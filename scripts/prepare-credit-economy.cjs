const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'tmp/credit-economy-20261122');
const api=[
 'openai/openai.service','openai/openai.module','openai/credit-context.interceptor','common/filters/http-exception.filter',
 'credit/credit.service','credit/credit.controller','content-marketing/content-marketing.service',
 'landing-pages/landing-pages.service','chatbot-cskh/utils/plan-billed-chat',
 'assistant/assistant.orchestrator.service','ai-ads-manager/google-ads-campaign-builder.service',
 'email/email-router.service','email-marketing/email-marketing.service','email-marketing/email-marketing.controller',
];
const worker=['lib/ad-url-analyze-ai','lib/video-transcription-stt','processors/ad-url-analyze','processors/video-transcription','processors/email-campaign-send'];
const shared=['credit','credit-pricing','subscription-catalog'];
const database=['credit-context','credit-ledger'];
function compile(from,to){fs.mkdirSync(path.dirname(to),{recursive:true});const result=ts.transpileModule(fs.readFileSync(from,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true},reportDiagnostics:true});if(result.diagnostics?.length)throw Error('Transpile diagnostics: '+from);fs.writeFileSync(to,result.outputText);}
for(const [pkg,names]of [['api',api],['worker',worker]])for(const name of names)compile(path.join(root,'apps',pkg,'src',name+'.ts'),path.join(dir,pkg,'dist',name+'.js'));
for(const [pkg,names]of [['shared',shared],['database',database]])for(const name of names)compile(path.join(root,'packages',pkg,'src',name+'.ts'),path.join(dir,'packages',pkg,name+'.js'));
fs.writeFileSync(path.join(dir,'patch-packages.cjs'),`const fs=require('fs'),path=require('path');
for(const [pkg,names]of ${JSON.stringify([['shared',shared],['database',database]])}){
 const dist=path.dirname(require.resolve('@marketingspa/'+pkg));
 for(const name of names)fs.copyFileSync('/tmp/credit-packages/'+pkg+'/'+name+'.js',path.join(dist,name+'.js'));
 const extra=pkg==='shared'?'credit-pricing':'credit-context';
 fs.appendFileSync(path.join(dist,'index.js'),'\\nObject.assign(module.exports, require('+JSON.stringify('./'+extra)+'));\\n');
}
`);
for(const [pkg,base]of [['api','aibeego-api:six-month-bonus-20261122'],['worker','aibeego-worker:subscription-tiers-20261122']]){
 fs.writeFileSync(path.join(dir,'Dockerfile.'+pkg),`FROM ${base}\nCOPY packages/ /tmp/credit-packages/\nCOPY patch-packages.cjs /app/patch-credit-packages.cjs\nRUN node /app/patch-credit-packages.cjs\nCOPY ${pkg}/dist/ /app/dist/\n`);
}
const pricing=require(path.join(dir,'packages/shared/credit-pricing.js')).CREDIT_PRICING;
const q=s=>"'"+s.replace(/'/g,"''")+"'";
let sql=`-- Monthly catalogue allowances; preserve purchased balances and existing order amounts.\nUPDATE subscription_plans SET credits_included=CASE WHEN code LIKE 'abg-basic-%' THEN 5000 WHEN code LIKE 'abg-pro-%' THEN 15000 ELSE 45000 END WHERE code ~ '^abg-(basic|pro|vip)-(1|6|12)m$';\n`;
for(const row of pricing)sql+=`INSERT INTO credit_feature_pricing(id,feature_code,name,credit_cost,description,is_active,sort_order,created_at,updated_at) VALUES (${q('credit-economy-'+row.featureCode)},${q(row.featureCode)},${q(row.name)},${row.creditCost},${q(row.description)},true,${row.sortOrder},NOW(),NOW()) ON CONFLICT(feature_code) DO UPDATE SET name=EXCLUDED.name,credit_cost=EXCLUDED.credit_cost,description=EXCLUDED.description,is_active=true,sort_order=EXCLUDED.sort_order,updated_at=NOW();\n`;
const migration=path.join(root,'packages/database/prisma/migrations/20261122050000_credit_economy');fs.mkdirSync(migration,{recursive:true});fs.writeFileSync(path.join(migration,'migration.sql'),sql);
let qa=fs.readFileSync(path.join(root,'scripts/test-subscription-tiers.cjs'),'utf8');
for(const [from,to]of [["require('../packages/database/dist')","require('@marketingspa/database')"],["require('../packages/shared/dist')","require('@marketingspa/shared')"],["require('../tmp/subscription-tiers-api/billing/billing.service')","require('/app/dist/billing/billing.service')"],["require('../tmp/subscription-tiers-api/common/uploads/plan-storage')","require('/app/dist/common/uploads/plan-storage')"],['127.0.0.1:15491/plan_tiers_qa_v2','subscription-postgres:5432/plan_tiers_qa_v2']]){if(!qa.includes(from))throw Error('QA anchor missing');qa=qa.replace(from,to);}
fs.writeFileSync(path.join(dir,'subscription-qa.cjs'),qa);
console.log(JSON.stringify({apiModules:api.length,workerModules:worker.length,pricingRows:pricing.length,migration:'20261122050000_credit_economy'}));
