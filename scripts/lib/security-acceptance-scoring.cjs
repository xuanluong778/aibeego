/**
 * Chấm PASS / FAIL / CHƯA KIỂM CHỨNG cho cổng nghiệm thu (Prompt 6).
 */

const REQUIRED_CHUA_MARK = /\[CHƯA KIỂM CHỨNG\s*—\s*bắt buộc\]/i;
const SUITE_CHUA_THIEU =
  /CHƯA KIỂM CHỨNG\s*—\s*thiếu(?![\s\S]{0,120}(tùy chọn|không bắt buộc|browser QA|Google OAuth))/i;

/**
 * @param {{ exitCode: number|null, blocked?: boolean, required: boolean, stdout?: string }} input
 */
function scoreSuiteResult(input) {
  const combined = input.stdout || '';
  if (input.blocked) {
    return input.required ? 'CHƯA KIỂM CHỨNG' : 'CHƯA KIỂM CHỨNG';
  }
  if (input.exitCode === 127 || input.exitCode === null) {
    return input.required ? 'CHƯA KIỂM CHỨNG' : 'CHƯA KIỂM CHỨNG';
  }

  if (input.required) {
    if (REQUIRED_CHUA_MARK.test(combined) || SUITE_CHUA_THIEU.test(combined)) {
      return 'CHƯA KIỂM CHỨNG';
    }
  }

  const hardFailLine = combined.split('\n').some((line) => {
    if (/\[PASS\]/.test(line)) return false;
    const t = line.trim();
    return /^\[FAIL\]/.test(t) || /^FAIL\s+/.test(t);
  });
  const hardFailInOutput =
    hardFailLine ||
    /AssertionError|ERR_ASSERTION/.test(combined) ||
    (input.required && /\b0\/\d+\s+passed/i.test(combined));

  const exitFail = (input.exitCode ?? 1) !== 0;
  if (exitFail || hardFailInOutput) return 'FAIL';
  return 'PASS';
}

/**
 * @param {Array<{ status: string, required: boolean }>} suites
 * @param {'offline'|'full'} mode
 */
function summarizeGate(suites, mode) {
  let pass = 0;
  let fail = 0;
  let chua = 0;
  let blocking = 0;
  for (const s of suites) {
    const req = Boolean(s.required);
    if (s.status === 'PASS') pass += 1;
    else if (s.status === 'FAIL') {
      fail += 1;
      if (req) blocking += 1;
    } else if (s.status === 'CHƯA KIỂM CHỨNG') {
      chua += 1;
      if (req) blocking += 1;
    }
  }
  const qaPass = blocking === 0;
  const releaseReady = qaPass && chua === 0;
  return { pass, fail, chua, blocking, qaPass, releaseReady, mode };
}

module.exports = { scoreSuiteResult, summarizeGate, REQUIRED_CHUA_MARK, SUITE_CHUA_THIEU };