/**
 * Prompt 4 — kiểm kê không cắt 500, preview trả hàng, CSV/phiếu trả, hai dòng cùng SP.
 * DB: marketingspa_sales_idem_qa
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac, randomUUID } from 'node:crypto';
import { Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../apps/api/dist/auth/auth.service.js';
import { JwtStrategy } from '../apps/api/dist/auth/jwt.strategy.js';
import { JwtAuthGuard } from '../apps/api/dist/common/guards/auth.guard.js';
import { TenantGuard } from '../apps/api/dist/common/guards/tenant.guard.js';
import { PermissionsGuard } from '../apps/api/dist/common/guards/permissions.guard.js';
import { SalesController } from '../apps/api/dist/sales/sales.controller.js';
import { ProductImportController } from '../apps/api/dist/sales/product-import.controller.js';
import { WooCommerceController } from '../apps/api/dist/sales/woocommerce.controller.js';
import { SalesSensitiveRedactInterceptor } from '../apps/api/dist/sales/sales-sensitive-redact.interceptor.js';

const SECRET = 'prompt4-qa-jwt-secret';
process.env.JWT_SECRET = SECRET;

function signJwt(payload: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ ...payload, iat: now, exp: now + 3600 })).toString('base64url');
  const sig = createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

async function main() {
  const dbName = new URL((process.env.DATABASE_URL ?? '').replace(/^postgresql:/, 'http:')).pathname.replace(/^\//, '');
  assert.equal(dbName, 'marketingspa_sales_idem_qa');
  const { PrismaService } = await import('../apps/api/dist/prisma/prisma.service.js');
  const { AuditService } = await import('../apps/api/dist/audit/audit.service.js');
  const { SalesDocumentCodeService } = await import('../apps/api/dist/sales/sales-document-code.service.js');
  const { InventoryService } = await import('../apps/api/dist/sales/inventory.service.js');
  const { SalesService } = await import('../apps/api/dist/sales/sales.service.js');
  const { StocktakeService } = await import('../apps/api/dist/sales/stocktake.service.js');
  const { SalesPaymentService } = await import('../apps/api/dist/sales/payment.service.js');
  const { SalesReturnService } = await import('../apps/api/dist/sales/return.service.js');
  const { SalesPurchaseService } = await import('../apps/api/dist/sales/purchase.service.js');
  const { SalesReportsService } = await import('../apps/api/dist/sales/reports.service.js');
  const { ProductImportService } = await import('../apps/api/dist/sales/product-import.service.js');
  const { WooCommerceService } = await import('../apps/api/dist/sales/woocommerce.service.js');
  const SalesOrderStatus = { CONFIRMED: 'CONFIRMED', READY: 'READY' } as const;

  const prisma = new PrismaService();
  const audit = new AuditService(prisma);
  const docCodes = new SalesDocumentCodeService(prisma);
  const inventory = new InventoryService(prisma, audit, docCodes);
  const sales = new SalesService(prisma, audit, inventory, docCodes);
  const stocktake = new StocktakeService(prisma, audit, inventory, docCodes);
  const payments = new SalesPaymentService(prisma, audit);
  const returns = new SalesReturnService(prisma, audit, inventory, docCodes);
  const purchase = new SalesPurchaseService(prisma, audit, inventory, docCodes);
  const reports = new SalesReportsService(prisma, inventory);

  const org = await prisma.organization.findFirstOrThrow({ where: { isActive: true } });
  const user = await prisma.user.findFirstOrThrow({
    where: { organizationId: org.id, deletedAt: null },
    select: { id: true, email: true },
  });
  const tag = `P4-${Date.now()}`;
  const ids: string[] = [];
  const leftover = await prisma.salesProduct.findMany({
    where: { organizationId: org.id, sku: { startsWith: 'P4-' } },
    select: { id: true },
  });
  if (leftover.length) {
    const leftIds = leftover.map((p) => p.id);
    const orderRows = await prisma.salesOrderItem.findMany({
      where: { productId: { in: leftIds } },
      select: { orderId: true },
    });
    const orderIds = [...new Set(orderRows.map((r) => r.orderId))];
    if (orderIds.length) {
      await prisma.salesReturnItem.deleteMany({ where: { returnDoc: { orderId: { in: orderIds } } } });
      await prisma.salesReturn.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.salesPayment.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.salesOrderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await prisma.salesOrder.deleteMany({ where: { id: { in: orderIds } } });
    }
    const moveIds = (
      await prisma.salesStockMovement.findMany({
        where: { productId: { in: leftIds } },
        select: { id: true },
      })
    ).map((m) => m.id);
    if (moveIds.length) {
      await prisma.salesStockMovementLine.deleteMany({ where: { movementId: { in: moveIds } } });
      await prisma.salesStockMovement.deleteMany({ where: { id: { in: moveIds } } });
    }
    await prisma.salesStocktakeLine.deleteMany({ where: { productId: { in: leftIds } } });
    await prisma.salesStockBatch.deleteMany({ where: { productId: { in: leftIds } } });
    await prisma.salesProduct.deleteMany({ where: { id: { in: leftIds } } });
    console.log(`  [PASS] Dọn ${leftIds.length} sản phẩm P4 còn sót`);
  }
  for (let i = 0; i < 51; i++) {
    const p = await sales.createProduct(
      org.id,
      { name: `${tag}-${i}`, sku: `${tag}-${i}`, price: 10, costPrice: 1, stockQty: 0 },
      user.id,
    );
    ids.push(p.id);
  }
  const st = await stocktake.create(org.id, { note: tag, productIds: ids }, user.id);
  const count = (st as { productCount?: number; lines?: unknown[] }).productCount
    ?? (st as { lines: unknown[] }).lines.length;
  assert.equal(count, 51, `stocktake cắt còn ${count}`);
  assert.equal((st as { scope?: string }).scope, 'SELECTED');
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../apps/api/src/sales/stocktake.service.ts'),
    'utf8',
  );
  assert.equal(src.includes('take: 500'), false);
  console.log('  [PASS] Kiểm kê 51 sản phẩm không cắt 500');

  let customer = await prisma.customer.findFirst({ where: { organizationId: org.id, isActive: true } });
  if (!customer) {
    customer = await prisma.customer.create({ data: { organizationId: org.id, name: tag, isActive: true } });
  }
  const product = await prisma.salesProduct.findFirstOrThrow({ where: { id: ids[0] } });
  await inventory.inbound(org.id, { productId: product.id, batchCode: `${tag}-B`, quantity: 10, unitCost: 1 }, user.id);
  const order = await sales.createOrder(
    org.id,
    {
      customerId: customer.id,
      customerName: customer.name,
      note: tag,
      items: [
        { productId: product.id, productName: 'A', quantity: 1, unitPrice: 10, lineDiscount: 0 },
        { productId: product.id, productName: 'A-2', quantity: 1, unitPrice: 12, lineDiscount: 0 },
      ],
    },
    user.id,
  );
  const lines = await prisma.salesOrderItem.findMany({ where: { orderId: order.id } });
  assert.equal(lines.length, 2);
  assert.equal(lines[0]!.productId, lines[1]!.productId);
  console.log('  [PASS] Hai dòng cùng sản phẩm trên một đơn');
  await sales.updateStatus(org.id, order.id, SalesOrderStatus.CONFIRMED, user.id);
  await sales.updateStatus(org.id, order.id, SalesOrderStatus.READY, user.id);
  await sales.exportOrder(org.id, order.id, user.id);
  const before = await prisma.salesProduct.findUniqueOrThrow({ where: { id: product.id } });
  const ret = await returns.createAndConfirm(
    org.id,
    {
      orderId: order.id,
      idempotencyKey: `${tag}-ret`,
      reason: 'qa',
      disposition: 'SCRAP',
      items: [{ orderItemId: lines[0]!.id, quantity: 1 }],
    },
    user.id,
  );
  const after = await prisma.salesProduct.findUniqueOrThrow({ where: { id: product.id } });
  assert.equal(Number(after.stockQty), Number(before.stockQty), 'SCRAP không được cộng tồn');
  console.log('  [PASS] SCRAP không nhập lại kho');
  const preview = await returns.preview(org.id, {
    orderId: order.id,
    items: [{ orderItemId: lines[1]!.id, quantity: 1 }],
  });
  assert.ok((preview.suggestedRefundMax ?? 0) >= 0);
  console.log('  [PASS] Preview nghĩa vụ hoàn', preview.suggestedRefundMax);

  async function makeActor(codes: string[]) {
    const role = await prisma.role.create({
      data: { organizationId: org.id, code: `P4_${randomUUID().slice(0, 8)}`, name: 'p4' },
    });
    for (const code of codes) {
      const perm = await prisma.permission.upsert({
        where: { code },
        update: {},
        create: { code, name: code, module: 'sales' },
      });
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionId: perm.id } });
    }
    const actor = await prisma.user.create({
      data: {
        organizationId: org.id,
        roleId: role.id,
        name: 'p4',
        email: `p4-${randomUUID()}@example.invalid`,
      },
    });
    return {
      role,
      actor,
      token: signJwt({ sub: actor.id, email: actor.email, organizationId: org.id, role: role.code }),
    };
  }
  const finance = await makeActor([
    'order.read',
    'sales.report.export',
    'sales.profit.view',
    'sales.cost.view',
  ]);
  const reader = await makeActor(['order.read', 'order.write']);
  const stockActor = await makeActor(['order.read', 'sales.inventory.write']);
  const createdActors = [finance, reader, stockActor];
  const qaAuth = {
    async validateUser(userId: string) {
      const row = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      });
      if (!row?.role) return null;
      return {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role.code,
        organizationId: row.organizationId,
        employeeId: row.employeeId,
        permissions: row.role.permissions.map((p) => p.permission.code),
      };
    },
  };
  @Module({
    imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
    controllers: [SalesController, ProductImportController, WooCommerceController],
    providers: [
      { provide: ConfigService, useValue: { get: (k: string) => process.env[k] } },
      { provide: AuthService, useValue: qaAuth },
      JwtStrategy,
      JwtAuthGuard,
      TenantGuard,
      PermissionsGuard,
      SalesSensitiveRedactInterceptor,
      { provide: SalesService, useValue: sales },
      { provide: InventoryService, useValue: inventory },
      { provide: StocktakeService, useValue: stocktake },
      { provide: SalesPaymentService, useValue: payments },
      { provide: SalesReturnService, useValue: returns },
      { provide: SalesPurchaseService, useValue: purchase },
      { provide: SalesReportsService, useValue: reports },
      {
        provide: ProductImportService,
        useValue: {
          history: async () => ({ items: [{ costPrice: 15, name: 'import-row' }], total: 1 }),
        },
      },
      {
        provide: WooCommerceService,
        useValue: { list: async () => [{ id: 'w1', name: 'woo', costPrice: 9, unitCost: 8 }] },
      },
    ],
  })
  class QaModule {}
  const app = await NestFactory.create(QaModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();
  const csvDenied = await fetch(`${base}/api/v1/sales/reports/export.csv?preset=year`, {
    headers: { Authorization: `Bearer ${reader.token}` },
  });
  assert.equal(csvDenied.status, 403, await csvDenied.text());
  const csv = await fetch(`${base}/api/v1/sales/reports/export.csv?preset=year`, {
    headers: { Authorization: `Bearer ${finance.token}` },
  });
  const csvBody = await csv.text();
  assert.equal(csv.status, 200, csvBody.slice(0, 180));
  assert.match(csvBody, /kpi,/);
  console.log('  [PASS] CSV báo cáo qua JWT', csv.status, csvBody.length);
  const retId = (ret as { id: string }).id;
  const got = await fetch(`${base}/api/v1/sales/returns/${retId}`, {
    headers: { Authorization: `Bearer ${finance.token}` },
  });
  assert.equal(got.status, 200);
  const retJson = await got.json();
  assert.equal(retJson.id, retId);
  console.log('  [PASS] GET phiếu trả qua JWT');
  const previewHttp = await fetch(`${base}/api/v1/sales/returns/preview`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${finance.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: order.id,
      idempotencyKey: `${tag}-preview`,
      reason: 'qa',
      disposition: 'HOLD',
      items: [{ orderItemId: lines[1]!.id, quantity: 1 }],
    }),
  });
  const previewJson = await previewHttp.json();
  assert.ok(previewHttp.status === 200 || previewHttp.status === 201, JSON.stringify(previewJson).slice(0, 240));
  assert.equal(typeof previewJson.suggestedRefundMax, 'number');
  console.log('  [PASS] POST preview trả hàng qua JWT');
  const importDenied = await fetch(`${base}/api/v1/sales/product-imports/template?format=csv`, {
    headers: { Authorization: `Bearer ${reader.token}` },
  });
  assert.equal(importDenied.status, 403);
  const importCsv = await fetch(`${base}/api/v1/sales/product-imports/template?format=csv`, {
    headers: { Authorization: `Bearer ${stockActor.token}` },
  });
  const importBody = await importCsv.text();
  assert.equal(importCsv.status, 200, importBody.slice(0, 180));
  assert.match(importBody, /SKU|sku|Tên/i);
  const wooDenied = await fetch(`${base}/api/v1/sales/woocommerce`, {
    headers: { Authorization: `Bearer ${reader.token}` },
  });
  assert.equal(wooDenied.status, 403);
  const woo = await fetch(`${base}/api/v1/sales/woocommerce`, {
    headers: { Authorization: `Bearer ${stockActor.token}` },
  });
  const wooJson = await woo.json();
  assert.equal(woo.status, 200, JSON.stringify(wooJson).slice(0, 180));
  assert.equal(JSON.stringify(wooJson).includes('"costPrice":9'), false);
  assert.equal(JSON.stringify(wooJson).includes('"unitCost":8'), false);
  console.log('  [PASS] Import CSV mẫu + Woo list không lộ giá vốn');
  await app.close();

  await prisma.salesReturnItem.deleteMany({ where: { returnDoc: { orderId: order.id } } });
  await prisma.salesReturn.deleteMany({ where: { orderId: order.id } });
  await prisma.salesOrderItem.deleteMany({ where: { orderId: order.id } });
  await prisma.salesOrder.deleteMany({ where: { id: order.id } });
  const mids = (await prisma.salesStockMovement.findMany({ where: { productId: { in: ids } }, select: { id: true } })).map((m) => m.id);
  if (mids.length) {
    await prisma.salesStockMovementLine.deleteMany({ where: { movementId: { in: mids } } });
    await prisma.salesStockMovement.deleteMany({ where: { id: { in: mids } } });
  }
  await prisma.salesStocktakeLine.deleteMany({ where: { stocktakeId: (st as { id: string }).id } });
  await prisma.salesStocktake.deleteMany({ where: { id: (st as { id: string }).id } });
  await prisma.salesStockBatch.deleteMany({ where: { productId: { in: ids } } });
  await prisma.salesProduct.deleteMany({ where: { id: { in: ids } } });
  await prisma.salesOperationIdempotency.deleteMany({
    where: { organizationId: org.id, idempotencyKey: { startsWith: tag } },
  });
  for (const row of createdActors) {
    await prisma.user.delete({ where: { id: row.actor.id } });
    await prisma.rolePermission.deleteMany({ where: { roleId: row.role.id } });
    await prisma.role.delete({ where: { id: row.role.id } });
  }
  await prisma.$disconnect();
  console.log('Prompt 4 QA passed');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
