export type AdminPermission =
  | 'dashboard.read'
  | 'orders.read'
  | 'customers.read'
  | 'vendors.read'
  | 'vendors.review'
  | 'riders.read'
  | 'riders.review'
  | 'finance.read'
  | 'audit.read'
  | 'disputes.read'
  | 'disputes.manage'
  | 'sessions.manage'
  | 'admins.manage'
  | 'notifications.send';

const rolePermissions: Record<string, readonly AdminPermission[]> = {
  SUPER_ADMIN: [
    'dashboard.read', 'orders.read', 'customers.read', 'vendors.read',
    'vendors.review', 'riders.read', 'riders.review', 'finance.read',
    'audit.read', 'disputes.read', 'disputes.manage', 'sessions.manage', 'admins.manage', 'notifications.send',
  ],
  OPERATIONS_MANAGER: ['dashboard.read', 'orders.read', 'vendors.read', 'vendors.review', 'riders.read', 'riders.review', 'disputes.read', 'disputes.manage'],
  FINANCE_ADMIN: ['dashboard.read', 'finance.read'],
  CUSTOMER_SUPPORT: ['dashboard.read', 'orders.read', 'customers.read', 'disputes.read', 'disputes.manage'],
  VENDOR_MANAGER: ['dashboard.read', 'vendors.read', 'vendors.review'],
  RIDER_MANAGER: ['dashboard.read', 'riders.read', 'riders.review'],
  MARKETING_MANAGER: ['dashboard.read'],
  ANALYST: ['dashboard.read', 'orders.read', 'finance.read'],
  READ_ONLY_ADMIN: ['dashboard.read', 'orders.read', 'customers.read', 'vendors.read', 'riders.read', 'finance.read', 'audit.read', 'disputes.read'],
};

export function hasAdminPermission(roles: readonly string[], permission: AdminPermission): boolean {
  return roles.includes('ADMIN') || roles.some(role =>
    role === 'SUPER_ADMIN' || rolePermissions[role]?.includes(permission) === true,
  );
}

export function isAdminRole(role: string): boolean {
  return role === 'ADMIN' || Object.prototype.hasOwnProperty.call(rolePermissions, role);
}
