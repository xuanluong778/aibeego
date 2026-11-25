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
var MarketingAutopilotExecutorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketingAutopilotExecutorService = void 0;
/**
 * AI Executor — after Blueprint, create REAL draft assets via existing domain services.
 * All assets DRAFT/PAUSED; linked by missionId via MarketingMissionAsset (+ AutopilotDraft registry).
 */
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../../prisma/prisma.service");
const teleprompter_source_service_1 = require("../../content-marketing/teleprompter-source.service");
const domain_stubs_1 = require("../compat/domain-stubs");
const automation_service_1 = require("../../automation/automation.service");
const messaging_campaign_service_1 = require("../../messaging-campaign/messaging-campaign.service");
const auto_post_service_1 = require("../../auto-post/auto-post.service");
const domain_stubs_2 = require("../compat/domain-stubs");
const chatbot_cskh_service_1 = require("../../chatbot-cskh/chatbot-cskh.service");
const domain_stubs_3 = require("../compat/domain-stubs");
const ai_ads_manager_service_1 = require("../../ai-ads-manager/ai-ads-manager.service");
const marketing_autopilot_draft_adapter_1 = require("../marketing-autopilot-draft.adapter");
let MarketingAutopilotExecutorService = MarketingAutopilotExecutorService_1 = class MarketingAutopilotExecutorService {
    prisma;
    draftAdapter;
    teleprompter;
    funnelBuilder;
    funnelGenerator;
    automation;
    messagingCampaign;
    autoPost;
    emailMarketing;
    chatbot;
    leadScoring;
    aiAds;
    logger = new common_1.Logger(MarketingAutopilotExecutorService_1.name);
    constructor(prisma, draftAdapter, teleprompter, funnelBuilder, funnelGenerator, automation, messagingCampaign, autoPost, emailMarketing, chatbot, leadScoring, aiAds) {
        this.prisma = prisma;
        this.draftAdapter = draftAdapter;
        this.teleprompter = teleprompter;
        this.funnelBuilder = funnelBuilder;
        this.funnelGenerator = funnelGenerator;
        this.automation = automation;
        this.messagingCampaign = messagingCampaign;
        this.autoPost = autoPost;
        this.emailMarketing = emailMarketing;
        this.chatbot = chatbot;
        this.leadScoring = leadScoring;
        this.aiAds = aiAds;
    }
    async executeMissionAssets(input) {
        const { missionId, user, project, draftRunId } = input;
        const plan = (0, shared_1.normalizeAutopilotPlanForDraft)(input.plan, {
            productName: project.productName,
            primaryGoal: project.primaryGoal,
            customerProfile: project.customerProfile,
            targetArea: project.targetArea,
            productPrice: project.productPrice,
        });
        const assets = [];
        const skipped = [];
        const draftRegistry = [];
        const register = async (row) => {
            assets.push(row);
            await this.prisma.marketingMissionAsset.upsert({
                where: {
                    organizationId_entityType_entityId: {
                        organizationId: user.organizationId,
                        entityType: row.entityType,
                        entityId: row.entityId,
                    },
                },
                create: {
                    organizationId: user.organizationId,
                    missionId,
                    module: row.module,
                    assetType: row.assetType ?? null,
                    recommendationId: row.recommendationId ?? null,
                    entityType: row.entityType,
                    entityId: row.entityId,
                    editUrl: row.editUrl ?? null,
                    status: row.status,
                    adapter: row.adapter,
                    metadataJson: {
                        missionId,
                        draftOnly: true,
                        liveActionsEnabled: false,
                        editUrl: row.editUrl ?? null,
                        recommendationId: row.recommendationId ?? null,
                        ...(row.metadata ?? {}),
                    },
                },
                update: {
                    missionId,
                    status: row.status,
                    assetType: row.assetType ?? undefined,
                    recommendationId: row.recommendationId ?? undefined,
                    editUrl: row.editUrl ?? undefined,
                    metadataJson: {
                        missionId,
                        draftOnly: true,
                        liveActionsEnabled: false,
                        editUrl: row.editUrl ?? null,
                        recommendationId: row.recommendationId ?? null,
                        ...(row.metadata ?? {}),
                    },
                },
            });
        };
        const soft = async (module, fn) => {
            try {
                await fn();
            }
            catch (err) {
                const reason = err instanceof Error ? err.message : String(err);
                this.logger.warn(`[executor] ${module} skipped: ${reason}`);
                skipped.push({ module, reason });
            }
        };
        // Dependency order: Funnel → Content → Automation → Campaign
        const coreTypes = (0, shared_1.sortDraftTypesByDependency)([
            'FUNNEL_DRAFT',
            'CONTENT_DRAFT',
            'AUTOMATION_DRAFT',
            'CAMPAIGN_DRAFT',
        ]);
        let funnelDomainId = null;
        for (const type of coreTypes) {
            await soft(type, async () => {
                const existing = await this.prisma.marketingAutopilotDraft.findFirst({
                    where: { organizationId: user.organizationId, missionId, type },
                    orderBy: { createdAt: 'desc' },
                });
                if (existing) {
                    const payload = existing.payload;
                    const entityId = payload?.adapter?.externalEntityId ?? existing.id;
                    const entityType = payload?.adapter?.externalEntityType ?? `autopilot_${type.toLowerCase()}`;
                    const editUrl = payload?.adapter?.editUrl ?? (0, shared_1.resolveAutopilotDraftEditUrl)(type, entityId);
                    draftRegistry.push({
                        type,
                        draftId: existing.id,
                        externalEntityId: entityId,
                    });
                    if (type === 'FUNNEL_DRAFT')
                        funnelDomainId = entityId;
                    await register({
                        module: type === 'CONTENT_DRAFT'
                            ? 'CONTENT'
                            : type === 'FUNNEL_DRAFT'
                                ? 'FUNNEL'
                                : type === 'AUTOMATION_DRAFT'
                                    ? 'AUTOMATION'
                                    : 'CAMPAIGN',
                        assetType: type,
                        entityType,
                        entityId,
                        editUrl,
                        status: existing.status || 'DRAFT',
                        adapter: payload?.adapter?.adapter ?? 'existing_draft',
                        recommendationId: `nba:${type}`,
                        metadata: { reused: true, draftId: existing.id },
                    });
                    return;
                }
                const adapterResult = await this.draftAdapter.createDraft(type, user, plan, project);
                const editUrl = adapterResult.editUrl ??
                    (0, shared_1.resolveAutopilotDraftEditUrl)(type, adapterResult.externalEntityId);
                const draft = await this.prisma.marketingAutopilotDraft.create({
                    data: {
                        organizationId: user.organizationId,
                        createdById: user.id,
                        projectId: project.id,
                        runId: draftRunId,
                        missionId,
                        type,
                        status: 'DRAFT',
                        payload: {
                            generatedBy: 'marketing_autopilot_executor',
                            draftOnly: true,
                            liveActionsEnabled: false,
                            missionId,
                            plan,
                            adapter: { ...adapterResult, editUrl },
                        },
                    },
                });
                draftRegistry.push({
                    type,
                    draftId: draft.id,
                    externalEntityId: adapterResult.externalEntityId,
                });
                if (type === 'FUNNEL_DRAFT')
                    funnelDomainId = adapterResult.externalEntityId;
                await register({
                    module: type === 'CONTENT_DRAFT'
                        ? 'CONTENT'
                        : type === 'FUNNEL_DRAFT'
                            ? 'FUNNEL'
                            : type === 'AUTOMATION_DRAFT'
                                ? 'AUTOMATION'
                                : 'CAMPAIGN',
                    assetType: type,
                    entityType: adapterResult.externalEntityType,
                    entityId: adapterResult.externalEntityId,
                    editUrl,
                    status: 'DRAFT',
                    adapter: adapterResult.adapter,
                    recommendationId: `nba:${type}`,
                    metadata: {
                        ...(adapterResult.metadata ?? {}),
                        draftId: draft.id,
                        editUrl,
                    },
                });
            });
        }
        // --- Funnel Recommendation only if core FUNNEL_DRAFT did not create one ---
        let funnelRecId = funnelDomainId;
        await soft('FUNNEL_RECOMMENDATION', async () => {
            if (funnelRecId)
                return;
            const existing = await this.prisma.marketingMissionAsset.findFirst({
                where: { missionId, entityType: 'funnel_recommendation' },
            });
            if (existing) {
                funnelRecId = existing.entityId;
                return;
            }
            const prompt = `Autopilot Mission ${missionId.slice(0, 8)}. ` +
                `Mục tiêu: ${plan.offer.primaryGoal}. Sản phẩm: ${plan.offer.productName}. ` +
                `Khách: ${plan.customersTarget.targetProfile}. Khu vực: ${plan.customersTarget.targetArea}. ` +
                `DRAFT ONLY — không publish.`;
            const rec = await this.funnelGenerator.generate(user, {
                prompt,
                productService: plan.offer.productName,
                region: plan.customersTarget.targetArea,
                budget: String(plan.budget?.monthlyBudget ?? project.productPrice ?? 0),
            }, { skipQuota: true });
            funnelRecId = rec.id;
            const firstSlug = rec.recommendations?.[0]
                ?.templateSlug === 'lead-magnet'
                ? 'consultation'
                : rec.recommendations?.[0]
                    ?.templateSlug ?? 'consultation';
            if (firstSlug) {
                await this.prisma.marketingAutopilotFunnelSpec.update({
                    where: { id: rec.id },
                    data: { selectedSlug: firstSlug, selectedAt: new Date() },
                });
                try {
                    await this.funnelGenerator.generateComplete(user, rec.id);
                }
                catch (completeErr) {
                    this.logger.warn(`[executor] generateComplete soft-fail: ${completeErr instanceof Error ? completeErr.message : String(completeErr)}`);
                }
            }
            const row = await this.prisma.marketingAutopilotFunnelSpec.findFirst({
                where: { id: rec.id, organizationId: user.organizationId },
            });
            const editUrl = (0, shared_1.resolveAutopilotDraftEditUrl)('FUNNEL_DRAFT', rec.id);
            await register({
                module: 'FUNNEL',
                assetType: 'FUNNEL_DRAFT',
                entityType: 'funnel_recommendation',
                entityId: rec.id,
                editUrl,
                status: row?.status ?? 'DRAFT',
                adapter: 'FunnelGeneratorService',
                recommendationId: `nba:FUNNEL_DRAFT`,
                metadata: {
                    selectedSlug: firstSlug,
                    hasCompleteSpec: !!row?.completeSpec,
                    applied: false,
                    deployable: false,
                    editUrl,
                },
            });
        });
        // --- CRM lead scoring mapped to funnel (draft config) ---
        if (funnelRecId) {
            await soft('CRM_SCORING', async () => {
                await this.leadScoring.upsertConfig(user.organizationId, funnelRecId, {
                    maxScore: 100,
                    mqlThreshold: 50,
                    sqlThreshold: 80,
                    isActive: true,
                    source: 'marketing_autopilot_executor',
                    rules: (plan.crm?.lifecycle ?? ['New', 'MQL', 'SQL']).slice(0, 5).map((stage, i) => ({
                        key: `autopilot_${stage}`.toLowerCase().replace(/\s+/g, '_'),
                        label: `Autopilot: ${stage}`,
                        eventType: 'custom',
                        points: 10 + i * 5,
                        isActive: true,
                        position: i + 1,
                    })),
                });
                const cfg = await this.prisma.marketingAutopilotScoringConfig.findFirst({
                    where: { organizationId: user.organizationId, funnelId: funnelRecId },
                });
                if (cfg) {
                    await register({
                        module: 'CRM',
                        entityType: 'funnel_scoring_config',
                        entityId: cfg.id,
                        status: 'DRAFT',
                        adapter: 'LeadScoringService',
                        metadata: { funnelId: funnelRecId, missionId },
                    });
                }
            });
        }
        // --- Content AutoPost drafts (visible on /content) ---
        await soft('CONTENT_AUTOPOST', async () => {
            const themes = plan.content?.themes?.length
                ? plan.content.themes.slice(0, 3)
                : [plan.offer.primaryGoal, plan.offer.productName];
            for (const theme of themes) {
                const caption = [
                    `${theme}`,
                    '',
                    plan.valueProposition ?? plan.offer.valueProps?.[0] ?? plan.offer.productName,
                    '',
                    `CTA: ${plan.offer.primaryGoal}`,
                    `#${plan.offer.productName.replace(/\s+/g, '')} #MarketingAutopilot`,
                    '',
                    '[DRAFT — chưa publish Facebook]',
                ].join('\n');
                const post = await this.autoPost.saveDraft(user, {
                    postType: database_1.AutoPostType.SPA_SALES,
                    topic: `Autopilot: ${theme}`.slice(0, 500),
                    caption,
                    cta: plan.offer.primaryGoal.slice(0, 200),
                    spaService: plan.offer.productName.slice(0, 200),
                    targetAudience: plan.customersTarget.targetProfile.slice(0, 500),
                    tone: 'professional',
                    promotion: plan.offer.primaryGoal.slice(0, 300),
                });
                if (String(post.status) !== 'DRAFT') {
                    throw new Error(`AutoPost phải DRAFT, nhận ${post.status}`);
                }
                await register({
                    module: 'CONTENT',
                    entityType: 'auto_post',
                    entityId: post.id,
                    status: 'DRAFT',
                    adapter: 'AutoPostService',
                    metadata: { topic: theme, missionId },
                });
            }
        });
        // --- Extra content: ads copy + video hook on teleprompter already created; add facebookPost enrich ---
        await soft('CONTENT_ADS_COPY', async () => {
            const source = await this.teleprompter.upsert(user, {
                sourceType: 'marketing_autopilot_ads_copy',
                sourceRoute: `/marketing-autopilot/missions/${missionId}`,
                sourceTitle: `Ads Copy Draft — ${project.name}`.slice(0, 500),
                originalScript: [
                    `Headline: ${plan.offer.productName} — ${plan.offer.primaryGoal}`,
                    `Primary text: ${plan.valueProposition ?? plan.offer.valueProps.join('; ')}`,
                    `Audience: ${plan.customersTarget.targetProfile}`,
                    `CTA: Tìm hiểu / Đặt lịch ngay`,
                    'DRAFT ONLY — không chạy Ads live.',
                ].join('\n'),
                editedScript: [
                    `Headline: ${plan.offer.productName} — ${plan.offer.primaryGoal}`,
                    `Primary text: ${plan.valueProposition ?? plan.offer.valueProps.join('; ')}`,
                    `Audience: ${plan.customersTarget.targetProfile}`,
                    `CTA: Tìm hiểu / Đặt lịch ngay`,
                    'DRAFT ONLY — không chạy Ads live.',
                ].join('\n'),
                clientContentId: `autopilot-ads-copy-${missionId}`,
                facebookPost: `${plan.offer.productName}: ${plan.offer.primaryGoal}. ${plan.valueProposition ?? ''}`.slice(0, 2000),
                videoHook: plan.content?.themes?.[0],
            });
            await register({
                module: 'CONTENT',
                entityType: 'content_teleprompter_source',
                entityId: source.id,
                status: 'DRAFT',
                adapter: 'TeleprompterSourceService',
                metadata: { kind: 'ads_copy', missionId },
            });
        });
        // --- Chatbot DRAFT ---
        await soft('CHATBOT', async () => {
            const bot = await this.chatbot.createBot(user.organizationId, {
                botName: `Autopilot CSKH — ${project.name}`.slice(0, 120),
                businessName: plan.offer.productName,
                industry: 'spa',
                mainServices: (plan.offer.valueProps?.slice(0, 5) ?? [plan.offer.productName]).join(', '),
                greeting: `Xin chào! Mình hỗ trợ tư vấn ${plan.offer.productName}.`,
                consultationTone: 'friendly',
                status: database_1.ChatbotBotStatus.DRAFT,
            });
            if (String(bot.status) !== 'DRAFT') {
                throw new Error(`Chatbot phải DRAFT, nhận ${bot.status}`);
            }
            await register({
                module: 'CHATBOT',
                entityType: 'chatbot_bot',
                entityId: bot.id,
                status: 'DRAFT',
                adapter: 'ChatbotCskhService',
                metadata: { missionId },
            });
            if (funnelRecId) {
                await this.prisma.marketingAutopilotFunnelSpec.update({
                    where: { id: funnelRecId },
                    data: { chatbotBotId: bot.id },
                });
            }
        });
        // --- Email campaign draft ---
        await soft('EMAIL', async () => {
            const campaign = await this.emailMarketing.createCampaign(user.organizationId, {
                name: `Autopilot Email — ${project.name}`.slice(0, 200),
                subject: `${plan.offer.productName}: ${plan.offer.primaryGoal}`.slice(0, 200),
            }, user.id);
            await register({
                module: 'EMAIL',
                entityType: 'email_campaign',
                entityId: campaign.id,
                status: campaign.status ?? 'DRAFT',
                adapter: 'EmailMarketingService',
                metadata: { missionId, draftOnly: true },
            });
        });
        // --- Zalo campaign draft if OA connected ---
        await soft('ZALO', async () => {
            const oa = await this.prisma.messagingChannelConnection.findFirst({
                where: {
                    organizationId: user.organizationId,
                    providerKind: database_1.MessagingProviderKind.ZALO_OA,
                },
                orderBy: { updatedAt: 'desc' },
            });
            if (!oa || String(oa.status) === 'DISCONNECTED' || String(oa.status) === 'ERROR') {
                skipped.push({ module: 'ZALO', reason: 'Chưa kết nối Zalo OA' });
                return;
            }
            const campaign = await this.messagingCampaign.create(user.organizationId, {
                name: `Autopilot Zalo — ${project.name}`.slice(0, 200),
                channel: database_1.MessageChannel.ZALO,
                campaignType: database_1.MessagingCampaignKind.BROADCAST,
                channelConnectionId: oa.id,
                segmentConfig: {
                    source: 'marketing_autopilot_executor',
                    missionId,
                    draftOnly: true,
                },
                variables: {
                    productName: plan.offer.productName,
                    primaryGoal: plan.offer.primaryGoal,
                },
            }, user.id);
            if (String(campaign.status) !== 'DRAFT') {
                throw new Error(`Zalo campaign phải DRAFT, nhận ${campaign.status}`);
            }
            await register({
                module: 'ZALO',
                entityType: 'messaging_campaign',
                entityId: campaign.id,
                status: 'DRAFT',
                adapter: 'MessagingCampaignService',
                metadata: { channel: 'ZALO', channelConnectionId: oa.id, missionId },
            });
        });
        // --- Facebook/Google Ads creative draft (never live) ---
        await soft('ADS', async () => {
            if (!this.aiAds) {
                // Fallback: create AdDraft row directly (DRAFT)
                const draft = await this.prisma.adDraft.create({
                    data: {
                        userId: user.id,
                        organizationId: user.organizationId,
                        platform: database_1.AdPlatform.META,
                        status: database_1.AdDraftStatus.DRAFT,
                        objective: plan.offer.primaryGoal,
                        budget: plan.budget?.monthlyBudget ? plan.budget.monthlyBudget / 30 : null,
                        audience: plan.customersTarget.targetProfile,
                        headline: `${plan.offer.productName} — ${plan.offer.primaryGoal}`.slice(0, 200),
                        content: (plan.valueProposition ?? plan.offer.valueProps.join('; ')).slice(0, 2000),
                        cta: 'Đặt lịch ngay',
                        landingPage: '/dat-lich',
                        creative: {
                            missionId,
                            draftOnly: true,
                            liveAdsBlocked: true,
                            source: 'marketing_autopilot_executor',
                        },
                        aiGenerated: true,
                    },
                });
                await register({
                    module: 'ADS',
                    entityType: 'ad_draft',
                    entityId: draft.id,
                    status: 'DRAFT',
                    adapter: 'Prisma.adDraft',
                    metadata: { platform: 'META', missionId, liveAdsBlocked: true },
                });
                return;
            }
            const draft = await this.aiAds.generateDraft(user, {
                platform: database_1.AdPlatform.META,
                objective: plan.offer.primaryGoal,
                product: plan.offer.productName,
                audience: plan.customersTarget.targetProfile,
                budget: plan.budget?.monthlyBudget ? Math.round(plan.budget.monthlyBudget / 30) : undefined,
            });
            if (String(draft.status) !== 'DRAFT') {
                throw new Error(`AdDraft phải DRAFT, nhận ${draft.status}`);
            }
            await register({
                module: 'ADS',
                entityType: 'ad_draft',
                entityId: draft.id,
                status: 'DRAFT',
                adapter: 'AiAdsManagerService',
                metadata: { platform: draft.platform, missionId, liveAdsBlocked: true },
            });
        });
        // Safety: ensure no automation left active from this mission
        const autoAssets = assets.filter((a) => a.entityType === 'automation_flow');
        for (const a of autoAssets) {
            await this.prisma.automationFlow.updateMany({
                where: { id: a.entityId, organizationId: user.organizationId },
                data: { isActive: false, isPaused: true },
            });
        }
        return { assets, skipped, draftRegistry };
    }
};
exports.MarketingAutopilotExecutorService = MarketingAutopilotExecutorService;
exports.MarketingAutopilotExecutorService = MarketingAutopilotExecutorService = MarketingAutopilotExecutorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        marketing_autopilot_draft_adapter_1.MarketingAutopilotDraftAdapter,
        teleprompter_source_service_1.TeleprompterSourceService,
        domain_stubs_1.FunnelBuilderService,
        domain_stubs_1.FunnelGeneratorService,
        automation_service_1.AutomationService,
        messaging_campaign_service_1.MessagingCampaignService,
        auto_post_service_1.AutoPostService,
        domain_stubs_2.EmailMarketingService,
        chatbot_cskh_service_1.ChatbotCskhService,
        domain_stubs_3.LeadScoringService,
        ai_ads_manager_service_1.AiAdsManagerService])
], MarketingAutopilotExecutorService);
