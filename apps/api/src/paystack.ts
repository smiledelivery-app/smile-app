import { createHmac, timingSafeEqual } from 'node:crypto';

const baseUrl='https://api.paystack.co';

export class PaystackError extends Error {}
export type PaystackInitialization={authorizationUrl:string;accessCode:string;reference:string};
export type PaystackVerification={reference:string;amountMinor:number;status:string;metadata:Record<string,unknown>;channel:string|null;customerCode:string|null;accountNumber:string|null};

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

export async function assignTitanDva(input:{customerCode:string;firstName:string;lastName:string;phone:string},secret:string,fetcher?:typeof fetch) {
  const data=readRecord(await request<unknown>('/dedicated_account/assign',secret,{method:'POST',body:JSON.stringify({customer:input.customerCode,first_name:input.firstName,last_name:input.lastName,phone:input.phone,preferred_bank:'titan-paystack',country:'NG'})},fetcher));
  const bank=readRecord(data.bank);
  return {id:readString(data.id),accountNumber:readString(data.account_number),accountName:readString(data.account_name),bankName:readString(bank.name),bankSlug:readString(bank.slug)};
}
