const { resolve } = require('path');
const { spawnSync } = require('child_process');
const { buildSalesIdemQaDatabaseUrl, assertSalesIdemQaDb } = require('./sales-idem-qa-env.cjs');
const { readFileSync, existsSync } = require('fs');
const fs = require('fs');

const envPath = resolve(__dirname, '../.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i === -1) continue;
    const key = trimmed.slice(0, i).trim();
    const value = trimmed.slice(i + 1).trim();
    if (key === 'POSTGRES_USER' || key === 'POSTGRES_PASSWORD') {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

const user = process.env.POSTGRES_USER || 'marketingspa';
const pass = process.env.POSTGRES_PASSWORD || 'change_me_strong_password';
process.env.DATABASE_URL = buildSalesIdemQaDatabaseUrl(
  process.env.SALES_IDEM_QA_DATABASE_URL ||
    `postgresql://${user}:${pass}@postgres:5432/marketingspa_sales_idem_qa?schema=public`,
);
assertSalesIdemQaDb(process.env.DATABASE_URL);

const cwd = resolve(__dirname, '..');
const pnpmDir = resolve(cwd, 'node_modules/.pnpm');
const tsxDir = fs.readdirSync(pnpmDir).find((d) => d.startsWith('tsx@'));
const tsxCli = resolve(pnpmDir, tsxDir, 'node_modules/tsx/dist/cli.mjs');
const reflectPath = resolve(pnpmDir, 'reflect-metadata@0.2.2/node_modules/reflect-metadata');
process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ''} --require ${reflectPath}`.trim();
const nodePath = [
  resolve(cwd, 'apps/api/node_modules'),
  resolve(cwd, 'packages/database/node_modules'),
]
  .filter(Boolean)
  .join(process.platform === 'win32' ? ';' : ':');

const r = spawnSync(process.execPath, [tsxCli, 'scripts/test-sales-module-hardening-qa.ts'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_PATH: nodePath },
  cwd,
});
process.exit(r.status ?? 1);