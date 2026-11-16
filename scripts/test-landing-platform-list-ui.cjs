// Render the actual My Pages component and menu in Chromium with fixture HTTP data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const qa = path.join(root, '.platform-subdomain-qa');
const web = path.join(root, 'apps/web');
const esbuild = require(path.join(root, 'node_modules/.pnpm', fs.readdirSync(path.join(root, 'node_modules/.pnpm')).find(x => x.startsWith('esbuild@')), 'node_modules/esbuild'));
const items = [
  { id: 'subdomain-page', name: 'Subdomain regression', slug: 'old-page-path', publicPath: '/p/old-page-path', publicUrl: 'https://vibecode.aibeego.com/' },
  { id: 'path-page', name: 'Path regression', slug: 'path-only-page', publicPath: '/p/path-only-page', publicUrl: null },
].map(page => ({ ...page, status: 'PUBLISHED', theme: 'MODERN', updatedAt: '2026-11-16T10:00:00Z' }));
async function main() {
  fs.mkdirSync(qa, { recursive: true });
  const entry = path.join(qa, 'list-entry.tsx');
  fs.writeFileSync(entry, `import React from 'react';import{createRoot}from'react-dom/client';import Pages from '../apps/web/src/app/(app)/landing-pages/pages/page';createRoot(document.getElementById('root')!).render(<Pages/>);`);
  const stubs = {
    'next/navigation': `export const useRouter=()=>({push(){},refresh(){}});const params=new URLSearchParams();export const useSearchParams=()=>params;`,
    'next/link': `import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}`,
    '@/i18n/i18n-provider': `export const useT=()=>(key)=>key;`,
    '@/components/shared/page-header': `export function PageHeader(){return null;}`,
  };
  await esbuild.build({ entryPoints: [entry], outfile: path.join(qa, 'list.js'), bundle: true, platform: 'browser', jsx: 'automatic', alias: { '@': path.join(web, 'src') }, nodePaths: [path.join(web, 'node_modules')], define: { 'process.env': '{}', 'process.env.NODE_ENV': '"production"' }, logLevel: 'warning', plugins: [{ name: 'route-context', setup(build) {
    build.onResolve({ filter: /^(next\/navigation|next\/link|@\/i18n\/i18n-provider|@\/components\/shared\/page-header)$/ }, args => ({ path: args.path, namespace: 'route-context' }));
    build.onLoad({ filter: /.*/, namespace: 'route-context' }, args => ({ contents: stubs[args.path], loader: 'tsx', resolveDir: web }));
  } }] });
  const server = http.createServer((req, res) => {
    if (req.url === '/list.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(fs.readFileSync(path.join(qa, 'list.js'))); }
    else if (req.url.startsWith('/api/v1/landing-pages')) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ items })); }
    else { res.setHeader('Content-Type', 'text/html'); res.end('<div id="root"></div><script src="/list.js"></script>'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.LP_QA_CHROME || '/snap/chromium/current/usr/lib/chromium-browser/chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('ms_access_token', 'qa.' + btoa(JSON.stringify({ exp: Date.now() / 1000 + 3600 })) + '.qa'));
    await page.goto('http://127.0.0.1:' + server.address().port);
    const subdomainRow = page.getByRole('row').filter({ hasText: 'Subdomain regression' });
    await subdomainRow.getByText('vibecode.aibeego.com', { exact: true }).waitFor();
    await subdomainRow.getByRole('button', { name: 'Thao tác', exact: true }).click();
    assert.equal(await page.getByRole('menuitem', { name: 'Xem trang công khai', exact: true }).getAttribute('href'), 'https://vibecode.aibeego.com/');
    await page.keyboard.press('Escape');
    const pathRow = page.getByRole('row').filter({ hasText: 'Path regression' });
    await pathRow.getByRole('button', { name: 'Thao tác', exact: true }).click();
    assert.equal(await page.getByRole('menuitem', { name: 'Xem trang công khai', exact: true }).getAttribute('href'), '/p/path-only-page');
    assert.deepEqual(errors, []);
    console.log('PASS Actual page list displays the chosen hostname and opens its HTTPS URL.');
    console.log('PASS Pages without a subdomain retain the public path fallback.');
    console.log('PASS No browser runtime errors.');
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
