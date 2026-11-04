import dotenv from 'dotenv';
dotenv.config({path:process.env.ENV_FILE ?? '../../.env'});
import cors from 'cors';
import express, { type Request } from 'express';
import helmet from 'helmet';
import { PrismaClient, Role, VendorStatus, OrderStatus, DeliveryStatus, RiderOfferStatus, SupportTicketCategory, SupportTicketStatus, Prisma } from '@prisma/client';
import { createCipheriv, createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { calculateOrderAmounts, canVendorTransition } from './order-rules.js';
import { catalogSource } from './catalog-rules.js';
import { distanceKm, nearestEligibleRiders, rankRidersByRoadDistance } from './dispatch-rules.js';
import { drivingRoute, geocode, GoogleMapsError, mapProvider, MapServiceError, routeDistances } from './map-provider.js';
import { createProofCode } from './proof-codes.js';
import { createRiderNinUploadSignature, createVendorImageUploadSignature, MediaProviderError } from './media.js';
import { PaystackError, assignTitanDva, createPaystackCustomer, createPaystackTransferRecipient, initiatePaystackTransfer, initializePaystackTransaction, listPaystackBanks, resolvePaystackBankAccount, verifyPaystackSignature, verifyPaystackTransaction } from './paystack.js';
import { checkPhoneVerification, PhoneVerificationError, sendPhoneVerification, type PhoneVerificationChannel } from './phone-verification.js';
import { hasAdminPermission, isAdminRole, type AdminPermission } from './admin-permissions.js';

const app = express();
const prisma = new PrismaClient();
const port = Number(process.env.API_PORT ?? 4100);
const demoMode = process.env.DEMO_MODE === 'true' && process.env.NODE_ENV !== 'production';
const phoneVerificationBypass = process.env.PHONE_VERIFICATION_BYPASS === 'true' && process.env.NODE_ENV !== 'production';
function piiKey(){const secret=process.env.RIDER_PII_ENCRYPTION_KEY?.trim()||process.env.JWT_ACCESS_SECRET?.trim();if(!secret||secret.length<32)throw new Error('RIDER_PII_ENCRYPTION_KEY must be configured with at least 32 characters.');return createHash('sha256').update(secret).digest();}
function encryptRiderNin(value:string){const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',piiKey(),iv);const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;}
app.disable('x-powered-by');
app.use(helmet());
const allowedOrigins = new Set([process.env.WEB_ORIGIN ?? 'http://localhost:3000', process.env.ADMIN_ORIGIN ?? (process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:3001')].filter((origin):origin is string=>Boolean(origin)));
app.use(cors({ origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)), credentials: true }));
app.use(express.json({ limit: '1mb',verify:(req,_res,buffer)=>{(req as Request&{rawBody?:Buffer}).rawBody=buffer;} }));

type AuthRequest = Request & { auth?: { userId: string; roles: Role[] } };
type RawRequest = Request & { rawBody?:Buffer };
const emailSchema = z.string().trim().email().max(254).transform(v => v.toLowerCase());
const passSchema = z.string().min(10).max(128);
const phoneNumber = (raw:string) => {
  let value=raw.trim().replace(/[\s().-]/g,'');
  if(value.startsWith('00'))value=`+${value.slice(2)}`;
  if(/^0\d{10}$/.test(value))value=`+234${value.slice(1)}`;
  else if(/^234\d{8,13}$/.test(value))value=`+${value}`;
  return /^\+[1-9]\d{7,14}$/.test(value)?value:null;
};
const tokenHash = (token:string) => createHash('sha256').update(token).digest('hex');
const cancellationLimits={CUSTOMER:3,RIDER:3,VENDOR:5} as const;
const activeDeliveryStatuses:DeliveryStatus[]=[DeliveryStatus.ASSIGNED,DeliveryStatus.PICKED_UP];
type CancellationRole=keyof typeof cancellationLimits;
const cancellationReasons=['OUT_OF_STOCK','NOT_AVAILABLE','PRICE_CHANGED','VEHICLE_BREAKDOWN','NO_LONGER_INTERESTED','ORDERED_BY_MISTAKE','DELIVERY_TAKING_TOO_LONG','EMERGENCY','OTHER'] as const;
function nigeriaDayRange(now=new Date()){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Lagos',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const part=(name:string)=>Number(parts.find(item=>item.type===name)?.value);const start=new Date(Date.UTC(part('year'),part('month')-1,part('day'))-60*60_000);return {gte:start,lt:new Date(start.getTime()+24*60*60_000)};}
async function cancellationCount(actorId:string){return prisma.orderStatusEvent.count({where:{actorId,status:OrderStatus.CANCELLED,createdAt:nigeriaDayRange()}});}
function cancellationNote(reason:typeof cancellationReasons[number],details?:string){const labels={OUT_OF_STOCK:'Out of stock',NOT_AVAILABLE:'No longer available',PRICE_CHANGED:'Price has changed',VEHICLE_BREAKDOWN:'Vehicle breakdown',NO_LONGER_INTERESTED:'No longer interested',ORDERED_BY_MISTAKE:'Ordered by mistake',DELIVERY_TAKING_TOO_LONG:'Delivery taking too long',EMERGENCY:'Emergency',OTHER:'Other'};return `Cancelled: ${labels[reason]}${details?` — ${details}`:''}`;}
function cancellationInput(body:unknown){return z.object({reason:z.enum(cancellationReasons),details:z.string().trim().max(300).optional()}).refine(value=>value.reason!=='OTHER'||Boolean(value.details),{message:'Add a short explanation for your cancellation reason.'}).safeParse(body);}
const deliveryProofSecret = () => process.env.DELIVERY_OTP_SECRET??(process.env.NODE_ENV==='production'?undefined:process.env.JWT_ACCESS_SECRET);
const mappingConfigured = (kind:'routes'|'geocoding') => mapProvider()==='maplibre' ? !!process.env.OPENROUTESERVICE_API_KEY : kind==='routes' ? !!(process.env.GOOGLE_MAPS_ROUTES_API_KEY??process.env.MAPS_API_KEY) : !!(process.env.GOOGLE_MAPS_GEOCODING_API_KEY??process.env.GOOGLE_MAPS_ROUTES_API_KEY??process.env.MAPS_API_KEY);
const paystackSecret = () => process.env.PAYSTACK_SECRET_KEY ?? '';
const coordinatePair = z.object({latitude:z.number().min(-90).max(90).optional(),longitude:z.number().min(-180).max(180).optional()}).refine(value=>(value.latitude===undefined)===(value.longitude===undefined),'Provide both latitude and longitude.');
const GOOGLE_COORDINATE_TTL_MS=30*24*60*60_000;
async function freshVendorCoordinates(vendor:{id:string;address:string;latitude:Prisma.Decimal|null;longitude:Prisma.Decimal|null;geocodedAt:Date|null}) {
  if(vendor.latitude!==null&&vendor.longitude!==null&&(!vendor.geocodedAt||Date.now()-vendor.geocodedAt.getTime()<GOOGLE_COORDINATE_TTL_MS))return {latitude:Number(vendor.latitude),longitude:Number(vendor.longitude)};
  if(vendor.geocodedAt)await prisma.vendor.update({where:{id:vendor.id},data:{latitude:null,longitude:null,geocodedAt:null}});
  if(!mappingConfigured('geocoding'))return null;
  try{const point=await geocode(`${vendor.address}, Nigeria`);await prisma.vendor.update({where:{id:vendor.id},data:{latitude:point.latitude,longitude:point.longitude,geocodedAt:new Date()}});return point;}
  catch(error){console.warn(JSON.stringify({event:'vendor_geocoding_failed',error:error instanceof Error?error.message:'unknown'}));return null;}
}
async function freshAddressCoordinates(address:{id:string;line1:string;city:string;latitude:Prisma.Decimal|null;longitude:Prisma.Decimal|null;geocodedAt:Date|null}) {
  if(address.latitude!==null&&address.longitude!==null&&(!address.geocodedAt||Date.now()-address.geocodedAt.getTime()<GOOGLE_COORDINATE_TTL_MS))return {latitude:Number(address.latitude),longitude:Number(address.longitude)};
  if(address.geocodedAt)await prisma.address.update({where:{id:address.id},data:{latitude:null,longitude:null,geocodedAt:null}});
  if(!mappingConfigured('geocoding'))return null;
  try{const point=await geocode(`${address.line1}, ${address.city}, Nigeria`);await prisma.address.update({where:{id:address.id},data:{latitude:point.latitude,longitude:point.longitude,geocodedAt:new Date()}});return point;}
  catch(error){console.warn(JSON.stringify({event:'address_geocoding_failed',error:error instanceof Error?error.message:'unknown'}));return null;}
}
async function pruneExpiredGoogleCoordinates() {
  const cutoff=new Date(Date.now()-GOOGLE_COORDINATE_TTL_MS);
  await Promise.all([
    prisma.address.updateMany({where:{geocodedAt:{lt:cutoff}},data:{latitude:null,longitude:null,geocodedAt:null}}),
    prisma.vendor.updateMany({where:{geocodedAt:{lt:cutoff}},data:{latitude:null,longitude:null,geocodedAt:null}}),
  ]);
}
const deliveryOtp = (deliveryId:string) => {
  const secret=deliveryProofSecret();
  if(!secret) throw new Error('DELIVERY_OTP_SECRET is not configured.');
  return createProofCode(secret,'customer-delivery',deliveryId);
};
const vendorPickupOtp = (deliveryId:string) => {
  const secret=deliveryProofSecret();
  if(!secret) throw new Error('DELIVERY_OTP_SECRET is not configured.');
  return createProofCode(secret,'vendor-pickup',deliveryId);
};
async function dispatchDeliveryOffers(deliveryId:string) {
  const delivery=await prisma.delivery.findUnique({where:{id:deliveryId},include:{order:{include:{vendor:true}},offers:{select:{riderId:true,status:true,expiresAt:true}}}});
  if(!delivery||delivery.assignedRiderId) return 0;
  if(delivery.offers.some(offer=>offer.status===RiderOfferStatus.PENDING&&offer.expiresAt>new Date()))return 0;
  const vendor=delivery.order.vendor;
  const pickup=await freshVendorCoordinates(vendor);
  if(!pickup) { await prisma.delivery.updateMany({where:{id:deliveryId,assignedRiderId:null},data:{status:DeliveryStatus.UNASSIGNED}});return 0; }
  const previouslyOffered=new Set(delivery.offers.map(offer=>offer.riderId));
  const freshSince=new Date(Date.now()-10*60_000);
  const candidateRiders=await prisma.riderProfile.findMany({where:{status:VendorStatus.APPROVED,available:true,location:{is:{updatedAt:{gte:freshSince}}},offers:{none:{status:RiderOfferStatus.PENDING,expiresAt:{gt:new Date()}}},deliveries:{none:{status:{in:[DeliveryStatus.ASSIGNED,DeliveryStatus.PICKED_UP]}}}},include:{location:true}});
  const riders=(await Promise.all(candidateRiders.map(async rider=>({rider,count:await cancellationCount(rider.userId)})))).filter(item=>item.count<cancellationLimits.RIDER).map(item=>item.rider);
  const area=vendor.address.trim().toLowerCase();
  const maxDistance=Number(process.env.RIDER_MAX_PICKUP_KM??12);
  const configuredLimit=Number.parseInt(process.env.GOOGLE_ROUTES_MAX_ORIGINS??'25',10);
  const shortlistLimit=Number.isFinite(configuredLimit)?Math.max(1,Math.min(49,configuredLimit)):25;
  const located=riders.flatMap(rider=>rider.location?[{id:rider.id,latitude:Number(rider.location.latitude),longitude:Number(rider.location.longitude),serviceArea:rider.serviceArea,rider}]:[]);
  const shortlist=nearestEligibleRiders(located,pickup,area,previouslyOffered,maxDistance,shortlistLimit);
  const apiKey=mappingConfigured('routes');
  let nearby:Array<{rider:(typeof shortlist)[number]['rider'];km:number;meters:number}> = [];
  if(shortlist.length&&apiKey){
    try{
      const roadDistances=await routeDistances(shortlist.map(candidate=>({id:candidate.id,coordinate:{latitude:candidate.latitude,longitude:candidate.longitude}})),pickup);
      nearby=rankRidersByRoadDistance(shortlist, new Map([...roadDistances].map(([id,result])=>[id,result.distanceMeters/1000])),maxDistance,3).map(candidate=>({rider:candidate.rider,km:candidate.pickupDistanceKm,meters:Math.round(roadDistances.get(candidate.id)!.distanceMeters)}));
    }catch(error){
      console.warn(JSON.stringify({event:'google_routes_dispatch_failed',deliveryId,error:error instanceof GoogleMapsError?error.message:'unknown'}));
      if(process.env.NODE_ENV!=='production'||process.env.GOOGLE_MAPS_ALLOW_STRAIGHT_LINE_FALLBACK==='true')nearby=shortlist.slice(0,3).map(candidate=>({rider:candidate.rider,km:candidate.pickupDistanceKm,meters:Math.round(candidate.pickupDistanceKm*1000)}));
    }
  }else if(shortlist.length&&process.env.NODE_ENV!=='production'){
    nearby=shortlist.slice(0,3).map(candidate=>({rider:candidate.rider,km:candidate.pickupDistanceKm,meters:Math.round(candidate.pickupDistanceKm*1000)}));
  }
  if(!nearby.length) { await prisma.delivery.updateMany({where:{id:deliveryId,assignedRiderId:null},data:{status:DeliveryStatus.UNASSIGNED}});return 0; }
  const expiresAt=new Date(Date.now()+120_000);
  return prisma.$transaction(async tx=>{
    const current=await tx.delivery.findUnique({where:{id:deliveryId},include:{offers:{where:{status:RiderOfferStatus.PENDING,expiresAt:{gt:new Date()}},select:{id:true}}}});
    if(!current||current.assignedRiderId||current.offers.length)return 0;
    const created=await tx.riderOffer.createMany({data:nearby.map(({rider,meters})=>({deliveryId,riderId:rider.id,pickupDistanceMeters:meters,expiresAt})),skipDuplicates:true});
    if(!created.count)return 0;
    await tx.delivery.updateMany({where:{id:deliveryId,assignedRiderId:null},data:{status:DeliveryStatus.OFFERING}});
    return created.count;
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}
async function dispatchWaitingDeliveries() {
  const waiting=await prisma.delivery.findMany({where:{status:DeliveryStatus.UNASSIGNED,order:{status:OrderStatus.READY_FOR_PICKUP}},select:{id:true},take:100});
  for(const delivery of waiting) await dispatchDeliveryOffers(delivery.id);
}
function deriveKey(password:string,salt:string,length:number) {
  return new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,length,(error,key)=>error?reject(error):resolve(key)));
}

async function makePasswordHash(password:string) {
  const salt = randomBytes(16).toString('hex');
  const key = await deriveKey(password,salt,64);
  return `scrypt$${salt}$${key.toString('hex')}`;
}
async function verifyPassword(password:string,stored:string) {
  const [kind,salt,keyHex] = stored.split('$');
  if(kind !== 'scrypt' || !salt || !keyHex) return false;
  const expected = Buffer.from(keyHex,'hex');
  const actual = await deriveKey(password,salt,expected.length);
  return actual.length === expected.length && timingSafeEqual(actual,expected);
}

function nameParts(name:string) { const [firstName='Makanza',...rest]=name.trim().split(/\s+/); return {firstName,lastName:rest.join(' ')||'User'}; }
const dvaProvisioning=new Set<string>();
async function ensureWallet(userId:string) {
  return prisma.wallet.upsert({where:{userId},update:{},create:{userId,dvaStatus:'PENDING'}});
}
async function provisionDva(userId:string) {
  if(dvaProvisioning.has(userId))return;
  dvaProvisioning.add(userId);
  try {
    const user=await prisma.user.findUnique({where:{id:userId},select:{id:true,name:true,email:true,phone:true,isDemo:true}});
    if(!user)return;
    if(user.isDemo)return;
    const wallet=await ensureWallet(user.id); if(wallet.dvaStatus==='ACTIVE'||wallet.dvaAccountNumber)return;
    if(!paystackSecret()||!user.email||!user.phone){const missing=!paystackSecret()?'PAYSTACK_SECRET_KEY':!user.email?'email_address':'phone_number';await prisma.wallet.update({where:{id:wallet.id},data:{dvaStatus:'FAILED'}});console.warn(JSON.stringify({event:'dva_provision_skipped',userId,reason:`missing_${missing}`}));return;}
    const names=nameParts(user.name);
    const customerCode=wallet.paystackCustomerCode??await createPaystackCustomer({...names,email:user.email,phone:user.phone},paystackSecret());
    if(!wallet.paystackCustomerCode)await prisma.wallet.update({where:{id:wallet.id},data:{paystackCustomerCode:customerCode}});
    const dva=await assignTitanDva({customerCode},paystackSecret());
    await prisma.wallet.update({where:{userId:user.id},data:{paystackCustomerCode:customerCode,dvaId:dva.id,dvaAccountNumber:dva.accountNumber,dvaAccountName:dva.accountName,dvaBankName:dva.bankName,dvaBankSlug:dva.bankSlug,dvaStatus:'ACTIVE'}});
  } catch(error) {
    await prisma.wallet.update({where:{userId},data:{dvaStatus:'FAILED'}}).catch(()=>undefined);
    console.error(JSON.stringify({event:'dva_provision_failed',userId,errorType:error instanceof Error?error.name:'unknown',message:(error instanceof Error?error.message:'Unknown Paystack error').slice(0,180)}));
  } finally {
    dvaProvisioning.delete(userId);
  }
}
async function creditWallet(input:{userId:string;amountMinor:number;reference:string;type:string;orderId?:string;metadata?:Prisma.InputJsonValue}) {
  if(!Number.isSafeInteger(input.amountMinor)||input.amountMinor<1) throw new Error('INVALID_WALLET_AMOUNT');
  return prisma.$transaction(async tx=>{
    const existing=await tx.walletTransaction.findUnique({where:{reference:input.reference},select:{id:true}}); if(existing) return {credited:false};
    const wallet=await tx.wallet.upsert({where:{userId:input.userId},update:{},create:{userId:input.userId,dvaStatus:'PENDING'}});
    const updated=await tx.wallet.update({where:{id:wallet.id},data:{balanceMinor:{increment:input.amountMinor}}});
    await tx.walletTransaction.create({data:{walletId:wallet.id,userId:input.userId,type:input.type,direction:'CREDIT',amountMinor:input.amountMinor,balanceAfter:updated.balanceMinor,reference:input.reference,orderId:input.orderId,metadata:input.metadata}});
    return {credited:true,balanceMinor:updated.balanceMinor};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}
async function settleVendorTransfer(reference:string,event:'transfer.success'|'transfer.failed'|'transfer.reversed') {
  const transaction=await prisma.walletTransaction.findUnique({where:{reference},select:{id:true,walletId:true,userId:true,amountMinor:true,status:true,type:true}});
  if(!transaction||transaction.type!=='WITHDRAWAL'||(event!=='transfer.reversed'&&transaction.status!=='PENDING')||(event==='transfer.reversed'&&!['PENDING','SUCCEEDED'].includes(transaction.status)))return;
  await prisma.$transaction(async tx=>{
    const changed=await tx.walletTransaction.updateMany({where:{id:transaction.id,status:event==='transfer.reversed'?{in:['PENDING','SUCCEEDED']}:'PENDING'},data:{status:event==='transfer.success'?'SUCCEEDED':event==='transfer.reversed'?'REVERSED':'FAILED'}});
    if(!changed.count||event==='transfer.success')return;
    const wallet=await tx.wallet.update({where:{id:transaction.walletId},data:{balanceMinor:{increment:transaction.amountMinor}},select:{balanceMinor:true}});
    const reversalReference=`swr_${createHash('sha256').update(reference).digest('hex').slice(0,40)}`;
    await tx.walletTransaction.create({data:{walletId:transaction.walletId,userId:transaction.userId,type:'WITHDRAWAL_REVERSAL',direction:'CREDIT',status:'SUCCEEDED',amountMinor:transaction.amountMinor,balanceAfter:wallet.balanceMinor,reference:reversalReference,metadata:{withdrawalReference:reference,providerEvent:event}}});
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}
async function debitWalletForOrder(userId:string,orderId:string,amountMinor:number) {
  return prisma.$transaction(async tx=>{
    const existing=await tx.walletTransaction.findFirst({where:{userId,orderId,type:'ORDER_PAYMENT'},select:{id:true}});if(existing)return {paid:false,replayed:true};
    const wallet=await tx.wallet.upsert({where:{userId},update:{},create:{userId,dvaStatus:'PENDING'}});
    const debited=await tx.wallet.updateMany({where:{id:wallet.id,balanceMinor:{gte:amountMinor},status:'ACTIVE'},data:{balanceMinor:{decrement:amountMinor}}});
    if(debited.count!==1) return {paid:false,replayed:false};
    const updated=await tx.wallet.findUniqueOrThrow({where:{id:wallet.id},select:{balanceMinor:true}});
    await tx.walletTransaction.create({data:{walletId:wallet.id,userId,type:'ORDER_PAYMENT',direction:'DEBIT',amountMinor,balanceAfter:updated.balanceMinor,reference:`wallet_order_${orderId}`,orderId}});
    const changed=await tx.order.updateMany({where:{id:orderId,customerId:userId,status:OrderStatus.PENDING_PAYMENT},data:{status:OrderStatus.CONFIRMED}});
    if(changed.count!==1) throw new Error('ORDER_PAYMENT_STATE_CONFLICT');
    await tx.orderStatusEvent.create({data:{orderId,status:OrderStatus.CONFIRMED,actorId:userId,note:'Wallet payment confirmed'}});
    await tx.payment.create({data:{orderId,amountMinor,status:'SUCCEEDED',provider:'wallet',providerReference:`wallet_order_${orderId}`}});
    return {paid:true,balanceMinor:updated.balanceMinor};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}
async function requireUser(req:AuthRequest,res:express.Response,next:express.NextFunction) {
  const header = req.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
  if(!token) return res.status(401).json({error:{code:'UNAUTHENTICATED',message:'Sign in to continue.'}});
  try {
    const session = await prisma.session.findUnique({where:{tokenHash:tokenHash(token)},include:{user:true}});
    if(!session || session.revokedAt || session.expiresAt <= new Date()) return res.status(401).json({error:{code:'SESSION_EXPIRED',message:'Your session has expired. Sign in again.'}});
    req.auth = {userId:session.userId,roles:session.user.roles};
    return next();
  } catch(error) { return next(error); }
}
function requireRole(role:Role) {
  return (req:AuthRequest,res:express.Response,next:express.NextFunction) => {
    if(!req.auth?.roles.includes(role)) return res.status(403).json({error:{code:'FORBIDDEN',message:'You do not have access to this action.'}});
    next();
  };
}
function requireAdminPermission(permission:AdminPermission) {
  return (req:AuthRequest,res:express.Response,next:express.NextFunction) => {
    if(!req.auth||!hasAdminPermission(req.auth.roles,permission)) return res.status(403).json({error:{code:'FORBIDDEN',message:'You do not have access to this administrative action.'}});
    next();
  };
}
function routeParam(req:Request,name:string) {
  const value=req.params[name];
  return typeof value==='string'?value:value?.[0]??'';
}
function requireSuperAdmin(req:AuthRequest,res:express.Response,next:express.NextFunction) {
  if(!req.auth||!req.auth.roles.some(role=>role===Role.ADMIN||role===Role.SUPER_ADMIN)) return res.status(403).json({error:{code:'FORBIDDEN',message:'Only a super administrator can manage administrator accounts.'}});
  next();
}

// Process-local guard protects a single development API process. Deployments should
// replace this with a shared Redis-backed limiter before exposing authentication.
const loginAttempts = new Map<string,{count:number;expires:number}>();
app.use('/api/v1/auth', (req,res,next) => {
  const key = req.ip ?? 'unknown'; const now = Date.now(); const previous = loginAttempts.get(key);
  const entry = !previous || previous.expires < now ? {count:0,expires:now+15*60_000} : previous;
  entry.count += 1; loginAttempts.set(key,entry);
  if(entry.count > 30) return res.status(429).json({error:{code:'RATE_LIMITED',message:'Too many account requests. Try again later.'}});
  next();
});

app.get('/api/v1/health', (_req,res) => res.json({ok:true,service:'makanza-api',timestamp:new Date().toISOString()}));
app.get('/api/v1/ready',async (_req,res) => {
  try { await prisma.$queryRaw`SELECT 1`; return res.json({ok:true,database:'ready'}); }
  catch { return res.status(503).json({ok:false,database:'unavailable'}); }
});

const addressInput = z.object({label:z.string().trim().min(1).max(40),line1:z.string().trim().min(3).max(200),city:z.string().trim().min(2).max(80)}).and(coordinatePair);
app.get('/api/v1/addresses',requireUser,async (req:AuthRequest,res,next) => {
  try { const data = await prisma.address.findMany({where:{userId:req.auth!.userId},orderBy:{createdAt:'desc'}}); return res.json({data}); }
  catch(error) { return next(error); }
});
app.post('/api/v1/addresses',requireUser,async (req:AuthRequest,res,next) => {
  const input = addressInput.safeParse(req.body);
  if(!input.success) return res.status(400).json({error:{code:'INVALID_ADDRESS',message:'Enter a label, street address, and city.'}});
  try {
    let point = input.data.latitude!==undefined ? {latitude:input.data.latitude,longitude:input.data.longitude!} : null;
    let geocodedAt:Date|null=null;
    if(!point&&mappingConfigured('geocoding')){try{point=await geocode(`${input.data.line1}, ${input.data.city}, Nigeria`);geocodedAt=new Date();}catch(error){console.warn(JSON.stringify({event:'address_geocoding_failed',error:error instanceof Error?error.message:'unknown'}));}}
    const data = await prisma.address.create({data:{label:input.data.label,line1:input.data.line1,city:input.data.city,userId:req.auth!.userId,latitude:point?.latitude,longitude:point?.longitude,geocodedAt}}); return res.status(201).json({data});
  }
  catch(error) { return next(error); }
});
app.patch('/api/v1/addresses/:addressId',requireUser,async(req:AuthRequest,res,next)=>{
  const input=addressInput.safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'INVALID_ADDRESS',message:'Enter a label, street address, and city.'}});
  try{
    let point=input.data.latitude!==undefined?{latitude:input.data.latitude,longitude:input.data.longitude!}:null;let geocodedAt:Date|null=null;
    if(!point&&mappingConfigured('geocoding')){try{point=await geocode(`${input.data.line1}, ${input.data.city}, Nigeria`);geocodedAt=new Date();}catch(error){console.warn(JSON.stringify({event:'address_geocoding_failed',error:error instanceof Error?error.message:'unknown'}));}}
    const addressId=routeParam(req,'addressId');
    const updated=await prisma.address.updateMany({where:{id:addressId,userId:req.auth!.userId},data:{...input.data,latitude:point?.latitude,longitude:point?.longitude,geocodedAt}});
    if(!updated.count)return res.status(404).json({error:{code:'ADDRESS_NOT_FOUND',message:'Saved place not found.'}});
    return res.json({data:await prisma.address.findUnique({where:{id:addressId}})});
  }catch(error){return next(error);}
});
app.delete('/api/v1/addresses/:addressId',requireUser,async(req:AuthRequest,res,next)=>{
  try{
    const address=await prisma.address.findFirst({where:{id:routeParam(req,'addressId'),userId:req.auth!.userId},select:{id:true}});if(!address)return res.status(404).json({error:{code:'ADDRESS_NOT_FOUND',message:'Saved place not found.'}});
    if(await prisma.order.count({where:{addressId:address.id}}))return res.status(409).json({error:{code:'ADDRESS_IN_USE',message:'This place is attached to an order and cannot be removed.'}});
    await prisma.address.delete({where:{id:address.id}});return res.status(204).end();
  }catch(error){return next(error);}
});

app.post('/api/v1/auth/register', async (req,res,next) => {
  const input = z.object({name:z.string().trim().min(2).max(100),email:emailSchema,password:passSchema,phone:z.string().trim().min(8).max(24),channel:z.enum(['sms','whatsapp'])}).safeParse(req.body);
  if(!input.success) return res.status(400).json({error:{code:'INVALID_INPUT',message:'Provide your name, email, phone number, password, and SMS or WhatsApp delivery choice.'}});
  const phone=phoneNumber(input.data.phone);
  if(!phone)return res.status(400).json({error:{code:'INVALID_PHONE',message:'Enter a valid phone number with a country code, such as +2348012345678.'}});
  try {
    await prisma.pendingPhoneSignup.deleteMany({where:{expiresAt:{lt:new Date()}}});
    const existingUser=await prisma.user.findFirst({where:{OR:[{email:input.data.email},{phone}]},select:{id:true}});
    if(existingUser)return res.status(409).json({error:{code:'ACCOUNT_EXISTS',message:'An account already uses that email or phone number.'}});
    if(phoneVerificationBypass){
      const passwordHash=await makePasswordHash(input.data.password);
      const result=await prisma.$transaction(async(tx)=>{
        const existing=await tx.user.findFirst({where:{OR:[{email:input.data.email},{phone}]},select:{id:true}});
        if(existing)throw new Error('ACCOUNT_EXISTS');
        const user=await tx.user.create({data:{name:input.data.name,email:input.data.email,phone,passwordHash,roles:[Role.CUSTOMER],isDemo:true,wallet:{create:{dvaStatus:'PENDING'}}}});
        const token=randomBytes(32).toString('base64url');const expiresAt=new Date(Date.now()+30*24*60*60_000);
        await tx.session.create({data:{userId:user.id,tokenHash:tokenHash(token),expiresAt}});
        await tx.pendingPhoneSignup.deleteMany({where:{OR:[{email:input.data.email},{phone}]}});
        return{token,expiresAt,user:{id:user.id,name:user.name,email:user.email,phone:user.phone,roles:user.roles}};
      });
      return res.status(201).json({data:result});
    }
    const existingPending=await prisma.pendingPhoneSignup.findFirst({where:{OR:[{email:input.data.email},{phone}]}});
    if(existingPending&&Date.now()-existingPending.lastSentAt.getTime()<60_000)return res.status(429).json({error:{code:'VERIFICATION_WAIT',message:'Wait one minute before requesting another verification code.'}});
    if(existingPending)await prisma.pendingPhoneSignup.delete({where:{id:existingPending.id}});
    const passwordHash=await makePasswordHash(input.data.password);
    const pending=await prisma.pendingPhoneSignup.create({data:{name:input.data.name,email:input.data.email,phone,passwordHash,channel:input.data.channel,expiresAt:new Date(Date.now()+15*60_000)}});
    try{const providerPinId=await sendPhoneVerification(phone,input.data.channel as PhoneVerificationChannel);await prisma.pendingPhoneSignup.update({where:{id:pending.id},data:{providerPinId}});}
    catch(error){await prisma.pendingPhoneSignup.deleteMany({where:{id:pending.id}});throw error;}
    return res.status(202).json({data:{phone,channel:input.data.channel,expiresAt:pending.expiresAt}});
  } catch(error) {
    if(error instanceof Error&&error.message==='ACCOUNT_EXISTS')return res.status(409).json({error:{code:'ACCOUNT_EXISTS',message:'An account already uses that email or phone number.'}});
    if(error instanceof PhoneVerificationError)return res.status(error.status).json({error:{code:error.status===503?'PHONE_VERIFICATION_UNAVAILABLE':'PHONE_VERIFICATION_SEND_FAILED',message:error.message}});
    if(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return res.status(409).json({error:{code:'ACCOUNT_EXISTS',message:'An account already uses that email or phone number.'}});
    return next(error);
  }
});

app.post('/api/v1/auth/register/resend',async(req,res)=>{
  const input=z.object({phone:z.string().trim().min(8).max(24)}).safeParse(req.body);
  if(!input.success)return res.status(400).json({error:{code:'INVALID_PHONE',message:'Enter the phone number used for signup.'}});
  const phone=phoneNumber(input.data.phone);if(!phone)return res.status(400).json({error:{code:'INVALID_PHONE',message:'Enter a valid phone number with a country code.'}});
  try{
    const pending=await prisma.pendingPhoneSignup.findUnique({where:{phone}});
    if(!pending||pending.expiresAt.getTime()<=Date.now())return res.status(410).json({error:{code:'SIGNUP_EXPIRED',message:'This signup has expired. Start again to request a new code.'}});
    if(Date.now()-pending.lastSentAt.getTime()<60_000)return res.status(429).json({error:{code:'VERIFICATION_WAIT',message:'Wait one minute before requesting another verification code.'}});
    const providerPinId=await sendPhoneVerification(phone,pending.channel as PhoneVerificationChannel);
    await prisma.pendingPhoneSignup.update({where:{id:pending.id},data:{lastSentAt:new Date(),providerPinId}});
    return res.json({data:{phone,channel:pending.channel,expiresAt:pending.expiresAt}});
  }catch(error){if(error instanceof PhoneVerificationError)return res.status(error.status).json({error:{code:'PHONE_VERIFICATION_SEND_FAILED',message:error.message}});return res.status(500).json({error:{code:'PHONE_VERIFICATION_SEND_FAILED',message:'Could not send a verification code. Try again.'}});}
});

app.post('/api/v1/auth/register/verify',async(req,res,next)=>{
  const input=z.object({phone:z.string().trim().min(8).max(24),code:z.string().regex(/^\d{4,10}$/)}).safeParse(req.body);
  if(!input.success)return res.status(400).json({error:{code:'INVALID_VERIFICATION',message:'Enter the phone number and verification code.'}});
  const phone=phoneNumber(input.data.phone);if(!phone)return res.status(400).json({error:{code:'INVALID_PHONE',message:'Enter a valid phone number with a country code.'}});
  try{
    const pending=await prisma.pendingPhoneSignup.findUnique({where:{phone}});
    if(!pending||pending.expiresAt.getTime()<=Date.now()){if(pending)await prisma.pendingPhoneSignup.deleteMany({where:{id:pending.id}});return res.status(410).json({error:{code:'SIGNUP_EXPIRED',message:'This signup has expired. Start again to request a new code.'}});}
    if(!await checkPhoneVerification(pending.providerPinId??'',phone,input.data.code))return res.status(400).json({error:{code:'VERIFICATION_CODE_INCORRECT',message:'That code is incorrect or expired. Check it and try again.'}});
    const result=await prisma.$transaction(async(tx)=>{
      const existing=await tx.user.findFirst({where:{OR:[{email:pending.email},{phone:pending.phone}]},select:{id:true}});
      if(existing)throw new Error('ACCOUNT_EXISTS');
      const user=await tx.user.create({data:{name:pending.name,email:pending.email,phone:pending.phone,phoneVerifiedAt:new Date(),passwordHash:pending.passwordHash,roles:[Role.CUSTOMER],wallet:{create:{dvaStatus:'PENDING'}}}});
      const token=randomBytes(32).toString('base64url');const expiresAt=new Date(Date.now()+30*24*60*60_000);
      await tx.session.create({data:{userId:user.id,tokenHash:tokenHash(token),expiresAt}});
      await tx.pendingPhoneSignup.delete({where:{id:pending.id}});
      return{token,expiresAt,user:{id:user.id,name:user.name,email:user.email,phone:user.phone,roles:user.roles}};
    });
    void provisionDva(result.user.id);
    return res.status(201).json({data:result});
  }catch(error){
    if(error instanceof Error&&error.message==='ACCOUNT_EXISTS')return res.status(409).json({error:{code:'ACCOUNT_EXISTS',message:'An account already uses that email or phone number.'}});
    if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')return res.status(409).json({error:{code:'ACCOUNT_EXISTS',message:'An account already uses that email or phone number.'}});
    if(error instanceof PhoneVerificationError)return res.status(error.status).json({error:{code:'PHONE_VERIFICATION_UNAVAILABLE',message:error.message}});
    return next(error);
  }
});

app.post('/api/v1/auth/login', async (req,res,next) => {
  const input = z.object({email:emailSchema,password:passSchema}).safeParse(req.body);
  if(!input.success) return res.status(400).json({error:{code:'INVALID_INPUT',message:'Check your email and password.'}});
  try {
    const user = await prisma.user.findUnique({where:{email:input.data.email}});
    if(!user || !await verifyPassword(input.data.password,user.passwordHash)) return res.status(401).json({error:{code:'INVALID_CREDENTIALS',message:'Email or password is incorrect.'}});
    const token = randomBytes(32).toString('base64url'); const expiresAt = new Date(Date.now()+30*24*60*60_000);
    await prisma.session.create({data:{userId:user.id,tokenHash:tokenHash(token),expiresAt}});
    return res.json({data:{token,expiresAt,user:{id:user.id,name:user.name,email:user.email,phone:user.phone,roles:user.roles}}});
  } catch(error) { return next(error); }
});
app.get('/api/v1/auth/me',requireUser,(req:AuthRequest,res) => res.json({data:req.auth}));
app.get('/api/v1/auth/profile',requireUser,async(req:AuthRequest,res,next)=>{
  try{
    const user=await prisma.user.findUnique({where:{id:req.auth!.userId},select:{id:true,name:true,email:true,phone:true}});
    if(!user)return res.status(404).json({error:{code:'ACCOUNT_NOT_FOUND',message:'Account not found.'}});
    void provisionDva(user.id);
    return res.json({data:user});
  }catch(error){return next(error);}
});
app.patch('/api/v1/auth/profile',requireUser,async(req:AuthRequest,res,next)=>{
  const input=z.object({name:z.string().trim().min(2).max(100),phone:z.string().trim().min(7).max(24).nullable()}).safeParse(req.body);
  if(!input.success)return res.status(400).json({error:{code:'INVALID_PROFILE',message:'Enter a name and a valid phone number, or leave phone blank.'}});
  try{
    const current=await prisma.user.findUnique({where:{id:req.auth!.userId},select:{phone:true}});
    if(!current)return res.status(404).json({error:{code:'ACCOUNT_NOT_FOUND',message:'Account not found.'}});
    if(input.data.phone!==current.phone)return res.status(409).json({error:{code:'PHONE_VERIFICATION_REQUIRED',message:'Phone number changes must be verified before they can be saved.'}});
    const user=await prisma.user.update({where:{id:req.auth!.userId},data:{name:input.data.name,phone:input.data.phone},select:{id:true,name:true,email:true,phone:true}});
    return res.json({data:user});
  }catch(error){
    if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')return res.status(409).json({error:{code:'PHONE_IN_USE',message:'That phone number is already linked to another account.'}});
    return next(error);
  }
});
app.delete('/api/v1/auth/account',requireUser,async(req:AuthRequest,res,next)=>{
  const input=z.object({password:z.string().min(1).max(128)}).safeParse(req.body);
  if(!input.success)return res.status(400).json({error:{code:'PASSWORD_REQUIRED',message:'Enter your current password to delete your account.'}});
  try{
    const user=await prisma.user.findUnique({where:{id:req.auth!.userId},select:{id:true,passwordHash:true,roles:true}});
    if(!user)return res.status(404).json({error:{code:'ACCOUNT_NOT_FOUND',message:'Account not found.'}});
    if(!await verifyPassword(input.data.password,user.passwordHash))return res.status(400).json({error:{code:'CURRENT_PASSWORD_INCORRECT',message:'Your password is incorrect.'}});
    if(user.roles.includes(Role.VENDOR)||user.roles.includes(Role.RIDER))return res.status(409).json({error:{code:'BUSINESS_ACCOUNT',message:'Contact Smile support to close an account with vendor or rider access.'}});
    const replacementPassword=await makePasswordHash(randomBytes(32).toString('hex'));
    const now=new Date();
    await prisma.$transaction([
      prisma.address.updateMany({where:{userId:user.id},data:{label:'Removed',line1:'Removed',city:'Removed',latitude:null,longitude:null,geocodedAt:null}}),
      prisma.user.update({where:{id:user.id},data:{name:'Deleted account',email:null,phone:null,passwordHash:replacementPassword}}),
      prisma.session.updateMany({where:{userId:user.id,revokedAt:null},data:{revokedAt:now}})
    ]);
    return res.status(204).end();
  }catch(error){return next(error);}
});
app.post('/api/v1/auth/logout',requireUser,async (req:AuthRequest,res,next) => {
  const token = req.header('authorization')!.slice(7);
  try { await prisma.session.updateMany({where:{tokenHash:tokenHash(token),revokedAt:null},data:{revokedAt:new Date()}}); return res.status(204).end(); }
  catch(error) { return next(error); }
});
app.post('/api/v1/auth/password',requireUser,async(req:AuthRequest,res,next)=>{
  const input=z.object({currentPassword:z.string().min(1).max(128),newPassword:passSchema}).safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'INVALID_PASSWORD',message:'Choose a new password with at least 10 characters.'}});
  try{
    const user=await prisma.user.findUnique({where:{id:req.auth!.userId},select:{id:true,passwordHash:true}});if(!user||!await verifyPassword(input.data.currentPassword,user.passwordHash))return res.status(400).json({error:{code:'CURRENT_PASSWORD_INCORRECT',message:'Your current password is incorrect.'}});
    const authToken=req.header('authorization')!.slice(7);const currentHash=tokenHash(authToken);const passwordHash=await makePasswordHash(input.data.newPassword);const now=new Date();
    await prisma.$transaction([prisma.user.update({where:{id:user.id},data:{passwordHash}}),prisma.session.updateMany({where:{userId:user.id,revokedAt:null,tokenHash:{not:currentHash}},data:{revokedAt:now}})]);
    return res.json({data:{changed:true}});
  }catch(error){return next(error);}
});

app.post('/api/v1/vendor/media/sign',requireUser,(req:AuthRequest,res)=>{
  try{return res.json({data:createVendorImageUploadSignature(req.auth!.userId)});}
  catch(error){if(error instanceof MediaProviderError)return res.status(error.status).json({error:{code:'MEDIA_UPLOAD_UNAVAILABLE',message:error.message}});return res.status(500).json({error:{code:'MEDIA_UPLOAD_UNAVAILABLE',message:'Could not prepare the image upload.'}});}
});
app.post('/api/v1/rider/media/sign-nin',requireUser,(req:AuthRequest,res)=>{
  try{return res.json({data:createRiderNinUploadSignature(req.auth!.userId)});}
  catch(error){if(error instanceof MediaProviderError)return res.status(error.status).json({error:{code:'PRIVATE_DOCUMENT_UPLOAD_UNAVAILABLE',message:error.message}});return res.status(500).json({error:{code:'PRIVATE_DOCUMENT_UPLOAD_UNAVAILABLE',message:'Could not prepare a secure identity document upload.'}});}
});
app.get('/api/v1/rider/payout-banks',requireUser,async(_req,res,next)=>{try{return res.json({data:await listPaystackBanks(paystackSecret())});}catch(error){if(error instanceof PaystackError)return res.status(503).json({error:{code:'BANK_LIST_UNAVAILABLE',message:'Commercial bank list is unavailable. Try again later.'}});return next(error);}});

const storeTime=z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/,'Use 24-hour time, for example 09:00.');
const onboardingInput = z.object({name:z.string().trim().min(2).max(120),ownerName:z.string().trim().min(2).max(100).optional(),contactPhone:z.string().trim().min(7).max(24).optional(),description:z.string().trim().max(1000).default(''),address:z.string().trim().min(5).max(250),openingTime:storeTime,closingTime:storeTime,logoUrl:z.string().url().max(2048).nullable().optional(),coverImageUrl:z.string().url().max(2048).nullable().optional(),cacNumber:z.string().trim().max(50).nullable().optional(),cacDocumentUrl:z.string().url().max(2048).nullable().optional(),termsAccepted:z.literal(true)}).and(coordinatePair);
app.post('/api/v1/vendors/onboarding',requireUser,async (req:AuthRequest,res,next) => {
  const input=onboardingInput.safeParse(req.body);
  if(!input.success) return res.status(400).json({error:{code:'INVALID_APPLICATION',message:'Complete the business details and accept the platform terms.'}});
  try {
    const existing=await prisma.vendor.findUnique({where:{ownerId:req.auth!.userId}});
    if(existing) return res.status(409).json({error:{code:'APPLICATION_EXISTS',message:'A vendor application already exists for this account.',status:existing.status}});
    const slugBase=input.data.name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,45)||'kitchen';
    const slug=`${slugBase}-${randomBytes(4).toString('hex')}`;
    let point = input.data.latitude!==undefined ? {latitude:input.data.latitude,longitude:input.data.longitude!} : null;
    let geocodedAt:Date|null=null;
    if(!point&&mappingConfigured('geocoding')){try{point=await geocode(`${input.data.address}, Nigeria`);geocodedAt=new Date();}catch(error){console.warn(JSON.stringify({event:'vendor_geocoding_failed',error:error instanceof Error?error.message:'unknown'}));}}
    const vendor=await prisma.$transaction(async tx=>{
      const user=await tx.user.findUniqueOrThrow({where:{id:req.auth!.userId}});
      await tx.user.update({where:{id:user.id},data:{name:input.data.ownerName??user.name,...(input.data.contactPhone?{phone:input.data.contactPhone}:{}),roles:user.roles.includes(Role.VENDOR)?user.roles:[...user.roles,Role.VENDOR]}});
      return tx.vendor.create({data:{ownerId:user.id,name:input.data.name,description:input.data.description,address:input.data.address,contactPhone:input.data.contactPhone,openingTime:input.data.openingTime,closingTime:input.data.closingTime,logoUrl:input.data.logoUrl,coverImageUrl:input.data.coverImageUrl,cacNumber:input.data.cacNumber,cacDocumentUrl:input.data.cacDocumentUrl,latitude:point?.latitude,longitude:point?.longitude,geocodedAt,slug,status:VendorStatus.PENDING_REVIEW,isOpen:false,isDemo:user.isDemo,termsAcceptedAt:new Date()}});
    });
    void provisionDva(req.auth!.userId);
    return res.status(201).json({data:{id:vendor.id,name:vendor.name,status:vendor.status}});
  } catch(error) {
    if(error instanceof Prisma.PrismaClientKnownRequestError && error.code==='P2002') return res.status(409).json({error:{code:'APPLICATION_EXISTS',message:'A vendor application already exists for this account.'}});
    return next(error);
  }
});

app.get('/api/v1/vendor/profile',requireUser,requireRole(Role.VENDOR),async (req:AuthRequest,res,next)=>{
  try { const data=await prisma.vendor.findUnique({where:{ownerId:req.auth!.userId},include:{owner:{select:{name:true}}}}); if(!data)return res.status(404).json({error:{code:'VENDOR_PROFILE_NOT_FOUND',message:'No vendor application is linked to this account.'}});return res.json({data:{...data,ownerName:data.owner.name,owner:undefined}}); }
  catch(error){return next(error);}
});
const vendorProfileInput=z.object({name:z.string().trim().min(2).max(120),ownerName:z.string().trim().min(2).max(100),contactPhone:z.string().trim().min(7).max(24),description:z.string().trim().max(1000),address:z.string().trim().min(5).max(250),openingTime:storeTime,closingTime:storeTime,logoUrl:z.string().url().max(2048).nullable(),coverImageUrl:z.string().url().max(2048).nullable(),cacNumber:z.string().trim().max(50).nullable(),cacDocumentUrl:z.string().url().max(2048).nullable()}).and(coordinatePair);
app.put('/api/v1/vendor/profile',requireUser,requireRole(Role.VENDOR),async(req:AuthRequest,res,next)=>{
  const input=vendorProfileInput.safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'INVALID_VENDOR_PROFILE',message:'Check the owner, store, address, and document details.'}});
  try{
    const vendor=await prisma.vendor.findUnique({where:{ownerId:req.auth!.userId},select:{id:true,status:true}});if(!vendor)return res.status(404).json({error:{code:'VENDOR_PROFILE_NOT_FOUND',message:'Submit your store application first.'}});
    let point=input.data.latitude!==undefined?{latitude:input.data.latitude,longitude:input.data.longitude!}:null;let geocodedAt:Date|null=null;
    if(!point&&mappingConfigured('geocoding')){try{point=await geocode(`${input.data.address}, Nigeria`);geocodedAt=new Date();}catch(error){console.warn(JSON.stringify({event:'vendor_geocoding_failed',error:error instanceof Error?error.message:'unknown'}));}}
    const [updated]=await prisma.$transaction([prisma.vendor.update({where:{id:vendor.id},data:{name:input.data.name,description:input.data.description,address:input.data.address,contactPhone:input.data.contactPhone,openingTime:input.data.openingTime,closingTime:input.data.closingTime,logoUrl:input.data.logoUrl,coverImageUrl:input.data.coverImageUrl,cacNumber:input.data.cacNumber,cacDocumentUrl:input.data.cacDocumentUrl,latitude:point?.latitude,longitude:point?.longitude,geocodedAt,status:vendor.status===VendorStatus.DRAFT?VendorStatus.PENDING_REVIEW:vendor.status,termsAcceptedAt:new Date()}}),prisma.user.update({where:{id:req.auth!.userId},data:{name:input.data.ownerName,phone:input.data.contactPhone}})]);
    return res.json({data:{...updated,ownerName:input.data.ownerName}});
  }catch(error){return next(error);}
});

