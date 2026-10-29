export type VendorOrderStatus = 'CONFIRMED'|'ACCEPTED_BY_VENDOR'|'PREPARING'|'READY_FOR_PICKUP'|'REJECTED';

const vendorTransitions:Partial<Record<VendorOrderStatus,VendorOrderStatus[]>>={
  CONFIRMED:['ACCEPTED_BY_VENDOR','REJECTED'],
  ACCEPTED_BY_VENDOR:['PREPARING'],
  PREPARING:['READY_FOR_PICKUP']
};

export function canVendorTransition(from:string,to:string):boolean {
  return !!vendorTransitions[from as VendorOrderStatus]?.includes(to as VendorOrderStatus);
}

export function calculateOrderAmounts(items:{priceMinor:number;quantity:number;addons?:{priceMinor:number;quantity:number}[]}[],deliveryFeeMinor:number) {
  if(!Number.isSafeInteger(deliveryFeeMinor)||deliveryFeeMinor<0) throw new RangeError('Invalid delivery fee.');
  let subtotalMinor=0;
  for(const item of items) {
    if(!Number.isSafeInteger(item.priceMinor)||item.priceMinor<1||!Number.isInteger(item.quantity)||item.quantity<1) throw new RangeError('Invalid order line.');
    if(item.addons?.some(addon=>!Number.isSafeInteger(addon.priceMinor)||addon.priceMinor<1||!Number.isInteger(addon.quantity)||addon.quantity<1)) throw new RangeError('Invalid order add-on.');
    const unitMinor=item.priceMinor+(item.addons??[]).reduce((sum,addon)=>sum+addon.priceMinor*addon.quantity,0);
    subtotalMinor+=unitMinor*item.quantity;
    if(!Number.isSafeInteger(subtotalMinor)||subtotalMinor+deliveryFeeMinor>2_147_483_647) throw new RangeError('Order total is outside the supported range.');
  }
  return {subtotalMinor,totalMinor:subtotalMinor+deliveryFeeMinor};
}
