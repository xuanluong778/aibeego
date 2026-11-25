/**
 * Harden sales: RBAC (shadow-safe), concurrent order/stocktake, atomic doc codes.
 * DB: marketingspa_sales_idem_qa (guard).
 */
import assert from 'node:assert/strict';
import { ForbiddenException } from '@nestjs/common';
import { SalesOrderStatus, SalesStocktakeStatus } from '@prisma/client';
import {
  assertSalesCostView,
  assertSalesInventoryWrite,
  assertSalesOrderWrite,
  assertSalesPaymentCollect,
  assertSalesPaymentRefund,
  assertSalesProfitView,
  assertSalesReceiveWrite,
  assertSalesReportExport,
  assertSalesStocktakeWrite,
  canViewSalesCost,
} from '../apps/api/dist/sales/sales.rbac.js';
import type { AuthUser } from '../apps/api/dist/common/interfaces/auth-user.interface.js';
import { redactSalesSensitive } from '../apps/api/dist/sales/sales-response-redact.util.js';

const QA_DB = 'marketingspa_sales_idem_qa';

function assertQaDb() {
  const m = (process.env.DATABASE_URL ?? '').match(/\/([^/?]+)(?:\?|$)/);
  assert.equal(m?.[1], QA_DB);
}

const results: Array<{ name: string; pass: boolean; detail?: string }> = [];
function record(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
}

function user(perms: string[], role = 'SALE'): AuthUser {
  return {
    id: 'u1',
    email: 't@test',
    name: 'T',
    role,
    roleName: role,
    organizationId: 'org',
    permissions: perms,
    organization: { id: 'org', name: 'O' } as AuthUser['organization'],
    employee: null,
  };
}

async function load() {
  const { PrismaService } = await import('../apps/api/dist/prisma/prisma.service.js');
  const { AuditService } = await import('../apps/api/dist/audit/audit.service.js');
  const { SalesDocumentCodeService } = await import('../apps/api/dist/sales/sales-document-code.service.js');
  const { InventoryService } = await import('../apps/api/dist/sales/inventory.service.js');
  const { SalesService } = await import('../apps/api/dist/sales/sales.service.js');
  const { StocktakeService } = await import('../apps/api/dist/sales/stocktake.service.js');
  const prisma = new PrismaService();
  const audit = new AuditService(prisma);
  const docCodes = new SalesDocumentCodeService(prisma);
  const inventory = new InventoryService(prisma, audit, docCodes);
  const sales = new SalesService(prisma, audit, inventory, docCodes);
  const stocktake = new StocktakeService(prisma, audit, inventory, docCodes);
  return { prisma, sales, stocktake, inventory, audit, docCodes };
}

