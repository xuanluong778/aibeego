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
var MarketingContextDatasourcesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketingContextDatasourcesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let MarketingContextDatasourcesService = MarketingContextDatasourcesService_1 = class MarketingContextDatasourcesService {
    prisma;
    logger = new common_1.Logger(MarketingContextDatasourcesService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async collectAll(organizationId, timeRange) {
        const range = {
            from: new Date(timeRange.from),
            to: new Date(timeRange.to),
        };
        const results = await Promise.all([
            this.safeCollect('crm.leads', () => this.collectCrmLeads(organizationId, range)),
            this.safeCollect('bookings', () => this.collectBookings(organizationId, range)),
            this.safeCollect('revenue', () => this.collectRevenue(organizationId, range)),
            this.safeCollect('ads.adDailyStat', () => this.collectAds(organizationId, range)),
            this.safeCollect('email', () => this.collectEmail(organizationId, range)),
            this.safeCollect('chatbot', () => this.collectChatbot(organizationId, range)),
            this.safeCollect('funnel', () => this.collectFunnel(organizationId, range)),
            this.safeCollect('campaigns', () => this.collectCampaigns(organizationId, range)),
            this.safeCollect('content', () => this.collectContent(organizationId, range)),
            this.safeCollect('automation', () => this.collectAutomation(organizationId, range)),
        ]);
        return results;
    }
    async safeCollect(domain, fn) {
        try {
            const { data, recordCount } = await fn();
            if (recordCount <= 0) {
                return { domain, status: 'INSUFFICIENT_DATA', recordCount: 0 };
            }
            return { domain, status: 'OK', data, recordCount };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Context datasource ${domain} failed: ${message}`);
            return { domain, status: 'ERROR', error: message };
        }
    }
    leadWhere(orgId, range) {
        return {
            organizationId: orgId,
            createdAt: { gte: range.from, lte: range.to },
        };
    }
    async collectCrmLeads(organizationId, range) {
        const where = this.leadWhere(organizationId, range);
        const [total, hot, unassigned, noFollowUp] = await Promise.all([
            this.prisma.lead.count({ where }),
            this.prisma.lead.count({
                where: {
                    ...where,
                    OR: [
                        { pipelineStatus: { in: ['QUALIFIED', 'BOOKED', 'CONFIRMED'] } },
                        { score: { gte: 80 } },
                    ],
                },
            }),
            this.prisma.lead.count({ where: { ...where, assignedToId: null } }),
            this.prisma.lead.count({
                where: {
                    ...where,
                    OR: [
                        { slaBreached: true },
                        { assignedToId: null, lastContactedAt: null },
                    ],
                },
            }),
        ]);
        return {
            recordCount: total,
            data: { total, hot, unassigned, noFollowUp },
        };
    }
    dateOnlyRange(range) {
        const from = new Date(Date.UTC(range.from.getUTCFullYear(), range.from.getUTCMonth(), range.from.getUTCDate()));
        const to = new Date(Date.UTC(range.to.getUTCFullYear(), range.to.getUTCMonth(), range.to.getUTCDate(), 23, 59, 59, 999));
        return { from, to };
    }
    async collectBookings(organizationId, range) {
        const where = {
            organizationId,
            scheduledAt: { gte: range.from, lte: range.to },
        };
        const [appointmentTotal, upcoming, completed, pipelineBooked] = await Promise.all([
            this.prisma.appointment.count({ where }),
            this.prisma.appointment.count({
                where: { ...where, status: 'SCHEDULED', scheduledAt: { gte: new Date() } },
            }),
            this.prisma.appointment.count({ where: { ...where, status: 'COMPLETED' } }),
            this.prisma.lead.count({
                where: {
                    organizationId,
                    pipelineStatus: { in: ['BOOKED', 'CONFIRMED', 'VISITED', 'PURCHASED'] },
                    createdAt: { gte: range.from, lte: range.to },
                    appointments: { none: { scheduledAt: { gte: range.from, lte: range.to } } },
                },
            }),
        ]);
        const total = appointmentTotal + pipelineBooked;
        return { recordCount: total, data: { total, upcoming, completed } };
    }
    async collectRevenue(organizationId, range) {
        const paymentAgg = await this.prisma.payment.aggregate({
            where: {
                organizationId,
                status: 'COMPLETED',
                paidAt: { gte: range.from, lte: range.to },
            },
            _sum: { amount: true },
            _count: true,
        });
        if (paymentAgg._count > 0) {
            const total = paymentAgg._sum.amount ? Number(paymentAgg._sum.amount) : 0;
            return {
                recordCount: paymentAgg._count,
                data: { total, currency: 'VND' },
            };
        }
        const orderAgg = await this.prisma.order.aggregate({
            where: {
                organizationId,
                status: { in: ['PAID', 'PARTIALLY_PAID'] },
                orderedAt: { gte: range.from, lte: range.to },
            },
            _sum: { total: true },
            _count: true,
        });
        const total = orderAgg._sum.total ? Number(orderAgg._sum.total) : 0;
        return {
            recordCount: orderAgg._count,
            data: { total, currency: 'VND' },
        };
    }
    async collectAds(organizationId, range) {
        const dateRange = this.dateOnlyRange(range);
        const dailyWhere = {
            organizationId,
            date: { gte: dateRange.from, lte: dateRange.to },
        };
        const [agg, count] = await Promise.all([
            this.prisma.adDailyStat.aggregate({
                where: dailyWhere,
                _sum: {
                    spend: true,
                    impressions: true,
                    clicks: true,
                    leads: true,
                    conversionValue: true,
                },
            }),
            this.prisma.adDailyStat.count({ where: dailyWhere }),
        ]);
        if (count > 0) {
            return this.toAdsPayload({
                spend: Number(agg._sum.spend ?? 0),
                impressions: Number(agg._sum.impressions ?? 0),
                clicks: Number(agg._sum.clicks ?? 0),
                leads: Number(agg._sum.leads ?? 0),
                conversionValue: Number(agg._sum.conversionValue ?? 0),
                recordCount: count,
            });
        }
        const insightWhere = {
            organizationId,
            OR: [
                { date: { gte: dateRange.from, lte: dateRange.to } },
                { dateFrom: { lte: dateRange.to }, dateTo: { gte: dateRange.from } },
            ],
        };
        const [insightAgg, insightCount] = await Promise.all([
            this.prisma.adInsight.aggregate({
                where: insightWhere,
                _sum: {
                    spend: true,
                    impressions: true,
                    clicks: true,
                    leads: true,
                    conversionValue: true,
                },
            }),
            this.prisma.adInsight.count({ where: insightWhere }),
        ]);
        return this.toAdsPayload({
            spend: Number(insightAgg._sum.spend ?? 0),
            impressions: Number(insightAgg._sum.impressions ?? 0),
            clicks: Number(insightAgg._sum.clicks ?? 0),
            leads: Number(insightAgg._sum.leads ?? 0),
            conversionValue: Number(insightAgg._sum.conversionValue ?? 0),
            recordCount: insightCount,
        });
    }
    toAdsPayload(input) {
        const { spend, impressions, clicks, leads, conversionValue, recordCount } = input;
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : null;
        const cpc = clicks > 0 ? spend / clicks : null;
        const cpl = leads > 0 ? spend / leads : null;
        const roas = spend > 0 ? conversionValue / spend : null;
        return {
            recordCount,
            data: { spend, impressions, clicks, leads, ctr, cpc, cpl, roas },
        };
    }
    async collectEmail(organizationId, range) {
        const campaigns = await this.prisma.marketingAutopilotEmailDraft.findMany({
            where: {
                organizationId,
                createdAt: { gte: range.from, lte: range.to },
            },
            select: { sentCount: true, openCount: true, clickCount: true },
        });
        const sent = campaigns.reduce((s, c) => s + c.sentCount, 0);
        const opens = campaigns.reduce((s, c) => s + c.openCount, 0);
        const clicks = campaigns.reduce((s, c) => s + c.clickCount, 0);
        const openRate = sent > 0 ? (opens / sent) * 100 : null;
        const clickRate = sent > 0 ? (clicks / sent) * 100 : null;
        return {
            recordCount: campaigns.length,
            data: { campaigns: campaigns.length, sent, openRate, clickRate },
        };
    }
    async collectChatbot(organizationId, range) {
        const [bots, openConversations, leadsCaptured] = await Promise.all([
            this.prisma.chatbotBot.count({ where: { organizationId } }),
            this.prisma.chatbotConversation.count({
                where: { organizationId, status: 'OPEN' },
            }),
            this.prisma.chatbotLead.count({
                where: { organizationId, createdAt: { gte: range.from, lte: range.to } },
            }),
        ]);
        const recordCount = bots + openConversations + leadsCaptured;
        return { recordCount, data: { bots, openConversations, leadsCaptured } };
    }
    async collectFunnel(organizationId, range) {
        const [activeFunnels, pipelineStages, leadsInFunnel] = await Promise.all([
            this.prisma.marketingAutopilotFunnelSpec.count({
                where: { organizationId, status: 'ACTIVE' },
            }),
            this.prisma.funnelStage.count({ where: { organizationId } }),
            this.prisma.lead.count({
                where: {
                    organizationId,
                    stageId: { not: null },
                    createdAt: { gte: range.from, lte: range.to },
                },
            }),
        ]);
        const recordCount = activeFunnels + pipelineStages + leadsInFunnel;
        return { recordCount, data: { activeFunnels, pipelineStages, leadsInFunnel } };
    }
    async collectCampaigns(organizationId, range) {
        const messaging = await this.prisma.messagingCampaign.findMany({
            where: {
                organizationId,
                createdAt: { gte: range.from, lte: range.to },
            },
            select: { status: true, sentCount: true },
        });
        const messagingActive = messaging.filter((c) => ['RUNNING', 'SCHEDULED', 'DRAFT'].includes(c.status)).length;
        const messagingSent = messaging.reduce((s, c) => s + c.sentCount, 0);
        const legacyCampaigns = await this.prisma.campaign.count({
            where: { organizationId, createdAt: { gte: range.from, lte: range.to } },
        });
        const recordCount = messaging.length + legacyCampaigns;
        return {
            recordCount,
            data: { messagingActive, messagingSent, legacyCampaigns },
        };
    }
    async collectContent(organizationId, range) {
        const [teleprompterSources, autoPostDrafts, autoPostPublished] = await Promise.all([
            this.prisma.contentTeleprompterSource.count({
                where: { organizationId, createdAt: { gte: range.from, lte: range.to } },
            }),
            this.prisma.autoPost.count({
                where: { organizationId, status: 'DRAFT' },
            }),
            this.prisma.autoPost.count({
                where: {
                    organizationId,
                    status: 'PUBLISHED',
                    publishedAt: { gte: range.from, lte: range.to },
                },
            }),
        ]);
        const recordCount = teleprompterSources + autoPostDrafts + autoPostPublished;
        return { recordCount, data: { teleprompterSources, autoPostDrafts, autoPostPublished } };
    }
    async collectAutomation(organizationId, range) {
        const [activeFlows, pausedFlows, logsSuccess, logsFailed] = await Promise.all([
            this.prisma.automationFlow.count({
                where: { organizationId, isActive: true, isPaused: false },
            }),
            this.prisma.automationFlow.count({
                where: { organizationId, isPaused: true },
            }),
            this.prisma.automationLog.count({
                where: {
                    organizationId,
                    status: 'SUCCESS',
                    createdAt: { gte: range.from, lte: range.to },
                },
            }),
            this.prisma.automationLog.count({
                where: {
                    organizationId,
                    status: 'FAILED',
                    createdAt: { gte: range.from, lte: range.to },
                },
            }),
        ]);
        const recordCount = activeFlows + pausedFlows + logsSuccess + logsFailed;
        return { recordCount, data: { activeFlows, pausedFlows, logsSuccess, logsFailed } };
    }
};
exports.MarketingContextDatasourcesService = MarketingContextDatasourcesService;
exports.MarketingContextDatasourcesService = MarketingContextDatasourcesService = MarketingContextDatasourcesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MarketingContextDatasourcesService);
