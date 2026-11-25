import { authStorage } from './auth-storage';
import { getStoredAffiliateRef } from './affiliate-ref';
import { publishAuthMessage, waitForPeerAccessToken, withRefreshCoordination } from './auth-coordinator';
import { accessTokenExpiringSoon, shouldReuseStoredTokenAfterLock } from './auth-session-policy';

function resolveApiUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      return window.location.origin;
    }
  }
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (fromEnv && !fromEnv.includes('localhost') && !fromEnv.includes('127.0.0.1')) {
    return fromEnv.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return (
    process.env.API_INTERNAL_URL?.trim() ||
    fromEnv?.replace(/\/$/, '') ||
    'http://localhost:4000'
  );
}

export function getApiBaseUrl(): string {
  return `${resolveApiUrl()}/api/v1`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errors?: string[],
    public code?: string,
    public redirectTo?: string,
    public guidance?: string,
    public requestId?: string,
    public googleAdsErrorCode?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function throwApiError(res: Response, body: Record<string, unknown>) {
  const rawMsg = body.message;
  const message =
    typeof rawMsg === 'string'
      ? rawMsg
      : Array.isArray(rawMsg)
        ? rawMsg.map(String).join('; ')
        : res.statusText || 'API error';
  const guidance = typeof body.guidance === 'string' ? body.guidance : undefined;
  const requestId = typeof body.requestId === 'string' ? body.requestId : undefined;
  const googleAdsErrorCode =
    typeof body.googleAdsErrorCode === 'string'
      ? body.googleAdsErrorCode
      : typeof body.code === 'string'
        ? body.code
        : undefined;
  const display =
    guidance && !message.includes(guidance) ? `${message}\n\nCách xử lý: ${guidance}` : message;
  const err = new ApiError(
    display,
    res.status,
    Array.isArray(body.errors) ? (body.errors as string[]) : undefined,
    typeof body.code === 'string' ? body.code : undefined,
    typeof body.redirectTo === 'string' ? body.redirectTo : undefined,
    guidance,
    requestId,
    googleAdsErrorCode,
  );
  // Chặn gọi API trực tiếp khi chưa thanh toán / hết trial → về trang giá
  if (
    typeof window !== 'undefined' &&
    res.status === 403 &&
    (body.code === 'SUBSCRIPTION_REQUIRED' || body.code === 'TRIAL_EXPIRED')
  ) {
    const dest = typeof body.redirectTo === 'string' ? body.redirectTo : '/pricing';
    if (!window.location.pathname.startsWith('/pricing')) {
      const reason = body.code === 'TRIAL_EXPIRED' ? 'trial_expired' : 'subscription_required';
      window.location.replace(`${dest}?reason=${reason}`);
    }
  }
  throw err;
}

/** Single-flight refresh — tránh race nhiều request 401 song song làm hỏng refresh token */
let refreshInFlight: Promise<string | null> | null = null;
/** One hard login redirect per page load */
let loginRedirectScheduled = false;

/** JWT exp trong ≤45s hoặc malformed → refresh trước (tránh 401 ồn console trên /auth/me). */
function accessTokenNeedsRefresh(token: string | null): boolean {
  return accessTokenExpiringSoon(token);
}

function readRefreshErrorCode(body: Record<string, unknown> | null): string | undefined {
  if (!body) return undefined;
  return typeof body.code === 'string' ? body.code : undefined;
}

/** Phiên đã logout tab khác — dừng request, không retry / refresh. */
function abortIfSessionEpochChanged(epochAtStart: number): void {
  if (authStorage.getSessionEpoch() !== epochAtStart) {
    throw new ApiError('Unauthorized', 401);
  }
}

async function refreshAccessToken(rejectedAccessToken?: string | null): Promise<string | null> {
  const epochAtStart = authStorage.getSessionEpoch();
  if (refreshInFlight) {
    const token = await refreshInFlight;
    if (epochAtStart !== authStorage.getSessionEpoch()) return null;
    return token;
  }
  refreshInFlight = (async () => {
    try {
      return await withRefreshCoordination(async () => {
        abortIfSessionEpochChanged(epochAtStart);
        const afterLock = authStorage.getAccessToken();
        if (shouldReuseStoredTokenAfterLock(afterLock, rejectedAccessToken)) {
          return afterLock;
        }

        const API_URL = resolveApiUrl();
        const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });

        if (epochAtStart !== authStorage.getSessionEpoch()) return null;

        const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
        const code = readRefreshErrorCode(body);

        if (!res.ok) {
          if (code === 'REFRESH_ALREADY_USED') {
            const beforeWait = authStorage.getAccessToken();
            if (shouldReuseStoredTokenAfterLock(beforeWait, rejectedAccessToken)) return beforeWait;

            const peer = await waitForPeerAccessToken();
            if (shouldReuseStoredTokenAfterLock(peer, rejectedAccessToken)) {
              authStorage.setAccessToken(peer, { epochAtStart });
              return peer;
            }
            const afterWait = authStorage.getAccessToken();
            if (shouldReuseStoredTokenAfterLock(afterWait, rejectedAccessToken)) return afterWait;
          } else {
            const peer = await waitForPeerAccessToken(800);
            if (shouldReuseStoredTokenAfterLock(peer, rejectedAccessToken)) {
              authStorage.setAccessToken(peer, { epochAtStart });
              return peer;
            }
          }
          if (res.status === 401 || res.status === 403) {
            if (code !== 'REFRESH_ALREADY_USED' && epochAtStart === authStorage.getSessionEpoch()) {
              authStorage.clear();
            }
          }
          return null;
        }

        if (epochAtStart !== authStorage.getSessionEpoch()) return null;

        const token =
          (typeof body?.accessToken === 'string' && body.accessToken) ||
          (typeof body?.data === 'object' &&
            body?.data !== null &&
            typeof (body.data as { accessToken?: string }).accessToken === 'string' &&
            (body.data as { accessToken: string }).accessToken) ||
          null;
        if (!token) {
          if (epochAtStart === authStorage.getSessionEpoch()) authStorage.clear();
          return null;
        }
        authStorage.setAccessToken(token, { epochAtStart });
        publishAuthMessage({ type: 'refresh-done', ok: true });
        return token;
      });
    } catch {
      // Network blip — keep access token; do not clear session
      return authStorage.getAccessToken();
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

function scheduleLoginRedirectOnce() {
  if (typeof window === 'undefined') return;
  if (loginRedirectScheduled) return;
  if (window.location.pathname.startsWith('/login')) return;
  loginRedirectScheduled = true;
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.replace(`/login?next=${next}`);
}

function withCredentials(init: RequestInit): RequestInit {
  return { ...init, credentials: 'include' };
}

function unauthorizedAfterLogout(epochAtRequest: number): never {
  if (authStorage.getSessionEpoch() === epochAtRequest) {
    scheduleLoginRedirectOnce();
  }
  throw new ApiError('Unauthorized', 401);
}

export async function apiClient<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const epochAtRequest = authStorage.getSessionEpoch();
  const { auth = true, ...init } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) ?? {}),
  };

  let token = auth ? authStorage.getAccessToken() : null;
  // Proactive refresh so /auth/me rarely logs a 401 in the console
  if (auth && accessTokenNeedsRefresh(token)) {
    const refreshed = await refreshAccessToken();
    abortIfSessionEpochChanged(epochAtRequest);
    if (refreshed) token = refreshed;
    else if (!token) {
      unauthorizedAfterLogout(epochAtRequest);
    }
  }
  if (auth && token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Gửi mã affiliate đã capture (localStorage/cookie JS) — Nest khóa vào OTP lúc send-otp
  const affiliateRef = getStoredAffiliateRef();
  if (affiliateRef && !headers['X-Affiliate-Ref']) {
    headers['X-Affiliate-Ref'] = affiliateRef;
  }

  const API_URL = resolveApiUrl();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1${path}`, withCredentials({ ...init, headers }));
  } catch (e) {
    // Preserve abort so callers can timeout without treating it as a dead backend.
    if (
      (e instanceof DOMException && e.name === 'AbortError') ||
      (e instanceof Error && e.name === 'AbortError')
    ) {
      throw e;
    }
    throw new ApiError(
      'Không kết nối được API. Kiểm tra server backend đang chạy tại ' + API_URL,
      0,
    );
  }

  abortIfSessionEpochChanged(epochAtRequest);

  if (res.status === 401 && auth) {
    if (authStorage.getSessionEpoch() !== epochAtRequest) {
      throw new ApiError('Unauthorized', 401);
    }
    const newToken = await refreshAccessToken(token);
    abortIfSessionEpochChanged(epochAtRequest);
    if (newToken && newToken !== token) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${API_URL}/api/v1${path}`, withCredentials({ ...init, headers }));
      abortIfSessionEpochChanged(epochAtRequest);
    } else {
      unauthorizedAfterLogout(epochAtRequest);
    }
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({ message: res.statusText }))) as Record<
      string,
      unknown
    >;
    throwApiError(res, body);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const epochAtRequest = authStorage.getSessionEpoch();
  const headers: Record<string, string> = {};
  let token = authStorage.getAccessToken();
  if (accessTokenNeedsRefresh(token)) {
    const refreshed = await refreshAccessToken();
    abortIfSessionEpochChanged(epochAtRequest);
    if (refreshed) token = refreshed;
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const API_URL = resolveApiUrl();
  let res = await fetch(
    `${API_URL}/api/v1${path}`,
    withCredentials({
      method: 'POST',
      headers,
      body: formData,
    }),
  );

  abortIfSessionEpochChanged(epochAtRequest);

  if (res.status === 401) {
    if (authStorage.getSessionEpoch() !== epochAtRequest) {
      throw new ApiError('Unauthorized', 401);
    }
    const newToken = await refreshAccessToken(token);
    abortIfSessionEpochChanged(epochAtRequest);
    if (newToken && newToken !== token) {
      headers.Authorization = `Bearer ${newToken}`;
      res = await fetch(
        `${API_URL}/api/v1${path}`,
        withCredentials({
          method: 'POST',
          headers,
          body: formData,
        }),
      );
      abortIfSessionEpochChanged(epochAtRequest);
    } else {
      unauthorizedAfterLogout(epochAtRequest);
    }
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({ message: res.statusText }))) as Record<
      string,
      unknown
    >;
    throwApiError(res, body);
  }

  return res.json() as Promise<T>;
}

