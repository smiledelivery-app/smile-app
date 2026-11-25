import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterVendorHistoryOrders,
  filterVendorOrdersByTab,
  getVendorOrderProgressStep,
  getVendorOrderTabCounts,
} from '../src/utils/vendor-orders.ts';

const sampleOrders = [
  { id: 'v-incoming-1', status: 'CONFIRMED', totalMinor: 250000, createdAt: '2026-11-24T09:00:00Z', items: [], events: [] },
  { id: 'v-accepted-1', status: 'ACCEPTED_BY_VENDOR', totalMinor: 350000, createdAt: '2026-11-24T09:10:00Z', items: [], events: [] },
  { id: 'v-preparing-1', status: 'PREPARING', totalMinor: 380000, createdAt: '2026-11-24T09:20:00Z', items: [], events: [] },
  { id: 'v-ready-1', status: 'READY_FOR_PICKUP', totalMinor: 410000, createdAt: '2026-11-24T09:30:00Z', items: [], events: [] },
  { id: 'v-assigned-1', status: 'RIDER_ASSIGNED', totalMinor: 410000, createdAt: '2026-11-24T09:35:00Z', items: [], events: [] },
  { id: 'v-picked-1', status: 'PICKED_UP', totalMinor: 410000, createdAt: '2026-11-24T09:40:00Z', items: [], events: [] },
  { id: 'v-completed-1', status: 'DELIVERED', totalMinor: 450000, createdAt: '2026-11-24T08:00:00Z', items: [], events: [] },
  { id: 'v-completed-2', status: 'DELIVERED', totalMinor: 520000, createdAt: '2026-11-24T10:00:00Z', items: [], events: [] },
  { id: 'v-rejected-1', status: 'REJECTED', totalMinor: 190000, createdAt: '2026-11-24T09:50:00Z', items: [], events: [] },
  { id: 'v-cancelled-1', status: 'CANCELLED', totalMinor: 190000, createdAt: '2026-11-24T09:45:00Z', items: [], events: [] },
] as const;

test('vendor order tabs separate incoming, accepted/in-progress, and completed orders', () => {
  assert.deepEqual(
    filterVendorOrdersByTab(sampleOrders as never, 'incoming').map(order => order.id),
    ['v-incoming-1'],
  );
  assert.deepEqual(
    filterVendorOrdersByTab(sampleOrders as never, 'accepted').map(order => order.id),
    ['v-accepted-1', 'v-preparing-1', 'v-ready-1', 'v-assigned-1', 'v-picked-1'],
  );
  assert.deepEqual(
    filterVendorOrdersByTab(sampleOrders as never, 'completed').map(order => order.id),
    ['v-completed-2', 'v-completed-1'],
  );
  assert.deepEqual(getVendorOrderTabCounts(sampleOrders as never), {
    incoming: 1,
    accepted: 5,
    completed: 2,
  });
});

test('vendor order history shows all store orders newest-first including rejected and cancelled', () => {
  const all = filterVendorHistoryOrders(sampleOrders as never, 'all');
  assert.equal(all.length, sampleOrders.length);
  assert.equal(all[0]?.id, 'v-completed-2');
  assert.deepEqual(
    filterVendorHistoryOrders(sampleOrders as never, 'declined').map(order => order.id),
    ['v-rejected-1', 'v-cancelled-1'],
  );
});

test('vendor progress steps reflect accepted through picked-up stages', () => {
  assert.equal(getVendorOrderProgressStep('CONFIRMED'), 0);
  assert.equal(getVendorOrderProgressStep('ACCEPTED_BY_VENDOR'), 1);
  assert.equal(getVendorOrderProgressStep('PREPARING'), 2);
  assert.equal(getVendorOrderProgressStep('READY_FOR_PICKUP'), 3);
  assert.equal(getVendorOrderProgressStep('PICKED_UP'), 4);
});
