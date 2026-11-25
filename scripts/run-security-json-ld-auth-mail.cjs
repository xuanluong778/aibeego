/**
 * Kiểm thử JSON-LD + auth-mail logging (không deploy production).
 */
const { resolve } = require('path');
const { existsSync, writeFileSync, unlinkSync } = require('fs');
const { spawnSync } = require('child_process');

const cwd = resolve(__dirname, '..');
const tsc = resolve(cwd, 'node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/tsc.js');

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: false, ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log('[security] JSON-LD unit');
run(process.execPath, [resolve(cwd, 'scripts/test-safe-json-ld.cjs')]);
run(process.execPath, [resolve(cwd, 'scripts/test-safe-json-ld-sync.cjs')]);

console.log('[security] build API (auth-mail)');
const qaTsconfig = resolve(cwd, 'apps/api/tsconfig.security-mail.json');
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
  run(process.execPath, [tsc, '-p', qaTsconfig, '--noCheck'], { cwd: resolve(cwd, 'apps/api') });
} finally {
  if (existsSync(qaTsconfig)) unlinkSync(qaTsconfig);
}

const mailTestJs = resolve(cwd, 'scripts/test-auth-mail-logging.js');
const mailTsconfig = resolve(cwd, 'scripts/tsconfig.auth-mail-logging.json');
writeFileSync(
  mailTsconfig,
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
    files: ['test-auth-mail-logging.ts'],
  }),
);
console.log('[security] compile auth-mail test');
try {
  run(process.execPath, [tsc, '-p', mailTsconfig, '--noCheck'], { cwd: resolve(cwd, 'scripts') });
} finally {
  if (existsSync(mailTsconfig)) unlinkSync(mailTsconfig);
}

try {
  run('docker', ['exec', 'marketingspa-api', 'mkdir', '-p', '/tmp/security-tests/apps/api']);
  run('docker', ['cp', resolve(cwd, 'apps/api/dist'), 'marketingspa-api:/tmp/security-tests/apps/api/']);
  run('docker', ['cp', mailTestJs, 'marketingspa-api:/tmp/security-tests/test-auth-mail-logging.js']);
  console.log('[security] auth-mail logging (container API)');
  const r = spawnSync(
    'docker',
    [
      'exec',
      '-w',
      '/tmp/security-tests',
      '-e',
      'NODE_PATH=/app/node_modules',
      'marketingspa-api',
      'node',
      '-r',
      '/app/node_modules/reflect-metadata',
      'test-auth-mail-logging.js',
    ],
    { cwd, stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '' } },
  );
  if (r.status !== 0) process.exit(r.status ?? 1);
} finally {
  if (existsSync(mailTestJs)) unlinkSync(mailTestJs);
}

if (process.env.SECURITY_QA_SMTP_LIVE === '1') {
  console.log('[security] SMTP live — kiểm tra hộp thư QA thủ công sau khi gửi');
} else {
  console.log('[security] CHƯA KIỂM CHỨNG: SMTP gửi thật tới hộp thư QA (SECURITY_QA_SMTP_LIVE=1)');
}

console.log('[security] done');