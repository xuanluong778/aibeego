// Reuse the exact real-source/real-provider response from the canary; real builder/autosave/draft preview.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require(process.env.LP_PLAYWRIGHT_MODULE||'playwright');
const fixture=JSON.parse(fs.readFileSync('.tmp/lp-seo-editorial/http-fixture.json','utf8'));
const read=JSON.parse(fs.readFileSync('.tmp/lp-seo-editorial/read.json','utf8'));
const generated=JSON.parse(fs.readFileSync('.tmp/lp-seo-editorial/generation.json','utf8'));
const entry=fixture.pages.find(p=>p.kind==='seo'),base='http://localhost:8080';
async function api(path,body){const r=await fetch(`${base}/api/v1${path}`,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${fixture.token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();assert.ok(r.ok,`${r.status} ${JSON.stringify(data).slice(0,300)}`);return data;}
(async()=>{
  let checks=0,publishCalls=0;const browser=await chromium.launch({headless:true,executablePath:process.env.LP_CHROME_PATH});
  try{
    const page=await browser.newPage({viewport:{width:1580,height:1000}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());page.on('request',r=>{if(/\/publish$/.test(r.url()))publishCalls++});
    await page.addInitScript(token=>localStorage.setItem('ms_access_token',token),fixture.token);
    const before=await api(`/landing-pages/${entry.id}`);
    await page.route('**/ai-template-content/read-url',r=>r.fulfill({status:201,json:read}));
    await page.route('**/ai-template-content',r=>r.fulfill({status:201,json:generated}));
    await page.goto(`${base}/landing-pages/builder/${entry.id}`,{waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'Tạo nội dung cho mẫu bằng AI',exact:true}).click();
    const dialog=page.getByRole('dialog');
    await dialog.getByRole('button',{name:'Tạo nội dung từ URL',exact:true}).click();
    await dialog.getByLabel('URL trang công khai').fill('https://daotaoseodigi.com/');
    await dialog.getByRole('checkbox',{name:`Chọn ảnh ${fixture.image.name}`,exact:true}).check();
    await dialog.getByRole('radio',{name:`Ảnh chính ${fixture.image.name}`,exact:true}).check();
    await dialog.getByLabel('Mục tiêu trang').selectOption('consult');
    await dialog.getByRole('button',{name:'Tạo đề xuất trên mẫu',exact:true}).click();
    await dialog.getByRole('heading',{name:'Đề xuất theo khối',exact:true}).waitFor();checks++;
    assert.deepEqual((await api(`/landing-pages/${entry.id}`)).draftSpec,before.draftSpec);checks++;
    await dialog.getByRole('button',{name:'Duyệt đề xuất và ẩn demo thiếu dữ liệu',exact:true}).click();
    const preview=dialog.locator('.lp-template-ai-preview-page');
    assert.doesNotMatch(await preview.innerText(),/Studio Sáng tạo|Trao đổi dự án|chiến lược thương hiệu|ngân sách quảng cáo|Mốc demo|PORTFOLIO/i);checks++;
    for(const device of ['Desktop','Tablet','Mobile']){
      await dialog.getByRole('button',{name:device,exact:true}).click();await page.screenshot({path:`.tmp/lp-seo-editorial/${device}-review.png`,fullPage:true});checks++;
    }
    await Promise.all([page.waitForResponse(r=>r.url().endsWith('/autosave')&&r.ok()),dialog.getByRole('button',{name:/^Áp dụng đã chọn/}).click()]);
    const saved=await api(`/landing-pages/${entry.id}`);assert.equal(saved.status,'DRAFT');assert.equal(publishCalls,0);checks++;
    assert.equal(saved.draftSpec.blocks.length,before.draftSpec.blocks.length);assert.deepEqual(saved.draftSpec.themeTokens,before.draftSpec.themeTokens);
    assert.equal(saved.draftSpec.seo.canonical,before.draftSpec.seo.canonical);
    assert.equal(saved.draftSpec.meta.contentSource.sourceUrl,'https://daotaoseodigi.com/');checks++;
    for(const block of before.draftSpec.blocks){
      const after=saved.draftSpec.blocks.find(b=>b.id===block.id);
      for(const key of ['style','responsiveStyle','freeLayout','responsiveFreeLayout','variant','ctaUrl','crm','endsAt','timezone'])assert.deepEqual(after[key],block[key],`${block.type}.${key}`);
    }checks++;
    for(const type of ['Countdown','Pricing','Guarantee'])assert.equal(saved.draftSpec.blocks.find(b=>b.type===type).hidden,true);checks++;
    await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Tạo nội dung cho mẫu bằng AI',exact:true}).waitFor();
    assert.deepEqual((await api(`/landing-pages/${entry.id}`)).draftSpec.blocks,saved.draftSpec.blocks);checks++;
    const token=await api(`/landing-pages/${entry.id}/preview-token`,{expiresInHours:1});
    await page.goto(`${base}${token.previewPath}`,{waitUntil:'networkidle'});
    assert.match(await page.locator('meta[name="robots"]').getAttribute('content'),/noindex/);checks++;
    const text=await page.locator('body').innerText();
    assert.match(text,/Đào Tạo SEO Digi/);assert.doesNotMatch(text,/Studio Sáng tạo|Trao đổi dự án|chiến lược thương hiệu|ngân sách quảng cáo|Mốc demo|PORTFOLIO|Lợi ích sản phẩm/i);checks++;
    for(const regex of [/google|crawl|index/i,/từ khóa|từ khoá|keyword/i,/entity|stacking/i,/cấu trúc|silo|cluster/i,/audit/i,/onpage/i,/internal link|liên kết nội bộ/i,/technical|schema/i,/traffic user/i,/tổng kết/i])assert.match(text,regex);checks++;
    const measurements=[];
    for(const width of [1440,768,390]){
      await page.setViewportSize({width,height:1000});
      const state=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-innerWidth,h1:document.querySelectorAll('h1').length,clipped:[...document.querySelectorAll('[data-lp-block-id] h1,[data-lp-block-id] h2,[data-lp-block-id] h3,[data-lp-block-id] p')].filter(el=>el.getClientRects().length&&el.scrollWidth>el.clientWidth+2).map(el=>el.textContent.slice(0,100))}));
      assert.ok(state.overflow<=2,JSON.stringify({width,...state}));assert.equal(state.h1,1);assert.deepEqual(state.clipped,[]);measurements.push({width,...state});
      await page.screenshot({path:`.tmp/lp-seo-editorial/draft-preview-${width}.png`,fullPage:true});checks++;
    }
    assert.deepEqual(errors,[]);assert.equal((await api(`/landing-pages/${entry.id}`)).status,'DRAFT');checks++;
    fs.writeFileSync('.tmp/lp-seo-editorial/applied.json',JSON.stringify(saved.draftSpec,null,2));
    const result={passed:true,checks,source:'real URL snapshot',provider:'real response reused',autosave:'real',privateDraftPreview:true,publishCalls,measurements};
    fs.writeFileSync('.tmp/lp-seo-editorial/browser-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
