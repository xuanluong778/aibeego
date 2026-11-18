// Explicitly local only; all database fixtures are rolled back in one transaction.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const { PrismaClient } = require('@marketingspa/database');
const shared = require('@marketingspa/shared');
const apiRoot = process.env.LP_API_DIST || path.resolve('apps/api/dist');
const { LandingPagesService } = require(
  path.join(apiRoot, 'landing-pages/landing-pages.service.js'),
);
const { LandingPageAiService } = require(
  path.join(apiRoot, 'landing-pages/landing-page-ai.service.js'),
);
const prisma = new PrismaClient();
const uploadedFiles = [];
(async () => {
  if (process.env.LP_TEMPLATE_LOCAL_DB !== '1')
    throw new Error('Set LP_TEMPLATE_LOCAL_DB=1 only for the local test database.');
  const slug = `lp-template-qa-${randomUUID()}`;
  let checks = 0;
  const rollback = new Error('LP_TEMPLATE_QA_ROLLBACK');
  try {
    await prisma.$transaction(
      async (tx) => {
        const org = await tx.organization.create({
          data: { slug, name: 'QA nội dung mẫu (rollback)' },
        });
        const actor = { id: randomUUID(), organizationId: org.id, role: 'OWNER' };
        const transactional = new Proxy(tx, {
          get: (target, key) =>
            key === '$transaction' ? async (callback) => callback(tx) : Reflect.get(target, key),
        });
        const service = new LandingPagesService(
          transactional,
          { assertWithinLimit() {} },
          {},
          {},
          new LandingPageAiService({ isConfigured: () => false }),
          {},
        );
        service.ensureSystemTemplates = async () => {};
        for (const templateSlug of [
          'product-launch',
          'product-launch-trust-reviews',
          'agency-portfolio-cream-editorial',
        ]) {
          const page = await service.create(actor, {
            name: 'QA nội dung mẫu',
            templateSlug,
            idempotencyKey: randomUUID(),
          });
          assert.ok(page.templateId);
          checks++;
          const bytes = Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
            'base64',
          );
          const upload = await service.uploadPublicImage(actor, page.id, {
            originalname: 'qa-product.png',
            mimetype: 'image/png',
            size: bytes.length,
            buffer: bytes,
          });
          const uploadedPath = path.resolve(process.cwd(), upload.url.replace(/^\//, ''));
          const uploadRoot = path.resolve(process.cwd(), 'uploads');
          assert.ok(uploadedPath.startsWith(uploadRoot + path.sep));
          uploadedFiles.push(uploadedPath);
          const library = await service.listMedia(actor, page.id, { scope: 'org' });
          const image = library.items.find((image) => image.url === upload.url);
          assert.ok(image);
          checks++;
          const brief = {
            productName: 'Bình 500 ml',
            brandName: 'An Nhiên',
            description: 'Dung tích 500 ml\nCó nắp khóa',
            targetCustomer: 'Nhân viên văn phòng',
            goal: 'consult',
            imageIds: [image.id],
            primaryImageId: image.id,
          };
          const result = await service.generateTemplateContent(actor, page.id, {
            brief,
            snapshot: page.draftSpec,
            idempotencyKey: randomUUID(),
          });
          const afterPreview = await tx.landingPage.findUnique({ where: { id: page.id } });
          assert.deepEqual(afterPreview.draftSpec, JSON.parse(JSON.stringify(page.draftSpec)));
          assert.ok(result.proposals.some((p) => p.status === 'missing'));
          const heroSlot = result.slots.find(
            (slot) => slot.blockType === 'Hero' && slot.field === 'headline',
          );
          assert.ok(
            !result.protectedSlotIds.includes(heroSlot.id),
            'A newly created template headline is not a manual edit',
          );
          checks++;
          await assert.rejects(
            service.generateTemplateContent({ ...actor, organizationId: randomUUID() }, page.id, {
              brief,
              snapshot: page.draftSpec,
              idempotencyKey: randomUUID(),
            }),
          );
          checks++;
          await assert.rejects(
            service.validateTemplateContentImages(actor, page.id, [
              'foreign-page:foreign-photo.png',
            ]),
          );
          checks++;
          const ready = result.proposals.filter((p) => p.status === 'ready').map((p) => p.slotId);
          const applied = shared.applyTemplateContent(
            page.draftSpec,
            page.draftSpec,
            result.proposals,
            ready,
            result.images,
          );
          assert.ok(applied.applied.length > 5);
          const saved = await service.autosave(actor, page.id, {
            draftSpec: { ...applied.spec, meta: { ...applied.spec.meta, clientRevision: 1 } },
            clientRevision: 1,
            baseRevision: 0,
            requestId: randomUUID(),
          });
          assert.equal(saved.rejected, false);
          const reloaded = await tx.landingPage.findUnique({ where: { id: page.id } });
          const hero = reloaded.draftSpec.blocks.find((b) => b.type === 'Hero');
          assert.ok(hero.headline.includes('Bình 500 ml'));
          assert.equal(hero.imageUrl, upload.url);
          assert.deepEqual(
            reloaded.draftSpec.themeTokens,
            JSON.parse(JSON.stringify(page.draftSpec.themeTokens)),
          );
          assert.equal(reloaded.draftSpec.blocks.length, page.draftSpec.blocks.length);
          assert.equal(reloaded.publishedSpec, null);
          checks++;
          const restored = await service.autosave(actor, page.id, {
            draftSpec: { ...page.draftSpec, meta: { ...page.draftSpec.meta, clientRevision: 2 } },
            clientRevision: 2,
            baseRevision: 1,
            requestId: randomUUID(),
          });
          assert.equal(restored.rejected, false);
          const afterUndo = await tx.landingPage.findUnique({ where: { id: page.id } });
          assert.deepEqual(
            afterUndo.draftSpec.blocks,
            JSON.parse(JSON.stringify(page.draftSpec.blocks)),
          );
          checks++;
        }
        throw rollback;
      },
      { timeout: 30000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  }
  assert.equal(await prisma.organization.count({ where: { slug } }), 0);
  checks++;
  console.log(
    JSON.stringify({
      passed: true,
      checks,
      realPrismaPersistence: true,
      realServices: true,
      rolledBack: true,
      provider: 'fallback fixture',
    }),
  );
})()
  .catch((error) => {
    console.error(error.message.slice(0, 800));
    process.exitCode = 1;
  })
  .finally(async () => {
    for (const file of uploadedFiles) {
      fs.unlinkSync(file);
      for (const directory of [path.dirname(file), path.dirname(path.dirname(file))]) {
        try {
          fs.rmdirSync(directory);
        } catch {
          /* Only remove empty fixture directories. */
        }
      }
    }
    await prisma.$disconnect();
  });
