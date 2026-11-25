/**
 * Auth session QA — build API + HTTP/fixture tests (không deploy production).
 */
const { existsSync, writeFileSync, unlinkSync } = require('fs');
const { resolve } = require('path');
const { spawnSync } = require('child_process');

const { readFileSync } = require('fs');
const {
  assertQaDockerDatabaseLive,
  resolveApiUrl,
  assertQaDatabaseName,
} = require('./lib/security-acceptance-qa-env.cjs');
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

const tsc = resolve(cwd, 'node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/tsc.js');
const apiDir = resolve(cwd, 'apps/api');

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: false, ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log('[auth-session] build API (tsc --noCheck)');
const apiTsconfig = resolve(apiDir, 'tsconfig.auth-session-qa.json');
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
  run(process.execPath, [tsc, '-p', apiTsconfig, '--noCheck', '--pretty', 'false'], { cwd: apiDir });
} finally {
  if (existsSync(apiTsconfig)) unlinkSync(apiTsconfig);
}

const testJs = resolve(cwd, 'scripts/test-auth-session-http.js');
const testTsconfig = resolve(cwd, 'scripts/tsconfig.auth-session-qa.json');
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
      files: ['test-auth-session-http.ts'],
    },
    null,
    2,
  ),
);
console.log('[auth-session] compile test');
try {
  run(process.execPath, [tsc, '-p', testTsconfig, '--noCheck', '--pretty', 'false'], { cwd: resolve(cwd, 'scripts') });
} finally {
  if (existsSync(testTsconfig)) unlinkSync(testTsconfig);
}

const dbName = process.env.AUTH_SESSION_QA_DB || 'marketingspa_hrm_finance_qa';
const user = process.env.POSTGRES_USER || 'marketingspa';
const pass = process.env.POSTGRES_PASSWORD || 'change_me_strong_password';
const internalUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@marketingspa-postgres:5432/${dbName}?schema=public`;

try {
  const prevApi = process.env.API_URL;
  process.env.API_URL =
    (process.env.AUTH_SESSION_PROXY_URL || process.env.API_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
  resolveApiUrl();
  if (prevApi === undefined) delete process.env.API_URL;
  else process.env.API_URL = prevApi;
  assertQaDatabaseName(dbName, 'AUTH_SESSION_QA_DB');
  assertQaDockerDatabaseLive(dbName);
} catch (e) {
  console.error(`[auth-session] QA guard FAIL — ${e.message}`);
  process.exit(1);
}

console.log('[auth-session] đảm bảo rotation_root_id trên DB QA');
run('docker', [
  'exec',
  'marketingspa-postgres',
  'psql',
  '-U',
  user,
  '-d',
  dbName,
  '-v',
  'ON_ERROR_STOP=1',
  '-c',
  'ALTER TABLE "auth_sessions" ADD COLUMN IF NOT EXISTS "rotation_root_id" TEXT; CREATE INDEX IF NOT EXISTS "auth_sessions_user_id_rotation_root_id_idx" ON "auth_sessions"("user_id", "rotation_root_id");',
]);

run('docker', [
  'exec',
  'marketingspa-api',
  'sh',
  '-c',
  'rm -rf /tmp/auth-session-qa && mkdir -p /tmp/auth-session-qa/scripts /tmp/auth-session-qa/apps/api',
]);
run('docker', ['cp', resolve(cwd, 'apps/api/dist'), 'marketingspa-api:/tmp/auth-session-qa/apps/api/']);
run('docker', ['cp', testJs, 'marketingspa-api:/tmp/auth-session-qa/scripts/test-auth-session-http.js']);

const nodePath = '/tmp/auth-session-qa/apps/api/dist:/app/node_modules';
console.log('[auth-session] chạy fixture QA trong marketingspa-api');
const result = spawnSync(
  'docker',
  [
    'exec',
    '-e',
    `DATABASE_URL=${internalUrl}`,
    '-e',
    'JWT_SECRET=auth-session-qa-jwt-secret',
    '-e',
    'JWT_REFRESH_SECRET=auth-session-qa-jwt-secret',
    '-e',
    'UPLOAD_SIGNING_SECRET=auth-session-upload-sign-32chars-min',
    '-e',
    'AUTH_SESSION_QA_HOLD_MS=300',
    '-e',
    `NODE_PATH=${nodePath}`,
    '-w',
    '/tmp/auth-session-qa/scripts',
    'marketingspa-api',
    'node',
    '-r',
    '/app/node_modules/reflect-metadata',
    '/tmp/auth-session-qa/scripts/test-auth-session-http.js',
  ],
  { cwd, stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '' } },
);

if (existsSync(testJs)) unlinkSync(testJs);
if (result.status !== 0) process.exit(result.status ?? 1);

console.log('[auth-session] web logic QA');
const logicJs = resolve(cwd, 'scripts/test-auth-session-web-logic.js');
const logicJsInScripts = resolve(cwd, 'scripts/test-auth-session-web-logic.js');
const logicTsconfig = resolve(cwd, 'scripts/tsconfig.auth-session-web-logic.json');
writeFileSync(
  logicTsconfig,
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
      files: ['test-auth-session-web-logic.ts'],
    },
    null,
    2,
  ),
);
try {
  run(process.execPath, [tsc, '-p', logicTsconfig, '--noCheck', '--pretty', 'false'], {
    cwd: resolve(cwd, 'scripts'),
  });
} finally {
  if (existsSync(logicTsconfig)) unlinkSync(logicTsconfig);
}
run(process.execPath, [logicJsInScripts]);
if (existsSync(logicJsInScripts)) unlinkSync(logicJsInScripts);

console.log('[auth-session] browser QA');
let playwrightPath;
try {
  playwrightPath = require.resolve('playwright', { paths: [cwd] });
} catch {
  playwrightPath = '';
}
if (!playwrightPath) {
  console.log('  [CHƯA KIỂM CHỨNG] Browser suite — cài playwright: pnpm install (root devDependency)');
} else {
  const browser = spawnSync(process.execPath, [resolve(cwd, 'scripts/test-auth-session-browser.cjs')], {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
  if (browser.status !== 0) process.exit(browser.status ?? 1);
}

console.log('[auth-session] proxy IP QA');
const proxy = spawnSync(process.execPath, [resolve(cwd, 'scripts/test-auth-session-proxy-http.cjs')], {
  cwd,
  stdio: 'inherit',
  env: process.env,
});
if (proxy.status !== 0) process.exit(proxy.status ?? 1);

console.log('[auth-session] two-tab Web/API QA');
const twoTab = spawnSync(process.execPath, [resolve(cwd, 'scripts/test-auth-session-two-tab-http.cjs')], {
  cwd,
  stdio: 'inherit',
  env: process.env,
});
if (twoTab.status !== 0) process.exit(twoTab.status ?? 1);

console.log('[auth-session] PASS');