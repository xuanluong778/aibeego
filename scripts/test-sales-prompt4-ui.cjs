/**
 * Browser harness for Prompt 4 sales UI.
 * Serves the real orders / purchases / stock / stocktake pages against a fixture API.
 * Usage: node scripts/test-sales-prompt4-ui.cjs
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'tmp/sales-prompt4-ui');
const web = path.join(root, 'apps/web');
fs.mkdirSync(dir, { recursive: true });

fs.writeFileSync(
  path.join(dir, 'link-stub.tsx'),
  `import React from 'react';
export default function Link(props: { href?: string; children?: React.ReactNode; className?: string }) {
  return <a href={props.href || '#'} className={props.className}>{props.children}</a>;
}
`,
);

fs.writeFileSync(
  path.join(dir, 'entry.tsx'),
  `import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/i18n/i18n-provider';
import Orders from '@/app/(app)/sales/orders/page';
import Purchases from '@/app/(app)/sales/purchases/page';
import Stock from '@/app/(app)/sales/stock-movements/page';
import Stocktake from '@/app/(app)/sales/stocktake/page';
const screen = new URLSearchParams(location.search).get('screen') || 'orders';
const Page = screen === 'purchases' ? Purchases : screen === 'stock' ? Stock : screen === 'stocktake' ? Stocktake : Orders;
const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={qc}><I18nProvider initialLocale="vi"><Page /></I18nProvider></QueryClientProvider>,
);
`,
);

const esbuildDir = fs.readdirSync(path.join(root, 'node_modules/.pnpm')).find((d) => d.startsWith('esbuild@'));
if (!esbuildDir) throw new Error('Không tìm thấy esbuild');
const esbuild = require(path.join(root, 'node_modules/.pnpm', esbuildDir, 'node_modules/esbuild'));
esbuild.buildSync({
  entryPoints: [path.join(dir, 'entry.tsx')],
  outfile: path.join(dir, 'ui.js'),
  bundle: true,
  platform: 'browser',
  jsx: 'automatic',
  alias: {
    '@': path.join(web, 'src'),
    'next/link': path.join(dir, 'link-stub.tsx'),
  },
  nodePaths: [path.join(web, 'node_modules')],
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.NEXT_PUBLIC_API_URL': '"http://127.0.0.1:4019"',
  },
  logLevel: 'error',
});

const products = Array.from({ length: 51 }, (_, i) => ({
  id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`,
  name: i === 7 ? 'Pin QA' : `Sản phẩm ${String(i).padStart(2, '0')}`,
  sku: `SKU-${String(i).padStart(3, '0')}`,
  model: i === 7 ? 'MODEL-PIN' : `M-${i}`,
  barcode: `BC${String(i).padStart(6, '0')}`,
  unit: 'cái',
  price: 100000 + i,
  costPrice: 0,
  stockQty: 4,
  sellableQty: 3,
  minStockQty: 0,
  isActive: true,
}));
const order = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'SO-P4',
  status: 'SHIPPED',
  exportedAt: '2026-11-23T00:00:00.000Z',
  customerId: '22222222-2222-4222-8222-222222222222',
  customerName: 'Khách QA',
  phone: '0900000000',
  total: 300000,
  subtotal: 300000,
  discount: 0,
  shippingFee: 0,
  amountPaid: 150000,
  amountCollected: 180000,
  amountRefunded: 30000,
  amountDue: 150000,
  amountRefundable: 0,
  paymentStatus: 'PARTIAL',
  source: 'OTHER',
  createdAt: '2026-11-23T00:00:00.000Z',
  items: [
    {
      id: '33333333-3333-4333-8333-333333333331',
      productId: products[7].id,
      productName: 'Pin QA',
      quantity: 2,
      returnedQty: 0,
      unitPrice: 100000,
      totalPrice: 200000,
    },
    {
      id: '33333333-3333-4333-8333-333333333332',
      productId: products[7].id,
      productName: 'Pin QA',
      quantity: 1,
      returnedQty: 0,
      unitPrice: 100000,
      totalPrice: 100000,
    },
  ],
};
const stocktake = {
  id: '44444444-4444-4444-8444-444444444444',
  code: 'KK-P4',
  status: 'DRAFT',
  scope: 'ALL_ACTIVE',
  productCount: 51,
  catalogMatched: 51,
  note: 'qa',
  createdAt: '2026-11-23T00:00:00.000Z',
  lines: products.map((p, i) => ({
    id: `55555555-5555-4555-8555-${String(i + 1).padStart(12, '0')}`,
    productId: p.id,
    systemQty: 3,
    countedQty: 3,
    variance: 0,
    product: { id: p.id, name: p.name, sku: p.sku, barcode: p.barcode },
  })),
};
const seen = { previewKeys: [], returnKeys: [], previewAttempts: 0 };

function pageOf(url) {
  const page = Number(url.searchParams.get('page') || 1);
  const pageSize = Number(url.searchParams.get('pageSize') || 20);
  const q = (url.searchParams.get('search') || '').toLowerCase();
  const filtered = products.filter((p) =>
    !q || [p.name, p.sku, p.model, p.barcode].some((v) => v.toLowerCase().includes(q)),
  );
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);
  return {
    items,
    total: filtered.length,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
  };
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1:4019');
  const send = (code, body, type) => {
    const payload = Buffer.isBuffer(body) || typeof body === 'string' ? body : JSON.stringify(body);
    res.writeHead(code, { 'Content-Type': type || 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(payload);
  };
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': '*',
    });
    res.end();
    return;
  }
  if (url.pathname === '/' || url.pathname === '/qa') {
    send(
      200,
      `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/ui.css"></head><body class="bg-slate-950 text-slate-100"><div id="root"></div><script>window.process={env:{NODE_ENV:"production",NEXT_PUBLIC_API_URL:"http://127.0.0.1:4019"}};</script><script>window.addEventListener("error",function(e){var p=document.createElement("pre");p.id="boot-error";p.textContent=String(e.message)+"\\n"+(e.error&&e.error.stack||"");document.body.appendChild(p);});</script><script src="/ui.js"></script></body></html>`,
      'text/html; charset=utf-8',
    );
    return;
  }
  if (url.pathname === '/ui.js') return send(200, fs.readFileSync(path.join(dir, 'ui.js')), 'text/javascript');
  if (url.pathname === '/ui.css') {
    const css = fs.existsSync(path.join(dir, 'ui.css')) ? fs.readFileSync(path.join(dir, 'ui.css')) : '';
    return send(200, css, 'text/css');
  }
  if (url.pathname === '/__qa') return send(200, seen);
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8');
    let body = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { body = {}; }
    const p = url.pathname.replace(/^\/api\/v1/, '');
    if (p === '/auth/me') {
      return send(200, {
        id: 'user-1',
        email: 'qa@example.invalid',
        name: 'QA',
        role: 'OWNER',
        organizationId: 'org-1',
        permissions: [],
      });
    }
    if (p.startsWith('/sales/products/')) {
      const found = products.find((item) => item.id === p.split('/').pop());
      return send(found ? 200 : 404, found || { message: 'missing' });
    }
    if (p.startsWith('/sales/products')) return send(200, pageOf(url));
    if (p.startsWith('/sales/orders/') && p.endsWith(order.id) === false && p.includes(order.id)) {
      return send(200, order);
    }
    if (p === '/sales/orders') return send(200, { items: [order], total: 1, page: 1, pageSize: 20, totalPages: 1 });
    if (p === `/sales/orders/${order.id}`) return send(200, order);
    if (p === '/customers') {
      return send(200, { items: [{ id: order.customerId, name: order.customerName, phone: order.phone }], total: 1, page: 1, pageSize: 20, totalPages: 1 });
    }
    if (p === '/sales/returns/preview') {
      seen.previewAttempts += 1;
      if (body.idempotencyKey) seen.previewKeys.push(body.idempotencyKey);
      if (seen.previewAttempts === 1) return send(500, { message: 'Tạm lỗi preview' });
      return send(200, {
        suggestedRefundMax: 100000,
        amountPaid: 150000,
        amountDue: 150000,
        allocation: { totals: { merchandise: 100000, revenueReversal: 100000, suggestedRefundMax: 100000 } },
      });
    }
    if (p === '/sales/returns' && req.method === 'POST') {
      if (body.idempotencyKey) seen.returnKeys.push(body.idempotencyKey);
      return send(200, { id: 'ret-1', orderStatus: 'PARTIALLY_RETURNED' });
    }
    if (p === '/sales/stocktakes') {
      return send(200, { items: [stocktake], total: 1, page: 1, pageSize: 30, totalPages: 1 });
    }
    if (p === `/sales/stocktakes/${stocktake.id}`) return send(200, stocktake);
    if (p === '/sales/stock/reconcile') return send(200, { ok: true, counts: { mismatches: 0 }, mismatches: [] });
    if (p.startsWith('/sales/stock/movements')) {
      return send(200, { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });
    }
    if (p.startsWith('/sales/suppliers')) {
      return send(200, { items: [{ id: '66666666-6666-4666-8666-666666666666', name: 'NCC QA' }], total: 1, page: 1, pageSize: 50, totalPages: 1 });
    }
    if (p.startsWith('/sales/purchase-orders')) {
      return send(200, { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });
    }
    if (req.method === 'GET') return send(200, { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 });
    return send(200, { ok: true });
  });
});

const host = process.env.PROMPT4_UI_HOST || '127.0.0.1';
server.listen(4019, host, () => {
  console.log(`Prompt 4 UI http://${host}:4019/qa`);
});
