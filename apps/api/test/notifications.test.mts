import test from 'node:test';
import assert from 'node:assert/strict';
import { expoPushPayload, notificationCopy } from '../src/notifications.ts';

test('order notification copy identifies the order and next action', () => {
  assert.deepEqual(notificationCopy('CONFIRMED', 'order-12345678', 'Green Kitchen'), {
    title: 'Order received',
    body: 'Green Kitchen has received order #12345678.',
  });
  assert.equal(notificationCopy('PAYMENT_FAILED', 'order-12345678', 'Green Kitchen').title, 'Payment failed');
});

test('Expo push payload carries the inbox notification and optional order link', () => {
  assert.deepEqual(expoPushPayload({
    id: 'notice-1',
    title: 'Order ready',
    body: 'Your order is ready.',
    type: 'ORDER_READY_FOR_PICKUP',
    orderId: 'order-1',
  }, 'ExpoPushToken[device]'), {
    to: 'ExpoPushToken[device]',
    title: 'Order ready',
    body: 'Your order is ready.',
    sound: 'default',
    data: { notificationId: 'notice-1', type: 'ORDER_READY_FOR_PICKUP', orderId: 'order-1' },
  });
});
