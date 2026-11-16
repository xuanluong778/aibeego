// Component/renderer browser harness at /lp-pricing-qa in a disposable Next container.
// HTTP responses are mocked; no real page, database, AI provider or publish endpoint is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('./run-landing-page-url-upgrade-tests.cjs');
const { collectTemplateContentSlots, normalizeTemplateContentBrief, fallbackTemplateContent, planTemplateContent } = require('../packages/shared/src/landing-page-template-content.ts');
const { chromium } = require(process.env.LP_PLAYWRIGHT_MODULE || '../.tmp/pricing-qa/node_modules/playwright');
const base = process.env.LP_PRICING_QA_URL || 'http://127.0.0.1:3109';
const out = path.resolve('.tmp/pricing-qa');
const qaToken = [Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: 'qa-only', exp: 2114380800 })).toString('base64url'), 'qa-only-not-a-real-signature'].join('.');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.LP_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  let checks = 0, generationCalls = 0, publishCalls = 0;
  let page;
  const errors = [];
  try {
    page = await browser.newPage({ viewport: { width: 1580, height: 1100 }, timezoneId: 'Asia/Ho_Chi_Minh' });
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    page.on('request', request => { if (/\/publish$/.test(request.url())) publishCalls++; });
    await page.addInitScript(token => localStorage.setItem('ms_access_token', token), qaToken);
    await page.route('**/api/v1/**', async route => {
      const url = route.request().url();
      const respond = json => route.fulfill({ status: 200, json });
      if (/\/auth\/refresh/.test(url)) return respond({ accessToken: qaToken });
      if (/\/auth\/me/.test(url)) return respond({ id: 'qa-only', organizationId: 'qa-only', role: 'OWNER', locale: 'vi' });
      if (/business-profile/.test(url)) return respond({ brandName: 'Digi' });
      if (/\/media\?/.test(url)) return respond({ items: [] });
      if (/validate-images/.test(url)) return respond({ images: [] });
      if (/ai-template-content$/.test(url)) {
        generationCalls++;
        const body = route.request().postDataJSON();
        const brief = normalizeTemplateContentBrief(body.brief);
        const slots = collectTemplateContentSlots(body.snapshot, !!brief.originalPrice);
        return respond({ slots, proposals: fallbackTemplateContent(slots, brief), outline: planTemplateContent(slots, brief), images: [], protectedSlotIds: [], source: 'fallback' });
      }
      return respond({});
    });
    await page.goto(`${base}/lp-pricing-qa`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByRole('button', { name: 'Mở tạo nội dung AI', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.waitFor({ state: 'visible', timeout: 10000 });
    await dialog.getByLabel('Tên sản phẩm / dịch vụ', { exact: false }).fill('Khóa học SEO Digi');
    await dialog.getByLabel('Thương hiệu', { exact: false }).fill('Digi');
    await dialog.getByLabel('Mô tả / đặc điểm thực tế', { exact: false }).fill('Thực hành trên website\nNghiên cứu từ khóa');
    await dialog.getByLabel('Khách hàng mục tiêu', { exact: false }).fill('Người học SEO');
    await dialog.getByLabel('Giá gốc', { exact: true }).fill('10000000');
    await dialog.getByLabel('Giá khuyến mãi', { exact: true }).fill('4000000');
    await dialog.getByLabel('Box báo giá nhận giá sản phẩm', { exact: true }).selectOption({ index: 1 });
    assert.match(await dialog.innerText(), /60%/); checks++;
    await page.screenshot({ path: path.join(out, 'price-fields-desktop.png') });
    await dialog.getByRole('button', { name: 'Tạo đề xuất trên mẫu', exact: true }).click();
    await dialog.getByRole('button', { name: 'Duyệt đề xuất và ẩn demo thiếu dữ liệu', exact: true }).click();
    const offer = dialog.locator('[data-lp-countdown-offer]');
    await offer.waitFor();
    assert.match(await offer.innerText(), /10\.000\.000/);
    assert.match(await offer.innerText(), /4\.000\.000/);
    assert.match(await offer.innerText(), /60%/); checks++;
    assert.ok(await offer.locator('del').evaluate(el => getComputedStyle(el).textDecorationLine.includes('line-through'))); checks++;
    assert.equal(await dialog.locator('[data-lp-block-id="qa-countdown"] [aria-live="polite"]').count(), 0); checks++;
    assert.doesNotMatch(await dialog.locator('[data-lp-block-id="qa-countdown"]').innerText(), /Timezone:/);
    const visibleCards = dialog.locator('[data-lp-pricing-card]:visible, .price-card:visible, .sl2-price:visible');
    assert.equal(await visibleCards.count(), 1);
    assert.match(await visibleCards.innerText(), /Khóa học SEO Digi/);
    assert.match(await visibleCards.innerText(), /4\.000\.000/); checks++;
    await visibleCards.screenshot({ path: path.join(out, 'price-box.png') });
    await page.screenshot({ path: path.join(out, 'price-preview-desktop.png') });
    await dialog.getByRole('button', { name: /Áp dụng đã chọn/ }).click();
    await dialog.waitFor({ state: 'hidden' });
    const saved = JSON.parse(await page.getByTestId('saved-spec').textContent());
    const pricing = saved.blocks.find(b => b.type === 'Pricing');
    assert.equal(pricing.plans[1].price, '4.000.000 ₫');
    assert.equal(pricing.plans[1].originalPrice, '10.000.000 ₫');
    assert.equal(saved.blocks.find(b => b.type === 'Countdown').clockMode, 'offer'); checks++;
    const measurements = [];
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      const result = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - innerWidth }));
      assert.ok(result.overflow <= 2, JSON.stringify({ width, ...result }));
      const publicOffer = page.locator('[data-lp-countdown-offer]');
      await publicOffer.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(out, `offer-${width}.png`) });
      measurements.push({ width, ...result }); checks++;
    }
    assert.equal(publishCalls, 0); assert.equal(generationCalls, 1); assert.deepEqual(errors, []); checks++;
    const result = { passed: true, checks, generationCalls, publishCalls, measurements, transport: 'mocked', database: 'none', browser: 'Chrome headless', realComponents: true };
    fs.writeFileSync(path.join(out, 'browser-results.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(JSON.stringify({ pageErrors: errors }));
    if (page) {
      await page.screenshot({ path: path.join(out, 'browser-failure.png') }).catch(() => {});
      fs.writeFileSync(path.join(out, 'browser-failure.html'), await page.content());
    }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
