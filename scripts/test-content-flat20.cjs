const assert=require('node:assert/strict'),fs=require('node:fs'),req=require('node:module').createRequire('/app/package.json');
process.env.DATABASE_URL='postgresql://planqa:planqa-local-only@subscription-postgres:5432/plan_tiers_qa_v2?schema=public';req('reflect-metadata');
const {prisma:db,CreditLedger}=req('@marketingspa/database');
const {buildPlanCatalog,billingAnniversary}=req('@marketingspa/shared');
const {CreditService}=req('/app/dist/credit/credit.service'),{OpenAiService}=req('/app/dist/openai/openai.service'),{CreditContextInterceptor}=req('/app/dist/openai/credit-context.interceptor');
const {lastValueFrom,defer}=req('rxjs');const ledger=new CreditLedger(db),credit=new CreditService(db),interceptor=new CreditContextInterceptor();
const ai=new OpenAiService({get:key=>({OPENAI_API_KEY:'fixture',OPENAI_MODEL:'gpt-4o-mini'}[key])},credit);
const realFetch=global.fetch;let calls=0,statuses=[];global.fetch=async()=>{calls++;return new Response(JSON.stringify({choices:[{message:{content:'Fixture'}}]}),{status:statuses.shift()||200});};
const basic={messages:[{role:'user',content:'Fixture'}],maxTokens:100};let seq=0;
async function main(){
  for(const p of buildPlanCatalog())await db.subscriptionPlan.upsert({where:{code:p.code},create:p,update:p});
  for(const [featureCode,creditCost]of [['content_ai.generate',20],['content_ai.suggest',20],['assistant.chat',10]])await db.creditFeaturePricing.upsert({where:{featureCode},create:{featureCode,name:featureCode,creditCost},update:{creditCost,isActive:true}});
  const org=await db.organization.create({data:{name:'Flat content QA',slug:`flat-content-${Date.now()}`}}),plan=await db.subscriptionPlan.findUniqueOrThrow({where:{code:'abg-pro-1m'}}),start=new Date();
  await db.subscription.create({data:{organizationId:org.id,planId:plan.id,status:'ACTIVE',currentPeriodStart:start,currentPeriodEnd:billingAnniversary(start,1)}});
  const invoke=(path,fn)=>lastValueFrom(interceptor.intercept({getType:()=> 'http',switchToHttp:()=>({getRequest:()=>({user:{organizationId:org.id},originalUrl:path})})},{handle:()=>defer(fn)}));
  const used=async fn=>{const before=await ledger.getBalance(org.id);await fn();return before.balance-(await ledger.getBalance(org.id)).balance;};
  const results=[];
  for(const path of ['/api/v1/content-marketing/generate','/api/v1/content-marketing/suggest-personal-titles']){
    assert.equal(await used(()=>invoke(path,()=>ai.chatCompletion(basic))),20);
    assert.equal(await used(()=>invoke(path,async()=>{await ai.chatCompletion(basic);await ai.chatCompletion(basic);return ai.chatCompletion(basic);})),20);
    assert.equal(await used(()=>invoke(path,()=>Promise.all(Array.from({length:4},()=>ai.chatCompletion(basic))))),20);
    assert.equal(await used(()=>invoke(path,()=>ai.chatCompletion({messages:[{role:'user',content:'x'.repeat(100000)}],maxTokens:12000,model:'gpt-4o'}))),20);
    results.push({path,singleCall:20,threeCalls:20,fourParallelCalls:20,longPremiumCall:20});
  }
  statuses=[503,200];assert.equal(await used(()=>invoke('/api/v1/content-marketing/generate',async()=>{try{await ai.chatCompletion(basic);}catch{}return ai.chatCompletion(basic);})),20,'Retry after rejected provider only charges once');
  statuses=[503,503,503];assert.equal(await used(()=>invoke('/api/v1/content-marketing/generate',async()=>{for(let i=0;i<3;i++)try{await ai.chatCompletion(basic);}catch{}return 'fallback';})),0,'No accepted provider call means no debit');
  assert.equal(await used(()=>Promise.all([1,2].map(()=>invoke('/api/v1/content-marketing/generate',()=>ai.chatCompletion(basic))))),40,'Separate user requests charge separately');
  assert.equal(await used(()=>invoke('/api/v1/assistant/chat',()=>credit.runPaidFeature({organizationId:org.id,featureCode:'assistant.chat',referenceId:`other:${Date.now()}:${++seq}`,fn:async()=>{await ai.chatCompletion(basic);await ai.chatCompletion(basic);return ai.chatCompletion(basic);}}))),30,'Other features retain their existing metering');
  const records=await db.creditTransaction.findMany({where:{organizationId:org.id,type:'USAGE',featureCode:{in:['content_ai.generate','content_ai.suggest']}}});
  assert(records.every(row=>Number(row.amount)===20&&row.metadata.flatPerRequest===true));
  const remaining=await ledger.getBalance(org.id);await ledger.usage({organizationId:org.id,amount:remaining.balance-10,idempotencyKey:'drain'});
  const beforeCalls=calls;await assert.rejects(invoke('/api/v1/content-marketing/generate',async()=>{try{return await ai.chatCompletion(basic);}catch{return 'fallback';}}),e=>e.getResponse().code==='INSUFFICIENT_CREDITS');assert.equal(calls,beforeCalls);
  const report={passed:true,results,retryChargedOnce:true,rejectedProviderFree:true,separateRequestsChargedSeparately:true,otherFeesUnchanged:true,insufficientCreditBlocksProvider:true,paidProviderCalls:0};
  fs.writeFileSync('/fixtures/flat20-test-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{global.fetch=realFetch;await db.$disconnect();});
