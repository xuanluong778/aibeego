// Only deploys the explicitly selected local aibeego Docker project.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'tmp/local-subscription-release-20261122');
const manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
const run=args=>execFileSync('docker',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
const query=sql=>run(['exec','marketingspa-postgres','sh','-c','exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -t -A -c "$1"','sh',sql]).trim();
const compose=['compose','-p','aibeego','-f','docker-compose.yml','-f','docker-compose.local.yml','-f','deploy/local-subscription-tiers.yml'];
const marker=path.join(root,'apps/web/public/landing-page-builder-version.json');
const statsSql=`SELECT json_build_object('subscriptions',(SELECT count(*) FROM subscriptions),'orders',(SELECT count(*) FROM payment_orders),'wallets',(SELECT count(*) FROM credit_wallets),'subscriptionHash',(SELECT md5(COALESCE(string_agg(jsonb_build_array(id,organization_id,plan_id,status,current_period_start,current_period_end)::text,'|' ORDER BY id),'')) FROM subscriptions),'walletHash',(SELECT md5(COALESCE(string_agg(jsonb_build_array(id,organization_id,balance,reserved_balance,lifetime_earned,lifetime_used)::text,'|' ORDER BY id),'')) FROM credit_wallets))`;
const q=value=>value==null?'NULL':"'"+String(value).replace(/'/g,"''")+"'";
let schemaApplied=false,servicesStopped=false;
async function main(){
  if(fs.existsSync(path.join(dir,'deployment.json')))throw Error('Release already deployed; inspect verification instead.');
  for(const service of ['api','worker','web']){
    run(['image','inspect',`aibeego-${service}:subscription-tiers-20261122`]);
    const info=JSON.parse(run(['inspect',`marketingspa-${service}`]))[0];
    assert.equal(info.Config.Labels['com.docker.compose.project'],'aibeego');
    assert.equal(info.Image,manifest.images[service].id,'Running image changed since backup');
  }
  const version=JSON.parse(run(['run','--rm','--entrypoint','node','aibeego-web:subscription-tiers-20261122','-e',"console.log(require('fs').readFileSync('/app/public/landing-page-builder-version.json','utf8'))"]));
  assert(version.buildId);
  fs.copyFileSync(marker,path.join(dir,'previous-builder-version.json'));
  const oldPlans=JSON.parse(query('SELECT json_agg(row_to_json(p)) FROM subscription_plans p'));
  fs.writeFileSync(path.join(dir,'plans-before.json'),JSON.stringify(oldPlans,null,2));
  run([...compose,'stop','-t','30','worker','api']);servicesStopped=true;
  const before=JSON.parse(query(statsSql));
  const dump='/tmp/aibeego-subscription-cutover-20261122.dump';
  run(['exec','marketingspa-postgres','sh','-c','exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f "$1"','sh',dump]);
  run(['cp',`marketingspa-postgres:${dump}`,path.join(dir,'database-cutover.dump')]);
  assert(run(['exec','marketingspa-postgres','pg_restore','--list',dump]).includes('credit_wallets'));
  run(['cp',path.join(dir,'apply-migrations.sql'),'marketingspa-postgres:/tmp/aibeego-subscription-migrations.sql']);
  const migration=run(['exec','marketingspa-postgres','sh','-c','exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f /tmp/aibeego-subscription-migrations.sql']);
  assert(migration.includes('COMMIT'));schemaApplied=true;
  fs.writeFileSync(path.join(dir,'migration-result.txt'),migration);
  const after=JSON.parse(query(statsSql));assert.deepEqual(after,before,'Migration changed purchased subscriptions or wallet amounts');
  assert.equal(query("SELECT count(*) FROM subscription_plans WHERE code LIKE 'abg-%' AND is_active"),'9');
  fs.writeFileSync(marker,JSON.stringify(version));
  run([...compose,'up','-d','--no-deps','api','worker','web']);
  run(['exec','marketingspa-nginx','nginx','-t']);run(['exec','marketingspa-nginx','nginx','-s','reload']);
  const cutoverAt=Date.now();let ready=false;
  for(let attempt=0;attempt<100;attempt++){
    try{
      const health=await fetch('http://localhost:8080/api/v1/health',{signal:AbortSignal.timeout(4000)});
      const plansResponse=await fetch('http://localhost:8080/api/v1/billing/plans',{signal:AbortSignal.timeout(4000)});
      const body=await plansResponse.json(),plans=Array.isArray(body)?body:body.data;
      const worker=JSON.parse(run(['inspect','marketingspa-worker']))[0];
      const heartbeat=Number(run(['exec','marketingspa-redis','redis-cli','GET','marketingspa:worker:heartbeat']).trim());
      if(health.status===200&&plansResponse.status===200&&plans?.length===9&&worker.State.Running&&heartbeat>=cutoverAt-10000&&heartbeat>=Date.parse(worker.State.StartedAt)){ready=true;break;}
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,1500));
  }
  assert(ready,'New services did not become healthy');
  for(const service of ['api','worker','web'])run(['tag',`aibeego-${service}:subscription-tiers-20261122`,`aibeego-${service}`]);
  const result={target:manifest.target,migrations:manifest.pending.map(m=>m.name),images:['api','worker','web'],purchasedDataPreserved:true,before,after,builderVersion:version.buildId,deployedAt:new Date().toISOString()};
  fs.writeFileSync(path.join(dir,'deployment.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({deployed:true,target:manifest.target,plans:9,purchasedDataPreserved:true,workerHeartbeat:'fresh'}));
}
main().catch(error=>{
  console.error(`Deployment failed: ${error.message}`);
  if(servicesStopped){
    try{
      if(schemaApplied){
        const plans=JSON.parse(fs.readFileSync(path.join(dir,'plans-before.json'),'utf8'));
        let sql="BEGIN; UPDATE subscription_plans SET is_active=false WHERE code LIKE 'abg-%'; UPDATE credit_wallets SET plan_balance=0;\n";
        for(const p of plans)sql+=`UPDATE subscription_plans SET name=${q(p.name)},price_monthly=${q(p.price_monthly)},price_vnd=${q(p.price_vnd)},highlight_label=${q(p.highlight_label)},savings_amount=${q(p.savings_amount)},sort_order=${Number(p.sort_order)},features=${q(JSON.stringify(p.features))}::jsonb,is_active=${p.is_active?'true':'false'} WHERE id=${q(p.id)};\n`;
        query(sql+'COMMIT;');
      }
    }catch(rollbackError){console.error(`Catalogue rollback error: ${rollbackError.message}`);}
    try{
      if(fs.existsSync(path.join(dir,'previous-builder-version.json')))fs.copyFileSync(path.join(dir,'previous-builder-version.json'),marker);
      const rollback=path.join(dir,'rollback.yml');fs.writeFileSync(rollback,'services:\n'+Object.entries(manifest.images).map(([s,i])=>`  ${s}:\n    image: ${i.rollback}\n`).join(''));
      run(['compose','-p','aibeego','-f','docker-compose.yml','-f','docker-compose.local.yml','-f',rollback,'up','-d','--no-deps','api','worker','web']);
      run(['exec','marketingspa-nginx','nginx','-s','reload']);console.error('Restored previous application images; additive schema retained.');
    }catch(rollbackError){console.error(`Service rollback error: ${rollbackError.message}`);}
  }
  process.exitCode=1;
});
