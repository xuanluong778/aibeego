/**
 * Build ssrf-fetch + chatbot/policy modules, chạy QA trong sidecar (không đụng marketingspa-api).
 */
const { resolve } = require('path');
const { existsSync, writeFileSync, unlinkSync } = require('fs');
const { spawnSync } = require('child_process');
const { ensureUrlFetchQaSidecar } = require('./url-fetch-qa-sidecar.cjs');

const cwd = resolve(__dirname, '..');
const tsc = resolve(cwd, 'node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/tsc.js');

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: false, ...opts });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const sharedTsconfig = resolve(cwd, 'packages/shared/tsconfig.url-fetch-qa.json');
writeFileSync(
  sharedTsconfig,
  JSON.stringify(
    {
      compilerOptions: {
        module: 'commonjs',
        target: 'ES2022',
        moduleResolution: 'node',
        esModuleInterop: true,
        strict: false,
        skipLibCheck: true,
        outDir: './dist',
        rootDir: './src',
        declaration: false,
      },
      include: ['src/ssrf-fetch.ts', 'src/ad-url-analyze.ts'],
    },
    null,
    2,
  ),
);
console.log('[url-fetch-qa] build shared ssrf-fetch');
try {
  run(process.execPath, [tsc, '-p', sharedTsconfig, '--noCheck'], { cwd: resolve(cwd, 'packages/shared') });
} finally {
  if (existsSync(sharedTsconfig)) unlinkSync(sharedTsconfig);
}

const apiTsconfig = resolve(cwd, 'apps/api/tsconfig.url-fetch-qa.json');
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
      include: [
        'src/chatbot-cskh/utils/website-crawl.util.ts',
        'src/content-marketing/facebook-policy/facebook-policy-ssrf-fetch.ts',
        'src/content-marketing/facebook-policy/facebook-policy-import.logic.ts',
        'src/content-marketing/facebook-policy/facebook-policy-url-parse.ts',
        'src/content-marketing/facebook-policy/facebook-policy.types.ts',
      ],
    },
    null,
    2,
  ),
);
console.log('[url-fetch-qa] build API crawl/policy');
try {
  run(process.execPath, [tsc, '-p', apiTsconfig, '--noCheck', '--pretty', 'false'], {
    cwd: resolve(cwd, 'apps/api'),
  });
} finally {
  if (existsSync(apiTsconfig)) unlinkSync(apiTsconfig);
}

const qaContainer = ensureUrlFetchQaSidecar();
console.log(`[url-fetch-qa] patch ${qaContainer} + fixture`);
run('docker', [
  'cp',
  resolve(cwd, 'packages/shared/dist/ssrf-fetch.js'),
  `${qaContainer}:/app/node_modules/@marketingspa/shared/dist/ssrf-fetch.js`,
]);
run('docker', [
  'cp',
  resolve(cwd, 'apps/api/dist/chatbot-cskh/utils/website-crawl.util.js'),
  `${qaContainer}:/app/dist/chatbot-cskh/utils/website-crawl.util.js`,
]);
run('docker', [
  'cp',
  resolve(cwd, 'apps/api/dist/content-marketing/facebook-policy/facebook-policy-ssrf-fetch.js'),
  `${qaContainer}:/app/dist/content-marketing/facebook-policy/facebook-policy-ssrf-fetch.js`,
]);
run('docker', [
  'cp',
  resolve(cwd, 'apps/api/dist/content-marketing/facebook-policy/facebook-policy-import.logic.js'),
  `${qaContainer}:/app/dist/content-marketing/facebook-policy/facebook-policy-import.logic.js`,
]);
run('docker', [
  'cp',
  resolve(cwd, 'scripts/test-user-url-fetch-qa.docker.cjs'),
  `${qaContainer}:/tmp/test-user-url-fetch-qa.cjs`,
]);

const result = spawnSync(
  'docker',
  ['exec', '-w', '/tmp', qaContainer, 'node', 'test-user-url-fetch-qa.cjs'],
  { cwd, stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '' } },
);
process.exit(result.status ?? 1);