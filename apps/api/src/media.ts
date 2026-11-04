import { createHash } from 'node:crypto';

export class MediaProviderError extends Error {
  constructor(message: string, readonly status = 503) { super(message); this.name = 'MediaProviderError'; }
}

export type CloudinaryUploadSignature = { cloudName: string; apiKey: string; timestamp: number; folder: string; signature: string };

export function createVendorImageUploadSignature(userId: string): CloudinaryUploadSignature {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) throw new MediaProviderError('Vendor image upload is not configured. Set the Cloudinary server credentials.');

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `smile/vendors/${userId}`;
  const signature = createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`).digest('hex');
  return { cloudName, apiKey, timestamp, folder, signature };
}

export function createRiderNinUploadSignature(userId:string):CloudinaryUploadSignature&{type:'authenticated';resourceType:'raw'}{
  const cloudName=process.env.CLOUDINARY_CLOUD_NAME?.trim();const apiKey=process.env.CLOUDINARY_API_KEY?.trim();const apiSecret=process.env.CLOUDINARY_API_SECRET?.trim();
  if(!cloudName||!apiKey||!apiSecret)throw new MediaProviderError('Secure rider document upload is not configured. Set the Cloudinary server credentials.');
  const timestamp=Math.floor(Date.now()/1000);const folder=`smile/riders/${userId}/identity`;const type='authenticated';
  const signature=createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}&type=${type}${apiSecret}`).digest('hex');
  return{cloudName,apiKey,timestamp,folder,signature,type,resourceType:'raw'};
}
