"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isHrmOrgWideRole = isHrmOrgWideRole;
exports.isAttendanceOrgWideRole = isAttendanceOrgWideRole;
exports.canCorrectAttendanceDay = canCorrectAttendanceDay;
exports.canApproveLeaveOt = canApproveLeaveOt;
exports.resolveHrmAccessScope = resolveHrmAccessScope;
exports.resolveAttendanceScope = resolveAttendanceScope;
exports.assertEmployeeInScope = assertEmployeeInScope;
exports.assertCanPunchForEmployee = assertCanPunchForEmployee;
exports.assertCanCreateLeaveOt = assertCanCreateLeaveOt;
exports.assertCanApproveLeaveOt = assertCanApproveLeaveOt;
const common_1 = require("@nestjs/common");
const roles_1 = require("../common/constants/roles");
/** OWNER / HR xem toàn org; MANAGER xem cây cấp dưới; còn lại chỉ bản thân. */
function isHrmOrgWideRole(role) {
    return role === roles_1.SYSTEM_ROLES.OWNER || role === roles_1.SYSTEM_ROLES.HR;
}
/** @deprecated */
function isAttendanceOrgWideRole(role) {
    return isHrmOrgWideRole(role);
}
function canCorrectAttendanceDay(role) {
    return role === roles_1.SYSTEM_ROLES.OWNER || role === roles_1.SYSTEM_ROLES.HR;
}
function canApproveLeaveOt(role) {
    return (role === roles_1.SYSTEM_ROLES.OWNER ||
        role === roles_1.SYSTEM_ROLES.HR ||
        role === roles_1.SYSTEM_ROLES.MANAGER);
}
async function resolveHrmAccessScope(prisma, organizationId, user) {
    if (isHrmOrgWideRole(user.role)) {
        return { mode: 'all' };
    }
    if (user.role === roles_1.SYSTEM_ROLES.MANAGER) {
        if (!user.employeeId) {
            return { mode: 'ids', employeeIds: [] };
        }
        const ids = await collectReportEmployeeIds(prisma, organizationId, user.employeeId);
        return { mode: 'ids', employeeIds: ids };
    }
    if (!user.employeeId) {
        return { mode: 'ids', employeeIds: [] };
    }
    return { mode: 'ids', employeeIds: [user.employeeId] };
}
/** @deprecated */
async function resolveAttendanceScope(prisma, organizationId, user) {
    return resolveHrmAccessScope(prisma, organizationId, user);
}
async function collectReportEmployeeIds(prisma, organizationId, managerEmployeeId) {
    const result = new Set([managerEmployeeId]);
    let frontier = [managerEmployeeId];
    while (frontier.length) {
        const reports = await prisma.employee.findMany({
            where: {
                organizationId,
                managerId: { in: frontier },
                isActive: true,
            },
            select: { id: true },
        });
        const next = [];
        for (const r of reports) {
            if (!result.has(r.id)) {
                result.add(r.id);
                next.push(r.id);
            }
        }
        frontier = next;
    }
    return [...result];
}
function assertEmployeeInScope(scope, employeeId, verb = 'truy cập') {
    if (scope.mode === 'all')
        return;
    if (!scope.employeeIds.includes(employeeId)) {
        throw new common_1.ForbiddenException(`Không có quyền ${verb} nhân viên này`);
    }
}
/** Nhân viên thường chỉ được punch chính mình; HR/Owner/Manager (trong scope) được punch hộ. */
function assertCanPunchForEmployee(user, targetEmployeeId, scope) {
    assertEmployeeInScope(scope, targetEmployeeId, 'xem/chấm công');
    if (isHrmOrgWideRole(user.role) || user.role === roles_1.SYSTEM_ROLES.MANAGER) {
        return;
    }
    if (user.employeeId !== targetEmployeeId) {
        throw new common_1.ForbiddenException('Bạn chỉ được chấm công cho chính mình');
    }
}
/** Tạo đơn phép/OT: staff chỉ cho mình; Manager/HR/Owner trong scope. */
function assertCanCreateLeaveOt(user, targetEmployeeId, scope) {
    assertEmployeeInScope(scope, targetEmployeeId, 'tạo đơn cho');
    if (isHrmOrgWideRole(user.role) || user.role === roles_1.SYSTEM_ROLES.MANAGER) {
        return;
    }
    if (user.employeeId !== targetEmployeeId) {
        throw new common_1.ForbiddenException('Bạn chỉ được tạo đơn cho chính mình');
    }
}
/** Duyệt: Owner/HR/Manager và đơn thuộc scope (Manager không tự duyệt chính mình). */
function assertCanApproveLeaveOt(user, targetEmployeeId, scope) {
    if (!canApproveLeaveOt(user.role)) {
        throw new common_1.ForbiddenException('Không có quyền duyệt phép/OT');
    }
    assertEmployeeInScope(scope, targetEmployeeId, 'duyệt đơn của');
    if (user.role === roles_1.SYSTEM_ROLES.MANAGER && user.employeeId === targetEmployeeId) {
        throw new common_1.ForbiddenException('Quản lý không tự duyệt đơn của chính mình');
    }
}
