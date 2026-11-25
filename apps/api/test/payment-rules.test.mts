import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaystackRefund, PaystackError, verifyPaystackTransaction } from '../src/paystack.ts';
import {
  buildCustomerWalletActivity,
  isCancelledOrRefundOrderStatus,
  parsePaystackWebhookDva,
  parsePaystackWebhookRefund,
  shouldAllowOrderPayment,
} from '../src/payment-rules.ts';

test('Paystack refund adapter posts minor-unit amount and returns parsed status', async () => {
  let requestUrl = '';
  let requestBody = '';
  const fakeFetch: typeof fetch = async (input, init) => {
    requestUrl = String(input);
    requestBody = String(init?.body);
    return new Response(
      JSON.stringify({
        status: true,
        data: {
          id: 98765,
          status: 'pending',
          amount: 250_000,
          transaction: { reference: 'order_abc_123' },
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };

  const refund = await createPaystackRefund(
    { transactionReference: 'order_abc_123', amountMinor: 250_000, merchantNote: 'Vendor declined order' },
    'sk_test_secret',
    fakeFetch,
  );
  assert.equal(requestUrl, 'https://api.paystack.co/refund');
  assert.match(requestBody, /"transaction":"order_abc_123"/);
  assert.match(requestBody, /"amount":250000/);
  assert.deepEqual(refund, {
    id: '98765',
    status: 'pending',
    amountMinor: 250_000,
    transactionReference: 'order_abc_123',
  });
  await assert.rejects(
    () => createPaystackRefund({ transactionReference: 'order_abc_123', amountMinor: 0 }, 'sk_test_secret', fakeFetch),
    PaystackError,
  );
});

test('Paystack transaction verification validates integer minor-unit amounts and metadata', async () => {
  const fakeFetch: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        status: true,
        data: {
          reference: 'ref_1',
          amount: 150_000,
          status: 'success',
          channel: 'dedicated_nuban',
          metadata: { purpose: 'wallet_topup', userId: 'u_1' },
          customer: { customer_code: 'CUS_123' },
          authorization: { account_number: '9988776655' },
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  const verified = await verifyPaystackTransaction('ref_1', 'sk_test_secret', fakeFetch);
  assert.equal(verified.amountMinor, 150_000);
  assert.equal(verified.channel, 'dedicated_nuban');
  assert.equal(verified.customerCode, 'CUS_123');
  assert.equal(verified.accountNumber, '9988776655');
});

test('Paystack DVA and refund webhook parsers handle nested provider payloads safely', () => {
  assert.deepEqual(
    parsePaystackWebhookDva({
      customer: { customer_code: 'CUS_abc' },
      dedicated_account: {
        id: 42,
        account_number: '1234567890',
        account_name: 'Smile / Ada',
        bank: { name: 'Paystack-Titan', slug: 'titan-paystack' },
      },
    }),
    {
      customerCode: 'CUS_abc',
      dvaId: '42',
      accountNumber: '1234567890',
      accountName: 'Smile / Ada',
      bankName: 'Paystack-Titan',
      bankSlug: 'titan-paystack',
    },
  );

  assert.deepEqual(
    parsePaystackWebhookRefund({
      status: 'processed',
      amount: 320_000,
      transaction_reference: 'order_xyz_1',
      refund_reference: 'rf_1',
    }),
    {
      transactionReference: 'order_xyz_1',
      refundReference: 'rf_1',
      amountMinor: 320_000,
      status: 'processed',
    },
  );
});

test('order payment eligibility and cancellation refund status guards', () => {
  assert.equal(shouldAllowOrderPayment('PENDING_PAYMENT'), true);
  assert.equal(shouldAllowOrderPayment('PAYMENT_FAILED'), true);
  assert.equal(shouldAllowOrderPayment('CONFIRMED'), false);
  assert.equal(shouldAllowOrderPayment('CANCELLED'), false);

  assert.equal(isCancelledOrRefundOrderStatus('CANCELLED'), true);
  assert.equal(isCancelledOrRefundOrderStatus('REJECTED'), true);
  assert.equal(isCancelledOrRefundOrderStatus('REFUND_PENDING'), true);
  assert.equal(isCancelledOrRefundOrderStatus('REFUNDED'), true);
  assert.equal(isCancelledOrRefundOrderStatus('CONFIRMED'), false);
});

test('customer wallet activity merges top-ups and DVA deposits while deduplicating wallet order debits and refunds', () => {
  const activity = buildCustomerWalletActivity(
    [
      {
        id: 'pay-wallet',
        amountMinor: 150_000,
        status: 'REFUNDED',
        provider: 'wallet',
        providerReference: 'wallet_order_ord1',
        isDemo: false,
        createdAt: '2026-11-25T10:00:00.000Z',
        order: { id: 'ord1', displayNumber: 101, vendor: { name: 'Ada Kitchen' } },
      },
      {
        id: 'pay-card',
        amountMinor: 200_000,
        status: 'SUCCEEDED',
        provider: 'paystack',
        providerReference: 'order_ord2_abc',
        isDemo: false,
        createdAt: '2026-11-25T11:00:00.000Z',
        order: { id: 'ord2', displayNumber: 102, vendor: { name: 'Green Bowl' } },
      },
    ],
    [
      {
        id: 'wt-order',
        type: 'ORDER_PAYMENT',
        direction: 'DEBIT',
        status: 'SUCCEEDED',
        amountMinor: 150_000,
        balanceAfter: 50_000,
        reference: 'wallet_order_ord1',
        orderId: 'ord1',
        createdAt: '2026-11-25T10:00:00.000Z',
        order: { id: 'ord1', displayNumber: 101, vendor: { name: 'Ada Kitchen' } },
      },
      {
        id: 'wt-refund',
        type: 'REFUND',
        direction: 'CREDIT',
        status: 'SUCCEEDED',
        amountMinor: 150_000,
        balanceAfter: 200_000,
        reference: 'order_refund_pay-wallet',
        orderId: 'ord1',
        createdAt: '2026-11-25T10:05:00.000Z',
        order: { id: 'ord1', displayNumber: 101, vendor: { name: 'Ada Kitchen' } },
      },
      {
        id: 'wt-topup',
        type: 'TOPUP',
        direction: 'CREDIT',
        status: 'SUCCEEDED',
        amountMinor: 500_000,
        balanceAfter: 500_000,
        reference: 'paystack_dva_1',
        orderId: null,
        metadata: { channel: 'dedicated_nuban' },
        createdAt: '2026-11-25T12:00:00.000Z',
        order: null,
      },
    ],
  );

  assert.equal(activity.length, 3);
  assert.equal(activity[0].id, 'wt-topup');
  assert.equal(activity[0].direction, 'CREDIT');
  assert.equal(activity[0].provider, 'bank_transfer');
  assert.equal(activity[0].title, 'Bank transfer deposit');
  assert.equal(activity[1].id, 'pay-card');
  assert.equal(activity[1].direction, 'DEBIT');
  assert.equal(activity[2].id, 'pay-wallet');
  assert.equal(activity[2].direction, 'CREDIT');
});
