// Disposable sales_products_qa only. Remote WooCommerce is a synthetic transport fixture.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const { randomUUID } = require('node:crypto');
const qa = require('./test-sales-products.cjs');
const root = path.resolve(__dirname, '..');
const apiRequire = createRequire(path.join(root, 'apps/api/package.json'));
const shared = require('../packages/shared/dist/ssrf-fetch');
const {
  WooCommerceService,
  normalizeWooWebsite,
} = require('../apps/api/dist/sales/woocommerce.service');
const { WooCommerceController } = require('../apps/api/dist/sales/woocommerce.controller');
const { ProductImportService } = require('../apps/api/dist/sales/product-import.service');
const { ProductImportController } = require('../apps/api/dist/sales/product-import.controller');
const { RateLimitService } = require('../apps/api/dist/common/services/rate-limit.service');
const { encryptSecret, decryptSecret } = require('../apps/api/dist/common/utils/encryption.util');
const util = require('../apps/api/dist/sales/product-spreadsheet.util');
const imports = new ProductImportService(qa.db, qa.sales);
const secret = 'synthetic-woo-qa-encryption-key';
const woo = new WooCommerceService(qa.db, { get: () => secret }, imports, new RateLimitService());
const credentials = {
  websiteUrl: 'https://woo.example.invalid/shop/',
  consumerKey: 'ck_' + 'a'.repeat(40),
  consumerSecret: 'cs_' + 'b'.repeat(40),
};
const mapping = Object.fromEntries(util.IMPORT_FIELDS.map((field, index) => [field, index]));
const options = { mode: 'skip', createCategories: true, updateFields: [] };
const remoteCalls = [];
let currency = 'VND',
  failRemote = false,
  failureStatus = 401,
  connectionId,
  browser;
const products = new Map();
function product(id, overrides = {}) {
  return {
    id,
    name: 'Woo sản phẩm ' + id,
    type: 'simple',
    sku: '',
    price: '12000',
    regular_price: '15000',
    sale_price: '12000',
    status: 'publish',
    permalink: `https://woo.example.invalid/shop/product/${id}`,
    description: '<p>Mô tả tiếng Việt</p>',
    short_description: '<p>Tóm tắt</p>',
    images: [{ src: 'https://woo.example.invalid/image.jpg' }],
    categories: [{ id: 7, name: 'Mỹ phẩm' }],
    manage_stock: true,
    stock_quantity: 12,
    stock_status: 'instock',
    ...overrides,
  };
}
products.set(1, product(1));
products.set(2, product(2, { type: 'variable', variations: [21, 22] }));
products.set(3, product(3, { name: 'Woo UI mới', sku: '000-WOO-UI' }));
products.set(4, product(4, { sku: 'EXISTING-SKU' }));
products.set(5, product(5));
products.set(6, product(6));
products.set(7, product(7));
products.set(8, product(8));
products.set(
  9,
  product(9, { type: 'variable', variations: Array.from({ length: 101 }, (_, i) => 9000 + i) }),
);
products.set(10, product(10, { type: 'variable', variations: [10001, 10002] }));
const originalFetch = shared.fetchPublicAuthenticatedJson;
const originalDiscover = shared.discoverPublicWordPressWebsite;
shared.discoverPublicWordPressWebsite = async (raw) =>
  raw.includes('/product-category/') ? credentials.websiteUrl : null;
