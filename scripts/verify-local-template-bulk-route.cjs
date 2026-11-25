// Live proxy/UI smoke test. Uploads only invalid ZIPs, which cannot change templates.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
async function main() {
  const token = execFileSync('docker', ['exec', 'marketingspa-api', 'node', '-e', `
    const {prisma}=require('@marketingspa/database');
    const {createHmac}=require('node:crypto');
    (async()=>{
      const u=await prisma.user.findFirst({where:{isActive:true,deletedAt:null,role:{code:'SUPER_ADMIN'}},select:{id:true,email:true,organizationId:true}});
      if(!u)throw Error('No active admin');
      const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
      const data=enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:u.id,email:u.email,organizationId:u.organizationId,role:'SUPER_ADMIN',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+180});
      process.stdout.write(data+'.'+createHmac('sha256',process.env.JWT_SECRET).update(data).digest('base64url'));
    })().finally(()=>prisma.$disconnect());
  `], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  assert.equal((await fetch('http://localhost:8080/api/v1/health')).status, 200);
  assert.equal((await fetch('http://localhost:8080/api/v1/landing-pages/templates/packs/bulk', {method:'POST'})).status, 401);
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(token => localStorage.setItem('ms_access_token', token), token);
    const page = await context.newPage();
    await page.goto('http://localhost:8080/landing-pages/manage-templates');
    const input = page.locator('input[type=file]');
    await input.waitFor({ state: 'attached', timeout: 45000 });
    const responsePromise = page.waitForResponse(r => r.url().endsWith('/landing-pages/templates/packs/bulk') && r.request().method() === 'POST');
    await input.setInputFiles([
      { name: 'invalid-fixture-a.zip', mimeType: 'application/zip', buffer: Buffer.from('invalid fixture a') },
      { name: 'invalid-fixture-b.zip', mimeType: 'application/zip', buffer: Buffer.from('invalid fixture b') },
    ]);
    const response = await responsePromise;
    assert.equal(response.status(), 201);
    const result = await response.json();
    assert.equal(result.created, 0); assert.equal(result.updated, 0); assert.equal(result.failed, 2);
    await page.getByRole('cell', { name: 'invalid-fixture-a.zip', exact: true }).waitFor();
    await page.getByRole('cell', { name: 'invalid-fixture-b.zip', exact: true }).waitFor();
    assert(!await page.getByText('Failed to fetch', { exact: true }).count());
    const dir = path.resolve(__dirname, '../tmp/template-bulk-route-fix-20261122');
    await page.screenshot({ path: path.join(dir, 'live-bulk-report.png'), fullPage: false });
    const report = { target: 'http://localhost:8080', health: 200, unauthenticatedUpload: 401,
      browserMultipartUpload: 201, perFileReport: true, templateWrites: 0, checkedAt: new Date().toISOString() };
    fs.writeFileSync(path.join(dir, 'live-verification.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
