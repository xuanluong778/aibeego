import {
  fetchPublicHtmlSafe,
  assertPublicHttpUrl as sharedAssertPublicHttpUrl,
  SsrfValidationError,
  FetchPublicError,
} from '@marketingspa/shared/dist/ssrf-fetch';

export class CrawlFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CrawlFetchError';
  }
}

export class CrawlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CrawlValidationError';
  }
}

export type CrawlExtractResult = {
  pageUrl: string;
  title: string;
  content: string;
};

const CHUNK_SIZE = 800;
const MAX_BYTES = 50_000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 15_000;
/** Giới hạn tải thô (trước khi strip HTML) — đọc theo luồng, dừng khi vượt. */
const MAX_DOWNLOAD_BYTES = MAX_BYTES * 4;

export function chunkWebsiteContent(content: string): string[] {
  const text = content.trim();
  if (!text) return [];

  const paragraphs = text
    .split(/\n\s*\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 40);
  if (paragraphs.length >= 2) return paragraphs;

  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    chunks.push(text.slice(i, i + CHUNK_SIZE));
  }
  return chunks.length ? chunks : [text];
}

function mapSsrfToCrawlValidation(e: SsrfValidationError): CrawlValidationError {
  const internalCodes = new Set([
    'PRIVATE_IP',
    'LOCALHOST',
    'METADATA',
    'DNS_FAILED',
    'EMPTY_URL',
    'INVALID_URL',
    'BAD_SCHEME',
    'USERINFO',
  ]);
  if (internalCodes.has(e.code)) {
    return new CrawlValidationError('Không quét URL nội bộ.');
  }
  return new CrawlValidationError(e.message);
}

function mapFetchToCrawlFetch(e: FetchPublicError): CrawlFetchError {
  switch (e.code) {
    case 'TIMEOUT':
      return new CrawlFetchError('Hết thời gian chờ khi tải trang.');
    case 'TOO_LARGE':
      return new CrawlFetchError('Phản hồi quá lớn.');
    case 'TOO_MANY_REDIRECTS':
      return new CrawlFetchError('Quá nhiều lần redirect.');
    case 'BAD_REDIRECT':
      return new CrawlFetchError('Redirect thiếu Location.');
    case 'HTTP_ERROR': {
      const m = e.message.match(/HTTP (\d+)/);
      return new CrawlFetchError(m ? `HTTP ${m[1]}` : e.message);
    }
    case 'INSUFFICIENT_CONTENT':
      return new CrawlFetchError('Không trích xuất được nội dung trang.');
    default:
      return new CrawlFetchError(e.message);
  }
}

/**
 * Crawl public websites — pinned TLS, redirect re-check, streaming size cap (@marketingspa/shared).
 */
export async function fetchAndExtractUrl(url: string): Promise<CrawlExtractResult> {
  const raw = url.trim();
  if (!raw) throw new CrawlValidationError('URL không được để trống.');

  try {
    const fetched = await fetchPublicHtmlSafe(raw, {
      timeoutMs: TIMEOUT_MS,
      maxBytes: MAX_DOWNLOAD_BYTES,
      maxRedirects: MAX_REDIRECTS,
      skipCommerceHostBlock: true,
      userAgent: 'Mozilla/5.0 (compatible; AIBeego-ChatbotCrawler/1.0)',
      minExtractChars: 10,
      maxExtractChars: MAX_BYTES,
    });
    const content = fetched.text.trim().slice(0, MAX_BYTES);
    if (content.length < 10) {
      throw new CrawlFetchError('Không trích xuất được nội dung trang.');
    }
    return {
      pageUrl: fetched.finalUrl.slice(0, 2000),
      title: fetched.title,
      content,
    };
  } catch (e) {
    if (e instanceof SsrfValidationError) throw mapSsrfToCrawlValidation(e);
    if (e instanceof FetchPublicError) throw mapFetchToCrawlFetch(e);
    if (e instanceof CrawlFetchError || e instanceof CrawlValidationError) throw e;
    throw new CrawlFetchError(e instanceof Error ? e.message : 'Không tải được trang.');
  }
}

export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  try {
    return await sharedAssertPublicHttpUrl(raw, { skipCommerceHostBlock: true });
  } catch (e) {
    if (e instanceof SsrfValidationError) throw mapSsrfToCrawlValidation(e);
    throw e;
  }
}