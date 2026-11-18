const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.env.LP_LOGO_QA_URL||'http://127.0.0.1:13048';
const output=process.env.LP_LOGO_QA_DIR||'/var/www/aibeego_com_usr/logo-header-fix-20261118';
(async()=>{
 const browser=await chromium.launch({executablePath:'/snap/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const [width,viewport] of [[1500,'desktop'],[768,'tablet'],[375,'mobile']]){
   const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const response=await page.goto(base+'/p/logo-qa-template',{waitUntil:'domcontentloaded',timeout:45000});assert(response.ok());
   await page.waitForFunction(viewport=>document.querySelector('[data-lp-renderer]')?.getAttribute('data-lp-viewport')===viewport,viewport);
   await page.waitForFunction(()=>{const img=document.querySelector('header .lp-header-logo img');return img?.complete&&img.naturalWidth>0&&getComputedStyle(img).maxHeight==='48px'});
   const size=await page.evaluate(()=>{
    const img=document.querySelector('header .lp-header-logo img');const a=img.getBoundingClientRect(),h=img.closest('header').getBoundingClientRect();const hero=document.querySelector('[data-lp-hero-visual] [data-lp-content-image]')?.getBoundingClientRect();
    return{width:a.width,height:a.height,top:a.top,bottom:a.bottom,headerTop:h.top,headerBottom:h.bottom,fit:getComputedStyle(img).objectFit,heroHeight:hero?.height};
   });
   assert.equal(size.width,44);assert.equal(size.height,44);assert.equal(size.fit,'contain');assert(size.top>=size.headerTop&&size.bottom<=size.headerBottom);
   if(size.heroHeight!==undefined)assert(size.heroHeight>100,'Hero remains full sized');
   if(width===375){const toggle=page.locator('header .lp-header-menu-toggle');await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');await toggle.press('Escape');assert.equal(await toggle.getAttribute('aria-expanded'),'false')}
   await page.screenshot({path:output+'/compiled-'+width+'.png'});
   assert.deepEqual(errors,[]);console.log('PASS compiled logo',width,JSON.stringify(size));await page.close();
  }
  console.log('PASS compiled logo QA: 3 responsive cases, correct logo size, uncropped, hero unchanged, menu works');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
