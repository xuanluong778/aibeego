import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SalesOrderStatus } from '@marketingspa/database';
import { sourceDescriptionMarkdown, sourceImages, sourceProductModel } from '@marketingspa/shared/dist/sales-product-source';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InventoryService } from './inventory.service';
import { TenantKpiCacheService } from '../common/services/tenant-kpi-cache.service';
import { buildPaginatedResult, getPaginationParams } from '../common/utils/pagination.util';
import {
  CreateSalesOrderDto,
  CreateSalesProductDto,
  SalesOrderItemDto,
  SalesOrderQueryDto,
  SalesProductQueryDto,
  UpdateSalesOrderDto,
  UpdateSalesProductDto,
} from './dto/sales.dto';
import { SalesDocumentCodeService, SALES_DOC_TYPES } from './sales-document-code.service';
import { assertBranchInOrg } from './sales-org-scope.util';
import { deriveOrderPaymentStatus } from './sales-order-payment.util';

const ALLOWED_TRANSITIONS: Record<SalesOrderStatus, SalesOrderStatus[]> = {
  DRAFT: [SalesOrderStatus.CONFIRMED, SalesOrderStatus.CANCELLED],
  CONFIRMED: [SalesOrderStatus.READY, SalesOrderStatus.CANCELLED],
  READY: [SalesOrderStatus.SHIPPED, SalesOrderStatus.CANCELLED],
  SHIPPED: [
    SalesOrderStatus.COMPLETED,
    SalesOrderStatus.RETURNED,
    SalesOrderStatus.PARTIALLY_RETURNED,
    SalesOrderStatus.CANCELLED,
  ],
  COMPLETED: [SalesOrderStatus.RETURNED, SalesOrderStatus.PARTIALLY_RETURNED],
  PARTIALLY_RETURNED: [
    SalesOrderStatus.RETURNED,
    SalesOrderStatus.COMPLETED,
    SalesOrderStatus.CANCELLED,
  ],
  CANCELLED: [],
  RETURNED: [],
};

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly inventory: InventoryService,
    private readonly docCodes: SalesDocumentCodeService,
    private readonly kpiCache?: TenantKpiCacheService,
  ) {}

  private decimal(n: number) {
    return new Prisma.Decimal(Number(n) || 0);
  }

  private calcLine(item: SalesOrderItemDto) {
    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
    const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
    const lineDiscount = Math.max(0, Number(item.lineDiscount) || 0);
    const totalPrice = Math.max(0, qty * unitPrice - lineDiscount);
    return { qty, unitPrice, lineDiscount, totalPrice };
  }

  private calcTotals(items: SalesOrderItemDto[], discount = 0, shippingFee = 0) {
    const lines = items.map((it) => this.calcLine(it));
    const subtotal = lines.reduce((s, l) => s + l.totalPrice, 0);
    const disc = Math.max(0, Number(discount) || 0);
    const ship = Math.max(0, Number(shippingFee) || 0);
    const total = Math.max(0, subtotal - disc + ship);
    return { lines, subtotal, discount: disc, shippingFee: ship, total };
  }

  private async assertCustomer(organizationId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId, isActive: true },
      select: { id: true, name: true, phone: true, note: true },
    });
    if (!customer) throw new BadRequestException('Khách hàng không tồn tại');
    return customer;
  }

  /** Mọi productId trên đơn phải thuộc cùng organizationId */
  private async assertProductsInOrg(
    organizationId: string,
    items: Array<{ productId?: string | null }>,
  ) {
    const ids = [...new Set(items.map((i) => i.productId).filter(Boolean))] as string[];
    if (!ids.length) return;
    const found = await this.prisma.salesProduct.findMany({
      where: { organizationId, id: { in: ids } },
      select: { id: true },
    });
    if (found.length !== ids.length) {
      throw new BadRequestException('Sản phẩm không thuộc tổ chức hoặc không tồn tại');
    }
  }

  private async assertCategoryInOrg(organizationId: string, categoryId: string | null | undefined, db: Prisma.TransactionClient = this.prisma) {
    if (!categoryId) return;
    const cat = await db.salesProductCategory.findFirst({
      where: { id: categoryId, organizationId },
      select: { id: true },
    });
    if (!cat) throw new BadRequestException({ message: ['categoryId: Danh mục không thuộc tổ chức.'] });
  }

  private serializeOrder<
    T extends {
      subtotal: Prisma.Decimal;
      discount: Prisma.Decimal;
      shippingFee: Prisma.Decimal;
      total: Prisma.Decimal;
      amountPaid?: Prisma.Decimal;
      payments?: Array<{ amount: Prisma.Decimal; kind?: string }>;
      items?: Array<{
        unitPrice: Prisma.Decimal;
        lineDiscount: Prisma.Decimal;
        totalPrice: Prisma.Decimal;
      }>;
    },
  >(order: T) {
    const total = Number(order.total);
    const amountPaid = Number(order.amountPaid ?? 0);
    const collected = (order.payments ?? [])
      .filter((p) => p.kind !== 'REFUND')
      .reduce((s, p) => s + Number(p.amount), 0);
    const amountRefunded = (order.payments ?? [])
      .filter((p) => p.kind === 'REFUND')
      .reduce((s, p) => s + Number(p.amount), 0);
    const round = (n: number) => Math.round(n * 100) / 100;
    return {
      ...order,
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      shippingFee: Number(order.shippingFee),
      total,
      amountPaid,
      amountCollected: order.payments ? round(collected) : undefined,
      amountRefunded: order.payments ? round(amountRefunded) : undefined,
      amountDue: Math.max(0, round(total - amountPaid)),
      amountRefundable: Math.max(0, round(amountPaid - total)),
      payments: order.payments?.map((p) => ({ ...p, amount: Number(p.amount) })),
      items: order.items?.map((it) => ({
        ...it,
        unitPrice: Number(it.unitPrice),
        lineDiscount: Number(it.lineDiscount),
        totalPrice: Number(it.totalPrice),
      })),
    };
  }

  async listOrders(organizationId: string, query: SalesOrderQueryDto) {
    const { page, pageSize, skip, take } = getPaginationParams(query);
    const cacheName = `list:sorders:${page}:${pageSize}:${JSON.stringify({
      st: query.status,
      c: query.customerId,
      s: query.search,
      f: query.from,
      t: query.to,
    })}`;
    const cached = await this.kpiCache?.getJson<any>(organizationId, cacheName);
    if (cached) return cached;
    const where: Prisma.SalesOrderWhereInput = { organizationId };
    if (query.status) where.status = query.status;
    if (query.customerId) where.customerId = query.customerId;
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
      if (query.from) where.createdAt.gte = new Date(query.from);
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

    const payload = buildPaginatedResult(
      items.map((o) => this.serializeOrder(o)),
      total,
      page,
      pageSize,
    );
    await this.kpiCache?.setJson(organizationId, cacheName, payload, 8);
    return payload;
  }

  async getOrder(organizationId: string, id: string) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id, organizationId },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
        payments: { orderBy: { paidAt: 'asc' } },
        returns: { include: { items: true }, orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    return this.serializeOrder({
      ...order,
      returns: order.returns.map((r) => ({
        ...r,
        refundAmount: Number(r.refundAmount),
        items: r.items.map((i) => ({ ...i, refundAmount: Number(i.refundAmount) })),
      })),
    });
  }

  async createOrder(organizationId: string, dto: CreateSalesOrderDto, userId?: string) {
    if (!dto.items?.length) throw new BadRequestException('Đơn hàng cần ít nhất 1 sản phẩm');
    const customer = await this.assertCustomer(organizationId, dto.customerId);
    await this.assertProductsInOrg(organizationId, dto.items);
    await assertBranchInOrg(this.prisma, organizationId, dto.branchId);
    const totals = this.calcTotals(dto.items, dto.discount, dto.shippingFee);

    let order: Awaited<ReturnType<typeof this.prisma.salesOrder.create>>;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        order = await this.prisma.$transaction(async (tx) => {
      const code = await this.docCodes.nextInTransaction(
        tx,
        organizationId,
        SALES_DOC_TYPES.SALES_ORDER,
      );
      const created = await tx.salesOrder.create({
        data: {
          organizationId,
          branchId: dto.branchId,
          customerId: customer.id,
          code,
          status: SalesOrderStatus.DRAFT,
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
              const line = totals.lines[i]!;
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
      await this.audit.log(
        {
          organizationId,
          userId,
          action: 'SALES_ORDER_CREATED',
          entityType: 'SALES_ORDER',
          entityId: created.id,
          metadata: { code: created.code, total: totals.total },
        },
        tx,
      );
      return created;
    });
        break;
      } catch (e) {
        if (
          attempt < 3 &&
          typeof e === 'object' &&
          e !== null &&
          'code' in e &&
          (e as { code: string }).code === 'P2002'
        ) {
          continue;
        }
        throw e;
      }
    }

    await this.kpiCache?.bump(organizationId);
    return this.serializeOrder(order!);
  }

  async updateOrder(
    organizationId: string,
    id: string,
    dto: UpdateSalesOrderDto,
    userId?: string,
  ) {
    if (dto.items?.length) await this.assertProductsInOrg(organizationId, dto.items);
    if (dto.branchId !== undefined) await assertBranchInOrg(this.prisma, organizationId, dto.branchId);

    let prefCustomerId: string | undefined;
    let prefCustomerName: string | undefined;
    if (dto.customerId) {
      const customer = await this.assertCustomer(organizationId, dto.customerId);
      prefCustomerId = customer.id;
      prefCustomerName = dto.customerName?.trim() || customer.name;
    } else if (dto.customerName?.trim()) {
      prefCustomerName = dto.customerName.trim();
    }

    const items = dto.items;
    const order = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<
        Array<{
          id: string;
          status: SalesOrderStatus;
          exported_at: Date | null;
          subtotal: Prisma.Decimal;
          discount: Prisma.Decimal;
          shipping_fee: Prisma.Decimal;
          amount_paid: Prisma.Decimal;
          customer_id: string;
          customer_name: string;
        }>
      >`
        SELECT id, status, exported_at, subtotal, discount, shipping_fee, amount_paid,
               customer_id, customer_name
        FROM sales_orders
        WHERE id = ${id} AND organization_id = ${organizationId}
        FOR UPDATE
      `;
      if (!locked.length) throw new NotFoundException('Không tìm thấy đơn hàng');
      const row = locked[0]!;
      if (row.status !== SalesOrderStatus.DRAFT && row.status !== SalesOrderStatus.CONFIRMED) {
        throw new BadRequestException('Chỉ sửa được đơn DRAFT hoặc CONFIRMED');
      }
      if (row.exported_at) {
        throw new BadRequestException('Đơn đã xuất kho — không sửa dòng hàng');
      }

      const discountBase =
        dto.discount !== undefined ? dto.discount : Number(row.discount);
      const shipBase =
        dto.shippingFee !== undefined ? dto.shippingFee : Number(row.shipping_fee);
      const totals = items?.length
        ? this.calcTotals(items, discountBase, shipBase)
        : null;

      if (items?.length) {
        await tx.salesOrderItem.deleteMany({ where: { orderId: id } });
        await tx.salesOrderItem.createMany({
          data: items.map((it, i) => {
            const line = totals!.lines[i]!;
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

      let subtotal = Number(row.subtotal);
      let discount = discountBase;
      let shippingFee = shipBase;
      if (totals) {
        subtotal = totals.subtotal;
        discount = totals.discount;
        shippingFee = totals.shippingFee;
      } else if (dto.discount === undefined && dto.shippingFee === undefined && !items?.length) {
        // metadata-only patch
      } else if (!items?.length) {
        subtotal = Number(
          (
            await tx.salesOrderItem.aggregate({
              where: { orderId: id },
              _sum: { totalPrice: true },
            })
          )._sum.totalPrice ?? row.subtotal,
        );
      }
      const total = Math.max(0, subtotal - Number(discount) + Number(shippingFee));
      const amountPaid = Number(row.amount_paid);
      const paymentStatus = deriveOrderPaymentStatus(total, amountPaid);

      const updated = await tx.salesOrder.update({
        where: { id },
        data: {
          customerId: prefCustomerId ?? row.customer_id,
          customerName: prefCustomerName ?? row.customer_name,
          phone: dto.phone !== undefined ? dto.phone?.trim() || null : undefined,
          address: dto.address !== undefined ? dto.address?.trim() || null : undefined,
          source: dto.source !== undefined ? dto.source?.trim() || null : undefined,
          note: dto.note !== undefined ? dto.note?.trim() || null : undefined,
          ...(dto.branchId !== undefined ? { branchId: dto.branchId } : {}),
          subtotal: this.decimal(subtotal),
          discount: this.decimal(discount),
          shippingFee: this.decimal(shippingFee),
          total: this.decimal(total),
          paymentStatus,
        },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          items: true,
        },
      });

      await this.audit.log(
        {
          organizationId,
          userId,
          action: 'SALES_ORDER_UPDATED',
          entityType: 'SALES_ORDER',
          entityId: id,
          metadata: {
            total,
            paymentStatus,
            subtotal,
            discount,
            shippingFee,
          },
        },
        tx,
      );
      return updated;
    });

    return this.serializeOrder(order);
  }

  async updateStatus(
    organizationId: string,
    id: string,
    status: SalesOrderStatus,
    userId?: string,
  ) {
    const order = await this.prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<
          Array<{
            id: string;
            status: SalesOrderStatus;
            code: string;
            exported_at: Date | null;
          }>
        >`
          SELECT id, status, code, exported_at
          FROM sales_orders
          WHERE id = ${id} AND organization_id = ${organizationId}
          FOR UPDATE
        `;
        if (!locked.length) throw new NotFoundException('Không tìm thấy đơn hàng');
        const existing = locked[0]!;
        const allowed = ALLOWED_TRANSITIONS[existing.status] ?? [];
        if (!allowed.includes(status)) {
          throw new BadRequestException(
            `Không chuyển được từ ${existing.status} sang ${status}`,
          );
        }

        const needsReturn =
          Boolean(existing.exported_at) &&
          (status === SalesOrderStatus.CANCELLED || status === SalesOrderStatus.RETURNED);

        // Không cho đánh SHIPPED qua status nếu chưa xuất kho — dùng nút Xuất hàng
        if (status === SalesOrderStatus.SHIPPED && !existing.exported_at) {
          throw new BadRequestException(
            'Chưa xuất kho — dùng nút “Xuất hàng” để trừ tồn FEFO rồi chuyển SHIPPED',
          );
        }

        if (needsReturn) {
          await this.inventory.returnForSalesOrder(tx, {
            organizationId,
            orderId: id,
            performedById: userId,
            reason:
              status === SalesOrderStatus.RETURNED
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

        const stamp: Prisma.SalesOrderUpdateInput = { status };
        const now = new Date();
        if (status === SalesOrderStatus.CONFIRMED) stamp.confirmedAt = now;
        if (status === SalesOrderStatus.READY) stamp.readyAt = now;
        if (status === SalesOrderStatus.SHIPPED) stamp.shippedAt = now;
        if (status === SalesOrderStatus.COMPLETED) stamp.completedAt = now;
        if (status === SalesOrderStatus.CANCELLED) stamp.cancelledAt = now;
        if (status === SalesOrderStatus.RETURNED) stamp.returnedAt = now;

        const updated = await tx.salesOrder.update({
          where: { id },
          data: stamp,
          include: {
            customer: { select: { id: true, name: true, phone: true } },
            items: true,
          },
        });

        await this.audit.log(
          {
            organizationId,
            userId,
            action:
              status === SalesOrderStatus.CANCELLED
                ? 'SALES_ORDER_CANCELLED'
                : status === SalesOrderStatus.RETURNED
                  ? 'SALES_ORDER_RETURNED'
                  : 'SALES_ORDER_STATUS',
            entityType: 'SALES_ORDER',
            entityId: id,
            metadata: {
              from: existing.status,
              to: status,
              stockReturned: Boolean(needsReturn),
            },
          },
          tx,
        );

        return updated;
      },
      { timeout: 20_000 },
    );

    return this.serializeOrder(order);
  }

  /** Xuất hàng: FEFO theo lô, lock đơn + lô, idempotent, rollback nếu lỗi */
  async exportOrder(organizationId: string, id: string, userId?: string) {
    const order = await this.prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<
          Array<{
            id: string;
            status: SalesOrderStatus;
            code: string;
            exported_at: Date | null;
            shipped_at: Date | null;
          }>
        >`
          SELECT id, status, code, exported_at, shipped_at
          FROM sales_orders
          WHERE id = ${id} AND organization_id = ${organizationId}
          FOR UPDATE
        `;
        if (!locked.length) throw new NotFoundException('Không tìm thấy đơn hàng');
        const row = locked[0]!;

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

        if (
          row.status === SalesOrderStatus.CANCELLED ||
          row.status === SalesOrderStatus.RETURNED
        ) {
          throw new BadRequestException('Đơn đã hủy/trả không thể xuất hàng');
        }
        if (
          row.status !== SalesOrderStatus.READY &&
          row.status !== SalesOrderStatus.CONFIRMED &&
          row.status !== SalesOrderStatus.SHIPPED
        ) {
          throw new BadRequestException('Chỉ xuất hàng khi đơn CONFIRMED / READY / SHIPPED');
        }

        const items = await tx.salesOrderItem.findMany({ where: { orderId: id } });

        await this.inventory.exportForSalesOrder(tx, {
          organizationId,
          orderId: id,
          orderCode: row.code,
          items: items.map((it) => ({
            orderItemId: it.id,
            productId: it.productId,
            productName: it.productName,
            quantity: it.quantity,
          })),
          performedById: userId,
        });

        const nextStatus =
          row.status === SalesOrderStatus.SHIPPED ? row.status : SalesOrderStatus.SHIPPED;

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

        await this.audit.log(
          {
            organizationId,
            userId,
            action: 'SALES_ORDER_EXPORTED',
            entityType: 'SALES_ORDER',
            entityId: id,
            metadata: { code: row.code, itemCount: items.length },
          },
          tx,
        );

        return updated;
      },
      { timeout: 20_000 },
    );

    return this.serializeOrder(order);
  }

  // ── Products ────────────────────────────────────────────────────────────

  async listProducts(organizationId: string, query: SalesProductQueryDto) {
    const { page, pageSize, skip, take } = getPaginationParams(query);
    const cacheName = `list:sprod:v2:${page}:${pageSize}:${JSON.stringify({
      s: query.search,
      a: query.active,
      c: query.categoryId,
    })}`;
    const cached = await this.kpiCache?.getJson<any>(organizationId, cacheName);
    if (cached) return cached;
    const where: Prisma.SalesProductWhereInput = { organizationId };
    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { sku: { contains: q, mode: 'insensitive' } },
        { barcode: { contains: q, mode: 'insensitive' } },
        { model: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (query.active === 'true') where.isActive = true;
    if (query.active === 'false') where.isActive = false;
    if (query.categoryId) where.categoryId = query.categoryId;

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

    const stockMap = await this.inventory.stockBreakdownMany(
      this.prisma,
      organizationId,
      items.map((p) => p.id),
    );

    const payload = buildPaginatedResult(
      items.map((p) => {
        const stock = stockMap.get(p.id) || { physicalQty: 0, sellableQty: 0, expiredQty: 0 };
        return {
          ...p,
          imageUrl: p.websiteSources.flatMap(source => sourceImages(source.snapshot as Record<string, unknown>))[0] || null,
          websitePriceMissing: p.websiteSources.length > 0 && p.websiteSources.every(source => {
            const snapshot = source.snapshot as Record<string, unknown>;
            return !snapshot.regularPrice && !snapshot.salePrice;
          }),
          websiteSources: p.websiteSources.map(source => {
            const snapshot = source.snapshot as Record<string, unknown>;
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
      }),
      total,
      page,
      pageSize,
    );
    await this.kpiCache?.setJson(organizationId, cacheName, payload, 8);
    return payload;
  }

  async listCategories(organizationId: string) {
    return this.prisma.salesProductCategory.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
    });
  }
  async getProduct(organizationId: string, id: string) {
    const product = await this.prisma.salesProduct.findFirst({ where: { id, organizationId },
      include: { category: { select: { id: true, name: true } }, websiteSources: {
        select: { externalId: true, syncedAt: true, snapshot: true, connection: { select: { websiteUrl: true } } },
        orderBy: { syncedAt: 'desc' },
      } },
    });
    if (!product) throw new NotFoundException('Không tìm thấy sản phẩm');
    const stock = await this.inventory.stockBreakdown(this.prisma, organizationId, id);
    const sources = product.websiteSources.map(source => {
      const snapshot = source.snapshot as Record<string, unknown>;
      let url = '';
      try { const parsed = new URL(String(snapshot.url || '')); if (['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password) url = parsed.href; } catch { /* Missing source URL. */ }
      return { externalId: source.externalId, websiteUrl: source.connection.websiteUrl, syncedAt: source.syncedAt,
        url, images: sourceImages(snapshot), model: sourceProductModel(snapshot),
        description: sourceDescriptionMarkdown(snapshot.description), shortDescription: sourceDescriptionMarkdown(snapshot.shortDescription),
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

  async createCategory(organizationId: string, name: string, db: Prisma.TransactionClient = this.prisma) {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('Tên danh mục trống');
    return db.salesProductCategory.upsert({
      where: {
        organizationId_name: { organizationId, name: trimmed },
      },
      create: { organizationId, name: trimmed },
      update: {},
    });
  }

  async createProduct(organizationId: string, dto: CreateSalesProductDto, userId?: string, tx?: Prisma.TransactionClient) {
    dto = this.validateProduct(CreateSalesProductDto, dto);
    const initialStock = dto.stockQty ?? 0;
    await this.assertCategoryInOrg(organizationId, dto.categoryId, tx);
    const write = async (tx: Prisma.TransactionClient) => {
      const created = await tx.salesProduct.create({
        data: {
          organizationId,
          name: dto.name.trim(),
          sku: dto.sku?.trim() || null,
          model: dto.model?.trim() || null,
          barcode: dto.barcode?.trim() || null,
          categoryId: dto.categoryId || null,
          unit: dto.unit?.trim() || 'cái',
          price: new Prisma.Decimal(dto.price ?? 0),
          costPrice: new Prisma.Decimal(dto.costPrice ?? 0),
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
            unitCost: new Prisma.Decimal(dto.costPrice ?? 0),
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
      .catch((error: unknown) => this.productConflict(error));

    if (!tx) await this.invalidateProductCache(organizationId);
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

  async updateProduct(
    organizationId: string,
    id: string,
    dto: UpdateSalesProductDto,
    userId?: string,
    tx?: Prisma.TransactionClient,
  ) {
    dto = this.validateProduct(UpdateSalesProductDto, dto);
    const db = tx || this.prisma;
    const existing = await db.salesProduct.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy sản phẩm');

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
        ...(dto.price !== undefined ? { price: new Prisma.Decimal(dto.price) } : {}),
        ...(dto.costPrice !== undefined ? { costPrice: new Prisma.Decimal(dto.costPrice) } : {}),
        ...(dto.minStockQty !== undefined
          ? { minStockQty: dto.minStockQty }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.note !== undefined ? { note: dto.note?.trim() || null } : {}),
      },
      include: { category: { select: { id: true, name: true } } },
    }).catch((error: unknown) => this.productConflict(error));
    if (!tx) await this.invalidateProductCache(organizationId);
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

  async invalidateProductCache(organizationId: string) {
    await this.kpiCache?.bump(organizationId);
  }

  validateProduct<T extends object>(type: new () => T, input: T): T {
    const dto = plainToInstance(type, input);
    const errors = validateSync(dto, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length)
      throw new BadRequestException({
        message: errors.flatMap((error) =>
          Object.values(error.constraints || {}).map((message) => `${error.property}: ${message}`),
        ),
      });
    return dto;
  }

  private productConflict(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
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
        throw new ConflictException({ message: messages, code: 'SALES_PRODUCT_DUPLICATE' });
    }
    throw error;
  }
}
