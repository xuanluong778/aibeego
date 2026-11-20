// Read-only check: resolves one existing binding, calls listPages, never writes customer data.
const assert = require('node:assert/strict');
if (process.env.LANDING_LIST_READONLY_CHECK !== '1') throw new Error('Explicit read-only check flag required.');
const { PrismaClient } = require('@marketingspa/database');
const { LandingPagesService } = require('/app/dist/landing-pages/landing-pages.service.js');
const db = new PrismaClient();
(async () => {
  const hostname = process.env.EXPECTED_LANDING_HOSTNAME;
  assert.match(hostname, /^[a-z0-9-]+\.aibeego\.com$/);
  const rows = await db.$queryRaw`SELECT d.landing_page_id, p.organization_id, p.slug, p.status FROM landing_page_platform_domains d JOIN landing_pages p ON p.id=d.landing_page_id WHERE d.hostname=${hostname}`;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, 'PUBLISHED');
  const service = Object.create(LandingPagesService.prototype);
  service.prisma = db;
  const list = await service.listPages(rows[0].organization_id, { q: rows[0].slug });
  const page = list.items.find(item => item.id === rows[0].landing_page_id);
  assert.ok(page);
  assert.equal(page.publicUrl, 'https://' + hostname + '/');
  assert.equal(page.publicPath, '/p/' + rows[0].slug);
  console.log(JSON.stringify({ passed: true, publicUrl: page.publicUrl, legacyPath: page.publicPath }));
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
