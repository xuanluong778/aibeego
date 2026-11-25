/**
 * Build @marketingspa/shared bằng tsconfig package (không ghi đè từng file ES5).
 */
const { existsSync, readdirSync, readFileSync, writeFileSync, unlinkSync } = require('fs');
const { resolve } = require('path');
const { spawnSync } = require('child_process');

function findTsc(cwd) {
  const pinned = resolve(cwd, 'node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/lib/tsc.js');
  if (existsSync(pinned)) return pinned;
  const flat = resolve(cwd, 'node_modules/typescript/lib/tsc.js');
  if (existsSync(flat)) return flat;
  const pnpmDir = resolve(cwd, 'node_modules/.pnpm');
  if (existsSync(pnpmDir)) {
    const dirs = readdirSync(pnpmDir).filter((n) => n.startsWith('typescript@'));
    dirs.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const dir of dirs) {
      const candidate = resolve(pnpmDir, dir, 'node_modules/typescript/lib/tsc.js');
      if (existsSync(candidate)) return candidate;
    }
  }
  throw new Error('Không tìm thấy typescript/lib/tsc.js — chạy pnpm install');
}

/**
 * @param {string} repoRoot
 * @returns {string[] | null}
 */
function resolvePnpmNodeTypeRoots(repoRoot) {
  const pnpmDir = resolve(repoRoot, 'node_modules/.pnpm');
  if (!existsSync(pnpmDir)) return null;
  const candidates = readdirSync(pnpmDir)
    .filter((n) => /^@types\+node@/.test(n))
    .sort((a, b) => {
      const va = a.replace('@types+node@', '');
      const vb = b.replace('@types+node@', '');
      return vb.localeCompare(va, undefined, { numeric: true });
    });
  for (const folder of candidates) {
    const typesRoot = resolve(pnpmDir, folder, 'node_modules/@types');
    if (existsSync(resolve(typesRoot, 'node/index.d.ts'))) {
      return [typesRoot];
    }
  }
  return null;
}

/**
 * @param {string} repoRoot
 * @param {string} packageName
 * @returns {string | null}
 */
function resolvePnpmPackageDir(repoRoot, packageName) {
  const pnpmDir = resolve(repoRoot, 'node_modules/.pnpm');
  if (!existsSync(pnpmDir)) return null;
  const prefix = packageName.startsWith('@')
    ? `${packageName.replace('/', '+')}@`
    : `${packageName}@`;
  const matches = readdirSync(pnpmDir).filter((n) => n.startsWith(prefix));
  if (!matches.length) return null;
  matches.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  const folder = matches[0];
  if (packageName.startsWith('@')) {
    const [scope, name] = packageName.split('/');
    const inner = resolve(pnpmDir, folder, 'node_modules', scope, name);
    return existsSync(resolve(inner, 'package.json')) ? inner : null;
  }
  const inner = resolve(pnpmDir, folder, 'node_modules', packageName);
  return existsSync(resolve(inner, 'package.json')) ? inner : null;
}

/**
 * @param {string} repoRoot
 * @returns {Record<string, string[]>}
 */
function sharedCompilerPaths(repoRoot) {
  const sharedDir = resolve(repoRoot, 'packages/shared');
  const raw = readFileSync(resolve(sharedDir, 'package.json'), 'utf8');
  const pkg = JSON.parse(raw);
  /** @type {Record<string, string[]>} */
  const paths = {};
  const names = [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})];
  for (const name of names) {
    if (name.startsWith('@marketingspa/')) {
      const short = name.split('/')[1];
      const pkgPath = resolve(repoRoot, 'packages', short);
      if (existsSync(pkgPath)) paths[name] = [pkgPath];
      continue;
    }
    if (name.startsWith('@types/')) continue;
    const dir = resolvePnpmPackageDir(repoRoot, name);
    if (dir) paths[name] = [dir];
  }
  return paths;
}

/**
 * @param {string} repoRoot
 * @returns {{ ok: boolean, detail?: string }}
 */
function tryPnpmFilterBuild(repoRoot) {
  const pnpmOnPath = spawnSync(process.platform === 'win32' ? 'where pnpm' : 'which pnpm', {
    encoding: 'utf8',
    shell: true,
  });
  if (pnpmOnPath.status !== 0 || !(pnpmOnPath.stdout || '').trim()) {
    return { ok: false, detail: 'pnpm không có trên PATH' };
  }
  const r = spawnSync('pnpm', ['--filter', '@marketingspa/shared', 'build'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: '' },
    shell: true,
  });
  const out = resolve(repoRoot, 'packages/shared/dist/email-click-destination.js');
  if (r.status === 0 && existsSync(out)) {
    return { ok: true, detail: 'pnpm --filter @marketingspa/shared build OK' };
  }
  return {
    ok: false,
    detail: (r.stderr || r.stdout || 'pnpm build failed').split('\n').slice(-4).join(' '),
  };
}

/**
 * @param {string} sharedDir
 * @returns {boolean}
 */
function workspaceConfigResolvable(sharedDir) {
  const link = resolve(sharedDir, 'node_modules/@marketingspa/config/tsconfig.base.json');
  return existsSync(link);
}

