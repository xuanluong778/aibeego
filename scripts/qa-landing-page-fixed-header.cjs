const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
const root=process.env.LP_FIXED_HEADER_QA_DIR||'/var/www/aibeego_com_usr/fixed-header-20261118';
const templates=JSON.parse(fs.readFileSync(root+'/templates.json','utf8'));
(async()=>{
 const browser=await chromium.launch({executablePath:'/snap/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  let count=0;
  for(const [width,viewport] of [[1500,'desktop'],[375,'mobile']])for(const nested of [false,true]){
   const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://fonts.googleapis.com/**',route=>route.abort());
   await page.setContent('<html><head><base href="https://aibeego.com/"></head><body style="margin:0"><div id="surface" '+(nested?'data-lp-fullscreen-preview-surface="1" style="position:fixed;inset:0;z-index:100;background:white"':'')+'><div id="toolbar" style="position:fixed;top:0;height:44px;z-index:100;background:black;width:100%;'+(nested?'':'display:none')+'"></div><div id="scroll" data-lp-preview-full-canvas="1" style="'+(nested?'position:absolute;top:44px;left:0;right:0;height:800px;overflow:auto;transform:translateZ(0)':'')+'"><div id="app"></div></div></div></body></html>');
   await page.addStyleTag({path:root+'/production.css'});await page.addStyleTag({path:root+'/fixture/motion.css'});await page.addScriptTag({path:root+'/fixture/motion.js'});
   const spec=templates.find(t=>t.slug==='online-course').spec;
   await page.evaluate(({spec,viewport,nested})=>{window.fixtureRoot=createRoot(document.getElementById('app'));fixtureRoot.render(React.createElement(LandingPageRenderer,{spec,mode:nested?'preview':'public',viewport}))},{spec,viewport,nested});
   await page.waitForSelector('[data-lp-fixed-header-portal] header');
   await page.waitForFunction(()=>{const i=document.querySelector('[data-lp-fixed-header-portal] header img');return i?.complete&&i.naturalWidth>0});
   await page.waitForFunction(()=>{const h=document.querySelector('[data-lp-fixed-header-portal] header'),s=document.querySelector('[data-lp-fixed-header-placeholder]');return h&&s&&Math.abs(h.offsetHeight-s.getBoundingClientRect().height)<1});
   const measure=()=>page.evaluate(()=>{const h=document.querySelector('[data-lp-fixed-header-portal] header'),s=document.querySelector('[data-lp-fixed-header-placeholder]'),i=h.querySelector('img');return{position:getComputedStyle(h).position,header:h.getBoundingClientRect().toJSON(),spacer:s.getBoundingClientRect().height,logo:i.getBoundingClientRect().toJSON()}});
   const before=await measure();assert.equal(before.position,'fixed');assert(Math.abs(before.spacer-before.header.height)<=1,'spacer matches header');assert(before.logo.height<=48);
   await page.evaluate(nested=>nested?document.getElementById('scroll').scrollTo(0,1200):window.scrollTo(0,1200),nested);
   await page.waitForTimeout(100);
   const after=await measure();assert(Math.abs(after.header.top-(nested?44:0))<=1,'header stays at top: '+JSON.stringify(after));assert.equal(after.header.width,before.header.width);
   assert(Math.abs(after.logo.height-44)<=1);
   await page.screenshot({path:root+`/fixed-${width}-${nested?'preview':'public'}.png`});
   const portal=page.locator('[data-lp-fixed-header-portal]');
   if(width===375)await portal.locator('.lp-header-menu-toggle').click();
   const pricing=portal.locator('nav:visible a').filter({hasText:'Bảng giá'}).first();
   const target=(await pricing.getAttribute('href')).slice(1);await pricing.click();await page.waitForTimeout(650);
   const targetRect=await page.evaluate(id=>Array.from(document.querySelectorAll('[data-lp-renderer]:not([data-lp-fixed-header-portal]) [data-lp-block-id]')).find(e=>e.dataset.lpBlockId===id)?.getBoundingClientRect().toJSON(),target);
   assert(targetRect&&targetRect.top>=(nested?44:0)+(await measure()).header.height-2,'menu target is below fixed header: '+JSON.stringify(targetRect));
   assert.deepEqual(errors,[]);console.log('PASS fixed header',width,nested?'nested preview':'public',JSON.stringify({before,after}));count++;await page.close();
  }
  console.log('PASS fixed header QA:',count,'cases, viewport position fixed, spacer, logo, menu targets, nested scroll');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
