"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssistantController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permissions_guard_1 = require("../common/guards/permissions.guard");
const require_permissions_decorator_1 = require("../common/decorators/require-permissions.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const shared_1 = require("@marketingspa/shared");
const assistant_session_service_1 = require("./assistant.session.service");
const tool_runtime_1 = require("./tool-registry/tool-runtime");
const context_1 = require("./tool-registry/context");
const assistant_orchestrator_service_1 = require("./assistant.orchestrator.service");
const assistant_audit_service_1 = require("./assistant.audit.service");
const pending_action_service_1 = require("./write/pending-action.service");
const crypto_1 = require("crypto");
/** Canary/org rollout — OWNER/SUPER_ADMIN never bypass. */
function assertAssistantOrgAllowed(user) {
    if (!(0, shared_1.isAssistantOrgAllowed)(user.organizationId)) {
        throw new common_1.ForbiddenException((0, shared_1.assistantCanaryDenyMessage)());
    }
}
/**
 * HTTP surface: Trợ lý Bạch Cốt Tinh.
 * Không nhận organizationId từ body/query/LLM — chỉ JWT.
 */
let AssistantController = class AssistantController {
    sessions;
    runtime;
    orchestrator;
    audit;
    pending;
    constructor(sessions, runtime, orchestrator, audit, pending) {
        this.sessions = sessions;
        this.runtime = runtime;
        this.orchestrator = orchestrator;
        this.audit = audit;
        this.pending = pending;
    }
    /**
     * Rollout status (canary allowlist). Safe for clients to hide FAB without 403 noise.
     * JWT tenant only — no elevating by body orgId.
     */
    status(user) {
        const cfg = (0, shared_1.loadAssistantCanaryConfig)();
        const orgAllowed = (0, shared_1.isAssistantOrgAllowed)(user.organizationId);
        return {
            enabled: orgAllowed,
            canaryMode: cfg.canaryMode,
            masterEnabled: cfg.masterEnabled,
            organizationId: user.organizationId,
            message: orgAllowed ? null : (0, shared_1.assistantCanaryDenyMessage)(cfg),
        };
    }
    listTools(user, timezoneHeader) {
        assertAssistantOrgAllowed(user);
        const ctx = (0, context_1.buildAssistantToolContext)(user, { timezoneHeader });
        return {
            tools: this.runtime.listAllowedTools(ctx),
            limits: this.runtime.getLimits(),
            timezone: ctx.timezone,
            organizationId: ctx.organizationId,
        };
    }
    listSessions(user, limit) {
        assertAssistantOrgAllowed(user);
        const take = Math.min(50, Math.max(1, Number(limit) || 20));
        return this.sessions.listForUser(user, take);
    }
    async createSession(user, body, timezoneHeader) {
        assertAssistantOrgAllowed(user);
        const ctx = (0, context_1.buildAssistantToolContext)(user, { timezoneHeader });
        const session = await this.sessions.create(user, {
            title: body?.title,
            timezone: ctx.timezone,
        });
        await this.audit.log(user, {
            requestId: ctx.requestId,
            sessionId: session.id,
            action: 'SESSION_CREATE',
            ok: true,
        });
        return session;
    }
    getSession(user, id) {
        assertAssistantOrgAllowed(user);
        const isAdmin = (0, shared_1.assistantHasAllPermissions)({ role: user.role, permissions: user.permissions ?? [] }, [shared_1.ASSISTANT_PERMISSIONS.ADMIN]);
        if (isAdmin) {
            return this.sessions.getInOrg(user, id, true);
        }
        return this.sessions.getOwned(user, id, true);
    }
    async deleteSession(user, id) {
        assertAssistantOrgAllowed(user);
        const session = await this.sessions.deleteOwned(user, id);
        return { id: session.id, status: session.status };
    }
    chat(user, body, timezoneHeader, idempotencyHeader) {
        assertAssistantOrgAllowed(user);
        return this.orchestrator.chat(user, {
            sessionId: body?.sessionId,
            message: body?.message ?? '',
            idempotencyKey: body?.idempotencyKey || idempotencyHeader,
            filters: body?.filters ?? null,
        }, { timezoneHeader });
    }
    confirmAction(user, body, idempotencyHeader) {
        assertAssistantOrgAllowed(user);
        return this.pending.confirm(user, {
            actionId: body?.actionId,
            confirmToken: body?.confirmToken,
            idempotencyKey: body?.idempotencyKey || idempotencyHeader,
        }, { requestId: (0, crypto_1.randomUUID)() });
    }
    cancelAction(user, body) {
        assertAssistantOrgAllowed(user);
        return this.pending.cancel(user, body?.actionId, { requestId: (0, crypto_1.randomUUID)() });
    }
};
exports.AssistantController = AssistantController;
__decorate([
    (0, common_1.Get)('status'),
    (0, require_permissions_decorator_1.RequirePermissions)(shared_1.ASSISTANT_PERMISSIONS.USE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AssistantController.prototype, "status", null);
__decorate([
    (0, common_1.Get)('tools'),
    (0, require_permissions_decorator_1.RequirePermissions)(shared_1.ASSISTANT_PERMISSIONS.ADMIN),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Headers)('x-timezone')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AssistantController.prototype, "listTools", null);
__decorate([
    (0, common_1.Get)('sessions'),
    (0, require_permissions_decorator_1.RequirePermissions)(shared_1.ASSISTANT_PERMISSIONS.USE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AssistantController.prototype, "listSessions", null);
__decorate([
    (0, common_1.Post)('sessions'),
    (0, require_permissions_decorator_1.RequirePermissions)(shared_1.ASSISTANT_PERMISSIONS.USE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('x-timezone')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], AssistantController.prototype, "createSession", null);
__decorate([
    (0, common_1.Get)('sessions/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)(shared_1.ASSISTANT_PERMISSIONS.USE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AssistantController.prototype, "getSession", null);
__decorate([
    (0, common_1.Delete)('sessions/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)(shared_1.ASSISTANT_PERMISSIONS.USE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AssistantController.prototype, "deleteSession", null);
__decorate([
    (0, common_1.Post)('chat'),
    (0, require_permissions_decorator_1.RequirePermissions)(shared_1.ASSISTANT_PERMISSIONS.USE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('x-timezone')),
    __param(3, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String]),
    __metadata("design:returntype", void 0)
], AssistantController.prototype, "chat", null);
__decorate([
    (0, common_1.Post)('actions/confirm'),
    (0, require_permissions_decorator_1.RequirePermissions)(shared_1.ASSISTANT_PERMISSIONS.USE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", void 0)
], AssistantController.prototype, "confirmAction", null);
__decorate([
    (0, common_1.Post)('actions/cancel'),
    (0, require_permissions_decorator_1.RequirePermissions)(shared_1.ASSISTANT_PERMISSIONS.USE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AssistantController.prototype, "cancelAction", null);
exports.AssistantController = AssistantController = __decorate([
    (0, common_1.Controller)('assistant'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [assistant_session_service_1.AssistantSessionService,
        tool_runtime_1.AssistantToolRuntime,
        assistant_orchestrator_service_1.AssistantOrchestratorService,
        assistant_audit_service_1.AssistantAuditService,
        pending_action_service_1.AssistantPendingActionService])
], AssistantController);