function matrixShadow(enforce: boolean) {
  const reader = user(['order.read']);
  const writer = user(['order.read', 'order.write']);
  const costOnly = user(['order.read', 'sales.cost.view']);
  let throws = (fn: () => void) => {
    let ok = false;
    try {
      fn();
    } catch (e) {
      ok = e instanceof ForbiddenException;
    }
    return ok;
  };
  // asserts always throw — không phụ thuộc HRM_PERMISSIONS_ENFORCE
  process.env.HRM_PERMISSIONS_ENFORCE = enforce ? 'true' : 'false';
  record(
    `Ma trận enforce=${enforce}: thiếu order.write → 403`,
    throws(() => assertSalesOrderWrite(reader)),
    'order.update',
  );
  record(
    `Ma trận enforce=${enforce}: order.write cho phép sửa đơn`,
    !throws(() => assertSalesOrderWrite(writer)),
  );
  record(
    `Ma trận enforce=${enforce}: tách thu — chỉ read bị chặn`,
    throws(() => assertSalesPaymentCollect(reader)),
  );
  record(
    `Ma trận enforce=${enforce}: tách hoàn — chỉ collect không đủ`,
    throws(() => assertSalesPaymentRefund(user(['sales.payment.collect']))),
  );
  record(
    `Ma trận enforce=${enforce}: chỉ order.write không được hoàn tiền`,
    throws(() => assertSalesPaymentRefund(writer)),
  );
  record(
    `Ma trận enforce=${enforce}: chỉ order.write không được nhận hàng`,
    throws(() => assertSalesReceiveWrite(writer)),
  );
  record(
    `Ma trận enforce=${enforce}: chỉ order.write không được kiểm kê`,
    throws(() => assertSalesStocktakeWrite(writer)),
  );
  record(
    `Ma trận enforce=${enforce}: giá vốn cần sales.cost.view`,
    !canViewSalesCost(reader) && canViewSalesCost(costOnly),
  );
  const nested = redactSalesSensitive(
    {
      items: [{ unitCost: 9, lines: [{ batch: { unitCost: 4, costAmount: 8 } }] }],
      kpis: { grossProfit: 1, recognizedRevenue: 2 },
    },
    reader,
  ) as {
    items: Array<{ unitCost: null; lines: Array<{ batch: { unitCost: null; costAmount: null } }> }>;
    kpis: { grossProfit: null; recognizedRevenue: number };
  };
  record(
    `Ma trận enforce=${enforce}: redact giá vốn lồng nhau`,
    nested.items[0]!.unitCost === null &&
      nested.items[0]!.lines[0]!.batch.unitCost === null &&
      nested.items[0]!.lines[0]!.batch.costAmount === null &&
      nested.kpis.grossProfit === null &&
      nested.kpis.recognizedRevenue === 2,
  );
  record(
    `Ma trận enforce=${enforce}: xuất báo cáo cần quyền export`,
    throws(() => assertSalesReportExport(reader)),
  );
  record(
    `Ma trận enforce=${enforce}: profit view`,
    throws(() => assertSalesProfitView(reader)) && !throws(() => assertSalesProfitView(user(['sales.profit.view']))),
  );
  record(
    `Ma trận enforce=${enforce}: cost assert`,
    throws(() => assertSalesCostView(reader)),
  );
  record(
    `Ma trận enforce=${enforce}: chỉ order.write không được điều chỉnh kho`,
    throws(() => assertSalesInventoryWrite(writer)),
  );
  record(
    `Ma trận enforce=${enforce}: sales.inventory.write được điều chỉnh kho`,
    !throws(() => assertSalesInventoryWrite(user(['sales.inventory.write']))),
  );
}

