/**
 * Browser QA phiên — epoch đa tab, reload sau logout (localhost:8080).
 */
const path = require('path');
const { chromium } = require(path.resolve(__dirname, '..', 'node_modules', 'playwright'));

const BASE = process.env.AUTH_SESSION_BROWSER_URL || 'http://127.0.0.1:8080';
const results = [];

function record(name, status, detail) {
  results.push({ name, status, detail });
  console.log(`  [${status}] ${name}${detail ? ` — ${detail}` : ''}`);
  if (status === 'FAIL') process.exitCode = 1;
}

const EPOCH_KEY = 'ms_auth_session_epoch';
const TOKEN_KEY = 'ms_access_token';
const TOKEN_EPOCH_KEY = 'ms_auth_token_epoch';

function epochLogicScript() {
  function readEpoch() {
    const n = parseInt(localStorage.getItem('ms_auth_session_epoch') || '0', 10);
    return Number.isFinite(n) ? n : 0;
  }
  function getAccessToken() {
    const token = localStorage.getItem('ms_access_token');
    if (!token) return null;
    const te = parseInt(localStorage.getItem('ms_auth_token_epoch') || '0', 10);
    if (te < readEpoch()) return null;
    return token;
  }
  function setAccessToken(t) {
    const e = readEpoch();
    localStorage.setItem('ms_access_token', t);
    localStorage.setItem('ms_auth_token_epoch', String(e));
    return true;
  }
  function clear() {
    const e = readEpoch() + 1;
    localStorage.setItem('ms_auth_session_epoch', String(e));
    localStorage.removeItem('ms_access_token');
    localStorage.removeItem('ms_auth_token_epoch');
  }
  return { readEpoch, getAccessToken, setAccessToken, clear };
}

async function main() {
  console.log('[auth-session-browser]', BASE);
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: 'msedge' });
  } catch {
    browser = await chromium.launch({ headless: true });
  }
  const ctx = await browser.newContext();
  const pageA = await ctx.newPage();
  const pageB = await ctx.newPage();
  await pageA.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await pageB.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 });

  await pageA.evaluate((keys) => {
    localStorage.setItem(keys.TOKEN, 'stale-access');
    localStorage.setItem(keys.TOKEN_EPOCH, '0');
    localStorage.setItem(keys.EPOCH, '0');
  }, { TOKEN: TOKEN_KEY, TOKEN_EPOCH: TOKEN_EPOCH_KEY, EPOCH: EPOCH_KEY });

  await pageB.evaluate((keys) => {
    localStorage.setItem(keys.EPOCH, '1');
    localStorage.removeItem(keys.TOKEN);
    localStorage.removeItem(keys.TOKEN_EPOCH);
  }, { TOKEN: TOKEN_KEY, TOKEN_EPOCH: TOKEN_EPOCH_KEY, EPOCH: EPOCH_KEY });

  const tokenVisibleOnA = await pageA.evaluate(() => {
    const readEpoch = () => {
      const n = parseInt(localStorage.getItem('ms_auth_session_epoch') || '0', 10);
      return Number.isFinite(n) ? n : 0;
    };
    const token = localStorage.getItem('ms_access_token');
    if (!token) return null;
    const te = parseInt(localStorage.getItem('ms_auth_token_epoch') || '0', 10);
    if (te < readEpoch()) return null;
    return token;
  });

  record(
    'Browser — tab B logout epoch, tab A không còn access (không BroadcastChannel)',
    tokenVisibleOnA === null ? 'PASS' : 'FAIL',
    tokenVisibleOnA ? 'still sees token' : 'null',
  );

  await pageA.evaluate((keys) => {
    localStorage.setItem(keys.EPOCH, '2');
    localStorage.removeItem(keys.TOKEN);
    localStorage.removeItem(keys.TOKEN_EPOCH);
  }, { TOKEN: TOKEN_KEY, TOKEN_EPOCH: TOKEN_EPOCH_KEY, EPOCH: EPOCH_KEY });

  await pageA.reload({ waitUntil: 'domcontentloaded' });
  const afterReload = await pageA.evaluate(() => localStorage.getItem('ms_access_token'));
  record(
    'Browser — reload sau logout không khôi phục access từ localStorage',
    !afterReload ? 'PASS' : 'FAIL',
    afterReload ? 'token present' : 'cleared',
  );

  record('Browser — OTP đăng ký', 'CHƯA KIỂM CHỨNG', 'cần mail catcher QA');
  record('Browser — Google OAuth', 'CHƯA KIỂM CHỨNG', 'cần Google client QA');
  record('Browser — Socket.IO reconnect sau refresh', 'CHƯA KIỂM CHỨNG', 'cần phiên đăng nhập thật + WS');

  await browser.close();
  const pass = results.filter((r) => r.status === 'PASS').length;
  console.log(`\n[auth-session-browser] ${pass}/${results.length} PASS`);
  if ((process.exitCode ?? 0) !== 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});