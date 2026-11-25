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
var FunnelCanvasRuntimeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FunnelCanvasRuntimeService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../prisma/prisma.service");
const queue_constants_1 = require("../queue/queue.constants");
const queue_enqueue_service_1 = require("../common/services/queue-enqueue.service");
const pipeline_service_1 = require("./pipeline.service");
const automation_engine_service_1 = require("./automation-engine.service");
const customer_journey_service_1 = require("./customer-journey.service");
const lead_scoring_service_1 = require("./lead-scoring.service");
const status_transitions_util_1 = require("../common/utils/status-transitions.util");
const MAX_WALK = 16;
let FunnelCanvasRuntimeService = FunnelCanvasRuntimeService_1 = class FunnelCanvasRuntimeService {
    prisma;
    pipeline;
    automation;
    journey;
    queueEnqueue;
    queue;
    scoring;
    logger = new common_1.Logger(FunnelCanvasRuntimeService_1.name);
    constructor(prisma, pipeline, automation, journey, queueEnqueue, queue, scoring) {
        this.prisma = prisma;
        this.pipeline = pipeline;
        this.automation = automation;
        this.journey = journey;
        this.queueEnqueue = queueEnqueue;
        this.queue = queue;
        this.scoring = scoring;
    }
    async advance(input) {
        try {
            const live = await this.loadLive(input.organizationId, input.leadId, input.funnelId);
            if (!live)
                return { skipped: true, reason: 'inactive' };
            const ev = normalize(input.event);
            if (ev === 'FORM_SUBMITTED' || ev === 'LEAD_CREATED' || ev === 'CTA_CLICK') {
                const prior = await this.prisma.funnelRuntimeLog.findFirst({
                    where: {
                        organizationId: input.organizationId,
                        funnelId: live.funnel.id,
                        leadId: input.leadId,
                        event: ev,
                        publishedVersion: live.funnel.publishedVersion,
                        status: database_1.FunnelRuntimeLogStatus.SUCCESS,
                    },
                    select: { id: true },
                });
                if (prior)
                    return { skipped: true, reason: 'duplicate_event' };
            }
            const ctx = this.contextFromLead(live.lead, input);
            const entries = (0, shared_1.entryCanvasNodeIds)(live.spec, ctx);
            const seen = new Set();
            for (const nodeId of entries) {
                await this.enterNode(live, nodeId, ctx, input, null, seen, 0);
            }
            return { ok: true, entries: entries.length };
        }
        catch (err) {
            this.logger.warn(`Canvas advance failed: ${err instanceof Error ? err.message : String(err)}`);
            return { skipped: true, reason: 'error' };
        }
    }
    async continueJob(data) {
        const live = await this.loadLive(data.organizationId, data.leadId, data.funnelId);
        if (!live)
            return { skipped: true, reason: 'inactive' };
        if (live.funnel.publishedVersion !== data.publishedVersion) {
            return { skipped: true, reason: 'version_mismatch' };
        }
        const ctx = this.contextFromLead(live.lead, {
            ...data,
            branch: data.branch ?? (data.event === 'TIMEOUT' ? 'timeout' : 'default'),
        });
        await this.enterNode(live, data.nodeId, ctx, { ...data, fromSchedule: true }, data.edgeId ?? null, new Set(), 0);
        return { ok: true };
    }
    async listLogs(organizationId, funnelId, leadId) {
        const funnel = await this.prisma.funnelRecommendation.findFirst({
            where: { id: funnelId, organizationId },
            select: { id: true },
        });
        if (!funnel)
            return [];
        return this.prisma.funnelRuntimeLog.findMany({
            where: {
                organizationId,
                funnelId,
                ...(leadId ? { leadId } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: 200,
        });
    }
    contextFromLead(lead, input) {
        return {
            event: input.event,
            branch: input.branch,
            stageCode: input.stageCode ?? lead.stage?.code ?? lead.pipelineStatus,
            previousStatus: input.previousStatus,
            pipelineStatus: lead.pipelineStatus,
            qualification: lead.qualification,
            score: lead.score,
            tags: lead.tags,
            conversion: (0, shared_1.conversionForCanvasEvent)({ event: input.event }),
            revenue: input.revenue,
        };
    }
    async loadLive(organizationId, leadId, funnelId) {
        const lead = await this.prisma.lead.findFirst({
            where: { id: leadId, organizationId },
            include: { stage: { select: { code: true } } },
        });
        if (!lead)
            return null;
        const id = funnelId || lead.funnelRecommendationId;
        if (!id)
            return null;
        const funnel = await this.prisma.funnelRecommendation.findFirst({
            where: { id, organizationId, status: database_1.FunnelPublishStatus.ACTIVE },
        });
        if (!funnel)
            return null;
        const raw = funnel.publishedSpec ?? funnel.completeSpec;
        if (!raw)
            return null;
        const spec = (0, shared_1.parseFunnelCompleteSpec)(raw);
        return { lead, funnel, spec };
    }
    async enterNode(live, nodeId, ctx, extra, edgeId, seen, depth) {
        if (depth > MAX_WALK)
            return;
        const node = live.spec.nodes.find((n) => n.id === nodeId);
        if (!node)
            return;
        const walkKey = `${nodeId}:${normalize(ctx.event)}`;
        if (seen.has(walkKey))
            return;
        seen.add(walkKey);
        const idempotencyKey = (0, shared_1.canvasRuntimeIdempotencyKey)({
            funnelId: live.funnel.id,
            publishedVersion: live.funnel.publishedVersion,
            leadId: extra.leadId,
            nodeId,
            event: String(ctx.event),
            edgeId,
        });
        const claimed = await this.claim(live, extra, {
            nodeId,
            edgeId,
            event: String(ctx.event),
            branch: ctx.branch ? String(ctx.branch) : null,
            idempotencyKey,
        });
        if (!claimed)
            return;
        let branch = 'success';
        let result = { nodeType: node.type };
        try {
            result = { ...result, ...(await this.executeNode(live, nodeId, ctx, extra)) };
            if (result.skipped)
                branch = 'default';
            const delta = (0, shared_1.readCanvasNodeMeta)(node).scoreDelta;
            if (!result.scheduledDelay &&
                typeof delta === 'number' &&
                delta !== 0 &&
                result.reason !== 'condition_failed') {
                const scored = await this.scoring.applyCanvasScoreDelta(extra.organizationId, extra.leadId, delta);
                result.scoreDelta = scored;
                if (typeof scored.next === 'number') {
                    live.lead.score = scored.next;
                    ctx.score = scored.next;
                }
                if (typeof scored.qualification === 'string' || scored.qualification === null) {
                    live.lead.qualification = scored.qualification;
                    ctx.qualification = scored.qualification;
                }
            }
        }
        catch (err) {
            branch = 'failure';
            result.error = err instanceof Error ? err.message : String(err);
            await this.prisma.funnelRuntimeLog.update({
                where: { id: claimed.id },
                data: {
                    status: database_1.FunnelRuntimeLogStatus.FAILED,
                    executedAt: new Date(),
                    result: result,
                    branch: 'failure',
                },
            });
            await this.follow(live, nodeId, { ...ctx, branch: 'failure', event: 'FAILURE' }, extra, seen, depth + 1);
            return;
        }
        await this.prisma.funnelRuntimeLog.update({
            where: { id: claimed.id },
            data: {
                status: database_1.FunnelRuntimeLogStatus.SUCCESS,
                executedAt: new Date(),
                result: result,
                branch: String(branch),
            },
        });
        if (result.scheduledDelay)
            return;
        await this.follow(live, nodeId, { ...ctx, branch }, extra, seen, depth + 1);
    }
    async follow(live, fromNodeId, ctx, extra, seen, depth) {
        const transitions = (0, shared_1.selectCanvasTransitions)(live.spec, fromNodeId, ctx);
        for (const t of transitions) {
            if (t.kind === 'now') {
                await this.enterNode(live, t.toNodeId, { ...ctx, event: t.event, branch: t.branch === 'default' ? ctx.branch : t.branch }, extra, t.edgeId, seen, depth);
                continue;
            }
            await this.schedule(live, extra, t);
        }
    }
    async schedule(live, extra, t) {
        const idempotencyKey = (0, shared_1.canvasRuntimeIdempotencyKey)({
            funnelId: live.funnel.id,
            publishedVersion: live.funnel.publishedVersion,
            leadId: extra.leadId,
            nodeId: t.toNodeId,
            event: t.event,
            edgeId: t.edgeId,
        });
        const scheduledFor = new Date(Date.now() + Math.max(0, t.delayMinutes) * 60_000);
        try {
            await this.prisma.funnelRuntimeLog.create({
                data: {
                    organizationId: extra.organizationId,
                    funnelId: live.funnel.id,
                    leadId: extra.leadId,
                    nodeId: t.toNodeId,
                    edgeId: t.edgeId,
                    event: t.event,
                    branch: t.branch,
                    status: database_1.FunnelRuntimeLogStatus.SCHEDULED,
                    publishedVersion: live.funnel.publishedVersion,
                    idempotencyKey,
                    scheduledFor,
                },
            });
        }
        catch (err) {
            if (err.code === 'P2002')
                return;
            throw err;
        }
        const payload = {
            organizationId: extra.organizationId,
            funnelId: live.funnel.id,
            leadId: extra.leadId,
            nodeId: t.toNodeId,
            event: t.event,
            branch: t.branch,
            edgeId: t.edgeId,
            publishedVersion: live.funnel.publishedVersion,
            appointmentId: extra.appointmentId,
            orderId: extra.orderId,
            paymentId: extra.paymentId,
            revenue: extra.revenue,
            fromSchedule: true,
        };
        await this.queueEnqueue.add(this.queue, 'run-canvas-runtime', payload, {
            jobId: `canvas:${idempotencyKey}`.slice(0, 120),
            delay: Math.max(0, t.delayMinutes) * 60_000,
            attempts: 3,
            backoff: { type: 'exponential', delay: 15_000 },
            removeOnComplete: 200,
            removeOnFail: 100,
        });
    }
    async claim(live, extra, row) {
        const existing = await this.prisma.funnelRuntimeLog.findUnique({
            where: {
                organizationId_idempotencyKey: {
                    organizationId: extra.organizationId,
                    idempotencyKey: row.idempotencyKey,
                },
            },
        });
        if (existing) {
            if (existing.status === database_1.FunnelRuntimeLogStatus.SUCCESS ||
                existing.status === database_1.FunnelRuntimeLogStatus.SKIPPED ||
                existing.status === database_1.FunnelRuntimeLogStatus.PENDING) {
                return null;
            }
            if (existing.status === database_1.FunnelRuntimeLogStatus.SCHEDULED) {
                return this.prisma.funnelRuntimeLog.update({
                    where: { id: existing.id },
                    data: { status: database_1.FunnelRuntimeLogStatus.PENDING },
                });
            }
            if (existing.status === database_1.FunnelRuntimeLogStatus.FAILED) {
                return this.prisma.funnelRuntimeLog.update({
                    where: { id: existing.id },
                    data: { status: database_1.FunnelRuntimeLogStatus.PENDING, result: database_1.Prisma.JsonNull },
                });
            }
            return null;
        }
        try {
            return await this.prisma.funnelRuntimeLog.create({
                data: {
                    organizationId: extra.organizationId,
                    funnelId: live.funnel.id,
                    leadId: extra.leadId,
                    nodeId: row.nodeId,
                    edgeId: row.edgeId,
                    event: row.event,
                    branch: row.branch,
                    status: database_1.FunnelRuntimeLogStatus.PENDING,
                    publishedVersion: live.funnel.publishedVersion,
                    idempotencyKey: row.idempotencyKey,
                },
            });
        }
        catch (err) {
            if (err.code === 'P2002')
                return null;
            throw err;
        }
    }
    async executeNode(live, nodeId, ctx, extra) {
        const node = live.spec.nodes.find((n) => n.id === nodeId);
        if (node.type === 'FORM' || (0, shared_1.isFunnelPassthroughNode)(node.type)) {
            return { skipped: true, reason: 'passthrough' };
        }
        if (node.type === 'STAGE')
            return this.executeStage(live, nodeId, extra);
        if (node.type === 'BOOKING')
            return this.executeBooking(live, nodeId, extra);
        if (node.type === 'AUTOMATION')
            return this.executeAutomation(live, nodeId, ctx, extra);
        if (node.type === 'GOAL')
            return this.executeGoal(live, nodeId, ctx, extra);
        if (node.type === 'RETARGET')
            return this.executeRetarget(live, nodeId, ctx, extra);
        return { skipped: true, reason: 'noop' };
    }
    async executeStage(live, nodeId, extra) {
        const fresh = await this.prisma.lead.findFirst({
            where: { id: extra.leadId, organizationId: extra.organizationId },
            include: { stage: { select: { code: true } } },
        });
        if (fresh) {
            live.lead.pipelineStatus = fresh.pipelineStatus;
            live.lead.stageId = fresh.stageId;
            live.lead.pipelineId = fresh.pipelineId;
            live.lead.stage = fresh.stage;
        }
        const node = live.spec.nodes.find((n) => n.id === nodeId);
        const meta = (0, shared_1.readCanvasNodeMeta)(node);
        const code = (meta.stageCode || node.stage?.code || '').toUpperCase();
        if (!code && !meta.stageId)
            return { skipped: true, reason: 'no_stage_code' };
        const current = (live.lead.stage?.code || live.lead.pipelineStatus).toUpperCase();
        if (code && current === code)
            return { skipped: true, reason: 'already_at_stage', code };
        const stage = (meta.stageId
            ? await this.prisma.funnelStage.findFirst({
                where: { id: meta.stageId, organizationId: extra.organizationId, isActive: true },
            })
            : null) ??
            (code
                ? await this.prisma.funnelStage.findFirst({
                    where: { organizationId: extra.organizationId, code, isActive: true },
                })
                : null) ??
            (await this.pipeline.resolveStageForStatus(extra.organizationId, (code || current), live.lead.pipelineId ?? undefined));
        if (!stage)
            return { skipped: true, reason: 'stage_missing', code };
        const pointers = this.pipeline.leadPointersFromStage(stage);
        const nextStatus = pointers.pipelineStatus ?? live.lead.pipelineStatus;
        if (nextStatus !== live.lead.pipelineStatus) {
            if (!(0, shared_1.shouldAdvancePipeline)(live.lead.pipelineStatus, nextStatus)) {
                return { skipped: true, reason: 'no_regress', from: live.lead.pipelineStatus, to: nextStatus };
            }
            try {
                (0, status_transitions_util_1.assertLeadTransition)(live.lead.pipelineStatus, nextStatus);
            }
            catch {
                throw new Error(`Invalid stage ${live.lead.pipelineStatus} → ${nextStatus}`);
            }
        }
        await this.prisma.lead.update({
            where: { id: extra.leadId },
            data: {
                stageId: pointers.stageId ?? live.lead.stageId,
                pipelineId: pointers.pipelineId ?? live.lead.pipelineId,
                pipelineStatus: nextStatus,
                lostReason: stage.isLost ? 'funnel-canvas' : undefined,
                convertedAt: stage.isWon ? new Date() : undefined,
                lastContactedAt: new Date(),
            },
        });
        live.lead.pipelineStatus = nextStatus;
        if (live.lead.stage)
            live.lead.stage.code = code;
        await this.journey.recordJourneyStep({
            organizationId: extra.organizationId,
            leadId: extra.leadId,
            funnelId: live.funnel.id,
            eventType: database_1.MarketingFunnelEventType.STAGE_CHANGED,
            idempotencyKey: `CANVAS_STAGE:${live.funnel.id}:${extra.leadId}:${code}`,
            metadata: { nodeId, from: current, to: code, source: 'funnel-canvas' },
        });
        void this.automation.dispatch(extra.organizationId, database_1.AutomationTriggerType.STAGE_CHANGED, {
            leadId: extra.leadId,
            customerId: live.lead.customerId,
            context: {
                stageId: stage.id,
                stageCode: nextStatus,
                previousStatus: current,
            },
            dedupeKey: `STAGE_CHANGED:${extra.leadId}:${stage.id}`,
        });
        return { applied: true, code };
    }
    async executeAutomation(live, nodeId, ctx, extra) {
        const node = live.spec.nodes.find((n) => n.id === nodeId);
        const inbound = String(ctx.event);
        const mapped = (0, shared_1.mapCanvasEventToAutomationTrigger)(inbound);
        const nodeMeta = (0, shared_1.readCanvasNodeMeta)(node);
        const metaTrigger = String(nodeMeta.triggerType ?? '');
        const delayed = Boolean(extra && 'fromSchedule' in extra && extra.fromSchedule);
        let triggerName = metaTrigger ||
            (inbound === 'TIMEOUT' || inbound === 'LEAD_UNTOUCHED'
                ? 'LEAD_UNTOUCHED'
                : mapped);
        if (!triggerName)
            return { skipped: true, reason: 'no_trigger' };
        if ((inbound === 'FORM_SUBMITTED' || inbound === 'LEAD_CREATED') && triggerName === 'LEAD_CREATED') {
            if (!delayed) {
                return { skipped: true, reason: 'already_dispatched_on_lead_create', trigger: triggerName };
            }
            triggerName = 'LEAD_UNTOUCHED';
        }
        const trigger = triggerName;
        if (!Object.values(database_1.AutomationTriggerType).includes(trigger)) {
            return { skipped: true, reason: 'unknown_trigger', trigger: triggerName };
        }
        void this.automation.dispatch(extra.organizationId, trigger, {
            leadId: extra.leadId,
            customerId: live.lead.customerId,
            appointmentId: extra.appointmentId,
            flowId: nodeMeta.flowId,
            delayMinutesOverride: nodeMeta.delayMinutes,
            context: {
                canvasNodeId: nodeId,
                event: inbound,
                stageCode: String(ctx.stageCode ?? ''),
            },
            dedupeKey: `CANVAS_AUTO:${live.funnel.id}:${nodeId}:${extra.leadId}:${triggerName}`,
        });
        return { dispatched: triggerName, flowId: nodeMeta.flowId ?? null };
    }
    async executeBooking(live, nodeId, extra) {
        const node = live.spec.nodes.find((n) => n.id === nodeId);
        const bookingEvent = (0, shared_1.readCanvasNodeMeta)(node).bookingEvent ?? 'BOOKING_CREATED';
        const eventType = bookingEvent === 'BOOKING_CONFIRMED'
            ? database_1.MarketingFunnelEventType.APPOINTMENT_CONFIRMED
            : bookingEvent === 'BOOKING_CANCELLED'
                ? database_1.MarketingFunnelEventType.APPOINTMENT_CANCELLED
                : bookingEvent === 'VISIT' || bookingEvent === 'BOOKING_COMPLETED'
                    ? database_1.MarketingFunnelEventType.CUSTOMER_ARRIVED
                    : database_1.MarketingFunnelEventType.APPOINTMENT_BOOKED;
        await this.journey.recordJourneyStep({
            organizationId: extra.organizationId,
            leadId: extra.leadId,
            funnelId: live.funnel.id,
            eventType,
            appointmentId: extra.appointmentId,
            idempotencyKey: `CANVAS_BOOKING:${live.funnel.id}:${extra.leadId}:${nodeId}:${bookingEvent}`,
            metadata: { nodeId, bookingEvent, source: 'funnel-canvas' },
        });
        return { bookingEvent };
    }
    async executeGoal(live, nodeId, ctx, extra) {
        const node = live.spec.nodes.find((n) => n.id === nodeId);
        const conversion = (0, shared_1.resolveGoalConversion)(node, live.spec, ctx);
        if (!conversion)
            return { skipped: true, reason: 'no_conversion' };
        const eventName = (0, shared_1.mapConversionToFunnelEventType)(conversion);
        const eventType = eventName;
        let revenue = extra.revenue ?? null;
        let orderId = extra.orderId ?? null;
        let paymentId = extra.paymentId ?? null;
        if (conversion === 'PURCHASE' && revenue == null) {
            const payment = await this.prisma.payment.findFirst({
                where: {
                    organizationId: extra.organizationId,
                    status: database_1.PaymentStatus.COMPLETED,
                    order: { leadId: extra.leadId },
                },
                orderBy: { paidAt: 'desc' },
                select: { id: true, amount: true, orderId: true },
            });
            if (payment) {
                revenue = Number(payment.amount);
                orderId = payment.orderId;
                paymentId = payment.id;
            }
            else {
                const order = await this.prisma.order.findFirst({
                    where: { organizationId: extra.organizationId, leadId: extra.leadId },
                    orderBy: { createdAt: 'desc' },
                    select: { id: true, total: true },
                });
                if (order) {
                    revenue = Number(order.total);
                    orderId = order.id;
                }
            }
        }
        await this.journey.recordJourneyStep({
            organizationId: extra.organizationId,
            leadId: extra.leadId,
            funnelId: live.funnel.id,
            eventType,
            idempotencyKey: `CANVAS_GOAL:${live.funnel.id}:${extra.leadId}:${conversion}:${nodeId}`,
            amount: revenue,
            appointmentId: extra.appointmentId,
            orderId,
            paymentId,
            metadata: {
                conversion,
                nodeId,
                source: 'funnel-canvas',
                revenue,
            },
        });
        return { conversion, revenue };
    }
    async executeRetarget(live, nodeId, ctx, extra) {
        const node = live.spec.nodes.find((n) => n.id === nodeId);
        const meta = (0, shared_1.readCanvasNodeMeta)(node);
        if (meta.conditionField) {
            const ok = (0, shared_1.evaluateFunnelEdgeCondition)({
                field: meta.conditionField,
                op: meta.conditionOp ?? 'gte',
                value: meta.conditionValue ?? 0,
            }, ctx);
            if (!ok)
                return { skipped: true, reason: 'condition_failed' };
        }
        if ((meta.delayMinutes ?? 0) > 0 && !extra.fromSchedule) {
            await this.schedule(live, extra, {
                edgeId: `node-delay:${nodeId}`,
                toNodeId: nodeId,
                event: String(ctx.event || 'LEAD_UNTOUCHED'),
                branch: 'default',
                delayMinutes: meta.delayMinutes ?? 0,
            });
            return { scheduledDelay: true, delayMinutes: meta.delayMinutes, skipped: true };
        }
        const capDays = live.spec.remarketing?.frequencyCapDays ?? 7;
        const since = new Date(Date.now() - capDays * 24 * 60 * 60_000);
        const source = `funnel-canvas-retarget:${live.funnel.id}:${nodeId}`;
        const existing = await this.prisma.crmTask.findFirst({
            where: {
                organizationId: extra.organizationId,
                leadId: extra.leadId,
                source,
                createdAt: { gte: since },
            },
        });
        if (existing)
            return { skipped: true, reason: 'frequency_cap', taskId: existing.id };
        const audience = live.spec.remarketing?.audiences?.find((a) => a.key === meta.audienceKey);
        const offer = audience?.label || live.spec.remarketing?.offer || live.spec.offer;
        const task = await this.prisma.crmTask.create({
            data: {
                organizationId: extra.organizationId,
                leadId: extra.leadId,
                customerId: live.lead.customerId,
                title: `Remarketing: ${offer}`.slice(0, 160),
                dueAt: new Date(Date.now() + 60 * 60_000),
                source,
            },
        });
        const trigger = (meta.triggerType &&
            Object.values(database_1.AutomationTriggerType).includes(meta.triggerType)
            ? meta.triggerType
            : 'LEAD_UNTOUCHED');
        void this.automation.dispatch(extra.organizationId, trigger, {
            leadId: extra.leadId,
            customerId: live.lead.customerId,
            flowId: meta.flowId,
            context: {
                canvasNodeId: nodeId,
                event: String(ctx.event),
                audienceKey: meta.audienceKey ?? '',
            },
            dedupeKey: `CANVAS_RETARGET:${live.funnel.id}:${nodeId}:${extra.leadId}`,
        });
        return { taskId: task.id, ads: false, audienceKey: meta.audienceKey ?? null };
    }
};
exports.FunnelCanvasRuntimeService = FunnelCanvasRuntimeService;
exports.FunnelCanvasRuntimeService = FunnelCanvasRuntimeService = FunnelCanvasRuntimeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(5, (0, common_1.Inject)(queue_constants_1.AUTOMATION_MESSAGE_QUEUE)),
    __param(6, (0, common_1.Inject)((0, common_1.forwardRef)(() => lead_scoring_service_1.LeadScoringService))),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        pipeline_service_1.PipelineService,
        automation_engine_service_1.AutomationEngineService,
        customer_journey_service_1.CustomerJourneyService,
        queue_enqueue_service_1.QueueEnqueueService, Function, lead_scoring_service_1.LeadScoringService])
], FunnelCanvasRuntimeService);
function normalize(v) {
    return v.trim().toUpperCase();
}
