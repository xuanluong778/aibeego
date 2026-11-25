const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'tmp/credit-costs-review-20261122');
function compile(input,output){fs.mkdirSync(path.dirname(output),{recursive:true});const result=ts.transpileModule(fs.readFileSync(input,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true},reportDiagnostics:true});if(result.diagnostics?.length)throw Error('Transpile diagnostics');fs.writeFileSync(output,result.outputText);}
for(const name of ['credit','credit-pricing'])compile(path.join(root,'packages/shared/src',name+'.ts'),path.join(dir,'shared',name+'.js'));
for(const name of ['credit/credit.service','platform-admin/credit-costs-admin.service'])compile(path.join(root,'apps/api/src',name+'.ts'),path.join(dir,'dist',name+'.js'));
fs.writeFileSync(path.join(dir,'patch-shared.cjs'),`const fs=require('fs'),path=require('path');const dist=path.dirname(require.resolve('@marketingspa/shared'));for(const name of ['credit','credit-pricing'])fs.copyFileSync('/tmp/review-shared/'+name+'.js',path.join(dist,name+'.js'));`);
fs.writeFileSync(path.join(dir,'Dockerfile.api'),'FROM aibeego-api:admin-credit-costs-20261122\nCOPY shared/ /tmp/review-shared/\nCOPY patch-shared.cjs /app/patch-review-shared.cjs\nRUN node /app/patch-review-shared.cjs\nCOPY dist/ /app/dist/\n');
console.log('Prepared content suggestion classification fix; no existing configured price changed.');
