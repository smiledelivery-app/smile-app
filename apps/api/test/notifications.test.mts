import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPushPayloads, expoPushPayload, notificationCopy } from '../src/notifications.ts';

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

test('push batches preserve every notification for every device belonging to a user',()=>{
  const notifications=[
    {id:'notice-1',userId:'user-1',title:'Order accepted',body:'Order accepted.',type:'ORDER',orderId:'order-1'},
    {id:'notice-2',userId:'user-1',title:'Rider assigned',body:'Rider assigned.',type:'ORDER',orderId:'order-1'},
    {id:'notice-3',userId:'user-2',title:'Order ready',body:'Order ready.',type:'ORDER',orderId:'order-2'},
  ];
  const devices=[
    {id:'device-1',userId:'user-1',token:'ExpoPushToken[one]'},
    {id:'device-2',userId:'user-1',token:'ExpoPushToken[two]'},
    {id:'device-3',userId:'user-2',token:'ExpoPushToken[three]'},
  ];

  const payloads=buildPushPayloads(notifications,devices);
  assert.deepEqual(payloads.map(({deviceId,data})=>[deviceId,data.notificationId]),[
    ['device-1','notice-1'],
    ['device-1','notice-2'],
    ['device-2','notice-1'],
    ['device-2','notice-2'],
    ['device-3','notice-3'],
  ]);
});
