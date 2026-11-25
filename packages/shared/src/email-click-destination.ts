import { createHmac, timingSafeEqual } from 'crypto';

const SKIP_HREF = /^(mailto:|tel:|sms:|javascript:|cid:|#)/i;

/** Distinct http(s) destinations declared in campaign HTML (pre–tracking wrap), giữ query + #fragment. */
export function collectEmailTrackableDestinations(html: string): string[] {
  const urls = new Set<string>();
  const re = /href\s*=\s*(["'])([\s\S]*?)\1/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = m[2]!.replace(/&amp;/g, '&').trim();
    if (!href || SKIP_HREF.test(href)) continue;
    if (href.includes('/email-marketing/public/click/')) continue;
    if (href.includes('/email-unsubscribe')) continue;
    if (!/^https?:\/\//i.test(href)) continue;
    urls.add(normalizeEmailClickUrl(href));
  }
  return [...urls];
}

/** Chuẩn hóa URL đích — giữ path, search, hash. */
export function normalizeEmailClickUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return raw.trim();
    return u.toString();
  } catch {
    return raw.trim();
  }
}

/** Legacy: mất fragment so với mẫu được phép; thêm hoặc đổi fragment bị từ chối. */
export function emailClickUrlMatchesAllowed(requested: string, allowed: string): boolean {
  const r = normalizeEmailClickUrl(requested);
  const a = normalizeEmailClickUrl(allowed);
  if (r === a) return true;
  try {
    const ur = new URL(r);
    const ua = new URL(a);
    if (ur.origin !== ua.origin || ur.pathname !== ua.pathname || ur.search !== ua.search) {
      return false;
    }
    if (!ua.hash) return !ur.hash;
    if (!ur.hash) return true;
    return ur.hash === ua.hash;
  } catch {
    return false;
  }
}

export function signEmailClickDestination(
  recipientId: string,
  campaignId: string,
  destinationUrl: string,
  secret: string,
): string {
  const dest = normalizeEmailClickUrl(destinationUrl);
  return createHmac('sha256', secret)
    .update(`${recipientId}\0${campaignId}\0${dest}`)
    .digest('base64url');
}

function signaturesEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export type EmailClickResolveResult =
  | { ok: true; destination: string; mode: 'signed' | 'legacy' }
  | { ok: false; destination: string; reason: string };

/** Verify click destination before redirect / metrics (signed preferred; legacy allow-list). */
export function resolveEmailClickDestination(input: {
  requestedUrl?: string;
  signature?: string;
  recipientId: string;
  campaignId: string;
  allowedDestinations: string[];
  signSecret?: string;
  safeFallbackUrl: string;
}): EmailClickResolveResult {
  const fallback = (input.safeFallbackUrl || '/').trim() || '/';
  const raw = (input.requestedUrl || '').trim();
  if (!raw || !/^https?:\/\//i.test(raw)) {
    return { ok: false, destination: fallback, reason: 'missing_or_invalid_url' };
  }
  const dest = normalizeEmailClickUrl(raw);
  const sig = (input.signature || '').trim();
  const secret = (input.signSecret || '').trim();

  if (sig && secret) {
    const expected = signEmailClickDestination(
      input.recipientId,
      input.campaignId,
      dest,
      secret,
    );
    if (signaturesEqual(sig, expected)) {
      return { ok: true, destination: dest, mode: 'signed' };
    }
    return { ok: false, destination: fallback, reason: 'bad_signature' };
  }

  for (const allowed of input.allowedDestinations) {
    if (emailClickUrlMatchesAllowed(dest, allowed)) {
      return { ok: true, destination: dest, mode: 'legacy' };
    }
  }
  return { ok: false, destination: fallback, reason: 'destination_not_in_campaign' };
}

export const EMAIL_CLICK_LEGACY_FORMAT_NOTE =
  'Link cũ /click/{rid}?url= — mất #fragment so với mẫu vẫn OK; thêm/đổi fragment → fallback.';