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
exports.Customer360Service = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
let Customer360Service = class Customer360Service {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async get360(organizationId, customerId) {
        const customer = await this.prisma.customer.findFirst({
            where: { id: customerId, organizationId, isActive: true },
            include: {
                leadSource: true,
                branch: true,
                assignedEmployee: true,
            },
        });
        if (!customer)
            throw new common_1.NotFoundException('Khách hàng không tồn tại');
        const [leads, appointments, orders, noteLogs, activities, tasks] = await Promise.all([
            this.prisma.lead.findMany({
                where: { organizationId, customerId },
                orderBy: { createdAt: 'desc' },
                take: 50,
                include: {
                    leadSource: true,
                    assignedTo: true,
                    attribution: true,
                    stage: true,
                },
            }),
            this.prisma.appointment.findMany({
                where: { organizationId, customerId },
                orderBy: { scheduledAt: 'desc' },
                take: 50,
                include: {
                    employee: true,
                    service: true,
                    branch: true,
                    room: true,
                    bed: true,
                    adCampaign: { select: { id: true, name: true } },
                },
            }),
            this.prisma.order.findMany({
                where: { organizationId, customerId },
                orderBy: { orderedAt: 'desc' },
                take: 50,
                include: { items: true, payments: true },
            }),
            this.prisma.auditLog.findMany({
                where: {
                    organizationId,
                    entityType: 'CUSTOMER',
                    entityId: customerId,
                },
                orderBy: { createdAt: 'desc' },
                take: 50,
                include: { user: { select: { id: true, name: true } } },
            }),
            this.prisma.leadActivity.findMany({
                where: {
                    organizationId,
                    lead: { customerId },
                },
                orderBy: { createdAt: 'desc' },
                take: 100,
            }),
            this.prisma.crmTask.findMany({
                where: { organizationId, customerId, status: 'OPEN' },
                orderBy: { dueAt: 'asc' },
                take: 50,
            }),
        ]);
        const leadIds = leads.map((l) => l.id);
        const conversations = await this.prisma.chatbotConversation.findMany({
            where: {
                organizationId,
                OR: [
                    ...(customer.phone ? [{ visitorPhone: customer.phone }] : []),
                    ...(leadIds.length ? [{ linkedLeadId: { in: leadIds } }] : []),
                ],
            },
            orderBy: { updatedAt: 'desc' },
            take: 30,
            include: { messages: { orderBy: { createdAt: 'asc' }, take: 50 } },
        });
        const totalSpend = orders.reduce((sum, o) => {
            const paid = o.payments
                .filter((p) => p.status === database_1.PaymentStatus.COMPLETED)
                .reduce((s, p) => s + Number(p.amount), 0);
            return sum + paid;
        }, 0);
        const servicesPurchased = orders.flatMap((o) => o.items.map((i) => ({
            orderId: o.id,
            name: i.name,
            quantity: i.quantity,
            totalPrice: Number(i.totalPrice),
            orderedAt: o.orderedAt,
        })));
        const timeline = [
            ...leads.map((l) => ({
                type: 'LEAD',
                at: l.createdAt,
                title: `Lead: ${l.name}`,
                meta: { leadId: l.id, status: l.pipelineStatus },
            })),
            ...appointments.map((a) => ({
                type: 'APPOINTMENT',
                at: a.scheduledAt,
                title: `Lịch hẹn ${a.status}`,
                meta: { appointmentId: a.id, status: a.status },
            })),
            ...orders.map((o) => ({
                type: 'ORDER',
                at: o.orderedAt,
                title: `Đơn ${o.orderNumber}`,
                meta: { orderId: o.id, total: Number(o.total) },
            })),
            ...activities.map((a) => ({
                type: 'ACTIVITY',
                at: a.createdAt,
                title: a.action,
                meta: { from: a.fromValue, to: a.toValue },
            })),
            ...noteLogs.map((n) => ({
                type: 'NOTE',
                at: n.createdAt,
                title: 'Ghi chú',
                meta: { content: n.metadata?.content },
            })),
            ...conversations.map((c) => ({
                type: 'CHAT',
                at: c.updatedAt,
                title: `Hội thoại chatbot (${c.status})`,
                meta: { conversationId: c.id, humanTakeover: c.humanTakeover },
            })),
        ].sort((a, b) => b.at.getTime() - a.at.getTime());
        return {
            customer,
            source: customer.leadSource ?? customer.source,
            conversations,
            appointments,
            servicesPurchased,
            totalSpend,
            assignedEmployee: customer.assignedEmployee,
            leads,
            orders,
            tasks,
            timeline,
        };
    }
    async findDuplicates(organizationId, customerId) {
        const customer = await this.prisma.customer.findFirst({
            where: { id: customerId, organizationId },
        });
        if (!customer)
            throw new common_1.NotFoundException('Khách hàng không tồn tại');
        const or = [];
        if (customer.phone) {
            or.push({ phone: { contains: customer.phone.replace(/\D/g, '').slice(-9) } });
        }
        if (customer.email) {
            or.push({ email: { equals: customer.email, mode: 'insensitive' } });
        }
        if (!or.length)
            return [];
        return this.prisma.customer.findMany({
            where: {
                organizationId,
                isActive: true,
                id: { not: customerId },
                mergedIntoId: null,
                OR: or,
            },
            take: 20,
            include: { branch: true, leadSource: true },
        });
    }
    async mergeCustomers(organizationId, primaryId, secondaryId, userId) {
        if (primaryId === secondaryId) {
            throw new common_1.BadRequestException('Không thể gộp cùng một hồ sơ');
        }
        const [primary, secondary] = await Promise.all([
            this.prisma.customer.findFirst({ where: { id: primaryId, organizationId } }),
            this.prisma.customer.findFirst({
                where: { id: secondaryId, organizationId },
                include: { leads: true, appointments: true, orders: true },
            }),
        ]);
        if (!primary || !secondary)
            throw new common_1.NotFoundException('Hồ sơ không tồn tại');
        const snapshot = {
            secondary,
            primaryBefore: primary,
        };
        await this.prisma.$transaction(async (tx) => {
            await tx.lead.updateMany({
                where: { organizationId, customerId: secondaryId },
                data: { customerId: primaryId },
            });
            await tx.appointment.updateMany({
                where: { organizationId, customerId: secondaryId },
                data: { customerId: primaryId },
            });
            await tx.order.updateMany({
                where: { organizationId, customerId: secondaryId },
                data: { customerId: primaryId },
            });
            await tx.crmTask.updateMany({
                where: { organizationId, customerId: secondaryId },
                data: { customerId: primaryId },
            });
            await tx.automationLog.updateMany({
                where: { organizationId, customerId: secondaryId },
                data: { customerId: primaryId },
            });
            const mergedTags = [...new Set([...(primary.tags ?? []), ...(secondary.tags ?? [])])];
            await tx.customer.update({
                where: { id: primaryId },
                data: {
                    phone: primary.phone || secondary.phone,
                    email: primary.email || secondary.email,
                    note: [primary.note, secondary.note].filter(Boolean).join('\n---\n') || primary.note,
                    tags: mergedTags,
                    assignedEmployeeId: primary.assignedEmployeeId || secondary.assignedEmployeeId,
                    leadSourceId: primary.leadSourceId || secondary.leadSourceId,
                },
            });
            await tx.customer.update({
                where: { id: secondaryId },
                data: { isActive: false, mergedIntoId: primaryId },
            });
            await tx.customerMergeLog.create({
                data: {
                    organizationId,
                    primaryId,
                    secondaryId,
                    mergedByUserId: userId,
                    snapshot: snapshot,
                },
            });
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'CUSTOMER_MERGED',
            entityType: 'CUSTOMER',
            entityId: primaryId,
            metadata: { secondaryId },
        });
        return this.get360(organizationId, primaryId);
    }
};
exports.Customer360Service = Customer360Service;
exports.Customer360Service = Customer360Service = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], Customer360Service);
