// Compile the changed worker modules; retain unrelated modules from the running image.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'tmp/local-subscription-release-20261122');
const compiled=path.join(dir,'worker-compiled'),overlay=path.join(dir,'worker-overlay');
const result=spawnSync(process.execPath,[path.join(root,'node_modules/typescript/bin/tsc'),'-p','apps/worker/tsconfig.json','--outDir',compiled,'--declaration','false','--sourceMap','false','--declarationMap','false'],{cwd:root,encoding:'utf8'});
const diagnostics=(result.stdout||'')+(result.stderr||'');
fs.writeFileSync(path.join(dir,'worker-typecheck.txt'),diagnostics);
const lines=diagnostics.split(/\r?\n/).filter(Boolean);
const expected=/^apps\/worker\/src\/(lib\/sla-breach-scan\.ts\(\d+,\d+\): error TS2339:|processors\/ads-(autopilot|campaign-deploy)\.ts\(\d+,\d+\): error TS2305:)/;
if(result.error||lines.some(line=>!expected.test(line))||(result.status!==0&&lines.length!==6))throw Error(`Unexpected worker build error: ${diagnostics}`);
const files=['lib/run-canvas-runtime','processors/auto-post','processors/automation-run','processors/email-campaign-send','processors/jobs','processors/marketing-autopilot-mission','processors/messaging-send','processors/rag-source-sync','processors/video-transcription'];
for(const name of files){const from=path.join(compiled,`${name}.js`),to=path.join(overlay,'dist',`${name}.js`);if(!fs.existsSync(from))throw Error(`Missing emitted module ${name}`);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);}
fs.copyFileSync(path.join(root,'deploy/patch-subscription-worker-runtime.cjs'),path.join(overlay,'patch-runtime.cjs'));
console.log(JSON.stringify({modules:files.length,unrelatedDiagnostics:lines.length,overlay}));
