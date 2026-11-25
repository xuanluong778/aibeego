const req=require('node:module').createRequire('/app/package.json'),assert=require('node:assert/strict');
process.env.DATABASE_URL='postgresql://planqa:planqa-local-only@subscription-postgres:5432/plan_tiers_qa_v2?schema=public';
process.env.OPENAI_API_KEY='fixture-only';process.env.OPENAI_MODEL='gpt-4o-mini';
const {prisma:db,CreditLedger}=req('@marketingspa/database');
const {buildPlanCatalog,billingAnniversary,CREDIT_PRICING}=req('@marketingspa/shared');
const {analyzeAdUrlContent}=req('/app/dist/lib/ad-url-analyze-ai');
const realFetch=global.fetch;let calls=0;
global.fetch=async()=>{calls++;return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({brandName:'Fixture',productName:'Fixture',confidence:0.9})}}]}),{status:200});};
async function main(){
  for(const plan of buildPlanCatalog())await db.subscriptionPlan.upsert({where:{code:plan.code},create:plan,update:plan});
  for(const p of CREDIT_PRICING)await db.creditFeaturePricing.upsert({where:{featureCode:p.featureCode},create:{...p,isActive:true},update:{...p,isActive:true}});
  const stamp=Date.now(),org=await db.organization.create({data:{name:'Worker cost QA',slug:`worker-cost-${stamp}`}});
  const plan=await db.subscriptionPlan.findUniqueOrThrow({where:{code:'abg-pro-1m'}}),start=new Date();
  await db.subscription.create({data:{organizationId:org.id,planId:plan.id,status:'ACTIVE',currentPeriodStart:start,currentPeriodEnd:billingAnniversary(start,1)}});
  const ledger=new CreditLedger(db),before=await ledger.getBalance(org.id);
  const input={organizationId:org.id,billingReference:`worker-url:${stamp}`,adPostKind:'product',title:'Fixture',text:'Fixture product information',finalUrl:'https://example.invalid/'};
  await analyzeAdUrlContent(input);assert.equal(before.balance-(await ledger.getBalance(org.id)).balance,60);
  await assert.rejects(analyzeAdUrlContent(input),e=>e.code==='ALREADY_COMMITTED');assert.equal(calls,1);
  const current=await ledger.getBalance(org.id);await ledger.usage({organizationId:org.id,amount:current.balance,idempotencyKey:'drain'});
  await assert.rejects(analyzeAdUrlContent({...input,billingReference:`worker-low:${stamp}`}),e=>e.code==='INSUFFICIENT_CREDITS');assert.equal(calls,1);
  assert.equal(typeof req('/app/dist/processors/email-campaign-send').processEmailCampaignSend,'function');
  assert.equal(typeof req('/app/dist/processors/video-transcription').processVideoTranscription,'function');
  const adapters=req('/app/dist/lib/google-ads-api');assert.equal(typeof adapters.createLiveGoogleAdsMutatePort,'function');assert.equal(typeof adapters.createLiveGoogleAdsAutopilotMutatePort,'function');
  console.log('PASS: real worker URL analysis debits 60, duplicate/insufficient calls blocked before provider; email/video modules load; Google Ads adapters preserved. No external provider calls.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{global.fetch=realFetch;await db.$disconnect();});
