// Actual builder, autosave and database; remote extraction/provider are explicit deterministic fixtures.
const fs = require('node:fs'), assert = require('node:assert/strict');
const { chromium } = require(process.env.LP_PLAYWRIGHT_MODULE || 'playwright');
const shared = require('../.tmp/lp-url-content/shared.cjs');
const fixture = JSON.parse(fs.readFileSync('.tmp/lp-url-content/http-fixture.json', 'utf8'));
const base = 'http://localhost:8080', entry = fixture.pages.find(p => p.kind === 'product');
async function api(path, body) {
  const response = await fetch(`${base}/api/v1${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${fixture.token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  assert.ok(response.ok, `HTTP ${response.status}`); return response.json();
}
(async () => {
  let checks = 0, generations = 0, publishCalls = 0;
  const source = { ...shared.extractTemplateUrlSource('<html><head><meta property="og:site_name" content="An Nhiên"><meta name="description" content="Bình 500 ml có nắp khóa."></head><main><h1>Bình 500 ml</h1><p>Bình dung tích 500 ml, có nắp khóa. Liên hệ để trao đổi về thông tin sản phẩm phù hợp nhu cầu.</p><img src="/photo.png" alt="Bình minh họa"></main></html>', 'https://source.test/binh', 'https://source.test/binh'), sourceId: 'url-browser-fixture' };
  const browser = await chromium.launch({ headless: true, executablePath: process.env.LP_CHROME_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 1580, height: 1000 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
    page.on('request', r => { if (/\/publish$/.test(r.url())) publishCalls++; });
    await page.addInitScript(token => localStorage.setItem('ms_access_token', token), fixture.token);
    const loaded = await api(`/landing-pages/${entry.id}`);
    const revision = loaded.draftSpec.meta?.clientRevision;
    if (revision) await api(`/landing-pages/${entry.id}/autosave`, { draftSpec: entry.original, clientRevision: revision + 1, baseRevision: revision, requestId: `url-reset-${Date.now()}` });
    const before = await api(`/landing-pages/${entry.id}`);
    await page.goto(`${base}/landing-pages/builder/${entry.id}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Tạo nội dung cho mẫu bằng AI', exact: true }).click();
    let dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Tạo nội dung từ URL', exact: true }).click();
    await dialog.getByLabel('URL trang công khai').fill('http://127.0.0.1/private');
    const blocked = page.waitForResponse(r => r.url().endsWith('/read-url'));
    await dialog.getByRole('button', { name: 'Đọc và phân tích URL', exact: true }).click();
    assert.equal((await blocked).status(), 400); await dialog.getByRole('alert').waitFor(); checks++;
    await dialog.getByRole('button', { name: 'Nhập thủ công', exact: true }).click();
    await dialog.getByLabel('Tên sản phẩm', { exact: false }).fill('Thông tin nhập tay');
    assert.equal(await dialog.getByLabel('Tên sản phẩm', { exact: false }).inputValue(), 'Thông tin nhập tay'); checks++;
    await dialog.getByRole('button', { name: 'Tạo nội dung từ URL', exact: true }).click();
    await dialog.getByLabel('URL trang công khai').fill(source.sourceUrl);
    let attempt = 0;
    await page.route('**/ai-template-content/read-url', route => {
      attempt++;
      return route.fulfill(attempt === 1 ? { status: 400, json: { code: 'HTTP_ERROR', message: 'Trang nguồn chặn truy cập.' } } : { status: 201, json: { source, brief: shared.templateUrlBrief(source) } });
    });
    await dialog.getByRole('button', { name: 'Đọc và phân tích URL', exact: true }).click();
    await dialog.getByRole('alert').filter({ hasText: 'Trang nguồn chặn' }).waitFor(); checks++;
    await dialog.getByRole('button', { name: 'Đọc và phân tích URL', exact: true }).click();
    await dialog.getByRole('status').filter({ hasText: 'Đã đọc nội dung trang' }).waitFor();
    assert.equal(await dialog.getByLabel('Tên sản phẩm', { exact: false }).inputValue(), 'Bình 500 ml');
    assert.equal(await dialog.getByLabel('Khách hàng mục tiêu').inputValue(), ''); checks++;
    assert.deepEqual((await api(`/landing-pages/${entry.id}`)).draftSpec, before.draftSpec); checks++;
    await dialog.locator('summary').filter({ hasText: 'Ảnh từ trang nguồn' }).click();
    await page.route('**/ai-template-content/import-url-image', route => route.fulfill({ status: 201, json: { image: fixture.image, sourceUrl: source.sourceUrl } }));
    await dialog.getByRole('button', { name: 'Nhập vào thư viện', exact: true }).click();
    await dialog.getByRole('button', { name: 'Đã nhập vào thư viện', exact: true }).waitFor();
    const imageCheck = dialog.getByRole('checkbox', { name: `Chọn ảnh ${fixture.image.name}`, exact: true });
    assert.equal(await imageCheck.isChecked(), false); await imageCheck.check();
    await dialog.getByRole('radio', { name: `Ảnh chính ${fixture.image.name}`, exact: true }).check(); checks++;
    await page.route('**/ai-template-content', route => {
      generations++; const request = route.request().postDataJSON();
      assert.equal(request.sourceId, source.sourceId);
      const brief = shared.normalizeTemplateContentBrief({ ...request.brief, sourceText: source.text }, true), slots = shared.collectTemplateContentSlots(request.snapshot);
      const proposals = shared.fallbackTemplateContent(slots, brief), hero = slots.find(s => s.blockType === 'Hero' && s.field === 'headline');
      const accepted = shared.validateTemplateContentProposals({ proposals: [{ slotId: hero.id, text: 'Bình 500 ml có nắp khóa', evidence: ['có nắp khóa'] }] }, [hero], brief)[0];
      proposals[proposals.findIndex(p => p.slotId === hero.id)] = accepted;
      return route.fulfill({ status: 201, json: { slots, proposals, outline: shared.planTemplateContent(slots, brief), source: 'mixed', protectedSlotIds: shared.protectedTemplateSlotIds(request.snapshot, entry.original), images: [fixture.image], urlSource: { sourceUrl: source.sourceUrl, finalUrl: source.finalUrl, readAt: source.readAt } } });
    });
    await dialog.getByRole('button', { name: 'Tạo đề xuất trên mẫu', exact: true }).click();
    await dialog.getByRole('heading', { name: 'Đề xuất theo khối', exact: true }).waitFor();
    await dialog.getByText('Nguồn đối chiếu:', { exact: false }).waitFor();
    assert.ok(await dialog.getByText('Cần bổ sung', { exact: true }).count()); checks++;
    assert.deepEqual((await api(`/landing-pages/${entry.id}`)).draftSpec, before.draftSpec); checks++;
    for (const device of ['Desktop', 'Tablet', 'Mobile']) {
      await dialog.getByRole('button', { name: device, exact: true }).click();
      await page.screenshot({ path: `.tmp/lp-url-content/url-${device}.png`, fullPage: true }); checks++;
    }
    await dialog.getByRole('button', { name: 'Duyệt đề xuất và ẩn demo thiếu dữ liệu', exact: true }).click();
    await Promise.all([page.waitForResponse(r => r.url().endsWith('/autosave') && r.ok()), dialog.getByRole('button', { name: /^Áp dụng đã chọn/ }).click()]);
    const saved = await api(`/landing-pages/${entry.id}`);
    assert.equal(saved.status, 'DRAFT'); assert.equal(publishCalls, 0);
    assert.equal(saved.draftSpec.meta.contentSource.sourceUrl, source.sourceUrl);
    assert.deepEqual(saved.draftSpec.themeTokens, before.draftSpec.themeTokens);
    assert.equal(saved.draftSpec.blocks.length, before.draftSpec.blocks.length); checks++;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Tạo nội dung cho mẫu bằng AI', exact: true }).waitFor();
    assert.deepEqual((await api(`/landing-pages/${entry.id}`)).draftSpec.meta.contentSource, saved.draftSpec.meta.contentSource); checks++;
    await page.getByRole('button', { name: 'Tạo nội dung cho mẫu bằng AI', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByText('Nguồn đã lưu trong bản nháp:', { exact: false }).waitFor();
    await dialog.getByRole('button', { name: 'Tạo nội dung từ URL', exact: true }).click();
    assert.equal(await dialog.getByLabel('URL trang công khai').inputValue(), source.sourceUrl); checks++;
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: '.tmp/lp-url-content/url-info-mobile.png', fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2)); checks++;
    assert.deepEqual(errors, []); assert.equal(generations, 1); checks++;
    fs.writeFileSync('.tmp/lp-url-content/browser-results.json', JSON.stringify({ passed: true, checks, source: 'fixture', provider: 'fixture', autosave: 'real HTTP/database', publishCalls }, null, 2));
    console.log(JSON.stringify({ passed: true, checks, source: 'fixture', provider: 'fixture', autosave: 'real HTTP/database', publishCalls }));
  } finally { await browser.close(); }
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
