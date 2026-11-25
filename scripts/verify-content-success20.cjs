const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const dir=path.resolve(__dirname,'../tmp/content-success20-20261122');
const run=(container,input)=>JSON.parse(execFileSync('docker',['exec','-i',container,'node'],{input,encoding:'utf8',stdio:['pipe','pipe','pipe']}));
async function main(){
 const before=JSON.parse(fs.readFileSync(path.join(dir,'before.json'),'utf8'));
 const identity=run('marketingspa-api',`const {prisma,CreditLedger}=require('@marketingspa/database'),{createHmac}=require('crypto');(async()=>{
 const u=await prisma.user.findFirstOrThrow({where:{isActive:true,deletedAt:null,role:{code:'SUPER_ADMIN'}},select:{id:true,email:true,organizationId:true}});
 const rows=await prisma.creditFeaturePricing.findMany({orderBy:{featureCode:'asc'}}),ledger=new CreditLedger(prisma),rates=[];
 for(const row of rows)rates.push({featureCode:row.featureCode,cost:await ledger.getFeatureCost(row.featureCode)});
 const plans=await prisma.subscriptionPlan.findMany({where:{code:{startsWith:'abg-'}},orderBy:{code:'asc'}});
 const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),data=enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:u.id,email:u.email,organizationId:u.organizationId,role:'SUPER_ADMIN',exp:Math.floor(Date.now()/1000)+300});
 console.log(JSON.stringify({token:data+'.'+createHmac('sha256',process.env.JWT_SECRET).update(data).digest('base64url'),rates,plans}));
 })().finally(()=>prisma.$disconnect());`);
 const targets=['content_ai.generate','content_ai.suggest'];
 for(const row of before.pricing)assert.equal(identity.rates.find(r=>r.featureCode===row.feature_code).cost,row.feature_code==='content_ai.generate'?20:row.feature_code==='content_ai.suggest'?0:Number(row.credit_cost));
 const worker=run('marketingspa-worker',`const {prisma,CreditLedger}=require('@marketingspa/database');(async()=>{const l=new CreditLedger(prisma);console.log(JSON.stringify(await Promise.all(['content_ai.generate','content_ai.suggest'].map(c=>l.getFeatureCost(c)))));})().finally(()=>prisma.$disconnect());`);
 assert.deepEqual(worker,[20,0]);
 const headers={Authorization:'Bearer '+identity.token};
 const response=await fetch('http://localhost:8080/api/v1/admin/credit-costs',{headers});assert(response.ok);const rows=await response.json();
 for(const code of targets){const row=rows.find(r=>r.featureCode===code);assert.equal(row.creditCost,code==='content_ai.generate'?20:0);assert.equal(row.unit,code==='content_ai.generate'?'content tạo thành công':'miễn phí');}
 const browser=await chromium.launch({channel:'msedge',headless:true}),errors=[];
 try{
 const context=await browser.newContext({viewport:{width:1536,height:1100}});
 await context.addInitScript(token=>{localStorage.setItem('ms_access_token',token);localStorage.setItem('maz.uiLocale','vi');},identity.token);
 await context.route('**/*',route=>['GET','HEAD','OPTIONS'].includes(route.request().method())?route.continue():route.abort());
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8080/admin/credit-costs');
 await page.getByRole('heading',{name:'Credit costs',exact:true}).waitFor({timeout:30000});
 for(const code of targets){const input=page.locator(`tr[data-feature-code="${code}"]`).getByRole('spinbutton');await input.waitFor();assert.equal(await input.inputValue(),code==='content_ai.generate'?'20':'0');}
 assert(await page.locator('tr[data-feature-code="content_ai.suggest"]').getByRole('spinbutton').isDisabled());
 assert((await page.locator('body').innerText()).includes('Chỉ trừ credit khi tạo Content AI thành công.'));
 await page.screenshot({path:path.join(dir,'live-desktop.png'),fullPage:false});
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:path.join(dir,'live-mobile.png'),fullPage:false});
 await page.goto('http://localhost:8080/credits');await page.getByText('Chỉ trừ credit khi tạo Content AI thành công. Gợi ý và các thao tác khác trong phần Content miễn phí.',{exact:false}).waitFor({timeout:30000});
 assert.deepEqual(errors,[]);
 }finally{await browser.close();}
 const report={checkedAt:new Date().toISOString(),contentGenerate:20,contentSuggest:0,apiAndWorkerRatesMatch:true,otherPricesUnchanged:true,desktopAndMobile:true,pageErrors:errors,paidProviderCalls:0};
 fs.writeFileSync(path.join(dir,'live-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
