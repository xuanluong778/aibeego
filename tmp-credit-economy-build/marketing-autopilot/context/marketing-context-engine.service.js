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
exports.MarketingContextEngineService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../audit/audit.service");
const marketing_context_cache_service_1 = require("./marketing-context-cache.service");
const marketing_context_datasources_service_1 = require("./marketing-context-datasources.service");
const marketing_context_redaction_util_1 = require("./marketing-context-redaction.util");
const marketing_context_types_1 = require("./marketing-context.types");
const ENGINE_VERSION = 'v2';
const PRIMARY_WINDOW_DAYS = 30;
let MarketingContextEngineService = class MarketingContextEngineService {
    prisma;
    datasources;
    cache;
    audit;
    constructor(prisma, datasources, cache, audit) {
        this.prisma = prisma;
        this.datasources = datasources;
        this.cache = cache;
        this.audit = audit;
    }
    defaultTimeRange(days = PRIMARY_WINDOW_DAYS) {
        const to = new Date();
        const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
        return { from: from.toISOString(), to: to.toISOString() };
    }
    async getContext(organizationId, options) {
        if (!options?.refresh) {
            const cached = await this.cache.get(organizationId);
            if (cached) {
                return { snapshot: cached, fromCache: true, snapshotId: null };
            }
            const latest = await this.prisma.marketingContextSnapshot.findFirst({
                where: {
                    organizationId,
                    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
                },
                orderBy: { createdAt: 'desc' },
            });
            if (latest) {
                const payload = this.rowToPayload(latest);
                await this.cache.set(organizationId, payload);
                return { snapshot: payload, fromCache: false, snapshotId: latest.id };
            }
        }
        return this.refreshContext(organizationId, options?.user);
    }
    async refreshContext(organizationId, user) {
        const windows = await this.collectWindows(organizationId);
        const primary = windows.find((w) => w.days === PRIMARY_WINDOW_DAYS) ?? windows[windows.length - 1];
        const metrics = primary.metrics;
        const sources = primary.sources;
        const timeRange = primary.timeRange;
        const bottlenecks = this.detectBottlenecks(windows);
        const opportunities = this.detectOpportunities(windows);
        const insights = this.buildInsights(metrics, timeRange, sources, bottlenecks, opportunities).slice(0, 8);
        const payload = {
            organizationId,
            generatedAt: new Date().toISOString(),
            timeRange,
            engineVersion: ENGINE_VERSION,
            metrics,
            insights,
            sources,
            windows,
            bottlenecks,
            opportunities,
        };
        const redacted = (0, marketing_context_redaction_util_1.redactMarketingContextSnapshot)(payload);
        const expiresAt = new Date(Date.now() + this.cache.getTtlSeconds() * 1000);
        const row = await this.prisma.marketingContextSnapshot.create({
            data: {
                organizationId,
                createdById: user?.id,
                timeRangeFrom: new Date(timeRange.from),
                timeRangeTo: new Date(timeRange.to),
                engineVersion: ENGINE_VERSION,
                metricsJson: redacted.metrics,
                insightsJson: redacted.insights,
                sourcesJson: redacted.sources,
                snapshotJson: redacted,
                expiresAt,
            },
        });
        await this.cache.set(organizationId, redacted);
        if (user) {
            await this.audit.log({
                organizationId,
                userId: user.id,
                action: 'marketing_context_snapshot_refresh',
                entityType: 'marketing_context_snapshot',
                entityId: row.id,
                metadata: {
                    engineVersion: ENGINE_VERSION,
                    insightCount: insights.length,
                    bottleneckCount: bottlenecks.length,
                    opportunityCount: opportunities.length,
                    windows: windows.map((w) => w.days),
                    sourceDomains: sources.map((s) => s.domain),
                },
            });
        }
        return { snapshot: redacted, fromCache: false, snapshotId: row.id };
    }
    async collectWindows(organizationId) {
        const slices = await Promise.all(marketing_context_types_1.CONTEXT_ENGINE_WINDOWS.map(async (days) => {
            const timeRange = this.defaultTimeRange(days);
            const datasourceResults = await this.datasources.collectAll(organizationId, timeRange);
            const metrics = this.buildMetrics(datasourceResults);
            const sources = datasourceResults.map((r) => ({
                domain: r.domain,
                status: r.status,
                recordCount: r.recordCount,
                error: r.error,
            }));
            return { days, timeRange, metrics, sources };
        }));
        return slices;
    }
    rowToPayload(row) {
        const fromSnapshot = row.snapshotJson;
        if (fromSnapshot?.organizationId) {
            return fromSnapshot;
        }
        return {
            organizationId: row.organizationId,
            generatedAt: row.createdAt.toISOString(),
            timeRange: {
                from: row.timeRangeFrom.toISOString(),
                to: row.timeRangeTo.toISOString(),
            },
            engineVersion: row.engineVersion,
            metrics: row.metricsJson,
            insights: row.insightsJson,
            sources: row.sourcesJson,
        };
    }
    buildMetrics(results) {
        const byDomain = Object.fromEntries(results.map((r) => [r.domain, r]));
        const crm = byDomain['crm.leads']?.data;
        const bookings = byDomain['bookings']?.data;
        const revenue = byDomain['revenue']?.data;
        const ads = byDomain['ads.adDailyStat']?.data;
        const email = byDomain['email']?.data;
        const chatbot = byDomain['chatbot']?.data;
        const funnel = byDomain['funnel']?.data;
        const campaigns = byDomain['campaigns']?.data;
        const content = byDomain['content']?.data;
        const automation = byDomain['automation']?.data;
        const customers = byDomain['customer360']?.data;
        const zalo = byDomain['zalo']?.data;
        const businessEvents = byDomain['businessEvents']?.data;
        const leadTotal = crm?.total ?? null;
        const bookingTotal = bookings?.total ?? null;
        const leadToBookingRate = leadTotal && leadTotal > 0 && bookingTotal !== null
            ? Math.round((bookingTotal / leadTotal) * 1000) / 10
            : null;
        const m = {
            leads: { total: null, new: null, hot: null, unassigned: null, noFollowUp: null },
            bookings: { total: null, upcoming: null, completed: null },
            conversion: { leadToBookingRate: null },
            revenue: { total: null, currency: 'VND' },
            ads: {
                spend: null,
                impressions: null,
                clicks: null,
                ctr: null,
                cpc: null,
                cpl: null,
                roas: null,
                leads: null,
            },
            email: { campaigns: null, sent: null, openRate: null, clickRate: null },
            chatbot: { bots: null, openConversations: null, leadsCaptured: null },
            funnel: { activeFunnels: null, pipelineStages: null, leadsInFunnel: null },
            campaigns: { messagingActive: null, messagingSent: null, legacyCampaigns: null },
            content: { teleprompterSources: null, autoPostDrafts: null, autoPostPublished: null },
            customers: { total: null, repurchaseCandidates: null },
            zalo: { sent: null, campaigns: null },
            businessEvents: { counts: {} },
            automation: { activeFlows: null, pausedFlows: null, logsSuccess: null, logsFailed: null },
        };
        if (byDomain['crm.leads']?.status === 'OK' && crm) {
            m.leads = {
                total: crm.total,
                new: crm.new ?? null,
                hot: crm.hot,
                unassigned: crm.unassigned,
                noFollowUp: crm.noFollowUp,
            };
        }
        if (byDomain['bookings']?.status === 'OK' && bookings) {
            m.bookings = {
                total: bookings.total,
                upcoming: bookings.upcoming,
                completed: bookings.completed,
            };
        }
        m.conversion.leadToBookingRate = leadToBookingRate;
        if (byDomain['revenue']?.status === 'OK' && revenue) {
            m.revenue = { total: revenue.total, currency: revenue.currency };
        }
        if (byDomain['ads.adDailyStat']?.status === 'OK' && ads) {
            const adsLeads = ads.leads ?? null;
            const crmLeads = m.leads.total;
            const spend = ads.spend;
            let cpl = ads.cpl;
            if ((cpl == null || cpl <= 0) && spend != null && spend > 0) {
                const leadCount = adsLeads != null && adsLeads > 0
                    ? adsLeads
                    : crmLeads != null && crmLeads > 0
                        ? crmLeads
                        : null;
                if (leadCount != null && leadCount > 0)
                    cpl = spend / leadCount;
            }
            m.ads = {
                spend: ads.spend,
                impressions: ads.impressions,
                clicks: ads.clicks,
                ctr: ads.ctr,
                cpc: ads.cpc,
                cpl,
                roas: ads.roas,
                leads: adsLeads,
            };
        }
        if (byDomain['email']?.status === 'OK' && email) {
            m.email = {
                campaigns: email.campaigns,
                sent: email.sent,
                openRate: email.openRate,
                clickRate: email.clickRate,
            };
        }
        if (byDomain['chatbot']?.status === 'OK' && chatbot) {
            m.chatbot = {
                bots: chatbot.bots,
                openConversations: chatbot.openConversations,
                leadsCaptured: chatbot.leadsCaptured,
            };
        }
        if (byDomain['funnel']?.status === 'OK' && funnel) {
            m.funnel = {
                activeFunnels: funnel.activeFunnels,
                pipelineStages: funnel.pipelineStages,
                leadsInFunnel: funnel.leadsInFunnel,
            };
        }
        if (byDomain['campaigns']?.status === 'OK' && campaigns) {
            m.campaigns = {
                messagingActive: campaigns.messagingActive,
                messagingSent: campaigns.messagingSent,
                legacyCampaigns: campaigns.legacyCampaigns,
            };
        }
        if (byDomain['content']?.status === 'OK' && content) {
            m.content = {
                teleprompterSources: content.teleprompterSources,
                autoPostDrafts: content.autoPostDrafts,
                autoPostPublished: content.autoPostPublished,
            };
        }
        if (byDomain['automation']?.status === 'OK' && automation) {
            m.automation = {
                activeFlows: automation.activeFlows,
                pausedFlows: automation.pausedFlows,
                logsSuccess: automation.logsSuccess,
                logsFailed: automation.logsFailed,
            };
        }
        if (byDomain['customer360']?.status === 'OK' && customers) {
            m.customers = {
                total: customers.total,
                repurchaseCandidates: customers.repurchaseCandidates,
            };
        }
        if (byDomain['zalo']?.status === 'OK' && zalo) {
            m.zalo = { sent: zalo.sent, campaigns: zalo.campaigns };
        }
        if (byDomain['businessEvents']?.status === 'OK' && businessEvents) {
            m.businessEvents = { counts: businessEvents.counts ?? {} };
        }
        return m;
    }
    detectBottlenecks(windows) {
        const out = [];
        const w30 = windows.find((w) => w.days === 30) ?? windows[0];
        if (!w30)
            return out;
        const m = w30.metrics;
        const days = w30.days;
        const total = m.leads.total ?? 0;
        const noFollowUp = m.leads.noFollowUp ?? 0;
        if (noFollowUp > 0 && (total === 0 || noFollowUp / Math.max(total, 1) >= 0.2)) {
            out.push({
                id: (0, crypto_1.randomUUID)(),
                kind: 'crm_followup',
                title: 'Lead follow-up bottleneck',
                summary: `${noFollowUp} lead chưa follow-up / SLA breach trong ${days} ngày.`,
                evidence: `leads.noFollowUp=${noFollowUp}; leads.total=${total}; window=${days}d`,
                severity: noFollowUp / Math.max(total, 1) >= 0.4 ? 'HIGH' : 'MEDIUM',
                windowDays: days,
                confidence: total >= 10 ? 'HIGH' : 'MEDIUM',
            });
        }
        const rate = m.conversion.leadToBookingRate;
        if (rate != null && rate > 0 && rate < 15 && total >= 5) {
            out.push({
                id: (0, crypto_1.randomUUID)(),
                kind: 'conversion',
                title: 'Conversion lead → booking thấp',
                summary: `Lead-to-booking ${rate}% trong ${days} ngày.`,
                evidence: `leadToBookingRate=${rate}; bookings=${m.bookings.total}; leads=${total}`,
                severity: rate < 8 ? 'HIGH' : 'MEDIUM',
                windowDays: days,
                confidence: total >= 20 ? 'HIGH' : 'MEDIUM',
            });
        }
        if ((m.funnel.activeFunnels ?? 0) === 0 && total > 5) {
            out.push({
                id: (0, crypto_1.randomUUID)(),
                kind: 'funnel',
                title: 'Chưa có funnel đang chạy',
                summary: 'Có lead nhưng không có active funnel để nuôi dưỡng.',
                evidence: `funnel.activeFunnels=0; leads.total=${total}`,
                severity: 'HIGH',
                windowDays: days,
                confidence: 'HIGH',
            });
        }
        if (m.ads.spend != null && m.ads.spend > 0 && m.ads.roas != null && m.ads.roas < 1) {
            out.push({
                id: (0, crypto_1.randomUUID)(),
                kind: 'ads_efficiency',
                title: 'Ads ROAS dưới hòa vốn',
                summary: `ROAS ${m.ads.roas.toFixed(2)} với spend ${Math.round(m.ads.spend).toLocaleString('vi-VN')} VND.`,
                evidence: `ads.roas=${m.ads.roas}; ads.spend=${m.ads.spend}; ads.cpl=${m.ads.cpl}`,
                severity: 'HIGH',
                windowDays: days,
                confidence: 'HIGH',
            });
        }
        if ((m.automation.logsFailed ?? 0) > (m.automation.logsSuccess ?? 0) && (m.automation.logsFailed ?? 0) > 0) {
            out.push({
                id: (0, crypto_1.randomUUID)(),
                kind: 'automation',
                title: 'Automation thất bại nhiều hơn thành công',
                summary: `Failed ${m.automation.logsFailed} vs success ${m.automation.logsSuccess}.`,
                evidence: `logsFailed=${m.automation.logsFailed}; logsSuccess=${m.automation.logsSuccess}`,
                severity: 'MEDIUM',
                windowDays: days,
                confidence: 'MEDIUM',
            });
        }
        if (m.email.sent != null && m.email.sent >= 50 && m.email.openRate != null && m.email.openRate < 15) {
            out.push({
                id: (0, crypto_1.randomUUID)(),
                kind: 'email',
                title: 'Email open rate thấp',
                summary: `Open rate ${m.email.openRate.toFixed(1)}% trên ${m.email.sent} email.`,
                evidence: `email.openRate=${m.email.openRate}; email.sent=${m.email.sent}`,
                severity: 'MEDIUM',
                windowDays: days,
                confidence: 'HIGH',
            });
        }
        return out.slice(0, 6);
    }
    detectOpportunities(windows) {
        const out = [];
        const w30 = windows.find((w) => w.days === 30);
        const w7 = windows.find((w) => w.days === 7);
        const w90 = windows.find((w) => w.days === 90);
        if (!w30)
            return out;
        const m = w30.metrics;
        if ((m.leads.hot ?? 0) > 0) {
            out.push({
                id: (0, crypto_1.randomUUID)(),
                kind: 'hot_leads',
                title: 'Lead nóng sẵn sàng chốt',
                summary: `${m.leads.hot} lead MQL/SQL/score cao trong 30 ngày.`,
                evidence: `leads.hot=${m.leads.hot}; leads.total=${m.leads.total}`,
                windowDays: 30,
                confidence: 'HIGH',
            });
        }
        if ((m.content.teleprompterSources ?? 0) < 3 && (m.leads.total ?? 0) > 0) {
            out.push({
                id: (0, crypto_1.randomUUID)(),
                kind: 'content',
                title: 'Thiếu content nurture — cơ hội bổ sung',
                summary: 'Ít hơn 3 teleprompter sources trong khi đã có lead.',
                evidence: `content.teleprompterSources=${m.content.teleprompterSources}`,
                windowDays: 30,
                confidence: 'MEDIUM',
            });
        }
        if ((m.chatbot.leadsCaptured ?? 0) > 0) {
            out.push({
                id: (0, crypto_1.randomUUID)(),
                kind: 'chatbot',
                title: 'Chatbot đang thu lead hiệu quả',
                summary: `${m.chatbot.leadsCaptured} lead từ chatbot — có thể mở rộng script.`,
                evidence: `chatbot.leadsCaptured=${m.chatbot.leadsCaptured}`,
                windowDays: 30,
                confidence: 'MEDIUM',
            });
        }
        const rev30 = m.revenue.total ?? 0;
        const rev90 = w90?.metrics.revenue.total ?? null;
        if (rev30 > 0 && rev90 != null && rev90 > 0 && rev30 * 3 > rev90 * 1.2) {
            out.push({
                id: (0, crypto_1.randomUUID)(),
                kind: 'revenue_growth',
                title: 'Doanh thu 30 ngày đang tăng tốc so với 90 ngày',
                summary: 'Tốc độ revenue gần đây cao hơn baseline 90 ngày.',
                evidence: `revenue.30d=${rev30}; revenue.90d=${rev90}`,
                windowDays: 30,
                confidence: 'MEDIUM',
            });
        }
        const leads7 = w7?.metrics.leads.total ?? 0;
        const leads30 = m.leads.total ?? 0;
        if (leads7 > 0 && leads30 > 0 && leads7 / Math.max(leads30, 1) >= 0.45) {
            out.push({
                id: (0, crypto_1.randomUUID)(),
                kind: 'remarketing',
                title: 'Lead mới tập trung 7 ngày gần đây',
                summary: 'Cơ hội nurture/remarketing nhanh cho cohort mới.',
                evidence: `leads.7d=${leads7}; leads.30d=${leads30}`,
                windowDays: 7,
                confidence: 'MEDIUM',
            });
        }
        return out.slice(0, 6);
    }
    buildInsights(metrics, timeRange, sources, bottlenecks, opportunities) {
        const insights = [];
        const push = (category, title, summary, evidence, source, confidence) => {
            insights.push({
                id: (0, crypto_1.randomUUID)(),
                category,
                title,
                summary,
                evidence,
                source,
                timeRange,
                confidence,
            });
        };
        for (const b of bottlenecks) {
            push('bottleneck', b.title, b.summary, b.evidence, `context-v2.${b.kind}`, b.confidence);
        }
        for (const o of opportunities) {
            push('opportunity', o.title, o.summary, o.evidence, `context-v2.${o.kind}`, o.confidence);
        }
        const crmSource = sources.find((s) => s.domain === 'crm.leads');
        if (crmSource?.status === 'INSUFFICIENT_DATA') {
            push('crm', 'Chưa đủ dữ liệu CRM/Lead', 'Không có lead trong khoảng thời gian phân tích.', 'lead.count=0 trong timeRange', 'crm.leads', 'INSUFFICIENT_DATA');
        }
        const adsSource = sources.find((s) => s.domain === 'ads.adDailyStat');
        if (adsSource?.status === 'INSUFFICIENT_DATA') {
            push('ads', 'Chưa đủ dữ liệu Ads', 'Không có adDailyStat trong khoảng thời gian phân tích.', 'adDailyStat.count=0', 'ads.adDailyStat', 'INSUFFICIENT_DATA');
        }
        else if (metrics.ads.spend != null && metrics.ads.spend > 0) {
            push('ads', 'Chi phí Ads & hiệu quả', `Spend ${Math.round(metrics.ads.spend).toLocaleString('vi-VN')} VND` +
                (metrics.ads.roas !== null ? `, ROAS ${metrics.ads.roas.toFixed(2)}` : '') +
                (metrics.ads.cpl !== null ? `, CPL ${Math.round(metrics.ads.cpl).toLocaleString('vi-VN')}` : ''), `spend=${metrics.ads.spend}, ctr=${metrics.ads.ctr}, cpc=${metrics.ads.cpc}, roas=${metrics.ads.roas}`, 'ads.adDailyStat', 'HIGH');
        }
        if (metrics.conversion.leadToBookingRate !== null &&
            metrics.leads.total !== null &&
            metrics.leads.total >= 5) {
            push('conversion', 'Tỷ lệ Lead → Booking', `Lead-to-booking ${metrics.conversion.leadToBookingRate}% (${metrics.bookings.total ?? 0}/${metrics.leads.total} lead).`, `bookings=${metrics.bookings.total}, leads=${metrics.leads.total}`, 'bookings+crm.leads', metrics.leads.total >= 20 ? 'HIGH' : 'MEDIUM');
        }
        return insights.sort((a, b) => {
            const rank = (c) => c === 'HIGH' ? 3 : c === 'MEDIUM' ? 2 : c === 'LOW' ? 1 : 0;
            return rank(b.confidence) - rank(a.confidence);
        });
    }
};
exports.MarketingContextEngineService = MarketingContextEngineService;
exports.MarketingContextEngineService = MarketingContextEngineService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        marketing_context_datasources_service_1.MarketingContextDatasourcesService,
        marketing_context_cache_service_1.MarketingContextCacheService,
        audit_service_1.AuditService])
], MarketingContextEngineService);
