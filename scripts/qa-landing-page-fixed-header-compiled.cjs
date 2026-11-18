const assert=require('node:assert/strict');const {chromium}=require('playwright');
const base=process.env.LP_FIXED_HEADER_QA_URL||'http://127.0.0.1:13048';const root=process.env.LP_FIXED_HEADER_QA_DIR||'/var/www/aibeego_com_usr/fixed-header-20261118';
(async()=>{const b=await chromium.launch({executablePath:'/snap/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});try{
 for(const width of [1500,768,375]){
  const p=await b.newPage({viewport:{width,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));const r=await p.goto(base+'/p/logo-qa-template',{waitUntil:'domcontentloaded',timeout:45000});assert(r.ok());
  const h=p.locator('[data-lp-fixed-header-portal] header');await h.waitFor();await p.waitForFunction(()=>{const i=document.querySelector('[data-lp-fixed-header-portal] header img');return i?.complete&&i.naturalWidth>0});
  assert.equal(await h.evaluate(e=>getComputedStyle(e).position),'fixed');
  await p.evaluate(()=>window.scrollTo(0,1200));await p.waitForTimeout(150);
  const m=await h.evaluate(e=>({rect:e.getBoundingClientRect().toJSON(),logo:e.querySelector('img').getBoundingClientRect().toJSON()}));const expectedTop=await p.evaluate(()=>document.querySelector('[data-lp-preview-banner]')?.getBoundingClientRect().bottom||0);assert(Math.abs(m.rect.top-expectedTop)<1);assert.equal(m.rect.width,width);assert.equal(m.logo.height,44);
  const toggle=h.locator('.lp-header-menu-toggle');if(width<801)await toggle.click();
  const link=h.locator('nav:visible a').filter({hasText:'Bảng giá'}).first();const id=(await link.getAttribute('href')).slice(1);await link.click();
  await p.waitForFunction(id=>{const target=Array.from(document.querySelectorAll('[data-lp-renderer]:not([data-lp-fixed-header-portal]) [data-lp-block-id]')).find(e=>e.dataset.lpBlockId===id),header=document.querySelector('[data-lp-fixed-header-portal] header');if(!target||!header)return false;const t=target.getBoundingClientRect().top,h=header.getBoundingClientRect().bottom;return t>=h-1&&t<=h+48},id,{timeout:5000});
  const top=await p.evaluate(id=>Array.from(document.querySelectorAll('[data-lp-renderer]:not([data-lp-fixed-header-portal]) [data-lp-block-id]')).find(e=>e.dataset.lpBlockId===id)?.getBoundingClientRect().top,id);assert(top>=m.rect.bottom-1,'target remains visible below header');
  if(width<801)assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  await p.screenshot({path:root+'/compiled-'+width+'.png'});assert.deepEqual(errors,[]);console.log('PASS compiled fixed header',width,JSON.stringify(m));await p.close();
 }
 console.log('PASS compiled fixed header QA: 3 responsive cases, scroll, logo, menu targets and mobile menu');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
