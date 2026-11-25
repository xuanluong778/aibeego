/**
 * SES P0 webhook QA — API sidecar marketingspa-api-ses-p0-qa, không đổi marketingspa-api vận hành.
 */
const { existsSync, readFileSync, writeFileSync, unlinkSync } = require('fs');
const { resolve } = require('path');
const { spawnSync } = require('child_process');
const { assertQaSesFixture, dockerContainerRunning } = require('./lib/security-acceptance-qa-env.cjs');
const { ensureSesP0ApiQa, DEFAULT_CONTAINER } = require('./lib/security-acceptance-api-qa-sidecar.cjs');
const { buildSharedPackage } = require('./build-shared-package.cjs');

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

if (!dockerContainerRunning('marketingspa-postgres')) {
  console.log('[email-ses-p0] [CHƯA KIỂM CHỨNG — bắt buộc] thiếu marketingspa-postgres');
  process.exit(2);
}

const dbName = process.env.AUTH_SESSION_QA_DB || process.env.SECURITY_ACCEPTANCE_DB || 'marketingspa_hrm_finance_qa';
const user = process.env.POSTGRES_USER || 'marketingspa';
const pass = process.env.POSTGRES_PASSWORD || 'change_me_strong_password';
const internalUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@marketingspa-postgres:5432/${dbName}?schema=public`;

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, NODE_OPTIONS: '' },
    ...opts,
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

/** @type {{ apiUrl: string, container: string }} */
let sidecar;
try {
  sidecar = ensureSesP0ApiQa({ dbName, repoRoot: cwd });
} catch (e) {
  console.error(`[email-ses-p0] QA API sidecar FAIL — ${e.message}`);
  process.exit(1);
}

try {
  assertQaSesFixture({ dbName, apiUrl: sidecar.apiUrl, apiContainer: sidecar.container });
} catch (e) {
  console.error(`[email-ses-p0] QA guard FAIL — ${e.message}`);
  process.exit(1);
}

const tsc = resolve(cwd, 'node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/tsc.js');
const apiDir = resolve(cwd, 'apps/api');

const built = buildSharedPackage(cwd);
if (!built.ok) {
  console.error(`[email-ses-p0] shared build FAIL — ${built.detail}`);
  process.exit(1);
}

console.log('[email-ses-p0] API tsc');
const apiTsconfig = resolve(apiDir, 'tsconfig.email-ses-qa.json');
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
        sourceMap: false,
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist', 'test', '**/*spec.ts'],
    },
    null,
    2,
  ),
);
try {
  run(process.execPath, [tsc, '-p', apiTsconfig, '--noCheck'], { cwd: apiDir });
} finally {
  if (existsSync(apiTsconfig)) unlinkSync(apiTsconfig);
}

const testJs = resolve(cwd, 'scripts/test-email-ses-p0.js');
const testTsconfig = resolve(cwd, 'scripts/tsconfig.email-ses-p0-qa.json');
writeFileSync(
  testTsconfig,
  JSON.stringify({
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
    files: ['test-email-ses-p0.ts'],
  }),
);
run(process.execPath, [tsc, '-p', testTsconfig, '--noCheck'], { cwd: resolve(cwd, 'scripts') });
if (existsSync(testTsconfig)) unlinkSync(testTsconfig);

const testRunnerContainer = 'marketingspa-api';
const workDir = '/tmp/email-ses-p0';
run('docker', [
  'exec',
  testRunnerContainer,
  'sh',
  '-c',
  `rm -rf ${workDir} && mkdir -p ${workDir}/scripts ${workDir}/apps/api/dist ${workDir}/packages/shared/dist`,
]);
run('docker', ['cp', resolve(cwd, 'apps/api/dist'), `${testRunnerContainer}:${workDir}/apps/api/`]);
run('docker', ['cp', resolve(cwd, 'packages/shared/dist'), `${testRunnerContainer}:${workDir}/packages/shared/`]);
run('docker', ['cp', testJs, `${testRunnerContainer}:${workDir}/scripts/test-email-ses-p0.js`]);

const nodePath = `/app/node_modules/.pnpm/node_modules:/app/node_modules:${workDir}/apps/api/dist:${workDir}/packages/shared/dist`;
const httpApiUrl = `http://${sidecar.container}:4000`;
console.log(
  `[email-ses-p0] HTTP → ${sidecar.container} (${httpApiUrl}) | runner=${testRunnerContainer} | DB=${dbName}`,
);
const result = spawnSync(
  'docker',
  [
    'exec',
    '-e',
    `DATABASE_URL=${internalUrl}`,
    '-e',
    `API_URL=${httpApiUrl}`,
    '-e',
    'SES_SNS_TOPIC_ARN=arn:aws:sns:ap-southeast-1:000000000000:marketingautoaz-p0-test',
    '-e',
    'SES_SNS_WEBHOOK_TEST_SIGNING_KEY=p0-local-test-signing-key',
    '-e',
    `NODE_PATH=${nodePath}`,
    '-w',
    `${workDir}/scripts`,
    testRunnerContainer,
    'node',
    '-r',
    '/app/node_modules/reflect-metadata',
    'test-email-ses-p0.js',
  ],
  { cwd, stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '' } },
);

if (existsSync(testJs)) unlinkSync(testJs);

if ((result.status ?? 1) !== 0) {
  console.log('[email-ses-p0] FAIL');
  process.exit(result.status ?? 1);
}
console.log(`[email-ses-p0] PASS — HTTP P0 trên ${DEFAULT_CONTAINER}`);
process.exit(0);