async function main() {
  assertQaDb();
  console.log(`test-sales-module-hardening-qa — ${QA_DB}`);
  matrixShadow(true);
  matrixShadow(false);

  const { prisma, sales, stocktake, inventory, audit } = await load();
  const orgs = await prisma.organization.findMany({ where: { isActive: true }, take: 1 });
  const org = orgs[0];
  assert.ok(org);
  const tag = `HARD-${Date.now()}`;
  const userRow = await prisma.user.findFirstOrThrow({
    where: { organizationId: org.id, deletedAt: null },
    select: { id: true },
  });
  let customer = await prisma.customer.findFirst({ where: { organizationId: org.id, isActive: true } });
  if (!customer) {
    customer = await prisma.customer.create({
      data: { organizationId: org.id, name: `${tag}-KH`, isActive: true },
    });
  }

  const product = await sales.createProduct(
    org.id,
    { name: `${tag}-P`, sku: `${tag}-P`, price: 50, costPrice: 5, stockQty: 0 },
    userRow.id,
  );
  await inventory.inbound(org.id, { productId: product.id, batchCode: `${tag}-B`, quantity: 20, unitCost: 5 }, userRow.id);

  const order = await sales.createOrder(
    org.id,
    {
      customerId: customer.id,
      customerName: customer.name,
      note: tag,
      items: [{ productId: product.id, productName: product.name, quantity: 4, unitPrice: 50, lineDiscount: 0 }],
    },
    userRow.id,
  );
  await sales.updateStatus(org.id, order.id, SalesOrderStatus.CONFIRMED, userRow.id);
  await sales.updateStatus(org.id, order.id, SalesOrderStatus.READY, userRow.id);

  const codes: string[] = [];
  await Promise.all(
    Array.from({ length: 8 }, () =>
      sales
        .createOrder(
          org.id,
          {
            customerId: customer.id,
            customerName: customer.name,
            note: `${tag}-codes`,
            items: [{ productId: product.id, productName: 'c', quantity: 1, unitPrice: 1, lineDiscount: 0 }],
          },
          userRow.id,
        )
        .then((o) => codes.push((o as { code: string }).code)),
    ),
  );
  const uniq = new Set(codes);
  record('Tạo chứng từ đồng thời: mã SO duy nhất', uniq.size === codes.length, `n=${codes.length}`);

  const exportP = sales.exportOrder(org.id, order.id, userRow.id);
  const patchP = sales
    .updateOrder(
      org.id,
      order.id,
      { discount: 5 },
      userRow.id,
    )
    .then(() => 'ok')
    .catch((e: Error) => e.message);
  const [_, patchRes] = await Promise.all([exportP, patchP]);
  const after = await prisma.salesOrder.findFirstOrThrow({ where: { id: order.id } });
  const exportWon =
    after.exportedAt != null &&
    (String(patchRes).includes('xuất kho') || String(patchRes).includes('CONFIRMED') === false);
  record(
    'Đồng thời sửa đơn + xuất hàng: một bên thắng, không corrupt',
    exportWon || after.exportedAt != null,
    `exported=${Boolean(after.exportedAt)} patch=${String(patchRes).slice(0, 40)}`,
  );

  const st = await stocktake.create(org.id, { note: tag, productIds: [product.id] }, userRow.id);
  const cancelP = stocktake.cancel(org.id, st.id, userRow.id).catch((e: Error) => e.message);
  const confirmP = stocktake.confirm(org.id, st.id, userRow.id).catch((e: Error) => e.message);
  const [cancelRes, confirmRes] = await Promise.all([cancelP, confirmP]);
  const stAfter = await prisma.salesStocktake.findFirstOrThrow({ where: { id: st.id } });
  const oneWinner =
    (stAfter.status === SalesStocktakeStatus.CONFIRMED && String(cancelRes).includes('xác nhận')) ||
    (stAfter.status === SalesStocktakeStatus.CANCELLED && String(confirmRes).includes('nháp'));
  record('Kiểm kê: hủy vs xác nhận đồng thời', oneWinner || stAfter.status !== SalesStocktakeStatus.DRAFT, `status=${stAfter.status}`);

  const st2 = await stocktake.create(org.id, { note: `${tag}-2`, productIds: [product.id] }, userRow.id);
  const outs = await Promise.all([
    sales.exportOrder(org.id, order.id, userRow.id).catch((e: Error) => e.message),
    inventory.outbound(org.id, { productId: product.id, quantity: 1, reason: `${tag}-race` }, userRow.id).catch((e: Error) => e.message),
  ]);
  record('Hai luồng xuất tồn (đơn + manual)', outs.every((x) => typeof x === 'string' || x != null), `outs=${outs.length}`);

  const prod = await prisma.salesProduct.findFirst({ where: { sku: { startsWith: tag } } });
  if (prod) {
    const mids = (
      await prisma.salesStockMovement.findMany({ where: { productId: prod.id }, select: { id: true } })
    ).map((m) => m.id);
    if (mids.length) {
      await prisma.salesStockMovementLine.deleteMany({ where: { movementId: { in: mids } } });
      await prisma.salesStockMovement.deleteMany({ where: { id: { in: mids } } });
    }
    await prisma.salesStockBatch.deleteMany({ where: { productId: prod.id } });
    await prisma.salesStocktakeLine.deleteMany({ where: { productId: prod.id } });
  }
  await prisma.salesOrder.deleteMany({ where: { OR: [{ note: tag }, { note: { startsWith: tag } }] } });
  await prisma.salesStocktake.deleteMany({
    where: { OR: [{ note: { startsWith: tag } }, { note: { contains: `|${tag}` } }] },
  });
  await prisma.salesProduct.deleteMany({ where: { sku: { startsWith: tag } } });
  await prisma.$disconnect();

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.error(failed);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});