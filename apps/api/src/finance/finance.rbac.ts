/**
 * RBAC Tài chính spa — assert luôn 403, không phụ thuộc shadow mode.
 * Không suy ra từ order.write hay sales.payment.* (bộ Bán hàng giữ nguyên).
 */
import { ForbiddenException } from '@nestjs/common';
import { SYSTEM_ROLES } from '../common/constants/roles';
import type { AuthUser } from '../common/interfaces/auth-user.interface';

export const FINANCE_PERMISSIONS = {
  read: 'finance.read',
  orderManage: 'finance.order.manage',
  paymentRecord: 'finance.payment.record',
  paymentRefund: 'finance.payment.refund',
  expenseManage: 'finance.expense.manage',
} as const;

function isPrivileged(user: AuthUser) {
  return user.role === SYSTEM_ROLES.OWNER || user.role === 'SUPER_ADMIN';
}

function assertFinance(user: AuthUser, code: string) {
  if (isPrivileged(user)) return;
  if (!user.permissions?.includes(code)) {
    throw new ForbiddenException(`Thiếu quyền: ${code}`);
  }
}

export function assertFinanceRead(user: AuthUser) {
  assertFinance(user, FINANCE_PERMISSIONS.read);
}

export function assertFinanceOrderManage(user: AuthUser) {
  assertFinance(user, FINANCE_PERMISSIONS.orderManage);
}

export function assertFinancePaymentRecord(user: AuthUser) {
  assertFinance(user, FINANCE_PERMISSIONS.paymentRecord);
}

export function assertFinancePaymentRefund(user: AuthUser) {
  assertFinance(user, FINANCE_PERMISSIONS.paymentRefund);
}

export function assertFinanceExpenseManage(user: AuthUser) {
  assertFinance(user, FINANCE_PERMISSIONS.expenseManage);
}
