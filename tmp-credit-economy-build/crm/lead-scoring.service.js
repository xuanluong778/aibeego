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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var LeadScoringService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadScoringService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../prisma/prisma.service");
const pipeline_service_1 = require("./pipeline.service");
const lead_assignment_service_1 = require("./lead-assignment.service");
const automation_engine_service_1 = require("./automation-engine.service");
const events_gateway_1 = require("../events/events.gateway");
const funnel_canvas_runtime_service_1 = require("./funnel-canvas-runtime.service");
const status_transitions_util_1 = require("../common/utils/status-transitions.util");
const SCORE_EVENT_ACTION = 'SCORE_EVENT';
let LeadScoringService = LeadScoringService_1 = class LeadScoringService {
    prisma;
    pipeline;
    assignment;
    automation;
    events;
    canvasRuntime;
    logger = new common_1.Logger(LeadScoringService_1.name);
    constructor(prisma, pipeline, assignment, automation, events, canvasRuntime) {
        this.prisma = prisma;
        this.pipeline = pipeline;
        this.assignment = assignment;
        this.automation = automation;
        this.events = events;
        this.canvasRuntime = canvasRuntime;
    }
    async getConfig(organizationId, funnelId) {
        await this.assertFunnel(organizationId, funnelId);
        const config = await this.prisma.funnelScoringConfig.findFirst({
            where: { organizationId, funnelId },
            include: {
                rules: { orderBy: { position: 'asc' } },
                mqlStage: { select: { id: true, name: true, code: true } },
                sqlStage: { select: { id: true, name: true, code: true } },
            },
        });
        return config;
    }
    async propose(organizationId, funnelId) {
        const rec = await this.prisma.funnelRecommendation.findFirst({
            where: { id: funnelId, organizationId },
            select: { selectedSlug: true, prompt: true, completeSpec: true },
        });
        if (!rec)
            throw new common_1.NotFoundException('Funnel không tồn tại');
        const completeSpec = rec.completeSpec && typeof rec.completeSpec === 'object'
            ? rec.completeSpec
            : null;
        return (0, shared_1.proposeScoringForFunnel)({
            selectedSlug: rec.selectedSlug,
            prompt: rec.prompt,
            completeSpec,
        });
    }
    async upsertConfig(organizationId, funnelId, dto) {
        await this.assertFunnel(organizationId, funnelId);
        if (dto.mqlStageId)
            await this.assertStage(organizationId, dto.mqlStageId);
        if (dto.sqlStageId)
            await this.assertStage(organizationId, dto.sqlStageId);
        const maxScore = (0, shared_1.clampLeadScore)(dto.maxScore ?? 100, 100) || 100;
        let mql = dto.mqlThreshold ?? 50;
        let sql = dto.sqlThreshold ?? 80;
        mql = Math.min(maxScore, Math.max(0, Math.round(mql)));
        sql = Math.min(maxScore, Math.max(mql, Math.round(sql)));
        if (sql < mql)
            throw new common_1.BadRequestException('SQL threshold phải ≥ MQL');
        const existing = await this.prisma.funnelScoringConfig.findFirst({
            where: { organizationId, funnelId },
            select: { id: true },
        });
        const config = existing
            ? await this.prisma.funnelScoringConfig.update({
                where: { id: existing.id },
                data: {
                    maxScore,
                    mqlThreshold: mql,
                    sqlThreshold: sql,
                    mqlStageId: dto.mqlStageId === undefined ? undefined : dto.mqlStageId,
                    sqlStageId: dto.sqlStageId === undefined ? undefined : dto.sqlStageId,
                    isActive: dto.isActive ?? true,
                    source: dto.source ?? 'manual',
                },
            })
            : await this.prisma.funnelScoringConfig.create({
                data: {
                    organizationId,
                    funnelId,
                    maxScore,
                    mqlThreshold: mql,
                    sqlThreshold: sql,
                    mqlStageId: dto.mqlStageId ?? undefined,
                    sqlStageId: dto.sqlStageId ?? undefined,
                    isActive: dto.isActive ?? true,
                    source: dto.source ?? 'manual',
                },
            });
        if (dto.rules) {
            await this.prisma.funnelScoringRule.deleteMany({
                where: { organizationId, configId: config.id },
            });
            if (dto.rules.length) {
                await this.prisma.funnelScoringRule.createMany({
                    data: dto.rules.map((r, i) => ({
                        organizationId,
                        configId: config.id,
                        key: r.key.slice(0, 64),
                        label: r.label.slice(0, 120),
                        eventType: r.eventType,
                        points: Math.min(100, Math.max(-50, Math.round(r.points))),
                        condition: (r.condition ?? {}),
                        isActive: r.isActive ?? true,
                        position: r.position ?? i,
                    })),
                });
            }
        }
        return this.getConfig(organizationId, funnelId);
    }
    async applyProposed(organizationId, funnelId) {
        const proposal = await this.propose(organizationId, funnelId);
        await this.pipeline.ensureDefaultPipeline(organizationId);
        const existing = await this.prisma.funnelScoringConfig.findFirst({
            where: { organizationId, funnelId },
            select: { mqlStageId: true, sqlStageId: true },
        });
        const mqlStage = await this.pipeline.resolveStageForStatus(organizationId, database_1.LeadPipelineStatus.QUALIFIED);
        const sqlStage = await this.pipeline.resolveStageForStatus(organizationId, database_1.LeadPipelineStatus.BOOKED);
        return this.upsertConfig(organizationId, funnelId, {
            maxScore: proposal.maxScore,
            mqlThreshold: proposal.mqlThreshold,
            sqlThreshold: proposal.sqlThreshold,
            mqlStageId: existing?.mqlStageId ?? mqlStage?.id ?? null,
            sqlStageId: existing?.sqlStageId ?? sqlStage?.id ?? null,
            source: 'ai',
            rules: proposal.rules,
        });
    }
    /**
     * Increment/decrement lead score from a funnel event.
     * Fire-and-forget safe: never throws to caller after lookup misses.
     */
    async applyEvent(input) {
        try {
            if (!input.leadId)
                return { skipped: true, reason: 'no_lead' };
            const eventType = input.eventType === 'CHATBOT_REPLY' && (0, shared_1.detectAskPrice)(input.text)
                ? 'ASK_PRICE'
                : input.eventType;
            const lead = await this.prisma.lead.findFirst({
                where: { id: input.leadId, organizationId: input.organizationId },
                select: {
                    id: true,
                    name: true,
                    score: true,
                    qualification: true,
                    funnelRecommendationId: true,
                    customerId: true,
                    assignedToId: true,
                    pipelineStatus: true,
                    stageId: true,
                    pipelineId: true,
                    branchId: true,
                    leadSourceId: true,
                },
            });
            if (!lead?.funnelRecommendationId)
                return { skipped: true, reason: 'no_funnel' };
            const config = await this.prisma.funnelScoringConfig.findFirst({
                where: {
                    organizationId: input.organizationId,
                    funnelId: lead.funnelRecommendationId,
                    isActive: true,
                },
                include: { rules: { where: { isActive: true, eventType } } },
            });
            if (!config || config.rules.length === 0)
                return { skipped: true, reason: 'no_rule' };
            const allowed = [];
            for (const rule of config.rules) {
                if (await this.isCoolingDown(input.organizationId, lead.id, eventType, rule.condition)) {
                    continue;
                }
                allowed.push(rule);
            }
            if (!allowed.length)
                return { skipped: true, reason: 'cooldown' };
            const points = allowed.reduce((s, r) => s + r.points, 0);
            const { previous, next, delta } = (0, shared_1.applyScoreDelta)(lead.score, points, config.maxScore);
            if (delta === 0 && points === 0)
                return { skipped: true, reason: 'noop' };
            return this.commitScoreChange({
                organizationId: input.organizationId,
                lead,
                previous,
                next,
                eventType,
                points: delta,
                source: input.source ?? eventType,
                config,
            });
        }
        catch (err) {
            this.logger.warn(`applyEvent failed: ${err instanceof Error ? err.message : String(err)}`);
            return { skipped: true, reason: 'error' };
        }
    }
    /** Canvas Inspector scoreDelta — bump score then MQL/SQL / CRM stage. */
    async applyCanvasScoreDelta(organizationId, leadId, points) {
        try {
            const lead = await this.prisma.lead.findFirst({
                where: { id: leadId, organizationId },
                select: {
                    id: true,
                    name: true,
                    score: true,
                    qualification: true,
                    funnelRecommendationId: true,
                    customerId: true,
                    assignedToId: true,
                    pipelineStatus: true,
                    stageId: true,
                    pipelineId: true,
                    branchId: true,
                    leadSourceId: true,
                },
            });
            if (!lead)
                return { skipped: true, reason: 'no_lead' };
            const config = lead.funnelRecommendationId
                ? await this.prisma.funnelScoringConfig.findFirst({
                    where: { organizationId, funnelId: lead.funnelRecommendationId, isActive: true },
                })
                : null;
            const { previous, next, delta } = (0, shared_1.applyScoreDelta)(lead.score, points, config?.maxScore ?? 100);
            if (delta === 0)
                return { skipped: true, reason: 'noop', previous, next };
            if (!config) {
                await this.prisma.lead.update({ where: { id: lead.id }, data: { score: next } });
                await this.onAbsoluteScoreSet(organizationId, leadId, previous);
                return { previous, next, delta, qualification: lead.qualification };
            }
            const result = await this.commitScoreChange({
                organizationId,
                lead,
                previous,
                next,
                eventType: 'CTA_CLICK',
                points: delta,
                source: 'funnel-canvas',
                config,
            });
            return { previous, next, delta, qualification: result.qualification, crossed: result.crossed };
        }
        catch (err) {
            this.logger.warn(`applyCanvasScoreDelta failed: ${err instanceof Error ? err.message : String(err)}`);
            return { skipped: true, reason: 'error' };
        }
    }
    /** After manual PATCH score — check MQL/SQL without double-adding points. */
    async onAbsoluteScoreSet(organizationId, leadId, previousScore) {
        try {
            const lead = await this.prisma.lead.findFirst({
                where: { id: leadId, organizationId },
                select: {
                    id: true,
                    name: true,
                    score: true,
                    qualification: true,
                    funnelRecommendationId: true,
                    customerId: true,
                    assignedToId: true,
                    pipelineStatus: true,
                    stageId: true,
                    pipelineId: true,
                    branchId: true,
                    leadSourceId: true,
                },
            });
            if (!lead?.funnelRecommendationId)
                return;
            const config = await this.prisma.funnelScoringConfig.findFirst({
                where: { organizationId, funnelId: lead.funnelRecommendationId, isActive: true },
            });
            if (!config) {
                await this.prisma.leadActivity.create({
                    data: {
                        organizationId,
                        leadId,
                        action: 'SCORE_CHANGED',
                        fromValue: String(previousScore),
                        toValue: String(lead.score),
                    },
                });
                void this.automation.dispatch(organizationId, database_1.AutomationTriggerType.SCORE_CHANGED, {
                    leadId,
                    customerId: lead.customerId,
                    context: {
                        score: String(lead.score),
                        previousScore: String(previousScore),
                    },
                    dedupeKey: `SCORE_CHANGED:${leadId}:${lead.score}`,
                });
                return;
            }
            await this.commitScoreChange({
                organizationId,
                lead,
                previous: previousScore,
                next: lead.score,
                eventType: 'FORM_SUBMITTED',
                points: lead.score - previousScore,
                source: 'manual',
                config,
                skipEventLog: true,
            });
        }
        catch (err) {
            this.logger.warn(`onAbsoluteScoreSet failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    async commitScoreChange(input) {
        const q = (0, shared_1.qualificationAfterScore)(input.previous, input.next, input.config.mqlThreshold, input.config.sqlThreshold, input.lead.qualification);
        const updated = await this.prisma.lead.update({
            where: { id: input.lead.id },
            data: {
                score: input.next,
                qualification: q.qualification ?? undefined,
                mqlReachedAt: q.crossedMql ? new Date() : undefined,
                sqlReachedAt: q.crossedSql ? new Date() : undefined,
            },
            select: { assignedToId: true, customerId: true, score: true, qualification: true },
        });
        if (!input.skipEventLog) {
            await this.prisma.leadActivity.create({
                data: {
                    organizationId: input.organizationId,
                    leadId: input.lead.id,
                    action: SCORE_EVENT_ACTION,
                    fromValue: String(input.previous),
                    toValue: String(input.next),
                    metadata: {
                        eventType: input.eventType,
                        points: input.points,
                        source: input.source,
                    },
                },
            });
        }
        await this.prisma.leadActivity.create({
            data: {
                organizationId: input.organizationId,
                leadId: input.lead.id,
                action: 'SCORE_CHANGED',
                fromValue: String(input.previous),
                toValue: String(input.next),
                metadata: {
                    eventType: input.eventType,
                    qualification: q.qualification,
                    crossed: q.crossed,
                },
            },
        });
        this.events.emitToOrg(input.organizationId, shared_1.WS_EVENTS.LEAD_SCORE_CHANGED, {
            leadId: input.lead.id,
            name: input.lead.name,
            score: input.next,
            previousScore: input.previous,
            qualification: q.qualification,
        });
        void this.automation.dispatch(input.organizationId, database_1.AutomationTriggerType.SCORE_CHANGED, {
            leadId: input.lead.id,
            customerId: updated.customerId ?? input.lead.customerId,
            context: {
                score: String(input.next),
                previousScore: String(input.previous),
                crossed: q.crossed ?? '',
                eventType: input.eventType,
            },
            dedupeKey: `SCORE_CHANGED:${input.lead.id}:${input.next}:${q.crossed ?? 'n'}`,
        });
        if (q.qualification === 'MQL' || q.qualification === 'SQL') {
            await this.syncQualificationStage({
                organizationId: input.organizationId,
                leadId: input.lead.id,
                qualification: q.qualification,
                config: input.config,
            });
        }
        if (q.crossed) {
            await this.onThresholdReached({
                organizationId: input.organizationId,
                lead: input.lead,
                crossed: q.crossed,
                score: input.next,
                config: input.config,
                assignedToId: updated.assignedToId ?? input.lead.assignedToId,
            });
        }
        return {
            ok: true,
            previous: input.previous,
            next: input.next,
            crossed: q.crossed,
            qualification: q.qualification,
        };
    }
    /** Fresh DB read — never regress; skip if already at/beyond target. */
    async syncQualificationStage(input) {
        const targetStageId = input.qualification === 'SQL' ? input.config.sqlStageId : input.config.mqlStageId;
        const fallback = input.qualification === 'SQL' ? database_1.LeadPipelineStatus.BOOKED : database_1.LeadPipelineStatus.QUALIFIED;
        const live = await this.prisma.lead.findFirst({
            where: { id: input.leadId, organizationId: input.organizationId },
            select: {
                id: true,
                name: true,
                pipelineStatus: true,
                stageId: true,
                pipelineId: true,
                customerId: true,
            },
        });
        if (!live)
            return;
        const stage = (targetStageId
            ? await this.prisma.funnelStage.findFirst({
                where: { id: targetStageId, organizationId: input.organizationId, isActive: true },
            })
            : null) ??
            (await this.pipeline.resolveStageForStatus(input.organizationId, fallback, live.pipelineId ?? undefined));
        if (!stage)
            return;
        if (live.stageId === stage.id)
            return;
        const currentStage = live.stageId
            ? await this.prisma.funnelStage.findFirst({
                where: { id: live.stageId, organizationId: input.organizationId },
                select: { position: true, pipelineId: true },
            })
            : null;
        if (currentStage &&
            currentStage.pipelineId === stage.pipelineId &&
            currentStage.position >= stage.position) {
            return;
        }
        const pointers = this.pipeline.leadPointersFromStage(stage);
        const nextStatus = pointers.pipelineStatus ?? live.pipelineStatus;
        if (nextStatus !== live.pipelineStatus && !(0, shared_1.shouldAdvancePipeline)(live.pipelineStatus, nextStatus)) {
            return;
        }
        if (nextStatus !== live.pipelineStatus) {
            try {
                (0, status_transitions_util_1.assertLeadTransition)(live.pipelineStatus, nextStatus);
            }
            catch {
                return;
            }
        }
        await this.prisma.lead.update({
            where: { id: live.id },
            data: {
                stageId: pointers.stageId ?? live.stageId,
                pipelineId: pointers.pipelineId ?? live.pipelineId,
                pipelineStatus: nextStatus,
                lastContactedAt: new Date(),
                slaRespondBy: stage.slaMinutes
                    ? new Date(Date.now() + stage.slaMinutes * 60_000)
                    : undefined,
            },
        });
        await this.prisma.leadActivity.create({
            data: {
                organizationId: input.organizationId,
                leadId: live.id,
                action: 'STATUS_CHANGED',
                fromValue: live.pipelineStatus,
                toValue: nextStatus,
                metadata: {
                    reason: `${input.qualification}_THRESHOLD`,
                    stageId: stage.id,
                },
            },
        });
        this.events.broadcastLeadStatusChanged(input.organizationId, {
            leadId: live.id,
            name: live.name,
            previousStatus: live.pipelineStatus,
            pipelineStatus: nextStatus,
        });
        void this.automation.dispatch(input.organizationId, database_1.AutomationTriggerType.STAGE_CHANGED, {
            leadId: live.id,
            customerId: live.customerId,
            context: {
                stageId: stage.id,
                stageCode: nextStatus,
                previousStatus: live.pipelineStatus,
                crossed: input.qualification,
            },
            dedupeKey: `STAGE_CHANGED:${live.id}:${stage.id}:${input.qualification}`,
        });
    }
    async onThresholdReached(input) {
        const targetStageId = input.crossed === 'SQL' ? input.config.sqlStageId : input.config.mqlStageId;
        const fallbackCode = input.crossed === 'SQL' ? database_1.LeadPipelineStatus.BOOKED : database_1.LeadPipelineStatus.QUALIFIED;
        let stage = targetStageId
            ? await this.prisma.funnelStage.findFirst({
                where: { id: targetStageId, organizationId: input.organizationId, isActive: true },
            })
            : await this.pipeline.resolveStageForStatus(input.organizationId, fallbackCode, input.lead.pipelineId ?? undefined);
        await this.syncQualificationStage({
            organizationId: input.organizationId,
            leadId: input.lead.id,
            qualification: input.crossed,
            config: input.config,
        });
        await this.prisma.leadActivity.create({
            data: {
                organizationId: input.organizationId,
                leadId: input.lead.id,
                action: input.crossed === 'SQL' ? 'SQL_REACHED' : 'MQL_REACHED',
                toValue: String(input.score),
                metadata: { score: input.score, stageId: stage?.id ?? null },
            },
        });
        let assigneeId = input.assignedToId;
        if (!assigneeId) {
            const attr = await this.prisma.leadAttribution.findFirst({
                where: { leadId: input.lead.id },
                select: { adCampaignId: true },
            });
            assigneeId =
                (await this.assignment.autoAssign(input.organizationId, {
                    branchId: input.lead.branchId,
                    leadSourceId: input.lead.leadSourceId,
                    adCampaignId: attr?.adCampaignId,
                    score: input.score,
                })) ?? null;
            if (assigneeId) {
                await this.prisma.lead.update({
                    where: { id: input.lead.id },
                    data: { assignedToId: assigneeId },
                });
                await this.prisma.leadActivity.create({
                    data: {
                        organizationId: input.organizationId,
                        leadId: input.lead.id,
                        action: 'LEAD_ASSIGNED',
                        toValue: assigneeId,
                        metadata: { reason: `${input.crossed}_HANDOFF` },
                    },
                });
            }
        }
        await this.prisma.crmTask.create({
            data: {
                organizationId: input.organizationId,
                leadId: input.lead.id,
                title: input.crossed === 'SQL'
                    ? `SQL — gọi chốt lịch/lead ${input.lead.name}`
                    : `MQL — liên hệ lead ${input.lead.name}`,
                dueAt: new Date(Date.now() + 15 * 60_000),
                source: 'lead-scoring',
            },
        });
        this.events.emitToOrg(input.organizationId, shared_1.WS_EVENTS.LEAD_QUALIFIED, {
            leadId: input.lead.id,
            name: input.lead.name,
            qualification: input.crossed,
            score: input.score,
            assignedToId: assigneeId,
        });
        void this.canvasRuntime.advance({
            organizationId: input.organizationId,
            leadId: input.lead.id,
            event: input.crossed,
            funnelId: input.lead.funnelRecommendationId,
            stageCode: stage?.code ?? fallbackCode,
        });
    }
    async isCoolingDown(organizationId, leadId, eventType, condition) {
        const c = (condition && typeof condition === 'object' ? condition : {});
        if (!c.once && !c.cooldownMinutes)
            return false;
        const since = c.once
            ? new Date(0)
            : new Date(Date.now() - Math.max(1, c.cooldownMinutes ?? 0) * 60_000);
        const rows = await this.prisma.leadActivity.findMany({
            where: {
                organizationId,
                leadId,
                action: SCORE_EVENT_ACTION,
                createdAt: { gte: since },
            },
            select: { metadata: true },
            take: 40,
        });
        return rows.some((row) => {
            const meta = row.metadata;
            return meta?.eventType === eventType;
        });
    }
    async assertFunnel(organizationId, funnelId) {
        const rec = await this.prisma.funnelRecommendation.findFirst({
            where: { id: funnelId, organizationId },
            select: { id: true },
        });
        if (!rec)
            throw new common_1.NotFoundException('Funnel không tồn tại hoặc không thuộc tổ chức');
        return rec;
    }
    async assertStage(organizationId, stageId) {
        const stage = await this.prisma.funnelStage.findFirst({
            where: { id: stageId, organizationId, isActive: true },
            select: { id: true },
        });
        if (!stage)
            throw new common_1.BadRequestException('Stage không hợp lệ');
    }
};
exports.LeadScoringService = LeadScoringService;
exports.LeadScoringService = LeadScoringService = LeadScoringService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(5, (0, common_1.Inject)((0, common_1.forwardRef)(() => funnel_canvas_runtime_service_1.FunnelCanvasRuntimeService))),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        pipeline_service_1.PipelineService,
        lead_assignment_service_1.LeadAssignmentService,
        automation_engine_service_1.AutomationEngineService,
        events_gateway_1.EventsGateway,
        funnel_canvas_runtime_service_1.FunnelCanvasRuntimeService])
], LeadScoringService);
