/**
 * LP cache HTTP QA — typecheck API + HTTP trên marketingspa_hrm_finance_qa.
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
const path = require('path');

function run(command, args, extraEnv = {}, cwdOverride = cwd) {
  const result = spawnSync(command, args, {
    cwd: cwdOverride,
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: '', ...extraEnv },
    shell: false,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const exists = spawnSync(
  'docker',
  ['exec', 'marketingspa-postgres', 'psql', '-U', user, '-d', 'postgres', '-tAc', `SELECT 1 FROM pg_database WHERE datname='${dbName}'`],
  { encoding: 'utf8' },
);
if (exists.status !== 0 || !String(exists.stdout).trim()) {
  console.error(`Database ${dbName} chưa có — chạy node scripts/run-hrm-finance-rbac-http.cjs trước (hoặc HRM_FINANCE_QA_SKIP_SETUP=1 nếu DB đã có).`);
  process.exit(1);
}

const internalUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@marketingspa-postgres:5432/${dbName}?schema=public`;
assertHrmFinanceQaDb(internalUrl);

const tsc = resolve(cwd, 'node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/tsc.js');
const apiDir = resolve(cwd, 'apps/api');

const apiTsconfig = resolve(apiDir, 'tsconfig.lp-cache-qa.json');
console.log('[lp-cache-http] typecheck/build API (tsc dist, --noCheck — cùng pattern HRM QA)');
writeFileSync(
  apiTsconfig,
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
    [tsc, '-p', apiTsconfig, '--noCheck', '--pretty', 'false'],
    {},
    apiDir,
  );
} finally {
  if (existsSync(apiTsconfig)) unlinkSync(apiTsconfig);
}

const sharedDistDir = resolve(cwd, 'packages/shared/dist');
const sharedRetry = resolve(sharedDistDir, 'landing-page-cache-retry-token.js');
const sharedCacheTags = resolve(sharedDistDir, 'landing-page-public-cache.js');
if (!existsSync(sharedRetry) || !existsSync(sharedCacheTags)) {
  console.error('Thiếu dist shared (retry token / public cache) — build packages/shared trên máy có pnpm.');
  process.exit(1);
}
const sharedShim = resolve(cwd, 'scripts/.lp-qa-shared-shim');
const shimDist = resolve(sharedShim, 'dist');
try {
  const { mkdirSync, cpSync, rmSync } = require('fs');
  rmSync(sharedShim, { recursive: true, force: true });
  mkdirSync(shimDist, { recursive: true });
  cpSync(sharedRetry, resolve(shimDist, 'landing-page-cache-retry-token.js'));
  cpSync(sharedCacheTags, resolve(shimDist, 'landing-page-public-cache.js'));
  writeFileSync(
    resolve(shimDist, 'index.js'),
    [
      "'use strict';",
      'Object.assign(exports, require("./landing-page-cache-retry-token"));',
      'Object.assign(exports, require("./landing-page-public-cache"));',
      '',
    ].join('\n'),
  );
  writeFileSync(
    resolve(sharedShim, 'package.json'),
    JSON.stringify({ name: '@marketingspa/shared', main: './dist/index.js' }, null, 2),
  );
} catch (e) {
  console.error(e);
  process.exit(1);
}

const testJs = resolve(cwd, 'scripts/test-landing-page-cache-http.js');
const testTsconfig = resolve(cwd, 'scripts/tsconfig.lp-cache-qa.json');
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
      files: ['test-landing-page-cache-http.ts'],
    },
    null,
    2,
  ),
);
console.log('[lp-cache-http] compile test');
try {
  run(process.execPath, [tsc, '-p', testTsconfig, '--noCheck', '--pretty', 'false'], {}, resolve(cwd, 'scripts'));
} finally {
  if (existsSync(testTsconfig)) unlinkSync(testTsconfig);
}

const tunnelName = 'hrm-finance-qa-tunnel';
let tunnelRunning = String(
  spawnSync('docker', ['inspect', '-f', '{{.State.Running}}', tunnelName], { encoding: 'utf8' }).stdout || '',
).trim();
if (tunnelRunning !== 'true') {
  const start = spawnSync('docker', ['start', tunnelName], { encoding: 'utf8' });
  if (start.status === 0) {
    tunnelRunning = 'true';
    console.log(`[lp-cache-http] khởi động lại tunnel ${tunnelName}`);
  } else {
    const qaNet = String(
      spawnSync('docker', ['inspect', 'marketingspa-postgres', '--format', '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}'], {
        encoding: 'utf8',
      }).stdout || '',
    ).trim();
    if (!qaNet) {
      console.error('Không thấy Docker network Postgres — bật Docker và stack QA.');
      process.exit(1);
    }
    console.log(`[lp-cache-http] mở cổng local ${port} → Postgres (socat)`);
    run('docker', [
      'run', '-d', '--name', tunnelName, '--network', qaNet,
      '-p', `127.0.0.1:${port}:5432`,
      'alpine/socat',
      'tcp-listen:5432,fork,reuseaddr',
      'tcp-connect:marketingspa-postgres:5432',
    ]);
  }
}

const databaseUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@127.0.0.1:${port}/${dbName}?schema=public`;
assertHrmFinanceQaDb(databaseUrl);

function runHttpQaInDocker(testFile) {
  run('docker', [
    'exec',
    'marketingspa-api',
    'sh',
    '-c',
    'rm -rf /tmp/lp-nm /tmp/lp-shared /tmp/apps && mkdir -p /tmp/scripts /tmp/apps/api /tmp/lp-nm/@marketingspa/shared/dist /tmp/lp-shared',
  ]);
  run('docker', ['cp', resolve(cwd, 'apps/api/dist'), 'marketingspa-api:/tmp/apps/api/']);
  run('docker', ['cp', resolve(sharedShim, 'package.json'), 'marketingspa-api:/tmp/lp-nm/@marketingspa/shared/package.json']);
  for (const f of ['index.js', 'landing-page-cache-retry-token.js', 'landing-page-public-cache.js']) {
    run('docker', ['cp', resolve(shimDist, f), `marketingspa-api:/tmp/lp-nm/@marketingspa/shared/dist/${f}`]);
  }
  run('docker', ['cp', `${sharedDistDir}/.`, 'marketingspa-api:/tmp/lp-shared/']);
  run('docker', ['cp', testFile, 'marketingspa-api:/tmp/scripts/test-landing-page-cache-http.js']);
  const nodePath = '/tmp/lp-nm:/tmp/apps/api/dist:/app/node_modules';
  console.log('[lp-cache-http] HTTP QA trong container marketingspa-api');
  return spawnSync(
    'docker',
    [
      'exec',
      '-e',
      `DATABASE_URL=${internalUrl}`,
      '-e',
      'JWT_SECRET=landing-page-cache-qa-jwt-secret',
      '-e',
      'LANDING_PAGE_REVALIDATE_SECRET=lp-cache-qa-revalidate-secret-32ch',
      '-e',
      'LP_QA_SHARED_DIST=/tmp/lp-shared',
      '-e',
      `NODE_PATH=${nodePath}`,
      '-w',
      '/tmp/scripts',
      'marketingspa-api',
      'node',
      '-r',
      '/app/node_modules/reflect-metadata',
      '/tmp/scripts/test-landing-page-cache-http.js',
    ],
    { cwd, stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '' } },
  );
}

const reflectCandidates = [
  resolve(cwd, 'apps/api/node_modules/reflect-metadata'),
  resolve(cwd, 'node_modules/reflect-metadata'),
];
const reflect = reflectCandidates.find((p) => existsSync(p));
const forceDocker = process.env.LP_CACHE_HTTP_IN_DOCKER === '1';

let result = { status: 1 };
try {
  if (!forceDocker && reflect) {
    const nodePath = [resolve(cwd, 'apps/api/dist'), resolve(cwd, 'apps/api/node_modules'), resolve(cwd, 'node_modules')]
      .filter((p) => existsSync(p))
      .join(path.delimiter);
    console.log(`[lp-cache-http] HTTP QA (local Node → ${dbName} @ 127.0.0.1:${port})`);
    result = spawnSync(
      process.execPath,
      ['-r', reflect, testJs],
      {
        cwd: resolve(cwd, 'scripts'),
        stdio: 'inherit',
        env: {
          ...process.env,
          NODE_OPTIONS: '',
          DATABASE_URL: databaseUrl,
          JWT_SECRET: 'landing-page-cache-qa-jwt-secret',
          LANDING_PAGE_REVALIDATE_SECRET: 'lp-cache-qa-revalidate-secret-32ch',
          NODE_PATH: nodePath,
        },
      },
    );
  } else {
    if (!reflect) console.log('[lp-cache-http] không có reflect-metadata local → chạy trong container API');
    result = runHttpQaInDocker(testJs);
  }
} finally {
  if (existsSync(testJs)) unlinkSync(testJs);
}

if (result.status !== 0) process.exit(result.status ?? 1);
console.log('[lp-cache-http] PASS');