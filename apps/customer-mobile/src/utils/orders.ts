import type { CustomerOrder } from '@makanza/mobile-core';

export type OrderTab = 'ongoing' | 'completed' | 'cancelled';
export type HistoryFilter = 'all' | 'ongoing' | 'unpaid' | 'completed' | 'cancelled';

/** Paid orders that have not yet been delivered, cancelled, rejected, or refunded. */
const ONGOING_PAID_STATUSES = new Set([
  'CONFIRMED',
  'ACCEPTED_BY_VENDOR',
  'PREPARING',
  'READY_FOR_PICKUP',
  'RIDER_ASSIGNED',
  'PICKED_UP',
  'DELIVERY_EXCEPTION',
]);

const COMPLETED_STATUSES = new Set(['DELIVERED']);

const CANCELLED_STATUSES = new Set([
  'CANCELLED',
  'REJECTED',
  'REFUND_PENDING',
  'REFUNDED',
]);

const UNPAID_OR_FAILED_STATUSES = new Set([
  'PENDING_PAYMENT',
  'PAYMENT_FAILED',
]);

const CANCELLABLE_STATUSES = new Set([
  'PENDING_PAYMENT',
  'CONFIRMED',
  'ACCEPTED_BY_VENDOR',
  'PREPARING',
  'READY_FOR_PICKUP',
  'RIDER_ASSIGNED',
]);

export function isOrderOngoing(order: Pick<CustomerOrder, 'status'>): boolean {
  return ONGOING_PAID_STATUSES.has(order.status);
}

export function isOrderCompleted(order: Pick<CustomerOrder, 'status'>): boolean {
  return COMPLETED_STATUSES.has(order.status);
}

export function isOrderCancelled(order: Pick<CustomerOrder, 'status'>): boolean {
  return CANCELLED_STATUSES.has(order.status);
}

export function isOrderUnpaidOrFailed(order: Pick<CustomerOrder, 'status'>): boolean {
  return UNPAID_OR_FAILED_STATUSES.has(order.status);
}

export function canCancelCustomerOrder(order: Pick<CustomerOrder, 'status'>): boolean {
  return CANCELLABLE_STATUSES.has(order.status);
}

export function filterOrdersByTab(orders: readonly CustomerOrder[], tab: OrderTab): CustomerOrder[] {
  if (tab === 'ongoing') return orders.filter(isOrderOngoing);
  if (tab === 'completed') return orders.filter(isOrderCompleted);
  return orders.filter(isOrderCancelled);
}

export function filterHistoryOrders(orders: readonly CustomerOrder[], filter: HistoryFilter): CustomerOrder[] {
  if (filter === 'all') return [...orders];
  if (filter === 'ongoing') return orders.filter(isOrderOngoing);
  if (filter === 'unpaid') return orders.filter(isOrderUnpaidOrFailed);
  if (filter === 'completed') return orders.filter(isOrderCompleted);
  return orders.filter(isOrderCancelled);
}

export function getOrderTabCounts(orders: readonly CustomerOrder[]): Record<OrderTab, number> {
  let ongoing = 0;
  let completed = 0;
  let cancelled = 0;
  for (const order of orders) {
    if (isOrderOngoing(order)) ongoing += 1;
    else if (isOrderCompleted(order)) completed += 1;
    else if (isOrderCancelled(order)) cancelled += 1;
  }
  return { ongoing, completed, cancelled };
}

export function getOrderProgressStep(status: string): number {
  switch (status) {
    case 'CONFIRMED':
    case 'ACCEPTED_BY_VENDOR':
      return 1;
    case 'PREPARING':
    case 'READY_FOR_PICKUP':
      return 2;
    case 'RIDER_ASSIGNED':
      return 3;
    case 'PICKED_UP':
    case 'DELIVERED':
      return 4;
    default:
      return 0;
  }
}

export function formatCustomerOrderStatus(order: Pick<CustomerOrder, 'status' | 'delivery'>): string {
  const waitingRider = order.status === 'READY_FOR_PICKUP'
    && ['UNASSIGNED', 'OFFERING'].includes(order.delivery?.status ?? '');
  if (waitingRider) return 'Finding a rider';

  const labels: Record<string, string> = {
    PENDING_PAYMENT: 'Payment due',
    PAYMENT_FAILED: 'Payment failed',
    CONFIRMED: 'Order paid · awaiting kitchen',
    ACCEPTED_BY_VENDOR: 'Kitchen confirmed',
    PREPARING: 'Preparing order',
    READY_FOR_PICKUP: 'Ready for pickup',
    RIDER_ASSIGNED: 'Rider assigned',
    PICKED_UP: 'On the way',
    DELIVERED: 'Delivered',
    REJECTED: 'Order rejected',
    CANCELLED: 'Cancelled',
    REFUND_PENDING: 'Refund pending',
    REFUNDED: 'Refunded',
    DELIVERY_EXCEPTION: 'Needs attention',
  };

  return labels[order.status] ?? order.status.replace(/_/g, ' ').toLowerCase();
}