shared.fetchPublicAuthenticatedJson = async (raw, auth) => {
  const url = new URL(raw);
  remoteCalls.push(url.href);
  assert.equal(url.origin, 'https://woo.example.invalid');
  assert(!url.search.includes('consumer_'));
  assert.equal(
    auth,
    'Basic ' +
      Buffer.from(credentials.consumerKey + ':' + credentials.consumerSecret).toString('base64'),
  );
  if (failRemote)
    throw new shared.FetchPublicError('remote secret must never escape', 'HTTP_ERROR', failureStatus);
  const route = url.pathname.replace('/shop/wp-json/wc/v3/', '');
  if (route === 'data/currencies/current') return { data: { code: currency }, headers: {} };
  if (route === 'products/categories')
    return {
      data: [{ id: 7, name: 'Mỹ phẩm', slug: 'my-pham', count: 3 }],
      headers: { 'x-wp-totalpages': '1' },
    };
  if (route === 'products') {
    const page = Number(url.searchParams.get('page') || 1);
    return {
      data:
        url.searchParams.get('per_page') === '1'
          ? [products.get(1)]
          : page === 1
            ? [products.get(1), products.get(2)]
            : [products.get(3)],
      headers: { 'x-wp-totalpages': '2', 'x-wp-total': '3' },
    };
  }
  if (route === 'products/2/variations')
    return {
      data: [
        product(21, { manage_stock: 'parent', attributes: [{ name: 'Màu', option: 'Đỏ' }] }),
        product(22, { sku: '000-WOO-BLUE', attributes: [{ name: 'Màu', option: 'Xanh' }] }),
      ],
      headers: { 'x-wp-totalpages': '1' },
    };
  if (route === 'products/9/variations') {
    const ids =
      Number(url.searchParams.get('page')) === 1
        ? Array.from({ length: 100 }, (_, i) => 9000 + i)
        : [9100];
    return {
      data: ids.map((id) => product(id, { attributes: [{ name: 'Mã', option: String(id) }] })),
      headers: { 'x-wp-totalpages': '2' },
    };
  }
  if (route === 'products/10/variations')
    return { data: [product(10001)], headers: { 'x-wp-totalpages': '1' } };
  const id = Number(route.split('/')[1]);
  assert(products.has(id), `Unexpected fixture path ${route}`);
  return { data: products.get(id), headers: {} };
};
async function http(method, endpoint, body, actor = 'writer') {
  const response = await fetch(qa.base + '/api/v1/sales/' + endpoint, {
    method,
    headers: { Authorization: 'Bearer ' + actor, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}
async function draft(ids, token = randomUUID()) {
  const res = await http('POST', `woocommerce/${connectionId}/import`, {
    productIds: ids,
    clientToken: token,
  });
  assert.equal(res.status, 201, JSON.stringify(res));
  return res.body;
}
async function preview(session, selectedOptions = options) {
  return imports.preview(qa.actors.writer.organizationId, session.id, {
    sheetIndex: 0,
    mapping,
    options: selectedOptions,
  });
}
async function complete(session) {
  const org = qa.actors.writer.organizationId;
  let next = await imports.confirm(org, session.id, session.previewVersion);
  while (next.status === 'RUNNING')
    next = await imports.process(org, session.id, qa.actors.writer.id);
  return next;
}
async function apiChecks() {
  const org = qa.actors.writer.organizationId;
  assert.throws(() => normalizeWooWebsite('http://shop.example.com'));
  assert.throws(() => normalizeWooWebsite('https://a:b@shop.example.com'));
  assert.throws(() => normalizeWooWebsite('https://shop.example.com?x=1'));
  assert.equal(
    normalizeWooWebsite('https://shop.example.com/sub'),
    'https://shop.example.com/sub/',
  );
  // Real SSRF validation, without ever connecting to loopback or private addresses.
  await assert.rejects(originalFetch('https://127.0.0.1/', 'Basic synthetic'));
  await assert.rejects(originalFetch('https://169.254.169.254/', 'Basic synthetic'));
  await assert.rejects(originalFetch('http://example.com/', 'Basic synthetic'));
  assert.equal((await http('POST', 'woocommerce', credentials, 'reader')).status, 403);
  const connected = await http('POST', 'woocommerce', {
    ...credentials,
    websiteUrl: credentials.websiteUrl + 'product-category/my-pham/',
  });
  assert.equal(connected.status, 201, JSON.stringify(connected));
  connectionId = connected.body.id;
  assert.equal(connected.body.websiteUrl, credentials.websiteUrl);
  assert(!JSON.stringify(connected.body).includes('credentials'));
  const saved = await qa.db.wooCommerceConnection.findUnique({ where: { id: connectionId } });
  assert(!saved.credentials.includes(credentials.consumerSecret));
  assert.equal(
    JSON.parse(decryptSecret(saved.credentials, secret)).consumerKey,
    credentials.consumerKey,
  );
  assert(
    !JSON.stringify((await http('GET', 'woocommerce')).body).includes(credentials.consumerSecret),
  );
  assert.equal(
    (await http('GET', `woocommerce/${connectionId}/products`, undefined, 'foreign')).status,
    404,
  );
  assert.equal(
    (
      await http('POST', `woocommerce/${connectionId}/category-url`, {
        url: 'https://other.example/product-category/my-pham/',
      })
    ).status,
    400,
  );
  const resolved = await http('POST', `woocommerce/${connectionId}/category-url`, {
    url: credentials.websiteUrl + 'product-category/my-pham/',
  });
  assert.equal(resolved.body.id, 7);
  const secondPage = await http('GET', `woocommerce/${connectionId}/products?page=2&categoryId=7`);
  assert.equal(secondPage.body.items[0].id, 3);
  assert(remoteCalls.some((url) => url.includes('category=7')));
  failRemote = true;
  const failed = await http('GET', `woocommerce/${connectionId}/products`);
  assert.equal(failed.status, 400);
  assert.equal(failed.body.code, 'WOO_HTTP_401');
  assert(!JSON.stringify(failed).includes('remote secret'));
  for (const status of [403, 404, 429, 302]) {
    failureStatus = status;
    const diagnostic = await http('GET', `woocommerce/${connectionId}/products`);
    assert.equal(diagnostic.status, 400);
    assert.equal(diagnostic.body.code, `WOO_HTTP_${status}`);
    if (status === 404) assert(diagnostic.body.message.includes('URL gốc'));
    assert(!JSON.stringify(diagnostic).includes('remote secret'));
  }
  failureStatus = 401;
  failRemote = false;
  currency = 'USD';
  assert.equal((await http('POST', 'woocommerce', credentials)).status, 400);
  currency = 'VND';

  const token = randomUUID();
  let session = await draft([1, 2], token);
  assert.equal((await draft([2, 1], token)).id, session.id);
  assert.equal(
    (
      await http('POST', `woocommerce/${connectionId}/import`, {
        productIds: [3],
        clientToken: token,
      })
    ).status,
    409,
  );
  session = await preview(session);
  assert.equal(session.counts.READY, 3);
  const sourceRows = (await imports.rows(org, session.id, { page: 1, pageSize: 25 })).items;
  assert(
    sourceRows.some((row) => row.source.variationId === 21 && row.source.stockScope === 'parent'),
  );
  await complete(session);
  assert.equal(await qa.db.salesProduct.count({ where: { organizationId: org } }), 3);
  assert.equal(await qa.db.salesStockBatch.count({ where: { organizationId: org } }), 0);
  assert.equal(await qa.db.salesStockMovement.count({ where: { organizationId: org } }), 0);
  assert.equal(await qa.db.wooCommerceProduct.count({ where: { organizationId: org } }), 3);
  assert.equal(
    (
      await qa.db.salesProduct.aggregate({
        where: { organizationId: org },
        _sum: { stockQty: true },
      })
    )._sum.stockQty,
    0,
  );
  const replay = await preview(await draft([1, 2]));
  assert.equal(replay.counts.SKIPPED, 3);
  await complete(replay);
  assert.equal(await qa.db.salesProduct.count({ where: { organizationId: org } }), 3);
  // Change only selected price field. Existing warehouse balances stay unchanged.
  products.get(1).price = '99000';
  const updated = await complete(
    await preview(await draft([1]), { ...options, mode: 'update', updateFields: ['price'] }),
  );
  assert.equal(updated.counts.UPDATED, 1);
  const link = await qa.db.wooCommerceProduct.findUnique({
    where: { connectionId_externalId: { connectionId, externalId: '1' } },
    include: { product: true },
  });
  assert.equal(Number(link.product.price), 99000);
  assert.equal(link.product.stockQty, 0);
  await qa.sales.createProduct(
    org,
    { name: 'Internal existing', sku: 'EXISTING-SKU' },
    qa.actors.writer.id,
  );
  assert.equal((await preview(await draft([4]))).counts.INVALID, 1);

  // Two independent previews for the same code-less source must not create two local products.
  const a = await preview(await draft([5]));
  const b = await preview(await draft([5]));
  await Promise.all([complete(a), complete(b)]);
  assert.equal(
    await qa.db.salesProduct.count({ where: { organizationId: org, name: 'Woo sản phẩm 5' } }),
    1,
  );
  // Source linkage failure rolls back product + result atomically; retry writes once.
  await qa.db.$executeRawUnsafe(
    `CREATE FUNCTION woo_qa_reject_link() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.external_id='6' THEN RAISE EXCEPTION 'Synthetic source link failure'; END IF; RETURN NEW; END $$`,
  );
  await qa.db.$executeRawUnsafe(
    `CREATE TRIGGER woo_qa_link BEFORE INSERT ON woocommerce_products FOR EACH ROW EXECUTE FUNCTION woo_qa_reject_link()`,
  );
  const rollback = await preview(await draft([6]));
  assert.equal((await complete(rollback)).counts.ERROR, 1);
  assert.equal(
    await qa.db.salesProduct.count({ where: { name: 'Woo sản phẩm 6', organizationId: org } }),
    0,
  );
  await qa.db.$executeRawUnsafe('DROP TRIGGER woo_qa_link ON woocommerce_products');
  await qa.db.$executeRawUnsafe('DROP FUNCTION woo_qa_reject_link()');
  const retry = await imports.retry(org, rollback.id);
  await imports.process(org, retry.id, qa.actors.writer.id);
  await imports.process(org, retry.id, qa.actors.writer.id);
  assert.equal(
    await qa.db.salesProduct.count({ where: { name: 'Woo sản phẩm 6', organizationId: org } }),
    1,
  );
  const listed = await qa.sales.listProducts(org, { page: 1, pageSize: 50 });
  assert(
    listed.items.some((item) =>
      item.websiteSources.some((s) => s.externalId === '1' && s.snapshot.stockQuantity === 12),
    ),
  );
  console.log(
    'PASS: credentials, read-only API, category URL, pagination, variants, isolated stock, selected updates, tenant/permission enforcement, cross-session idempotency and atomic rollback/retry',
  );
  woo.limits = new RateLimitService();
  const paginated = await draft([9]);
  assert.equal(paginated.sheets[0].rowCount, 101);
  assert(
    remoteCalls.some((url) => url.includes('products/9/variations') && url.includes('page=2')),
  );
  const before = await qa.db.salesProductImport.count();
  const incomplete = await http('POST', `woocommerce/${connectionId}/import`, {
    productIds: [10],
    clientToken: randomUUID(),
  });
  assert.equal(incomplete.status, 400);
  assert.equal(await qa.db.salesProductImport.count(), before);
  currency = 'USD';
  assert.equal(
    (
      await http('POST', `woocommerce/${connectionId}/import`, {
        productIds: [7],
        clientToken: randomUUID(),
      })
    ).status,
    400,
  );
  currency = 'VND';
  const malicious = await draft([7]);
  const badMapping = { ...mapping };
  delete badMapping.price;
  badMapping.stockQty = mapping.price;
  const blocked = await imports.preview(org, malicious.id, {
    sheetIndex: 0,
    mapping: badMapping,
    options,
  });
  assert.equal(blocked.counts.INVALID, 1);
  console.log(
    'PASS: 101 variations across API pages, incomplete source rejection, changed currency rejection and server-side prohibition of website opening stock',
  );
}
async function transportChecks() {
  const https = require('node:https'),
    { EventEmitter } = require('node:events');
  const originalRequest = https.request;
  let mode = 'success',
    calls = 0;
  shared.__setDnsLookupForTests(async () => [{ address: '8.8.8.8', family: 4 }]);
  https.request = (options, callback) => {
    calls++;
    assert.equal(options.method, 'GET');
    assert.equal(options.servername, 'shop.example.invalid');
    assert.equal(
      options.headers.Authorization,
      mode.startsWith('discovery') ? undefined : 'Basic synthetic',
    );
    options.lookup('shop.example.invalid', { all: true }, (error, addresses) => {
      assert.equal(error, null);
      assert.equal(addresses[0].address, '8.8.8.8');
    });
    const req = new EventEmitter();
    req.destroy = (error) => {
      if (error) process.nextTick(() => req.emit('error', error));
    };
    req.end = () =>
      process.nextTick(() => {
        if (mode === 'timeout') return;
        const res = new EventEmitter();
        res.destroy = () => {};
        res.statusCode = ['redirect', 'discoveryRedirect'].includes(mode)
          ? 302
          : mode === 'error'
            ? 401
            : 200;
        res.headers = {
          'content-type': 'application/json',
          ...(['redirect', 'discoveryRedirect'].includes(mode)
            ? { location: 'https://evil.example.invalid/' }
            : {}),
          ...(mode === 'large' ? { 'content-length': '5000000' } : {}),
          ...(mode === 'discoveryHeader'
            ? { link: '<https://shop.example.invalid/wp-json/>; rel="https://api.w.org/"' }
            : {}),
          ...(mode === 'discoveryExternal'
            ? { link: '<https://evil.example.invalid/wp-json/>; rel="https://api.w.org/"' }
            : {}),
        };
        callback(res);
        res.emit(
          'data',
          Buffer.from(
            mode === 'discoveryHtml'
              ? '<link href="https://shop.example.invalid/sub/wp-json/" rel="https://api.w.org/">'
              : '{"ok":true,"remoteSecret":"must not escape errors"}',
          ),
        );
        res.emit('end');
      });
    return req;
  };
  try {
    assert.equal(
      (await originalFetch('https://shop.example.invalid/api', 'Basic synthetic')).data.ok,
      true,
    );
    mode = 'redirect';
    const before = calls;
    await assert.rejects(
      originalFetch('https://shop.example.invalid/api', 'Basic synthetic'),
      (error) => error.code === 'HTTP_ERROR' && error.statusCode === 302,
    );
    assert.equal(calls, before + 1);
    mode = 'error';
    await assert.rejects(
      originalFetch('https://shop.example.invalid/api', 'Basic synthetic'),
      (error) => !error.message.includes('remoteSecret'),
    );
    mode = 'large';
    await assert.rejects(
      originalFetch('https://shop.example.invalid/api', 'Basic synthetic'),
      (error) => error.code === 'TOO_LARGE',
    );
    mode = 'timeout';
    await assert.rejects(
      originalFetch('https://shop.example.invalid/api', 'Basic synthetic', 20),
      (error) => error.code === 'TIMEOUT',
    );
    mode = 'discoveryHeader';
    assert.equal(
      await originalDiscover('https://shop.example.invalid/bo-luu-dien-offline/'),
      'https://shop.example.invalid/',
    );
    mode = 'discoveryHtml';
    assert.equal(
      await originalDiscover('https://shop.example.invalid/sub/category/'),
      'https://shop.example.invalid/sub/',
    );
    mode = 'discoveryExternal';
    assert.equal(await originalDiscover('https://shop.example.invalid/category/'), null);
    mode = 'discoveryNone';
    assert.equal(await originalDiscover('https://shop.example.invalid/sub/'), null);
    mode = 'discoveryRedirect';
    const discoveryCalls = calls;
    await assert.rejects(originalDiscover('https://shop.example.invalid/category/'));
    assert.equal(calls, discoveryCalls + 1);
  } finally {
    https.request = originalRequest;
    shared.__setDnsLookupForTests(null);
  }
  console.log(
    'PASS: real authenticated transport pins public IP, uses GET only, refuses redirects without forwarding credentials, limits size/time and sanitizes errors',
  );
}
async function uiChecks() {
  const web = path.join(root, 'apps/web'),
    dir = path.join(root, 'tmp/sales-products-qa');
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
    `import React from'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import{I18nProvider}from'../../apps/web/src/i18n/i18n-provider';import Page from'../../apps/web/src/app/(app)/sales/products/page';const actors=${JSON.stringify(qa.actors)};const qc=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});qc.setQueryData(['auth','me'],actors[new URLSearchParams(location.search).get('actor')||'writer']);createRoot(document.getElementById('root')!).render(<QueryClientProvider client={qc}><I18nProvider initialLocale="vi"><Page/></I18nProvider></QueryClientProvider>);`,
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
  const { execFileSync } = require('node:child_process');
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
      'apps/web/src/app/(app)/sales/products/page.tsx,apps/web/src/components/sales/*.tsx,apps/web/src/components/ui/*.tsx,apps/web/src/components/shared/*.tsx',
      '--minify',
    ],
    { cwd: root, stdio: 'pipe' },
  );
  browser = await require('playwright').chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 950 } });
  await context.addInitScript(() =>
    localStorage.setItem(
      'ms_access_token',
      `synthetic.${btoa(JSON.stringify({ exp: 4102444800, qaActor: 'writer' }))}.test`,
    ),
  );
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(qa.base + '/qa');
  await page.getByRole('button', { name: 'Nhập nhanh sản phẩm', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Kết nối WooCommerce', exact: true }).click();
  await dialog
    .getByLabel('URL gốc website (HTTPS)', { exact: true })
    .fill(credentials.websiteUrl + 'product-category/my-pham/');
  await dialog.getByLabel('Consumer Key', { exact: true }).fill(credentials.consumerKey);
  await dialog.getByLabel('Consumer Secret', { exact: true }).fill(credentials.consumerSecret);
  await dialog.getByRole('button', { name: 'Kiểm tra và lưu kết nối', exact: true }).click();
  await page.waitForFunction(() => document.getElementById('woo-secret')?.value === '');
  assert.equal(
    await dialog.getByLabel('URL gốc website (HTTPS)', { exact: true }).inputValue(),
    credentials.websiteUrl,
  );
  await dialog.getByText(/Đã nhận diện website gốc/).waitFor();
  await dialog
    .getByLabel('Hoặc dán link danh mục của website này', { exact: true })
    .fill(credentials.websiteUrl + 'product-category/my-pham/');
  await dialog.getByRole('button', { name: 'Tìm danh mục', exact: true }).click();
  await page.waitForFunction(() => document.getElementById('woo-category')?.value === '7');
  await dialog.getByRole('button', { name: 'Trang sau', exact: true }).click();
  await dialog
    .getByRole('button', { name: 'Chọn tất cả kết quả (tối đa 100)', exact: true })
    .click();
  await dialog.getByText(/Đã chọn 3 sản phẩm cha/).waitFor();
  await dialog.getByRole('button', { name: 'Bỏ chọn tất cả', exact: true }).click();
  await dialog.getByLabel('Chọn Woo UI mới', { exact: true }).check();
  const out = path.join(root, 'tmp/sales-woocommerce-qa');
  await page.screenshot({ path: path.join(out, 'woo-selection.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 850 });
  await page.screenshot({ path: path.join(out, 'woo-mobile.png'), fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.setViewportSize({ width: 1280, height: 950 });
  await dialog.getByRole('button', { name: 'Đọc chi tiết → Xem trước nhập', exact: true }).click();
  await dialog.getByRole('button', { name: 'Xem trước / kiểm tra', exact: true }).click();
  await dialog.getByRole('button', { name: 'Xác nhận nhập 1 dòng hợp lệ', exact: true }).waitFor();
  await page.screenshot({ path: path.join(out, 'woo-preview.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Xác nhận nhập 1 dòng hợp lệ', exact: true }).click();
  await dialog.getByRole('progressbar').waitFor();
  await page.waitForFunction(() => {
    const p = document.querySelector('progress');
    return p && p.max > 0 && p.value === p.max;
  });
  assert(
    await qa.db.salesProduct.findFirst({
      where: { organizationId: qa.actors.writer.organizationId, sku: '000-WOO-UI', stockQty: 0 },
    }),
  );
  assert.deepEqual(errors, []);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Nhập nhanh sản phẩm', exact: true }).click();
  assert.equal(
    await page.getByRole('dialog').getByLabel('File Excel/CSV', { exact: true }).inputValue(),
    '',
  );
  console.log(
    'PASS: real React/controller/database UI flow: connect, category URL, pagination, select, preview, confirm and mobile layout',
  );
}
(async () => {
  try {
    await qa.start({
      controllers: [WooCommerceController, ProductImportController],
      providers: [
        { provide: WooCommerceService, useValue: woo },
        { provide: ProductImportService, useValue: imports },
      ],
    });
    await transportChecks();
    await apiChecks();
    await uiChecks();
  } finally {
    shared.fetchPublicAuthenticatedJson = originalFetch;
    shared.discoverPublicWordPressWebsite = originalDiscover;
    if (browser) await browser.close();
    await qa.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
