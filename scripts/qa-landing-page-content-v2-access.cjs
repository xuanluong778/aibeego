const fs = require('node:fs'), assert = require('node:assert/strict');
const fixture = JSON.parse(fs.readFileSync('.tmp/lp-content-v2/http-fixture.json', 'utf8'));
(async () => {
  const entry = fixture.pages[0], headers = { Authorization: `Bearer ${fixture.token}`, 'Content-Type': 'application/json' };
  const request = (id, body, authenticated = true) => fetch(`http://localhost:8080/api/v1/landing-pages/${id}/ai-template-content/validate-images`, { method: 'POST', headers: authenticated ? headers : { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await request(entry.id, { imageIds: [fixture.image.id] })).status, 201);
  assert.equal((await request(entry.id, { imageIds: [fixture.image.id] }, false)).status, 401);
  assert.equal((await request('2a68892a-e811-4647-a29c-600827b46cc8', { imageIds: [fixture.image.id] })).status, 404);
  assert.equal((await request(entry.id, { imageIds: ['another-tenant-image'] })).status, 400);
  console.log(JSON.stringify({ passed: true, checks: 4, http: 'real', crossTenantPage: '404', foreignImage: '400', anonymous: '401' }));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
