import { createHash } from 'node:crypto';
import { fetchPublicHtmlSafe, FetchPublicError, SsrfValidationError } from './ssrf-fetch';
import { ragWebsiteMarkdown } from './rag-website-markdown';

export const RAG_SOURCE_QUEUE = 'rag-source-sync';
export const RAG_SOURCE_LIMITS = {
  websitePages: 25,
  depth: 2,
  delayMs: 1000,
  facebookPages: 4,
  postsPerPage: 25,
};
export type RagCollectedItem = {
  externalId: string;
  url: string;
  title: string;
  content: string;
  sourceUpdatedAt?: Date;
};
export type RagCollectSink = (item: RagCollectedItem | null, error?: string) => Promise<void>;
export function decodeRagEntities(text: string): string {
  return text
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (whole, value: string) => {
      const n = value[0]?.toLowerCase() === 'x' ? parseInt(value.slice(1), 16) : Number(value);
      return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff)
        ? String.fromCodePoint(n)
        : whole;
    })
    .replace(
      /&(?:amp|nbsp|quot|apos|ndash|mdash);/gi,
      (value) =>
        ({
          '&amp;': '&',
          '&nbsp;': ' ',
          '&quot;': '"',
          '&apos;': "'",
          '&ndash;': '–',
          '&mdash;': '—',
        })[value.toLowerCase()] || value,
    );
}
export const normalizeRagContent = (s: string) =>
  s
    .normalize('NFC')
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '    ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 100_000);
export const ragContentHash = (content: string) =>
  createHash('sha256').update(normalizeRagContent(content)).digest('hex');
export function canonicalRagUrl(raw: string, base?: string): string {
  const u = new URL(raw, base);
  if (
    !['http:', 'https:'].includes(u.protocol) ||
    u.username ||
    u.password ||
    (u.port && !['80', '443'].includes(u.port))
  )
    throw new Error('URL phải là HTTP(S) công khai trên cổng tiêu chuẩn.');
  u.hash = '';
  for (const key of [...u.searchParams.keys()])
    if (/^utm_|^(fbclid|gclid|session|sid)$/i.test(key)) u.searchParams.delete(key);
  u.searchParams.sort();
  u.pathname = u.pathname.replace(/\/(?:index\.html?)?$/i, '') || '/';
  if (u.toString().length > 1800) throw new Error('URL quá dài.');
  return u.toString();
}
const relevant = (url: string) =>
  /about|gioi-thieu|san-pham|product|dich-vu|service|lien-he|contact|faq|hoi-dap|chinh-sach|policy|policies|privacy|terms|bao-hanh|van-chuyen|doi-tra/i.test(
    decodeURI(new URL(url).pathname),
  );

