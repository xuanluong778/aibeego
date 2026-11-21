/**
 * RBAC Bán hàng / Kho — map nghiệp vụ → role canonical.
 * Admin  = OWNER (bypass PermissionsGuard + full perms)
 * Manager = MANAGER
 * Staff   = SALE
 */
import { SYSTEM_ROLES } from '../common/constants/roles';
import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../common/interfaces/auth-user.interface';

export const SALES_ROLE_MAP = {
  Admin: SYSTEM_ROLES.OWNER,
  Manager: SYSTEM_ROLES.MANAGER,
  Staff: SYSTEM_ROLES.SALE,
} as const;

/** Roles được ghi kho / đơn bán */
export const SALES_WRITE_ROLE_CODES = [
  SYSTEM_ROLES.OWNER,
  SYSTEM_ROLES.MANAGER,
  SYSTEM_ROLES.SALE,
] as const;

export const SALES_PERMISSIONS = {
  read: 'order.read',
  write: 'order.write',
} as const;
export function assertSalesReadPermission(user: AuthUser) {
  if (user.role === SYSTEM_ROLES.OWNER || user.role === 'SUPER_ADMIN') return;
  if (!user.permissions?.includes(SALES_PERMISSIONS.read)) throw new ForbiddenException(`Thiếu quyền: ${SALES_PERMISSIONS.read}`);
}

/** Product writes stay enforced even when the general permissions guard is in shadow mode. */
export function assertSalesWritePermission(user: AuthUser) {
  if (user.role === SYSTEM_ROLES.OWNER || user.role === 'SUPER_ADMIN') return;
  if (!user.permissions?.includes(SALES_PERMISSIONS.write))
    throw new ForbiddenException(`Thiếu quyền: ${SALES_PERMISSIONS.write}`);
}

export function canWriteSales(roleCode: string | undefined | null): boolean {
  if (!roleCode) return false;
  return (SALES_WRITE_ROLE_CODES as readonly string[]).includes(roleCode);
}
