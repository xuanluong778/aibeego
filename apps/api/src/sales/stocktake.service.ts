import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, SalesStocktakeStatus } from '@marketingspa/database';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InventoryService, type StockTx } from './inventory.service';
import { buildPaginatedResult, getPaginationParams } from '../common/utils/pagination.util';
import { PaginationDto } from '../common/dto/pagination.dto';
import { SalesDocumentCodeService, SALES_DOC_TYPES } from './sales-document-code.service';

@Injectable()
export class StocktakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly inventory: InventoryService,
    private readonly docCodes: SalesDocumentCodeService,
  ) {}

  private todayStart() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  async list(organizationId: string, query: PaginationDto & { status?: string }) {
    const { page, pageSize, skip, take } = getPaginationParams(query);
    const where: Prisma.SalesStocktakeWhereInput = { organizationId };
    if (query.status) where.status = query.status as SalesStocktakeStatus;
    const [items, total] = await Promise.all([
      this.prisma.salesStocktake.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          lines: {
            include: { product: { select: { id: true, name: true, sku: true, barcode: true } } },
          },
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.salesStocktake.count({ where }),
    ]);
    return buildPaginatedResult(items, total, page, pageSize);
  }

  async get(organizationId: string, id: string) {
    const row = await this.prisma.salesStocktake.findFirst({
      where: { id, organizationId },
      include: {
        lines: {
          include: {
            product: {
              select: { id: true, name: true, sku: true, barcode: true, unit: true, stockQty: true },
            },
          },
          orderBy: { product: { name: 'asc' } },
        },
      },
    });
    if (!row) throw new NotFoundException('Không tìm thấy phiếu kiểm kê');
    const match = (row.note ?? '').match(/^SCOPE:(ALL_ACTIVE|SELECTED)\|(\d+)\|?([\s\S]*)$/);
    return {
      ...row,
      note: match ? match[3] || null : row.note,
      scope: match?.[1] ?? 'UNKNOWN',
      productCount: row.lines.length,
      catalogMatched: match ? Number(match[2]) : row.lines.length,
    };
  }

  async create(
    organizationId: string,
    dto: { note?: string; productIds?: string[] },
    userId?: string,
  ) {
    const where = {
      organizationId,
      isActive: true,
      ...(dto.productIds?.length ? { id: { in: dto.productIds } } : {}),
    };
    const matched = await this.prisma.salesProduct.count({ where });
    const products: Array<{ id: string; stockQty: number }> = [];
    const pageSize = 500;
    for (let skip = 0; skip < matched; skip += pageSize) {
      const chunk = await this.prisma.salesProduct.findMany({
        where,
        select: { id: true, stockQty: true },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip,
        take: pageSize,
      });
      products.push(...chunk);
    }
    if (!products.length) throw new BadRequestException('Không có sản phẩm để kiểm kê');
    if (products.length !== matched) {
      throw new BadRequestException('Không tải đủ sản phẩm để kiểm kê — thử lại');
    }
    const scope = dto.productIds?.length ? 'SELECTED' : 'ALL_ACTIVE';

    const created = await this.prisma.$transaction(async (tx) => {
      const code = await this.docCodes.nextInTransaction(
        tx,
        organizationId,
        SALES_DOC_TYPES.STOCKTAKE,
      );
      const st = await tx.salesStocktake.create({
        data: {
          organizationId,
          code,
          note: [`SCOPE:${scope}`, String(products.length), dto.note?.trim() || '']
            .filter(Boolean)
            .join('|'),
          performedById: userId ?? null,
          lines: {
            create: products.map((p) => ({
              productId: p.id,
              systemQty: p.stockQty,
              countedQty: p.stockQty,
              variance: 0,
            })),
          },
        },
        include: {
          lines: {
            include: { product: { select: { id: true, name: true, sku: true, barcode: true } } },
          },
        },
      });
      await this.audit.log(
        {
          organizationId,
          userId,
          action: 'SALES_STOCKTAKE_CREATED',
          entityType: 'SALES_STOCKTAKE',
          entityId: st.id,
          metadata: { code, lineCount: products.length },
        },
        tx,
      );
      return st;
    });
    return {
      ...created,
      scope,
      productCount: products.length,
      catalogMatched: matched,
    };
  }

  async updateLines(
    organizationId: string,
    id: string,
    lines: Array<{ productId: string; countedQty: number; note?: string }>,
    userId?: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ status: SalesStocktakeStatus }>>`
        SELECT status FROM sales_stocktakes
        WHERE id = ${id} AND organization_id = ${organizationId}
        FOR UPDATE
      `;
      if (!locked.length) throw new NotFoundException('Không tìm thấy phiếu kiểm kê');
      if (locked[0]!.status !== SalesStocktakeStatus.DRAFT) {
        throw new BadRequestException('Chỉ sửa phiếu kiểm kê nháp');
      }
      for (const line of lines) {
        const counted = Math.max(0, Math.trunc(Number(line.countedQty) || 0));
        const row = await tx.salesStocktakeLine.findFirst({
          where: { stocktakeId: id, productId: line.productId },
        });
        if (!row) continue;
        const variance = counted - row.systemQty;
        await tx.salesStocktakeLine.update({
          where: { id: row.id },
          data: {
            countedQty: counted,
            variance,
            note: line.note !== undefined ? line.note?.trim() || null : row.note,
          },
        });
      }
      await this.audit.log(
        {
          organizationId,
          userId,
          action: 'SALES_STOCKTAKE_UPDATED',
          entityType: 'SALES_STOCKTAKE',
          entityId: id,
          metadata: { lineUpdates: lines.length },
        },
        tx,
      );
    });
    return this.get(organizationId, id);
  }

  /**
   * Xác nhận kiểm kê: mỗi dòng variance ≠ 0 → ADJUST (delta = variance).
   * Append-only movements; không sửa lịch sử cũ.
   */
  async confirm(organizationId: string, id: string, userId?: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<
          Array<{ id: string; status: SalesStocktakeStatus; code: string }>
        >`
          SELECT id, status, code FROM sales_stocktakes
          WHERE id = ${id} AND organization_id = ${organizationId}
          FOR UPDATE
        `;
        if (!locked.length) throw new NotFoundException('Không tìm thấy phiếu kiểm kê');
        if (locked[0]!.status === SalesStocktakeStatus.CANCELLED) {
          throw new BadRequestException('Phiếu đã hủy — không xác nhận được');
        }
        if (locked[0]!.status !== SalesStocktakeStatus.DRAFT) {
          // Idempotent confirm
          return this.get(organizationId, id);
        }

        const lines = await tx.salesStocktakeLine.findMany({ where: { stocktakeId: id } });
        const adjustments: Array<{ productId: string; delta: number }> = [];

        for (const line of lines) {
          if (line.variance === 0) continue;
          await this.applyVarianceAdjust(tx, {
            organizationId,
            productId: line.productId,
            delta: line.variance,
            reason: `Kiểm kê ${locked[0]!.code}`,
            userId,
            referenceId: id,
          });
          adjustments.push({ productId: line.productId, delta: line.variance });
        }

        await tx.salesStocktake.update({
          where: { id },
          data: {
            status: SalesStocktakeStatus.CONFIRMED,
            confirmedAt: new Date(),
            confirmedById: userId ?? null,
          },
        });

        await this.audit.log(
          {
            organizationId,
            userId,
            action: 'SALES_STOCKTAKE_CONFIRMED',
            entityType: 'SALES_STOCKTAKE',
            entityId: id,
            metadata: { code: locked[0]!.code, adjustments },
          },
          tx,
        );

        return tx.salesStocktake.findFirstOrThrow({
          where: { id, organizationId },
          include: {
            lines: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    sku: true,
                    barcode: true,
                    unit: true,
                    stockQty: true,
                  },
                },
              },
              orderBy: { product: { name: 'asc' } },
            },
          },
        });
      },
      { timeout: 30_000 },
    );
  }

  private async applyVarianceAdjust(
    tx: StockTx,
    opts: {
      organizationId: string;
      productId: string;
      delta: number;
      reason: string;
      userId?: string;
      referenceId: string;
    },
  ) {
    const { organizationId, productId, delta, reason, userId, referenceId } = opts;
    if (delta > 0) {
      await this.inventory.lockProductForStock(tx, organizationId, productId);
      const batchCode = `KK-${Date.now().toString(36).toUpperCase()}`;
      const product = await tx.salesProduct.findFirstOrThrow({
        where: { id: productId, organizationId },
      });
      const batch = await tx.salesStockBatch.create({
        data: {
          organizationId,
          productId,
          batchCode,
          quantity: delta,
          remainingQuantity: delta,
          importedAt: new Date(),
          unitCost: product.costPrice,
        },
      });
      await this.inventory.syncProductStock(tx, organizationId, productId);
      await tx.salesStockMovement.create({
        data: {
          organizationId,
          type: 'ADJUST',
          productId,
          quantity: delta,
          reason,
          performedById: userId ?? null,
          referenceType: 'STOCKTAKE',
          referenceId,
          lines: { create: [{ batchId: batch.id, quantity: delta }] },
        },
      });
      return;
    }

    // delta < 0 — trừ FEFO sellable trước, rồi write-off lô hết hạn (kiểm kê vật lý)
    const need = Math.abs(delta);
    await this.inventory.lockProductForStock(tx, organizationId, productId);
    await this.inventory.lockBatchesForProduct(tx, organizationId, productId);

    let left = need;
    const alloc: Array<{ batchId: string; quantity: number }> = [];
    const today = this.todayStart();

    const sellable = await tx.salesStockBatch.findMany({
      where: {
        organizationId,
        productId,
        remainingQuantity: { gt: 0 },
        OR: [{ expiryDate: null }, { expiryDate: { gte: today } }],
      },
      orderBy: [{ expiryDate: 'asc' }, { importedAt: 'asc' }],
    });
    sellable.sort((a, b) => {
      if (a.expiryDate && b.expiryDate) {
        const d = a.expiryDate.getTime() - b.expiryDate.getTime();
        if (d !== 0) return d;
      } else if (a.expiryDate && !b.expiryDate) return -1;
      else if (!a.expiryDate && b.expiryDate) return 1;
      return a.importedAt.getTime() - b.importedAt.getTime();
    });

    for (const batch of sellable) {
      if (left <= 0) break;
      const take = Math.min(batch.remainingQuantity, left);
      await tx.salesStockBatch.update({
        where: { id: batch.id },
        data: { remainingQuantity: batch.remainingQuantity - take },
      });
      alloc.push({ batchId: batch.id, quantity: take });
      left -= take;
    }

    if (left > 0) {
      const expired = await tx.salesStockBatch.findMany({
        where: {
          organizationId,
          productId,
          remainingQuantity: { gt: 0 },
          expiryDate: { lt: today },
        },
        orderBy: [{ expiryDate: 'asc' }, { importedAt: 'asc' }],
      });
      for (const batch of expired) {
        if (left <= 0) break;
        const fresh = await tx.salesStockBatch.findFirstOrThrow({ where: { id: batch.id } });
        const take = Math.min(fresh.remainingQuantity, left);
        if (take <= 0) continue;
        await tx.salesStockBatch.update({
          where: { id: fresh.id },
          data: { remainingQuantity: fresh.remainingQuantity - take },
        });
        alloc.push({ batchId: fresh.id, quantity: take });
        left -= take;
      }
    }

    if (left > 0) {
      throw new BadRequestException(
        `Kiểm kê giảm tồn thất bại — thiếu ${left} trên hệ thống (product ${productId})`,
      );
    }

    await this.inventory.syncProductStock(tx, organizationId, productId);
    await tx.salesStockMovement.create({
      data: {
        organizationId,
        type: 'ADJUST',
        productId,
        quantity: -need,
        reason,
        performedById: userId ?? null,
        referenceType: 'STOCKTAKE',
        referenceId,
        lines: { create: alloc.map((a) => ({ batchId: a.batchId, quantity: a.quantity })) },
      },
    });
  }

  async cancel(organizationId: string, id: string, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ status: SalesStocktakeStatus; code: string }>>`
        SELECT status, code FROM sales_stocktakes
        WHERE id = ${id} AND organization_id = ${organizationId}
        FOR UPDATE
      `;
      if (!locked.length) throw new NotFoundException('Không tìm thấy phiếu kiểm kê');
      const row = locked[0]!;
      if (row.status === SalesStocktakeStatus.CONFIRMED) {
        throw new BadRequestException('Phiếu đã xác nhận — không hủy được');
      }
      if (row.status === SalesStocktakeStatus.CANCELLED) {
        return tx.salesStocktake.findFirstOrThrow({ where: { id, organizationId } });
      }

      const updated = await tx.salesStocktake.update({
        where: { id },
        data: { status: SalesStocktakeStatus.CANCELLED },
      });
      await this.audit.log(
        {
          organizationId,
          userId,
          action: 'SALES_STOCKTAKE_CANCELLED',
          entityType: 'SALES_STOCKTAKE',
          entityId: id,
          metadata: { code: row.code },
        },
        tx,
      );
      return updated;
    });
  }
}
