const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'tmp/admin-credit-costs-20261122');
const run=args=>execFileSync('docker',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
const compose=['compose','-p','aibeego','-f','docker-compose.yml','-f','docker-compose.local.yml','-f','deploy/local-subscription-tiers.yml','-f','deploy/local-template-bulk-route-fix.yml','-f','deploy/local-six-month-bonus.yml','-f','deploy/local-compact-header.yml','-f','deploy/local-credit-economy.yml'];
const query=sql=>run(['exec','marketingspa-postgres','sh','-c','exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -v ON_ERROR_STOP=1 -c "$1"','sh',sql]).trim();
let deploying=false;
async function main(){
  if(fs.existsSync(path.join(dir,'deployment.json')))throw Error('Already deployed');
  const images={};
  for(const service of ['api','web']){
    run(['image','inspect',`aibeego-${service}:admin-credit-costs-20261122`]);
    const state=JSON.parse(run(['inspect',`marketingspa-${service}`]))[0];assert.equal(state.Config.Labels['com.docker.compose.project'],'aibeego');
    images[service]=`aibeego-${service}:before-admin-credit-costs-20261122`;run(['tag',state.Image,images[service]]);
  }
  const pricing=JSON.parse(query('SELECT json_agg(p ORDER BY p.feature_code) FROM credit_feature_pricing p'));
  fs.writeFileSync(path.join(dir,'pricing-before.json'),JSON.stringify(pricing,null,2));
  fs.writeFileSync(path.join(dir,'rollback.yml'),'services:\n'+Object.entries(images).map(([s,image])=>`  ${s}:\n    image: ${image}\n`).join(''));
  deploying=true;
  run([...compose,'-f','deploy/local-admin-credit-costs.yml','up','-d','--no-deps','--no-build','api','web']);
  run(['exec','marketingspa-nginx','nginx','-t']);run(['exec','marketingspa-nginx','nginx','-s','reload']);
  let ready=false;
  for(let i=0;i<40;i++){
    try{
      const health=await fetch('http://localhost:8080/api/v1/health',{signal:AbortSignal.timeout(3000)});
      const guard=await fetch('http://localhost:8080/api/v1/admin/credit-costs',{signal:AbortSignal.timeout(3000)});
      const web=await fetch('http://localhost:8080/login',{signal:AbortSignal.timeout(3000)});
      if(health.ok&&web.ok&&guard.status===401){ready=true;break;}
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,1500));
  }
  assert(ready,'Readiness failed');
  assert.deepEqual(JSON.parse(query('SELECT json_agg(p ORDER BY p.feature_code) FROM credit_feature_pricing p')),pricing,'Existing costs changed during deployment');
  const result={deployedAt:new Date().toISOString(),route:'/admin/credit-costs',existingCreditCostsPreserved:true,noSchemaMigration:true};
  fs.writeFileSync(path.join(dir,'deployment.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error.message);if(deploying){try{run([...compose,'-f',path.join(dir,'rollback.yml'),'up','-d','--no-deps','--no-build','api','web']);run(['exec','marketingspa-nginx','nginx','-s','reload']);console.error('Restored prior API/web images.');}catch(rollbackError){console.error(rollbackError.message);}}process.exitCode=1;});
