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
exports.AppointmentsService = void 0;
const database_1 = require("@marketingspa/database");
const common_1 = require("@nestjs/common");
const database_2 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const tenant_ownership_service_1 = require("../common/services/tenant-ownership.service");
const attribution_hooks_service_1 = require("../attribution/attribution-hooks.service");
const appointment_conflict_service_1 = require("../crm/appointment-conflict.service");
const automation_engine_service_1 = require("../crm/automation-engine.service");
const pipeline_service_1 = require("../crm/pipeline.service");
const template_renderer_util_1 = require("../automation/template-renderer.util");
const pagination_util_1 = require("../common/utils/pagination.util");
const date_range_util_1 = require("../common/utils/date-range.util");
const events_gateway_1 = require("../events/events.gateway");
const status_transitions_util_1 = require("../common/utils/status-transitions.util");
let AppointmentsService = class AppointmentsService {
    prisma;
    events;
    audit;
    tenant;
    attributionHooks;
    conflicts;
    automation;
    pipeline;
    constructor(prisma, events, audit, tenant, attributionHooks, conflicts, automation, pipeline) {
        this.prisma = prisma;
        this.events = events;
        this.audit = audit;
        this.tenant = tenant;
        this.attributionHooks = attributionHooks;
        this.conflicts = conflicts;
        this.automation = automation;
        this.pipeline = pipeline;
    }
    listServices(organizationId) {
        return this.prisma.service.findMany({
            where: { organizationId, isActive: true },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, price: true, durationMinutes: true },
        });
    }
    async findAll(organizationId, query) {
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        const where = this.buildWhere(organizationId, query);
        const [items, total] = await Promise.all([
            this.prisma.appointment.findMany({
                where,
                skip,
                take,
                orderBy: { scheduledAt: 'asc' },
                include: this.defaultInclude(),
            }),
            this.prisma.appointment.count({ where }),
        ]);
        return (0, pagination_util_1.buildPaginatedResult)(items, total, page, pageSize);
    }
    async getCalendar(organizationId, query) {
        const { from, to } = (0, date_range_util_1.resolveCalendarRange)(query.view, query.date);
        const where = {
            organizationId,
            scheduledAt: { gte: from, lte: to },
            ...(query.branchId && { branchId: query.branchId }),
            ...(query.employeeId && { employeeId: query.employeeId }),
            ...(query.serviceId && { serviceId: query.serviceId }),
            ...(query.status && { status: query.status }),
        };
        return this.prisma.appointment.findMany({
            where,
            orderBy: { scheduledAt: 'asc' },
            include: this.defaultInclude(),
        });
    }
    async findOne(organizationId, id) {
        const appt = await this.prisma.appointment.findFirst({
            where: { id, organizationId },
            include: this.defaultInclude(),
        });
        if (!appt)
            throw new common_1.NotFoundException('Lịch hẹn không tồn tại');
        return appt;
    }
    async create(organizationId, dto, userId) {
        await this.tenant.validateBranchBoundRelations(organizationId, {
            branchId: dto.branchId,
            customerId: dto.customerId,
            leadId: dto.leadId,
            employeeId: dto.employeeId,
            serviceId: dto.serviceId,
            adCampaignId: dto.adCampaignId,
        });
        await Promise.all([
            this.tenant.assertSpaRoom(organizationId, dto.roomId),
            this.tenant.assertSpaBed(organizationId, dto.bedId),
            this.tenant.assertSpaEquipment(organizationId, dto.equipmentId),
        ]);
        let customerId = dto.customerId;
        if (!customerId && dto.leadId) {
            const lead = await this.prisma.lead.findFirst({
                where: { id: dto.leadId, organizationId },
            });
            if (lead?.customerId) {
                customerId = lead.customerId;
            }
            else if (lead) {
                const phone = lead.phone?.trim() || null;
                const email = lead.email?.trim() || null;
                let customer = (phone
                    ? await this.prisma.customer.findFirst({
                        where: { organizationId, phone, isActive: true },
                    })
                    : null) ??
                    (email
                        ? await this.prisma.customer.findFirst({
                            where: {
                                organizationId,
                                email: { equals: email, mode: 'insensitive' },
                                isActive: true,
                            },
                        })
                        : null);
                if (!customer) {
                    customer = await new database_1.PlanPolicy(this.prisma).resource(organizationId, 'customers', (tx) => tx.customer.count({ where: { organizationId, isActive: true } }), (tx) => tx.customer.create({
                        data: {
                            organizationId,
                            branchId: dto.branchId ?? lead.branchId,
                            name: lead.name,
                            phone: phone ?? undefined,
                            email: email ?? undefined,
                            leadSourceId: lead.leadSourceId,
                            source: 'appointment_from_lead',
                        },
                    }));
                }
                await this.prisma.lead.update({
                    where: { id: lead.id },
                    data: { customerId: customer.id },
                });
                customerId = customer.id;
            }
        }
        const durationMinutes = dto.durationMinutes ?? 60;
        await this.conflicts.assertNoConflict(organizationId, {
            scheduledAt: new Date(dto.scheduledAt),
            durationMinutes,
            employeeId: dto.employeeId,
            roomId: dto.roomId,
            bedId: dto.bedId,
            equipmentId: dto.equipmentId,
        });
        const appt = await this.prisma.appointment.create({
            data: {
                organizationId,
                branchId: dto.branchId,
                customerId,
                leadId: dto.leadId,
                employeeId: dto.employeeId,
                serviceId: dto.serviceId,
                roomId: dto.roomId,
                bedId: dto.bedId,
                equipmentId: dto.equipmentId,
                adCampaignId: dto.adCampaignId,
                scheduledAt: new Date(dto.scheduledAt),
                durationMinutes,
                note: dto.note,
                depositAmount: dto.depositAmount ?? 0,
                depositStatus: dto.depositStatus,
            },
            include: this.defaultInclude(),
        });
        if (dto.leadId) {
            const stage = await this.pipeline.resolveStageForStatus(organizationId, database_2.LeadPipelineStatus.BOOKED);
            await this.prisma.lead.update({
                where: { id: dto.leadId },
                data: {
                    pipelineStatus: database_2.LeadPipelineStatus.BOOKED,
                    stageId: stage?.id,
                },
            });
        }
        await this.audit.log({
            organizationId,
            userId,
            action: 'APPOINTMENT_CREATED',
            entityType: 'APPOINTMENT',
            entityId: appt.id,
            metadata: { scheduledAt: appt.scheduledAt.toISOString(), customerId: appt.customerId },
        });
        this.events.broadcastAppointmentNew(organizationId, {
            appointmentId: appt.id,
            scheduledAt: appt.scheduledAt.toISOString(),
            customerName: appt.customer?.name,
        });
        await this.attributionHooks.onAppointmentChange(organizationId, {
            id: appt.id,
            leadId: appt.leadId,
            customerId: appt.customerId,
            branchId: appt.branchId,
            employeeId: appt.employeeId,
            serviceId: appt.serviceId,
            status: appt.status,
        });
        void this.automation.dispatch(organizationId, database_2.AutomationTriggerType.APPOINTMENT_CREATED, {
            leadId: appt.leadId,
            customerId: appt.customerId,
            appointmentId: appt.id,
            dedupeKey: `APPOINTMENT_CREATED:${appt.id}`,
        });
        return appt;
    }
    async update(organizationId, id, dto, userId) {
        const existing = await this.findOne(organizationId, id);
        await this.tenant.validateBranchBoundRelations(organizationId, {
            branchId: dto.branchId ?? existing.branchId,
            customerId: dto.customerId ?? existing.customerId,
            leadId: dto.leadId ?? existing.leadId,
            employeeId: dto.employeeId ?? existing.employeeId,
            serviceId: dto.serviceId ?? existing.serviceId,
        });
        const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : existing.scheduledAt;
        const durationMinutes = dto.durationMinutes ?? existing.durationMinutes;
        await this.conflicts.assertNoConflict(organizationId, {
            scheduledAt,
            durationMinutes,
            employeeId: dto.employeeId ?? existing.employeeId,
            roomId: dto.roomId ?? existing.roomId,
            bedId: dto.bedId ?? existing.bedId,
            equipmentId: dto.equipmentId ?? existing.equipmentId,
            excludeAppointmentId: id,
        });
        if (dto.employeeId !== undefined && dto.employeeId !== existing.employeeId) {
            await this.audit.log({
                organizationId,
                userId,
                action: 'APPOINTMENT_ASSIGNED',
                entityType: 'APPOINTMENT',
                entityId: id,
                metadata: {
                    previousEmployeeId: existing.employeeId,
                    assignedEmployeeId: dto.employeeId,
                },
            });
        }
        return this.prisma.appointment.update({
            where: { id },
            data: {
                ...dto,
                scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
                depositAmount: dto.depositAmount,
            },
            include: this.defaultInclude(),
        });
    }
    async reschedule(organizationId, id, dto, userId) {
        const existing = await this.findOne(organizationId, id);
        const durationMinutes = dto.durationMinutes ?? existing.durationMinutes;
        await this.conflicts.assertNoConflict(organizationId, {
            scheduledAt: new Date(dto.scheduledAt),
            durationMinutes,
            employeeId: dto.employeeId ?? existing.employeeId,
            roomId: dto.roomId ?? existing.roomId,
            bedId: dto.bedId ?? existing.bedId,
            equipmentId: existing.equipmentId,
            excludeAppointmentId: id,
        });
        const appt = await this.prisma.appointment.update({
            where: { id },
            data: {
                scheduledAt: new Date(dto.scheduledAt),
                durationMinutes,
                employeeId: dto.employeeId ?? existing.employeeId,
                roomId: dto.roomId ?? existing.roomId,
                bedId: dto.bedId ?? existing.bedId,
                note: dto.note ?? existing.note,
                status: database_2.AppointmentStatus.SCHEDULED,
                rescheduledFromId: existing.rescheduledFromId ?? id,
            },
            include: this.defaultInclude(),
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'APPOINTMENT_RESCHEDULED',
            entityType: 'APPOINTMENT',
            entityId: id,
            metadata: {
                from: existing.scheduledAt.toISOString(),
                to: appt.scheduledAt.toISOString(),
            },
        });
        return appt;
    }
    async updateStatus(organizationId, id, dto, userId) {
        const existing = await this.findOne(organizationId, id);
        const previousStatus = existing.status;
        (0, status_transitions_util_1.assertAppointmentTransition)(previousStatus, dto.status);
        const appt = await this.prisma.appointment.update({
            where: { id },
            data: {
                status: dto.status,
                cancelledReason: dto.cancelledReason,
                noShowReason: dto.noShowReason,
                checkedInAt: dto.status === database_2.AppointmentStatus.ARRIVED ? new Date() : existing.checkedInAt,
                checkedOutAt: dto.status === database_2.AppointmentStatus.COMPLETED ? new Date() : existing.checkedOutAt,
            },
            include: this.defaultInclude(),
        });
        if (existing.leadId) {
            const leadStatusMap = {
                [database_2.AppointmentStatus.CONFIRMED]: database_2.LeadPipelineStatus.CONFIRMED,
                [database_2.AppointmentStatus.ARRIVED]: database_2.LeadPipelineStatus.VISITED,
                [database_2.AppointmentStatus.COMPLETED]: database_2.LeadPipelineStatus.VISITED,
                [database_2.AppointmentStatus.CANCELLED]: database_2.LeadPipelineStatus.CONTACTED,
                [database_2.AppointmentStatus.NO_SHOW]: database_2.LeadPipelineStatus.CONTACTED,
            };
            const next = leadStatusMap[dto.status];
            if (next) {
                const stage = await this.pipeline.resolveStageForStatus(organizationId, next);
                await this.prisma.lead.update({
                    where: { id: existing.leadId },
                    data: { pipelineStatus: next, stageId: stage?.id },
                });
            }
        }
        await this.audit.log({
            organizationId,
            userId,
            action: 'APPOINTMENT_STATUS_CHANGED',
            entityType: 'APPOINTMENT',
            entityId: id,
            metadata: { previousStatus, newStatus: dto.status },
        });
        await this.attributionHooks.onAppointmentChange(organizationId, {
            id: appt.id,
            leadId: appt.leadId,
            customerId: appt.customerId,
            branchId: appt.branchId,
            employeeId: appt.employeeId,
            serviceId: appt.serviceId,
            status: appt.status,
        }, previousStatus);
        if (dto.status === database_2.AppointmentStatus.CANCELLED) {
            void this.automation.dispatch(organizationId, database_2.AutomationTriggerType.APPOINTMENT_CANCELLED, {
                leadId: appt.leadId,
                customerId: appt.customerId,
                appointmentId: appt.id,
                dedupeKey: `APPOINTMENT_CANCELLED:${appt.id}`,
            });
        }
        if (dto.status === database_2.AppointmentStatus.NO_SHOW) {
            void this.automation.dispatch(organizationId, database_2.AutomationTriggerType.NO_SHOW, {
                leadId: appt.leadId,
                customerId: appt.customerId,
                appointmentId: appt.id,
                dedupeKey: `NO_SHOW:${appt.id}`,
            });
        }
        return appt;
    }
    /** Giả lập gửi nhắc lịch — ghi AutomationLog */
    async sendReminder(organizationId, id, userId) {
        const appt = await this.findOne(organizationId, id);
        let flow = await this.prisma.automationFlow.findFirst({
            where: {
                organizationId,
                isActive: true,
                triggerType: database_2.AutomationTriggerType.APPOINTMENT_REMINDER,
            },
            include: { messageTemplate: true },
        });
        if (!flow) {
            const template = await this.prisma.messageTemplate.findFirst({
                where: { organizationId, isActive: true },
            });
            if (!template) {
                throw new common_1.NotFoundException('Chưa có mẫu tin nhắn automation');
            }
            flow = await new database_1.PlanPolicy(this.prisma).resource(organizationId, 'flows', (tx) => tx.automationFlow.count({ where: { organizationId } }), (tx) => tx.automationFlow.create({
                data: {
                    organizationId,
                    messageTemplateId: template.id,
                    name: 'Nhắc lịch hẹn',
                    triggerType: database_2.AutomationTriggerType.APPOINTMENT_REMINDER,
                    triggerConfig: { hoursBefore: 24 },
                },
                include: { messageTemplate: true },
            }));
        }
        const scheduledAt = appt.scheduledAt;
        const channel = flow.channel ?? flow.messageTemplate?.channel;
        const bodyTemplate = flow.messageTemplate?.body ??
            'Xin chào {{customer_name}}, spa nhắc lịch hẹn {{appointment_time}} tại {{branch_name}}.';
        const renderedContent = (0, template_renderer_util_1.renderTemplate)(bodyTemplate, {
            customer_name: appt.customer?.name ?? appt.lead?.name ?? 'Quý khách',
            appointment_time: scheduledAt.toLocaleString('vi-VN'),
            branch_name: appt.branch?.name ?? '',
            service_name: appt.service?.name ?? '',
        });
        const log = await this.prisma.automationLog.create({
            data: {
                organizationId,
                automationFlowId: flow.id,
                customerId: appt.customerId,
                leadId: appt.leadId,
                channel: channel ?? undefined,
                renderedContent,
                status: database_2.AutomationLogStatus.SENT,
                executedAt: new Date(),
                result: {
                    simulated: true,
                    type: 'APPOINTMENT_REMINDER',
                    channel: channel ?? 'UNKNOWN',
                    appointmentId: appt.id,
                    sentByUserId: userId,
                },
            },
        });
        return { message: 'Đã ghi nhắc lịch giả lập vào AutomationLog', log };
    }
    async remove(organizationId, id) {
        await this.findOne(organizationId, id);
        return this.prisma.appointment.delete({ where: { id } });
    }
    buildWhere(organizationId, query) {
        return {
            organizationId,
            ...(query.status && { status: query.status }),
            ...(query.branchId && { branchId: query.branchId }),
            ...(query.employeeId && { employeeId: query.employeeId }),
            ...(query.serviceId && { serviceId: query.serviceId }),
            ...(query.customerId && { customerId: query.customerId }),
            ...(query.from || query.to
                ? {
                    scheduledAt: {
                        ...(query.from && { gte: new Date(query.from) }),
                        ...(query.to && { lte: new Date(query.to) }),
                    },
                }
                : {}),
        };
    }
    defaultInclude() {
        return {
            customer: true,
            lead: { include: { assignedTo: true } },
            employee: true,
            service: true,
            branch: true,
            room: true,
            bed: true,
            equipment: true,
            adCampaign: { select: { id: true, name: true } },
        };
    }
};
exports.AppointmentsService = AppointmentsService;
exports.AppointmentsService = AppointmentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        events_gateway_1.EventsGateway,
        audit_service_1.AuditService,
        tenant_ownership_service_1.TenantOwnershipService,
        attribution_hooks_service_1.AttributionHooksService,
        appointment_conflict_service_1.AppointmentConflictService,
        automation_engine_service_1.AutomationEngineService,
        pipeline_service_1.PipelineService])
], AppointmentsService);
