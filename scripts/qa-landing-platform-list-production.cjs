// Explicit production smoke: creates its own temporary tenant, reads list, opens public URL,
// then removes only that tenant and its auth cache. Never modifies customer pages/bindings.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
if (process.env.LANDING_LIST_PRODUCTION_QA !== '1') throw new Error('Explicit production QA flag required.');
const out = process.env.LANDING_LIST_QA_OUTPUT;
assert.ok(out && fs.statSync(out).isDirectory());
function apiWorker(fn, input) {
  return JSON.parse(execFileSync('docker', ['exec', '-i', 'marketingspa-api', 'node', '-e', '(' + fn.toString() + ')().catch(e=>{console.error(e.message);process.exitCode=1})'], { input: JSON.stringify(input || {}), encoding: 'utf8', maxBuffer: 1024 * 1024 }));
}
async function seed() {
  const { PrismaClient } = require('@marketingspa/database');
  const { JwtService } = require('@nestjs/jwt');
  const { randomUUID } = require('node:crypto');
  const { LANDING_PAGE_SYSTEM_TEMPLATES } = require('@marketingspa/shared');
  const db = new PrismaClient();
  try {
    const slug = 'public-link-qa-' + randomUUID(), label = 'public-link-qa-' + randomUUID().slice(0, 8);
    const spec = LANDING_PAGE_SYSTEM_TEMPLATES.find(t => t.slug === 'product-launch').spec;
    const fixture = await db.$transaction(async tx => {
      const org = await tx.organization.create({ data: { name: 'Temporary public link QA', slug } });
      const role = await tx.role.create({ data: { organizationId: org.id, code: 'OWNER', name: 'QA Owner', isSystem: true } });
      const user = await tx.user.create({ data: { organizationId: org.id, roleId: role.id, name: 'Public link QA', email: slug + '@example.test', emailVerifiedAt: new Date() } });
      const plan = await tx.subscriptionPlan.findFirst({ where: { isActive: true } });
      if (!plan) throw Error('No active plan for temporary fixture');
      await tx.subscription.create({ data: { organizationId: org.id, planId: plan.id, status: 'ACTIVE', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 3600000) } });
      const page = await tx.landingPage.create({ data: { organizationId: org.id, createdById: user.id, name: 'Public subdomain link QA', slug: slug + '-subdomain', subdomainSlug: label, status: 'PUBLISHED', theme: 'MODERN', draftSpec: spec, publishedSpec: spec, publishedAt: new Date() } });
      const pathPage = await tx.landingPage.create({ data: { organizationId: org.id, createdById: user.id, name: 'Public path link QA', slug: slug + '-path', status: 'PUBLISHED', theme: 'MODERN', draftSpec: spec, publishedSpec: spec, publishedAt: new Date() } });
      const hostname = label + '.aibeego.com', binding = randomUUID();
      await tx.$executeRaw`INSERT INTO landing_page_platform_domains(landing_page_id,binding_id,label,hostname) VALUES(${page.id},${binding},${label},${hostname})`;
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
    fs.writeFileSync(path.join(out, 'list-fixture.json'), JSON.stringify(fixture), { mode: 0o600 });
    const response = await fetch('https://aibeego.com/api/v1/landing-pages', { headers: { Authorization: 'Bearer ' + fixture.token } });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.items.find(p => p.id === fixture.pageId).publicUrl, 'https://' + fixture.hostname + '/');
    browser = await chromium.launch({ executablePath: process.env.LP_QA_CHROME || '/snap/chromium/current/usr/lib/chromium-browser/chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(token => localStorage.setItem('ms_access_token', token), fixture.token);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('https://aibeego.com/landing-pages/pages');
    const row = page.getByRole('row').filter({ hasText: 'Public subdomain link QA' });
    await row.getByText(fixture.hostname, { exact: true }).waitFor({ timeout: 45000 });
    await row.getByRole('button', { name: 'Thao tác', exact: true }).click();
    const link = page.getByRole('menuitem', { name: 'Xem trang công khai', exact: true });
    assert.equal(await link.getAttribute('href'), 'https://' + fixture.hostname + '/');
    await page.screenshot({ path: path.join(out, 'public-link-production.png'), fullPage: true });
    const popupPromise = context.waitForEvent('page');
    await link.click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    assert.equal(new URL(popup.url()).hostname, fixture.hostname);
    const publicResponse = await popup.reload();
    assert.equal(publicResponse.status(), 200);
    assert.equal((await publicResponse.securityDetails()).subjectName, '*.aibeego.com');
    await popup.close();
    await page.keyboard.press('Escape');
    await page.getByRole('row').filter({ hasText: 'Public path link QA' }).getByRole('button', { name: 'Thao tác', exact: true }).click();
    assert.equal(await page.getByRole('menuitem', { name: 'Xem trang công khai', exact: true }).getAttribute('href'), fixture.path);
    assert.deepEqual(errors, []);
    Object.assign(report, { apiListPassed: true, browserMenuPassed: true, popupHttpsPassed: true, pathFallbackPassed: true, runtimeErrors: errors });
  } finally {
    if (browser) await browser.close();
    if (fixture) {
      Object.assign(report, apiWorker(cleanup, fixture));
      execFileSync('docker', ['exec', 'marketingspa-redis', 'redis-cli', 'DEL', 'maaz:auth:u:' + fixture.userId, 'maaz:auth:me:' + fixture.userId], { stdio: 'pipe' });
    }
    fs.writeFileSync(path.join(out, 'production-list-result.json'), JSON.stringify(report, null, 2));
  }
  console.log(JSON.stringify(report));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
