'use client';

/** Đồng bộ refresh / access token giữa nhiều tab — tránh tab thua xóa phiên tab thắng. */

const CHANNEL = 'ms-auth-v1';
const LOCK_NAME = 'ms-auth-refresh';
const PEER_WAIT_MS = 2500;

type AuthBusMessage =
  | { type: 'access-token'; token: string }
  | { type: 'logout' }
  | { type: 'refresh-done'; ok: boolean };

function channel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return null;
  try {
    return new BroadcastChannel(CHANNEL);
  } catch {
    return null;
  }
}

export function publishAuthMessage(msg: AuthBusMessage) {
  const ch = channel();
  ch?.postMessage(msg);
  ch?.close();
}

export function waitForPeerAccessToken(timeoutMs = PEER_WAIT_MS): Promise<string | null> {
  return new Promise((resolve) => {
    const ch = channel();
    if (!ch) {
      resolve(null);
      return;
    }
    const timer = window.setTimeout(() => {
      ch.close();
      resolve(null);
    }, timeoutMs);
    ch.onmessage = (ev: MessageEvent<AuthBusMessage>) => {
      const data = ev.data;
      if (data?.type === 'access-token' && typeof data.token === 'string' && data.token) {
        window.clearTimeout(timer);
        ch.close();
        resolve(data.token);
      }
      if (data?.type === 'logout') {
        window.clearTimeout(timer);
        ch.close();
        resolve(null);
      }
    };
  });
}

/**
 * Chỉ một tab/tab-group gọi refresh HTTP; tab khác chờ broadcast access token.
 */
export async function withRefreshCoordination<T>(run: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks?.request) {
    return navigator.locks.request(LOCK_NAME, run);
  }
  return run();
}