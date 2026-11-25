/**
 * Phân loại bundle SQL legacy (không in VALUES / PII).
 * Exit 0 = không còn file data tracked hoặc đã phân loại OK cho gate.
 */
const { spawnSync } = require('child_process');
const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');

const cwd = resolve(__dirname, '..');
const DATA_REL =
  'chatbot_cskh_bundle_20260702_132020/database/chatbot_cskh_data_postgresql.sql';

function gitTracked(rel) {
  const r = spawnSync('git', ['ls-files', '--error-unmatch', rel], { cwd, encoding: 'utf8' });
  return r.status === 0;
}

function main() {
  console.log('[bundle-sql-audit] legacy chatbot_cskh export (không log nội dung INSERT)');
  if (!existsSync(resolve(cwd, DATA_REL))) {
    console.log('[bundle-sql-audit] PASS — không có file data trên disk');
    return;
  }

  const tracked = gitTracked(DATA_REL);
  const raw = readFileSync(resolve(cwd, DATA_REL), 'utf8');
  const insertCount = (raw.match(/^\s*INSERT\s+INTO/gim) || []).length;
  const tableMatches = [...raw.matchAll(/INSERT\s+INTO\s+([^\s(]+)/gi)];
  const tables = [...new Set(tableMatches.map((m) => m[1]))];
  const emailAt = (raw.match(/@[a-z0-9.-]+\.[a-z]{2,}/gi) || []).length;
  const vnPhone = (raw.match(/0[3-9]\d{8}/g) || []).length;
  const bytes = Buffer.byteLength(raw, 'utf8');

  const usage = spawnSync('git', ['grep', '-l', 'chatbot_cskh_data_postgresql'], {
    cwd,
    encoding: 'utf8',
  });
  const refs =
    usage.status === 0
      ? usage.stdout
          .trim()
          .split(/\r?\n/)
          .filter((f) => f && f !== DATA_REL)
      : [];

  let classification = 'sample_legacy_export';
  if (emailAt > 5 || bytes > 500_000) classification = 'possible_production_pii';
  if (insertCount === 36 && bytes < 50_000 && emailAt === 0) {
    classification = 'sample_legacy_export';
  }

  console.log(`[bundle-sql-audit] insert_rows=${insertCount} bytes=${bytes} tables=${tables.length}`);
  console.log(`[bundle-sql-audit] indicators: email_tokens=${emailAt} vn_phone_patterns=${vnPhone}`);
  console.log(`[bundle-sql-audit] classification=${classification}`);
  console.log(`[bundle-sql-audit] git_tracked=${tracked} runtime_refs=${refs.length}`);
  if (refs.length) {
    for (const f of refs.slice(0, 10)) console.log(`  ref: ${f}`);
  }

  if (classification === 'possible_production_pii' && tracked) {
    console.log('[bundle-sql-audit] FAIL — dữ liệu có khả năng thật vẫn đang track; cần lưu ngoài git + bỏ track');
    process.exit(1);
  }

  if (tracked) {
    console.log(
      '[bundle-sql-audit] FAIL — file data vẫn git-tracked (scanner/CI phải chặn); bỏ track sau backup',
    );
    process.exit(1);
  }

  console.log('[bundle-sql-audit] PASS — không track data SQL hoặc đã gỡ track');
}

main();