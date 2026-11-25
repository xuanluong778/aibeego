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
var FunnelConsultantService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FunnelConsultantService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../prisma/prisma.service");
const openai_service_1 = require("../openai/openai.service");
const funnel_generator_service_1 = require("./funnel-generator.service");
const funnel_analytics_service_1 = require("../leads/funnel-analytics.service");
let FunnelConsultantService = FunnelConsultantService_1 = class FunnelConsultantService {
    prisma;
    openAi;
    generator;
    analytics;
    logger = new common_1.Logger(FunnelConsultantService_1.name);
    constructor(prisma, openAi, generator, analytics) {
        this.prisma = prisma;
        this.openAi = openAi;
        this.generator = generator;
        this.analytics = analytics;
    }
    async propose(user, recommendationId, dto) {
        const current = await this.loadDraft(user.organizationId, recommendationId);
        const prompt = (0, shared_1.sanitizeFunnelUserPrompt)(dto.prompt?.trim() ?? '');
        const intents = dto.intent
            ? [dto.intent]
            : prompt
                ? (0, shared_1.detectConsultantIntents)(prompt)
                : ['OPTIMIZE_FROM_DATA'];
        const includeAnalytics = dto.includeAnalytics !== false;
        const metrics = includeAnalytics
            ? await this.loadFunnelMetrics(user.organizationId, recommendationId)
            : null;
        let source = 'rules';
        let patched;
        let rationale;
        if (this.openAi.isConfigured() && (prompt.length >= 3 || intents[0] === 'OPTIMIZE_FROM_DATA')) {
            try {
                const ai = await this.proposeWithAi(current, intents, prompt, metrics);
                if (ai) {
                    const changed = (0, shared_1.hashFunnelSpec)(ai.spec) !== (0, shared_1.hashFunnelSpec)(current);
                    patched = changed ? ai.spec : undefined;
                    rationale = ai.rationale;
                    source = changed ? 'ai' : 'rules';
                }
            }
            catch (err) {
                this.logger.warn(`Consultant AI failed, using rules: ${String(err)}`);
            }
        }
        try {
            return (0, shared_1.buildConsultantProposal)({
                current,
                intents,
                prompt,
                source,
                rationale,
                metrics,
                patched,
            });
        }
        catch (err) {
            this.logger.warn(`Consultant proposal invalid: ${String(err)}`);
            throw new common_1.BadRequestException('Không tạo được đề xuất hợp lệ — schema/graph không pass');
        }
    }
    async apply(user, recommendationId, body) {
        if (body.confirm !== true) {
            throw new common_1.BadRequestException('Cần xác nhận (confirm=true) — AI không tự thay Funnel/ngân sách');
        }
        let spec;
        try {
            spec = (0, shared_1.assertFunnelCompleteDraft)(body.complete);
        }
        catch (err) {
            if (err instanceof shared_1.FunnelCanvasValidationError) {
                throw new common_1.BadRequestException({ message: err.message, issues: err.issues });
            }
            throw new common_1.BadRequestException('Proposed spec không qua schema validator');
        }
        if (body.specHash && body.specHash !== (0, shared_1.hashFunnelSpec)(spec)) {
            throw new common_1.BadRequestException('specHash không khớp — hãy propose lại rồi xác nhận');
        }
        const saved = await this.generator.saveCompleteDraft(user, recommendationId, {
            complete: spec,
        });
        return {
            ...saved,
            applied: false,
            deployable: false,
            budgetChanged: false,
            mode: 'draft',
        };
    }
    async loadDraft(organizationId, id) {
        const row = await this.prisma.funnelRecommendation.findFirst({
            where: { id, organizationId },
            select: { completeSpec: true },
        });
        if (!row)
            throw new common_1.NotFoundException('Funnel không tồn tại');
        if (!row.completeSpec) {
            throw new common_1.BadRequestException('Chưa có complete spec — generate complete trước');
        }
        try {
            return (0, shared_1.parseFunnelCompleteSpec)(row.completeSpec);
        }
        catch {
            throw new common_1.BadRequestException('completeSpec hiện tại không hợp lệ');
        }
    }
    async loadFunnelMetrics(organizationId, funnelId) {
        const to = new Date();
        const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
        const where = {
            organizationId,
            funnelRecommendationId: funnelId,
            createdAt: { gte: from, lte: to },
        };
        const [leads, booking, purchased, slaBreached, orgAnalytics] = await Promise.all([
            this.prisma.lead.count({ where }),
            this.prisma.lead.count({
                where: {
                    ...where,
                    pipelineStatus: {
                        in: [
                            database_1.LeadPipelineStatus.BOOKED,
                            database_1.LeadPipelineStatus.CONFIRMED,
                            database_1.LeadPipelineStatus.VISITED,
                            database_1.LeadPipelineStatus.PURCHASED,
                        ],
                    },
                },
            }),
            this.prisma.lead.count({
                where: { ...where, pipelineStatus: database_1.LeadPipelineStatus.PURCHASED },
            }),
            this.prisma.lead.count({ where: { ...where, slaBreached: true } }),
            this.analytics.getAnalytics(organizationId, {}).catch(() => null),
        ]);
        const mql = await this.prisma.lead.count({
            where: {
                ...where,
                OR: [{ qualification: { in: ['MQL', 'SQL'] } }, { mqlReachedAt: { not: null } }],
            },
        });
        const sql = await this.prisma.lead.count({
            where: {
                ...where,
                OR: [{ qualification: 'SQL' }, { sqlReachedAt: { not: null } }],
            },
        });
        const dropOff = [
            { stage: 'LEAD', count: leads, dropOffFromPrevious: null },
            { stage: 'MQL', count: mql, dropOffFromPrevious: (0, shared_1.dropOffFromPrevious)(mql, leads) },
            { stage: 'SQL', count: sql, dropOffFromPrevious: (0, shared_1.dropOffFromPrevious)(sql, mql) },
            {
                stage: 'BOOKING',
                count: booking,
                dropOffFromPrevious: (0, shared_1.dropOffFromPrevious)(booking, sql || leads),
            },
            {
                stage: 'PURCHASED',
                count: purchased,
                dropOffFromPrevious: (0, shared_1.dropOffFromPrevious)(purchased, booking),
            },
        ];
        return {
            hasRealData: leads > 0,
            scope: leads > 0 ? 'funnel' : 'none',
            leads,
            booking,
            purchased,
            conversionRate: (0, shared_1.pctRate)(purchased, leads),
            bookingRate: (0, shared_1.pctRate)(booking, leads),
            cpl: leads > 0 ? orgAnalytics?.kpis.cpl ?? null : null,
            spend: leads > 0 ? orgAnalytics?.kpis.spend ?? null : null,
            slaBreached,
            slaRate: (0, shared_1.pctRate)(slaBreached, leads),
            avgConversionTimeHours: leads > 0 ? orgAnalytics?.kpis.avgConversionTimeHours ?? null : null,
            dropOff,
        };
    }
    async proposeWithAi(current, intents, prompt, metrics) {
        const raw = await this.openAi.chatCompletion({
            model: 'gpt-4o-mini',
            temperature: 0.3,
            maxTokens: 1800,
            timeoutMs: 45_000,
            messages: [
                {
                    role: 'system',
                    content: `Bạn là Funnel Consultant spa. Trả về ĐÚNG 1 JSON:
{"rationale":"string tiếng Việt","patch":{...optional funnel-complete fields...}}
QUY TẮC:
- Chỉ sửa draft qua các field schema funnel-complete.v1 (offer, cta, nodes, connections, followUp, automations, remarketing, chatbotFlow, leadForm, booking, salesHandoff, kpis, strategy, summary)
- KHÔNG invent key mới, KHÔNG đổi templateSlug/schemaVersion/mode
- KHÔNG đổi ngân sách ads, KHÔNG pause campaign, KHÔNG bịa KPI
- Nếu metrics.hasRealData=false: không nêu số conversion/CPL giả
- patch có thể rỗng nếu không nên sửa
- nodes/connections nếu có phải là FULL arrays thay thế, không delta`,
                },
                {
                    role: 'user',
                    content: JSON.stringify({
                        request: prompt,
                        intents,
                        spec: (0, shared_1.compactSpecForAi)(current),
                        metrics: metrics
                            ? {
                                hasRealData: metrics.hasRealData,
                                leads: metrics.leads,
                                booking: metrics.booking,
                                purchased: metrics.purchased,
                                conversionRate: metrics.conversionRate,
                                bookingRate: metrics.bookingRate,
                                cpl: metrics.cpl,
                                slaBreached: metrics.slaBreached,
                                slaRate: metrics.slaRate,
                                dropOff: metrics.dropOff,
                            }
                            : null,
                    }),
                },
            ],
        });
        const jsonText = extractJsonObject(raw);
        const parsed = JSON.parse(jsonText);
        const rationale = typeof parsed.rationale === 'string' && parsed.rationale.trim()
            ? parsed.rationale.trim().slice(0, 1200)
            : undefined;
        if (!parsed.patch || typeof parsed.patch !== 'object' || Array.isArray(parsed.patch)) {
            return rationale ? { spec: current, rationale } : null;
        }
        try {
            const spec = (0, shared_1.mergeConsultantPatch)(current, parsed.patch);
            (0, shared_1.assertFunnelCompleteDraft)(spec);
            return { spec, rationale: rationale ?? 'AI đề xuất chỉnh draft (chờ xác nhận).' };
        }
        catch (err) {
            this.logger.warn(`AI patch failed schema: ${String(err)}`);
            return null;
        }
    }
};
exports.FunnelConsultantService = FunnelConsultantService;
exports.FunnelConsultantService = FunnelConsultantService = FunnelConsultantService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        openai_service_1.OpenAiService,
        funnel_generator_service_1.FunnelGeneratorService,
        funnel_analytics_service_1.FunnelAnalyticsService])
], FunnelConsultantService);
function extractJsonObject(text) {
    const trimmed = text.trim();
    if (trimmed.startsWith('{'))
        return trimmed;
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence?.[1])
        return fence[1].trim();
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start)
        return trimmed.slice(start, end + 1);
    throw new Error('AI response is not JSON');
}
