// Add clearly tagged demo records to a development database. This seed never deletes.
import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient, Role, VendorStatus } from '@prisma/client';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';

const prisma = new PrismaClient();
async function hashDemoPassword(password:string) {
  const salt = randomBytes(16).toString('hex');
  const key = await new Promise<Buffer>((resolve,reject)=>scryptCallback(password,salt,64,(error,derived)=>error?reject(error):resolve(derived)));
  return `scrypt$${salt}$${key.toString('hex')}`;
}
const kitchens = [
  {slug:'saffron-suya-demo',name:'Saffron & Suya',productCategory:'Nigerian · Grill',address:'Lekki Phase 1, Lagos',latitude:6.4474,longitude:3.4723,image:'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1000&q=85',products:[['Smoky party jollof','Smoky tomato rice, sweet plantain and a choice of protein.',450000],['Suya chicken skewers','Peppery grilled chicken with onions and fresh tomatoes.',380000]]},
  {slug:'jollof-house-demo',name:'The Jollof House',productCategory:'West African · Rice',address:'Victoria Island, Lagos',latitude:6.4281,longitude:3.4219,image:'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=1000&q=85',products:[['Village jollof bowl','Smoky party jollof with dodo and ayamase chicken.',520000],['Ofada rice & stew','Local ofada rice with rich green pepper sauce.',490000]]},
  {slug:'mellow-bowl-demo',name:'Mellow Bowl',productCategory:'Healthy · Bowls',address:'Ikoyi, Lagos',latitude:6.4474,longitude:3.4320,image:'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1000&q=85',products:[['Rainbow nourish bowl','Avocado, grains, greens and a citrus dressing.',610000],['Crispy plantain salad','Warm plantain, crunchy greens and house sauce.',470000]]},
  {slug:'buka-corner-demo',name:'Buka on the Corner',productCategory:'Nigerian · Local',address:'Yaba, Lagos',latitude:6.5158,longitude:3.3895,image:'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1000&q=85',products:[['Egusi & pounded yam','Slow-cooked egusi with greens and soft pounded yam.',560000],['Beans & ripe plantain','Comforting honey beans with golden dodo.',330000]]}
];

async function main() {
  if(process.env.NODE_ENV === 'production' || process.env.DEMO_MODE !== 'true') throw new Error('Demo seed refused: set DEMO_MODE=true outside production.');
  const demoPassword = process.env.DEMO_PASSWORD;
  if(!demoPassword || demoPassword.length < 12) throw new Error('Set DEMO_PASSWORD to a development-only password with at least 12 characters.');
  const passwordHash = await hashDemoPassword(demoPassword);
  const customer = await prisma.user.upsert({where:{email:'customer.demo@makanza.example'},update:{passwordHash},create:{email:'customer.demo@makanza.example',name:'Makanza Demo Customer',passwordHash,roles:[Role.CUSTOMER],isDemo:true}});
  const admin = await prisma.user.upsert({where:{email:'admin.demo@makanza.example'},update:{passwordHash},create:{email:'admin.demo@makanza.example',name:'Makanza Demo Admin',passwordHash,roles:[Role.ADMIN],isDemo:true}});
  await prisma.address.upsert({where:{id:'demo-address-lekki'},update:{},create:{id:'demo-address-lekki',userId:customer.id,label:'Home',line1:'Lekki Phase 1',city:'Lagos',latitude:6.4474,longitude:3.4723}});
  for(const [index,kitchen] of kitchens.entries()) {
    const email = `vendor${index+1}.demo@makanza.example`;
    const owner = await prisma.user.upsert({where:{email},update:{passwordHash},create:{email,name:`${kitchen.name} Owner`,passwordHash,roles:[Role.VENDOR],isDemo:true}});
    const vendor = await prisma.vendor.upsert({where:{slug:kitchen.slug},update:{},create:{ownerId:owner.id,name:kitchen.name,slug:kitchen.slug,address:kitchen.address,latitude:kitchen.latitude,longitude:kitchen.longitude,status:VendorStatus.APPROVED,isOpen:true,isDemo:true}});
    for(const [productIndex,product] of kitchen.products.entries()) {
      const id = `${kitchen.slug}-item-${productIndex+1}`;
      await prisma.product.upsert({where:{id},update:{},create:{id,vendorId:vendor.id,name:product[0],description:product[1],category:kitchen.productCategory.split(' · ')[0],priceMinor:product[2] as number,imageUrl:kitchen.image,stock:25,isDemo:true}});
    }
  }
  const riderUser=await prisma.user.upsert({where:{email:'rider.demo@makanza.example'},update:{passwordHash},create:{email:'rider.demo@makanza.example',name:'Demo Rider',passwordHash,roles:[Role.RIDER],isDemo:true}});
  const rider=await prisma.riderProfile.upsert({where:{userId:riderUser.id},update:{},create:{userId:riderUser.id,status:VendorStatus.APPROVED,available:true,vehicleType:'Bicycle',serviceArea:'Lagos'}});
  await prisma.riderLocation.upsert({where:{riderId:rider.id},update:{latitude:6.4550,longitude:3.4590},create:{riderId:rider.id,latitude:6.4550,longitude:3.4590}});
  console.log(`Demo data ready: ${kitchens.length} tagged kitchens, 8 products, one available demo rider, customer ${customer.email}, and admin ${admin.email}.`);
  console.log('Vendors: vendor1.demo@makanza.example through vendor4.demo@makanza.example; rider: rider.demo@makanza.example. Passwords come from DEMO_PASSWORD.');
}
main().finally(async()=>prisma.$disconnect());
