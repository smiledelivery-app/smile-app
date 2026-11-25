import type { VendorOrder } from '@makanza/mobile-core';

export type VendorOrderTab = 'incoming' | 'accepted' | 'completed';
export type VendorHistoryFilter = 'all' | 'incoming' | 'accepted' | 'completed' | 'declined';

const INCOMING_STATUSES = new Set(['CONFIRMED']);

const ACCEPTED_STATUSES = new Set([
  'ACCEPTED_BY_VENDOR',
  'PREPARING',
  'READY_FOR_PICKUP',
  'RIDER_ASSIGNED',
  'PICKED_UP',
  'DELIVERY_EXCEPTION',
]);

const COMPLETED_STATUSES = new Set(['DELIVERED']);

const DECLINED_OR_CANCELLED_STATUSES = new Set([
  'REJECTED',
  'CANCELLED',
  'REFUND_PENDING',
  'REFUNDED',
]);

export function isVendorOrderIncoming(order: Pick<VendorOrder, 'status'>): boolean {
  return INCOMING_STATUSES.has(order.status);
}

export function isVendorOrderAccepted(order: Pick<VendorOrder, 'status'>): boolean {
  return ACCEPTED_STATUSES.has(order.status);
}

export function isVendorOrderCompleted(order: Pick<VendorOrder, 'status'>): boolean {
  return COMPLETED_STATUSES.has(order.status);
}

export function isVendorOrderDeclinedOrCancelled(order: Pick<VendorOrder, 'status'>): boolean {
  return DECLINED_OR_CANCELLED_STATUSES.has(order.status);
}

const sortNewestFirst = (orders: readonly VendorOrder[]) =>
  [...orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

export function filterVendorOrdersByTab(orders: readonly VendorOrder[], tab: VendorOrderTab): VendorOrder[] {
  if (tab === 'incoming') return orders.filter(isVendorOrderIncoming);
  if (tab === 'accepted') return orders.filter(isVendorOrderAccepted);
  return sortNewestFirst(orders.filter(isVendorOrderCompleted));
}

export function filterVendorHistoryOrders(orders: readonly VendorOrder[], filter: VendorHistoryFilter): VendorOrder[] {
  const ordered = sortNewestFirst(orders);
  if (filter === 'all') return ordered;
  if (filter === 'incoming') return ordered.filter(isVendorOrderIncoming);
  if (filter === 'accepted') return ordered.filter(isVendorOrderAccepted);
  if (filter === 'completed') return ordered.filter(isVendorOrderCompleted);
  return ordered.filter(isVendorOrderDeclinedOrCancelled);
}

export function getVendorOrderTabCounts(orders: readonly VendorOrder[]): Record<VendorOrderTab, number> {
  let incoming = 0;
  let accepted = 0;
  let completed = 0;
  for (const order of orders) {
    if (isVendorOrderIncoming(order)) incoming += 1;
    else if (isVendorOrderAccepted(order)) accepted += 1;
    else if (isVendorOrderCompleted(order)) completed += 1;
  }
  return { incoming, accepted, completed };
}

export function getVendorOrderProgressStep(status: string): number {
  switch (status) {
    case 'ACCEPTED_BY_VENDOR':
      return 1;
    case 'PREPARING':
      return 2;
    case 'READY_FOR_PICKUP':
    case 'RIDER_ASSIGNED':
      return 3;
    case 'PICKED_UP':
    case 'DELIVERED':
      return 4;
    default:
      return 0;
  }
}
