export type PaystackWebhookDvaPayload = {
  customerCode: string | null;
  dvaId: string | null;
  accountNumber: string | null;
  accountName: string | null;
  bankName: string | null;
  bankSlug: string | null;
};

export type PaystackWebhookRefundPayload = {
  transactionReference: string | null;
  refundReference: string | null;
  amountMinor: number | null;
  status: string;
};

export type CustomerPaymentRecord = {
  id: string;
  amountMinor: number;
  status: string;
  provider: string;
  providerReference?: string | null;
  isDemo: boolean;
  createdAt: Date | string;
  order?: {
    id?: string | null;
    displayNumber?: number | null;
    vendor?: { name?: string | null } | null;
  } | null;
};

export type CustomerWalletLedgerRecord = {
  id: string;
  type: string;
  direction: string;
  status: string;
  amountMinor: number;
  balanceAfter: number;
  reference: string;
  orderId: string | null;
  metadata?: unknown;
  createdAt: Date | string;
  order?: {
    id?: string | null;
    displayNumber?: number | null;
    vendor?: { name?: string | null } | null;
  } | null;
};

export type CustomerActivityItem = {
  id: string;
  amountMinor: number;
  status: string;
  provider: string;
  direction: 'CREDIT' | 'DEBIT';
  type: string;
  title: string;
  subtitle: string | null;
  isDemo: boolean;
  createdAt: string;
  order: {
    id: string;
    displayNumber?: number | null;
    vendor?: { name?: string | null } | null;
  } | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Extracts dedicated virtual account fields from Paystack `dedicatedaccount.assign.*` webhook data. */
export function parsePaystackWebhookDva(data: unknown): PaystackWebhookDvaPayload {
  const root = asRecord(data);
  const customer = asRecord(root.customer);
  const dedicated = asRecord(root.dedicated_account);
  const bank = asRecord(dedicated.bank);
  const rawId = dedicated.id ?? root.id;
  return {
    customerCode: asString(customer.customer_code) ?? asString(root.customer_code),
    dvaId: typeof rawId === 'string' || typeof rawId === 'number' ? String(rawId) : null,
    accountNumber: asString(dedicated.account_number) ?? asString(root.account_number),
    accountName: asString(dedicated.account_name) ?? asString(root.account_name),
    bankName: asString(bank.name),
    bankSlug: asString(bank.slug),
  };
}

/** Extracts transaction reference and status from Paystack `refund.*` webhook data. */
export function parsePaystackWebhookRefund(data: unknown): PaystackWebhookRefundPayload {
  const root = asRecord(data);
  const transaction = asRecord(root.transaction);
  const rawAmount = root.amount;
  const amountMinor = typeof rawAmount === 'number' && Number.isSafeInteger(rawAmount) ? rawAmount : null;
  return {
    transactionReference:
      asString(root.transaction_reference)
      ?? asString(transaction.reference)
      ?? asString(root.reference),
    refundReference: asString(root.refund_reference) ?? asString(root.reference),
    amountMinor,
    status: (asString(root.status) ?? '').toLowerCase(),
  };
}

/** Whether an order in the given status can initiate or retry payment. */
export function shouldAllowOrderPayment(status: string): boolean {
  return status === 'PENDING_PAYMENT' || status === 'PAYMENT_FAILED';
}

/** Whether an order is already in a cancelled/rejected/refund lifecycle state. */
export function isCancelledOrRefundOrderStatus(status: string): boolean {
  return status === 'CANCELLED' || status === 'REJECTED' || status === 'REFUND_PENDING' || status === 'REFUNDED';
}

/** Maps wallet ledger records and order payments into a deduplicated activity feed compatible with customer UIs. */
export function buildCustomerWalletActivity(
  payments: readonly CustomerPaymentRecord[],
  walletTransactions: readonly CustomerWalletLedgerRecord[],
  limit = 100,
): CustomerActivityItem[] {
  const paymentBackedOrderRefs = new Set<string>();
  const refundedOrderIds = new Set<string>();

  for (const payment of payments) {
    if (payment.providerReference) paymentBackedOrderRefs.add(payment.providerReference);
    if (payment.status.toUpperCase() === 'REFUNDED' && payment.order?.id) {
      refundedOrderIds.add(payment.order.id);
    }
  }

  const items: CustomerActivityItem[] = payments.map((payment) => {
    const status = payment.status.toUpperCase();
    const refunded = status === 'REFUNDED';
    return {
      id: payment.id,
      amountMinor: payment.amountMinor,
      status: payment.status,
      provider: payment.provider,
      direction: refunded ? 'CREDIT' : 'DEBIT',
      type: refunded ? 'REFUND' : 'ORDER_PAYMENT',
      title: payment.order?.vendor?.name ?? 'Smile order',
      subtitle: null,
      isDemo: payment.isDemo,
      createdAt: new Date(payment.createdAt).toISOString(),
      order: payment.order?.id
        ? {
            id: payment.order.id,
            displayNumber: payment.order.displayNumber ?? null,
            vendor: payment.order.vendor?.name ? { name: payment.order.vendor.name } : null,
          }
        : null,
    };
  });

  for (const tx of walletTransactions) {
    // Avoid duplicating order debits already represented by Payment rows (`wallet_order_<orderId>`).
    if (tx.type === 'ORDER_PAYMENT' && paymentBackedOrderRefs.has(tx.reference)) continue;
    // Avoid duplicating order refunds already represented by a REFUNDED Payment row for the same order.
    if (tx.type === 'REFUND' && tx.orderId && refundedOrderIds.has(tx.orderId)) continue;

    const meta = asRecord(tx.metadata);
    const channel = asString(meta.channel);
    const isDva = channel === 'dedicated_nuban';
    const provider = tx.type === 'TOPUP' ? (isDva ? 'bank_transfer' : 'paystack') : 'wallet';
    const title =
      tx.type === 'TOPUP'
        ? isDva
          ? 'Bank transfer deposit'
          : 'Wallet top-up'
        : tx.type === 'REFUND'
          ? tx.order?.vendor?.name
            ? `Refund · ${tx.order.vendor.name}`
            : 'Order refund'
          : tx.type === 'ORDER_EARNING'
            ? 'Order earning'
            : tx.type === 'DELIVERY_EARNING'
              ? 'Delivery earning'
              : tx.type === 'WITHDRAWAL'
                ? 'Bank withdrawal'
                : tx.type === 'WITHDRAWAL_REVERSAL'
                  ? 'Withdrawal returned'
                  : 'Wallet adjustment';

    items.push({
      id: tx.id,
      amountMinor: tx.amountMinor,
      status: tx.type === 'REFUND' && tx.status === 'SUCCEEDED' ? 'REFUNDED' : tx.status,
      provider,
      direction: tx.direction === 'CREDIT' ? 'CREDIT' : 'DEBIT',
      type: tx.type,
      title,
      subtitle: channel ? channel.replace(/_/g, ' ') : null,
      isDemo: false,
      createdAt: new Date(tx.createdAt).toISOString(),
      order: tx.order?.id
        ? {
            id: tx.order.id,
            displayNumber: tx.order.displayNumber ?? null,
            vendor: tx.order.vendor?.name ? { name: tx.order.vendor.name } : null,
          }
        : null,
    });
  }

  return items
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}