app.get('/api/v1/vendor/products',requireUser,requireRole(Role.VENDOR),async (req:AuthRequest,res,next)=>{
  try { const vendor=await prisma.vendor.findFirst({where:{ownerId:req.auth!.userId,status:{in:[VendorStatus.DRAFT,VendorStatus.PENDING_REVIEW,VendorStatus.APPROVED]}}});if(!vendor)return res.status(403).json({error:{code:'VENDOR_NOT_APPROVED',message:'Submit store details first to prepare your menu.'}});const data=await prisma.product.findMany({where:{vendorId:vendor.id},orderBy:{createdAt:'desc'},take:100,include:{addons:{orderBy:{createdAt:'asc'}}}});return res.json({data}); }
  catch(error){return next(error);}
});
const productInput=z.object({name:z.string().trim().min(2).max(120),description:z.string().trim().max(1500).default(''),category:z.string().trim().min(2).max(60),priceMinor:z.number().int().positive().max(2_000_000_000),imageUrl:z.string().url().max(2048).nullable().optional(),stock:z.number().int().nonnegative().max(100000).nullable().optional()});
app.post('/api/v1/vendor/products',requireUser,requireRole(Role.VENDOR),async (req:AuthRequest,res,next)=>{
  const input=productInput.safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'INVALID_PRODUCT',message:'Check the product name, category, price, and stock.'}});
  try {const vendor=await prisma.vendor.findFirst({where:{ownerId:req.auth!.userId,status:{in:[VendorStatus.DRAFT,VendorStatus.PENDING_REVIEW,VendorStatus.APPROVED]}}});if(!vendor)return res.status(403).json({error:{code:'VENDOR_NOT_APPROVED',message:'Submit store details first to prepare your menu.'}});const data=await prisma.product.create({data:{...input.data,vendorId:vendor.id,isDemo:vendor.isDemo}});return res.status(201).json({data});}
  catch(error){return next(error);}
});
app.patch('/api/v1/vendor/products/:productId',requireUser,requireRole(Role.VENDOR),async (req:AuthRequest,res,next)=>{
  const input=productInput.partial().extend({available:z.boolean().optional()}).safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'INVALID_PRODUCT',message:'Product changes are invalid.'}});
  try {const productId=routeParam(req,'productId');const vendor=await prisma.vendor.findFirst({where:{ownerId:req.auth!.userId,status:{in:[VendorStatus.DRAFT,VendorStatus.PENDING_REVIEW,VendorStatus.APPROVED]}},select:{id:true}});if(!vendor)return res.status(403).json({error:{code:'VENDOR_NOT_APPROVED',message:'An approved vendor account is required.'}});const changed=await prisma.product.updateMany({where:{id:productId,vendorId:vendor.id},data:input.data});if(!changed.count)return res.status(404).json({error:{code:'PRODUCT_NOT_FOUND',message:'Product not found for this kitchen.'}});const data=await prisma.product.findUnique({where:{id:productId}});return res.json({data});}
  catch(error){return next(error);}
});
app.delete('/api/v1/vendor/products/:productId',requireUser,requireRole(Role.VENDOR),async (req:AuthRequest,res,next)=>{
  try {const productId=routeParam(req,'productId');const vendor=await prisma.vendor.findFirst({where:{ownerId:req.auth!.userId,status:{in:[VendorStatus.DRAFT,VendorStatus.PENDING_REVIEW,VendorStatus.APPROVED]}},select:{id:true}});if(!vendor)return res.status(403).json({error:{code:'VENDOR_NOT_APPROVED',message:'An approved vendor account is required.'}});const changed=await prisma.product.updateMany({where:{id:productId,vendorId:vendor.id},data:{available:false}});if(!changed.count)return res.status(404).json({error:{code:'PRODUCT_NOT_FOUND',message:'Product not found for this kitchen.'}});return res.status(204).end();}
  catch(error){return next(error);}
});
const addonInput=z.object({name:z.string().trim().min(2).max(80),priceMinor:z.number().int().positive().max(2_000_000_000)});
app.post('/api/v1/vendor/products/:productId/addons',requireUser,requireRole(Role.VENDOR),async(req:AuthRequest,res,next)=>{
  const input=addonInput.safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'INVALID_ADDON',message:'Enter an add-on name and a positive price.'}});
  try{const vendor=await prisma.vendor.findFirst({where:{ownerId:req.auth!.userId,status:{in:[VendorStatus.DRAFT,VendorStatus.PENDING_REVIEW,VendorStatus.APPROVED]}},select:{id:true}});if(!vendor)return res.status(403).json({error:{code:'VENDOR_NOT_APPROVED',message:'An approved vendor account is required.'}});const product=await prisma.product.findFirst({where:{id:routeParam(req,'productId'),vendorId:vendor.id},select:{id:true}});if(!product)return res.status(404).json({error:{code:'PRODUCT_NOT_FOUND',message:'Product not found for this store.'}});const count=await prisma.productAddon.count({where:{productId:product.id,available:true}});if(count>=20)return res.status(409).json({error:{code:'ADDON_LIMIT',message:'A product can have up to 20 active extras.'}});const data=await prisma.productAddon.create({data:{...input.data,productId:product.id}});return res.status(201).json({data});}catch(error){return next(error);}
});
app.patch('/api/v1/vendor/products/:productId/addons/:addonId',requireUser,requireRole(Role.VENDOR),async(req:AuthRequest,res,next)=>{
  const input=addonInput.partial().extend({available:z.boolean().optional()}).safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'INVALID_ADDON',message:'Check the add-on name, price, and availability.'}});
  try{const addonId=routeParam(req,'addonId');const vendor=await prisma.vendor.findFirst({where:{ownerId:req.auth!.userId,status:{in:[VendorStatus.DRAFT,VendorStatus.PENDING_REVIEW,VendorStatus.APPROVED]}},select:{id:true}});if(!vendor)return res.status(403).json({error:{code:'VENDOR_NOT_APPROVED',message:'An approved vendor account is required.'}});const changed=await prisma.productAddon.updateMany({where:{id:addonId,productId:routeParam(req,'productId'),product:{is:{vendorId:vendor.id}}},data:input.data});if(!changed.count)return res.status(404).json({error:{code:'ADDON_NOT_FOUND',message:'Extra not found for this product.'}});return res.json({data:await prisma.productAddon.findUnique({where:{id:addonId}})});}catch(error){return next(error);}
});
app.delete('/api/v1/vendor/products/:productId/addons/:addonId',requireUser,requireRole(Role.VENDOR),async(req:AuthRequest,res,next)=>{
  try{const vendor=await prisma.vendor.findFirst({where:{ownerId:req.auth!.userId,status:{in:[VendorStatus.DRAFT,VendorStatus.PENDING_REVIEW,VendorStatus.APPROVED]}},select:{id:true}});if(!vendor)return res.status(403).json({error:{code:'VENDOR_NOT_APPROVED',message:'An approved vendor account is required.'}});const changed=await prisma.productAddon.updateMany({where:{id:routeParam(req,'addonId'),productId:routeParam(req,'productId'),product:{is:{vendorId:vendor.id}}},data:{available:false}});if(!changed.count)return res.status(404).json({error:{code:'ADDON_NOT_FOUND',message:'Extra not found for this product.'}});return res.status(204).end();}catch(error){return next(error);}
});

