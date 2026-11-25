/**
 * Fixture — guard DB/API QA từ chối cấu hình vận hành (không kết nối DB thật).
 */
const assert = require('node:assert/strict');
const {
  assertQaDatabaseName,
  resolveApiUrl,
  assertQaDockerDatabaseLive,
} = require('./lib/security-acceptance-qa-env.cjs');

function expectThrow(fn, label) {
  let threw = false;
  try {
    fn();
  } catch (e) {
    threw = true;
    console.log(`  [PASS] ${label} — từ chối: ${e.message.slice(0, 80)}`);
  }
  assert.ok(threw, label);
}

assertQaDatabaseName('marketingspa_hrm_finance_qa');
console.log('  [PASS] DB QA hợp lệ');

expectThrow(() => assertQaDatabaseName('marketingspa_hrm_finance'), 'DB vận hành');
expectThrow(() => assertQaDatabaseName('app_production'), 'DB không suffix _qa');

process.env.API_URL = 'https://aibeego.com';
expectThrow(() => resolveApiUrl(), 'API host production');
process.env.API_URL = 'http://127.0.0.1:8080';
assert.equal(resolveApiUrl(), 'http://127.0.0.1:8080');
console.log('  [PASS] API QA host 127.0.0.1');

expectThrow(
  () => assertQaDockerDatabaseLive('marketingspa_hrm_finance'),
  'current_database guard từ chối DB sai tên',
);

console.log('\n[test-qa-db-guard] PASS');