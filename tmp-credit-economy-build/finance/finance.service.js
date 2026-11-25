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
exports.FinanceService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const tenant_ownership_service_1 = require("../common/services/tenant-ownership.service");
const attribution_hooks_service_1 = require("../attribution/attribution-hooks.service");
const audit_service_1 = require("../audit/audit.service");
const pipeline_service_1 = require("../crm/pipeline.service");
const events_gateway_1 = require("../events/events.gateway");
const tenant_kpi_cache_service_1 = require("../common/services/tenant-kpi-cache.service");
const pagination_util_1 = require("../common/utils/pagination.util");
const date_range_util_1 = require("../common/utils/date-range.util");
const status_transitions_util_1 = require("../common/utils/status-transitions.util");
let FinanceService = class FinanceService {
    prisma;
    tenant;
    attributionHooks;
    audit;
    pipeline;
    events;
    kpiCache;
    constructor(prisma, tenant, attributionHooks, audit, pipeline, events, kpiCache) {
        this.prisma = prisma;
        this.tenant = tenant;
        this.attributionHooks = attributionHooks;
        this.audit = audit;
        this.pipeline = pipeline;
        this.events = events;
        this.kpiCache = kpiCache;
    }
    async listOrders(organizationId, query) {
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        const where = this.dateFilter(organizationId, query, 'orderedAt');
        if (query.orderStatus)
            where.status = query.orderStatus;
        if (query.customerId)
            where.customerId = query.customerId;
        const [items, total] = await Promise.all([
            this.prisma.order.findMany({
                where,
                skip,
                take,
                orderBy: { orderedAt: 'desc' },
                include: {
                    customer: {
                        include: {
                            leads: {
                                take: 1,
                                orderBy: { createdAt: 'desc' },
                                include: { assignedTo: true },
                            },
                        },
                    },
                    items: { include: { service: true } },
                    payments: true,
                },
            }),
            this.prisma.order.count({ where }),
        ]);
        return (0, pagination_util_1.buildPaginatedResult)(items, total, page, pageSize);
    }
    async createOrder(organizationId, dto, userId) {
        await this.tenant.validateBranchBoundRelations(organizationId, {
            branchId: dto.branchId,
            customerId: dto.customerId,
        });
        if (dto.leadId) {
            await this.tenant.assertLead(organizationId, dto.leadId, dto.branchId);
        }
        for (const item of dto.items) {
            await this.tenant.assertService(organizationId, item.serviceId);
        }
        const subtotal = dto.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
        const discount = dto.discount ?? 0;
        const total = subtotal - discount;
        const count = await this.prisma.order.count({ where: { organizationId } });
        const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}-${String(count + 1).padStart(4, '0')}`;
        const order = await this.prisma.order.create({
            data: {
                organizationId,
                customerId: dto.customerId,
                branchId: dto.branchId,
                leadId: dto.leadId,
                orderNumber,
                subtotal: new database_1.Prisma.Decimal(subtotal),
                discount: new database_1.Prisma.Decimal(discount),
                total: new database_1.Prisma.Decimal(total),
                note: dto.note,
                items: {
                    create: dto.items.map((i) => ({
                        serviceId: i.serviceId,
                        name: i.name,
                        quantity: i.quantity,
                        unitPrice: new database_1.Prisma.Decimal(i.unitPrice),
                        totalPrice: new database_1.Prisma.Decimal(i.unitPrice * i.quantity),
                    })),
                },
            },
            include: { items: true, customer: true },
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'ORDER_CREATED',
            entityType: 'ORDER',
            entityId: order.id,
            metadata: { leadId: dto.leadId, total, orderNumber },
        });
        return order;
    }
    async listPayments(organizationId, query) {
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        const where = {
            organizationId,
            ...(query.paymentStatus && { status: query.paymentStatus }),
            ...(query.from || query.to
                ? {
                    paidAt: {
                        ...(query.from && { gte: new Date(query.from) }),
                        ...(query.to && { lte: new Date(query.to) }),
                    },
                }
                : {}),
        };
        const [items, total] = await Promise.all([
            this.prisma.payment.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    order: {
                        include: {
                            customer: true,
                            items: true,
                        },
                    },
                },
            }),
            this.prisma.payment.count({ where }),
        ]);
        return (0, pagination_util_1.buildPaginatedResult)(items, total, page, pageSize);
    }
    async createPayment(organizationId, dto, userId) {
        const order = await this.prisma.order.findFirst({
            where: { id: dto.orderId, organizationId },
            include: {
                items: true,
                payments: true,
                customer: true,
            },
        });
        if (!order)
            throw new common_1.NotFoundException('Đơn hàng không tồn tại');
        if (order.status === database_1.OrderStatus.CANCELLED || order.status === database_1.OrderStatus.REFUNDED) {
            throw new common_1.BadRequestException('Đơn hàng đã hủy/hoàn — không thể thanh toán');
        }
        const idemKey = dto.idempotencyKey?.trim() || dto.reference?.trim() || null;
        if (idemKey) {
            const existing = await this.prisma.payment.findFirst({
                where: {
                    organizationId,
                    orderId: dto.orderId,
                    reference: idemKey,
                    status: { in: [database_1.PaymentStatus.COMPLETED, database_1.PaymentStatus.PENDING] },
                },
            });
            if (existing)
                return existing;
        }
        const alreadyPaid = order.payments
            .filter((p) => p.status === database_1.PaymentStatus.COMPLETED)
            .reduce((s, p) => s + Number(p.amount), 0);
        const orderTotal = Number(order.total);
        if (alreadyPaid + 0.001 >= orderTotal) {
            throw new common_1.BadRequestException('Đơn hàng đã thanh toán đủ');
        }
        const payment = await this.prisma.payment.create({
            data: {
                organizationId,
                orderId: dto.orderId,
                amount: new database_1.Prisma.Decimal(dto.amount),
                method: dto.method,
                status: database_1.PaymentStatus.COMPLETED,
                reference: idemKey ?? dto.reference,
                paidAt: new Date(),
            },
        });
        const paidNow = alreadyPaid + Number(dto.amount);
        const nextOrderStatus = (0, status_transitions_util_1.orderStatusFromPaid)(orderTotal, paidNow);
        await this.prisma.order.update({
            where: { id: order.id },
            data: { status: nextOrderStatus },
        });
        if (order.leadId && nextOrderStatus === database_1.OrderStatus.PAID) {
            await this.promoteLeadPurchased(organizationId, order.leadId, userId);
        }
        const priorOrders = await this.prisma.order.count({
            where: {
                organizationId,
                customerId: order.customerId,
                id: { not: order.id },
                payments: { some: { status: database_1.PaymentStatus.COMPLETED } },
            },
        });
        await this.attributionHooks.onPayment(organizationId, {
            id: payment.id,
            orderId: order.id,
            amount: Number(dto.amount),
            status: database_1.PaymentStatus.COMPLETED,
            leadId: order.leadId,
            customerId: order.customerId,
            branchId: order.branchId,
            serviceIds: order.items.map((i) => i.serviceId).filter(Boolean),
            isReturningCustomer: priorOrders > 0,
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'PAYMENT_CREATED',
            entityType: 'PAYMENT',
            entityId: payment.id,
            metadata: {
                orderId: order.id,
                amount: dto.amount,
                reference: payment.reference,
                orderStatus: nextOrderStatus,
            },
        });
        await this.kpiCache?.bump(organizationId);
        return payment;
    }
    async refundPayment(organizationId, paymentId, userId) {
        const payment = await this.prisma.payment.findFirst({
            where: { id: paymentId, organizationId },
            include: { order: true },
        });
        if (!payment)
            throw new common_1.NotFoundException('Thanh toán không tồn tại');
        (0, status_transitions_util_1.assertPaymentRefundable)(payment.status);
        const updated = await this.prisma.payment.update({
            where: { id: paymentId },
            data: { status: database_1.PaymentStatus.REFUNDED },
        });
        const completed = await this.prisma.payment.findMany({
            where: {
                organizationId,
                orderId: payment.orderId,
                status: database_1.PaymentStatus.COMPLETED,
            },
        });
        const paid = completed.reduce((s, p) => s + Number(p.amount), 0);
        const orderTotal = Number(payment.order.total);
        const nextStatus = paid <= 0 ? database_1.OrderStatus.REFUNDED : (0, status_transitions_util_1.orderStatusFromPaid)(orderTotal, paid);
        await this.prisma.order.update({
            where: { id: payment.orderId },
            data: { status: nextStatus },
        });
        await this.attributionHooks.onPayment(organizationId, {
            id: updated.id,
            orderId: payment.orderId,
            amount: Number(payment.amount),
            status: database_1.PaymentStatus.REFUNDED,
            leadId: payment.order.leadId,
            customerId: payment.order.customerId,
            branchId: payment.order.branchId,
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'PAYMENT_REFUNDED',
            entityType: 'PAYMENT',
            entityId: paymentId,
            metadata: { orderId: payment.orderId, amount: Number(payment.amount), orderStatus: nextStatus },
        });
        await this.kpiCache?.bump(organizationId);
        return updated;
    }
    async cancelOrder(organizationId, orderId, userId) {
        const order = await this.prisma.order.findFirst({
            where: { id: orderId, organizationId },
            include: { payments: true },
        });
        if (!order)
            throw new common_1.NotFoundException('Đơn hàng không tồn tại');
        if (order.status === database_1.OrderStatus.CANCELLED)
            return order;
        const hasCompleted = order.payments.some((p) => p.status === database_1.PaymentStatus.COMPLETED);
        if (hasCompleted) {
            throw new common_1.BadRequestException('Đơn đã thanh toán — hãy hoàn tiền trước khi hủy');
        }
        const updated = await this.prisma.order.update({
            where: { id: orderId },
            data: { status: database_1.OrderStatus.CANCELLED },
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'ORDER_CANCELLED',
            entityType: 'ORDER',
            entityId: orderId,
            metadata: { previousStatus: order.status },
        });
        return updated;
    }
    async promoteLeadPurchased(organizationId, leadId, userId) {
        const lead = await this.prisma.lead.findFirst({
            where: { id: leadId, organizationId },
        });
        if (!lead || lead.pipelineStatus === database_1.LeadPipelineStatus.PURCHASED)
            return;
        const stage = await this.pipeline.resolveStageForStatus(organizationId, database_1.LeadPipelineStatus.PURCHASED);
        const previousStatus = lead.pipelineStatus;
        await this.prisma.lead.update({
            where: { id: leadId },
            data: {
                pipelineStatus: database_1.LeadPipelineStatus.PURCHASED,
                stageId: stage?.id,
                convertedAt: new Date(),
            },
        });
        await this.prisma.leadActivity.create({
            data: {
                organizationId,
                leadId,
                actorUserId: userId,
                action: 'STATUS_CHANGED',
                fromValue: previousStatus,
                toValue: database_1.LeadPipelineStatus.PURCHASED,
                metadata: { source: 'payment' },
            },
        });
        await this.attributionHooks.onLeadQualified(organizationId, leadId);
        this.events.broadcastLeadStatusChanged(organizationId, {
            leadId,
            name: lead.name,
            previousStatus,
            pipelineStatus: database_1.LeadPipelineStatus.PURCHASED,
        });
    }
    async listExpenses(organizationId, query) {
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        const where = this.dateFilter(organizationId, query, 'expenseDate');
        if (query.expenseCategory)
            where.category = query.expenseCategory;
        const [items, total] = await Promise.all([
            this.prisma.expense.findMany({
                where,
                skip,
                take,
                orderBy: { expenseDate: 'desc' },
                include: { adCampaign: true, branch: true },
            }),
            this.prisma.expense.count({ where }),
        ]);
        return (0, pagination_util_1.buildPaginatedResult)(items, total, page, pageSize);
    }
    async createExpense(organizationId, dto) {
        await this.tenant.validateBranchBoundRelations(organizationId, {
            branchId: dto.branchId,
            adCampaignId: dto.adCampaignId,
        });
        const row = await this.prisma.expense.create({
            data: {
                organizationId,
                category: dto.category,
                description: dto.description,
                amount: new database_1.Prisma.Decimal(dto.amount),
                expenseDate: new Date(dto.expenseDate),
                branchId: dto.branchId,
                adCampaignId: dto.adCampaignId,
                note: dto.note,
            },
            include: { adCampaign: true, branch: true },
        });
        await this.kpiCache?.bump(organizationId);
        return row;
    }
    async updateExpense(organizationId, id, dto) {
        await this.ensureExpense(organizationId, id);
        const row = await this.prisma.expense.update({
            where: { id },
            data: {
                ...dto,
                amount: dto.amount != null ? new database_1.Prisma.Decimal(dto.amount) : undefined,
                expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : undefined,
            },
            include: { adCampaign: true, branch: true },
        });
        await this.kpiCache?.bump(organizationId);
        return row;
    }
    async removeExpense(organizationId, id) {
        await this.ensureExpense(organizationId, id);
        const row = await this.prisma.expense.delete({ where: { id } });
        await this.kpiCache?.bump(organizationId);
        return row;
    }
    async getDashboard(organizationId, query) {
        const { from, to } = this.resolveDashboardRange(query);
        const branchFilter = query.branchId ? { branchId: query.branchId } : {};
        const cacheName = `fin:${from.toISOString()}:${to.toISOString()}:${query.branchId || 'all'}`;
        const cached = await this.kpiCache?.getJson(organizationId, cacheName);
        if (cached)
            return cached;
        const paymentWhere = {
            organizationId,
            status: database_1.PaymentStatus.COMPLETED,
            paidAt: { gte: from, lte: to },
        };
        const expenseWhere = {
            organizationId,
            expenseDate: { gte: from, lte: to },
            ...branchFilter,
        };
        const [payments, expensesByCategory] = await Promise.all([
            this.prisma.payment.aggregate({
                where: paymentWhere,
                _sum: { amount: true },
                _count: true,
            }),
            this.prisma.expense.groupBy({
                by: ['category'],
                where: expenseWhere,
                _sum: { amount: true },
            }),
        ]);
        const sumCategory = (cats) => expensesByCategory
            .filter((e) => cats.includes(e.category))
            .reduce((s, e) => s + Number(e._sum.amount ?? 0), 0);
        const adSpend = sumCategory([database_1.ExpenseCategory.ADVERTISING]);
        const salarySpend = sumCategory([database_1.ExpenseCategory.SALARY]);
        const materialSpend = sumCategory([database_1.ExpenseCategory.SUPPLIES]);
        const operatingSpend = sumCategory([
            database_1.ExpenseCategory.RENT,
            database_1.ExpenseCategory.UTILITIES,
            database_1.ExpenseCategory.MAINTENANCE,
        ]);
        const otherSpend = sumCategory([database_1.ExpenseCategory.OTHER]);
        const expenseTotal = expensesByCategory.reduce((s, e) => s + Number(e._sum.amount ?? 0), 0);
        const revenue = Number(payments._sum.amount ?? 0);
        const profit = revenue - expenseTotal;
        const payload = {
            from: from.toISOString(),
            to: to.toISOString(),
            revenue,
            adSpend,
            salarySpend,
            materialSpend,
            operatingSpend,
            otherSpend,
            expense: expenseTotal,
            profit,
            paymentCount: payments._count,
            expenseCount: expensesByCategory.reduce((s, e) => s + 1, 0),
            margin: revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : '0',
        };
        await this.kpiCache?.setJson(organizationId, cacheName, payload, 20);
        return payload;
    }
    resolveDashboardRange(query) {
        if (query.from && query.to) {
            const from = new Date(query.from);
            from.setHours(0, 0, 0, 0);
            const to = new Date(query.to);
            to.setHours(23, 59, 59, 999);
            return { from, to };
        }
        return (0, date_range_util_1.resolveDateRange)(query.period ?? 'month', query.date);
    }
    async ensureExpense(organizationId, id) {
        const expense = await this.prisma.expense.findFirst({
            where: { id, organizationId },
        });
        if (!expense)
            throw new common_1.NotFoundException('Chi phí không tồn tại');
        return expense;
    }
    dateFilter(organizationId, query, field) {
        return {
            organizationId,
            ...(query.from || query.to
                ? {
                    [field]: {
                        ...(query.from && { gte: new Date(query.from) }),
                        ...(query.to && { lte: new Date(query.to) }),
                    },
                }
                : {}),
        };
    }
};
exports.FinanceService = FinanceService;
exports.FinanceService = FinanceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        tenant_ownership_service_1.TenantOwnershipService,
        attribution_hooks_service_1.AttributionHooksService,
        audit_service_1.AuditService,
        pipeline_service_1.PipelineService,
        events_gateway_1.EventsGateway,
        tenant_kpi_cache_service_1.TenantKpiCacheService])
], FinanceService);
