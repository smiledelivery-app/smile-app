import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canCancelCustomerOrder,
  filterHistoryOrders,
  filterOrdersByTab,
  formatCustomerOrderStatus,
  getOrderProgressStep,
  getOrderTabCounts,
} from '../src/utils/orders.ts';

const sampleOrders = [
  { id: 'ord-pending', status: 'PENDING_PAYMENT', totalMinor: 250000, createdAt: '2026-11-24T10:00:00Z', items: [] },
  { id: 'ord-failed', status: 'PAYMENT_FAILED', totalMinor: 250000, createdAt: '2026-11-24T09:50:00Z', items: [] },
  { id: 'ord-confirmed', status: 'CONFIRMED', totalMinor: 350000, createdAt: '2026-11-24T09:40:00Z', items: [] },
  { id: 'ord-preparing', status: 'PREPARING', totalMinor: 350000, createdAt: '2026-11-24T09:30:00Z', items: [] },
  { id: 'ord-picked-up', status: 'PICKED_UP', totalMinor: 420000, createdAt: '2026-11-24T09:20:00Z', items: [] },
  { id: 'ord-delivered', status: 'DELIVERED', totalMinor: 420000, createdAt: '2026-11-24T09:10:00Z', items: [] },
  { id: 'ord-cancelled', status: 'CANCELLED', totalMinor: 190000, createdAt: '2026-11-24T09:00:00Z', items: [] },
  { id: 'ord-rejected', status: 'REJECTED', totalMinor: 190000, createdAt: '2026-11-24T08:50:00Z', items: [] },
  { id: 'ord-refunded', status: 'REFUNDED', totalMinor: 190000, createdAt: '2026-11-24T08:40:00Z', items: [] },
] as const;

test('ongoing tab includes only paid orders not yet delivered or cancelled', () => {
  const ongoing = filterOrdersByTab(sampleOrders as never, 'ongoing').map(order => order.id);
  assert.deepEqual(ongoing, ['ord-confirmed', 'ord-preparing', 'ord-picked-up']);
});

test('completed and cancelled tabs partition delivered and cancelled/rejected/refunded orders', () => {
  assert.deepEqual(
    filterOrdersByTab(sampleOrders as never, 'completed').map(order => order.id),
    ['ord-delivered'],
  );
  assert.deepEqual(
    filterOrdersByTab(sampleOrders as never, 'cancelled').map(order => order.id),
    ['ord-cancelled', 'ord-rejected', 'ord-refunded'],
  );
  assert.deepEqual(getOrderTabCounts(sampleOrders as never), {
    ongoing: 3,
    completed: 1,
    cancelled: 3,
  });
});

test('history includes all initiated orders including unpaid and failed payments', () => {
  assert.equal(filterHistoryOrders(sampleOrders as never, 'all').length, sampleOrders.length);
  assert.deepEqual(
    filterHistoryOrders(sampleOrders as never, 'unpaid').map(order => order.id),
    ['ord-pending', 'ord-failed'],
  );
});

test('progress step, cancellation eligibility, and status labels reflect payment and delivery state', () => {
  assert.equal(getOrderProgressStep('PENDING_PAYMENT'), 0);
  assert.equal(getOrderProgressStep('CONFIRMED'), 1);
  assert.equal(getOrderProgressStep('PICKED_UP'), 4);
  assert.equal(canCancelCustomerOrder({ status: 'CONFIRMED' }), true);
  assert.equal(canCancelCustomerOrder({ status: 'PICKED_UP' }), false);
  assert.equal(
    formatCustomerOrderStatus({ status: 'READY_FOR_PICKUP', delivery: { status: 'OFFERING', assignedAt: null, riderName: null } }),
    'Finding a rider',
  );
  assert.equal(
    formatCustomerOrderStatus({ status: 'CANCELLED', delivery: null }),
    'Cancelled',
  );
});
