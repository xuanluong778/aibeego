const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'tmp/content-flat20-20261122');
function compile(input,output){fs.mkdirSync(path.dirname(output),{recursive:true});const result=ts.transpileModule(fs.readFileSync(input,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true},reportDiagnostics:true});if(result.diagnostics?.length)throw Error('Transpile diagnostics');fs.writeFileSync(output,result.outputText);}
for(const name of ['openai/openai.service','openai/credit-context.interceptor','platform-admin/credit-costs-admin.service'])compile(path.join(root,'apps/api/src',name+'.ts'),path.join(dir,'dist',name+'.js'));
compile(path.join(root,'packages/shared/src/credit-pricing.ts'),path.join(dir,'credit-pricing.js'));
fs.writeFileSync(path.join(dir,'patch-shared.cjs'),`const fs=require('fs'),path=require('path');fs.copyFileSync('/tmp/flat-credit-pricing.js',path.join(path.dirname(require.resolve('@marketingspa/shared')),'credit-pricing.js'));`);
fs.writeFileSync(path.join(dir,'Dockerfile.api'),'FROM aibeego-api:credit-costs-review-20261122\nCOPY credit-pricing.js /tmp/flat-credit-pricing.js\nCOPY patch-shared.cjs /app/patch-flat-shared.cjs\nRUN node /app/patch-flat-shared.cjs\nCOPY dist/ /app/dist/\n');
console.log('Prepared flat per-request content billing overlay.');
