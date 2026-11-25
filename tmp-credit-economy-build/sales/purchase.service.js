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
exports.SalesPurchaseService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const inventory_service_1 = require("./inventory.service");
const pagination_util_1 = require("../common/utils/pagination.util");
let SalesPurchaseService = class SalesPurchaseService {
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
    // ── Suppliers ────────────────────────────────────────────────────────────
    async listSuppliers(organizationId, query) {
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query ?? {});
        const where = { organizationId, isActive: true };
        if (query?.search?.trim()) {
            where.name = { contains: query.search.trim(), mode: 'insensitive' };
        }
        const [items, total] = await Promise.all([
            this.prisma.salesSupplier.findMany({
                where,
                skip,
                take,
                orderBy: { name: 'asc' },
            }),
            this.prisma.salesSupplier.count({ where }),
        ]);
        return (0, pagination_util_1.buildPaginatedResult)(items, total, page, pageSize);
    }
    async createSupplier(organizationId, dto, userId) {
        const name = dto.name.trim();
        if (!name)
            throw new common_1.BadRequestException('Thiếu tên NCC');
        const created = await this.prisma.salesSupplier.create({
            data: {
                organizationId,
                name,
                phone: dto.phone?.trim() || null,
                email: dto.email?.trim() || null,
                address: dto.address?.trim() || null,
                taxCode: dto.taxCode?.trim() || null,
                note: dto.note?.trim() || null,
            },
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'SALES_SUPPLIER_CREATED',
            entityType: 'SALES_SUPPLIER',
            entityId: created.id,
        });
        return created;
    }
    async updateSupplier(organizationId, id, dto) {
        const existing = await this.prisma.salesSupplier.findFirst({
            where: { id, organizationId },
        });
        if (!existing)
            throw new common_1.NotFoundException('Không tìm thấy NCC');
        return this.prisma.salesSupplier.update({
            where: { id },
            data: {
                ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
                ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
                ...(dto.email !== undefined ? { email: dto.email?.trim() || null } : {}),
                ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
                ...(dto.taxCode !== undefined ? { taxCode: dto.taxCode?.trim() || null } : {}),
                ...(dto.note !== undefined ? { note: dto.note?.trim() || null } : {}),
                ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
            },
        });
    }
    // ── Purchase Orders ──────────────────────────────────────────────────────
    async nextPoCode(organizationId) {
        const day = new Date();
        const y = day.getFullYear();
        const m = String(day.getMonth() + 1).padStart(2, '0');
        const d = String(day.getDate()).padStart(2, '0');
        const prefix = `PO-${y}${m}${d}-`;
        const count = await this.prisma.salesPurchaseOrder.count({
            where: { organizationId, code: { startsWith: prefix } },
        });
        return `${prefix}${String(count + 1).padStart(4, '0')}`;
    }
    async listPurchaseOrders(organizationId, query) {
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        const where = { organizationId };
        if (query.status)
            where.status = query.status;
        const [items, total] = await Promise.all([
            this.prisma.salesPurchaseOrder.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    supplier: { select: { id: true, name: true, phone: true } },
                    items: true,
                },
            }),
            this.prisma.salesPurchaseOrder.count({ where }),
        ]);
        return (0, pagination_util_1.buildPaginatedResult)(items.map((po) => this.serializePo(po)), total, page, pageSize);
    }
    async getPurchaseOrder(organizationId, id) {
        const po = await this.prisma.salesPurchaseOrder.findFirst({
            where: { id, organizationId },
            include: {
                supplier: true,
                items: { include: { product: { select: { id: true, name: true, sku: true } } } },
            },
        });
        if (!po)
            throw new common_1.NotFoundException('Không tìm thấy PO');
        return this.serializePo(po);
    }
    async createPurchaseOrder(organizationId, dto, userId) {
        if (!dto.items?.length)
            throw new common_1.BadRequestException('PO cần ít nhất 1 dòng');
        const supplier = await this.prisma.salesSupplier.findFirst({
            where: { id: dto.supplierId, organizationId, isActive: true },
        });
        if (!supplier)
            throw new common_1.BadRequestException('NCC không hợp lệ');
        const productIds = [...new Set(dto.items.map((i) => i.productId))];
        const products = await this.prisma.salesProduct.findMany({
            where: { organizationId, id: { in: productIds } },
        });
        if (products.length !== productIds.length) {
            throw new common_1.BadRequestException('Sản phẩm không thuộc tổ chức');
        }
        const byId = new Map(products.map((p) => [p.id, p]));
        const code = await this.nextPoCode(organizationId);
        const lines = dto.items.map((it) => {
            const qty = Math.max(1, Math.trunc(Number(it.quantity) || 0));
            const unitCost = Math.max(0, Number(it.unitCost) || 0);
            const p = byId.get(it.productId);
            return {
                productId: p.id,
                productName: p.name,
                quantity: qty,
                unitCost,
                lineTotal: qty * unitCost,
            };
        });
        const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
        const po = await this.prisma.$transaction(async (tx) => {
            const created = await tx.salesPurchaseOrder.create({
                data: {
                    organizationId,
                    supplierId: supplier.id,
                    code,
                    status: database_1.SalesPurchaseOrderStatus.ORDERED,
                    expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
                    note: dto.note?.trim() || null,
                    subtotal: this.decimal(subtotal),
                    createdById: userId ?? null,
                    orderedAt: new Date(),
                    items: {
                        create: lines.map((l) => ({
                            productId: l.productId,
                            productName: l.productName,
                            quantity: l.quantity,
                            unitCost: this.decimal(l.unitCost),
                            lineTotal: this.decimal(l.lineTotal),
                        })),
                    },
                },
                include: { supplier: true, items: true },
            });
            await this.audit.log({
                organizationId,
                userId,
                action: 'SALES_PO_CREATED',
                entityType: 'SALES_PURCHASE_ORDER',
                entityId: created.id,
                metadata: { code, subtotal, lineCount: lines.length },
            }, tx);
            return created;
        });
        return this.serializePo(po);
    }
    /**
     * Nhận hàng PO → InventoryService.applyInboundInTx (INBOUND).
     * Idempotent theo receivedQty: không nhận vượt; retry an toàn.
     */
    async receiveGoods(organizationId, poId, dto, userId) {
        if (!dto.items?.length)
            throw new common_1.BadRequestException('Thiếu dòng nhận hàng');
        return this.prisma.$transaction(async (tx) => {
            const locked = await tx.$queryRaw `
          SELECT id, status, code FROM sales_purchase_orders
          WHERE id = ${poId} AND organization_id = ${organizationId}
          FOR UPDATE
        `;
            if (!locked.length)
                throw new common_1.NotFoundException('Không tìm thấy PO');
            const header = locked[0];
            if (header.status === database_1.SalesPurchaseOrderStatus.CANCELLED ||
                header.status === database_1.SalesPurchaseOrderStatus.RECEIVED) {
                // Idempotent: already fully received
                if (header.status === database_1.SalesPurchaseOrderStatus.RECEIVED) {
                    return this.getPurchaseOrder(organizationId, poId);
                }
                throw new common_1.BadRequestException('PO đã hủy');
            }
            const poItems = await tx.salesPurchaseOrderItem.findMany({
                where: { purchaseOrderId: poId },
            });
            const byProduct = new Map(poItems.map((i) => [i.productId, i]));
            for (const recv of dto.items) {
                const line = byProduct.get(recv.productId);
                if (!line)
                    throw new common_1.BadRequestException(`SP không có trên PO: ${recv.productId}`);
                const qty = Math.trunc(Number(recv.quantity) || 0);
                if (qty <= 0)
                    continue;
                const remain = line.quantity - line.receivedQty;
                if (qty > remain) {
                    throw new common_1.BadRequestException(`Nhận vượt PO cho ${line.productName} (còn ${remain})`);
                }
                const batchCode = recv.batchCode?.trim() ||
                    `PO-${header.code}-${line.productId.slice(0, 6).toUpperCase()}`;
                await this.inventory.applyInboundInTx(tx, organizationId, {
                    productId: line.productId,
                    batchCode,
                    quantity: qty,
                    unitCost: Number(line.unitCost),
                    expiryDate: recv.expiryDate,
                    reason: `Nhận hàng PO ${header.code}`,
                    note: dto.note?.trim() || undefined,
                    referenceType: 'PURCHASE_ORDER',
                    referenceId: poId,
                }, userId);
                await tx.salesPurchaseOrderItem.update({
                    where: { id: line.id },
                    data: { receivedQty: { increment: qty } },
                });
            }
            const refreshed = await tx.salesPurchaseOrderItem.findMany({
                where: { purchaseOrderId: poId },
            });
            const allRecv = refreshed.every((i) => i.receivedQty >= i.quantity);
            const anyRecv = refreshed.some((i) => i.receivedQty > 0);
            const status = allRecv
                ? database_1.SalesPurchaseOrderStatus.RECEIVED
                : anyRecv
                    ? database_1.SalesPurchaseOrderStatus.PARTIAL_RECEIVED
                    : database_1.SalesPurchaseOrderStatus.ORDERED;
            await tx.salesPurchaseOrder.update({
                where: { id: poId },
                data: {
                    status,
                    ...(allRecv ? { receivedAt: new Date() } : {}),
                },
            });
            await this.audit.log({
                organizationId,
                userId,
                action: 'SALES_PO_RECEIVED',
                entityType: 'SALES_PURCHASE_ORDER',
                entityId: poId,
                metadata: { code: header.code, status, items: dto.items },
            }, tx);
            return tx.salesPurchaseOrder.findFirstOrThrow({
                where: { id: poId, organizationId },
                include: {
                    supplier: true,
                    items: true,
                },
            }).then((po) => this.serializePo(po));
        }, { timeout: 30_000 });
    }
    serializePo(po) {
        return {
            ...po,
            subtotal: Number(po.subtotal),
            items: po.items?.map((i) => ({
                ...i,
                unitCost: Number(i.unitCost),
                lineTotal: Number(i.lineTotal),
            })),
        };
    }
};
exports.SalesPurchaseService = SalesPurchaseService;
exports.SalesPurchaseService = SalesPurchaseService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        inventory_service_1.InventoryService])
], SalesPurchaseService);
