/**
 * Auth mail — log không chứa OTP/token/link đầy đủ.
 * Chạy trong container API sau build: docker exec … node …/test-auth-mail-logging.js
 */
import assert from 'node:assert/strict';
import { ServiceUnavailableException } from '@nestjs/common';
import { AuthMailService } from './apps/api/dist/auth/auth-mail.service.js';
import { redactEmailForLog } from './apps/api/dist/auth/auth-mail.redact.js';

type LogRow = { level: string; msg: string };

function mockConfig(env: Record<string, string | undefined>) {
  return {
    get: (key: string, def?: string) => (env[key] !== undefined ? env[key] : def),
  } as never;
}

function attachLogCapture(service: AuthMailService) {
  const rows: LogRow[] = [];
  const logger = {
    log: (m: string) => rows.push({ level: 'log', msg: m }),
    warn: (m: string) => rows.push({ level: 'warn', msg: m }),
    error: (m: string) => rows.push({ level: 'error', msg: m }),
  };
  (service as unknown as { logger: typeof logger }).logger = logger;
  return rows;
}

function assertNoSecrets(rows: LogRow[], secrets: string[]) {
  const blob = rows.map((r) => r.msg).join('\n');
  for (const s of secrets) {
    assert.ok(!blob.includes(s), `log leaked secret: ${s.slice(0, 8)}…`);
  }
}

async function main() {
  const otp = '482901';
  const token = 'super-secret-reset-token-uuid';
  const email = 'qa.register@example.invalid';

  assert.equal(redactEmailForLog(email), 'q***@example.invalid');

  // 1) Thiếu SMTP, dev fallback — không ghi OTP
  const noSmtp = new AuthMailService(
    mockConfig({ NODE_ENV: 'development', SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '' }),
  );
  const logs1 = attachLogCapture(noSmtp);
  await noSmtp.sendRegistrationOtp(email, otp, 'QA User');
  assertNoSecrets(logs1, [otp, token, 'reset-password?token', 'verify-email?token']);
  assert.ok(logs1.some((r) => r.msg.includes('smtp=missing')));
  console.log('[PASS] dev-fallback không log OTP');

  // 2) Thiếu SMTP, bắt buộc OTP production
  const noSmtpProd = new AuthMailService(
    mockConfig({
      NODE_ENV: 'production',
      AUTH_OTP_DEV_FALLBACK: '',
      SMTP_HOST: '',
      SMTP_USER: '',
      SMTP_PASS: '',
    }),
  );
  const logs2 = attachLogCapture(noSmtpProd);
  await assert.rejects(() => noSmtpProd.sendRegistrationOtp(email, otp, 'QA'), (e: Error) =>
    e.message.includes('chưa cấu hình'),
  );
  assertNoSecrets(logs2, [otp, email, '482901']);
  assert.ok(logs2.some((r) => r.msg.includes('smtp-missing')));
  console.log('[PASS] thiếu SMTP production — 503, log che email');

  // 3) SMTP cấu hình nhưng gửi lỗi
  const smtpFail = new AuthMailService(
    mockConfig({
      NODE_ENV: 'production',
      SMTP_HOST: 'smtp.invalid.local',
      SMTP_USER: 'user',
      SMTP_PASS: 'pass',
    }),
  );
  const logs3 = attachLogCapture(smtpFail);
  (smtpFail as unknown as { transporter: { sendMail: () => Promise<never> } }).transporter = {
    sendMail: async () => {
      throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
    },
  };
  try {
    await smtpFail.sendRegistrationOtp(email, otp, 'QA');
    assert.fail('expected 503');
  } catch (e) {
    assert.ok(e instanceof ServiceUnavailableException);
    assert.equal(e.getStatus(), 503);
  }
  assertNoSecrets(logs3, [otp, token, 'reset-password?token']);
  const failLog = logs3.find((r) => r.msg.startsWith('[mail:fail]'))?.msg ?? '';
  assert.equal(failLog, `[mail:fail] kind=registration-otp to=q***@example.invalid status=fail code=ECONNREFUSED`);
  assert.ok(!failLog.includes('detail='));
  console.log('[PASS] lỗi SMTP — HTTP 503, log chỉ kind/to/status/code');

  // 5) SMTP giả — phản hồi lỗi chứa dữ liệu nhạy cảm
  const sensitivePass = 'SuperSecretSmtpPass-qa';
  const smtpLeak = new AuthMailService(
    mockConfig({
      NODE_ENV: 'production',
      SMTP_HOST: 'smtp.fake.local',
      SMTP_USER: 'user',
      SMTP_PASS: 'pass',
    }),
  );
  const logs5 = attachLogCapture(smtpLeak);
  const leakyResponse =
    '554 5.7.1 Rejected: OTP=482901 token=reset-abc verify?token=xyz <script>';
  (smtpLeak as unknown as { transporter: { sendMail: () => Promise<never> } }).transporter = {
    sendMail: async () => {
      throw Object.assign(new Error(`535 Auth failed password=${sensitivePass}`), {
        code: 'EAUTH',
        response: leakyResponse,
        responseCode: 554,
      });
    },
  };
  try {
    await smtpLeak.sendRegistrationOtp(email, otp, 'QA');
    assert.fail('expected 503');
  } catch (e) {
    assert.ok(e instanceof ServiceUnavailableException);
    assert.equal(e.getStatus(), 503);
    assert.ok(String(e.message).includes('Không gửi được email'));
  }
  assertNoSecrets(logs5, [
    otp,
    sensitivePass,
    leakyResponse,
    '482901',
    'reset-abc',
    '535 Auth',
    'password=',
    'Rejected:',
  ]);
  const leakLog = logs5.find((r) => r.msg.startsWith('[mail:fail]'))?.msg ?? '';
  assert.match(leakLog, /^\[mail:fail\] kind=registration-otp to=q\*\*\*@example\.invalid status=fail code=EAUTH$/);
  console.log('[PASS] SMTP giả lập nhạy cảm — 503, log không chứa phản hồi/message');

  // 4) Liên kết verify/reset — dev fallback không log URL
  const linkSvc = new AuthMailService(
    mockConfig({ NODE_ENV: 'development', SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '' }),
  );
  const logs4 = attachLogCapture(linkSvc);
  await linkSvc.sendActionLink('reset-password', email, token);
  await linkSvc.sendActionLink('verify-email', email, token);
  assertNoSecrets(logs4, [token, 'reset-password?token', 'verify-email?token', encodeURIComponent(token)]);
  console.log('[PASS] action-link dev-fallback không log token/URL');

  console.log('\n5/5 PASS auth-mail logging');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});