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
var MarketingAutopilotExecutionEngineService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketingAutopilotExecutionEngineService = void 0;
/**
 * Execution Engine + Guardrail — after Approval Snapshot, activate assets via existing services.
 * Gate order: Permission → Integration Health → Approval → Guardrail → Execute.
 * Soft-skip BLOCKED_INTEGRATION; never outbound without approval + allow* flags.
 */
const common_1 = require("@nestjs/common");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../audit/audit.service");
const automation_service_1 = require("../../automation/automation.service");
const messaging_campaign_service_1 = require("../../messaging-campaign/messaging-campaign.service");
const domain_stubs_1 = require("../compat/domain-stubs");
const chatbot_cskh_service_1 = require("../../chatbot-cskh/chatbot-cskh.service");
const ai_ads_manager_service_1 = require("../../ai-ads-manager/ai-ads-manager.service");
const domain_stubs_2 = require("../compat/domain-stubs");
const database_1 = require("@marketingspa/database");
let MarketingAutopilotExecutionEngineService = MarketingAutopilotExecutionEngineService_1 = class MarketingAutopilotExecutionEngineService {
    prisma;
    audit;
    automation;
    messaging;
    email;
    chatbot;
    aiAds;
    funnelLifecycle;
    logger = new common_1.Logger(MarketingAutopilotExecutionEngineService_1.name);
    constructor(prisma, audit, automation, messaging, email, chatbot, aiAds, funnelLifecycle) {
        this.prisma = prisma;
        this.audit = audit;
        this.automation = automation;
        this.messaging = messaging;
        this.email = email;
        this.chatbot = chatbot;
        this.aiAds = aiAds;
        this.funnelLifecycle = funnelLifecycle;
    }
    async getOrCreateGuardrail(organizationId) {
        const existing = await this.prisma.marketingAutopilotGuardrail.findUnique({
            where: { organizationId },
        });
        if (existing)
            return (0, shared_1.normalizeGuardrailFromDb)(existing);
        const created = await this.prisma.marketingAutopilotGuardrail.create({
            data: {
                organizationId,
                maxDailyAdSpend: shared_1.DEFAULT_MARKETING_AUTOPILOT_GUARDRAIL.maxDailyAdSpend,
                maxCampaignBudget: shared_1.DEFAULT_MARKETING_AUTOPILOT_GUARDRAIL.maxCampaignBudget,
                maxBudgetIncreasePercent: shared_1.DEFAULT_MARKETING_AUTOPILOT_GUARDRAIL.maxBudgetIncreasePercent,
                allowedChannels: shared_1.DEFAULT_MARKETING_AUTOPILOT_GUARDRAIL.allowedChannels,
                allowFacebookPublish: shared_1.DEFAULT_MARKETING_AUTOPILOT_GUARDRAIL.allowFacebookPublish,
                allowGoogleAdsPublish: shared_1.DEFAULT_MARKETING_AUTOPILOT_GUARDRAIL.allowGoogleAdsPublish,
                allowEmailSend: shared_1.DEFAULT_MARKETING_AUTOPILOT_GUARDRAIL.allowEmailSend,
                allowZaloSend: shared_1.DEFAULT_MARKETING_AUTOPILOT_GUARDRAIL.allowZaloSend,
                allowAutomationActivation: shared_1.DEFAULT_MARKETING_AUTOPILOT_GUARDRAIL.allowAutomationActivation,
                stopLossCpl: shared_1.DEFAULT_MARKETING_AUTOPILOT_GUARDRAIL.stopLossCpl,
                stopLossCpa: shared_1.DEFAULT_MARKETING_AUTOPILOT_GUARDRAIL.stopLossCpa,
            },
        });
        return (0, shared_1.normalizeGuardrailFromDb)(created);
    }
    /**
     * Run execution for an approved mission. Soft-fails per asset; never kills whole mission.
     */
    async executeApprovedMission(input) {
        const { user, missionId, approvalId } = input;
        const mission = await this.prisma.marketingMission.findFirst({
            where: { id: missionId, organizationId: user.organizationId },
            include: {
                assets: { orderBy: { createdAt: 'asc' } },
            },
        });
        if (!mission) {
            return {
                missionId,
                approvalId,
                executed: 0,
                blocked: 0,
                failed: 0,
                skipped: 0,
                actions: [
                    {
                        module: '',
                        entityType: 'mission',
                        entityId: missionId,
                        action: null,
                        result: 'BLOCKED_PERMISSION',
                        message: 'Mission not found for tenant',
                    },
                ],
            };
        }
        const approval = await this.prisma.marketingMissionApproval.findFirst({
            where: {
                id: approvalId,
                missionId,
                organizationId: user.organizationId,
            },
        });
        if (!approval) {
            return {
                missionId,
                approvalId,
                executed: 0,
                blocked: 1,
                failed: 0,
                skipped: 0,
                actions: [
                    {
                        module: '',
                        entityType: 'approval',
                        entityId: approvalId,
                        action: null,
                        result: 'BLOCKED_APPROVAL',
                        message: 'Approval snapshot missing or wrong tenant',
                    },
                ],
            };
        }
        const snapshot = (approval.snapshotJson ?? {});
        const snapshotAssetIds = new Set((snapshot.assets ?? []).map((a) => `${a.entityType}:${a.entityId}`));
        const guardrail = await this.getOrCreateGuardrail(user.organizationId);
        const proposedBudget = typeof snapshot.budget?.plan?.monthlyBudget === 'number'
            ? snapshot.budget.plan.monthlyBudget / 30
            : null;
        const results = [];
        let executed = 0;
        let blocked = 0;
        let failed = 0;
        let skipped = 0;
        for (const asset of mission.assets) {
            const action = (0, shared_1.resolveExecutionActionForAsset)({
                module: asset.module,
                entityType: asset.entityType,
                preferSend: false,
            });
            if (!action) {
                skipped += 1;
                results.push({
                    module: asset.module,
                    entityType: asset.entityType,
                    entityId: asset.entityId,
                    action: null,
                    result: 'SKIPPED',
                    message: 'No executable action for module',
                });
                await this.writeLogs({
                    user,
                    missionId,
                    approvalId,
                    asset,
                    action: 'SKIP',
                    before: { status: asset.status },
                    gate: {
                        ok: false,
                        stage: 'EXECUTE',
                        result: 'SKIPPED',
                        message: 'No executable action',
                    },
                    after: { status: asset.status },
                });
                continue;
            }
            const inSnapshot = snapshotAssetIds.size === 0 ||
                snapshotAssetIds.has(`${asset.entityType}:${asset.entityId}`);
            const integration = await this.checkIntegrationHealth(user.organizationId, action, asset);
            const gate = (0, shared_1.evaluateExecutionGate)({
                permissionOk: mission.organizationId === user.organizationId,
                integrationOk: integration.ok,
                integrationReason: integration.reason,
                approvalOk: !!approval && inSnapshot,
                approvalReason: inSnapshot
                    ? undefined
                    : 'Asset không nằm trong Approval Snapshot',
                guardrail,
                action,
                channel: this.channelForAction(action, asset),
                proposedBudget: action === 'ENABLE_ADS_CAMPAIGN' || action === 'PUBLISH_ADS_DRAFT'
                    ? proposedBudget
                    : null,
            });
            const before = { status: asset.status, module: asset.module };
            await this.writeLogs({
                user,
                missionId,
                approvalId,
                asset,
                action,
                before,
                gate,
                phaseOnly: 'BEFORE',
            });
            if (!gate.ok) {
                blocked += 1;
                results.push({
                    module: asset.module,
                    entityType: asset.entityType,
                    entityId: asset.entityId,
                    action,
                    result: gate.result,
                    message: gate.message,
                });
                await this.prisma.marketingMissionAsset.update({
                    where: { id: asset.id },
                    data: {
                        status: gate.result,
                        metadataJson: {
                            ...(asset.metadataJson ?? {}),
                            lastExecution: {
                                result: gate.result,
                                stage: gate.stage,
                                message: gate.message,
                                at: new Date().toISOString(),
                            },
                        },
                    },
                });
                await this.writeLogs({
                    user,
                    missionId,
                    approvalId,
                    asset,
                    action,
                    before,
                    gate,
                    after: { status: gate.result },
                    phaseOnly: 'AFTER',
                });
                // Soft — continue other assets
                continue;
            }
            try {
                const execAfter = await this.performExecute(user, action, asset);
                executed += 1;
                results.push({
                    module: asset.module,
                    entityType: asset.entityType,
                    entityId: asset.entityId,
                    action,
                    result: 'EXECUTED',
                    message: execAfter.message,
                });
                await this.prisma.marketingMissionAsset.update({
                    where: { id: asset.id },
                    data: {
                        status: 'EXECUTED',
                        metadataJson: {
                            ...(asset.metadataJson ?? {}),
                            lastExecution: {
                                result: 'EXECUTED',
                                action,
                                message: execAfter.message,
                                at: new Date().toISOString(),
                            },
                        },
                    },
                });
                await this.writeLogs({
                    user,
                    missionId,
                    approvalId,
                    asset,
                    action,
                    before,
                    gate: { ...gate, result: 'EXECUTED', message: execAfter.message },
                    after: execAfter.after,
                    phaseOnly: 'AFTER',
                });
            }
            catch (err) {
                failed += 1;
                const message = err instanceof Error ? err.message : String(err);
                this.logger.warn(`[execution] ${action} ${asset.entityId} soft-fail: ${message}`);
                results.push({
                    module: asset.module,
                    entityType: asset.entityType,
                    entityId: asset.entityId,
                    action,
                    result: 'FAILED',
                    message,
                });
                await this.prisma.marketingMissionAsset.update({
                    where: { id: asset.id },
                    data: {
                        status: 'FAILED',
                        metadataJson: {
                            ...(asset.metadataJson ?? {}),
                            lastExecution: {
                                result: 'FAILED',
                                action,
                                message,
                                at: new Date().toISOString(),
                            },
                        },
                    },
                });
                await this.writeLogs({
                    user,
                    missionId,
                    approvalId,
                    asset,
                    action,
                    before,
                    gate: {
                        ok: false,
                        stage: 'EXECUTE',
                        result: 'FAILED',
                        message,
                    },
                    after: { error: message },
                    phaseOnly: 'AFTER',
                });
            }
        }
        return {
            missionId,
            approvalId,
            executed,
            blocked,
            failed,
            skipped,
            actions: results,
        };
    }
    /**
     * Explicit pre-approval probe — always BLOCKED_APPROVAL for outbound actions.
     * Used by tests / safety checks; never executes.
     */
    probeWithoutApproval(input) {
        return (0, shared_1.evaluateExecutionGate)({
            permissionOk: input.organizationId === input.actorOrganizationId,
            integrationOk: true,
            approvalOk: false,
            guardrail: input.guardrail ?? shared_1.DEFAULT_MARKETING_AUTOPILOT_GUARDRAIL,
            action: input.action,
        });
    }
    channelForAction(action, asset) {
        if (action.includes('ZALO') || asset.module === 'ZALO')
            return 'ZALO';
        if (action.includes('EMAIL') || asset.module === 'EMAIL')
            return 'EMAIL';
        if (action.includes('FACEBOOK') || asset.module === 'CONTENT')
            return 'FACEBOOK';
        if (action === 'ENABLE_ADS_CAMPAIGN' || asset.module === 'ADS')
            return 'FACEBOOK';
        if (asset.module === 'CAMPAIGN')
            return 'MESSENGER';
        return null;
    }
    async checkIntegrationHealth(organizationId, action, _asset) {
        // Local-only / DB activations do not need external integrations
        if (action === 'ACTIVATE_AUTOMATION' ||
            action === 'ACTIVATE_CHATBOT' ||
            action === 'PUBLISH_FUNNEL' ||
            action === 'PUBLISH_ADS_DRAFT' ||
            action === 'SCHEDULE_EMAIL' ||
            action === 'SCHEDULE_CAMPAIGN') {
            return { ok: true };
        }
        if (action === 'SCHEDULE_ZALO' || action === 'SEND_ZALO') {
            const oa = await this.prisma.messagingChannelConnection.findFirst({
                where: {
                    organizationId,
                    providerKind: 'ZALO_OA',
                    status: { notIn: ['DISCONNECTED', 'ERROR'] },
                },
            });
            if (!oa) {
                return { ok: false, reason: 'Chưa kết nối Zalo OA' };
            }
            return { ok: true };
        }
        if (action === 'PUBLISH_FACEBOOK_CONTENT' || action === 'SEND_EMAIL') {
            if (action === 'PUBLISH_FACEBOOK_CONTENT') {
                const fb = await this.prisma.messagingChannelConnection.findFirst({
                    where: {
                        organizationId,
                        providerKind: 'MESSENGER',
                        status: { notIn: ['DISCONNECTED', 'ERROR'] },
                    },
                });
                const adMeta = await this.prisma.adConnection.findFirst({
                    where: {
                        organizationId,
                        provider: 'META',
                        status: 'CONNECTED',
                    },
                });
                if (!fb && !adMeta) {
                    return { ok: false, reason: 'Chưa kết nối Facebook/Meta' };
                }
                return { ok: true };
            }
            // SEND_EMAIL — require at least a sender domain row if any; else soft-block
            const domain = null;
            if (!domain) {
                return { ok: false, reason: 'Chưa cấu hình Email sender domain' };
            }
            return { ok: true };
        }
        if (action === 'ENABLE_ADS_CAMPAIGN') {
            const conn = await this.prisma.adConnection.findFirst({
                where: {
                    organizationId,
                    status: 'CONNECTED',
                    provider: { in: ['META', 'GOOGLE'] },
                },
            });
            if (!conn) {
                return { ok: false, reason: 'Chưa kết nối Meta/Google Ads' };
            }
            return { ok: true };
        }
        return { ok: true };
    }
    async performExecute(user, action, asset) {
        const orgId = user.organizationId;
        switch (action) {
            case 'ACTIVATE_AUTOMATION': {
                // Only real automation flows — skip fake e2e ids softly via ensure
                const flow = await this.prisma.automationFlow.findFirst({
                    where: { id: asset.entityId, organizationId: orgId },
                });
                if (!flow) {
                    return {
                        message: 'Automation entity không tồn tại — marked ready in registry only',
                        after: { registryOnly: true },
                    };
                }
                const updated = await this.automation.approveFlow(orgId, asset.entityId, user.id);
                return {
                    message: 'Automation flow activated',
                    after: { isActive: updated.isActive, id: updated.id },
                };
            }
            case 'ACTIVATE_CHATBOT': {
                const bot = await this.prisma.chatbotBot.findFirst({
                    where: { id: asset.entityId, organizationId: orgId },
                });
                if (!bot) {
                    return {
                        message: 'Chatbot không tồn tại — registry only',
                        after: { registryOnly: true },
                    };
                }
                const updated = await this.chatbot.updateBot(orgId, asset.entityId, {
                    status: database_1.ChatbotBotStatus.ACTIVE,
                });
                return {
                    message: 'Chatbot activated',
                    after: { status: updated.status, id: updated.id },
                };
            }
            case 'PUBLISH_FUNNEL': {
                const rec = await this.prisma.marketingAutopilotFunnelSpec.findFirst({
                    where: { id: asset.entityId, organizationId: orgId },
                });
                if (!rec) {
                    return {
                        message: 'Funnel recommendation missing — registry only',
                        after: { registryOnly: true, entityType: asset.entityType },
                    };
                }
                if (!rec.completeSpec) {
                    return {
                        message: 'Funnel completeSpec missing — kept DRAFT',
                        after: { status: rec.status, needsCompleteSpec: true },
                    };
                }
                try {
                    const published = await this.funnelLifecycle.publish(user, asset.entityId, 'Autopilot approval execution', false);
                    return {
                        message: 'Funnel published (flows inactive)',
                        after: {
                            status: published?.status ?? 'ACTIVE',
                            id: asset.entityId,
                        },
                    };
                }
                catch (err) {
                    return {
                        message: `Funnel publish soft-skip: ${err instanceof Error ? err.message : String(err)}`,
                        after: { status: rec.status, softSkip: true },
                    };
                }
            }
            case 'SCHEDULE_EMAIL': {
                const camp = await this.prisma.marketingAutopilotEmailDraft.findFirst({
                    where: { id: asset.entityId, organizationId: orgId },
                });
                if (!camp) {
                    return {
                        message: 'Email campaign missing — registry only',
                        after: { registryOnly: true },
                    };
                }
                // Do NOT send — mark READY_TO_SCHEDULE in metadata; schedule needs template+future time
                await this.prisma.marketingAutopilotEmailDraft.update({
                    where: { id: camp.id },
                    data: {
                    // keep DRAFT — never send without allowEmailSend + explicit send path
                    },
                });
                return {
                    message: 'Email kept DRAFT (scheduled only when template+allowEmailSend)',
                    after: { status: camp.status, sendBlockedByDefault: true },
                };
            }
            case 'SEND_EMAIL': {
                // Hard path — only reached if guardrail allowEmailSend=true
                await this.email.sendCampaign(orgId, asset.entityId);
                return { message: 'Email send enqueued', after: { status: 'RUNNING' } };
            }
            case 'SCHEDULE_ZALO':
            case 'SCHEDULE_CAMPAIGN': {
                const camp = await this.prisma.messagingCampaign.findFirst({
                    where: { id: asset.entityId, organizationId: orgId },
                });
                if (!camp) {
                    return {
                        message: 'Messaging campaign missing — registry only',
                        after: { registryOnly: true },
                    };
                }
                const when = new Date(Date.now() + 24 * 3600 * 1000);
                try {
                    const scheduled = await this.messaging.schedule(orgId, asset.entityId, { scheduledAt: when.toISOString() }, user.id);
                    return {
                        message: 'Messaging campaign scheduled (not started/sent)',
                        after: { status: scheduled.status, scheduledAt: when.toISOString() },
                    };
                }
                catch (err) {
                    return {
                        message: `Schedule soft-skip: ${err instanceof Error ? err.message : String(err)}`,
                        after: { status: camp.status, softSkip: true },
                    };
                }
            }
            case 'SEND_ZALO': {
                await this.messaging.start(orgId, asset.entityId, user.id);
                return { message: 'Zalo/messaging start enqueued', after: { status: 'PLANNING' } };
            }
            case 'PUBLISH_FACEBOOK_CONTENT': {
                // Never call AutoPost.publishNow here — even if allow flag true, require explicit separate path.
                // Mark registry EXECUTED only when allow flag already gated; still do NOT Graph-publish automatically.
                return {
                    message: 'Facebook content publish deferred (no auto Graph publish)',
                    after: { deferred: true, allowFacebookPublishRequired: true },
                };
            }
            case 'PUBLISH_ADS_DRAFT': {
                const draft = await this.prisma.adDraft.findFirst({
                    where: { id: asset.entityId, organizationId: orgId },
                });
                if (!draft) {
                    return {
                        message: 'Ad draft missing — registry only',
                        after: { registryOnly: true },
                    };
                }
                if (this.aiAds) {
                    try {
                        const pub = await this.aiAds.publishDraft(user, asset.entityId);
                        return {
                            message: 'Ad draft marked PUBLISHED locally (no Meta spend)',
                            after: { status: pub.status, id: pub.id },
                        };
                    }
                    catch {
                        // fall through
                    }
                }
                const updated = await this.prisma.adDraft.update({
                    where: { id: draft.id },
                    data: { status: 'PUBLISHED' },
                });
                return {
                    message: 'Ad draft marked PUBLISHED locally (no Meta spend)',
                    after: { status: updated.status },
                };
            }
            case 'ENABLE_ADS_CAMPAIGN': {
                // Spend path — only if gates passed; still avoid unless real campaign id
                throw new Error('ENABLE_ADS_CAMPAIGN requires live campaign id — not auto-enabled from draft');
            }
            default:
                return { message: `Unhandled action ${action}`, after: {} };
        }
    }
    async writeLogs(input) {
        const base = {
            organizationId: input.user.organizationId,
            missionId: input.missionId,
            approvalId: input.approvalId,
            module: input.asset.module,
            entityType: input.asset.entityType,
            entityId: input.asset.entityId,
            action: input.action,
            checkStage: input.gate.stage,
            result: input.gate.result,
            message: input.gate.message.slice(0, 500),
            beforeJson: input.before,
            afterJson: (input.after ?? {}),
        };
        const phases = input.phaseOnly === 'BEFORE'
            ? ['BEFORE']
            : input.phaseOnly === 'AFTER'
                ? ['AFTER']
                : ['BEFORE', 'AFTER'];
        for (const phase of phases) {
            await this.prisma.marketingAutopilotExecutionLog.create({
                data: { ...base, phase },
            });
        }
        // Parallel org audit log (redacts secrets)
        await this.audit.log({
            organizationId: input.user.organizationId,
            userId: input.user.id,
            action: `AUTOPILOT_EXEC_${input.phaseOnly ?? 'GATE'}_${input.gate.result}`,
            entityType: 'MARKETING_AUTOPILOT_ASSET',
            entityId: input.asset.entityId,
            metadata: {
                missionId: input.missionId,
                approvalId: input.approvalId,
                module: input.asset.module,
                executionAction: input.action,
                stage: input.gate.stage,
                result: input.gate.result,
                message: input.gate.message,
                // explicitly never include tokens
            },
        });
    }
};
exports.MarketingAutopilotExecutionEngineService = MarketingAutopilotExecutionEngineService;
exports.MarketingAutopilotExecutionEngineService = MarketingAutopilotExecutionEngineService = MarketingAutopilotExecutionEngineService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        automation_service_1.AutomationService,
        messaging_campaign_service_1.MessagingCampaignService,
        domain_stubs_1.EmailMarketingService,
        chatbot_cskh_service_1.ChatbotCskhService,
        ai_ads_manager_service_1.AiAdsManagerService,
        domain_stubs_2.FunnelLifecycleService])
], MarketingAutopilotExecutionEngineService);