export async function apiDownload(path: string): Promise<{ blob: Blob; filename: string }> {
  const epochAtRequest = authStorage.getSessionEpoch();
  const headers: Record<string, string> = {};
  let token = authStorage.getAccessToken();
  if (accessTokenNeedsRefresh(token)) {
    const refreshed = await refreshAccessToken();
    abortIfSessionEpochChanged(epochAtRequest);
    if (refreshed) token = refreshed;
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  const API_URL = resolveApiUrl();
  let res = await fetch(`${API_URL}/api/v1${path}`, withCredentials({ headers }));

  abortIfSessionEpochChanged(epochAtRequest);

  if (res.status === 401) {
    if (authStorage.getSessionEpoch() !== epochAtRequest) {
      throw new ApiError('Unauthorized', 401);
    }
    const newToken = await refreshAccessToken(token);
    abortIfSessionEpochChanged(epochAtRequest);
    if (newToken && newToken !== token) {
      headers.Authorization = `Bearer ${newToken}`;
      res = await fetch(`${API_URL}/api/v1${path}`, withCredentials({ headers }));
      abortIfSessionEpochChanged(epochAtRequest);
    } else {
      unauthorizedAfterLogout(epochAtRequest);
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(body.message ?? 'Download failed', res.status, body.errors);
  }

  const disposition = res.headers.get('Content-Disposition') ?? '';
  const star = /filename\*=(?:UTF-8''|utf-8'')([^;]+)/i.exec(disposition);
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  const rawName = star?.[1]?.trim() || plain?.[1]?.trim() || 'download.bin';
  let filename = rawName;
  try {
    filename = decodeURIComponent(rawName);
  } catch {
    filename = rawName;
  }
  const blob = await res.blob();
  return { blob, filename };
}

export { resolveApiUrl as getApiUrl };
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000';
