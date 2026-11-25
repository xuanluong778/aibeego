const fs=require('fs'),path=require('path'),ts=require('typescript');
const dir=path.resolve('tmp/content-success20-20261122');fs.mkdirSync(dir,{recursive:true});
function compile(src,out){fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,ts.transpileModule(fs.readFileSync(src,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true}}).outputText);}
for(const name of ['openai/openai.service','openai/credit-context.interceptor','platform-admin/credit-costs-admin.service','content-marketing/advanced-article-logic','content-marketing/content-marketing-logic','content-marketing/ad-product-service.logic','content-marketing/opinion-generate.logic','content-marketing/opinion-story.logic'])compile('apps/api/src/'+name+'.ts',dir+'/dist/'+name+'.js');
compile('packages/shared/src/credit-pricing.ts',dir+'/credit-pricing.js');
compile('apps/worker/src/lib/ad-url-analyze-ai.ts',dir+'/ad-url-analyze-ai.js');
fs.writeFileSync(dir+'/patch-shared.cjs',`const fs=require('fs'),path=require('path');fs.copyFileSync('/tmp/credit-pricing.js',path.join(path.dirname(require.resolve('@marketingspa/shared')),'credit-pricing.js'));`);
fs.writeFileSync(dir+'/Dockerfile.api','FROM aibeego-api:content-flat20-20261122\nCOPY credit-pricing.js /tmp/credit-pricing.js\nCOPY patch-shared.cjs /app/patch-success-pricing.cjs\nRUN node /app/patch-success-pricing.cjs\nCOPY dist/ /app/dist/\n');
fs.writeFileSync(dir+'/Dockerfile.worker','FROM aibeego-worker:credit-economy-20261122\nCOPY ad-url-analyze-ai.js /app/dist/lib/ad-url-analyze-ai.js\n');
fs.writeFileSync('deploy/local-content-success20.yml','services:\n  api:\n    image: aibeego-api:content-success20-20261122\n  web:\n    image: aibeego-web:content-success20-20261122\n  worker:\n    image: aibeego-worker:content-success20-20261122\n');
console.log('Prepared success-only Content billing.');
