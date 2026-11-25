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
exports.MessagingOrgPolicyService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const DEFAULTS = {
    timezone: 'Asia/Ho_Chi_Minh',
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    maxMessagesPerRecipientPerDay: 3,
    campaignCooldownMinutes: 1440,
    channelRateLimits: {},
    excludeRecentlyManualMessaged: true,
    manualMessageLookbackMinutes: 60,
    stopOnReply: true,
    stopOnOptOut: true,
    createTaskOnReply: true,
    assignEmployeeOnReply: false,
    handoverToChatbotOnReply: true,
    optOutKeywords: ['STOP', 'DUNG', 'HUY', 'UNSUBSCRIBE', 'OPT OUT'],
};
let MessagingOrgPolicyService = class MessagingOrgPolicyService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async getOrCreate(organizationId) {
        const existing = await this.prisma.messagingOrgPolicy.findUnique({
            where: { organizationId },
        });
        if (existing)
            return existing;
        return this.prisma.messagingOrgPolicy.create({
            data: {
                organizationId,
                ...DEFAULTS,
                channelRateLimits: DEFAULTS.channelRateLimits,
                optOutKeywords: DEFAULTS.optOutKeywords,
            },
        });
    }
    async update(organizationId, dto, userId) {
        await this.getOrCreate(organizationId);
        const updated = await this.prisma.messagingOrgPolicy.update({
            where: { organizationId },
            data: {
                ...(dto.timezone !== undefined && { timezone: dto.timezone }),
                ...(dto.quietHoursStart !== undefined && { quietHoursStart: dto.quietHoursStart }),
                ...(dto.quietHoursEnd !== undefined && { quietHoursEnd: dto.quietHoursEnd }),
                ...(dto.maxMessagesPerRecipientPerDay !== undefined && {
                    maxMessagesPerRecipientPerDay: dto.maxMessagesPerRecipientPerDay,
                }),
                ...(dto.campaignCooldownMinutes !== undefined && {
                    campaignCooldownMinutes: dto.campaignCooldownMinutes,
                }),
                ...(dto.channelRateLimits !== undefined && {
                    channelRateLimits: dto.channelRateLimits,
                }),
                ...(dto.excludeRecentlyManualMessaged !== undefined && {
                    excludeRecentlyManualMessaged: dto.excludeRecentlyManualMessaged,
                }),
                ...(dto.manualMessageLookbackMinutes !== undefined && {
                    manualMessageLookbackMinutes: dto.manualMessageLookbackMinutes,
                }),
                ...(dto.stopOnReply !== undefined && { stopOnReply: dto.stopOnReply }),
                ...(dto.stopOnOptOut !== undefined && { stopOnOptOut: dto.stopOnOptOut }),
                ...(dto.createTaskOnReply !== undefined && { createTaskOnReply: dto.createTaskOnReply }),
                ...(dto.assignEmployeeOnReply !== undefined && {
                    assignEmployeeOnReply: dto.assignEmployeeOnReply,
                }),
                ...(dto.handoverToChatbotOnReply !== undefined && {
                    handoverToChatbotOnReply: dto.handoverToChatbotOnReply,
                }),
                ...(dto.optOutKeywords !== undefined && {
                    optOutKeywords: dto.optOutKeywords,
                }),
            },
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'MESSAGING_ORG_POLICY_UPDATED',
            entityType: 'MESSAGING_ORG_POLICY',
            entityId: updated.id,
            metadata: dto,
        });
        return updated;
    }
};
exports.MessagingOrgPolicyService = MessagingOrgPolicyService;
exports.MessagingOrgPolicyService = MessagingOrgPolicyService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], MessagingOrgPolicyService);
