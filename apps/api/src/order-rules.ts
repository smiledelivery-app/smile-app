export type VendorOrderStatus = 'CONFIRMED'|'ACCEPTED_BY_VENDOR'|'PREPARING'|'READY_FOR_PICKUP'|'REJECTED';

export const SERVICE_FEE_MINOR = 50_000;
export const BASE_DELIVERY_FEE_MINOR = 50_000;
export const DELIVERY_FEE_PER_KM_MINOR = 15_000;
export const MIN_DELIVERY_FEE_MINOR = 50_000;
export const DELIVERY_FEE_ROUNDING_MINOR = 5_000;

export type PaymentFeeSettings = {
  baseDeliveryFeeMinor: number;
  deliveryFeePerKmMinor: number;
  serviceFeeMinor: number;
};

export const DEFAULT_PAYMENT_FEE_SETTINGS: PaymentFeeSettings = {
  baseDeliveryFeeMinor: BASE_DELIVERY_FEE_MINOR,
  deliveryFeePerKmMinor: DELIVERY_FEE_PER_KM_MINOR,
  serviceFeeMinor: SERVICE_FEE_MINOR,
};

export function resolvePaymentFeeSettings(row?: Partial<PaymentFeeSettings> | null): PaymentFeeSettings {
  return {
    baseDeliveryFeeMinor:
      typeof row?.baseDeliveryFeeMinor === 'number' && Number.isSafeInteger(row.baseDeliveryFeeMinor) && row.baseDeliveryFeeMinor >= 0
        ? row.baseDeliveryFeeMinor
        : BASE_DELIVERY_FEE_MINOR,
    deliveryFeePerKmMinor:
      typeof row?.deliveryFeePerKmMinor === 'number' && Number.isSafeInteger(row.deliveryFeePerKmMinor) && row.deliveryFeePerKmMinor >= 0
        ? row.deliveryFeePerKmMinor
        : DELIVERY_FEE_PER_KM_MINOR,
    serviceFeeMinor:
      typeof row?.serviceFeeMinor === 'number' && Number.isSafeInteger(row.serviceFeeMinor) && row.serviceFeeMinor >= 0
        ? row.serviceFeeMinor
        : SERVICE_FEE_MINOR,
  };
}

const vendorTransitions:Partial<Record<VendorOrderStatus,VendorOrderStatus[]>>={
  CONFIRMED:['ACCEPTED_BY_VENDOR','REJECTED'],
  ACCEPTED_BY_VENDOR:['PREPARING'],
  PREPARING:['READY_FOR_PICKUP']
};

export function canVendorTransition(from:string,to:string):boolean {
  return !!vendorTransitions[from as VendorOrderStatus]?.includes(to as VendorOrderStatus);
}

/** Calculates the distance-based rider fee in minor units (kobo) rounded to the nearest ₦50. */
export function calculateDeliveryFeeMinor(
  distanceMeters: number,
  settings?: Partial<Pick<PaymentFeeSettings, 'baseDeliveryFeeMinor' | 'deliveryFeePerKmMinor'>>,
): number {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) {
    throw new RangeError('Invalid delivery distance.');
  }
  const baseFeeMinor = settings?.baseDeliveryFeeMinor ?? BASE_DELIVERY_FEE_MINOR;
  const perKmFeeMinor = settings?.deliveryFeePerKmMinor ?? DELIVERY_FEE_PER_KM_MINOR;
  if (!Number.isSafeInteger(baseFeeMinor) || baseFeeMinor < 0) {
    throw new RangeError('Invalid base delivery fee.');
  }
  if (!Number.isSafeInteger(perKmFeeMinor) || perKmFeeMinor < 0) {
    throw new RangeError('Invalid per-kilometer delivery fee.');
  }
  const distanceKm = distanceMeters / 1000;
  const rawMinor = baseFeeMinor + distanceKm * perKmFeeMinor;
  const roundedMinor = Math.round(rawMinor / DELIVERY_FEE_ROUNDING_MINOR) * DELIVERY_FEE_ROUNDING_MINOR;
  return Math.max(baseFeeMinor, roundedMinor);
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
