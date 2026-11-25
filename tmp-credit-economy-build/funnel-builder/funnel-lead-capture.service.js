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
var FunnelLeadCaptureService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FunnelLeadCaptureService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../prisma/prisma.service");
const leads_service_1 = require("../leads/leads.service");
const chatbot_cskh_service_1 = require("../chatbot-cskh/chatbot-cskh.service");
const funnel_canvas_runtime_service_1 = require("../crm/funnel-canvas-runtime.service");
const FUNNEL_SOURCE_CODE = 'FUNNEL';
const CHATBOT_SOURCE_CODE = 'CHATBOT';
const FUNNEL_SCRIPT_TITLE_PREFIX = 'Funnel script';
let FunnelLeadCaptureService = FunnelLeadCaptureService_1 = class FunnelLeadCaptureService {
    prisma;
    leads;
    chatbot;
    canvasRuntime;
    logger = new common_1.Logger(FunnelLeadCaptureService_1.name);
    constructor(prisma, leads, chatbot, canvasRuntime) {
        this.prisma = prisma;
        this.leads = leads;
        this.chatbot = chatbot;
        this.canvasRuntime = canvasRuntime;
    }
    async ensureLeadSource(organizationId, code, name) {
        const existing = await this.prisma.leadSource.findFirst({
            where: { organizationId, code },
        });
        if (existing) {
            if (!existing.isActive) {
                return this.prisma.leadSource.update({
                    where: { id: existing.id },
                    data: { isActive: true },
                });
            }
            return existing;
        }
        return this.prisma.leadSource.create({
            data: { organizationId, code, name, isActive: true },
        });
    }
    async getPublicForm(recommendationId) {
        const { rec, spec } = await this.requireComplete(recommendationId);
        if (rec.status !== 'ACTIVE') {
            throw new common_1.BadRequestException('Funnel chưa ACTIVE — không nhận lead công khai');
        }
        const formId = spec.nodes.find((n) => n.type === 'FORM')?.id ?? rec.id;
        return {
            id: rec.id,
            formId,
            name: spec.name,
            offer: spec.offer,
            cta: spec.cta,
            summary: spec.summary,
            leadForm: spec.leadForm,
            appearance: spec.appearance ?? null,
            chatbotBotId: rec.chatbotBotId,
            mode: spec.mode,
            status: rec.status,
            publishedVersion: rec.publishedVersion,
        };
    }
    async submitPublicLead(recommendationId, dto) {
        const { rec, spec } = await this.requireComplete(recommendationId);
        if (rec.status !== 'ACTIVE') {
            throw new common_1.BadRequestException('Funnel chưa ACTIVE — không nhận lead công khai');
        }
        const answers = (dto.answers ?? {});
        const valid = (0, shared_1.validateFunnelFormAnswers)(spec, answers);
        if (!valid.ok) {
            throw new common_1.BadRequestException({ message: 'Form không hợp lệ', issues: valid.issues });
        }
        const mapped = (0, shared_1.mapFunnelFormAnswersToLead)(spec, answers);
        if (!mapped.phone && spec.leadForm.fields.some((f) => f.required && f.type === 'tel')) {
            throw new common_1.BadRequestException('Thiếu số điện thoại');
        }
        const source = await this.ensureLeadSource(rec.organizationId, FUNNEL_SOURCE_CODE, 'Funnel Form');
        const attribution = {
            ...(dto.attribution ?? {}),
            utmSource: (typeof dto.attribution?.utmSource === 'string' && dto.attribution.utmSource) ||
                'funnel',
            utmMedium: (typeof dto.attribution?.utmMedium === 'string' && dto.attribution.utmMedium) ||
                'lead_form',
            utmCampaign: (typeof dto.attribution?.utmCampaign === 'string' && dto.attribution.utmCampaign) ||
                spec.templateSlug,
            landingPage: dto.landingPage ?? dto.attribution?.landingPage,
            referrer: dto.referrer ?? dto.attribution?.referrer,
        };
        const formId = (typeof dto.formId === 'string' && dto.formId.trim()) ||
            spec.nodes.find((n) => n.type === 'FORM')?.id ||
            rec.id;
        const lead = await this.leads.create(rec.organizationId, {
            name: mapped.name,
            phone: mapped.phone,
            email: mapped.email,
            note: mapped.note,
            leadSourceId: source.id,
            funnelRecommendationId: rec.id,
            tags: ['funnel', spec.templateSlug],
            attribution,
            captureMeta: {
                formId,
                funnelId: rec.id,
                name: mapped.name,
                phone: mapped.phone,
                email: mapped.email,
                extra: mapped.extra,
                source: source.code,
            },
        });
        await this.leads.applyScoringEvent({
            organizationId: rec.organizationId,
            leadId: lead.id,
            eventType: 'FORM_SUBMITTED',
            source: 'funnel_form',
        });
        await this.canvasRuntime.advance({
            organizationId: rec.organizationId,
            leadId: lead.id,
            event: 'FORM_SUBMITTED',
            funnelId: rec.id,
        });
        return {
            ok: true,
            leadId: lead.id,
            updated: lead.updatedAt.getTime() - lead.createdAt.getTime() > 2_000,
            message: 'Cảm ơn bạn! Spa sẽ liên hệ sớm qua số điện thoại vừa để lại.',
        };
    }
    async bindChatbot(user, recommendationId, botId) {
        const { rec, spec } = await this.requireComplete(recommendationId, user.organizationId);
        await this.ensureLeadSource(user.organizationId, CHATBOT_SOURCE_CODE, 'Chatbot CSKH');
        const greeting = (0, shared_1.funnelChatbotGreetingFromFlow)(spec);
        const knowledge = (0, shared_1.serializeFunnelChatbotFlowToKnowledge)(spec);
        const mainServices = [spec.offer, spec.cta].filter(Boolean).join(' · ').slice(0, 4000);
        let bot;
        const existingId = botId || rec.chatbotBotId;
        if (existingId) {
            bot = await this.chatbot.updateBot(user.organizationId, existingId, {
                botName: spec.chatbotFlow.name.slice(0, 120),
                businessName: spec.name.slice(0, 160),
                industry: spec.templateSlug,
                mainServices,
                greeting,
                consultationTone: 'friendly',
                status: database_1.ChatbotBotStatus.ACTIVE,
            });
        }
        else {
            bot = await this.chatbot.createBot(user.organizationId, {
                botName: spec.chatbotFlow.name.slice(0, 120),
                businessName: spec.name.slice(0, 160),
                industry: spec.templateSlug,
                mainServices,
                greeting,
                consultationTone: 'friendly',
                status: database_1.ChatbotBotStatus.ACTIVE,
            });
        }
        const title = `${FUNNEL_SCRIPT_TITLE_PREFIX} ${spec.templateSlug}`.slice(0, 160);
        const existingKb = await this.prisma.chatbotKnowledgeSource.findFirst({
            where: { organizationId: user.organizationId, botId: bot.id, title },
        });
        if (existingKb) {
            await this.prisma.chatbotKnowledgeSource.update({
                where: { id: existingKb.id },
                data: { content: knowledge, status: 'active', sourceType: database_1.ChatbotSourceType.MANUAL },
            });
        }
        else {
            await this.chatbot.createKnowledge(user.organizationId, {
                botId: bot.id,
                title,
                sourceType: database_1.ChatbotSourceType.MANUAL,
                content: knowledge,
            });
        }
        await this.prisma.funnelRecommendation.update({
            where: { id: rec.id },
            data: { chatbotBotId: bot.id },
        });
        const embed = await this.chatbot.getEmbedCode(user.organizationId, bot.id);
        this.logger.log(`Bound funnel ${rec.id} → chatbot ${bot.id}`);
        return {
            recommendationId: rec.id,
            botId: bot.id,
            botName: bot.botName,
            greeting,
            embed,
            applied: false,
            deployable: false,
        };
    }
    async requireComplete(recommendationId, organizationId) {
        const rec = await this.prisma.funnelRecommendation.findFirst({
            where: {
                id: recommendationId,
                ...(organizationId ? { organizationId } : {}),
            },
        });
        if (!rec)
            throw new common_1.NotFoundException('Funnel không tồn tại');
        if (!rec.completeSpec && !rec.publishedSpec) {
            throw new common_1.BadRequestException('Funnel chưa có completeSpec');
        }
        const liveJson = rec.status === 'ACTIVE' && rec.publishedSpec ? rec.publishedSpec : rec.completeSpec;
        if (!liveJson) {
            throw new common_1.BadRequestException('Funnel chưa có spec');
        }
        let spec;
        try {
            spec = (0, shared_1.parseFunnelCompleteSpec)(liveJson);
        }
        catch {
            throw new common_1.BadRequestException('completeSpec không hợp lệ');
        }
        return { rec, spec };
    }
};
exports.FunnelLeadCaptureService = FunnelLeadCaptureService;
exports.FunnelLeadCaptureService = FunnelLeadCaptureService = FunnelLeadCaptureService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        leads_service_1.LeadsService,
        chatbot_cskh_service_1.ChatbotCskhService,
        funnel_canvas_runtime_service_1.FunnelCanvasRuntimeService])
], FunnelLeadCaptureService);
