/**
 * Sidecar API QA (port 4001) + seed — không đổi marketingspa-api / DB vận hành.
 * Web: mở http://localhost:3001 với NEXT_PUBLIC_API_URL=http://localhost:4001
 */
const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');
const { spawnSync } = require('child_process');
const { assertHrmFinanceQaDb } = require('./hrm-finance-qa-env.cjs');

const cwd = resolve(__dirname, '..');
const envPath = resolve(cwd, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    const value = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if ((key === 'POSTGRES_USER' || key === 'POSTGRES_PASSWORD') && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const user = process.env.POSTGRES_USER || 'marketingspa';
const pass = process.env.POSTGRES_PASSWORD || 'change_me_strong_password';
const port = process.env.HRM_FINANCE_QA_PORT || '15432';
const dbName = 'marketingspa_hrm_finance_qa';
const databaseUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@127.0.0.1:${port}/${dbName}?schema=public`;
assertHrmFinanceQaDb(databaseUrl);
process.env.DATABASE_URL = databaseUrl;

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: false, ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
  return r;
}

const qaNet = String(
  spawnSync('docker', ['inspect', 'marketingspa-postgres', '--format', '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}'], {
    encoding: 'utf8',
  }).stdout || '',
).trim();
if (!qaNet) {
  console.error('Cần container marketingspa-postgres');
  process.exit(1);
}

const internalUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@marketingspa-postgres:5432/${dbName}?schema=public`;

const exists = spawnSync(
  'docker',
  ['exec', 'marketingspa-postgres', 'psql', '-U', user, '-d', 'postgres', '-tAc', `SELECT 1 FROM pg_database WHERE datname='${dbName}'`],
  { encoding: 'utf8' },
);
if (!String(exists.stdout).trim()) {
  console.error(`Database ${dbName} chưa có — chạy node scripts/run-hrm-finance-rbac-http.cjs trước`);
  process.exit(1);
}

const tunnelName = 'hrm-finance-qa-tunnel';
const tunnel = spawnSync('docker', ['inspect', '-f', '{{.State.Running}}', tunnelName], { encoding: 'utf8' });
if (String(tunnel.stdout).trim() !== 'true') {
  console.log(`[browser-qa] mở cổng Postgres QA ${port}`);
  run('docker', [
    'run',
    '-d',
    '--name',
    tunnelName,
    '--network',
    qaNet,
    '-p',
    `127.0.0.1:${port}:5432`,
    'alpine/socat',
    'tcp-listen:5432,fork,reuseaddr',
    'tcp-connect:marketingspa-postgres:5432',
  ]);
}

console.log('[browser-qa] seed users (marketingspa-api → QA DB)');
run('docker', [
  'cp',
  resolve(cwd, 'scripts/seed-hrm-finance-qa-browser-dist.cjs'),
  'marketingspa-api:/tmp/seed-hrm-finance-qa-browser-dist.cjs',
]);
const seed = spawnSync(
  'docker',
  [
    'exec',
    '-e',
    `DATABASE_URL=${internalUrl}`,
    'marketingspa-api',
    'node',
    '-r',
    '/app/node_modules/reflect-metadata',
    '/tmp/seed-hrm-finance-qa-browser-dist.cjs',
  ],
  { cwd, stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '' } },
);
if (seed.status !== 0) process.exit(seed.status ?? 1);

const apiImage = spawnSync('docker', ['inspect', '-f', '{{.Config.Image}}', 'marketingspa-api'], { encoding: 'utf8' });
const image = String(apiImage.stdout || 'marketingspa-api').trim() || 'marketingspa-api';

spawnSync('docker', ['rm', '-f', 'marketingspa-api-qa'], { stdio: 'ignore' });

if (!existsSync(resolve(cwd, 'apps/api/dist/main.js'))) {
  console.error('Thiếu apps/api/dist — chạy run-hrm-finance-rbac-http.cjs (build) trước');
  process.exit(1);
}

const envFileArgs = existsSync(envPath) ? ['--env-file', envPath] : [];
console.log('[browser-qa] khởi động marketingspa-api-qa :4001');
run('docker', [
  'run',
  '-d',
  '--name',
  'marketingspa-api-qa',
  '--network',
  qaNet,
  '-p',
  '127.0.0.1:4001:4000',
  ...envFileArgs,
  '-e',
  `DATABASE_URL=${internalUrl}`,
  '-e',
  'REDIS_URL=redis://redis:6379',
  '-e',
  'HRM_PERMISSIONS_ENFORCE=true',
  '-e',
  'HOST=0.0.0.0',
  '-v',
  `${resolve(cwd, 'apps/api/dist')}:/app/dist:ro`,
  image,
  'node',
  'dist/main.js',
]);

async function waitForApiReady() {
  console.log('[browser-qa] đợi API sẵn sàng…');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await sleep(8000);
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://127.0.0.1:4001/api/v1/health');
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    await sleep(2000);
  }
  console.warn('[browser-qa] API chưa phản hồi health sau ~68s');
  return false;
}

async function qaOverviewApiChecks() {
  async function login(email) {
    const res = await fetch('http://127.0.0.1:4001/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'QaOverview1!' }),
    });
    const json = await res.json();
    return json.accessToken;
  }
  async function status(method, path, token) {
    const res = await fetch(`http://127.0.0.1:4001/api/v1${path}`, {
      method,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    return res.status;
  }
  const crmTok = await login('qa-crm-only@example.invalid');
  const finTok = await login('qa-finance-read@example.invalid');
  if (!crmTok || !finTok) {
    console.warn('[browser-qa] bỏ qua kiểm tra API — chưa login được');
    return;
  }
  console.log('[browser-qa] kiểm tra API Tổng quan (thay UI khi web dev chưa chạy):');
  const checks = [
    ['GET', '/finance/dashboard?period=day', crmTok, 403],
    ['GET', '/leads/pipeline-counts', crmTok, 200],
    ['GET', '/finance/dashboard?period=day', finTok, 200],
  ];
  let failed = false;
  for (const [method, path, token, expect] of checks) {
    const code = await status(method, path, token);
    const ok = code === expect;
    console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${method} ${path} → ${code} (mong đợi ${expect})`);
    if (!ok) failed = true;
  }
  if (failed) process.exitCode = 2;
}

(async () => {
  try {
    await waitForApiReady();
    await qaOverviewApiChecks();
  } catch (err) {
    console.warn('[browser-qa] kiểm tra API lỗi:', err?.message || err);
  }
  console.log(`
[browser-qa] API QA: http://127.0.0.1:4001
Đăng nhập (DB QA):
  CRM không finance.read — qa-crm-only@example.invalid / QaOverview1!
  Đủ finance.read       — qa-finance-read@example.invalid / QaOverview1!

Web local (không dùng nginx:8080 vì trỏ DB vận hành):
  set NEXT_PUBLIC_API_URL=http://localhost:4001
  rebuild web hoặc chạy dev khi pnpm/next sẵn sàng; mở http://localhost:3001/overview
`);
})();