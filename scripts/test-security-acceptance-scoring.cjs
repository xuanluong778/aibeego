/**
 * Kiểm thử chấm điểm cổng — thiếu suite, suite lỗi, ca tùy chọn chưa chạy (Prompt 6).
 */
const assert = require('node:assert/strict');
const { scoreSuiteResult, summarizeGate } = require('./lib/security-acceptance-scoring.cjs');

function pass(name) {
  console.log(`  [PASS] ${name}`);
}

let failed = 0;
function check(name, cond) {
  if (!cond) {
    console.log(`  [FAIL] ${name}`);
    failed += 1;
  } else pass(name);
}

// 1) Suite bắt buộc chưa chạy (blocked)
const blocked = scoreSuiteResult({ exitCode: null, blocked: true, required: true, stdout: '' });
check('blocked required → CHƯA', blocked === 'CHƯA KIỂM CHỨNG');
const sumBlocked = summarizeGate([{ status: blocked, required: true }], 'full');
check('full gate blocked required → exit', !sumBlocked.qaPass && sumBlocked.blocking === 1);

// 2) Suite lỗi assertion
const bad = scoreSuiteResult({
  exitCode: 1,
  required: true,
  stdout: '  [PASS] a\nAssertionError: boom\n',
});
check('assertion → FAIL', bad === 'FAIL');
const sumFail = summarizeGate([{ status: bad, required: true }], 'offline');
check('offline gate FAIL required', !sumFail.qaPass);

// 3) Bắt buộc exit 0 nhưng có marker CHƯA bắt buộc
const chuaExit0 = scoreSuiteResult({
  exitCode: 0,
  required: true,
  stdout: '[suite] [CHƯA KIỂM CHỨNG — bắt buộc] thiếu HTTP webhook\n',
});
check('required CHƯA marker + exit 0 → CHƯA', chuaExit0 === 'CHƯA KIỂM CHỨNG');
const sumChua0 = summarizeGate([{ status: chuaExit0, required: true }], 'full');
check('full gate CHƯA required blocks', !sumChua0.qaPass);

// 4) Assertion FAIL nhưng exit 0
const assertExit0 = scoreSuiteResult({
  exitCode: 0,
  required: true,
  stdout: '  [PASS] a\nFAIL  http_webhook\n',
});
check('FAIL line + exit 0 → FAIL', assertExit0 === 'FAIL');

// 5) Ca tùy chọn CHƯA — suite PASS, không chặn offline
const okOptional = scoreSuiteResult({
  exitCode: 0,
  required: false,
  stdout: '  [PASS] core\n  [CHƯA KIỂM CHỨNG] browser QA\n',
});
check('optional CHƯA in output still PASS suite', okOptional === 'PASS');
const okRequiredOptionalChua = scoreSuiteResult({
  exitCode: 0,
  required: true,
  stdout:
    '  [PASS] core\n[email-click-unit] HTTP/browser A≠B isolation — CHƯA KIỂM CHỨNG\n',
});
check('required suite optional CHƯA lines still PASS', okRequiredOptionalChua === 'PASS');
const sumOpt = summarizeGate(
  [
    { status: 'PASS', required: true },
    { status: okOptional, required: false },
    { status: 'CHƯA KIỂM CHỨNG', required: false },
  ],
  'offline',
);
check('offline optional CHƯA không block QA', sumOpt.qaPass);
check('release chưa sẵn khi còn CHƯA', !sumOpt.releaseReady);

if (failed) process.exit(1);
console.log('\n[test-security-acceptance-scoring] PASS');