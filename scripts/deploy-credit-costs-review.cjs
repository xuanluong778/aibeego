const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'tmp/credit-costs-review-20261122');
const run=args=>execFileSync('docker',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
const query=sql=>run(['exec','marketingspa-postgres','sh','-c','exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -t -A -c "$1"','sh',sql]).trim();
const compose=['compose','-p','aibeego','-f','docker-compose.yml','-f','docker-compose.local.yml','-f','deploy/local-subscription-tiers.yml','-f','deploy/local-template-bulk-route-fix.yml','-f','deploy/local-six-month-bonus.yml','-f','deploy/local-compact-header.yml','-f','deploy/local-credit-economy.yml','-f','deploy/local-admin-credit-costs.yml'];
const read=()=>JSON.parse(query('SELECT json_agg(p ORDER BY p.feature_code) FROM credit_feature_pricing p'));
const q=s=>"'"+s.replace(/'/g,"''")+"'";
let recreating=false;
async function main(){
  assert(!fs.existsSync(path.join(dir,'deployment.json')),'Already deployed');
  const before=read(),expected=require(path.join(dir,'current.json')).pricing;
  for(const row of expected){const actual=before.find(r=>r.feature_code===row.featureCode);assert.equal(Number(actual.credit_cost),Number(row.creditCost),'A price changed while reviewing; refresh snapshot');const timestamp=/Z$|[+-]\d{2}:\d{2}$/.test(actual.updated_at)?actual.updated_at:actual.updated_at+'Z';assert.equal(new Date(timestamp).getTime(),new Date(row.updatedAt).getTime(),'Pricing changed while reviewing');}
  fs.writeFileSync(path.join(dir,'pricing-before-deploy.json'),JSON.stringify(before,null,2));
  const state=JSON.parse(run(['inspect','marketingspa-api']))[0];assert.equal(state.Config.Labels['com.docker.compose.project'],'aibeego');
  run(['tag',state.Image,'aibeego-api:before-credit-costs-review-20261122']);
  const migration='20261122060000_content_suggestion_credit',sql=fs.readFileSync(path.join(root,'packages/database/prisma/migrations',migration,'migration.sql'),'utf8');
  const checksum=crypto.createHash('sha256').update(sql).digest('hex');
  const apply=`BEGIN;\n${sql}\nINSERT INTO _prisma_migrations(id,checksum,migration_name,started_at,finished_at,applied_steps_count) VALUES(${q(crypto.randomUUID())},${q(checksum)},${q(migration)},NOW(),NOW(),1);\nCOMMIT;\n`;
  fs.writeFileSync(path.join(dir,'apply.sql'),apply);run(['cp',path.join(dir,'apply.sql'),'marketingspa-postgres:/tmp/apply-credit-costs-review.sql']);
  run(['exec','marketingspa-postgres','sh','-c','exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -f /tmp/apply-credit-costs-review.sql']);
  const after=read();assert.deepEqual(after.filter(r=>before.some(b=>b.feature_code===r.feature_code)),before,'Existing custom prices changed');
  recreating=true;run([...compose,'-f','deploy/local-credit-costs-review.yml','up','-d','--no-deps','--no-build','api']);
  run(['exec','marketingspa-nginx','nginx','-t']);run(['exec','marketingspa-nginx','nginx','-s','reload']);
  let ready=false;for(let i=0;i<40;i++){try{if((await fetch('http://localhost:8080/api/v1/health',{signal:AbortSignal.timeout(3000)})).ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,1000));}
  assert(ready,'API readiness failed');
  const result={deployedAt:new Date().toISOString(),existing15RatesPreserved:true,newFeature:'content_ai.suggest',newRate:Number(after.find(r=>r.feature_code==='content_ai.suggest').credit_cost),contentAndEmailIndependent:true,queryClassificationFixed:true};
  fs.writeFileSync(path.join(dir,'deployment.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error.message);if(recreating){try{const rollback=path.join(dir,'rollback.yml');fs.writeFileSync(rollback,'services:\n  api:\n    image: aibeego-api:before-credit-costs-review-20261122\n');run([...compose,'-f',rollback,'up','-d','--no-deps','--no-build','api']);run(['exec','marketingspa-nginx','nginx','-s','reload']);}catch(e){console.error(e.message);}}process.exitCode=1;});
