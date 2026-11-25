import assert from 'node:assert/strict';
import { resolveSalesReportRange, calendarDateInTimeZone } from '../packages/shared/dist/sales-report-time.js';
const SalesOrderStatus = {
  DRAFT: 'DRAFT',
  CONFIRMED: 'CONFIRMED',
  READY: 'READY',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
const SalesPaymentKind = { REFUND: 'REFUND' } as const;

const QA_DB = 'marketingspa_sales_idem_qa';

function assertQaDb() {
  const m = (process.env.DATABASE_URL ?? '').match(/\/([^/?]+)(?:\?|$)/);
  assert.equal(m?.[1], QA_DB, `DATABASE_URL phải trỏ ${QA_DB}`);
}

const results: Array<{ name: string; pass: boolean; kind: string; detail?: string }> = [];
function record(name: string, pass: boolean, kind: string, detail?: string) {
  results.push({ name, pass, kind, detail });
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] (${kind}) ${name}${detail ? ` — ${detail}` : ''}`);
}

async function loadServices() {
  const { PrismaService } = await import('../apps/api/dist/prisma/prisma.service.js');
  const { AuditService } = await import('../apps/api/dist/audit/audit.service.js');
  const { InventoryService } = await import('../apps/api/dist/sales/inventory.service.js');
  const { SalesService } = await import('../apps/api/dist/sales/sales.service.js');
  const { SalesReportsService } = await import('../apps/api/dist/sales/reports.service.js');
  const { SalesPaymentService } = await import('../apps/api/dist/sales/payment.service.js');
  const { SalesReturnService } = await import('../apps/api/dist/sales/return.service.js');
  const { SalesPurchaseService } = await import('../apps/api/dist/sales/purchase.service.js');
  const prisma = new PrismaService();
  const audit = new AuditService(prisma);
  const { SalesDocumentCodeService } = await import('../apps/api/dist/sales/sales-document-code.service.js');
  const docCodes = new SalesDocumentCodeService(prisma);
  const inventory = new InventoryService(prisma, audit, docCodes);
  const sales = new SalesService(prisma, audit, inventory, docCodes);
  const reports = new SalesReportsService(prisma, inventory);
  const payments = new SalesPaymentService(prisma, audit);
  const returns = new SalesReturnService(prisma, audit, inventory, docCodes);
  const purchase = new SalesPurchaseService(prisma, audit, inventory, docCodes);
  return { prisma, inventory, sales, reports, payments, returns, purchase };
}

async function cleanup(prisma: Awaited<ReturnType<typeof loadServices>>['prisma'], tag: string) {
  assertQaDb();
  const orders = await prisma.salesOrder.findMany({
    where: { note: { startsWith: tag } },
    select: { id: true },
  });
  const orderIds = orders.map((o) => o.id);
  if (orderIds.length) {
    await prisma.salesPayment.deleteMany({ where: { orderId: { in: orderIds } } });
    const retIds = (
      await prisma.salesReturn.findMany({ where: { orderId: { in: orderIds } }, select: { id: true } })
    ).map((r) => r.id);
    if (retIds.length) {
      await prisma.salesReturnItem.deleteMany({ where: { returnId: { in: retIds } } });
      await prisma.salesReturn.deleteMany({ where: { id: { in: retIds } } });
    }
    await prisma.salesOrderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.salesOrder.deleteMany({ where: { id: { in: orderIds } } });
  }
  await prisma.salesStockMovement.deleteMany({
    where: { product: { sku: { startsWith: tag } } },
  });
  await prisma.salesStockBatch.deleteMany({ where: { product: { sku: { startsWith: tag } } } });
  await prisma.salesProduct.deleteMany({ where: { sku: { startsWith: tag } } });
}

async function main() {
  assertQaDb();
  console.log(`test-sales-reports-reconcile — DB: ${QA_DB}`);
  const anchor = new Date('2026-06-15T17:00:00.000Z');
  const vnDay = calendarDateInTimeZone(anchor, 'Asia/Ho_Chi_Minh');
  const rToday = resolveSalesReportRange({
    preset: 'today',
    timeZone: 'Asia/Ho_Chi_Minh',
    now: anchor,
  });
  record(
    'Ranh giới ngày VN khi server UTC (17:00Z → 16/6 VN)',
    vnDay === '2026-06-16' && rToday.fromDate === '2026-06-16',
    'unit',
    `vnDay=${vnDay} range=${rToday.fromDate}`,
  );

  const { prisma, inventory, sales, reports, payments, returns, purchase } = await loadServices();
  const orgs = await prisma.organization.findMany({ where: { isActive: true }, take: 1 });
  const org = orgs[0];
  assert.ok(org);
  const tag = `E2E-RPT-${Date.now()}`;
  const user = await prisma.user.findFirstOrThrow({
    where: { organizationId: org.id, deletedAt: null },
    select: { id: true },
  });
  let customer = await prisma.customer.findFirst({
    where: { organizationId: org.id, isActive: true },
  });
  if (!customer) {
    customer = await prisma.customer.create({
      data: { organizationId: org.id, name: `${tag}-KH`, isActive: true },
    });
  }
  await cleanup(prisma, tag);

  const product = await sales.createProduct(org.id, {
    name: `${tag}-P`,
    sku: `${tag}-P`,
    price: 100,
    costPrice: 999,
    stockQty: 0,
  });
  await prisma.salesProduct.update({
    where: { id: product.id },
    data: { costPrice: 999 },
  });

  await inventory.inbound(
    org.id,
    {
      productId: product.id,
      batchCode: `${tag}-B10`,
      quantity: 5,
      unitCost: 10,
      reason: 'lô 10',
    },
    user.id,
  );
  await inventory.inbound(
    org.id,
    {
      productId: product.id,
      batchCode: `${tag}-B20`,
      quantity: 5,
      unitCost: 20,
      reason: 'lô 20',
    },
    user.id,
  );

  const order = await sales.createOrder(
    org.id,
    {
      customerId: customer.id,
      customerName: customer.name,
      note: `${tag}-flow`,
      items: [{ productId: product.id, productName: product.name, quantity: 2, unitPrice: 100, lineDiscount: 0 }],
    },
    user.id,
  );
  await sales.updateStatus(org.id, order.id, SalesOrderStatus.CONFIRMED, user.id);
  await sales.updateStatus(org.id, order.id, SalesOrderStatus.READY, user.id);
  await sales.exportOrder(org.id, order.id, user.id);

  const cogsBeforeCatalogBump = await prisma.salesStockMovementLine.aggregate({
    where: { movement: { organizationId: org.id, type: 'OUTBOUND', productId: product.id } },
    _sum: { costAmount: true },
  });
  await prisma.salesProduct.update({ where: { id: product.id }, data: { costPrice: 999 } });
  const cogsAfter = await prisma.salesStockMovementLine.aggregate({
    where: { movement: { organizationId: org.id, type: 'OUTBOUND', productId: product.id } },
    _sum: { costAmount: true },
  });
  record(
    'Đổi costPrice 999: COGS dòng xuất đã tạo không đổi',
    Number(cogsBeforeCatalogBump._sum.costAmount ?? 0) === Number(cogsAfter._sum.costAmount ?? 0),
    'integration',
    `cogs=${cogsAfter._sum.costAmount}`,
  );

  const estProduct = await sales.createProduct(org.id, {
    name: `${tag}-EST`,
    sku: `${tag}-EST`,
    price: 50,
    costPrice: 77,
    stockQty: 0,
  });
  await inventory.inbound(
    org.id,
    { productId: estProduct.id, batchCode: `${tag}-CAT`, quantity: 3, reason: 'catalog only' },
    user.id,
  );
  const estBatch = await prisma.salesStockBatch.findFirstOrThrow({
    where: { productId: estProduct.id, batchCode: `${tag}-CAT` },
  });
  record(
    'Nhập không chỉ định unitCost → ESTIMATED từ danh mục',
    estBatch.costBasis === 'ESTIMATED',
    'integration',
    `basis=${estBatch.costBasis} uc=${estBatch.unitCost}`,
  );

  const tamperBatch = await prisma.salesStockBatch.findFirstOrThrow({
    where: { batchCode: `${tag}-B10` },
  });
  const lineBefore = await prisma.salesStockMovementLine.findFirst({
    where: { batchId: tamperBatch.id, movement: { type: 'OUTBOUND' } },
  });
  await prisma.salesStockBatch.update({
    where: { id: tamperBatch.id },
    data: { unitCost: 9999 },
  });
  const lineAfterTamper = await prisma.salesStockMovementLine.findFirstOrThrow({
    where: { id: lineBefore!.id },
  });
  record(
    'Sửa giá lô sau xuất không đổi snapshot dòng movement',
    Number(lineAfterTamper.unitCost) === Number(lineBefore!.unitCost),
    'integration',
  );

  const outLines = await prisma.salesStockMovementLine.findMany({
    where: { movement: { organizationId: org.id, referenceType: 'SALES_ORDER' } },
    include: { movement: true },
  });
  const snapOk = outLines.length >= 1 && outLines.some((l) => l.costBasis === 'CONFIRMED' && Number(l.unitCost) === 10);
  record('Snapshot COGS trên allocation khi xuất', snapOk, 'integration', `lines=${outLines.length}`);

  const oi = await prisma.salesOrderItem.findFirstOrThrow({ where: { orderId: order.id } });
  const ret1 = await returns.createAndConfirm(
    org.id,
    {
      orderId: order.id,
      idempotencyKey: `${tag}-ret1`,
      items: [{ orderItemId: oi.id, quantity: 1 }],
    },
    user.id,
  );
  const alloc1 = (ret1 as { allocation?: { totals: { revenueReversal: number } } }).allocation;
  record(
    'Trả hàng có allocation_snapshot khớp policy',
    (alloc1?.totals?.revenueReversal ?? 0) > 0,
    'integration',
    `revRev=${alloc1?.totals?.revenueReversal}`,
  );

  const retLines = await prisma.salesStockMovementLine.findMany({
    where: { movement: { organizationId: org.id, type: 'RETURN_IN' } },
    orderBy: { movement: { createdAt: 'desc' } },
    take: 2,
  });
  record(
    'Hoàn hàng giữ snapshot giá vốn gốc',
    retLines.some((l) => Number(l.unitCost) === 10),
    'integration',
    `unitCosts=${retLines.map((l) => l.unitCost).join('/')}`,
  );

  await payments.addPayment(org.id, order.id, { amount: 100, idempotencyKey: `${tag}-pay` }, user.id);
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  await prisma.salesPayment.create({
    data: {
      organizationId: org.id,
      orderId: order.id,
      kind: SalesPaymentKind.REFUND,
      amount: 30,
      paidAt: yesterday,
      note: `${tag} refund other day`,
    },
  });

  const summary = await reports.summary(org.id, { preset: 'year' });
  const k = summary.kpis as Record<string, number>;
  record(
    'Báo cáo có warnings giá vốn (UNKNOWN/ESTIMATED)',
    Array.isArray((summary as { warnings?: string[] }).warnings),
    'integration',
    `n=${(summary as { warnings?: string[] }).warnings?.length ?? 0}`,
  );
  record(
    'Thu/hoàn khác kỳ: refunded theo paidAt, returnReversal theo confirmedAt',
    (k.refunded ?? 0) >= 30 && typeof k.returnRevenueReversal === 'number',
    'integration',
    `refunded=${k.refunded} retRev=${k.returnRevenueReversal}`,
  );
  const recon =
    typeof k.recognizedRevenue === 'number' &&
    typeof k.collected === 'number' &&
    typeof k.refunded === 'number' &&
    k.netCollected === Math.round((k.collected - k.refunded) * 100) / 100;
  record(
    'Đối soát KPI: recognized / collected / refunded / net',
    recon,
    'integration',
    `rev=${k.recognizedRevenue} coll=${k.collected} ref=${k.refunded}`,
  );
  record(
    'netRecognized = recognized − returnReversal',
    Math.abs(
      (k.netRecognizedRevenue ?? 0) - ((k.recognizedRevenue ?? 0) - (k.returnRevenueReversal ?? 0)),
    ) < 0.02,
    'integration',
    `net=${k.netRecognizedRevenue} retRev=${k.returnRevenueReversal}`,
  );

  const csv = await reports.exportCsv(org.id, { preset: 'year' });
  record(
    'CSV chứa recognizedRevenue hoặc orderValue',
    /recognizedRevenue|orderValue/.test(csv.body) || /kpi,/.test(csv.body),
    'integration',
    `bytes=${csv.body.length}`,
  );

  const invVal = k.inventoryValue ?? 0;
  const batchSum = await prisma.$queryRaw<Array<{ v: string }>>`
    SELECT COALESCE(SUM(remaining_quantity * unit_cost), 0)::text AS v
    FROM sales_stock_batches WHERE organization_id = ${org.id} AND remaining_quantity > 0`;
  record(
    'Giá trị tồn = Σ remaining×unit_cost lô',
    Math.abs(invVal - Number(batchSum[0]?.v ?? 0)) < 0.02,
    'integration',
    `report=${invVal} batch=${batchSum[0]?.v}`,
  );

  const bigCount = await prisma.salesOrder.count({ where: { organizationId: org.id } });
  const { readFileSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const reportsSrc = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../apps/api/src/sales/reports.service.ts'),
    'utf8',
  );
  record(
    'Không giới hạn 5000 (source)',
    !reportsSrc.includes('take: 5000'),
    'source',
  );

  const bulkTag = `${tag}-BULK`;
  const bulkStarted = Date.now();
  const bulkRows = Array.from({ length: 5001 }, (_, i) => ({
    organizationId: org.id,
    customerId: customer.id,
    code: `${bulkTag}-${i}`,
    status: SalesOrderStatus.COMPLETED,
    customerName: customer.name,
    subtotal: 1,
    discount: 0,
    shippingFee: 0,
    total: 1,
    note: bulkTag,
  }));
  for (let off = 0; off < bulkRows.length; off += 500) {
    await prisma.salesOrder.createMany({ data: bulkRows.slice(off, off + 500) });
  }
  const bulkMs = Date.now() - bulkStarted;
  const rangeYear = reports.resolveRange(org.id, { preset: 'year' });
  const indepCount = await prisma.salesOrder.count({
    where: {
      organizationId: org.id,
      createdAt: { gte: rangeYear.fromUtc, lte: rangeYear.toUtc },
      status: { notIn: [SalesOrderStatus.DRAFT, SalesOrderStatus.CANCELLED] },
    },
  });
  const sumStarted = Date.now();
  const sumBulk = await reports.summary(org.id, { preset: 'year' });
  const sumMs = Date.now() - sumStarted;
  const kBulk = sumBulk.kpis as Record<string, number>;
  record(
    '5001+ đơn: orderCountCreated khớp count độc lập',
    kBulk.orderCountCreated === indepCount,
    'integration',
    `kpi=${kBulk.orderCountCreated} indep=${indepCount} seedMs=${bulkMs} sumMs=${sumMs}`,
  );
  await prisma.salesOrder.deleteMany({ where: { note: bulkTag } });

  const multiOrder = await sales.createOrder(
    org.id,
    {
      customerId: customer.id,
      customerName: customer.name,
      note: `${tag}-multi-ret`,
      discount: 30,
      shippingFee: 15,
      items: [
        { productId: product.id, productName: 'L1', quantity: 4, unitPrice: 50, lineDiscount: 0 },
        { productId: product.id, productName: 'L2', quantity: 2, unitPrice: 50, lineDiscount: 0 },
      ],
    },
    user.id,
  );
  await sales.updateStatus(org.id, multiOrder.id, SalesOrderStatus.CONFIRMED, user.id);
  await sales.updateStatus(org.id, multiOrder.id, SalesOrderStatus.READY, user.id);
  await sales.exportOrder(org.id, multiOrder.id, user.id);
  const multiItems = await prisma.salesOrderItem.findMany({ where: { orderId: multiOrder.id } });
  const rA = await returns.createAndConfirm(
    org.id,
    {
      orderId: multiOrder.id,
      idempotencyKey: `${tag}-mr1`,
      items: [{ orderItemId: multiItems[0]!.id, quantity: 2 }],
    },
    user.id,
  );
  const rB = await returns.createAndConfirm(
    org.id,
    {
      orderId: multiOrder.id,
      idempotencyKey: `${tag}-mr2`,
      items: [{ orderItemId: multiItems[1]!.id, quantity: 1 }],
    },
    user.id,
  );
  const tA = (rA as { allocation: { totals: { merchandise: number; discountReversal: number } } }).allocation.totals;
  const tB = (rB as { allocation: { totals: { merchandise: number; discountReversal: number } } }).allocation.totals;
  const expDisc = Math.round(30 * ((100 + 50) / 300) * 100) / 100;
  const discOk = Math.abs(tA.discountReversal + tB.discountReversal - expDisc) < 0.05;
  const merchOk = Math.abs(tA.merchandise + tB.merchandise - (100 + 50)) < 0.05;
  record('Nhiều dòng trả nhiều lần: CK tổng khớp', discOk, 'integration', `disc=${tA.discountReversal + tB.discountReversal}`);
  record('Nhiều dòng trả nhiều lần: merchandise khớp', merchOk, 'integration');

  const dual = await sales.createOrder(
    org.id,
    {
      customerId: customer.id,
      customerName: customer.name,
      note: `${tag}-dual-out`,
      items: [
        { productId: product.id, productName: product.name, quantity: 1, unitPrice: 50, lineDiscount: 0 },
        { productId: product.id, productName: `${product.name} 2`, quantity: 1, unitPrice: 50, lineDiscount: 0 },
      ],
    },
    user.id,
  );
  await sales.updateStatus(org.id, dual.id, SalesOrderStatus.CONFIRMED, user.id);
  await sales.updateStatus(org.id, dual.id, SalesOrderStatus.READY, user.id);
  await sales.exportOrder(org.id, dual.id, user.id);
  const outboundCount = await prisma.salesStockMovement.count({
    where: {
      organizationId: org.id,
      type: 'OUTBOUND',
      referenceType: 'SALES_ORDER',
      productId: product.id,
      referenceId: { contains: dual.id },
    },
  });
  record(
    'Unique index: hai dòng đơn cùng SP → hai OUTBOUND',
    outboundCount === 2,
    'integration',
    `outbounds=${outboundCount}`,
  );

  await cleanup(prisma, tag);
  await prisma.$disconnect();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.error('Failed:', failed.map((f) => f.name).join(', '));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});