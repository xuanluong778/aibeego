"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tenantFromAuthUser = tenantFromAuthUser;
exports.assertMcpToolPermission = assertMcpToolPermission;
exports.listMcpToolDescriptors = listMcpToolDescriptors;
const common_1 = require("@nestjs/common");
const shared_1 = require("@marketingspa/shared");
/** Tạo tenant context từ AuthUser — không nhận orgId từ client body. */
function tenantFromAuthUser(user) {
    return shared_1.adsMcpTenantContextSchema.parse({
        organizationId: user.organizationId,
        userId: user.id,
        role: user.role,
        permissions: user.permissions ?? [],
    });
}
function assertMcpToolPermission(ctx, tool) {
    const required = shared_1.adsMcpToolPermissionMap[tool];
    if (!(0, shared_1.adsMcpHasPermission)(ctx, required)) {
        throw new common_1.ForbiddenException(`Ads MCP tool ${tool} yêu cầu quyền ${required}`);
    }
}
function listMcpToolDescriptors() {
    return Object.values(shared_1.ADS_MCP_TOOLS).map((name) => ({
        name,
        permission: shared_1.adsMcpToolPermissionMap[name],
        public: false,
        providerApis: false,
        dataSource: 'postgresql',
    }));
}
