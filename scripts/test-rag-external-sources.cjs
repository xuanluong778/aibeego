// No production endpoints or customer tokens. Requires prepare-rag-source-qa.cjs.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createRequire } = require('node:module');
const { PrismaClient } = require('../packages/database/dist');
const collect = require('../packages/shared/dist/rag-source-collect');
const ssrf = require('../packages/shared/dist/ssrf-fetch');
const { runRagSourceSync } = require('../apps/worker/dist/processors/rag-source-sync');
const { RagSourceService } = require('../apps/api/dist/rag-kb/rag-source.service');
const { RagKbService } = require('../apps/api/dist/rag-kb/rag-kb.service');
const { RagRetrievalService } = require('../apps/api/dist/rag-kb/rag-retrieval.service');
const workerRequire = createRequire(require.resolve('../apps/worker/package.json'));
const { Queue, Worker, QueueEvents } = workerRequire('bullmq');
const connection = { host: '127.0.0.1', port: 16489, maxRetriesPerRequest: null };
const db = new PrismaClient({
  datasources: {
    db: { url: 'postgresql://ragqa:ragqa-local-only@127.0.0.1:15489/rag_source_qa?schema=public' },
  },
});
const prefix = `rag-qa-${randomUUID()}`;
const queue = new Queue(collect.RAG_SOURCE_QUEUE, { connection, prefix });
const events = new QueueEvents(collect.RAG_SOURCE_QUEUE, { connection, prefix });
const service = new RagSourceService(db, queue),
  kbService = new RagKbService(db, new RagRetrievalService(db));
