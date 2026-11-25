/**
 * Cấp / đổi role — luôn 403, không phụ thuộc HRM_PERMISSIONS_ENFORCE.
 * hrm.employee.write chỉ sửa hồ sơ. hrm.role.assign mới được đổi role,
 * và không được vượt hạng của người thao tác hay tự nâng quyền.
 */
import { ForbiddenException } from '@nestjs/common';
import { canonicalizeRoleCode, SYSTEM_ROLES } from '../common/constants/roles';
import type { AuthUser } from '../common/interfaces/auth-user.interface';

export const HRM_ROLE_ASSIGN_PERMISSION = 'hrm.role.assign';
export const HRM_ACCOUNT_MANAGE_PERMISSION = 'hrm.account.manage';

const RANK: Record<string, number> = {
  SUPER_ADMIN: 100,
  [SYSTEM_ROLES.OWNER]: 100,
  [SYSTEM_ROLES.MANAGER]: 80,
  [SYSTEM_ROLES.HR]: 60,
  [SYSTEM_ROLES.MARKETING]: 40,
  [SYSTEM_ROLES.SALE]: 40,
  [SYSTEM_ROLES.TECHNICIAN]: 40,
};

export function roleAuthorityRank(code: string | null | undefined): number {
  if (!code) return 0;
  const canonical = canonicalizeRoleCode(code);
  return RANK[canonical] ?? 40;
}

export function roleCodesEqual(current: string | null | undefined, next: string | null | undefined) {
  if (!current || !next) return false;
  return canonicalizeRoleCode(current) === canonicalizeRoleCode(next);
}

function isPrivileged(user: AuthUser) {
  return user.role === SYSTEM_ROLES.OWNER || user.role === 'SUPER_ADMIN';
}

export function assertCanAssignRole(
  actor: AuthUser,
  input: {
    organizationId: string;
    targetUserId?: string | null;
    targetRoleCode?: string | null;
    nextRoleCode: string;
  },
) {
  if (!actor?.organizationId || actor.organizationId !== input.organizationId) {
    throw new ForbiddenException('Không có quyền cấp role ngoài tổ chức của mình');
  }
  if (!isPrivileged(actor) && !actor.permissions?.includes(HRM_ROLE_ASSIGN_PERMISSION)) {
    throw new ForbiddenException(`Thiếu quyền: ${HRM_ROLE_ASSIGN_PERMISSION}`);
  }

  const actorRank = roleAuthorityRank(actor.role);
  const nextRank = roleAuthorityRank(input.nextRoleCode);
  const currentRank = roleAuthorityRank(input.targetRoleCode);

  if (currentRank > actorRank) {
    throw new ForbiddenException('Không được đổi role của tài khoản cao hơn thẩm quyền');
  }
  if (nextRank > actorRank) {
    throw new ForbiddenException('Không được cấp role vượt thẩm quyền');
  }
  if (input.targetUserId && input.targetUserId === actor.id && nextRank > currentRank) {
    throw new ForbiddenException('Không được tự nâng quyền');
  }
}

/** Đặt lại mật khẩu — luôn 403 khi thiếu quyền hoặc tài khoản đích cao hơn thẩm quyền. */
export function assertCanResetEmployeePassword(
  actor: AuthUser,
  input: {
    organizationId: string;
    targetUserId: string;
    targetRoleCode?: string | null;
  },
) {
  if (!actor?.organizationId || actor.organizationId !== input.organizationId) {
    throw new ForbiddenException('Không có quyền thao tác ngoài tổ chức của mình');
  }
  if (!isPrivileged(actor) && !actor.permissions?.includes(HRM_ACCOUNT_MANAGE_PERMISSION)) {
    throw new ForbiddenException(`Thiếu quyền: ${HRM_ACCOUNT_MANAGE_PERMISSION}`);
  }
  const actorRank = roleAuthorityRank(actor.role);
  const targetRank = roleAuthorityRank(input.targetRoleCode);
  if (targetRank > actorRank) {
    throw new ForbiddenException('Không được đặt lại mật khẩu tài khoản cao hơn thẩm quyền');
  }
}
