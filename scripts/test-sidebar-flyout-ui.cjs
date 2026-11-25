/** Browser regression tests for the real sidebar/shell with synthetic identity and routing. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const web = path.join(root, 'apps/web');
const dir = path.join(root, 'tmp/sidebar-flyout-qa');
const esbuild = require(
  path.join(
    root,
    'node_modules/.pnpm',
    fs
      .readdirSync(path.join(root, 'node_modules/.pnpm'))
      .find((name) => name.startsWith('esbuild@')),
    'node_modules/esbuild',
  ),
);

async function main() {
  fs.mkdirSync(dir, { recursive: true });
  const write = (name, text) => fs.writeFileSync(path.join(dir, name), text);
  write(
    'navigation.tsx',
    `import React,{useSyncExternalStore} from 'react';
    const sub=(cb)=>{window.addEventListener('popstate',cb);return()=>window.removeEventListener('popstate',cb)};
    export const usePathname=()=>useSyncExternalStore(sub,()=>location.pathname);
    export const useSearchParams=()=>new URLSearchParams(useSyncExternalStore(sub,()=>location.search));
    export function go(href){history.pushState({},'',href);window.dispatchEvent(new PopStateEvent('popstate'))}
    export const useRouter=()=>({push:go,replace:go});
    export default React.forwardRef(function Link({href,prefetch,onClick,children,...props},ref){return <a ref={ref} href={href} {...props} onClick={e=>{onClick?.(e);if(!e.defaultPrevented){e.preventDefault();go(href)}}}>{children}</a>});`,
  );
  write(
    'auth.ts',
    `import {useSyncExternalStore} from 'react';
    const sub=(cb)=>{window.addEventListener('identity',cb);return()=>window.removeEventListener('identity',cb)};
    export function useCurrentUser(){const value=useSyncExternalStore(sub,()=>localStorage.getItem('test-user')||'user-a:MEMBER');const [id,role]=value.split(':');return {data:{id,role,name:'Nguyễn Thu Hà',email:'qa@example.test'}}}
    export const useLogout=()=>({mutate:(_,options)=>options?.onSuccess?.()});`,
  );
  write('subscription.ts', `export const useSubscriptionDisplay=()=>({display:null});`);
  write(
    'empty.tsx',
    `export const AssistantWidget=()=>null;export const MessagesHeaderIcon=()=>null;export const HeaderCreditChip=()=>null;export const HeaderSubscriptionChips=()=>null;`,
  );
  write(
    'entry.tsx',
    `import React from 'react';import{createRoot}from'react-dom/client';
    import{AppShell}from'../../apps/web/src/components/layout/app-shell';
    import{I18nProvider}from'../../apps/web/src/i18n/i18n-provider';
    createRoot(document.getElementById('root')).render(<I18nProvider initialLocale="vi"><AppShell><h1>Sản phẩm</h1><p>Quản lý danh mục sản phẩm</p><button id="outside">Nội dung trang</button></AppShell></I18nProvider>);`,
  );
  await esbuild.build({
    entryPoints: [path.join(dir, 'entry.tsx')],
    outfile: path.join(dir, 'ui.js'),
    bundle: true,
    platform: 'browser',
    jsx: 'automatic',
    alias: {
      '@': path.join(web, 'src'),
      'next/link': path.join(dir, 'navigation.tsx'),
      'next/navigation': path.join(dir, 'navigation.tsx'),
      '@/hooks/use-auth': path.join(dir, 'auth.ts'),
      '@/hooks/use-subscription-display': path.join(dir, 'subscription.ts'),
      '@/components/assistant/assistant-widget': path.join(dir, 'empty.tsx'),
    },
    plugins: [
      {
        name: 'header-fixtures',
        setup(build) {
          build.onResolve(
            { filter: /^\.\/(messages-header-icon|header-credit-chip|header-subscription-chips)$/ },
            () => ({ path: path.join(dir, 'empty.tsx') }),
          );
        },
      },
    ],
    nodePaths: [path.join(web, 'node_modules')],
    define: { 'process.env': '{}', 'process.env.NODE_ENV': '"production"' },
    logLevel: 'error',
  });
  write(
    'input.css',
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
      'apps/web/src/components/layout/*.tsx,apps/web/src/components/ui/*.tsx',
      '--minify',
    ],
    { cwd: root, stdio: 'pipe' },
  );
  const server = http.createServer((req, res) => {
    const asset = req.url === '/ui.js' ? 'ui.js' : req.url === '/ui.css' ? 'ui.css' : null;
    res.setHeader(
      'Content-Type',
      asset === 'ui.js'
        ? 'application/javascript'
        : asset
          ? 'text/css'
          : 'text/html; charset=utf-8',
    );
    res.end(
      asset
        ? fs.readFileSync(path.join(dir, asset))
        : '<!doctype html><html><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/ui.css"><div id="root"></div><script src="/ui.js"></script></html>',
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const url = `http://127.0.0.1:${server.address().port}`;
    await page.goto(url + '/sales/products');
    const rail = page.getByTestId('main-app-sidebar');
    const flyout = page.locator('[data-sidebar-flyout][data-state="open"]');
    const sales = rail.getByRole('button', { name: 'Bán hàng', exact: true });
    const waitClosed = () => flyout.waitFor({ state: 'hidden' });
    const insideViewport = async () =>
      assert(
        await flyout.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return (
            r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1
          );
        }),
        'flyout stays inside viewport',
      );
    assert.equal(Math.round((await rail.boundingBox()).width), 240);
    const reportsY = (await rail.getByRole('link', { name: 'Báo cáo', exact: true }).boundingBox())
      .y;
    await sales.hover();
    await flyout.waitFor();
    assert.equal(
      (await rail.getByRole('link', { name: 'Báo cáo', exact: true }).boundingBox()).y,
      reportsY,
      'opening does not move rows',
    );
    assert.equal(
      await flyout.locator('[aria-current="page"]').getAttribute('href'),
      '/sales/products',
    );
    await insideViewport();
    await sales.click();
    assert.equal(await flyout.count(), 1, 'click after hover keeps group open');
    const parentBox = await sales.boundingBox(),
      panelBox = await flyout.boundingBox();
    await page.mouse.move(parentBox.x + parentBox.width + 3, parentBox.y + 20);
    await page.waitForTimeout(80);
    assert(await flyout.isVisible(), 'short close delay bridges gap');
    await page.mouse.move(panelBox.x + 30, panelBox.y + 25);
    await page.waitForTimeout(260);
    assert(await flyout.isVisible());
    await page.screenshot({ animations: 'disabled', path: path.join(dir, 'desktop-expanded.png') });
    await rail.getByRole('button', { name: 'CRM & Khách hàng', exact: true }).hover();
    assert.equal(await flyout.count(), 1, 'only one group opens');
    await page.mouse.move(900, 500);
    await waitClosed();
    await sales.focus();
    await page.keyboard.press('ArrowRight');
    await flyout.waitFor();
    assert(
      await flyout.evaluate((el) => el.contains(document.activeElement)),
      'keyboard opening focuses panel',
    );
    await page.keyboard.press('End');
    assert.equal(await page.locator(':focus').getAttribute('href'), '/sales/reports');
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator(':focus').getAttribute('href'), '/sales/orders');
    await page.keyboard.press('Escape');
    await waitClosed();
    await page.waitForTimeout(250);
    assert(
      await sales.evaluate((el) => el === document.activeElement),
      'Escape restores parent focus',
    );
    await sales.hover();
    await page.locator('#outside').click();
    await waitClosed();
    await rail.getByTestId('main-app-sidebar-toggle').click();
    await page.waitForTimeout(250);
    assert.equal(Math.round((await rail.boundingBox()).width), 64);
    assert.equal(
      await page.evaluate(() => localStorage.getItem('aibeego.sidebar.collapsed:user-a')),
      '1',
    );
    await rail.getByRole('link', { name: 'Tổng quan', exact: true }).hover();
    await page.getByRole('tooltip').waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('tooltip').waitFor({ state: 'hidden' });
    await sales.hover();
    await flyout.waitFor();
    await flyout.getByRole('link', { name: 'Đơn hàng', exact: true }).click();
    await waitClosed();
    assert(page.url().endsWith('/sales/orders'));
    assert.equal(await rail.getAttribute('data-collapsed'), '1');
    await page.reload();
    assert.equal(await rail.getAttribute('data-collapsed'), '1');
    await sales.hover();
    await flyout.waitFor();
    await page.screenshot({
      animations: 'disabled',
      path: path.join(dir, 'desktop-collapsed.png'),
    });
    await page.evaluate(() => {
      localStorage.setItem('test-user', 'user-b:MEMBER');
      dispatchEvent(new Event('identity'));
    });
    await page.waitForTimeout(250);
    assert.equal(await rail.getAttribute('data-collapsed'), '0', 'preferences isolated per user');
    await rail.getByRole('button', { name: 'Landing Page', exact: true }).hover();
    await flyout.waitFor();
    assert.equal(
      await flyout.locator('a[href="/landing-pages/manage-templates"]').count(),
      0,
      'admin item hidden for member',
    );
    await page.evaluate(() => {
      localStorage.setItem('test-user', 'user-b:SUPER_ADMIN');
      dispatchEvent(new Event('identity'));
    });
    await flyout.locator('a[href="/landing-pages/manage-templates"]').waitFor();
    await page.locator('#outside').click();
    for (const height of [900, 728, 700, 600, 520]) {
      await page.setViewportSize({ width: 1280, height });
      assert(
        await rail
          .locator('[data-sidebar-menu-scroll]')
          .evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
        `all tabs fit at viewport height ${height}`,
      );
      assert.equal(
        await rail
          .locator('[data-sidebar-menu-scroll]')
          .evaluate((el) => getComputedStyle(el).scrollbarWidth),
        'none',
      );
      const navBounds = await rail
        .getByRole('navigation', { name: 'Menu chính', exact: true })
        .boundingBox();
      const lastBounds = await rail
        .getByRole('link', { name: 'Báo cáo', exact: true })
        .boundingBox();
      assert(
        navBounds.y + navBounds.height - lastBounds.y - lastBounds.height < 52,
        'menu spacing uses remaining viewport evenly',
      );
    }
    await page.setViewportSize({ width: 1280, height: 420 });
    const footer = rail.locator('[data-sidebar-footer]');
    const footerBox = await footer.boundingBox();
    assert(footerBox.y + footerBox.height <= 421);
    const scroll = rail.locator('[data-sidebar-menu-scroll]');
    assert(
      await scroll.evaluate((el) => el.scrollHeight > el.clientHeight),
      'short screen scrolls only menu',
    );
    await scroll.evaluate((el) => (el.scrollTop = el.scrollHeight));
    assert.deepEqual(await footer.boundingBox(), footerBox, 'footer unaffected by menu scrolling');
    await rail.getByRole('button', { name: 'Cài đặt', exact: true }).hover();
    await flyout.waitFor();
    await insideViewport();
    await page.screenshot({ animations: 'disabled', path: path.join(dir, 'desktop-short.png') });
    await page.mouse.click(950, 100);
    await waitClosed();
    for (const width of [768, 390, 320]) {
      await page.setViewportSize({ width, height: 700 });
      assert(!(await rail.isVisible()));
      await page.getByRole('button', { name: 'Mở menu chính', exact: true }).click();
      const drawer = page.getByRole('dialog', { name: 'Ai Bee Go — Menu chính', exact: true });
      await drawer.waitFor();
      const mobileSales = drawer.getByRole('button', { name: 'Bán hàng', exact: true });
      await mobileSales.hover();
      assert.equal(await flyout.count(), 0, 'drawer ignores hover');
      await mobileSales.click();
      await flyout.waitFor();
      await insideViewport();
      if (width === 390) {
        await page.keyboard.press('Escape');
        await waitClosed();
        assert(await drawer.isVisible(), 'first Escape closes only submenu');
        await mobileSales.click();
        await flyout.waitFor();
      }
      await flyout.getByRole('link', { name: 'Sản phẩm', exact: true }).focus();
      assert(
        await flyout.evaluate((el) => el.contains(document.activeElement)),
        'nested popover can receive focus',
      );
      await page.screenshot({
        animations: 'disabled',
        path: path.join(dir, `drawer-${width}.png`),
      });
      await flyout.getByRole('link', { name: 'Sản phẩm', exact: true }).click();
      await drawer.waitFor({ state: 'hidden' });
      await page.waitForTimeout(250);
      assert.equal(
        await page.locator(':focus').getAttribute('aria-label'),
        'Mở menu chính',
        'drawer restores focus',
      );
      assert(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        'no horizontal overflow',
      );
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    assert.equal(
      await rail.getByRole('button', { name: 'Nguyễn Thu Hà', exact: true }).count(),
      0,
      'duplicate sidebar account removed',
    );
    await page.evaluate(() => {
      history.pushState({}, '', '/landing-pages/builder/qa');
      dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForTimeout(250);
    assert.equal(
      await rail.getAttribute('data-collapsed'),
      '1',
      'builder retains collapsed default',
    );
    await rail.getByTestId('main-app-sidebar-toggle').click();
    await page.waitForTimeout(250);
    assert.equal(await rail.getAttribute('data-collapsed'), '0');
    await page.evaluate(() => {
      history.pushState({}, '', '/sales/products');
      dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForTimeout(250);
    assert.equal(
      await rail.getAttribute('data-collapsed'),
      '0',
      'builder toggle does not overwrite normal preference',
    );
    assert.deepEqual(errors, []);
    console.log(
      'PASS: 240/64px, hover/click, single flyout, delay, active route, outside/Escape, keyboard/focus, navigation/reload/user persistence, admin permissions, balanced spacing/full viewport, no duplicate sidebar account, collision bounds, tablet/mobile 768/390/320px, no runtime errors.',
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
