export type VendorOrderStatus = 'CONFIRMED'|'ACCEPTED_BY_VENDOR'|'PREPARING'|'READY_FOR_PICKUP'|'REJECTED';

export const SERVICE_FEE_MINOR = 50_000;
export const BASE_DELIVERY_FEE_MINOR = 50_000;
export const DELIVERY_FEE_PER_KM_MINOR = 15_000;
export const MIN_DELIVERY_FEE_MINOR = 50_000;
export const DELIVERY_FEE_ROUNDING_MINOR = 5_000;

const vendorTransitions:Partial<Record<VendorOrderStatus,VendorOrderStatus[]>>={
  CONFIRMED:['ACCEPTED_BY_VENDOR','REJECTED'],
  ACCEPTED_BY_VENDOR:['PREPARING'],
  PREPARING:['READY_FOR_PICKUP']
};

export function canVendorTransition(from:string,to:string):boolean {
  return !!vendorTransitions[from as VendorOrderStatus]?.includes(to as VendorOrderStatus);
}

/** Calculates the distance-based rider fee in minor units (kobo) rounded to the nearest ₦50. */
export function calculateDeliveryFeeMinor(distanceMeters: number): number {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) {
    throw new RangeError('Invalid delivery distance.');
  }
  const distanceKm = distanceMeters / 1000;
  const rawMinor = BASE_DELIVERY_FEE_MINOR + distanceKm * DELIVERY_FEE_PER_KM_MINOR;
  const roundedMinor = Math.round(rawMinor / DELIVERY_FEE_ROUNDING_MINOR) * DELIVERY_FEE_ROUNDING_MINOR;
  return Math.max(MIN_DELIVERY_FEE_MINOR, roundedMinor);
}

/** Computes server-authoritative order subtotal, fees, and customer total in minor units. */
export function calculateOrderAmounts(
  items: { priceMinor: number; quantity: number; addons?: { priceMinor: number; quantity: number }[] }[],
  deliveryFeeMinor: number,
  serviceFeeMinor: number = SERVICE_FEE_MINOR,
) {
  if (!Number.isSafeInteger(deliveryFeeMinor) || deliveryFeeMinor < 0) throw new RangeError('Invalid delivery fee.');
  if (!Number.isSafeInteger(serviceFeeMinor) || serviceFeeMinor < 0) throw new RangeError('Invalid service fee.');
  let subtotalMinor = 0;
  for (const item of items) {
    if (!Number.isSafeInteger(item.priceMinor) || item.priceMinor < 1 || !Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new RangeError('Invalid order line.');
    }
    if (item.addons?.some(addon => !Number.isSafeInteger(addon.priceMinor) || addon.priceMinor < 1 || !Number.isInteger(addon.quantity) || addon.quantity < 1)) {
      throw new RangeError('Invalid order add-on.');
    }
    const unitMinor = item.priceMinor + (item.addons ?? []).reduce((sum, addon) => sum + addon.priceMinor * addon.quantity, 0);
    subtotalMinor += unitMinor * item.quantity;
    if (!Number.isSafeInteger(subtotalMinor) || subtotalMinor + deliveryFeeMinor + serviceFeeMinor > 2_147_483_647) {
      throw new RangeError('Order total is outside the supported range.');
    }
  }
  return {
    subtotalMinor,
    deliveryFeeMinor,
    serviceFeeMinor,
    totalMinor: subtotalMinor + deliveryFeeMinor + serviceFeeMinor,
  };
}
