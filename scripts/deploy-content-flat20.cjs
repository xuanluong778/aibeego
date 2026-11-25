const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'tmp/content-flat20-20261122');
const run=(args,input)=>execFileSync('docker',args,{cwd:root,input,encoding:'utf8',stdio:['pipe','pipe','pipe']});
const query=sql=>run(['exec','marketingspa-postgres','sh','-c','exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -t -A -c "$1"','sh',sql]).trim();
const compose=['compose','-p','aibeego','-f','docker-compose.yml','-f','docker-compose.local.yml','-f','deploy/local-subscription-tiers.yml','-f','deploy/local-template-bulk-route-fix.yml','-f','deploy/local-six-month-bonus.yml','-f','deploy/local-compact-header.yml','-f','deploy/local-credit-economy.yml','-f','deploy/local-admin-credit-costs.yml','-f','deploy/local-credit-costs-review.yml'];
const q=value=>value==null?'NULL':"'"+String(value).replace(/'/g,"''")+"'";
const targets=['content_ai.generate','content_ai.suggest'];let stopped=false,applied=false;
async function main(){
  assert(!fs.existsSync(path.join(dir,'deployment.json')),'Already deployed');
  const images={};for(const service of ['api','web']){run(['image','inspect',`aibeego-${service}:content-flat20-20261122`]);const state=JSON.parse(run(['inspect',`marketingspa-${service}`]))[0];assert.equal(state.Config.Labels['com.docker.compose.project'],'aibeego');images[service]=`aibeego-${service}:before-content-flat20-20261122`;run(['tag',state.Image,images[service]]);}
  const actor=JSON.parse(run(['exec','-i','marketingspa-api','node'],`const {prisma}=require('@marketingspa/database');prisma.user.findFirstOrThrow({where:{isActive:true,deletedAt:null,role:{code:'SUPER_ADMIN'}},select:{id:true,organizationId:true}}).then(r=>console.log(JSON.stringify(r))).finally(()=>prisma.$disconnect());`));
  const before=JSON.parse(query('SELECT json_agg(p ORDER BY p.feature_code) FROM credit_feature_pricing p'));
  const plansBefore=query("SELECT json_agg(p ORDER BY p.code) FROM subscription_plans p WHERE code LIKE 'abg-%'");
  fs.writeFileSync(path.join(dir,'before.json'),JSON.stringify({images,pricing:before,plans:JSON.parse(plansBefore)},null,2));
  fs.writeFileSync(path.join(dir,'rollback.yml'),'services:\n'+Object.entries(images).map(([s,image])=>`  ${s}:\n    image: ${image}\n`).join(''));
  const migration='20261122070000_content_flat_request_price',auditId=crypto.randomUUID();
  let rollback='BEGIN;\n';for(const row of before.filter(r=>targets.includes(r.feature_code)))rollback+=`UPDATE credit_feature_pricing SET credit_cost=${Number(row.credit_cost)},description=${q(row.description)},updated_at=${q(row.updated_at)} WHERE feature_code=${q(row.feature_code)};\n`;
  rollback+=`DELETE FROM audit_logs WHERE id=${q(auditId)};\nDELETE FROM _prisma_migrations WHERE migration_name=${q(migration)};\nCOMMIT;\n`;
  fs.writeFileSync(path.join(dir,'rollback.sql'),rollback);
  const sql=fs.readFileSync(path.join(root,'packages/database/prisma/migrations',migration,'migration.sql'),'utf8'),checksum=crypto.createHash('sha256').update(sql).digest('hex');
  const metadata={features:targets,before:before.filter(r=>targets.includes(r.feature_code)).map(r=>({featureCode:r.feature_code,creditCost:Number(r.credit_cost)})),after:20,billingMode:'flat-per-request',source:'user-request'};
  const apply=`BEGIN;\n${sql}\nINSERT INTO _prisma_migrations(id,checksum,migration_name,started_at,finished_at,applied_steps_count) VALUES(${q(crypto.randomUUID())},${q(checksum)},${q(migration)},NOW(),NOW(),1);\nINSERT INTO audit_logs(id,organization_id,user_id,action,entity_type,entity_id,metadata,created_at) VALUES(${q(auditId)},${q(actor.organizationId)},${q(actor.id)},'PLATFORM_CONTENT_CREDIT_POLICY_UPDATED','CreditFeaturePricing','content_ai',${q(JSON.stringify(metadata))}::jsonb,NOW());\nCOMMIT;\n`;
  fs.writeFileSync(path.join(dir,'apply.sql'),apply);
  run([...compose,'stop','-t','30','api']);stopped=true;
  run(['cp',path.join(dir,'apply.sql'),'marketingspa-postgres:/tmp/apply-content-flat20.sql']);run(['exec','marketingspa-postgres','sh','-c','exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f /tmp/apply-content-flat20.sql']);applied=true;
  const after=JSON.parse(query('SELECT json_agg(p ORDER BY p.feature_code) FROM credit_feature_pricing p'));
  assert.deepEqual(after.filter(r=>!targets.includes(r.feature_code)),before.filter(r=>!targets.includes(r.feature_code)));
  assert.equal(query("SELECT json_agg(p ORDER BY p.code) FROM subscription_plans p WHERE code LIKE 'abg-%'"),plansBefore);
  for(const code of targets)assert.equal(Number(after.find(r=>r.feature_code===code).credit_cost),20);
  run([...compose,'-f','deploy/local-content-flat20.yml','up','-d','--no-deps','--no-build','api','web']);run(['exec','marketingspa-nginx','nginx','-t']);run(['exec','marketingspa-nginx','nginx','-s','reload']);
  let ready=false;for(let i=0;i<40;i++){try{const api=await fetch('http://localhost:8080/api/v1/health',{signal:AbortSignal.timeout(3000)}),web=await fetch('http://localhost:8080/login',{signal:AbortSignal.timeout(3000)});if(api.ok&&web.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,1000));}
  assert(ready,'API/web readiness failed');
  const result={deployedAt:new Date().toISOString(),contentGenerate:20,contentSuggest:20,billingMode:'once-per-request',otherPricesPreserved:true,monthlyLimitsPreserved:true};
  fs.writeFileSync(path.join(dir,'deployment.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error.message);if(stopped){try{if(applied){run(['cp',path.join(dir,'rollback.sql'),'marketingspa-postgres:/tmp/rollback-content-flat20.sql']);run(['exec','marketingspa-postgres','sh','-c','exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f /tmp/rollback-content-flat20.sql']);}run([...compose,'-f',path.join(dir,'rollback.yml'),'up','-d','--no-deps','--no-build','api','web']);run(['exec','marketingspa-nginx','nginx','-s','reload']);console.error('Restored previous images and Content credit settings.');}catch(e){console.error(e.message);}}process.exitCode=1;});
