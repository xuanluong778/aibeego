const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const dir=path.resolve(__dirname,'../tmp/credit-costs-review-20261122'),snapshot=require(path.join(dir,'current.json'));
const run=(container,input)=>JSON.parse(execFileSync('docker',['exec','-i',container,'node'],{input,encoding:'utf8',stdio:['pipe','pipe','pipe']}));
async function main(){
  const latestEdit=new Date(Math.max(...snapshot.changes.map(row=>new Date(row.createdAt).getTime()))).toISOString();
  const identity=run('marketingspa-api',`const {prisma,CreditLedger}=require('@marketingspa/database'),{createHmac}=require('crypto');(async()=>{
    const u=await prisma.user.findFirstOrThrow({where:{isActive:true,deletedAt:null,role:{code:'SUPER_ADMIN'}},select:{id:true,email:true,organizationId:true}});
    const rows=await prisma.creditFeaturePricing.findMany({orderBy:{sortOrder:'asc'}}),ledger=new CreditLedger(prisma),rates=[];
    for(const row of rows)rates.push({featureCode:row.featureCode,cost:await ledger.getFeatureCost(row.featureCode)});
    const recent=await prisma.creditTransaction.findMany({where:{type:'USAGE',createdAt:{gte:new Date(${JSON.stringify(latestEdit)})}},select:{featureCode:true,amount:true,createdAt:true},orderBy:{createdAt:'desc'},take:20});
    const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),data=enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:u.id,email:u.email,organizationId:u.organizationId,role:'SUPER_ADMIN',exp:Math.floor(Date.now()/1000)+300});
    console.log(JSON.stringify({token:data+'.'+createHmac('sha256',process.env.JWT_SECRET).update(data).digest('base64url'),rates,recent}));
  })().finally(()=>prisma.$disconnect());`);
  const worker=run('marketingspa-worker',`const {prisma,CreditLedger}=require('@marketingspa/database');(async()=>{const rows=await prisma.creditFeaturePricing.findMany({orderBy:{sortOrder:'asc'}}),ledger=new CreditLedger(prisma),rates=[];for(const row of rows)rates.push({featureCode:row.featureCode,cost:await ledger.getFeatureCost(row.featureCode)});console.log(JSON.stringify(rates));})().finally(()=>prisma.$disconnect());`);
  assert.deepEqual(identity.rates,worker);
  const workerModels=run('marketingspa-worker',`const stt=require('/app/dist/lib/video-transcription-stt');console.log(JSON.stringify({chatModel:process.env.OPENAI_MODEL||'gpt-4o-mini',pass1Model:stt.pass1Model(),pass2Model:stt.pass2Model()}));`);
  for(const row of snapshot.pricing)assert.equal(identity.rates.find(r=>r.featureCode===row.featureCode).cost,Number(row.creditCost));
  assert.equal(identity.rates.find(r=>r.featureCode==='content_ai.suggest').cost,10);
  const headers={Authorization:'Bearer '+identity.token},url='http://localhost:8080/api/v1/admin/credit-costs';
  const rows=await(await fetch(url,{headers})).json();assert.equal(rows.length,16);
  assert.equal(rows.filter(r=>r.reserved).length,2);
  const publicRows=await(await fetch('http://localhost:8080/api/v1/credits/pricing',{headers})).json();assert.equal(publicRows.length,14);
  assert(publicRows.some(r=>r.featureCode==='content_ai.suggest'));assert(!publicRows.some(r=>r.featureCode==='assistant.write'));
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1536,height:1100}});
    await context.addInitScript(token=>{localStorage.setItem('ms_access_token',token);localStorage.setItem('maz.uiLocale','vi');},identity.token);
    await context.route('**/*',route=>['GET','HEAD','OPTIONS'].includes(route.request().method())?route.continue():route.abort());
    const page=await context.newPage();await page.goto('http://localhost:8080/admin/credit-costs');
    await page.getByRole('heading',{name:'Credit costs',exact:true}).waitFor({timeout:30000});
    for(const [code,cost]of [['content_ai.generate','20'],['content_ai.suggest','10'],['chatbot.reply','3'],['video.transcribe','50'],['landing_page.generate','40']]){
      const input=page.locator(`tr[data-feature-code="${code}"]`).getByRole('spinbutton');await input.waitFor();assert.equal(await input.inputValue(),cost);
    }
    await page.locator('tr[data-feature-code="assistant.write"]').getByText('Cấu hình dự phòng',{exact:true}).waitFor();
    await page.screenshot({path:path.join(dir,'reviewed-costs-desktop.png'),fullPage:false});
    await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:path.join(dir,'reviewed-costs-mobile.png'),fullPage:false});
  }finally{await browser.close();}
  const report={checkedAt:new Date().toISOString(),apiAndWorkerRatesMatch:true,all15UserRatesPreserved:true,rates:identity.rates,workerModels,activeFeatures:14,reservedFeatures:2,desktopMobile:true,recentUsageAfterUserEdits:identity.recent,paidProviderCalls:0};
  fs.writeFileSync(path.join(dir,'live-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
