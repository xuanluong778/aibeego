/**
 * Regression idempotency sales — DB QA riêng (marketingspa_sales_idem_qa).
 * Không dùng with-root-env: đọc .env chỉ để lấy POSTGRES_* rồi ép DATABASE_URL QA.
 *
 * Chuẩn (Docker network, sau `pnpm build` trong apps/api):
 *   docker run --rm --network aibeego_default -v "<repo>:/app" -w /app \
 *     -e DATABASE_URL=postgresql://<user>:<pass>@postgres:5432/marketingspa_sales_idem_qa?schema=public \
 *     -e NODE_OPTIONS=--require /app/node_modules/.pnpm/reflect-metadata@0.2.2/node_modules/reflect-metadata \
 *     node:20-bookworm-slim bash -c "corepack enable && pnpm --filter @marketingspa/database exec tsx ../../scripts/test-sales-idempotency-regression.ts"
 *
 * Hoặc: pnpm test:sales-idempotency (cần DATABASE_URL trỏ postgres:5432 từ container/host có network).
 */
const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');
const { spawnSync } = require('child_process');
const { assertSalesIdemQaDb, buildSalesIdemQaDatabaseUrl } = require('./sales-idem-qa-env.cjs');

const envPath = resolve(__dirname, '../.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i === -1) continue;
    const key = trimmed.slice(0, i).trim();
    const value = trimmed.slice(i + 1).trim();
    if (key === 'POSTGRES_USER' || key === 'POSTGRES_PASSWORD' || key === 'POSTGRES_DB') {
      if (process.env[key] === undefined) process.env[key] = value;
    }
    if (key === 'DATABASE_URL' && process.env.DATABASE_URL === undefined) {
      process.env.DATABASE_URL = value;
    }
  }
}

const user = process.env.POSTGRES_USER || 'marketingspa';
const pass = process.env.POSTGRES_PASSWORD || 'change_me_strong_password';
const qaUrl =
  process.env.SALES_IDEM_QA_DATABASE_URL ||
  `postgresql://${user}:${pass}@postgres:5432/marketingspa_sales_idem_qa?schema=public`;
process.env.DATABASE_URL = buildSalesIdemQaDatabaseUrl(qaUrl);
const dbName = assertSalesIdemQaDb(process.env.DATABASE_URL);
console.log(`[sales-idem-regression] DATABASE_URL → ${dbName}`);

const nodeOpts = process.env.NODE_OPTIONS ?? '';
if (!nodeOpts.includes('reflect-metadata')) {
  const reflectPath = resolve(__dirname, '../node_modules/.pnpm/reflect-metadata@0.2.2/node_modules/reflect-metadata');
  process.env.NODE_OPTIONS = `${nodeOpts} --require ${reflectPath}`.trim();
}

const fs = require('fs');
const cwd = resolve(__dirname, '..');
const pnpmDir = resolve(cwd, 'node_modules/.pnpm');
const tsxDir = fs.readdirSync(pnpmDir).find((d) => d.startsWith('tsx@'));
if (!tsxDir) throw new Error('Không tìm thấy tsx trong node_modules/.pnpm');
const tsxCli = resolve(pnpmDir, tsxDir, 'node_modules/tsx/dist/cli.mjs');
const nodePath = [
  resolve(cwd, 'apps/api/node_modules'),
  resolve(cwd, 'packages/database/node_modules'),
  process.env.NODE_PATH,
]
  .filter(Boolean)
  .join(process.platform === 'win32' ? ';' : ':');

const result = spawnSync(process.execPath, [tsxCli, 'scripts/test-sales-idempotency-regression.ts'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_PATH: nodePath },
  cwd,
});

process.exit(result.status ?? 1);