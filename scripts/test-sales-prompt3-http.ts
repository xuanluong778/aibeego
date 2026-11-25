/**
 * Prompt 3 — SalesController + JWT thật (passport-jwt), QA DB.
 * Thiếu quyền → 403 cả khi HRM_PERMISSIONS_ENFORCE true/false.
 * Response JSON không còn số giá vốn khi thiếu sales.cost.view.
 */
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';

function signJwt(payload: Record<string, unknown>, secret: string) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ ...payload, iat: now, exp: now + 3600 })).toString(
    'base64url',
  );
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}
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
import { SalesSensitiveRedactInterceptor } from '../apps/api/dist/sales/sales-sensitive-redact.interceptor.js';

const SECRET = 'prompt3-qa-jwt-secret';
process.env.JWT_SECRET = SECRET;

function hasNumericCost(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasNumericCost);
  if (!value || typeof value !== 'object') return false;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (
      (k === 'unitCost' || k === 'costPrice' || k === 'costAmount' || k === 'grossProfit') &&
      typeof v === 'number'
    ) {
      return true;
    }
    if (hasNumericCost(v)) return true;
  }
  return false;
}

async function main() {
  const dbName = (process.env.DATABASE_URL ?? '').match(/\/([^/?]+)(?:\?|$)/)?.[1];
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

  const qaAuth = {
    async validateUser(userId: string) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
          deletedAt: true,
          organizationId: true,
          employeeId: true,
          role: {
            select: {
              code: true,
              permissions: { select: { permission: { select: { code: true } } } },
            },
          },
        },
      });
      if (!user || !user.isActive || user.deletedAt || !user.role) return null;
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role.code,
        organizationId: user.organizationId,
        employeeId: user.employeeId,
        permissions: user.role.permissions.map((rp) => rp.permission.code),
      };
    },
  };

  const tag = `P3-${Date.now()}`;
  const orgA = await prisma.organization.create({
    data: { name: tag + 'A', slug: 'p3a-' + randomUUID() },
  });
  const orgB = await prisma.organization.create({
    data: { name: tag + 'B', slug: 'p3b-' + randomUUID() },
  });
  const codes = [
    'order.read',
    'order.write',
    'sales.inventory.read',
    'sales.inventory.write',
    'sales.receive.write',
    'sales.stocktake.write',
    'sales.payment.collect',
    'sales.payment.refund',
    'sales.cost.view',
    'sales.profit.view',
  ];
  for (const code of codes) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, name: code, module: 'sales' },
    });
  }
  const permRows = await prisma.permission.findMany({ where: { code: { in: codes } } });
  const permId = new Map(permRows.map((p) => [p.code, p.id]));

  async function actor(orgId: string, roleCode: string, grant: string[], label: string) {
    const role = await prisma.role.create({
      data: { organizationId: orgId, code: roleCode, name: label },
    });
    for (const c of grant) {
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId: permId.get(c)! },
      });
    }
    const user = await prisma.user.create({
      data: {
        organizationId: orgId,
        roleId: role.id,
        name: label,
        email: `${label}-${randomUUID()}@example.invalid`,
      },
    });
    const token = signJwt(
      { sub: user.id, email: user.email, organizationId: orgId, role: roleCode },
      SECRET,
    );
    return { user, token, role };
  }

  const orderOnly = await actor(orgA.id, 'P3_ORDER_ONLY', ['order.read', 'order.write'], 'order-only');
  const noCost = await actor(
    orgA.id,
    'P3_NO_COST',
    ['order.read', 'sales.inventory.read', 'sales.receive.write'],
    'no-cost',
  );
  const foreign = await actor(
    orgB.id,
    'P3_FOREIGN',
    ['order.read', 'sales.inventory.read', 'sales.inventory.write', 'sales.cost.view'],
    'org-b',
  );

  const customer = await prisma.customer.create({
    data: { organizationId: orgA.id, name: tag + '-KH', isActive: true },
  });
  const userA = orderOnly.user;
  const product = await sales.createProduct(
    orgA.id,
    { name: tag + '-P', sku: tag + '-P', price: 40, costPrice: 12, stockQty: 0 },
    userA.id,
  );
  await inventory.inbound(
    orgA.id,
    { productId: product.id, batchCode: tag + '-B', quantity: 5, unitCost: 12, reason: tag },
    userA.id,
  );
  const supplier = await purchase.createSupplier(orgA.id, { name: tag + '-NCC' }, userA.id);
  const po = await purchase.createPurchaseOrder(
    orgA.id,
    {
      supplierId: (supplier as { id: string }).id,
      items: [{ productId: product.id, quantity: 1, unitCost: 12 }],
    },
    userA.id,
  );
  const st = await stocktake.create(orgA.id, { note: tag, productIds: [product.id] }, userA.id);

  @Module({
    imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
    controllers: [SalesController],
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
    ],
  })
  class QaModule {}

  const app = await NestFactory.create(QaModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();

  async function hit(method: string, route: string, token: string, body?: unknown) {
    const res = await fetch(`${base}/api/v1/sales/${route}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }
    return { status: res.status, json };
  }

  const results: string[] = [];
  const check = (name: string, ok: boolean, detail?: string) => {
    results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
    console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
    if (!ok) throw new Error(name);
  };

  for (const enforce of ['true', 'false']) {
    process.env.HRM_PERMISSIONS_ENFORCE = enforce;
    const pay = await hit('POST', `orders/${randomUUID()}/payments`, orderOnly.token, {
      amount: 1,
      idempotencyKey: tag + '-pay',
    });
    check(`enforce=${enforce} order.write thu tiền → 403`, pay.status === 403, String(pay.status));
    const refund = await hit('POST', `orders/${randomUUID()}/refunds`, orderOnly.token, {
      amount: 1,
      idempotencyKey: tag + '-rf',
    });
    check(`enforce=${enforce} order.write hoàn tiền → 403`, refund.status === 403);
    const adj = await hit('POST', 'stock/adjust', orderOnly.token, {
      productId: product.id,
      delta: 1,
      reason: tag,
    });
    check(`enforce=${enforce} order.write điều chỉnh kho → 403`, adj.status === 403);
    const recv = await hit('POST', 'purchase-orders', orderOnly.token, {
      supplierId: (supplier as { id: string }).id,
      items: [{ productId: product.id, quantity: 1, unitCost: 1 }],
    });
    check(`enforce=${enforce} order.write nhận/tạo PO → 403`, recv.status === 403);
    const kk = await hit('POST', `stocktakes/${st.id}/confirm`, orderOnly.token);
    check(`enforce=${enforce} order.write xác nhận kiểm kê → 403`, kk.status === 403);
  }

  const batches = await hit('GET', 'stock/batches?page=1&pageSize=20', noCost.token);
  check('GET batches không có số unitCost', batches.status === 200 && !hasNumericCost(batches.json), String(batches.status));
  const moves = await hit('GET', 'stock/movements?page=1&pageSize=20', noCost.token);
  check('GET movements không có số giá vốn', moves.status === 200 && !hasNumericCost(moves.json));
  const pos = await hit('GET', 'purchase-orders?page=1&pageSize=20', noCost.token);
  check('GET PO không có số unitCost', pos.status === 200 && !hasNumericCost(pos.json));
  const one = await hit('GET', `products/${product.id}`, noCost.token);
  check('GET product không có costPrice số', one.status === 200 && !hasNumericCost(one.json));
  const poOne = await hit('GET', `purchase-orders/${(po as { id: string }).id}`, noCost.token);
  check('GET PO chi tiết không có unitCost số', poOne.status === 200 && !hasNumericCost(poOne.json));

  const cross = await hit('GET', `products/${product.id}`, foreign.token);
  check('Tenant B không đọc sản phẩm A', cross.status === 404 || cross.status === 403, String(cross.status));
  const crossWrite = await hit('POST', 'stock/adjust', foreign.token, {
    productId: product.id,
    delta: 1,
    reason: 'x',
  });
  check(
    'Tenant B không điều chỉnh kho A',
    crossWrite.status === 403 || crossWrite.status === 404,
    String(crossWrite.status),
  );

  await app.close();

  await prisma.salesPurchaseOrderItem.deleteMany({ where: { purchaseOrder: { organizationId: orgA.id } } });
  await prisma.salesPurchaseOrder.deleteMany({ where: { organizationId: orgA.id } });
  await prisma.salesStocktakeLine.deleteMany({ where: { stocktakeId: st.id } });
  await prisma.salesStocktake.deleteMany({ where: { organizationId: orgA.id } });
  const mids = (
    await prisma.salesStockMovement.findMany({ where: { organizationId: orgA.id }, select: { id: true } })
  ).map((m) => m.id);
  if (mids.length) {
    await prisma.salesStockMovementLine.deleteMany({ where: { movementId: { in: mids } } });
    await prisma.salesStockMovement.deleteMany({ where: { id: { in: mids } } });
  }
  await prisma.salesStockBatch.deleteMany({ where: { organizationId: orgA.id } });
  await prisma.salesProduct.deleteMany({ where: { organizationId: orgA.id } });
  await prisma.salesSupplier.deleteMany({ where: { organizationId: orgA.id } });
  await prisma.customer.deleteMany({ where: { id: customer.id } });
  await prisma.user.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
  await prisma.rolePermission.deleteMany({
    where: { role: { organizationId: { in: [orgA.id, orgB.id] } } },
  });
  await prisma.role.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
  await prisma.$disconnect();
  console.log(`\n${results.length} HTTP JWT checks passed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
