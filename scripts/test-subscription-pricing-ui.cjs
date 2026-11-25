// Real pricing component with synthetic billing hooks; no live checkout or customer account.
const fs = require('node:fs'),
  path = require('node:path'),
  http = require('node:http');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..'),
  web = path.join(root, 'apps/web'),
  dir = path.join(root, 'tmp/subscription-pricing-ui');
const esbuild = require(
  path.join(
    root,
    'node_modules/.pnpm',
    fs.readdirSync(path.join(root, 'node_modules/.pnpm')).find((p) => p.startsWith('esbuild@')),
    'node_modules/esbuild',
  ),
);
const {
  buildPlanCatalog,
  planDefinition,
} = require('../packages/shared/dist/subscription-catalog');
async function main() {
  fs.mkdirSync(dir, { recursive: true });
  const write = (name, text) => fs.writeFileSync(path.join(dir, name), text);
  const plans = buildPlanCatalog().map((plan) => ({
    ...plan,
    id: plan.code,
    entitlement: planDefinition(plan.code),
  }));
  write(
    'billing.ts',
    `const plans=${JSON.stringify(plans)};
    export const useBillingPlans=()=>({data:plans,isLoading:false,isError:false});
    export const useCurrentSubscription=()=>({data:null});export const usePlanEntitlements=()=>({data:null});
    export const usePaymentOrder=()=>({data:null,isLoading:false});
    export const useActivateTrial=()=>({isPending:false});export const useCancelPaymentOrder=()=>({isPending:false});
    export const useCreatePaymentOrder=()=>({isPending:false,mutateAsync:async(code)=>{window.selectedPlan=code;return{id:'fixture-order'}}});`,
  );
  write('auth.ts', `export const useCurrentUser=()=>({data:{id:'qa',name:'QA'},isLoading:false});`);
  write(
    'navigation.ts',
    `export const useRouter=()=>({push:()=>{},replace:()=>{}});export const useSearchParams=()=>new URLSearchParams();`,
  );
  write(
    'i18n.ts',
    `const labels={'pricing.title':'Chọn gói Ai Bee Go','pricingPage.registerNow':'Đăng ký ngay','pricingPage.compareBenefits':'So sánh quyền lợi','pricingPage.benefits':'Quyền lợi','pricingPage.price':'Giá thanh toán'};export const useT=()=>key=>labels[key]||key;`,
  );
  write('query.ts', 'export const useQueryClient=()=>({invalidateQueries:()=>Promise.resolve()});');
  write('subscription.ts', 'export const useSubscriptionDisplay=()=>({display:null});');
  write(
    'entry.tsx',
    `import React from 'react';import{createRoot}from'react-dom/client';import Page from '../../apps/web/src/app/(app)/pricing/page';createRoot(document.getElementById('root')).render(<Page/>);`,
  );
  await esbuild.build({
    entryPoints: [path.join(dir, 'entry.tsx')],
    outfile: path.join(dir, 'ui.js'),
    bundle: true,
    platform: 'browser',
    jsx: 'automatic',
    alias: {
      '@': path.join(web, 'src'),
      '@marketingspa/shared': path.join(root, 'packages/shared/src/subscription-catalog.ts'),
      '@/hooks/use-billing': path.join(dir, 'billing.ts'),
      '@/hooks/use-auth': path.join(dir, 'auth.ts'),
      '@/hooks/use-subscription-display': path.join(dir, 'subscription.ts'),
      '@/i18n/i18n-provider': path.join(dir, 'i18n.ts'),
      'next/navigation': path.join(dir, 'navigation.ts'),
      '@tanstack/react-query': path.join(dir, 'query.ts'),
    },
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
      'apps/web/src/app/(app)/pricing/page.tsx,apps/web/src/components/ui/*.tsx',
      '--minify',
    ],
    { cwd: root, stdio: 'pipe' },
  );
  const server = http.createServer((req, res) => {
    const name = req.url === '/ui.js' ? 'ui.js' : req.url === '/ui.css' ? 'ui.css' : null;
    res.setHeader(
      'Content-Type',
      name === 'ui.js' ? 'application/javascript' : name ? 'text/css' : 'text/html; charset=utf-8',
    );
    res.end(
      name
        ? fs.readFileSync(path.join(dir, name))
        : '<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/ui.css"><body><div id="root"></div><script src="/ui.js"></script></body></html>',
    );
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/pricing`);
    for (const months of [1, 6, 12]) {
      await page
        .getByRole('button', {
          name: months === 12 ? '12 tháng · Tiết kiệm 2 tháng' : `${months} tháng`,
          exact: true,
        })
        .click();
      for (const tier of ['Basic', 'Pro', 'VIP'])
        await page
          .getByRole('heading', { name: `Ai Bee Go ${tier} — ${months} tháng`, exact: true })
          .waitFor();
      assert.equal(await page.locator('#plans > div').count(), 3);
    }
    await page.screenshot({ path: path.join(dir, 'desktop.png'), fullPage: true });
    await page.getByRole('button', { name: 'Đăng ký ngay', exact: true }).nth(2).click();
    assert.equal(await page.evaluate(() => window.selectedPlan), 'abg-vip-12m');
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(dir, 'mobile.png'), fullPage: true });
    assert(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      'no horizontal page overflow on mobile',
    );
    assert.deepEqual(errors, []);
    console.log(
      'PASS: real pricing component, 3 tiers × 3 terms, exact checkout code, mobile layout, no browser errors',
    );
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
