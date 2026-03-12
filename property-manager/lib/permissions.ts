export type AppRole = 'operator' | 'tenant' | 'vendor';

export type PermissionAction =
  | 'property:read'
  | 'property:write'
  | 'unit:read'
  | 'unit:write'
  | 'request:read'
  | 'request:write'
  | 'request:assignVendor'
  | 'request:addInternalNote'
  | 'request:addTenantUpdate'
  | 'reporting:read';

const rolePermissions: Record<AppRole, PermissionAction[]> = {
  operator: [
    'property:read',
    'property:write',
    'unit:read',
    'unit:write',
    'request:read',
    'request:write',
    'request:assignVendor',
    'request:addInternalNote',
    'request:addTenantUpdate',
    'reporting:read',
  ],
  tenant: ['request:read'],
  vendor: ['request:read'],
};

export function can(role: AppRole, action: PermissionAction): boolean {
  return rolePermissions[role].includes(action);
}

export function assertCan(role: AppRole, action: PermissionAction): void {
  if (!can(role, action)) {
    throw new Error(`${role} cannot perform ${action}`);
  }
}

export function visibleEventScopes(role: AppRole): Array<'internal' | 'tenant' | 'vendor' | 'all'> {
  if (role === 'operator') return ['internal', 'tenant', 'vendor', 'all'];
  if (role === 'tenant') return ['tenant', 'all'];
  return ['vendor', 'all'];
}
