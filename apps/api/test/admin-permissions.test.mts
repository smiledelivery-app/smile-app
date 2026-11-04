import test from 'node:test';
import assert from 'node:assert/strict';
import { hasAdminPermission, isAdminRole } from '../src/admin-permissions.ts';

test('admin roles receive only their configured permissions', () => {
  assert.equal(hasAdminPermission(['FINANCE_ADMIN'], 'finance.read'), true);
  assert.equal(hasAdminPermission(['FINANCE_ADMIN'], 'vendors.review'), false);
  assert.equal(hasAdminPermission(['READ_ONLY_ADMIN'], 'riders.review'), false);
  assert.equal(hasAdminPermission(['CUSTOMER_SUPPORT'], 'customers.read'), true);
  assert.equal(hasAdminPermission(['CUSTOMER_SUPPORT'], 'orders.read'), true);
  assert.equal(hasAdminPermission(['VENDOR_MANAGER'], 'vendors.review'), true);
  assert.equal(hasAdminPermission(['RIDER_MANAGER'], 'riders.review'), true);
  assert.equal(hasAdminPermission(['MARKETING_MANAGER'], 'orders.read'), false);
  assert.equal(hasAdminPermission(['ANALYST'], 'finance.read'), true);
  assert.equal(hasAdminPermission(['OPERATIONS_MANAGER'], 'orders.read'), true);
  assert.equal(hasAdminPermission(['OPERATIONS_MANAGER'], 'disputes.manage'), true);
  assert.equal(hasAdminPermission(['CUSTOMER_SUPPORT'], 'disputes.manage'), true);
  assert.equal(hasAdminPermission(['READ_ONLY_ADMIN'], 'disputes.read'), true);
  assert.equal(hasAdminPermission(['READ_ONLY_ADMIN'], 'disputes.manage'), false);
  assert.equal(hasAdminPermission(['FINANCE_ADMIN'], 'disputes.read'), false);
  assert.equal(hasAdminPermission(['CUSTOMER'], 'dashboard.read'), false);
});

test('legacy ADMIN remains a super-admin-compatible role', () => {
  assert.equal(hasAdminPermission(['ADMIN'], 'admins.manage'), true);
  assert.equal(isAdminRole('ADMIN'), true);
  assert.equal(isAdminRole('CUSTOMER'), false);
});
