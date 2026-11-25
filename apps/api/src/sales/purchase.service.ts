import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SalesPurchaseOrderStatus } from '@marketingspa/database';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InventoryService } from './inventory.service';
import { buildPaginatedResult, getPaginationParams } from '../common/utils/pagination.util';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  loadSalesIdempotentResult,
  requireIdempotencyKey,
  saveSalesIdempotentResult,
  stablePayloadHash,
} from './sales-idempotency.util';
import { SalesDocumentCodeService, SALES_DOC_TYPES } from './sales-document-code.service';

@Injectable()
export class SalesPurchaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly inventory: InventoryService,
    private readonly docCodes: SalesDocumentCodeService,
  ) {}

  private decimal(n: number) {
    return new Prisma.Decimal(Number(n) || 0);
  }

  // ── Suppliers ────────────────────────────────────────────────────────────

  async listSuppliers(organizationId: string, query?: PaginationDto & { search?: string }) {
    const { page, pageSize, skip, take } = getPaginationParams(query ?? {});
    const where: Prisma.SalesSupplierWhereInput = { organizationId, isActive: true };
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
    return buildPaginatedResult(items, total, page, pageSize);
  }

  async createSupplier(
    organizationId: string,
    dto: {
      name: string;
      phone?: string;
      email?: string;
      address?: string;
      taxCode?: string;
      note?: string;
    },
    userId?: string,
  ) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Thiếu tên NCC');
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

  async updateSupplier(
    organizationId: string,
    id: string,
    dto: Partial<{
      name: string;
      phone: string;
      email: string;
      address: string;
      taxCode: string;
      note: string;
      isActive: boolean;
    }>,
  ) {
    const existing = await this.prisma.salesSupplier.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException('Không tìm thấy NCC');
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

  async listPurchaseOrders(
    organizationId: string,
    query: PaginationDto & { status?: string },
  ) {
    const { page, pageSize, skip, take } = getPaginationParams(query);
    const where: Prisma.SalesPurchaseOrderWhereInput = { organizationId };
    if (query.status) where.status = query.status as SalesPurchaseOrderStatus;
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
    return buildPaginatedResult(
      items.map((po) => this.serializePo(po)),
      total,
      page,
      pageSize,
    );
  }

  async getPurchaseOrder(organizationId: string, id: string) {
    const po = await this.prisma.salesPurchaseOrder.findFirst({
      where: { id, organizationId },
      include: {
        supplier: true,
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
      },
    });
    if (!po) throw new NotFoundException('Không tìm thấy PO');
    return this.serializePo(po);
  }

  async createPurchaseOrder(
    organizationId: string,
    dto: {
      supplierId: string;
      expectedDate?: string;
      note?: string;
      items: Array<{ productId: string; quantity: number; unitCost: number }>;
    },
    userId?: string,
  ) {
    if (!dto.items?.length) throw new BadRequestException('PO cần ít nhất 1 dòng');
    const supplier = await this.prisma.salesSupplier.findFirst({
      where: { id: dto.supplierId, organizationId, isActive: true },
    });
    if (!supplier) throw new BadRequestException('NCC không hợp lệ');

    const productIds = [...new Set(dto.items.map((i) => i.productId))];
    const products = await this.prisma.salesProduct.findMany({
      where: { organizationId, id: { in: productIds } },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException('Sản phẩm không thuộc tổ chức');
    }
    const byId = new Map(products.map((p) => [p.id, p]));

    const lines = dto.items.map((it) => {
      const qty = Math.max(1, Math.trunc(Number(it.quantity) || 0));
      const unitCost = Math.max(0, Number(it.unitCost) || 0);
      const p = byId.get(it.productId)!;
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
      const code = await this.docCodes.nextInTransaction(
        tx,
        organizationId,
        SALES_DOC_TYPES.PURCHASE_ORDER,
      );
      const created = await tx.salesPurchaseOrder.create({
        data: {
          organizationId,
          supplierId: supplier.id,
          code,
          status: SalesPurchaseOrderStatus.ORDERED,
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
      await this.audit.log(
        {
          organizationId,
          userId,
          action: 'SALES_PO_CREATED',
          entityType: 'SALES_PURCHASE_ORDER',
          entityId: created.id,
          metadata: { code, subtotal, lineCount: lines.length },
        },
        tx,
      );
      return created;
    });

    return this.serializePo(po);
  }

  /**
   * Nhận hàng PO → InventoryService.applyInboundInTx (INBOUND).
   * Idempotent theo receivedQty: không nhận vượt; retry an toàn.
   */
  async receiveGoods(
    organizationId: string,
    poId: string,
    dto: {
      items: Array<{
        purchaseOrderItemId?: string;
        productId?: string;
        quantity: number;
        batchCode?: string;
        expiryDate?: string;
      }>;
      idempotencyKey: string;
      note?: string;
    },
    userId?: string,
  ) {
    if (!dto.items?.length) throw new BadRequestException('Thiếu dòng nhận hàng');
    const idempotencyKey = requireIdempotencyKey(dto.idempotencyKey);
    const payloadForHash = {
      poId,
      items: dto.items.map((i) => ({
        purchaseOrderItemId: i.purchaseOrderItemId ?? null,
        productId: i.productId ?? null,
        quantity: Math.trunc(Number(i.quantity) || 0),
        batchCode: i.batchCode?.trim() || null,
        expiryDate: i.expiryDate ?? null,
      })),
      note: dto.note?.trim() || null,
    };
    const payloadHash = stablePayloadHash(payloadForHash);
    const normalized = this.normalizeReceiveLines(dto.items);

    return this.prisma.$transaction(
      async (tx) => {
        const replay = await loadSalesIdempotentResult<{ poId: string }>(tx, {
          organizationId,
          operation: 'PO_RECEIVE',
          idempotencyKey,
          payloadHash,
        });
        if (replay) {
          const po = await tx.salesPurchaseOrder.findFirstOrThrow({
            where: { id: replay.poId, organizationId },
            include: { supplier: true, items: true },
          });
          return this.serializePo(po);
        }

        const locked = await tx.$queryRaw<Array<{ id: string; status: string; code: string }>>`
          SELECT id, status, code FROM sales_purchase_orders
          WHERE id = ${poId} AND organization_id = ${organizationId}
          FOR UPDATE
        `;
        if (!locked.length) throw new NotFoundException('Không tìm thấy PO');
        const header = locked[0]!;
        if (header.status === SalesPurchaseOrderStatus.CANCELLED) {
          throw new BadRequestException('PO đã hủy');
        }

        const poItems = await tx.salesPurchaseOrderItem.findMany({
          where: { purchaseOrderId: poId },
        });
        const byId = new Map(poItems.map((i) => [i.id, i]));
        const byProduct = new Map(poItems.map((i) => [i.productId, i]));

        for (const recv of normalized) {
          const line = recv.purchaseOrderItemId
            ? byId.get(recv.purchaseOrderItemId)
            : recv.productId
              ? byProduct.get(recv.productId)
              : undefined;
          if (!line) {
            throw new BadRequestException(
              recv.purchaseOrderItemId
                ? `Dòng PO không hợp lệ: ${recv.purchaseOrderItemId}`
                : `SP không có trên PO: ${recv.productId}`,
            );
          }
          const qty = recv.quantity;
          if (qty <= 0) continue;
          const remain = line.quantity - line.receivedQty;
          if (qty > remain) {
            throw new BadRequestException(
              `Nhận vượt PO cho ${line.productName} (còn ${remain}, yêu cầu ${qty})`,
            );
          }

          const batchCode =
            recv.batchCode?.trim() ||
            `PO-${header.code}-${line.productId.slice(0, 6).toUpperCase()}`;

          const inboundRef = `PO_RECEIVE:${poId}:${line.id}:${idempotencyKey}`;
          const priorInbound = await tx.salesStockMovement.findFirst({
            where: {
              organizationId,
              type: 'INBOUND',
              referenceType: 'PURCHASE_ORDER',
              referenceId: inboundRef,
            },
          });
          if (!priorInbound) {
            await this.inventory.applyInboundInTx(
              tx,
              organizationId,
              {
                productId: line.productId,
                batchCode,
                quantity: qty,
                unitCost: Number(line.unitCost),
                expiryDate: recv.expiryDate,
                reason: `Nhận hàng PO ${header.code}`,
                note: dto.note?.trim() || undefined,
                referenceType: 'PURCHASE_ORDER',
                referenceId: inboundRef,
              },
              userId,
            );
            await tx.salesPurchaseOrderItem.update({
              where: { id: line.id },
              data: { receivedQty: { increment: qty } },
            });
          }
        }

        const refreshed = await tx.salesPurchaseOrderItem.findMany({
          where: { purchaseOrderId: poId },
        });
        const allRecv = refreshed.every((i) => i.receivedQty >= i.quantity);
        const anyRecv = refreshed.some((i) => i.receivedQty > 0);
        const status = allRecv
          ? SalesPurchaseOrderStatus.RECEIVED
          : anyRecv
            ? SalesPurchaseOrderStatus.PARTIAL_RECEIVED
            : SalesPurchaseOrderStatus.ORDERED;

        await tx.salesPurchaseOrder.update({
          where: { id: poId },
          data: {
            status,
            ...(allRecv ? { receivedAt: new Date() } : {}),
          },
        });

        await this.audit.log(
          {
            organizationId,
            userId,
            action: 'SALES_PO_RECEIVED',
            entityType: 'SALES_PURCHASE_ORDER',
            entityId: poId,
            metadata: { code: header.code, status, idempotencyKey, items: normalized },
          },
          tx,
        );

        const po = await tx.salesPurchaseOrder.findFirstOrThrow({
          where: { id: poId, organizationId },
          include: { supplier: true, items: true },
        });
        const serialized = this.serializePo(po);
        await saveSalesIdempotentResult(tx, {
          organizationId,
          operation: 'PO_RECEIVE',
          idempotencyKey,
          payloadHash,
          resourceId: poId,
          resultJson: { poId },
        });
        return serialized;
      },
      { timeout: 30_000 },
    );
  }

  private normalizeReceiveLines(
    items: Array<{
      purchaseOrderItemId?: string;
      productId?: string;
      quantity: number;
      batchCode?: string;
      expiryDate?: string;
    }>,
  ) {
    const keyCounts = new Map<string, number>();
    for (const raw of items) {
      if (!raw.purchaseOrderItemId && !raw.productId) {
        throw new BadRequestException('Mỗi dòng nhận cần purchaseOrderItemId hoặc productId');
      }
      const key = raw.purchaseOrderItemId ? `id:${raw.purchaseOrderItemId}` : `pid:${raw.productId}`;
      keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
    }
    for (const [key, count] of keyCounts) {
      if (count > 1) {
        throw new BadRequestException(
          `Trùng dòng nhận trong cùng yêu cầu (${key.replace(/^(id|pid):/, '')}) — gộp số lượng hoặc tách lần nhận`,
        );
      }
    }
    return items.map((raw) => ({
      purchaseOrderItemId: raw.purchaseOrderItemId,
      productId: raw.productId,
      quantity: Math.trunc(Number(raw.quantity) || 0),
      batchCode: raw.batchCode,
      expiryDate: raw.expiryDate,
    }));
  }

  private serializePo<
    T extends {
      subtotal: Prisma.Decimal;
      items?: Array<{ unitCost: Prisma.Decimal; lineTotal: Prisma.Decimal }>;
    },
  >(po: T) {
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
}
