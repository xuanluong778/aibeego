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
exports.SalesService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const sales_product_source_1 = require("@marketingspa/shared/dist/sales-product-source");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const inventory_service_1 = require("./inventory.service");
const tenant_kpi_cache_service_1 = require("../common/services/tenant-kpi-cache.service");
const pagination_util_1 = require("../common/utils/pagination.util");
const sales_dto_1 = require("./dto/sales.dto");
const ALLOWED_TRANSITIONS = {
    DRAFT: [database_1.SalesOrderStatus.CONFIRMED, database_1.SalesOrderStatus.CANCELLED],
    CONFIRMED: [database_1.SalesOrderStatus.READY, database_1.SalesOrderStatus.CANCELLED],
    READY: [database_1.SalesOrderStatus.SHIPPED, database_1.SalesOrderStatus.CANCELLED],
    SHIPPED: [
        database_1.SalesOrderStatus.COMPLETED,
        database_1.SalesOrderStatus.RETURNED,
        database_1.SalesOrderStatus.PARTIALLY_RETURNED,
        database_1.SalesOrderStatus.CANCELLED,
    ],
    COMPLETED: [database_1.SalesOrderStatus.RETURNED, database_1.SalesOrderStatus.PARTIALLY_RETURNED],
    PARTIALLY_RETURNED: [
        database_1.SalesOrderStatus.RETURNED,
        database_1.SalesOrderStatus.COMPLETED,
        database_1.SalesOrderStatus.CANCELLED,
    ],
    CANCELLED: [],
    RETURNED: [],
};
let SalesService = class SalesService {
    prisma;
    audit;
    inventory;
    kpiCache;
    constructor(prisma, audit, inventory, kpiCache) {
        this.prisma = prisma;
        this.audit = audit;
        this.inventory = inventory;
        this.kpiCache = kpiCache;
    }
    decimal(n) {
        return new database_1.Prisma.Decimal(Number(n) || 0);
    }
    calcLine(item) {
        const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
        const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
        const lineDiscount = Math.max(0, Number(item.lineDiscount) || 0);
        const totalPrice = Math.max(0, qty * unitPrice - lineDiscount);
        return { qty, unitPrice, lineDiscount, totalPrice };
    }
    calcTotals(items, discount = 0, shippingFee = 0) {
        const lines = items.map((it) => this.calcLine(it));
        const subtotal = lines.reduce((s, l) => s + l.totalPrice, 0);
        const disc = Math.max(0, Number(discount) || 0);
        const ship = Math.max(0, Number(shippingFee) || 0);
        const total = Math.max(0, subtotal - disc + ship);
        return { lines, subtotal, discount: disc, shippingFee: ship, total };
    }
    async nextOrderCode(organizationId) {
        const day = new Date();
        const y = day.getFullYear();
        const m = String(day.getMonth() + 1).padStart(2, '0');
        const d = String(day.getDate()).padStart(2, '0');
        const prefix = `SO-${y}${m}${d}-`;
        const count = await this.prisma.salesOrder.count({
            where: { organizationId, code: { startsWith: prefix } },
        });
        return `${prefix}${String(count + 1).padStart(4, '0')}`;
    }
    async assertCustomer(organizationId, customerId) {
        const customer = await this.prisma.customer.findFirst({
            where: { id: customerId, organizationId, isActive: true },
            select: { id: true, name: true, phone: true, note: true },
        });
        if (!customer)
            throw new common_1.BadRequestException('Khách hàng không tồn tại');
        return customer;
    }
    /** Mọi productId trên đơn phải thuộc cùng organizationId */
    async assertProductsInOrg(organizationId, items) {
        const ids = [...new Set(items.map((i) => i.productId).filter(Boolean))];
        if (!ids.length)
            return;
        const found = await this.prisma.salesProduct.findMany({
            where: { organizationId, id: { in: ids } },
            select: { id: true },
        });
        if (found.length !== ids.length) {
            throw new common_1.BadRequestException('Sản phẩm không thuộc tổ chức hoặc không tồn tại');
        }
    }
    async assertCategoryInOrg(organizationId, categoryId, db = this.prisma) {
        if (!categoryId)
            return;
        const cat = await db.salesProductCategory.findFirst({
            where: { id: categoryId, organizationId },
            select: { id: true },
        });
        if (!cat)
            throw new common_1.BadRequestException({ message: ['categoryId: Danh mục không thuộc tổ chức.'] });
    }
    serializeOrder(order) {
        const total = Number(order.total);
        const amountPaid = Number(order.amountPaid ?? 0);
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
    async listOrders(organizationId, query) {
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        const cacheName = `list:sorders:${page}:${pageSize}:${JSON.stringify({
            st: query.status,
            c: query.customerId,
            s: query.search,
            f: query.from,
            t: query.to,
        })}`;
        const cached = await this.kpiCache?.getJson(organizationId, cacheName);
        if (cached)
            return cached;
        const where = { organizationId };
        if (query.status)
            where.status = query.status;
        if (query.customerId)
            where.customerId = query.customerId;
        if (query.search?.trim()) {
            const q = query.search.trim();
            where.OR = [
                { code: { contains: q, mode: 'insensitive' } },
                { customerName: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q, mode: 'insensitive' } },
            ];
        }
        if (query.from || query.to) {
            where.createdAt = {};
            if (query.from)
                where.createdAt.gte = new Date(query.from);
            if (query.to) {
                const to = new Date(query.to);
                to.setHours(23, 59, 59, 999);
                where.createdAt.lte = to;
            }
        }
        const [items, total] = await Promise.all([
            this.prisma.salesOrder.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    customer: { select: { id: true, name: true, phone: true } },
                    items: true,
                },
            }),
            this.prisma.salesOrder.count({ where }),
        ]);
        const payload = (0, pagination_util_1.buildPaginatedResult)(items.map((o) => this.serializeOrder(o)), total, page, pageSize);
        await this.kpiCache?.setJson(organizationId, cacheName, payload, 8);
        return payload;
    }
    async getOrder(organizationId, id) {
        const order = await this.prisma.salesOrder.findFirst({
            where: { id, organizationId },
            include: {
                customer: { select: { id: true, name: true, phone: true, email: true } },
                items: { include: { product: { select: { id: true, name: true, sku: true } } } },
                payments: { orderBy: { paidAt: 'asc' } },
                returns: { include: { items: true }, orderBy: { createdAt: 'desc' }, take: 20 },
            },
        });
        if (!order)
            throw new common_1.NotFoundException('Không tìm thấy đơn hàng');
        return this.serializeOrder({
            ...order,
            returns: order.returns.map((r) => ({
                ...r,
                refundAmount: Number(r.refundAmount),
                items: r.items.map((i) => ({ ...i, refundAmount: Number(i.refundAmount) })),
            })),
        });
    }
    async createOrder(organizationId, dto, userId) {
        if (!dto.items?.length)
            throw new common_1.BadRequestException('Đơn hàng cần ít nhất 1 sản phẩm');
        const customer = await this.assertCustomer(organizationId, dto.customerId);
        await this.assertProductsInOrg(organizationId, dto.items);
        const totals = this.calcTotals(dto.items, dto.discount, dto.shippingFee);
        const code = await this.nextOrderCode(organizationId);
        const order = await this.prisma.salesOrder.create({
            data: {
                organizationId,
                branchId: dto.branchId,
                customerId: customer.id,
                code,
                status: database_1.SalesOrderStatus.DRAFT,
                customerName: (dto.customerName || customer.name).trim(),
                phone: dto.phone?.trim() || customer.phone || null,
                address: dto.address?.trim() || null,
                source: dto.source?.trim() || null,
                subtotal: this.decimal(totals.subtotal),
                discount: this.decimal(totals.discount),
                shippingFee: this.decimal(totals.shippingFee),
                total: this.decimal(totals.total),
                note: dto.note?.trim() || null,
                createdById: userId,
                items: {
                    create: dto.items.map((it, i) => {
                        const line = totals.lines[i];
                        return {
                            productId: it.productId || null,
                            productName: it.productName.trim(),
                            sku: it.sku?.trim() || null,
                            quantity: line.qty,
                            unitPrice: this.decimal(line.unitPrice),
                            lineDiscount: this.decimal(line.lineDiscount),
                            totalPrice: this.decimal(line.totalPrice),
                        };
                    }),
                },
            },
            include: {
                customer: { select: { id: true, name: true, phone: true } },
                items: true,
            },
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'SALES_ORDER_CREATED',
            entityType: 'SALES_ORDER',
            entityId: order.id,
            metadata: { code: order.code, total: totals.total },
        });
        await this.kpiCache?.bump(organizationId);
        return this.serializeOrder(order);
    }
    async updateOrder(organizationId, id, dto, userId) {
        const existing = await this.prisma.salesOrder.findFirst({ where: { id, organizationId } });
        if (!existing)
            throw new common_1.NotFoundException('Không tìm thấy đơn hàng');
        if (existing.status !== database_1.SalesOrderStatus.DRAFT &&
            existing.status !== database_1.SalesOrderStatus.CONFIRMED) {
            throw new common_1.BadRequestException('Chỉ sửa được đơn DRAFT hoặc CONFIRMED');
        }
        if (existing.exportedAt) {
            throw new common_1.BadRequestException('Đơn đã xuất kho — không sửa dòng hàng');
        }
        if (dto.items?.length)
            await this.assertProductsInOrg(organizationId, dto.items);
        let customerId = existing.customerId;
        let customerName = existing.customerName;
        if (dto.customerId) {
            const customer = await this.assertCustomer(organizationId, dto.customerId);
            customerId = customer.id;
            customerName = dto.customerName?.trim() || customer.name;
        }
        else if (dto.customerName?.trim()) {
            customerName = dto.customerName.trim();
        }
        const items = dto.items;
        const totals = items?.length
            ? this.calcTotals(items, dto.discount ?? Number(existing.discount), dto.shippingFee ?? Number(existing.shippingFee))
            : null;
        const order = await this.prisma.$transaction(async (tx) => {
            if (items?.length) {
                await tx.salesOrderItem.deleteMany({ where: { orderId: id } });
                await tx.salesOrderItem.createMany({
                    data: items.map((it, i) => {
                        const line = totals.lines[i];
                        return {
                            orderId: id,
                            productId: it.productId || null,
                            productName: it.productName.trim(),
                            sku: it.sku?.trim() || null,
                            quantity: line.qty,
                            unitPrice: this.decimal(line.unitPrice),
                            lineDiscount: this.decimal(line.lineDiscount),
                            totalPrice: this.decimal(line.totalPrice),
                        };
                    }),
                });
            }
            return tx.salesOrder.update({
                where: { id },
                data: {
                    customerId,
                    customerName,
                    phone: dto.phone !== undefined ? dto.phone?.trim() || null : undefined,
                    address: dto.address !== undefined ? dto.address?.trim() || null : undefined,
                    source: dto.source !== undefined ? dto.source?.trim() || null : undefined,
                    note: dto.note !== undefined ? dto.note?.trim() || null : undefined,
                    ...(totals
                        ? {
                            subtotal: this.decimal(totals.subtotal),
                            discount: this.decimal(totals.discount),
                            shippingFee: this.decimal(totals.shippingFee),
                            total: this.decimal(totals.total),
                        }
                        : {
                            ...(dto.discount !== undefined
                                ? { discount: this.decimal(dto.discount) }
                                : {}),
                            ...(dto.shippingFee !== undefined
                                ? { shippingFee: this.decimal(dto.shippingFee) }
                                : {}),
                        }),
                },
                include: {
                    customer: { select: { id: true, name: true, phone: true } },
                    items: true,
                },
            });
        });
        // Recompute total if only discount/shipping changed without items
        if (!totals && (dto.discount !== undefined || dto.shippingFee !== undefined)) {
            const subtotal = Number(order.subtotal);
            const discount = Number(order.discount);
            const shippingFee = Number(order.shippingFee);
            const total = Math.max(0, subtotal - discount + shippingFee);
            const updated = await this.prisma.salesOrder.update({
                where: { id },
                data: { total: this.decimal(total) },
                include: {
                    customer: { select: { id: true, name: true, phone: true } },
                    items: true,
                },
            });
            await this.audit.log({
                organizationId,
                userId,
                action: 'SALES_ORDER_UPDATED',
                entityType: 'SALES_ORDER',
                entityId: id,
            });
            return this.serializeOrder(updated);
        }
        await this.audit.log({
            organizationId,
            userId,
            action: 'SALES_ORDER_UPDATED',
            entityType: 'SALES_ORDER',
            entityId: id,
        });
        return this.serializeOrder(order);
    }
    async updateStatus(organizationId, id, status, userId) {
        const order = await this.prisma.$transaction(async (tx) => {
            const locked = await tx.$queryRaw `
          SELECT id, status, code, exported_at
          FROM sales_orders
          WHERE id = ${id} AND organization_id = ${organizationId}
          FOR UPDATE
        `;
            if (!locked.length)
                throw new common_1.NotFoundException('Không tìm thấy đơn hàng');
            const existing = locked[0];
            const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
            if (!allowed.includes(status)) {
                throw new common_1.BadRequestException(`Không chuyển được từ ${existing.status} sang ${status}`);
            }
            const needsReturn = Boolean(existing.exported_at) &&
                (status === database_1.SalesOrderStatus.CANCELLED || status === database_1.SalesOrderStatus.RETURNED);
            // Không cho đánh SHIPPED qua status nếu chưa xuất kho — dùng nút Xuất hàng
            if (status === database_1.SalesOrderStatus.SHIPPED && !existing.exported_at) {
                throw new common_1.BadRequestException('Chưa xuất kho — dùng nút “Xuất hàng” để trừ tồn FEFO rồi chuyển SHIPPED');
            }
            if (needsReturn) {
                await this.inventory.returnForSalesOrder(tx, {
                    organizationId,
                    orderId: id,
                    performedById: userId,
                    reason: status === database_1.SalesOrderStatus.RETURNED
                        ? `Hoàn hàng đơn ${existing.code}`
                        : `Hoàn hàng khi hủy đơn ${existing.code}`,
                });
                // Đánh dấu returnedQty = quantity cho full return/cancel sau xuất
                const items = await tx.salesOrderItem.findMany({ where: { orderId: id } });
                for (const it of items) {
                    if (it.returnedQty < it.quantity) {
                        await tx.salesOrderItem.update({
                            where: { id: it.id },
                            data: { returnedQty: it.quantity },
                        });
                    }
                }
            }
            const stamp = { status };
            const now = new Date();
            if (status === database_1.SalesOrderStatus.CONFIRMED)
                stamp.confirmedAt = now;
            if (status === database_1.SalesOrderStatus.READY)
                stamp.readyAt = now;
            if (status === database_1.SalesOrderStatus.SHIPPED)
                stamp.shippedAt = now;
            if (status === database_1.SalesOrderStatus.COMPLETED)
                stamp.completedAt = now;
            if (status === database_1.SalesOrderStatus.CANCELLED)
                stamp.cancelledAt = now;
            if (status === database_1.SalesOrderStatus.RETURNED)
                stamp.returnedAt = now;
            const updated = await tx.salesOrder.update({
                where: { id },
                data: stamp,
                include: {
                    customer: { select: { id: true, name: true, phone: true } },
                    items: true,
                },
            });
            await this.audit.log({
                organizationId,
                userId,
                action: status === database_1.SalesOrderStatus.CANCELLED
                    ? 'SALES_ORDER_CANCELLED'
                    : status === database_1.SalesOrderStatus.RETURNED
                        ? 'SALES_ORDER_RETURNED'
                        : 'SALES_ORDER_STATUS',
                entityType: 'SALES_ORDER',
                entityId: id,
                metadata: {
                    from: existing.status,
                    to: status,
                    stockReturned: Boolean(needsReturn),
                },
            }, tx);
            return updated;
        }, { timeout: 20_000 });
        return this.serializeOrder(order);
    }
    /** Xuất hàng: FEFO theo lô, lock đơn + lô, idempotent, rollback nếu lỗi */
    async exportOrder(organizationId, id, userId) {
        const order = await this.prisma.$transaction(async (tx) => {
            const locked = await tx.$queryRaw `
          SELECT id, status, code, exported_at, shipped_at
          FROM sales_orders
          WHERE id = ${id} AND organization_id = ${organizationId}
          FOR UPDATE
        `;
            if (!locked.length)
                throw new common_1.NotFoundException('Không tìm thấy đơn hàng');
            const row = locked[0];
            // Idempotent: cùng đơn không trừ kho 2 lần
            if (row.exported_at) {
                return tx.salesOrder.findFirstOrThrow({
                    where: { id, organizationId },
                    include: {
                        customer: { select: { id: true, name: true, phone: true } },
                        items: true,
                    },
                });
            }
            if (row.status === database_1.SalesOrderStatus.CANCELLED ||
                row.status === database_1.SalesOrderStatus.RETURNED) {
                throw new common_1.BadRequestException('Đơn đã hủy/trả không thể xuất hàng');
            }
            if (row.status !== database_1.SalesOrderStatus.READY &&
                row.status !== database_1.SalesOrderStatus.CONFIRMED &&
                row.status !== database_1.SalesOrderStatus.SHIPPED) {
                throw new common_1.BadRequestException('Chỉ xuất hàng khi đơn CONFIRMED / READY / SHIPPED');
            }
            const items = await tx.salesOrderItem.findMany({ where: { orderId: id } });
            await this.inventory.exportForSalesOrder(tx, {
                organizationId,
                orderId: id,
                orderCode: row.code,
                items: items.map((it) => ({
                    productId: it.productId,
                    productName: it.productName,
                    quantity: it.quantity,
                })),
                performedById: userId,
            });
            const nextStatus = row.status === database_1.SalesOrderStatus.SHIPPED ? row.status : database_1.SalesOrderStatus.SHIPPED;
            const updated = await tx.salesOrder.update({
                where: { id },
                data: {
                    exportedAt: new Date(),
                    exportedById: userId,
                    status: nextStatus,
                    shippedAt: row.shipped_at ?? new Date(),
                },
                include: {
                    customer: { select: { id: true, name: true, phone: true } },
                    items: true,
                },
            });
            await this.audit.log({
                organizationId,
                userId,
                action: 'SALES_ORDER_EXPORTED',
                entityType: 'SALES_ORDER',
                entityId: id,
                metadata: { code: row.code, itemCount: items.length },
            }, tx);
            return updated;
        }, { timeout: 20_000 });
        return this.serializeOrder(order);
    }
    // ── Products ────────────────────────────────────────────────────────────
    async listProducts(organizationId, query) {
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        const cacheName = `list:sprod:v2:${page}:${pageSize}:${JSON.stringify({
            s: query.search,
            a: query.active,
            c: query.categoryId,
        })}`;
        const cached = await this.kpiCache?.getJson(organizationId, cacheName);
        if (cached)
            return cached;
        const where = { organizationId };
        if (query.search?.trim()) {
            const q = query.search.trim();
            where.OR = [
                { name: { contains: q, mode: 'insensitive' } },
                { sku: { contains: q, mode: 'insensitive' } },
                { barcode: { contains: q, mode: 'insensitive' } },
                { model: { contains: q, mode: 'insensitive' } },
            ];
        }
        if (query.active === 'true')
            where.isActive = true;
        if (query.active === 'false')
            where.isActive = false;
        if (query.categoryId)
            where.categoryId = query.categoryId;
        const [items, total] = await Promise.all([
            this.prisma.salesProduct.findMany({
                where,
                skip,
                take,
                orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
                include: {
                    category: { select: { id: true, name: true } },
                    _count: { select: { batches: true } },
                    websiteSources: { select: { externalId: true, syncedAt: true, snapshot: true, connection: { select: { websiteUrl: true } } } },
                },
            }),
            this.prisma.salesProduct.count({ where }),
        ]);
        const stockMap = await this.inventory.stockBreakdownMany(this.prisma, organizationId, items.map((p) => p.id));
        const payload = (0, pagination_util_1.buildPaginatedResult)(items.map((p) => {
            const stock = stockMap.get(p.id) || { physicalQty: 0, sellableQty: 0, expiredQty: 0 };
            return {
                ...p,
                imageUrl: p.websiteSources.flatMap(source => (0, sales_product_source_1.sourceImages)(source.snapshot))[0] || null,
                websitePriceMissing: p.websiteSources.length > 0 && p.websiteSources.every(source => {
                    const snapshot = source.snapshot;
                    return !snapshot.regularPrice && !snapshot.salePrice;
                }),
                websiteSources: p.websiteSources.map(source => {
                    const snapshot = source.snapshot;
                    return { externalId: source.externalId, syncedAt: source.syncedAt, connection: source.connection,
                        snapshot: { url: snapshot.url, stockQuantity: snapshot.stockQuantity, stockStatus: snapshot.stockStatus,
                            stockScope: snapshot.stockScope, fetchedAt: snapshot.fetchedAt,
                            images: Array.isArray(snapshot.images) ? snapshot.images.slice(0, 1) : [],
                            description: String(snapshot.description || '').replace(/<[^>]*>/g, ' ').slice(0, 1000) } };
                }),
                price: Number(p.price),
                costPrice: Number(p.costPrice),
                physicalQty: stock.physicalQty,
                sellableQty: stock.sellableQty,
                expiredQty: stock.expiredQty,
                isLowStock: stock.sellableQty > 0 && stock.sellableQty <= p.minStockQty,
                isOutOfStock: stock.sellableQty <= 0,
            };
        }), total, page, pageSize);
        await this.kpiCache?.setJson(organizationId, cacheName, payload, 8);
        return payload;
    }
    async listCategories(organizationId) {
        return this.prisma.salesProductCategory.findMany({
            where: { organizationId },
            orderBy: { name: 'asc' },
        });
    }
    async getProduct(organizationId, id) {
        const product = await this.prisma.salesProduct.findFirst({ where: { id, organizationId },
            include: { category: { select: { id: true, name: true } }, websiteSources: {
                    select: { externalId: true, syncedAt: true, snapshot: true, connection: { select: { websiteUrl: true } } },
                    orderBy: { syncedAt: 'desc' },
                } },
        });
        if (!product)
            throw new common_1.NotFoundException('Không tìm thấy sản phẩm');
        const stock = await this.inventory.stockBreakdown(this.prisma, organizationId, id);
        const sources = product.websiteSources.map(source => {
            const snapshot = source.snapshot;
            let url = '';
            try {
                const parsed = new URL(String(snapshot.url || ''));
                if (['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password)
                    url = parsed.href;
            }
            catch { /* Missing source URL. */ }
            return { externalId: source.externalId, websiteUrl: source.connection.websiteUrl, syncedAt: source.syncedAt,
                url, images: (0, sales_product_source_1.sourceImages)(snapshot), model: (0, sales_product_source_1.sourceProductModel)(snapshot),
                description: (0, sales_product_source_1.sourceDescriptionMarkdown)(snapshot.description), shortDescription: (0, sales_product_source_1.sourceDescriptionMarkdown)(snapshot.shortDescription),
                attributes: Array.isArray(snapshot.attributes) ? snapshot.attributes.map(a => ({ name: String(a.name || ''), option: String(a.option || '') })) : [],
                stockQuantity: typeof snapshot.stockQuantity === 'number' ? snapshot.stockQuantity : null,
                stockStatus: String(snapshot.stockStatus || ''), stockScope: String(snapshot.stockScope || ''),
                status: String(snapshot.status || ''), regularPrice: String(snapshot.regularPrice || ''), salePrice: String(snapshot.salePrice || ''),
            };
        });
        const { websiteSources, ...base } = product;
        return { ...base, price: Number(product.price), costPrice: Number(product.costPrice),
            physicalQty: stock.physicalQty, sellableQty: stock.sellableQty, expiredQty: stock.expiredQty,
            isOutOfStock: stock.sellableQty <= 0, isLowStock: stock.sellableQty > 0 && stock.sellableQty <= product.minStockQty,
            imageUrl: sources.flatMap(s => s.images)[0] || null, sources,
        };
    }
    async createCategory(organizationId, name, db = this.prisma) {
        const trimmed = name.trim();
        if (!trimmed)
            throw new common_1.BadRequestException('Tên danh mục trống');
        return db.salesProductCategory.upsert({
            where: {
                organizationId_name: { organizationId, name: trimmed },
            },
            create: { organizationId, name: trimmed },
            update: {},
        });
    }
    async createProduct(organizationId, dto, userId, tx) {
        dto = this.validateProduct(sales_dto_1.CreateSalesProductDto, dto);
        const initialStock = dto.stockQty ?? 0;
        await this.assertCategoryInOrg(organizationId, dto.categoryId, tx);
        const write = async (tx) => {
            const created = await tx.salesProduct.create({
                data: {
                    organizationId,
                    name: dto.name.trim(),
                    sku: dto.sku?.trim() || null,
                    model: dto.model?.trim() || null,
                    barcode: dto.barcode?.trim() || null,
                    categoryId: dto.categoryId || null,
                    unit: dto.unit?.trim() || 'cái',
                    price: new database_1.Prisma.Decimal(dto.price ?? 0),
                    costPrice: new database_1.Prisma.Decimal(dto.costPrice ?? 0),
                    stockQty: 0,
                    minStockQty: dto.minStockQty ?? 0,
                    note: dto.note?.trim() || null,
                },
            });
            if (initialStock > 0) {
                // Opening stock via inventory inbound semantics
                const batch = await tx.salesStockBatch.create({
                    data: {
                        organizationId,
                        productId: created.id,
                        batchCode: `OPENING-${created.id.slice(0, 8).toUpperCase()}`,
                        quantity: initialStock,
                        remainingQuantity: initialStock,
                        importedAt: new Date(),
                        unitCost: new database_1.Prisma.Decimal(dto.costPrice ?? 0),
                    },
                });
                await tx.salesStockMovement.create({
                    data: {
                        organizationId,
                        type: 'INBOUND',
                        productId: created.id,
                        quantity: initialStock,
                        reason: 'Tồn đầu kỳ',
                        performedById: userId ?? null,
                        referenceType: 'OPENING',
                        lines: { create: [{ batchId: batch.id, quantity: initialStock }] },
                    },
                });
                await tx.salesProduct.update({
                    where: { id: created.id },
                    data: { stockQty: initialStock },
                });
            }
            return tx.salesProduct.findFirstOrThrow({
                where: { id: created.id },
                include: { category: { select: { id: true, name: true } } },
            });
        };
        const product = await (tx ? write(tx) : this.prisma.$transaction(write))
            .catch((error) => this.productConflict(error));
        if (!tx)
            await this.invalidateProductCache(organizationId);
        await this.audit.log({
            organizationId,
            userId,
            action: 'SALES_PRODUCT_CREATED',
            entityType: 'SALES_PRODUCT',
            entityId: product.id,
        }, tx || this.prisma);
        return {
            ...product,
            price: Number(product.price),
            costPrice: Number(product.costPrice),
        };
    }
    async updateProduct(organizationId, id, dto, userId, tx) {
        dto = this.validateProduct(sales_dto_1.UpdateSalesProductDto, dto);
        const db = tx || this.prisma;
        const existing = await db.salesProduct.findFirst({
            where: { id, organizationId },
        });
        if (!existing)
            throw new common_1.NotFoundException('Không tìm thấy sản phẩm');
        // stockQty không chỉnh trực tiếp — dùng phiếu nhập/xuất/điều chỉnh
        if (dto.categoryId !== undefined) {
            await this.assertCategoryInOrg(organizationId, dto.categoryId, db);
        }
        const product = await db.salesProduct.update({
            where: { id },
            data: {
                ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
                ...(dto.sku !== undefined ? { sku: dto.sku?.trim() || null } : {}),
                ...(dto.model !== undefined ? { model: dto.model?.trim() || null } : {}),
                ...(dto.barcode !== undefined ? { barcode: dto.barcode?.trim() || null } : {}),
                ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId || null } : {}),
                ...(dto.unit !== undefined ? { unit: dto.unit?.trim() || 'cái' } : {}),
                ...(dto.price !== undefined ? { price: new database_1.Prisma.Decimal(dto.price) } : {}),
                ...(dto.costPrice !== undefined ? { costPrice: new database_1.Prisma.Decimal(dto.costPrice) } : {}),
                ...(dto.minStockQty !== undefined
                    ? { minStockQty: dto.minStockQty }
                    : {}),
                ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
                ...(dto.note !== undefined ? { note: dto.note?.trim() || null } : {}),
            },
            include: { category: { select: { id: true, name: true } } },
        }).catch((error) => this.productConflict(error));
        if (!tx)
            await this.invalidateProductCache(organizationId);
        await this.audit.log({
            organizationId,
            userId,
            action: 'SALES_PRODUCT_UPDATED',
            entityType: 'SALES_PRODUCT',
            entityId: id,
        }, db);
        return {
            ...product,
            price: Number(product.price),
            costPrice: Number(product.costPrice),
        };
    }
    async invalidateProductCache(organizationId) {
        await this.kpiCache?.bump(organizationId);
    }
    validateProduct(type, input) {
        const dto = (0, class_transformer_1.plainToInstance)(type, input);
        const errors = (0, class_validator_1.validateSync)(dto, { whitelist: true, forbidNonWhitelisted: true });
        if (errors.length)
            throw new common_1.BadRequestException({
                message: errors.flatMap((error) => Object.values(error.constraints || {}).map((message) => `${error.property}: ${message}`)),
            });
        return dto;
    }
    productConflict(error) {
        if (error instanceof database_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const target = error.meta?.target;
            const fields = Array.isArray(target) ? target.map(String) : [String(target || '')];
            const messages = [
                ...(fields.some((field) => /(?:^|_)sku(?:_|$)/i.test(field))
                    ? ['sku: Mã SKU đã được dùng trong tổ chức.']
                    : []),
                ...(fields.some((field) => /(?:^|_)barcode(?:_|$)/i.test(field))
                    ? ['barcode: Barcode đã được dùng trong tổ chức.']
                    : []),
            ];
            if (messages.length)
                throw new common_1.ConflictException({ message: messages, code: 'SALES_PRODUCT_DUPLICATE' });
        }
        throw error;
    }
};
exports.SalesService = SalesService;
exports.SalesService = SalesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        inventory_service_1.InventoryService,
        tenant_kpi_cache_service_1.TenantKpiCacheService])
], SalesService);
