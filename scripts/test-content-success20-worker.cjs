const req=require('node:module').createRequire('/app/package.json'),assert=require('node:assert/strict'),fs=require('fs');
process.env.DATABASE_URL='postgresql://planqa:planqa-local-only@subscription-postgres:5432/plan_tiers_qa_v2?schema=public';process.env.OPENAI_API_KEY='fixture';
const {prisma:db,CreditLedger}=req('@marketingspa/database'),{analyzeAdUrlContent}=req('/app/dist/lib/ad-url-analyze-ai');
let calls=0;const realFetch=global.fetch;global.fetch=async()=>{calls++;return new Response(JSON.stringify({choices:[{message:{content:'{"product":{"name":"Fixture"}}'}}]}));};
(async()=>{
 const ledger=new CreditLedger(db),org=await db.organization.create({data:{name:'Free content link analysis QA',slug:'content-free-worker-'+Date.now()}});
 const before=await ledger.getBalance(org.id);
 await analyzeAdUrlContent({organizationId:org.id,billingReference:'free-link-'+Date.now(),adPostKind:'product',title:'Fixture',text:'Fixture product details',finalUrl:'https://example.invalid/'});
 const after=await ledger.getBalance(org.id);assert.equal(after.balance,before.balance);assert.equal(after.reservedBalance,0);assert.equal(calls,1);
 assert.equal(await db.creditTransaction.count({where:{organizationId:org.id,type:'USAGE'}}),0);
 const report={passed:true,contentLinkAnalysisCreditCost:0,paidProviderCalls:0};fs.writeFileSync('/fixtures/worker-test-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{global.fetch=realFetch;await db.$disconnect();});
