import { z } from 'zod';

// Application identity and profile fields are required; payout verification
// is optional at submission time so provider outages do not block review.
export const riderApplicationInput = z.object({
  vehicleType:z.enum(['BICYCLE','MOTORCYCLE','TRICYCLE','CAR']),
  serviceArea:z.string().trim().min(2).max(100),
  dateOfBirth:z.string().date(),
  nin:z.string().regex(/^\d{11}$/),
  ninDocumentPublicId:z.string().trim().min(10).max(255).regex(/^smile\/riders\/[a-zA-Z0-9_-]+\/identity\/[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)?$/),
  ninDocumentVersion:z.number().int().positive().max(2_147_483_647),
  profileImagePublicId:z.string().trim().min(10).max(255).regex(/^smile\/riders\/[a-zA-Z0-9_-]+\/profile\/[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)?$/),
  profileImageUrl:z.string().url().max(2048),
  plateNumber:z.string().trim().max(20).optional().default(''),
  residentialAddress:z.string().trim().min(8).max(250),
  guarantorName:z.string().trim().min(2).max(100),
  guarantorNin:z.string().regex(/^\d{11}$/),
  guarantorAddress:z.string().trim().min(8).max(250),
  accountNumber:z.string().trim().max(10).optional().default(''),
  bankCode:z.string().trim().max(12).optional().default(''),
  termsAccepted:z.literal(true),
}).superRefine((data,ctx)=>{
  if(data.vehicleType!=='BICYCLE'&&!data.plateNumber.trim())ctx.addIssue({code:z.ZodIssueCode.custom,path:['plateNumber'],message:'A plate number is required for this vehicle.'});
  if(data.vehicleType==='BICYCLE'&&data.plateNumber.trim().length>0&&data.plateNumber.trim().length<3)ctx.addIssue({code:z.ZodIssueCode.custom,path:['plateNumber'],message:'Enter a valid plate number or leave blank for a bicycle.'});
});

export type RiderApplicationInput = z.infer<typeof riderApplicationInput>;
