const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const dir=path.resolve(__dirname,'../tmp/admin-credit-costs-20261122');
async function main(){
  const token=execFileSync('docker',['exec','-i','marketingspa-api','node'],{encoding:'utf8',stdio:['pipe','pipe','pipe'],input:`
    const {prisma}=require('@marketingspa/database'),{createHmac}=require('crypto');
    (async()=>{const u=await prisma.user.findFirstOrThrow({where:{isActive:true,deletedAt:null,role:{code:'SUPER_ADMIN'}},select:{id:true,email:true,organizationId:true}});
    const enc=v=>Buffer.from(JSON.stringify(v)).toString('base64url');const data=enc({alg:'HS256',typ:'JWT'})+'.'+enc({sub:u.id,email:u.email,organizationId:u.organizationId,role:'SUPER_ADMIN',exp:Math.floor(Date.now()/1000)+300});
    process.stdout.write(data+'.'+createHmac('sha256',process.env.JWT_SECRET).update(data).digest('base64url'));})().finally(()=>prisma.$disconnect());
  `}).trim();
  const endpoint='http://localhost:8080/api/v1/admin/credit-costs',headers={Authorization:'Bearer '+token};
  assert.equal((await fetch(endpoint)).status,401);
  const response=await fetch(endpoint,{headers});assert.equal(response.status,200);
  const rows=await response.json();assert(rows.length>=15);
  const original=rows.find(r=>r.featureCode==='content_ai.generate').creditCost;
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1536,height:1100}});
    await context.addInitScript(token=>{localStorage.setItem('ms_access_token',token);localStorage.setItem('maz.uiLocale','vi');},token);
    let patches=0;
    // Exercise the save UI with fixture responses; never change live billing prices.
    const handler=async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.pathname.startsWith('/api/v1/admin/credit-costs')){
        if(request.method()==='PATCH'){
          patches++;const code=decodeURIComponent(url.pathname.split('/').at(-1)),body=request.postDataJSON(),row=rows.find(r=>r.featureCode===code);
          row.creditCost=body.creditCost;row.updatedAt=new Date().toISOString();
          return route.fulfill({status:200,json:{featureCode:code,creditCost:row.creditCost,updatedAt:row.updatedAt}});
        }
        return route.fulfill({status:200,json:rows});
      }
      if(!['GET','HEAD','OPTIONS'].includes(request.method()))return route.abort();
      return route.continue();
    };
    await context.route('**/*',handler);
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://localhost:8080/admin');
    await page.getByRole('link',{name:'Credit costs',exact:true}).click();
    await page.getByRole('heading',{name:'Credit costs',exact:true}).waitFor({timeout:30000});
    const search=page.getByRole('textbox',{name:'Tìm Credit costs',exact:true});
    await search.fill('Phiên âm');assert.equal(await page.locator('tr[data-feature-code]').count(),1);
    await search.fill('');assert.equal(await page.locator('tr[data-feature-code]').count(),rows.length);
    const row=page.locator('tr[data-feature-code="content_ai.generate"]'),input=row.getByRole('spinbutton'),save=row.getByRole('button',{name:'Lưu',exact:true});
    assert(await save.isDisabled());await input.fill('0');assert(await save.isDisabled());assert.equal(await input.getAttribute('aria-invalid'),'true');
    await input.fill(String(original+8));assert(await save.isEnabled());await save.click();
    await row.getByText('Đã lưu',{exact:true}).waitFor();assert.equal(patches,1);
    await row.getByRole('spinbutton').waitFor();assert.equal(await row.getByRole('spinbutton').inputValue(),String(original+8));
    await context.unroute('**/*',handler);
    await context.route('**/*',route=>['GET','HEAD','OPTIONS'].includes(route.request().method())?route.continue():route.abort());
    await page.reload();await page.locator('tr[data-feature-code="content_ai.generate"]').getByRole('spinbutton').waitFor();
    assert.equal(await page.locator('tr[data-feature-code="content_ai.generate"]').getByRole('spinbutton').inputValue(),String(original));
    await page.screenshot({path:path.join(dir,'live-desktop.png'),fullPage:false});
    await page.setViewportSize({width:390,height:844});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Mobile document overflow');
    await page.screenshot({path:path.join(dir,'live-mobile.png'),fullPage:false});
    assert.deepEqual(errors,[]);
    const actual=await(await fetch(endpoint,{headers})).json();assert.equal(actual.find(r=>r.featureCode==='content_ai.generate').creditCost,original);
    const report={target:'http://localhost:8080/admin/credit-costs',rows:rows.length,adminMenu:true,search:true,inputValidation:true,saveUiFixturePassed:true,desktopMobile:true,livePricesUnchanged:true,checkedAt:new Date().toISOString()};
    fs.writeFileSync(path.join(dir,'live-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
