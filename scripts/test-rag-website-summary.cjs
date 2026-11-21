const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('../packages/database/dist');
const { runRagSourceSync } = require('../apps/worker/dist/processors/rag-source-sync');
const { RagSourceService } = require('../apps/api/dist/rag-kb/rag-source.service');
const { RagKbService } = require('../apps/api/dist/rag-kb/rag-kb.service');
const { RagRetrievalService } = require('../apps/api/dist/rag-kb/rag-retrieval.service');
const { collectRagWebsite } = require('../packages/shared/dist/rag-source-collect');
const db = new PrismaClient({
  datasources: {
    db: { url: 'postgresql://ragqa:ragqa-local-only@127.0.0.1:15489/rag_source_qa?schema=public' },
  },
});
let org;
(async () => {
  try {
    org = await db.organization.create({
      data: { name: 'Website summary QA', slug: randomUUID() },
    });
    const kb = await db.ragKnowledgeBase.create({
      data: { organizationId: org.id, name: 'Summary QA' },
    });
    const source = await db.ragKbSource.create({
      data: {
        organizationId: org.id,
        knowledgeBaseId: kb.id,
        sourceKey: 'website:https://example.com/',
        url: 'https://example.com/',
        kind: 'WEBSITE',
        status: 'queued',
        runId: randomUUID(),
      },
    });
    const scope = { sourceId: source.id, organizationId: org.id, knowledgeBaseId: kb.id };
    await db.ragKbDocument.create({
      data: {
        ...scope,
        externalId: 'https://example.com/about',
        sourceType: 'WEBSITE',
        title: 'About legacy',
        url: 'https://example.com/about',
        content: 'Existing successfully collected company information.',
      },
    });
    await db.ragKbDocument.create({
      data: {
        ...scope,
        externalId: 'https://example.com/contact',
        sourceType: 'WEBSITE',
        title: 'Contact legacy',
        url: 'https://example.com/contact',
        content: 'Manually verified phone 0123456789.',
        manualEditedAt: new Date(),
      },
    });
    const unrelated = await db.ragKbDocument.create({
      data: {
        organizationId: org.id,
        knowledgeBaseId: kb.id,
        sourceType: 'FILE',
        title: 'User uploaded file',
        content: 'Unrelated manual file stays unchanged.',
      },
    });
    const run = async (row, collector) =>
      runRagSourceSync(db, { ...scope, runId: row.runId }, { website: collector });
    await run(source, async (_url, sink) => {
      await sink({
        externalId: 'https://example.com/contact',
        url: 'https://example.com/contact',
        title: 'Contact new',
        content: 'Must not replace manually verified contact.',
      });
      await sink({
        externalId: 'https://example.com/services',
        url: 'https://example.com/services',
        title: 'Services &#8211; QA',
        content: 'New SEO service description.',
      });
      await sink(null, 'https://example.com/about — HTTP_ERROR: HTTP 404');
    });
    let docs = await db.ragKbDocument.findMany({ where: scope });
    assert.equal(docs.length, 1);
    const summary = docs[0];
    for (const s of [
      'Existing successfully collected',
      'Manually verified phone',
      'New SEO service',
      'https://example.com/about',
      'https://example.com/contact',
      'https://example.com/services',
      'Services – QA',
    ])
      assert(summary.content.includes(s), s);
    assert.equal(
      (await db.ragKbDocument.findUnique({ where: { id: unrelated.id } })).content,
      'Unrelated manual file stays unchanged.',
    );
    const service = new RagSourceService(db, { add: async () => ({}) });
    const kbService = new RagKbService(db, new RagRetrievalService(db));
    assert(!(await service.list(org.id, kb.id))[0].websitePages);
    let row = await service.sync(org.id, kb.id, source.id);
    await run(row, async () => {
      throw Error('Synthetic total failure');
    });
    assert.equal(
      (await db.ragKbDocument.findUnique({ where: { id: summary.id } })).content,
      summary.content,
    );
    row = await service.sync(org.id, kb.id, source.id);
    await run(row, async (_url, sink) =>
      sink({
        externalId: 'https://example.com/services',
        url: 'https://example.com/services',
        title: 'Services',
        content: 'Updated SEO service description.',
      }),
    );
    docs = await db.ragKbDocument.findMany({ where: scope });
    assert.equal(docs.length, 1);
    assert(docs[0].content.includes('Updated SEO service'));
    assert(docs[0].content.includes('Manually verified phone'));
    const file = await kbService.downloadDocument(org.id, kb.id, summary.id);
    assert.equal(file.filename, 'website-example.com.md');
    assert(file.body.includes('Tổng hợp tri thức website'));
    await kbService.updateDocument(org.id, kb.id, summary.id, {
      title: 'My summary',
      content: 'Whole summary edited manually and must remain intact.',
    });
    row = await service.sync(org.id, kb.id, source.id);
    await run(row, async (_url, sink) =>
      sink({
        externalId: 'https://example.com/new-service',
        url: 'https://example.com/new-service',
        title: 'New page',
        content: 'New collected content must not overwrite the edited summary.',
      }),
    );
    assert.equal(
      (await db.ragKbDocument.findUnique({ where: { id: summary.id } })).content,
      'Whole summary edited manually and must remain intact.',
    );
    let requests = 0,
      errors = [];
    await collectRagWebsite(
      'https://example.com/',
      async (_item, error) => {
        if (error) errors.push(error);
      },
      {
        wait: async () => {},
        fetchHtml: async (url) => {
          requests++;
          if (url.endsWith('/services')) throw Error('Synthetic failure');
          return {
            finalUrl: url,
            title: 'Root',
            text: 'Root page with enough public text for collection.',
            html: '<link href="/contact-form.css"><a href="/contact.css">CSS</a><a href="/services">Service</a>',
          };
        },
      },
    );
    assert.equal(requests, 2);
    assert.equal(errors.length, 1);
    assert(errors[0].includes('/services'));
    console.log(
      'PASS: legacy pages and child URLs merge into one UTF-8 Markdown document; manual edits, last successful pages and unrelated files preserved; CSS skipped; errors identify URLs',
    );
  } finally {
    if (org) await db.organization.delete({ where: { id: org.id } });
    await db.$disconnect();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
