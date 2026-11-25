"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMetaFanpageAllowedOrgIds = parseMetaFanpageAllowedOrgIds;
exports.assertCanUseServerEnvFanpage = assertCanUseServerEnvFanpage;
exports.canUseServerEnvFanpage = canUseServerEnvFanpage;
const common_1 = require("@nestjs/common");
/**
 * SERVER_ENV Fanpage publish (META_PAGE_ID + META_PAGE_ACCESS_TOKEN)
 * chỉ dành cho SUPER_ADMIN hoặc org trong allowlist.
 * Env: META_FANPAGE_ALLOWED_ORG_IDS (comma-separated organization UUIDs)
 * Alias: META_PAGE_ALLOWED_ORG_IDS
 */
function parseMetaFanpageAllowedOrgIds(getEnv) {
    const raw = getEnv('META_FANPAGE_ALLOWED_ORG_IDS')?.trim() ||
        getEnv('META_PAGE_ALLOWED_ORG_IDS')?.trim() ||
        '';
    if (!raw)
        return [];
    return raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}
function assertCanUseServerEnvFanpage(user, getEnv) {
    if (user.role === 'SUPER_ADMIN')
        return;
    const allowlist = parseMetaFanpageAllowedOrgIds(getEnv);
    if (user.organizationId && allowlist.includes(user.organizationId))
        return;
    throw new common_1.ForbiddenException('Tính năng này chỉ dành cho quản trị viên hệ thống.');
}
function canUseServerEnvFanpage(user, allowedOrgIds) {
    if (user.role === 'SUPER_ADMIN')
        return true;
    return Boolean(user.organizationId && allowedOrgIds.includes(user.organizationId));
}
