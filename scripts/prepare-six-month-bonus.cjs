const fs = require('node:fs'), path = require('node:path'), ts = require('typescript');
const root = path.resolve(__dirname, '..'), dir = path.join(root, 'tmp/six-month-bonus-20261122');
fs.mkdirSync(dir, {recursive:true});
for (const [input, output] of [
  ['apps/api/src/billing/billing.service.ts','billing.service.js'],
  ['packages/shared/src/subscription-catalog.ts','subscription-catalog.js'],
]) {
  const result = ts.transpileModule(fs.readFileSync(path.join(root,input),'utf8'),{compilerOptions:{
    target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true,
  },reportDiagnostics:true});
  if(result.diagnostics?.length)throw Error('Transpilation diagnostics for '+input);
  fs.writeFileSync(path.join(dir,output),result.outputText);
}
fs.writeFileSync(path.join(dir,'Dockerfile.api'),`FROM aibeego-api:template-bulk-route-fix-20261122
COPY billing.service.js /app/dist/billing/billing.service.js
COPY subscription-catalog.js /app/node_modules/.pnpm/@marketingspa+shared@file+packages+shared/node_modules/@marketingspa/shared/dist/subscription-catalog.js
`);
let qa=fs.readFileSync(path.join(root,'scripts/test-subscription-tiers.cjs'),'utf8');
for(const [from,to]of [
  ["require('../packages/database/dist')","require('@marketingspa/database')"],
  ["require('../packages/shared/dist')","require('@marketingspa/shared')"],
  ["require('../tmp/subscription-tiers-api/billing/billing.service')","require('/app/dist/billing/billing.service')"],
  ["require('../tmp/subscription-tiers-api/common/uploads/plan-storage')","require('/app/dist/common/uploads/plan-storage')"],
  ['127.0.0.1:15491/plan_tiers_qa_v2','subscription-postgres:5432/plan_tiers_qa_v2'],
]){if(!qa.includes(from))throw Error('Missing QA adaptation anchor: '+from);qa=qa.replace(from,to);}
fs.writeFileSync(path.join(dir,'qa.cjs'),qa);
console.log('Prepared API overlay and isolated checkout/fulfillment regression suite.');