const riderApplicationInput=z.object({vehicleType:z.enum(['BICYCLE','MOTORCYCLE','TRICYCLE','CAR']),serviceArea:z.string().trim().min(2).max(100),dateOfBirth:z.string().date(),nin:z.string().regex(/^\d{11}$/),ninDocumentPublicId:z.string().trim().min(10).max(255).regex(/^smile\/riders\/[a-zA-Z0-9_-]+\/identity\/[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)?$/),ninDocumentVersion:z.number().int().positive().max(2_147_483_647),plateNumber:z.string().trim().max(20).optional().default(''),residentialAddress:z.string().trim().min(8).max(250),guarantorName:z.string().trim().min(2).max(100),guarantorNin:z.string().regex(/^\d{11}$/),guarantorAddress:z.string().trim().min(8).max(250),accountNumber:z.string().trim().regex(/^\d{10}$/),bankCode:z.string().trim().min(2).max(12),termsAccepted:z.literal(true)}).superRefine((data,ctx)=>{if(data.vehicleType!=='BICYCLE'&&!data.plateNumber.trim())ctx.addIssue({code:z.ZodIssueCode.custom,path:['plateNumber'],message:'A plate number is required for this vehicle.'});if(data.vehicleType==='BICYCLE'&&data.plateNumber.trim().length>0&&data.plateNumber.trim().length<3)ctx.addIssue({code:z.ZodIssueCode.custom,path:['plateNumber'],message:'Enter a valid plate number or leave blank for a bicycle.'});});
app.post('/api/v1/rider/onboarding',requireUser,async (req:AuthRequest,res,next)=>{
  const input=riderApplicationInput.safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'INVALID_APPLICATION',message:'Complete the identity, vehicle, guarantor, bank, service area, and terms fields.'}});
  try {
    if(!input.data.ninDocumentPublicId.startsWith(`smile/riders/${req.auth!.userId}/identity/`))return res.status(400).json({error:{code:'INVALID_NIN_DOCUMENT',message:'Upload your own NIN document before submitting.'}});
    const existing=await prisma.riderProfile.findUnique({where:{userId:req.auth!.userId}});
    if(existing)return res.status(409).json({error:{code:'APPLICATION_EXISTS',message:'A rider application already exists for this account.',status:existing.status}});
    const banks=await listPaystackBanks(paystackSecret());const bank=banks.find(row=>row.code===input.data.bankCode);if(!bank)return res.status(400).json({error:{code:'BANK_NOT_AVAILABLE',message:'Choose a supported Nigerian commercial bank.'}});
    const resolved=await resolvePaystackBankAccount(input.data.accountNumber,input.data.bankCode,paystackSecret());const recipient=await createPaystackTransferRecipient({name:resolved.accountName,accountNumber:resolved.accountNumber,bankCode:input.data.bankCode},paystackSecret());
    const ninCiphertext=encryptRiderNin(input.data.nin);const guarantorNinCiphertext=encryptRiderNin(input.data.guarantorNin);const dob=new Date(`${input.data.dateOfBirth}T00:00:00.000Z`);if(dob>=new Date())return res.status(400).json({error:{code:'INVALID_DATE_OF_BIRTH',message:'Enter a valid date of birth.'}});
    const profile=await prisma.$transaction(async tx=>{const user=await tx.user.findUniqueOrThrow({where:{id:req.auth!.userId}});if(!user.roles.includes(Role.RIDER))await tx.user.update({where:{id:user.id},data:{roles:[...user.roles,Role.RIDER]}});const created=await tx.riderProfile.create({data:{userId:user.id,vehicleType:input.data.vehicleType,serviceArea:input.data.serviceArea,dateOfBirth:dob,ninCiphertext,ninDocumentPublicId:input.data.ninDocumentPublicId,ninDocumentVersion:input.data.ninDocumentVersion,plateNumber:input.data.plateNumber.trim()||null,residentialAddress:input.data.residentialAddress,guarantorName:input.data.guarantorName,guarantorNinCiphertext,guarantorAddress:input.data.guarantorAddress,status:VendorStatus.PENDING_REVIEW,available:false}});await tx.wallet.upsert({where:{userId:user.id},update:{payoutAccountLast4:resolved.accountNumber.slice(-4),payoutAccountName:resolved.accountName,payoutBankName:bank.name,payoutBankCode:input.data.bankCode,payoutRecipientCode:recipient.recipientCode,payoutStatus:'VERIFIED'},create:{userId:user.id,payoutAccountLast4:resolved.accountNumber.slice(-4),payoutAccountName:resolved.accountName,payoutBankName:bank.name,payoutBankCode:input.data.bankCode,payoutRecipientCode:recipient.recipientCode,payoutStatus:'VERIFIED'}});return created;});
    void provisionDva(req.auth!.userId);
    return res.status(201).json({data:{id:profile.id,status:profile.status,available:profile.available}});
  }catch(error){if(error instanceof PaystackError)return res.status(503).json({error:{code:'BANK_VERIFICATION_UNAVAILABLE',message:'Could not verify the rider payout account. Try again later.'}});if(error instanceof Error&&error.message.includes('RIDER_PII_ENCRYPTION_KEY'))return res.status(503).json({error:{code:'PII_ENCRYPTION_UNAVAILABLE',message:'Rider identity storage is not configured.'}});if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')return res.status(409).json({error:{code:'APPLICATION_EXISTS',message:'A rider application already exists.'}});return next(error);}
});
app.get('/api/v1/rider/profile',requireUser,requireRole(Role.RIDER),async(req:AuthRequest,res,next)=>{
  try{const profile=await prisma.riderProfile.findUnique({where:{userId:req.auth!.userId},select:{id:true,status:true,available:true,vehicleType:true,serviceArea:true,location:{select:{updatedAt:true}}}});if(!profile)return res.status(404).json({error:{code:'RIDER_PROFILE_NOT_FOUND',message:'No rider application is linked to this account.'}});return res.json({data:{...profile,suspended:profile.status===VendorStatus.SUSPENDED}});}catch(error){return next(error);}
});
app.put('/api/v1/rider/availability',requireUser,requireRole(Role.RIDER),async(req:AuthRequest,res,next)=>{
  const input=z.object({available:z.boolean()}).safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'INVALID_AVAILABILITY',message:'Availability must be true or false.'}});
  try{const profile=await prisma.riderProfile.findUnique({where:{userId:req.auth!.userId}});if(!profile||profile.status!==VendorStatus.APPROVED)return res.status(403).json({error:{code:'RIDER_NOT_APPROVED',message:'Only an approved, active rider can change availability.'}});if(input.data.available&&await cancellationCount(req.auth!.userId)>=cancellationLimits.RIDER)return res.status(429).json({error:{code:'DAILY_CANCELLATION_LIMIT',message:'You reached today’s cancellation limit and cannot receive more delivery offers today.'}});if(input.data.available){const location=await prisma.riderLocation.findUnique({where:{riderId:profile.id}});if(!location||location.updatedAt<new Date(Date.now()-10*60_000))return res.status(409).json({error:{code:'LOCATION_REQUIRED',message:'Send a recent location before going online.'}});}const data=await prisma.riderProfile.update({where:{id:profile.id},data:{available:input.data.available}});if(data.available)await dispatchWaitingDeliveries();return res.json({data:{available:data.available}});}catch(error){return next(error);}
});
app.put('/api/v1/rider/location',requireUser,requireRole(Role.RIDER),async(req:AuthRequest,res,next)=>{
  const input=z.object({latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180)}).safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'INVALID_LOCATION',message:'Location coordinates are invalid.'}});
  try{const profile=await prisma.riderProfile.findUnique({where:{userId:req.auth!.userId}});if(!profile||profile.status!==VendorStatus.APPROVED)return res.status(403).json({error:{code:'RIDER_NOT_APPROVED',message:'An approved, active rider profile is required.'}});await prisma.riderLocation.upsert({where:{riderId:profile.id},update:input.data,create:{riderId:profile.id,...input.data}});if(profile.available)await dispatchWaitingDeliveries();return res.json({data:{updatedAt:new Date().toISOString()}});}catch(error){return next(error);}
});
async function expireAndRedispatchOffers() {
  const now=new Date();
  const deliveryIds=await prisma.$transaction(async tx=>{
    const expired=await tx.riderOffer.findMany({where:{status:RiderOfferStatus.PENDING,expiresAt:{lte:now}},select:{deliveryId:true}});
    if(!expired.length)return [] as string[];
    await tx.riderOffer.updateMany({where:{status:RiderOfferStatus.PENDING,expiresAt:{lte:now}},data:{status:RiderOfferStatus.EXPIRED}});
    const unique=[...new Set(expired.map(offer=>offer.deliveryId))];
    const active=await tx.riderOffer.findMany({where:{deliveryId:{in:unique},status:RiderOfferStatus.PENDING,expiresAt:{gt:now}},select:{deliveryId:true}});
    const open=new Set(active.map(offer=>offer.deliveryId));
    return unique.filter(id=>!open.has(id));
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  for(const deliveryId of deliveryIds)await dispatchDeliveryOffers(deliveryId);
}
app.get('/api/v1/rider/offers',requireUser,requireRole(Role.RIDER),async(req:AuthRequest,res,next)=>{
  try{
    await expireAndRedispatchOffers();
    const rider=await prisma.riderProfile.findUnique({where:{userId:req.auth!.userId},include:{location:true}});
    if(!rider||rider.status!==VendorStatus.APPROVED)return res.status(403).json({error:{code:'RIDER_NOT_APPROVED',message:'An approved, active rider profile is required.'}});
    if(await cancellationCount(req.auth!.userId)>=cancellationLimits.RIDER){await prisma.riderProfile.update({where:{id:rider.id},data:{available:false}});return res.status(429).json({error:{code:'DAILY_CANCELLATION_LIMIT',message:'You reached today’s cancellation limit and cannot receive more delivery offers until tomorrow.'}});}
    const offers=await prisma.riderOffer.findMany({where:{riderId:rider.id,status:RiderOfferStatus.PENDING,expiresAt:{gt:new Date()}},include:{delivery:{include:{order:{include:{vendor:true,address:{select:{city:true}},items:true}}}}},orderBy:{createdAt:'asc'},take:20});
    const data=offers.map(offer=>{const order=offer.delivery.order;const pickup=order.vendor.latitude!==null&&order.vendor.longitude!==null&&rider.location?distanceKm(Number(rider.location.latitude),Number(rider.location.longitude),Number(order.vendor.latitude),Number(order.vendor.longitude)):null;const pickupDistanceKm=offer.pickupDistanceMeters===null?pickup:Number(offer.pickupDistanceMeters/1000);return{id:offer.id,expiresAt:offer.expiresAt,deliveryId:offer.deliveryId,pickupDistanceKm:pickupDistanceKm===null?null:Number(pickupDistanceKm.toFixed(1)),vendor:{name:order.vendor.name,address:order.vendor.address},dropoffCity:order.address?.city??'Delivery area',itemCount:order.items.reduce((count,item)=>count+item.quantity,0),totalMinor:order.totalMinor};});
    return res.json({data});
  }catch(error){return next(error);}
});
app.post('/api/v1/rider/offers/:offerId/accept',requireUser,requireRole(Role.RIDER),async(req:AuthRequest,res,next)=>{
  try{
    if(await cancellationCount(req.auth!.userId)>=cancellationLimits.RIDER)return res.status(429).json({error:{code:'DAILY_CANCELLATION_LIMIT',message:'You reached today’s cancellation limit and cannot accept delivery offers today.'}});
    const rider=await prisma.riderProfile.findUnique({where:{userId:req.auth!.userId}});if(!rider||rider.status!==VendorStatus.APPROVED||!rider.available)return res.status(403).json({error:{code:'RIDER_UNAVAILABLE',message:'An approved, available rider is required to accept an offer.'}});
    const offer=await prisma.riderOffer.findFirst({where:{id:routeParam(req,'offerId'),riderId:rider.id}});if(!offer)return res.status(404).json({error:{code:'OFFER_NOT_FOUND',message:'This offer is no longer available.'}});if(offer.status!==RiderOfferStatus.PENDING||offer.expiresAt<=new Date())return res.status(409).json({error:{code:'OFFER_EXPIRED',message:'This offer has expired.'}});
    const delivery=await prisma.$transaction(async tx=>{
      const assigned=await tx.delivery.updateMany({where:{id:offer.deliveryId,status:DeliveryStatus.OFFERING,assignedRiderId:null},data:{assignedRiderId:rider.id,status:DeliveryStatus.ASSIGNED,assignedAt:new Date()}});
      if(assigned.count!==1)throw new Error('OFFER_ALREADY_ASSIGNED');
      const accepted=await tx.riderOffer.updateMany({where:{id:offer.id,status:RiderOfferStatus.PENDING,expiresAt:{gt:new Date()}},data:{status:RiderOfferStatus.ACCEPTED}});
      if(accepted.count!==1)throw new Error('OFFER_EXPIRED');
      await tx.riderOffer.updateMany({where:{deliveryId:offer.deliveryId,id:{not:offer.id},status:RiderOfferStatus.PENDING},data:{status:RiderOfferStatus.EXPIRED}});
      const related=await tx.delivery.findUniqueOrThrow({where:{id:offer.deliveryId},include:{order:true}});
      const changed=await tx.order.updateMany({where:{id:related.orderId,status:OrderStatus.READY_FOR_PICKUP},data:{status:OrderStatus.RIDER_ASSIGNED}});if(changed.count!==1)throw new Error('ORDER_STATE_CONFLICT');
      await tx.orderStatusEvent.create({data:{orderId:related.orderId,status:OrderStatus.RIDER_ASSIGNED,actorId:req.auth!.userId}});
      await tx.riderProfile.update({where:{id:rider.id},data:{available:false}});
      return tx.delivery.findUnique({where:{id:offer.deliveryId},include:{order:{select:{id:true,status:true}},assignedRider:{include:{user:{select:{name:true}}}}}});
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    return res.json({data:delivery});
  }catch(error){if(error instanceof Error&&['OFFER_ALREADY_ASSIGNED','OFFER_EXPIRED','ORDER_STATE_CONFLICT'].includes(error.message))return res.status(409).json({error:{code:error.message,message:'The offer is no longer available. Refresh your offers.'}});if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2034')return res.status(409).json({error:{code:'OFFER_ALREADY_ASSIGNED',message:'Another rider accepted this delivery first.'}});return next(error);}
});
app.post('/api/v1/rider/offers/:offerId/reject',requireUser,requireRole(Role.RIDER),async(req:AuthRequest,res,next)=>{
  try{
    const rider=await prisma.riderProfile.findUnique({where:{userId:req.auth!.userId}});if(!rider||rider.status!==VendorStatus.APPROVED)return res.status(403).json({error:{code:'RIDER_NOT_APPROVED',message:'An approved rider profile is required.'}});
    const offer=await prisma.riderOffer.findFirst({where:{id:routeParam(req,'offerId'),riderId:rider.id,status:RiderOfferStatus.PENDING}});if(!offer)return res.status(404).json({error:{code:'OFFER_NOT_FOUND',message:'This offer is no longer available.'}});
    await prisma.riderOffer.update({where:{id:offer.id},data:{status:RiderOfferStatus.REJECTED}});
    const active=await prisma.riderOffer.count({where:{deliveryId:offer.deliveryId,status:RiderOfferStatus.PENDING,expiresAt:{gt:new Date()}}});if(!active)await dispatchDeliveryOffers(offer.deliveryId);
    return res.status(204).end();
  }catch(error){return next(error);}
});
app.get('/api/v1/rider/deliveries',requireUser,requireRole(Role.RIDER),async(req:AuthRequest,res,next)=>{
  try{const rider=await prisma.riderProfile.findUnique({where:{userId:req.auth!.userId}});if(!rider||rider.status!==VendorStatus.APPROVED)return res.status(403).json({error:{code:'RIDER_NOT_APPROVED',message:'An approved rider profile is required.'}});const rows=await prisma.delivery.findMany({where:{assignedRiderId:rider.id},orderBy:{createdAt:'desc'},take:50,include:{order:{select:{id:true,status:true,totalMinor:true,deliveryNotes:true,vendor:{select:{id:true,name:true,address:true,latitude:true,longitude:true}},customer:{select:{name:true,phone:true}},address:{select:{label:true,line1:true,city:true,latitude:true,longitude:true}},items:{select:{id:true,nameSnapshot:true,quantity:true,unitPriceMinor:true,addons:true}}}}}});const data=rows.map(({order,...delivery})=>({...delivery,pickupCode:delivery.status===DeliveryStatus.ASSIGNED?vendorPickupOtp(delivery.id):null,order:{...order,customer:delivery.status===DeliveryStatus.PICKED_UP?order.customer:null}}));return res.json({data});}catch(error){return next(error);}
});
app.get('/api/v1/rider/deliveries/:deliveryId/route',requireUser,requireRole(Role.RIDER),async(req:AuthRequest,res,next)=>{
  try{
    const rider=await prisma.riderProfile.findUnique({where:{userId:req.auth!.userId},include:{location:true}});
    if(!rider||rider.status!==VendorStatus.APPROVED)return res.status(403).json({error:{code:'RIDER_NOT_APPROVED',message:'An approved rider profile is required.'}});
    const delivery=await prisma.delivery.findFirst({where:{id:routeParam(req,'deliveryId'),assignedRiderId:rider.id,status:{in:[DeliveryStatus.ASSIGNED,DeliveryStatus.PICKED_UP]}},include:{order:{include:{vendor:true,address:true}}}});
    if(!delivery)return res.status(404).json({error:{code:'DELIVERY_NOT_ASSIGNED',message:'This active delivery is not assigned to you.'}});
    if(!rider.location||rider.location.updatedAt<new Date(Date.now()-10*60_000))return res.status(409).json({error:{code:'LOCATION_REQUIRED',message:'Send a recent location to calculate your route.'}});
    const origin={latitude:Number(rider.location.latitude),longitude:Number(rider.location.longitude)};
    const isPickup=delivery.status===DeliveryStatus.ASSIGNED;
    const destination=isPickup
      ?await freshVendorCoordinates(delivery.order.vendor)
      :delivery.order.address?await freshAddressCoordinates(delivery.order.address):null;
    if(!destination)return res.status(409).json({error:{code:'DESTINATION_COORDINATES_UNAVAILABLE',message:'A map pin is not available for this stop yet.'}});
    if(!mappingConfigured('routes'))return res.status(503).json({error:{code:'MAPS_NOT_CONFIGURED',message:`${mapProvider()} route service is not configured.`}});
    const route=await drivingRoute(origin,destination);
    return res.json({data:{deliveryId:delivery.id,leg:isPickup?'PICKUP':'DROPOFF',origin,destination,distanceMeters:route.distanceMeters,durationSeconds:route.durationSeconds,encodedPolyline:route.encodedPolyline,geometryFormat:mapProvider()==='maplibre'?'latlng-semicolon':'google-encoded',provider:mapProvider()}});
  }catch(error){
    if(error instanceof GoogleMapsError||error instanceof MapServiceError)return res.status(502).json({error:{code:'ROUTE_UNAVAILABLE',message:`${mapProvider()} could not calculate this route. Try again or open navigation.`}});
    return next(error);
  }
});
app.post('/api/v1/rider/deliveries/:deliveryId/complete',requireUser,requireRole(Role.RIDER),async(req:AuthRequest,res,next)=>{
  const input=z.object({code:z.string().regex(/^\d{6}$/)}).safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'INVALID_DELIVERY_CODE',message:'Enter the 6 digit code from the customer.'}});
  try{const rider=await prisma.riderProfile.findUnique({where:{userId:req.auth!.userId}});if(!rider)return res.status(403).json({error:{code:'RIDER_NOT_APPROVED',message:'Rider profile required.'}});const delivery=await prisma.delivery.findFirst({where:{id:routeParam(req,'deliveryId'),assignedRiderId:rider.id,status:DeliveryStatus.PICKED_UP}});if(!delivery)return res.status(409).json({error:{code:'INVALID_DELIVERY_STATE',message:'This delivery is not assigned to you or has not been picked up.'}});if(delivery.proofAttempts>=5)return res.status(429).json({error:{code:'DELIVERY_PROOF_LOCKED',message:'Too many incorrect codes. Contact support.'}});const expected=Buffer.from(deliveryOtp(delivery.id));const provided=Buffer.from(input.data.code);if(!timingSafeEqual(expected,provided)){const attempt=await prisma.delivery.updateMany({where:{id:delivery.id,proofAttempts:{lt:5}},data:{proofAttempts:{increment:1}}});if(!attempt.count)return res.status(429).json({error:{code:'DELIVERY_PROOF_LOCKED',message:'Too many incorrect codes. Contact support.'}});return res.status(403).json({error:{code:'INVALID_DELIVERY_CODE',message:'That delivery code does not match.'}});}await prisma.$transaction(async tx=>{const changed=await tx.delivery.updateMany({where:{id:delivery.id,assignedRiderId:rider.id,status:DeliveryStatus.PICKED_UP},data:{status:DeliveryStatus.DELIVERED,deliveredAt:new Date()}});if(!changed.count)throw new Error('DELIVERY_STATE_CONFLICT');await tx.order.update({where:{id:delivery.orderId},data:{status:OrderStatus.DELIVERED}});await tx.orderStatusEvent.create({data:{orderId:delivery.orderId,status:OrderStatus.DELIVERED,actorId:req.auth!.userId}});const order=await tx.order.findUniqueOrThrow({where:{id:delivery.orderId},select:{id:true,subtotalMinor:true,isDemo:true,vendor:{select:{ownerId:true}}}});if(!order.isDemo&&order.subtotalMinor>0){const wallet=await tx.wallet.upsert({where:{userId:order.vendor.ownerId},update:{},create:{userId:order.vendor.ownerId,dvaStatus:'PENDING'}});const reference=`vendor_sale_${order.id}`;const existing=await tx.walletTransaction.findUnique({where:{reference},select:{id:true}});if(!existing){const updated=await tx.wallet.update({where:{id:wallet.id},data:{balanceMinor:{increment:order.subtotalMinor}}});await tx.walletTransaction.create({data:{walletId:wallet.id,userId:order.vendor.ownerId,type:'ORDER_EARNING',direction:'CREDIT',status:'SUCCEEDED',amountMinor:order.subtotalMinor,balanceAfter:updated.balanceMinor,reference,orderId:order.id,metadata:{basis:'delivered_item_subtotal'}}});}}await tx.riderProfile.update({where:{id:rider.id},data:{available:true}});});return res.json({data:{id:delivery.id,status:DeliveryStatus.DELIVERED}});}catch(error){if(error instanceof Error&&error.message==='DELIVERY_STATE_CONFLICT')return res.status(409).json({error:{code:error.message,message:'The delivery status changed. Refresh and try again.'}});if(error instanceof Error&&error.message.includes('DELIVERY_OTP_SECRET'))return res.status(503).json({error:{code:'DELIVERY_PROOF_UNAVAILABLE',message:'Delivery proof is not configured.'}});return next(error);}
});

app.get('/api/v1/vendors',async (req,res,next) => {
  const input = z.object({q:z.string().trim().max(100).optional(),category:z.string().trim().max(60).optional()}).safeParse(req.query);
  if(!input.success) return res.status(400).json({error:{code:'INVALID_QUERY',message:'Search query is invalid.'}});
  try {
    const buildWhere=(isDemo:boolean):Prisma.VendorWhereInput=>{
      const where:Prisma.VendorWhereInput={status:VendorStatus.APPROVED,isOpen:true,isDemo};
      if(input.data.q)where.OR=[{name:{contains:input.data.q,mode:'insensitive'}},{address:{contains:input.data.q,mode:'insensitive'}},{products:{some:{available:true,isDemo,name:{contains:input.data.q,mode:'insensitive'}}}},{products:{some:{available:true,isDemo,description:{contains:input.data.q,mode:'insensitive'}}}},{products:{some:{available:true,isDemo,category:{contains:input.data.q,mode:'insensitive'}}}}];
      if(input.data.category)where.products={some:{available:true,category:{contains:input.data.category,mode:'insensitive'}}};
      return where;
    };
    const select={id:true,name:true,address:true,logoUrl:true,coverImageUrl:true,isOpen:true,isDemo:true,latitude:true,longitude:true,products:{where:{available:true},select:{category:true,imageUrl:true},take:1}} as const;
    const realVendorCount=await prisma.vendor.count({where:{status:VendorStatus.APPROVED,isOpen:true,isDemo:false}});
    const source = catalogSource(realVendorCount,demoMode);
    const rows = source==='database'?await prisma.vendor.findMany({where:buildWhere(false),orderBy:{name:'asc'},take:50,select}):await prisma.vendor.findMany({where:buildWhere(true),orderBy:{name:'asc'},take:50,select});
    const data = rows.map(v=>({id:v.id,name:v.name,cuisine:v.products[0]?.category??'Local store',neighborhood:v.address,eta:'Estimate at checkout',fee:800,rating:null,image:v.coverImageUrl??v.logoUrl??v.products[0]?.imageUrl??'',open:v.isOpen,demo:v.isDemo,latitude:v.latitude===null?null:Number(v.latitude),longitude:v.longitude===null?null:Number(v.longitude)}));
    return res.json({data,meta:{source,total:data.length}});
  } catch(error) { return next(error); }
});

app.get('/api/v1/vendors/:vendorId/products',async (req,res,next) => {
  try {
    const vendorId=routeParam(req,'vendorId');
    let vendor = await prisma.vendor.findFirst({where:{id:vendorId,status:VendorStatus.APPROVED,isOpen:true,isDemo:false},select:{id:true,isDemo:true}});
    if(!vendor && demoMode) {
      const realVendorCount=await prisma.vendor.count({where:{status:VendorStatus.APPROVED,isOpen:true,isDemo:false}});
      if(realVendorCount===0) vendor=await prisma.vendor.findFirst({where:{id:vendorId,status:VendorStatus.APPROVED,isOpen:true,isDemo:true},select:{id:true,isDemo:true}});
    }
    if(!vendor) return res.status(404).json({error:{code:'VENDOR_NOT_FOUND',message:'This kitchen is unavailable.'}});
    const products = await prisma.product.findMany({where:{vendorId:vendor.id,available:true,isDemo:vendor.isDemo},orderBy:{name:'asc'},take:100,include:{addons:{where:{available:true},orderBy:{createdAt:'asc'}}}});
    return res.json({data:products});
  } catch(error) { return next(error); }
});

const createOrderSchema = z.object({vendorId:z.string().min(1),addressId:z.string().min(1),deliveryNotes:z.string().max(500).optional(),idempotencyKey:z.string().uuid(),items:z.array(z.object({productId:z.string().min(1),quantity:z.number().int().min(1).max(20),addons:z.array(z.object({addonId:z.string().min(1),quantity:z.number().int().min(1).max(20)})).max(20).optional()})).min(1).max(30)}).refine(v=>new Set(v.items.map(x=>x.productId)).size===v.items.length,{message:'Each product may appear only once.'}).refine(v=>v.items.every(item=>new Set((item.addons??[]).map(addon=>addon.addonId)).size===(item.addons??[]).length),{message:'Each product extra may appear only once per item.'});
app.post('/api/v1/orders',requireUser,requireRole(Role.CUSTOMER),async (req:AuthRequest,res,next) => {
  const input = createOrderSchema.safeParse(req.body);
  if(!input.success) return res.status(400).json({error:{code:'INVALID_ORDER',message:'Review the items and delivery details.'}});
  try {
    if(await cancellationCount(req.auth!.userId)>=cancellationLimits.CUSTOMER)return res.status(429).json({error:{code:'DAILY_CANCELLATION_LIMIT',message:'You reached today’s cancellation limit and cannot place another order today.'}});
    const prior = await prisma.order.findUnique({where:{idempotencyKey:input.data.idempotencyKey},include:{items:true}});
    if(prior) return prior.customerId === req.auth!.userId ? res.json({data:prior,replayed:true}) : res.status(409).json({error:{code:'IDEMPOTENCY_CONFLICT',message:'This request key is already in use.'}});
    const [vendor,address] = await Promise.all([
      prisma.vendor.findFirst({where:{id:input.data.vendorId,status:VendorStatus.APPROVED,isOpen:true}}),
      prisma.address.findFirst({where:{id:input.data.addressId,userId:req.auth!.userId}})
    ]);
    if(!vendor) return res.status(409).json({error:{code:'VENDOR_UNAVAILABLE',message:'This kitchen cannot accept orders right now.'}});
    const vendorOwner=await prisma.vendor.findUnique({where:{id:vendor.id},select:{ownerId:true}});if(vendorOwner&&await cancellationCount(vendorOwner.ownerId)>=cancellationLimits.VENDOR)return res.status(409).json({error:{code:'VENDOR_DAILY_CANCELLATION_LIMIT',message:'This vendor has reached today’s cancellation limit and cannot accept new orders today.'}});
    if(!address) return res.status(400).json({error:{code:'INVALID_ADDRESS',message:'Choose one of your saved delivery addresses.'}});
    const ids = input.data.items.map(item=>item.productId);
    const products = await prisma.product.findMany({where:{id:{in:ids},vendorId:vendor.id,available:true,isDemo:vendor.isDemo}});
    if(products.length !== ids.length) return res.status(409).json({error:{code:'ITEM_UNAVAILABLE',message:'A selected item is no longer available.'}});
    for(const item of input.data.items) {
      const product = products.find(p=>p.id===item.productId)!;
      if(product.stock !== null && product.stock < item.quantity) return res.status(409).json({error:{code:'OUT_OF_STOCK',message:`${product.name} does not have enough stock.`}});
    }
    const addonIds=input.data.items.flatMap(item=>(item.addons??[]).map(addon=>addon.addonId));
    const addons=addonIds.length?await prisma.productAddon.findMany({where:{id:{in:addonIds},available:true,productId:{in:ids}}}):[];
    for(const item of input.data.items)for(const choice of item.addons??[])if(!addons.some(addon=>addon.id===choice.addonId&&addon.productId===item.productId))return res.status(409).json({error:{code:'ADDON_UNAVAILABLE',message:'A selected extra is no longer available for this item.'}});
    const deliveryFeeMinor = 80000;
    let amounts:{subtotalMinor:number;totalMinor:number};
    try { amounts=calculateOrderAmounts(input.data.items.map(item=>({priceMinor:products.find(p=>p.id===item.productId)!.priceMinor,quantity:item.quantity,addons:(item.addons??[]).map(choice=>({priceMinor:addons.find(addon=>addon.id===choice.addonId)!.priceMinor,quantity:choice.quantity}))})),deliveryFeeMinor); }
    catch { return res.status(400).json({error:{code:'ORDER_TOTAL_INVALID',message:'Order total is outside the supported range.'}}); }
    const {subtotalMinor,totalMinor}=amounts;
    const mockPayment = vendor.isDemo && demoMode;
    const order = await prisma.$transaction(async tx=>{
      for(const item of input.data.items) {
        const product = products.find(p=>p.id===item.productId)!;
        if(product.stock !== null) {
          const changed = await tx.product.updateMany({where:{id:product.id,stock:{gte:item.quantity}},data:{stock:{decrement:item.quantity}}});
          if(changed.count !== 1) throw new Error('STOCK_CONFLICT');
        }
      }
      const created = await tx.order.create({data:{customerId:req.auth!.userId,vendorId:vendor.id,addressId:address.id,deliveryNotes:input.data.deliveryNotes,subtotalMinor,deliveryFeeMinor,totalMinor,idempotencyKey:input.data.idempotencyKey,isDemo:mockPayment,status:mockPayment?OrderStatus.CONFIRMED:OrderStatus.PENDING_PAYMENT,items:{create:input.data.items.map(item=>{const p=products.find(row=>row.id===item.productId)!;return {productId:p.id,nameSnapshot:p.name,unitPriceMinor:p.priceMinor,quantity:item.quantity,addons:{create:(item.addons??[]).map(choice=>{const addon=addons.find(row=>row.id===choice.addonId)!;return{nameSnapshot:addon.name,unitPriceMinor:addon.priceMinor,quantity:choice.quantity};})}};})},events:{create:{status:mockPayment?OrderStatus.CONFIRMED:OrderStatus.PENDING_PAYMENT,actorId:req.auth!.userId,note:mockPayment?'Development mock checkout':'Awaiting payment'}}},include:{items:{include:{addons:true}}}});
      if(mockPayment)await tx.payment.create({data:{orderId:created.id,amountMinor:created.totalMinor,status:'SUCCEEDED',provider:'development-mock',providerReference:`demo_${created.id}`,isDemo:true}});
      return created;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    return res.status(201).json({data:order,paymentMode:mockPayment?'development-mock':'payment-required'});
  } catch(error) {
    if(error instanceof Error && error.message === 'STOCK_CONFLICT') return res.status(409).json({error:{code:'OUT_OF_STOCK',message:'Stock changed while placing this order. Refresh and try again.'}});
    if(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.order.findUnique({where:{idempotencyKey:input.data.idempotencyKey},include:{items:true}});
      if(existing?.customerId === req.auth!.userId) return res.json({data:existing,replayed:true});
      return res.status(409).json({error:{code:'ORDER_CONFLICT',message:'This order request conflicts with an existing order.'}});
    }
    return next(error);
  }
});

app.post('/api/v1/orders/:orderId/pay',requireUser,requireRole(Role.CUSTOMER),async(req:AuthRequest,res,next)=>{
  const input=z.object({method:z.enum(['wallet','paystack'])}).safeParse(req.body);
  if(!input.success)return res.status(400).json({error:{code:'INVALID_PAYMENT_METHOD',message:'Choose wallet or Paystack payment.'}});
  try {
    const order=await prisma.order.findFirst({where:{id:routeParam(req,'orderId'),customerId:req.auth!.userId},select:{id:true,status:true,totalMinor:true,isDemo:true,customer:{select:{email:true}}}});
    if(!order)return res.status(404).json({error:{code:'ORDER_NOT_FOUND',message:'Order not found.'}});
    if(order.status===OrderStatus.CONFIRMED)return res.json({data:{orderId:order.id,status:order.status,replayed:true}});
    if(order.status!==OrderStatus.PENDING_PAYMENT)return res.status(409).json({error:{code:'ORDER_NOT_PAYABLE',message:'This order can no longer be paid.'}});
    if(input.data.method==='wallet'){
      const result=await debitWalletForOrder(req.auth!.userId,order.id,order.totalMinor);
      if(!result.paid){
        if(result.replayed)return res.json({data:{orderId:order.id,status:OrderStatus.CONFIRMED,replayed:true}});
        const wallet=await ensureWallet(req.auth!.userId);
        return res.status(409).json({error:{code:'INSUFFICIENT_WALLET_BALANCE',message:'Your wallet balance is too low for this order.',details:{balanceMinor:wallet.balanceMinor,shortfallMinor:Math.max(0,order.totalMinor-wallet.balanceMinor)}}});
      }
      return res.json({data:{orderId:order.id,status:OrderStatus.CONFIRMED,method:'wallet',balanceMinor:result.balanceMinor}});
    }
    if(!order.customer.email)return res.status(409).json({error:{code:'EMAIL_REQUIRED',message:'Add an email address before paying with Paystack.'}});
    const reference=`order_${order.id}_${randomBytes(10).toString('hex')}`;
    const authorization=await initializePaystackTransaction({email:order.customer.email,amountMinor:order.totalMinor,reference,metadata:{purpose:'order_payment',orderId:order.id,userId:req.auth!.userId}},paystackSecret());
    await prisma.payment.create({data:{orderId:order.id,amountMinor:order.totalMinor,status:'PENDING',provider:'paystack',providerReference:reference}});
    return res.json({data:{orderId:order.id,method:'paystack',...authorization}});
  } catch(error) {
    if(error instanceof PaystackError)return res.status(503).json({error:{code:'PAYSTACK_UNAVAILABLE',message:error.message}});
    if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')return res.status(409).json({error:{code:'PAYMENT_ALREADY_INITIALIZED',message:'A payment has already been initialized. Refresh this order before trying again.'}});
    return next(error);
  }
});

app.get('/api/v1/wallet',requireUser,async(req:AuthRequest,res,next)=>{
  try { void provisionDva(req.auth!.userId); const wallet=await ensureWallet(req.auth!.userId); return res.json({data:{balanceMinor:wallet.balanceMinor,currency:wallet.currency,status:wallet.status,dva:{accountNumber:wallet.dvaAccountNumber,accountName:wallet.dvaAccountName,bankName:wallet.dvaBankName,bankSlug:wallet.dvaBankSlug,status:wallet.dvaStatus},payoutAccount:{accountLast4:wallet.payoutAccountLast4,accountName:wallet.payoutAccountName,bankName:wallet.payoutBankName,bankCode:wallet.payoutBankCode,status:wallet.payoutStatus}}}); }
  catch(error){return next(error);}
});
app.post('/api/v1/wallet/topup/initialize',requireUser,async(req:AuthRequest,res,next)=>{
  const input=z.object({amountMinor:z.number().int().min(10000).max(100_000_000),idempotencyKey:z.string().uuid().optional()}).safeParse(req.body);
  if(!input.success)return res.status(400).json({error:{code:'INVALID_TOPUP',message:'Enter a wallet top-up amount of at least ₦100.'}});
  try {
    const user=await prisma.user.findUniqueOrThrow({where:{id:req.auth!.userId},select:{email:true}});
    if(!user.email)return res.status(409).json({error:{code:'EMAIL_REQUIRED',message:'Add an email address before topping up.'}});
    const reference=`wallet-${req.auth!.userId}-${input.data.idempotencyKey??randomBytes(10).toString('hex')}`;
    const authorization=await initializePaystackTransaction({email:user.email,amountMinor:input.data.amountMinor,reference,metadata:{purpose:'wallet_topup',userId:req.auth!.userId,amountMinor:input.data.amountMinor}},paystackSecret());
    return res.json({data:{method:'paystack',amountMinor:input.data.amountMinor,...authorization}});
  }catch(error){if(error instanceof PaystackError)return res.status(503).json({error:{code:'PAYSTACK_UNAVAILABLE',message:error.message}});return next(error);}
});
app.post('/api/v1/wallet/topup/verify',requireUser,async(req:AuthRequest,res,next)=>{
  const input=z.object({reference:z.string().trim().min(8).max(120)}).safeParse(req.body);
  if(!input.success)return res.status(400).json({error:{code:'INVALID_TOPUP_REFERENCE',message:'A valid Paystack reference is required.'}});
  try{
    const verified=await verifyPaystackTransaction(input.data.reference,paystackSecret());
    if(verified.status!=='success')return res.status(202).json({data:{status:verified.status,credited:false}});
    const metadataAmount=typeof verified.metadata.amountMinor==='number'?verified.metadata.amountMinor:Number(verified.metadata.amountMinor);
    if(verified.metadata.purpose!=='wallet_topup'||verified.metadata.userId!==req.auth!.userId||!Number.isSafeInteger(metadataAmount)||metadataAmount!==verified.amountMinor)return res.status(404).json({error:{code:'TOPUP_NOT_FOUND',message:'This payment reference does not belong to your wallet.'}});
    const transactionReference=`paystack_${verified.reference}`;
    try{await creditWallet({userId:req.auth!.userId,amountMinor:verified.amountMinor,reference:transactionReference,type:'TOPUP',metadata:{channel:verified.channel}});}
    catch(error){if(!(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')||!await prisma.walletTransaction.findUnique({where:{reference:transactionReference},select:{id:true}}))throw error;}
    const wallet=await ensureWallet(req.auth!.userId);
    return res.json({data:{status:'success',credited:true,balanceMinor:wallet.balanceMinor}});
  }catch(error){if(error instanceof PaystackError)return res.status(503).json({error:{code:'PAYSTACK_UNAVAILABLE',message:error.message}});return next(error);}
});
app.post('/api/v1/wallet/dva/retry',requireUser,async(req:AuthRequest,res,next)=>{
  try { const wallet=await ensureWallet(req.auth!.userId);if(wallet.dvaStatus==='ACTIVE')return res.json({data:{status:'ACTIVE'}});await prisma.wallet.update({where:{id:wallet.id},data:{dvaStatus:'PENDING'}});void provisionDva(req.auth!.userId);return res.status(202).json({data:{status:'PENDING'}}); }
  catch(error){return next(error);}
});

app.get('/api/v1/vendor/wallet',requireUser,requireRole(Role.VENDOR),async(req:AuthRequest,res,next)=>{
  try{
    const vendor=await prisma.vendor.findFirst({where:{ownerId:req.auth!.userId,status:{in:[VendorStatus.DRAFT,VendorStatus.PENDING_REVIEW,VendorStatus.APPROVED]}},select:{id:true,status:true}});
    if(!vendor)return res.status(403).json({error:{code:'VENDOR_NOT_APPROVED',message:'An approved vendor account is required.'}});
    void provisionDva(req.auth!.userId);
    const wallet=await ensureWallet(req.auth!.userId);
    const transactions=await prisma.walletTransaction.findMany({where:{walletId:wallet.id},orderBy:{createdAt:'desc'},take:50,select:{id:true,type:true,direction:true,status:true,amountMinor:true,balanceAfter:true,reference:true,orderId:true,createdAt:true}});
    return res.json({data:{vendorStatus:vendor.status,balanceMinor:wallet.balanceMinor,currency:wallet.currency,status:wallet.status,dva:{accountNumber:wallet.dvaAccountNumber,accountName:wallet.dvaAccountName,bankName:wallet.dvaBankName,status:wallet.dvaStatus},payoutAccount:{accountLast4:wallet.payoutAccountLast4,accountName:wallet.payoutAccountName,bankName:wallet.payoutBankName,bankCode:wallet.payoutBankCode,status:wallet.payoutStatus},transactions}});
  }catch(error){return next(error);}
});

app.get('/api/v1/vendor/wallet/banks',requireUser,requireRole(Role.VENDOR),async(req:AuthRequest,res,next)=>{
  try{
    const vendor=await prisma.vendor.findFirst({where:{ownerId:req.auth!.userId,status:{in:[VendorStatus.DRAFT,VendorStatus.PENDING_REVIEW,VendorStatus.APPROVED]}},select:{id:true}});
    if(!vendor)return res.status(403).json({error:{code:'VENDOR_NOT_APPROVED',message:'An approved vendor account is required.'}});
    return res.json({data:await listPaystackBanks(paystackSecret())});
  }catch(error){if(error instanceof PaystackError)return res.status(503).json({error:{code:'PAYSTACK_UNAVAILABLE',message:error.message}});return next(error);}
});

app.put('/api/v1/vendor/wallet/payout-account',requireUser,requireRole(Role.VENDOR),async(req:AuthRequest,res,next)=>{
  const input=z.object({accountNumber:z.string().trim().regex(/^\d{10}$/),bankCode:z.string().trim().min(2).max(12)}).safeParse(req.body);
  if(!input.success)return res.status(400).json({error:{code:'INVALID_PAYOUT_ACCOUNT',message:'Enter a valid 10 digit NUBAN account number and choose a bank.'}});
  try{
    const vendor=await prisma.vendor.findFirst({where:{ownerId:req.auth!.userId,status:{in:[VendorStatus.DRAFT,VendorStatus.PENDING_REVIEW,VendorStatus.APPROVED]}},select:{id:true}});
    if(!vendor)return res.status(403).json({error:{code:'VENDOR_NOT_APPROVED',message:'An approved vendor account is required.'}});
    const banks=await listPaystackBanks(paystackSecret());const bank=banks.find(row=>row.code===input.data.bankCode);
    if(!bank)return res.status(400).json({error:{code:'BANK_NOT_AVAILABLE',message:'Choose a supported Nigerian bank.'}});
    const resolved=await resolvePaystackBankAccount(input.data.accountNumber,input.data.bankCode,paystackSecret());
    const recipient=await createPaystackTransferRecipient({name:resolved.accountName,accountNumber:resolved.accountNumber,bankCode:input.data.bankCode},paystackSecret());
    const wallet=await ensureWallet(req.auth!.userId);
    const updated=await prisma.wallet.update({where:{id:wallet.id},data:{payoutAccountLast4:resolved.accountNumber.slice(-4),payoutAccountName:resolved.accountName,payoutBankName:bank.name,payoutBankCode:input.data.bankCode,payoutRecipientCode:recipient.recipientCode,payoutStatus:'VERIFIED'}});
    return res.json({data:{accountLast4:updated.payoutAccountLast4,accountName:updated.payoutAccountName,bankName:updated.payoutBankName,bankCode:updated.payoutBankCode,status:updated.payoutStatus}});
  }catch(error){if(error instanceof PaystackError)return res.status(503).json({error:{code:'PAYSTACK_UNAVAILABLE',message:error.message}});return next(error);}
});

app.post('/api/v1/vendor/wallet/withdraw',requireUser,requireRole(Role.VENDOR),async(req:AuthRequest,res,next)=>{
  const input=z.object({amountMinor:z.number().int().min(10000).max(100_000_000),idempotencyKey:z.string().uuid()}).safeParse(req.body);
  if(!input.success)return res.status(400).json({error:{code:'INVALID_WITHDRAWAL',message:'Enter a withdrawal amount from ₦100 and a valid request key.'}});
  let requestReference:string|undefined;let reservationCreated=false;
  try{
    const vendor=await prisma.vendor.findFirst({where:{ownerId:req.auth!.userId,status:VendorStatus.APPROVED},select:{id:true}});
    if(!vendor)return res.status(403).json({error:{code:'VENDOR_NOT_APPROVED',message:'An approved vendor account is required.'}});
    const wallet=await ensureWallet(req.auth!.userId);
    if(wallet.payoutStatus!=='VERIFIED'||!wallet.payoutRecipientCode)return res.status(409).json({error:{code:'PAYOUT_ACCOUNT_REQUIRED',message:'Add and verify a Nigerian bank account before withdrawing.'}});
    const reference=`swv_${createHash('sha256').update(`${req.auth!.userId}:${input.data.idempotencyKey}`).digest('hex').slice(0,40)}`;
    requestReference=reference;
    const reservation=await prisma.$transaction(async tx=>{
      const existing=await tx.walletTransaction.findUnique({where:{reference}});
      if(existing)return existing;
      const debit=await tx.wallet.updateMany({where:{id:wallet.id,status:'ACTIVE',balanceMinor:{gte:input.data.amountMinor}},data:{balanceMinor:{decrement:input.data.amountMinor}}});
      if(!debit.count)throw new Error('INSUFFICIENT_VENDOR_WALLET_BALANCE');
      const updated=await tx.wallet.findUniqueOrThrow({where:{id:wallet.id},select:{balanceMinor:true}});
      return tx.walletTransaction.create({data:{walletId:wallet.id,userId:req.auth!.userId,type:'WITHDRAWAL',direction:'DEBIT',status:'PENDING',amountMinor:input.data.amountMinor,balanceAfter:updated.balanceMinor,reference,metadata:{recipientCode:wallet.payoutRecipientCode}}});
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    reservationCreated=true;
    if(reservation.status==='SUCCEEDED')return res.json({data:{status:'SUCCEEDED',reference,balanceMinor:(await prisma.wallet.findUniqueOrThrow({where:{id:wallet.id},select:{balanceMinor:true}})).balanceMinor}});
    if(reservation.status!=='PENDING')return res.status(409).json({error:{code:'WITHDRAWAL_ALREADY_FINAL',message:'This withdrawal request has already been finalized. Start a new withdrawal if needed.'}});
    const metadata=reservation.metadata;
    const recipientCode=metadata&&typeof metadata==='object'&&!Array.isArray(metadata)&&'recipientCode'in metadata&&typeof metadata.recipientCode==='string'?metadata.recipientCode:null;
    if(!recipientCode)return res.status(409).json({error:{code:'WITHDRAWAL_RECIPIENT_MISSING',message:'The saved bank recipient for this withdrawal is unavailable.'}});
    const transfer=await initiatePaystackTransfer({amountMinor:reservation.amountMinor,recipientCode,reference,reason:'Smile vendor wallet withdrawal'},paystackSecret());
    const status=transfer.status.toLowerCase()==='success'?'SUCCEEDED':'PENDING';
    const updated=await prisma.walletTransaction.update({where:{id:reservation.id},data:{status,metadata:{recipientCode,transferCode:transfer.transferCode,providerStatus:transfer.status}}});
    const currentWallet=await prisma.wallet.findUniqueOrThrow({where:{id:wallet.id},select:{balanceMinor:true}});
    return res.status(status==='PENDING'?202:200).json({data:{status,reference:updated.reference,balanceMinor:currentWallet.balanceMinor}});
  }catch(error){
    if(error instanceof Error&&error.message==='INSUFFICIENT_VENDOR_WALLET_BALANCE')return res.status(409).json({error:{code:'INSUFFICIENT_WALLET_BALANCE',message:'Your vendor wallet balance is too low for this withdrawal.'}});
    if(error instanceof PaystackError&&reservationCreated&&requestReference){await settleVendorTransfer(requestReference,'transfer.failed');return res.status(503).json({error:{code:'PAYOUT_REJECTED',message:'Paystack could not start the payout. The reserved amount has been returned to your wallet.'}});}
    if(reservationCreated&&requestReference){console.error(JSON.stringify({event:'vendor_withdrawal_confirmation_pending',reference:requestReference,errorType:error instanceof Error?error.name:'unknown'}));return res.status(202).json({data:{status:'PENDING',reference:requestReference,message:'The transfer status is being confirmed.'}});}
    return next(error);
  }
});

app.post(['/webhooks/paystack','/api/v1/webhooks/paystack'],async(req:RawRequest,res,next)=>{
  const secret=paystackSecret();
  if(!verifyPaystackSignature(req.rawBody??Buffer.from(''),req.header('x-paystack-signature'),secret))return res.status(401).json({error:{code:'INVALID_SIGNATURE',message:'Invalid Paystack webhook signature.'}});
  const payload=req.body as {event?:unknown;data?:Record<string,unknown>};const event=typeof payload.event==='string'?payload.event:'';const data=payload.data&&typeof payload.data==='object'?payload.data:{};const reference=typeof data.reference==='string'?data.reference:null;
  const eventKey=`${event}:${typeof data.id==='string'||typeof data.id==='number'?data.id:reference??createHash('sha256').update(req.rawBody??'').digest('hex')}`;
  try {
    await prisma.paystackWebhookEvent.create({data:{eventKey,event,reference,payload:req.body as Prisma.InputJsonValue}});
  } catch(error) {
    if(!(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002'))return next(error);
    const prior=await prisma.paystackWebhookEvent.findUnique({where:{eventKey},select:{processedAt:true}});
    if(prior?.processedAt)return res.status(200).json({data:{received:true,duplicate:true}});
  }
  try {
    if(reference&&['transfer.success','transfer.failed','transfer.reversed'].includes(event))await settleVendorTransfer(reference,event as 'transfer.success'|'transfer.failed'|'transfer.reversed');
    if(event==='charge.success'&&reference) {
      const verified=await verifyPaystackTransaction(reference,secret);
      if(verified.status!=='success')throw new PaystackError('Paystack verification did not confirm a successful charge.');
      const purpose=typeof verified.metadata.purpose==='string'?verified.metadata.purpose:'';
      const userId=typeof verified.metadata.userId==='string'?verified.metadata.userId:null;
      const orderId=typeof verified.metadata.orderId==='string'?verified.metadata.orderId:null;
      if(purpose==='wallet_topup'&&userId) await creditWallet({userId,amountMinor:verified.amountMinor,reference:`paystack_${verified.reference}`,type:'TOPUP',metadata:{channel:verified.channel}});
      if(verified.channel==='dedicated_nuban'&&purpose!=='wallet_topup') {
        let wallet=verified.accountNumber?await prisma.wallet.findUnique({where:{dvaAccountNumber:verified.accountNumber},select:{userId:true}}):null;
        if(!wallet&&verified.customerCode)wallet=await prisma.wallet.findUnique({where:{paystackCustomerCode:verified.customerCode},select:{userId:true}});
        if(wallet)await creditWallet({userId:wallet.userId,amountMinor:verified.amountMinor,reference:`paystack_${verified.reference}`,type:'TOPUP',metadata:{channel:'dedicated_nuban'}});
      }
      if(purpose==='order_payment'&&userId&&orderId) await prisma.$transaction(async tx=>{
        const payment=await tx.payment.findUnique({where:{providerReference:verified.reference}});if(!payment||payment.orderId!==orderId||payment.amountMinor!==verified.amountMinor)throw new PaystackError('Payment reference does not match its order.');
        const changed=await tx.order.updateMany({where:{id:orderId,customerId:userId,status:OrderStatus.PENDING_PAYMENT},data:{status:OrderStatus.CONFIRMED}});
        if(changed.count)await tx.orderStatusEvent.create({data:{orderId,status:OrderStatus.CONFIRMED,actorId:userId,note:'Paystack payment verified'}});
        await tx.payment.update({where:{id:payment.id},data:{status:'SUCCEEDED'}});
      },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    }
    if(event==='charge.failed'&&reference)await prisma.payment.updateMany({where:{providerReference:reference,status:'PENDING'},data:{status:'FAILED'}});
    await prisma.paystackWebhookEvent.update({where:{eventKey},data:{processedAt:new Date()}});
    return res.json({data:{received:true}});
  } catch(error) { console.error(JSON.stringify({event:'paystack_webhook_processing_failed',eventKey,errorType:error instanceof Error?error.name:'unknown'}));return res.status(500).json({error:{code:'WEBHOOK_PROCESSING_FAILED',message:'Webhook processing will be retried.'}}); }
});

async function cancelOrderForRole(orderId:string,userId:string,role:CancellationRole,reason:typeof cancellationReasons[number],details?:string){
  const owner=role==='VENDOR'?await prisma.vendor.findFirst({where:{ownerId:userId,status:VendorStatus.APPROVED},select:{id:true}}):null;
  if(role==='VENDOR'&&!owner)throw Object.assign(new Error('An approved vendor account is required.'),{status:403,code:'VENDOR_NOT_APPROVED'});
  const rider=role==='RIDER'?await prisma.riderProfile.findUnique({where:{userId}}):null;
  if(role==='RIDER'&&(!rider||rider.status!==VendorStatus.APPROVED))throw Object.assign(new Error('An approved rider account is required.'),{status:403,code:'RIDER_NOT_APPROVED'});
  const order=await prisma.order.findFirst({where:{...(role==='RIDER'?{delivery:{is:{id:orderId,assignedRiderId:rider!.id}}}:{id:orderId}),...(role==='CUSTOMER'?{customerId:userId}:{}),...(owner?{vendorId:owner.id}:{})},include:{items:{select:{productId:true,quantity:true}},delivery:{select:{id:true,status:true,assignedRiderId:true}}}});
  if(!order)throw Object.assign(new Error('This order was not found or is not assigned to you.'),{status:404,code:'ORDER_NOT_FOUND'});
  const cancellableStatuses:OrderStatus[]=[OrderStatus.PENDING_PAYMENT,OrderStatus.CONFIRMED,OrderStatus.ACCEPTED_BY_VENDOR,OrderStatus.PREPARING,OrderStatus.READY_FOR_PICKUP,OrderStatus.RIDER_ASSIGNED,OrderStatus.PICKED_UP];
  if(!cancellableStatuses.includes(order.status))throw Object.assign(new Error('This order can no longer be cancelled.'),{status:409,code:'ORDER_NOT_CANCELLABLE'});
  if(role!=='RIDER'&&order.status===OrderStatus.PICKED_UP)throw Object.assign(new Error('The order can no longer be cancelled after rider pickup.'),{status:409,code:'ORDER_NOT_CANCELLABLE'});
  if(role==='RIDER'&&(!order.delivery||!activeDeliveryStatuses.includes(order.delivery.status)))throw Object.assign(new Error('Only an active delivery assigned to you can be cancelled.'),{status:409,code:'DELIVERY_NOT_CANCELLABLE'});
  const range=nigeriaDayRange();
  await prisma.$transaction(async tx=>{
    const count=await tx.orderStatusEvent.count({where:{actorId:userId,status:OrderStatus.CANCELLED,createdAt:range}});
    if(count>=cancellationLimits[role])throw Object.assign(new Error(`You reached today’s ${cancellationLimits[role]} cancellation limit.`),{status:429,code:'DAILY_CANCELLATION_LIMIT'});
    const changed=await tx.order.updateMany({where:{id:order.id,status:order.status},data:{status:OrderStatus.CANCELLED}});
    if(!changed.count)throw Object.assign(new Error('The order changed. Refresh and try again.'),{status:409,code:'ORDER_STATE_CONFLICT'});
    if(order.status!==OrderStatus.PICKED_UP)for(const item of order.items)await tx.product.updateMany({where:{id:item.productId,stock:{not:null}},data:{stock:{increment:item.quantity}}});
    if(order.delivery){
      await tx.delivery.updateMany({where:{id:order.delivery.id,status:{in:[DeliveryStatus.OFFERING,DeliveryStatus.UNASSIGNED,DeliveryStatus.ASSIGNED,DeliveryStatus.PICKED_UP]}},data:{status:DeliveryStatus.EXCEPTION,assignedRiderId:null}});
      await tx.riderOffer.updateMany({where:{deliveryId:order.delivery.id,status:RiderOfferStatus.PENDING},data:{status:RiderOfferStatus.EXPIRED}});
    }
    await tx.payment.updateMany({where:{orderId:order.id,isDemo:true,status:'SUCCEEDED'},data:{status:'REFUNDED'}});
    await tx.orderStatusEvent.create({data:{orderId:order.id,status:OrderStatus.CANCELLED,actorId:userId,note:cancellationNote(reason,details)}});
    if(role==='RIDER'&&rider)await tx.riderProfile.update({where:{id:rider.id},data:{available:false}});
    else if(order.delivery?.assignedRiderId)await tx.riderProfile.updateMany({where:{id:order.delivery.assignedRiderId},data:{available:true}});
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  return {id:order.id,status:OrderStatus.CANCELLED,reason,details:details??null};
}
async function cancellationRoute(req:AuthRequest,res:import('express').Response,next:import('express').NextFunction,role:CancellationRole){
  const input=cancellationInput(req.body);if(!input.success)return res.status(400).json({error:{code:'INVALID_CANCELLATION_REASON',message:input.error.issues[0]?.message??'Choose a cancellation reason.'}});
  const allowed:Record<CancellationRole,readonly string[]>={CUSTOMER:['NO_LONGER_INTERESTED','ORDERED_BY_MISTAKE','DELIVERY_TAKING_TOO_LONG','OTHER'],VENDOR:['OUT_OF_STOCK','NOT_AVAILABLE','PRICE_CHANGED','OTHER'],RIDER:['VEHICLE_BREAKDOWN','EMERGENCY','OTHER']};
  if(!allowed[role].includes(input.data.reason))return res.status(400).json({error:{code:'INVALID_CANCELLATION_REASON',message:'Choose a reason available for your account.'}});
  try{return res.json({data:await cancelOrderForRole(routeParam(req,'orderId')||routeParam(req,'deliveryId'),req.auth!.userId,role,input.data.reason,input.data.details)});}
  catch(error){const failure=error as Error&{status?:number;code?:string};if(failure.status)return res.status(failure.status).json({error:{code:failure.code??'CANCELLATION_FAILED',message:failure.message}});if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2034')return res.status(409).json({error:{code:'CANCELLATION_CONFLICT',message:'The order changed while cancelling. Refresh and try again.'}});return next(error);}
}
app.post('/api/v1/orders/:orderId/cancel',requireUser,requireRole(Role.CUSTOMER),(req:AuthRequest,res,next)=>cancellationRoute(req,res,next,'CUSTOMER'));
app.post('/api/v1/vendor/orders/:orderId/cancel',requireUser,requireRole(Role.VENDOR),(req:AuthRequest,res,next)=>cancellationRoute(req,res,next,'VENDOR'));
app.post('/api/v1/rider/deliveries/:deliveryId/cancel',requireUser,requireRole(Role.RIDER),(req:AuthRequest,res,next)=>cancellationRoute(req,res,next,'RIDER'));

app.get('/api/v1/orders',requireUser,requireRole(Role.CUSTOMER),async (req:AuthRequest,res,next) => {
  try {
    const rows=await prisma.order.findMany({where:{customerId:req.auth!.userId},orderBy:{createdAt:'desc'},take:50,include:{items:{include:{addons:true}},vendor:{select:{id:true,name:true}},events:{select:{id:true,status:true,note:true,createdAt:true},orderBy:{createdAt:'asc'}},delivery:{include:{assignedRider:{include:{user:{select:{name:true,phone:true}}}}}}}});
    const data=rows.map(({delivery,...order})=>{const riderVisible=Boolean(delivery?.assignedRiderId&&activeDeliveryStatuses.includes(delivery.status));return{...order,delivery:delivery?{status:delivery.status,assignedAt:delivery.assignedAt,riderName:riderVisible?delivery.assignedRider?.user.name??null:null,riderPhone:riderVisible?delivery.assignedRider?.user.phone??null:null,riderVehicleType:riderVisible?delivery.assignedRider?.vehicleType??null:null}:null,deliveryCode:delivery?.assignedRiderId&&activeDeliveryStatuses.includes(delivery.status)?deliveryOtp(delivery.id):null};});
    return res.json({data});
  }
  catch(error) { return next(error); }
});
app.get('/api/v1/orders/:orderId/tracking',requireUser,requireRole(Role.CUSTOMER),async(req:AuthRequest,res,next)=>{
  try{
    const order=await prisma.order.findFirst({where:{id:routeParam(req,'orderId'),customerId:req.auth!.userId},select:{id:true,vendor:{select:{id:true,name:true,address:true,latitude:true,longitude:true,geocodedAt:true}},address:{select:{id:true,line1:true,city:true,latitude:true,longitude:true,geocodedAt:true}},delivery:{select:{id:true,status:true,assignedRiderId:true,assignedRider:{select:{location:{select:{latitude:true,longitude:true,updatedAt:true}}}}}}}});
    if(!order)return res.status(404).json({error:{code:'ORDER_NOT_FOUND',message:'This order was not found.'}});
    const delivery=order.delivery;
    if(!delivery||!delivery.assignedRiderId||!activeDeliveryStatuses.includes(delivery.status))return res.status(409).json({error:{code:'TRACKING_UNAVAILABLE',message:'Live rider tracking is available after a rider is assigned.'}});
    const [vendorPoint,customerPoint]=await Promise.all([freshVendorCoordinates(order.vendor),order.address?freshAddressCoordinates(order.address):null]);
    const location=delivery.assignedRider?.location;
    const rider=location&&Date.now()-location.updatedAt.getTime()<5*60_000
      ?{latitude:Number(location.latitude),longitude:Number(location.longitude),updatedAt:location.updatedAt.toISOString()}
      :null;
    return res.json({data:{deliveryId:delivery.id,deliveryStatus:delivery.status,vendor:{name:order.vendor.name,latitude:vendorPoint?.latitude??null,longitude:vendorPoint?.longitude??null},customer:{latitude:customerPoint?.latitude??null,longitude:customerPoint?.longitude??null},rider}});
  }catch(error){return next(error);}
});
app.get('/api/v1/wallet/transactions',requireUser,requireRole(Role.CUSTOMER),async(req:AuthRequest,res,next)=>{
  try{
    const data=await prisma.payment.findMany({where:{order:{customerId:req.auth!.userId}},orderBy:{createdAt:'desc'},take:100,select:{id:true,amountMinor:true,status:true,provider:true,isDemo:true,createdAt:true,order:{select:{id:true,vendor:{select:{name:true}}}}}});
    return res.json({data});
  }catch(error){return next(error);}
});

app.get('/api/v1/vendor/orders',requireUser,requireRole(Role.VENDOR),async (req:AuthRequest,res,next) => {
  try {
    const vendor = await prisma.vendor.findFirst({where:{ownerId:req.auth!.userId},select:{id:true}});
    if(!vendor) return res.status(403).json({error:{code:'VENDOR_NOT_APPROVED',message:'An approved vendor account is required.'}});
    const rows = await prisma.order.findMany({where:{vendorId:vendor.id},orderBy:{createdAt:'asc'},take:100,include:{items:{include:{addons:true}},events:{orderBy:{createdAt:'asc'}},delivery:{include:{assignedRider:{include:{user:{select:{name:true}}}}}}}});
    const data=rows.map(({delivery,...order})=>({...order,delivery:delivery?{status:delivery.status,assignedAt:delivery.assignedAt,riderName:delivery.assignedRider?.user.name??null,pickupVerified:delivery.pickupVerifiedAt!==null}:null}));
    return res.json({data});
  } catch(error) { return next(error); }
});

app.post('/api/v1/vendor/orders/:orderId/pickup',requireUser,requireRole(Role.VENDOR),async(req:AuthRequest,res,next)=>{
  const input=z.object({code:z.string().regex(/^\d{6}$/)}).safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'INVALID_PICKUP_CODE',message:'Enter the six-digit code shown in the rider app.'}});
  try{
    const vendor=await prisma.vendor.findFirst({where:{ownerId:req.auth!.userId,status:VendorStatus.APPROVED},select:{id:true}});if(!vendor)return res.status(403).json({error:{code:'VENDOR_NOT_APPROVED',message:'An approved vendor account is required.'}});
    const order=await prisma.order.findFirst({where:{id:routeParam(req,'orderId'),vendorId:vendor.id},select:{id:true,delivery:{select:{id:true,status:true,assignedRiderId:true,pickupVerifiedAt:true,pickupProofAttempts:true}}}});if(!order)return res.status(404).json({error:{code:'ORDER_NOT_FOUND',message:'Order not found.'}});
    const delivery=order.delivery;if(!delivery||delivery.status!==DeliveryStatus.ASSIGNED||!delivery.assignedRiderId)return res.status(409).json({error:{code:'INVALID_DELIVERY_STATE',message:'This order does not have a rider awaiting pickup.'}});if(delivery.pickupVerifiedAt)return res.status(409).json({error:{code:'PICKUP_ALREADY_VERIFIED',message:'The rider pickup has already been verified.'}});if(delivery.pickupProofAttempts>=5)return res.status(429).json({error:{code:'PICKUP_CODE_LOCKED',message:'Too many incorrect codes. Contact support.'}});
    const expected=Buffer.from(vendorPickupOtp(delivery.id));const provided=Buffer.from(input.data.code);if(!timingSafeEqual(expected,provided)){const attempt=await prisma.delivery.updateMany({where:{id:delivery.id,status:DeliveryStatus.ASSIGNED,pickupVerifiedAt:null,pickupProofAttempts:{lt:5}},data:{pickupProofAttempts:{increment:1}}});if(!attempt.count)return res.status(429).json({error:{code:'PICKUP_CODE_LOCKED',message:'Too many incorrect codes. Contact support.'}});return res.status(403).json({error:{code:'INVALID_PICKUP_CODE',message:'That rider pickup code does not match. Ask the rider to show it again.'}});}
    await prisma.$transaction(async tx=>{const changed=await tx.delivery.updateMany({where:{id:delivery.id,status:DeliveryStatus.ASSIGNED,pickupVerifiedAt:null},data:{status:DeliveryStatus.PICKED_UP,pickedUpAt:new Date(),pickupVerifiedAt:new Date()}});if(!changed.count)throw new Error('DELIVERY_STATE_CONFLICT');await tx.order.update({where:{id:order.id},data:{status:OrderStatus.PICKED_UP}});await tx.orderStatusEvent.create({data:{orderId:order.id,status:OrderStatus.PICKED_UP,actorId:req.auth!.userId,note:'Vendor verified rider pickup code'}});});
    return res.json({data:{deliveryId:delivery.id,status:DeliveryStatus.PICKED_UP,verified:true}});
  }catch(error){if(error instanceof Error&&error.message==='DELIVERY_STATE_CONFLICT')return res.status(409).json({error:{code:'DELIVERY_STATE_CONFLICT',message:'The delivery status changed. Refresh and try again.'}});if(error instanceof Error&&error.message.includes('DELIVERY_OTP_SECRET'))return res.status(503).json({error:{code:'DELIVERY_PROOF_UNAVAILABLE',message:'Pickup verification is not configured.'}});return next(error);}
});

app.post('/api/v1/vendor/orders/:orderId/status',requireUser,requireRole(Role.VENDOR),async (req:AuthRequest,res,next) => {
  const input = z.object({status:z.enum([OrderStatus.ACCEPTED_BY_VENDOR,OrderStatus.REJECTED,OrderStatus.PREPARING,OrderStatus.READY_FOR_PICKUP]),reason:z.enum(['NOT_AVAILABLE','OUT_OF_STOCK']).optional()}).safeParse(req.body);
  if(!input.success) return res.status(400).json({error:{code:'INVALID_STATUS',message:'That vendor order status is invalid.'}});
  if(input.data.status===OrderStatus.REJECTED&&!input.data.reason) return res.status(400).json({error:{code:'REJECTION_REASON_REQUIRED',message:'Choose why this order cannot be fulfilled.'}});
  if(input.data.status!==OrderStatus.REJECTED&&input.data.reason) return res.status(400).json({error:{code:'INVALID_REASON',message:'A decline reason is only valid when rejecting an order.'}});
  if(input.data.status===OrderStatus.READY_FOR_PICKUP&&!deliveryProofSecret()) return res.status(503).json({error:{code:'DELIVERY_PROOF_UNAVAILABLE',message:'Set DELIVERY_OTP_SECRET before sending deliveries to riders.'}});
  try {
    const vendor = await prisma.vendor.findFirst({where:{ownerId:req.auth!.userId,status:VendorStatus.APPROVED}});
    if(!vendor) return res.status(403).json({error:{code:'VENDOR_NOT_APPROVED',message:'An approved vendor account is required.'}});
    const order = await prisma.order.findFirst({where:{id:routeParam(req,'orderId'),vendorId:vendor.id}});
    if(!order) return res.status(404).json({error:{code:'ORDER_NOT_FOUND',message:'Order not found.'}});
    if(!canVendorTransition(order.status,input.data.status)) return res.status(409).json({error:{code:'INVALID_TRANSITION',message:'The order has changed or this transition is not allowed.'}});
    const result = await prisma.$transaction(async tx=>{
      const update = await tx.order.updateMany({where:{id:order.id,status:order.status},data:{status:input.data.status}});
      if(update.count !== 1) throw new Error('ORDER_STATE_CONFLICT');
      const rejectionNote=input.data.reason==='NOT_AVAILABLE'?'Declined: item not available':'Declined: out of stock';
      await tx.orderStatusEvent.create({data:{orderId:order.id,status:input.data.status,actorId:req.auth!.userId,note:input.data.status===OrderStatus.REJECTED?rejectionNote:null}});
      if(input.data.status === OrderStatus.REJECTED) await tx.payment.updateMany({where:{orderId:order.id,isDemo:true,status:'SUCCEEDED'},data:{status:'REFUNDED'}});
      let deliveryId:string|undefined;
      if(input.data.status === OrderStatus.READY_FOR_PICKUP) {
        const delivery=await tx.delivery.create({data:{orderId:order.id,status:DeliveryStatus.UNASSIGNED}});
        deliveryId=delivery.id;
      }
      const updatedOrder=await tx.order.findUnique({where:{id:order.id},include:{items:true,events:{orderBy:{createdAt:'asc'}}}});
      return {updatedOrder,deliveryId};
    });
    if(result.deliveryId)await dispatchDeliveryOffers(result.deliveryId);
    return res.json({data:result.updatedOrder});
  } catch(error) {
    if(error instanceof Error && error.message === 'ORDER_STATE_CONFLICT') return res.status(409).json({error:{code:'ORDER_STATE_CONFLICT',message:'The order changed. Refresh and try again.'}});
    return next(error);
  }
});

app.get('/api/v1/admin/overview',requireUser,requireAdminPermission('dashboard.read'),async(req,res,next)=>{
  const input=z.object({from:z.coerce.date().optional(),to:z.coerce.date().optional()}).safeParse(req.query);
  if(!input.success||input.data.from&&input.data.to&&input.data.from>=input.data.to)return res.status(400).json({error:{code:'INVALID_DATE_RANGE',message:'The dashboard date range is invalid.'}});
  const dateRange=input.data.from||input.data.to?{createdAt:{...(input.data.from?{gte:input.data.from}:{}),...(input.data.to?{lt:input.data.to}:{})}}:{};
  const locationFreshSince=new Date(Date.now()-5*60_000);
  try{
    const [groups,customers,vendors,riders,availableRiders,gmv,deliveryFees,payments,delivered,recentOrders,trend]=await Promise.all([
      prisma.order.groupBy({by:['status'],where:{isDemo:false,...dateRange},_count:{_all:true}}),
      prisma.user.count({where:{isDemo:false,roles:{has:Role.CUSTOMER}}}),
      prisma.vendor.count({where:{isDemo:false,status:VendorStatus.APPROVED}}),
      prisma.riderProfile.count({where:{user:{isDemo:false},status:VendorStatus.APPROVED}}),
      prisma.riderProfile.count({where:{user:{isDemo:false},status:VendorStatus.APPROVED,available:true,location:{is:{updatedAt:{gte:locationFreshSince}}}}}),
      prisma.order.aggregate({where:{isDemo:false,status:OrderStatus.DELIVERED,...dateRange},_sum:{subtotalMinor:true}}),
      prisma.order.aggregate({where:{isDemo:false,status:OrderStatus.DELIVERED,...dateRange},_sum:{deliveryFeeMinor:true}}),
      prisma.payment.aggregate({where:{isDemo:false,status:'SUCCEEDED',...(input.data.from||input.data.to?{createdAt:{...(input.data.from?{gte:input.data.from}:{}),...(input.data.to?{lt:input.data.to}:{})}}:{})},_sum:{amountMinor:true}}),
      prisma.delivery.findMany({where:{status:DeliveryStatus.DELIVERED,deliveredAt:input.data.from||input.data.to?{...(input.data.from?{gte:input.data.from}:{}),...(input.data.to?{lt:input.data.to}:{})}:{not:null},order:{isDemo:false,...dateRange}},select:{assignedAt:true,deliveredAt:true}}),
      prisma.order.findMany({where:{isDemo:false,...dateRange},orderBy:{createdAt:'desc'},take:8,select:{id:true,status:true,totalMinor:true,createdAt:true,customer:{select:{name:true}},vendor:{select:{name:true}}}}),
      prisma.$queryRaw<Array<{day:string;orders:number;gmvMinor:bigint}>>`
        SELECT TO_CHAR(DATE("createdAt" AT TIME ZONE 'Africa/Lagos'),'YYYY-MM-DD') AS day,
          COUNT(*)::int AS orders,
          COALESCE(SUM(CASE WHEN status = 'DELIVERED' THEN "subtotalMinor" ELSE 0 END),0)::bigint AS "gmvMinor"
        FROM "Order"
        WHERE "isDemo" = false
          AND (${input.data.from??null}::timestamptz IS NULL OR "createdAt" >= ${input.data.from??null})
          AND (${input.data.to??null}::timestamptz IS NULL OR "createdAt" < ${input.data.to??null})
        GROUP BY 1 ORDER BY 1
      `
    ]);
    const counts=Object.fromEntries(groups.map(group=>[group.status,group._count._all])) as Record<string,number>;
    const completed=counts[OrderStatus.DELIVERED]??0;
    const cancelled=(counts[OrderStatus.CANCELLED]??0)+(counts[OrderStatus.REJECTED]??0);
    const active=[OrderStatus.CONFIRMED,OrderStatus.ACCEPTED_BY_VENDOR,OrderStatus.PREPARING,OrderStatus.READY_FOR_PICKUP,OrderStatus.RIDER_ASSIGNED,OrderStatus.PICKED_UP,OrderStatus.DELIVERY_EXCEPTION].reduce((sum,status)=>sum+(counts[status]??0),0);
    const terminal=completed+cancelled;
    const durationRows=delivered.filter(row=>row.assignedAt&&row.deliveredAt);
    const averageDeliveryMinutes=durationRows.length?Math.round(durationRows.reduce((sum,row)=>sum+(row.deliveredAt!.getTime()-row.assignedAt!.getTime())/60_000,0)/durationRows.length):null;
    return res.json({data:{
      period:{from:input.data.from??null,to:input.data.to??null,timeZone:'Africa/Lagos'},
      orders:Object.values(counts).reduce((sum,count)=>sum+count,0),completedOrders:completed,activeOrders:active,pendingOrders:counts[OrderStatus.PENDING_PAYMENT]??0,cancelledOrders:cancelled,
      gmvMinor:gmv._sum.subtotalMinor??0,deliveryFeesMinor:deliveryFees._sum.deliveryFeeMinor??0,collectedPaymentsMinor:payments._sum.amountMinor??0,
      platformRevenueMinor:null,riderEarningsMinor:null,customers,activeVendors:vendors,activeRiders:availableRiders,approvedRiders:riders,
      averageOrderValueMinor:completed?Math.round((gmv._sum.subtotalMinor??0)/completed):null,averageDeliveryMinutes,
      completionRate:terminal?completed/terminal:null,recentOrders,trend:trend.map(row=>({day:row.day,orders:row.orders,gmvMinor:Number(row.gmvMinor)})),
    }});
  }catch(error){return next(error);}
});
app.get('/api/v1/admin/orders',requireUser,requireAdminPermission('orders.read'),async(req,res,next)=>{
  const input=z.object({q:z.string().trim().max(120).optional(),status:z.nativeEnum(OrderStatus).optional(),from:z.coerce.date().optional(),to:z.coerce.date().optional(),vendorId:z.string().trim().min(1).max(100).optional(),customerId:z.string().trim().min(1).max(100).optional(),riderId:z.string().trim().min(1).max(100).optional(),paymentStatus:z.string().trim().min(1).max(40).optional(),page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(100).default(25)}).safeParse(req.query);
  if(!input.success)return res.status(400).json({error:{code:'INVALID_QUERY',message:'Order search or pagination is invalid.'}});
  if(input.data.from&&input.data.to&&input.data.from>=input.data.to)return res.status(400).json({error:{code:'INVALID_DATE_RANGE',message:'The order date range is invalid.'}});
  const where:Prisma.OrderWhereInput={isDemo:false,...(input.data.status?{status:input.data.status}:{}),...(input.data.from||input.data.to?{createdAt:{...(input.data.from?{gte:input.data.from}:{}),...(input.data.to?{lt:input.data.to}:{})}}:{}),...(input.data.vendorId?{vendorId:input.data.vendorId}:{}),...(input.data.customerId?{customerId:input.data.customerId}:{}),...(input.data.riderId?{delivery:{is:{assignedRiderId:input.data.riderId}}}:{}),...(input.data.paymentStatus?{payments:{some:{status:input.data.paymentStatus}}}:{}),...(input.data.q?{OR:[{id:{contains:input.data.q,mode:'insensitive'}},{customer:{name:{contains:input.data.q,mode:'insensitive'}}},{vendor:{name:{contains:input.data.q,mode:'insensitive'}}}]}:{})};
  try{
    const [data,total]=await Promise.all([
      prisma.order.findMany({where,orderBy:{createdAt:'desc'},skip:(input.data.page-1)*input.data.limit,take:input.data.limit,include:{customer:{select:{id:true,name:true,email:true,phone:true}},vendor:{select:{id:true,name:true,address:true}},delivery:{include:{assignedRider:{include:{user:{select:{id:true,name:true,phone:true}}}}}},items:{include:{addons:true}},payments:{orderBy:{createdAt:'desc'}},events:{orderBy:{createdAt:'asc'}}}}),
      prisma.order.count({where})
    ]);
    return res.json({data,total,page:input.data.page,pageSize:input.data.limit});
  }catch(error){return next(error);}
});
app.get('/api/v1/admin/customers',requireUser,requireAdminPermission('customers.read'),async(req,res,next)=>{
  const input=z.object({q:z.string().trim().max(120).optional(),page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(100).default(25)}).safeParse(req.query);
  if(!input.success)return res.status(400).json({error:{code:'INVALID_QUERY',message:'Customer search or pagination is invalid.'}});
  const where:Prisma.UserWhereInput={isDemo:false,roles:{has:Role.CUSTOMER},...(input.data.q?{OR:[{name:{contains:input.data.q,mode:'insensitive'}},{email:{contains:input.data.q,mode:'insensitive'}},{phone:{contains:input.data.q}}]}:{})};
  try{
    const [data,total]=await Promise.all([
      prisma.user.findMany({where,orderBy:{createdAt:'desc'},skip:(input.data.page-1)*input.data.limit,take:input.data.limit,select:{id:true,name:true,email:true,phone:true,createdAt:true,wallet:{select:{balanceMinor:true,status:true}},_count:{select:{orders:true,addresses:true}}}}),
      prisma.user.count({where})
    ]);
    return res.json({data,total,page:input.data.page,pageSize:input.data.limit});
  }catch(error){return next(error);}
});
app.get('/api/v1/admin/vendors',requireUser,requireAdminPermission('vendors.read'),async(req,res,next)=>{
  const input=z.object({q:z.string().trim().max(120).optional(),status:z.nativeEnum(VendorStatus).optional(),page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(100).default(25)}).safeParse(req.query);
  if(!input.success)return res.status(400).json({error:{code:'INVALID_QUERY',message:'Vendor search or pagination is invalid.'}});
  const where:Prisma.VendorWhereInput={isDemo:false,...(input.data.status?{status:input.data.status}:{}),...(input.data.q?{OR:[{name:{contains:input.data.q,mode:'insensitive'}},{address:{contains:input.data.q,mode:'insensitive'}},{owner:{name:{contains:input.data.q,mode:'insensitive'}}}]}:{})};
  try{
    const [data,total]=await Promise.all([
      prisma.vendor.findMany({where,orderBy:{createdAt:'desc'},skip:(input.data.page-1)*input.data.limit,take:input.data.limit,select:{id:true,name:true,address:true,status:true,isOpen:true,createdAt:true,contactPhone:true,owner:{select:{id:true,name:true,email:true,phone:true}},_count:{select:{products:true,orders:true}}}}),
      prisma.vendor.count({where})
    ]);
    return res.json({data,total,page:input.data.page,pageSize:input.data.limit});
  }catch(error){return next(error);}
});
app.get('/api/v1/admin/riders',requireUser,requireAdminPermission('riders.read'),async(req,res,next)=>{
  const input=z.object({q:z.string().trim().max(120).optional(),status:z.nativeEnum(VendorStatus).optional(),page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(100).default(25)}).safeParse(req.query);
  if(!input.success)return res.status(400).json({error:{code:'INVALID_QUERY',message:'Rider search or pagination is invalid.'}});
  const where:Prisma.RiderProfileWhereInput={user:{isDemo:false,...(input.data.q?{OR:[{name:{contains:input.data.q,mode:'insensitive'}},{email:{contains:input.data.q,mode:'insensitive'}},{phone:{contains:input.data.q}}]}:{})},...(input.data.status?{status:input.data.status}:{})};
  try{
    const [riders,total]=await Promise.all([
      prisma.riderProfile.findMany({where,orderBy:{user:{createdAt:'desc'}},skip:(input.data.page-1)*input.data.limit,take:input.data.limit,select:{id:true,status:true,available:true,vehicleType:true,serviceArea:true,location:{select:{latitude:true,longitude:true,updatedAt:true}},user:{select:{id:true,name:true,email:true,phone:true,createdAt:true}},_count:{select:{deliveries:true}}}}),
      prisma.riderProfile.count({where})
    ]);
    const freshSince=new Date(Date.now()-5*60_000);
    const data=riders.map(({location,...rider})=>({...rider,createdAt:rider.user.createdAt,location:location&&location.updatedAt>=freshSince?location:null}));
    return res.json({data,total,page:input.data.page,pageSize:input.data.limit,locationFreshnessMinutes:5});
  }catch(error){return next(error);}
});
app.get('/api/v1/admin/transactions',requireUser,requireAdminPermission('finance.read'),async(req,res,next)=>{
  const input=z.object({q:z.string().trim().max(120).optional(),status:z.string().trim().max(40).optional(),page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(100).default(25)}).safeParse(req.query);
  if(!input.success)return res.status(400).json({error:{code:'INVALID_QUERY',message:'Transaction search or pagination is invalid.'}});
  const where:Prisma.PaymentWhereInput={isDemo:false,...(input.data.status?{status:input.data.status}:{}),...(input.data.q?{OR:[{id:{contains:input.data.q,mode:'insensitive'}},{providerReference:{contains:input.data.q,mode:'insensitive'}},{orderId:{contains:input.data.q,mode:'insensitive'}}]}:{})};
  try{
    const [data,total]=await Promise.all([
      prisma.payment.findMany({where,orderBy:{createdAt:'desc'},skip:(input.data.page-1)*input.data.limit,take:input.data.limit,select:{id:true,orderId:true,amountMinor:true,status:true,provider:true,providerReference:true,createdAt:true,updatedAt:true,order:{select:{status:true,customer:{select:{name:true}},vendor:{select:{name:true}}}}}}),
      prisma.payment.count({where})
    ]);
    return res.json({data,total,page:input.data.page,pageSize:input.data.limit});
  }catch(error){return next(error);}
});
app.get('/api/v1/admin/applications',requireUser,async(req:AuthRequest,res,next)=>{
  const canReadVendors=hasAdminPermission(req.auth!.roles,'vendors.read');
  const canReadRiders=hasAdminPermission(req.auth!.roles,'riders.read');
  if(!canReadVendors&&!canReadRiders)return res.status(403).json({error:{code:'FORBIDDEN',message:'You do not have access to administrative applications.'}});
  try{
    const [vendors,riders]=await Promise.all([
      canReadVendors?prisma.vendor.findMany({where:{status:{in:[VendorStatus.DRAFT,VendorStatus.PENDING_REVIEW]},isDemo:false},orderBy:{createdAt:'asc'},take:50,select:{id:true,name:true,address:true,status:true,createdAt:true,owner:{select:{name:true,email:true}}}}):Promise.resolve([]),
      canReadRiders?prisma.riderProfile.findMany({where:{status:{in:[VendorStatus.DRAFT,VendorStatus.PENDING_REVIEW]},user:{isDemo:false}},orderBy:{user:{createdAt:'asc'}},take:50,select:{id:true,status:true,vehicleType:true,serviceArea:true,user:{select:{name:true,email:true,createdAt:true}}}}):Promise.resolve([])
    ]);
    return res.json({data:{vendors,riders}});
  }catch(error){return next(error);}
});
app.get('/api/v1/admin/riders/:riderId/nin-document',requireUser,requireAdminPermission('riders.review'),async(req:AuthRequest,res,next)=>{
  const riderId=routeParam(req,'riderId');
  try{
    const rider=await prisma.riderProfile.findUnique({where:{id:riderId},select:{ninDocumentPublicId:true,ninDocumentVersion:true,user:{select:{isDemo:true}}}});
    if(!rider?.ninDocumentPublicId||!rider.ninDocumentVersion)return res.status(404).json({error:{code:'NIN_DOCUMENT_NOT_FOUND',message:'This rider application has no NIN document.'}});
    await prisma.auditLog.create({data:{actorId:req.auth!.userId,action:'RIDER_NIN_DOCUMENT_VIEWED',targetType:'RiderProfile',targetId:riderId,metadata:{},isDemo:rider.user.isDemo}});
    const cloudName=process.env.CLOUDINARY_CLOUD_NAME?.trim();const apiSecret=process.env.CLOUDINARY_API_SECRET?.trim();if(!cloudName||!apiSecret)return res.status(503).json({error:{code:'DOCUMENT_STORAGE_UNAVAILABLE',message:'Private document storage is not configured.'}});
    const publicPath=`v${rider.ninDocumentVersion}/${rider.ninDocumentPublicId}`;const signature=createHash('sha1').update(`${publicPath}${apiSecret}`).digest('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_').slice(0,8);const encodedPath=publicPath.split('/').map(encodeURIComponent).join('/');
    const document=await fetch(`https://res.cloudinary.com/${encodeURIComponent(cloudName)}/raw/authenticated/s--${signature}--/${encodedPath}`);if(!document.ok)return res.status(502).json({error:{code:'NIN_DOCUMENT_UNAVAILABLE',message:'The private NIN document could not be retrieved.'}});
    const bytes=Buffer.from(await document.arrayBuffer());res.setHeader('Cache-Control','private, no-store');res.setHeader('Content-Type',document.headers.get('content-type')??'application/octet-stream');res.setHeader('Content-Disposition','inline; filename="rider-nin-document"');return res.status(200).send(bytes);
  }catch(error){return next(error);}
});
app.patch('/api/v1/admin/vendors/:vendorId/status',requireUser,requireAdminPermission('vendors.review'),async(req:AuthRequest,res,next)=>{
  const vendorId=routeParam(req,'vendorId');
  const input=z.object({status:z.enum([VendorStatus.APPROVED,VendorStatus.REJECTED,VendorStatus.SUSPENDED]),isOpen:z.boolean().optional(),reason:z.string().trim().min(5).max(500)}).safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'INVALID_STATUS',message:'Vendor review status and a reason of at least five characters are required.'}});
  try{
    const data=await prisma.$transaction(async tx=>{
      const previous=await tx.vendor.findUniqueOrThrow({where:{id:vendorId},select:{status:true,isOpen:true,isDemo:true}});
      const vendor=await tx.vendor.update({where:{id:vendorId},data:{status:input.data.status,isOpen:input.data.status===VendorStatus.APPROVED?input.data.isOpen??false:false},select:{id:true,name:true,status:true,isOpen:true}});
      await tx.auditLog.create({data:{actorId:req.auth!.userId,action:'VENDOR_STATUS_CHANGED',targetType:'Vendor',targetId:vendor.id,metadata:{previous:{status:previous.status,isOpen:previous.isOpen},next:{status:vendor.status,isOpen:vendor.isOpen},reason:input.data.reason},isDemo:previous.isDemo}});
      return vendor;
    });
    return res.json({data});
  }catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2025')return res.status(404).json({error:{code:'VENDOR_NOT_FOUND',message:'Vendor application not found.'}});return next(error);}
});
app.patch('/api/v1/admin/riders/:riderId/status',requireUser,requireAdminPermission('riders.review'),async(req:AuthRequest,res,next)=>{
  const riderId=routeParam(req,'riderId');
  const input=z.object({status:z.enum([VendorStatus.APPROVED,VendorStatus.REJECTED,VendorStatus.SUSPENDED]),reason:z.string().trim().min(5).max(500)}).safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'INVALID_STATUS',message:'Rider review status and a reason of at least five characters are required.'}});
  try{
    const data=await prisma.$transaction(async tx=>{
      const previous=await tx.riderProfile.findUniqueOrThrow({where:{id:riderId},select:{status:true,available:true,user:{select:{isDemo:true}}}});
      const rider=await tx.riderProfile.update({where:{id:riderId},data:{status:input.data.status,available:false},select:{id:true,status:true,vehicleType:true,serviceArea:true}});
      await tx.auditLog.create({data:{actorId:req.auth!.userId,action:'RIDER_STATUS_CHANGED',targetType:'RiderProfile',targetId:rider.id,metadata:{previous:{status:previous.status,available:previous.available},next:{status:rider.status,available:false},reason:input.data.reason},isDemo:previous.user.isDemo}});
      return rider;
    });
    return res.json({data});
  }catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2025')return res.status(404).json({error:{code:'RIDER_NOT_FOUND',message:'Rider application not found.'}});return next(error);}
});
app.get('/api/v1/admin/disputes',requireUser,requireAdminPermission('disputes.read'),async(req,res,next)=>{
  const input=z.object({q:z.string().trim().max(120).optional(),status:z.nativeEnum(SupportTicketStatus).optional(),category:z.nativeEnum(SupportTicketCategory).optional(),page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(100).default(25)}).safeParse(req.query);
  if(!input.success)return res.status(400).json({error:{code:'INVALID_QUERY',message:'Dispute filters or pagination are invalid.'}});
  const where:Prisma.SupportTicketWhereInput={
    isDemo:false,
    ...(input.data.status?{status:input.data.status}:{}),
    ...(input.data.category?{category:input.data.category}:{}),
    ...(input.data.q?{OR:[
      {id:{contains:input.data.q,mode:'insensitive'}},
      {subject:{contains:input.data.q,mode:'insensitive'}},
      {description:{contains:input.data.q,mode:'insensitive'}},
      {orderId:{contains:input.data.q,mode:'insensitive'}},
      {customer:{is:{name:{contains:input.data.q,mode:'insensitive'}}}},
    ]}:{})
  };
  try{
    const [data,total]=await Promise.all([
      prisma.supportTicket.findMany({
        where,orderBy:{updatedAt:'desc'},skip:(input.data.page-1)*input.data.limit,take:input.data.limit,
        select:{
          id:true,subject:true,description:true,category:true,status:true,resolution:true,orderId:true,customerId:true,createdAt:true,updatedAt:true,resolvedAt:true,
          customer:{select:{id:true,name:true,email:true,phone:true}},
          order:{select:{id:true,status:true,totalMinor:true,createdAt:true}},
          createdBy:{select:{id:true,name:true,email:true}},
          assignedAdmin:{select:{id:true,name:true,email:true}},
        }
      }),
      prisma.supportTicket.count({where})
    ]);
    return res.json({data,total,page:input.data.page,pageSize:input.data.limit});
  }catch(error){return next(error);}
});
app.post('/api/v1/admin/disputes',requireUser,requireAdminPermission('disputes.manage'),async(req:AuthRequest,res,next)=>{
  const input=z.object({
    subject:z.string().trim().min(4).max(160),description:z.string().trim().min(10).max(5000),
    category:z.nativeEnum(SupportTicketCategory),customerId:z.string().trim().min(1).max(100).optional(),
    orderId:z.string().trim().min(1).max(100).optional(),reason:z.string().trim().min(5).max(500),
  }).safeParse(req.body);
  if(!input.success)return res.status(400).json({error:{code:'INVALID_DISPUTE',message:'Enter a valid dispute and link a customer or order.'}});
  const {customerId,orderId}=input.data;
  try{
    const linkedOrder=orderId?await prisma.order.findFirst({where:{id:orderId,isDemo:false},select:{id:true,customerId:true}}):null;
    if(orderId&&!linkedOrder)return res.status(404).json({error:{code:'ORDER_NOT_FOUND',message:'A non-demo order with that ID was not found.'}});
    if(customerId&&linkedOrder&&linkedOrder.customerId!==customerId)return res.status(400).json({error:{code:'CUSTOMER_ORDER_MISMATCH',message:'The selected customer does not own this order.'}});
    const resolvedCustomerId=customerId??linkedOrder?.customerId;
    if(resolvedCustomerId){
      const customer=await prisma.user.findFirst({where:{id:resolvedCustomerId,isDemo:false,roles:{has:Role.CUSTOMER}},select:{id:true}});
      if(!customer)return res.status(404).json({error:{code:'CUSTOMER_NOT_FOUND',message:'A non-demo customer with that ID was not found.'}});
    }
    const data=await prisma.$transaction(async tx=>{
      const ticket=await tx.supportTicket.create({
        data:{
          subject:input.data.subject,description:input.data.description,category:input.data.category,
          ...(resolvedCustomerId?{customerId:resolvedCustomerId}:{}),...(orderId?{orderId}:{}),
          createdById:req.auth!.userId,assignedAdminId:req.auth!.userId,isDemo:false,
        },
        select:{
          id:true,subject:true,description:true,category:true,status:true,resolution:true,orderId:true,customerId:true,createdAt:true,updatedAt:true,resolvedAt:true,
          customer:{select:{id:true,name:true,email:true,phone:true}},order:{select:{id:true,status:true,totalMinor:true,createdAt:true}},
          createdBy:{select:{id:true,name:true,email:true}},assignedAdmin:{select:{id:true,name:true,email:true}},
        },
      });
      await tx.auditLog.create({data:{actorId:req.auth!.userId,action:'SUPPORT_TICKET_CREATED',targetType:'SupportTicket',targetId:ticket.id,metadata:{category:ticket.category,orderId:ticket.orderId,customerId:ticket.customerId,reason:input.data.reason},isDemo:false}});
      return ticket;
    });
    return res.status(201).json({data});
  }catch(error){return next(error);}
});
app.patch('/api/v1/admin/disputes/:ticketId',requireUser,requireAdminPermission('disputes.manage'),async(req:AuthRequest,res,next)=>{
  const ticketId=routeParam(req,'ticketId');
  const input=z.object({
    status:z.nativeEnum(SupportTicketStatus).optional(),resolution:z.string().trim().max(5000).nullable().optional(),
    assignedAdminId:z.string().trim().min(1).max(100).nullable().optional(),reason:z.string().trim().min(5).max(500),
  }).refine(value=>value.status!==undefined||value.resolution!==undefined||value.assignedAdminId!==undefined,'At least one ticket field must change.')
    .refine(value=>!['RESOLVED','CLOSED'].includes(value.status??'')||Boolean(value.resolution?.trim()),'A resolution is required to resolve or close a dispute.')
    .safeParse(req.body);
  if(!input.success)return res.status(400).json({error:{code:'INVALID_DISPUTE_UPDATE',message:'Choose a valid update; resolved or closed disputes require resolution details.'}});
  try{
    if(input.data.assignedAdminId){
      const adminRoles=[Role.ADMIN,Role.SUPER_ADMIN,Role.OPERATIONS_MANAGER,Role.FINANCE_ADMIN,Role.CUSTOMER_SUPPORT,Role.VENDOR_MANAGER,Role.RIDER_MANAGER,Role.MARKETING_MANAGER,Role.ANALYST,Role.READ_ONLY_ADMIN];
      const admin=await prisma.user.findFirst({where:{id:input.data.assignedAdminId,roles:{hasSome:adminRoles}},select:{id:true}});
      if(!admin)return res.status(404).json({error:{code:'ADMIN_NOT_FOUND',message:'The assigned account is not an administrator.'}});
    }
    const result=await prisma.$transaction(async tx=>{
      const previous=await tx.supportTicket.findFirst({where:{id:ticketId,isDemo:false},select:{id:true,status:true,resolution:true,assignedAdminId:true,resolvedAt:true}});
      if(!previous)return null;
      const status=input.data.status??previous.status;
      const resolution=input.data.resolution===undefined?previous.resolution:input.data.resolution;
      if((status===SupportTicketStatus.RESOLVED||status===SupportTicketStatus.CLOSED)&&!resolution?.trim())throw new Error('DISPUTE_RESOLUTION_REQUIRED');
      const assignedAdminId=input.data.assignedAdminId===undefined?previous.assignedAdminId:input.data.assignedAdminId;
      const ticket=await tx.supportTicket.update({
        where:{id:ticketId},
        data:{status,resolution,assignedAdminId,resolvedAt:status===SupportTicketStatus.RESOLVED||status===SupportTicketStatus.CLOSED?previous.resolvedAt??new Date():null},
        select:{
          id:true,subject:true,description:true,category:true,status:true,resolution:true,orderId:true,customerId:true,createdAt:true,updatedAt:true,resolvedAt:true,
          customer:{select:{id:true,name:true,email:true,phone:true}},order:{select:{id:true,status:true,totalMinor:true,createdAt:true}},
          createdBy:{select:{id:true,name:true,email:true}},assignedAdmin:{select:{id:true,name:true,email:true}},
        },
      });
      await tx.auditLog.create({data:{
        actorId:req.auth!.userId,action:'SUPPORT_TICKET_UPDATED',targetType:'SupportTicket',targetId:ticket.id,
        metadata:{previous:{status:previous.status,resolution:previous.resolution,assignedAdminId:previous.assignedAdminId},next:{status:ticket.status,resolution:ticket.resolution,assignedAdminId:ticket.assignedAdmin?.id??null},reason:input.data.reason},
        isDemo:false,
      }});
      return ticket;
    });
    if(!result)return res.status(404).json({error:{code:'DISPUTE_NOT_FOUND',message:'Dispute not found.'}});
    return res.json({data:result});
  }catch(error){
    if(error instanceof Error&&error.message==='DISPUTE_RESOLUTION_REQUIRED')return res.status(400).json({error:{code:'DISPUTE_RESOLUTION_REQUIRED',message:'Add resolution details before resolving or closing a dispute.'}});
    return next(error);
  }
});
app.get('/api/v1/admin/audit-logs',requireUser,requireAdminPermission('audit.read'),async(req,res,next)=>{
  const input=z.object({cursor:z.string().optional(),limit:z.coerce.number().int().min(1).max(100).default(50)}).safeParse(req.query);if(!input.success)return res.status(400).json({error:{code:'INVALID_QUERY',message:'Audit-log pagination is invalid.'}});
  try{const data=await prisma.auditLog.findMany({where:{isDemo:false},orderBy:{createdAt:'desc'},take:input.data.limit,...(input.data.cursor?{skip:1,cursor:{id:input.data.cursor}}:{}),select:{id:true,actorId:true,action:true,targetType:true,targetId:true,metadata:true,createdAt:true}});return res.json({data,nextCursor:data.length===input.data.limit?data.at(-1)?.id:null});}catch(error){return next(error);}
});
app.get('/api/v1/admin/sessions',requireUser,requireAdminPermission('sessions.manage'),async(_req,res,next)=>{
  const adminRoles=[Role.ADMIN,Role.SUPER_ADMIN,Role.OPERATIONS_MANAGER,Role.FINANCE_ADMIN,Role.CUSTOMER_SUPPORT,Role.VENDOR_MANAGER,Role.RIDER_MANAGER,Role.MARKETING_MANAGER,Role.ANALYST,Role.READ_ONLY_ADMIN];
  try{
    const data=await prisma.session.findMany({where:{user:{roles:{hasSome:adminRoles}}},orderBy:{createdAt:'desc'},take:100,select:{id:true,createdAt:true,expiresAt:true,revokedAt:true,user:{select:{id:true,name:true,email:true,roles:true,isDemo:true}}}});
    return res.json({data});
  }catch(error){return next(error);}
});
app.delete('/api/v1/admin/sessions/:sessionId',requireUser,requireAdminPermission('sessions.manage'),async(req:AuthRequest,res,next)=>{
  const sessionId=routeParam(req,'sessionId');
  const input=z.object({reason:z.string().trim().min(5).max(500)}).safeParse(req.body);
  if(!input.success)return res.status(400).json({error:{code:'REASON_REQUIRED',message:'A reason of at least five characters is required to revoke a session.'}});
  try{
    const data=await prisma.$transaction(async tx=>{
      const session=await tx.session.findUnique({where:{id:sessionId},select:{id:true,userId:true,revokedAt:true,user:{select:{isDemo:true}}}});
      if(!session)return null;
      if(!session.revokedAt)await tx.session.update({where:{id:session.id},data:{revokedAt:new Date()}});
      await tx.auditLog.create({data:{actorId:req.auth!.userId,action:'ADMIN_SESSION_REVOKED',targetType:'Session',targetId:session.id,metadata:{userId:session.userId,reason:input.data.reason},isDemo:session.user.isDemo}});
      return {id:session.id,revoked:true};
    });
    if(!data)return res.status(404).json({error:{code:'SESSION_NOT_FOUND',message:'Session not found.'}});
    return res.json({data});
  }catch(error){return next(error);}
});
app.get('/api/v1/admin/admins',requireUser,requireAdminPermission('admins.manage'),async(_req,res,next)=>{
  try{
    const data=await prisma.user.findMany({where:{roles:{hasSome:[Role.ADMIN,Role.SUPER_ADMIN,Role.OPERATIONS_MANAGER,Role.FINANCE_ADMIN,Role.CUSTOMER_SUPPORT,Role.VENDOR_MANAGER,Role.RIDER_MANAGER,Role.MARKETING_MANAGER,Role.ANALYST,Role.READ_ONLY_ADMIN]}},orderBy:{createdAt:'desc'},select:{id:true,name:true,email:true,roles:true,createdAt:true}});
    return res.json({data});
  }catch(error){return next(error);}
});
app.post('/api/v1/admin/admins',requireUser,requireSuperAdmin,async(req:AuthRequest,res,next)=>{
  const input=z.object({name:z.string().trim().min(2).max(100),email:emailSchema,password:passSchema,role:z.nativeEnum(Role).refine(isAdminRole,'Choose an administrative role.'),reason:z.string().trim().min(5).max(500)}).safeParse(req.body);
  if(!input.success)return res.status(400).json({error:{code:'INVALID_ADMIN',message:'Administrator name, email, password, and role are required.'}});
  try{
    if(await prisma.user.findUnique({where:{email:input.data.email},select:{id:true}}))return res.status(409).json({error:{code:'EMAIL_IN_USE',message:'An account already uses this email.'}});
    const passwordHash=await makePasswordHash(input.data.password);
    const data=await prisma.$transaction(async tx=>{
      const admin=await tx.user.create({data:{name:input.data.name,email:input.data.email,passwordHash,roles:[input.data.role]},select:{id:true,name:true,email:true,roles:true,createdAt:true}});
      await tx.auditLog.create({data:{actorId:req.auth!.userId,action:'ADMIN_ACCOUNT_CREATED',targetType:'User',targetId:admin.id,metadata:{roles:admin.roles,reason:input.data.reason},isDemo:false}});
      return admin;
    });
    return res.status(201).json({data});
  }catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')return res.status(409).json({error:{code:'EMAIL_IN_USE',message:'An account already uses this email.'}});return next(error);}
});
app.patch('/api/v1/admin/admins/:adminId/roles',requireUser,requireSuperAdmin,async(req:AuthRequest,res,next)=>{
  const adminId=routeParam(req,'adminId');
  const input=z.object({roles:z.array(z.nativeEnum(Role)).min(1).max(3).refine(roles=>roles.every(isAdminRole),'Administrator roles only.'),reason:z.string().trim().min(5).max(500)}).safeParse(req.body);
  if(!input.success)return res.status(400).json({error:{code:'INVALID_ROLES',message:'Choose one to three administrative roles.'}});
  try{
    const result=await prisma.$transaction(async tx=>{
      const current=await tx.user.findUnique({where:{id:adminId},select:{id:true,roles:true,isDemo:true}});
      if(!current||!current.roles.some(isAdminRole))return null;
      if(current.id===req.auth!.userId&&!input.data.roles.some(role=>role===Role.ADMIN||role===Role.SUPER_ADMIN))throw new Error('CANNOT_REMOVE_OWN_SUPER_ADMIN');
      if(current.roles.includes(Role.SUPER_ADMIN)&&!input.data.roles.includes(Role.SUPER_ADMIN)){
        const remaining=await tx.user.count({where:{id:{not:current.id},roles:{has:Role.SUPER_ADMIN}}});
        if(!remaining)throw new Error('LAST_SUPER_ADMIN');
      }
      const admin=await tx.user.update({where:{id:current.id},data:{roles:input.data.roles},select:{id:true,name:true,email:true,roles:true,createdAt:true}});
      await tx.auditLog.create({data:{actorId:req.auth!.userId,action:'ADMIN_ROLES_CHANGED',targetType:'User',targetId:admin.id,metadata:{previous:current.roles,next:admin.roles,reason:input.data.reason},isDemo:current.isDemo}});
      return admin;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    if(!result)return res.status(404).json({error:{code:'ADMIN_NOT_FOUND',message:'Administrator not found.'}});
    return res.json({data:result});
  }catch(error){if(error instanceof Error&&error.message==='CANNOT_REMOVE_OWN_SUPER_ADMIN')return res.status(409).json({error:{code:'CANNOT_REMOVE_OWN_SUPER_ADMIN',message:'You cannot remove your own super-administrator access.'}});if(error instanceof Error&&error.message==='LAST_SUPER_ADMIN')return res.status(409).json({error:{code:'LAST_SUPER_ADMIN',message:'At least one super administrator must remain.'}});return next(error);}
});

app.use((_req,res) => res.status(404).json({error:{code:'NOT_FOUND',message:'This endpoint does not exist.'}}));
app.use((error:unknown,req:Request,res:express.Response,_next:express.NextFunction) => {
  const requestId = randomBytes(8).toString('hex');
  const prismaCode=error instanceof Prisma.PrismaClientKnownRequestError?error.code:undefined;
  console.error(JSON.stringify({requestId,method:req.method,path:req.path,errorType:error instanceof Error?error.name:'UnknownError',...(prismaCode?{prismaCode}:{})}));
  if(prismaCode==='P2021'||prismaCode==='P2022')return res.status(503).json({error:{code:'DATABASE_SCHEMA_OUTDATED',message:'The database is missing required Smile migrations. Apply pending Prisma migrations, then restart the API.',requestId}});
  return res.status(500).json({error:{code:'INTERNAL_ERROR',message:'Something went wrong. Try again.',requestId}});
});

void pruneExpiredGoogleCoordinates().catch(error=>console.error(JSON.stringify({event:'google_coordinate_prune_failed',error:error instanceof Error?error.name:'unknown'})));
setInterval(()=>{
  void pruneExpiredGoogleCoordinates().catch(error=>console.error(JSON.stringify({event:'google_coordinate_prune_failed',error:error instanceof Error?error.name:'unknown'})));
},5*60_000).unref();
app.listen(port,'0.0.0.0',()=>console.log(`Smile API listening on port ${port} on all network interfaces`));
