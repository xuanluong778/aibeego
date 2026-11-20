// Real Publish dialog and CSS in Chromium; fixture API only, no production app/data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),qa=path.join(root,'.platform-subdomain-qa'),web=path.join(root,'apps/web');fs.mkdirSync(qa,{recursive:true});
const esbuild=require(path.join(root,'node_modules/.pnpm',fs.readdirSync(path.join(root,'node_modules/.pnpm')).find(x=>x.startsWith('esbuild@')),'node_modules/esbuild'));
const entry=`import React,{useState}from'react';import{createRoot}from'react-dom/client';import{LandingPagePublishDialog}from'../apps/web/src/components/landing-pages/landing-page-publish-dialog';import{apiClient}from'../apps/web/src/lib/api-client';function App(){const[open,setOpen]=useState(true),[publishing,setPublishing]=useState(false),[url,setUrl]=useState('https://old-page.aibeego.com/');return <><button onClick={()=>setOpen(true)}>Mở Publish</button><a data-public-url href={url}>{url}</a><LandingPagePublishDialog open={open} pageId="qa-page" publishing={publishing} onOpenChange={setOpen} onPublish={async selection=>{setPublishing(true);try{const result=await apiClient<{publicUrl:string}>('/landing-pages/qa-page/publish',{method:'POST',body:JSON.stringify(selection)});setUrl(result.publicUrl)}finally{setPublishing(false)}}}/></>};createRoot(document.getElementById('root')!).render(<App/>);`;
let enabled=true,current=null,optionsFail=false,publishRace=false,submitted=[],passed=0,failed=0;
function pass(name){passed++;console.log('PASS',name)}
async function main(){
 fs.writeFileSync(path.join(qa,'publish-entry.tsx'),entry);
 const css=fs.readFileSync(path.join(web,'src/app/globals.css'),'utf8').replace(/^@import[^\n]*\n/gm,'');fs.writeFileSync(path.join(qa,'publish-input.css'),'@tailwind base;\n@tailwind components;\n@tailwind utilities;\n'+css);
 execFileSync(path.join(web,'node_modules/.bin/tailwindcss'),['-c',path.join(web,'tailwind.config.ts'),'-i',path.join(qa,'publish-input.css'),'-o',path.join(qa,'publish.css'),'--content','apps/web/src/components/landing-pages/landing-page-publish-dialog.tsx,apps/web/src/components/ui/*tsx','--minify'],{cwd:root,stdio:'pipe'});
 await esbuild.build({entryPoints:[path.join(qa,'publish-entry.tsx')],outfile:path.join(qa,'publish.js'),bundle:true,platform:'browser',jsx:'automatic',alias:{'@':path.join(web,'src')},nodePaths:[path.join(web,'node_modules')],define:{'process.env':'{}','process.env.NODE_ENV':'"production"'},logLevel:'warning'});
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://qa');
  if(url.pathname==='/publish.js'){res.setHeader('Content-Type','application/javascript');res.end(fs.readFileSync(path.join(qa,'publish.js')));return}
  if(url.pathname==='/publish.css'){res.setHeader('Content-Type','text/css');res.end(fs.readFileSync(path.join(qa,'publish.css')));return}
  if(url.pathname.includes('/api/v1/')){
   res.setHeader('Content-Type','application/json');
   if(url.pathname.endsWith('/publication-options')){if(optionsFail){res.statusCode=503;res.end(JSON.stringify({message:'Không tải được lựa chọn xuất bản.'}));return}res.end(JSON.stringify({enabled,baseDomain:'aibeego.com',current,suggestedLabel:current?.label||'my-page',pathUrl:'/p/my-page'}));return}
   if(url.pathname.endsWith('/subdomain-availability')){
    const label=url.searchParams.get('label'),reserved=label==='admin',available=!reserved&&!['taken-name','slow-taken'].includes(label);
    const body={available,label,hostname:label+'.aibeego.com',message:reserved?'Tên này dành riêng cho hệ thống. Hãy chọn tên khác.':available?'Bạn có thể sử dụng địa chỉ này.':'Tên này đã được sử dụng. Hãy chọn tên khác.'};
    setTimeout(()=>res.end(JSON.stringify(body)),label==='slow-taken'?1000:25);return;
   }
   if(req.method==='POST'&&url.pathname.endsWith('/publish')){let body='';req.on('data',chunk=>body+=chunk);req.on('end',()=>{
    const selection=JSON.parse(body);submitted.push(selection);if(publishRace){res.statusCode=409;res.end(JSON.stringify({code:'SUBDOMAIN_TAKEN',message:'Tên này vừa được sử dụng. Hãy chọn subdomain khác.'}));return}
    res.end(JSON.stringify({publicUrl:selection.publicationTarget==='subdomain'?'https://'+selection.subdomainSlug+'.aibeego.com/':'/p/my-page'}));
   });return}
   res.statusCode=404;res.end('{}');return;
  }
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/publish.css"></head><body style="margin:0;background:#0a3d30;color:white;font:14px Arial"><div id="root"></div><script src="/publish.js"></script></body></html>');
 });await new Promise(r=>server.listen(19601,'127.0.0.1',r));
 let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.LP_QA_CHROME||'/snap/chromium/current/usr/lib/chromium-browser/chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>localStorage.setItem('ms_access_token','qa.'+btoa(JSON.stringify({exp:Date.now()/1000+3600}))+'.qa'));
  const open=async()=>{await page.goto('http://127.0.0.1:19601/');await page.getByRole('dialog').waitFor()};
  const confirm=()=>page.locator('[data-lp-confirm-publish]');
  await open();await page.waitForFunction(()=>document.querySelector('[data-lp-confirm-publish]')?.disabled===false);
  assert.equal(await page.getByRole('radio',{name:/Subdomain miễn phí/}).isChecked(),true);assert.equal(await page.getByLabel('Tên subdomain',{exact:true}).inputValue(),'my-page');pass('Publish opens free-subdomain selection with suggested name and URL suffix');
  await page.getByLabel('Tên subdomain',{exact:true}).fill('taken-name');await page.getByText('Tên này đã được sử dụng. Hãy chọn tên khác.',{exact:true}).waitFor();assert.equal(await confirm().isDisabled(),true);pass('Taken name blocks publication');
  await page.getByLabel('Tên subdomain',{exact:true}).fill('admin');await page.getByText('Tên này dành riêng cho hệ thống. Hãy chọn tên khác.',{exact:true}).waitFor();assert.equal(await confirm().isDisabled(),true);pass('Reserved infrastructure name blocks publication');
  for(const invalid of ['ab','name.with-dot','đẹp','-bad']){await page.getByLabel('Tên subdomain',{exact:true}).fill(invalid);assert.equal(await confirm().isDisabled(),true)}pass('Invalid labels cannot be submitted');
  await page.getByLabel('Tên subdomain',{exact:true}).fill('slow-taken');await page.waitForTimeout(420);await page.getByLabel('Tên subdomain',{exact:true}).fill('open-name');await page.waitForFunction(()=>document.querySelector('[data-lp-confirm-publish]')?.disabled===false);await page.waitForTimeout(1100);assert.equal(await confirm().isEnabled(),true);pass('Out-of-order availability responses never overwrite the latest name');
  await page.screenshot({path:path.join(qa,'publish-desktop.png')});
  for(const width of [360,390,768]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>{const d=document.querySelector('[role="dialog"]');const r=d.getBoundingClientRect();return document.documentElement.scrollWidth>innerWidth||d.scrollWidth>d.clientWidth||r.left<0||r.right>innerWidth}),false,`Overflow at ${width}px`)}
  await page.setViewportSize({width:390,height:900});await page.screenshot({path:path.join(qa,'publish-mobile.png')});pass('Publish dialog fits desktop, tablet and mobile');
  await confirm().click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.deepEqual(submitted.at(-1),{publicationTarget:'subdomain',subdomainSlug:'open-name'});assert.equal(await page.locator('[data-public-url]').getAttribute('href'),'https://open-name.aibeego.com/');pass('Confirm submits selected label once and opens the correct public destination');
  publishRace=true;await open();await page.waitForFunction(()=>document.querySelector('[data-lp-confirm-publish]')?.disabled===false);await confirm().click();await page.getByRole('alert').waitFor();assert.match(await page.getByRole('alert').innerText(),/vừa được sử dụng/);assert.equal(await page.getByRole('dialog').isVisible(),true);assert.equal(await page.locator('[data-public-url]').getAttribute('href'),'https://old-page.aibeego.com/');pass('Server race error stays in the dialog and preserves the previously published URL');
  publishRace=false;current={label:'old-label',hostname:'old-label.aibeego.com',url:'https://old-label.aibeego.com/'};await open();await page.getByLabel('Tên subdomain',{exact:true}).fill('new-label');await page.getByText(/địa chỉ cũ old-label.aibeego.com/).waitFor();await page.getByRole('radio',{name:/Liên kết hiện có/}).check();await page.getByText(/sẽ tháo subdomain old-label.aibeego.com/).waitFor();await confirm().click();assert.deepEqual(submitted.at(-1),{publicationTarget:'path'});pass('Rename and path-only choices explain removal and never submit an orphan label');
  enabled=false;current=null;await open();await page.getByText(/Địa chỉ miễn phí chưa sẵn sàng/).waitFor();assert.equal(await page.getByRole('radio',{name:/Subdomain miễn phí/}).isDisabled(),true);assert.equal(await page.getByRole('radio',{name:/Liên kết hiện có/}).isChecked(),true);await confirm().click();assert.deepEqual(submitted.at(-1),{publicationTarget:'path'});pass('Unavailable infrastructure keeps the existing publish flow working');
  optionsFail=true;await open();await page.getByRole('alert').waitFor();assert.equal(await confirm().isDisabled(),true);pass('Options API failure does not allow a blind publication');
  assert.deepEqual(errors,[]);pass('No browser runtime errors');
 }finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
 console.log(`PUBLISH UI RESULT ${passed} passed, ${failed} failed`);
}
main().catch(error=>{console.error(error);process.exitCode=1});
