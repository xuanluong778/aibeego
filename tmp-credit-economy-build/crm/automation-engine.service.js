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
var AutomationEngineService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomationEngineService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const queue_constants_1 = require("../queue/queue.constants");
const queue_enqueue_service_1 = require("../common/services/queue-enqueue.service");
const shared_1 = require("@marketingspa/shared");
const template_renderer_util_1 = require("../automation/template-renderer.util");
const lead_assignment_service_1 = require("./lead-assignment.service");
const messaging_eligibility_service_1 = require("../messaging/messaging-eligibility.service");
let AutomationEngineService = AutomationEngineService_1 = class AutomationEngineService {
    prisma;
    queueEnqueue;
    assignment;
    eligibility;
    queue;
    logger = new common_1.Logger(AutomationEngineService_1.name);
    constructor(prisma, queueEnqueue, assignment, eligibility, queue) {
        this.prisma = prisma;
        this.queueEnqueue = queueEnqueue;
        this.assignment = assignment;
        this.eligibility = eligibility;
        this.queue = queue;
    }
    /** Fire-and-forget enqueue — không chặn API */
    async dispatch(organizationId, triggerType, payload) {
        const flows = await this.prisma.automationFlow.findMany({
            where: {
                organizationId,
                triggerType,
                isActive: true,
                isPaused: false,
                ...(payload.flowId ? { id: payload.flowId } : {}),
            },
        });
        for (const flow of flows) {
            const idempotencyKey = payload.dedupeKey ??
                `${flow.id}:${triggerType}:${payload.leadId ?? ''}:${payload.appointmentId ?? ''}:${payload.customerId ?? ''}`;
            await this.queueEnqueue.add(this.queue, 'run-automation', {
                organizationId,
                flowId: flow.id,
                leadId: payload.leadId,
                customerId: payload.customerId,
                appointmentId: payload.appointmentId,
                context: payload.context ?? {},
                idempotencyKey,
                fromStep: payload.fromStep,
            }, {
                jobId: `auto:${idempotencyKey}`.slice(0, 120),
                delay: payload.delayMinutesOverride != null
                    ? Math.max(0, payload.delayMinutesOverride) * 60_000
                    : Math.max(0, flow.delayMinutes) * 60_000,
                attempts: 3,
                backoff: { type: 'exponential', delay: 15_000 },
                removeOnComplete: 200,
                removeOnFail: 100,
            });
        }
    }
    isInQuietHours(flow) {
        if (!flow.quietHoursStart || !flow.quietHoursEnd)
            return false;
        const now = new Date();
        const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const start = flow.quietHoursStart;
        const end = flow.quietHoursEnd;
        if (start <= end)
            return hhmm >= start && hhmm < end;
        return hhmm >= start || hhmm < end;
    }
    async processJob(data) {
        const existing = await this.prisma.automationLog.findUnique({
            where: {
                organizationId_idempotencyKey: {
                    organizationId: data.organizationId,
                    idempotencyKey: data.idempotencyKey,
                },
            },
        });
        if (existing && existing.status !== database_1.AutomationLogStatus.FAILED) {
            return { skipped: true, reason: 'idempotent' };
        }
        const flow = await this.prisma.automationFlow.findFirst({
            where: { id: data.flowId, organizationId: data.organizationId },
            include: { messageTemplate: true },
        });
        if (!flow || !flow.isActive || flow.isPaused) {
            return { skipped: true, reason: 'flow_inactive' };
        }
        if (this.isInQuietHours(flow)) {
            await this.prisma.automationLog.create({
                data: {
                    organizationId: data.organizationId,
                    automationFlowId: flow.id,
                    leadId: data.leadId ?? undefined,
                    customerId: data.customerId ?? undefined,
                    appointmentId: data.appointmentId ?? undefined,
                    status: database_1.AutomationLogStatus.SKIPPED,
                    stepName: 'quiet_hours',
                    idempotencyKey: `${data.idempotencyKey}:quiet`,
                    executedAt: new Date(),
                    result: { reason: 'quiet_hours', retryHint: flow.quietHoursEnd },
                },
            }).catch(() => undefined);
            // Re-enqueue after quiet hours end (approx + delay to end)
            const delayMs = 30 * 60_000;
            await this.queueEnqueue.add(this.queue, 'run-automation', data, {
                jobId: `auto-retry-quiet:${data.idempotencyKey}`.slice(0, 120),
                delay: delayMs,
                attempts: 2,
            });
            return { skipped: true, reason: 'quiet_hours_rescheduled' };
        }
        if (flow.maxSendsPerDay != null) {
            const dayStart = new Date();
            dayStart.setHours(0, 0, 0, 0);
            const sentToday = await this.prisma.automationLog.count({
                where: {
                    organizationId: data.organizationId,
                    automationFlowId: flow.id,
                    createdAt: { gte: dayStart },
                    status: { in: [database_1.AutomationLogStatus.SENT, database_1.AutomationLogStatus.SUCCESS] },
                },
            });
            if (sentToday >= flow.maxSendsPerDay) {
                return { skipped: true, reason: 'max_sends_per_day' };
            }
        }
        if (flow.cooldownMinutes > 0 && data.leadId) {
            const since = new Date(Date.now() - flow.cooldownMinutes * 60_000);
            const recent = await this.prisma.automationLog.findFirst({
                where: {
                    organizationId: data.organizationId,
                    automationFlowId: flow.id,
                    leadId: data.leadId,
                    createdAt: { gte: since },
                    status: { in: [database_1.AutomationLogStatus.SENT, database_1.AutomationLogStatus.SUCCESS] },
                },
            });
            if (recent)
                return { skipped: true, reason: 'cooldown' };
        }
        let context = { ...(data.context ?? {}) };
        if (data.leadId) {
            const lead = await this.prisma.lead.findFirst({
                where: { id: data.leadId, organizationId: data.organizationId },
                include: { branch: true, customer: true },
            });
            if (lead) {
                context = {
                    ...context,
                    customer_name: lead.name,
                    phone: lead.phone ?? '',
                    branch_name: lead.branch?.name ?? '',
                };
            }
        }
        const actions = (Array.isArray(flow.actions) ? flow.actions : []);
        const effectiveActions = actions.length > 0
            ? actions
            : flow.messageTemplate
                ? [{ type: 'SEND_MESSAGE' }]
                : [];
        const stepResults = [];
        let lastContent;
        for (let i = 0; i < effectiveActions.length; i++) {
            const action = effectiveActions[i];
            const stepName = action.type;
            try {
                const result = await this.runAction(data.organizationId, flow, action, {
                    leadId: data.leadId,
                    customerId: data.customerId,
                    appointmentId: data.appointmentId,
                    context,
                });
                if (result && typeof result === 'object' && 'renderedContent' in result) {
                    lastContent = result.renderedContent;
                }
                stepResults.push({ step: i, stepName, ok: true, result });
                await this.prisma.automationLog.create({
                    data: {
                        organizationId: data.organizationId,
                        automationFlowId: flow.id,
                        leadId: data.leadId ?? undefined,
                        customerId: data.customerId ?? undefined,
                        appointmentId: data.appointmentId ?? undefined,
                        channel: flow.channel ?? flow.messageTemplate?.channel ?? database_1.MessageChannel.ZALO,
                        renderedContent: lastContent,
                        status: database_1.AutomationLogStatus.SUCCESS,
                        stepIndex: i,
                        stepName,
                        idempotencyKey: `${data.idempotencyKey}:step:${i}`,
                        executedAt: new Date(),
                        result: result,
                    },
                }).catch(() => undefined);
            }
            catch (err) {
                const msg = err instanceof Error ? err.message : 'action failed';
                this.logger.warn(`automation step failed: ${msg}`);
                await this.prisma.automationLog.create({
                    data: {
                        organizationId: data.organizationId,
                        automationFlowId: flow.id,
                        leadId: data.leadId ?? undefined,
                        customerId: data.customerId ?? undefined,
                        status: database_1.AutomationLogStatus.FAILED,
                        stepIndex: i,
                        stepName,
                        idempotencyKey: `${data.idempotencyKey}:step:${i}:fail`,
                        executedAt: new Date(),
                        result: { error: msg },
                    },
                }).catch(() => undefined);
                throw err;
            }
        }
        await this.prisma.automationLog.create({
            data: {
                organizationId: data.organizationId,
                automationFlowId: flow.id,
                leadId: data.leadId ?? undefined,
                customerId: data.customerId ?? undefined,
                appointmentId: data.appointmentId ?? undefined,
                channel: flow.channel ?? flow.messageTemplate?.channel,
                renderedContent: lastContent,
                status: database_1.AutomationLogStatus.SENT,
                stepName: 'completed',
                idempotencyKey: data.idempotencyKey,
                executedAt: new Date(),
                result: { steps: stepResults, simulated: true },
            },
        });
        return { ok: true, steps: stepResults.length };
    }
    async runAction(organizationId, flow, action, ctx) {
        switch (action.type) {
            case 'SEND_MESSAGE':
            case 'SEND_EMAIL': {
                const channel = flow.channel ?? flow.messageTemplate?.channel ?? database_1.MessageChannel.ZALO;
                const eligibility = await this.eligibility.checkBeforeSend({
                    organizationId,
                    channel,
                    campaignType: 'automation',
                    flowId: flow.id,
                    leadId: ctx.leadId ?? undefined,
                    customerId: ctx.customerId ?? undefined,
                    templateId: action.templateId ?? flow.messageTemplateId ?? undefined,
                });
                if (!eligibility.eligible) {
                    return {
                        skipped: true,
                        reason: eligibility.reasonCode,
                        message: eligibility.reasonMessage,
                        providerMode: eligibility.providerMode,
                        nextEligibleAt: eligibility.nextEligibleAt,
                    };
                }
                let body = flow.messageTemplate?.body ?? 'Xin chào {{customer_name}}';
                if (action.templateId) {
                    const t = await this.prisma.messageTemplate.findFirst({
                        where: { id: action.templateId, organizationId },
                    });
                    if (t)
                        body = t.body;
                }
                const renderedContent = (0, template_renderer_util_1.renderTemplate)(body, ctx.context);
                return {
                    renderedContent,
                    simulated: true,
                    channel: action.type,
                    providerMode: eligibility.providerMode,
                    estimatedCost: eligibility.estimatedCost,
                };
            }
            case 'CREATE_TASK': {
                const dueAt = new Date(Date.now() + (action.dueInMinutes ?? 60) * 60_000);
                return this.prisma.crmTask.create({
                    data: {
                        organizationId,
                        leadId: ctx.leadId ?? undefined,
                        customerId: ctx.customerId ?? undefined,
                        title: action.title,
                        dueAt,
                        source: 'automation',
                    },
                });
            }
            case 'ASSIGN_EMPLOYEE': {
                if (!ctx.leadId)
                    return { skipped: true };
                const employeeId = action.employeeId ??
                    (await this.assignment.autoAssign(organizationId, {}));
                if (!employeeId)
                    return { skipped: true, reason: 'no_employee' };
                await this.prisma.lead.update({
                    where: { id: ctx.leadId },
                    data: { assignedToId: employeeId },
                });
                return { assignedToId: employeeId };
            }
            case 'CHANGE_STATUS': {
                if (!ctx.leadId || !action.pipelineStatus)
                    return { skipped: true };
                await this.prisma.lead.update({
                    where: { id: ctx.leadId },
                    data: { pipelineStatus: action.pipelineStatus },
                });
                return { pipelineStatus: action.pipelineStatus };
            }
            case 'ADD_TAG': {
                if (!ctx.leadId)
                    return { skipped: true };
                const lead = await this.prisma.lead.findFirst({ where: { id: ctx.leadId } });
                if (!lead)
                    return { skipped: true };
                const tags = [...new Set([...(lead.tags ?? []), action.tag])];
                await this.prisma.lead.update({ where: { id: ctx.leadId }, data: { tags } });
                return { tags };
            }
            case 'CREATE_APPOINTMENT': {
                if (!ctx.leadId)
                    return { skipped: true };
                const lead = await this.prisma.lead.findFirst({
                    where: { id: ctx.leadId, organizationId },
                });
                if (!lead?.branchId && !action.branchId)
                    return { skipped: true, reason: 'no_branch' };
                const scheduledAt = new Date(Date.now() + (action.delayMinutes ?? 1440) * 60_000);
                return this.prisma.appointment.create({
                    data: {
                        organizationId,
                        branchId: action.branchId ?? lead.branchId,
                        leadId: lead.id,
                        customerId: lead.customerId,
                        scheduledAt,
                        status: 'SCHEDULED',
                        note: 'Tạo bởi automation',
                    },
                });
            }
            case 'WEBHOOK': {
                const url = String(action.url || '').trim();
                if (!url || !(0, shared_1.isSafeWebhookUrl)(url)) {
                    return { skipped: true, reason: 'unsafe_webhook_url' };
                }
                const lead = ctx.leadId
                    ? await this.prisma.lead.findFirst({
                        where: { id: ctx.leadId, organizationId },
                        select: {
                            id: true,
                            name: true,
                            phone: true,
                            email: true,
                            landingPageId: true,
                            landingPageBlockId: true,
                        },
                    })
                    : null;
                const payload = {
                    event: 'automation.webhook',
                    organizationId,
                    leadId: ctx.leadId ?? null,
                    customerId: ctx.customerId ?? null,
                    lead: lead
                        ? {
                            id: lead.id,
                            name: lead.name,
                            phone: lead.phone,
                            email: lead.email,
                            landingPageId: lead.landingPageId,
                            landingPageBlockId: lead.landingPageBlockId,
                        }
                        : null,
                    context: ctx.context,
                    triggeredAt: new Date().toISOString(),
                };
                const result = await (0, shared_1.postOutboundWebhook)(url, payload, action.secretHeader);
                if (!result.ok) {
                    this.logger.warn(`WEBHOOK action failed: ${result.error ?? result.status}`);
                }
                return result;
            }
            default:
                return { skipped: true, reason: 'unknown_action' };
        }
    }
};
exports.AutomationEngineService = AutomationEngineService;
exports.AutomationEngineService = AutomationEngineService = AutomationEngineService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, common_1.Inject)(queue_constants_1.AUTOMATION_MESSAGE_QUEUE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        queue_enqueue_service_1.QueueEnqueueService,
        lead_assignment_service_1.LeadAssignmentService,
        messaging_eligibility_service_1.MessagingEligibilityService, Function])
], AutomationEngineService);
