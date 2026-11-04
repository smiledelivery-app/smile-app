import { createHmac, timingSafeEqual } from 'node:crypto';

const baseUrl='https://api.paystack.co';

export class PaystackError extends Error {}
export type PaystackInitialization={authorizationUrl:string;accessCode:string;reference:string};
export type PaystackVerification={reference:string;amountMinor:number;status:string;metadata:Record<string,unknown>;channel:string|null;customerCode:string|null;accountNumber:string|null};
export type PaystackBank={name:string;code:string};
export type PaystackTransfer={reference:string;transferCode:string|null;status:string};

function readString(value:unknown) { return typeof value==='string'?value:null; }
function readRecord(value:unknown):Record<string,unknown> { return value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{}; }

export function verifyPaystackSignature(raw:Buffer,signature:string|undefined,secret:string) {
  if(!signature||!secret) return false;
  const expected=createHmac('sha512',secret).update(raw).digest('hex');
  const received=Buffer.from(signature,'hex'); const expectedBuffer=Buffer.from(expected,'hex');
  return received.length===expectedBuffer.length&&timingSafeEqual(received,expectedBuffer);
}

async function request<T>(path:string,secret:string,init:RequestInit={},fetcher:typeof fetch=fetch):Promise<T> {
  if(!secret) throw new PaystackError('Paystack is not configured.');
  const response=await fetcher(`${baseUrl}${path}`,{...init,headers:{authorization:`Bearer ${secret}`,accept:'application/json','content-type':'application/json',...init.headers}});
  const body=readRecord(await response.json().catch(()=>null));
  if(!response.ok||body.status!==true) throw new PaystackError(readString(body.message)??'Paystack request failed.');
  return body.data as T;
}

export async function initializePaystackTransaction(input:{email:string;amountMinor:number;reference:string;metadata:Record<string,unknown>},secret:string,fetcher?:typeof fetch):Promise<PaystackInitialization> {
  const data=readRecord(await request<unknown>('/transaction/initialize',secret,{method:'POST',body:JSON.stringify({email:input.email,amount:input.amountMinor,reference:input.reference,metadata:input.metadata,currency:'NGN'})},fetcher));
  const authorizationUrl=readString(data.authorization_url),accessCode=readString(data.access_code),reference=readString(data.reference);
  if(!authorizationUrl||!accessCode||!reference) throw new PaystackError('Paystack returned an incomplete transaction authorization.');
  return {authorizationUrl,accessCode,reference};
}

export async function verifyPaystackTransaction(reference:string,secret:string,fetcher?:typeof fetch):Promise<PaystackVerification> {
  const data=readRecord(await request<unknown>(`/transaction/verify/${encodeURIComponent(reference)}`,secret,{},fetcher));
  const amount=data.amount; const amountMinor=typeof amount==='number'?amount:Number(amount);
  if(!Number.isSafeInteger(amountMinor)||amountMinor<1) throw new PaystackError('Paystack returned an invalid amount.');
  const customer=readRecord(data.customer),authorization=readRecord(data.authorization);
  return {reference:readString(data.reference)??reference,amountMinor,status:readString(data.status)??'',metadata:readRecord(data.metadata),channel:readString(data.channel),customerCode:readString(customer.customer_code),accountNumber:readString(authorization.account_number)};
}

export async function createPaystackCustomer(input:{email:string;firstName:string;lastName:string;phone?:string|null},secret:string,fetcher?:typeof fetch) {
  const data=readRecord(await request<unknown>('/customer',secret,{method:'POST',body:JSON.stringify({email:input.email,first_name:input.firstName,last_name:input.lastName,phone:input.phone??undefined})},fetcher));
  const code=readString(data.customer_code); if(!code) throw new PaystackError('Paystack did not return a customer code.'); return code;
}

export async function assignTitanDva(input:{customerCode:string},secret:string,fetcher?:typeof fetch) {
  // Paystack's sandbox uses its test bank provider slug. The Titan provider is
  // only valid when assigning real accounts with a live key.
  const preferredBank=secret.startsWith('sk_test_')?'test-bank':'titan-paystack';
  const data=readRecord(await request<unknown>('/dedicated_account',secret,{method:'POST',body:JSON.stringify({customer:input.customerCode,preferred_bank:preferredBank})},fetcher));
  const bank=readRecord(data.bank);
  const id=typeof data.id==='string'||typeof data.id==='number'?String(data.id):null;
  const accountNumber=readString(data.account_number);
  if(!id||!accountNumber)throw new PaystackError('Paystack did not return the dedicated account details.');
  return {id,accountNumber,accountName:readString(data.account_name),bankName:readString(bank.name),bankSlug:readString(bank.slug)};
}

export async function listPaystackBanks(secret:string,fetcher?:typeof fetch):Promise<PaystackBank[]> {
  const rows=await request<unknown>('/bank?currency=NGN&perPage=100',secret,{},fetcher);
  if(!Array.isArray(rows))throw new PaystackError('Paystack returned an invalid bank list.');
  return rows.map(value=>readRecord(value)).filter(row=>row.active!==false).map(row=>({name:readString(row.name)??'',code:readString(row.code)??''})).filter(bank=>bank.name&&bank.code);
}

export async function resolvePaystackBankAccount(accountNumber:string,bankCode:string,secret:string,fetcher?:typeof fetch) {
  const query=new URLSearchParams({account_number:accountNumber,bank_code:bankCode});
  const data=readRecord(await request<unknown>(`/bank/resolve?${query.toString()}`,secret,{},fetcher));
  const resolvedNumber=readString(data.account_number),accountName=readString(data.account_name);
  if(resolvedNumber!==accountNumber||!accountName)throw new PaystackError('Paystack could not verify this bank account.');
  return {accountNumber:resolvedNumber,accountName};
}

export async function createPaystackTransferRecipient(input:{name:string;accountNumber:string;bankCode:string},secret:string,fetcher?:typeof fetch) {
  const data=readRecord(await request<unknown>('/transferrecipient',secret,{method:'POST',body:JSON.stringify({type:'nuban',name:input.name,account_number:input.accountNumber,bank_code:input.bankCode,currency:'NGN'})},fetcher));
  const code=readString(data.recipient_code);
  if(!code)throw new PaystackError('Paystack did not return a transfer recipient code.');
  return {recipientCode:code};
}

export async function initiatePaystackTransfer(input:{amountMinor:number;recipientCode:string;reference:string;reason:string},secret:string,fetcher?:typeof fetch):Promise<PaystackTransfer> {
  const data=readRecord(await request<unknown>('/transfer',secret,{method:'POST',body:JSON.stringify({source:'balance',amount:input.amountMinor,recipient:input.recipientCode,reference:input.reference,reason:input.reason,currency:'NGN'})},fetcher));
  return {reference:readString(data.reference)??input.reference,transferCode:readString(data.transfer_code),status:readString(data.status)??'pending'};
}
