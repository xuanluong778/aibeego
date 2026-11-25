import { BadRequestException, Injectable } from '@nestjs/common';
import {
  Prisma,
  SalesOrderStatus,
  SalesPaymentKind,
  SalesReturnDocStatus,
  SalesStockMovementType,
} from '@marketingspa/database';
import { costWarningLines } from './sales-cost-basis.util';
import type { ReturnAllocationResult } from './sales-return-allocation.util';
import { resolveSalesReportRange } from '@marketingspa/shared';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { TenantKpiCacheService } from '../common/services/tenant-kpi-cache.service';
import { rollupMovementCogs } from './sales-report-cogs.util';

/**
 * Chính sách ghi nhận (Prompt 2):
 * - orderValue: tổng đơn tạo trong kỳ (không DRAFT/CANCELLED)
 * - recognizedRevenue: doanh thu xuất theo exportedAt; netRecognizedRevenue trừ doanh thu đảo (allocation trả hàng)
 * - collected / refunded / netCollected: tiền thu/hoàn theo paidAt trong kỳ (tách khỏi trả hàng)
 * - cogs: OUTBOUND − RETURN_IN trong kỳ (createdAt UTC), từ snapshot allocation — không dùng giá danh mục hiện tại
 */
@Injectable()
export class SalesReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly kpiCache?: TenantKpiCacheService,
  ) {}

  async getOrgReportTimezone(organizationId: string): Promise<string> {
    const org = await this.prisma.organization.findFirstOrThrow({
      where: { id: organizationId },
      select: { salesReportTimezone: true },
    });
    return org.salesReportTimezone?.trim() || 'Asia/Ho_Chi_Minh';
  }

  resolveRange(
    organizationId: string,
    opts: { preset?: string; from?: string; to?: string },
    timeZone?: string,
  ) {
    try {
      return resolveSalesReportRange({
        preset: opts.preset,
        from: opts.from,
        to: opts.to,
        timeZone: timeZone ?? undefined,
      });
    } catch (e) {
      throw new BadRequestException(e instanceof Error ? e.message : 'Khoảng ngày không hợp lệ');
    }
  }

  async summary(
    organizationId: string,
    opts: { preset?: string; from?: string; to?: string },
  ) {
    const timeZone = await this.getOrgReportTimezone(organizationId);
    const range = this.resolveRange(organizationId, opts, timeZone);
    const { fromUtc, toUtc, preset, fromDate, toDate } = range;

    const cacheName = `sales-sum:v2:${preset}:${timeZone}:${fromDate}:${toDate}`;
    const cached = await this.kpiCache?.getJson<unknown>(organizationId, cacheName);
    if (cached) return cached;

    const orderWhereCreated: Prisma.SalesOrderWhereInput = {
      organizationId,
      createdAt: { gte: fromUtc, lte: toUtc },
      status: { notIn: [SalesOrderStatus.DRAFT, SalesOrderStatus.CANCELLED] },
    };

    const [
      orderCountCreated,
      orderValueAgg,
      exportedOrders,
      payments,
      refunds,
      stockMovements,
      returnsInPeriod,
    ] = await Promise.all([
        this.prisma.salesOrder.count({ where: orderWhereCreated }),
        this.prisma.salesOrder.aggregate({
          where: orderWhereCreated,
          _sum: { total: true, discount: true, shippingFee: true },
        }),
        this.prisma.salesOrder.findMany({
          where: {
            organizationId,
            exportedAt: { gte: fromUtc, lte: toUtc },
            status: {
              notIn: [SalesOrderStatus.DRAFT, SalesOrderStatus.CANCELLED],
            },
          },
          select: {
            id: true,
            customerId: true,
            customerName: true,
            total: true,
            discount: true,
            shippingFee: true,
            status: true,
            amountPaid: true,
            items: {
              select: {
                id: true,
                productId: true,
                productName: true,
                quantity: true,
                returnedQty: true,
                totalPrice: true,
                unitPrice: true,
                lineDiscount: true,
              },
            },
          },
        }),
        this.prisma.salesPayment.aggregate({
          where: {
            organizationId,
            kind: SalesPaymentKind.PAYMENT,
            paidAt: { gte: fromUtc, lte: toUtc },
          },
          _sum: { amount: true },
          _count: true,
        }),
        this.prisma.salesPayment.aggregate({
          where: {
            organizationId,
            kind: SalesPaymentKind.REFUND,
            paidAt: { gte: fromUtc, lte: toUtc },
          },
          _sum: { amount: true },
          _count: true,
        }),
        this.prisma.salesStockMovement.findMany({
          where: {
            organizationId,
            createdAt: { gte: fromUtc, lte: toUtc },
            type: {
              in: [SalesStockMovementType.OUTBOUND, SalesStockMovementType.RETURN_IN],
            },
          },
          select: {
            type: true,
            productId: true,
            lines: {
              select: {
                quantity: true,
                unitCost: true,
                costAmount: true,
                costBasis: true,
              },
            },
          },
        }),
        this.prisma.salesReturn.findMany({
          where: {
            organizationId,
            status: SalesReturnDocStatus.CONFIRMED,
            confirmedAt: { gte: fromUtc, lte: toUtc },
          },
          select: {
            allocationSnapshot: true,
            refundAmount: true,
          },
        }),
      ]);

    const orderValue = Number(orderValueAgg._sum.total ?? 0);

    let recognizedRevenue = 0;
    const productAgg = new Map<
      string,
      { productId: string; name: string; qty: number; revenue: number; cogs: number }
    >();
    const customerAgg = new Map<
      string,
      { customerId: string; name: string; orders: number; revenue: number }
    >();

    for (const o of exportedOrders) {
      const cust = customerAgg.get(o.customerId) || {
        customerId: o.customerId,
        name: o.customerName,
        orders: 0,
        revenue: 0,
      };
      cust.orders += 1;
      let orderRecognized = 0;

      for (const it of o.items) {
        const netQty = Math.max(0, it.quantity - it.returnedQty);
        if (netQty <= 0) continue;
        const lineTotal = Number(it.totalPrice);
        const lineRev = it.quantity > 0 ? (lineTotal * netQty) / it.quantity : 0;
        orderRecognized += lineRev;
        if (it.productId) {
          const row = productAgg.get(it.productId) || {
            productId: it.productId,
            name: it.productName,
            qty: 0,
            revenue: 0,
            cogs: 0,
          };
          row.qty += netQty;
          row.revenue += lineRev;
          productAgg.set(it.productId, row);
        }
      }
      recognizedRevenue += orderRecognized;
      cust.revenue += orderRecognized;
      customerAgg.set(o.customerId, cust);
    }

    let returnRevenueReversal = 0;
    let refundObligationSuggested = 0;
    for (const r of returnsInPeriod) {
      const snap = r.allocationSnapshot as ReturnAllocationResult | null;
      returnRevenueReversal += snap?.totals?.revenueReversal ?? 0;
      refundObligationSuggested += snap?.totals?.suggestedRefundMax ?? 0;
    }
    returnRevenueReversal = Math.round(returnRevenueReversal * 100) / 100;
    refundObligationSuggested = Math.round(refundObligationSuggested * 100) / 100;
    const netRecognizedRevenue = Math.round((recognizedRevenue - returnRevenueReversal) * 100) / 100;

    const cogsRollup = rollupMovementCogs(stockMovements);
    const cogsNet = Math.round(cogsRollup.cogsNet * 100) / 100;

    for (const row of productAgg.values()) {
      const share =
        recognizedRevenue > 0 ? row.revenue / recognizedRevenue : 0;
      row.cogs = Math.round(cogsNet * share * 100) / 100;
    }

    const collected = Number(payments._sum.amount ?? 0);
    const refunded = Number(refunds._sum.amount ?? 0);
    const netCollected = Math.round((collected - refunded) * 100) / 100;
    const grossProfit = Math.round((netRecognizedRevenue - cogsNet) * 100) / 100;
    const aov = exportedOrders.length
      ? recognizedRevenue / exportedOrders.length
      : 0;

    const cancelled = await this.prisma.salesOrder.count({
      where: {
        organizationId,
        createdAt: { gte: fromUtc, lte: toUtc },
        status: SalesOrderStatus.CANCELLED,
      },
    });
    const returned = await this.prisma.salesOrder.count({
      where: {
        organizationId,
        exportedAt: { gte: fromUtc, lte: toUtc },
        status: {
          in: [SalesOrderStatus.RETURNED, SalesOrderStatus.PARTIALLY_RETURNED],
        },
      },
    });

    const invRows = await this.prisma.$queryRaw<
      Array<{
        value: string | null;
        unknown_lines: bigint;
        zero_confirmed: bigint;
      }>
    >`
      SELECT
        COALESCE(SUM(b.remaining_quantity * b.unit_cost), 0)::text AS value,
        COALESCE(SUM(CASE WHEN b.cost_basis = 'UNKNOWN' OR (b.cost_basis IS NULL AND b.unit_cost <= 0) THEN b.remaining_quantity ELSE 0 END), 0) AS unknown_lines,
        COALESCE(SUM(CASE WHEN b.cost_basis = 'CONFIRMED' AND b.unit_cost = 0 THEN b.remaining_quantity ELSE 0 END), 0) AS zero_confirmed
      FROM sales_stock_batches b
      WHERE b.organization_id = ${organizationId}
        AND b.remaining_quantity > 0
    `;
    const inventoryValue = Number(invRows[0]?.value ?? 0);
    const inventoryUnknownQty = Number(invRows[0]?.unknown_lines ?? 0);
    const inventoryZeroConfirmedQty = Number(invRows[0]?.zero_confirmed ?? 0);

    const allProducts = await this.prisma.salesProduct.findMany({
      where: { organizationId, isActive: true },
      select: {
        id: true,
        name: true,
        sku: true,
        stockQty: true,
        minStockQty: true,
      },
    });
    const stockMap = await this.inventory.stockBreakdownMany(
      this.prisma,
      organizationId,
      allProducts.map((p) => p.id),
    );
    let outOfStock = 0;
    let lowStock = 0;
    const stockRows = allProducts.map((p) => {
      const br = stockMap.get(p.id) || {
        physicalQty: 0,
        sellableQty: 0,
        expiredQty: 0,
      };
      if (br.sellableQty <= 0) outOfStock += 1;
      else if (br.sellableQty <= p.minStockQty) lowStock += 1;
      return {
        productId: p.id,
        name: p.name,
        sku: p.sku,
        ...br,
        stockQty: p.stockQty,
        minStockQty: p.minStockQty,
      };
    });

    const todayUtc = fromUtc;
    const in30End = new Date(toUtc.getTime() + 30 * 86400000);
    const expiredBatches = await this.prisma.salesStockBatch.findMany({
      where: {
        organizationId,
        remainingQuantity: { gt: 0 },
        expiryDate: { lt: todayUtc },
      },
      include: { product: { select: { id: true, name: true, sku: true } } },
      take: 50,
    });
    const expiringBatches = await this.prisma.salesStockBatch.findMany({
      where: {
        organizationId,
        remainingQuantity: { gt: 0 },
        expiryDate: { gte: todayUtc, lte: in30End },
      },
      include: { product: { select: { id: true, name: true, sku: true } } },
      take: 50,
    });

    const topProducts = [...productAgg.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    const topCustomers = [...customerAgg.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const warnings = costWarningLines({
      unknownQty: cogsRollup.cogsUnknownQty,
      estimatedQty: cogsRollup.cogsEstimatedQty,
      confirmedZeroQty: cogsRollup.cogsConfirmedZeroQty,
      inventoryUnknownQty,
      inventoryZeroConfirmedQty,
    });

    const payload = {
      range: {
        preset,
        timeZone,
        from: fromDate,
        to: toDate,
        fromUtc: fromUtc.toISOString(),
        toUtc: toUtc.toISOString(),
      },
      policy: {
        orderValue: 'Đơn tạo trong kỳ (createdAt, TZ org)',
        recognizedRevenue: 'Dòng xuất trong kỳ (exportedAt), trừ returnedQty trên dòng',
        returnRevenueReversal: 'Doanh thu đảo từ allocation_snapshot trả hàng (confirmedAt)',
        netRecognizedRevenue: 'recognizedRevenue − returnRevenueReversal',
        collected: 'Thu tiền paidAt trong kỳ (SalesPayment PAYMENT)',
        refunded: 'Hoàn tiền paidAt trong kỳ (SalesPayment REFUND) — tách phiếu trả',
        refundObligationSuggested: 'Gợi ý hoàn tối đa trên phiếu trả, không tự ghi hoàn tiền',
        cogs: 'OUTBOUND − RETURN_IN trong kỳ, cost snapshot allocation',
        partialReturnAllocation: 'CK & ship phân bổ theo tỷ trọng merchandise; remainder cent',
      },
      warnings,
      kpis: {
        orderValue,
        orderCountCreated,
        recognizedRevenue,
        returnRevenueReversal,
        netRecognizedRevenue,
        refundObligationSuggested,
        exportedOrderCount: exportedOrders.length,
        aov,
        collected,
        refunded,
        netCollected,
        cogs: cogsNet,
        cogsConfirmed: cogsRollup.cogsConfirmed,
        cogsEstimated: cogsRollup.cogsEstimated,
        cogsUnknownQty: cogsRollup.cogsUnknownQty,
        grossProfit,
        cancelledOrders: cancelled,
        returnedOrders: returned,
        inventoryValue,
        inventoryUnknownQty,
        outOfStock,
        lowStock,
        paymentCount: payments._count,
        refundCount: refunds._count,
        expiredBatches: expiredBatches.length,
        expiring30Batches: expiringBatches.length,
        discountInPeriod: Number(orderValueAgg._sum.discount ?? 0),
        shippingInPeriod: Number(orderValueAgg._sum.shippingFee ?? 0),
      },
      topProducts,
      topCustomers,
      expiredBatches: expiredBatches.map((b) => ({
        batchId: b.id,
        batchCode: b.batchCode,
        productId: b.productId,
        productName: b.product.name,
        remainingQuantity: b.remainingQuantity,
        expiryDate: b.expiryDate,
      })),
      expiringBatches: expiringBatches.map((b) => ({
        batchId: b.id,
        batchCode: b.batchCode,
        productId: b.productId,
        productName: b.product.name,
        remainingQuantity: b.remainingQuantity,
        expiryDate: b.expiryDate,
      })),
      lowSellable: stockRows
        .filter((r) => r.sellableQty > 0 && r.sellableQty <= r.minStockQty)
        .slice(0, 30),
      outOfSellable: stockRows.filter((r) => r.sellableQty <= 0).slice(0, 30),
    };
    await this.kpiCache?.setJson(organizationId, cacheName, payload, 20);
    return payload;
  }

  async exportCsv(
    organizationId: string,
    opts: { preset?: string; from?: string; to?: string },
  ) {
    const data = (await this.summary(organizationId, opts)) as {
      kpis: Record<string, number>;
      topProducts: Array<Record<string, unknown>>;
      topCustomers: Array<Record<string, unknown>>;
      warnings: string[];
      range: { preset: string };
    };
    const k = data.kpis;
    const lines: string[] = [];
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    lines.push('section,metric,value');
    for (const [key, val] of Object.entries(k)) {
      lines.push(`kpi,${key},${val}`);
    }
    lines.push('section,productId,name,qty,revenue,cogs');
    for (const p of data.topProducts) {
      lines.push(
        ['topProduct', p.productId, esc(p.name), p.qty, p.revenue, p.cogs].join(','),
      );
    }
    lines.push('section,customerId,name,orders,revenue');
    for (const c of data.topCustomers) {
      lines.push(
        ['topCustomer', c.customerId, esc(c.name), c.orders, c.revenue].join(','),
      );
    }
    for (const w of data.warnings ?? []) {
      lines.push(`warning,,${esc(w)}`);
    }
    return {
      filename: `sales-report-${data.range.preset}-${Date.now()}.csv`,
      contentType: 'text/csv; charset=utf-8',
      body: '\uFEFF' + lines.join('\n'),
    };
  }
}

void Prisma;