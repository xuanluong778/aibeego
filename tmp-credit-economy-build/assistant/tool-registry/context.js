"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAssistantToolContext = buildAssistantToolContext;
exports.assertCtxMatchesAuth = assertCtxMatchesAuth;
const crypto_1 = require("crypto");
const shared_1 = require("@marketingspa/shared");
const IANA_TZ = /^[A-Za-z0-9_+/-]{1,64}$/;
/**
 * Build ToolContext only from JWT AuthUser (+ safe timezone header).
 * Never reads organizationId / userId from client body or LLM args.
 */
function buildAssistantToolContext(user, opts = {}) {
    const tzCandidate = (opts.orgTimezone && IANA_TZ.test(opts.orgTimezone) ? opts.orgTimezone : null) ||
        (opts.timezoneHeader && IANA_TZ.test(opts.timezoneHeader.trim())
            ? opts.timezoneHeader.trim()
            : null) ||
        shared_1.ASSISTANT_DEFAULT_TIMEZONE;
    const canReveal = (user.permissions ?? []).includes(shared_1.ASSISTANT_PERMISSIONS.PII_REVEAL);
    // Mặc định mask; OWNER không auto-reveal (chỉ bypass check permission code khi có request reveal ở phase sau).
    return shared_1.assistantToolContextSchema.parse({
        userId: user.id,
        organizationId: user.organizationId,
        timezone: tzCandidate,
        role: user.role,
        permissions: user.permissions ?? [],
        employeeId: user.employeeId ?? null,
        locale: 'vi',
        requestId: opts.requestId ?? (0, crypto_1.randomUUID)(),
        piiReveal: {
            phone: Boolean(canReveal),
            email: Boolean(canReveal),
        },
    });
}
/** Assert tool handlers cannot see a foreign org even if LLM fabricates one. */
function assertCtxMatchesAuth(ctx, user) {
    if (ctx.organizationId !== user.organizationId) {
        throw new Error('assistant_tenant_mismatch');
    }
    if (ctx.userId !== user.id) {
        throw new Error('assistant_user_mismatch');
    }
}
