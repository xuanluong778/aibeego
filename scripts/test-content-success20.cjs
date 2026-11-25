const assert=require('node:assert/strict'),fs=require('fs'),req=require('node:module').createRequire('/app/package.json');
process.env.DATABASE_URL='postgresql://planqa:planqa-local-only@subscription-postgres:5432/plan_tiers_qa_v2?schema=public';req('reflect-metadata');
const {prisma:db,CreditLedger}=req('@marketingspa/database'),{buildPlanCatalog,billingAnniversary}=req('@marketingspa/shared');
const {CreditService}=req('/app/dist/credit/credit.service'),{OpenAiService}=req('/app/dist/openai/openai.service'),{CreditContextInterceptor}=req('/app/dist/openai/credit-context.interceptor');
const {lastValueFrom,defer}=req('rxjs');const ledger=new CreditLedger(db),credit=new CreditService(db),interceptor=new CreditContextInterceptor(credit);
const ai=new OpenAiService({get:k=>({OPENAI_API_KEY:'fixture',OPENAI_MODEL:'gpt-4o-mini'}[k])},credit);
let calls=0,status=200,providerContent='Fixture';const realFetch=global.fetch;
global.fetch=async()=>{calls++;return new Response(JSON.stringify({choices:[{message:{content:providerContent}}]}),{status});};
const basic={messages:[{role:'user',content:'Fixture'}],maxTokens:100};
async function main(){
 for(const p of buildPlanCatalog())await db.subscriptionPlan.upsert({where:{code:p.code},create:p,update:p});
 for(const [featureCode,creditCost]of [['content_ai.generate',20],['content_ai.suggest',20],['assistant.chat',10]])await db.creditFeaturePricing.upsert({where:{featureCode},create:{featureCode,name:featureCode,creditCost},update:{creditCost,isActive:true}});
 const org=await db.organization.create({data:{name:'Content success billing QA',slug:`content-success-${Date.now()}`}}),plan=await db.subscriptionPlan.findUniqueOrThrow({where:{code:'abg-pro-1m'}}),start=new Date();
 await db.subscription.create({data:{organizationId:org.id,planId:plan.id,status:'ACTIVE',currentPeriodStart:start,currentPeriodEnd:billingAnniversary(start,1)}});
 const invoke=(route,fn,method='POST')=>lastValueFrom(interceptor.intercept({getType:()=> 'http',switchToHttp:()=>({getRequest:()=>({method,user:{organizationId:org.id},originalUrl:'/api/v1/content-marketing/'+route})})},{handle:()=>defer(fn)}));
 const used=async fn=>{const before=await ledger.getBalance(org.id);await fn();const after=await ledger.getBalance(org.id);assert.equal(after.reservedBalance,0);return before.balance-after.balance;};
 const results=[];
 for(const [route,body]of [['generate',{content:'Completed content'}],['generate-advanced',{final_article:'Completed article'}],['opinion/generate',{facebookPost:'Completed post',videoScript:'Script'}]]){
  assert.equal(await used(()=>invoke(route,async()=>{await Promise.all([1,2,3,4].map(()=>ai.chatCompletion(basic)));assert.equal(await db.creditTransaction.count({where:{organizationId:org.id,type:'USAGE',referenceId:{startsWith:'not-used'}}}),0);return {...body,source:'ai'};})),20);
  const balanceBeforeFailure=await ledger.getBalance(org.id);
  await assert.rejects(invoke(route,async()=>{await ai.chatCompletion({...basic,model:'gpt-4o',maxTokens:12000});throw Error('Postprocessing failed');}),/Postprocessing failed/);
  const balanceAfterFailure=await ledger.getBalance(org.id);assert.equal(balanceAfterFailure.balance,balanceBeforeFailure.balance);assert.equal(balanceAfterFailure.reservedBalance,0);
  for(const result of [{...body,source:'template'},{source:'ai',content:' ',final_article:'',facebookPost:''},{error:'generation failed'},null])assert.equal(await used(()=>invoke(route,async()=>{await ai.chatCompletion(basic);return result;})),0);
  status=503;assert.equal(await used(()=>invoke(route,async()=>{try{await ai.chatCompletion(basic);}catch{}return {...body,source:'template'};})),0);status=200;
  results.push({route,success:20,failedOrFallback:0});
 }
 const freeRoutes=['industry-suggestions','advanced/rewrite','advanced/optimize-cta','advanced/titles','advanced/suggest-field','analyze-video','check-policy','score','rewrite','suggest-insights','suggest-cta','suggest-personal-ideas','suggest-personal-titles','analyze-opinion-story','opinion/analyze','opinion/rewrite','opinion/score-naturalness','opinion/suggest-field','teleprompter/rewrite','facebook-policy/check','facebook-policy/rewrite','facebook-policy/import-url','facebook-policy/analyze-media'];
 for(const route of freeRoutes)assert.equal(await used(()=>invoke(route,async()=>{await ai.chatCompletion(basic);await ai.chatCompletion(basic);return {source:'ai',content:'Free editor action'};})),0,route);
 const {ContentMarketingService}=req('/app/dist/content-marketing/content-marketing.service');
 const service=new ContentMarketingService(ai,db,{get:()=>undefined}),dto={mode:'personal',productService:'Chia sẻ kinh nghiệm làm việc',postTopic:'Kinh nghiệm làm việc',postLength:'short'};
 providerContent=JSON.stringify({content:'Chia sẻ kinh nghiệm làm việc: mỗi ngày dành thời gian học và thực hành.',hooks:[],openers:[],punchlines:[]});
 assert.equal(await used(()=>invoke('generate',()=>service.generate(dto))),20,'Real generation service completed');
 providerContent='{}';assert.equal(await used(()=>invoke('generate',()=>service.generate(dto))),0,'Missing AI content falls back free');
 providerContent='invalid JSON';assert.equal(await used(()=>invoke('generate',()=>service.generate(dto))),0,'Invalid AI body falls back free');
 providerContent='Fixture';
 // Debit is settled only after the complete content response, never at an internal AI step.
 const usageBefore=await db.creditTransaction.count({where:{organizationId:org.id,type:'USAGE'}});
 await invoke('generate',async()=>{await ai.chatCompletion(basic);assert.equal(await db.creditTransaction.count({where:{organizationId:org.id,type:'USAGE'}}),usageBefore);return {source:'ai',content:'Completed final result'};});
 assert.equal(await db.creditTransaction.count({where:{organizationId:org.id,type:'USAGE'}}),usageBefore+1);
 const remaining=await ledger.getBalance(org.id);await ledger.usage({organizationId:org.id,amount:remaining.balance,idempotencyKey:'qa-drain'});
 const count=calls;await assert.rejects(invoke('generate',async()=>{await ai.chatCompletion(basic);return {source:'ai',content:'Should not run'};}),e=>e.getResponse().code==='INSUFFICIENT_CREDITS');assert.equal(calls,count);
 assert.equal(await used(()=>invoke('suggest-personal-titles',async()=>{await ai.chatCompletion(basic);return {titles:['Free at zero balance']};})),0);
 const final=await ledger.getBalance(org.id);assert.equal(final.reservedBalance,0);
 const report={passed:true,creationRoutes:results,freeRoutes,freeAtZeroBalance:true,failedPostprocessingReleasesReservation:true,debitedOnlyAfterFinalContent:true,paidProviderCalls:0};
 fs.writeFileSync('/fixtures/success-test-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{global.fetch=realFetch;await db.$disconnect();});
