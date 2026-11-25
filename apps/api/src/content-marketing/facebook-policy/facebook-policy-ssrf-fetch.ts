/**
 * Facebook policy import — wrapper quanh @marketingspa/shared/ssrf-fetch (throws CrawlValidationError).
 */
import {
  assertPublicHttpUrl as sharedAssertPublicHttpUrl,
  fetchPublicHtmlSafe as sharedFetchPublicHtmlSafe,
  FetchPublicError,
  SsrfValidationError,
} from '@marketingspa/shared/dist/ssrf-fetch';
import { CrawlValidationError } from '../../chatbot-cskh/utils/website-crawl.util';

function mapSsrfToCrawlValidation(e: SsrfValidationError): CrawlValidationError {
  switch (e.code) {
    case 'EMPTY_URL':
      return new CrawlValidationError('URL không được để trống.');
    case 'INVALID_URL':
      return new CrawlValidationError('URL không hợp lệ.');
    case 'BAD_SCHEME':
      return new CrawlValidationError('URL phải bắt đầu bằng http:// hoặc https://');
    case 'USERINFO':
      return new CrawlValidationError('URL không được chứa thông tin đăng nhập.');
    case 'DNS_FAILED':
      return new CrawlValidationError('Không phân giải được tên miền.');
    case 'PRIVATE_IP':
    case 'LOCALHOST':
    case 'METADATA':
      return new CrawlValidationError('Không quét URL nội bộ.');
    default:
      return new CrawlValidationError(e.message);
  }
}

function mapFetchToCrawlValidation(e: FetchPublicError): CrawlValidationError {
  switch (e.code) {
    case 'TIMEOUT':
      return new CrawlValidationError('Hết thời gian chờ khi tải trang.');
    case 'TOO_LARGE':
      return new CrawlValidationError('Trang quá lớn để phân tích.');
    case 'TOO_MANY_REDIRECTS':
      return new CrawlValidationError('Quá nhiều lần redirect.');
    case 'BAD_REDIRECT':
      return new CrawlValidationError('Redirect thiếu Location.');
    case 'HTTP_ERROR':
      return new CrawlValidationError(e.message);
    default:
      return new CrawlValidationError(e.message);
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

export async function fetchPublicHtmlSafe(
  rawUrl: string,
  opts?: {
    timeoutMs?: number;
    maxBytes?: number;
    maxRedirects?: number;
    userAgent?: string;
  },
): Promise<{ finalUrl: string; title: string; text: string; html: string }> {
  try {
    const fetched = await sharedFetchPublicHtmlSafe(rawUrl, {
      timeoutMs: opts?.timeoutMs ?? 12_000,
      maxBytes: opts?.maxBytes ?? 1_500_000,
      maxRedirects: opts?.maxRedirects ?? 3,
      skipCommerceHostBlock: true,
      includeHtml: true,
      preserveScriptTagsInHtml: true,
      userAgent: opts?.userAgent ?? 'Mozilla/5.0 (compatible; AiBeeGo-PolicyImporter/1.0)',
      maxExtractChars: 20_000,
      minExtractChars: 0,
    });
    return {
      finalUrl: fetched.finalUrl,
      title: fetched.title,
      text: fetched.text,
      html: fetched.html ?? '',
    };
  } catch (e) {
    if (e instanceof SsrfValidationError) throw mapSsrfToCrawlValidation(e);
    if (e instanceof FetchPublicError) throw mapFetchToCrawlValidation(e);
  }
  throw new CrawlValidationError('Không tải được trang.');
}