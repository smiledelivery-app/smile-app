import { z } from 'zod';

export const vendorOperatingHourInput = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isClosed: z.boolean(),
  openingTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).nullable(),
  closingTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).nullable(),
}).refine(hour => hour.isClosed
  ? hour.openingTime === null && hour.closingTime === null
  : hour.openingTime !== null && hour.closingTime !== null, {
  message: 'Closed days must not have hours; open days need both opening and closing times.',
});

export const vendorOperatingHoursInput = z.array(vendorOperatingHourInput)
  .length(7)
  .refine(hours => new Set(hours.map(hour => hour.dayOfWeek)).size === 7, {
    message: 'Provide exactly one schedule for each day of the week.',
  });

export type VendorOperatingHourInput = z.infer<typeof vendorOperatingHourInput>;
