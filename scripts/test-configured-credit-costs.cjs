const assert=require('node:assert/strict'),fs=require('node:fs');
const req=require('node:module').createRequire('/app/package.json');
process.env.DATABASE_URL='postgresql://planqa:planqa-local-only@subscription-postgres:5432/plan_tiers_qa_v2?schema=public';
req('reflect-metadata');
const {prisma:db,CreditLedger,creditCallContext}=req('@marketingspa/database');
const {buildPlanCatalog,creditFeatureForPath,transcriptionCreditAmount,billingAnniversary}=req('@marketingspa/shared');
const {CreditService}=req('/app/dist/credit/credit.service'),{OpenAiService}=req('/app/dist/openai/openai.service');
const {CreditContextInterceptor}=req('/app/dist/openai/credit-context.interceptor'),{lastValueFrom,defer}=req('rxjs');
const snapshot=require('/fixtures/current.json'),rates=new Map(snapshot.pricing.map(row=>[row.featureCode,Number(row.creditCost)]));
rates.set('content_ai.suggest',rates.get('email_ai.subject'));
let n=0,providerCalls=0;const realFetch=global.fetch;global.fetch=async()=>{providerCalls++;return new Response(JSON.stringify({choices:[{message:{content:'fixture'}}]}));};
const ledger=new CreditLedger(db),credit=new CreditService(db),ai=new OpenAiService({get:key=>({OPENAI_API_KEY:'fixture',OPENAI_MODEL:'gpt-4o-mini'}[key])},credit);
const message={messages:[{role:'user',content:'Fixture'}],maxTokens:100};
const scope=(org,code,fn)=>creditCallContext.run({organizationId:org,featureCode:code,referenceId:`configured:${Date.now()}:${++n}`},fn);
async function charged(org,fn){const before=await ledger.getBalance(org);await fn();return before.balance-(await ledger.getBalance(org)).balance;}
async function main(){
  for(const p of buildPlanCatalog())await db.subscriptionPlan.upsert({where:{code:p.code},create:p,update:p});
  for(const row of snapshot.pricing){const data={name:row.name,creditCost:Number(row.creditCost),description:row.description,isActive:row.isActive,sortOrder:row.sortOrder};await db.creditFeaturePricing.upsert({where:{featureCode:row.featureCode},create:{featureCode:row.featureCode,...data},update:data});}
  await db.creditFeaturePricing.upsert({where:{featureCode:'content_ai.suggest'},create:{featureCode:'content_ai.suggest',name:'Content AI — gợi ý ngắn',creditCost:rates.get('content_ai.suggest'),sortOrder:15},update:{creditCost:rates.get('content_ai.suggest'),isActive:true}});
  const org=await db.organization.create({data:{name:'Configured cost QA',slug:`configured-${Date.now()}`}}),start=new Date();
  const plan=await db.subscriptionPlan.findUniqueOrThrow({where:{code:'abg-pro-1m'}});
  await db.subscription.create({data:{organizationId:org.id,planId:plan.id,status:'ACTIVE',currentPeriodStart:start,currentPeriodEnd:billingAnniversary(start,1)}});
  const results=[];
  for(const [code,price]of rates){
    if(['content_ai.image','assistant.write','ai.vision','video.transcribe','email.send'].includes(code))continue;
    const amount=await charged(org.id,()=>scope(org.id,code,()=>ai.chatCompletion(message)));
    assert.equal(amount,price,code);results.push({featureCode:code,configured:price,debited:amount,pass:true});
  }
  const nested=await charged(org.id,()=>scope(org.id,'assistant.chat',()=>credit.runPaidFeature({organizationId:org.id,featureCode:'assistant.chat',referenceId:`assistant-once:${Date.now()}`,fn:()=>ai.chatCompletion(message)})));
  assert.equal(nested,rates.get('assistant.chat'));
  const twice=await charged(org.id,()=>scope(org.id,'assistant.chat',()=>credit.runPaidFeature({organizationId:org.id,featureCode:'assistant.chat',referenceId:`assistant-twice:${Date.now()}`,fn:async()=>{await ai.chatCompletion(message);await ai.chatCompletion(message);}})));
  assert.equal(twice,rates.get('assistant.chat')*2);
  const vision=await charged(org.id,()=>scope(org.id,'ai.vision',()=>ai.chatCompletionVision({messages:[{role:'user',content:[{type:'text',text:'Read image'},{type:'image_url',image_url:{url:'data:image/png;base64,AAAA'}}]}],maxTokens:100})));
  assert.equal(vision,rates.get('ai.vision'));results.push({featureCode:'ai.vision',configured:rates.get('ai.vision'),debited:vision,pass:true});
  const video=transcriptionCreditAmount(rates.get('video.transcribe'),30);
  const videoCharged=await charged(org.id,()=>ledger.runPaidFeature({organizationId:org.id,featureCode:'video.transcribe',amount:video,referenceId:`video30:${Date.now()}`,fn:async c=>{c.markProviderStarted();return '30 seconds';}}));
  assert.equal(videoCharged,25);results.push({featureCode:'video.transcribe',configuredPerMinute:rates.get('video.transcribe'),seconds:30,debited:videoCharged,pass:true});
  const email=await charged(org.id,()=>ledger.runPaidFeature({organizationId:org.id,featureCode:'email.send',referenceId:`email:${Date.now()}`,fn:async c=>{c.markProviderStarted();return 'sent fixture';}}));
  assert.equal(email,rates.get('email.send'));results.push({featureCode:'email.send',configured:rates.get('email.send'),debited:email,pass:true});
  assert.equal(creditFeatureForPath('/api/v1/content-marketing/suggest-personal-titles'),'content_ai.suggest');
  assert.equal(creditFeatureForPath('/api/v1/content-marketing/generate?prompt=suggest&industry=spa'),'content_ai.generate');
  assert.equal(creditFeatureForPath('/api/v1/CONTENT-MARKETING/GENERATE'),'content_ai.generate');
  assert.equal(creditFeatureForPath('/api/v1/email-marketing/generate-content'),'email_ai.subject');
  const intercepted=path=>new CreditContextInterceptor().intercept({getType:()=> 'http',switchToHttp:()=>({getRequest:()=>({user:{organizationId:org.id},originalUrl:path})})},{handle:()=>defer(()=>ai.chatCompletion(message))});
  assert.equal(await charged(org.id,()=>lastValueFrom(intercepted('/api/v1/content-marketing/generate?suggest=true'))),rates.get('content_ai.generate'));
  await db.creditFeaturePricing.update({where:{featureCode:'email_ai.subject'},data:{creditCost:17}});
  assert.equal(await charged(org.id,()=>lastValueFrom(intercepted('/api/v1/content-marketing/suggest-personal-titles'))),rates.get('content_ai.suggest'),'Email customization must not change content suggestion pricing');
  await db.creditFeaturePricing.update({where:{featureCode:'email_ai.subject'},data:{creditCost:rates.get('email_ai.subject')}});
  const long=await charged(org.id,()=>scope(org.id,'content_ai.generate',()=>ai.chatCompletion({messages:[{role:'user',content:'a'.repeat(30000)}],maxTokens:500})));
  assert.equal(long,rates.get('content_ai.generate')*2);
  const balance=await ledger.getBalance(org.id);await ledger.usage({organizationId:org.id,amount:balance.balance,idempotencyKey:'drain'});
  const callsBefore=providerCalls;await assert.rejects(scope(org.id,'content_ai.generate',()=>ai.chatCompletion(message)),e=>e.getResponse().code==='INSUFFICIENT_CREDITS');assert.equal(providerCalls,callsBefore);
  const budgets={Basic:{monthly:5000,used:30*20+20*10+20*10+150*3+250*2+5*50+10*15},Pro:{monthly:15000,used:75*20+70*10+60*10+500*3+1000*2+15*50+10*30},VIP:{monthly:45000,used:200*20+120*10+200*10+1500*3+3000*2+60*50+30*30}};
  fs.writeFileSync('/fixtures/configured-test-report.json',JSON.stringify({passed:true,results,budgets,nestedNoDoubleCharge:true,contentAndEmailIndependent:true,queryCannotLowerPrice:true,paidProviderCalls:0},null,2));
  console.log(JSON.stringify({passed:true,results,budgets,contentAndEmailIndependent:true,queryCannotLowerPrice:true,paidProviderCalls:0}));
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{global.fetch=realFetch;await db.$disconnect();});
