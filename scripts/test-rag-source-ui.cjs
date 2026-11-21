const fs = require('node:fs'),
  path = require('node:path'),
  http = require('node:http');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'),
  dir = path.join(root, 'tmp/rag-source-qa'),
  web = path.join(root, 'apps/web');
const esbuild = require(
  path.join(
    root,
    'node_modules/.pnpm',
    fs.readdirSync(path.join(root, 'node_modules/.pnpm')).find((x) => x.startsWith('esbuild@')),
    'node_modules/esbuild',
  ),
);
async function main() {
  fs.mkdirSync(dir, { recursive: true });
  const css = fs
    .readFileSync(path.join(web, 'src/app/globals.css'), 'utf8')
    .replace(/^@import[^\n]*\n/gm, '');
  fs.writeFileSync(
    path.join(dir, 'input.css'),
    '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n' + css,
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
      'apps/web/src/components/knowledge-base/knowledge-source-panel.tsx,apps/web/src/components/ui/*.tsx',
      '--minify',
    ],
    { cwd: root, stdio: 'pipe' },
  );
  fs.writeFileSync(
    path.join(dir, 'entry.tsx'),
    `import React from 'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import{KnowledgeSourcePanel}from'../../apps/web/src/components/knowledge-base/knowledge-source-panel';import{KnowledgeMarkdownExportButton}from'../../apps/web/src/components/knowledge-base/knowledge-markdown-export-button';createRoot(document.getElementById('root')!).render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})}><KnowledgeSourcePanel kbId="kb-test"/><KnowledgeMarkdownExportButton kbId="kb-test" onError={console.error}/></QueryClientProvider>);`,
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
  });
  let sources = [],
    fail = false;
  const actions = [];
  const server = http.createServer(async (req, res) => {
    if (req.url === '/ui.js') {
      res.setHeader('Content-Type', 'application/javascript');
      return res.end(fs.readFileSync(path.join(dir, 'ui.js')));
    }
    if (req.url === '/ui.css') {
      res.setHeader('Content-Type', 'text/css');
      return res.end(fs.readFileSync(path.join(dir, 'ui.css')));
    }
    if (!req.url.includes('/api/')) {
      res.setHeader('Content-Type', 'text/html');
      return res.end(
        '<meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/ui.css"><div id="root" style="padding:16px"></div><script src="/ui.js"></script>',
      );
    }
    if (req.url.endsWith('/export.md')) {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="knowledge-kb-test.md"');
      return res.end('# Knowledge QA\n\n## UTF-8: Tiếng Việt\n');
    }
    res.setHeader('Content-Type', 'application/json');
    if (req.url.endsWith('/facebook-pages'))
      return res.end(
        JSON.stringify([
          {
            id: 'page-own',
            pageId: '123',
            pageName: 'Fanpage QA của tổ chức',
            connection: { status: 'CONNECTED' },
          },
        ]),
      );
    if (req.method === 'GET') return res.end(JSON.stringify(sources));
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : null;
    actions.push({ method: req.method, url: req.url, body });
    if (fail) {
      res.statusCode = 503;
      return res.end(JSON.stringify({ message: 'Hàng đợi chưa sẵn sàng' }));
    }
    if (req.method === 'POST' && req.url.endsWith('/sources')) {
      const source = {
        id: 'source-' + sources.length,
        ...body,
        enabled: true,
        status: 'queued',
        processed: 0,
        succeeded: 0,
        failed: 0,
        errors: [],
        lastSyncedAt: null,
        lastAttemptAt: new Date().toISOString(),
        sourceKey: body.kind === 'FACEBOOK' ? 'facebook:123' : body.url,
      };
      sources.push(source);
      setTimeout(
        () =>
          Object.assign(source, {
            status: 'partial',
            processed: 3,
            succeeded: 2,
            failed: 1,
            lastError: 'Một trang không tải được',
            lastSyncedAt: new Date().toISOString(),
          }),
        200,
      );
    } else if (req.method === 'PATCH')
      Object.assign(
        sources.find((s) => req.url.endsWith('/' + s.id)),
        { enabled: body.enabled, status: body.enabled ? 'idle' : 'paused' },
      );
    else if (req.method === 'DELETE')
      sources = sources.filter((s) => !req.url.endsWith('/' + s.id));
    res.end(JSON.stringify({ ok: true }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1100, height: 850 } }),
      errors = [];
    await page.addInitScript(() =>
      localStorage.setItem(
        'ms_access_token',
        `synthetic.${btoa(JSON.stringify({ exp: 4102444800 }))}.test`,
      ),
    );
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Xuất .md UTF-8', exact: true }).click();
    const download = await downloading;
    const bytes = [];
    for await (const piece of await download.createReadStream()) bytes.push(piece);
    assert.equal(download.suggestedFilename(), 'knowledge-kb-test.md');
    assert(Buffer.concat(bytes).toString('utf8').includes('Tiếng Việt'));
    await page.getByLabel('URL website', { exact: true }).fill('https://example.com');
    await page.getByRole('button', { name: 'Thêm nguồn', exact: true }).click();
    await page.getByText('Thành công một phần', { exact: true }).waitFor();
    assert.equal(actions[0].body.kind, 'WEBSITE');
    await page.getByRole('button', { name: 'Tắt nguồn', exact: true }).click();
    await page.getByText('Đã tắt', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Bật nguồn', exact: true }).click();
    await page.getByText('Chưa đồng bộ', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Đồng bộ lại', exact: true }).click();
    await page.getByLabel('Loại nguồn', { exact: true }).selectOption('FACEBOOK');
    await page.getByLabel('Fanpage đã kết nối', { exact: true }).selectOption('page-own');
    await page.getByRole('button', { name: 'Thêm nguồn', exact: true }).click();
    await page.getByText('Fanpage QA của tổ chức', { exact: true }).waitFor();
    assert(actions.some((a) => a.body?.facebookPageId === 'page-own'));
    fail = true;
    await page.getByRole('button', { name: 'Thêm nguồn', exact: true }).click();
    await page.getByText('Hàng đợi chưa sẵn sàng', { exact: true }).waitFor();
    fail = false;
    page.on('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Gỡ nguồn', exact: true }).first().click();
    await page.waitForFunction(() => document.querySelectorAll('article').length === 1);
    await page.screenshot({ path: path.join(dir, 'sources-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 850 });
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'Mobile must not overflow horizontally',
    );
    await page.screenshot({ path: path.join(dir, 'sources-mobile.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log(
      'PASS: real component Website/Fanpage add, progress/partial/error, sync/toggle/remove, mobile render, no browser errors',
    );
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
