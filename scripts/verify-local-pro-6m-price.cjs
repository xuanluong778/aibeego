const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {chromium} = require('playwright');
async function main() {
  const catalog = require('../packages/shared/dist').buildPlanCatalog();
  assert.equal(catalog.find(p => p.code === 'abg-pro-6m').priceVnd, 4800000);
  const identity = JSON.parse(execFileSync('docker', ['exec', '-i', 'marketingspa-api', 'node'], {
    encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], input: `
    require('reflect-metadata');
    const {prisma}=require('@marketingspa/database');
    const {BillingService}=require('/app/dist/billing/billing.service');
    const {createHmac}=require('node:crypto');
    (async()=>{
      const plan=await prisma.subscriptionPlan.findUniqueOrThrow({where:{code:'abg-pro-6m'}});
      // Actual checkout logic with fixture order persistence: no real orders created/cancelled.
      const fixture={subscriptionPlan:{findFirst:async()=>plan},paymentOrder:{
        updateMany:async()=>({count:0}),findUnique:async()=>null,
        create:async({data})=>({...data,id:'fixture',plan,createdAt:new Date(),updatedAt:new Date()})}};
      const billing=new BillingService(fixture,{get:()=>undefined},{log:async()=>{}},{},{},{});
      billing.generateUniqueOrderCode=async()=>'FIXTUREPRICE';
      const order=await billing.createOrder('fixture-org','fixture-user',plan.code);
      if(order.amountVnd!==4800000||new URL(order.qrUrl).searchParams.get('amount')!=='4800000')throw Error('Wrong checkout/QR amount');
      if(order.plan.bonusMonths!==1||order.plan.totalUsageMonths!==7)throw Error('Missing bonus in checkout');
      const user=await prisma.user.findFirstOrThrow({where:{isActive:true,deletedAt:null,role:{code:'SUPER_ADMIN'}},select:{id:true,email:true,organizationId:true}});
      const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
      const data=enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:user.id,email:user.email,organizationId:user.organizationId,role:'SUPER_ADMIN',exp:Math.floor(Date.now()/1000)+180});
      const token=data+'.'+createHmac('sha256',process.env.JWT_SECRET).update(data).digest('base64url');
      console.log(JSON.stringify({token,checkout:order.amountVnd,qrAmount:4800000}));
    })().finally(()=>prisma.$disconnect());`,
  }));
  const response = await fetch('http://localhost:8080/api/v1/billing/plans');
  assert.equal(response.status, 200);
  const body = await response.json(), plans = Array.isArray(body) ? body : body.data;
  const pro = plans.find(p => p.code === 'abg-pro-6m');
  assert.equal(Number(pro.priceVnd), 4800000);
  assert.equal(pro.durationMonths, 6);
  assert.equal(pro.creditsIncluded, 1500);
  const vip = plans.find(p => p.code === 'abg-vip-6m');
  assert.equal(Number(vip.priceVnd), 10794000);
  for (const plan of [pro, vip]) {
    assert.equal(plan.bonusMonths, 1);
    assert.equal(plan.totalUsageMonths, 7);
  }
  assert.equal(plans.find(p => p.code === 'abg-basic-6m').bonusMonths, 0);
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    const context = await browser.newContext({viewport:{width:1536,height:1100}});
    await context.addInitScript(token => {
      localStorage.setItem('ms_access_token', token);
      localStorage.setItem('maz.uiLocale', 'vi');
    }, identity.token);
    await context.route('**/*', route => ['GET','HEAD','OPTIONS'].includes(route.request().method()) ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto('http://localhost:8080/pricing');
    await page.getByRole('button',{name:'6 tháng',exact:true}).click();
    const card = page.locator('#plans > div').filter({has:page.getByRole('heading',{name:'Ai Bee Go Pro — 6 tháng',exact:true})});
    await card.getByText('4.800.000 ₫',{exact:true}).waitFor({timeout:30000});
    await card.getByText('Mua 6 tháng tặng 1 tháng',{exact:true}).waitFor();
    await card.getByText('6 tháng + tặng 1 tháng · Tổng 7 tháng sử dụng',{exact:true}).waitFor();
    const vipCard = page.locator('#plans > div').filter({has:page.getByRole('heading',{name:'Ai Bee Go VIP — 6 tháng',exact:true})});
    await vipCard.getByText('Mua 6 tháng tặng 1 tháng',{exact:true}).waitFor();
    await vipCard.getByText('10.794.000 ₫',{exact:true}).waitFor();
    const dir = path.resolve(__dirname,'../tmp/six-month-bonus-20261122');
    await page.locator('#plans').screenshot({path:path.join(dir,'six-month-bonus-desktop.png')});
    await page.setViewportSize({width:390,height:844});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile overflow');
    await card.screenshot({path:path.join(dir,'pro-six-month-bonus-mobile.png')});
    const report={priceVnd:4800000,months:6,bonusMonths:1,totalUsageMonths:7,vipPriceVnd:10794000,monthlyCredits:1500,checkout:identity.checkout,qrAmount:identity.qrAmount,browserVerified:true};
    fs.writeFileSync(path.join(dir,'verification.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report));
  } finally { await browser.close(); }
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
