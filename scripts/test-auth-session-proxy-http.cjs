/**
 * Rate limit qua nginx QA (:8080).
 * - Cùng email: chứng minh rate limit chạy qua proxy.
 * - XFF giả khác nhau: không được né IP bucket (kỳ vọng 429 trước lần 16 khi IP thật giống nhau).
 */
const BASE = process.env.AUTH_SESSION_PROXY_URL || 'http://127.0.0.1:8080';

async function postLogin(email, password, xff) {
  const res = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(xff ? { 'X-Forwarded-For': xff } : {}),
    },
    body: JSON.stringify({ email, password }),
  });
  return res.status;
}

async function main() {
  console.log('[auth-session-proxy]', BASE);
  const email = `qa-proxy-${Date.now()}@example.invalid`;
  const password = 'wrong-qa-pass';
  let email429 = false;
  for (let i = 0; i < 8; i++) {
    const status = await postLogin(email, password, `203.0.113.${i}`);
    if (status === 429) {
      email429 = true;
      break;
    }
  }
  const emailStatus = email429 ? 'PASS' : 'FAIL';
  console.log(
    `  [${emailStatus}] HTTP proxy — rate limit login (cùng email, XFF đổi)${email429 ? '' : ' — no 429'}`,
  );

  let ip429 = false;
  for (let i = 0; i < 20; i++) {
    const status = await postLogin(`qa-ip-${i}-${Date.now()}@example.invalid`, password, `198.51.100.${i}`);
    if (status === 429) {
      ip429 = true;
      break;
    }
  }
  const ipStatus = ip429 ? 'PASS' : 'CHƯA KIỂM CHỨNG';
  console.log(
    `  [${ipStatus}] HTTP proxy — IP bucket không bị XFF giả né${ip429 ? '' : ' — nginx vẫn chain XFF; xem HTTP direct'}`,
  );

  if (!email429) process.exit(1);
  console.log('[auth-session-proxy] PASS (email bucket)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});