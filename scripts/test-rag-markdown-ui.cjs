const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const web = path.join(root, 'apps/web');
const dir = path.join(root, 'tmp/rag-markdown-ui');
const esbuild = require(
  path.join(
    root,
    'node_modules/.pnpm',
    fs.readdirSync(path.join(root, 'node_modules/.pnpm')).find((x) => x.startsWith('esbuild@')),
    'node_modules/esbuild',
  ),
);
(async () => {
  fs.mkdirSync(dir, { recursive: true });
  const example =
    '# Tri thức doanh nghiệp\n\n## Dịch vụ SEO\n\nTư vấn theo nhu cầu của khách hàng.\n\n- Phân tích website\n- Xây dựng nội dung\n\n| Gói | Giá |\n| --- | --- |\n| Cơ bản | 5.000.000 ₫ |\n\nƯu đãi đến **30/11/2026**.\n\n[Nguồn](https://example.com/)\n\n<script>window.attack = true</script>\n\n[Unsafe](javascript:alert(1))\n\n![Tracker](https://tracking.example/pixel)';
  fs.writeFileSync(
    path.join(dir, 'entry.tsx'),
    `import React,{useState}from'react';import{createRoot}from'react-dom/client';import{KnowledgeMarkdownEditor}from'../../apps/web/src/components/knowledge-base/knowledge-markdown-editor';function App(){const[v,set]=useState(${JSON.stringify(example)});return <div style={{maxWidth:1000,margin:'auto',padding:24}}><h1 style={{fontSize:24,marginBottom:16}}>Xem và sửa tài liệu</h1><KnowledgeMarkdownEditor value={v} onChange={set} title="Tri thức doanh nghiệp"/></div>}createRoot(document.getElementById('root')!).render(<App/>);`,
  );
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
      'apps/web/src/components/knowledge-base/knowledge-markdown-editor.tsx,apps/web/src/components/ui/*.tsx',
      '--minify',
    ],
    { cwd: root, stdio: 'pipe' },
  );
  await esbuild.build({
    entryPoints: [path.join(dir, 'entry.tsx')],
    outfile: path.join(dir, 'ui.js'),
    bundle: true,
    platform: 'browser',
    jsx: 'automatic',
    alias: { '@': path.join(web, 'src') },
    nodePaths: [path.join(web, 'node_modules')],
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  const server = http.createServer((req, res) => {
    if (req.url === '/ui.js') {
      res.setHeader('Content-Type', 'application/javascript');
      return res.end(fs.readFileSync(path.join(dir, 'ui.js')));
    }
    if (req.url === '/ui.css') {
      res.setHeader('Content-Type', 'text/css');
      return res.end(fs.readFileSync(path.join(dir, 'ui.css')));
    }
    res.setHeader('Content-Type', 'text/html');
    res.end(
      '<meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/ui.css"><div id="root"></div><script src="/ui.js"></script>',
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1100, height: 850 } });
    const errors = [],
      tracking = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => {
      if (r.url().includes('tracking.example')) tracking.push(r.url());
    });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.getByRole('heading', { name: 'Tri thức doanh nghiệp', exact: true }).waitFor();
    assert.equal(await page.locator('article ul li').count(), 2);
    assert.equal(await page.locator('article td').count(), 2);
    assert.equal(await page.locator('article img,article script').count(), 0);
    assert.equal(await page.evaluate(() => window.attack), undefined);
    assert.equal(await page.getByText('Unsafe', { exact: true }).getAttribute('href'), '');
    assert.equal(
      await page.getByText('Nguồn', { exact: true }).getAttribute('rel'),
      'noopener noreferrer',
    );
    await page.screenshot({ path: path.join(dir, 'preview-desktop.png'), fullPage: true });
    await page.getByRole('tab', { name: 'Sửa Markdown', exact: true }).click();
    const edited = example + '\n\nNội dung sửa được giữ nguyên.';
    await page.getByLabel('Nội dung Markdown', { exact: true }).fill(edited);
    await page.getByRole('tab', { name: 'Xem trước', exact: true }).click();
    await page.getByText('Nội dung sửa được giữ nguyên.', { exact: true }).waitFor();
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Tải .md', exact: true }).click();
    const download = await downloadEvent,
      bytes = [];
    for await (const chunk of await download.createReadStream()) bytes.push(chunk);
    assert(download.suggestedFilename().endsWith('.md'));
    assert.equal(Buffer.concat(bytes).toString('utf8'), edited);
    await page.setViewportSize({ width: 390, height: 850 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(dir, 'preview-mobile.png'), fullPage: true });
    assert.deepEqual(errors, []);
    assert.deepEqual(tracking, []);
    console.log(
      'PASS: readable Markdown preview, headings/lists/tables, edit-preview retains changes, UTF-8 download, mobile layout and no raw HTML/scripts/tracking requests.',
    );
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
