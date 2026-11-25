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
var AssistantToolRuntime_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssistantToolRuntime = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@marketingspa/shared");
const tool_registry_1 = require("./tool-registry");
const pii_1 = require("./pii");
const prisma_service_1 = require("../../prisma/prisma.service");
const database_1 = require("@marketingspa/database");
function withTimeout(promise, ms, tool) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(Object.assign(new Error(`timeout:${tool}`), { code: 'TIMEOUT' }));
        }, ms);
        promise.then((v) => {
            clearTimeout(timer);
            resolve(v);
        }, (e) => {
            clearTimeout(timer);
            reject(e);
        });
    });
}
/**
 * Validates args, enforces RBAC (OWNER/SUPER_ADMIN = permission bypass only),
 * enforces tenant via ctx (must have been built from JWT), timeout, PII mask on success data.
 */
let AssistantToolRuntime = AssistantToolRuntime_1 = class AssistantToolRuntime {
    registry;
    prisma;
    logger = new common_1.Logger(AssistantToolRuntime_1.name);
    constructor(registry, prisma) {
        this.registry = registry;
        this.prisma = prisma;
    }
    getLimits() {
        return { ...shared_1.ASSISTANT_TOOL_LIMITS };
    }
    listAllowedTools(ctx) {
        return this.registry.listDescriptorsForContext(ctx);
    }
    async invoke(toolName, rawArgs, ctx) {
        const started = Date.now();
        const def = this.registry.get(toolName);
        if (!def) {
            return (0, shared_1.assistantErrResult)({
                code: 'NOT_FOUND',
                message: `Tool không tồn tại: ${toolName}`,
                tool: toolName,
                organizationId: ctx.organizationId,
            });
        }
        if (!(0, shared_1.assistantHasAllPermissions)(ctx, def.permissions)) {
            return (0, shared_1.assistantErrResult)({
                code: 'FORBIDDEN',
                message: 'Thiếu quyền để gọi tool này',
                tool: toolName,
                organizationId: ctx.organizationId,
            });
        }
        const parsed = def.argsSchema.safeParse(rawArgs ?? {});
        if (!parsed.success) {
            return (0, shared_1.assistantErrResult)({
                code: 'VALIDATION',
                message: parsed.error.issues[0]?.message ?? 'Tham số tool không hợp lệ',
                tool: toolName,
                organizationId: ctx.organizationId,
            });
        }
        const timeoutMs = def.timeoutMs ?? shared_1.ASSISTANT_TOOL_LIMITS.timeoutMs;
        try {
            const feature = toolName.startsWith('finance.') ? 'finance'
                : toolName.startsWith('ads.') ? 'ads_performance'
                    : toolName.startsWith('hrm.') || toolName.startsWith('employees.') ? 'hrm' : null;
            if (feature && ctx.role !== 'SUPER_ADMIN')
                await new database_1.PlanPolicy(this.prisma).assertFeature(ctx.organizationId, feature);
            const result = await withTimeout(def.handler(ctx, parsed.data), timeoutMs, toolName);
            if (!result.ok) {
                // Force org echo to JWT org — never trust handler for tenant
                return { ...result, organizationId: ctx.organizationId };
            }
            // Tenant hard rule: success must not claim foreign org
            if (result.organizationId !== ctx.organizationId) {
                this.logger.error(`tool ${toolName} returned foreign organizationId (blocked)`);
                return (0, shared_1.assistantErrResult)({
                    code: 'UPSTREAM',
                    message: 'Kết quả tool vi phạm tenant',
                    tool: toolName,
                    organizationId: ctx.organizationId,
                });
            }
            const maskedData = (0, pii_1.maskObjectPii)(result.data, ctx.piiReveal);
            // Preserve one-time confirmToken for client UI (maskObjectPii strips *token* keys)
            if (result.data &&
                typeof result.data === 'object' &&
                !Array.isArray(result.data) &&
                typeof result.data.confirmToken === 'string' &&
                result.data.requiresConfirmation === true &&
                maskedData &&
                typeof maskedData === 'object' &&
                !Array.isArray(maskedData)) {
                maskedData.confirmToken = result.data.confirmToken;
            }
            return {
                ...result,
                organizationId: ctx.organizationId,
                data: maskedData,
                pii: {
                    masked: !(ctx.piiReveal.phone && ctx.piiReveal.email),
                    revealedFields: [
                        ...(ctx.piiReveal.phone ? ['phone'] : []),
                        ...(ctx.piiReveal.email ? ['email'] : []),
                    ],
                },
            };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.startsWith('timeout:') || err?.code === 'TIMEOUT') {
                return (0, shared_1.assistantErrResult)({
                    code: 'TIMEOUT',
                    message: `Tool timeout (${timeoutMs}ms)`,
                    tool: toolName,
                    organizationId: ctx.organizationId,
                    retryable: true,
                });
            }
            this.logger.warn(`tool ${toolName} failed after ${Date.now() - started}ms: ${msg}`);
            return (0, shared_1.assistantErrResult)({
                code: 'UPSTREAM',
                message: 'Lỗi khi thực thi tool',
                tool: toolName,
                organizationId: ctx.organizationId,
                retryable: true,
            });
        }
    }
};
exports.AssistantToolRuntime = AssistantToolRuntime;
exports.AssistantToolRuntime = AssistantToolRuntime = AssistantToolRuntime_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tool_registry_1.AssistantToolRegistry, prisma_service_1.PrismaService])
], AssistantToolRuntime);
