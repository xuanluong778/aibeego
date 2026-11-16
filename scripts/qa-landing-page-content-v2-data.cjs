// Local disposable HTTP/browser fixtures. Never update the user's original page.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@marketingspa/database');
const { JwtService } = require('@nestjs/jwt');
const { LandingPagesService } = require('/app/dist/landing-pages/landing-pages.service.js');
const { LandingPageAiService } = require('/app/dist/landing-pages/landing-page-ai.service.js');
const p = new PrismaClient(), file = process.argv[3] || '/app/lp-content-v2-fixture.json';
(async () => {
  if (process.env.LP_CONTENT_LOCAL_QA !== '1') throw new Error('Only run with LP_CONTENT_LOCAL_QA=1 in the local environment.');
  if (process.argv[2] === 'cleanup') {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.ok(data.slug.startsWith('lp-v2-qa-'));
    const org = await p.organization.findFirst({ where: { id: data.organizationId, slug: data.slug } });
    if (org) await p.organization.delete({ where: { id: org.id } });
    const root = path.resolve('uploads/public/landing-pages'), target = path.resolve(root, data.organizationId);
    assert.ok(target.startsWith(root + path.sep)); assert.ok(/^[a-f0-9-]{36}$/i.test(data.organizationId));
    fs.rmSync(target, { recursive: true, force: true });
    console.log(JSON.stringify({ cleaned: true, remainingOrganization: await p.organization.count({ where: { slug: data.slug } }) })); return;
  }
  const slug = `lp-v2-qa-${randomUUID()}`;
  const org = await p.organization.create({ data: { slug, name: 'QA luồng nội dung AI (tạm)' } });
  // Save the fixture marker immediately so cleanup is possible if a later setup step fails.
  const data = { slug, organizationId: org.id, token: '', pages: [], image: null };
  fs.writeFileSync(file, JSON.stringify(data));
  const role = await p.role.create({ data: { organizationId: org.id, code: 'OWNER', name: 'QA Owner', isSystem: true } });
  const user = await p.user.create({ data: { organizationId: org.id, roleId: role.id, name: 'QA nội dung', email: `${slug}@example.test`, emailVerifiedAt: new Date() } });
  const plan = await p.subscriptionPlan.findFirst({ where: { isActive: true } }); assert.ok(plan);
  await p.subscription.create({ data: { organizationId: org.id, planId: plan.id, status: 'ACTIVE', currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 3600000) } });
  data.token = await new JwtService().signAsync({ sub: user.id, email: user.email, organizationId: org.id, role: 'OWNER' }, { secret: process.env.JWT_SECRET, expiresIn: '1h' });
  const actor = { id: user.id, organizationId: org.id, role: 'OWNER' };
  const service = new LandingPagesService(p, { assertWithinLimit() {} }, {}, {}, new LandingPageAiService({ isConfigured: () => false }), {});
  service.ensureSystemTemplates = async () => {};
  const original = await p.landingPage.findUnique({ where: { id: '2a68892a-e811-4647-a29c-600827b46cc8' } }); assert.ok(original);
  const seo = await p.landingPage.create({ data: { organizationId: org.id, createdById: user.id, templateId: original.templateId, name: 'QA Đào tạo SEO — Thế giới digi', slug: `${slug}-seo`, subdomainSlug: `${slug}-seo`, status: 'DRAFT', theme: original.theme, draftSpec: original.draftSpec, trackingConfig: { qaSentinel: 'preserve-tracking' } } });
  const product = await service.create(actor, { name: 'QA sản phẩm', templateSlug: 'product-launch', idempotencyKey: randomUUID() });
  data.pages.push({ id: seo.id, slug: seo.slug, kind: 'seo', original: original.draftSpec }, { id: product.id, slug: product.slug, kind: 'product', original: product.draftSpec });
  const sourceUrl = original.draftSpec.blocks.find(block => block.type === 'Hero')?.imageUrl;
  let bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64'), mime = 'image/png', name = 'qa.png';
  if (typeof sourceUrl === 'string' && sourceUrl.startsWith('/uploads/')) {
    const source = path.resolve(process.cwd(), sourceUrl.slice(1)); assert.ok(source.startsWith(path.resolve('uploads') + path.sep));
    if (fs.existsSync(source)) { bytes = fs.readFileSync(source); name = path.basename(source); mime = /\.webp$/i.test(source) ? 'image/webp' : /\.jpe?g$/i.test(source) ? 'image/jpeg' : 'image/png'; }
  }
  const upload = await service.uploadPublicImage(actor, seo.id, { originalname: name, mimetype: mime, buffer: bytes, size: bytes.length });
  const library = await service.listMedia(actor, seo.id, { scope: 'org' }); data.image = library.items.find(image => image.url === upload.url); assert.ok(data.image);
  fs.writeFileSync(file, JSON.stringify(data));
  console.log(JSON.stringify({ seeded: true, pages: data.pages.length, organizationId: org.id, token: 'stored in fixture file only' }));
})().catch(error => { console.error(error.message.slice(0, 500)); process.exitCode = 1; }).finally(() => p.$disconnect());
