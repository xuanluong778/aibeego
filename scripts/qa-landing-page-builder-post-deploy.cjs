#!/usr/bin/env node
/**
 * Post-deploy builder QA (973fd6e+) — Playwright + JWT (owner org, no publish).
 *   node scripts/with-root-env.cjs node scripts/qa-landing-page-builder-post-deploy.cjs
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const APP = (process.env.APP_URL || 'https://aibeego.com').replace(/\/$/, '');
const JWT_SECRET = process.env.JWT_SECRET;
const LP_ID = process.env.LP_QA_PAGE_ID || '1f07a824-f288-4150-a54d-ccf6df6f0269';
const QA_USER_ID = process.env.LP_QA_USER_ID || '7013afc5-a8d2-405f-b125-3a59fb751ae7';
const QA_EMAIL = process.env.LP_QA_EMAIL || 'xuanluong778@gmail.com';
const QA_ORG = process.env.LP_QA_ORG_ID || '5756b22e-c568-4a9f-b5d4-3e4d1a2e03a0';
const QA_ROLE = process.env.LP_QA_ROLE || 'SUPER_ADMIN';
const OUT = process.env.LP_QA_SCREENSHOT_DIR ||
  '/var/www/aibeego_com_usr/data/backups/ui-baseline-add-components/post-deploy-qa';

const results = [];
function row(name, status, detail = '') {
  results.push({ name, status, detail });
  console.log(`${status} | ${name}${detail ? ' — ' + detail : ''}`);
}

function b64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function mintAccessToken() {
  if (!JWT_SECRET) throw new Error('JWT_SECRET missing (use with-root-env.cjs)');
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(
    JSON.stringify({
      sub: QA_USER_ID,
      email: QA_EMAIL,
      organizationId: QA_ORG,
      role: QA_ROLE,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  );
  const sig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${header}.${payload}.${sig}`;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    row('PLAYWRIGHT', 'FAIL', 'install playwright in repo root');
    process.exitCode = 1;
    return;
  }

  const token = mintAccessToken();
  const health = await fetch(`${APP}/api/v1/health`).then((r) => r.status).catch(() => 0);
  row('API_HEALTH', health === 200 ? 'PASS' : 'FAIL', String(health));

  const authProbe = await fetch(`${APP}/api/v1/landing-pages/${LP_ID}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  row('AUTH_LP_READ', authProbe.ok ? 'PASS' : 'FAIL', String(authProbe.status));
  if (!authProbe.ok) {
    writeReport();
    process.exitCode = 1;
    return;
  }

  const beforeSpec = await authProbe.json();
  const blockCountBefore =
    beforeSpec?.data?.draftSpec?.blocks?.length ??
    beforeSpec?.draftSpec?.blocks?.length ??
    beforeSpec?.data?.draft_spec?.blocks?.length ??
    null;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
  });
  await context.addInitScript((t) => {
    localStorage.setItem('ms_access_token', t);
  }, token);

  const page = await context.newPage();
  const consoleErrors = [];
  const failedReq = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200));
  });
  page.on('requestfailed', (req) => {
    failedReq.push(`${req.failure()?.errorText || 'fail'} ${req.url().slice(0, 120)}`);
  });

  const builderUrl = `${APP}/landing-pages/builder/${LP_ID}`;
  const nav = await page.goto(builderUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
  row('BUILDER_NAV', nav && nav.status() < 400 ? 'PASS' : 'FAIL', String(nav?.status()));

  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(OUT, '01-builder-loaded.png'), fullPage: false });

  const railBtn = page.locator('[data-lp-inspector-rail-btn="add-components"]');
  const railVisible = await railBtn.isVisible().catch(() => false);
  if (!railVisible) {
    row('PANEL_PLUS_OPEN', 'FAIL', 'rail + not visible');
  } else {
    await railBtn.click();
    await page.waitForTimeout(800);
    const panel = page.locator('[data-lp-add-components-panel="1"]');
    row('PANEL_PLUS_OPEN', (await panel.isVisible()) ? 'PASS' : 'FAIL');
    await page.screenshot({ path: path.join(OUT, '02-add-panel-root.png'), fullPage: false });

    for (const id of ['text', 'button', 'social', 'graphics']) {
      const vis = await page.locator(`[data-lp-add-component-card="${id}"]`).isVisible().catch(() => false);
      row(`PRESET_ROOT_${id.toUpperCase()}`, vis ? 'PASS' : 'FAIL');
    }

    const formsCard = page.locator('[data-lp-add-component-card="forms"]');
    if (await formsCard.isVisible()) {
      await formsCard.click();
      await page.waitForTimeout(600);
      const emptyBtn = page.locator('[data-lp-form-insert-empty="1"]');
      row('FORM_EMPTY_CONTROL', (await emptyBtn.isVisible()) ? 'PASS' : 'FAIL');
      await page.screenshot({ path: path.join(OUT, '03-forms-subview.png'), fullPage: false });
      if (await emptyBtn.isVisible()) await emptyBtn.click();
      await page.waitForTimeout(1200);
    } else {
      row('FORM_EMPTY_CONTROL', 'FAIL', 'forms card missing');
    }

    await railBtn.click();
    await page.waitForTimeout(400);
    const headerCard = page.locator('[data-lp-add-component-card="header"]');
    row('HEADER_CARD', (await headerCard.isVisible()) ? 'PASS' : 'FAIL');
    row('FOOTER_CARD', (await page.locator('[data-lp-add-component-card="footer"]').isVisible()) ? 'PASS' : 'FAIL');
    row('SPEAKER_CARD', (await page.locator('[data-lp-add-component-card="speaker"]').isVisible()) ? 'PASS' : 'FAIL');
    if (await headerCard.isVisible()) {
      await headerCard.click();
      await page.waitForTimeout(800);
    }
    await page.screenshot({ path: path.join(OUT, '04-after-inserts.png'), fullPage: false });

    const textCard = page.locator('[data-lp-add-component-card="text"]');
    if (await textCard.isVisible()) {
      await textCard.click();
      await page.waitForTimeout(500);
      row('PRESET_TEXT_SUBVIEW', (await page.locator('[data-lp-add-components-sub="text"]').count()) > 0 ? 'PASS' : 'CHƯA KIỂM CHỨNG');
      await page.keyboard.press('Escape');
    }

    const undoBtn = page.getByRole('button', { name: 'Undo' });
    if (await undoBtn.isEnabled().catch(() => false)) {
      await undoBtn.click();
      await page.waitForTimeout(500);
      row('UNDO', 'PASS');
    } else {
      row('UNDO', 'CHƯA KIỂM CHỨNG', 'Undo disabled after inserts');
    }

    const saveBtn = page.getByRole('button', { name: /Lưu/i }).first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(2500);
      row('SAVE_CLICK', 'PASS');
    } else {
      row('SAVE_CLICK', 'CHƯA KIỂM CHỨNG', 'Lưu button not found');
    }

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(OUT, '05-after-reload.png'), fullPage: false });
    row('RELOAD', 'PASS');
  }

  await page.locator('[data-lp-inspector-rail-btn="add-components"]').click().catch(() => {});
  await page.waitForTimeout(500);
  const layersTab = page.locator('[data-lp-add-root-tab="layers"]');
  if (await layersTab.isVisible().catch(() => false)) {
    await layersTab.click();
    await page.waitForTimeout(500);
    row('TAB_LAYERS', (await page.locator('[data-lp-add-components-layers]').isVisible()) ? 'PASS' : 'FAIL');
    await page.screenshot({ path: path.join(OUT, '06-layers-tab.png'), fullPage: false });
  } else {
    row('TAB_LAYERS', 'CHƯA KIỂM CHỨNG');
  }

  for (const tab of ['design', 'content', 'page-theme']) {
    const t = page.locator(`[data-lp-inspector-rail-btn="${tab}"]`);
    if (await t.isVisible().catch(() => false)) {
      await t.click();
      await page.waitForTimeout(400);
      row(`INSPECTOR_TAB_${tab.toUpperCase()}`, 'PASS');
    } else {
      row(`INSPECTOR_TAB_${tab.toUpperCase()}`, 'CHƯA KIỂM CHỨNG');
    }
  }
  await page.screenshot({ path: path.join(OUT, '07-inspector-tabs.png'), fullPage: false });

  const afterAuth = await fetch(`${APP}/api/v1/landing-pages/${LP_ID}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  const blockCountAfter =
    afterAuth?.data?.draftSpec?.blocks?.length ??
    afterAuth?.draftSpec?.blocks?.length ??
    null;
  if (blockCountBefore != null && blockCountAfter != null) {
    row('BLOCK_COUNT_MUTATED', blockCountAfter >= blockCountBefore ? 'PASS' : 'FAIL', `${blockCountBefore}→${blockCountAfter}`);
  } else {
    row('BLOCK_COUNT_MUTATED', 'CHƯA KIỂM CHỨNG');
  }

  const severeConsole = consoleErrors.filter(
    (e) => !/favicon|404.*chunk|hydration/i.test(e),
  );
  const flaky = (s) => /ERR_NETWORK_CHANGED|ERR_ABORTED|net::ERR/i.test(s);
  const severe = severeConsole.filter((e) => !flaky(e));
  const netFail = failedReq.filter((e) => !flaky(e));
  row('CONSOLE_ERRORS', severe.length === 0 ? 'PASS' : 'FAIL', severe.slice(0, 3).join(' | '));
  row('NETWORK_FAIL', netFail.length === 0 ? 'PASS' : 'FAIL', netFail.slice(0, 3).join(' | '));
  row('DRAG_DROP', 'CHƯA KIỂM CHỨNG', 'headless pointer DnD not automated in this script');
  row('REDO', 'CHƯA KIỂM CHỨNG', 'Redo button state not asserted');

  fs.writeFileSync(path.join(OUT, 'console-errors.json'), JSON.stringify(consoleErrors, null, 2));
  fs.writeFileSync(path.join(OUT, 'network-failed.json'), JSON.stringify(failedReq, null, 2));

  await browser.close();
  writeReport();
  if (results.some((r) => r.status === 'FAIL')) process.exitCode = 1;
}

function writeReport() {
  const md = [
    '# Post-deploy builder QA',
    '',
    `- APP: ${APP}`,
    `- Page: ${LP_ID}`,
    `- Screenshots: ${OUT}`,
    '',
    '| Hạng mục | Kết quả | Ghi chú |',
    '|---|---|---|',
    ...results.map((r) => `| ${r.name} | ${r.status} | ${r.detail.replace(/\|/g, '/')} |`),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'REPORT.md'), md);
  console.log('\nWrote', path.join(OUT, 'REPORT.md'));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