let worker;
const orgIds = [];
const item = (id, content = 'Synthetic website service information for testing.') => ({
  externalId: id,
  url: `https://example.com/${id}`,
  title: `Test ${id}`,
  content,
});
const pass = (name) => console.log('PASS:', name);
async function unit() {
  assert.equal(
    collect.canonicalRagUrl('https://example.com/about/?utm_source=test#intro'),
    'https://example.com/about',
  );
  assert.equal(collect.ragContentHash('hello\r\nworld'), collect.ragContentHash('hello\nworld'));
  for (const raw of [
    'http://127.0.0.1',
    'http://169.254.169.254',
    'http://[::1]',
    'file:///etc/passwd',
    'https://user:pass@example.com',
  ])
    await assert.rejects(() => ssrf.assertPublicHttpUrl(raw));
  ssrf.__setDnsLookupForTests(async () => [{ address: '10.1.1.1', family: 4 }]);
  await assert.rejects(() => ssrf.revalidateResolvedIps('example.com', ['93.184.216.34']));
  ssrf.__setDnsLookupForTests(async () => [{ address: '93.184.216.34', family: 4 }]);
  pass('URL normalization, content hash, private/metadata/IPv6/credentials and DNS rebind guards');
  const http = require('node:http'),
    { EventEmitter } = require('node:events');
  const originalRequest = http.request;
  let requests = 0;
  http.request = (opts, callback) => {
    requests++;
    opts.lookup(opts.hostname, {}, (err, address) => {
      assert.equal(err, null);
      assert.equal(address, '93.184.216.34');
    });
    const req = new EventEmitter();
    req.destroy = (error) => {
      if (error) req.emit('error', error);
    };
    req.end = () =>
      queueMicrotask(() => {
        const res = new EventEmitter();
        res.headers = { location: 'http://127.0.0.1/private' };
        res.statusCode = 302;
        res.destroy = () => {};
        callback(res);
        res.emit('end');
      });
    return req;
  };
  try {
    await assert.rejects(() =>
      ssrf.fetchPublicHtmlSafe('http://example.com', { allowHost: (h) => h === 'example.com' }),
    );
    assert.equal(requests, 1);
  } finally {
    http.request = originalRequest;
  }
  pass('real fetch transport pins public IP and rejects private redirect before second request');
  const calls = [],
    found = [],
    errors = [];
  await collect.collectRagWebsite(
    'https://example.com',
    async (value, error) => {
      if (value) found.push(value);
      if (error) errors.push(error);
    },
    {
      wait: async (ms) => assert.equal(ms, 1000),
      fetchHtml: async (url, opts) => {
        calls.push(url);
        assert(opts.allowHost('example.com'));
        assert(!opts.allowHost('127.0.0.1'));
        assert(!opts.allowHost('other.com'));
        if (url.endsWith('/faq')) throw Error('Synthetic HTTP 503');
        return {
          finalUrl: url,
          title: 'Test',
          text: 'Public service information for synthetic collection.',
          html:
            url === 'https://example.com/'
              ? '<a href="/about/">About</a><a href="/about?utm_source=a">Duplicate</a><a href="/services">Services</a><a href="/faq">FAQ</a><a href="https://other.com/about">Outside</a><a href="http://127.0.0.1/contact">Private</a>'
              : '<a href="/about">Cycle</a>',
        };
      },
    },
  );
  assert.equal(calls.length, 4);
  assert.equal(found.length, 3);
  assert.equal(errors.length, 1);
  pass('website discovery, cycles/URL dedupe, scope, rate delay and partial page failure');
  let boundedCalls = 0;
  await collect.collectRagWebsite('https://example.com', async () => {}, {
    wait: async () => {},
    fetchHtml: async url => {
      boundedCalls++;
      return { finalUrl: url, title: 'Bound test', text: 'Synthetic bounded crawling example.', html: Array.from({ length: 100 }, (_, i) => `<a href="/services/${i}">Service</a>`).join('') };
    },
  });
  assert.equal(boundedCalls, collect.RAG_SOURCE_LIMITS.websitePages);
  pass('website page-count hard limit');
  let reads = [],
    posts = [];
  await collect.collectRagFacebook(
    '123',
    async (edge, params) => {
      reads.push({ edge, params });
      assert(!/inbox|comments|feed/.test(edge));
      if (edge === '123') return { name: 'Synthetic Page', about: 'Public Page information' };
      return params.after
        ? {
            data: [
              { id: '123_1', message: 'Duplicate post' },
              { id: '123_2', message: 'Second post content' },
            ],
          }
        : {
            data: [{ id: '123_1', message: 'First public post content' }],
            paging: {
              next: 'https://evil.invalid/?access_token=never-follow',
              cursors: { after: 'cursor-2' },
            },
          };
    },
    async (value) => posts.push(value),
  );
  assert.equal(reads.length, 3);
  assert.equal(reads[2].params.after, 'cursor-2');
  assert.equal(posts.length, 3);
  for (const [code, expected] of [
    [190, 'TOKEN_EXPIRED'],
    [200, 'MISSING_PERMISSION'],
    [4, 'RATE_LIMITED'],
  ])
    assert.equal(collect.ragFacebookError(code).code, expected);
  pass(
    'Page/posts allowlist, cursor pagination without next-URL token leakage, dedupe and Meta errors',
  );
}
async function integration() {
  const org = await db.organization.create({
    data: { name: 'RAG synthetic A', slug: randomUUID() },
  });
  orgIds.push(org.id);
  const other = await db.organization.create({
    data: { name: 'RAG synthetic B', slug: randomUUID() },
  });
  orgIds.push(other.id);
  const kb = await db.ragKnowledgeBase.create({ data: { organizationId: org.id, name: 'QA A' } });
  const kbB = await db.ragKnowledgeBase.create({
    data: { organizationId: other.id, name: 'QA B' },
  });
  const source = await service.create(org.id, kb.id, {
    kind: 'WEBSITE',
    url: 'https://example.com',
  });
  await Promise.all([
    service.create(org.id, kb.id, { kind: 'WEBSITE', url: 'https://example.com/#x' }),
    service.sync(org.id, kb.id, source.id),
  ]);
  assert.equal(await db.ragKbSource.count({ where: { knowledgeBaseId: kb.id } }), 1);
  assert.equal((await queue.getJobs(['waiting'])).length, 1);
  await assert.rejects(() => service.list(other.id, kb.id));
  await assert.rejects(() => service.sync(other.id, kbB.id, source.id));
  await assert.rejects(() =>
    service.create(other.id, kbB.id, { kind: 'FACEBOOK', facebookPageId: randomUUID() }),
  );
  await assert.rejects(() =>
    db.ragKbSource.create({
      data: {
        organizationId: other.id,
        knowledgeBaseId: kb.id,
        sourceKey: 'wrong',
        kind: 'WEBSITE',
      },
    }),
  );
  pass('tenant checks, composite database FK and concurrent duplicate source/job submission');
  worker = new Worker(
    collect.RAG_SOURCE_QUEUE,
    (job) =>
      runRagSourceSync(db, job.data, {
        website: async (_url, sink) => {
          await sink(item('about'));
          await sink(item('about'));
          await sink(item('services', 'Different synthetic service information.'));
          await sink(null, 'Synthetic FAQ failure');
        },
      }),
    { connection, prefix, concurrency: 1 },
  );
  await events.waitUntilReady();
  await (await queue.getJob(source.runId)).waitUntilFinished(events, 15000);
  let current = await db.ragKbSource.findUnique({ where: { id: source.id } });
  assert.equal(current.status, 'partial');
  assert.equal(current.failed, 1);
  assert.equal(await db.ragKbDocument.count({ where: { sourceId: source.id } }), 1);
  pass('real BullMQ execution, progressive persistence, URL dedupe and partial success');
  await worker.close();
  worker = undefined;
  const doc = await db.ragKbDocument.findFirst({
    where: { sourceId: source.id, externalId: 'website:summary' },
  });
  await kbService.updateDocument(org.id, kb.id, doc.id, {
    title: 'Manual title',
    content: 'Manually edited content that synchronization must keep.',
  });
  const next = await service.sync(org.id, kb.id, source.id);
  await runRagSourceSync(
    db,
    { organizationId: org.id, knowledgeBaseId: kb.id, sourceId: source.id, runId: next.runId },
    {
      website: async (_url, sink) => {
        await sink(item('about', 'Changed upstream content must never overwrite manual edit.'));
        await sink(item('services', 'Updated upstream service content is safe to synchronize.'));
      },
    },
  );
  assert.equal(
    (await db.ragKbDocument.findUnique({ where: { id: doc.id } })).title,
    'Manual title',
  );
  assert.equal(await db.ragKbDocument.count({ where: { sourceId: source.id } }), 1);
  pass('resync updates generated content without duplicates and preserves manual edits');
  const before = await db.ragKbDocument.findFirst({
    where: { sourceId: source.id, externalId: 'website:summary' },
  });
  const failed = await service.sync(org.id, kb.id, source.id);
  await runRagSourceSync(
    db,
    { organizationId: org.id, knowledgeBaseId: kb.id, sourceId: source.id, runId: failed.runId },
    {
      website: async () => {
        throw Error('Synthetic connection failure');
      },
    },
  );
  assert.equal((await db.ragKbSource.findUnique({ where: { id: source.id } })).status, 'error');
  assert.equal(
    (await db.ragKbDocument.findUnique({ where: { id: before.id } })).content,
    before.content,
  );
  pass('failed refresh preserves last successful documents');
  const lost = await service.sync(org.id, kb.id, source.id);
  await (await queue.getJob(lost.runId)).remove();
  const recovered = (await service.list(org.id, kb.id)).find(row => row.id === source.id);
  assert.equal(recovered.status, 'error');
  assert(recovered.lastError.includes('Job'));
  const offline = new RagSourceService(db, { add: async () => { throw Error('Synthetic Redis outage'); } });
  await assert.rejects(() => offline.sync(org.id, kb.id, source.id));
  assert.equal((await db.ragKbSource.findUnique({ where: { id: source.id } })).runId, null);
  assert.equal((await db.ragKbDocument.findUnique({ where: { id: before.id } })).content, before.content);
  pass('missing-job recovery and enqueue failure preserve documents and allow retry');
  const role = await db.role.create({
    data: { organizationId: org.id, code: 'OWNER', name: 'Synthetic owner' },
  });
  const user = await db.user.create({
    data: {
      organizationId: org.id,
      roleId: role.id,
      name: 'Synthetic owner',
      email: `${randomUUID()}@example.test`,
    },
  });
  const { encryptSecret } = require('../apps/worker/dist/lib/encryption');
  const previousKey = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = 'rag-qa-synthetic-encryption-key';
  const conn = await db.autoPostFacebookConnection.create({
    data: {
      userId: user.id,
      organizationId: org.id,
      encryptedAccessToken: encryptSecret('synthetic-user-token', process.env.ENCRYPTION_KEY),
      status: 'CONNECTED',
      scopes: ['pages_read_engagement'],
    },
  });
  const page = await db.autoPostFacebookPage.create({
    data: {
      userId: user.id,
      connectionId: conn.id,
      pageId: '123',
      pageName: 'Synthetic Page',
      encryptedPageAccessToken: encryptSecret('synthetic-page-token', process.env.ENCRYPTION_KEY),
    },
  });
  await assert.rejects(() =>
    service.create(other.id, kbB.id, { kind: 'FACEBOOK', facebookPageId: page.id }),
  );
  assert.equal((await service.pages(other.id)).length, 0);
  const fb = await service.create(org.id, kb.id, { kind: 'FACEBOOK', facebookPageId: page.id });
  const originalFetch = global.fetch;
  let graphCalls = 0;
  global.fetch = async (url, opts) => {
    graphCalls++;
    assert.equal(url.hostname, 'graph.facebook.com');
    assert.equal(opts.headers.Authorization, 'Bearer synthetic-page-token');
    assert.equal(url.searchParams.has('access_token'), false);
    return new Response(
      JSON.stringify(
        url.pathname.endsWith('/posts')
          ? { data: [{ id: '123_1', message: 'Synthetic Facebook post for the knowledge base.' }] }
          : { name: 'Synthetic Page', about: 'Public page business information for QA.' },
      ),
      { status: 200 },
    );
  };
  try {
    await runRagSourceSync(db, {
      organizationId: org.id,
      knowledgeBaseId: kb.id,
      sourceId: fb.id,
      runId: fb.runId,
    });
    assert.equal(graphCalls, 2);
    assert.equal(await db.ragKbDocument.count({ where: { sourceId: fb.id } }), 2);
    const denied = await service.sync(org.id, kb.id, fb.id);
    global.fetch = async () =>
      new Response(
        JSON.stringify({ error: { code: 200, message: 'must not persist synthetic-page-token' } }),
        { status: 403 },
      );
    await runRagSourceSync(db, {
      organizationId: org.id,
      knowledgeBaseId: kb.id,
      sourceId: fb.id,
      runId: denied.runId,
    });
    let fbRow = await db.ragKbSource.findUnique({ where: { id: fb.id } });
    assert(fbRow.lastError.includes('MISSING_PERMISSION'));
    assert(!JSON.stringify(fbRow).includes('synthetic-page-token'));
    await db.autoPostFacebookConnection.update({
      where: { id: conn.id },
      data: { status: 'TOKEN_EXPIRED' },
    });
    const expired = await service.sync(org.id, kb.id, fb.id);
    global.fetch = async () => {
      throw Error('Expired token must be blocked before fetch');
    };
    await runRagSourceSync(db, {
      organizationId: org.id,
      knowledgeBaseId: kb.id,
      sourceId: fb.id,
      runId: expired.runId,
    });
    fbRow = await db.ragKbSource.findUnique({ where: { id: fb.id } });
    assert(fbRow.lastError.includes('TOKEN_EXPIRED'));
    assert.equal(await db.ragKbDocument.count({ where: { sourceId: fb.id } }), 2);
  } finally {
    global.fetch = originalFetch;
    if (previousKey === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = previousKey;
  }
  pass(
    'connected Page tenant scope, encrypted token reuse, Page/posts collection, permission/expired-token errors without losing prior data or leaking tokens',
  );
  const paused = await service.sync(org.id, kb.id, source.id);
  await service.toggle(org.id, kb.id, source.id, false);
  let called = false;
  await runRagSourceSync(
    db,
    { organizationId: org.id, knowledgeBaseId: kb.id, sourceId: source.id, runId: paused.runId },
    {
      website: async () => {
        called = true;
      },
    },
  );
  assert(!called);
  assert(
    (await kbService.search(org.id, { knowledgeBaseId: kb.id, query: 'synthetic' })).results.every(
      (hit) => ![doc.id, before.id].includes(hit.documentId),
    ),
  );
  await kbService.reindex(org.id, kb.id);
  assert.equal(
    await db.ragKbDocument.count({ where: { sourceId: source.id, status: 'ready' } }),
    0,
  );
  await service.toggle(org.id, kb.id, source.id, true);
  const cancelling = await service.sync(org.id, kb.id, source.id);
  await runRagSourceSync(
    db,
    {
      organizationId: org.id,
      knowledgeBaseId: kb.id,
      sourceId: source.id,
      runId: cancelling.runId,
    },
    {
      website: async (_url, sink) => {
        await service.toggle(org.id, kb.id, source.id, false);
        await sink(item('should-not-save'));
      },
    },
  );
  assert.equal(
    await db.ragKbDocument.count({ where: { sourceId: source.id, externalId: 'should-not-save' } }),
    0,
  );
  await service.remove(org.id, kb.id, source.id);
  assert.equal(await db.ragKbDocument.count({ where: { sourceId: source.id, status: 'ready' } }), 0);
  assert.equal((await db.ragKbDocument.findUnique({ where: { id: doc.id } })).status, 'disabled');
  assert.equal((await service.list(org.id, kb.id)).filter((row) => row.id === source.id).length, 0);
  pass(
    'pause/search/reindex exclusion, in-flight cancellation and removal preserving edited document',
  );
}
(async () => {
  try {
    await unit();
    await integration();
  } finally {
    ssrf.__setDnsLookupForTests(null);
    if (worker) await worker.close();
    await queue.obliterate({ force: true });
    await queue.close();
    await events.close();
    for (const id of orgIds) await db.organization.delete({ where: { id } });
    await db.$disconnect();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
