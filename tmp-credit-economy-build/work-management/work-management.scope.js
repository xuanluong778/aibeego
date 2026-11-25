"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORK_EMPLOYEE_LINK_REQUIRED_MSG = void 0;
exports.isWorkOrgWideRole = isWorkOrgWideRole;
exports.canManageAnyTask = canManageAnyTask;
exports.resolveLinkedEmployeeId = resolveLinkedEmployeeId;
exports.resolveWorkScope = resolveWorkScope;
exports.workTaskVisibilityWhere = workTaskVisibilityWhere;
exports.assertCanWriteTask = assertCanWriteTask;
const common_1 = require("@nestjs/common");
const roles_1 = require("../common/constants/roles");
const hrm_attendance_scope_1 = require("../hrm/hrm-attendance-scope");
/**
 * Super Admin / OWNER / HR → org-wide.
 * MANAGER (Trưởng phòng) → self + reports tree.
 * Nhân viên khác → related tasks only (self employeeId).
 */
function isWorkOrgWideRole(role) {
    return (0, hrm_attendance_scope_1.isHrmOrgWideRole)(role) || role === 'SUPER_ADMIN';
}
function canManageAnyTask(role) {
    return isWorkOrgWideRole(role) || role === roles_1.SYSTEM_ROLES.MANAGER;
}
/**
 * Lấy employeeId cho thao tác giao việc: User.employeeId hoặc khớp email HRM (tùy chọn ghi vào User).
 */
async function resolveLinkedEmployeeId(prisma, organizationId, user, opts) {
    if (user.employeeId)
        return user.employeeId;
    if (!user.email?.trim())
        return null;
    const emp = await prisma.employee.findFirst({
        where: {
            organizationId,
            email: { equals: user.email.trim(), mode: 'insensitive' },
            isActive: true,
        },
        select: { id: true },
    });
    if (!emp)
        return null;
    if (opts?.persistUserLink) {
        await prisma.user.updateMany({
            where: { id: user.id, organizationId, employeeId: null },
            data: { employeeId: emp.id },
        });
    }
    return emp.id;
}
exports.WORK_EMPLOYEE_LINK_REQUIRED_MSG = 'Tài khoản đăng nhập chưa gắn hồ sơ nhân viên (HRM). Trong HRM, đặt email nhân viên trùng email đăng nhập, hoặc gán nhân viên cho tài khoản trong phần thành viên/tổ chức.';
async function resolveWorkScope(prisma, organizationId, user) {
    if (isWorkOrgWideRole(user.role)) {
        return { mode: 'all' };
    }
    return (0, hrm_attendance_scope_1.resolveHrmAccessScope)(prisma, organizationId, user);
}
/** Prisma where: task visible to user under scope. */
function workTaskVisibilityWhere(scope, user) {
    if (scope.mode === 'all') {
        return {};
    }
    const ids = scope.employeeIds;
    if (!ids.length) {
        // No employee link → only empty (staff with no employeeId sees nothing unless they create as null)
        return {
            OR: [
                ...(user.employeeId
                    ? [
                        { createdById: user.employeeId },
                        { assignerId: user.employeeId },
                        { assignees: { some: { employeeId: user.employeeId } } },
                        { watchers: { some: { employeeId: user.employeeId } } },
                    ]
                    : [{ id: '__none__' }]),
            ],
        };
    }
    // Manager/staff: related if any linked person is in scope
    return {
        OR: [
            { createdById: { in: ids } },
            { assignerId: { in: ids } },
            { assignees: { some: { employeeId: { in: ids } } } },
            { watchers: { some: { employeeId: { in: ids } } } },
        ],
    };
}
function assertCanWriteTask(user, task, scope) {
    if (canManageAnyTask(user.role)) {
        if (scope.mode === 'all')
            return;
        // Manager: task must touch someone in management scope (incl. self)
        const related = [
            task.createdById,
            task.assignerId,
            ...task.assigneeIds,
            ...task.watcherIds,
        ].filter(Boolean);
        if (related.some((id) => scope.employeeIds.includes(id)))
            return;
        throw new common_1.ForbiddenException('Không có quyền sửa công việc ngoài phạm vi quản lý');
    }
    // Staff: must be related personally
    const me = user.employeeId;
    if (!me)
        throw new common_1.ForbiddenException('Tài khoản chưa gắn nhân viên');
    if (task.createdById === me ||
        task.assignerId === me ||
        task.assigneeIds.includes(me) ||
        task.watcherIds.includes(me)) {
        return;
    }
    throw new common_1.ForbiddenException('Bạn chỉ được sửa công việc liên quan đến mình');
}
