const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'tmp/six-month-bonus-20261122');
const run=(args,input)=>execFileSync('docker',args,{cwd:root,input,encoding:'utf8',stdio:['pipe','pipe','pipe']});
const node=input=>JSON.parse(run(['exec','-i','marketingspa-api','node'],input));
const snapshot=`async function snapshot(prisma){return {
  plans:await prisma.subscriptionPlan.findMany({orderBy:{code:'asc'}}),
  protectedRows:await prisma.$queryRawUnsafe(\`SELECT
  (SELECT md5(coalesce(string_agg(to_jsonb(p)::text,'|' ORDER BY p.id),'')) FROM payment_orders p) AS orders,
  (SELECT md5(coalesce(string_agg(to_jsonb(s)::text,'|' ORDER BY s.id),'')) FROM subscriptions s) AS subscriptions\`)
};}`;
async function main(){
  fs.mkdirSync(dir,{recursive:true});
  const images={};
  for(const service of ['api','web']){
    run(['image','inspect',`aibeego-${service}:six-month-bonus-20261122`]);
    const state=JSON.parse(run(['inspect',`marketingspa-${service}`]))[0];
    assert.equal(state.Config.Labels['com.docker.compose.project'],'aibeego');
    images[service]=state.Config.Image;
    run(['tag',state.Image,`aibeego-${service}:before-six-month-bonus-20261122`]);
  }
  const before=node(`const {prisma}=require('@marketingspa/database');${snapshot}snapshot(prisma).then(v=>console.log(JSON.stringify(v))).finally(()=>prisma.$disconnect());`);
  const backup=path.join(dir,'before.json');
  if(fs.existsSync(backup))throw Error('Deployment backup exists; inspect before rerunning');
  fs.writeFileSync(backup,JSON.stringify({images,...before},null,2));
  const migration='20261122040000_pro_6m_restore_price_bonus';
  const sql=fs.readFileSync(path.join(root,'packages/database/prisma/migrations',migration,'migration.sql'),'utf8');
  const checksum=crypto.createHash('sha256').update(sql).digest('hex');
  const after=node(`const {prisma}=require('@marketingspa/database');${snapshot}(async()=>{
    await prisma.$transaction(async tx=>{
      await tx.$executeRawUnsafe(${JSON.stringify(sql)});
      await tx.$executeRawUnsafe('INSERT INTO _prisma_migrations(id,checksum,migration_name,started_at,finished_at,applied_steps_count) VALUES($1,$2,$3,NOW(),NOW(),1)',require('crypto').randomUUID(),${JSON.stringify(checksum)},${JSON.stringify(migration)});
    });console.log(JSON.stringify(await snapshot(prisma)));
  })().finally(()=>prisma.$disconnect());`);
  assert.deepEqual(after.protectedRows,before.protectedRows);
  assert.deepEqual(after.plans.filter(p=>p.code!=='abg-pro-6m'),before.plans.filter(p=>p.code!=='abg-pro-6m'));
  assert.equal(Number(after.plans.find(p=>p.code==='abg-pro-6m').priceVnd),4800000);
  run(['compose','-p','aibeego','-f','docker-compose.yml','-f','docker-compose.local.yml','-f','deploy/local-subscription-tiers.yml','-f','deploy/local-template-bulk-route-fix.yml','-f','deploy/local-six-month-bonus.yml','up','-d','--no-deps','--no-build','api','web']);
  run(['exec','marketingspa-nginx','nginx','-t']);run(['exec','marketingspa-nginx','nginx','-s','reload']);
  let ready=false;
  for(let i=0;i<50;i++){
    try{
      const r=await fetch('http://localhost:8080/api/v1/billing/plans',{signal:AbortSignal.timeout(3000)});
      const plans=await r.json();
      const items=Array.isArray(plans)?plans:plans.data;
      const pro=items.find(p=>p.code==='abg-pro-6m'),vip=items.find(p=>p.code==='abg-vip-6m');
      if(Number(pro.priceVnd)===4800000&&pro.bonusMonths===1&&vip.bonusMonths===1){ready=true;break;}
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,1500));
  }
  assert(ready,'API readiness failed; previous images are saved in before.json');
  fs.writeFileSync(path.join(dir,'deployment.json'),JSON.stringify({deployedAt:new Date().toISOString(),proPrice:4800000,proUsageMonths:7,vipUsageMonths:7,existingOrdersAndSubscriptionsPreserved:true},null,2));
  console.log('PASS: deployed Pro 4,800,000 VND; Pro/VIP 6+1 months; existing orders/subscriptions preserved.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
