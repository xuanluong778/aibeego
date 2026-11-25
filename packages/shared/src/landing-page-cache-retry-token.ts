import { createHmac, timingSafeEqual } from 'crypto';

export type LandingPageCacheRetryPayload = {
  organizationId: string;
  pageId: string;
  slug: string;
  exp: number;
};

const DEFAULT_TTL_MS = 15 * 60 * 1000;

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function fromB64url(input: string): Buffer {
  return Buffer.from(input, 'base64url');
}

export function signLandingPageCacheRetryToken(
  scope: Omit<LandingPageCacheRetryPayload, 'exp'>,
  secret: string,
  ttlMs = DEFAULT_TTL_MS,
  nowMs = Date.now(),
): string {
  const payload: LandingPageCacheRetryPayload = {
    organizationId: scope.organizationId.trim(),
    pageId: scope.pageId.trim(),
    slug: scope.slug.trim(),
    exp: nowMs + ttlMs,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export type VerifyLandingPageCacheRetryResult =
  | { ok: true; scope: Omit<LandingPageCacheRetryPayload, 'exp'> }
  | { ok: false; reason: 'bad_format' | 'bad_signature' | 'expired' | 'invalid_payload' };

export function verifyLandingPageCacheRetryToken(
  token: string,
  secret: string,
  nowMs = Date.now(),
): VerifyLandingPageCacheRetryResult {
  const raw = (token || '').trim();
  const dot = raw.lastIndexOf('.');
  if (dot <= 0) return { ok: false, reason: 'bad_format' };
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { ok: false, reason: 'bad_signature' };
    }
  } catch {
    return { ok: false, reason: 'bad_signature' };
  }
  let payload: LandingPageCacheRetryPayload;
  try {
    payload = JSON.parse(fromB64url(body).toString('utf8')) as LandingPageCacheRetryPayload;
  } catch {
    return { ok: false, reason: 'invalid_payload' };
  }
  if (
    !payload.organizationId ||
    !payload.pageId ||
    !payload.slug ||
    typeof payload.exp !== 'number'
  ) {
    return { ok: false, reason: 'invalid_payload' };
  }
  if (payload.exp < nowMs) return { ok: false, reason: 'expired' };
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/i.test(payload.slug.trim())) {
    return { ok: false, reason: 'invalid_payload' };
  }
  return {
    ok: true,
    scope: {
      organizationId: payload.organizationId,
      pageId: payload.pageId,
      slug: payload.slug,
    },
  };
}