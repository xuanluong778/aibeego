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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssistantSessionService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../prisma/prisma.service");
/** Persistence cho assistant_sessions / assistant_messages only — không query domain. */
let AssistantSessionService = class AssistantSessionService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(user, opts = {}) {
        return this.prisma.assistantSession.create({
            data: {
                organizationId: user.organizationId,
                userId: user.id,
                title: opts.title?.slice(0, 200) || null,
                timezone: opts.timezone || 'Asia/Ho_Chi_Minh',
                status: 'ACTIVE',
            },
        });
    }
    async listForUser(user, take = 20) {
        return this.prisma.assistantSession.findMany({
            where: {
                organizationId: user.organizationId,
                userId: user.id,
                status: 'ACTIVE',
            },
            orderBy: { updatedAt: 'desc' },
            take: Math.min(take, 50),
        });
    }
    async getOwned(user, sessionId, includeMessages = false) {
        const session = await this.prisma.assistantSession.findFirst({
            where: {
                id: sessionId,
                organizationId: user.organizationId,
                userId: user.id,
            },
            include: includeMessages
                ? {
                    messages: {
                        orderBy: { createdAt: 'asc' },
                        take: shared_1.ASSISTANT_TOOL_LIMITS.maxChatHistoryMessages,
                    },
                }
                : undefined,
        });
        if (!session) {
            throw new common_1.NotFoundException('Không tìm thấy phiên trợ lý');
        }
        return session;
    }
    /** Soft-delete (ARCHIVE). Only owner of session. */
    async deleteOwned(user, sessionId) {
        await this.getOwned(user, sessionId, false);
        return this.prisma.assistantSession.update({
            where: { id: sessionId },
            data: { status: 'ARCHIVED' },
        });
    }
    /**
     * Append message — content must already be redacted by caller.
     * Tenant: always JWT org + session ownership.
     */
    async appendMessage(user, sessionId, input) {
        await this.getOwned(user, sessionId, false);
        const content = String(input.content ?? '').slice(0, shared_1.ASSISTANT_TOOL_LIMITS.maxMessageChars * 4);
        const [message] = await this.prisma.$transaction([
            this.prisma.assistantMessage.create({
                data: {
                    organizationId: user.organizationId,
                    sessionId,
                    userId: user.id,
                    role: input.role,
                    content,
                    toolName: input.toolName ?? null,
                    toolCallId: input.toolCallId ?? null,
                    meta: (0, shared_1.sanitizeAssistantAuditMeta)(input.meta ?? null),
                },
            }),
            this.prisma.assistantSession.update({
                where: { id: sessionId },
                data: { lastMessageAt: new Date() },
            }),
        ]);
        return message;
    }
    /** Admin can read any session in same org only — never cross-tenant. */
    async getInOrg(user, sessionId, isAdmin) {
        if (!isAdmin) {
            return this.getOwned(user, sessionId, true);
        }
        const session = await this.prisma.assistantSession.findFirst({
            where: {
                id: sessionId,
                organizationId: user.organizationId,
            },
            include: {
                messages: {
                    orderBy: { createdAt: 'asc' },
                    take: shared_1.ASSISTANT_TOOL_LIMITS.maxChatHistoryMessages,
                },
            },
        });
        if (!session) {
            throw new common_1.NotFoundException('Không tìm thấy phiên trợ lý');
        }
        if (session.organizationId !== user.organizationId) {
            throw new common_1.ForbiddenException('assistant_tenant_mismatch');
        }
        return session;
    }
};
exports.AssistantSessionService = AssistantSessionService;
exports.AssistantSessionService = AssistantSessionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AssistantSessionService);
