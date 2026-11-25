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
exports.AutomationService = void 0;
const database_1 = require("@marketingspa/database");
const common_1 = require("@nestjs/common");
const database_2 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const tenant_ownership_service_1 = require("../common/services/tenant-ownership.service");
const messaging_eligibility_service_1 = require("../messaging/messaging-eligibility.service");
const token_security_util_1 = require("../common/utils/token-security.util");
const pagination_util_1 = require("../common/utils/pagination.util");
const template_renderer_util_1 = require("./template-renderer.util");
const shared_1 = require("@marketingspa/shared");
let AutomationService = class AutomationService {
    prisma;
    audit;
    tenant;
    eligibility;
    constructor(prisma, audit, tenant, eligibility) {
        this.prisma = prisma;
        this.audit = audit;
        this.tenant = tenant;
        this.eligibility = eligibility;
    }
    getVariableCatalog() {
        return template_renderer_util_1.TEMPLATE_VARIABLES;
    }
    async listTemplates(organizationId, query) {
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        const where = { organizationId };
        if (query.channel) {
            where.channel = query.channel;
        }
        const [items, total] = await Promise.all([
            this.prisma.messageTemplate.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
            this.prisma.messageTemplate.count({ where }),
        ]);
        return (0, pagination_util_1.buildPaginatedResult)(items, total, page, pageSize);
    }
    async createTemplate(organizationId, dto, userId) {
        const variables = dto.variables ?? (0, template_renderer_util_1.extractTemplateVariables)(dto.body);
        const template = await this.prisma.messageTemplate.create({
            data: {
                organizationId,
                name: dto.name,
                channel: dto.channel,
                subject: dto.subject,
                body: dto.body,
                variables,
                isActive: dto.isActive ?? true,
                campaignKind: dto.campaignKind,
                providerMode: dto.providerMode,
                providerTemplateId: dto.providerTemplateId,
                approvalStatus: dto.approvalStatus ?? database_2.MessageTemplateApprovalStatus.DRAFT,
                mediaUrl: dto.mediaUrl,
                ctaLabel: dto.ctaLabel,
                ctaUrl: dto.ctaUrl,
                variableFallbacks: (dto.variableFallbacks ?? {}),
                contentBlocks: (dto.contentBlocks ?? []),
            },
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'AUTOMATION_TEMPLATE_CREATED',
            entityType: 'MESSAGE_TEMPLATE',
            entityId: template.id,
            metadata: (0, token_security_util_1.redactForAudit)({ name: dto.name, channel: dto.channel }),
        });
        return template;
    }
    async updateTemplate(organizationId, id, dto, userId) {
        await this.ensureTemplate(organizationId, id);
        const { variables, body, variableFallbacks, contentBlocks, ...rest } = dto;
        const template = await this.prisma.messageTemplate.update({
            where: { id },
            data: {
                ...rest,
                ...(body !== undefined && { body }),
                ...(variables !== undefined
                    ? { variables }
                    : body !== undefined
                        ? { variables: (0, template_renderer_util_1.extractTemplateVariables)(body) }
                        : {}),
                ...(variableFallbacks !== undefined && {
                    variableFallbacks: variableFallbacks,
                }),
                ...(contentBlocks !== undefined && {
                    contentBlocks: contentBlocks,
                }),
            },
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'AUTOMATION_TEMPLATE_UPDATED',
            entityType: 'MESSAGE_TEMPLATE',
            entityId: id,
            metadata: (0, token_security_util_1.redactForAudit)(dto),
        });
        return template;
    }
    async previewTemplate(organizationId, id, dto) {
        const template = await this.ensureTemplate(organizationId, id);
        return (0, shared_1.previewTemplateContent)({
            body: template.body,
            context: dto.context ?? {},
            fallbacks: (template.variableFallbacks ?? {}),
            mediaUrl: template.mediaUrl,
            ctaLabel: template.ctaLabel,
            ctaUrl: template.ctaUrl,
        });
    }
    async deleteTemplate(organizationId, id, userId) {
        await this.ensureTemplate(organizationId, id);
        const template = await this.prisma.messageTemplate.update({
            where: { id },
            data: { isActive: false },
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'AUTOMATION_TEMPLATE_DELETED',
            entityType: 'MESSAGE_TEMPLATE',
            entityId: id,
        });
        return template;
    }
    listFunnels(organizationId) {
        return this.prisma.funnelRecommendation.findMany({
            where: { organizationId },
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
                id: true,
                prompt: true,
                selectedSlug: true,
                completeGeneratedAt: true,
                createdAt: true,
            },
        });
    }
    listFlows(organizationId) {
        return this.prisma.automationFlow.findMany({
            where: { organizationId },
            include: { messageTemplate: true },
            orderBy: { createdAt: 'desc' },
        });
    }
    async createFlow(organizationId, dto, userId, canApprove = false) {
        if (dto.messageTemplateId) {
            await this.ensureTemplate(organizationId, dto.messageTemplateId);
        }
        const isActive = dto.isActive !== undefined ? dto.isActive : canApprove;
        if (isActive && !canApprove) {
            throw new common_1.BadRequestException('Cần quyền automation.campaign.approve để kích hoạt flow');
        }
        const flow = await new database_1.PlanPolicy(this.prisma).resource(organizationId, 'flows', (tx) => tx.automationFlow.count({ where: { organizationId } }), (tx) => tx.automationFlow.create({
            data: {
                organizationId,
                funnelId: dto.funnelId,
                name: dto.name,
                triggerType: dto.triggerType,
                messageTemplateId: dto.messageTemplateId,
                channel: dto.channel,
                delayMinutes: dto.delayMinutes ?? 0,
                triggerConfig: (dto.triggerConfig ?? {}),
                actions: (dto.actions ?? []),
                isActive,
                isPaused: dto.isPaused ?? false,
                quietHoursStart: dto.quietHoursStart,
                quietHoursEnd: dto.quietHoursEnd,
                maxSendsPerDay: dto.maxSendsPerDay,
                cooldownMinutes: dto.cooldownMinutes ?? 0,
            },
            include: { messageTemplate: true },
        }));
        await this.audit.log({
            organizationId,
            userId,
            action: 'AUTOMATION_FLOW_CREATED',
            entityType: 'AUTOMATION_FLOW',
            entityId: flow.id,
            metadata: (0, token_security_util_1.redactForAudit)({
                name: dto.name,
                triggerType: dto.triggerType,
            }),
        });
        return flow;
    }
    async updateFlow(organizationId, id, dto, userId, canApprove = false) {
        const existing = await this.ensureFlow(organizationId, id);
        if (dto.messageTemplateId) {
            await this.ensureTemplate(organizationId, dto.messageTemplateId);
        }
        if (dto.isActive === true && !canApprove) {
            throw new common_1.BadRequestException('Dùng endpoint approve để kích hoạt flow');
        }
        if (dto.isActive === false && existing.isActive) {
            // allowed — deactivate without approve
        }
        const { triggerConfig, actions, ...rest } = dto;
        const flow = await this.prisma.automationFlow.update({
            where: { id },
            data: {
                ...rest,
                ...(triggerConfig !== undefined && {
                    triggerConfig: triggerConfig,
                }),
                ...(actions !== undefined && { actions: actions }),
            },
            include: { messageTemplate: true },
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'AUTOMATION_FLOW_UPDATED',
            entityType: 'AUTOMATION_FLOW',
            entityId: id,
            metadata: (0, token_security_util_1.redactForAudit)(dto),
        });
        return flow;
    }
    async approveFlow(organizationId, id, userId) {
        await this.ensureFlow(organizationId, id);
        const flow = await this.prisma.automationFlow.update({
            where: { id },
            data: { isActive: true },
            include: { messageTemplate: true },
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'AUTOMATION_FLOW_APPROVED',
            entityType: 'AUTOMATION_FLOW',
            entityId: id,
        });
        return flow;
    }
    async pauseFlow(organizationId, id, isPaused, userId) {
        await this.ensureFlow(organizationId, id);
        const flow = await this.prisma.automationFlow.update({
            where: { id },
            data: { isPaused },
            include: { messageTemplate: true },
        });
        await this.audit.log({
            organizationId,
            userId,
            action: isPaused ? 'AUTOMATION_FLOW_PAUSED' : 'AUTOMATION_FLOW_RESUMED',
            entityType: 'AUTOMATION_FLOW',
            entityId: id,
        });
        return flow;
    }
    async deleteFlow(organizationId, id, userId) {
        await this.ensureFlow(organizationId, id);
        const flow = await this.prisma.automationFlow.update({
            where: { id },
            data: { isActive: false },
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'AUTOMATION_FLOW_CANCELLED',
            entityType: 'AUTOMATION_FLOW',
            entityId: id,
        });
        return flow;
    }
    /** Placeholder: giả lập gửi tin — render template + ghi AutomationLog */
    async simulate(organizationId, flowId, dto, userId) {
        const flow = await this.ensureFlow(organizationId, flowId);
        if (!flow.isActive) {
            throw new common_1.BadRequestException('Flow chưa được duyệt/kích hoạt');
        }
        const template = flow.messageTemplate;
        const channel = flow.channel ?? template?.channel ?? database_2.MessageChannel.ZALO;
        const eligibility = await this.eligibility.check({
            organizationId,
            channel,
            campaignType: 'automation',
            flowId: flow.id,
            leadId: dto.leadId,
            customerId: dto.customerId,
            templateId: template?.id,
        });
        if (!eligibility.eligible) {
            const skippedLog = await this.prisma.automationLog.create({
                data: {
                    organizationId,
                    automationFlowId: flow.id,
                    customerId: dto.customerId,
                    leadId: dto.leadId,
                    channel,
                    status: database_2.AutomationLogStatus.SKIPPED,
                    executedAt: new Date(),
                    result: {
                        eligibility: JSON.parse(JSON.stringify(eligibility)),
                        simulated: true,
                    },
                },
            });
            return {
                message: eligibility.reasonMessage ?? 'Không đủ điều kiện gửi',
                eligibility,
                log: skippedLog,
            };
        }
        let context = { ...(dto.context ?? {}) };
        if (dto.customerId) {
            await this.tenant.assertCustomer(organizationId, dto.customerId);
            const customer = await this.prisma.customer.findFirst({
                where: { id: dto.customerId, organizationId },
                include: { branch: true },
            });
            if (customer) {
                context = {
                    ...context,
                    customer_name: customer.name,
                    branch_name: customer.branch?.name ?? context.branch_name ?? '',
                };
            }
        }
        if (dto.leadId) {
            await this.tenant.assertLead(organizationId, dto.leadId);
            const lead = await this.prisma.lead.findFirst({
                where: { id: dto.leadId, organizationId },
            });
            if (lead) {
                context = {
                    ...context,
                    customer_name: lead.name,
                };
            }
        }
        const bodyTemplate = template?.body ?? 'Tin nhắn giả lập — chưa gắn template';
        const renderedContent = (0, template_renderer_util_1.renderTemplate)(bodyTemplate, context);
        const log = await this.prisma.automationLog.create({
            data: {
                organizationId,
                automationFlowId: flow.id,
                customerId: dto.customerId,
                leadId: dto.leadId,
                channel,
                renderedContent,
                status: database_2.AutomationLogStatus.SENT,
                executedAt: new Date(),
                result: {
                    simulated: true,
                    channel,
                    delayMinutes: flow.delayMinutes,
                    message: 'Tin nhắn giả lập — chưa gửi thật ở MVP',
                    eligibility: JSON.parse(JSON.stringify(eligibility)),
                },
            },
            include: { customer: true, lead: true, automationFlow: true },
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'AUTOMATION_FLOW_SENT',
            entityType: 'AUTOMATION_FLOW',
            entityId: flow.id,
            metadata: (0, token_security_util_1.redactForAudit)({
                logId: log.id,
                channel,
                customerId: dto.customerId,
                leadId: dto.leadId,
                simulated: true,
            }),
        });
        return { message: 'Automation đã chạy giả lập', log };
    }
    async listLogs(organizationId, query) {
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        const where = {
            organizationId,
            ...(query.channel && { channel: query.channel }),
        };
        const [items, total] = await Promise.all([
            this.prisma.automationLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take,
                include: { automationFlow: true, customer: true, lead: true },
            }),
            this.prisma.automationLog.count({ where }),
        ]);
        return (0, pagination_util_1.buildPaginatedResult)(items, total, page, pageSize);
    }
    async ensureTemplate(organizationId, id) {
        const t = await this.prisma.messageTemplate.findFirst({ where: { id, organizationId } });
        if (!t)
            throw new common_1.NotFoundException('Template không tồn tại');
        return t;
    }
    async ensureFlow(organizationId, id) {
        const f = await this.prisma.automationFlow.findFirst({
            where: { id, organizationId },
            include: { messageTemplate: true },
        });
        if (!f)
            throw new common_1.NotFoundException('Automation flow không tồn tại');
        return f;
    }
};
exports.AutomationService = AutomationService;
exports.AutomationService = AutomationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        tenant_ownership_service_1.TenantOwnershipService,
        messaging_eligibility_service_1.MessagingEligibilityService])
], AutomationService);
