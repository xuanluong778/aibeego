/** Quy tắc refresh phiên — thuần, dùng cho api-client và QA. */

export function accessTokenExpiringSoon(token: string | null, nowMs = Date.now(), skewMs = 45_000): boolean {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return true;
    const b64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '='));
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp !== 'number') return true;
    return payload.exp * 1000 <= nowMs + skewMs;
  } catch {
    return true;
  }
}

export function accessTokenStillValidByExp(token: string | null, nowMs = Date.now()): boolean {
  return !!token && !accessTokenExpiringSoon(token, nowMs);
}

/**
 * Sau lock: chỉ tái dùng token trong storage nếu khác token vừa bị 401 và còn hạn.
 */
export function shouldReuseStoredTokenAfterLock(
  stored: string | null,
  rejected: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!stored) return false;
  if (rejected && stored === rejected) return false;
  return accessTokenStillValidByExp(stored, nowMs);
}