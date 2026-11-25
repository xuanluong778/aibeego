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
exports.MarketingAutopilotContentDraftService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@marketingspa/shared");
const teleprompter_source_service_1 = require("../content-marketing/teleprompter-source.service");
const openai_service_1 = require("../openai/openai.service");
const shared_2 = require("@marketingspa/shared");
let MarketingAutopilotContentDraftService = class MarketingAutopilotContentDraftService {
    teleprompter;
    openai;
    constructor(teleprompter, openai) {
        this.teleprompter = teleprompter;
        this.openai = openai;
    }
    buildInputFromPlan(plan, project) {
        return {
            productName: plan.offer?.productName || project.productName || 'Sản phẩm',
            productPrice: plan.offer?.productPrice ?? (project.productPrice != null ? Number(project.productPrice) : undefined),
            customerProfile: plan.customersTarget?.targetProfile || project.customerProfile || '',
            targetArea: plan.customersTarget?.targetArea || project.targetArea || '',
            primaryGoal: plan.offer?.primaryGoal || project.primaryGoal || '',
            valueProps: plan.offer?.valueProps,
            valueProposition: plan.valueProposition,
            icpProfiles: plan.icpProfiles,
        };
    }
    async generateBundle(plan, project, opts) {
        const input = this.buildInputFromPlan(plan, project);
        const base = (0, shared_1.generateAutopilotContentIdeas)(input, opts);
        if (!this.openai.isConfigured())
            return base;
        try {
            const enriched = await this.tryLlmEnrich(input, base);
            return enriched ?? base;
        }
        catch {
            return base;
        }
    }
    async tryLlmEnrich(input, base) {
        const prompt = [
            'Bạn là copywriter marketing spa/làm đẹp Việt Nam. Cải thiện 5 content ideas sau — giữ format JSON, index 1-5.',
            'Yêu cầu: cụ thể theo sản phẩm/ICP/khu vực; KHÔNG dùng "Angle theo lợi ích", "Short video", "Carousel" làm title.',
            'NGÀNH NHẠY CẢM: không cam kết 100%, không bịa số liệu, dùng "có thể hỗ trợ", "tùy cơ địa".',
            `Sản phẩm: ${input.productName}. ICP: ${input.customerProfile}. Khu vực: ${input.targetArea}. Mục tiêu: ${input.primaryGoal}.`,
            'Trả về JSON object { "ideas": [...] } cùng schema (title, hook, customerInsight, angle, fullContent, offer, cta, channel, format, formatLabel, shortVideo?, carousel?, safetyNotes?).',
            'Draft hiện tại:',
            JSON.stringify(base.ideas).slice(0, 12000),
        ].join('\n');
        const raw = await this.openai.chatCompletion({
            messages: [
                { role: 'system', content: 'Trả về JSON hợp lệ duy nhất, không markdown.' },
                { role: 'user', content: prompt },
            ],
            temperature: 0.4,
            maxTokens: 4000,
            timeoutMs: 25000,
        });
        const json = (0, shared_2.extractMarketingAutopilotPlannerJson)(raw);
        if (!json || typeof json !== 'object')
            return null;
        const ideas = json.ideas;
        if (!Array.isArray(ideas) || ideas.length < 5)
            return null;
        const merged = {
            ...base,
            ideas: ideas.slice(0, 5).map((idea, i) => ({ ...base.ideas[i], ...idea, index: i + 1 })),
        };
        // Never persist LLM enrichment that fails quality/generic checks — keep deterministic base.
        if (!(0, shared_1.assertAutopilotContentBundleQuality)(merged))
            return null;
        return merged;
    }
    async upsertTeleprompterFromBundle(user, project, bundle, existingContentId) {
        const script = (0, shared_1.formatAutopilotContentBundleScript)(bundle);
        const firstVideo = bundle.ideas.find((i) => i.format === 'short_video') ?? bundle.ideas[0];
        return this.teleprompter.upsert(user, {
            id: existingContentId ?? undefined,
            sourceType: 'marketing_autopilot',
            sourceRoute: `/marketing-autopilot/projects/${project.id}`,
            sourceTitle: `Autopilot: ${project.name}`.slice(0, 500),
            originalScript: script,
            editedScript: script,
            clientContentId: `autopilot-content-${project.id}`,
            videoHook: firstVideo.hook?.slice(0, 500),
            facebookPost: firstVideo.hook?.slice(0, 2000),
        });
    }
    async saveIdeaToStudio(user, project, idea) {
        const script = (0, shared_1.formatAutopilotContentIdeaMarkdown)(idea);
        return this.teleprompter.upsert(user, {
            sourceType: 'marketing_autopilot',
            sourceRoute: `/marketing-autopilot/projects/${project.id}`,
            sourceTitle: `${project.name} — Idea ${idea.index}: ${idea.title}`.slice(0, 500),
            originalScript: script,
            editedScript: script,
            clientContentId: `autopilot-content-${project.id}-idea-${idea.index}-${Date.now()}`,
            videoHook: idea.hook?.slice(0, 500),
            facebookPost: idea.hook?.slice(0, 2000),
        });
    }
    parseBundleFromTeleprompter(script) {
        return (0, shared_1.parseAutopilotContentBundleFromScript)(script);
    }
    assertTeleprompterFound(row) {
        if (!row)
            throw new common_1.NotFoundException('Không tìm thấy Content Draft');
    }
};
exports.MarketingAutopilotContentDraftService = MarketingAutopilotContentDraftService;
exports.MarketingAutopilotContentDraftService = MarketingAutopilotContentDraftService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [teleprompter_source_service_1.TeleprompterSourceService,
        openai_service_1.OpenAiService])
], MarketingAutopilotContentDraftService);
