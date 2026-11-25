// Dedicated disposable DB only. Never reads connection strings from .env.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'tmp/subscription-tiers-qa');
fs.mkdirSync(dir, { recursive: true });
let schema = fs.readFileSync(path.join(root, 'packages/database/prisma/schema.prisma'), 'utf8');
schema = schema
  .replace(/model PlanUsage \{[\s\S]*?\n\}/, '')
  .replace(/model PlanStoredFile \{[\s\S]*?\n\}/, '')
  .replace(/^  planBalance\s+.*\r?\n/m, '')
  .replace(/^  planPeriodKey\s+.*\r?\n/m, '');
const baseline = path.join(dir, 'baseline.prisma');
fs.writeFileSync(baseline, schema);
const env = {
  ...process.env,
  DATABASE_URL:
    'postgresql://planqa:planqa-local-only@127.0.0.1:15491/plan_tiers_qa_v2?schema=public',
};
const cli = path.join(root, 'node_modules/prisma/build/index.js');
execFileSync(process.execPath, [cli, 'db', 'push', '--schema', baseline, '--skip-generate'], {
  cwd: root,
  env,
  stdio: 'inherit',
});
execFileSync(
  process.execPath,
  [
    cli,
    'db',
    'execute',
    '--schema',
    baseline,
    '--file',
    path.join(
      root,
      'packages/database/prisma/migrations/20261122020000_subscription_tiers/migration.sql',
    ),
  ],
  { cwd: root, env, stdio: 'inherit' },
);
console.log('PASS: additive subscription migration on isolated PostgreSQL');
