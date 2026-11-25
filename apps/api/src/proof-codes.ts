import { createHmac } from 'node:crypto';

export function proofSubject(deliveryId:string,assignedRiderId:string):string {
  return `${deliveryId}:${assignedRiderId}`;
}

export function createProofCode(secret:string,scope:'customer-delivery'|'vendor-pickup',subject:string):string {
  const digest=createHmac('sha256',secret).update(`${scope}:${subject}`).digest();
  return String(digest.readUInt32BE(0)%1_000_000).padStart(6,'0');
}
