const assert=require('node:assert/strict');const {chromium}=require('playwright');
const base=process.env.LP_FIXED_HEADER_BASE||'https://aibeego.com';const output='/var/www/aibeego_com_usr/fixed-header-20261118';
(async()=>{const b=await chromium.launch({executablePath:'/snap/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});try{let count=0;
 for(const slug of ['agency-portfolio-cream-editorial-sales-6','agency-portfolio-dark-direct-response-10'])for(const width of [1500,375]){
  const p=await b.newPage({viewport:{width,height:900}});const errors=[];p.on('pageerror',e=>errors.push(e.message));const r=await p.goto(base+'/p/'+slug,{waitUntil:'domcontentloaded',timeout:45000});assert(r.ok());
  const h=p.locator('[data-lp-fixed-header-portal] header');await h.waitFor();await p.waitForFunction(()=>{const h=document.querySelector('[data-lp-fixed-header-portal] header'),s=document.querySelector('[data-lp-fixed-header-placeholder]');return h&&s&&getComputedStyle(h).position==='fixed'&&Math.abs(h.offsetHeight-s.getBoundingClientRect().height)<1});
  await p.evaluate(()=>window.scrollTo(0,1200));await p.waitForFunction(()=>Math.abs(document.querySelector('[data-lp-fixed-header-portal] header').getBoundingClientRect().top)<1);
  const rect=await h.evaluate(e=>e.getBoundingClientRect().toJSON());assert(Math.abs(rect.width-width)<1);
  if(width===375){const toggle=h.locator('.lp-header-menu-toggle, .menu-toggle');await toggle.waitFor({state:'visible'});await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');await toggle.press('Escape');assert.equal(await toggle.getAttribute('aria-expanded'),'false')}
  await p.screenshot({path:output+'/production-'+slug+'-'+width+'.png'});assert.deepEqual(errors,[]);console.log('PASS production fixed header',slug,width,JSON.stringify(rect));count++;await p.close();
 }
 console.log('PASS production fixed header QA:',count,'published page cases');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
