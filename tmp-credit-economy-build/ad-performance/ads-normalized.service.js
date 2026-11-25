"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AdsNormalizedService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdsNormalizedService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const ads_efficiency_util_1 = require("../ai-ads-manager/ads-efficiency.util");
/**
 * Lớp metric chuẩn hóa org-scoped.
 * Sync Meta → FacebookAdsCampaignSnapshot → materialize vào AdManagerCampaign + AdInsight.
 * ai-ads-manager chỉ đọc từ đây — không sync provider / không đụng token.
 */
let AdsNormalizedService = AdsNormalizedService_1 = class AdsNormalizedService {
    prisma;
    logger = new common_1.Logger(AdsNormalizedService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    /**
     * Materialize snapshots Meta (sau FacebookAdsService.sync) vào bảng chuẩn hóa AI đọc.
     * Adapter tương thích: giữ FacebookAdsCampaignSnapshot; đồng bộ sang AdInsight.
     */
    async materializeMetaSnapshots(organizationId, userId, dateFrom, dateTo) {
        const meta = await this.prisma.facebookAdsConnection.findUnique({
            where: { organizationId },
        });
        const adAccountId = meta?.selectedAdAccountId;
        if (!adAccountId)
            return 0;
        const snapshots = await this.prisma.facebookAdsCampaignSnapshot.findMany({
            where: { organizationId, dateFrom, dateTo },
        });
        const account = await this.ensurePlatformAccount(organizationId, userId, database_1.AdPlatform.META, adAccountId, meta?.selectedAdAccountName ?? adAccountId);
        const { normalizeAdsMetrics } = await Promise.resolve().then(() => __importStar(require('@marketingspa/shared')));
        const timezone = account.timezone || 'UTC';
        const currency = account.currency || 'USD';
        const dateKey = dateFrom.toISOString().slice(0, 10);
        let count = 0;
        for (const snap of snapshots) {
            const spend = (0, ads_efficiency_util_1.decimalToNumber)(snap.spend);
            const conversions = (0, ads_efficiency_util_1.decimalToNumber)(snap.results);
            const purchaseRoas = snap.purchaseRoas ? (0, ads_efficiency_util_1.decimalToNumber)(snap.purchaseRoas) : null;
            // conversionValue từ ROAS khi có — không làm tròn sớm
            const conversionValue = purchaseRoas != null && spend > 0 ? spend * purchaseRoas : 0;
            const normalized = normalizeAdsMetrics({
                impressions: snap.impressions,
                reach: snap.reach,
                clicks: snap.clicks,
                spend,
                conversions,
                conversionValue,
                currency,
                date: dateKey,
                conversionActions: conversions > 0
                    ? [
                        {
                            type: snap.campaignType || 'result',
                            count: conversions,
                            value: conversionValue || undefined,
                        },
                    ]
                    : [],
                recomputeRates: true,
            });
            const metrics = {
                spend: normalized.spend,
                revenue: normalized.conversionValue,
                impressions: normalized.impressions,
                clicks: normalized.clicks,
                ctr: normalized.ctr ?? 0,
                cpc: normalized.cpc ?? 0,
                cpm: normalized.cpm ?? 0,
                conversions: normalized.conversions,
                leads: 0,
                cpa: normalized.cpa ?? 0,
                cpl: null,
                roas: normalized.roas,
            };
            const score = (0, ads_efficiency_util_1.computeEfficiencyScore)(metrics);
            const suggestion = (0, ads_efficiency_util_1.buildAiSuggestion)(metrics, score);
            const campaign = await this.prisma.adManagerCampaign.upsert({
                where: {
                    userId_platform_externalId: {
                        userId,
                        platform: database_1.AdPlatform.META,
                        externalId: snap.campaignId,
                    },
                },
                create: {
                    userId,
                    organizationId,
                    accountId: account.id,
                    platform: database_1.AdPlatform.META,
                    externalId: snap.campaignId,
                    name: snap.campaignName,
                    status: database_1.AdCampaignStatus.ACTIVE,
                    objective: snap.objective,
                    lastSyncedAt: snap.syncedAt,
                },
                update: {
                    name: snap.campaignName,
                    objective: snap.objective,
                    lastSyncedAt: snap.syncedAt,
                    organizationId,
                },
            });
            const insightData = {
                organizationId,
                campaignId: campaign.id,
                campaignName: snap.campaignName,
                date: dateFrom,
                spend: normalized.spend,
                revenue: normalized.conversionValue,
                conversionValue: normalized.conversionValue,
                impressions: Math.floor(normalized.impressions),
                clicks: Math.floor(normalized.clicks),
                ctr: normalized.ctr,
                cpc: normalized.cpc,
                cpm: normalized.cpm,
                reach: Math.floor(normalized.reach),
                frequency: (0, ads_efficiency_util_1.decimalToNumber)(snap.frequency),
                conversions: normalized.conversions,
                leads: 0,
                cpa: normalized.cpa,
                cpl: null,
                roas: normalized.roas,
                currency: normalized.currency,
                timezone,
                conversionActions: normalized.conversionActions,
                efficiencyScore: score,
                aiSuggestion: suggestion,
                syncedAt: snap.syncedAt,
            };
            await this.prisma.adInsight.upsert({
                where: {
                    userId_platform_externalCampaignId_dateFrom_dateTo: {
                        userId,
                        platform: database_1.AdPlatform.META,
                        externalCampaignId: snap.campaignId,
                        dateFrom,
                        dateTo,
                    },
                },
                create: {
                    userId,
                    platform: database_1.AdPlatform.META,
                    externalCampaignId: snap.campaignId,
                    dateFrom,
                    dateTo,
                    rawMetrics: {
                        source: 'FacebookAdsCampaignSnapshot',
                        campaignType: snap.campaignType,
                    },
                    ...insightData,
                },
                update: insightData,
            });
            count += 1;
        }
        await this.prisma.adConnection.updateMany({
            where: { organizationId, provider: 'META' },
            data: { lastSyncAt: new Date(), lastError: null, userId },
        });
        this.logger.log(`Materialized ${count} Meta campaigns → AdInsight org=${organizationId}`);
        return count;
    }
    async listInsights(organizationId, dateFrom, dateTo, opts) {
        const page = opts?.page ?? 1;
        const pageSize = opts?.pageSize ?? 20;
        const where = {
            organizationId,
            dateFrom: new Date(dateFrom),
            dateTo: new Date(dateTo),
            ...(opts?.platform ? { platform: opts.platform } : {}),
        };
        const [total, items] = await Promise.all([
            this.prisma.adInsight.count({ where }),
            this.prisma.adInsight.findMany({
                where,
                include: { campaign: true },
                orderBy: { spend: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
        ]);
        return { total, page, pageSize, items };
    }
    toPublicMetricsRow(row) {
        const conversionValue = row.conversionValue != null
            ? (0, ads_efficiency_util_1.decimalToNumber)(row.conversionValue)
            : (0, ads_efficiency_util_1.decimalToNumber)(row.revenue);
        return {
            insightId: row.id,
            id: row.campaignId ?? row.id,
            organizationId: row.organizationId,
            platform: row.platform,
            externalCampaignId: row.externalCampaignId,
            name: row.campaignName,
            campaignName: row.campaignName,
            status: row.campaign?.status ?? 'ACTIVE',
            budget: row.campaign?.budget ? (0, ads_efficiency_util_1.decimalToNumber)(row.campaign.budget) : null,
            dateFrom: row.dateFrom.toISOString().slice(0, 10),
            dateTo: row.dateTo.toISOString().slice(0, 10),
            date: (row.date ?? row.dateFrom).toISOString().slice(0, 10),
            impressions: row.impressions,
            reach: row.reach,
            clicks: row.clicks,
            spend: (0, ads_efficiency_util_1.decimalToNumber)(row.spend),
            conversions: (0, ads_efficiency_util_1.decimalToNumber)(row.conversions),
            conversionValue,
            ctr: row.ctr != null ? (0, ads_efficiency_util_1.decimalToNumber)(row.ctr) : null,
            cpc: row.cpc != null ? (0, ads_efficiency_util_1.decimalToNumber)(row.cpc) : null,
            cpm: row.cpm != null ? (0, ads_efficiency_util_1.decimalToNumber)(row.cpm) : null,
            cpa: row.cpa != null ? (0, ads_efficiency_util_1.decimalToNumber)(row.cpa) : null,
            roas: row.roas != null ? (0, ads_efficiency_util_1.decimalToNumber)(row.roas) : null,
            currency: row.currency ?? 'USD',
            timezone: row.timezone ?? 'UTC',
            conversionActions: Array.isArray(row.conversionActions) ? row.conversionActions : [],
            efficiencyScore: row.efficiencyScore,
            aiSuggestion: row.aiSuggestion,
            /** tương thích FE cũ */
            leads: 0,
            externalId: row.externalCampaignId,
        };
    }
    async getDashboard(organizationId, dateFrom, dateTo) {
        const { items: insights } = await this.listInsights(organizationId, dateFrom, dateTo, {
            page: 1,
            pageSize: 500,
        });
        const campaigns = await this.prisma.adManagerCampaign.findMany({
            where: { organizationId },
        });
        let totalSpend = 0;
        let totalRevenue = 0;
        let totalConversions = 0;
        let poorCount = 0;
        for (const row of insights) {
            totalSpend += (0, ads_efficiency_util_1.decimalToNumber)(row.spend);
            const cv = row.conversionValue != null
                ? (0, ads_efficiency_util_1.decimalToNumber)(row.conversionValue)
                : (0, ads_efficiency_util_1.decimalToNumber)(row.revenue);
            totalRevenue += cv;
            totalConversions += (0, ads_efficiency_util_1.decimalToNumber)(row.conversions) + (0, ads_efficiency_util_1.decimalToNumber)(row.leads);
            if ((row.efficiencyScore ?? 50) < 40)
                poorCount += 1;
        }
        const roas = totalSpend > 0 ? totalRevenue / totalSpend : null;
        const cpa = totalConversions > 0 ? totalSpend / totalConversions : null;
        return {
            dateFrom,
            dateTo,
            totalSpend,
            totalRevenue,
            conversionValue: totalRevenue,
            roas,
            cpa,
            cpl: cpa,
            totalConversions,
            activeCampaigns: campaigns.filter((c) => c.status === 'ACTIVE').length,
            poorCampaigns: poorCount,
            profit: totalRevenue - totalSpend,
            source: 'AdsNormalizedService',
        };
    }
    /**
     * @deprecated Google sync thật qua BullMQ (`enqueueGoogleSync`). Giữ method để tránh break import.
     */
    async syncGoogleStub(_organizationId) {
        return {
            synced: 0,
            deprecated: true,
            message: 'Google Ads mock đã tắt. Dùng OAuth /ad-performance/google và POST sync (BullMQ).',
        };
    }
    async ensurePlatformAccount(organizationId, userId, platform, externalId, name) {
        const existing = await this.prisma.adPlatformAccount.findFirst({
            where: { organizationId, platform, externalId },
        });
        if (existing) {
            return this.prisma.adPlatformAccount.update({
                where: { id: existing.id },
                data: { name, isActive: true },
            });
        }
        return this.prisma.adPlatformAccount.create({
            data: {
                userId,
                organizationId,
                platform,
                externalId,
                name,
            },
        });
    }
};
exports.AdsNormalizedService = AdsNormalizedService;
exports.AdsNormalizedService = AdsNormalizedService = AdsNormalizedService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdsNormalizedService);
