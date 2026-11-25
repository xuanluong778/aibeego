/**
 * QA logic refresh / logout epoch (không DOM) — mirror auth-session-policy + epoch contract.
 */
import { randomUUID } from 'node:crypto';

/** Mirror `apps/web/src/lib/auth-session-policy.ts` — QA Node không import TS web. */
function accessTokenExpiringSoon(token: string | null, nowMs = Date.now(), skewMs = 45_000): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return true;
    const b64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(b64, 'base64').toString('utf8');
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp !== 'number') return true;
    return payload.exp * 1000 <= nowMs + skewMs;
  } catch {
    return true;
  }
}

function accessTokenStillValidByExp(token: string | null, nowMs = Date.now()): boolean {
  return !!token && !accessTokenExpiringSoon(token, nowMs);
}

function shouldReuseStoredTokenAfterLock(
  stored: string | null,
  rejected: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!stored) return false;
  if (rejected && stored === rejected) return false;
  return accessTokenStillValidByExp(stored, nowMs);
}

const results: Array<{ name: string; status: 'PASS' | 'FAIL'; detail?: string }> = [];

function record(name: string, ok: boolean, detail?: string) {
  results.push({ name, status: ok ? 'PASS' : 'FAIL', detail });
  console.log(`  [${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) process.exitCode = 1;
}

function signJwt(expOffsetSec: number) {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + expOffsetSec;
  const body = Buffer.from(JSON.stringify({ exp, jti: randomUUID() })).toString('base64url');
  return `${header}.${body}.x`;
}

function simulateEpochStore() {
  let sessionEpoch = 0;
  let accessToken: string | null = null;
  let tokenEpoch = -1;

  return {
    getSessionEpoch: () => sessionEpoch,
    getAccessToken: () => (tokenEpoch < sessionEpoch ? null : accessToken),
    setAccessToken: (t: string, atEpoch: number) => {
      if (atEpoch !== sessionEpoch) return false;
      accessToken = t;
      tokenEpoch = sessionEpoch;
      return true;
    },
    clear: () => {
      sessionEpoch += 1;
      accessToken = null;
      tokenEpoch = -1;
    },
    bumpLogoutRemote: () => {
      sessionEpoch += 1;
    },
  };
}

function main() {
  console.log('[auth-session-web-logic]');
  const fresh = signJwt(3600);
  const rejected = signJwt(3600);
  const peer = signJwt(3600);

  record(
    '401 — không tái dùng đúng token vừa bị từ chối (còn hạn)',
    !shouldReuseStoredTokenAfterLock(rejected, rejected),
  );
  record(
    'Hai tab — token peer khác → tái dùng, không refresh thừa',
    shouldReuseStoredTokenAfterLock(peer, rejected),
  );
  record(
    'Token sắp hết hạn — không coi là still valid',
    !accessTokenStillValidByExp(signJwt(-10)),
  );

  const store = simulateEpochStore();
  const epochStart = store.getSessionEpoch();
  store.setAccessToken(fresh, epochStart);
  store.bumpLogoutRemote();
  const saved = store.setAccessToken(signJwt(3600), epochStart);
  record(
    'Logout epoch — không lưu token sau khi tab khác logout',
    !saved && store.getAccessToken() === null,
  );
  record(
    'Logout epoch — refresh giả lập trả null nếu epoch đổi',
    epochStart !== store.getSessionEpoch(),
  );

  const mid = simulateEpochStore();
  const reqEpoch = mid.getSessionEpoch();
  mid.setAccessToken(fresh, reqEpoch);
  mid.bumpLogoutRemote();
  const noRetrySave = mid.setAccessToken(peer, reqEpoch);
  record(
    'Request in-flight — epoch đổi → không lưu / không refresh lại',
    !noRetrySave && mid.getAccessToken() === null,
  );

  const pass = results.filter((r) => r.status === 'PASS').length;
  console.log(`\n[auth-session-web-logic] ${pass}/${results.length} PASS`);
  if ((process.exitCode ?? 0) !== 0) process.exit(1);
}

main();