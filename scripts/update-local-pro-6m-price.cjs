const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'tmp/pro-6m-price-20261122');
fs.mkdirSync(dir, { recursive: true });
const migration = '20261122030000_pro_6m_price_4m';
const sql = fs.readFileSync(path.join(root, 'packages/database/prisma/migrations', migration, 'migration.sql'), 'utf8');
const checksum = crypto.createHash('sha256').update(sql).digest('hex');
const run = input => JSON.parse(execFileSync('docker', ['exec', '-i', 'marketingspa-api', 'node'], {
  input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
}));
const snapshot = `async function snapshot(prisma) {
  const plans = await prisma.subscriptionPlan.findMany({orderBy:{code:'asc'}});
  const [protectedRows] = await prisma.$queryRawUnsafe(\`SELECT
    (SELECT md5(coalesce(string_agg(to_jsonb(p)::text,'|' ORDER BY p.id),'')) FROM payment_orders p) AS orders,
    (SELECT md5(coalesce(string_agg(to_jsonb(s)::text,'|' ORDER BY s.id),'')) FROM subscriptions s) AS subscriptions\`);
  return {plans,protectedRows};
}`;
const before = run(`const {prisma}=require('@marketingspa/database');${snapshot}
snapshot(prisma).then(v=>console.log(JSON.stringify(v))).finally(()=>prisma.$disconnect());`);
const backup = path.join(dir, 'before.json');
if (!fs.existsSync(backup)) fs.writeFileSync(backup, JSON.stringify(before, null, 2));
assert(before.plans.some(p => p.code === 'abg-pro-6m'));
const after = run(`const {prisma}=require('@marketingspa/database');${snapshot}
(async()=>{
  await prisma.$transaction(async tx=>{
    await tx.$executeRawUnsafe(${JSON.stringify(sql)});
    const rows=await tx.$queryRawUnsafe('SELECT id FROM _prisma_migrations WHERE migration_name=$1 AND finished_at IS NOT NULL AND rolled_back_at IS NULL',${JSON.stringify(migration)});
    if(!rows.length) await tx.$executeRawUnsafe('INSERT INTO _prisma_migrations(id,checksum,migration_name,started_at,finished_at,applied_steps_count) VALUES($1,$2,$3,NOW(),NOW(),1)',require('node:crypto').randomUUID(),${JSON.stringify(checksum)},${JSON.stringify(migration)});
  });
  console.log(JSON.stringify(await snapshot(prisma)));
})().finally(()=>prisma.$disconnect());`);
assert.deepEqual(after.protectedRows, before.protectedRows);
assert.deepEqual(after.plans.filter(p => p.code !== 'abg-pro-6m'), before.plans.filter(p => p.code !== 'abg-pro-6m'));
const plan = after.plans.find(p => p.code === 'abg-pro-6m');
assert.equal(Number(plan.priceVnd), 4000000);
assert.equal(Number(plan.priceMonthly), 666666.67);
assert.equal(Number(plan.savingsAmount), 800000);
fs.writeFileSync(path.join(dir, 'after.json'), JSON.stringify(after, null, 2));
console.log(JSON.stringify({updated:plan.code,priceVnd:Number(plan.priceVnd),existingOrdersAndSubscriptionsPreserved:true,otherPlansPreserved:true}));
