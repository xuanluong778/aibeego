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
exports.MessagingCampaignService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const messaging_eligibility_service_1 = require("../messaging/messaging-eligibility.service");
const template_renderer_util_1 = require("../automation/template-renderer.util");
const pagination_util_1 = require("../common/utils/pagination.util");
const token_security_util_1 = require("../common/utils/token-security.util");
const messaging_campaign_segment_service_1 = require("./messaging-campaign-segment.service");
const messaging_campaign_queue_service_1 = require("./messaging-campaign-queue.service");
const tenant_kpi_cache_service_1 = require("../common/services/tenant-kpi-cache.service");
const messaging_campaign_types_1 = require("./messaging-campaign.types");
const campaignInclude = {
    channelConnection: { select: { id: true, displayName: true, accountRef: true, status: true } },
    messageTemplate: { select: { id: true, name: true, channel: true, body: true } },
    integration: { select: { id: true, provider: true, status: true } },
    createdBy: { select: { id: true, name: true, email: true } },
};
const campaignListInclude = {
    channelConnection: { select: { id: true, displayName: true, accountRef: true, status: true } },
    messageTemplate: { select: { id: true, name: true, channel: true } },
    integration: { select: { id: true, provider: true, status: true } },
    createdBy: { select: { id: true, name: true } },
};
let MessagingCampaignService = class MessagingCampaignService {
    prisma;
    segment;
    eligibility;
    audit;
    campaignQueue;
    kpiCache;
    constructor(prisma, segment, eligibility, audit, campaignQueue, kpiCache) {
        this.prisma = prisma;
        this.segment = segment;
        this.eligibility = eligibility;
        this.audit = audit;
        this.campaignQueue = campaignQueue;
        this.kpiCache = kpiCache;
    }
    async create(organizationId, dto, userId) {
        await this.validateReferences(organizationId, dto);
        const campaign = await this.prisma.messagingCampaign.create({
            data: {
                organizationId,
                name: dto.name,
                channel: dto.channel,
                campaignType: dto.campaignType,
                channelConnectionId: dto.channelConnectionId,
                integrationId: dto.integrationId,
                messageTemplateId: dto.messageTemplateId,
                segmentConfig: (dto.segmentConfig ?? {}),
                variables: (dto.variables ?? {}),
                timezone: dto.timezone ?? 'Asia/Ho_Chi_Minh',
                createdByUserId: userId,
                status: database_1.MessagingCampaignStatus.DRAFT,
            },
            include: campaignInclude,
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'MESSAGING_CAMPAIGN_CREATED',
            entityType: 'MESSAGING_CAMPAIGN',
            entityId: campaign.id,
            metadata: (0, token_security_util_1.redactForAudit)({
                name: campaign.name,
                channel: campaign.channel,
            }),
        });
        return campaign;
    }
    async update(organizationId, id, dto, userId) {
        const existing = await this.ensureCampaign(organizationId, id);
        this.assertContentEditable(existing);
        if (this.hasLockedFieldChanges(dto)) {
            this.assertContentEditable(existing);
        }
        await this.validateReferences(organizationId, dto);
        const campaign = await this.prisma.messagingCampaign.update({
            where: { id },
            data: {
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.channel !== undefined && { channel: dto.channel }),
                ...(dto.campaignType !== undefined && { campaignType: dto.campaignType }),
                ...(dto.channelConnectionId !== undefined && {
                    channelConnectionId: dto.channelConnectionId,
                }),
                ...(dto.integrationId !== undefined && { integrationId: dto.integrationId }),
                ...(dto.messageTemplateId !== undefined && { messageTemplateId: dto.messageTemplateId }),
                ...(dto.segmentConfig !== undefined && {
                    segmentConfig: dto.segmentConfig,
                }),
                ...(dto.variables !== undefined && { variables: dto.variables }),
                ...(dto.timezone !== undefined && { timezone: dto.timezone }),
            },
            include: campaignInclude,
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'MESSAGING_CAMPAIGN_UPDATED',
            entityType: 'MESSAGING_CAMPAIGN',
            entityId: campaign.id,
            metadata: (0, token_security_util_1.redactForAudit)(dto),
        });
        return campaign;
    }
    async list(organizationId, query) {
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        const cacheName = `list:msg:${page}:${pageSize}:${JSON.stringify({
            st: query.status,
            ch: query.channel,
            s: query.search,
        })}`;
        const cached = await this.kpiCache?.getJson(organizationId, cacheName);
        if (cached)
            return cached;
        const where = {
            organizationId,
            ...(query.status && { status: query.status }),
            ...(query.channel && { channel: query.channel }),
            ...(query.search && {
                name: { contains: query.search, mode: 'insensitive' },
            }),
        };
        const [items, total] = await Promise.all([
            this.prisma.messagingCampaign.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take,
                include: campaignListInclude,
            }),
            this.prisma.messagingCampaign.count({ where }),
        ]);
        const payload = (0, pagination_util_1.buildPaginatedResult)(items, total, page, pageSize);
        await this.kpiCache?.setJson(organizationId, cacheName, payload, 8);
        return payload;
    }
    async findOne(organizationId, id) {
        const campaign = await this.prisma.messagingCampaign.findFirst({
            where: { id, organizationId },
            include: {
                ...campaignInclude,
                recipients: {
                    take: 20,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        identity: {
                            select: {
                                id: true,
                                displayName: true,
                                externalUserId: true,
                                channel: true,
                            },
                        },
                    },
                },
            },
        });
        if (!campaign)
            throw new common_1.NotFoundException('Chiến dịch không tồn tại');
        return campaign;
    }
    async previewSegment(organizationId, id) {
        const campaign = await this.ensureCampaign(organizationId, id);
        const segmentConfig = campaign.segmentConfig;
        return this.segment.preview(organizationId, campaign.channel, segmentConfig, campaign.channelConnectionId);
    }
    async previewEligibility(organizationId, id, dto) {
        const campaign = await this.ensureCampaign(organizationId, id);
        const segmentConfig = campaign.segmentConfig;
        const limit = dto.limit ?? 500;
        let identities = await this.segment.resolveIdentities(organizationId, campaign.channel, segmentConfig, campaign.channelConnectionId);
        if (dto.identityIds?.length) {
            const allowed = new Set(dto.identityIds);
            identities = identities.filter((i) => allowed.has(i.id));
        }
        identities = await this.segment.filterOutSuppressed(organizationId, campaign.channel, identities, segmentConfig.excludeSuppressed !== false);
        const template = campaign.messageTemplateId
            ? await this.prisma.messageTemplate.findFirst({
                where: { id: campaign.messageTemplateId, organizationId },
            })
            : null;
        const results = [];
        const breakdown = {};
        let eligible = 0;
        let excluded = 0;
        let estimatedCost = 0;
        const contentPreviews = [];
        const processList = identities.slice(0, limit);
        for (const identity of processList) {
            const eligibility = await this.eligibility.check({
                organizationId,
                channel: campaign.channel,
                campaignType: (0, shared_1.mapCampaignKindToEligibilityType)(campaign.campaignType),
                identityId: identity.id,
                connectionId: campaign.channelConnectionId ?? undefined,
                templateId: campaign.messageTemplateId ?? undefined,
                leadId: identity.leadId ?? undefined,
                customerId: identity.customerId ?? undefined,
            });
            if (eligibility.eligible) {
                eligible += 1;
                estimatedCost += eligibility.estimatedCost ?? 0;
                if (contentPreviews.length < 50 && template) {
                    const context = await this.buildRenderContext(organizationId, { customerId: identity.customerId ?? undefined, leadId: identity.leadId ?? undefined }, identity, campaign.variables);
                    contentPreviews.push({
                        identityId: identity.id,
                        name: identity.displayName ?? 'Khách',
                        content: (0, template_renderer_util_1.renderTemplate)(template.body, context),
                    });
                }
            }
            else {
                excluded += 1;
                const code = eligibility.reasonCode ?? 'UNKNOWN';
                breakdown[code] = (breakdown[code] ?? 0) + 1;
            }
            if (results.length < 50) {
                let renderedPreview;
                if (eligibility.eligible && template) {
                    const context = await this.buildRenderContext(organizationId, { customerId: identity.customerId ?? undefined, leadId: identity.leadId ?? undefined }, identity, campaign.variables);
                    renderedPreview = (0, template_renderer_util_1.renderTemplate)(template.body, context);
                }
                results.push({
                    identityId: identity.id,
                    externalUserId: (0, token_security_util_1.maskExternalId)(identity.externalUserId),
                    displayName: identity.displayName,
                    eligibility,
                    renderedPreview,
                });
            }
        }
        const totalIdentities = identities.length;
        const ratio = processList.length > 0 ? totalIdentities / processList.length : 0;
        const scaledBreakdown = {};
        for (const [code, count] of Object.entries(breakdown)) {
            scaledBreakdown[code] = Math.round(count * ratio);
        }
        return {
            totalIdentities,
            sampled: processList.length,
            estimatedEligible: Math.round(eligible * ratio),
            estimatedExcluded: Math.round(excluded * ratio),
            estimatedCost: Math.round(estimatedCost * ratio),
            breakdown: scaledBreakdown,
            contentPreviews,
            results,
        };
    }
    async testSend(organizationId, id, dto, userId) {
        const campaign = await this.ensureCampaign(organizationId, id);
        const template = campaign.messageTemplateId
            ? await this.prisma.messageTemplate.findFirst({
                where: { id: campaign.messageTemplateId, organizationId },
            })
            : null;
        const identity = await this.resolveTestIdentity(organizationId, campaign.channel, dto);
        const eligibility = await this.eligibility.check({
            organizationId,
            channel: campaign.channel,
            campaignType: (0, shared_1.mapCampaignKindToEligibilityType)(campaign.campaignType),
            identityId: identity?.id,
            customerId: dto.customerId ?? identity?.customerId ?? undefined,
            leadId: dto.leadId ?? identity?.leadId ?? undefined,
            connectionId: campaign.channelConnectionId ?? undefined,
            templateId: campaign.messageTemplateId ?? undefined,
        });
        if (!eligibility.eligible) {
            return {
                simulated: true,
                sent: false,
                message: eligibility.reasonMessage ?? 'Không đủ điều kiện gửi',
                eligibility,
            };
        }
        const context = await this.buildRenderContext(organizationId, dto, identity, campaign.variables);
        const bodyTemplate = template?.body ?? 'Tin nhắn giả lập — chưa gắn template';
        const renderedContent = (0, template_renderer_util_1.renderTemplate)(bodyTemplate, context);
        await this.audit.log({
            organizationId,
            userId,
            action: 'MESSAGING_CAMPAIGN_TEST_SEND',
            entityType: 'MESSAGING_CAMPAIGN',
            entityId: campaign.id,
            metadata: (0, token_security_util_1.redactForAudit)({
                identityId: identity?.id,
                customerId: dto.customerId,
                leadId: dto.leadId,
                simulated: true,
                providerMode: eligibility.providerMode,
            }),
        });
        return {
            simulated: true,
            sent: false,
            message: 'Gửi thử giả lập — không gửi tin thật qua API',
            renderedContent,
            providerMode: eligibility.providerMode,
            eligibility,
            identityId: identity?.id,
        };
    }
    async schedule(organizationId, id, dto, userId) {
        const campaign = await this.ensureCampaign(organizationId, id);
        if (campaign.status !== database_1.MessagingCampaignStatus.DRAFT &&
            campaign.status !== database_1.MessagingCampaignStatus.SCHEDULED) {
            throw new common_1.BadRequestException('Chỉ lên lịch chiến dịch ở trạng thái nháp hoặc đã lên lịch');
        }
        const scheduledAt = new Date(dto.scheduledAt);
        if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() <= Date.now()) {
            throw new common_1.BadRequestException('Thời gian lên lịch phải ở tương lai');
        }
        const updated = await this.prisma.messagingCampaign.update({
            where: { id },
            data: {
                status: database_1.MessagingCampaignStatus.SCHEDULED,
                scheduledAt,
                ...(dto.timezone && { timezone: dto.timezone }),
            },
            include: campaignInclude,
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'MESSAGING_CAMPAIGN_SCHEDULED',
            entityType: 'MESSAGING_CAMPAIGN',
            entityId: id,
            metadata: { scheduledAt: scheduledAt.toISOString() },
        });
        return updated;
    }
    async start(organizationId, id, userId) {
        const campaign = await this.ensureCampaign(organizationId, id);
        if (campaign.status !== database_1.MessagingCampaignStatus.DRAFT &&
            campaign.status !== database_1.MessagingCampaignStatus.SCHEDULED) {
            throw new common_1.BadRequestException('Chỉ bắt đầu chiến dịch ở trạng thái nháp hoặc đã lên lịch');
        }
        await this.prisma.messagingCampaign.update({
            where: { id },
            data: { status: database_1.MessagingCampaignStatus.PLANNING, startedAt: new Date() },
        });
        await this.campaignQueue.enqueuePlan(organizationId, id);
        await this.audit.log({
            organizationId,
            userId,
            action: 'MESSAGING_CAMPAIGN_STARTED',
            entityType: 'MESSAGING_CAMPAIGN',
            entityId: id,
            metadata: { queued: true, planner: 'messaging-campaign-plan-queue' },
        });
        return this.findOne(organizationId, id);
    }
    async pause(organizationId, id, userId) {
        const campaign = await this.ensureCampaign(organizationId, id);
        if (campaign.status !== database_1.MessagingCampaignStatus.RUNNING) {
            throw new common_1.BadRequestException('Chỉ tạm dừng chiến dịch đang chạy');
        }
        const updated = await this.prisma.messagingCampaign.update({
            where: { id },
            data: {
                status: database_1.MessagingCampaignStatus.PAUSED,
                pausedAt: new Date(),
            },
            include: campaignInclude,
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'MESSAGING_CAMPAIGN_PAUSED',
            entityType: 'MESSAGING_CAMPAIGN',
            entityId: id,
        });
        return updated;
    }
    async resume(organizationId, id, userId) {
        const campaign = await this.ensureCampaign(organizationId, id);
        if (campaign.status !== database_1.MessagingCampaignStatus.PAUSED) {
            throw new common_1.BadRequestException('Chỉ tiếp tục chiến dịch đang tạm dừng');
        }
        const updated = await this.prisma.messagingCampaign.update({
            where: { id },
            data: {
                status: database_1.MessagingCampaignStatus.RUNNING,
                pausedAt: null,
            },
            include: campaignInclude,
        });
        await this.campaignQueue.enqueueDispatch(organizationId, id);
        await this.audit.log({
            organizationId,
            userId,
            action: 'MESSAGING_CAMPAIGN_RESUMED',
            entityType: 'MESSAGING_CAMPAIGN',
            entityId: id,
        });
        return updated;
    }
    async cancel(organizationId, id, userId) {
        const campaign = await this.ensureCampaign(organizationId, id);
        const cancellable = [
            database_1.MessagingCampaignStatus.DRAFT,
            database_1.MessagingCampaignStatus.SCHEDULED,
            database_1.MessagingCampaignStatus.PLANNING,
            database_1.MessagingCampaignStatus.RUNNING,
            database_1.MessagingCampaignStatus.PAUSED,
        ];
        if (!cancellable.includes(campaign.status)) {
            throw new common_1.BadRequestException('Không thể hủy chiến dịch ở trạng thái hiện tại');
        }
        const updated = await this.prisma.messagingCampaign.update({
            where: { id },
            data: {
                status: database_1.MessagingCampaignStatus.CANCELLED,
                cancelledAt: new Date(),
            },
            include: campaignInclude,
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'MESSAGING_CAMPAIGN_CANCELLED',
            entityType: 'MESSAGING_CAMPAIGN',
            entityId: id,
        });
        return updated;
    }
    async duplicate(organizationId, id, userId) {
        const source = await this.ensureCampaign(organizationId, id);
        const copy = await this.prisma.messagingCampaign.create({
            data: {
                organizationId,
                name: `${source.name} (bản sao)`,
                channel: source.channel,
                campaignType: source.campaignType,
                channelConnectionId: source.channelConnectionId,
                integrationId: source.integrationId,
                messageTemplateId: source.messageTemplateId,
                segmentConfig: source.segmentConfig,
                variables: source.variables,
                timezone: source.timezone,
                createdByUserId: userId,
                status: database_1.MessagingCampaignStatus.DRAFT,
            },
            include: campaignInclude,
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'MESSAGING_CAMPAIGN_DUPLICATED',
            entityType: 'MESSAGING_CAMPAIGN',
            entityId: copy.id,
            metadata: { sourceCampaignId: id },
        });
        return copy;
    }
    async remove(organizationId, id, userId) {
        const campaign = await this.ensureCampaign(organizationId, id);
        if (campaign.status === database_1.MessagingCampaignStatus.RUNNING ||
            campaign.status === database_1.MessagingCampaignStatus.PLANNING) {
            throw new common_1.BadRequestException('Hãy hủy chiến dịch đang chạy trước khi xóa');
        }
        await this.prisma.messagingCampaign.delete({ where: { id } });
        await this.audit.log({
            organizationId,
            userId,
            action: 'MESSAGING_CAMPAIGN_DELETED',
            entityType: 'MESSAGING_CAMPAIGN',
            entityId: id,
            metadata: {
                name: campaign.name,
                status: campaign.status,
                channel: campaign.channel,
            },
        });
        return { ok: true, id };
    }
    /**
     * Dashboard báo cáo chiến dịch — counters, tỷ lệ, attribution, cost, lỗi theo provider.
     * Chỉ trả dữ liệu thuộc organizationId.
     */
    async getDashboard(organizationId, id) {
        const campaign = await this.ensureCampaign(organizationId, id);
        const statusGroups = await this.prisma.messagingCampaignRecipient.groupBy({
            by: ['status'],
            where: { organizationId, campaignId: id },
            _count: { _all: true },
        });
        const byStatus = Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all]));
        const blockedCount = await this.prisma.messagingCampaignRecipient.count({
            where: {
                organizationId,
                campaignId: id,
                OR: [
                    { exclusionReason: { contains: 'BLOCKED' } },
                    { lastError: { contains: 'BLOCKED' } },
                    { lastError: { contains: 'USER_BLOCKED' } },
                ],
            },
        });
        const errorRows = await this.prisma.messagingCampaignRecipient.findMany({
            where: {
                organizationId,
                campaignId: id,
                OR: [
                    { status: 'FAILED' },
                    { status: 'SKIPPED' },
                    { lastError: { not: null } },
                    { exclusionReason: { not: null } },
                ],
            },
            select: {
                lastError: true,
                exclusionReason: true,
                status: true,
                identity: {
                    select: {
                        integrationScopeKey: true,
                        channel: true,
                    },
                },
            },
            take: 5_000,
        });
        const errorsByReason = {};
        const errorsByPageOrOa = {};
        for (const row of errorRows) {
            const reason = row.exclusionReason || row.lastError || row.status || 'UNKNOWN';
            const reasonKey = reason.slice(0, 120);
            errorsByReason[reasonKey] = (errorsByReason[reasonKey] ?? 0) + 1;
            const pageKey = row.identity.integrationScopeKey || row.identity.channel;
            errorsByPageOrOa[pageKey] = (errorsByPageOrOa[pageKey] ?? 0) + 1;
        }
        const connection = campaign.channelConnection;
        const providerLabel = connection
            ? `${campaign.channel}:${connection.accountRef}`
            : campaign.channel;
        const since = campaign.startedAt ?? campaign.createdAt;
        const leadIds = (await this.prisma.messagingCampaignRecipient.findMany({
            where: { organizationId, campaignId: id, leadId: { not: null } },
            select: { leadId: true },
            distinct: ['leadId'],
            take: 10_000,
        }))
            .map((r) => r.leadId)
            .filter(Boolean);
        const customerIds = (await this.prisma.messagingCampaignRecipient.findMany({
            where: { organizationId, campaignId: id, customerId: { not: null } },
            select: { customerId: true },
            distinct: ['customerId'],
            take: 10_000,
        }))
            .map((r) => r.customerId)
            .filter(Boolean);
        const [appointmentsCount, ordersCount, revenueAgg] = await Promise.all([
            leadIds.length || customerIds.length
                ? this.prisma.appointment.count({
                    where: {
                        organizationId,
                        createdAt: { gte: since },
                        OR: [
                            ...(leadIds.length ? [{ leadId: { in: leadIds } }] : []),
                            ...(customerIds.length ? [{ customerId: { in: customerIds } }] : []),
                        ],
                    },
                })
                : Promise.resolve(0),
            customerIds.length
                ? this.prisma.order.count({
                    where: {
                        organizationId,
                        customerId: { in: customerIds },
                        orderedAt: { gte: since },
                    },
                })
                : Promise.resolve(0),
            customerIds.length
                ? this.prisma.order.aggregate({
                    where: {
                        organizationId,
                        customerId: { in: customerIds },
                        orderedAt: { gte: since },
                    },
                    _sum: { total: true },
                })
                : Promise.resolve({ _sum: { total: null } }),
        ]);
        const attributedRevenue = Number(revenueAgg._sum.total ?? 0);
        const conversions = appointmentsCount + ordersCount;
        const actualCost = Number(campaign.actualCost ?? 0);
        const estimatedCost = Number(campaign.estimatedCost ?? 0);
        const sent = campaign.sentCount || byStatus.SENT || 0;
        const replied = campaign.repliedCount || byStatus.REPLIED || 0;
        const replyRate = sent > 0 ? replied / sent : 0;
        const costPerConversion = conversions > 0 ? actualCost / conversions : null;
        const meta = (campaign.metadata ?? {});
        return {
            campaign: {
                id: campaign.id,
                name: campaign.name,
                channel: campaign.channel,
                status: campaign.status,
                campaignType: campaign.campaignType,
                provider: providerLabel,
                pageOrOa: connection?.accountRef ?? null,
                startedAt: campaign.startedAt,
                completedAt: campaign.completedAt,
            },
            totals: {
                totalRecipients: campaign.totalRecipients,
                eligible: campaign.eligibleCount,
                excluded: campaign.excludedCount,
                queued: campaign.queuedCount,
                sent: campaign.sentCount,
                delivered: campaign.deliveredCount,
                read: campaign.readCount,
                replied: campaign.repliedCount,
                failed: campaign.failedCount,
                blocked: blockedCount,
                optOut: campaign.optOutCount,
                byStatus,
            },
            rates: {
                replyRate,
                deliveryRate: sent > 0 ? campaign.deliveredCount / sent : 0,
                readRate: sent > 0 ? campaign.readCount / sent : 0,
            },
            attribution: {
                appointments: appointmentsCount,
                orders: ordersCount,
                revenue: attributedRevenue,
                conversions,
                replyAttributionCount: Array.isArray(meta.replyAttributions)
                    ? meta.replyAttributions.length
                    : 0,
                windowFrom: since,
            },
            costs: {
                estimatedCost,
                actualCost,
                costPerConversion,
                costPerSent: sent > 0 ? actualCost / sent : null,
            },
            errors: {
                byReason: errorsByReason,
                byPageOrOa: errorsByPageOrOa,
                provider: providerLabel,
            },
        };
    }
    async exportRecipients(organizationId, id, opts) {
        const campaign = await this.ensureCampaign(organizationId, id);
        const format = opts.format === 'xlsx' || opts.format === 'xls' ? 'xlsx' : 'csv';
        const canReveal = opts.reveal === true &&
            (opts.userRole === 'OWNER' ||
                (opts.permissions ?? []).includes('automation.integration.manage'));
        const recipients = await this.prisma.messagingCampaignRecipient.findMany({
            where: { organizationId, campaignId: id },
            orderBy: { createdAt: 'asc' },
            take: 50_000,
            include: {
                identity: {
                    select: {
                        externalUserId: true,
                        phoneNormalized: true,
                        displayName: true,
                        integrationScopeKey: true,
                    },
                },
            },
        });
        const headers = [
            'Recipient ID',
            'Status',
            'Eligible',
            'External ID',
            'Phone',
            'Display Name',
            'Page/OA',
            'Provider Mode',
            'Exclusion / Error',
            'Sent At',
            'Delivered At',
            'Read At',
            'Replied At',
            'Cost',
        ];
        const rows = recipients.map((r) => [
            r.id,
            r.status,
            r.eligible ? '1' : '0',
            canReveal ? r.identity.externalUserId : (0, token_security_util_1.maskExternalId)(r.identity.externalUserId),
            canReveal ? (r.identity.phoneNormalized ?? '') : (0, token_security_util_1.maskPhone)(r.identity.phoneNormalized),
            r.identity.displayName ?? '',
            r.identity.integrationScopeKey,
            r.providerMode ?? '',
            r.exclusionReason || r.lastError || '',
            r.sentAt?.toISOString() ?? '',
            r.deliveredAt?.toISOString() ?? '',
            r.readAt?.toISOString() ?? '',
            r.repliedAt?.toISOString() ?? '',
            String(r.cost ?? 0),
        ]);
        await this.audit.log({
            organizationId,
            userId: opts.userId,
            action: 'MESSAGING_CAMPAIGN_EXPORTED',
            entityType: 'MESSAGING_CAMPAIGN',
            entityId: id,
            metadata: (0, token_security_util_1.redactForAudit)({
                format,
                rowCount: recipients.length,
                masked: !canReveal,
                campaignName: campaign.name,
            }),
        });
        const stamp = new Date().toISOString().slice(0, 10);
        const safeName = campaign.name.replace(/[^\w-]+/g, '_').slice(0, 40);
        if (format === 'csv') {
            const body = [headers, ...rows]
                .map((cols) => cols.map((c) => this.csvEscape(String(c))).join(','))
                .join('\n');
            return {
                content: Buffer.from(`\uFEFF${body}`, 'utf8'),
                contentType: 'text/csv; charset=utf-8',
                filename: `campaign-${safeName}-${stamp}.csv`,
            };
        }
        const xmlRows = rows
            .map((cols) => `<Row>${cols.map((c) => `<Cell><Data ss:Type="String">${this.xmlEscape(String(c))}</Data></Cell>`).join('')}</Row>`)
            .join('');
        const headerRow = `<Row>${headers
            .map((c) => `<Cell><Data ss:Type="String">${this.xmlEscape(c)}</Data></Cell>`)
            .join('')}</Row>`;
        const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Recipients">
  <Table>${headerRow}${xmlRows}</Table>
 </Worksheet>
</Workbook>`;
        return {
            content: Buffer.from(xml, 'utf8'),
            contentType: 'application/vnd.ms-excel; charset=utf-8',
            filename: `campaign-${safeName}-${stamp}.xls`,
        };
    }
    csvEscape(value) {
        if (/[",\n\r]/.test(value))
            return `"${value.replace(/"/g, '""')}"`;
        return value;
    }
    xmlEscape(value) {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
    async ensureCampaign(organizationId, id) {
        const campaign = await this.prisma.messagingCampaign.findFirst({
            where: { id, organizationId },
            include: campaignInclude,
        });
        if (!campaign)
            throw new common_1.NotFoundException('Chiến dịch không tồn tại');
        return campaign;
    }
    assertContentEditable(campaign) {
        if (!(0, messaging_campaign_types_1.isCampaignContentEditable)(campaign.status, campaign.startedAt)) {
            throw new common_1.ForbiddenException('Không thể sửa nội dung hoặc segment sau khi chiến dịch đã bắt đầu');
        }
    }
    hasLockedFieldChanges(dto) {
        return (dto.segmentConfig !== undefined ||
            dto.variables !== undefined ||
            dto.messageTemplateId !== undefined ||
            dto.channelConnectionId !== undefined ||
            dto.integrationId !== undefined ||
            dto.channel !== undefined ||
            dto.campaignType !== undefined);
    }
    async validateReferences(organizationId, dto) {
        if (dto.channelConnectionId) {
            const conn = await this.prisma.messagingChannelConnection.findFirst({
                where: { id: dto.channelConnectionId, organizationId },
            });
            if (!conn)
                throw new common_1.BadRequestException('Kết nối kênh không tồn tại');
            if (dto.channel && conn.channel !== dto.channel) {
                throw new common_1.BadRequestException('Kênh kết nối không khớp với kênh chiến dịch');
            }
        }
        if (dto.integrationId) {
            const integration = await this.prisma.integration.findFirst({
                where: { id: dto.integrationId, organizationId },
            });
            if (!integration)
                throw new common_1.BadRequestException('Integration không tồn tại');
        }
        if (dto.messageTemplateId) {
            const template = await this.prisma.messageTemplate.findFirst({
                where: { id: dto.messageTemplateId, organizationId },
            });
            if (!template)
                throw new common_1.BadRequestException('Template không tồn tại');
            if (dto.channel && template.channel !== dto.channel) {
                throw new common_1.BadRequestException('Template không khớp kênh chiến dịch');
            }
        }
    }
    async resolveTestIdentity(organizationId, channel, dto) {
        if (dto.identityId) {
            const identity = await this.prisma.messagingContactIdentity.findFirst({
                where: { id: dto.identityId, organizationId, channel, mergedIntoId: null },
            });
            if (!identity)
                throw new common_1.NotFoundException('Identity không tồn tại');
            return identity;
        }
        if (dto.customerId) {
            const identity = await this.prisma.messagingContactIdentity.findFirst({
                where: { organizationId, channel, customerId: dto.customerId, mergedIntoId: null },
                orderBy: { lastInboundAt: 'desc' },
            });
            if (identity)
                return identity;
        }
        if (dto.leadId) {
            const identity = await this.prisma.messagingContactIdentity.findFirst({
                where: { organizationId, channel, leadId: dto.leadId, mergedIntoId: null },
                orderBy: { lastInboundAt: 'desc' },
            });
            if (identity)
                return identity;
        }
        return null;
    }
    async buildRenderContext(organizationId, dto, identity, campaignVariables) {
        const context = {
            ...campaignVariables,
            ...(dto.context ?? {}),
        };
        const customerId = dto.customerId ?? identity?.customerId;
        const leadId = dto.leadId ?? identity?.leadId;
        if (customerId) {
            const customer = await this.prisma.customer.findFirst({
                where: { id: customerId, organizationId },
                include: { branch: true },
            });
            if (customer) {
                context.customer_name = customer.name;
                context.branch_name = customer.branch?.name ?? context.branch_name ?? '';
            }
        }
        else if (leadId) {
            const lead = await this.prisma.lead.findFirst({
                where: { id: leadId, organizationId },
            });
            if (lead) {
                context.customer_name = lead.name;
            }
        }
        else if (identity?.displayName) {
            context.customer_name = identity.displayName;
        }
        if (!context.customer_name) {
            context.customer_name = 'Quý khách';
        }
        const latestAppt = await this.prisma.appointment.findFirst({
            where: {
                organizationId,
                OR: [
                    ...(customerId ? [{ customerId }] : []),
                    ...(leadId ? [{ leadId }] : []),
                ],
            },
            orderBy: { scheduledAt: 'desc' },
            include: { service: true, branch: true },
        });
        if (latestAppt) {
            context.appointment_time = latestAppt.scheduledAt.toLocaleString('vi-VN');
            context.service_name = latestAppt.service?.name ?? context.service_name ?? '';
            context.branch_name = latestAppt.branch?.name ?? context.branch_name ?? '';
        }
        if (!context.branch_name) {
            context.branch_name = 'Chi nhánh gần nhất';
        }
        if (!context.appointment_time) {
            context.appointment_time = 'thời gian đã hẹn';
        }
        if (!context.service_name) {
            context.service_name = 'dịch vụ';
        }
        return context;
    }
};
exports.MessagingCampaignService = MessagingCampaignService;
exports.MessagingCampaignService = MessagingCampaignService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        messaging_campaign_segment_service_1.MessagingCampaignSegmentService,
        messaging_eligibility_service_1.MessagingEligibilityService,
        audit_service_1.AuditService,
        messaging_campaign_queue_service_1.MessagingCampaignQueueService,
        tenant_kpi_cache_service_1.TenantKpiCacheService])
], MessagingCampaignService);
