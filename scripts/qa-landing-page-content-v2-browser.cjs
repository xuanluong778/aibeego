// Disposable real-HTTP acceptance: no changes to the user's page.
const fs = require('node:fs'), assert = require('node:assert/strict');
const { chromium } = require(process.env.LP_PLAYWRIGHT_MODULE || 'playwright');
const shared = require('../.tmp/lp-content-v2/shared.cjs');
const fixture = JSON.parse(fs.readFileSync('.tmp/lp-content-v2/http-fixture.json', 'utf8'));
const base = 'http://localhost:8080', out = '.tmp/lp-content-v2';
let checks = 0;
async function api(endpoint, body, token = fixture.token) {
  const r = await fetch(`${base}/api/v1${endpoint}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json(); if (!r.ok) throw new Error(`${r.status} ${endpoint}: ${JSON.stringify(data).slice(0, 500)}`); return data;
}
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.LP_CHROME_PATH });
  const results = [];
  try {
    for (const entry of fixture.pages) {
      const page = await browser.newPage({ viewport: { width: 1580, height: 1000 } });
      const errors = [], saves = []; let generation;
      page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
      await page.addInitScript(token => localStorage.setItem('ms_access_token', token), fixture.token);
      page.on('response', async r => { if (r.url().endsWith('/autosave')) saves.push({ status: r.status() }); });
      if (entry.kind === 'seo' && process.env.LP_QA_CACHE_GENERATION) await page.route('**/ai-template-content', async route => {
        const cached = JSON.parse(fs.readFileSync(`${out}/seo-generation.json`,'utf8'));
        const body = route.request().postDataJSON();
        const checked = new Map(shared.validateTemplateContentProposals({ proposals: cached.proposals.filter(p => p.source === 'ai') }, cached.slots, body.brief).map(p => [p.slotId,p]));
        cached.proposals = cached.proposals.map(p => p.source === 'ai' ? checked.get(p.slotId) : p);
        cached.source = cached.proposals.some(p => p.source === 'ai') ? cached.proposals.some(p => p.source === 'fallback' && p.status === 'ready') ? 'mixed' : 'ai' : 'fallback';
        cached.validationSummary = cached.proposals.reduce((summary,p) => { if(p.validationIssue) summary[p.validationIssue] = (summary[p.validationIssue] || 0) + 1; return summary; },{});
        generation = cached; await route.fulfill({status:201,json:cached});
      });
      // Keep real API generation for the SEO canary; deterministic product proposal verifies the shared fallback too.
      if (entry.kind === 'product') await page.route('**/ai-template-content', async route => {
        const body = route.request().postDataJSON(), slots = shared.collectTemplateContentSlots(body.snapshot);
        generation = { slots, proposals: shared.fallbackTemplateContent(slots, body.brief), outline: shared.planTemplateContent(slots, body.brief), protectedSlotIds: shared.protectedTemplateSlotIds(body.snapshot, entry.original), images: [fixture.image], source: 'fallback' };
        await route.fulfill({ status: 201, json: generation });
      });
      page.on('response', async r => { if (r.url().endsWith('/ai-template-content') && r.ok()) generation = await r.json(); });
      const endpoint = `/landing-pages/${entry.id}`;
      const initial = (await api(endpoint)).draftSpec;
      if (initial.meta?.clientRevision) await api(`${endpoint}/autosave`, { draftSpec: entry.original, clientRevision: initial.meta.clientRevision + 1, baseRevision: initial.meta.clientRevision, requestId: `qa-reset-${Date.now()}` });
      await page.goto(`${base}/landing-pages/builder/${entry.id}`, { waitUntil: 'domcontentloaded' });
      const open = async () => {
        await page.getByRole('button', { name: 'Tạo nội dung cho mẫu bằng AI', exact: true }).click();
        const dialog = page.getByRole('dialog');
        await dialog.getByLabel('Tên sản phẩm', { exact: false }).fill(entry.kind === 'seo' ? 'Đào tạo SEO' : 'Bình giữ nhiệt 500 ml');
        await dialog.getByLabel('Thương hiệu', { exact: false }).fill(entry.kind === 'seo' ? 'Thế giới digi' : 'An Nhiên');
        await dialog.getByLabel('Mô tả / đặc điểm', { exact: false }).fill(entry.kind === 'seo' ? 'Đào tạo SEO. Liên hệ để trao đổi nhu cầu học và nhận tư vấn về khóa học phù hợp.' : 'Dung tích 500 ml. Có nắp khóa.');
        await dialog.getByLabel('Khách hàng mục tiêu', { exact: false }).fill(entry.kind === 'seo' ? 'Người muốn tìm hiểu việc học SEO' : 'Nhân viên văn phòng');
        await dialog.getByLabel('Mục tiêu trang').selectOption('consult');
        await dialog.getByRole('checkbox', { name: `Chọn ảnh ${fixture.image.name}`, exact: true }).check();
        await dialog.getByRole('radio', { name: `Ảnh chính ${fixture.image.name}`, exact: true }).check();
        const response = page.waitForResponse(r => r.url().endsWith('/ai-template-content'), { timeout: 150000 });
        await dialog.getByRole('button', { name: 'Tạo đề xuất trên mẫu', exact: true }).click();
        const r = await response; assert.equal(r.status(), 201, 'generation HTTP status');
        await dialog.getByRole('heading', { name: 'Đề xuất theo khối', exact: true }).waitFor({ timeout: 150000 });
        return dialog;
      };
      let before = (await api(endpoint)).draftSpec;
      let dialog = await open(); checks++;
      console.log(JSON.stringify({stage:'generated',kind:entry.kind,source:generation.source,diagnostics:generation.validationSummary}));
      const generated = generation; assert.ok(generated.slots.length > 30); checks++;
      assert.ok(generated.proposals.every(p => ['ai','fallback'].includes(p.source)), 'each proposal identifies its actual source');
      assert.equal(generated.source, generated.proposals.some(p => p.source === 'ai') ? generated.proposals.some(p => p.source === 'fallback' && p.status === 'ready') ? 'mixed' : 'ai' : 'fallback'); checks++;
      fs.writeFileSync(`${out}/${entry.kind}-generation.json`, JSON.stringify(generated));
      for (const [device, width] of [['Desktop', 1100], ['Tablet', 768], ['Mobile', 390]]) {
        await dialog.getByRole('button', { name: device, exact: true }).click();
        const viewport = dialog.locator('[data-lp-preview-viewport]');
        assert.equal(await viewport.evaluate(el => Math.round(el.getBoundingClientRect().width / Number(el.parentElement.style.zoom))), width);
        assert.ok(await viewport.evaluate(el => el.getBoundingClientRect().width <= el.closest('[data-template-content-preview]').clientWidth + 2), 'preview scales to available review pane');
        await page.screenshot({ path: `${out}/${entry.kind}-${device}-review.png`, fullPage: true }); checks++;
      }
      assert.deepEqual((await api(endpoint)).draftSpec, before, 'preview never writes draft'); checks++;
      assert.ok(await dialog.getByText('Cần bổ sung', { exact: true }).count()); checks++;
      const hero = before.blocks.find(b => b.type === 'Hero');
      await dialog.getByRole('button', { name: 'Bỏ chọn tất cả', exact: true }).click();
      await dialog.locator(`[data-template-content-block="${hero.id}"]`).getByRole('checkbox').first().check();
      const titleSlot = generated.slots.find(s => s.blockId === hero.id && s.field === 'headline');
      await dialog.getByRole('textbox', { name: `Sửa ${titleSlot.label} ${titleSlot.id}`, exact: true }).fill(entry.kind === 'seo' ? 'Thông tin khóa học SEO tại Thế giới digi' : 'Tìm hiểu bình giữ nhiệt 500 ml của An Nhiên');
      await dialog.getByText('Bạn đã chỉnh sửa', { exact: true }).first().waitFor(); checks++;
      const titleChoice = dialog.getByRole('checkbox', { name: `Áp dụng ${titleSlot.label} ${titleSlot.id}`, exact: true });
      if (await titleChoice.isDisabled()) await titleChoice.locator('xpath=../..').getByRole('button', { name: 'Xác nhận thay thế', exact: true }).click();
      await titleChoice.check();
      const save = page.waitForResponse(r => r.url().endsWith('/autosave'), { timeout: 20000 });
      await dialog.getByRole('button', { name: /^Áp dụng đã chọn/ }).click(); assert.ok((await save).ok());
      let stored = (await api(endpoint)).draftSpec;
      for (const block of before.blocks.filter(b => b.id !== hero.id)) assert.deepEqual(stored.blocks.find(b => b.id === block.id), block);
      assert.deepEqual(stored.seo, before.seo); checks++;
      assert.equal(stored.meta.fieldSources[`${hero.id}.headline`], 'user'); checks++;
      await Promise.all([page.waitForResponse(r => r.url().endsWith('/autosave')), page.locator('[data-lp-toolbar-btn="undo"]').click()]);
      assert.deepEqual((await api(endpoint)).draftSpec.blocks, before.blocks); checks++;
      // Reuse the exact reviewed server proposal on the restored snapshot, avoiding a second provider charge.
      if (entry.kind === 'seo') await page.route('**/ai-template-content', route => route.fulfill({ status: 201, json: generated }));
      dialog = await open();
      await dialog.getByRole('button', { name: 'Duyệt đề xuất và ẩn demo thiếu dữ liệu', exact: true }).click();
      await Promise.all([page.waitForResponse(r => r.url().endsWith('/autosave')), dialog.getByRole('button', { name: /^Áp dụng đã chọn/ }).click()]);
      stored = (await api(endpoint)).draftSpec;
      assert.equal(stored.blocks.length, before.blocks.length); assert.deepEqual(stored.themeTokens, before.themeTokens); checks++;
      if (entry.kind === 'seo') { assert.equal(stored.blocks.find(b => b.type === 'Countdown').hidden, true); assert.match(stored.seo.title, /SEO/); checks++; }
      const persisted = structuredClone(stored);
      fs.writeFileSync(`${out}/${entry.kind}-applied.json`,JSON.stringify(persisted,null,2));
      await Promise.all([page.waitForResponse(r => r.url().endsWith('/autosave')), page.locator('[data-lp-toolbar-btn="undo"]').click()]);
      assert.deepEqual((await api(endpoint)).draftSpec.blocks, before.blocks); checks++;
      await Promise.all([page.waitForResponse(r => r.url().endsWith('/autosave')), page.locator('[data-lp-toolbar-btn="redo"]').click()]);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Tạo nội dung cho mẫu bằng AI', exact: true }).waitFor();
      const reloaded = (await api(endpoint)).draftSpec;
      assert.deepEqual(reloaded.blocks, persisted.blocks); assert.deepEqual(reloaded.seo, persisted.seo); checks++;
      // Publish only this disposable QA page, then inspect actual server-rendered metadata.
      const publish = await api(`${endpoint}/publish`, {}); assert.ok(publish); checks++;
      await fetch(`${base}/api/landing-pages/revalidate`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({slug:entry.slug}) });
      await page.goto(`${base}/p/${entry.slug}`, { waitUntil: 'networkidle' });
      assert.equal(await page.title(), persisted.seo.title);
      assert.equal(await page.locator('meta[name="description"]').getAttribute('content'), persisted.seo.metaDescription); checks++;
      assert.equal(await page.locator('meta[property="og:title"]').getAttribute('content'), persisted.seo.title);
      assert.equal(await page.locator('meta[property="og:description"]').getAttribute('content'), persisted.seo.metaDescription); checks++;
      if (!process.env.LP_QA_SKIP_OG) { assert.equal(await page.locator('meta[property="og:image"]').first().getAttribute('content'), new URL(persisted.seo.ogImage,base).href); checks++; }
      const text = await page.locator('body').innerText();
      if (entry.kind === 'seo') { assert.doesNotMatch(text, /chiến lược thương hiệu|định vị thương hiệu|Mốc demo|Studio Sáng tạo/i); checks++; }
      const leadCta = page.locator('a[href="#lead-form"]').first();
      if (await leadCta.count()) { await leadCta.click(); assert.equal(await page.evaluate(()=>location.hash),'#lead-form'); assert.ok(await page.locator('#lead-form').isVisible()); checks++; }
      const responsive = [];
      for (const width of [1440, 768, 390]) {
        await page.setViewportSize({ width, height: 1000 }); await page.waitForTimeout(350);
        const measurements = await page.evaluate(() => {
          const rgb = s => (s.match(/[\d.]+/g) || []).slice(0,3).map(Number);
          const lum = a => a.map(v => { v/=255; return v<=.04045?v/12.92:((v+.055)/1.055)**2.4; }).reduce((s,v,i) => s+v*[.2126,.7152,.0722][i],0);
          const ratio = (a,b) => (Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
          const visible = el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
          const actions = [...document.querySelectorAll('main a[href],main button[type="submit"], [data-lp-block-id] a[href], [data-lp-block-id] button[type="submit"]')].filter(visible).map(el => {
            let p=el,backgrounds=[]; while(p){const s=getComputedStyle(p),gradient=s.backgroundImage.match(/rgba?\([^)]+\)/g);if(gradient?.length){backgrounds=gradient.map(rgb);break;}if(s.backgroundColor!=='rgba(0, 0, 0, 0)'){backgrounds=[rgb(s.backgroundColor)];break;}p=p.parentElement;}
            if(!backgrounds.length)backgrounds=[[255,255,255]];
            const inkNodes=[el,...el.querySelectorAll('span')];return {text:el.innerText.trim(),href:el.getAttribute('href'),ratio:Math.min(...inkNodes.flatMap(n=>backgrounds.map(bg=>ratio(rgb(getComputedStyle(n).color),bg))))};
          });
          const clippedText = [...document.querySelectorAll('[data-lp-block-id] h1,[data-lp-block-id] h2,[data-lp-block-id] h3,[data-lp-block-id] p')].filter(visible).filter(el=>el.scrollWidth>el.clientWidth+2).map(el=>el.innerText.slice(0,80));
          return { overflow: document.documentElement.scrollWidth-innerWidth, h1:document.querySelectorAll('h1').length, actions, clippedText };
        });
        assert.ok(measurements.overflow <= 2, `horizontal overflow ${width}: ${measurements.overflow}`);
        assert.equal(measurements.h1,1); assert.ok(measurements.actions.every(a=>a.text && a.ratio>=4.49), JSON.stringify(measurements.actions)); checks++;
        assert.deepEqual(measurements.clippedText,[]);
        responsive.push({width,...measurements}); await page.screenshot({path:`${out}/${entry.kind}-public-${width}.png`,fullPage:true});
      }
      assert.deepEqual(errors,[]); assert.ok(saves.every(s=>s.status<300)); checks++;
      results.push({ kind:entry.kind, source:generated.source, slots:generated.slots.length, diagnostics:generated.validationSummary, saves:saves.length, responsive });
      fs.writeFileSync(`${out}/${entry.kind}-applied.json`,JSON.stringify(persisted,null,2));
      await page.close();
    }
    fs.writeFileSync(`${out}/browser-results.json`,JSON.stringify({checks,results},null,2)); console.log(JSON.stringify({passed:true,checks,results}));
  } finally { await browser.close(); }
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
