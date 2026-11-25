const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..'), dir = path.join(root, 'tmp/local-subscription-release-20261122');
fs.mkdirSync(dir, { recursive: true });
const run = args => execFileSync('docker', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const query = sql => run(['exec', 'marketingspa-postgres', 'sh', '-c', 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -t -A -c "$1"', 'sh', sql]).trim();
if (fs.existsSync(path.join(dir, 'manifest.json'))) throw Error('Release backup already exists; inspect instead of overwriting.');
const images = {};
for (const service of ['api', 'worker', 'web']) {
  const info = JSON.parse(run(['inspect', `marketingspa-${service}`]))[0];
  if (info.Config.Labels['com.docker.compose.project'] !== 'aibeego') throw Error('Wrong Docker project');
  const rollback = `aibeego-${service}:before-subscription-tiers-20261122`;
  run(['tag', info.Image, rollback]);
  images[service] = { id: info.Image, rollback };
}
const before = JSON.parse(query(`SELECT json_build_object(
 'subscriptions',(SELECT count(*) FROM subscriptions),
 'orders',(SELECT count(*) FROM payment_orders),
 'wallets',(SELECT count(*) FROM credit_wallets),
 'subscriptionHash',(SELECT md5(COALESCE(string_agg(jsonb_build_array(id,organization_id,plan_id,status,current_period_start,current_period_end)::text,'|' ORDER BY id),'')) FROM subscriptions),
 'walletHash',(SELECT md5(COALESCE(string_agg(jsonb_build_array(id,organization_id,balance,reserved_balance,lifetime_earned,lifetime_used)::text,'|' ORDER BY id),'')) FROM credit_wallets))`));
const dump = '/tmp/aibeego-before-subscription-tiers-20261122.dump';
run(['exec','marketingspa-postgres','sh','-c','exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f "$1"','sh',dump]);
run(['cp', `marketingspa-postgres:${dump}`, path.join(dir,'database-before.dump')]);
const listing=run(['exec','marketingspa-postgres','pg_restore','--list',dump]);
if (!listing.includes('subscriptions') || !listing.includes('credit_wallets')) throw Error('Backup verification failed');
fs.writeFileSync(path.join(dir,'backup-contents.txt'),listing);
const names=['20261122000000_pro_monthly_plan','20261122010000_pro_prices_and_features','20261122020000_subscription_tiers'];
const pending=[];
for(const name of names) {
  if(query(`SELECT count(*) FROM _prisma_migrations WHERE migration_name='${name}' AND finished_at IS NOT NULL AND rolled_back_at IS NULL`)!=='0')continue;
  const bytes=fs.readFileSync(path.join(root,'packages/database/prisma/migrations',name,'migration.sql'));
  pending.push({name,checksum:crypto.createHash('sha256').update(bytes).digest('hex'),sql:bytes.toString('utf8')});
}
if(query("SELECT count(*) FROM information_schema.columns WHERE table_name='credit_wallets' AND column_name='plan_balance'")!=='0') throw Error('Tier schema already exists; inspect state');
let sql="BEGIN;\nSELECT pg_advisory_xact_lock(hashtext('aibeego-local-subscription-release'));\n";
for(const migration of pending) sql+=`${migration.sql}\nINSERT INTO _prisma_migrations(id,checksum,migration_name,started_at,finished_at,applied_steps_count) VALUES('${crypto.randomUUID()}','${migration.checksum}','${migration.name}',NOW(),NOW(),1);\n`;
sql+='COMMIT;\n';
fs.writeFileSync(path.join(dir,'apply-migrations.sql'),sql);
fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({target:'local Docker http://localhost:8080',images,before,pending:pending.map(({name,checksum})=>({name,checksum})),backupBytes:fs.statSync(path.join(dir,'database-before.dump')).size},null,2));
console.log(JSON.stringify({backupVerified:true,pending:pending.map(m=>m.name),images:Object.keys(images),before,backupBytes:fs.statSync(path.join(dir,'database-before.dump')).size}));
