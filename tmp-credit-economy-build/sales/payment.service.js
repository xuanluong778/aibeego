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
exports.SalesPaymentService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
let SalesPaymentService = class SalesPaymentService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    decimal(n) {
        return new database_1.Prisma.Decimal(Number(n) || 0);
    }
    deriveStatus(total, netPaid) {
        const t = Math.round(total * 100) / 100;
        const p = Math.round(netPaid * 100) / 100;
        if (p <= 0)
            return database_1.SalesPaymentStatus.UNPAID;
        if (p >= t)
            return database_1.SalesPaymentStatus.PAID;
        return database_1.SalesPaymentStatus.PARTIAL;
    }
    deriveAfterRefund(total, netPaid, hadPayment) {
        const t = Math.round(total * 100) / 100;
        const p = Math.round(netPaid * 100) / 100;
        if (p <= 0) {
            return hadPayment ? database_1.SalesPaymentStatus.REFUNDED : database_1.SalesPaymentStatus.UNPAID;
        }
        if (p >= t)
            return database_1.SalesPaymentStatus.PAID;
        // có refund nhưng vẫn còn tiền đã thu
        return database_1.SalesPaymentStatus.PARTIALLY_REFUNDED;
    }
    async list(organizationId, orderId) {
        const order = await this.prisma.salesOrder.findFirst({
            where: { id: orderId, organizationId },
            select: { id: true },
        });
        if (!order)
            throw new common_1.NotFoundException('Không tìm thấy đơn hàng');
        const items = await this.prisma.salesPayment.findMany({
            where: { organizationId, orderId },
            orderBy: { paidAt: 'asc' },
        });
        return items.map((p) => ({
            ...p,
            amount: Number(p.amount),
        }));
    }
    async addPayment(organizationId, orderId, dto, userId) {
        const amount = Math.round((Number(dto.amount) || 0) * 100) / 100;
        if (amount <= 0)
            throw new common_1.BadRequestException('Số tiền thu phải > 0');
        return this.prisma.$transaction(async (tx) => {
            const locked = await tx.$queryRaw `
        SELECT id, total, amount_paid, payment_status
        FROM sales_orders
        WHERE id = ${orderId} AND organization_id = ${organizationId}
        FOR UPDATE
      `;
            if (!locked.length)
                throw new common_1.NotFoundException('Không tìm thấy đơn hàng');
            const row = locked[0];
            if (dto.idempotencyKey) {
                const existing = await tx.salesPayment.findFirst({
                    where: {
                        organizationId,
                        orderId,
                        kind: database_1.SalesPaymentKind.PAYMENT,
                        transactionRef: dto.idempotencyKey,
                    },
                });
                if (existing) {
                    const order = await tx.salesOrder.findFirstOrThrow({
                        where: { id: orderId, organizationId },
                        include: { payments: true, items: true },
                    });
                    return this.serializeOrderMoney(order);
                }
            }
            const total = Number(row.total);
            const prevPaid = Number(row.amount_paid);
            const nextPaid = Math.round((prevPaid + amount) * 100) / 100;
            if (nextPaid > total + 0.009) {
                throw new common_1.BadRequestException(`Thu vượt tổng đơn (đã thu ${prevPaid}, thu thêm ${amount}, tổng ${total})`);
            }
            const method = dto.method?.trim() || null;
            const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
            const txRef = dto.idempotencyKey?.trim() || dto.transactionRef?.trim() || null;
            await tx.salesPayment.create({
                data: {
                    organizationId,
                    orderId,
                    kind: database_1.SalesPaymentKind.PAYMENT,
                    amount: this.decimal(amount),
                    method,
                    transactionRef: txRef,
                    paidAt,
                    note: dto.note?.trim() || null,
                    performedById: userId ?? null,
                },
            });
            const status = this.deriveStatus(total, nextPaid);
            const updated = await tx.salesOrder.update({
                where: { id: orderId },
                data: {
                    amountPaid: this.decimal(nextPaid),
                    paymentStatus: status,
                    paymentMethod: method ?? undefined,
                    paidAt: status === database_1.SalesPaymentStatus.PAID ? paidAt : row.payment_status === database_1.SalesPaymentStatus.PAID ? undefined : paidAt,
                    transactionRef: txRef ?? undefined,
                },
                include: {
                    payments: { orderBy: { paidAt: 'asc' } },
                    items: true,
                    customer: { select: { id: true, name: true, phone: true } },
                },
            });
            await this.audit.log({
                organizationId,
                userId,
                action: 'SALES_PAYMENT_RECORDED',
                entityType: 'SALES_ORDER',
                entityId: orderId,
                metadata: { amount, nextPaid, status, method, transactionRef: txRef },
            }, tx);
            return this.serializeOrderMoney(updated);
        });
    }
    async addRefund(organizationId, orderId, dto, userId) {
        const amount = Math.round((Number(dto.amount) || 0) * 100) / 100;
        if (amount <= 0)
            throw new common_1.BadRequestException('Số tiền hoàn phải > 0');
        return this.prisma.$transaction(async (tx) => {
            const locked = await tx.$queryRaw `
        SELECT id, total, amount_paid
        FROM sales_orders
        WHERE id = ${orderId} AND organization_id = ${organizationId}
        FOR UPDATE
      `;
            if (!locked.length)
                throw new common_1.NotFoundException('Không tìm thấy đơn hàng');
            const row = locked[0];
            const total = Number(row.total);
            const prevPaid = Number(row.amount_paid);
            if (amount > prevPaid + 0.009) {
                throw new common_1.BadRequestException(`Hoàn vượt số đã thu (${prevPaid})`);
            }
            if (dto.idempotencyKey) {
                const existing = await tx.salesPayment.findFirst({
                    where: {
                        organizationId,
                        orderId,
                        kind: database_1.SalesPaymentKind.REFUND,
                        transactionRef: dto.idempotencyKey,
                    },
                });
                if (existing) {
                    const order = await tx.salesOrder.findFirstOrThrow({
                        where: { id: orderId, organizationId },
                        include: { payments: true, items: true },
                    });
                    return this.serializeOrderMoney(order);
                }
            }
            const nextPaid = Math.round((prevPaid - amount) * 100) / 100;
            const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
            const txRef = dto.idempotencyKey?.trim() || dto.transactionRef?.trim() || null;
            await tx.salesPayment.create({
                data: {
                    organizationId,
                    orderId,
                    kind: database_1.SalesPaymentKind.REFUND,
                    amount: this.decimal(amount),
                    method: dto.method?.trim() || null,
                    transactionRef: txRef,
                    paidAt,
                    note: dto.note?.trim() || null,
                    performedById: userId ?? null,
                },
            });
            const hadPayment = prevPaid > 0;
            const status = this.deriveAfterRefund(total, nextPaid, hadPayment);
            const updated = await tx.salesOrder.update({
                where: { id: orderId },
                data: {
                    amountPaid: this.decimal(nextPaid),
                    paymentStatus: status,
                    paymentMethod: dto.method?.trim() || undefined,
                    transactionRef: txRef ?? undefined,
                },
                include: {
                    payments: { orderBy: { paidAt: 'asc' } },
                    items: true,
                    customer: { select: { id: true, name: true, phone: true } },
                },
            });
            await this.audit.log({
                organizationId,
                userId,
                action: 'SALES_PAYMENT_REFUNDED',
                entityType: 'SALES_ORDER',
                entityId: orderId,
                metadata: { amount, nextPaid, status },
            }, tx);
            return this.serializeOrderMoney(updated);
        });
    }
    serializeOrderMoney(order) {
        const total = Number(order.total);
        const amountPaid = Number(order.amountPaid);
        return {
            ...order,
            subtotal: Number(order.subtotal),
            discount: Number(order.discount),
            shippingFee: Number(order.shippingFee),
            total,
            amountPaid,
            amountDue: Math.max(0, Math.round((total - amountPaid) * 100) / 100),
            payments: order.payments?.map((p) => ({ ...p, amount: Number(p.amount) })),
            items: order.items?.map((it) => ({
                ...it,
                unitPrice: Number(it.unitPrice),
                lineDiscount: Number(it.lineDiscount),
                totalPrice: Number(it.totalPrice),
            })),
        };
    }
};
exports.SalesPaymentService = SalesPaymentService;
exports.SalesPaymentService = SalesPaymentService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], SalesPaymentService);
