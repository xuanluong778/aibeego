// Disposable PostgreSQL/Redis and synthetic actors only. Never loads the application's .env.
// Prepare schema with DATABASE_URL set to this exact QA database before running.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { createRequire } = require('node:module');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
process.env.DATABASE_URL =
  'postgresql://salesqa:salesqa-local-only@127.0.0.1:18543/sales_products_qa?schema=public';
process.env.HRM_PERMISSIONS_ENFORCE = 'false'; // product writes must remain strict in shadow mode
const apiRequire = createRequire(path.join(root, 'apps/api/package.json'));
apiRequire('reflect-metadata');
const { Module, ValidationPipe, UnauthorizedException } = apiRequire('@nestjs/common');
const { NestFactory } = apiRequire('@nestjs/core');
const Redis = apiRequire('ioredis');
const { PrismaClient } = require('../packages/database/dist');
const { SalesService } = require('../apps/api/dist/sales/sales.service');
const { InventoryService } = require('../apps/api/dist/sales/inventory.service');
const { SalesController } = require('../apps/api/dist/sales/sales.controller');
const { AuditService } = require('../apps/api/dist/audit/audit.service');
const {
  TenantKpiCacheService,
} = require('../apps/api/dist/common/services/tenant-kpi-cache.service');
const { GlobalExceptionFilter } = require('../apps/api/dist/common/filters/http-exception.filter');
const { JwtAuthGuard } = require('../apps/api/dist/common/guards/auth.guard');
const { TenantGuard } = require('../apps/api/dist/common/guards/tenant.guard');
const { PermissionsGuard } = require('../apps/api/dist/common/guards/permissions.guard');
const db = new PrismaClient();
const redis = new Redis('redis://127.0.0.1:18579');
const cache = new TenantKpiCacheService(redis);
const audit = new AuditService(db);
const inventory = new InventoryService(db, audit);
const sales = new SalesService(db, audit, inventory, cache);
const actors = {};
let app, base, browser;
const organizations = [];
const pass = (message) => console.log('PASS:', message);
const errorField = (result, field, status = 400) => {
  assert.equal(result.status, status, JSON.stringify(result));
  assert(
    result.body.errors?.some(
      (message) =>
        message.startsWith(field + ':') ||
        message.startsWith(field + ' ') ||
        message.startsWith('property ' + field + ' '),
    ),
    JSON.stringify(result),
  );
};
async function request(method, route, body, actor = 'writer') {
  const response = await fetch(`${base}/api/v1/sales/${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${actor}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}
async function start(extra = {}) {
  assert.equal(
    (await db.$queryRawUnsafe('SELECT current_database() AS name'))[0].name,
    'sales_products_qa',
  );
  await db.$executeRawUnsafe('TRUNCATE TABLE organizations CASCADE');
  for (const suffix of ['A', 'B']) {
    const org = await db.organization.create({
      data: { name: 'Sales QA ' + suffix, slug: 'sales-qa-' + randomUUID() },
    });
    organizations.push(org);
    const role = await db.role.create({
      data: { organizationId: org.id, code: 'SALE', name: 'Synthetic QA role' },
    });
    const user = await db.user.create({
      data: {
        organizationId: org.id,
        roleId: role.id,
        name: 'Synthetic QA actor',
        email: randomUUID() + '@example.invalid',
      },
    });
    actors[suffix === 'A' ? 'writer' : 'foreign'] = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: 'SALE',
      roleName: role.name,
      organizationId: org.id,
      organization: org,
      employee: null,
      permissions: ['order.read', 'order.write'],
    };
  }
  actors.reader = { ...actors.writer, role: 'MANAGER', permissions: ['order.read'] };
  actors.owner = { ...actors.writer, role: 'OWNER', permissions: [] };
  class QaModule {}
  const deps = [
    SalesService,
    InventoryService,
    ...[
      'StocktakeService',
      'SalesPaymentService',
      'SalesReturnService',
      'SalesPurchaseService',
      'SalesReportsService',
    ].map(
      (name, i) =>
        require(
          '../apps/api/dist/sales/' +
            ['stocktake', 'payment', 'return', 'purchase', 'reports'][i] +
            '.service',
        )[name],
    ),
  ];
  // Authentication transport is synthetic; controller, TenantGuard and PermissionsGuard are real.
  JwtAuthGuard.prototype.canActivate = function (context) {
    const req = context.switchToHttp().getRequest();
    let actor = (req.headers.authorization || '').replace(/^Bearer /, '');
    if (actor.includes('.')) {
      try {
        actor = JSON.parse(Buffer.from(actor.split('.')[1], 'base64url')).qaActor;
      } catch {}
    }
    if (!actors[actor]) throw new UnauthorizedException();
    req.user = actors[actor];
    return true;
  };
  Module({
    controllers: [SalesController, ...(extra.controllers || [])],
    providers: [
      ...deps.map((token) => ({
        provide: token,
        useValue: token === SalesService ? sales : token === InventoryService ? inventory : {},
      })),
      JwtAuthGuard,
      TenantGuard,
      PermissionsGuard,
      ...(extra.providers || []),
    ],
  })(QaModule);
  app = await NestFactory.create(QaModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  const dir = path.join(root, 'tmp/sales-products-qa');
  const express = app.getHttpAdapter().getInstance();
  express.get('/qa/ui.js', (_, res) =>
    res.type('js').send(fs.readFileSync(path.join(dir, 'ui.js'))),
  );
  express.get('/qa/ui.css', (_, res) =>
    res.type('css').send(fs.readFileSync(path.join(dir, 'ui.css'))),
  );
  express.get('/qa', (_, res) =>
    res
      .type('html')
      .send(
        '<meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/qa/ui.css"><div id="root" style="padding:20px"></div><script src="/qa/ui.js"></script>',
      ),
  );
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
}
async function apiChecks() {
  for (const [field, value] of [
    ['name', '   '],
    ['name', 42],
    ['sku', 123],
    ['barcode', 123],
    ...['price', 'costPrice', 'stockQty', 'minStockQty'].flatMap((field) =>
      [-1, '', ' ', 'bad', null, false, [], '0x10', 1e15].map((value) => [field, value]),
    ),
    ['stockQty', 1.5],
    ['minStockQty', 1.5],
  ])
    errorField(
      await request('POST', 'products', { name: 'Invalid fixture', [field]: value }),
      field,
    );
  assert.equal(await db.salesProduct.count(), 0);
  pass(
    'HTTP ValidationPipe rejects trimmed-empty names, non-string identifiers, invalid/blank/null/negative/overflow numbers and fractional stock without coercing to zero',
  );
  const category = (await request('POST', 'categories', { name: 'Danh mục QA' })).body;
  const foreignCategory = (await request('POST', 'categories', { name: 'Danh mục B' }, 'foreign'))
    .body;
  errorField(
    await request('POST', 'products', { name: 'Foreign category', categoryId: foreignCategory.id }),
    'categoryId',
  );
  const before = await request('GET', 'products?page=1&pageSize=50');
  assert.equal(before.body.total, 0);
  const good = await request('POST', 'products', {
    name: '  Sản phẩm mở đầu  ',
    sku: '00123',
    barcode: '0000456',
    categoryId: category.id,
    unit: 'hộp',
    price: 12500.75,
    costPrice: 10000.5,
    stockQty: 7,
    minStockQty: 2,
    note: '  Ghi chú UTF-8  ',
  });
  assert.equal(good.status, 201, JSON.stringify(good));
  const p = good.body;
  assert.equal(p.name, 'Sản phẩm mở đầu');
  assert.equal(p.sku, '00123');
  assert.equal(p.barcode, '0000456');
  assert.equal(p.note, 'Ghi chú UTF-8');
  assert.equal(p.stockQty, 7);
  const batch = await db.salesStockBatch.findFirstOrThrow({ where: { productId: p.id } });
  assert(batch.batchCode.startsWith('OPENING-'));
  assert.equal(batch.quantity, 7);
  assert.equal(batch.remainingQuantity, 7);
  assert.equal(Number(batch.unitCost), 10000.5);
  const movement = await db.salesStockMovement.findFirstOrThrow({
    where: { productId: p.id },
    include: { lines: true },
  });
  assert.equal(movement.type, 'INBOUND');
  assert.equal(movement.referenceType, 'OPENING');
  assert.equal(movement.quantity, 7);
  assert.equal(movement.lines.length, 1);
  assert.equal(movement.lines[0].batchId, batch.id);
  const refreshed = await request('GET', 'products?page=1&pageSize=50');
  assert.equal(refreshed.body.total, 1);
  assert.equal(refreshed.body.items[0].physicalQty, 7);
  pass(
    'create preserves leading zeros and notes; real transaction creates OPENING batch + INBOUND + line; real Redis list cache invalidates immediately',
  );
  errorField(await request('POST', 'products', { name: 'Duplicate SKU', sku: p.sku }), 'sku', 409);
  errorField(
    await request('POST', 'products', { name: 'Duplicate barcode', barcode: p.barcode }),
    'barcode',
    409,
  );
  assert.equal(
    (
      await request(
        'POST',
        'products',
        { name: 'Other organization', sku: p.sku, barcode: p.barcode },
        'foreign',
      )
    ).status,
    201,
  );
  const race = await Promise.all(
    [1, 2].map((i) =>
      request('POST', 'products', { name: 'Concurrent SKU ' + i, sku: 'race-sku', stockQty: 3 }),
    ),
  );
  assert.deepEqual(race.map((r) => r.status).sort(), [201, 409]);
  errorField(
    race.find((r) => r.status === 409),
    'sku',
    409,
  );
  const barcodeRace = await Promise.all(
    [1, 2].map((i) =>
      request('POST', 'products', { name: 'Concurrent barcode ' + i, barcode: '000-race' }),
    ),
  );
  assert.deepEqual(barcodeRace.map((r) => r.status).sort(), [201, 409]);
  errorField(
    barcodeRace.find((r) => r.status === 409),
    'barcode',
    409,
  );
  pass(
    'actual tenant-scoped unique constraints return correct SKU/barcode field on concurrent inserts; same identifiers allowed in another organization',
  );
  const other = (
    await request('POST', 'products', { name: 'Other editable product', sku: 'other' })
  ).body;
  errorField(await request('PATCH', `products/${other.id}`, { sku: p.sku }), 'sku', 409);
  errorField(
    await request('PATCH', `products/${other.id}`, { barcode: p.barcode }),
    'barcode',
    409,
  );
  errorField(await request('PATCH', `products/${p.id}`, { stockQty: 999 }), 'stockQty');
  errorField(await request('PATCH', `products/${p.id}`, { name: '  ' }), 'name');
  errorField(await request('PATCH', `products/${p.id}`, { name: null }), 'name');
  for (const [field, value] of [
    ['price', ''],
    ['costPrice', -1],
    ['minStockQty', 1.1],
  ])
    errorField(await request('PATCH', `products/${p.id}`, { [field]: value }), field);
  const edit = await request('PATCH', `products/${p.id}`, {
    name: 'Tên đã sửa',
    price: 13000,
    costPrice: 11000,
    sku: '',
    barcode: '',
    categoryId: null,
    note: '',
    minStockQty: 0,
  });
  assert.equal(edit.status, 200, JSON.stringify(edit));
  assert.equal(edit.body.stockQty, 7);
  assert.equal(edit.body.sku, null);
  assert.equal(edit.body.barcode, null);
  assert.equal(edit.body.categoryId, null);
  assert.equal(edit.body.note, null);
  assert.equal(
    Number((await db.salesStockBatch.findUniqueOrThrow({ where: { id: batch.id } })).unitCost),
    10000.5,
  );
  assert(
    (await request('GET', 'products?page=1&pageSize=50')).body.items.some(
      (item) => item.id === p.id && item.name === 'Tên đã sửa',
    ),
  );
  const updateRace = await Promise.all(
    [p.id, other.id].map((id) =>
      request('PATCH', `products/${id}`, { barcode: '000-update-race' }),
    ),
  );
  assert.deepEqual(updateRace.map((r) => r.status).sort(), [200, 409]);
  errorField(
    updateRace.find((r) => r.status === 409),
    'barcode',
    409,
  );
  pass(
    'update rejects direct stock writes, validates fields, clears identifiers/category/note, preserves opening batch unit cost, invalidates cache and handles concurrent update conflicts',
  );
  for (const [method, route, body] of [
    ['POST', 'products', { name: 'Forbidden' }],
    ['PATCH', `products/${p.id}`, { name: 'Forbidden edit' }],
    ['POST', 'categories', { name: 'Forbidden category' }],
  ])
    assert.equal((await request(method, route, body, 'reader')).status, 403);
  assert.equal(
    (await request('GET', 'products?page=1&pageSize=50', undefined, 'reader')).status,
    200,
  );
  assert.equal((await request('POST', 'products', { name: 'Owner product' }, 'owner')).status, 201);
  assert.equal(
    (await request('PATCH', `products/${p.id}`, { name: 'Foreign edit' }, 'foreign')).status,
    404,
  );
  assert.equal(
    (
      await request('POST', 'products', {
        name: 'Spoofed org',
        organizationId: actors.foreign.organizationId,
      })
    ).status,
    403,
  );
  assert(
    !(await request('GET', 'products?page=1&pageSize=50', undefined, 'foreign')).body.items.some(
      (item) => item.id === p.id,
    ),
  );
  pass(
    'real controller + tenant/permission guards enforce order.write even with HRM shadow mode; read-only users can list, owner bypass works, cross-tenant writes fail',
  );
  const counts = await Promise.all([
    db.salesProduct.count(),
    db.salesStockBatch.count(),
    db.salesStockMovement.count(),
  ]);
  await db.$executeRawUnsafe(
    `CREATE FUNCTION sales_qa_reject_opening() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS (SELECT 1 FROM sales_products WHERE id=NEW.product_id AND sku='QA-ROLLBACK') THEN RAISE EXCEPTION 'Synthetic opening failure'; END IF; RETURN NEW; END $$`,
  );
  await db.$executeRawUnsafe(
    'CREATE TRIGGER sales_qa_reject_opening BEFORE INSERT ON sales_stock_movements FOR EACH ROW EXECUTE FUNCTION sales_qa_reject_opening()',
  );
  try {
    await assert.rejects(() =>
      sales.createProduct(
        actors.writer.organizationId,
        { name: 'Rollback fixture', sku: 'QA-ROLLBACK', stockQty: 5 },
        actors.writer.id,
      ),
    );
  } finally {
    await db.$executeRawUnsafe('DROP TRIGGER sales_qa_reject_opening ON sales_stock_movements');
    await db.$executeRawUnsafe('DROP FUNCTION sales_qa_reject_opening()');
  }
  assert.deepEqual(
    await Promise.all([
      db.salesProduct.count(),
      db.salesStockBatch.count(),
      db.salesStockMovement.count(),
    ]),
    counts,
  );
  const zero = (await request('POST', 'products', { name: 'Zero opening', stockQty: 0 })).body;
  assert.equal(await db.salesStockBatch.count({ where: { productId: zero.id } }), 0);
  assert.equal(await db.salesStockMovement.count({ where: { productId: zero.id } }), 0);
  pass(
    'real PostgreSQL failure rolls back product, batch and movement together; zero opening does not create a stock transaction',
  );
  await db.salesProduct.createMany({
    data: Array.from({ length: 51 }, (_, i) => ({
      organizationId: actors.writer.organizationId,
      name: `Pagination QA ${String(i).padStart(3, '0')}`,
    })),
  });
  await cache.bump(actors.writer.organizationId);
  const first = await request('GET', 'products?page=1&pageSize=50&search=Pagination%20QA');
  const second = await request('GET', 'products?page=2&pageSize=50&search=Pagination%20QA');
  assert.equal(first.body.items.length, 50);
  assert.equal(second.body.items.length, 1);
  assert.equal(first.body.total, 51);
  assert.equal(first.body.totalPages, 2);
  assert.equal(
    new Set([...first.body.items, ...second.body.items].map((item) => item.id)).size,
    51,
  );
  pass('stable server pagination and filtered totals return all 51 products without overlap');
}

async function uiChecks() {
  const { chromium } = require('playwright');
  const dir = path.join(root, 'tmp/sales-products-qa');
  const web = path.join(root, 'apps/web');
  fs.mkdirSync(dir, { recursive: true });
  const esbuild = require(
    path.join(
      root,
      'node_modules/.pnpm',
      fs.readdirSync(path.join(root, 'node_modules/.pnpm')).find((x) => x.startsWith('esbuild@')),
      'node_modules/esbuild',
    ),
  );
  fs.writeFileSync(
    path.join(dir, 'entry.tsx'),
    `import React from'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import{I18nProvider}from'../../apps/web/src/i18n/i18n-provider';import Page from'../../apps/web/src/app/(app)/sales/products/page';const actors=${JSON.stringify(actors)};const actor=new URLSearchParams(location.search).get('actor')||'writer';const qc=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});qc.setQueryData(['auth','me'],actors[actor]);createRoot(document.getElementById('root')!).render(<QueryClientProvider client={qc}><I18nProvider initialLocale="vi"><Page/></I18nProvider></QueryClientProvider>);`,
  );
  await esbuild.build({
    entryPoints: [path.join(dir, 'entry.tsx')],
    outfile: path.join(dir, 'ui.js'),
    bundle: true,
    platform: 'browser',
    jsx: 'automatic',
    alias: { '@': path.join(web, 'src') },
    nodePaths: [path.join(web, 'node_modules')],
    define: { 'process.env': '{}', 'process.env.NODE_ENV': '"production"' },
    logLevel: 'error',
  });
  fs.writeFileSync(
    path.join(dir, 'input.css'),
    '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n' +
      fs
        .readFileSync(path.join(web, 'src/app/globals.css'), 'utf8')
        .replace(/^@import[^\n]*\n/gm, ''),
  );
  execFileSync(
    process.execPath,
    [
      path.join(web, 'node_modules/tailwindcss/lib/cli.js'),
      '-c',
      path.join(web, 'tailwind.config.ts'),
      '-i',
      path.join(dir, 'input.css'),
      '-o',
      path.join(dir, 'ui.css'),
      '--content',
      'apps/web/src/app/(app)/sales/products/page.tsx,apps/web/src/components/ui/*.tsx,apps/web/src/components/shared/*.tsx',
      '--minify',
    ],
    { cwd: root, stdio: 'pipe' },
  );
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 920 } });
  await context.addInitScript(() => {
    const actor = new URLSearchParams(location.search).get('actor') || 'writer';
    localStorage.setItem(
      'ms_access_token',
      `synthetic.${btoa(JSON.stringify({ exp: 4102444800, qaActor: actor }))}.test`,
    );
  });
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(base + '/qa');
  await page
    .getByRole('button', { name: 'Thêm sản phẩm', exact: true })
    .click({ timeout: 10000 })
    .catch(async (error) => {
      console.error({ errors, body: await page.locator('body').innerText() });
      await page.screenshot({ path: path.join(dir, 'products-failure.png'), fullPage: true });
      throw error;
    });
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Tên sản phẩm *', { exact: true }).fill('   ');
  await dialog.getByLabel('Giá', { exact: true }).fill('');
  await dialog.getByLabel('Tồn đầu', { exact: true }).fill('1.5');
  await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await dialog.getByText('Nhập tên sản phẩm.', { exact: true }).waitFor();
  assert.equal(await dialog.locator('[aria-invalid="true"]').count(), 3);
  await dialog.getByLabel('Tên sản phẩm *', { exact: true }).fill('UI product one');
  await dialog.getByLabel('Giá', { exact: true }).fill('12500.75');
  await dialog.getByLabel('Giá vốn', { exact: true }).fill('10000.5');
  await dialog.getByLabel('Tồn đầu', { exact: true }).fill('4');
  await dialog.getByLabel('SKU', { exact: true }).fill('000-ui-sku');
  await dialog.getByLabel('Barcode', { exact: true }).fill('000-ui-barcode');
  await dialog.getByLabel('Đơn vị', { exact: true }).fill('thùng');
  await dialog.getByRole('combobox', { name: 'Danh mục', exact: true }).click();
  await page.getByRole('option', { name: 'Danh mục QA', exact: true }).click();
  await dialog.getByRole('textbox', { name: 'Danh mục mới…', exact: true }).fill('Danh mục từ UI');
  await dialog.getByRole('button', { name: 'Thêm', exact: true }).click();
  await dialog
    .locator('#product-categoryId')
    .getByText('Danh mục từ UI', { exact: true })
    .waitFor()
    .catch(async (error) => {
      console.error({
        combo: await dialog.locator('#product-categoryId').evaluate((element) => element.outerHTML),
        alerts: await dialog.getByRole('alert').allTextContents(),
        categories: await db.salesProductCategory.findMany({
          where: { organizationId: actors.writer.organizationId },
        }),
      });
      await page.screenshot({ path: path.join(dir, 'category-failure.png'), fullPage: true });
      throw error;
    });
  await dialog.getByLabel('Ghi chú', { exact: true }).fill('Ghi chú sản phẩm từ giao diện');
  await page.screenshot({ path: path.join(dir, 'product-form-desktop.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Lưu và thêm tiếp', exact: true }).click();
  await dialog.getByText('Đã thêm sản phẩm.', { exact: true }).waitFor();
  assert.equal(await dialog.getByLabel('Tên sản phẩm *', { exact: true }).inputValue(), '');
  assert.equal(await dialog.getByLabel('Tồn đầu', { exact: true }).inputValue(), '0');
  await dialog.getByLabel('Tên sản phẩm *', { exact: true }).fill('UI duplicate');
  await dialog.getByLabel('SKU', { exact: true }).fill('000-ui-sku');
  await dialog.getByLabel('Ghi chú', { exact: true }).fill('Keep me on error');
  await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await dialog.getByText('Mã SKU đã được dùng trong tổ chức.', { exact: true }).waitFor();
  assert.equal(
    await dialog.getByLabel('Ghi chú', { exact: true }).inputValue(),
    'Keep me on error',
  );
  assert.equal(
    await dialog.getByLabel('Tên sản phẩm *', { exact: true }).inputValue(),
    'UI duplicate',
  );
  await dialog.getByLabel('SKU', { exact: true }).fill('000-ui-sku-two');
  await dialog.getByLabel('Barcode', { exact: true }).fill('000-ui-barcode');
  await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await dialog.getByText('Barcode đã được dùng trong tổ chức.', { exact: true }).waitFor();
  assert.equal(
    await dialog.getByLabel('Ghi chú', { exact: true }).inputValue(),
    'Keep me on error',
  );
  await dialog.getByLabel('Barcode', { exact: true }).fill('000-ui-barcode-two');
  await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  const search = page.getByRole('textbox', { name: 'Tìm sản phẩm…', exact: true });
  await search.fill('UI product one');
  await page.getByRole('button', { name: 'UI product one', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Sửa', exact: true }).click();
  assert.equal(
    await dialog.getByLabel('Ghi chú', { exact: true }).inputValue(),
    'Ghi chú sản phẩm từ giao diện',
  );
  assert(await dialog.getByLabel('Tồn kho', { exact: true }).isDisabled());
  await dialog.getByLabel('SKU', { exact: true }).fill('');
  await dialog.getByLabel('Barcode', { exact: true }).fill('');
  await dialog.getByLabel('Ghi chú', { exact: true }).fill('Edited note');
  await dialog.getByRole('button', { name: 'Lưu', exact: true }).click();
  await dialog.waitFor({ state: 'hidden' });
  const saved = await db.salesProduct.findFirstOrThrow({
    where: { organizationId: actors.writer.organizationId, name: 'UI product one' },
  });
  assert.equal(saved.note, 'Edited note');
  assert.equal(saved.sku, null);
  assert.equal(saved.barcode, null);
  assert.equal(saved.stockQty, 4);
  assert.equal(saved.unit, 'thùng');
  assert.equal(Number(saved.price), 12500.75);
  assert.equal(Number(saved.costPrice), 10000.5);
  assert.equal(
    (await db.salesProductCategory.findUniqueOrThrow({ where: { id: saved.categoryId } })).name,
    'Danh mục từ UI',
  );
  await search.fill('Pagination QA');
  await page
    .getByRole('navigation', { name: 'Phân trang sản phẩm' })
    .getByText('Trang 1/2 · 51 sản phẩm · 50 sản phẩm/trang', { exact: true })
    .waitFor();
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
  await page.getByText('Trang 2/2 · 51 sản phẩm · 50 sản phẩm/trang', { exact: true }).waitFor();
  assert.equal(await page.locator('tbody tr').count(), 1);
  await search.fill('UI product');
  await page.getByText('Trang 1/1 · 1 sản phẩm · 50 sản phẩm/trang', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(dir, 'products-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Thêm sản phẩm', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 850 });
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => {})),
    ),
  );
  const bounds = await dialog.boundingBox();
  assert(
    bounds &&
      bounds.x >= 0 &&
      bounds.y >= 0 &&
      bounds.x + bounds.width <= 390 &&
      bounds.y + bounds.height <= 850,
    'Mobile dialog must fit within the viewport',
  );
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: path.join(dir, 'product-form-mobile.png'), fullPage: true });
  await page.goto(base + '/qa?actor=reader');
  await page.getByText('Bạn chỉ có quyền xem sản phẩm.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Thêm sản phẩm', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Sửa', exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  pass(
    'real page/hooks -> real controller/database: field validation, leading zeros, notes, save-and-add, retained input on conflict, read-only stock, edit clearing, pagination/reset, permission UI and mobile rendering',
  );
}
async function close() {
  if (browser) await browser.close();
  if (app) await app.close();
  await redis.quit();
  await db.$disconnect();
}
module.exports = {
  start,
  apiChecks,
  uiChecks,
  close,
  db,
  redis,
  sales,
  cache,
  actors,
  request,
  get app() {
    return app;
  },
  get base() {
    return base;
  },
  get browser() {
    return browser;
  },
};
if (require.main === module)
  (async () => {
    try {
      await start();
      await apiChecks();
      await uiChecks();
    } finally {
      await close();
    }
  })().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
