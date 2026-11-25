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
var FunnelLifecycleService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FunnelLifecycleService = void 0;
const database_1 = require("@marketingspa/database");
const common_1 = require("@nestjs/common");
const database_2 = require("@marketingspa/database");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../prisma/prisma.service");
const funnel_validator_service_1 = require("./funnel-validator.service");
const pipeline_service_1 = require("../crm/pipeline.service");
const lead_scoring_service_1 = require("../crm/lead-scoring.service");
let FunnelLifecycleService = FunnelLifecycleService_1 = class FunnelLifecycleService {
    prisma;
    validator;
    pipeline;
    scoring;
    logger = new common_1.Logger(FunnelLifecycleService_1.name);
    constructor(prisma, validator, pipeline, scoring) {
        this.prisma = prisma;
        this.validator = validator;
        this.pipeline = pipeline;
        this.scoring = scoring;
    }
    async assertFunnel(organizationId, id) {
        const row = await this.prisma.funnelRecommendation.findFirst({
            where: { id, organizationId },
        });
        if (!row)
            throw new common_1.NotFoundException('Funnel không tồn tại');
        return row;
    }
    assertMutableWorkingCopy(status) {
        if (status === database_2.FunnelPublishStatus.ARCHIVED) {
            throw new common_1.BadRequestException('Funnel ARCHIVED — clone để chỉnh, không sửa trực tiếp');
        }
    }
    /** Public capture uses frozen publishedSpec while ACTIVE. */
    liveSpecJson(row) {
        if (row.status === database_2.FunnelPublishStatus.ACTIVE && row.publishedSpec) {
            return row.publishedSpec;
        }
        return row.completeSpec;
    }
    async getQuota(organizationId) {
        const sub = await this.prisma.subscription.findFirst({
            where: {
                organizationId,
                status: { in: [database_2.SubscriptionStatus.ACTIVE, database_2.SubscriptionStatus.TRIALING] },
            },
            include: { plan: { select: { code: true } } },
            orderBy: { currentPeriodEnd: 'desc' },
        });
        const isTrial = sub?.status === database_2.SubscriptionStatus.TRIALING;
        const quota = (0, shared_1.resolveFunnelQuota)(sub?.plan?.code, isTrial);
        const [total, active] = await Promise.all([
            this.prisma.funnelRecommendation.count({
                where: { organizationId, status: { not: database_2.FunnelPublishStatus.ARCHIVED } },
            }),
            this.prisma.funnelRecommendation.count({
                where: { organizationId, status: database_2.FunnelPublishStatus.ACTIVE },
            }),
        ]);
        return { ...quota, usedFunnels: total, usedActive: active, planCode: sub?.plan?.code ?? null, isTrial };
    }
    async assertCanCreateFunnel(organizationId) {
        const q = await this.getQuota(organizationId);
        if (q.usedFunnels >= q.maxFunnels) {
            throw new common_1.ForbiddenException({
                code: 'FUNNEL_QUOTA',
                message: `Hết quota funnel (${q.usedFunnels}/${q.maxFunnels}) theo gói ${q.planCode ?? 'trial'}`,
                quota: q,
            });
        }
        return q;
    }
    async preparePublish(user, id) {
        const row = await this.assertFunnel(user.organizationId, id);
        this.assertMutableWorkingCopy(row.status);
        if (!row.completeSpec)
            throw new common_1.BadRequestException('Chưa có complete spec');
        const current = (0, shared_1.parseFunnelCompleteSpec)(row.completeSpec);
        const prepared = (0, shared_1.ensureFunnelActivateRequirements)(current);
        const validation = this.validator.validateCompleteSpec(prepared);
        await this.prisma.funnelRecommendation.update({
            where: { id: row.id },
            data: { completeSpec: prepared },
        });
        return {
            recommendationId: row.id,
            complete: prepared,
            validation,
            applied: false,
            liveFrozen: row.status === database_2.FunnelPublishStatus.ACTIVE,
        };
    }
    async publish(user, id, summary, canActivateFlows = false) {
        const row = await this.assertFunnel(user.organizationId, id);
        if (!(0, shared_1.canTransitionFunnelStatus)(row.status, 'ACTIVE')) {
            throw new common_1.BadRequestException(`Không publish từ ${row.status}`);
        }
        if (row.status === database_2.FunnelPublishStatus.ACTIVE) {
            throw new common_1.BadRequestException('Funnel đang ACTIVE — pause trước khi publish version mới (không phá lead đang chạy)');
        }
        if (!row.completeSpec)
            throw new common_1.BadRequestException('Chưa có complete spec');
        const spec = (0, shared_1.ensureFunnelActivateRequirements)((0, shared_1.parseFunnelCompleteSpec)(row.completeSpec));
        const gate = (0, shared_1.assertFunnelCanActivate)(spec);
        if (!gate.ok) {
            throw new common_1.BadRequestException({
                code: 'FUNNEL_NOT_READY',
                message: 'Funnel chưa đạt Validator — không ACTIVE',
                score: gate.score,
                blocking: gate.blocking,
            });
        }
        const q = await this.getQuota(user.organizationId);
        if (q.usedActive >= q.maxActive) {
            throw new common_1.ForbiddenException({
                code: 'FUNNEL_ACTIVE_QUOTA',
                message: `Hết quota funnel ACTIVE (${q.usedActive}/${q.maxActive})`,
                quota: q,
            });
        }
        const nextVersion = row.publishedVersion + 1;
        const specJson = spec;
        await this.prisma.$transaction([
            this.prisma.funnelVersion.create({
                data: {
                    organizationId: user.organizationId,
                    funnelId: row.id,
                    version: nextVersion,
                    spec: specJson,
                    summary: (summary || `Publish v${nextVersion}`).slice(0, 500),
                    createdById: user.id,
                },
            }),
            this.prisma.funnelRecommendation.update({
                where: { id: row.id },
                data: {
                    status: database_2.FunnelPublishStatus.ACTIVE,
                    completeSpec: specJson,
                    publishedSpec: specJson,
                    publishedVersion: nextVersion,
                    publishedAt: new Date(),
                    pausedAt: null,
                    archivedAt: null,
                },
            }),
        ]);
        this.logger.log(`Published funnel ${row.id} v${nextVersion} org=${user.organizationId}`);
        await this.bindPublishedCanvas(user.organizationId, row.id, spec, canActivateFlows);
        return {
            id: row.id,
            status: 'ACTIVE',
            publishedVersion: nextVersion,
            score: gate.score,
            liveFrozen: true,
        };
    }
    /** Push draft content to live publishedSpec without pausing (content refresh only). */
    async publishLiveUpdate(user, id, summary) {
        const row = await this.assertFunnel(user.organizationId, id);
        if (row.status !== database_2.FunnelPublishStatus.ACTIVE) {
            throw new common_1.BadRequestException('Chỉ cập nhật phiên bản đang chạy khi funnel ACTIVE');
        }
        if (!row.completeSpec)
            throw new common_1.BadRequestException('Chưa có complete spec');
        const spec = (0, shared_1.ensureFunnelActivateRequirements)((0, shared_1.parseFunnelCompleteSpec)(row.completeSpec));
        const gate = (0, shared_1.assertFunnelCanActivate)(spec);
        if (!gate.ok) {
            throw new common_1.BadRequestException({
                code: 'FUNNEL_NOT_READY',
                message: 'Draft chưa đạt Validator — không cập nhật live',
                score: gate.score,
                blocking: gate.blocking,
            });
        }
        const nextVersion = row.publishedVersion + 1;
        const specJson = spec;
        await this.prisma.$transaction([
            this.prisma.funnelVersion.create({
                data: {
                    organizationId: user.organizationId,
                    funnelId: row.id,
                    version: nextVersion,
                    spec: specJson,
                    summary: (summary || `Live update v${nextVersion}`).slice(0, 500),
                    createdById: user.id,
                },
            }),
            this.prisma.funnelRecommendation.update({
                where: { id: row.id },
                data: {
                    publishedSpec: specJson,
                    publishedVersion: nextVersion,
                    publishedAt: new Date(),
                },
            }),
        ]);
        this.logger.log(`Live-updated funnel ${row.id} v${nextVersion} org=${user.organizationId}`);
        return {
            id: row.id,
            status: 'ACTIVE',
            publishedVersion: nextVersion,
            hasUnpublishedChanges: false,
        };
    }
    async pause(user, id) {
        const row = await this.assertFunnel(user.organizationId, id);
        if (!(0, shared_1.canTransitionFunnelStatus)(row.status, 'PAUSED')) {
            throw new common_1.BadRequestException(`Không pause từ ${row.status}`);
        }
        await this.prisma.funnelRecommendation.update({
            where: { id: row.id },
            data: { status: database_2.FunnelPublishStatus.PAUSED, pausedAt: new Date() },
        });
        await this.setCanvasFlowsPaused(user.organizationId, row.id, true);
        return { id: row.id, status: 'PAUSED' };
    }
    async archive(user, id) {
        const row = await this.assertFunnel(user.organizationId, id);
        if (!(0, shared_1.canTransitionFunnelStatus)(row.status, 'ARCHIVED')) {
            throw new common_1.BadRequestException(`Không archive từ ${row.status}`);
        }
        await this.prisma.funnelRecommendation.update({
            where: { id: row.id },
            data: {
                status: database_2.FunnelPublishStatus.ARCHIVED,
                archivedAt: new Date(),
            },
        });
        await this.setCanvasFlowsPaused(user.organizationId, row.id, true);
        return { id: row.id, status: 'ARCHIVED' };
    }
    /** Hard delete — tenant-scoped; leads/events giữ nguyên (FK SetNull). */
    async delete(user, id) {
        const row = await this.assertFunnel(user.organizationId, id);
        await this.setCanvasFlowsPaused(user.organizationId, row.id, true);
        await this.prisma.funnelRecommendation.delete({ where: { id: row.id } });
        this.logger.log(`Deleted funnel ${row.id} org=${user.organizationId}`);
        return { id: row.id, deleted: true, wasActive: row.status === database_2.FunnelPublishStatus.ACTIVE };
    }
    async listVersions(organizationId, id) {
        await this.assertFunnel(organizationId, id);
        return this.prisma.funnelVersion.findMany({
            where: { organizationId, funnelId: id },
            orderBy: { version: 'desc' },
            select: {
                id: true,
                version: true,
                summary: true,
                createdById: true,
                createdAt: true,
            },
        });
    }
    async diffVersion(organizationId, id, versionId) {
        const row = await this.assertFunnel(organizationId, id);
        const ver = await this.prisma.funnelVersion.findFirst({
            where: { id: versionId, funnelId: id, organizationId },
        });
        if (!ver)
            throw new common_1.NotFoundException('Version không tồn tại');
        const current = row.completeSpec
            ? (0, shared_1.parseFunnelCompleteSpec)(row.completeSpec)
            : (0, shared_1.parseFunnelCompleteSpec)(ver.spec);
        const snap = (0, shared_1.parseFunnelCompleteSpec)(ver.spec);
        return {
            version: ver.version,
            versionId: ver.id,
            diff: (0, shared_1.diffFunnelCompleteSpecs)(snap, current),
        };
    }
    async restoreVersion(user, id, versionId) {
        const row = await this.assertFunnel(user.organizationId, id);
        this.assertMutableWorkingCopy(row.status);
        const ver = await this.prisma.funnelVersion.findFirst({
            where: { id: versionId, funnelId: id, organizationId: user.organizationId },
        });
        if (!ver)
            throw new common_1.NotFoundException('Version không tồn tại');
        const spec = (0, shared_1.parseFunnelCompleteSpec)(ver.spec);
        await this.prisma.funnelRecommendation.update({
            where: { id: row.id },
            data: { completeSpec: spec },
        });
        return {
            id: row.id,
            restoredVersion: ver.version,
            complete: spec,
            status: row.status,
            liveUnchanged: row.status === database_2.FunnelPublishStatus.ACTIVE,
            applied: false,
        };
    }
    async clone(user, id) {
        await this.assertCanCreateFunnel(user.organizationId);
        const row = await this.assertFunnel(user.organizationId, id);
        const scoring = await this.prisma.funnelScoringConfig.findFirst({
            where: { organizationId: user.organizationId, funnelId: id },
            include: { rules: true },
        });
        const cloned = await this.prisma.funnelRecommendation.create({
            data: {
                organizationId: user.organizationId,
                createdById: user.id,
                prompt: (0, shared_1.sanitizeFunnelUserPrompt)(`Clone: ${row.prompt}`),
                result: row.result,
                source: row.source,
                selectedSlug: row.selectedSlug,
                selectedAt: row.selectedSlug ? new Date() : null,
                completeSpec: row.completeSpec,
                completeSource: row.completeSource,
                completeGeneratedAt: row.completeSpec ? new Date() : null,
                status: database_2.FunnelPublishStatus.DRAFT,
                clonedFromId: row.id,
                chatbotBotId: null,
                publishedVersion: 0,
            },
        });
        if (scoring) {
            await this.prisma.funnelScoringConfig.create({
                data: {
                    organizationId: user.organizationId,
                    funnelId: cloned.id,
                    maxScore: scoring.maxScore,
                    mqlThreshold: scoring.mqlThreshold,
                    sqlThreshold: scoring.sqlThreshold,
                    isActive: scoring.isActive,
                    source: 'clone',
                    rules: {
                        create: scoring.rules.map((r) => ({
                            organizationId: user.organizationId,
                            key: r.key,
                            label: r.label,
                            eventType: r.eventType,
                            points: r.points,
                            condition: r.condition,
                            isActive: r.isActive,
                            position: r.position,
                        })),
                    },
                },
            });
        }
        return {
            id: cloned.id,
            clonedFromId: row.id,
            status: 'DRAFT',
            leadsCopied: 0,
            historyCopied: false,
        };
    }
    async bindPublishedCanvas(organizationId, funnelId, spec, canActivateFlows) {
        try {
            const stages = (spec.stages ?? []).map((s, i) => ({
                name: s.name,
                code: s.code,
                position: s.position ?? i,
                color: s.color,
                category: s.category,
                probability: s.probability,
                slaMinutes: s.slaMinutes,
                isWon: s.isWon,
                isLost: s.isLost,
            }));
            if (stages.length) {
                await this.pipeline.applyStageProposals(organizationId, stages);
            }
        }
        catch (err) {
            this.logger.warn(`Canvas stage bind failed: ${err instanceof Error ? err.message : String(err)}`);
        }
        try {
            await this.upsertCanvasFlows(organizationId, funnelId, spec, canActivateFlows);
        }
        catch (err) {
            this.logger.warn(`Canvas automation bind failed: ${err instanceof Error ? err.message : String(err)}`);
        }
        try {
            const existing = await this.prisma.funnelScoringConfig.findFirst({
                where: { organizationId, funnelId },
                select: { id: true },
            });
            if (!existing) {
                await this.scoring.applyProposed(organizationId, funnelId);
            }
        }
        catch (err) {
            this.logger.warn(`Canvas scoring bind failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    async upsertCanvasFlows(organizationId, funnelId, spec, canActivateFlows) {
        const desired = new Map();
        for (const [i, flow] of (spec.automations ?? []).entries()) {
            const triggerType = flow.triggerType;
            if (!Object.values(database_2.AutomationTriggerType).includes(triggerType))
                continue;
            const canvasKey = `automation:${flow.triggerType}:${flow.name}`.slice(0, 80);
            desired.set(canvasKey, {
                name: flow.name.slice(0, 160),
                triggerType,
                delayMinutes: flow.delayMinutes ?? 0,
                channel: flow.channel,
                actions: flow.actions ?? [],
                triggerConfig: { source: 'funnel-canvas', canvasKey, index: i },
            });
        }
        for (const [i, item] of (spec.followUp ?? []).entries()) {
            const mapped = mapFollowUpTrigger(item.trigger);
            if (!mapped)
                continue;
            const canvasKey = `followUp:${item.trigger}:${item.name}`.slice(0, 80);
            const actions = [
                {
                    type: 'CREATE_TASK',
                    title: item.message.slice(0, 160),
                    dueInMinutes: 60,
                },
            ];
            desired.set(canvasKey, {
                name: item.name.slice(0, 160),
                triggerType: mapped.triggerType,
                delayMinutes: item.delayMinutes ?? 0,
                channel: mapFollowUpChannel(item.channel),
                actions,
                triggerConfig: {
                    source: 'funnel-canvas',
                    canvasKey,
                    index: i,
                    ...(mapped.stageCode ? { stageCode: mapped.stageCode } : {}),
                },
            });
        }
        const existing = await this.prisma.automationFlow.findMany({
            where: { organizationId, funnelId },
        });
        const byKey = new Map();
        for (const row of existing) {
            const cfg = (row.triggerConfig ?? {});
            if (cfg.source === 'funnel-canvas' && typeof cfg.canvasKey === 'string') {
                byKey.set(cfg.canvasKey, row);
            }
        }
        const keep = new Set(desired.keys());
        for (const [key, row] of byKey) {
            if (keep.has(key))
                continue;
            await this.prisma.automationFlow.update({
                where: { id: row.id },
                data: { isPaused: true, isActive: false },
            });
        }
        for (const [canvasKey, flow] of desired) {
            const row = byKey.get(canvasKey);
            const data = {
                name: flow.name,
                triggerType: flow.triggerType,
                delayMinutes: flow.delayMinutes,
                channel: flow.channel,
                actions: flow.actions,
                triggerConfig: flow.triggerConfig,
                isPaused: false,
                isActive: canActivateFlows,
                funnelId,
            };
            if (row) {
                await this.prisma.automationFlow.update({ where: { id: row.id }, data });
            }
            else {
                await new database_1.PlanPolicy(this.prisma).resource(organizationId, 'flows', (tx) => tx.automationFlow.count({ where: { organizationId } }), (tx) => tx.automationFlow.create({
                    data: { organizationId, ...data },
                }));
            }
        }
    }
    async setCanvasFlowsPaused(organizationId, funnelId, paused) {
        const flows = await this.prisma.automationFlow.findMany({
            where: { organizationId, funnelId },
        });
        for (const flow of flows) {
            const cfg = (flow.triggerConfig ?? {});
            if (cfg.source !== 'funnel-canvas')
                continue;
            await this.prisma.automationFlow.update({
                where: { id: flow.id },
                data: { isPaused: paused },
            });
        }
    }
};
exports.FunnelLifecycleService = FunnelLifecycleService;
exports.FunnelLifecycleService = FunnelLifecycleService = FunnelLifecycleService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        funnel_validator_service_1.FunnelValidatorService,
        pipeline_service_1.PipelineService,
        lead_scoring_service_1.LeadScoringService])
], FunnelLifecycleService);
function mapFollowUpTrigger(trigger) {
    switch (trigger) {
        case 'LEAD_CREATED':
        case 'FORM_SUBMITTED':
            return { triggerType: database_2.AutomationTriggerType.LEAD_CREATED };
        case 'LEAD_UNTOUCHED':
            return { triggerType: database_2.AutomationTriggerType.LEAD_UNTOUCHED };
        case 'NO_SHOW':
            return { triggerType: database_2.AutomationTriggerType.NO_SHOW };
        case 'AFTER_VISIT':
            return { triggerType: database_2.AutomationTriggerType.STAGE_CHANGED, stageCode: 'VISITED' };
        case 'CUSTOM':
            return { triggerType: database_2.AutomationTriggerType.MANUAL };
        default:
            return null;
    }
}
function mapFollowUpChannel(channel) {
    if (channel === 'ZALO')
        return database_2.MessageChannel.ZALO;
    if (channel === 'SMS')
        return database_2.MessageChannel.SMS;
    if (channel === 'EMAIL')
        return database_2.MessageChannel.EMAIL;
    if (channel === 'MESSENGER')
        return database_2.MessageChannel.MESSENGER;
    return undefined;
}
