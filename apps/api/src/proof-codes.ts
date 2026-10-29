import { createHmac } from 'node:crypto';

export function createProofCode(secret:string,scope:'customer-delivery'|'vendor-pickup',deliveryId:string):string {
  const digest=createHmac('sha256',secret).update(`${scope}:${deliveryId}`).digest();
  return String(digest.readUInt32BE(0)%1_000_000).padStart(6,'0');
}
