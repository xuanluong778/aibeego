// Real Nest controller/validation/admin guard/service/audit with an isolated QA DB.
const assert=require('node:assert/strict'),fs=require('node:fs');
const req=require('node:module').createRequire('/app/package.json');
process.env.DATABASE_URL='postgresql://planqa:planqa-local-only@subscription-postgres:5432/plan_tiers_qa_v2?schema=public';
req('reflect-metadata');
const {Module,ValidationPipe,UnauthorizedException}=req('@nestjs/common'),{NestFactory}=req('@nestjs/core');
const {prisma:db,CreditLedger,creditCallContext}=req('@marketingspa/database');
const {CREDIT_PRICING,buildPlanCatalog,billingAnniversary}=req('@marketingspa/shared');
const {CreditCostsAdminController:Controller}=req('/app/dist/platform-admin/credit-costs-admin.controller');
const {CreditCostsAdminService:Service}=req('/app/dist/platform-admin/credit-costs-admin.service');
const {PlatformAdminGuard}=req('/app/dist/common/guards/platform-admin.guard');
const {AuditService}=req('/app/dist/audit/audit.service');
const {CreditService}=req('/app/dist/credit/credit.service');
const {OpenAiService}=req('/app/dist/openai/openai.service');
async function main(){
  const stamp=Date.now(),org=await db.organization.create({data:{name:'Credit costs admin QA',slug:`admin-cost-${stamp}`}});
  const role=await db.role.create({data:{organizationId:org.id,code:'SUPER_ADMIN',name:'Super admin'}});
  const actor=await db.user.create({data:{organizationId:org.id,roleId:role.id,name:'Fixture admin',email:`cost-${stamp}@example.invalid`}});
  const user={id:actor.id,organizationId:org.id,role:'SUPER_ADMIN',email:actor.email};
  for(const plan of buildPlanCatalog())await db.subscriptionPlan.upsert({where:{code:plan.code},create:plan,update:plan});
  for(const row of CREDIT_PRICING)await db.creditFeaturePricing.upsert({where:{featureCode:row.featureCode},create:{...row,isActive:true},update:{...row,isActive:true}});
  const plan=await db.subscriptionPlan.findUniqueOrThrow({where:{code:'abg-pro-1m'}}),start=new Date();
  await db.subscription.create({data:{organizationId:org.id,planId:plan.id,status:'ACTIVE',currentPeriodStart:start,currentPeriodEnd:billingAnniversary(start,1)}});
  assert(Reflect.getMetadata('__guards__',Controller).includes(PlatformAdminGuard));
  class FixtureAuth{canActivate(ctx){if(!ctx.switchToHttp().getRequest().user)throw new UnauthorizedException();return true;}}
  Reflect.defineMetadata('__guards__',[FixtureAuth,PlatformAdminGuard],Controller);
  const service=new Service(db,new AuditService(db));
  class FixtureModule{};Module({controllers:[Controller],providers:[{provide:Service,useValue:service}]})(FixtureModule);
  const app=await NestFactory.create(FixtureModule,{logger:false});app.setGlobalPrefix('api/v1');app.useGlobalPipes(new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true}));
  app.use((request,response,next)=>{const role=request.headers['x-fixture-role'];if(role)request.user={...user,role};next();});
  await app.listen(0,'127.0.0.1');const url=(await app.getUrl())+'/api/v1/admin/credit-costs';
  const send=async(method,code,body,role='SUPER_ADMIN')=>{const response=await fetch(url+(code?'/'+encodeURIComponent(code):''),{method,headers:{...(role?{'x-fixture-role':role}:{}),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};};
  try{
    assert.equal((await send('GET',null,null,null)).status,401);
    assert.equal((await send('GET',null,null,'OWNER')).status,403);
    assert.equal((await send('PATCH','content_ai.generate',{creditCost:47,expectedUpdatedAt:new Date().toISOString()},'OWNER')).status,403);
    const listed=await send('GET');assert.equal(listed.status,200);assert.equal(listed.data.length,CREDIT_PRICING.length);
    let row=listed.data.find(row=>row.featureCode==='content_ai.generate');
    assert.equal(row.module,'content_ai');assert.equal(row.action,'generate');assert.equal(row.unit,'lượt AI cơ bản');
    for(const value of [0,-1,1.5,1000001,'bad',null])assert.equal((await send('PATCH',row.featureCode,{creditCost:value,expectedUpdatedAt:row.updatedAt})).status,400);
    assert.equal((await send('PATCH',row.featureCode,{creditCost:47,expectedUpdatedAt:'bad'})).status,400);
    assert.equal((await send('PATCH',row.featureCode,{creditCost:47,expectedUpdatedAt:row.updatedAt,isActive:false})).status,400);
    const patched=await send('PATCH',row.featureCode,{creditCost:47,expectedUpdatedAt:row.updatedAt});assert.equal(patched.status,200);assert.equal(patched.data.creditCost,47);
    const ledger=new CreditLedger(db);assert.equal(await ledger.getFeatureCost(row.featureCode),47);
    const ai=new OpenAiService({get:key=>({OPENAI_API_KEY:'fixture',OPENAI_MODEL:'gpt-4o-mini'}[key])},new CreditService(db));
    const originalFetch=global.fetch;
    const before=await ledger.getBalance(org.id);
    global.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:'fixture'}}]}));
    try{await creditCallContext.run({organizationId:org.id,featureCode:row.featureCode,referenceId:`admin-priced:${stamp}`},()=>ai.chatCompletion({messages:[{role:'user',content:'fixture'}],maxTokens:100}));}finally{global.fetch=originalFetch;}
    assert.equal(before.balance-(await ledger.getBalance(org.id)).balance,47,'Real API provider gateway immediately uses saved price');
    const log=await db.auditLog.findFirstOrThrow({where:{entityId:row.id,action:'PLATFORM_CREDIT_COST_UPDATED',userId:actor.id}});assert.equal(log.metadata.before,40);assert.equal(log.metadata.after,47);
    assert.equal((await send('PATCH',row.featureCode,{creditCost:48,expectedUpdatedAt:row.updatedAt})).status,409);
    row=(await send('GET')).data.find(r=>r.featureCode===row.featureCode);assert.equal(row.usedCredits30d>=47,true);assert.equal(row.chargedCalls30d>=1,true);
    const concurrent=await Promise.all([51,52].map(creditCost=>send('PATCH',row.featureCode,{creditCost,expectedUpdatedAt:row.updatedAt})));
    assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
    row=(await send('GET')).data.find(r=>r.featureCode===row.featureCode);
    const failing=new Service(db,{log:async()=>{throw Error('audit unavailable');}});
    await assert.rejects(failing.update(user,row.featureCode,{creditCost:99,expectedUpdatedAt:row.updatedAt}));
    assert.equal(await ledger.getFeatureCost(row.featureCode),row.creditCost,'Audit and price update roll back together');
    assert.equal((await send('PATCH','unknown.action',{creditCost:10,expectedUpdatedAt:row.updatedAt})).status,404);
    assert.equal((await send('GET')).data.find(r=>r.featureCode==='chatbot.reply').creditCost,6,'Other prices unchanged');
    fs.writeFileSync('/fixtures/worker-readback.json',JSON.stringify({organizationId:org.id,featureCode:row.featureCode,creditCost:row.creditCost}));
    const report={passed:true,rows:CREDIT_PRICING.length,unauthenticated:401,nonAdmin:403,invalidInput:400,staleWrite:409,auditAtomic:true,actualGatewayUsesSavedPrice:47,concurrentLostUpdateBlocked:true};
    fs.writeFileSync('/fixtures/api-test-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  }finally{await app.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>db.$disconnect());
