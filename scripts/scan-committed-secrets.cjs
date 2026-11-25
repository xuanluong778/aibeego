/**
 * Quét file đã track trong git — pattern nhạy cảm, KHÔNG in giá trị.
 * Exit 1 → CI FAIL (in rõ [secrets-scan] FAIL).
 */
const { spawnSync } = require('child_process');
const { resolve } = require('path');

const cwd = resolve(__dirname, '..');

const GREP_ARGS = [
  '-n',
  '-E',
  'BEGIN (RSA )?PRIVATE KEY|AKIA[0-9A-Z]{16}|sk_live_[0-9a-zA-Z]{16,}|ghp_[0-9a-zA-Z]{20,}',
  '--',
  ':!*.png',
  ':!*.jpg',
  ':!*.jpeg',
  ':!*.gif',
  ':!*.webp',
  ':!*.woff',
  ':!*.woff2',
  ':!*.ico',
  ':!*.pdf',
  ':!*.zip',
  ':!backups/**',
  ':!chatbot_cskh_bundle_*',
];

function fail(reason) {
  console.error(`[secrets-scan] FAIL — ${reason}`);
  process.exit(1);
}

function main() {
  console.log('[secrets-scan] git grep patterns (paths only, no secret values)');

  const gitCheck = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd, encoding: 'utf8' });
  if (gitCheck.status !== 0) {
    fail('git không khả dụng hoặc không phải repository — công cụ quét chặn CI');
  }

  const r = spawnSync('git', ['grep', ...GREP_ARGS], { cwd, encoding: 'utf8' });
  if (r.status === 1 && !r.stdout?.trim()) {
    console.log('[secrets-scan] PASS — 0 secret pattern trong git-tracked files');
  } else if (r.status === 0) {
    console.error('[secrets-scan] FAIL — secret pattern trong git-tracked files:');
    for (const line of r.stdout.trim().split(/\r?\n/).slice(0, 50)) {
      const colon = line.indexOf(':');
      const path = colon >= 0 ? line.slice(0, colon) : line;
      console.error(`  - ${path} | impact=high — review/rotate, remove from git if production`);
    }
    process.exit(1);
  } else {
    fail(
      `git grep lỗi (status=${r.status}) — ${(r.stderr || '').split('\n')[0] || 'unknown'}; CI blocked`,
    );
  }

  const files = spawnSync('git', ['ls-files', '*.dump', '*.sql'], { cwd, encoding: 'utf8' });
  if (files.status !== 0) {
    fail(`git ls-files lỗi (status=${files.status})`);
  }

  const dumps = (files.stdout || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(
      (f) =>
        f &&
        !f.includes('prisma/migrations/') &&
        !f.includes('migrations_archived_') &&
        !f.includes('migrations_preserved_') &&
        (f.endsWith('.dump') || f.includes('_data_') || f.includes('github-sync')),
    );

  if (dumps.length) {
    console.error('[secrets-scan] FAIL — SQL/dump data tracked ngoài migrations:');
    for (const f of dumps) {
      console.error(`  - ${f} | impact=medium — remove from git tracking`);
    }
    process.exit(1);
  }

  console.log('[secrets-scan] PASS — không có data dump tracked');
}

main();