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
var AssistantAuditService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssistantAuditService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../prisma/prisma.service");
/**
 * Assistant audit — always scoped to JWT organizationId.
 * Never persists raw PII or free-form conversational content.
 */
let AssistantAuditService = AssistantAuditService_1 = class AssistantAuditService {
    prisma;
    logger = new common_1.Logger(AssistantAuditService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async log(user, input) {
        try {
            await this.prisma.assistantAuditLog.create({
                data: {
                    organizationId: user.organizationId,
                    userId: user.id,
                    sessionId: input.sessionId ?? null,
                    requestId: input.requestId.slice(0, 64),
                    toolName: input.toolName?.slice(0, 80) ?? null,
                    action: input.action.slice(0, 40),
                    ok: input.ok ?? null,
                    errorCode: input.errorCode?.slice(0, 40) ?? null,
                    durationMs: input.durationMs ?? null,
                    meta: (0, shared_1.sanitizeAssistantAuditMeta)(input.meta ?? null),
                },
            });
        }
        catch (err) {
            // Audit must not break tool path
            this.logger.warn(`assistant audit failed requestId=${input.requestId}: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
};
exports.AssistantAuditService = AssistantAuditService;
exports.AssistantAuditService = AssistantAuditService = AssistantAuditService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AssistantAuditService);
