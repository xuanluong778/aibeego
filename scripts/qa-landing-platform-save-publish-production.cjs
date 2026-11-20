// Production smoke: own temporary tenant, public template copy, real Builder autosave + publish,
// then removes only that tenant and its auth cache. Never modifies customer pages/bindings.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
if (process.env.LANDING_PUBLISH_PRODUCTION_QA !== '1') throw new Error('Explicit production QA flag required.');
const out = process.env.LANDING_PUBLISH_QA_OUTPUT;
assert.ok(out && fs.statSync(out).isDirectory());
function apiWorker(fn, input) {
  const sourceId = process.env.LANDING_PUBLISH_QA_SOURCE_PAGE_ID;
  if (sourceId) assert.match(sourceId, /^[a-f0-9-]{36}$/i);
  const sourceEnv = sourceId ? ['-e', 'LANDING_PUBLISH_QA_SOURCE_PAGE_ID=' + sourceId] : [];
  return JSON.parse(execFileSync('docker', ['exec', '-i', ...sourceEnv, 'marketingspa-api', 'node', '-e', '(' + fn.toString() + ')().catch(e=>{console.error(e.message);process.exitCode=1})'], { input: JSON.stringify(input || {}), encoding: 'utf8', maxBuffer: 1024 * 1024 }));
}
async function seed() {
  const { PrismaClient } = require('@marketingspa/database');
  const { JwtService } = require('@nestjs/jwt');
  const { randomUUID } = require('node:crypto');
  const { LANDING_PAGE_SYSTEM_TEMPLATES } = require('@marketingspa/shared');
  const db = new PrismaClient();
  try {
    const slug = 'public-link-qa-' + randomUUID(), label = 'public-link-qa-' + randomUUID().slice(0, 8);
    const sourceId = process.env.LANDING_PUBLISH_QA_SOURCE_PAGE_ID;
    const source = sourceId ? await db.landingPage.findFirst({ where: { id: sourceId, status: 'PUBLISHED' }, select: { publishedSpec: true } }) : null;
    if (sourceId && !source?.publishedSpec) throw Error('Source must be an existing published page; drafts are never copied.');
    const spec = structuredClone(source?.publishedSpec || LANDING_PAGE_SYSTEM_TEMPLATES.find(t => t.slug === 'agency-portfolio').spec);
    spec.meta = { ...spec.meta, clientRevision: 1203 };
    const fixture = await db.$transaction(async tx => {
      const org = await tx.organization.create({ data: { name: 'Temporary public link QA', slug } });
      const role = await tx.role.create({ data: { organizationId: org.id, code: 'OWNER', name: 'QA Owner', isSystem: true } });
      const user = await tx.user.create({ data: { organizationId: org.id, roleId: role.id, name: 'Public link QA', email: slug + '@example.test', emailVerifiedAt: new Date() } });
      const plan = await tx.subscriptionPlan.findFirst({ where: { isActive: true } });
      if (!plan) throw Error('No active plan for temporary fixture');
      await tx.subscription.create({ data: { organizationId: org.id, planId: plan.id, status: 'ACTIVE', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 3600000) } });
      const page = await tx.landingPage.create({ data: { organizationId: org.id, createdById: user.id, name: 'Public subdomain link QA', slug: slug + '-subdomain', subdomainSlug: label, status: 'PUBLISHED', theme: 'MODERN', draftSpec: spec, publishedSpec: spec, publishedAt: new Date() } });
      const pathPage = await tx.landingPage.create({ data: { organizationId: org.id, createdById: user.id, name: 'Public path link QA', slug: slug + '-path', status: 'PUBLISHED', theme: 'MODERN', draftSpec: spec, publishedSpec: spec, publishedAt: new Date() } });
      const hostname = label + '.aibeego.com';
      // No binding: the browser must save and publish to create it.
      const token = await new JwtService().signAsync({ sub: user.id, email: user.email, organizationId: org.id, role: 'OWNER' }, { secret: process.env.JWT_SECRET, expiresIn: '30m' });
      return { organizationId: org.id, slug, userId: user.id, pageId: page.id, hostname, token, path: '/p/' + pathPage.slug };
    });
    console.log(JSON.stringify(fixture));
  } finally { await db.$disconnect(); }
}
async function cleanup() {
  const data = JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
  if (!data.slug.startsWith('public-link-qa-')) throw Error('Unexpected fixture');
  const { PrismaClient } = require('@marketingspa/database');
  const db = new PrismaClient();
  try {
    const deleted = await db.organization.deleteMany({ where: { id: data.organizationId, slug: data.slug } });
    console.log(JSON.stringify({ fixtureCleaned: deleted.count === 1 }));
  } finally { await db.$disconnect(); }
}
async function main() {
  let fixture, browser;
  const report = {};
  try {
    fixture = apiWorker(seed);
    fs.writeFileSync(path.join(out, 'publish-fixture.json'), JSON.stringify(fixture), { mode: 0o600 });
    browser = await chromium.launch({ executablePath: process.env.LP_QA_CHROME || '/snap/chromium/current/usr/lib/chromium-browser/chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const context = await browser.newContext({ viewport: { width: 1290, height: 720 } });
    await context.addInitScript(token => localStorage.setItem('ms_access_token', token), fixture.token);
    const page = await context.newPage(), errors = [], saves = [], publishes = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', response => {
      if (response.url().endsWith('/autosave')) saves.push({ status: response.status(), bytes: Buffer.byteLength(response.request().postData() || '') });
      if (response.url().endsWith('/publish')) publishes.push({ status: response.status() });
    });
    await page.goto('https://aibeego.com/landing-pages/builder/' + fixture.pageId);
    await page.locator('[data-lp-canvas-root]').waitFor({ timeout: 45000 });
    await page.locator('[data-lp-publish-btn]').click();
    await page.locator('[data-lp-publish-dialog]').waitFor();
    await page.getByLabel('Tên subdomain', { exact: true }).fill(fixture.hostname.split('.')[0]);
    await page.waitForFunction(() => document.querySelector('[data-lp-confirm-publish]')?.disabled === false);
    await page.locator('[data-lp-confirm-publish]').click();
    await page.locator('[data-lp-publish-dialog]').waitFor({ state: 'hidden', timeout: 45000 });
    assert.ok(saves.some(s => s.status === 201 && s.bytes > 16384), JSON.stringify(saves));
    assert.deepEqual(publishes, [{ status: 201 }]);
    const response = await fetch('https://aibeego.com/api/v1/landing-pages/' + fixture.pageId, { headers: { Authorization: 'Bearer ' + fixture.token } });
    const result = await response.json();
    assert.equal(result.publicUrl, 'https://' + fixture.hostname + '/');
    const publicPage = await context.newPage();
    const publicResponse = await publicPage.goto(result.publicUrl);
    assert.equal(publicResponse.status(), 200);
    assert.equal((await publicResponse.securityDetails()).subjectName, '*.aibeego.com');
    await publicPage.screenshot({ path: path.join(out, 'published-https.png') });
    await page.screenshot({ path: path.join(out, 'builder-publish-success.png') });
    assert.deepEqual(errors, []);
    Object.assign(report, { savePassed: true, saves, publishPassed: true, httpsPassed: true, runtimeErrors: errors });
  } finally {
    if (browser) await browser.close();
    if (fixture) {
      Object.assign(report, apiWorker(cleanup, fixture));
      execFileSync('docker', ['exec', 'marketingspa-redis', 'redis-cli', 'DEL', 'maaz:auth:u:' + fixture.userId, 'maaz:auth:me:' + fixture.userId], { stdio: 'pipe' });
    }
    fs.writeFileSync(path.join(out, 'production-publish-result.json'), JSON.stringify(report, null, 2));
  }
  console.log(JSON.stringify(report));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
