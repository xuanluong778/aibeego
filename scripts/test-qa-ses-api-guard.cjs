/**
 * Fixture — guard SES API QA: DB khác _qa, không xác minh được đích (không đụng marketingspa-api vận hành).
 */
const assert = require('node:assert/strict');
const { assertQaSesFixture } = require('./lib/security-acceptance-qa-env.cjs');
const { assertApiContainerDatabase } = require('./lib/security-acceptance-api-qa-sidecar.cjs');

function expectThrow(fn, label) {
  let threw = false;
  try {
    fn();
  } catch (e) {
    threw = true;
    console.log(`  [PASS] ${label} — ${e.message.slice(0, 100)}`);
  }
  assert.ok(threw, label);
}

expectThrow(
  () =>
    assertQaSesFixture({
      dbName: 'marketingspa_hrm_finance_qa',
      apiUrl: 'http://127.0.0.1:4102',
      apiContainer: 'marketingspa-api-no-such',
      skipPostgres: true,
    }),
  'API container không chạy',
);

expectThrow(
  () => assertApiContainerDatabase('marketingspa-api-no-such-2', 'marketingspa_hrm_finance_qa'),
  'assertApiContainerDatabase container ảo',
);

const { dockerContainerRunning } = require('./lib/security-acceptance-api-qa-sidecar.cjs');
if (dockerContainerRunning('marketingspa-api-ses-p0-qa')) {
  expectThrow(
    () =>
      assertQaSesFixture({
        dbName: 'marketingspa_sales_idem_qa',
        apiUrl: 'http://127.0.0.1:4102',
        apiContainer: 'marketingspa-api-ses-p0-qa',
        skipPostgres: true,
      }),
    'sidecar DB _qa khác fixture',
  );
} else {
  expectThrow(
    () =>
      assertQaSesFixture({
        dbName: 'marketingspa_hrm_finance_qa',
        apiUrl: 'http://127.0.0.1:4102',
        apiContainer: 'marketingspa-api',
        skipPostgres: true,
      }),
    'marketingspa-api vận hành — DB khác fixture',
  );
}

console.log('\n[test-qa-ses-api-guard] PASS');