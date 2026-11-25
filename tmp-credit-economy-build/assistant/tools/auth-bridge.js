"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authUserFromToolContext = authUserFromToolContext;
/** Map ToolContext → AuthUser for domain services that take user. Never trust client org. */
function authUserFromToolContext(ctx) {
    return {
        id: ctx.userId,
        email: '',
        name: '',
        role: ctx.role,
        organizationId: ctx.organizationId,
        employeeId: ctx.employeeId ?? null,
        permissions: ctx.permissions ?? [],
    };
}
