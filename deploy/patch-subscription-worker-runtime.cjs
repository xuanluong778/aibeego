const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const original=createRequire('/app/package.json'),api=createRequire('/tmp/api-runtime/package.json');
const rootOf=(req,name)=>path.dirname(path.dirname(req.resolve(name)));
const originalDb=rootOf(original,'@marketingspa/database'),apiDb=rootOf(api,'@marketingspa/database');
const originalShared=rootOf(original,'@marketingspa/shared'),apiShared=rootOf(api,'@marketingspa/shared');
function copyModules(from,to,names){for(const name of names)fs.copyFileSync(path.join(from,'dist',`${name}.js`),path.join(to,'dist',`${name}.js`));}
copyModules(apiShared,originalShared,['subscription-catalog','subscription-display','credit']);
fs.appendFileSync(path.join(originalShared,'dist/index.js'),"\nObject.assign(module.exports, require('./subscription-catalog'));\n");
copyModules(apiDb,originalDb,['plan-policy','credit-ledger','customer-360-write']);
fs.appendFileSync(path.join(originalDb,'dist/index.js'),"\nObject.assign(module.exports, require('./plan-policy'));\n");
const link=path.join(originalDb,'node_modules/@marketingspa/shared');fs.mkdirSync(path.dirname(link),{recursive:true});if(!fs.existsSync(link))fs.symlinkSync(originalShared,link,'dir');
const clientRoot=req=>{const dbReq=createRequire(req.resolve('@marketingspa/database'));const clientReq=createRequire(dbReq.resolve('@prisma/client'));return path.dirname(clientReq.resolve('.prisma/client/index.js'));};
fs.cpSync(clientRoot(api),clientRoot(original),{recursive:true});
fs.cpSync('/tmp/worker-overlay/dist','/app/dist',{recursive:true});
const database=original('@marketingspa/database');if(typeof database.PlanPolicy!=='function')throw Error('Missing PlanPolicy');
const ads=original('/app/dist/lib/google-ads-api');if(typeof ads.createLiveGoogleAdsMutatePort!=='function'||typeof ads.createLiveGoogleAdsAutopilotMutatePort!=='function')throw Error('Lost existing Google Ads adapters');
console.log('PASS: worker plan modules updated, existing Google Ads adapters retained');
