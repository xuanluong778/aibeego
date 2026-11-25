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
var FunnelGeneratorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FunnelGeneratorService = void 0;
exports.composeFunnelBriefPrompt = composeFunnelBriefPrompt;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../prisma/prisma.service");
const openai_service_1 = require("../openai/openai.service");
const funnel_template_service_1 = require("./funnel-template.service");
const funnel_lifecycle_service_1 = require("./funnel-lifecycle.service");
const ALLOWED_SLUGS = new Set(shared_1.FUNNEL_TEMPLATE_SLUGS);
let FunnelGeneratorService = FunnelGeneratorService_1 = class FunnelGeneratorService {
    prisma;
    openAi;
    templates;
    lifecycle;
    logger = new common_1.Logger(FunnelGeneratorService_1.name);
    constructor(prisma, openAi, templates, lifecycle) {
        this.prisma = prisma;
        this.openAi = openAi;
        this.templates = templates;
        this.lifecycle = lifecycle;
    }
    /**
     * Analyze NL brief → 3–5 template recommendations.
     * Preview only — does NOT apply pipeline/automation.
     */
    async generate(user, dto) {
        await this.lifecycle.assertCanCreateFunnel(user.organizationId);
        await this.templates.ensureSystemTemplates();
        dto.prompt = (0, shared_1.sanitizeFunnelUserPrompt)(dto.prompt);
        const composedPrompt = composeFunnelBriefPrompt(dto);
        const hints = {
            ...dto,
            prompt: composedPrompt,
            industryHint: dto.industryHint || dto.productService,
            regionHint: dto.regionHint || dto.region,
            budgetHint: dto.budgetHint || dto.budget,
        };
        const catalog = shared_1.DEFAULT_FUNNEL_TEMPLATES.map((t) => ({
            slug: t.slug,
            name: t.name,
            category: t.category,
            description: t.description,
            goal: t.goal.label,
            tags: t.tags,
        }));
        let result;
        let source = 'fallback';
        try {
            if (this.openAi.isConfigured()) {
                result = await this.generateWithAi(hints, catalog);
                source = 'ai';
            }
            else {
                result = (0, shared_1.buildFallbackFunnelRecommendations)(composedPrompt);
                result = this.enrichWithHints(result, hints);
            }
        }
        catch (err) {
            this.logger.warn(`AI funnel generator failed, fallback: ${String(err)}`);
            result = this.enrichWithHints((0, shared_1.buildFallbackFunnelRecommendations)(composedPrompt), hints);
            source = 'fallback';
        }
        result = this.sanitizeResult(result, composedPrompt);
        const row = await this.prisma.funnelRecommendation.create({
            data: {
                organizationId: user.organizationId,
                createdById: user.id,
                prompt: composedPrompt,
                result: result,
                source,
            },
        });
        return {
            id: row.id,
            source,
            ...result,
            /** Explicit contract for clients */
            applied: false,
            deployable: false,
        };
    }
    async get(organizationId, id) {
        const row = await this.prisma.funnelRecommendation.findFirst({
            where: { id, organizationId },
        });
        if (!row)
            throw new common_1.NotFoundException('Recommendation not found');
        const result = (0, shared_1.parseFunnelGeneratorResult)(row.result);
        return {
            id: row.id,
            source: row.source,
            selectedSlug: row.selectedSlug,
            selectedAt: row.selectedAt,
            completeSpec: row.completeSpec,
            completeSource: row.completeSource,
            completeGeneratedAt: row.completeGeneratedAt,
            chatbotBotId: row.chatbotBotId,
            status: row.status,
            publishedVersion: row.publishedVersion,
            publishedAt: row.publishedAt,
            pausedAt: row.pausedAt,
            archivedAt: row.archivedAt,
            clonedFromId: row.clonedFromId,
            liveFrozen: row.status === 'ACTIVE',
            createdAt: row.createdAt,
            ...result,
            applied: false,
            deployable: false,
        };
    }
    async list(organizationId, take = 50) {
        const rows = await this.prisma.funnelRecommendation.findMany({
            where: { organizationId },
            orderBy: { createdAt: 'desc' },
            take,
            select: {
                id: true,
                prompt: true,
                source: true,
                selectedSlug: true,
                selectedAt: true,
                completeGeneratedAt: true,
                completeSource: true,
                chatbotBotId: true,
                status: true,
                publishedVersion: true,
                clonedFromId: true,
                createdAt: true,
                completeSpec: true,
                publishedSpec: true,
            },
        });
        const ids = rows.map((r) => r.id);
        const BOOKING_STATUSES = [
            database_1.LeadPipelineStatus.BOOKED,
            database_1.LeadPipelineStatus.CONFIRMED,
            database_1.LeadPipelineStatus.VISITED,
            database_1.LeadPipelineStatus.PURCHASED,
        ];
        const [statusGroups, paidOrders] = ids.length
            ? await Promise.all([
                this.prisma.lead.groupBy({
                    by: ['funnelRecommendationId', 'pipelineStatus'],
                    where: { organizationId, funnelRecommendationId: { in: ids } },
                    _count: { _all: true },
                }),
                this.prisma.order.findMany({
                    where: {
                        organizationId,
                        status: { in: [database_1.OrderStatus.PAID, database_1.OrderStatus.PARTIALLY_PAID] },
                        lead: { funnelRecommendationId: { in: ids } },
                    },
                    select: {
                        total: true,
                        lead: { select: { funnelRecommendationId: true } },
                    },
                }),
            ])
            : [[], []];
        const stats = new Map();
        for (const id of ids) {
            stats.set(id, { leads: 0, booking: 0, purchase: 0, revenue: 0 });
        }
        for (const g of statusGroups) {
            const id = g.funnelRecommendationId;
            if (!id)
                continue;
            const row = stats.get(id) ?? { leads: 0, booking: 0, purchase: 0, revenue: 0 };
            row.leads += g._count._all;
            if (BOOKING_STATUSES.includes(g.pipelineStatus))
                row.booking += g._count._all;
            if (g.pipelineStatus === database_1.LeadPipelineStatus.PURCHASED)
                row.purchase += g._count._all;
            stats.set(id, row);
        }
        for (const order of paidOrders) {
            const id = order.lead?.funnelRecommendationId;
            if (!id)
                continue;
            const row = stats.get(id) ?? { leads: 0, booking: 0, purchase: 0, revenue: 0 };
            row.revenue += Number(order.total ?? 0);
            stats.set(id, row);
        }
        return rows.map(({ completeSpec, publishedSpec, ...row }) => {
            const live = row.status === 'ACTIVE' ? publishedSpec : completeSpec;
            return {
                ...row,
                name: funnelSpecField(live, 'name') ?? funnelSpecField(completeSpec, 'name'),
                offer: funnelSpecField(live, 'offer') ?? funnelSpecField(completeSpec, 'offer'),
                kpis: stats.get(row.id) ?? { leads: 0, booking: 0, purchase: 0, revenue: 0 },
            };
        });
    }
    /**
     * Record user choice of a recommended template — still NO apply/deploy.
     */
    async select(organizationId, id, dto) {
        if (!ALLOWED_SLUGS.has(dto.templateSlug)) {
            throw new common_1.BadRequestException('templateSlug không thuộc Funnel Template Engine');
        }
        const row = await this.prisma.funnelRecommendation.findFirst({
            where: { id, organizationId },
        });
        if (!row)
            throw new common_1.NotFoundException('Recommendation not found');
        const result = (0, shared_1.parseFunnelGeneratorResult)(row.result);
        const allowed = new Set(result.recommendations.map((r) => r.templateSlug));
        if (!allowed.has(dto.templateSlug)) {
            throw new common_1.BadRequestException('Chỉ được chọn slug nằm trong danh sách đề xuất');
        }
        const updated = await this.prisma.funnelRecommendation.update({
            where: { id },
            data: {
                selectedSlug: dto.templateSlug,
                selectedAt: new Date(),
            },
        });
        return {
            id: updated.id,
            selectedSlug: updated.selectedSlug,
            selectedAt: updated.selectedAt,
            applied: false,
            deployable: false,
            nextStep: 'Gọi POST /funnel-builder/recommendations/:id/generate-complete để tạo Funnel JSON đầy đủ (draft).',
        };
    }
    /**
     * After strategy selected — generate complete funnel JSON (fixed schema).
     * Validates before DB save. Does NOT apply/deploy live pipeline.
     */
    async generateComplete(user, recommendationId) {
        await this.templates.ensureSystemTemplates();
        const row = await this.prisma.funnelRecommendation.findFirst({
            where: { id: recommendationId, organizationId: user.organizationId },
        });
        if (!row)
            throw new common_1.NotFoundException('Recommendation not found');
        if (!row.selectedSlug) {
            throw new common_1.BadRequestException('Cần chọn chiến lược Funnel trước khi generate complete');
        }
        if (!ALLOWED_SLUGS.has(row.selectedSlug)) {
            throw new common_1.BadRequestException('selectedSlug không hợp lệ');
        }
        const templateSlug = row.selectedSlug;
        const template = (0, shared_1.getDefaultFunnelTemplate)(templateSlug) ??
            shared_1.DEFAULT_FUNNEL_TEMPLATES.find((t) => t.slug === templateSlug);
        if (!template) {
            throw new common_1.BadRequestException('Không tìm thấy template trong catalog');
        }
        const preview = (0, shared_1.parseFunnelGeneratorResult)(row.result);
        const option = preview.recommendations.find((r) => r.templateSlug === templateSlug);
        let complete;
        let source = 'fallback';
        try {
            if (this.openAi.isConfigured()) {
                const raw = await this.generateCompleteWithAi({
                    prompt: row.prompt,
                    analysis: preview.analysis,
                    option,
                    template,
                });
                complete = (0, shared_1.sanitizeFunnelCompleteSpec)(raw, {
                    templateSlug,
                    template,
                    option,
                    analysis: preview.analysis,
                });
                source = 'ai';
            }
            else {
                complete = (0, shared_1.buildFallbackFunnelComplete)({
                    templateSlug,
                    option,
                    analysis: preview.analysis,
                });
            }
        }
        catch (err) {
            this.logger.warn(`Complete funnel AI failed, fallback: ${String(err)}`);
            complete = (0, shared_1.buildFallbackFunnelComplete)({
                templateSlug,
                option,
                analysis: preview.analysis,
            });
            source = 'fallback';
        }
        // Final validate before persist
        complete = (0, shared_1.sanitizeFunnelCompleteSpec)(complete, {
            templateSlug,
            template,
            option,
            analysis: preview.analysis,
        });
        const updated = await this.prisma.funnelRecommendation.update({
            where: { id: row.id },
            data: {
                completeSpec: complete,
                completeSource: source,
                completeGeneratedAt: new Date(),
            },
        });
        return {
            recommendationId: updated.id,
            templateSlug,
            source,
            complete,
            applied: false,
            deployable: false,
            mode: 'draft',
        };
    }
    /**
     * Save Funnel Canvas draft — validates funnel-complete.v1 + graph before persist.
     */
    async saveCompleteDraft(user, recommendationId, dto) {
        const row = await this.prisma.funnelRecommendation.findFirst({
            where: { id: recommendationId, organizationId: user.organizationId },
        });
        if (!row)
            throw new common_1.NotFoundException('Recommendation not found');
        if (row.status === 'ARCHIVED') {
            throw new common_1.BadRequestException('Funnel ARCHIVED — không sửa draft, hãy clone');
        }
        if (!row.completeSpec) {
            throw new common_1.BadRequestException('Chưa có completeSpec — hãy generate-complete trước');
        }
        let current;
        try {
            current = (0, shared_1.parseFunnelCompleteSpec)(row.completeSpec);
        }
        catch {
            throw new common_1.BadRequestException('completeSpec hiện tại không hợp lệ');
        }
        const incoming = dto.complete;
        if (!incoming || typeof incoming !== 'object') {
            throw new common_1.BadRequestException('complete phải là object');
        }
        try {
            const nodes = Array.isArray(incoming.nodes)
                ? (incoming.nodes)
                : current.nodes;
            const connections = Array.isArray(incoming.connections)
                ? (incoming.connections)
                : current.connections;
            const graphOnly = (0, shared_1.applyFunnelCanvasDraft)(current, {
                name: typeof incoming.name === 'string'
                    ? incoming.name
                    : current.name,
                offer: typeof incoming.offer === 'string'
                    ? incoming.offer
                    : current.offer,
                cta: typeof incoming.cta === 'string'
                    ? incoming.cta
                    : current.cta,
                strategy: typeof incoming.strategy === 'string'
                    ? incoming.strategy
                    : current.strategy,
                summary: typeof incoming.summary === 'string'
                    ? incoming.summary
                    : current.summary,
                nodes,
                connections,
            });
            const contentMerged = (0, shared_1.parseFunnelCompleteSpec)({
                ...current,
                ...graphOnly,
                leadForm: incoming.leadForm ?? current.leadForm,
                chatbotFlow: incoming.chatbotFlow ?? current.chatbotFlow,
                followUp: incoming.followUp ?? current.followUp,
                automations: incoming.automations ?? current.automations,
                leadScoring: incoming.leadScoring ?? current.leadScoring,
                salesHandoff: incoming.salesHandoff ?? current.salesHandoff,
                booking: incoming.booking ?? current.booking,
                remarketing: incoming.remarketing ?? current.remarketing,
                conversionGoal: incoming.conversionGoal ?? current.conversionGoal,
                kpis: incoming.kpis ?? current.kpis,
                schemaVersion: 'funnel-complete.v1',
                mode: 'draft',
                templateSlug: current.templateSlug,
            });
            (0, shared_1.assertFunnelCompleteDraft)(contentMerged);
            const updated = await this.prisma.funnelRecommendation.update({
                where: { id: row.id },
                data: {
                    completeSpec: contentMerged,
                },
            });
            return {
                recommendationId: updated.id,
                complete: contentMerged,
                applied: false,
                deployable: false,
                mode: 'draft',
                liveFrozen: row.status === 'ACTIVE',
                publishedVersion: row.publishedVersion,
            };
        }
        catch (err) {
            if (err instanceof shared_1.FunnelCanvasValidationError) {
                throw new common_1.BadRequestException({
                    message: err.message,
                    issues: err.issues,
                });
            }
            if (err instanceof common_1.BadRequestException)
                throw err;
            this.logger.warn(`saveCompleteDraft failed: ${String(err)}`);
            throw new common_1.BadRequestException('Không lưu được draft — schema/graph không hợp lệ');
        }
    }
    async generateCompleteWithAi(input) {
        const system = `Bạn là kiến trúc sư funnel spa/beauty. Điền nội dung Funnel hoàn chỉnh.
Trả về ĐÚNG 1 JSON object (không markdown) theo schema funnel-complete.v1.
Chỉ được dùng các field trong schema. Không invent key mới.
templateSlug BẮT BUỘC = "${input.template.slug}".
nodes.id nên khớp template nodes khi có thể: ${JSON.stringify(input.template.nodes.map((n) => ({ id: n.id, type: n.type, label: n.label })))}.
schemaVersion = "funnel-complete.v1", mode = "draft".
Bắt buộc có: offer, cta, stages, nodes, connections, leadForm, chatbotFlow, followUp, leadScoring, salesHandoff, booking, remarketing, conversionGoal, kpis.
Ngôn ngữ tiếng Việt.`;
        const userMsg = JSON.stringify({
            prompt: input.prompt,
            analysis: input.analysis,
            selectedOption: input.option,
            templateGoal: input.template.goal,
            templateAutomations: input.template.recommendedAutomation,
        });
        const raw = await this.openAi.chatCompletion({
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: userMsg },
            ],
            temperature: 0.3,
            maxTokens: 3500,
            timeoutMs: 60_000,
        });
        const jsonText = extractJsonObject(raw);
        return JSON.parse(jsonText);
    }
    enrichWithHints(result, dto) {
        const channels = dto.channels && dto.channels.length > 0
            ? dto.channels
            : result.analysis.channels;
        return (0, shared_1.parseFunnelGeneratorResult)({
            ...result,
            analysis: {
                ...result.analysis,
                industry: dto.industryHint || result.analysis.industry,
                service: dto.productService || result.analysis.service,
                goal: dto.goal || result.analysis.goal,
                targetAudience: dto.audience || result.analysis.targetAudience,
                offer: dto.price
                    ? `${result.analysis.offer || dto.productService || 'Ưu đãi'} — giá ${dto.price}`
                    : result.analysis.offer,
                channels,
                regionHint: dto.regionHint ?? dto.region ?? result.analysis.regionHint ?? null,
                budgetHint: dto.budgetHint ?? dto.budget ?? result.analysis.budgetHint ?? null,
            },
        });
    }
    sanitizeResult(raw, prompt) {
        // Drop any hallucinated slugs; re-validate length 3–5
        const filtered = raw.recommendations.filter((r) => ALLOWED_SLUGS.has(r.templateSlug));
        const dedup = new Map();
        for (const r of filtered.sort((a, b) => b.fitScore - a.fitScore)) {
            if (!dedup.has(r.templateSlug))
                dedup.set(r.templateSlug, r);
        }
        let recommendations = [...dedup.values()].slice(0, 5);
        if (recommendations.length < 3) {
            const fallback = (0, shared_1.buildFallbackFunnelRecommendations)(prompt).recommendations;
            for (const f of fallback) {
                if (recommendations.length >= 5)
                    break;
                if (!recommendations.some((r) => r.templateSlug === f.templateSlug)) {
                    recommendations.push(f);
                }
            }
            recommendations = recommendations.slice(0, 5);
        }
        if (recommendations.length < 3) {
            throw new common_1.BadRequestException('Không đủ recommendation hợp lệ từ template catalog');
        }
        return (0, shared_1.parseFunnelGeneratorResult)({
            ...raw,
            prompt,
            schemaVersion: 'funnel-generator.v1',
            mode: 'preview',
            recommendations,
            disclaimers: [
                'Chỉ đề xuất preview — chưa apply/deploy pipeline hoặc automation.',
                'Chỉ dùng templateSlug thuộc Funnel Template Engine.',
                ...(raw.disclaimers ?? []).slice(0, 3),
            ].slice(0, 5),
        });
    }
    async generateWithAi(dto, catalog) {
        const system = `Bạn là chuyên gia funnel marketing spa/beauty SaaS multi-tenant.
Nhiệm vụ: phân tích brief tiếng Việt và đề xuất 3–5 funnel CHỈ từ catalog template cho trước.
Trả về ĐÚNG 1 JSON object (không markdown) theo schema:
{
  "schemaVersion": "funnel-generator.v1",
  "prompt": string,
  "analysis": {
    "industry": string,
    "service": string,
    "goal": string,
    "targetAudience": string,
    "painPoints": string[],
    "offer": string,
    "leadMagnet": string,
    "channels": string[],
    "budgetHint": string|null,
    "regionHint": string|null,
    "confidence": number
  },
  "recommendations": [{
    "templateSlug": string, // BẮT BUỘC một trong catalog.slug
    "funnelName": string,
    "strategy": string,
    "fitReason": string,
    "offer": string,
    "customerJourney": [{ "step": number, "label": string, "description"?: string }],
    "channels": string[],
    "cta": string,
    "fitScore": number // 0-100
  }],
  "mode": "preview",
  "disclaimers": string[]
}
Quy tắc cứng:
- KHÔNG invent templateSlug ngoài catalog.
- KHÔNG apply/deploy — mode luôn "preview".
- recommendations.length từ 3 đến 5, mỗi slug tối đa 1 lần.
- fitScore phản ánh độ phù hợp với brief.
- Ngôn ngữ tiếng Việt.`;
        const userMsg = [
            `Brief: ${dto.prompt}`,
            dto.productService ? `Sản phẩm/dịch vụ: ${dto.productService}` : null,
            dto.goal ? `Mục tiêu: ${dto.goal}` : null,
            dto.price ? `Giá bán: ${dto.price}` : null,
            dto.audience ? `Đối tượng: ${dto.audience}` : null,
            dto.channels?.length ? `Kênh marketing: ${dto.channels.join(', ')}` : null,
            dto.notes ? `Mô tả thêm: ${dto.notes}` : null,
            dto.industryHint ? `Gợi ý ngành: ${dto.industryHint}` : null,
            dto.regionHint || dto.region ? `Khu vực: ${dto.regionHint || dto.region}` : null,
            dto.budgetHint || dto.budget ? `Ngân sách: ${dto.budgetHint || dto.budget}` : null,
            `Catalog templates: ${JSON.stringify(catalog)}`,
        ]
            .filter(Boolean)
            .join('\n');
        const raw = await this.openAi.chatCompletion({
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: userMsg },
            ],
            temperature: 0.35,
            maxTokens: 2500,
            timeoutMs: 45_000,
        });
        const jsonText = extractJsonObject(raw);
        const parsed = JSON.parse(jsonText);
        return (0, shared_1.parseFunnelGeneratorResult)({
            ...parsed,
            schemaVersion: 'funnel-generator.v1',
            prompt: dto.prompt,
            mode: 'preview',
        });
    }
};
exports.FunnelGeneratorService = FunnelGeneratorService;
exports.FunnelGeneratorService = FunnelGeneratorService = FunnelGeneratorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        openai_service_1.OpenAiService,
        funnel_template_service_1.FunnelTemplateService,
        funnel_lifecycle_service_1.FunnelLifecycleService])
], FunnelGeneratorService);
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
function funnelSpecField(raw, key) {
    let obj = raw;
    if (typeof obj === 'string') {
        try {
            obj = JSON.parse(obj);
        }
        catch {
            return null;
        }
    }
    if (!obj || typeof obj !== 'object')
        return null;
    const value = obj[key];
    return typeof value === 'string' && value.trim() ? value.trim().slice(0, 160) : null;
}
/** Compose structured create-funnel form into one brief for AI + storage */
function composeFunnelBriefPrompt(dto) {
    const lines = [
        dto.productService ? `Sản phẩm/dịch vụ: ${dto.productService.trim()}` : null,
        dto.goal ? `Mục tiêu: ${dto.goal.trim()}` : null,
        dto.price ? `Giá bán: ${dto.price.trim()}` : null,
        dto.budget || dto.budgetHint
            ? `Ngân sách: ${(dto.budget || dto.budgetHint || '').trim()}`
            : null,
        dto.region || dto.regionHint
            ? `Khu vực: ${(dto.region || dto.regionHint || '').trim()}`
            : null,
        dto.audience ? `Đối tượng: ${dto.audience.trim()}` : null,
        dto.channels?.length ? `Kênh marketing: ${dto.channels.map((c) => c.trim()).filter(Boolean).join(', ')}` : null,
        dto.notes ? `Mô tả thêm: ${dto.notes.trim()}` : null,
        `Bạn muốn AI tạo phễu như thế nào?: ${dto.prompt.trim()}`,
    ].filter(Boolean);
    const composed = lines.join('\n');
    return composed.length >= 8 ? composed : dto.prompt.trim();
}
