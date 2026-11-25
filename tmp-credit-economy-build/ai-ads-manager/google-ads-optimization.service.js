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
var GoogleAdsOptimizationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleAdsOptimizationService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../prisma/prisma.service");
const openai_service_1 = require("../openai/openai.service");
const ads_efficiency_util_1 = require("./ads-efficiency.util");
/**
 * Google Ads Optimization Engine — deterministic analysis + proposals.
 * LLM chỉ explain; không quyết định action.
 */
let GoogleAdsOptimizationService = GoogleAdsOptimizationService_1 = class GoogleAdsOptimizationService {
    prisma;
    openAi;
    logger = new common_1.Logger(GoogleAdsOptimizationService_1.name);
    constructor(prisma, openAi) {
        this.prisma = prisma;
        this.openAi = openAi;
    }
    async analyze(user, dto) {
        const customerId = (0, shared_1.normalizeGoogleCustomerId)(dto.customerId);
        if (!customerId)
            throw new common_1.BadRequestException('Customer ID không hợp lệ');
        await this.assertCustomerOwned(user.organizationId, customerId);
        const dateTo = dto.dateTo ? new Date(dto.dateTo) : new Date();
        const dateFrom = dto.dateFrom
            ? new Date(dto.dateFrom)
            : new Date(dateTo.getTime() - 7 * 86400000);
        const account = await this.prisma.adAccount.findFirst({
            where: {
                organizationId: user.organizationId,
                platform: 'GOOGLE',
                externalId: customerId.replace(/-/g, ''),
            },
        });
        const campaigns = await this.prisma.adCampaign.findMany({
            where: {
                organizationId: user.organizationId,
                platform: 'GOOGLE',
                ...(account ? { adAccountId: account.id } : {}),
            },
            include: {
                dailyStats: {
                    where: { date: { gte: dateFrom, lte: dateTo } },
                },
            },
            take: 100,
        });
        if (campaigns.length === 0) {
            const fallback = await this.loadFromAdManagerInsights(user.organizationId, dateFrom, dateTo, dto);
            return fallback;
        }
        const campaignSnapshots = campaigns.map((c) => {
            const rows = c.dailyStats.map((s) => ({
                date: s.date,
                spend: (0, ads_efficiency_util_1.decimalToNumber)(s.spend),
                impressions: s.impressions,
                clicks: s.clicks,
                conversions: (0, ads_efficiency_util_1.decimalToNumber)(s.conversions),
                leads: s.leads,
                conversionValue: (0, ads_efficiency_util_1.decimalToNumber)(s.conversionValue),
                ctr: s.ctr != null ? (0, ads_efficiency_util_1.decimalToNumber)(s.ctr) : null,
                cpc: s.cpc != null ? (0, ads_efficiency_util_1.decimalToNumber)(s.cpc) : null,
                cpa: s.cpa != null ? (0, ads_efficiency_util_1.decimalToNumber)(s.cpa) : null,
                roas: s.roas != null ? (0, ads_efficiency_util_1.decimalToNumber)(s.roas) : null,
            }));
            return (0, shared_1.aggregateDailyStatsToSnapshot)({
                entityType: 'CAMPAIGN',
                entityId: c.id,
                entityName: c.name,
                externalId: c.externalId ?? undefined,
                status: c.status,
                budget: c.budget != null ? (0, ads_efficiency_util_1.decimalToNumber)(c.budget) : null,
                startedAt: c.startDate,
                rows,
            });
        });
        const keywords = await this.prisma.adKeyword.findMany({
            where: {
                organizationId: user.organizationId,
                adCampaignId: { in: campaigns.map((c) => c.id) },
            },
            take: 200,
        });
        const keywordSnapshots = keywords.map((kw) => (0, shared_1.aggregateDailyStatsToSnapshot)({
            entityType: 'KEYWORD',
            entityId: kw.id,
            entityName: kw.text,
            externalId: kw.externalId,
            campaignId: kw.adCampaignId,
            adGroupId: kw.adSetId,
            status: kw.status,
            rows: [],
        }));
        const searchTermRows = await this.prisma.adSearchTermStat.findMany({
            where: {
                organizationId: user.organizationId,
                adCampaignId: { in: campaigns.map((c) => c.id) },
                date: { gte: dateFrom, lte: dateTo },
            },
            take: 500,
        });
        const termMap = new Map();
        for (const row of searchTermRows) {
            const key = `${row.adCampaignId}:${row.searchTerm}`;
            const prev = termMap.get(key) ?? {
                searchTerm: row.searchTerm,
                adCampaignId: row.adCampaignId,
                adSetId: row.adSetId,
                spend: 0,
                clicks: 0,
                impressions: 0,
                conversions: 0,
                ctr: 0,
                cpc: 0,
            };
            prev.spend += (0, ads_efficiency_util_1.decimalToNumber)(row.spend);
            prev.clicks += row.clicks;
            prev.impressions += row.impressions;
            prev.conversions += (0, ads_efficiency_util_1.decimalToNumber)(row.conversions);
            termMap.set(key, prev);
        }
        for (const t of termMap.values()) {
            t.ctr = t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0;
            t.cpc = t.clicks > 0 ? t.spend / t.clicks : 0;
        }
        const autopilotCfg = await this.prisma.googleAdsAutopilotConfig.findUnique({
            where: {
                organizationId_customerId: { organizationId: user.organizationId, customerId },
            },
        });
        return (0, shared_1.runGoogleAdsOptimizationEngine)({
            customerId,
            guard: shared_1.optimizationMinimumDataGuardSchema.parse({
                minClicks: dto.minClicks ?? 30,
                gracePeriodHours: dto.gracePeriodHours ?? autopilotCfg?.gracePeriodHours ?? 24,
            }),
            thresholds: shared_1.optimizationThresholdsSchema.parse({
                targetCpa: dto.targetCpa ?? (autopilotCfg?.targetCpa ? (0, ads_efficiency_util_1.decimalToNumber)(autopilotCfg.targetCpa) : null),
                targetCpl: autopilotCfg?.targetCpl ? (0, ads_efficiency_util_1.decimalToNumber)(autopilotCfg.targetCpl) : null,
                targetRoas: dto.targetRoas ?? (autopilotCfg?.targetRoas ? (0, ads_efficiency_util_1.decimalToNumber)(autopilotCfg.targetRoas) : null),
            }),
            campaigns: campaignSnapshots,
            keywords: keywordSnapshots,
            searchTerms: [...termMap.values()],
        });
    }
    async explain(user, result) {
        if (!this.openAi.isConfigured()) {
            return {
                configured: false,
                explanation: {
                    summary: 'OpenAI chưa cấu hình — chỉ trả proposals deterministic.',
                    proposalExplanations: result.proposals.map((_, i) => ({
                        proposalIndex: i,
                        explanation: result.proposals[i]?.reason ?? '',
                        disclaimer: 'Quyết định cuối do rule engine + guardrail backend',
                    })),
                },
            };
        }
        const { system, user: userPrompt } = (0, shared_1.buildOptimizationExplanationPrompt)(result);
        const raw = await this.openAi.chatCompletion({
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.2,
            maxTokens: 1200,
        });
        let parsed;
        try {
            parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim());
        }
        catch {
            parsed = {
                summary: raw.slice(0, 500),
                proposalExplanations: result.proposals.map((p, i) => ({
                    proposalIndex: i,
                    explanation: p.reason,
                    disclaimer: 'Quyết định cuối do rule engine + guardrail backend',
                })),
            };
        }
        return {
            configured: true,
            explanation: shared_1.optimizationLlmExplanationSchema.parse(parsed),
        };
    }
    async loadFromAdManagerInsights(organizationId, dateFrom, dateTo, dto) {
        const insights = await this.prisma.adInsight.findMany({
            where: {
                organizationId,
                platform: 'GOOGLE',
                dateFrom: { lte: dateTo },
                dateTo: { gte: dateFrom },
            },
            include: { campaign: true },
            take: 100,
        });
        if (insights.length === 0) {
            throw new common_1.NotFoundException('Chưa có dữ liệu Google Ads — sync trước khi optimize');
        }
        const campaignSnapshots = insights
            .filter((r) => r.campaign)
            .map((r) => (0, shared_1.aggregateDailyStatsToSnapshot)({
            entityType: 'CAMPAIGN',
            entityId: r.campaign.id,
            entityName: r.campaignName,
            externalId: r.externalCampaignId,
            status: r.campaign.status,
            budget: r.campaign.budget != null ? (0, ads_efficiency_util_1.decimalToNumber)(r.campaign.budget) : null,
            startedAt: r.campaign.startDate,
            rows: [
                {
                    date: r.dateTo,
                    spend: (0, ads_efficiency_util_1.decimalToNumber)(r.spend),
                    impressions: r.impressions,
                    clicks: r.clicks,
                    conversions: (0, ads_efficiency_util_1.decimalToNumber)(r.conversions),
                    leads: (0, ads_efficiency_util_1.decimalToNumber)(r.leads),
                    conversionValue: (0, ads_efficiency_util_1.decimalToNumber)(r.conversionValue),
                    ctr: r.ctr != null ? (0, ads_efficiency_util_1.decimalToNumber)(r.ctr) : null,
                    cpc: r.cpc != null ? (0, ads_efficiency_util_1.decimalToNumber)(r.cpc) : null,
                    cpa: r.cpa != null ? (0, ads_efficiency_util_1.decimalToNumber)(r.cpa) : null,
                    roas: r.roas != null ? (0, ads_efficiency_util_1.decimalToNumber)(r.roas) : null,
                },
            ],
        }));
        return (0, shared_1.runGoogleAdsOptimizationEngine)({
            customerId: dto.customerId,
            guard: shared_1.optimizationMinimumDataGuardSchema.parse({
                minClicks: dto.minClicks ?? 30,
                gracePeriodHours: dto.gracePeriodHours ?? 24,
            }),
            thresholds: shared_1.optimizationThresholdsSchema.parse({
                targetCpa: dto.targetCpa ?? null,
                targetRoas: dto.targetRoas ?? null,
            }),
            campaigns: campaignSnapshots,
        });
    }
    async assertCustomerOwned(organizationId, customerId) {
        const account = await this.prisma.adGoogleAdsAccount.findFirst({
            where: { organizationId, customerId, isSelected: true },
        });
        if (!account) {
            throw new common_1.ForbiddenException('Tài khoản Google Ads không thuộc tenant hoặc chưa được chọn');
        }
        return account;
    }
};
exports.GoogleAdsOptimizationService = GoogleAdsOptimizationService;
exports.GoogleAdsOptimizationService = GoogleAdsOptimizationService = GoogleAdsOptimizationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        openai_service_1.OpenAiService])
], GoogleAdsOptimizationService);
