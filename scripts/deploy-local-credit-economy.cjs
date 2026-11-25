const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'tmp/credit-economy-20261122');
const run=args=>execFileSync('docker',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
const query=sql=>run(['exec','marketingspa-postgres','sh','-c','exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -t -A -c "$1"','sh',sql]).trim();
const compose=['compose','-p','aibeego','-f','docker-compose.yml','-f','docker-compose.local.yml','-f','deploy/local-subscription-tiers.yml','-f','deploy/local-template-bulk-route-fix.yml','-f','deploy/local-six-month-bonus.yml','-f','deploy/local-compact-header.yml'];
const stats=`SELECT json_build_object(
 'plans',(SELECT json_agg(p ORDER BY p.code) FROM subscription_plans p),
 'pricing',(SELECT json_agg(p ORDER BY p.feature_code) FROM credit_feature_pricing p),
 'ordersHash',(SELECT md5(coalesce(string_agg(to_jsonb(p)::text,'|' ORDER BY p.id),'')) FROM payment_orders p),
 'subscriptionsHash',(SELECT md5(coalesce(string_agg(to_jsonb(s)::text,'|' ORDER BY s.id),'')) FROM subscriptions s),
 'walletsHash',(SELECT md5(coalesce(string_agg(to_jsonb(w)::text,'|' ORDER BY w.id),'')) FROM credit_wallets w),
 'transactionsHash',(SELECT md5(coalesce(string_agg(to_jsonb(t)::text,'|' ORDER BY t.id),'')) FROM credit_transactions t))`;
const q=value=>value==null?'NULL':"'"+String(value).replace(/'/g,"''")+"'";
let stopped=false,applied=false;
async function main(){
  fs.mkdirSync(dir,{recursive:true});
  if(fs.existsSync(path.join(dir,'deployment.json')))throw Error('Release already deployed');
  const images={};
  for(const service of ['api','worker','web']){
    run(['image','inspect',`aibeego-${service}:credit-economy-20261122`]);
    const state=JSON.parse(run(['inspect',`marketingspa-${service}`]))[0];
    assert.equal(state.Config.Labels['com.docker.compose.project'],'aibeego');
    images[service]=`aibeego-${service}:before-credit-economy-20261122`;
    run(['tag',state.Image,images[service]]);
  }
  run([...compose,'stop','-t','30','api','worker']);stopped=true;
  const before=JSON.parse(query(stats));
  fs.writeFileSync(path.join(dir,'before.json'),JSON.stringify({images,...before},null,2));
  const dump='/tmp/aibeego-before-credit-economy-20261122.dump';
  run(['exec','marketingspa-postgres','sh','-c','exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f "$1"','sh',dump]);
  run(['cp',`marketingspa-postgres:${dump}`,path.join(dir,'database-before.dump')]);
  const contents=run(['exec','marketingspa-postgres','pg_restore','--list',dump]);
  assert(contents.includes('credit_wallets')&&contents.includes('credit_transactions'));
  const migration='20261122050000_credit_economy';
  const sql=fs.readFileSync(path.join(root,'packages/database/prisma/migrations',migration,'migration.sql'),'utf8');
  const checksum=crypto.createHash('sha256').update(sql).digest('hex');
  let rollback='BEGIN;\n';
  for(const p of before.plans)rollback+=`UPDATE subscription_plans SET credits_included=${p.credits_included} WHERE code=${q(p.code)};\n`;
  for(const p of before.pricing||[])rollback+=`UPDATE credit_feature_pricing SET name=${q(p.name)},credit_cost=${p.credit_cost},description=${q(p.description)},is_active=${p.is_active},sort_order=${p.sort_order},updated_at=${q(p.updated_at)} WHERE feature_code=${q(p.feature_code)};\n`;
  rollback+=`DELETE FROM credit_feature_pricing WHERE id LIKE 'credit-economy-%' AND feature_code NOT IN (${(before.pricing||[]).map(p=>q(p.feature_code)).join(',')||"''"});\nDELETE FROM _prisma_migrations WHERE migration_name=${q(migration)};\nCOMMIT;\n`;
  fs.writeFileSync(path.join(dir,'rollback-pricing.sql'),rollback);
  const apply=`BEGIN;\nSELECT pg_advisory_xact_lock(hashtext('credit-economy-20261122'));\n${sql}\nINSERT INTO _prisma_migrations(id,checksum,migration_name,started_at,finished_at,applied_steps_count) VALUES(${q(crypto.randomUUID())},${q(checksum)},${q(migration)},NOW(),NOW(),1);\nCOMMIT;\n`;
  fs.writeFileSync(path.join(dir,'apply.sql'),apply);
  run(['cp',path.join(dir,'apply.sql'),'marketingspa-postgres:/tmp/apply-credit-economy.sql']);
  run(['exec','marketingspa-postgres','sh','-c','exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f /tmp/apply-credit-economy.sql']);applied=true;
  const after=JSON.parse(query(stats));
  for(const key of ['ordersHash','subscriptionsHash','walletsHash','transactionsHash'])assert.equal(after[key],before[key],key);
  assert.equal(after.plans.find(p=>p.code==='abg-pro-6m').price_vnd,4800000);
  fs.writeFileSync(path.join(dir,'after-migration.json'),JSON.stringify(after,null,2));
  const rollbackCompose=path.join(dir,'rollback.yml');
  fs.writeFileSync(rollbackCompose,'services:\n'+Object.entries(images).map(([s,image])=>`  ${s}:\n    image: ${image}\n`).join(''));
  run([...compose,'-f','deploy/local-credit-economy.yml','up','-d','--no-deps','--no-build','api','worker','web']);
  run(['exec','marketingspa-nginx','nginx','-t']);run(['exec','marketingspa-nginx','nginx','-s','reload']);
  let ready=false;
  for(let i=0;i<50;i++){
    try{
      const r=await fetch('http://localhost:8080/api/v1/billing/plans',{signal:AbortSignal.timeout(3000)});
      const body=await r.json(),plans=Array.isArray(body)?body:body.data;
      const credits=plans.filter(p=>p.durationMonths===1).map(p=>p.entitlement?.monthlyCredits);
      const worker=JSON.parse(run(['inspect','marketingspa-worker']))[0];
      const heartbeat=Number(run(['exec','marketingspa-redis','redis-cli','GET','marketingspa:worker:heartbeat']).trim());
      if(JSON.stringify(credits)==='[5000,15000,45000]'&&worker.State.Running&&heartbeat>=Date.parse(worker.State.StartedAt)){ready=true;break;}
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,1500));
  }
  assert(ready,'Services did not become ready');
  const result={deployedAt:new Date().toISOString(),monthlyCredits:[5000,15000,45000],pricingRows:after.pricing.length,existingOrdersAndSubscriptionsPreserved:true,walletsAndHistoryUnchangedByMigration:true,workerHeartbeat:'fresh'};
  fs.writeFileSync(path.join(dir,'deployment.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(error=>{
  console.error(error.message);
  if(stopped){try{
    if(applied){run(['cp',path.join(dir,'rollback-pricing.sql'),'marketingspa-postgres:/tmp/rollback-credit-economy.sql']);run(['exec','marketingspa-postgres','sh','-c','exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f /tmp/rollback-credit-economy.sql']);}
    const rollback=path.join(dir,'rollback.yml');
    if(fs.existsSync(rollback))run([...compose,'-f',rollback,'up','-d','--no-deps','--no-build','api','worker','web']);else run([...compose,'start','api','worker']);
    run(['exec','marketingspa-nginx','nginx','-s','reload']);
    console.error('Restored previous services and pricing; backup retained.');
  }catch(rollbackError){console.error('Rollback error: '+rollbackError.message);}}
  process.exitCode=1;
});
