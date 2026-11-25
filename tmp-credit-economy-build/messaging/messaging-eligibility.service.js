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
exports.MessagingEligibilityService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../prisma/prisma.service");
const messaging_provider_registry_1 = require("./providers/messaging-provider.registry");
let MessagingEligibilityService = class MessagingEligibilityService {
    prisma;
    providers;
    constructor(prisma, providers) {
        this.prisma = prisma;
        this.providers = providers;
    }
    evaluate(input) {
        return (0, shared_1.evaluateMessagingEligibility)(input);
    }
    /** Kiểm tra eligibility — dùng khi chuẩn bị chiến dịch (API) */
    async check(params) {
        const input = await this.buildInput(params);
        return (0, shared_1.evaluateMessagingEligibility)(input);
    }
    /** Kiểm tra lại ngay trước gửi (worker / engine) */
    async checkBeforeSend(params) {
        return this.check(params);
    }
    async buildInput(params) {
        const identity = await this.resolveIdentity(params);
        const connection = await this.resolveConnection(params);
        const template = params.templateId
            ? await this.prisma.messageTemplate.findFirst({
                where: { id: params.templateId, organizationId: params.organizationId },
            })
            : null;
        const wallet = await this.prisma.creditWallet.findUnique({
            where: { organizationId: params.organizationId },
        });
        const quota = await this.loadQuota(params, identity?.externalUserId);
        const providerKind = connection?.providerKind;
        const estimatedCost = this.estimateCost(params.channel, providerKind, template);
        const triggerConfig = params.flowId
            ? (await this.prisma.automationFlow.findFirst({
                where: { id: params.flowId, organizationId: params.organizationId },
                select: { triggerConfig: true, maxSendsPerDay: true, cooldownMinutes: true },
            }))?.triggerConfig
            : null;
        const cfg = (triggerConfig ?? {});
        return {
            organizationId: params.organizationId,
            channel: params.channel,
            campaignType: params.campaignType,
            providerModeHint: params.providerModeHint,
            identity: identity
                ? {
                    id: identity.id,
                    externalUserId: identity.externalUserId,
                    integrationScopeKey: identity.integrationScopeKey,
                    lastInboundAt: identity.lastInboundAt,
                    consentStatus: identity.consentStatus,
                    followStatus: identity.followStatus,
                    isBlocked: identity.isBlocked,
                    optedOut: identity.optedOut,
                }
                : params.externalUserId
                    ? { externalUserId: params.externalUserId }
                    : undefined,
            connection: connection
                ? {
                    id: connection.id,
                    accountRef: connection.accountRef,
                    status: connection.status,
                    isPaused: connection.isPaused,
                    permissions: connection.permissions ?? [],
                    providerKind: connection.providerKind,
                    tokenExpiresAt: connection.tokenExpiresAt,
                }
                : params.accountRef
                    ? { accountRef: params.accountRef }
                    : undefined,
            template: template
                ? {
                    id: template.id,
                    isApproved: cfg.templateApproved ?? true,
                    isUtility: cfg.isUtilityTemplate ?? false,
                    isZbsTemplate: cfg.isZbsTemplate ?? connection?.providerKind === database_1.MessagingProviderKind.ZBS_TEMPLATE,
                }
                : undefined,
            quota,
            walletBalance: wallet ? Number(wallet.balance) : 0,
            estimatedCostPerMessage: estimatedCost,
            sendHistory: identity
                ? {
                    lastOutboundAt: identity.lastOutboundAt,
                    cooldownMinutes: quota.cooldownMinutes,
                }
                : undefined,
        };
    }
    async resolveIdentity(params) {
        if (params.identityId) {
            const row = await this.prisma.messagingContactIdentity.findFirst({
                where: { id: params.identityId, organizationId: params.organizationId },
            });
            if (!row)
                throw new common_1.NotFoundException('Identity không tồn tại');
            return row;
        }
        if (params.externalUserId && params.accountRef) {
            const scopeKey = `${params.channel.toLowerCase()}:${params.accountRef}`;
            return this.prisma.messagingContactIdentity.findFirst({
                where: {
                    organizationId: params.organizationId,
                    externalUserId: params.externalUserId,
                    integrationScopeKey: scopeKey,
                },
            });
        }
        if (params.customerId) {
            return this.prisma.messagingContactIdentity.findFirst({
                where: {
                    organizationId: params.organizationId,
                    customerId: params.customerId,
                    channel: params.channel,
                    mergedIntoId: null,
                },
                orderBy: { lastInboundAt: 'desc' },
            });
        }
        if (params.leadId) {
            return this.prisma.messagingContactIdentity.findFirst({
                where: {
                    organizationId: params.organizationId,
                    leadId: params.leadId,
                    channel: params.channel,
                    mergedIntoId: null,
                },
                orderBy: { lastInboundAt: 'desc' },
            });
        }
        return null;
    }
    async resolveConnection(params) {
        if (params.connectionId) {
            return this.prisma.messagingChannelConnection.findFirst({
                where: { id: params.connectionId, organizationId: params.organizationId },
            });
        }
        if (params.accountRef) {
            return this.prisma.messagingChannelConnection.findFirst({
                where: {
                    organizationId: params.organizationId,
                    channel: params.channel,
                    accountRef: params.accountRef,
                },
            });
        }
        return this.prisma.messagingChannelConnection.findFirst({
            where: {
                organizationId: params.organizationId,
                channel: params.channel,
                status: database_1.MessagingChannelAccountStatus.ACTIVE,
                isPaused: false,
            },
            orderBy: { lastSyncedAt: 'desc' },
        });
    }
    async loadQuota(params, externalUserId) {
        const flow = params.flowId
            ? await this.prisma.automationFlow.findFirst({
                where: { id: params.flowId, organizationId: params.organizationId },
            })
            : null;
        const connection = await this.resolveConnection(params);
        const meta = (connection?.metadata ?? {});
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);
        let flowSendsToday;
        if (flow) {
            flowSendsToday = await this.prisma.automationLog.count({
                where: {
                    organizationId: params.organizationId,
                    automationFlowId: flow.id,
                    createdAt: { gte: dayStart },
                    status: { in: ['SENT', 'SUCCESS'] },
                },
            });
        }
        let sendsTodayToRecipient;
        if (externalUserId && flow) {
            sendsTodayToRecipient = await this.prisma.automationLog.count({
                where: {
                    organizationId: params.organizationId,
                    automationFlowId: flow.id,
                    createdAt: { gte: dayStart },
                    status: { in: ['SENT', 'SUCCESS'] },
                    OR: [{ leadId: params.leadId ?? undefined }, { customerId: params.customerId ?? undefined }],
                },
            });
        }
        return {
            broadcastsRemaining: meta.quota?.broadcastsRemaining,
            templatesRemaining: meta.quota?.templatesRemaining,
            dailyRecipientLimit: meta.quota?.dailyRecipientLimit,
            sendsTodayToRecipient,
            flowSendsToday,
            flowDailyLimit: flow?.maxSendsPerDay ?? undefined,
            cooldownMinutes: flow?.cooldownMinutes,
        };
    }
    estimateCost(channel, providerKind, template) {
        if (providerKind === database_1.MessagingProviderKind.ZBS_TEMPLATE) {
            return (this.providers.get(database_1.MessagingProviderKind.ZBS_TEMPLATE).estimateCost?.({
                to: '',
                templateId: 'estimate',
            }) ?? 0);
        }
        if (channel === database_1.MessageChannel.ZALO)
            return 0;
        return 0;
    }
};
exports.MessagingEligibilityService = MessagingEligibilityService;
exports.MessagingEligibilityService = MessagingEligibilityService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        messaging_provider_registry_1.MessagingProviderRegistry])
], MessagingEligibilityService);
