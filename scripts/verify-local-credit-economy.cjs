const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const dir=path.resolve(__dirname,'../tmp/credit-economy-20261122');
async function main(){
  const token=execFileSync('docker',['exec','-i','marketingspa-api','node'],{encoding:'utf8',stdio:['pipe','pipe','pipe'],input:`
    const {prisma}=require('@marketingspa/database'),{createHmac}=require('crypto');
    (async()=>{const u=await prisma.user.findFirstOrThrow({where:{isActive:true,deletedAt:null,role:{code:'SUPER_ADMIN'}},select:{id:true,email:true,organizationId:true}});
    const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');const data=enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:u.id,email:u.email,organizationId:u.organizationId,role:'SUPER_ADMIN',exp:Math.floor(Date.now()/1000)+300});
    process.stdout.write(data+'.'+createHmac('sha256',process.env.JWT_SECRET).update(data).digest('base64url'));})().finally(()=>prisma.$disconnect());
  `}).trim();
  const headers={Authorization:'Bearer '+token};
  const data=await (await fetch('http://localhost:8080/api/v1/billing/plans')).json(),plans=Array.isArray(data)?data:data.data;
  assert.equal(plans.length,9);
  for(const plan of plans){const expected=plan.code.includes('-basic-')?5000:plan.code.includes('-pro-')?15000:45000;
    assert.equal(plan.entitlement.monthlyCredits,expected);assert.equal(plan.creditsIncluded,expected);
  }
  const pro=plans.find(p=>p.code==='abg-pro-6m'),vip=plans.find(p=>p.code==='abg-vip-6m');
  assert.equal(Number(pro.priceVnd),4800000);assert.equal(pro.totalUsageMonths,7);assert.equal(vip.totalUsageMonths,7);
  const ratesResponse=await fetch('http://localhost:8080/api/v1/credits/pricing',{headers});assert.equal(ratesResponse.status,200);
  const rates=await ratesResponse.json();assert.equal(rates.length,14);
  assert.equal(rates.find(r=>r.featureCode==='email.send').creditCost,2);
  assert.equal(rates.find(r=>r.featureCode==='video.transcribe').creditCost,100);
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1536,height:1100}});
    await context.addInitScript(token=>{localStorage.setItem('ms_access_token',token);localStorage.setItem('maz.uiLocale','vi');},token);
    await context.route('**/*',route=>['GET','HEAD','OPTIONS'].includes(route.request().method())?route.continue():route.abort());
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://localhost:8080/pricing');
    for(const months of [1,6,12]){
      await page.getByRole('button',{name:months===12?'12 tháng · Tiết kiệm 2 tháng':`${months} tháng`,exact:true}).click();
      for(const [tier,credit]of [['Basic','5.000'],['Pro','15.000'],['VIP','45.000']]){
        const card=page.locator('#plans > div').filter({has:page.getByRole('heading',{name:`Ai Bee Go ${tier} — ${months} tháng`,exact:true})});
        await card.getByText(`${credit} credit AI mỗi tháng`,{exact:true}).waitFor({timeout:30000});
        if(months===6&&tier!=='Basic')await card.getByText('Mua 6 tháng tặng 1 tháng',{exact:true}).waitFor();
      }
      if(months===1)await page.locator('#plans').screenshot({path:path.join(dir,'pricing-new-credits-desktop.png')});
    }
    const header=page.locator('header').first();
    await header.getByText('Platform Super Admin',{exact:true}).waitFor();
    assert(!((await header.innerText()).includes('Nâng cấp gói Pro')));
    await page.goto('http://localhost:8080/credits');
    await page.getByRole('heading',{name:'Mức sử dụng AI credit',exact:true}).waitFor({timeout:30000});
    await page.getByRole('cell',{name:'Gửi email Marketing',exact:false}).waitFor();
    await page.getByRole('cell',{name:'Phiên âm video',exact:false}).waitFor();
    await page.screenshot({path:path.join(dir,'credits-rates-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Credits mobile overflow');
    await page.screenshot({path:path.join(dir,'credits-rates-mobile.png'),fullPage:false});
    assert.deepEqual(errors,[]);
    const report={target:'http://localhost:8080',plans:9,monthlyCredits:[5000,15000,45000],publicRateRows:14,
      proSixMonthPrice:4800000,sixMonthBonusPreserved:true,compactHeaderPreserved:true,desktopMobilePassed:true,paidProviderCalls:0,checkedAt:new Date().toISOString()};
    fs.writeFileSync(path.join(dir,'live-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
