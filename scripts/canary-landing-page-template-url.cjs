// Read-only generation on an existing disposable QA page. Never autosaves or publishes.
const assert = require('node:assert/strict'), fs = require('node:fs'), { randomUUID } = require('node:crypto');
const fixture = JSON.parse(fs.readFileSync(process.env.LP_URL_FIXTURE || '.tmp/lp-url-content/http-fixture.json', 'utf8'));
const base = process.env.LP_URL_BASE || 'http://localhost:8080';
const entry = fixture.pages.find(page => page.kind === 'seo');
async function api(path, body, authenticated = true) {
  const response = await fetch(`${base}/api/v1${path}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(authenticated ? { Authorization: `Bearer ${fixture.token}` } : {}) }, ...(body ? {body: JSON.stringify(body)} : {}) });
  const data = await response.json(); return { status: response.status, data };
}
(async () => {
  const endpoint = `/landing-pages/${entry.id}`, before = (await api(endpoint)).data;
  assert.equal((await api(`${endpoint}/ai-template-content/read-url`, {url:'https://example.com'}, false)).status, 401);
  const rejected = await api(`${endpoint}/ai-template-content/read-url`, {url:'http://127.0.0.1/private'});
  assert.equal(rejected.status, 400); assert.equal(rejected.data.code, 'SSRF_BLOCKED');
  const read = await api(`${endpoint}/ai-template-content/read-url`, {url:process.env.LP_URL_PUBLIC_SOURCE || 'https://example.com'});
  assert.equal(read.status, 201, JSON.stringify(read.data)); assert.ok(read.data.source.text.length >= 80);
  const foreign = await api(`/landing-pages/2a68892a-e811-4647-a29c-600827b46cc8/ai-template-content/read-url`, {url:'https://example.com'});
  assert.equal(foreign.status, 404);
  const generated = await api(`${endpoint}/ai-template-content`, {snapshot:before.draftSpec,brief:{...read.data.brief,goal:'consult',imageIds:[]},sourceId:read.data.source.sourceId,idempotencyKey:randomUUID()});
  assert.equal(generated.status,201,JSON.stringify(generated.data));
  assert.equal(generated.data.urlSource.sourceUrl,read.data.source.sourceUrl);
  assert.ok(generated.data.slots.length > 30);
  const ids = new Set(generated.data.slots.map(slot=>slot.id));
  assert.ok(generated.data.proposals.every(proposal=>ids.has(proposal.slotId)));
  for (const slot of generated.data.slots.filter(slot=>['price','review','policy'].includes(slot.role))) {
    assert.equal(generated.data.proposals.find(proposal=>proposal.slotId===slot.id).status,'missing');
  }
  const after = (await api(endpoint)).data;
  assert.deepEqual(after.draftSpec,before.draftSpec); assert.equal(after.updatedAt,before.updatedAt); assert.equal(after.status,'DRAFT');
  const result={passed:true,checks:8,sourceUrl:read.data.source.sourceUrl,readChars:read.data.source.text.length,aiSource:generated.data.source,slots:generated.data.slots.length,diagnostics:generated.data.validationSummary,draftUnchanged:true,published:false};
  fs.writeFileSync('.tmp/lp-url-content/live-results.json',JSON.stringify(result,null,2)); console.log(JSON.stringify(result));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
