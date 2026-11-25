import test from 'node:test';
import assert from 'node:assert/strict';
import { accountDeletionPrecheckError } from '../src/account-deletion.ts';
import { isAdminRole } from '../src/admin-permissions.ts';

test('account deletion allows customer, vendor, and rider accounts with no active work', () => {
  assert.equal(
    accountDeletionPrecheckError({
      isAdmin: ['CUSTOMER', 'VENDOR'].some(isAdminRole),
      activeVendorOrders: 0,
      activeRiderDeliveries: 0,
      pendingWithdrawals: 0,
    }),
    null,
  );
  assert.equal(
    accountDeletionPrecheckError({
      isAdmin: ['RIDER'].some(isAdminRole),
      activeVendorOrders: 0,
      activeRiderDeliveries: 0,
      pendingWithdrawals: 0,
    }),
    null,
  );
});

test('account deletion blocks administrator accounts and active orders, deliveries, or withdrawals', () => {
  assert.deepEqual(
    accountDeletionPrecheckError({
      isAdmin: ['ADMIN'].some(isAdminRole),
      activeVendorOrders: 0,
      activeRiderDeliveries: 0,
      pendingWithdrawals: 0,
    })?.code,
    'ADMIN_ACCOUNT',
  );
  assert.deepEqual(
    accountDeletionPrecheckError({
      isAdmin: ['CUSTOMER', 'VENDOR'].some(isAdminRole),
      activeVendorOrders: 2,
      activeRiderDeliveries: 0,
      pendingWithdrawals: 0,
    })?.code,
    'ACTIVE_ORDERS',
  );
  assert.deepEqual(
    accountDeletionPrecheckError({
      isAdmin: ['RIDER'].some(isAdminRole),
      activeVendorOrders: 0,
      activeRiderDeliveries: 1,
      pendingWithdrawals: 0,
    })?.code,
    'ACTIVE_DELIVERIES',
  );
  assert.deepEqual(
    accountDeletionPrecheckError({
      isAdmin: ['VENDOR'].some(isAdminRole),
      activeVendorOrders: 0,
      activeRiderDeliveries: 0,
      pendingWithdrawals: 1,
    })?.code,
    'PENDING_WITHDRAWAL',
  );
});
