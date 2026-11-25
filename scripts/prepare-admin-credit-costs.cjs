const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'tmp/admin-credit-costs-20261122');
const names=['platform-admin/platform-admin.module','platform-admin/credit-costs-admin.controller','platform-admin/credit-costs-admin.service','platform-admin/dto/admin-credit-cost.dto'];
for(const name of names){const source=path.join(root,'apps/api/src',name+'.ts'),out=path.join(dir,'dist',name+'.js');fs.mkdirSync(path.dirname(out),{recursive:true});const result=ts.transpileModule(fs.readFileSync(source,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true},reportDiagnostics:true});if(result.diagnostics?.length)throw Error('Transpile failed: '+name);fs.writeFileSync(out,result.outputText);}
fs.writeFileSync(path.join(dir,'Dockerfile.api'),'FROM aibeego-api:credit-economy-20261122\nCOPY dist/ /app/dist/\n');
const seed=ts.transpileModule(fs.readFileSync(path.join(root,'packages/database/prisma/seed-credit-feature-pricing.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}});
fs.writeFileSync(path.join(dir,'seed-pricing-test.cjs'),seed.outputText
  .replace('require("@prisma/client")','require("@marketingspa/database")')
  .replace('require("@prisma/client/runtime/library")','{ Decimal: require("@marketingspa/database").Prisma.Decimal }'));
console.log('Prepared four admin modules; billing runtime and current data retained.');