/** The shared fetcher validates every redirect, pins DNS, and bounds response bytes/time. */
export async function collectRagWebsite(
  root: string,
  sink: RagCollectSink,
  deps: {
    fetchHtml?: typeof fetchPublicHtmlSafe;
    wait?: (ms: number) => Promise<void>;
  } = {},
) {
  const start = canonicalRagUrl(root),
    host = new URL(start).hostname;
  const fetchHtml = deps.fetchHtml || fetchPublicHtmlSafe;
  const wait =
    deps.wait || ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const queue = [{ url: start, depth: 0 }],
    seen = new Set([start]),
    saved = new Set<string>();
  let attempted = 0;
  while (queue.length && attempted < RAG_SOURCE_LIMITS.websitePages) {
    const entry = queue.shift()!;
    if (attempted++) await wait(RAG_SOURCE_LIMITS.delayMs);
    let page: Awaited<ReturnType<typeof fetchPublicHtmlSafe>>;
    try {
      page = await fetchHtml(entry.url, {
        includeHtml: true,
        timeoutMs: 12_000,
        maxBytes: 750_000,
        maxRedirects: 3,
        allowHost: (h) => h === host,
      });
      if (new URL(page.finalUrl).hostname !== host)
        throw new Error('Trang chuyển hướng ra ngoài phạm vi website.');
    } catch (error) {
      const shownUrl = new URL(entry.url);
      shownUrl.search = '';
      shownUrl.hash = '';
      const known = error instanceof FetchPublicError || error instanceof SsrfValidationError;
      const code = known ? error.code : 'FETCH_FAILED';
      const reason = known ? error.message : 'Không kết nối được trang.';
      await sink(null, `${shownUrl.toString().slice(0, 300)} — ${code}: ${reason.slice(0, 180)}`);
      continue;
    }
    const finalUrl = canonicalRagUrl(page.finalUrl);
    if (!saved.has(finalUrl)) {
      saved.add(finalUrl);
      await sink({
        externalId: finalUrl,
        url: finalUrl,
        title: decodeRagEntities(page.title),
        content: normalizeRagContent(
          (page.html && ragWebsiteMarkdown(page.html, finalUrl)) || decodeRagEntities(page.text),
        ),
      });
    }
    if (entry.depth >= RAG_SOURCE_LIMITS.depth) continue;
    for (const match of (page.html || '').matchAll(/<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["']/gi)) {
      try {
        const url = canonicalRagUrl(match[1]!.replace(/&amp;/g, '&'), finalUrl);
        if (
          /\.(?:css|js|mjs|map|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|pdf|zip)$/i.test(
            new URL(url).pathname,
          ) ||
          new URL(url).hostname !== host ||
          !relevant(url) ||
          seen.has(url) ||
          seen.size >= 150
        )
          continue;
        seen.add(url);
        queue.push({ url, depth: entry.depth + 1 });
      } catch {
        /* Ignore non-page links. */
      }
    }
  }
}

export class RagFacebookError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export function ragFacebookError(code?: number) {
  if (code === 190)
    return new RagFacebookError(
      'TOKEN_EXPIRED',
      'Token Facebook hết hạn hoặc không hợp lệ. Hãy kết nối lại Fanpage.',
    );
  if ([10, 200, 294].includes(code || 0))
    return new RagFacebookError(
      'MISSING_PERMISSION',
      'Thiếu quyền đọc Page/bài đăng (pages_read_engagement). Hãy cấp lại quyền kết nối.',
    );
  if ([4, 17, 32, 613].includes(code || 0))
    return new RagFacebookError('RATE_LIMITED', 'Facebook giới hạn lượt đọc. Thử đồng bộ lại sau.');
  return new RagFacebookError(
    'FACEBOOK_ERROR',
    'Không đọc được dữ liệu Facebook. Dữ liệu thành công trước vẫn được giữ.',
  );
}
export type RagGraphRead = (path: string, params: Record<string, string>) => Promise<any>;
/** Read only Page metadata and Page-owned posts; never follow a server-provided URL. */
export async function collectRagFacebook(pageId: string, read: RagGraphRead, sink: RagCollectSink) {
  if (!/^\d+$/.test(pageId)) throw new Error('Page ID không hợp lệ.');
  const page = await read(pageId, {
    fields: 'id,name,about,description,website,phone,emails,location',
  });
  const profile = [
    page.name,
    page.about,
    page.description,
    page.website,
    page.phone,
    ...(page.emails || []),
    page.location ? JSON.stringify(page.location) : '',
  ]
    .filter(Boolean)
    .join('\n');
  await sink({
    externalId: `page:${pageId}`,
    url: `https://www.facebook.com/${pageId}`,
    title: String(page.name || 'Facebook Page'),
    content: normalizeRagContent(profile),
  });
  let after: string | undefined;
  const cursors = new Set<string>(),
    posts = new Set<string>();
  for (let i = 0; i < RAG_SOURCE_LIMITS.facebookPages; i++) {
    const batch = await read(`${pageId}/posts`, {
      fields: 'id,message,permalink_url,created_time,updated_time',
      limit: '25',
      ...(after ? { after } : {}),
    });
    for (const post of Array.isArray(batch.data) ? batch.data : []) {
      if (typeof post.id !== 'string' || posts.has(post.id) || !post.message?.trim()) continue;
      posts.add(post.id);
      const updated = post.updated_time || post.created_time;
      await sink({
        externalId: `post:${post.id}`,
        url: `https://www.facebook.com/${post.id}`,
        title: String(post.message).slice(0, 120),
        content: normalizeRagContent(post.message),
        ...(updated && Number.isFinite(Date.parse(updated))
          ? { sourceUpdatedAt: new Date(updated) }
          : {}),
      });
    }
    const cursor = batch.paging?.cursors?.after;
    if (
      !batch.paging?.next ||
      typeof cursor !== 'string' ||
      !cursor ||
      cursor.length > 2000 ||
      cursors.has(cursor)
    )
      break;
    cursors.add(cursor);
    after = cursor;
  }
}
