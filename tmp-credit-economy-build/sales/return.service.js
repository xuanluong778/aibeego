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
exports.SalesReturnService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const inventory_service_1 = require("./inventory.service");
let SalesReturnService = class SalesReturnService {
    prisma;
    audit;
    inventory;
    constructor(prisma, audit, inventory) {
        this.prisma = prisma;
        this.audit = audit;
        this.inventory = inventory;
    }
    decimal(n) {
        return new database_1.Prisma.Decimal(Number(n) || 0);
    }
    async nextCode(organizationId) {
        const day = new Date();
        const y = day.getFullYear();
        const m = String(day.getMonth() + 1).padStart(2, '0');
        const d = String(day.getDate()).padStart(2, '0');
        const prefix = `RT-${y}${m}${d}-`;
        const count = await this.prisma.salesReturn.count({
            where: { organizationId, code: { startsWith: prefix } },
        });
        return `${prefix}${String(count + 1).padStart(4, '0')}`;
    }
    async list(organizationId, orderId) {
        return this.prisma.salesReturn.findMany({
            where: {
                organizationId,
                ...(orderId ? { orderId } : {}),
            },
            include: { items: true },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
    }
    async get(organizationId, id) {
        const row = await this.prisma.salesReturn.findFirst({
            where: { id, organizationId },
            include: {
                items: true,
                order: { select: { id: true, code: true, status: true, exportedAt: true } },
            },
        });
        if (!row)
            throw new common_1.NotFoundException('Không tìm thấy phiếu trả');
        return {
            ...row,
            refundAmount: Number(row.refundAmount),
            items: row.items.map((i) => ({ ...i, refundAmount: Number(i.refundAmount) })),
        };
    }
    /**
     * Tạo + xác nhận phiếu trả (một phần/toàn phần) trong 1 transaction.
     * Stock: RETURN_IN idempotent theo SALES_RETURN + returnId::productId.
     */
    async createAndConfirm(organizationId, dto, userId) {
        if (!dto.items?.length)
            throw new common_1.BadRequestException('Thiếu dòng trả hàng');
        return this.prisma.$transaction(async (tx) => {
            const locked = await tx.$queryRaw `
          SELECT id, code, status, exported_at
          FROM sales_orders
          WHERE id = ${dto.orderId} AND organization_id = ${organizationId}
          FOR UPDATE
        `;
            if (!locked.length)
                throw new common_1.NotFoundException('Không tìm thấy đơn hàng');
            const order = locked[0];
            if (!order.exported_at) {
                throw new common_1.BadRequestException('Đơn chưa xuất kho — không trả hàng kho');
            }
            if (order.status === database_1.SalesOrderStatus.CANCELLED ||
                order.status === database_1.SalesOrderStatus.RETURNED) {
                throw new common_1.BadRequestException('Đơn đã hủy/trả hết — không trả thêm');
            }
            const code = await this.nextCode(organizationId);
            const orderItems = await tx.salesOrderItem.findMany({
                where: { orderId: dto.orderId },
            });
            const byId = new Map(orderItems.map((i) => [i.id, i]));
            const lines = [];
            for (const it of dto.items) {
                const oi = byId.get(it.orderItemId);
                if (!oi)
                    throw new common_1.BadRequestException(`Dòng đơn không hợp lệ: ${it.orderItemId}`);
                const qty = Math.trunc(Number(it.quantity) || 0);
                if (qty <= 0)
                    throw new common_1.BadRequestException('Số lượng trả phải > 0');
                const remain = oi.quantity - oi.returnedQty;
                if (qty > remain) {
                    throw new common_1.BadRequestException(`Trả vượt số còn lại của dòng ${oi.productName} (còn ${remain})`);
                }
                lines.push({
                    orderItemId: oi.id,
                    productId: oi.productId,
                    quantity: qty,
                    refundAmount: Math.max(0, Number(it.refundAmount) || 0),
                    reason: it.reason,
                });
            }
            const refundAmount = dto.refundAmount !== undefined
                ? Math.max(0, Number(dto.refundAmount) || 0)
                : lines.reduce((s, l) => s + l.refundAmount, 0);
            const ret = await tx.salesReturn.create({
                data: {
                    organizationId,
                    orderId: dto.orderId,
                    code,
                    status: database_1.SalesReturnDocStatus.CONFIRMED,
                    reason: dto.reason?.trim() || null,
                    note: dto.note?.trim() || null,
                    refundAmount: this.decimal(refundAmount),
                    processedById: userId ?? null,
                    confirmedAt: new Date(),
                    items: {
                        create: lines.map((l) => ({
                            orderItemId: l.orderItemId,
                            productId: l.productId,
                            quantity: l.quantity,
                            refundAmount: this.decimal(l.refundAmount),
                            reason: l.reason?.trim() || null,
                        })),
                    },
                },
                include: { items: true },
            });
            for (const l of lines) {
                if (!l.productId)
                    continue;
                await this.inventory.returnPartialForSalesOrder(tx, {
                    organizationId,
                    orderId: dto.orderId,
                    productId: l.productId,
                    quantity: l.quantity,
                    performedById: userId,
                    reason: dto.reason || `Trả hàng ${code}`,
                    referenceType: 'SALES_RETURN',
                    referenceId: `${ret.id}::${l.productId}`,
                });
                await tx.salesOrderItem.update({
                    where: { id: l.orderItemId },
                    data: { returnedQty: { increment: l.quantity } },
                });
            }
            const refreshed = await tx.salesOrderItem.findMany({ where: { orderId: dto.orderId } });
            const allReturned = refreshed.every((i) => i.returnedQty >= i.quantity);
            const anyReturned = refreshed.some((i) => i.returnedQty > 0);
            let nextStatus = order.status;
            if (allReturned)
                nextStatus = database_1.SalesOrderStatus.RETURNED;
            else if (anyReturned)
                nextStatus = database_1.SalesOrderStatus.PARTIALLY_RETURNED;
            await tx.salesOrder.update({
                where: { id: dto.orderId },
                data: {
                    status: nextStatus,
                    ...(allReturned ? { returnedAt: new Date() } : {}),
                },
            });
            await this.audit.log({
                organizationId,
                userId,
                action: 'SALES_RETURN_CONFIRMED',
                entityType: 'SALES_RETURN',
                entityId: ret.id,
                metadata: {
                    code,
                    orderId: dto.orderId,
                    refundAmount,
                    lines: lines.map((l) => ({
                        orderItemId: l.orderItemId,
                        productId: l.productId,
                        quantity: l.quantity,
                    })),
                    nextStatus,
                },
            }, tx);
            return {
                ...ret,
                refundAmount: Number(ret.refundAmount),
                items: ret.items.map((i) => ({ ...i, refundAmount: Number(i.refundAmount) })),
                orderStatus: nextStatus,
            };
        }, { timeout: 30_000 });
    }
};
exports.SalesReturnService = SalesReturnService;
exports.SalesReturnService = SalesReturnService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        inventory_service_1.InventoryService])
], SalesReturnService);
