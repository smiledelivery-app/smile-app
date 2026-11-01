import dotenv from 'dotenv';
dotenv.config({path:process.env.ENV_FILE ?? '../../.env'});
import cors from 'cors';
import express, { type Request } from 'express';
import helmet from 'helmet';
import { PrismaClient, Role, VendorStatus, OrderStatus, DeliveryStatus, RiderOfferStatus, Prisma } from '@prisma/client';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { calculateOrderAmounts, canVendorTransition } from './order-rules.js';
import { catalogSource } from './catalog-rules.js';
import { distanceKm, nearestEligibleRiders, rankRidersByRoadDistance } from './dispatch-rules.js';
import { computeDrivingDistances, computeDrivingRoute, geocodeAddress, GoogleMapsError } from './google-maps.js';
import { createProofCode } from './proof-codes.js';
import { createVendorImageUploadSignature, MediaProviderError } from './media.js';
import { PaystackError, assignTitanDva, createPaystackCustomer, initializePaystackTransaction, verifyPaystackSignature, verifyPaystackTransaction } from './paystack.js';
import { checkPhoneVerification, PhoneVerificationError, sendPhoneVerification, type PhoneVerificationChannel } from './phone-verification.js';

const app = express();
const prisma = new PrismaClient();
const port = Number(process.env.API_PORT ?? 4100);
const demoMode = process.env.DEMO_MODE === 'true' && process.env.NODE_ENV !== 'production';
const phoneVerificationBypass = process.env.PHONE_VERIFICATION_BYPASS === 'true' && process.env.NODE_ENV !== 'production';
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000', credentials: true }));
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
const deliveryProofSecret = () => process.env.DELIVERY_OTP_SECRET??(process.env.NODE_ENV==='production'?undefined:process.env.JWT_ACCESS_SECRET);
const googleRoutesKey = () => process.env.GOOGLE_MAPS_ROUTES_API_KEY ?? process.env.MAPS_API_KEY ?? '';
const googleGeocodingKey = () => process.env.GOOGLE_MAPS_GEOCODING_API_KEY ?? process.env.GOOGLE_MAPS_ROUTES_API_KEY ?? process.env.MAPS_API_KEY ?? '';
const paystackSecret = () => process.env.PAYSTACK_SECRET_KEY ?? '';
const coordinatePair = z.object({latitude:z.number().min(-90).max(90).optional(),longitude:z.number().min(-180).max(180).optional()}).refine(value=>(value.latitude===undefined)===(value.longitude===undefined),'Provide both latitude and longitude.');
const GOOGLE_COORDINATE_TTL_MS=30*24*60*60_000;
async function freshVendorCoordinates(vendor:{id:string;address:string;latitude:Prisma.Decimal|null;longitude:Prisma.Decimal|null;geocodedAt:Date|null}) {
  if(vendor.latitude!==null&&vendor.longitude!==null&&(!vendor.geocodedAt||Date.now()-vendor.geocodedAt.getTime()<GOOGLE_COORDINATE_TTL_MS))return {latitude:Number(vendor.latitude),longitude:Number(vendor.longitude)};
  if(vendor.geocodedAt)await prisma.vendor.update({where:{id:vendor.id},data:{latitude:null,longitude:null,geocodedAt:null}});
  const key=googleGeocodingKey();if(!key)return null;
  try{const point=await geocodeAddress(`${vendor.address}, Nigeria`,key);await prisma.vendor.update({where:{id:vendor.id},data:{latitude:point.latitude,longitude:point.longitude,geocodedAt:new Date()}});return point;}
  catch(error){console.warn(JSON.stringify({event:'vendor_geocoding_failed',error:error instanceof GoogleMapsError?error.message:'unknown'}));return null;}
}
async function freshAddressCoordinates(address:{id:string;line1:string;city:string;latitude:Prisma.Decimal|null;longitude:Prisma.Decimal|null;geocodedAt:Date|null}) {
  if(address.latitude!==null&&address.longitude!==null&&(!address.geocodedAt||Date.now()-address.geocodedAt.getTime()<GOOGLE_COORDINATE_TTL_MS))return {latitude:Number(address.latitude),longitude:Number(address.longitude)};
  if(address.geocodedAt)await prisma.address.update({where:{id:address.id},data:{latitude:null,longitude:null,geocodedAt:null}});
  const key=googleGeocodingKey();if(!key)return null;
  try{const point=await geocodeAddress(`${address.line1}, ${address.city}, Nigeria`,key);await prisma.address.update({where:{id:address.id},data:{latitude:point.latitude,longitude:point.longitude,geocodedAt:new Date()}});return point;}
  catch(error){console.warn(JSON.stringify({event:'address_geocoding_failed',error:error instanceof GoogleMapsError?error.message:'unknown'}));return null;}
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
  const riders=await prisma.riderProfile.findMany({where:{status:VendorStatus.APPROVED,available:true,location:{is:{updatedAt:{gte:freshSince}}},offers:{none:{status:RiderOfferStatus.PENDING,expiresAt:{gt:new Date()}}},deliveries:{none:{status:{in:[DeliveryStatus.ASSIGNED,DeliveryStatus.PICKED_UP]}}}},include:{location:true}});
  const area=vendor.address.trim().toLowerCase();
  const maxDistance=Number(process.env.RIDER_MAX_PICKUP_KM??12);
  const configuredLimit=Number.parseInt(process.env.GOOGLE_ROUTES_MAX_ORIGINS??'25',10);
  const shortlistLimit=Number.isFinite(configuredLimit)?Math.max(1,Math.min(49,configuredLimit)):25;
  const located=riders.flatMap(rider=>rider.location?[{id:rider.id,latitude:Number(rider.location.latitude),longitude:Number(rider.location.longitude),serviceArea:rider.serviceArea,rider}]:[]);
  const shortlist=nearestEligibleRiders(located,pickup,area,previouslyOffered,maxDistance,shortlistLimit);
  const apiKey=googleRoutesKey();
  let nearby:Array<{rider:(typeof shortlist)[number]['rider'];km:number;meters:number}> = [];
  if(shortlist.length&&apiKey){
    try{
      const roadDistances=await computeDrivingDistances(shortlist.map(candidate=>({id:candidate.id,coordinate:{latitude:candidate.latitude,longitude:candidate.longitude}})),pickup,apiKey);
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
async function ensureWallet(userId:string) {
  return prisma.wallet.upsert({where:{userId},update:{},create:{userId,dvaStatus:'PENDING'}});
}
async function provisionDva(userId:string) {
  const user=await prisma.user.findUnique({where:{id:userId},select:{id:true,name:true,email:true,phone:true}});
  if(!user?.email||!user.phone||!paystackSecret()) return;
  const wallet=await ensureWallet(user.id); if(wallet.dvaStatus==='ACTIVE') return;
  const names=nameParts(user.name);
  try {
    const customerCode=wallet.paystackCustomerCode??await createPaystackCustomer({...names,email:user.email,phone:user.phone},paystackSecret());
    const dva=await assignTitanDva({customerCode,...names,phone:user.phone},paystackSecret());
    await prisma.wallet.update({where:{userId:user.id},data:{paystackCustomerCode:customerCode,dvaId:dva.id,dvaAccountNumber:dva.accountNumber,dvaAccountName:dva.accountName,dvaBankName:dva.bankName,dvaBankSlug:dva.bankSlug,dvaStatus:dva.accountNumber?'ACTIVE':'PENDING'}});
  } catch(error) {
    await prisma.wallet.update({where:{userId:user.id},data:{dvaStatus:'FAILED'}});
    console.error(JSON.stringify({event:'dva_provision_failed',userId,errorType:error instanceof Error?error.name:'unknown'}));
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
    const key=googleGeocodingKey();
    if(!point&&key){try{point=await geocodeAddress(`${input.data.line1}, ${input.data.city}, Nigeria`,key);geocodedAt=new Date();}catch(error){console.warn(JSON.stringify({event:'address_geocoding_failed',error:error instanceof GoogleMapsError?error.message:'unknown'}));}}
    const data = await prisma.address.create({data:{label:input.data.label,line1:input.data.line1,city:input.data.city,userId:req.auth!.userId,latitude:point?.latitude,longitude:point?.longitude,geocodedAt}}); return res.status(201).json({data});
  }
  catch(error) { return next(error); }
});
app.patch('/api/v1/addresses/:addressId',requireUser,async(req:AuthRequest,res,next)=>{
  const input=addressInput.safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'INVALID_ADDRESS',message:'Enter a label, street address, and city.'}});
  try{
    let point=input.data.latitude!==undefined?{latitude:input.data.latitude,longitude:input.data.longitude!}:null;let geocodedAt:Date|null=null;
    if(!point&&googleGeocodingKey()){try{point=await geocodeAddress(`${input.data.line1}, ${input.data.city}, Nigeria`,googleGeocodingKey());geocodedAt=new Date();}catch(error){console.warn(JSON.stringify({event:'address_geocoding_failed',error:error instanceof GoogleMapsError?error.message:'unknown'}));}}
    const updated=await prisma.address.updateMany({where:{id:req.params.addressId,userId:req.auth!.userId},data:{...input.data,latitude:point?.latitude,longitude:point?.longitude,geocodedAt}});
    if(!updated.count)return res.status(404).json({error:{code:'ADDRESS_NOT_FOUND',message:'Saved place not found.'}});
    return res.json({data:await prisma.address.findUnique({where:{id:req.params.addressId}})});
  }catch(error){return next(error);}
});
app.delete('/api/v1/addresses/:addressId',requireUser,async(req:AuthRequest,res,next)=>{
  try{
    const address=await prisma.address.findFirst({where:{id:req.params.addressId,userId:req.auth!.userId},select:{id:true}});if(!address)return res.status(404).json({error:{code:'ADDRESS_NOT_FOUND',message:'Saved place not found.'}});
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

const onboardingInput = z.object({name:z.string().trim().min(2).max(120),ownerName:z.string().trim().min(2).max(100).optional(),contactPhone:z.string().trim().min(7).max(24).optional(),description:z.string().trim().max(1000).default(''),address:z.string().trim().min(5).max(250),logoUrl:z.string().url().max(2048).nullable().optional(),coverImageUrl:z.string().url().max(2048).nullable().optional(),cacNumber:z.string().trim().max(50).nullable().optional(),cacDocumentUrl:z.string().url().max(2048).nullable().optional(),termsAccepted:z.literal(true)}).and(coordinatePair);
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
    const key=googleGeocodingKey();
    if(!point&&key){try{point=await geocodeAddress(`${input.data.address}, Nigeria`,key);geocodedAt=new Date();}catch(error){console.warn(JSON.stringify({event:'vendor_geocoding_failed',error:error instanceof GoogleMapsError?error.message:'unknown'}));}}
    const vendor=await prisma.$transaction(async tx=>{
      const user=await tx.user.findUniqueOrThrow({where:{id:req.auth!.userId}});
      await tx.user.update({where:{id:user.id},data:{name:input.data.ownerName??user.name,...(input.data.contactPhone?{phone:input.data.contactPhone}:{}),roles:user.roles.includes(Role.VENDOR)?user.roles:[...user.roles,Role.VENDOR]}});
      return tx.vendor.create({data:{ownerId:user.id,name:input.data.name,description:input.data.description,address:input.data.address,contactPhone:input.data.contactPhone,logoUrl:input.data.logoUrl,coverImageUrl:input.data.coverImageUrl,cacNumber:input.data.cacNumber,cacDocumentUrl:input.data.cacDocumentUrl,latitude:point?.latitude,longitude:point?.longitude,geocodedAt,slug,status:VendorStatus.PENDING_REVIEW,isOpen:false,isDemo:user.isDemo,termsAcceptedAt:new Date()}});
    });
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
const vendorProfileInput=z.object({name:z.string().trim().min(2).max(120),ownerName:z.string().trim().min(2).max(100),contactPhone:z.string().trim().min(7).max(24),description:z.string().trim().max(1000),address:z.string().trim().min(5).max(250),logoUrl:z.string().url().max(2048).nullable(),coverImageUrl:z.string().url().max(2048).nullable(),cacNumber:z.string().trim().max(50).nullable(),cacDocumentUrl:z.string().url().max(2048).nullable()}).and(coordinatePair);
app.put('/api/v1/vendor/profile',requireUser,requireRole(Role.VENDOR),async(req:AuthRequest,res,next)=>{
  const input=vendorProfileInput.safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'INVALID_VENDOR_PROFILE',message:'Check the owner, store, address, and document details.'}});
  try{
    const vendor=await prisma.vendor.findUnique({where:{ownerId:req.auth!.userId},select:{id:true,status:true}});if(!vendor)return res.status(404).json({error:{code:'VENDOR_PROFILE_NOT_FOUND',message:'Submit your store application first.'}});
    let point=input.data.latitude!==undefined?{latitude:input.data.latitude,longitude:input.data.longitude!}:null;let geocodedAt:Date|null=null;
    if(!point&&googleGeocodingKey()){try{point=await geocodeAddress(`${input.data.address}, Nigeria`,googleGeocodingKey());geocodedAt=new Date();}catch(error){console.warn(JSON.stringify({event:'vendor_geocoding_failed',error:error instanceof GoogleMapsError?error.message:'unknown'}));}}
    const [updated]=await prisma.$transaction([prisma.vendor.update({where:{id:vendor.id},data:{name:input.data.name,description:input.data.description,address:input.data.address,contactPhone:input.data.contactPhone,logoUrl:input.data.logoUrl,coverImageUrl:input.data.coverImageUrl,cacNumber:input.data.cacNumber,cacDocumentUrl:input.data.cacDocumentUrl,latitude:point?.latitude,longitude:point?.longitude,geocodedAt,status:vendor.status===VendorStatus.DRAFT?VendorStatus.PENDING_REVIEW:vendor.status,termsAcceptedAt:new Date()}}),prisma.user.update({where:{id:req.auth!.userId},data:{name:input.data.ownerName,phone:input.data.contactPhone}})]);
    return res.json({data:{...updated,ownerName:input.data.ownerName}});
  }catch(error){return next(error);}
});

