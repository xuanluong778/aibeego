const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const {buildPlanCatalog}=require('../packages/shared/dist/subscription-catalog');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'tmp/local-subscription-release-20261122');
const run=args=>execFileSync('docker',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
async function main(){
  const health=await fetch('http://localhost:8080/api/v1/health');assert.equal(health.status,200);
  const response=await fetch('http://localhost:8080/api/v1/billing/plans');assert.equal(response.status,200);
  const body=await response.json(),plans=Array.isArray(body)?body:body.data;
  assert.equal(plans.length,9);
  for(const expected of buildPlanCatalog()){
    const actual=plans.find(plan=>plan.code===expected.code);assert(actual,expected.code);
    assert.equal(Number(actual.priceVnd),expected.priceVnd);assert.equal(actual.durationMonths,expected.durationMonths);
    assert(actual.entitlement?.tier);assert.equal(actual.entitlement.monthlyCredits,expected.creditsIncluded);
  }
  // Token is created and used only in memory for read-only verification. No credentials are logged.
  const identity=JSON.parse(run(['exec','marketingspa-api','node','-e',`const {prisma}=require('@marketingspa/database');const{createHmac}=require('crypto');(async()=>{const u=await prisma.user.findFirst({where:{isActive:true,deletedAt:null,role:{code:'OWNER'},organization:{subscriptions:{some:{status:'ACTIVE',currentPeriodEnd:{gt:new Date()},plan:{code:{startsWith:'msp-pro-'}}}}}},select:{id:true,email:true,organizationId:true,uiLocale:true}});if(!u)throw Error('No active legacy owner for read-only verification');const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');const head=enc({alg:'HS256',typ:'JWT'});const payload=enc({sub:u.id,email:u.email,organizationId:u.organizationId,role:'OWNER',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+900});const input=head+'.'+payload;console.log(JSON.stringify({token:input+'.'+createHmac('sha256',process.env.JWT_SECRET).update(input).digest('base64url'),locale:u.uiLocale||'vi'}));})().finally(()=>prisma.$disconnect());`]));
  const subscriptionResponse=await fetch('http://localhost:8080/api/v1/billing/subscription',{headers:{Authorization:`Bearer ${identity.token}`}});assert.equal(subscriptionResponse.status,200);
  const entitlementResponse=await fetch('http://localhost:8080/api/v1/billing/entitlements',{headers:{Authorization:`Bearer ${identity.token}`}});assert.equal(entitlementResponse.status,200);
  const entBody=await entitlementResponse.json(),entitlement=entBody.data??entBody;assert.equal(entitlement.legacy,true);
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1536,height:1000},locale:'vi-VN'});
    await context.addInitScript(({token,locale})=>{localStorage.setItem('ms_access_token',token);localStorage.setItem('maz.uiLocale',locale);},identity);
    await context.route('**/*',route=>{if(!['GET','HEAD','OPTIONS'].includes(route.request().method()))return route.abort();return route.continue();});
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://localhost:8080/pricing');
    await page.getByRole('heading',{name:'Ai Bee Go Basic — 1 tháng',exact:true}).waitFor({timeout:45000});
    for(const months of [1,6,12]){
      await page.getByRole('button',{name:months===12?'12 tháng · Tiết kiệm 2 tháng':`${months} tháng`,exact:true}).click();
      for(const tier of ['Basic','Pro','VIP'])await page.getByRole('heading',{name:`Ai Bee Go ${tier} — ${months} tháng`,exact:true}).waitFor();
      assert.equal(await page.locator('#plans > div').count(),3);
      await page.locator('#plans').screenshot({path:path.join(dir,`live-pricing-${months}m.png`)});
    }
    await page.setViewportSize({width:390,height:844});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile page overflow');
    await page.locator('#plans').screenshot({path:path.join(dir,'live-pricing-mobile.png')});
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
  const result={target:'http://localhost:8080',health:'ok',plans:9,terms:[1,6,12],legacyRightsPreserved:true,liveBrowser:'desktop/mobile passed',checkedAt:new Date().toISOString()};
  fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
