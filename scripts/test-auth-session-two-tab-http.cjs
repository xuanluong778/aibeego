/**
 * Web/API QA thật — hai tab: refresh vs logout (cookie qua :8080).
 * Cần AUTH_SESSION_QA_EMAIL + AUTH_SESSION_QA_PASSWORD (mật khẩu ≥ 8 ký tự).
 */
const BASE = process.env.AUTH_SESSION_PROXY_URL || 'http://127.0.0.1:8080';
const EMAIL = process.env.AUTH_SESSION_QA_EMAIL?.trim();
const PASSWORD = process.env.AUTH_SESSION_QA_PASSWORD;

function readSetCookie(res) {
  if (typeof res.headers.getSetCookie === 'function') {
    return res.headers.getSetCookie().join('; ');
  }
  return res.headers.get('set-cookie') || '';
}

function parseRefreshCookie(setCookie) {
  if (!setCookie) return null;
  const m = /ms_refresh_token=([^;]+)/.exec(setCookie);
  if (!m?.[1]) return null;
  const token = decodeURIComponent(m[1].trim());
  return { header: `ms_refresh_token=${token}`, token };
}

async function httpRefresh(refreshCookie, refreshTok, opts = {}) {
  const headers = { 'Content-Type': 'application/json', Cookie: refreshCookie };
  if (opts.holdResponse) headers['x-auth-session-qa-hold'] = '1';
  const res = await fetch(`${BASE}/api/v1/auth/refresh`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({ refreshToken: refreshTok || '' }),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body, setCookie: readSetCookie(res) };
}

async function httpLogout(access, refreshCookie) {
  const res = await fetch(`${BASE}/api/v1/auth/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${access}`,
      Cookie: refreshCookie,
    },
    credentials: 'include',
  });
  return res.status;
}

async function main() {
  console.log('[auth-session-two-tab]', BASE);
  if (!EMAIL || !PASSWORD) {
    console.log('  [CHƯA KIỂM CHỨNG] Thiếu AUTH_SESSION_QA_EMAIL / AUTH_SESSION_QA_PASSWORD');
    return;
  }

  const loginRes = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const loginBody = await loginRes.json().catch(() => ({}));
  const access = typeof loginBody.accessToken === 'string' ? loginBody.accessToken : '';
  const loginCookie = parseRefreshCookie(readSetCookie(loginRes));
  const refreshCookie = loginCookie?.header ?? '';
  const refreshTok = loginCookie?.token ?? '';

  if (!loginRes.ok || !access || !refreshCookie) {
    console.log(`  [FAIL] Đăng nhập QA — status=${loginRes.status}`);
    process.exit(1);
  }

  const refreshP = httpRefresh(refreshCookie, refreshTok, { holdResponse: true });
  const logoutStatus = await httpLogout(access, refreshCookie);
  const refreshLate = await refreshP;

  const okLogout = logoutStatus === 200 || logoutStatus === 201;
  console.log(
    `  [${okLogout ? 'PASS' : 'FAIL'}] Một logout (cookie đăng nhập) — status=${logoutStatus}`,
  );

  const lateParsed = parseRefreshCookie(refreshLate.setCookie);
  if ((refreshLate.status === 200 || refreshLate.status === 201) && lateParsed) {
    const probe = await httpRefresh(lateParsed.header, lateParsed.token);
    console.log(
      `  [${probe.status === 401 ? 'PASS' : 'FAIL'}] Cookie mới Set-Cookie muộn → refresh 401 — status=${probe.status}`,
    );
    if (probe.status !== 401) process.exit(1);
  } else {
    const probe = await httpRefresh(refreshCookie, refreshTok);
    console.log(
      `  [${probe.status === 401 ? 'PASS' : 'FAIL'}] Refresh race thua / không cookie mới — again=${probe.status} late=${refreshLate.status}`,
    );
    if (probe.status !== 401) process.exit(1);
  }

  const reload = await fetch(`${BASE}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: '{}',
  });
  console.log(
    `  [${reload.status === 401 ? 'PASS' : 'FAIL'}] Reload không cookie — status=${reload.status}`,
  );

  if (!okLogout || reload.status !== 401) process.exit(1);
  console.log('[auth-session-two-tab] PASS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});