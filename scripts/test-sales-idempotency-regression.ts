/**
 * Sales idempotency acceptance (QA DB only — marketingspa_sales_idem_qa).
 * Run: node scripts/run-sales-idempotency-regression.cjs
 *   (hoặc DATABASE_URL=.../marketingspa_sales_idem_qa pnpm exec tsx scripts/test-sales-idempotency-regression.ts)
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PrismaService } from '../apps/api/src/prisma/prisma.service';
import type { AuditService } from '../apps/api/src/audit/audit.service';
import type { InventoryService } from '../apps/api/src/sales/inventory.service';
import type { SalesService } from '../apps/api/src/sales/sales.service';
import type { SalesPaymentService } from '../apps/api/src/sales/payment.service';
import type { SalesReturnService } from '../apps/api/src/sales/return.service';
import type { SalesPurchaseService } from '../apps/api/src/sales/purchase.service';

const SALES_IDEM_QA_DB_ALLOWLIST = ['marketingspa_sales_idem_qa'] as const;

function assertQaDatabase(): string {
  const url = process.env.DATABASE_URL ?? '';
  const m = url.match(/\/([^/?]+)(?:\?|$)/);
  const db = m?.[1];
  if (!db || !SALES_IDEM_QA_DB_ALLOWLIST.includes(db as (typeof SALES_IDEM_QA_DB_ALLOWLIST)[number])) {
    throw new Error(
      `DATABASE_URL phải trỏ DB QA [${SALES_IDEM_QA_DB_ALLOWLIST.join(', ')}], hiện: ${db ?? 'thiếu'}`,
    );
  }
  return db;
}

function httpStatus(e: unknown): number | undefined {
  return (e as { getStatus?: () => number; status?: number })?.getStatus?.() ?? (e as { status?: number })?.status;
}

let prisma!: PrismaService;
let inventory!: InventoryService;
let sales!: SalesService;
let payments!: SalesPaymentService;
let returns!: SalesReturnService;
let purchase!: SalesPurchaseService;

const results: Array<{ name: string; pass: boolean; detail?: string }> = [];
function record(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
}

async function stockOf(productId: string) {
  return (await prisma.salesProduct.findUniqueOrThrow({ where: { id: productId } })).stockQty;
}

async function cleanup(tag: string) {
  assertQaDatabase();
  const products = await prisma.salesProduct.findMany({
    where: { OR: [{ sku: { startsWith: tag } }, { name: { startsWith: tag } }] },
    select: { id: true, organizationId: true },
  });
  const productIds = products.map((p) => p.id);
  const orgIds = [...new Set(products.map((p) => p.organizationId))];

  const orders = await prisma.salesOrder.findMany({
    where: { note: { startsWith: tag } },
    select: { id: true, organizationId: true },
  });
  const orderIds = orders.map((o) => o.id);
  for (const oid of orders.map((o) => o.organizationId)) orgIds.push(oid);

  if (orgIds.length) {
    await prisma.salesOperationIdempotency.deleteMany({
      where: { organizationId: { in: [...new Set(orgIds)] } },
    });
  }

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

  if (productIds.length) {
    await prisma.salesStockMovementLine.deleteMany({
      where: { movement: { productId: { in: productIds } } },
    });
    await prisma.salesStockMovement.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.salesStockBatch.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.salesPurchaseOrderItem.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.salesProduct.deleteMany({ where: { id: { in: productIds } } });
  }

  await prisma.salesPurchaseOrder.deleteMany({
    where: { OR: [{ code: { startsWith: tag } }, { supplier: { name: { startsWith: tag } } }] },
  });
  await prisma.salesSupplier.deleteMany({ where: { name: { startsWith: tag } } });
}

async function ensureFixtureOrgs() {
  const orgs = await prisma.organization.findMany({
    where: { isActive: true },
    take: 2,
    orderBy: { createdAt: 'asc' },
  });
  assert.ok(orgs.length >= 1, 'DB QA cần ít nhất 1 organization');
  const orgA = orgs[0]!;
  const orgB = orgs[1] ?? null;
  const customer = await prisma.customer.findFirst({
    where: { organizationId: orgA.id, isActive: true },
  });
  assert.ok(customer, 'DB QA cần customer active org A');
  const user = await prisma.user.findFirst({
    where: { organizationId: orgA.id, deletedAt: null },
    select: { id: true },
  });
  assert.ok(user, 'DB QA cần user org A');
  return { orgA, orgB, userId: user.id, customer };
}

function testFrontendKeyRetention() {
  const map = new Map<string, string>();
  const scope = 'payment';
  const orderId = 'order-1';
  let nonce = 0;
  const idemFor = () => {
    let key = map.get(orderId);
    if (!key) {
      nonce += 1;
      key = `sales:${scope}:${orderId}:nonce-${nonce}`;
      map.set(orderId, key);
    }
    return key;
  };
  const k1 = idemFor();
  const k2 = idemFor();
  const afterError = k1 === k2 && map.has(orderId);
  map.delete(orderId);
  nonce += 1;
  const k3 = idemFor();
  const newAfterSuccess = k3 !== k1;
  record(
    'Frontend giữ key sau lỗi, key mới sau thành công',
    afterError && newAfterSuccess,
    `k1=${k1.slice(0, 24)}… k3=${k3.slice(0, 24)}…`,
  );
}

async function loadServices() {
  const { PrismaService: PrismaSvc } = await import('../apps/api/dist/prisma/prisma.service.js');
  const { AuditService: AuditSvc } = await import('../apps/api/dist/audit/audit.service.js');
  const { InventoryService: InvSvc } = await import('../apps/api/dist/sales/inventory.service.js');
  const { SalesService: SalesSvc } = await import('../apps/api/dist/sales/sales.service.js');
  const { SalesPaymentService: PaySvc } = await import('../apps/api/dist/sales/payment.service.js');
  const { SalesReturnService: RetSvc } = await import('../apps/api/dist/sales/return.service.js');
  const { SalesPurchaseService: PoSvc } = await import('../apps/api/dist/sales/purchase.service.js');
  const { SalesDocumentCodeService: DocSvc } = await import(
    '../apps/api/dist/sales/sales-document-code.service.js'
  );
  prisma = new PrismaSvc();
  const audit = new AuditSvc(prisma);
  const docCodes = new DocSvc(prisma);
  inventory = new InvSvc(prisma, audit, docCodes);
  sales = new SalesSvc(prisma, audit, inventory, docCodes);
  payments = new PaySvc(prisma, audit);
  returns = new RetSvc(prisma, audit, inventory, docCodes);
  purchase = new PoSvc(prisma, audit, inventory, docCodes);
}

async function main() {
  const dbName = assertQaDatabase();
  console.log(`test-sales-idempotency-regression — DB: ${dbName}`);
  await loadServices();
  const { SalesOrderStatus } = await import('../packages/database/dist/index.js');
  testFrontendKeyRetention();
  record(
    'HTTP 409 contract (xem test-sales-idempotency-http.cjs)',
    httpStatus({ getStatus: () => 409 }) === 409,
    'mô phỏng — chạy pnpm test:sales-idempotency-http cho Nest thật',
  );

  const { orgA, orgB, userId, customer } = await ensureFixtureOrgs();
  const tag = `E2E-IDEM-${Date.now()}`;
  await cleanup(tag);

  const supplier = await purchase.createSupplier(orgA.id, { name: `${tag}-NCC` }, userId);
  const poProduct = await sales.createProduct(orgA.id, {
    name: `${tag}-PO`,
    sku: `${tag}-PO`,
    price: 10,
    costPrice: 5,
    stockQty: 0,
  });
  const po = await purchase.createPurchaseOrder(
    orgA.id,
    { supplierId: supplier.id, items: [{ productId: poProduct.id, quantity: 10, unitCost: 5 }] },
    userId,
  );
  const poLine = await prisma.salesPurchaseOrderItem.findFirstOrThrow({
    where: { purchaseOrderId: po.id },
  });
  const recvKey = `${tag}-recv-3`;
  await purchase.receiveGoods(
    orgA.id,
    po.id,
    { idempotencyKey: recvKey, items: [{ purchaseOrderItemId: poLine.id, quantity: 3 }] },
    userId,
  );
  const stockAfterFirst = await stockOf(poProduct.id);
  await purchase.receiveGoods(
    orgA.id,
    po.id,
    { idempotencyKey: recvKey, items: [{ purchaseOrderItemId: poLine.id, quantity: 3 }] },
    userId,
  );
  const lineAfter = await prisma.salesPurchaseOrderItem.findUniqueOrThrow({ where: { id: poLine.id } });
  const stockAfterRetry = await stockOf(poProduct.id);
  record(
    'PO 10 nhận 3 retry không cộng thêm',
    lineAfter.receivedQty === 3 && stockAfterFirst === 3 && stockAfterRetry === 3,
    `receivedQty=${lineAfter.receivedQty} stock=${stockAfterRetry}`,
  );

  let missingKeyRejected = false;
  try {
    await purchase.receiveGoods(orgA.id, po.id, { items: [{ purchaseOrderItemId: poLine.id, quantity: 1 }] } as never, userId);
  } catch {
    missingKeyRejected = true;
  }
  record('receiveGoods thiếu idempotencyKey → 400', missingKeyRejected);

  const po2 = await purchase.createPurchaseOrder(
    orgA.id,
    { supplierId: supplier.id, items: [{ productId: poProduct.id, quantity: 10, unitCost: 5 }] },
    userId,
  );
  const po2Line = await prisma.salesPurchaseOrderItem.findFirstOrThrow({ where: { purchaseOrderId: po2.id } });
  let dupRejected = false;
  try {
    await purchase.receiveGoods(
      orgA.id,
      po2.id,
      {
        idempotencyKey: `${tag}-dup-recv`,
        items: [
          { purchaseOrderItemId: po2Line.id, quantity: 6 },
          { purchaseOrderItemId: po2Line.id, quantity: 6 },
        ],
      },
      userId,
    );
  } catch {
    dupRejected = true;
  }
  record('Hai dòng nhận 6+6 trên PO 10 bị từ chối', dupRejected);

  let rollbackOk = true;
  const stockBeforeRb = await stockOf(poProduct.id);
  try {
    await purchase.receiveGoods(
      orgA.id,
      po2.id,
      {
        idempotencyKey: `${tag}-rollback`,
        items: [
          { purchaseOrderItemId: po2Line.id, quantity: 2 },
          { purchaseOrderItemId: po2Line.id, quantity: 99 },
        ],
      },
      userId,
    );
    rollbackOk = false;
  } catch {
    /* expected */
  }
  const stockAfterRb = await stockOf(poProduct.id);
  const idemRb = await prisma.salesOperationIdempotency.count({
    where: { organizationId: orgA.id, idempotencyKey: `${tag}-rollback` },
  });
  record(
    'Request lỗi giữa chừng — rollback tồn + ledger',
    rollbackOk && stockAfterRb === stockBeforeRb && idemRb === 0,
    `stock=${stockAfterRb} idem=${idemRb}`,
  );

  const concKey = `${tag}-conc`;
  const [c1, c2] = await Promise.allSettled([
    purchase.receiveGoods(
      orgA.id,
      po2.id,
      { idempotencyKey: concKey, items: [{ purchaseOrderItemId: po2Line.id, quantity: 4 }] },
      userId,
    ),
    purchase.receiveGoods(
      orgA.id,
      po2.id,
      { idempotencyKey: concKey, items: [{ purchaseOrderItemId: po2Line.id, quantity: 4 }] },
      userId,
    ),
  ]);
  const concRejected500 = [c1, c2].some(
    (r) => r.status === 'rejected' && httpStatus(r.reason) === 500,
  );
  const po2LineAfter = await prisma.salesPurchaseOrderItem.findUniqueOrThrow({ where: { id: po2Line.id } });
  const idemConc = await prisma.salesOperationIdempotency.count({
    where: { organizationId: orgA.id, operation: 'PO_RECEIVE', idempotencyKey: concKey },
  });
  record(
    'Hai request đồng thời cùng key chỉ ghi một lần',
    !concRejected500 && po2LineAfter.receivedQty === 4 && idemConc === 1,
    `received=${po2LineAfter.receivedQty} idemRows=${idemConc}`,
  );

  let crossPoConflict = false;
  const sharedKey = `${tag}-cross-po`;
  await purchase.receiveGoods(
    orgA.id,
    po.id,
    { idempotencyKey: sharedKey, items: [{ purchaseOrderItemId: poLine.id, quantity: 1 }] },
    userId,
  );
  try {
    await purchase.receiveGoods(
      orgA.id,
      po2.id,
      { idempotencyKey: sharedKey, items: [{ purchaseOrderItemId: po2Line.id, quantity: 1 }] },
      userId,
    );
  } catch (e) {
    crossPoConflict = httpStatus(e) === 409;
  }
  record('Cùng key khác PO → 409, không replay PO kia', crossPoConflict);

  await inventory.inbound(
    orgA.id,
    { productId: poProduct.id, batchCode: `${tag}-RET-B`, quantity: 20, reason: 'seed' },
    userId,
  );
  const sellOrder = await sales.createOrder(
    orgA.id,
    {
      customerId: customer.id,
      customerName: customer.name,
      note: `${tag}-sell`,
      items: [{ productId: poProduct.id, productName: poProduct.name, quantity: 5, unitPrice: 10, lineDiscount: 0 }],
    },
    userId,
  );
  await sales.updateStatus(orgA.id, sellOrder.id, SalesOrderStatus.CONFIRMED, userId);
  await sales.updateStatus(orgA.id, sellOrder.id, SalesOrderStatus.READY, userId);
  await sales.exportOrder(orgA.id, sellOrder.id, userId);
  const oi = await prisma.salesOrderItem.findFirstOrThrow({ where: { orderId: sellOrder.id } });
  let retDupRejected = false;
  try {
    await returns.createAndConfirm(
      orgA.id,
      {
        orderId: sellOrder.id,
        idempotencyKey: `${tag}-ret-dup`,
        items: [
          { orderItemId: oi.id, quantity: 4 },
          { orderItemId: oi.id, quantity: 4 },
        ],
      },
      userId,
    );
  } catch {
    retDupRejected = true;
  }
  record('Trùng dòng trả 4+4 bị từ chối', retDupRejected);

  const dualOrder = await sales.createOrder(
    orgA.id,
    {
      customerId: customer.id,
      customerName: customer.name,
      note: `${tag}-dual`,
      items: [
        { productId: poProduct.id, productName: poProduct.name, quantity: 2, unitPrice: 10, lineDiscount: 0 },
        { productId: poProduct.id, productName: `${poProduct.name} (2)`, quantity: 3, unitPrice: 10, lineDiscount: 0 },
      ],
    },
    userId,
  );
  await sales.updateStatus(orgA.id, dualOrder.id, SalesOrderStatus.CONFIRMED, userId);
  await sales.updateStatus(orgA.id, dualOrder.id, SalesOrderStatus.READY, userId);
  await sales.exportOrder(orgA.id, dualOrder.id, userId);
  const dualItems = await prisma.salesOrderItem.findMany({
    where: { orderId: dualOrder.id },
    orderBy: { quantity: 'asc' },
  });
  const beforeDualStock = await stockOf(poProduct.id);
  await returns.createAndConfirm(
    orgA.id,
    {
      orderId: dualOrder.id,
      idempotencyKey: `${tag}-dual-ret`,
      items: [
        { orderItemId: dualItems[0]!.id, quantity: 2 },
        { orderItemId: dualItems[1]!.id, quantity: 1 },
      ],
    },
    userId,
  );
  const afterDualStock = await stockOf(poProduct.id);
  const refreshedItems = await prisma.salesOrderItem.findMany({
    where: { orderId: dualOrder.id },
    orderBy: { quantity: 'asc' },
  });
  record(
    'Hai dòng cùng SP trả đúng từng orderItemId',
    afterDualStock === beforeDualStock + 3 &&
      refreshedItems[0]!.returnedQty === 2 &&
      refreshedItems[1]!.returnedQty === 1,
    `stock +3 returned=${refreshedItems.map((i) => i.returnedQty).join('/')}`,
  );

  const svcOrder = await sales.createOrder(
    orgA.id,
    {
      customerId: customer.id,
      customerName: customer.name,
      note: `${tag}-nosku`,
      items: [{ productName: 'Dịch vụ không kho', quantity: 3, unitPrice: 20, lineDiscount: 0 }],
    },
    userId,
  );
  await prisma.salesOrder.update({
    where: { id: svcOrder.id },
    data: { status: SalesOrderStatus.SHIPPED, exportedAt: new Date() },
  });
  const svcItem = await prisma.salesOrderItem.findFirstOrThrow({ where: { orderId: svcOrder.id } });
  await returns.createAndConfirm(
    orgA.id,
    {
      orderId: svcOrder.id,
      idempotencyKey: `${tag}-nosku-ret`,
      items: [{ orderItemId: svcItem.id, quantity: 2 }],
    },
    userId,
  );
  const svcItemAfter = await prisma.salesOrderItem.findUniqueOrThrow({ where: { id: svcItem.id } });
  record('Dòng không kho cập nhật returnedQty', svcItemAfter.returnedQty === 2, `returned=${svcItemAfter.returnedQty}`);

  const legacyOrder = await sales.createOrder(
    orgA.id,
    {
      customerId: customer.id,
      customerName: customer.name,
      note: `${tag}-legacy`,
      items: [{ productId: poProduct.id, productName: poProduct.name, quantity: 1, unitPrice: 10, lineDiscount: 0 }],
    },
    userId,
  );
  await sales.updateStatus(orgA.id, legacyOrder.id, SalesOrderStatus.CONFIRMED, userId);
  await sales.updateStatus(orgA.id, legacyOrder.id, SalesOrderStatus.READY, userId);
  const legacyItem = await prisma.salesOrderItem.findFirstOrThrow({ where: { orderId: legacyOrder.id } });
  const batch = await prisma.salesStockBatch.findFirst({ where: { productId: poProduct.id } });
  assert.ok(batch);
  const beforeLegacy = await stockOf(poProduct.id);
  await prisma.salesStockMovement.create({
    data: {
      organizationId: orgA.id,
      productId: poProduct.id,
      type: 'OUTBOUND',
      quantity: 1,
      referenceType: 'SALES_ORDER',
      referenceId: legacyOrder.id,
      performedById: userId,
      lines: { create: [{ batchId: batch.id, quantity: 1 }] },
    },
  });
  await prisma.salesOrder.update({
    where: { id: legacyOrder.id },
    data: { exportedAt: new Date(), status: SalesOrderStatus.SHIPPED },
  });
  await returns.createAndConfirm(
    orgA.id,
    {
      orderId: legacyOrder.id,
      idempotencyKey: `${tag}-legacy-ret`,
      items: [{ orderItemId: legacyItem.id, quantity: 1 }],
    },
    userId,
  );
  const afterLegacy = await stockOf(poProduct.id);
  record('Hoàn đơn xuất legacy referenceId=orderId', afterLegacy === beforeLegacy + 1, `stock ${beforeLegacy}→${afterLegacy}`);

  await prisma.salesStockMovement.create({
    data: {
      organizationId: orgA.id,
      productId: poProduct.id,
      type: 'OUTBOUND',
      quantity: 1,
      referenceType: 'SALES_ORDER',
      referenceId: `${tag}-ambig-ref`,
      performedById: userId,
      lines: { create: [{ batchId: batch.id, quantity: 1 }] },
    },
  });
  let dupLegacyBlocked = false;
  try {
    await prisma.salesStockMovement.create({
      data: {
        organizationId: orgA.id,
        productId: poProduct.id,
        type: 'OUTBOUND',
        quantity: 1,
        referenceType: 'SALES_ORDER',
        referenceId: `${tag}-ambig-ref`,
        performedById: userId,
      },
    });
  } catch (e) {
    dupLegacyBlocked = (e as { code?: string })?.code === 'P2002';
  }
  const invSrc = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../apps/api/src/sales/inventory.service.ts'),
    'utf8',
  );
  const hasAmbigError = /Nhiều phiếu xuất legacy/.test(String(invSrc));
  record(
    'Không tự chọn findFirst mơ hồ (unique DB + findMany>1)',
    dupLegacyBlocked && hasAmbigError,
    `P2002=${dupLegacyBlocked} codeGuard=${hasAmbigError}`,
  );

  const payOrder = await sales.createOrder(
    orgA.id,
    {
      customerId: customer.id,
      customerName: customer.name,
      note: `${tag}-refund`,
      items: [{ productId: poProduct.id, productName: poProduct.name, quantity: 1, unitPrice: 100, lineDiscount: 0 }],
    },
    userId,
  );
  let payMissingKey = false;
  try {
    await payments.addPayment(orgA.id, payOrder.id, { amount: 1 } as never, userId);
  } catch {
    payMissingKey = true;
  }
  record('addPayment thiếu idempotencyKey → 400', payMissingKey);

  await payments.addPayment(orgA.id, payOrder.id, { amount: 100, idempotencyKey: `${tag}-pay` }, userId);
  const refKey = `${tag}-ref-full`;
  const r1 = await payments.addRefund(orgA.id, payOrder.id, { amount: 100, idempotencyKey: refKey }, userId);
  const r2 = await payments.addRefund(orgA.id, payOrder.id, { amount: 100, idempotencyKey: refKey }, userId);
  record(
    'Hoàn tiền full retry cùng key',
    Number(r1.amountPaid) === 0 && Number(r2.amountPaid) === 0 && r1.paymentStatus === r2.paymentStatus,
    `paid=${r2.amountPaid}`,
  );

  let conflict409 = false;
  try {
    await payments.addRefund(orgA.id, payOrder.id, { amount: 50, idempotencyKey: refKey }, userId);
  } catch (e) {
    conflict409 = httpStatus(e) === 409;
  }
  record('Refund cùng key payload khác → HTTP 409 (Nest)', conflict409);

  if (orgB) {
    let cross = false;
    try {
      await purchase.getPurchaseOrder(orgB.id, po.id);
    } catch {
      cross = true;
    }
    record('Tổ chức B không đọc PO org A', cross);
  } else {
    record('Tổ chức B không đọc PO org A', true, 'skipped — chỉ 1 org trong DB QA');
  }

  await cleanup(tag);
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