// Uses only the fixed disposable PostgreSQL/Redis configured by test-sales-products.cjs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { randomUUID } = require('node:crypto');
const qa = require('./test-sales-products.cjs');
const apiRequire = createRequire(path.resolve(__dirname, '../apps/api/package.json'));
const ExcelJS = apiRequire('exceljs');
const JSZip = createRequire(apiRequire.resolve('exceljs'))('jszip');
const { ProductImportController } = require('../apps/api/dist/sales/product-import.controller');
const { ProductImportService } = require('../apps/api/dist/sales/product-import.service');
const { PrismaService } = require('../apps/api/dist/prisma/prisma.service');
const util = require('../apps/api/dist/sales/product-spreadsheet.util');
const imports = new ProductImportService(qa.db, qa.sales);
const root = path.resolve(__dirname, '..'),
  dir = path.join(root, 'tmp/sales-import-qa');
const headers = Object.values(util.PRODUCT_COLUMNS),
  fields = util.IMPORT_FIELDS;
const mapping = Object.fromEntries(fields.map((field, index) => [field, index]));
const options = { mode: 'skip', createCategories: false, updateFields: [] };
const pass = (message) => console.log('PASS:', message);
let browser;
async function http(method, route, body, actor = 'writer') {
  const res = await fetch(`${qa.base}/api/v1/sales/product-imports${route}`, {
    method,
    headers: { Authorization: `Bearer ${actor}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await res.json();
  return { status: res.status, data };
}
async function upload(
  buffer,
  name = 'products.csv',
  token = randomUUID(),
  actor = 'writer',
  delimiter = 'auto',
) {
  const form = new FormData();
  form.append('file', new Blob([buffer]), name);
  const res = await fetch(
    `${qa.base}/api/v1/sales/product-imports?clientToken=${token}&delimiter=${encodeURIComponent(delimiter)}`,
    { method: 'POST', headers: { Authorization: `Bearer ${actor}` }, body: form },
  );
  return { status: res.status, data: await res.json() };
}
function csv(rows, separator = ',') {
  return Buffer.from(
    '\ufeff' +
      [headers, ...rows]
        .map((row) =>
          Array.from(
            { length: headers.length },
            (_, index) => '"' + String(row[index] ?? '').replace(/"/g, '""') + '"',
          ).join(separator),
        )
        .join('\r\n'),
    'utf8',
  );
}
async function preview(id, selectedOptions = options, sheetIndex = 0, selectedMapping = mapping) {
  const result = await http('POST', `/${id}/preview`, {
    sheetIndex,
    mapping: selectedMapping,
    options: selectedOptions,
  });
  assert.equal(result.status, 201, JSON.stringify(result));
  return result.data;
}
async function rows(id, page = 1) {
  const result = await http('GET', `/${id}/rows?page=${page}&pageSize=100`);
  assert.equal(result.status, 200);
  return result.data;
}
async function confirm(session) {
  const result = await http('POST', `/${session.id}/confirm`, {
    previewVersion: session.previewVersion,
  });
  assert.equal(result.status, 201, JSON.stringify(result));
  return result.data;
}
async function processBatch(id) {
  const result = await http('POST', `/${id}/process`, {});
  assert.equal(result.status, 201, JSON.stringify(result));
  return result.data;
}
async function complete(session) {
  let result = await confirm(session);
  while (result.status === 'RUNNING') result = await processBatch(session.id);
  return result;
}
async function parserChecks() {
  const content = csv(
    [
      [
        'Sản phẩm Việt',
        '00123',
        '00004',
        '',
        'hộp',
        '1234.50',
        '2',
        '3',
        '1',
        'Dòng một, dấu phẩy;\nDòng hai "nháy"',
      ],
    ],
    ';',
  );
  const parsed = await util.parseProductSpreadsheet('vietnam.csv', content);
  assert.equal(parsed[0].rows[0].cells[1].value, '00123');
  assert.equal(parsed[0].rows[0].cells[9].value, 'Dòng một, dấu phẩy;\nDòng hai "nháy"');
  await assert.rejects(
    () => util.parseProductSpreadsheet('bad.csv', Buffer.from([0xff, 0xfe, 0xff])),
    /UTF-8/,
  );
  await assert.rejects(
    () => util.parseProductSpreadsheet('bad.csv', Buffer.from('A,B\n"unterminated')),
    /phân cách|nháy/,
  );
  await assert.rejects(
    () => util.parseProductSpreadsheet('ambiguous.csv', Buffer.from('A,B;C\nx,y;z')),
    /phân cách/,
  );
  assert.equal(
    (await util.parseProductSpreadsheet('explicit.csv', Buffer.from('A,B;C\nx,y;z'), ','))[0]
      .headers.length,
    2,
  );
  await assert.rejects(
    () =>
      util.parseProductSpreadsheet(
        'too-many.csv',
        csv(Array.from({ length: 2001 }, () => ['Many rows'])),
      ),
    /2.000/,
  );
  await assert.rejects(
    () => util.parseProductSpreadsheet('huge.csv', Buffer.alloc(5 * 1024 * 1024 + 1)),
    /5MB/,
  );
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Hướng dẫn').addRow(['Không phải dữ liệu']);
  const sheet = workbook.addWorksheet('Sản phẩm');
  sheet.addRow(headers);
  sheet.addRow(['Unicode Việt', '00023', '00045', '', 'cái', 1200.25, 1000.5, 3, 1, 'Một\nHai']);
  sheet.addRow(['Numeric code', 123, 'bar', '', '', 1, 0, 0, 0, '']);
  sheet.getCell('B3').numFmt = '000000';
  sheet.addRow(['Formula', 'formula', '', '', '', { formula: '100+20', result: 120 }, 0, 0, 0, '']);
  sheet.addRow(['Date', 'date', '', '', '', new Date('2026-11-21T00:00:00Z'), 0, 0, 0, '']);
  const xlsx = Buffer.from(await workbook.xlsx.writeBuffer());
  fs.writeFileSync(path.join(dir, 'fixtures.xlsx'), xlsx);
  const sheets = await util.parseProductSpreadsheet('fixture.xlsx', xlsx);
  assert.equal(sheets.length, 2);
  assert.equal(sheets[1].name, 'Sản phẩm');
  assert.equal(sheets[1].rows[0].cells[1].value, '00023');
  assert.equal(sheets[1].rows[1].cells[1].kind, 'number');
  assert.equal(sheets[1].rows[2].cells[5].kind, 'formula');
  assert.equal(sheets[1].rows[3].cells[5].kind, 'invalid');
  const template = await util.productImportTemplate('xlsx'),
    templateWb = new ExcelJS.Workbook();
  await templateWb.xlsx.load(template);
  assert.deepEqual(templateWb.worksheets[0].getRow(1).values.slice(1), headers);
  assert.equal(templateWb.worksheets[0].getColumn(2).numFmt, '@');
  const zip = new JSZip();
  zip.file('xl/workbook.xml', '<workbook/>');
  zip.file('bomb.xml', 'x'.repeat(21 * 1024 * 1024));
  const zipBomb = Buffer.from(
    await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }),
  );
  await assert.rejects(() => util.parseProductSpreadsheet('bomb.xlsx', zipBomb), /20MB/);
  pass(
    'CSV UTF-8/BOM, comma/semicolon, quoted multiline; XLSX multiple sheets/text IDs/numeric ID flags/formulas/dates; templates, malformed/ambiguous/oversized files and ZIP expansion limits',
  );
  return xlsx;
}
async function apiChecks(xlsx) {
  const skuA = await qa.sales.createProduct(
    qa.actors.writer.organizationId,
    {
      name: 'Existing A',
      sku: 'EXIST',
      barcode: 'EXBAR',
      price: 10,
      costPrice: 4,
      stockQty: 9,
      note: 'Keep note',
      minStockQty: 2,
    },
    qa.actors.writer.id,
  );
  const skuB = await qa.sales.createProduct(
    qa.actors.writer.organizationId,
    { name: 'Existing B', sku: 'OTHER', barcode: 'OTHERBAR' },
    qa.actors.writer.id,
  );
  const data = csv([
    [
      'Sản phẩm Việt',
      '00111',
      '000222',
      'Mới',
      'hộp',
      '1234.50',
      '700.25',
      '5',
      '2',
      'Dòng 1\nDòng 2',
    ],
    ['No code retry', '', '', '', 'cái', '10', '4', '3', '1', ''],
    ['Existing skip', 'EXIST', '', '', '', '', '', '999', '', ''],
    ['Wrong negative', 'NEG', '', '', '', '-1', '', '0', '', ''],
    ['Ambiguous number', 'AMB', '', '', '', '1,234', '', '', '', ''],
    ['Duplicate one', 'DUP', '', '', '', '', '', '', '', ''],
    ['Duplicate two', 'DUP', '', '', '', '', '', '', '', ''],
    ['Conflict identifiers', 'OTHER', 'EXBAR', '', '', '', '', '', '', ''],
    ['Formula CSV', 'FORM', '', '', '', '=1+2', '', '', '', ''],
    ['Transient failure', 'FAIL-IMPORT', '', 'Rollback category', '', '10', '5', '2', '', ''],
  ]);
  const token = randomUUID();
  const uploaded = await upload(data, 'products.csv', token);
  assert.equal(uploaded.status, 201, JSON.stringify(uploaded));
  const id = uploaded.data.id;
  assert.equal((await upload(data, 'products.csv', token)).data.id, id);
  assert.equal((await upload(csv([['Different']]), 'products.csv', token)).status, 409);
  const noCategory = await preview(id);
  let resultRows = (await rows(id)).items;
  assert(resultRows[0].errors.some((error) => error.includes('Danh mục chưa có')));
  const ready = await preview(id, { ...options, createCategories: true });
  assert.equal(
    (await http('POST', `/${id}/confirm`, { previewVersion: noCategory.previewVersion })).status,
    409,
  );
  assert.equal(ready.counts.READY, 3);
  assert.equal(ready.counts.SKIPPED, 1);
  assert.equal(ready.counts.INVALID, 6);
  assert.equal(
    await qa.db.salesProductCategory.count({
      where: { organizationId: qa.actors.writer.organizationId },
    }),
    0,
  );
  resultRows = (await rows(id)).items;
  assert(resultRows[7].errors.some((error) => error.includes('hai sản phẩm')));
  assert(
    resultRows[5].errors.some((error) => error.includes('Trùng')) &&
      resultRows[6].errors.some((error) => error.includes('Trùng')),
  );
  await qa.db.$executeRawUnsafe(
    `CREATE FUNCTION sales_qa_reject_import() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS (SELECT 1 FROM sales_products WHERE id=NEW.product_id AND sku='FAIL-IMPORT') THEN RAISE EXCEPTION 'Synthetic failure'; END IF; RETURN NEW; END $$`,
  );
  await qa.db.$executeRawUnsafe(
    'CREATE TRIGGER sales_qa_reject_import BEFORE INSERT ON sales_stock_movements FOR EACH ROW EXECUTE FUNCTION sales_qa_reject_import()',
  );
  await qa.request('GET', 'products?page=1&pageSize=50');
  await confirm(ready);
  const concurrent = await Promise.all([processBatch(id), processBatch(id)]);
  assert(concurrent.some((result) => result.status === 'COMPLETED'));
  let final = (await http('GET', '/' + id)).data;
  assert.equal(final.counts.CREATED, 2);
  assert.equal(final.counts.ERROR, 1);
  assert.equal(final.counts.INVALID, 6);
  assert.equal(
    await qa.db.salesProduct.count({
      where: { name: 'No code retry', organizationId: qa.actors.writer.organizationId },
    }),
    1,
  );
  assert.equal(
    await qa.db.salesProduct.count({
      where: { sku: 'FAIL-IMPORT', organizationId: qa.actors.writer.organizationId },
    }),
    0,
  );
  assert.equal(
    await qa.db.salesProductCategory.count({
      where: { name: 'Rollback category', organizationId: qa.actors.writer.organizationId },
    }),
    0,
  );
  await qa.db.$executeRawUnsafe('DROP TRIGGER sales_qa_reject_import ON sales_stock_movements');
  await qa.db.$executeRawUnsafe('DROP FUNCTION sales_qa_reject_import()');
  await http('POST', `/${id}/retry`, {});
  await processBatch(id);
  await processBatch(id);
  final = (await http('GET', '/' + id)).data;
  assert.equal(final.counts.CREATED, 3);
  assert.equal(final.counts.ERROR || 0, 0);
  const imported = await qa.db.salesProduct.findFirstOrThrow({
    where: { organizationId: qa.actors.writer.organizationId, sku: '00111' },
  });
  assert.equal(imported.barcode, '000222');
  assert.equal(imported.stockQty, 5);
  const freshList = await qa.request('GET', 'products?page=1&pageSize=50');
  assert(freshList.body.items.some((item) => item.id === imported.id && item.physicalQty === 5));
  assert.equal(Number(imported.price), 1234.5);
  assert.equal(imported.note, 'Dòng 1\nDòng 2');
  const batches = await qa.db.salesStockBatch.findMany({ where: { productId: imported.id } });
  assert.equal(batches.length, 1);
  assert(batches[0].batchCode.startsWith('OPENING-'));
  assert.equal(Number(batches[0].unitCost), 700.25);
  const importRow = await qa.db.salesProductImportRow.findFirstOrThrow({
    where: { importId: id, productId: imported.id },
  });
  assert.equal(importRow.status, 'CREATED');
  const report = await fetch(`${qa.base}/api/v1/sales/product-imports/${id}/report.csv`, {
    headers: { Authorization: 'Bearer writer' },
  });
  const reportText = await report.text();
  assert(reportText.includes('INVALID') && reportText.includes('Dòng 1'));
  assert(reportText.includes("'=1+2"));
  assert.equal(
    (await http('POST', `/${id}/preview`, { sheetIndex: 0, mapping, options })).status,
    409,
  );
  pass(
    'preview errors/duplicates/conflicts, opt-in categories; concurrent processing, row atomicity/rollback, partial success, safe error report and retry exactly once including rows without codes',
  );
  const updateData = csv([['', 'EXIST', '', '', '', '25.50', '88', '999', '7', '']]);
  const up = (await upload(updateData)).data;
  const previewUpdate = await preview(up.id, {
    mode: 'update',
    createCategories: false,
    updateFields: ['price', 'note', 'minStockQty'],
  });
  assert.equal(previewUpdate.counts.READY, 1);
  assert((await rows(up.id)).items[0].warnings.some((w) => w.includes('Tồn đầu kỳ')));
  await complete(previewUpdate);
  const updated = await qa.db.salesProduct.findUniqueOrThrow({ where: { id: skuA.id } });
  assert.equal(updated.name, 'Existing A');
  assert.equal(updated.note, 'Keep note');
  assert.equal(updated.stockQty, 9);
  assert.equal(Number(updated.price), 25.5);
  assert.equal(Number(updated.costPrice), 4);
  assert.equal(updated.minStockQty, 7);
  assert.equal(await qa.db.salesStockBatch.count({ where: { productId: skuA.id } }), 1);
  assert.equal(
    (
      await http('POST', `/${up.id}/preview`, {
        sheetIndex: 0,
        mapping,
        options: { ...options, mode: 'update', updateFields: ['stockQty'] },
      })
    ).status,
    400,
  );
  const workbookUpload = (await upload(xlsx, 'multi.xlsx')).data;
  const sheetPreview = await preview(workbookUpload.id, options, 1);
  assert.equal(sheetPreview.counts.READY, 1);
  assert.equal(sheetPreview.counts.INVALID, 3);
  await complete(sheetPreview);
  assert(
    await qa.db.salesProduct.findFirst({
      where: { organizationId: qa.actors.writer.organizationId, sku: '00023', barcode: '00045' },
    }),
  );
  const foreignUpload = (
    await upload(csv([['Same other org', '00111']]), 'org.csv', randomUUID(), 'foreign')
  ).data;
  assert.equal((await http('GET', `/${id}`, undefined, 'foreign')).status, 404);
  for (const suffix of ['', '/rows', '/report.csv']) {
    const res = await fetch(`${qa.base}/api/v1/sales/product-imports/${id}${suffix}`, {
      headers: { Authorization: 'Bearer foreign' },
    });
    assert.equal(res.status, 404);
  }
  for (const action of ['confirm', 'process', 'retry'])
    assert.equal(
      (
        await http(
          'POST',
          `/${id}/${action}`,
          action === 'confirm' ? { previewVersion: ready.previewVersion } : {},
          'foreign',
        )
      ).status,
      404,
    );
  for (const route of ['', '/template', '/' + id])
    assert.equal((await http('GET', route, undefined, 'reader')).status, 403);
  assert.equal(
    (await upload(csv([['Forbidden']]), 'forbidden.csv', randomUUID(), 'reader')).status,
    403,
  );
  assert.equal((await http('POST', `/${id}/process`, {}, 'reader')).status, 403);
  const foreignPreview = await http(
    'POST',
    `/${foreignUpload.id}/preview`,
    { sheetIndex: 0, mapping, options },
    'foreign',
  );
  assert.equal(foreignPreview.data.counts.READY, 1);
  assert(!(await http('GET', '', undefined, 'foreign')).data.items.some((item) => item.id === id));
  const largeSession = (
    await upload(csv(Array.from({ length: 51 }, (_, index) => ['Batch ' + index])))
  ).data;
  const largePreview = await preview(largeSession.id);
  await confirm(largePreview);
  const afterBatch = await processBatch(largeSession.id);
  assert.equal(afterBatch.counts.CREATED, 25);
  assert.equal(afterBatch.counts.PENDING, 26);
  await Promise.all([processBatch(largeSession.id), processBatch(largeSession.id)]);
  while ((await http('GET', '/' + largeSession.id)).data.status === 'RUNNING')
    await processBatch(largeSession.id);
  assert.equal((await http('GET', '/' + largeSession.id)).data.counts.CREATED, 51);
  assert.equal((await rows(largeSession.id)).total, 51);
  await assert.rejects(
    () =>
      qa.db.salesProductImportRow.create({
        data: {
          organizationId: qa.actors.foreign.organizationId,
          importId: id,
          rowNumber: 500,
          cells: {},
          status: 'READY',
          action: 'CREATE',
          errors: [],
          warnings: [],
        },
      }),
    (error) => error.code === 'P2003',
  );
  const changedCodeSession = (await upload(csv([['Do not replace', 'NEW-AFTER-PREVIEW']]))).data;
  const changedCodePreview = await preview(changedCodeSession.id);
  await qa.sales.createProduct(
    qa.actors.writer.organizationId,
    { name: 'Concurrent user product', sku: 'NEW-AFTER-PREVIEW', stockQty: 2 },
    qa.actors.writer.id,
  );
  assert.equal((await complete(changedCodePreview)).counts.SKIPPED, 1);
  const unapprovedUpdate = (await upload(csv([['Do not overwrite', 'UPDATE-AFTER-PREVIEW']]))).data;
  const unapprovedPreview = await preview(unapprovedUpdate.id, {
    ...options,
    mode: 'update',
    updateFields: ['name'],
  });
  await qa.sales.createProduct(
    qa.actors.writer.organizationId,
    { name: 'Concurrent unchanged', sku: 'UPDATE-AFTER-PREVIEW' },
    qa.actors.writer.id,
  );
  assert.equal((await complete(unapprovedPreview)).counts.ERROR, 1);
  assert(
    await qa.db.salesProduct.findFirst({
      where: { name: 'Concurrent unchanged', sku: 'UPDATE-AFTER-PREVIEW' },
    }),
  );
  await qa.db.$executeRawUnsafe(
    `CREATE FUNCTION sales_qa_reject_result() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status='CREATED' AND EXISTS (SELECT 1 FROM sales_products WHERE id=NEW.product_id AND name='Result rollback') THEN RAISE EXCEPTION 'Synthetic result write failure'; END IF; RETURN NEW; END $$`,
  );
  await qa.db.$executeRawUnsafe(
    'CREATE TRIGGER sales_qa_reject_result BEFORE UPDATE ON sales_product_import_rows FOR EACH ROW EXECUTE FUNCTION sales_qa_reject_result()',
  );
  const resultFailure = (await upload(csv([['Result rollback', '', '', '', '', '4', '2', '3']])))
    .data;
  await complete(await preview(resultFailure.id));
  assert.equal(await qa.db.salesProduct.count({ where: { name: 'Result rollback' } }), 0);
  await qa.db.$executeRawUnsafe('DROP TRIGGER sales_qa_reject_result ON sales_product_import_rows');
  await qa.db.$executeRawUnsafe('DROP FUNCTION sales_qa_reject_result()');
  await http('POST', `/${resultFailure.id}/retry`, {});
  await processBatch(resultFailure.id);
  await processBatch(resultFailure.id);
  assert.equal(await qa.db.salesProduct.count({ where: { name: 'Result rollback' } }), 1);
  pass(
    'selected-field updates/blank preservation/no stock writes, explicit XLSX sheet, organization and order.write enforcement, 25-row resumable batches and atomic row-result idempotency',
  );
}
async function uiChecks() {
  const { chromium } = require('playwright');
  const web = path.join(root, 'apps/web');
  const esbuild = require(
    path.join(
      root,
      'node_modules/.pnpm',
      fs.readdirSync(path.join(root, 'node_modules/.pnpm')).find((x) => x.startsWith('esbuild@')),
      'node_modules/esbuild',
    ),
  );
  const uiDir = path.join(root, 'tmp/sales-products-qa');
  fs.mkdirSync(uiDir, { recursive: true });
  fs.writeFileSync(
    path.join(uiDir, 'entry.tsx'),
    `import React from'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import{I18nProvider}from'../../apps/web/src/i18n/i18n-provider';import Page from'../../apps/web/src/app/(app)/sales/products/page';const actor=new URLSearchParams(location.search).get('actor')||'writer';const actors=${JSON.stringify(qa.actors)};const qc=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});qc.setQueryData(['auth','me'],actors[actor]);createRoot(document.getElementById('root')!).render(<QueryClientProvider client={qc}><I18nProvider initialLocale="vi"><Page/></I18nProvider></QueryClientProvider>);`,
  );
  await esbuild.build({
    entryPoints: [path.join(uiDir, 'entry.tsx')],
    outfile: path.join(uiDir, 'ui.js'),
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
    path.join(uiDir, 'input.css'),
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
      path.join(uiDir, 'input.css'),
      '-o',
      path.join(uiDir, 'ui.css'),
      '--content',
      'apps/web/src/app/(app)/sales/products/page.tsx,apps/web/src/components/sales/product-import-dialog.tsx,apps/web/src/components/ui/*.tsx,apps/web/src/components/shared/*.tsx',
      '--minify',
    ],
    { cwd: root, stdio: 'pipe' },
  );
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } }),
    errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const actor = new URLSearchParams(location.search).get('actor') || 'writer';
    localStorage.setItem(
      'ms_access_token',
      `synthetic.${btoa(JSON.stringify({ exp: 4102444800, qaActor: actor }))}.test`,
    );
  });
  await page.goto(qa.base + '/qa');
  await page.getByRole('button', { name: 'Nhập nhanh sản phẩm', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const templateEvent = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Tải mẫu .xlsx', exact: true }).click();
  assert((await templateEvent).suggestedFilename().endsWith('.xlsx'));
  await dialog.getByLabel('File Excel/CSV', { exact: true }).setInputFiles({
    name: 'ui-products.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      csv([
        [
          'Import UI Việt',
          '000-UI-IMPORT',
          '',
          'UI import category',
          'hộp',
          '1200.50',
          '800.25',
          '4',
          '2',
          'Chào\nDòng hai',
        ],
        ['UI invalid', '', '', '', '', '-5'],
      ])
        .toString('utf8')
        .replace('Tên sản phẩm', 'Tên hàng tùy chỉnh'),
      'utf8',
    ),
  });
  await dialog.getByRole('button', { name: 'Đọc file / tạo phiên', exact: true }).click();
  await dialog.getByLabel('Tên sản phẩm', { exact: true }).selectOption('0');
  await dialog.getByLabel('Cho phép tạo danh mục mới', { exact: true }).check();
  await dialog.getByRole('button', { name: 'Xem trước / kiểm tra', exact: true }).click();
  await dialog.getByRole('button', { name: 'Xác nhận nhập 1 dòng hợp lệ', exact: true }).waitFor();
  await dialog.getByText(/Dòng lỗi không được nhập/).waitFor();
  await page.screenshot({ path: path.join(dir, 'import-preview.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Xác nhận nhập 1 dòng hợp lệ', exact: true }).click();
  await dialog.getByRole('progressbar').waitFor();
  await page.waitForFunction(
    () => document.querySelector('progress')?.value === document.querySelector('progress')?.max,
  );
  assert(
    await qa.db.salesProduct.findFirst({
      where: { organizationId: qa.actors.writer.organizationId, sku: '000-UI-IMPORT', stockQty: 4 },
    }),
  );
  const reportEvent = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Tải kết quả / lỗi CSV', exact: true }).click();
  const report = await reportEvent;
  const chunks = [];
  for await (const chunk of await report.createReadStream()) chunks.push(chunk);
  assert(Buffer.concat(chunks).toString('utf8').includes('INVALID'));
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
    `Import dialog must fit the mobile viewport: ${JSON.stringify(bounds)}`,
  );
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.screenshot({ path: path.join(dir, 'import-mobile.png'), fullPage: true });
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Nhập nhanh sản phẩm', exact: true }).click();
  await page
    .getByRole('region', { name: 'Lịch sử nhập sản phẩm' })
    .getByText('ui-products.csv', { exact: true })
    .waitFor();
  await dialog
    .getByLabel('File Excel/CSV', { exact: true })
    .setInputFiles(path.join(dir, 'fixtures.xlsx'));
  await dialog.getByRole('button', { name: 'Đọc file / tạo phiên', exact: true }).click();
  assert.equal(await dialog.getByLabel('Sheet dữ liệu', { exact: true }).inputValue(), '-1');
  await dialog.getByLabel('Sheet dữ liệu', { exact: true }).selectOption('1');
  await dialog.getByRole('button', { name: 'Xem trước / kiểm tra', exact: true }).click();
  await dialog
    .getByText(/Lỗi dữ liệu: 3/)
    .first()
    .waitFor();
  await page.goto(qa.base + '/qa?actor=reader');
  await page.getByText('Bạn chỉ có quyền xem sản phẩm.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Nhập nhanh sản phẩm', exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  pass(
    'real import UI to API/DB: templates, file/mapping/preview/errors, confirmation/progress, UTF-8 report, persisted history, mobile and read-only access',
  );
}
(async () => {
  fs.mkdirSync(dir, { recursive: true });
  try {
    const xlsx = await parserChecks();
    await qa.start({
      controllers: [ProductImportController],
      providers: [
        { provide: ProductImportService, useValue: imports },
        { provide: PrismaService, useValue: qa.db },
      ],
    });
    await apiChecks(xlsx);
    await uiChecks();
  } finally {
    if (browser) await browser.close();
    await qa.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
