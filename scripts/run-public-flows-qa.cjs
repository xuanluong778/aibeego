/**
 * QA luồng công khai: cache LP + link email (unit; không deploy production).
 */
const { resolve } = require('path');
const { spawnSync } = require('child_process');

const cwd = resolve(__dirname, '..');
const r = spawnSync(process.execPath, ['scripts/test-public-cache-email-guards.cjs'], {
  cwd,
  stdio: 'inherit',
  env: { ...process.env, NODE_OPTIONS: '' },
});
if (r.status !== 0) process.exit(r.status ?? 1);

console.log('\n[prompt4] Browser / HTTP QA — CHƯA KIỂM CHỨNG:');
console.log('  - LP A/B: publish, cập nhật, unpublish, xóa — chỉ A đổi; retry cache sau xóa');
console.log('  - Email: gửi chiến dịch QA — click #fragment, đếm, unsubscribe');
console.log('\n[prompt4] PASS (helper unit suite)');