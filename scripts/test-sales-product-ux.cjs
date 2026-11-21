// Synthetic data in the fixed disposable sales_products_qa database only.
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const { execFileSync } = require('node:child_process');
const qa = require('./test-sales-products.cjs');
const {
  sourceProductModel,
  sourceDescriptionMarkdown,
} = require('../packages/shared/dist/sales-product-source');
const root = path.resolve(__dirname, '..'),
  out = path.join(root, 'tmp/sales-product-ux-qa');
let browser, product, oldest;
async function api(method, route, body, actor = 'writer') {
  const res = await fetch(qa.base + '/api/v1/sales/' + route, {
    method,
    headers: { Authorization: 'Bearer ' + actor, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, body: await res.json() };
}
async function checks() {
  const org = qa.actors.writer.organizationId;
  assert.equal(
    sourceProductModel({
      description: '<p>Giới thiệu</p><li><strong>Model: Hyundai HD-1000VA</strong></li>',
    }),
    'Hyundai HD-1000VA',
  );
  assert.equal(
    sourceProductModel({ attributes: [{ name: 'Model', option: '000-ABC' }] }),
    '000-ABC',
  );
  assert.equal(
    sourceProductModel({ description: '<script>Model: wrong</script><p>Không ghi model</p>' }),
    null,
  );
  assert(
    !sourceDescriptionMarkdown(
      '<script>window.bad=1</script><h2>Thông số</h2><ul><li>Model: UPS</li></ul>',
    ).includes('window.bad'),
  );
  oldest = await qa.sales.createProduct(
    org,
    { name: 'Máy công nghiệp cũ nhất', sku: 'OLDEST-999', model: 'EATON 9PX3000', price: 200 },
    qa.actors.writer.id,
  );
  await qa.db.salesProduct.createMany({
    data: Array.from({ length: 55 }, (_, i) => ({
      organizationId: org,
      name: 'Fill ' + i,
      sku: 'FILL-' + i,
    })),
  });
  const created = await api('POST', 'products', {
    name: 'Bộ lưu điện Offline 1000VA/600W',
    sku: '000-UPS',
    model: 'Hyundai HD-1000VA',
    price: 2500000,
    costPrice: 1000000,
    stockQty: 5,
  });
  assert.equal(created.status, 201, JSON.stringify(created));
  product = created.body;
  await qa.sales.createProduct(
    org,
    { name: 'Biến thể model trùng', sku: 'UPS-OTHER', model: 'Hyundai HD-1000VA' },
    qa.actors.writer.id,
  );
  const connection = await qa.db.wooCommerceConnection.create({
    data: {
      organizationId: org,
      websiteUrl: 'https://fixture.example.invalid/',
      credentials: 'synthetic-only',
      currency: 'VND',
    },
  });
  const description =
    '<h2>Thông số chung cơ bản</h2><ul><li><strong>Model: Hyundai HD-1000VA</strong></li><li>Công suất: 1000VA/600W</li></ul><p>' +
    'Mô tả chi tiết dễ đọc. '.repeat(100) +
    '</p><script>window.__PRODUCT_INJECTED=1</script><a href="javascript:alert(1)">Liên kết không an toàn</a>';
  await qa.db.wooCommerceProduct.create({
    data: {
      organizationId: org,
      connectionId: connection.id,
      externalId: '17',
      productId: product.id,
      snapshot: {
        description,
        shortDescription: '<p>Dòng UPS offline cho máy tính và camera.</p>',
        images: [
          'https://fixture.example.invalid/front.svg',
          'https://fixture.example.invalid/back.svg',
        ],
        attributes: [
          { name: 'Model', option: 'Hyundai HD-1000VA' },
          { name: 'Công suất', option: '1000VA/600W' },
        ],
        url: 'https://fixture.example.invalid/product/ups/',
        stockQuantity: 10,
        stockStatus: 'instock',
        stockScope: 'item',
        regularPrice: '2500000',
        status: 'publish',
        fetchedAt: new Date().toISOString(),
      },
    },
  });
  await qa.sales.invalidateProductCache(org);
  for (const query of ['Offline', '9px3000', 'OLDEST-999', 'hd-1000va']) {
    const result = await api('GET', 'products?search=' + encodeURIComponent(query));
    assert.equal(result.status, 200);
    assert(result.body.items.length > 0, query);
  }
  assert(!(await api('GET', 'products?pageSize=50')).body.items.some((p) => p.id === oldest.id));
  assert.equal((await api('GET', 'products/lookup?q=OLDEST-999')).body.id, oldest.id);
  assert.equal((await api('GET', 'products/lookup?q=9px3000')).body.id, oldest.id);
  assert.equal(
    (await api('GET', 'products/lookup?q=' + encodeURIComponent('Hyundai HD-1000VA'))).status,
    409,
  );
  const detail = await api('GET', 'products/' + product.id);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.sources[0].images.length, 2);
  assert(detail.body.sources[0].description.length > 1000);
  assert(!JSON.stringify(detail.body).includes('synthetic-only'));
  assert(!detail.body.sources[0].description.includes('__PRODUCT_INJECTED'));
  assert.equal((await api('GET', 'products/' + product.id, undefined, 'foreign')).status, 404);
  assert.equal((await api('GET', 'products/' + product.id, undefined, 'reader')).status, 200);
  qa.actors.locked = { ...qa.actors.reader, permissions: [] };
  assert.equal((await api('GET', 'products/' + product.id, undefined, 'locked')).status, 403);
  assert.equal(
    (await api('POST', 'stock/outbound', { productId: product.id, quantity: 1 }, 'reader')).status,
    403,
  );
  assert.equal(
    (
      await api(
        'POST',
        'stock/inbound',
        { productId: product.id, quantity: 1, batchCode: 'NO-WRITE' },
        'reader',
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await api(
        'POST',
        'stock/adjust',
        { productId: product.id, delta: 1, reason: 'No write' },
        'reader',
      )
    ).status,
    403,
  );
  assert.equal((await qa.db.salesProduct.findUnique({ where: { id: product.id } })).stockQty, 5);
  console.log(
    'PASS: model field, server search beyond 50 rows, unambiguous lookup, safe full detail/gallery and tenant/read/write enforcement',
  );
}
async function ui() {
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
    `import React from'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import{I18nProvider}from'../../apps/web/src/i18n/i18n-provider';import Products from'../../apps/web/src/app/(app)/sales/products/page';import Stock from'../../apps/web/src/app/(app)/sales/stock-movements/page';const actors=${JSON.stringify(qa.actors)},params=new URLSearchParams(location.search),qc=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});qc.setQueryData(['auth','me'],actors[params.get('actor')||'writer']);createRoot(document.getElementById('root')!).render(<QueryClientProvider client={qc}><I18nProvider initialLocale="vi">{params.get('screen')==='stock'?<Stock/>:<Products/>}</I18nProvider></QueryClientProvider>);`,
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
      'apps/web/src/app/(app)/sales/products/page.tsx,apps/web/src/app/(app)/sales/stock-movements/page.tsx,apps/web/src/components/sales/*.tsx,apps/web/src/components/ui/*.tsx,apps/web/src/components/shared/*.tsx',
      '--minify',
    ],
    { cwd: root, stdio: 'pipe' },
  );
  browser = await require('playwright').chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript(() => {
    const actor = new URLSearchParams(location.search).get('actor') || 'writer';
    localStorage.setItem(
      'ms_access_token',
      `synthetic.${btoa(JSON.stringify({ exp: 4102444800, qaActor: actor }))}.test`,
    );
  });
  await ctx.route('https://fixture.example.invalid/**', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#f1f5f9"/><rect x="150" y="100" width="300" height="400" rx="20" fill="#334155"/><circle cx="220" cy="180" r="12" fill="#22c55e"/><text x="300" y="340" font-size="42" text-anchor="middle" fill="white">UPS 1000VA</text></svg>',
    }),
  );
  const page = await ctx.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(qa.base + '/qa');
  await page.getByRole('button', { name: 'Xem chi tiết ' + product.name, exact: true }).waitFor();
  assert.equal(await page.locator('table details').count(), 0);
  await page.screenshot({ path: path.join(out, 'catalog.png'), fullPage: true });
  await page.getByRole('button', { name: 'Xem chi tiết ' + product.name, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('heading', { name: product.name, exact: true }).waitFor();
  await dialog.getByRole('img', { name: product.name, exact: true }).first().waitFor();
  await dialog.getByRole('button', { name: 'Xem ảnh 2', exact: true }).click();
  await dialog.getByRole('tab', { name: 'Thông số', exact: true }).click();
  await dialog.getByRole('tabpanel').getByText('1000VA/600W', { exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.__PRODUCT_INJECTED), undefined);
  await dialog.getByRole('tab', { name: 'Mô tả chi tiết', exact: true }).click();
  await page.screenshot({ path: path.join(out, 'detail-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 850 });
  await page.screenshot({ path: path.join(out, 'detail-mobile.png'), fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(qa.base + '/qa?screen=stock');
  await page.getByRole('tab', { name: 'Xuất kho', exact: true }).click();
  const search = page.getByRole('combobox', {
    name: 'Tìm sản phẩm theo tên, model, SKU hoặc barcode',
  });
  for (const term of ['9PX3000', 'OLDEST-999', 'Máy công nghiệp cũ nhất']) {
    await search.fill(term);
    await page.getByRole('option', { name: /Máy công nghiệp cũ nhất/ }).waitFor();
  }
  await page.getByRole('option', { name: /Máy công nghiệp cũ nhất/ }).click();
  await page.getByText('Đã chọn: Máy công nghiệp cũ nhất', { exact: true }).waitFor();
  await search.fill('000-UPS');
  await page.getByRole('option', { name: /Bộ lưu điện Offline/ }).waitFor();
  await search.press('ArrowDown'); await search.press('Enter');
  await page.getByText('Đã chọn: ' + product.name, { exact: true }).waitFor();
  await page.screenshot({ path: path.join(out, 'outbound-picker.png'), fullPage: true });
  await page.getByRole('button', { name: 'Xuất kho', exact: true }).click();
  await page.getByText('Đã xuất kho (FEFO)', { exact: true }).waitFor();
  assert.equal((await qa.db.salesProduct.findUnique({ where: { id: product.id } })).stockQty, 4);
  assert.deepEqual(errors, []);
  console.log(
    'PASS: image catalog, WordPress-style safe modal/gallery, mobile and name/model/SKU selection outside first 50 followed by actual outbound',
  );
}
(async () => {
  try {
    await qa.start();
    await checks();
    await ui();
  } finally {
    if (browser) await browser.close();
    await qa.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
