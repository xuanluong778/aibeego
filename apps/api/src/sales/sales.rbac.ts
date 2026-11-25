/**
 * RBAC Bán hàng / Kho — assert luôn 403, không phụ thuộc shadow mode của PermissionsGuard.
 */
import { SYSTEM_ROLES } from '../common/constants/roles';
import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../common/interfaces/auth-user.interface';

export const SALES_ROLE_MAP = {
  Admin: SYSTEM_ROLES.OWNER,
  Manager: SYSTEM_ROLES.MANAGER,
  Staff: SYSTEM_ROLES.SALE,
} as const;

export const SALES_WRITE_ROLE_CODES = [
  SYSTEM_ROLES.OWNER,
  SYSTEM_ROLES.MANAGER,
  SYSTEM_ROLES.SALE,
] as const;

/** Quyền chi tiết + alias legacy */
export const SALES_PERMISSIONS = {
  orderRead: 'order.read',
  orderWrite: 'order.write',
  inventoryRead: 'sales.inventory.read',
  inventoryWrite: 'sales.inventory.write',
  receiveWrite: 'sales.receive.write',
  stocktakeWrite: 'sales.stocktake.write',
  paymentCollect: 'sales.payment.collect',
  paymentRefund: 'sales.payment.refund',
  costView: 'sales.cost.view',
  profitView: 'sales.profit.view',
  reportExport: 'sales.report.export',
  /** @deprecated alias */
  read: 'order.read',
  /** @deprecated alias — nghiệp vụ ghi tổng hợp cũ */
  write: 'order.write',
} as const;

export const SALES_GRANULAR_PERMISSION_CODES = [
  SALES_PERMISSIONS.inventoryRead,
  SALES_PERMISSIONS.inventoryWrite,
  SALES_PERMISSIONS.receiveWrite,
  SALES_PERMISSIONS.stocktakeWrite,
  SALES_PERMISSIONS.paymentCollect,
  SALES_PERMISSIONS.paymentRefund,
  SALES_PERMISSIONS.costView,
  SALES_PERMISSIONS.profitView,
  SALES_PERMISSIONS.reportExport,
] as const;

function isPrivileged(user: AuthUser) {
  return user.role === SYSTEM_ROLES.OWNER || user.role === 'SUPER_ADMIN';
}

function hasCode(user: AuthUser, code: string) {
  return Boolean(user.permissions?.includes(code));
}

/**
 * Chính sách (không alias):
 * - order.read / order.write: chỉ đọc / sửa đơn.
 * - Kho, nhận hàng, kiểm kê, thu, hoàn, giá vốn, lợi nhuận, xuất CSV: từng mã riêng.
 * - OWNER / SUPER_ADMIN bypass.
 * Role SALE/MANAGER nhận mã riêng qua defaultPermissionCodesForRole và
 * scripts/grant-sales-granular-permissions.cjs (không suy từ order.write lúc runtime).
 */

export function canViewSalesCost(user: AuthUser): boolean {
  if (isPrivileged(user)) return true;
  return hasCode(user, SALES_PERMISSIONS.costView);
}

export function canViewSalesProfit(user: AuthUser): boolean {
  if (isPrivileged(user)) return true;
  return hasCode(user, SALES_PERMISSIONS.profitView);
}

export function canExportSalesReport(user: AuthUser): boolean {
  if (isPrivileged(user)) return true;
  return hasCode(user, SALES_PERMISSIONS.reportExport);
}

export function assertSalesOrderRead(user: AuthUser) {
  if (isPrivileged(user)) return;
  if (!hasCode(user, SALES_PERMISSIONS.orderRead)) {
    throw new ForbiddenException(`Thiếu quyền: ${SALES_PERMISSIONS.orderRead}`);
  }
}

export function assertSalesOrderWrite(user: AuthUser) {
  if (isPrivileged(user)) return;
  if (!hasCode(user, SALES_PERMISSIONS.orderWrite)) {
    throw new ForbiddenException(`Thiếu quyền: ${SALES_PERMISSIONS.orderWrite}`);
  }
}

export function assertSalesInventoryRead(user: AuthUser) {
  if (isPrivileged(user)) return;
  if (!hasCode(user, SALES_PERMISSIONS.inventoryRead)) {
    throw new ForbiddenException(`Thiếu quyền: ${SALES_PERMISSIONS.inventoryRead}`);
  }
}

export function assertSalesInventoryWrite(user: AuthUser) {
  if (isPrivileged(user)) return;
  if (!hasCode(user, SALES_PERMISSIONS.inventoryWrite)) {
    throw new ForbiddenException(`Thiếu quyền: ${SALES_PERMISSIONS.inventoryWrite}`);
  }
}

export function assertSalesReceiveWrite(user: AuthUser) {
  if (isPrivileged(user)) return;
  if (!hasCode(user, SALES_PERMISSIONS.receiveWrite)) {
    throw new ForbiddenException(`Thiếu quyền: ${SALES_PERMISSIONS.receiveWrite}`);
  }
}

export function assertSalesStocktakeWrite(user: AuthUser) {
  if (isPrivileged(user)) return;
  if (!hasCode(user, SALES_PERMISSIONS.stocktakeWrite)) {
    throw new ForbiddenException(`Thiếu quyền: ${SALES_PERMISSIONS.stocktakeWrite}`);
  }
}

export function assertSalesPaymentCollect(user: AuthUser) {
  if (isPrivileged(user)) return;
  if (!hasCode(user, SALES_PERMISSIONS.paymentCollect)) {
    throw new ForbiddenException(`Thiếu quyền: ${SALES_PERMISSIONS.paymentCollect}`);
  }
}

export function assertSalesPaymentRefund(user: AuthUser) {
  if (isPrivileged(user)) return;
  if (!hasCode(user, SALES_PERMISSIONS.paymentRefund)) {
    throw new ForbiddenException(`Thiếu quyền: ${SALES_PERMISSIONS.paymentRefund}`);
  }
}

export function assertSalesCostView(user: AuthUser) {
  if (isPrivileged(user)) return;
  if (!hasCode(user, SALES_PERMISSIONS.costView)) {
    throw new ForbiddenException(`Thiếu quyền: ${SALES_PERMISSIONS.costView}`);
  }
}

export function assertSalesProfitView(user: AuthUser) {
  if (isPrivileged(user)) return;
  if (!hasCode(user, SALES_PERMISSIONS.profitView)) {
    throw new ForbiddenException(`Thiếu quyền: ${SALES_PERMISSIONS.profitView}`);
  }
}

export function assertSalesReportExport(user: AuthUser) {
  if (isPrivileged(user)) return;
  if (!hasCode(user, SALES_PERMISSIONS.reportExport)) {
    throw new ForbiddenException(`Thiếu quyền: ${SALES_PERMISSIONS.reportExport}`);
  }
}

/** @deprecated use assertSalesOrderWrite */
export function assertSalesReadPermission(user: AuthUser) {
  assertSalesOrderRead(user);
}

/** @deprecated use assertSalesInventoryWrite or assertSalesOrderWrite */
export function assertSalesWritePermission(user: AuthUser) {
  assertSalesInventoryWrite(user);
}

export function canWriteSales(roleCode: string | undefined | null): boolean {
  if (!roleCode) return false;
  return (SALES_WRITE_ROLE_CODES as readonly string[]).includes(roleCode);
}