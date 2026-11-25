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
var MarketingAutopilotDraftAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketingAutopilotDraftAdapter = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const shared_1 = require("@marketingspa/shared");
const teleprompter_source_service_1 = require("../content-marketing/teleprompter-source.service");
const domain_stubs_1 = require("./compat/domain-stubs");
const domain_stubs_2 = require("./compat/domain-stubs");
const automation_service_1 = require("../automation/automation.service");
const messaging_campaign_service_1 = require("../messaging-campaign/messaging-campaign.service");
const prisma_service_1 = require("../prisma/prisma.service");
const marketing_autopilot_content_draft_service_1 = require("./marketing-autopilot-content-draft.service");
let MarketingAutopilotDraftAdapter = MarketingAutopilotDraftAdapter_1 = class MarketingAutopilotDraftAdapter {
    prisma;
    teleprompterSource;
    funnelBuilder;
    funnelGenerator;
    automation;
    messagingCampaign;
    contentDraft;
    logger = new common_1.Logger(MarketingAutopilotDraftAdapter_1.name);
    constructor(prisma, teleprompterSource, funnelBuilder, funnelGenerator, automation, messagingCampaign, contentDraft) {
        this.prisma = prisma;
        this.teleprompterSource = teleprompterSource;
        this.funnelBuilder = funnelBuilder;
        this.funnelGenerator = funnelGenerator;
        this.automation = automation;
        this.messagingCampaign = messagingCampaign;
        this.contentDraft = contentDraft;
    }
    async createDraft(type, user, plan, project) {
        const safePlan = (0, shared_1.normalizeAutopilotPlanForDraft)(plan, {
            productName: project.productName,
            primaryGoal: project.primaryGoal,
            customerProfile: project.customerProfile,
            targetArea: project.targetArea,
            productPrice: project.productPrice,
        });
        try {
            switch (type) {
                case 'CONTENT_DRAFT':
                    return await this.createContentDraft(user, safePlan, project);
                case 'FUNNEL_DRAFT':
                    return await this.createFunnelDraft(user, safePlan, project);
                case 'AUTOMATION_DRAFT':
                    return await this.createAutomationDraft(user, safePlan, project.name);
                case 'CAMPAIGN_DRAFT':
                    return await this.createCampaignDraft(user, safePlan, project.name);
                default:
                    throw new common_1.BadRequestException(`Loại Draft không hỗ trợ: ${String(type)}`);
            }
        }
        catch (err) {
            if (err instanceof common_1.BadRequestException)
                throw err;
            const detail = err instanceof Error ? err.message : String(err);
            this.logger.error(`createDraft(${type}) failed org=${user.organizationId}: ${detail}`);
            throw new common_1.BadRequestException(`Không tạo được ${type}: ${detail}. Kiểm tra dữ liệu plan (offer/content/funnel/crm) hoặc thử lại.`);
        }
    }
    async createContentDraft(user, plan, project) {
        const bundle = await this.contentDraft.generateBundle(plan, project);
        const row = await this.contentDraft.upsertTeleprompterFromBundle(user, project, bundle);
        const editUrl = (0, shared_1.resolveAutopilotDraftEditUrl)('CONTENT_DRAFT', row.id);
        return {
            adapter: 'TeleprompterSourceService',
            externalEntityType: 'content_teleprompter_source',
            externalEntityId: row.id,
            editUrl,
            metadata: {
                sourceTitle: row.sourceTitle,
                grounded: true,
                draftOnly: true,
                livePublishBlocked: true,
                productName: plan.offer.productName,
                primaryGoal: plan.offer.primaryGoal,
                editUrl,
                contentIdeas: bundle.ideas,
                contentBundleVersion: bundle.version,
                ideaCount: bundle.ideas.length,
            },
        };
    }
    /**
     * Real Funnel asset = FunnelRecommendation + completeSpec (canvas-editable).
     * NOT FunnelBlueprint alone — UI opens via /funnel?draft={recommendationId}.
     */
    async createFunnelDraft(user, plan, project) {
        const stages = plan.funnel?.stages?.length
            ? plan.funnel.stages
            : [
                { name: 'Awareness', objective: 'Thu hút' },
                { name: 'Conversion', objective: 'Chốt' },
            ];
        const prompt = `Autopilot Funnel — ${project.name}. ` +
            `Mục tiêu: ${plan.offer.primaryGoal}. ` +
            `Sản phẩm: ${plan.offer.productName} (${plan.offer.productPrice} VND). ` +
            `Khách hàng: ${plan.customersTarget.targetProfile}. ` +
            `Khu vực: ${plan.customersTarget.targetArea}. ` +
            `Value prop: ${plan.valueProposition ?? plan.offer.valueProps.join('; ')}. ` +
            `Bottlenecks: ${(plan.businessDiagnosis?.bottlenecks ?? []).join('; ') || 'n/a'}. ` +
            `Funnel stages: ${stages.map((s) => `${s.name}→${s.objective}`).join(' | ')}. ` +
            `DRAFT ONLY — không publish/live.`;
        const recId = await this.ensureFunnelRecommendationWithCompleteSpec(user, prompt, plan);
        try {
            const blueprint = await this.funnelBuilder.generate(user, {
                prompt,
                includeAutomations: false,
            });
            await this.funnelBuilder.apply(user, {
                blueprintId: blueprint.id,
                applyStages: true,
                applyFlows: false,
                activateFlows: false,
                deactivateMissingStages: false,
            }, false);
        }
        catch (err) {
            this.logger.warn(`Funnel CRM stage seed soft-fail: ${err instanceof Error ? err.message : String(err)}`);
        }
        const row = await this.prisma.marketingAutopilotFunnelSpec.findFirst({
            where: { id: recId, organizationId: user.organizationId },
        });
        if (!row?.completeSpec) {
            throw new common_1.BadRequestException('Funnel completeSpec chưa được tạo — không mở canvas được');
        }
        const editUrl = (0, shared_1.resolveAutopilotDraftEditUrl)('FUNNEL_DRAFT', recId);
        return {
            adapter: 'FunnelGeneratorService',
            externalEntityType: 'funnel_recommendation',
            externalEntityId: recId,
            editUrl,
            metadata: {
                name: project.name,
                status: row.status,
                selectedSlug: row.selectedSlug,
                hasCompleteSpec: true,
                grounded: true,
                draftOnly: true,
                includeAutomations: false,
                editUrl,
                stages: stages.map((s) => s.name),
            },
        };
    }
    defaultFunnelSlug() {
        return 'consultation';
    }
    async persistFallbackCompleteSpec(recommendationId, slug, prompt) {
        const preview = (0, shared_1.buildFallbackFunnelRecommendations)(prompt);
        const complete = (0, shared_1.buildFallbackFunnelComplete)({
            templateSlug: slug,
            option: preview.recommendations.find((r) => r.templateSlug === slug),
            analysis: preview.analysis,
        });
        await this.prisma.marketingAutopilotFunnelSpec.update({
            where: { id: recommendationId },
            data: {
                selectedSlug: slug,
                selectedAt: new Date(),
                completeSpec: complete,
                completeSource: 'fallback',
                completeGeneratedAt: new Date(),
            },
        });
    }
    async ensureFunnelRecommendationWithCompleteSpec(user, prompt, plan) {
        try {
            const rec = await Promise.race([
                this.funnelGenerator.generate(user, {
                    prompt,
                    productService: plan.offer.productName,
                    region: plan.customersTarget.targetArea,
                    budget: String(plan.budget?.monthlyBudget ?? plan.offer.productPrice ?? 0),
                }, { skipQuota: true }),
                new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Funnel generate timeout')), 20_000);
                }),
            ]);
            const rawSlug = rec.recommendations?.[0]
                ?.templateSlug ?? this.defaultFunnelSlug();
            const slug = (rawSlug === 'lead-magnet' ? this.defaultFunnelSlug() : rawSlug);
            try {
                await this.prisma.marketingAutopilotFunnelSpec.update({
                    where: { id: rec.id },
                    data: { selectedSlug: slug, selectedAt: new Date() },
                });
                await Promise.race([
                    this.funnelGenerator.generateComplete(user, rec.id),
                    new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('Funnel generateComplete timeout')), 20_000);
                    }),
                ]);
            }
            catch (completeErr) {
                this.logger.warn(`generateComplete fallback: ${completeErr instanceof Error ? completeErr.message : String(completeErr)}`);
                await this.persistFallbackCompleteSpec(rec.id, slug, prompt);
            }
            return rec.id;
        }
        catch (err) {
            this.logger.warn(`Funnel generate fallback row: ${err instanceof Error ? err.message : String(err)}`);
            const preview = (0, shared_1.buildFallbackFunnelRecommendations)(prompt);
            const slug = (preview.recommendations[0]?.templateSlug ??
                this.defaultFunnelSlug());
            const complete = (0, shared_1.buildFallbackFunnelComplete)({
                templateSlug: slug,
                option: preview.recommendations[0],
                analysis: preview.analysis,
            });
            const row = await this.prisma.marketingAutopilotFunnelSpec.create({
                data: {
                    organizationId: user.organizationId,
                    createdById: user.id,
                    prompt,
                    result: preview,
                    source: 'fallback',
                    selectedSlug: slug,
                    selectedAt: new Date(),
                    completeSpec: complete,
                    completeSource: 'fallback',
                    completeGeneratedAt: new Date(),
                    status: 'DRAFT',
                },
            });
            return row.id;
        }
    }
    async createAutomationDraft(user, plan, projectName) {
        const keyFlows = plan.chatbot?.keyFlows?.length
            ? plan.chatbot.keyFlows
            : ['Chào hỏi', 'Tư vấn', 'CTA'];
        const lifecycle = plan.crm?.lifecycle?.length ? plan.crm.lifecycle : ['New', 'MQL', 'SQL'];
        const flow = await this.automation.createFlow(user.organizationId, {
            name: `Autopilot Automation — ${projectName}`.slice(0, 200),
            triggerType: database_1.AutomationTriggerType.LEAD_CREATED,
            isActive: false,
            isPaused: true,
            delayMinutes: 0,
            channel: database_1.MessageChannel.EMAIL,
            actions: [
                ...keyFlows.map((flowText, index) => ({
                    type: 'DRAFT_STEP',
                    order: index + 1,
                    text: flowText,
                })),
                ...lifecycle.slice(0, 3).map((stage, index) => ({
                    type: 'DRAFT_CRM_STAGE',
                    order: keyFlows.length + index + 1,
                    text: `CRM stage: ${stage}`,
                })),
            ],
            triggerConfig: {
                source: 'marketing_autopilot_v3',
                draftOnly: true,
                crmLifecycle: lifecycle,
                chatbotPurpose: plan.chatbot?.purpose ?? 'Tư vấn & thu lead',
                primaryGoal: plan.offer.primaryGoal,
                productName: plan.offer.productName,
                bottlenecks: plan.businessDiagnosis?.bottlenecks ?? [],
            },
        }, user.id, false);
        if (flow.isActive) {
            throw new common_1.BadRequestException('Automation Draft không được phép active — aborted');
        }
        const editUrl = (0, shared_1.resolveAutopilotDraftEditUrl)('AUTOMATION_DRAFT', flow.id);
        return {
            adapter: 'AutomationService',
            externalEntityType: 'automation_flow',
            externalEntityId: flow.id,
            editUrl,
            metadata: {
                name: flow.name,
                isActive: flow.isActive,
                isPaused: flow.isPaused,
                grounded: true,
                draftOnly: true,
                livePublishBlocked: true,
                editUrl,
            },
        };
    }
    async createCampaignDraft(user, plan, projectName) {
        const campaign = await this.messagingCampaign.create(user.organizationId, {
            name: `Autopilot Campaign — ${projectName}`.slice(0, 200),
            channel: database_1.MessageChannel.EMAIL,
            campaignType: database_1.MessagingCampaignKind.BROADCAST,
            segmentConfig: {
                source: 'marketing_autopilot_v3',
                draftOnly: true,
                remarketing: plan.remarketing,
                communications: plan.communications,
                icp: plan.customersTarget,
                channelStrategy: plan.channelStrategy ?? [],
            },
            variables: {
                primaryGoal: plan.offer.primaryGoal,
                productName: plan.offer.productName,
                valueProposition: plan.valueProposition ?? '',
                targetArea: plan.customersTarget.targetArea,
            },
        }, user.id);
        if (String(campaign.status) !== 'DRAFT') {
            throw new common_1.BadRequestException(`Campaign phải ở trạng thái DRAFT, nhận được: ${campaign.status}`);
        }
        const editUrl = (0, shared_1.resolveAutopilotDraftEditUrl)('CAMPAIGN_DRAFT', campaign.id);
        return {
            adapter: 'MessagingCampaignService',
            externalEntityType: 'messaging_campaign',
            externalEntityId: campaign.id,
            editUrl,
            metadata: {
                name: campaign.name,
                status: campaign.status,
                channel: campaign.channel,
                grounded: true,
                draftOnly: true,
                liveSendBlocked: true,
                facebookWriteBlocked: true,
                editUrl,
            },
        };
    }
};
exports.MarketingAutopilotDraftAdapter = MarketingAutopilotDraftAdapter;
exports.MarketingAutopilotDraftAdapter = MarketingAutopilotDraftAdapter = MarketingAutopilotDraftAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        teleprompter_source_service_1.TeleprompterSourceService,
        domain_stubs_1.FunnelBuilderService,
        domain_stubs_2.FunnelGeneratorService,
        automation_service_1.AutomationService,
        messaging_campaign_service_1.MessagingCampaignService,
        marketing_autopilot_content_draft_service_1.MarketingAutopilotContentDraftService])
], MarketingAutopilotDraftAdapter);