app.get('/api/v1/vendor/products',requireUser,requireRole(Role.VENDOR),async (req:AuthRequest,res,next)=>{
  try { const vendor=await prisma.vendor.findFirst({where:{ownerId:req.auth!.userId,status:VendorStatus.APPROVED}});if(!vendor)return res.status(403).json({error:{code:'VENDOR_NOT_APPROVED',message:'Products can be managed after the vendor application is approved.'}});const data=await prisma.product.findMany({where:{vendorId:vendor.id},orderBy:{createdAt:'desc'},take:100,include:{addons:{orderBy:{createdAt:'asc'}}}});return res.json({data}); }
  catch(error){return next(error);}
});
const productInput=z.object({name:z.string().trim().min(2).max(120),description:z.string().trim().max(1500).default(''),category:z.string().trim().min(2).max(60),priceMinor:z.number().int().positive().max(2_000_000_000),imageUrl:z.string().url().max(2048).nullable().optional(),stock:z.number().int().nonnegative().max(100000).nullable().optional()});
app.post('/api/v1/vendor/products',requireUser,requireRole(Role.VENDOR),async (req:AuthRequest,res,next)=>{
  const input=productInput.safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'INVALID_PRODUCT',message:'Check the product name, category, price, and stock.'}});
  try {const vendor=await prisma.vendor.findFirst({where:{ownerId:req.auth!.userId,status:VendorStatus.APPROVED}});if(!vendor)return res.status(403).json({error:{code:'VENDOR_NOT_APPROVED',message:'Products can be published after the vendor application is approved.'}});const data=await prisma.product.create({data:{...input.data,vendorId:vendor.id,isDemo:vendor.isDemo}});return res.status(201).json({data});}
  catch(error){return next(error);}
});
app.patch('/api/v1/vendor/products/:productId',requireUser,requireRole(Role.VENDOR),async (req:AuthRequest,res,next)=>{
  const input=productInput.partial().extend({available:z.boolean().optional()}).safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'INVALID_PRODUCT',message:'Product changes are invalid.'}});
  try {const vendor=await prisma.vendor.findFirst({where:{ownerId:req.auth!.userId,status:VendorStatus.APPROVED},select:{id:true}});if(!vendor)return res.status(403).json({error:{code:'VENDOR_NOT_APPROVED',message:'An approved vendor account is required.'}});const changed=await prisma.product.updateMany({where:{id:req.params.productId,vendorId:vendor.id},data:input.data});if(!changed.count)return res.status(404).json({error:{code:'PRODUCT_NOT_FOUND',message:'Product not found for this kitchen.'}});const data=await prisma.product.findUnique({where:{id:req.params.productId}});return res.json({data});}
  catch(error){return next(error);}
});
app.delete('/api/v1/vendor/products/:productId',requireUser,requireRole(Role.VENDOR),async (req:AuthRequest,res,next)=>{
  try {const vendor=await prisma.vendor.findFirst({where:{ownerId:req.auth!.userId,status:VendorStatus.APPROVED},select:{id:true}});if(!vendor)return res.status(403).json({error:{code:'VENDOR_NOT_APPROVED',message:'An approved vendor account is required.'}});const changed=await prisma.product.updateMany({where:{id:req.params.productId,vendorId:vendor.id},data:{available:false}});if(!changed.count)return res.status(404).json({error:{code:'PRODUCT_NOT_FOUND',message:'Product not found for this kitchen.'}});return res.status(204).end();}
  catch(error){return next(error);}
});
const addonInput=z.object({name:z.string().trim().min(2).max(80),priceMinor:z.number().int().positive().max(2_000_000_000)});
app.post('/api/v1/vendor/products/:productId/addons',requireUser,requireRole(Role.VENDOR),async(req:AuthRequest,res,next)=>{
  const input=addonInput.safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'INVALID_ADDON',message:'Enter an add-on name and a positive price.'}});
  try{const vendor=await prisma.vendor.findFirst({where:{ownerId:req.auth!.userId,status:VendorStatus.APPROVED},select:{id:true}});if(!vendor)return res.status(403).json({error:{code:'VENDOR_NOT_APPROVED',message:'An approved vendor account is required.'}});const product=await prisma.product.findFirst({where:{id:req.params.productId,vendorId:vendor.id},select:{id:true}});if(!product)return res.status(404).json({error:{code:'PRODUCT_NOT_FOUND',message:'Product not found for this store.'}});const count=await prisma.productAddon.count({where:{productId:product.id,available:true}});if(count>=20)return res.status(409).json({error:{code:'ADDON_LIMIT',message:'A product can have up to 20 active extras.'}});const data=await prisma.productAddon.create({data:{...input.data,productId:product.id}});return res.status(201).json({data});}catch(error){return next(error);}
});
app.patch('/api/v1/vendor/products/:productId/addons/:addonId',requireUser,requireRole(Role.VENDOR),async(req:AuthRequest,res,next)=>{
  const input=addonInput.partial().extend({available:z.boolean().optional()}).safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'INVALID_ADDON',message:'Check the add-on name, price, and availability.'}});
  try{const vendor=await prisma.vendor.findFirst({where:{ownerId:req.auth!.userId,status:VendorStatus.APPROVED},select:{id:true}});if(!vendor)return res.status(403).json({error:{code:'VENDOR_NOT_APPROVED',message:'An approved vendor account is required.'}});const changed=await prisma.productAddon.updateMany({where:{id:req.params.addonId,productId:req.params.productId,product:{is:{vendorId:vendor.id}}},data:input.data});if(!changed.count)return res.status(404).json({error:{code:'ADDON_NOT_FOUND',message:'Extra not found for this product.'}});return res.json({data:await prisma.productAddon.findUnique({where:{id:req.params.addonId}})});}catch(error){return next(error);}
});
app.delete('/api/v1/vendor/products/:productId/addons/:addonId',requireUser,requireRole(Role.VENDOR),async(req:AuthRequest,res,next)=>{
  try{const vendor=await prisma.vendor.findFirst({where:{ownerId:req.auth!.userId,status:VendorStatus.APPROVED},select:{id:true}});if(!vendor)return res.status(403).json({error:{code:'VENDOR_NOT_APPROVED',message:'An approved vendor account is required.'}});const changed=await prisma.productAddon.updateMany({where:{id:req.params.addonId,productId:req.params.productId,product:{is:{vendorId:vendor.id}}},data:{available:false}});if(!changed.count)return res.status(404).json({error:{code:'ADDON_NOT_FOUND',message:'Extra not found for this product.'}});return res.status(204).end();}catch(error){return next(error);}
});

