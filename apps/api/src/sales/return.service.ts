import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  SalesOrderStatus,
  SalesReturnDocStatus,
} from '@marketingspa/database';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { InventoryService } from './inventory.service';
import {
  loadSalesIdempotentResult,
  requireIdempotencyKey,
  saveSalesIdempotentResult,
  stablePayloadHash,
} from './sales-idempotency.util';
import {
  allocatePartialReturn,
  type ReturnAllocationResult,
} from './sales-return-allocation.util';
import { SalesDocumentCodeService, SALES_DOC_TYPES } from './sales-document-code.service';

@Injectable()
export class SalesReturnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly inventory: InventoryService,
    private readonly docCodes: SalesDocumentCodeService,
  ) {}

  private decimal(n: number) {
    return new Prisma.Decimal(Number(n) || 0);
  }

  async list(organizationId: string, orderId?: string) {
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

  async get(organizationId: string, id: string) {
    const row = await this.prisma.salesReturn.findFirst({
      where: { id, organizationId },
      include: {
        items: true,
        order: { select: { id: true, code: true, status: true, exportedAt: true } },
      },
    });
    if (!row) throw new NotFoundException('Không tìm thấy phiếu trả');
    return {
      ...row,
      refundAmount: Number(row.refundAmount),
      items: row.items.map((i) => ({ ...i, refundAmount: Number(i.refundAmount) })),
    };
  }

  async preview(
    organizationId: string,
    dto: {
      orderId: string;
      items: Array<{ orderItemId: string; quantity: number }>;
    },
  ) {
    const order = await this.prisma.salesOrder.findFirst({
      where: { id: dto.orderId, organizationId },
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (!order.exportedAt) throw new BadRequestException('Đơn chưa xuất kho — không trả hàng kho');
    const orderItems = await this.prisma.salesOrderItem.findMany({ where: { orderId: order.id } });
    const prior = await this.prisma.salesReturn.findMany({
      where: { organizationId, orderId: order.id, status: 'CONFIRMED' },
      select: { allocationSnapshot: true },
    });
    let priorReturnedMerchandise = 0;
    for (const pr of prior) {
      const snap = pr.allocationSnapshot as { totals?: { merchandise?: number } } | null;
      priorReturnedMerchandise += snap?.totals?.merchandise ?? 0;
    }
    const allocation = allocatePartialReturn({
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      shippingFee: Number(order.shippingFee),
      total: Number(order.total),
      amountPaid: Number(order.amountPaid),
      priorReturnedMerchandise,
      orderLines: orderItems.map((oi) => ({
        orderItemId: oi.id,
        quantity: oi.quantity,
        returnedQtyBefore: oi.returnedQty,
        totalPrice: Number(oi.totalPrice),
      })),
      returnLines: dto.items.map((it) => ({
        orderItemId: it.orderItemId,
        quantity: Math.trunc(it.quantity),
      })),
    });
    return {
      allocation,
      amountCollected: undefined,
      amountPaid: Number(order.amountPaid),
      amountDue: Math.max(0, Math.round((Number(order.total) - Number(order.amountPaid)) * 100) / 100),
      suggestedRefundMax: allocation.totals.suggestedRefundMax,
    };
  }

  /**
   * Tạo + xác nhận phiếu trả (một phần/toàn phần) trong 1 transaction.
   * Stock: RETURN_IN idempotent theo SALES_RETURN + returnId::productId.
   */
  async createAndConfirm(
    organizationId: string,
    dto: {
      orderId: string;
      idempotencyKey: string;
      reason?: string;
      note?: string;
      disposition?: 'RESTOCK' | 'HOLD' | 'SCRAP';
      refundAmount?: number;
      items: Array<{
        orderItemId: string;
        quantity: number;
        refundAmount?: number;
        reason?: string;
      }>;
    },
    userId?: string,
  ) {
    if (!dto.items?.length) throw new BadRequestException('Thiếu dòng trả hàng');
    const seenItems = new Set<string>();
    for (const it of dto.items) {
      if (seenItems.has(it.orderItemId)) {
        throw new BadRequestException(
          `Trùng orderItemId trong cùng phiếu trả: ${it.orderItemId}`,
        );
      }
      seenItems.add(it.orderItemId);
    }

    const idempotencyKey = requireIdempotencyKey(dto.idempotencyKey);
    const payloadHash = stablePayloadHash({
      orderId: dto.orderId,
      reason: dto.reason?.trim() || null,
      note: dto.note?.trim() || null,
      disposition: dto.disposition ?? 'RESTOCK',
      refundAmount: dto.refundAmount ?? null,
      items: dto.items.map((i) => ({
        orderItemId: i.orderItemId,
        quantity: Math.trunc(Number(i.quantity) || 0),
        refundAmount: i.refundAmount ?? null,
        reason: i.reason?.trim() || null,
      })),
    });

    return this.prisma.$transaction(
      async (tx) => {
        const replay = await loadSalesIdempotentResult<{ returnId: string }>(tx, {
          organizationId,
          operation: 'ORDER_RETURN',
          idempotencyKey,
          payloadHash,
        });
        if (replay) {
          const row = await tx.salesReturn.findFirstOrThrow({
            where: { id: replay.returnId, organizationId },
            include: { items: true },
          });
          const order = await tx.salesOrder.findFirst({
            where: { id: dto.orderId, organizationId },
            select: { status: true },
          });
          return {
            ...row,
            refundAmount: Number(row.refundAmount),
            items: row.items.map((i) => ({ ...i, refundAmount: Number(i.refundAmount) })),
            orderStatus: order?.status,
          };
        }
        const locked = await tx.$queryRaw<
          Array<{
            id: string;
            code: string;
            status: SalesOrderStatus;
            exported_at: Date | null;
            subtotal: Prisma.Decimal;
            discount: Prisma.Decimal;
            shipping_fee: Prisma.Decimal;
            total: Prisma.Decimal;
            amount_paid: Prisma.Decimal;
          }>
        >`
          SELECT id, code, status, exported_at, subtotal, discount, shipping_fee, total, amount_paid
          FROM sales_orders
          WHERE id = ${dto.orderId} AND organization_id = ${organizationId}
          FOR UPDATE
        `;
        if (!locked.length) throw new NotFoundException('Không tìm thấy đơn hàng');
        const order = locked[0]!;
        if (!order.exported_at) {
          throw new BadRequestException('Đơn chưa xuất kho — không trả hàng kho');
        }
        if (
          order.status === SalesOrderStatus.CANCELLED ||
          order.status === SalesOrderStatus.RETURNED
        ) {
          throw new BadRequestException('Đơn đã hủy/trả hết — không trả thêm');
        }

        const code = await this.docCodes.nextInTransaction(
          tx,
          organizationId,
          SALES_DOC_TYPES.RETURN,
        );
        const orderItems = await tx.salesOrderItem.findMany({
          where: { orderId: dto.orderId },
        });
        const byId = new Map(orderItems.map((i) => [i.id, i]));

        const priorReturns = await tx.salesReturn.findMany({
          where: {
            organizationId,
            orderId: dto.orderId,
            status: SalesReturnDocStatus.CONFIRMED,
          },
          select: { allocationSnapshot: true },
        });
        let priorReturnedMerchandise = 0;
        for (const pr of priorReturns) {
          const snap = pr.allocationSnapshot as ReturnAllocationResult | null;
          priorReturnedMerchandise += snap?.totals?.merchandise ?? 0;
        }

        let allocation: ReturnAllocationResult;
        try {
          allocation = allocatePartialReturn({
            subtotal: Number(locked[0]!.subtotal),
            discount: Number(locked[0]!.discount),
            shippingFee: Number(locked[0]!.shipping_fee),
            total: Number(locked[0]!.total),
            amountPaid: Number(locked[0]!.amount_paid),
            priorReturnedMerchandise,
            orderLines: orderItems.map((oi) => ({
              orderItemId: oi.id,
              quantity: oi.quantity,
              returnedQtyBefore: oi.returnedQty,
              totalPrice: Number(oi.totalPrice),
            })),
            returnLines: dto.items.map((it) => ({
              orderItemId: it.orderItemId,
              quantity: Math.trunc(Number(it.quantity) || 0),
            })),
          });
        } catch (e) {
          throw new BadRequestException(
            e instanceof Error ? e.message : 'Phân bổ trả hàng không hợp lệ',
          );
        }

        const lines: Array<{
          orderItemId: string;
          productId: string | null;
          quantity: number;
          refundAmount: number;
          reason?: string;
        }> = [];

        for (const it of dto.items) {
          const oi = byId.get(it.orderItemId);
          if (!oi) throw new BadRequestException(`Dòng đơn không hợp lệ: ${it.orderItemId}`);
          const qty = Math.trunc(Number(it.quantity) || 0);
          const allocLine = allocation.lines.find((l) => l.orderItemId === it.orderItemId);
          if (!allocLine || allocLine.quantity !== qty) {
            throw new BadRequestException('Phân bổ dòng trả không khớp');
          }
          const lineRefund =
            it.refundAmount !== undefined ? Math.max(0, Number(it.refundAmount) || 0) : 0;
          if (lineRefund > allocLine.suggestedRefundMax + 0.009) {
            throw new BadRequestException(
              `Hoàn tiền dòng vượt nghĩa vụ (${lineRefund} > ${allocLine.suggestedRefundMax})`,
            );
          }
          lines.push({
            orderItemId: oi.id,
            productId: oi.productId,
            quantity: qty,
            refundAmount: lineRefund,
            reason: it.reason,
          });
        }

        const refundAmount =
          dto.refundAmount !== undefined
            ? Math.max(0, Number(dto.refundAmount) || 0)
            : lines.reduce((s, l) => s + l.refundAmount, 0);

        if (refundAmount > allocation.totals.suggestedRefundMax + 0.009) {
          throw new BadRequestException(
            `Hoàn tiền phiếu trả vượt nghĩa vụ tối đa ${allocation.totals.suggestedRefundMax}`,
          );
        }

        const ret = await tx.salesReturn.create({
          data: {
            organizationId,
            orderId: dto.orderId,
            code,
            status: SalesReturnDocStatus.CONFIRMED,
            reason: dto.reason?.trim() || null,
            note: [dto.disposition ? `DISPOSITION:${dto.disposition}` : '', dto.note?.trim() || '']
              .filter(Boolean)
              .join(' ') || null,
            refundAmount: this.decimal(refundAmount),
            allocationSnapshot: allocation as unknown as Prisma.InputJsonValue,
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

        const disposition = dto.disposition ?? 'RESTOCK';
        for (const l of lines) {
          if (l.productId && disposition === 'RESTOCK') {
            await this.inventory.returnPartialForSalesOrder(tx, {
              organizationId,
              orderId: dto.orderId,
              orderItemId: l.orderItemId,
              productId: l.productId,
              quantity: l.quantity,
              performedById: userId,
              reason: dto.reason || `Trả hàng ${code}`,
              referenceType: 'SALES_RETURN',
              referenceId: `${ret.id}::${l.orderItemId}`,
            });
          }
          await tx.salesOrderItem.update({
            where: { id: l.orderItemId },
            data: { returnedQty: { increment: l.quantity } },
          });
        }

        const refreshed = await tx.salesOrderItem.findMany({ where: { orderId: dto.orderId } });
        const allReturned = refreshed.every((i) => i.returnedQty >= i.quantity);
        const anyReturned = refreshed.some((i) => i.returnedQty > 0);

        let nextStatus: SalesOrderStatus = order.status;
        if (allReturned) nextStatus = SalesOrderStatus.RETURNED;
        else if (anyReturned) nextStatus = SalesOrderStatus.PARTIALLY_RETURNED;

        await tx.salesOrder.update({
          where: { id: dto.orderId },
          data: {
            status: nextStatus,
            ...(allReturned ? { returnedAt: new Date() } : {}),
          },
        });

        await this.audit.log(
          {
            organizationId,
            userId,
            action: 'SALES_RETURN_CONFIRMED',
            entityType: 'SALES_RETURN',
            entityId: ret.id,
            metadata: {
              code,
              orderId: dto.orderId,
              refundAmount,
              disposition: dto.disposition ?? 'RESTOCK',
              allocation: allocation.totals,
              amountReceivableAfter: allocation.amountReceivableAfter,
              lines: lines.map((l) => ({
                orderItemId: l.orderItemId,
                productId: l.productId,
                quantity: l.quantity,
              })),
              nextStatus,
            },
          },
          tx,
        );

        const payload = {
          ...ret,
          refundAmount: Number(ret.refundAmount),
          items: ret.items.map((i) => ({ ...i, refundAmount: Number(i.refundAmount) })),
          orderStatus: nextStatus,
          allocation,
        };
        await saveSalesIdempotentResult(tx, {
          organizationId,
          operation: 'ORDER_RETURN',
          idempotencyKey,
          payloadHash,
          resourceId: dto.orderId,
          resultJson: { returnId: ret.id },
        });
        return payload;
      },
      { timeout: 30_000 },
    );
  }
}
