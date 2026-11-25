"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SALES_PERMISSIONS = exports.SALES_WRITE_ROLE_CODES = exports.SALES_ROLE_MAP = void 0;
exports.assertSalesReadPermission = assertSalesReadPermission;
exports.assertSalesWritePermission = assertSalesWritePermission;
exports.canWriteSales = canWriteSales;
/**
 * RBAC Bán hàng / Kho — map nghiệp vụ → role canonical.
 * Admin  = OWNER (bypass PermissionsGuard + full perms)
 * Manager = MANAGER
 * Staff   = SALE
 */
const roles_1 = require("../common/constants/roles");
const common_1 = require("@nestjs/common");
exports.SALES_ROLE_MAP = {
    Admin: roles_1.SYSTEM_ROLES.OWNER,
    Manager: roles_1.SYSTEM_ROLES.MANAGER,
    Staff: roles_1.SYSTEM_ROLES.SALE,
};
/** Roles được ghi kho / đơn bán */
exports.SALES_WRITE_ROLE_CODES = [
    roles_1.SYSTEM_ROLES.OWNER,
    roles_1.SYSTEM_ROLES.MANAGER,
    roles_1.SYSTEM_ROLES.SALE,
];
exports.SALES_PERMISSIONS = {
    read: 'order.read',
    write: 'order.write',
};
function assertSalesReadPermission(user) {
    if (user.role === roles_1.SYSTEM_ROLES.OWNER || user.role === 'SUPER_ADMIN')
        return;
    if (!user.permissions?.includes(exports.SALES_PERMISSIONS.read))
        throw new common_1.ForbiddenException(`Thiếu quyền: ${exports.SALES_PERMISSIONS.read}`);
}
/** Product writes stay enforced even when the general permissions guard is in shadow mode. */
function assertSalesWritePermission(user) {
    if (user.role === roles_1.SYSTEM_ROLES.OWNER || user.role === 'SUPER_ADMIN')
        return;
    if (!user.permissions?.includes(exports.SALES_PERMISSIONS.write))
        throw new common_1.ForbiddenException(`Thiếu quyền: ${exports.SALES_PERMISSIONS.write}`);
}
function canWriteSales(roleCode) {
    if (!roleCode)
        return false;
    return exports.SALES_WRITE_ROLE_CODES.includes(roleCode);
}
