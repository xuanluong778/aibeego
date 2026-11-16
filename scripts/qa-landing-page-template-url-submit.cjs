// Regression for the primary submit button. Real builder; source/provider fixtures; never applies or publishes.
const fs = require('node:fs'), assert = require('node:assert/strict');
const { chromium } = require(process.env.LP_PLAYWRIGHT_MODULE || 'playwright');
const shared = require('../.tmp/lp-url-content/shared.cjs');
const fixture = JSON.parse(fs.readFileSync('.tmp/lp-url-content/http-fixture.json', 'utf8'));
const entry = fixture.pages.find(p => p.kind === 'seo'), base = 'http://localhost:8080';
const extracted = shared.extractTemplateUrlSource('<html><head><meta property="og:site_name" content="Thế giới digi"><meta name="description" content="Đào tạo SEO theo nhu cầu tìm hiểu của người học."></head><main><h1>Đào tạo SEO</h1><p>Đào tạo SEO theo nhu cầu tìm hiểu của người học. Liên hệ để trao đổi về nội dung và thông tin khóa học phù hợp.</p></main></html>', 'https://source.test/seo', 'https://source.test/seo');
async function stored() { const r = await fetch(`${base}/api/v1/landing-pages/${entry.id}`, { headers: {Authorization:`Bearer ${fixture.token}`} }); assert.ok(r.ok); return r.json(); }
(async () => {
  const browser = await chromium.launch({headless:true,executablePath:process.env.LP_CHROME_PATH});
  const original = await stored(), results = [];
  try {
    for (const scenario of ['bare-url-only','manual-overrides','invalid-url','blocked-retry','manual-validation','expired-retry','provider-retry','explicit-read-bare-url']) {
      const page = await browser.newPage({viewport:{width:1530,height:760}}), errors=[];
      let reads=0, generations=0, writes=0;
      page.on('pageerror',e=>errors.push(e.message)); page.on('dialog',d=>d.accept());
      page.on('request',r=>{if(/\/(autosave|publish)$/.test(r.url()))writes++});
      await page.addInitScript(token=>localStorage.setItem('ms_access_token',token),fixture.token);
      await page.route('**/ai-template-content/read-url',async route=>{
        reads++; assert.equal(route.request().postDataJSON().url,'https://source.test/seo');
        if(scenario==='blocked-retry'&&reads===1) return route.fulfill({status:400,json:{message:'Trang nguồn chặn truy cập. Hãy thử lại.',code:'HTTP_ERROR'}});
        await new Promise(resolve=>setTimeout(resolve,100));
        return route.fulfill({status:201,json:{source:{...extracted,sourceId:`source-${reads}`},brief:shared.templateUrlBrief(extracted)}});
      });
      await page.route('**/ai-template-content',route=>{
        generations++; const request=route.request().postDataJSON();
        if(scenario==='expired-retry'&&generations===1)return route.fulfill({status:400,json:{message:'Nội dung URL đã hết hạn. Đọc lại URL.',code:'URL_SOURCE_EXPIRED'}});
        if(scenario==='provider-retry'&&generations===1)return route.fulfill({status:503,json:{message:'AI tạm thời chưa sẵn sàng. Hãy thử lại.'}});
        if(scenario!=='manual-validation')assert.equal(request.sourceId,`source-${reads}`);
        if(scenario==='manual-overrides') {
          assert.equal(request.brief.productName,'Tên khóa học do tôi sửa');
          assert.equal(request.brief.description,'Mô tả tôi đã nhập và muốn giữ nguyên.');
          assert.equal(request.brief.targetCustomer,'Chủ doanh nghiệp bán hàng online');
        }
        const slots=shared.collectTemplateContentSlots(request.snapshot),brief={...request.brief,...(request.sourceId?{sourceText:extracted.text}:{})};
        return route.fulfill({status:201,json:{slots,proposals:shared.fallbackTemplateContent(slots,brief),protectedSlotIds:[],images:[],outline:shared.planTemplateContent(slots,brief),source:'fallback',...(request.sourceId?{urlSource:{sourceUrl:extracted.sourceUrl,finalUrl:extracted.finalUrl,readAt:extracted.readAt}}:{})}});
      });
      await page.goto(`${base}/landing-pages/builder/${entry.id}`,{waitUntil:'domcontentloaded'});
      await page.getByRole('button',{name:'Tạo nội dung cho mẫu bằng AI',exact:true}).click();
      const dialog=page.getByRole('dialog'), submit=dialog.getByRole('button',{name:'Tạo đề xuất trên mẫu',exact:true});
      const checkError=async text=>{
        const alert=dialog.getByRole('alert'); await alert.filter({hasText:text}).waitFor();
        await page.waitForFunction(()=>document.activeElement?.getAttribute('role')==='alert');
        assert.ok(await alert.evaluate(el=>{const a=el.getBoundingClientRect(),b=el.closest('aside').getBoundingClientRect();return a.top>=b.top&&a.bottom<=b.bottom;}),'error is visible in the scrolled panel');
        assert.equal(await dialog.locator('.lp-template-ai-primary-button').isEnabled(),true);
      };
      const fillManual=async()=>{for(const[label,value]of [['Tên sản phẩm','Tên khóa học do tôi sửa'],['Thương hiệu','Thương hiệu do tôi nhập'],['Mô tả / đặc điểm','Mô tả tôi đã nhập và muốn giữ nguyên.'],['Khách hàng mục tiêu','Chủ doanh nghiệp bán hàng online']])await dialog.getByLabel(label,{exact:false}).fill(value);};
      if(scenario==='manual-validation') {
        await submit.click(); await checkError('Nhập tên sản phẩm'); assert.equal(generations,0);
        await fillManual(); await submit.click();
      }else {
        await dialog.getByRole('button',{name:'Tạo nội dung từ URL',exact:true}).click();
        await dialog.getByLabel('URL trang công khai').fill(scenario==='invalid-url'?'https://[':'source.test/seo');
        if(scenario==='manual-overrides')await fillManual();
        if(scenario==='explicit-read-bare-url'){
          await dialog.getByRole('button',{name:'Đọc và phân tích URL',exact:true}).click();
          await dialog.getByRole('status').filter({hasText:'Đã đọc nội dung trang'}).waitFor();
          assert.equal(reads,1);
        }
        await submit.click();
        if(scenario==='invalid-url'){
          await checkError('URL không hợp lệ'); assert.equal(reads,0);assert.equal(generations,0);
          await page.screenshot({path:'.tmp/lp-url-content/submit-error-visible.png'});
        }
        if(['blocked-retry','expired-retry','provider-retry'].includes(scenario)){
          await checkError(scenario==='blocked-retry'?'Trang nguồn chặn':scenario==='expired-retry'?'hết hạn':'AI tạm thời');
          await submit.click();
        }
      }
      if(scenario!=='invalid-url') {
        await dialog.getByRole('heading',{name:'Đề xuất theo khối',exact:true}).waitFor();
        assert.equal(reads,scenario==='manual-validation'?0:['blocked-retry','expired-retry'].includes(scenario)?2:1);
        assert.equal(generations,['expired-retry','provider-retry'].includes(scenario)?2:1);
      }
      assert.equal(writes,0);assert.deepEqual(errors,[]);
      assert.deepEqual((await stored()).draftSpec,original.draftSpec);
      results.push({scenario,passed:true,reads,generations,writes});await page.close();
    }
    fs.writeFileSync('.tmp/lp-url-content/submit-results.json',JSON.stringify({passed:true,checks:results.length,results},null,2));
    console.log(JSON.stringify({passed:true,checks:results.length,results}));
  }finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