const riderApplicationInput=z.object({vehicleType:z.string().trim().min(3).max(40),serviceArea:z.string().trim().min(2).max(100),termsAccepted:z.literal(true)});
app.post('/api/v1/rider/onboarding',requireUser,async (req:AuthRequest,res,next)=>{
  const input=riderApplicationInput.safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'INVALID_APPLICATION',message:'Choose a vehicle, service area, and accept the rider terms.'}});
  try {
    const existing=await prisma.riderProfile.findUnique({where:{userId:req.auth!.userId}});
    if(existing)return res.status(409).json({error:{code:'APPLICATION_EXISTS',message:'A rider application already exists for this account.',status:existing.status}});
    const profile=await prisma.$transaction(async tx=>{const user=await tx.user.findUniqueOrThrow({where:{id:req.auth!.userId}});if(!user.roles.includes(Role.RIDER))await tx.user.update({where:{id:user.id},data:{roles:[...user.roles,Role.RIDER]}});return tx.riderProfile.create({data:{userId:user.id,vehicleType:input.data.vehicleType,serviceArea:input.data.serviceArea,status:VendorStatus.PENDING_REVIEW,available:false}});});
    return res.status(201).json({data:{id:profile.id,status:profile.status,available:profile.available}});
  }catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2002')return res.status(409).json({error:{code:'APPLICATION_EXISTS',message:'A rider application already exists.'}});return next(error);}
});
app.get('/api/v1/rider/profile',requireUser,requireRole(Role.RIDER),async(req:AuthRequest,res,next)=>{
  try{const profile=await prisma.riderProfile.findUnique({where:{userId:req.auth!.userId},select:{id:true,status:true,available:true,vehicleType:true,serviceArea:true,location:{select:{updatedAt:true}}}});if(!profile)return res.status(404).json({error:{code:'RIDER_PROFILE_NOT_FOUND',message:'No rider application is linked to this account.'}});return res.json({data:{...profile,suspended:profile.status===VendorStatus.SUSPENDED}});}catch(error){return next(error);}
});
app.put('/api/v1/rider/availability',requireUser,requireRole(Role.RIDER),async(req:AuthRequest,res,next)=>{
  const input=z.object({available:z.boolean()}).safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'INVALID_AVAILABILITY',message:'Availability must be true or false.'}});
  try{const profile=await prisma.riderProfile.findUnique({where:{userId:req.auth!.userId}});if(!profile||profile.status!==VendorStatus.APPROVED)return res.status(403).json({error:{code:'RIDER_NOT_APPROVED',message:'Only an approved, active rider can change availability.'}});if(input.data.available){const location=await prisma.riderLocation.findUnique({where:{riderId:profile.id}});if(!location||location.updatedAt<new Date(Date.now()-10*60_000))return res.status(409).json({error:{code:'LOCATION_REQUIRED',message:'Send a recent location before going online.'}});}const data=await prisma.riderProfile.update({where:{id:profile.id},data:{available:input.data.available}});if(data.available)await dispatchWaitingDeliveries();return res.json({data:{available:data.available}});}catch(error){return next(error);}
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
    const offers=await prisma.riderOffer.findMany({where:{riderId:rider.id,status:RiderOfferStatus.PENDING,expiresAt:{gt:new Date()}},include:{delivery:{include:{order:{include:{vendor:true,address:{select:{city:true}},items:true}}}}},orderBy:{createdAt:'asc'},take:20});
    const data=offers.map(offer=>{const order=offer.delivery.order;const pickup=order.vendor.latitude!==null&&order.vendor.longitude!==null&&rider.location?distanceKm(Number(rider.location.latitude),Number(rider.location.longitude),Number(order.vendor.latitude),Number(order.vendor.longitude)):null;const pickupDistanceKm=offer.pickupDistanceMeters===null?pickup:Number(offer.pickupDistanceMeters/1000);return{id:offer.id,expiresAt:offer.expiresAt,deliveryId:offer.deliveryId,pickupDistanceKm:pickupDistanceKm===null?null:Number(pickupDistanceKm.toFixed(1)),vendor:{name:order.vendor.name,address:order.vendor.address},dropoffCity:order.address?.city??'Delivery area',itemCount:order.items.reduce((count,item)=>count+item.quantity,0),totalMinor:order.totalMinor};});
    return res.json({data});
  }catch(error){return next(error);}
});
app.post('/api/v1/rider/offers/:offerId/accept',requireUser,requireRole(Role.RIDER),async(req:AuthRequest,res,next)=>{
  try{
    const rider=await prisma.riderProfile.findUnique({where:{userId:req.auth!.userId}});if(!rider||rider.status!==VendorStatus.APPROVED||!rider.available)return res.status(403).json({error:{code:'RIDER_UNAVAILABLE',message:'An approved, available rider is required to accept an offer.'}});
    const offer=await prisma.riderOffer.findFirst({where:{id:req.params.offerId,riderId:rider.id}});if(!offer)return res.status(404).json({error:{code:'OFFER_NOT_FOUND',message:'This offer is no longer available.'}});if(offer.status!==RiderOfferStatus.PENDING||offer.expiresAt<=new Date())return res.status(409).json({error:{code:'OFFER_EXPIRED',message:'This offer has expired.'}});
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
    const offer=await prisma.riderOffer.findFirst({where:{id:req.params.offerId,riderId:rider.id,status:RiderOfferStatus.PENDING}});if(!offer)return res.status(404).json({error:{code:'OFFER_NOT_FOUND',message:'This offer is no longer available.'}});
    await prisma.riderOffer.update({where:{id:offer.id},data:{status:RiderOfferStatus.REJECTED}});
    const active=await prisma.riderOffer.count({where:{deliveryId:offer.deliveryId,status:RiderOfferStatus.PENDING,expiresAt:{gt:new Date()}}});if(!active)await dispatchDeliveryOffers(offer.deliveryId);
    return res.status(204).end();
  }catch(error){return next(error);}
});
app.get('/api/v1/rider/deliveries',requireUser,requireRole(Role.RIDER),async(req:AuthRequest,res,next)=>{
  try{const rider=await prisma.riderProfile.findUnique({where:{userId:req.auth!.userId}});if(!rider||rider.status!==VendorStatus.APPROVED)return res.status(403).json({error:{code:'RIDER_NOT_APPROVED',message:'An approved rider profile is required.'}});const data=await prisma.delivery.findMany({where:{assignedRiderId:rider.id},orderBy:{createdAt:'desc'},take:50,include:{order:{select:{id:true,status:true,totalMinor:true,deliveryNotes:true,vendor:{select:{id:true,name:true,address:true,latitude:true,longitude:true}},address:{select:{label:true,line1:true,city:true,latitude:true,longitude:true}},items:{select:{id:true,nameSnapshot:true,quantity:true,unitPriceMinor:true,addons:true}}}}}});return res.json({data});}catch(error){return next(error);}
});
app.get('/api/v1/rider/deliveries/:deliveryId/route',requireUser,requireRole(Role.RIDER),async(req:AuthRequest,res,next)=>{
  try{
    const rider=await prisma.riderProfile.findUnique({where:{userId:req.auth!.userId},include:{location:true}});
    if(!rider||rider.status!==VendorStatus.APPROVED)return res.status(403).json({error:{code:'RIDER_NOT_APPROVED',message:'An approved rider profile is required.'}});
    const delivery=await prisma.delivery.findFirst({where:{id:req.params.deliveryId,assignedRiderId:rider.id,status:{in:[DeliveryStatus.ASSIGNED,DeliveryStatus.PICKED_UP]}},include:{order:{include:{vendor:true,address:true}}}});
    if(!delivery)return res.status(404).json({error:{code:'DELIVERY_NOT_ASSIGNED',message:'This active delivery is not assigned to you.'}});
    if(!rider.location||rider.location.updatedAt<new Date(Date.now()-10*60_000))return res.status(409).json({error:{code:'LOCATION_REQUIRED',message:'Send a recent location to calculate your route.'}});
    const origin={latitude:Number(rider.location.latitude),longitude:Number(rider.location.longitude)};
    const isPickup=delivery.status===DeliveryStatus.ASSIGNED;
    const destination=isPickup
      ?await freshVendorCoordinates(delivery.order.vendor)
      :delivery.order.address?await freshAddressCoordinates(delivery.order.address):null;
    if(!destination)return res.status(409).json({error:{code:'DESTINATION_COORDINATES_UNAVAILABLE',message:'A map pin is not available for this stop yet.'}});
    const apiKey=googleRoutesKey();
    if(!apiKey)return res.status(503).json({error:{code:'MAPS_NOT_CONFIGURED',message:'Google Maps route service is not configured.'}});
    const route=await computeDrivingRoute(origin,destination,apiKey);
    return res.json({data:{deliveryId:delivery.id,leg:isPickup?'PICKUP':'DROPOFF',origin,destination,distanceMeters:route.distanceMeters,durationSeconds:route.durationSeconds,encodedPolyline:route.encodedPolyline,provider:'google-routes'}});
  }catch(error){
    if(error instanceof GoogleMapsError)return res.status(502).json({error:{code:'ROUTE_UNAVAILABLE',message:'Google Maps could not calculate this route. Try again or open navigation.'}});
    return next(error);
  }
});
app.post('/api/v1/rider/deliveries/:deliveryId/pickup',requireUser,requireRole(Role.RIDER),async(req:AuthRequest,res,next)=>{
  const input=z.object({code:z.string().regex(/^\d{6}$/)}).safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'INVALID_PICKUP_CODE',message:'Enter the six-digit pickup code from the vendor.'}});
  try{
    const rider=await prisma.riderProfile.findUnique({where:{userId:req.auth!.userId}});if(!rider||rider.status!==VendorStatus.APPROVED)return res.status(403).json({error:{code:'RIDER_NOT_APPROVED',message:'An approved rider profile is required.'}});
    const delivery=await prisma.delivery.findFirst({where:{id:req.params.deliveryId,assignedRiderId:rider.id,status:DeliveryStatus.ASSIGNED}});if(!delivery)return res.status(409).json({error:{code:'INVALID_DELIVERY_STATE',message:'This delivery is not assigned to you or is not ready for pickup.'}});
    if(delivery.pickupVerifiedAt)return res.status(409).json({error:{code:'PICKUP_ALREADY_VERIFIED',message:'This pickup has already been confirmed.'}});
    if(delivery.pickupProofAttempts>=5)return res.status(429).json({error:{code:'PICKUP_CODE_LOCKED',message:'Too many incorrect pickup codes. Contact support.'}});
    const expected=Buffer.from(vendorPickupOtp(delivery.id));const provided=Buffer.from(input.data.code);
    if(!timingSafeEqual(expected,provided)){const attempt=await prisma.delivery.updateMany({where:{id:delivery.id,assignedRiderId:rider.id,status:DeliveryStatus.ASSIGNED,pickupProofAttempts:{lt:5}},data:{pickupProofAttempts:{increment:1}}});if(!attempt.count)return res.status(429).json({error:{code:'PICKUP_CODE_LOCKED',message:'Too many incorrect pickup codes. Contact support.'}});return res.status(403).json({error:{code:'INVALID_PICKUP_CODE',message:'That pickup code does not match. Ask the vendor to confirm the code.'}});}
    await prisma.$transaction(async tx=>{const changed=await tx.delivery.updateMany({where:{id:delivery.id,assignedRiderId:rider.id,status:DeliveryStatus.ASSIGNED,pickupVerifiedAt:null},data:{status:DeliveryStatus.PICKED_UP,pickedUpAt:new Date(),pickupVerifiedAt:new Date()}});if(!changed.count)throw new Error('DELIVERY_STATE_CONFLICT');await tx.order.update({where:{id:delivery.orderId},data:{status:OrderStatus.PICKED_UP}});await tx.orderStatusEvent.create({data:{orderId:delivery.orderId,status:OrderStatus.PICKED_UP,actorId:req.auth!.userId,note:'Vendor pickup code verified'}});});
    return res.json({data:{id:delivery.id,status:DeliveryStatus.PICKED_UP,pickupVerified:true}});
  }catch(error){if(error instanceof Error&&error.message==='DELIVERY_STATE_CONFLICT')return res.status(409).json({error:{code:error.message,message:'The delivery status changed. Refresh and try again.'}});if(error instanceof Error&&error.message.includes('DELIVERY_OTP_SECRET'))return res.status(503).json({error:{code:'DELIVERY_PROOF_UNAVAILABLE',message:'Pickup verification is not configured.'}});return next(error);}
});
app.post('/api/v1/rider/deliveries/:deliveryId/complete',requireUser,requireRole(Role.RIDER),async(req:AuthRequest,res,next)=>{
  const input=z.object({code:z.string().regex(/^\d{6}$/)}).safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'INVALID_DELIVERY_CODE',message:'Enter the 6 digit code from the customer.'}});
  try{const rider=await prisma.riderProfile.findUnique({where:{userId:req.auth!.userId}});if(!rider)return res.status(403).json({error:{code:'RIDER_NOT_APPROVED',message:'Rider profile required.'}});const delivery=await prisma.delivery.findFirst({where:{id:req.params.deliveryId,assignedRiderId:rider.id,status:DeliveryStatus.PICKED_UP}});if(!delivery)return res.status(409).json({error:{code:'INVALID_DELIVERY_STATE',message:'This delivery is not assigned to you or has not been picked up.'}});if(delivery.proofAttempts>=5)return res.status(429).json({error:{code:'DELIVERY_PROOF_LOCKED',message:'Too many incorrect codes. Contact support.'}});const expected=Buffer.from(deliveryOtp(delivery.id));const provided=Buffer.from(input.data.code);if(!timingSafeEqual(expected,provided)){const attempt=await prisma.delivery.updateMany({where:{id:delivery.id,proofAttempts:{lt:5}},data:{proofAttempts:{increment:1}}});if(!attempt.count)return res.status(429).json({error:{code:'DELIVERY_PROOF_LOCKED',message:'Too many incorrect codes. Contact support.'}});return res.status(403).json({error:{code:'INVALID_DELIVERY_CODE',message:'That delivery code does not match.'}});}await prisma.$transaction(async tx=>{const changed=await tx.delivery.updateMany({where:{id:delivery.id,assignedRiderId:rider.id,status:DeliveryStatus.PICKED_UP},data:{status:DeliveryStatus.DELIVERED,deliveredAt:new Date()}});if(!changed.count)throw new Error('DELIVERY_STATE_CONFLICT');await tx.order.update({where:{id:delivery.orderId},data:{status:OrderStatus.DELIVERED}});await tx.orderStatusEvent.create({data:{orderId:delivery.orderId,status:OrderStatus.DELIVERED,actorId:req.auth!.userId}});await tx.riderProfile.update({where:{id:rider.id},data:{available:true}});});return res.json({data:{id:delivery.id,status:DeliveryStatus.DELIVERED}});}catch(error){if(error instanceof Error&&error.message==='DELIVERY_STATE_CONFLICT')return res.status(409).json({error:{code:error.message,message:'The delivery status changed. Refresh and try again.'}});if(error instanceof Error&&error.message.includes('DELIVERY_OTP_SECRET'))return res.status(503).json({error:{code:'DELIVERY_PROOF_UNAVAILABLE',message:'Delivery proof is not configured.'}});return next(error);}
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
    let vendor = await prisma.vendor.findFirst({where:{id:req.params.vendorId,status:VendorStatus.APPROVED,isOpen:true,isDemo:false},select:{id:true,isDemo:true}});
    if(!vendor && demoMode) {
      const realVendorCount=await prisma.vendor.count({where:{status:VendorStatus.APPROVED,isOpen:true,isDemo:false}});
      if(realVendorCount===0) vendor=await prisma.vendor.findFirst({where:{id:req.params.vendorId,status:VendorStatus.APPROVED,isOpen:true,isDemo:true},select:{id:true,isDemo:true}});
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
    const prior = await prisma.order.findUnique({where:{idempotencyKey:input.data.idempotencyKey},include:{items:true}});
    if(prior) return prior.customerId === req.auth!.userId ? res.json({data:prior,replayed:true}) : res.status(409).json({error:{code:'IDEMPOTENCY_CONFLICT',message:'This request key is already in use.'}});
    const [vendor,address] = await Promise.all([
      prisma.vendor.findFirst({where:{id:input.data.vendorId,status:VendorStatus.APPROVED,isOpen:true}}),
      prisma.address.findFirst({where:{id:input.data.addressId,userId:req.auth!.userId}})
    ]);
    if(!vendor) return res.status(409).json({error:{code:'VENDOR_UNAVAILABLE',message:'This kitchen cannot accept orders right now.'}});
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
    const order=await prisma.order.findFirst({where:{id:req.params.orderId,customerId:req.auth!.userId},select:{id:true,status:true,totalMinor:true,isDemo:true,customer:{select:{email:true}}}});
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
  try { const wallet=await ensureWallet(req.auth!.userId); return res.json({data:{balanceMinor:wallet.balanceMinor,currency:wallet.currency,status:wallet.status,dva:{accountNumber:wallet.dvaAccountNumber,accountName:wallet.dvaAccountName,bankName:wallet.dvaBankName,bankSlug:wallet.dvaBankSlug,status:wallet.dvaStatus}}}); }
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

app.get('/api/v1/orders',requireUser,requireRole(Role.CUSTOMER),async (req:AuthRequest,res,next) => {
  try {
    const rows=await prisma.order.findMany({where:{customerId:req.auth!.userId},orderBy:{createdAt:'desc'},take:50,include:{items:{include:{addons:true}},vendor:{select:{id:true,name:true}},events:{select:{id:true,status:true,note:true,createdAt:true},orderBy:{createdAt:'asc'}},delivery:{include:{assignedRider:{include:{user:{select:{name:true}}}}}}}});
    const data=rows.map(({delivery,...order})=>({...order,delivery:delivery?{status:delivery.status,assignedAt:delivery.assignedAt,riderName:delivery.assignedRider?.user.name??null}:null,deliveryCode:delivery?.assignedRiderId&&[DeliveryStatus.ASSIGNED,DeliveryStatus.PICKED_UP].includes(delivery.status)?deliveryOtp(delivery.id):null}));
    return res.json({data});
  }
  catch(error) { return next(error); }
});
app.get('/api/v1/orders/:orderId/tracking',requireUser,requireRole(Role.CUSTOMER),async(req:AuthRequest,res,next)=>{
  try{
    const order=await prisma.order.findFirst({where:{id:req.params.orderId,customerId:req.auth!.userId},select:{id:true,vendor:{select:{id:true,name:true,address:true,latitude:true,longitude:true,geocodedAt:true}},address:{select:{id:true,line1:true,city:true,latitude:true,longitude:true,geocodedAt:true}},delivery:{select:{id:true,status:true,assignedRiderId:true,assignedRider:{select:{location:{select:{latitude:true,longitude:true,updatedAt:true}}}}}}}});
    if(!order)return res.status(404).json({error:{code:'ORDER_NOT_FOUND',message:'This order was not found.'}});
    const delivery=order.delivery;
    if(!delivery||!delivery.assignedRiderId||![DeliveryStatus.ASSIGNED,DeliveryStatus.PICKED_UP].includes(delivery.status))return res.status(409).json({error:{code:'TRACKING_UNAVAILABLE',message:'Live rider tracking is available after a rider is assigned.'}});
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
    const vendor = await prisma.vendor.findFirst({where:{ownerId:req.auth!.userId,status:VendorStatus.APPROVED},select:{id:true}});
    if(!vendor) return res.status(403).json({error:{code:'VENDOR_NOT_APPROVED',message:'An approved vendor account is required.'}});
    const rows = await prisma.order.findMany({where:{vendorId:vendor.id},orderBy:{createdAt:'asc'},take:100,include:{items:{include:{addons:true}},events:{orderBy:{createdAt:'asc'}},delivery:{include:{assignedRider:{include:{user:{select:{name:true}}}}}}}});
    const data=rows.map(({delivery,...order})=>({...order,delivery:delivery?{status:delivery.status,assignedAt:delivery.assignedAt,riderName:delivery.assignedRider?.user.name??null,pickupCode:delivery.status===DeliveryStatus.ASSIGNED?vendorPickupOtp(delivery.id):null}:null}));
    return res.json({data});
  } catch(error) { return next(error); }
});

app.post('/api/v1/vendor/orders/:orderId/status',requireUser,requireRole(Role.VENDOR),async (req:AuthRequest,res,next) => {
  const input = z.object({status:z.enum([OrderStatus.ACCEPTED_BY_VENDOR,OrderStatus.REJECTED,OrderStatus.PREPARING,OrderStatus.READY_FOR_PICKUP])}).safeParse(req.body);
  if(!input.success) return res.status(400).json({error:{code:'INVALID_STATUS',message:'That vendor order status is invalid.'}});
  if(input.data.status===OrderStatus.READY_FOR_PICKUP&&!deliveryProofSecret()) return res.status(503).json({error:{code:'DELIVERY_PROOF_UNAVAILABLE',message:'Set DELIVERY_OTP_SECRET before sending deliveries to riders.'}});
  try {
    const vendor = await prisma.vendor.findFirst({where:{ownerId:req.auth!.userId,status:VendorStatus.APPROVED}});
    if(!vendor) return res.status(403).json({error:{code:'VENDOR_NOT_APPROVED',message:'An approved vendor account is required.'}});
    const order = await prisma.order.findFirst({where:{id:req.params.orderId,vendorId:vendor.id}});
    if(!order) return res.status(404).json({error:{code:'ORDER_NOT_FOUND',message:'Order not found.'}});
    if(!canVendorTransition(order.status,input.data.status)) return res.status(409).json({error:{code:'INVALID_TRANSITION',message:'The order has changed or this transition is not allowed.'}});
    const result = await prisma.$transaction(async tx=>{
      const update = await tx.order.updateMany({where:{id:order.id,status:order.status},data:{status:input.data.status}});
      if(update.count !== 1) throw new Error('ORDER_STATE_CONFLICT');
      await tx.orderStatusEvent.create({data:{orderId:order.id,status:input.data.status,actorId:req.auth!.userId}});
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

app.get('/api/v1/admin/overview',requireUser,requireRole(Role.ADMIN),async(_req,res,next)=>{
  try{
    const [orders,customers,vendors,riders,revenue]=await Promise.all([
      prisma.order.count({where:{isDemo:false}}),prisma.user.count({where:{isDemo:false,roles:{has:Role.CUSTOMER}}}),
      prisma.vendor.count({where:{isDemo:false}}),prisma.riderProfile.count({where:{user:{isDemo:false}}}),
      prisma.payment.aggregate({where:{status:'SUCCEEDED',isDemo:false},_sum:{amountMinor:true}})
    ]);
    return res.json({data:{orders,customers,vendors,riders,revenueMinor:revenue._sum.amountMinor??0}});
  }catch(error){return next(error);}
});
app.get('/api/v1/admin/applications',requireUser,requireRole(Role.ADMIN),async(_req,res,next)=>{
  try{
    const [vendors,riders]=await Promise.all([
      prisma.vendor.findMany({where:{status:{in:[VendorStatus.DRAFT,VendorStatus.PENDING_REVIEW]}},orderBy:{createdAt:'asc'},take:50,select:{id:true,name:true,address:true,status:true,createdAt:true,owner:{select:{name:true,email:true}}}}),
      prisma.riderProfile.findMany({where:{status:{in:[VendorStatus.DRAFT,VendorStatus.PENDING_REVIEW]}},orderBy:{user:{createdAt:'asc'}},take:50,select:{id:true,status:true,vehicleType:true,serviceArea:true,user:{select:{name:true,email:true,createdAt:true}}}})
    ]);
    return res.json({data:{vendors,riders}});
  }catch(error){return next(error);}
});
app.patch('/api/v1/admin/vendors/:vendorId/status',requireUser,requireRole(Role.ADMIN),async(req:AuthRequest,res,next)=>{
  const input=z.object({status:z.enum([VendorStatus.APPROVED,VendorStatus.REJECTED,VendorStatus.SUSPENDED]),isOpen:z.boolean().optional()}).safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'INVALID_STATUS',message:'Vendor review status is invalid.'}});
  try{
    const data=await prisma.$transaction(async tx=>{
      const vendor=await tx.vendor.update({where:{id:req.params.vendorId},data:{status:input.data.status,isOpen:input.data.status===VendorStatus.APPROVED?input.data.isOpen??false:false},select:{id:true,name:true,status:true,isOpen:true}});
      await tx.auditLog.create({data:{actorId:req.auth!.userId,action:'VENDOR_STATUS_CHANGED',targetType:'Vendor',targetId:vendor.id,metadata:{status:vendor.status,isOpen:vendor.isOpen},isDemo:demoMode}});
      return vendor;
    });
    return res.json({data});
  }catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2025')return res.status(404).json({error:{code:'VENDOR_NOT_FOUND',message:'Vendor application not found.'}});return next(error);}
});
app.patch('/api/v1/admin/riders/:riderId/status',requireUser,requireRole(Role.ADMIN),async(req:AuthRequest,res,next)=>{
  const input=z.object({status:z.enum([VendorStatus.APPROVED,VendorStatus.REJECTED,VendorStatus.SUSPENDED])}).safeParse(req.body);if(!input.success)return res.status(400).json({error:{code:'INVALID_STATUS',message:'Rider review status is invalid.'}});
  try{
    const data=await prisma.$transaction(async tx=>{
      const rider=await tx.riderProfile.update({where:{id:req.params.riderId},data:{status:input.data.status,available:false},select:{id:true,status:true,vehicleType:true,serviceArea:true}});
      await tx.auditLog.create({data:{actorId:req.auth!.userId,action:'RIDER_STATUS_CHANGED',targetType:'RiderProfile',targetId:rider.id,metadata:{status:rider.status},isDemo:demoMode}});
      return rider;
    });
    return res.json({data});
  }catch(error){if(error instanceof Prisma.PrismaClientKnownRequestError&&error.code==='P2025')return res.status(404).json({error:{code:'RIDER_NOT_FOUND',message:'Rider application not found.'}});return next(error);}
});
app.get('/api/v1/admin/audit-logs',requireUser,requireRole(Role.ADMIN),async(req,res,next)=>{
  const input=z.object({cursor:z.string().optional(),limit:z.coerce.number().int().min(1).max(100).default(50)}).safeParse(req.query);if(!input.success)return res.status(400).json({error:{code:'INVALID_QUERY',message:'Audit-log pagination is invalid.'}});
  try{const data=await prisma.auditLog.findMany({where:{isDemo:false},orderBy:{createdAt:'desc'},take:input.data.limit,...(input.data.cursor?{skip:1,cursor:{id:input.data.cursor}}:{}),select:{id:true,actorId:true,action:true,targetType:true,targetId:true,metadata:true,createdAt:true}});return res.json({data,nextCursor:data.length===input.data.limit?data.at(-1)?.id:null});}catch(error){return next(error);}
});

app.use((_req,res) => res.status(404).json({error:{code:'NOT_FOUND',message:'This endpoint does not exist.'}}));
app.use((error:unknown,_req:Request,res:express.Response,_next:express.NextFunction) => {
  const requestId = randomBytes(8).toString('hex');
  console.error(JSON.stringify({requestId,errorType:error instanceof Error?error.name:'UnknownError'}));
  return res.status(500).json({error:{code:'INTERNAL_ERROR',message:'Something went wrong. Try again.',requestId}});
});

void pruneExpiredGoogleCoordinates().catch(error=>console.error(JSON.stringify({event:'google_coordinate_prune_failed',error:error instanceof Error?error.name:'unknown'})));
setInterval(()=>{
  void pruneExpiredGoogleCoordinates().catch(error=>console.error(JSON.stringify({event:'google_coordinate_prune_failed',error:error instanceof Error?error.name:'unknown'})));
},5*60_000).unref();
app.listen(port,'0.0.0.0',()=>console.log(`Smile API listening on port ${port} on all network interfaces`));
