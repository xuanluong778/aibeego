const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'tmp/local-subscription-release-20261122');
const run=args=>execFileSync('docker',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
const network='aibeego-subscription-qa-20261122',container='aibeego-plan-tiers-qa-20261122';
try{run(['network','inspect',network]);}catch{run(['network','create',network]);}
const state=JSON.parse(run(['inspect',container]))[0];
if(!state.NetworkSettings.Networks[network])run(['network','connect','--alias','subscription-postgres',network,container]);
run(['start',container]);
let source=fs.readFileSync(path.join(root,'scripts/test-subscription-tiers.cjs'),'utf8');
for(const [before,after]of [
  ["require('../packages/database/dist')","require('@marketingspa/database')"],
  ["require('../packages/shared/dist')","require('@marketingspa/shared')"],
  ["require('../tmp/subscription-tiers-api/billing/billing.service')","require('./dist/billing/billing.service')"],
  ["require('../tmp/subscription-tiers-api/common/uploads/plan-storage')","require('./dist/common/uploads/plan-storage')"],
  ['127.0.0.1:15491/plan_tiers_qa_v2','subscription-postgres:5432/plan_tiers_qa_v2'],
]){if(!source.includes(before))throw Error(`QA adaptation anchor missing: ${before}`);source=source.replace(before,after);}
const file=path.join(dir,'image-qa.cjs');fs.writeFileSync(file,source);
const result=run(['run','--rm','--network',network,'--mount',`type=bind,source=${file},target=/app/release-qa.cjs,readonly`,'--entrypoint','node','aibeego-api:subscription-tiers-20261122','/app/release-qa.cjs']);
fs.writeFileSync(path.join(dir,'image-qa-result.txt'),result);console.log(result);
