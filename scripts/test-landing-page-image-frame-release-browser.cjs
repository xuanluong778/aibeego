const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const qaRequire = process.env.LP_QA_NODE_MODULES
  ? createRequire(path.resolve(process.env.LP_QA_NODE_MODULES, '../package.json'))
  : require;
const base = process.env.LP_QA_BASE_URL || 'http://127.0.0.1:3308';
const out = path.resolve(process.env.LP_QA_OUT || '.tmp/image-frame-browser-qa');

(async () => {
  const browser = await qaRequire('playwright').chromium.launch({
    headless: true,
    ...(process.env.LP_QA_BROWSER ? { executablePath: process.env.LP_QA_BROWSER } : {}),
  });
  try {
    for (const control of ['toolbar', 'body']) {
      const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
      let saved = JSON.parse(fs.readFileSync(path.join(out, 'spec.json'), 'utf8'));
      let writes = 0;
      const hero = saved.blocks.find((b) => b.type === 'Hero');
      const id = hero.id,
        key = id + '::__element:image';
      saved.meta = {
        ...saved.meta,
        elementFreeLayouts: {
          ...saved.meta.elementFreeLayouts,
          [key]: { x: 0, y: 40, width: 310, height: 240 },
        },
      };
      await context.route('**/api/v1/**', async (route) => {
        const req = route.request(),
          u = new URL(req.url()),
          body = JSON.parse(req.postData() || '{}');
        if (body.draftSpec) {
          saved = body.draftSpec;
          writes++;
        }
        const json =
          u.pathname === '/api/v1/auth/me'
            ? {
                id: 'image-frame-qa-user',
                name: 'Local QA',
                role: 'SUPER_ADMIN',
                organizationId: 'image-frame-qa',
                email: 'qa@example.test',
              }
            : u.pathname.startsWith('/api/v1/landing-pages/image-frame-qa')
              ? {
                  id: 'image-frame-qa',
                  name: 'Image Frame QA',
                  slug: 'image-frame-qa',
                  status: 'DRAFT',
                  draftSpec: saved,
                  clientRevision: saved.meta?.clientRevision || 0,
                  requestId: body.requestId || null,
                  rejected: false,
                  updatedAt: new Date().toISOString(),
                }
              : { items: [], features: [], limits: null, ok: true };
        await route.fulfill({ status: 200, json });
      });
      await context.addInitScript(() =>
        localStorage.setItem(
          'ms_access_token',
          'x.' + btoa(JSON.stringify({ exp: 1999999999 })) + '.x',
        ),
      );
      const page = await context.newPage(),
        errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(base + '/landing-pages/builder/image-frame-qa', { timeout: 90000 });
      const image = page.locator(`[data-lp-element-id="${id}::image"]`),
        frame = image.locator('.photo-frame');
      await frame.waitFor({ timeout: 45000 });
      await frame.scrollIntoViewIfNeeded();
      await frame.click({ position: { x: 15, y: 80 } });
      await page.locator('[data-lp-vertical-tool="move"]').waitFor({ timeout: 10000 });
      await page.waitForTimeout(500);
      const before = await frame.boundingBox();
      const imgBefore = await image.locator('[data-lp-content-image]').boundingBox();
      const handle = await page.locator('[data-lp-vertical-tool="move"]').boundingBox();
      const start =
        control === 'body'
          ? { x: before.x + before.width - 20, y: before.y + before.height - 20 }
          : { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 };
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      // Move into the empty right side, clear of the Builder's text collision guard.
      await page.mouse.move(start.x + 70, start.y + 60, { steps: 15 });
      await page.waitForTimeout(100);
      const during = await frame.boundingBox(),
        imgDuring = await image.locator('[data-lp-content-image]').boundingBox();
      assert(
        during.x > before.x + 40,
        'gray frame must move right ' + JSON.stringify({ control, before, during }),
      );
      assert(
        Math.abs(imgDuring.x - imgBefore.x - (during.x - before.x)) < 2,
        'image moves with gray frame',
      );
      await page.mouse.up();
      await page.waitForTimeout(250);
      const after = await frame.boundingBox();
      await page.screenshot({ path: path.join(out, 'release-' + control + '.png') });
      assert(
        Math.abs(after.x - during.x) < 3,
        'drop must retain position ' +
          JSON.stringify({
            control,
            before,
            after,
            during,
            debug: await image.evaluate((el) => ({
              style: el.style.cssText,
              parent: el.parentElement.className,
              parentRect: el.parentElement.getBoundingClientRect().toJSON(),
              shell: el.closest('[data-lp-section-chrome]').style.cssText,
              canvas: el.closest('[data-lp-canvas-root]').getBoundingClientRect().toJSON(),
              overlap: el.dataset.lpOverlapOverride,
              nonOverlap: el.closest('[data-lp-non-overlap]')?.getAttribute('data-lp-non-overlap'),
            })),
            saved: saved.meta.elementFreeLayouts[key],
          }),
      );
      await page.screenshot({ path: path.join(out, 'release-' + control + '.png') });
      await page.locator('[data-lp-toolbar-btn="save"]').click();
      for (let i = 0; i < 50 && (!writes || saved.meta.elementFreeLayouts[key].x === 0); i++)
        await page.waitForTimeout(100);
      assert(
        writes > 0 && saved.meta.elementFreeLayouts[key].x > 0,
        'builder commits saved element layout',
      );
      await page.reload();
      await frame.waitFor();
      await frame.scrollIntoViewIfNeeded();
      await frame.click({ position: { x: 15, y: 80 } });
      await page.waitForTimeout(500);
      const reloaded = await frame.boundingBox();
      assert(
        Math.abs(reloaded.x - after.x) < 3,
        'saved frame survives reload ' + JSON.stringify({ control, after, reloaded }),
      );
      assert.deepEqual(errors, [], 'no browser runtime errors');
      console.log('PASS packaged Builder gray frame drag, drop, save and reload:', control);
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
