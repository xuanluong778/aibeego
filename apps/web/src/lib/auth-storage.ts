'use client';

import { publishAuthMessage } from './auth-coordinator';

const ACCESS_KEY = 'ms_access_token';
const EPOCH_KEY = 'ms_auth_session_epoch';
const TOKEN_EPOCH_KEY = 'ms_auth_token_epoch';

/** Bộ nhớ tạo tab — đồng bộ với localStorage khi đọc epoch. */
let sessionEpoch = 0;

function readEpochFromStorage(): number {
  if (typeof window === 'undefined') return sessionEpoch;
  try {
    const raw = localStorage.getItem(EPOCH_KEY);
    const n = raw ? parseInt(raw, 10) : 0;
    if (Number.isFinite(n)) {
      sessionEpoch = Math.max(sessionEpoch, n);
    }
  } catch {
    /* ignore */
  }
  return sessionEpoch;
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (ev) => {
    if (ev.key === EPOCH_KEY || ev.key === ACCESS_KEY || ev.key === TOKEN_EPOCH_KEY) {
      readEpochFromStorage();
    }
  });
}

export const authStorage = {
  getSessionEpoch(): number {
    return readEpochFromStorage();
  },
  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    const token = localStorage.getItem(ACCESS_KEY);
    if (!token) return null;
    const tokenEpoch = parseInt(localStorage.getItem(TOKEN_EPOCH_KEY) || '0', 10);
    const globalEpoch = readEpochFromStorage();
    if (!Number.isFinite(tokenEpoch) || tokenEpoch < globalEpoch) return null;
    return token;
  },
  setAccessToken(accessToken: string, opts?: { epochAtStart?: number }) {
    const epochNow = readEpochFromStorage();
    const atStart = opts?.epochAtStart;
    if (atStart !== undefined && atStart !== epochNow) {
      return;
    }
    localStorage.setItem(ACCESS_KEY, accessToken);
    localStorage.setItem(TOKEN_EPOCH_KEY, String(epochNow));
    publishAuthMessage({ type: 'access-token', token: accessToken });
  },
  clear() {
    const next = readEpochFromStorage() + 1;
    sessionEpoch = next;
    try {
      localStorage.setItem(EPOCH_KEY, String(next));
      localStorage.removeItem(ACCESS_KEY);
      localStorage.removeItem(TOKEN_EPOCH_KEY);
    } catch {
      /* ignore */
    }
    publishAuthMessage({ type: 'logout' });
  },
  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  },
};