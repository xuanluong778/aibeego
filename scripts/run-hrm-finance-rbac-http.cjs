/**
 * Nghiệm thu nhân sự + tài chính trên DB QA riêng.
 * Không đụng database ứng dụng đang chạy.
 */
const { readFileSync, existsSync, writeFileSync, unlinkSync } = require('fs');
const { resolve } = require('path');
const { spawnSync } = require('child_process');
const { assertHrmFinanceQaDb } = require('./hrm-finance-qa-env.cjs');

const cwd = resolve(__dirname, '..');
delete process.env.NODE_OPTIONS;
const envPath = resolve(cwd, '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i === -1) continue;
    const key = trimmed.slice(0, i).trim();
    const value = trimmed.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if ((key === 'POSTGRES_USER' || key === 'POSTGRES_PASSWORD') && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const user = process.env.POSTGRES_USER || 'marketingspa';
const pass = process.env.POSTGRES_PASSWORD || 'change_me_strong_password';
const port = process.env.HRM_FINANCE_QA_PORT || '15432';
const dbName = 'marketingspa_hrm_finance_qa';

function run(command, args, extraEnv = {}, cwdOverride = cwd) {
  const result = spawnSync(command, args, {
    cwd: cwdOverride,
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: '', ...extraEnv },
    shell: false,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const exists = spawnSync(
  'docker',
  ['exec', 'marketingspa-postgres', 'psql', '-U', user, '-d', 'postgres', '-tAc', `SELECT 1 FROM pg_database WHERE datname='${dbName}'`],
  { encoding: 'utf8' },
);
if (exists.status !== 0) {
  console.error(exists.stderr || exists.stdout);
  process.exit(exists.status ?? 1);
}
const skipSetup = process.env.HRM_FINANCE_QA_SKIP_SETUP === '1';
if (skipSetup) console.log('[hrm-finance-qa] bỏ qua tạo DB và build');
const qaNetwork = spawnSync(
  'docker',
  ['inspect', 'marketingspa-postgres', '--format', '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}'],
  { encoding: 'utf8' },
);
const qaNet = String(qaNetwork.stdout || '').trim();
if (!qaNet) {
  console.error('Không thấy Docker network của Postgres');
  process.exit(1);
}
const internalUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@marketingspa-postgres:5432/${dbName}?schema=public`;
assertHrmFinanceQaDb(internalUrl);
if (!skipSetup) {
console.log(`[hrm-finance-qa] tạo lại database ${dbName}`);
run('docker', [
  'exec', 'marketingspa-postgres', 'psql', '-U', user, '-d', 'postgres', '-c',
  `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${dbName}' AND pid <> pg_backend_pid();`,
]);
run('docker', [
  'exec', 'marketingspa-postgres', 'psql', '-U', user, '-d', 'postgres', '-c',
  `DROP DATABASE IF EXISTS ${dbName}`,
]);
run('docker', ['exec', 'marketingspa-postgres', 'psql', '-U', user, '-d', 'postgres', '-c', `CREATE DATABASE ${dbName}`]);

const tunnelName = 'hrm-finance-qa-tunnel';
const tunnel = spawnSync('docker', ['inspect', '-f', '{{.State.Running}}', tunnelName], { encoding: 'utf8' });
if (String(tunnel.stdout).trim() !== 'true') {
  const network = spawnSync(
    'docker',
    ['inspect', 'marketingspa-postgres', '--format', '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}'],
    { encoding: 'utf8' },
  );
  const net = String(network.stdout).trim();
  if (!net) {
    console.error('Không thấy Docker network của Postgres');
    process.exit(1);
  }
  console.log(`[hrm-finance-qa] mở cổng local ${port} tới Postgres QA`);
  run('docker', [
    'run', '-d', '--name', tunnelName, '--network', net,
    '-p', `127.0.0.1:${port}:5432`,
    'alpine/socat',
    'tcp-listen:5432,fork,reuseaddr',
    'tcp-connect:marketingspa-postgres:5432',
  ]);
}

const databaseUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@127.0.0.1:${port}/${dbName}?schema=public`;
assertHrmFinanceQaDb(databaseUrl);
process.env.DATABASE_URL = databaseUrl;
process.env.HRM_FINANCE_QA_DATABASE_URL = databaseUrl;
console.log(`[hrm-finance-qa] DATABASE_URL → ${dbName} @ 127.0.0.1:${port}`);

console.log('[hrm-finance-qa] prisma db push');
run('docker', [
  'run', '--rm', '--network', qaNet,
  '-v', `${resolve(cwd, 'packages/database')}:/schema`,
  '-e', `DATABASE_URL=${internalUrl}`,
  '-w', '/tmp',
  'node:20',
  'sh', '-c',
  'npm install --silent prisma@6.19.3 && ./node_modules/.bin/prisma db push --skip-generate --accept-data-loss --schema /schema/prisma/schema.prisma',
]);

console.log('[hrm-finance-qa] build api');
const apiDir = resolve(cwd, 'apps/api');
const qaTsconfig = resolve(apiDir, 'tsconfig.hrm-finance-qa.json');
writeFileSync(
  qaTsconfig,
  JSON.stringify(
    {
      extends: '../../packages/config/tsconfig.nestjs.json',
      compilerOptions: {
        outDir: './dist',
        rootDir: './src',
        declaration: false,
        declarationMap: false,
        sourceMap: true,
        baseUrl: './',
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist', 'test', '**/*spec.ts'],
    },
    null,
    2,
  ),
);
try {
  run(
    process.execPath,
    [
      resolve(cwd, 'node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/tsc.js'),
      '-p',
      qaTsconfig,
      '--noCheck',
      '--pretty',
      'false',
    ],
    {},
    apiDir,
  );
} finally {
  if (existsSync(qaTsconfig)) unlinkSync(qaTsconfig);
}
}

const testJs = resolve(cwd, 'scripts/test-hrm-finance-rbac-http.js');
const testTsconfig = resolve(cwd, 'scripts/tsconfig.hrm-finance-qa.json');
writeFileSync(
  testTsconfig,
  JSON.stringify(
    {
      compilerOptions: {
        module: 'commonjs',
        target: 'ES2022',
        moduleResolution: 'node',
        esModuleInterop: true,
        strict: false,
        skipLibCheck: true,
        outDir: '.',
        rootDir: '.',
      },
      files: ['test-hrm-finance-rbac-http.ts'],
    },
    null,
    2,
  ),
);
console.log('[hrm-finance-qa] compile test');
try {
  run(
    process.execPath,
    [
      resolve(cwd, 'node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/tsc.js'),
      '-p',
      testTsconfig,
      '--noCheck',
      '--pretty',
      'false',
    ],
    {},
    resolve(cwd, 'scripts'),
  );
} finally {
  if (existsSync(testTsconfig)) unlinkSync(testTsconfig);
}
let result = { status: 1 };
try {
  run('docker', ['exec', 'marketingspa-api', 'mkdir', '-p', '/tmp/scripts', '/tmp/apps/api']);
  run('docker', ['cp', resolve(cwd, 'apps/api/dist'), 'marketingspa-api:/tmp/apps/api/']);
  run('docker', ['cp', testJs, 'marketingspa-api:/tmp/scripts/test-hrm-finance-rbac-http.js']);
  run('docker', ['cp', resolve(cwd, 'scripts/grant-hrm-finance-permissions.cjs'), 'marketingspa-api:/tmp/scripts/grant-hrm-finance-permissions.cjs']);
  run('docker', ['cp', resolve(cwd, 'scripts/hrm-finance-qa-env.cjs'), 'marketingspa-api:/tmp/scripts/hrm-finance-qa-env.cjs']);
  console.log('[hrm-finance-qa] HTTP test trong container API (engine Linux)');
  result = spawnSync(
    'docker',
    [
      'exec',
      '-e', `DATABASE_URL=${internalUrl}`,
      '-e', 'NODE_PATH=/app/node_modules:/app/node_modules/.pnpm/@prisma+client@6.19.3_prisma@6.19.3_typescript@5.9.3__typescript@5.9.3/node_modules',
      '-e', 'JWT_SECRET=hrm-finance-qa-jwt-secret',
      '-w', '/tmp',
      'marketingspa-api',
      'node',
      '-r', '/app/node_modules/reflect-metadata',
      '/tmp/scripts/test-hrm-finance-rbac-http.js',
    ],
    { cwd, stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '' } },
  );
} finally {
  if (existsSync(testJs)) unlinkSync(testJs);
}
process.exit(result.status ?? 1);
