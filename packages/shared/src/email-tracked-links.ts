import { normalizeEmailClickUrl, signEmailClickDestination } from './email-click-destination';

const SKIP_HREF = /^(mailto:|tel:|sms:|javascript:|cid:|#)/i;

export function rewriteEmailTrackedLinks(
  html: string,
  clickBase: string,
  unsubscribeUrl?: string,
  opts?: { campaignId?: string; recipientId?: string; clickSignSecret?: string },
): string {
  return html.replace(/href\s*=\s*(["'])([\s\S]*?)\1/gi, (full, quote: string, rawHref: string) => {
    const href = rawHref.replace(/&amp;/g, '&').trim();
    if (!href) return full;
    if (SKIP_HREF.test(href)) return full;
    if (href.includes('/email-marketing/public/click/')) return full;
    if (href.includes('/email-unsubscribe')) return full;
    if (unsubscribeUrl && href === unsubscribeUrl) return full;
    if (!/^https?:\/\//i.test(href)) return full;
    const dest = normalizeEmailClickUrl(href);
    const campaignId = opts?.campaignId?.trim() || '';
    const recipientId = opts?.recipientId?.trim() || clickBase.replace(/\/$/, '').split('/').pop() || '';
    const secret = opts?.clickSignSecret?.trim() || '';
    const signed =
      campaignId && recipientId && secret
        ? `&sig=${encodeURIComponent(
            signEmailClickDestination(recipientId, campaignId, dest, secret),
          )}`
        : '';
    return `href=${quote}${clickBase}?url=${encodeURIComponent(dest)}${signed}${quote}`;
  });
}
