export type AccountDeletionCheckInput = {
  isAdmin: boolean;
  activeVendorOrders: number;
  activeRiderDeliveries: number;
  pendingWithdrawals: number;
};

export type AccountDeletionPrecheckError = {
  status: 409;
  code: 'ADMIN_ACCOUNT' | 'ACTIVE_ORDERS' | 'ACTIVE_DELIVERIES' | 'PENDING_WITHDRAWAL';
  message: string;
};

/** Validates whether an authenticated account may self-delete before anonymization. */
export function accountDeletionPrecheckError(input: AccountDeletionCheckInput): AccountDeletionPrecheckError | null {
  if (input.isAdmin) {
    return {
      status: 409,
      code: 'ADMIN_ACCOUNT',
      message: 'Contact a super administrator to close an administrator account.',
    };
  }
  if (input.activeVendorOrders > 0) {
    return {
      status: 409,
      code: 'ACTIVE_ORDERS',
      message: 'Complete or cancel active store orders before deleting your account.',
    };
  }
  if (input.activeRiderDeliveries > 0) {
    return {
      status: 409,
      code: 'ACTIVE_DELIVERIES',
      message: 'Complete or cancel active deliveries before deleting your account.',
    };
  }
  if (input.pendingWithdrawals > 0) {
    return {
      status: 409,
      code: 'PENDING_WITHDRAWAL',
      message: 'Wait for pending wallet withdrawals to finish before deleting your account.',
    };
  }
  return null;
}
