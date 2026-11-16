import assert from 'node:assert/strict';
import { LandingPagesService } from '../apps/api/src/landing-pages/landing-pages.service';
import { LandingPageAiService } from '../apps/api/src/landing-pages/landing-page-ai.service';
import { OpenAiService } from '../apps/api/src/openai/openai.service';
import { LANDING_PAGE_SYSTEM_TEMPLATES, collectTemplateContentSlots, extractTemplateUrlSource } from '../packages/shared/src/index';

class SharedRedis {
  status = 'ready';
  data = new Map<string, { value: string; expiresAt: number }>();
  async get(key: string) { const entry = this.data.get(key); return entry && entry.expiresAt > Date.now() ? entry.value : null; }
  async set(key: string, value: string, _px: string, ttl: number, nx?: string) {
    const existing = this.data.get(key);
    if (nx && existing && existing.expiresAt > Date.now()) return null;
    this.data.set(key, { value, expiresAt: Date.now() + ttl }); return 'OK';
  }
  async eval(script: string, _n: number, key: string, arg: any) {
    if (script.includes("'incr'")) {
      const count = Number(await this.get(key) || 0) + 1;
      const ttl = count > 1 ? this.data.get(key)!.expiresAt : Date.now() + Number(arg);
      this.data.set(key, { value: String(count), expiresAt: ttl }); return count;
    }
    if (await this.get(key) === arg) return Number(this.data.delete(key));
    return 0;
  }
}
const redis = new SharedRedis();
const user = { id: 'owner', organizationId: 'tenant-a' } as any;
const spec = structuredClone(LANDING_PAGE_SYSTEM_TEMPLATES.find(t => t.slug === 'agency-portfolio-cream-editorial')!.spec);
const source = extractTemplateUrlSource('<main><h1>Khóa học thiết kế</h1><p>Tìm hiểu chương trình thiết kế dành cho người mới bắt đầu và lựa chọn hướng học phù hợp với nhu cầu.</p></main>', 'https://course.test', 'https://course.test');
let providerCalls = 0, checks = 0;
function replica() {
  const service: any = Object.create(LandingPagesService.prototype);
  Object.assign(service, {
    redis, templateUrlSources: new Map(), templateContentIdem: new Map(),
    templateContentPage: async () => ({ template: { definition: spec } }),
    creationTemplateSpec: () => spec,
    crawlPublicUrl: async () => ({ content: source }),
    validateTemplateContentImages: async () => ({ images: [] }),
    ai: { async generateTemplateContent() { providerCalls++; await new Promise(r => setTimeout(r, 5)); return { proposals: [], source: 'fallback' }; } },
  });
  return service;
}
async function test(name: string, run: () => Promise<void>) { await run(); checks++; console.log(`PASS ${name}`); }
(async () => {
  const first = replica(), second = replica();
  const receipt = await first.readTemplateContentUrl(user, 'page-a', { url: source.sourceUrl });
  const brief = { productName: 'Khóa học thiết kế', brandName: 'Xưởng Học', description: source.text, targetCustomer: 'Người mới', goal: 'consult', imageIds: [] };
  const dto = { brief, sourceId: receipt.source.sourceId, snapshot: spec, idempotencyKey: 'retry-stable-key' };
  await test('A source read on one replica is usable on another without process-local memory', async () => {
    assert.equal(first.templateUrlSources.size, 0);
    assert.equal((await second.generateTemplateContent(user, 'page-a', dto)).urlSource.sourceUrl, source.sourceUrl);
  });
  await test('Shared idempotency returns the same result without a second provider call', async () => {
    const before = providerCalls;
    await Promise.all([first.generateTemplateContent(user, 'page-a', dto), second.generateTemplateContent(user, 'page-a', dto)]);
    assert.equal(providerCalls, before);
  });
  await test('Concurrent identical requests on separate replicas start one provider call', async () => {
    const before = providerCalls;
    const concurrent = { ...dto, idempotencyKey: 'concurrent-key' };
    const [a, b] = await Promise.all([first.generateTemplateContent(user, 'page-a', concurrent), second.generateTemplateContent(user, 'page-a', concurrent)]);
    assert.equal(JSON.stringify(a), JSON.stringify(b), 'same wire response after Redis serialization');
    assert.equal(providerCalls, before + 1);
  });
  await test('Changing the brief with a reused key does not replay old copy', async () => {
    const before = providerCalls;
    await first.generateTemplateContent(user, 'page-a', { ...dto, brief: { ...brief, productName: 'Khóa học mới' } });
    assert.equal(providerCalls, before + 1);
  });
  await test('Receipts are bound to tenant, user and page; an expired receipt fails closed', async () => {
    for (const [actor, page] of [[{ ...user, organizationId: 'tenant-b' }, 'page-a'], [{ ...user, id: 'other' }, 'page-a'], [user, 'page-b']] as any[])
      await assert.rejects(second.generateTemplateContent(actor, page, dto), (e: any) => e.getResponse().code === 'URL_SOURCE_EXPIRED');
    redis.data.get(`lp:template-source:${user.organizationId}:${user.id}:page-a:${receipt.source.sourceId}`)!.expiresAt = 0;
    await assert.rejects(second.generateTemplateContent(user, 'page-a', dto), (e: any) => e.getResponse().code === 'URL_SOURCE_EXPIRED');
  });
  await test('Quota is shared across replicas and Redis disconnection cannot bypass it', async () => {
    await first.assertTemplateContentLimit('cross-replica', 1, 60000);
    await assert.rejects(second.assertTemplateContentLimit('cross-replica', 1, 60000), (e: any) => e.getStatus() === 429);
    redis.status = 'reconnecting';
    await assert.rejects(second.assertTemplateContentLimit('new-key', 10, 60000), (e: any) => e.getStatus() === 503);
    redis.status = 'ready';
  });
  const slots = collectTemplateContentSlots(spec);
  await test('AI batches never exceed two simultaneous provider calls', async () => {
    let active = 0, peak = 0;
    const ai = new LandingPageAiService({ isConfigured: () => true, async chatCompletion() {
      active++; peak = Math.max(peak, active);
      await new Promise(r => setTimeout(r, 2)); active--; return '{"proposals":[]}';
    } } as any);
    await ai.generateTemplateContent(slots, brief as any);
    assert.equal(peak, 2);
  });
  await test('A page-wide time budget stops starting provider calls after 85 seconds', async () => {
    const now = Date.now; let clock = 0, calls = 0;
    try {
      Date.now = () => clock;
      const ai = new LandingPageAiService({ isConfigured: () => true, async chatCompletion(request: any) {
        calls++; assert.ok(request.timeoutMs <= 35000 && request.timeoutMs <= 85000 - clock);
        clock += request.timeoutMs; return '{"proposals":[]}';
      } } as any);
      const result = await ai.generateTemplateContent(slots, brief as any);
      assert.ok(calls <= 3);
      assert.ok(clock <= 85000);
      assert.ok(result.proposals.some((p: any) => p.validationIssue === 'AI_TIME_BUDGET'));
    } finally { Date.now = now; }
  });
  await test('The provider timeout also aborts a response body stalled after HTTP headers', async () => {
    const originalFetch = globalThis.fetch;
    const openai: any = Object.create(OpenAiService.prototype);
    openai.getApiKey = () => 'test-only';
    openai.getBaseUrl = () => 'https://provider.test';
    openai.getDefaultModel = () => 'test';
    try {
      globalThis.fetch = (async (_url: unknown, init: RequestInit) => new Response(new ReadableStream({
        start(controller) {
          init.signal!.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')), { once: true });
        },
      }), { status: 200 })) as typeof fetch;
      await assert.rejects(openai.chatCompletion({ messages: [], timeoutMs: 20 }), /timeout after 20ms/);
      globalThis.fetch = (async () => new Response(JSON.stringify({ choices: [{ message: { content: ' OK ' } }] }), { status: 200 })) as typeof fetch;
      assert.equal(await openai.chatCompletion({ messages: [], timeoutMs: 100 }), 'OK');
    } finally { globalThis.fetch = originalFetch; }
  });
  console.log(JSON.stringify({ passed: true, checks, redis: 'shared fake', database: 'none', provider: 'mocked' }));
})().catch(error => { console.error(error); process.exitCode = 1; });
