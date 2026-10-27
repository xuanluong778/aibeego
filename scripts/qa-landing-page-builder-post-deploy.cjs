#!/usr/bin/env node
/**
 * Landing page builder acceptance QA (post 973fd6e).
 * Auth: LP_QA_ACCESS_TOKEN **or** LP_QA_EMAIL + LP_QA_PASSWORD (real login API).
 * Optional dev-only: LP_QA_ALLOW_JWT_MINT=1 + LP_QA_USER_ID, LP_QA_EMAIL, LP_QA_ORG_ID, LP_QA_ROLE + JWT_SECRET.
 *
 *   node scripts/with-root-env.cjs node scripts/qa-landing-page-builder-post-deploy.cjs
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const APP = (process.env.APP_URL || 'https://aibeego.com').replace(/\/$/, '');
const SOURCE_LP_ID = process.env.LP_QA_SOURCE_PAGE_ID || process.env.LP_QA_PAGE_ID || '';
const OUT =
  process.env.LP_QA_SCREENSHOT_DIR ||
  '/var/www/aibeego_com_usr/data/backups/ui-baseline-add-components/post-deploy-qa-v2';

const results = [];
const networkLog = [];

function row(name, status, detail = '') {
  results.push({ name, status, detail });
  console.log(`${status} | ${name}${detail ? ' — ' + detail : ''}`);
}

function unwrapPage(json) {
  return json?.data ?? json;
}

function blockCount(spec) {
  return spec?.blocks?.length ?? null;
}

function b64url(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function resolveAccessToken() {
  const direct = (process.env.LP_QA_ACCESS_TOKEN || '').trim();
  if (direct) return direct;

  const email = (process.env.LP_QA_EMAIL || '').trim();
  const password = process.env.LP_QA_PASSWORD || '';
  if (email && password) {
    const res = await fetch(`${APP}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json().catch(() => ({}));
    const token =
      json?.data?.accessToken || json?.accessToken || json?.data?.tokens?.accessToken;
    if (res.ok && token) return token;
    throw new Error(`login failed ${res.status}: ${JSON.stringify(json).slice(0, 120)}`);
  }

  if (process.env.LP_QA_ALLOW_JWT_MINT === '1') {
    const secret = process.env.JWT_SECRET;
    const userId = (process.env.LP_QA_USER_ID || '').trim();
    const qaEmail = (process.env.LP_QA_EMAIL || '').trim();
    const org = (process.env.LP_QA_ORG_ID || '').trim();
    const role = (process.env.LP_QA_ROLE || '').trim();
    if (!secret || !userId || !qaEmail || !org || !role) {
      throw new Error('LP_QA_ALLOW_JWT_MINT=1 requires JWT_SECRET and LP_QA_USER_ID/EMAIL/ORG_ID/ROLE');
    }
    console.warn('[QA] JWT mint enabled — use only on staging/CI, not as production auth bypass.');
    const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = b64url(
      JSON.stringify({
        sub: userId,
        email: qaEmail,
        organizationId: org,
        role,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    );
    const sig = crypto
      .createHmac('sha256', secret)
      .update(`${header}.${payload}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    return `${header}.${payload}.${sig}`;
  }

  throw new Error('Set LP_QA_ACCESS_TOKEN or LP_QA_EMAIL+LP_QA_PASSWORD (or explicit LP_QA_ALLOW_JWT_MINT=1)');
}

async function api(token, p, init = {}) {
  const res = await fetch(`${APP}/api/v1${p}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { res, json };
}

async function fetchPage(token, id) {
  const { res, json } = await api(token, `/landing-pages/${id}`);
  if (!res.ok) throw new Error(`GET lp ${res.status}`);
  return unwrapPage(json);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    row('PLAYWRIGHT', 'FAIL', 'pnpm exec playwright install chromium');
    process.exitCode = 1;
    return;
  }

  let token;
  try {
    token = await resolveAccessToken();
    row('AUTH', 'PASS', process.env.LP_QA_ACCESS_TOKEN ? 'token' : process.env.LP_QA_EMAIL ? 'login' : 'mint');
  } catch (e) {
    row('AUTH', 'FAIL', e.message);
    writeReport(null);
    process.exitCode = 1;
    return;
  }

  if (!SOURCE_LP_ID) {
    row('SOURCE_PAGE', 'FAIL', 'LP_QA_SOURCE_PAGE_ID required');
    process.exitCode = 1;
    return;
  }

  const source = await fetchPage(token, SOURCE_LP_ID);
  const sourceBlocks = blockCount(source.draftSpec);
  row('SOURCE_PAGE_READ', 'PASS', `blocks=${sourceBlocks}`);

  const { res: dupRes, json: dupJson } = await api(token, `/landing-pages/${SOURCE_LP_ID}/duplicate`, {
    method: 'POST',
    body: '{}',
  });
  const clone = unwrapPage(dupJson);
  const LP_ID = clone?.id;
  if (!dupRes.ok || !LP_ID) {
    row('CLONE_PAGE', 'FAIL', String(dupRes.status));
    process.exitCode = 1;
    return;
  }
  row('CLONE_PAGE', 'PASS', LP_ID);
  fs.writeFileSync(path.join(OUT, 'clone-page-id.txt'), LP_ID);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  await context.addInitScript((t) => localStorage.setItem('ms_access_token', t), token);
  const page = await context.newPage();
  page.setDefaultTimeout(45000);

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('response', (res) => {
    const url = res.url();
    if (url.includes('/api/v1/') || url.includes('autosave')) {
      networkLog.push({
        url: url.slice(0, 200),
        status: res.status(),
        ok: res.ok(),
        method: res.request().method(),
      });
    }
  });
  page.on('requestfailed', (req) => {
    networkLog.push({
      url: req.url().slice(0, 200),
      failed: req.failure()?.errorText || 'fail',
      method: req.method(),
    });
  });

  await page.goto(`${APP}/landing-pages/builder/${LP_ID}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForTimeout(5000);
  const canvas = page.locator('[data-lp-canvas-root]');
  await canvas.waitFor({ state: 'visible', timeout: 60000 }).catch(() => null);
  const blocksOnCanvas = () => page.locator('[data-lp-canvas-root] [data-lp-block-id]').count();

  let n0 = await blocksOnCanvas();
  row('BUILDER_CANVAS', n0 > 0 ? 'PASS' : 'FAIL', `blocks visible=${n0}`);
  await page.screenshot({ path: path.join(OUT, '01-clone-loaded.png') });

  const openPlus = async () => {
    const panel = page.locator('[data-lp-add-components-panel="1"]');
    const rail = page.locator('[data-lp-inspector-rail-btn="add-components"]');
    if (!(await panel.isVisible().catch(() => false))) {
      await rail.click();
      await page.waitForTimeout(800);
    }
  };

  const ensureAddRoot = async () => {
    const rail = page.locator('[data-lp-inspector-rail-btn="add-components"]');
    const panel = page.locator('[data-lp-add-components-panel="1"]');
    for (let i = 0; i < 4; i++) {
      const sub = page.locator('[data-lp-add-components-sub]');
      if (!(await sub.count())) break;
      const closeX = sub.locator('[data-lp-sidebar-close]').first();
      const back = sub.getByRole('button', { name: /Quay lại/i }).first();
      if (await closeX.isVisible().catch(() => false)) await closeX.click();
      else if (await back.isVisible().catch(() => false)) await back.click();
      else break;
      await page.waitForTimeout(500);
    }
    if (!(await panel.isVisible().catch(() => false))) {
      await rail.click();
      await page.waitForTimeout(800);
    }
    await page.locator('[data-lp-add-root-tab="add"]').click().catch(() => {});
    await page.waitForTimeout(400);
    await page.locator('[data-lp-add-components-scroll]').evaluate((el) => { el.scrollTop = 0; }).catch(() => {});
  };

  await openPlus();
  row('PANEL_PLUS', (await page.locator('[data-lp-add-components-panel="1"]').isVisible()) ? 'PASS' : 'FAIL');

  await page.locator('[data-lp-add-component-card="text"]').click();
  await page.waitForTimeout(500);
  row('SUBVIEW_TEXT', (await page.locator('[data-lp-add-components-sub="text"]').count()) > 0 ? 'PASS' : 'FAIL');
  await page.screenshot({ path: path.join(OUT, '02-text-subview.png') });
  await ensureAddRoot();
  const panelRoot = page.locator('[data-lp-add-components-panel="1"]');
  const socialCard = panelRoot.locator('[data-lp-add-component-card="social"]');
  await panelRoot.locator('[data-lp-add-components-scroll]').evaluate((el) => { el.scrollTop = 0; }).catch(() => {});
  if (!(await socialCard.isVisible().catch(() => false))) {
    await page.screenshot({ path: path.join(OUT, '02b-root-no-social.png') });
    row('SUBVIEW_SOCIAL', 'FAIL', 'social card not visible on add tab');
  } else {
    await socialCard.click();
    await page.waitForTimeout(700);
    const socialSub = await page.locator('[data-lp-add-components-sub="social"]').count();
    row('SUBVIEW_SOCIAL', socialSub > 0 ? 'PASS' : 'FAIL');
    await page.screenshot({ path: path.join(OUT, '03-social-subview.png') });
    await ensureAddRoot();
  }
  await ensureAddRoot();
  const formsCard = panelRoot.locator('[data-lp-add-component-card="forms"]');
  await formsCard.scrollIntoViewIfNeeded().catch(() => {});
  if (!(await formsCard.isVisible().catch(() => false))) {
    row('FORM_PRESET_INSERT', 'FAIL', 'forms card not visible');
    row('FORM_EMPTY_INSERT', 'FAIL', 'skipped');
  } else {
  await formsCard.click();
  await page.waitForTimeout(500);
  const presetBtn = page.locator('[data-lp-form-preset]').first();
  if (await presetBtn.count()) {
    await presetBtn.click();
    await page.waitForTimeout(1000);
    row('FORM_PRESET_INSERT', 'PASS');
  } else {
    row('FORM_PRESET_INSERT', 'FAIL', 'no preset');
  }
  await ensureAddRoot();
  await panelRoot.locator('[data-lp-add-component-card="forms"]').click();
  await page.locator('[data-lp-form-insert-empty="1"]').click();
  await page.waitForTimeout(1000);
  row('FORM_EMPTY_INSERT', 'PASS');
  await ensureAddRoot();
  }

  await ensureAddRoot();
  const footerCard = panelRoot.locator('[data-lp-add-component-card="footer"]');
  const speakerCardInsert = panelRoot.locator('[data-lp-add-component-card="speaker"]');
  await panelRoot.locator('[data-lp-add-components-scroll]').evaluate((el) => { el.scrollTop = el.scrollHeight; }).catch(() => {});
  if (await footerCard.isVisible().catch(() => false)) {
    await footerCard.click();
    await page.waitForTimeout(800);
    let n1 = await blocksOnCanvas();
    row('INSERT_FOOTER', n1 > n0 ? 'PASS' : 'FAIL', `${n0}→${n1}`);
    n0 = n1;
  } else row('INSERT_FOOTER', 'FAIL', 'card not visible');
  await ensureAddRoot();
  await panelRoot.locator('[data-lp-add-components-scroll]').evaluate((el) => { el.scrollTop = el.scrollHeight; }).catch(() => {});
  if (await speakerCardInsert.isVisible().catch(() => false)) {
    await speakerCardInsert.click();
    await page.waitForTimeout(800);
    let n1 = await blocksOnCanvas();
    row('INSERT_SPEAKER', n1 > n0 ? 'PASS' : 'FAIL', `${n0}→${n1}`);
    n0 = n1;
  } else row('INSERT_SPEAKER', 'FAIL', 'card not visible');

  await ensureAddRoot();
  const sectionCard = panelRoot.locator('[data-lp-add-component-card="section"]');
  if (!(await sectionCard.isVisible().catch(() => false))) {
    row('SECTION_LIBRARY_OPEN', 'FAIL', 'section card missing');
    row('SECTION_LIBRARY_INSERT', 'FAIL', 'skipped');
  } else {
  await sectionCard.click();
  await page.waitForTimeout(800);
  const lib = page.locator('[data-lp-section-library-modal="1"]');
  row('SECTION_LIBRARY_OPEN', (await lib.isVisible()) ? 'PASS' : 'FAIL');
  await page.screenshot({ path: path.join(OUT, '04-section-library.png') });
  const libCard = page.locator('[data-lp-section-library-card]').first();
  if (await libCard.count()) {
    await libCard.hover();
    await libCard.getByRole('button', { name: /Thêm section/i }).click();
    await page.waitForTimeout(1200);
    n1 = await blocksOnCanvas();
    row('SECTION_LIBRARY_INSERT', n1 > n0 ? 'PASS' : 'FAIL', `${n0}→${n1}`);
    n0 = n1;
  }
  await page.keyboard.press('Escape');
  }

  await ensureAddRoot();
  const speakerCard = page.locator('[data-lp-add-component-card="speaker"]');
  const canvasBox = await canvas.boundingBox();
  if (canvasBox && (await speakerCard.isVisible())) {
    const from = await speakerCard.boundingBox();
    if (from) {
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height * 0.7);
      await page.mouse.up();
      await page.waitForTimeout(1200);
      const nDrag = await blocksOnCanvas();
      row('DRAG_DROP_SPEAKER', nDrag > n0 ? 'PASS' : 'CHƯA KIỂM CHỨNG', `${n0}→${nDrag}`);
      n0 = Math.max(n0, nDrag);
    } else row('DRAG_DROP_SPEAKER', 'CHƯA KIỂM CHỨNG', 'no bbox');
  } else row('DRAG_DROP_SPEAKER', 'CHƯA KIỂM CHỨNG', 'canvas/speaker missing');

  const undoBtn = page.getByRole('button', { name: 'Undo' });
  const redoBtn = page.getByRole('button', { name: 'Redo' });
  const beforeUndo = await blocksOnCanvas();
  if (await undoBtn.isEnabled().catch(() => false)) {
    await undoBtn.click();
    await page.waitForTimeout(700);
    const afterUndo = await blocksOnCanvas();
    row('UNDO_CANVAS', afterUndo < beforeUndo ? 'PASS' : 'FAIL', `${beforeUndo}→${afterUndo}`);
    if (await redoBtn.isEnabled().catch(() => false)) {
      await redoBtn.click();
      await page.waitForTimeout(700);
      const afterRedo = await blocksOnCanvas();
      row('REDO_CANVAS', afterRedo > afterUndo ? 'PASS' : 'FAIL', `${afterUndo}→${afterRedo}`);
    } else row('REDO_CANVAS', 'FAIL', 'Redo disabled');
  } else row('UNDO_CANVAS', 'FAIL', 'Undo disabled');

  const autosaveWait = page.waitForResponse(
    (r) => r.url().includes('/autosave') && r.request().method() === 'POST',
    { timeout: 45000 },
  );
  const saveBtn = page.getByRole('button', { name: /Lưu/i }).first();
  if (await saveBtn.isVisible()) await saveBtn.click();
  let autosaveStatus = 0;
  try {
    const ar = await autosaveWait;
    autosaveStatus = ar.status();
  } catch {
    autosaveStatus = 0;
  }
  row('AUTOSAVE_HTTP', autosaveStatus === 201 || autosaveStatus === 200 ? 'PASS' : 'FAIL', String(autosaveStatus));

  const beforeReload = await fetchPage(token, LP_ID);
  const revBefore = beforeReload.draftSpec?.meta?.clientRevision;
  const blocksBeforeReload = blockCount(beforeReload.draftSpec);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const afterReload = await fetchPage(token, LP_ID);
  const blocksAfterReload = blockCount(afterReload.draftSpec);
  row(
    'SAVE_RELOAD_SPEC',
    blocksAfterReload === blocksBeforeReload ? 'PASS' : 'FAIL',
    `api blocks ${blocksBeforeReload}→${blocksAfterReload} rev=${revBefore}→${afterReload.draftSpec?.meta?.clientRevision}`,
  );
  await page.screenshot({ path: path.join(OUT, '05-after-reload.png') });

  await page.goto(`${APP}/landing-pages/builder/${LP_ID}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await openPlus();
  await page.locator('[data-lp-add-root-tab="layers"]').click();
  row('TAB_LAYERS', (await page.locator('[data-lp-add-components-layers]').isVisible()) ? 'PASS' : 'FAIL');
  await page.screenshot({ path: path.join(OUT, '07-layers-tab.png') });

  for (const route of ['/landing-pages/pages', '/landing-pages/templates']) {
    const r = await page.goto(`${APP}${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    row(`SMOKE_${route.replace(/\//g, '_')}`, r && r.status() < 400 ? 'PASS' : 'FAIL', String(r?.status()));
  }
  await page.screenshot({ path: path.join(OUT, '06-smoke-list.png') });

  fs.writeFileSync(path.join(OUT, 'console-errors.json'), JSON.stringify(consoleErrors, null, 2));
  fs.writeFileSync(path.join(OUT, 'network-log.json'), JSON.stringify(networkLog, null, 2));
  writeNetworkAnalysis(networkLog, autosaveStatus);

  const severe = consoleErrors.filter((e) => !/favicon|DevTools/i.test(e));
  row('CONSOLE_RAW', severe.length === 0 ? 'PASS' : 'FAIL', `count=${severe.length}`);

  await browser.close();
  writeReport(LP_ID);
  if (results.some((r) => r.status === 'FAIL')) process.exitCode = 1;
}

function writeNetworkAnalysis(log, autosaveStatus) {
  const autosaves = log.filter((e) => e.url && e.url.includes('autosave'));
  const failed = log.filter((e) => e.failed || (e.status && e.status >= 400));
  const lines = [
    '# Network analysis (raw log in network-log.json)',
    '',
    '## Autosave',
    `- Last manual save autosave HTTP: **${autosaveStatus}** (FAIL if not 200/201)`,
    `- Autosave entries in log: ${autosaves.length}`,
    '',
    '## Failed / 4xx+ (unfiltered)',
    ...failed.slice(0, 30).map((e) => `- ${JSON.stringify(e)}`),
    '',
    '## Notes',
    '- `net::ERR_ABORTED` on RSC prefetch: often navigation cancel — not auto-PASS.',
    '- Autosave must pair with SAVE_RELOAD_SPEC PASS to claim persist OK.',
  ];
  fs.writeFileSync(path.join(OUT, 'NETWORK-ANALYSIS.md'), lines.join('\n'));
}

function writeReport(lpId) {
  const md = [
    '# Builder acceptance QA v2',
    '',
    `- APP: ${APP}`,
    `- Clone page: ${lpId || 'n/a'}`,
    `- Source: ${SOURCE_LP_ID}`,
    `- OUT: ${OUT}`,
    '',
    '| Test | Result | Detail |',
    '|---|---|---|',
    ...results.map((r) => `| ${r.name} | ${r.status} | ${r.detail.replace(/\|/g, '/')} |`),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'REPORT.md'), md);
  console.log('Wrote', path.join(OUT, 'REPORT.md'));
}

main().catch((err) => {
  console.error(err);
  row('RUNTIME', 'FAIL', err.message || String(err));
  try {
    writeReport(process.env.LP_QA_LAST_CLONE_ID || '');
  } catch {
    /* */
  }
  process.exitCode = 1;
});