const MINIMAL_OFFLINE_SRC = [
  'src/email-click-destination.ts',
  'src/email-tracked-links.ts',
  'src/landing-page-public-cache.ts',
  'src/landing-page-cache-retry-token.ts',
];

/**
 * @param {string} repoRoot
 * @param {string} tsc
 * @param {boolean} usePackageTsconfig
 * @returns {{ ok: boolean, detail?: string }}
 */
function runSharedTsc(repoRoot, tsc, usePackageTsconfig) {
  const sharedDir = resolve(repoRoot, 'packages/shared');
  const out = resolve(sharedDir, 'dist/email-click-destination.js');
  const qaTsconfig = resolve(sharedDir, 'tsconfig.build-qa.json');
  let tsconfigPath = resolve(sharedDir, 'tsconfig.json');

  if (!usePackageTsconfig) {
    const typeRoots = resolvePnpmNodeTypeRoots(repoRoot);
    const paths = sharedCompilerPaths(repoRoot);
    writeFileSync(
      qaTsconfig,
      JSON.stringify(
        {
          extends: '../config/tsconfig.base.json',
          compilerOptions: {
            outDir: './dist',
            rootDir: './src',
            declaration: true,
            declarationMap: true,
            baseUrl: '.',
            paths,
            lib: ['ES2022', 'DOM'],
            ...(typeRoots ? { typeRoots } : {}),
          },
          include: ['src/**/*'],
          exclude: ['node_modules', 'dist'],
        },
        null,
        2,
      ),
    );
    tsconfigPath = qaTsconfig;
  }

  const r = spawnSync(process.execPath, [tsc, '-p', tsconfigPath], {
    cwd: sharedDir,
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: '' },
  });

  if (!usePackageTsconfig && existsSync(qaTsconfig)) unlinkSync(qaTsconfig);

  if (r.status === 0 && existsSync(out)) {
    return {
      ok: true,
      detail: usePackageTsconfig ? 'tsconfig.json (workspace)' : 'tsconfig.build-qa (pnpm paths)',
    };
  }
  return {
    ok: false,
    detail: (r.stderr || r.stdout || 'tsc failed').split('\n').slice(-5).join(' '),
  };
}

/**
 * @param {string} repoRoot
 * @param {string} tsc
 * @returns {{ ok: boolean, detail?: string }}
 */
function runMinimalOfflineTsc(repoRoot, tsc) {
  const sharedDir = resolve(repoRoot, 'packages/shared');
  const out = resolve(sharedDir, 'dist/email-click-destination.js');
  const qaTsconfig = resolve(sharedDir, 'tsconfig.build-qa-minimal.json');
  const typeRoots = resolvePnpmNodeTypeRoots(repoRoot);
  writeFileSync(
    qaTsconfig,
    JSON.stringify(
      {
        extends: '../config/tsconfig.base.json',
        compilerOptions: {
          outDir: './dist',
          rootDir: './src',
          declaration: true,
          ...(typeRoots ? { typeRoots } : {}),
        },
        include: MINIMAL_OFFLINE_SRC,
        exclude: ['node_modules', 'dist'],
      },
      null,
      2,
    ),
  );
  const r = spawnSync(process.execPath, [tsc, '-p', qaTsconfig], {
    cwd: sharedDir,
    encoding: 'utf8',
    env: { ...process.env, NODE_OPTIONS: '' },
  });
  if (existsSync(qaTsconfig)) unlinkSync(qaTsconfig);
  if (r.status === 0 && existsSync(out)) {
    return { ok: true, detail: 'minimal offline src (workspace symlinks broken)' };
  }
  return {
    ok: false,
    detail: (r.stderr || r.stdout || 'minimal tsc failed').split('\n').slice(-5).join(' '),
  };
}

/**
 * @param {string} [repoRoot]
 * @returns {{ ok: boolean, detail?: string }}
 */
function buildSharedPackage(repoRoot = resolve(__dirname, '..')) {
  const sharedDir = resolve(repoRoot, 'packages/shared');
  const tsc = findTsc(repoRoot);
  const usePackageTsconfig = workspaceConfigResolvable(sharedDir);

  const full = runSharedTsc(repoRoot, tsc, usePackageTsconfig);
  if (full.ok) return full;

  const pnpmFallback = tryPnpmFilterBuild(repoRoot);
  if (pnpmFallback.ok) return pnpmFallback;

  if (!usePackageTsconfig) {
    const minimal = runMinimalOfflineTsc(repoRoot, tsc);
    if (minimal.ok) return minimal;
    return { ok: false, detail: `${full.detail}; minimal: ${minimal.detail}` };
  }

  return { ok: false, detail: `${full.detail}; pnpm: ${pnpmFallback.detail}` };
}

if (require.main === module) {
  const r = buildSharedPackage();
  if (!r.ok) {
    console.error(`[shared-build] FAIL — ${r.detail}`);
    process.exit(1);
  }
  console.log(`[shared-build] PASS — ${r.detail}`);
}

module.exports = { buildSharedPackage, findTsc, resolvePnpmNodeTypeRoots, resolvePnpmPackageDir };