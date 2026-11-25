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
var AiAdsManagerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiAdsManagerService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const facebook_ads_service_1 = require("../ad-performance/facebook-ads/facebook-ads.service");
const google_ads_service_1 = require("../ad-performance/google-ads/google-ads.service");
const ad_connection_facade_1 = require("../ad-performance/ad-connection.facade");
const ads_sync_queue_service_1 = require("../ad-performance/ads-sync-queue.service");
const ads_mcp_gateway_1 = require("../ads-mcp/ads-mcp.gateway");
const ads_mcp_context_1 = require("../ads-mcp/ads-mcp.context");
const ads_action_service_1 = require("../ads-actions/ads-action.service");
const openai_service_1 = require("../openai/openai.service");
const tenant_kpi_cache_service_1 = require("../common/services/tenant-kpi-cache.service");
const crypto_1 = require("crypto");
const ads_automation_engine_1 = require("./ads-automation.engine");
const ads_efficiency_util_1 = require("./ads-efficiency.util");
let AiAdsManagerService = AiAdsManagerService_1 = class AiAdsManagerService {
    prisma;
    config;
    facebookAds;
    googleAds;
    connections;
    adsSyncQueue;
    adsMcp;
    adsActions;
    openAi;
    kpiCache;
    logger = new common_1.Logger(AiAdsManagerService_1.name);
    constructor(prisma, config, facebookAds, googleAds, connections, adsSyncQueue, adsMcp, adsActions, openAi, kpiCache) {
        this.prisma = prisma;
        this.config = config;
        this.facebookAds = facebookAds;
        this.googleAds = googleAds;
        this.connections = connections;
        this.adsSyncQueue = adsSyncQueue;
        this.adsMcp = adsMcp;
        this.adsActions = adsActions;
        this.openAi = openAi;
        this.kpiCache = kpiCache;
    }
    /** Đọc dashboard chỉ qua Internal Ads MCP Gateway (PostgreSQL). */
    async getDashboard(user, dateFrom, dateTo) {
        const cacheName = `ads:${dateFrom}:${dateTo}`;
        const cached = await this.kpiCache?.getJson(user.organizationId, cacheName);
        if (cached)
            return cached;
        const ctx = (0, ads_mcp_context_1.tenantFromAuthUser)(user);
        const m = await this.adsMcp.getMetrics(ctx, { dateFrom, dateTo });
        const { assertNoCredentialLeak } = await Promise.resolve().then(() => __importStar(require('../common/utils/token-security.util')));
        const payload = {
            dateFrom: m.dateFrom,
            dateTo: m.dateTo,
            totalSpend: m.totalSpend,
            totalRevenue: m.conversionValue,
            conversionValue: m.conversionValue,
            roas: m.roas,
            cpa: m.cpa,
            cpl: m.cpa,
            totalConversions: m.totalConversions,
            activeCampaigns: m.activeCampaigns,
            poorCampaigns: m.poorCampaigns,
            profit: m.conversionValue - m.totalSpend,
            source: 'AdsMcpGateway',
            evidence: m.evidence,
        };
        assertNoCredentialLeak(payload);
        await this.kpiCache?.setJson(user.organizationId, cacheName, payload, 20);
        return payload;
    }
    /** Accounts từ MCP — không gọi Meta/Google status API. */
    async getConnections(user) {
        const ctx = (0, ads_mcp_context_1.tenantFromAuthUser)(user);
        const res = await this.adsMcp.listAccounts(ctx);
        return {
            items: res.items.map((a) => ({
                provider: a.platform,
                status: a.status,
                accountName: a.accountName,
                lastSyncAt: a.lastSyncAt,
                lastError: a.lastError,
                connected: a.connected,
                credentialSource: 'AdConnection',
            })),
            source: 'AdsMcpGateway',
        };
    }
    getMetaOAuthStart(user) {
        return this.facebookAds.getOAuthStartUrl(user, 'ads');
    }
    getGoogleOAuthStart(user) {
        return this.googleAds.getOAuthStartUrl(user, 'ads');
    }
    listGoogleCustomers(user) {
        return this.googleAds.listCustomers(user);
    }
    selectGoogleCustomer(user, dto) {
        return this.googleAds.selectCustomer(user, dto);
    }
    listGoogleLinkedAccounts(user) {
        return this.googleAds.listLinkedAccounts(user);
    }
    selectGoogleAccounts(user, dto) {
        return this.googleAds.selectAccounts(user, dto);
    }
    syncGoogleOnly(user, dto) {
        return this.googleAds.sync(user, dto ?? {});
    }
    /** @deprecated Paste refresh token bị từ chối — dùng OAuth */
    async connectGoogle(_user, dto) {
        if (dto.refreshToken) {
            throw new common_1.BadRequestException('Không chấp nhận paste Google refresh token. Dùng OAuth: GET /ad-performance/google/oauth/start');
        }
        throw new common_1.BadRequestException('Kết nối Google Ads qua OAuth: GET /ai-ads-manager/google/oauth/start hoặc /ad-performance/google/oauth/start');
    }
    async connectGmail(user, dto) {
        await this.connections.upsertEncryptedCredentials({
            organizationId: user.organizationId,
            userId: user.id,
            provider: database_1.AdConnectionProvider.GMAIL,
            plaintextPayload: JSON.stringify({ refreshToken: dto.refreshToken, email: dto.email }),
            status: database_1.AdConnectionStatus.CONNECTED,
            externalAccountId: dto.email,
            externalAccountName: dto.email,
            scopes: ['https://www.googleapis.com/auth/gmail.send'],
        });
        return { ok: true };
    }
    async disconnect(user, provider) {
        if (provider === 'META') {
            await this.facebookAds.disconnect(user);
            return { ok: true };
        }
        if (provider === 'GOOGLE') {
            await this.googleAds.disconnect(user);
            return { ok: true };
        }
        await this.connections.clearCredentials(user.organizationId, provider, user.id);
        return { ok: true };
    }
    async listSyncJobs(user, limit = 30) {
        return this.adsSyncQueue.listJobs(user, limit);
    }
    async getSyncJob(user, jobId) {
        return this.adsSyncQueue.getJob(user, jobId);
    }
    async sync(user, dto) {
        const platforms = dto.platform ? [dto.platform] : [database_1.AdPlatform.META, database_1.AdPlatform.GOOGLE];
        const results = [];
        for (const platform of platforms) {
            if (platform === 'META') {
                const res = await this.facebookAds.sync(user, {
                    dateFrom: dto.dateFrom,
                    dateTo: dto.dateTo,
                });
                results.push({
                    platform: 'META',
                    synced: 0,
                    jobId: res.jobId,
                    queued: res.queued,
                    status: res.status,
                    message: res.message,
                });
            }
            else if (platform === 'GOOGLE') {
                const res = await this.adsSyncQueue.enqueueGoogleSync(user, {
                    dateFrom: dto.dateFrom,
                    dateTo: dto.dateTo,
                });
                results.push({
                    platform: 'GOOGLE',
                    synced: 0,
                    jobId: res.jobId,
                    queued: res.queued,
                    status: res.status,
                    message: res.message,
                });
            }
        }
        await this.runAutomationAfterSync(user, dto.dateFrom, dto.dateTo);
        return { results };
    }
    async getCampaigns(user, dateFrom, dateTo, opts) {
        const { assertNoCredentialLeak } = await Promise.resolve().then(() => __importStar(require('../common/utils/token-security.util')));
        const ctx = (0, ads_mcp_context_1.tenantFromAuthUser)(user);
        const limit = Math.min(opts?.pageSize ?? 20, 50);
        const page = opts?.page ?? 1;
        const mcp = await this.adsMcp.listCampaigns(ctx, {
            dateFrom,
            dateTo,
            platform: opts?.platform,
            limit: Math.min(limit * page, 50),
        });
        // MCP trả top-N theo spend; phân trang đơn giản trên kết quả đã giới hạn
        const start = (page - 1) * limit;
        const slice = mcp.items.slice(start, start + limit);
        const payload = {
            total: mcp.total,
            page,
            pageSize: limit,
            source: 'AdsMcpGateway',
            items: slice.map((c) => ({
                insightId: c.insightId ?? c.campaignId,
                id: c.campaignId,
                organizationId: user.organizationId,
                platform: c.platform,
                externalCampaignId: c.campaignId,
                name: c.name,
                campaignName: c.name,
                status: c.status,
                budget: null,
                dateFrom: c.dateFrom ?? dateFrom,
                dateTo: c.dateTo ?? dateTo,
                date: c.dateFrom ?? dateFrom,
                impressions: c.impressions,
                reach: 0,
                clicks: c.clicks,
                spend: c.spend,
                conversions: c.conversions,
                conversionValue: c.conversionValue,
                ctr: c.ctr,
                cpc: c.cpc,
                cpm: c.cpm,
                cpa: c.cpa,
                roas: c.roas,
                currency: c.currency ?? 'USD',
                timezone: 'UTC',
                conversionActions: [],
                efficiencyScore: c.efficiencyScore ?? null,
                aiSuggestion: null,
                leads: 0,
                externalId: c.campaignId,
            })),
        };
        assertNoCredentialLeak(payload);
        return payload;
    }
    async getSettings(user) {
        const settings = await this.ensureSettings(user);
        return {
            autoModeEnabled: settings.autoModeEnabled,
            mcpMode: (0, ads_automation_engine_1.normalizeMcpMode)(settings.mcpMode),
            dailyBudgetLimit: settings.dailyBudgetLimit
                ? (0, ads_efficiency_util_1.decimalToNumber)(settings.dailyBudgetLimit)
                : null,
            maxTogglesPerDay: settings.maxTogglesPerDay,
            togglesToday: settings.togglesToday,
            maxBudgetChangePercent: settings.maxBudgetChangePercent,
            ruleLookbackDays: settings.ruleLookbackDays,
            ruleCooldownMinutes: settings.ruleCooldownMinutes,
            minSpendForAction: settings.minSpendForAction
                ? (0, ads_efficiency_util_1.decimalToNumber)(settings.minSpendForAction)
                : null,
            emergencyStop: settings.emergencyStop,
        };
    }
    async updateAutoMode(user, dto) {
        if (dto.autoModeEnabled || dto.mcpMode === 'AUTO') {
            await this.ensureSettings(user);
        }
        const mcpMode = dto.mcpMode ? (0, ads_automation_engine_1.normalizeMcpMode)(dto.mcpMode) : undefined;
        let autoModeEnabled = dto.autoModeEnabled;
        if (mcpMode === 'AUTO')
            autoModeEnabled = true;
        if (mcpMode === 'OBSERVE')
            autoModeEnabled = false;
        const settings = await this.prisma.adManagerSettings.upsert({
            where: { userId: user.id },
            create: {
                userId: user.id,
                organizationId: user.organizationId,
                autoModeEnabled,
                mcpMode: mcpMode ?? 'SUGGEST',
                dailyBudgetLimit: dto.dailyBudgetLimit,
                maxTogglesPerDay: dto.maxTogglesPerDay ?? 10,
                maxBudgetChangePercent: dto.maxBudgetChangePercent ?? 20,
                ruleLookbackDays: dto.ruleLookbackDays ?? 7,
                ruleCooldownMinutes: dto.ruleCooldownMinutes ?? 60,
                minSpendForAction: dto.minSpendForAction,
            },
            update: {
                autoModeEnabled,
                ...(mcpMode && { mcpMode }),
                ...(dto.dailyBudgetLimit !== undefined && { dailyBudgetLimit: dto.dailyBudgetLimit }),
                ...(dto.maxTogglesPerDay !== undefined && { maxTogglesPerDay: dto.maxTogglesPerDay }),
                ...(dto.maxBudgetChangePercent !== undefined && {
                    maxBudgetChangePercent: dto.maxBudgetChangePercent,
                }),
                ...(dto.ruleLookbackDays !== undefined && { ruleLookbackDays: dto.ruleLookbackDays }),
                ...(dto.ruleCooldownMinutes !== undefined && {
                    ruleCooldownMinutes: dto.ruleCooldownMinutes,
                }),
                ...(dto.minSpendForAction !== undefined && {
                    minSpendForAction: dto.minSpendForAction,
                }),
            },
        });
        await this.prisma.adAutomationLog.create({
            data: {
                userId: user.id,
                organizationId: user.organizationId,
                platform: 'META',
                action: database_1.AdAutomationAction.RECOMMEND,
                autoMode: settings.autoModeEnabled,
                reason: `MCP mode=${(0, ads_automation_engine_1.normalizeMcpMode)(settings.mcpMode)}; auto=${settings.autoModeEnabled}`,
                snapshot: { settings },
            },
        });
        return this.getSettings(user);
    }
    async setEmergencyStop(user, emergencyStop) {
        await this.prisma.adManagerSettings.upsert({
            where: { userId: user.id },
            create: {
                userId: user.id,
                organizationId: user.organizationId,
                emergencyStop,
                autoModeEnabled: false,
            },
            update: { emergencyStop, ...(emergencyStop && { autoModeEnabled: false }) },
        });
        return { emergencyStop };
    }
    async listRules(user) {
        const items = await this.prisma.adAutomationRule.findMany({
            where: { organizationId: user.organizationId },
            orderBy: { createdAt: 'desc' },
        });
        return {
            items: items.map((r) => ({
                ...r,
                threshold: r.threshold ? (0, ads_efficiency_util_1.decimalToNumber)(r.threshold) : null,
                spendThreshold: r.spendThreshold ? (0, ads_efficiency_util_1.decimalToNumber)(r.spendThreshold) : null,
            })),
        };
    }
    async createRule(user, dto) {
        const rule = await this.prisma.adAutomationRule.create({
            data: {
                userId: user.id,
                organizationId: user.organizationId,
                name: dto.name,
                ruleType: dto.ruleType,
                platform: dto.platform,
                threshold: dto.threshold,
                spendThreshold: dto.spendThreshold,
                enabled: dto.enabled ?? true,
            },
        });
        return rule;
    }
    async updateRule(user, id, dto) {
        const existing = await this.prisma.adAutomationRule.findFirst({
            where: { id, organizationId: user.organizationId },
        });
        if (!existing)
            throw new common_1.NotFoundException('Rule không tồn tại');
        return this.prisma.adAutomationRule.update({
            where: { id },
            data: {
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.threshold !== undefined && { threshold: dto.threshold }),
                ...(dto.spendThreshold !== undefined && { spendThreshold: dto.spendThreshold }),
                ...(dto.enabled !== undefined && { enabled: dto.enabled }),
            },
        });
    }
    async deleteRule(user, id) {
        const existing = await this.prisma.adAutomationRule.findFirst({
            where: { id, organizationId: user.organizationId },
        });
        if (!existing)
            throw new common_1.NotFoundException('Rule không tồn tại');
        await this.prisma.adAutomationRule.delete({ where: { id } });
        return { ok: true };
    }
    async pauseCampaign(user, campaignId) {
        return this.toggleCampaign(user, campaignId, 'PAUSED', true);
    }
    async enableCampaign(user, campaignId) {
        return this.toggleCampaign(user, campaignId, 'ACTIVE', true);
    }
    async listLogs(user, limit = 50) {
        const items = await this.prisma.adAutomationLog.findMany({
            where: { organizationId: user.organizationId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: { rule: { select: { name: true, ruleType: true } } },
        });
        return { items };
    }
    async listDrafts(user) {
        const items = await this.prisma.adDraft.findMany({
            where: { organizationId: user.organizationId },
            orderBy: { createdAt: 'desc' },
        });
        return {
            items: items.map((d) => ({
                ...d,
                budget: d.budget ? (0, ads_efficiency_util_1.decimalToNumber)(d.budget) : null,
            })),
        };
    }
    async generateDraft(user, dto) {
        const settings = await this.ensureSettings(user);
        if (dto.budget && settings.dailyBudgetLimit) {
            const limit = (0, ads_efficiency_util_1.decimalToNumber)(settings.dailyBudgetLimit);
            if (dto.budget > limit) {
                throw new common_1.BadRequestException(`Ngân sách vượt giới hạn ${limit}/ngày`);
            }
        }
        const ctx = (0, ads_mcp_context_1.tenantFromAuthUser)(user);
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - 7);
        const dateFrom = from.toISOString().slice(0, 10);
        const dateTo = to.toISOString().slice(0, 10);
        let evidenceNote = '';
        try {
            const metrics = await this.adsMcp.getMetrics(ctx, { dateFrom, dateTo });
            const waste = await this.adsMcp.detectBudgetWaste(ctx, {
                dateFrom,
                dateTo,
                limit: 5,
            });
            evidenceNote = JSON.stringify({
                source: 'AdsMcpGateway',
                evidence: metrics.evidence,
                wasteSignals: waste.signals.slice(0, 3).map((s) => ({
                    code: s.code,
                    severity: s.severity,
                    campaignName: s.campaignName,
                    evidence: s.evidence,
                })),
            });
        }
        catch (err) {
            this.logger.warn(`MCP evidence for draft skipped: ${String(err)}`);
        }
        let content = {
            objective: dto.objective,
            audience: dto.audience ?? 'Khách hàng tiềm năng spa/beauty 25–45 tuổi',
            headline: `Ưu đãi ${dto.product ?? 'dịch vụ'} — đặt lịch ngay`,
            content: `Khám phá ${dto.product ?? 'dịch vụ'} với ưu đãi hấp dẫn. Liên hệ để được tư vấn miễn phí.`,
            cta: 'Đặt lịch ngay',
            landingPage: '/dat-lich',
        };
        if (this.openAi.isConfigured()) {
            try {
                const raw = await this.openAi.chatCompletion({
                    messages: [
                        {
                            role: 'system',
                            content: 'Bạn là chuyên gia quảng cáo Facebook/Google cho spa. Chỉ dùng số liệu evidence từ AdsMcpGateway (PostgreSQL), không giả định token/API provider. Trả về JSON: objective, audience, headline, content, cta, landingPage. Tiếng Việt.',
                        },
                        {
                            role: 'user',
                            content: `Tạo bản nháp quảng cáo ${dto.platform}: mục tiêu ${dto.objective}, sản phẩm ${dto.product ?? 'spa'}, ngân sách ${dto.budget ?? 'chưa xác định'}. Evidence: ${evidenceNote || 'không có'}`,
                        },
                    ],
                    temperature: 0.7,
                });
                const parsed = JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim());
                content = { ...content, ...parsed };
            }
            catch {
                this.logger.warn('AI draft fallback to template');
            }
        }
        const draft = await this.prisma.adDraft.create({
            data: {
                userId: user.id,
                organizationId: user.organizationId,
                platform: dto.platform,
                status: database_1.AdDraftStatus.DRAFT,
                objective: content.objective,
                budget: dto.budget,
                audience: content.audience,
                content: content.content,
                headline: content.headline,
                cta: content.cta,
                landingPage: content.landingPage,
                aiGenerated: true,
            },
        });
        return draft;
    }
    async publishDraft(user, draftId) {
        const draft = await this.prisma.adDraft.findFirst({
            where: { id: draftId, organizationId: user.organizationId },
        });
        if (!draft)
            throw new common_1.NotFoundException('Bản nháp không tồn tại');
        const updated = await this.prisma.adDraft.update({
            where: { id: draftId },
            data: { status: database_1.AdDraftStatus.PUBLISHED, publishedAt: new Date() },
        });
        await this.prisma.adAutomationLog.create({
            data: {
                userId: user.id,
                organizationId: user.organizationId,
                platform: draft.platform,
                action: database_1.AdAutomationAction.RECOMMEND,
                autoMode: false,
                reason: `User duyệt & đăng quảng cáo bản nháp ${draftId}`,
                snapshot: { draftId, headline: draft.headline },
            },
        });
        return updated;
    }
    async getEmailReports(user) {
        const items = await this.prisma.adEmailReport.findMany({
            where: { organizationId: user.organizationId },
        });
        return { items };
    }
    async upsertEmailReport(user, dto) {
        const existing = await this.prisma.adEmailReport.findFirst({
            where: { organizationId: user.organizationId },
        });
        if (existing) {
            return this.prisma.adEmailReport.update({
                where: { id: existing.id },
                data: dto,
            });
        }
        return this.prisma.adEmailReport.create({
            data: {
                userId: user.id,
                organizationId: user.organizationId,
                ...dto,
            },
        });
    }
    async sendReport(user, dateFrom, dateTo) {
        const dashboard = await this.getDashboard(user, dateFrom, dateTo);
        const campaigns = await this.getCampaigns(user, dateFrom, dateTo);
        const logs = await this.listLogs(user, 10);
        const report = await this.prisma.adEmailReport.findFirst({
            where: { organizationId: user.organizationId, enabled: true },
        });
        if (!report) {
            throw new common_1.BadRequestException('Chưa cấu hình Gmail báo cáo hoặc chưa bật gửi email');
        }
        const body = this.buildEmailBody(dashboard, campaigns.items, logs.items);
        this.logger.log(`Email report queued for user ${user.id} → ${report.recipientEmail} (${body.length} chars)`);
        await this.prisma.adEmailReport.update({
            where: { id: report.id },
            data: { lastSentAt: new Date() },
        });
        await this.prisma.adAutomationLog.create({
            data: {
                userId: user.id,
                organizationId: user.organizationId,
                platform: 'META',
                action: database_1.AdAutomationAction.RECOMMEND,
                autoMode: false,
                reason: `Gửi báo cáo email tới ${report.recipientEmail}`,
                snapshot: { dashboard, recipient: report.recipientEmail },
            },
        });
        return { ok: true, preview: body.slice(0, 500) };
    }
    async optimizeCampaign(user, campaignId) {
        const ctx = (0, ads_mcp_context_1.tenantFromAuthUser)(user);
        const analysis = await this.adsMcp.analyzeCampaign(ctx, { campaignId });
        const campaign = await this.prisma.adManagerCampaign.findFirst({
            where: { id: campaignId, organizationId: user.organizationId },
        });
        if (!campaign)
            throw new common_1.NotFoundException('Chiến dịch không tồn tại');
        const rec = await this.prisma.adAiRecommendation.create({
            data: {
                userId: user.id,
                organizationId: user.organizationId,
                campaignId,
                platform: campaign.platform,
                type: 'optimize',
                content: analysis.summary,
                priority: 100 - (analysis.efficiencyScore ?? 50),
            },
        });
        await this.prisma.adInsight.updateMany({
            where: { organizationId: user.organizationId, campaignId },
            data: {
                aiSuggestion: analysis.summary,
                efficiencyScore: analysis.efficiencyScore ?? undefined,
            },
        });
        // AI chỉ đề xuất — không tự duyệt / không tự đổi chiến dịch
        let actionRequest = null;
        const suggestedStatus = analysis.verdict === 'pause'
            ? 'PAUSED'
            : analysis.verdict === 'scale' || analysis.verdict === 'hold'
                ? campaign.status
                : campaign.status;
        if (analysis.verdict === 'pause' || analysis.verdict === 'optimize') {
            const actionType = analysis.verdict === 'pause' ? 'PAUSE_CAMPAIGN' : 'UPDATE_STATUS';
            const idempotencyKey = (0, crypto_1.createHash)('sha256')
                .update([
                user.organizationId,
                campaignId,
                actionType,
                analysis.verdict,
                new Date().toISOString().slice(0, 10),
            ].join(':'))
                .digest('hex')
                .slice(0, 64);
            actionRequest = await this.adsActions.propose(user, {
                campaignId,
                recommendationId: rec.id,
                platform: campaign.platform,
                actionType,
                source: 'AI',
                aiGenerated: true,
                submitForApproval: true,
                idempotencyKey,
                reason: analysis.summary,
                beforeState: {
                    campaignId: campaign.id,
                    status: campaign.status,
                    budget: campaign.budget != null ? (0, ads_efficiency_util_1.decimalToNumber)(campaign.budget) : null,
                    name: campaign.name,
                    platform: campaign.platform,
                    externalCampaignId: campaign.externalId,
                },
                afterState: {
                    campaignId: campaign.id,
                    status: analysis.verdict === 'pause' ? 'PAUSED' : suggestedStatus,
                    budget: campaign.budget != null ? (0, ads_efficiency_util_1.decimalToNumber)(campaign.budget) : null,
                    name: campaign.name,
                    platform: campaign.platform,
                    externalCampaignId: campaign.externalId,
                },
                evidence: {
                    efficiencyScore: analysis.efficiencyScore,
                    verdict: analysis.verdict,
                    evidence: analysis.evidence,
                    wasteSignals: analysis.wasteSignals,
                },
                payload: { verdict: analysis.verdict, providerWrite: false },
            });
        }
        const { assertNoCredentialLeak } = await Promise.resolve().then(() => __importStar(require('../common/utils/token-security.util')));
        const payload = {
            recommendation: rec,
            suggestion: analysis.summary,
            efficiencyScore: analysis.efficiencyScore,
            analysis,
            actionRequest,
            message: 'AI chỉ tạo AdsActionRequest (PENDING_APPROVAL). Cần ads.manage phê duyệt — AI không tự duyệt.',
            source: 'AdsMcpGateway',
        };
        assertNoCredentialLeak(payload);
        return payload;
    }
    async runAutomationAfterSync(user, dateFrom, dateTo) {
        const settings = await this.ensureSettings(user);
        const mcpMode = (0, ads_automation_engine_1.normalizeMcpMode)(settings.mcpMode);
        const rules = await this.prisma.adAutomationRule.findMany({
            where: { organizationId: user.organizationId, enabled: true },
        });
        const insights = await this.prisma.adInsight.findMany({
            where: {
                organizationId: user.organizationId,
                dateFrom: new Date(dateFrom),
                dateTo: new Date(dateTo),
            },
            include: { campaign: true },
        });
        const minSpend = settings.minSpendForAction
            ? (0, ads_efficiency_util_1.decimalToNumber)(settings.minSpendForAction)
            : null;
        const maxBudgetPct = settings.maxBudgetChangePercent ?? 20;
        const cooldownMs = (settings.ruleCooldownMinutes ?? 60) * 60_000;
        for (const row of insights) {
            if (!row.campaign)
                continue;
            // Không tự bật lại quảng cáo do user tắt thủ công
            const userPaused = row.campaign.status === 'PAUSED' &&
                !(await this.wasLastPausedByAutomation(row.campaign.id));
            const metrics = {
                spend: (0, ads_efficiency_util_1.decimalToNumber)(row.spend),
                revenue: (0, ads_efficiency_util_1.decimalToNumber)(row.revenue),
                impressions: row.impressions,
                clicks: row.clicks,
                ctr: (0, ads_efficiency_util_1.decimalToNumber)(row.ctr),
                cpc: (0, ads_efficiency_util_1.decimalToNumber)(row.cpc),
                cpm: (0, ads_efficiency_util_1.decimalToNumber)(row.cpm),
                conversions: (0, ads_efficiency_util_1.decimalToNumber)(row.conversions),
                leads: (0, ads_efficiency_util_1.decimalToNumber)(row.leads),
                cpa: (0, ads_efficiency_util_1.decimalToNumber)(row.cpa),
                cpl: row.cpl != null ? (0, ads_efficiency_util_1.decimalToNumber)(row.cpl) : null,
                roas: row.roas != null ? (0, ads_efficiency_util_1.decimalToNumber)(row.roas) : null,
            };
            const evaluations = (0, ads_automation_engine_1.evaluateRules)(rules.map((r) => ({
                id: r.id,
                ruleType: r.ruleType,
                threshold: r.threshold ? (0, ads_efficiency_util_1.decimalToNumber)(r.threshold) : null,
                spendThreshold: r.spendThreshold ? (0, ads_efficiency_util_1.decimalToNumber)(r.spendThreshold) : null,
                enabled: r.enabled,
            })), metrics, row.campaign.status, { minSpendForAction: minSpend });
            for (const ev of evaluations) {
                if (await this.isRuleInCooldown(user.organizationId, row.campaign.id, ev.ruleId, cooldownMs)) {
                    continue;
                }
                // OBSERVE: chỉ ghi log / recommendation — không tạo AdsActionRequest
                if (mcpMode === 'OBSERVE' || settings.emergencyStop) {
                    await this.prisma.adAutomationLog.create({
                        data: {
                            userId: user.id,
                            organizationId: user.organizationId,
                            ruleId: ev.ruleId,
                            campaignId: row.campaign.id,
                            platform: row.platform,
                            externalCampaignId: row.externalCampaignId,
                            campaignName: row.campaignName,
                            action: ev.shouldPause ? database_1.AdAutomationAction.PAUSE : database_1.AdAutomationAction.ALERT,
                            autoMode: false,
                            reason: `[OBSERVE/STOP] ${ev.reason}`,
                            snapshot: metrics,
                        },
                    });
                    if (ev.shouldAlert) {
                        await this.prisma.adAiRecommendation.create({
                            data: {
                                userId: user.id,
                                organizationId: user.organizationId,
                                campaignId: row.campaign.id,
                                platform: row.platform,
                                type: ev.ruleType,
                                content: ev.reason,
                                priority: 50,
                            },
                        });
                    }
                    continue;
                }
                if (ev.shouldPause && !userPaused) {
                    const idempotencyKey = (0, crypto_1.createHash)('sha256')
                        .update([
                        user.organizationId,
                        row.campaign.id,
                        'PAUSE_CAMPAIGN',
                        ev.ruleId,
                        dateFrom,
                        dateTo,
                    ].join(':'))
                        .digest('hex')
                        .slice(0, 64);
                    const proposed = await this.adsActions.propose(user, {
                        campaignId: row.campaign.id,
                        platform: row.platform,
                        actionType: 'PAUSE_CAMPAIGN',
                        source: 'RULE',
                        aiGenerated: true,
                        submitForApproval: true,
                        idempotencyKey,
                        reason: ev.reason,
                        beforeState: {
                            campaignId: row.campaign.id,
                            status: row.campaign.status,
                            name: row.campaignName,
                            platform: row.platform,
                            externalCampaignId: row.externalCampaignId,
                        },
                        afterState: {
                            campaignId: row.campaign.id,
                            status: 'PAUSED',
                            name: row.campaignName,
                            platform: row.platform,
                            externalCampaignId: row.externalCampaignId,
                        },
                        evidence: { ruleId: ev.ruleId, metrics, mcpMode },
                        payload: {
                            ruleId: ev.ruleId,
                            providerWrite: mcpMode === 'AUTO',
                        },
                    });
                    if (mcpMode === 'AUTO' && !settings.emergencyStop) {
                        // AUTO trong giới hạn: hệ thống queue (không tự approve bằng cùng user AI —
                        // enqueue trực tiếp qua service nội bộ nếu đã SUBMIT)
                        await this.tryAutoQueueWithinLimits(user, proposed.id, settings);
                    }
                    await this.prisma.adAutomationLog.create({
                        data: {
                            userId: user.id,
                            organizationId: user.organizationId,
                            ruleId: ev.ruleId,
                            campaignId: row.campaign.id,
                            platform: row.platform,
                            externalCampaignId: row.externalCampaignId,
                            campaignName: row.campaignName,
                            action: database_1.AdAutomationAction.RECOMMEND,
                            autoMode: mcpMode === 'AUTO',
                            reason: `Rule PAUSE → AdsActionRequest (${mcpMode}): ${ev.reason}`,
                            snapshot: metrics,
                        },
                    });
                }
                else if (ev.budgetChangePercent != null && row.campaign.budget != null) {
                    const pct = (0, ads_automation_engine_1.clampBudgetChangePercent)(ev.budgetChangePercent, maxBudgetPct);
                    const currentBudget = (0, ads_efficiency_util_1.decimalToNumber)(row.campaign.budget);
                    const proposedBudget = Math.max(1, Math.round(currentBudget * (1 + pct / 100) * 100) / 100);
                    const dailyLimit = settings.dailyBudgetLimit
                        ? (0, ads_efficiency_util_1.decimalToNumber)(settings.dailyBudgetLimit)
                        : null;
                    if (dailyLimit != null && proposedBudget > dailyLimit) {
                        await this.prisma.adAutomationLog.create({
                            data: {
                                userId: user.id,
                                organizationId: user.organizationId,
                                ruleId: ev.ruleId,
                                campaignId: row.campaign.id,
                                platform: row.platform,
                                action: database_1.AdAutomationAction.ALERT,
                                autoMode: false,
                                reason: `Budget ${proposedBudget} vượt dailyBudgetLimit ${dailyLimit} — bỏ qua`,
                                snapshot: metrics,
                            },
                        });
                        continue;
                    }
                    const idempotencyKey = (0, crypto_1.createHash)('sha256')
                        .update([
                        user.organizationId,
                        row.campaign.id,
                        'ADJUST_BUDGET',
                        ev.ruleId,
                        String(proposedBudget),
                        dateFrom,
                        dateTo,
                    ].join(':'))
                        .digest('hex')
                        .slice(0, 64);
                    await this.adsActions.propose(user, {
                        campaignId: row.campaign.id,
                        platform: row.platform,
                        actionType: 'ADJUST_BUDGET',
                        source: 'RULE',
                        aiGenerated: true,
                        submitForApproval: true,
                        idempotencyKey,
                        reason: ev.reason,
                        proposedBudget,
                        budgetLimit: dailyLimit ?? undefined,
                        beforeState: {
                            campaignId: row.campaign.id,
                            budget: currentBudget,
                            status: row.campaign.status,
                            externalCampaignId: row.externalCampaignId,
                        },
                        afterState: {
                            campaignId: row.campaign.id,
                            budget: proposedBudget,
                            status: row.campaign.status,
                            externalCampaignId: row.externalCampaignId,
                        },
                        evidence: { ruleId: ev.ruleId, metrics, pct, mcpMode },
                        payload: { ruleId: ev.ruleId, budgetChangePercent: pct },
                    });
                }
                else {
                    await this.prisma.adAutomationLog.create({
                        data: {
                            userId: user.id,
                            organizationId: user.organizationId,
                            ruleId: ev.ruleId,
                            campaignId: row.campaign.id,
                            platform: row.platform,
                            externalCampaignId: row.externalCampaignId,
                            campaignName: row.campaignName,
                            action: ev.shouldPause ? database_1.AdAutomationAction.PAUSE : database_1.AdAutomationAction.ALERT,
                            autoMode: false,
                            reason: ev.reason,
                            snapshot: metrics,
                        },
                    });
                    if (ev.shouldAlert) {
                        await this.prisma.adAiRecommendation.create({
                            data: {
                                userId: user.id,
                                organizationId: user.organizationId,
                                campaignId: row.campaign.id,
                                platform: row.platform,
                                type: ev.ruleType,
                                content: ev.reason,
                                priority: 50,
                            },
                        });
                    }
                }
            }
        }
    }
    async wasLastPausedByAutomation(campaignId) {
        const last = await this.prisma.adAutomationLog.findFirst({
            where: { campaignId, action: database_1.AdAutomationAction.PAUSE },
            orderBy: { createdAt: 'desc' },
        });
        return Boolean(last?.autoMode);
    }
    async isRuleInCooldown(organizationId, campaignId, ruleId, cooldownMs) {
        if (cooldownMs <= 0)
            return false;
        const since = new Date(Date.now() - cooldownMs);
        const hit = await this.prisma.adAutomationLog.findFirst({
            where: {
                organizationId,
                campaignId,
                ruleId,
                createdAt: { gte: since },
            },
            select: { id: true },
        });
        return Boolean(hit);
    }
    async tryAutoQueueWithinLimits(user, actionRequestId, settings) {
        if (settings.emergencyStop)
            return;
        if (settings.togglesToday >= settings.maxTogglesPerDay) {
            await this.prisma.adAutomationLog.create({
                data: {
                    userId: user.id,
                    organizationId: user.organizationId,
                    platform: 'META',
                    action: database_1.AdAutomationAction.ALERT,
                    autoMode: true,
                    reason: `AUTO bỏ qua — vượt maxTogglesPerDay (${settings.maxTogglesPerDay})`,
                    snapshot: { actionRequestId },
                },
            });
            return;
        }
        // AUTO: chuyển PENDING → APPROVED bởi system actor khác requester (audit)
        // Không gọi approve() với cùng user — enqueue nội bộ khi ADS_ACTIONS_LIVE
        try {
            await this.adsActions.systemAutoApproveForMcp(user.organizationId, actionRequestId, user.id);
            await this.prisma.adManagerSettings.updateMany({
                where: { userId: user.id, organizationId: user.organizationId },
                data: { togglesToday: { increment: 1 } },
            });
        }
        catch (err) {
            this.logger.warn(`MCP AUTO queue failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    async toggleCampaign(user, campaignId, status, manual, ruleEv) {
        const campaign = await this.prisma.adManagerCampaign.findFirst({
            where: { id: campaignId, organizationId: user.organizationId },
        });
        if (!campaign)
            throw new common_1.NotFoundException('Chiến dịch không tồn tại');
        const settings = await this.ensureSettings(user);
        if (!manual && settings.emergencyStop) {
            throw new common_1.BadRequestException('Emergency stop đang bật — không thực hiện tự động');
        }
        if (!manual && settings.autoModeEnabled) {
            await this.checkToggleLimit(settings);
        }
        // Provider write tắt mặc định — chỉ human manual + ADS_ACTIONS_PROVIDER_WRITE=true
        const providerWrite = String(this.config.get('ADS_ACTIONS_PROVIDER_WRITE') ?? 'false').toLowerCase() === 'true';
        if (manual && providerWrite && campaign.platform === 'META') {
            try {
                await this.facebookAds.setCampaignActive(user.organizationId, campaign.externalId, status === 'ACTIVE');
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : 'Meta API lỗi';
                this.logger.warn(`Meta pause/enable failed for campaign ${campaign.externalId}: ${msg}`);
                throw new common_1.BadRequestException(msg);
            }
        }
        else if (!manual) {
            throw new common_1.BadRequestException('Auto Mode không được tự ghi chiến dịch — dùng AdsActionRequest + phê duyệt ads.manage');
        }
        const updated = await this.prisma.adManagerCampaign.update({
            where: { id: campaignId },
            data: { status },
        });
        await this.prisma.adAutomationLog.create({
            data: {
                userId: user.id,
                organizationId: user.organizationId,
                ruleId: ruleEv?.ruleId,
                campaignId,
                platform: campaign.platform,
                externalCampaignId: campaign.externalId,
                campaignName: campaign.name,
                action: status === 'PAUSED' ? database_1.AdAutomationAction.PAUSE : database_1.AdAutomationAction.ENABLE,
                autoMode: !manual && settings.autoModeEnabled,
                reason: ruleEv?.reason ??
                    (manual ? `User ${status === 'PAUSED' ? 'tạm dừng' : 'bật lại'} thủ công` : 'Auto Mode'),
                snapshot: { status },
            },
        });
        return updated;
    }
    async checkToggleLimit(settings) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let togglesToday = settings.togglesToday;
        const resetDate = settings.togglesResetDate ? new Date(settings.togglesResetDate) : null;
        if (!resetDate || resetDate < today) {
            togglesToday = 0;
        }
        if (togglesToday >= settings.maxTogglesPerDay) {
            throw new common_1.BadRequestException('Đã đạt giới hạn bật/tắt trong ngày');
        }
        await this.prisma.adManagerSettings.update({
            where: { id: settings.id },
            data: { togglesToday: togglesToday + 1, togglesResetDate: today },
        });
    }
    async ensureSettings(user) {
        return this.prisma.adManagerSettings.upsert({
            where: { userId: user.id },
            create: { userId: user.id, organizationId: user.organizationId },
            update: {},
        });
    }
    mapConnectionStatus(provider, row, overrideStatus, accountName) {
        const status = overrideStatus ?? row?.status ?? database_1.AdConnectionStatus.DISCONNECTED;
        return {
            provider,
            status,
            accountName: accountName ?? row?.externalAccountName ?? null,
            lastSyncAt: row?.lastSyncAt ?? null,
            lastError: row?.lastError ?? null,
            connected: status === database_1.AdConnectionStatus.CONNECTED,
        };
    }
    buildEmailBody(dashboard, campaigns, logs) {
        const best = campaigns[0];
        const worst = campaigns[campaigns.length - 1];
        return [
            'Báo cáo AI Ads Manager',
            `Chi tiêu: ${dashboard.totalSpend}`,
            `Doanh thu: ${dashboard.totalRevenue}`,
            `ROAS: ${dashboard.roas ?? '—'}`,
            `CPA/CPL: ${dashboard.cpa}`,
            `Chiến dịch tốt nhất: ${best?.name ?? '—'}`,
            `Chiến dịch kém nhất: ${worst?.name ?? '—'}`,
            `Hành động AI: ${logs.map((l) => l.reason).join('; ')}`,
        ].join('\n');
    }
};
exports.AiAdsManagerService = AiAdsManagerService;
exports.AiAdsManagerService = AiAdsManagerService = AiAdsManagerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        facebook_ads_service_1.FacebookAdsService,
        google_ads_service_1.GoogleAdsService,
        ad_connection_facade_1.AdConnectionFacade,
        ads_sync_queue_service_1.AdsSyncQueueService,
        ads_mcp_gateway_1.AdsMcpGateway,
        ads_action_service_1.AdsActionService,
        openai_service_1.OpenAiService,
        tenant_kpi_cache_service_1.TenantKpiCacheService])
], AiAdsManagerService);
