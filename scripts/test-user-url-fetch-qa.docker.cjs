/**
 * QA URL fetch — chạy trong marketingspa-api (/app).
 */
const assert = require('node:assert/strict');
const http = require('node:http');
const { EventEmitter } = require('node:events');

const ssrf = require('/app/node_modules/@marketingspa/shared/dist/ssrf-fetch');
const crawl = require('/app/dist/chatbot-cskh/utils/website-crawl.util');
const policy = require('/app/dist/content-marketing/facebook-policy/facebook-policy-ssrf-fetch');
const {
  extractFacebookCaptionFromHtml,
} = require('/app/dist/content-marketing/facebook-policy/facebook-policy-import.logic');

const pass = (name) => console.log(`  [PASS] ${name}`);
const fail = (name, detail) => {
  console.log(`  [FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
  process.exitCode = 1;
};

/** Mock ClientRequest: abort/destroy từ ssrf-fetch phải emit error (giống http thật). */
function wireMockRequestDestroy(req) {
  req.destroy = (error) => {
    if (error) queueMicrotask(() => req.emit('error', error));
  };
}

async function main() {
  let ok = 0;
  const check = (name, cond, detail) => {
    if (cond) {
      pass(name);
      ok++;
    } else fail(name, detail);
  };

  console.log('[ssrf] kiểm tra DNS / nội bộ');
  for (const raw of ['http://127.0.0.1', 'http://169.254.169.254/', 'http://[::1]/']) {
    await assert.rejects(() => ssrf.assertPublicHttpUrl(raw));
  }
  ssrf.__setDnsLookupForTests(async () => [{ address: '10.1.1.1', family: 4 }]);
  await assert.rejects(() => ssrf.assertPublicHttpUrl('http://example.com'));
  ssrf.__setDnsLookupForTests(async () => [{ address: '93.184.216.34', family: 4 }]);
  check('Chặn IP nội bộ / metadata / DNS private', true);

  console.log('[ssrf] redirect private bị chặn (pinned transport)');
  const originalRequest = http.request;
  let requests = 0;
  http.request = (opts, callback) => {
    requests++;
    const req = new EventEmitter();
    req.destroy = (error) => {
      if (error) req.emit('error', error);
    };
    req.end = () =>
      queueMicrotask(() => {
        const res = new EventEmitter();
        res.headers = { location: 'http://127.0.0.1/private' };
        res.statusCode = 302;
        res.destroy = () => {};
        callback(res);
        res.emit('end');
      });
    return req;
  };
  try {
    await assert.rejects(() =>
      ssrf.fetchPublicHtmlSafe('http://example.com', {
        allowHost: (h) => h === 'example.com',
        maxRedirects: 3,
      }),
    );
    check('Redirect → 127.0.0.1 không có request thứ hai', requests === 1, `requests=${requests}`);
  } finally {
    http.request = originalRequest;
  }

  console.log('[ssrf] phản hồi quá lớn (Content-Length)');
  http.request = (opts, callback) => {
    const req = new EventEmitter();
    wireMockRequestDestroy(req);
    req.end = () =>
      queueMicrotask(() => {
        const res = new EventEmitter();
        res.statusCode = 200;
        res.headers = { 'content-type': 'text/html', 'content-length': '99999999' };
        res.destroy = () => {};
        callback(res);
        res.emit('data', Buffer.alloc(64 * 1024));
        res.emit('end');
      });
    return req;
  };
  try {
    await assert.rejects(
      () =>
        ssrf.fetchPublicHtmlSafe('http://example.com', {
          allowHost: (h) => h === 'example.com',
          maxBytes: 50_000,
        }),
      (e) => e.code === 'TOO_LARGE',
    );
    check('Dừng khi Content-Length vượt maxBytes', true);
  } finally {
    http.request = originalRequest;
  }

  console.log('[ssrf] phản hồi quá lớn (stream, không Content-Length)');
  http.request = (opts, callback) => {
    const req = new EventEmitter();
    wireMockRequestDestroy(req);
    req.end = () =>
      queueMicrotask(() => {
        const res = new EventEmitter();
        res.statusCode = 200;
        res.headers = { 'content-type': 'text/html' };
        res.destroy = () => {};
        callback(res);
        res.emit('data', Buffer.alloc(40_000));
        res.emit('data', Buffer.alloc(40_000));
        res.emit('end');
      });
    return req;
  };
  try {
    await assert.rejects(
      () =>
        ssrf.fetchPublicHtmlSafe('http://example.com', {
          allowHost: (h) => h === 'example.com',
          maxBytes: 50_000,
        }),
      (e) => e.code === 'TOO_LARGE',
    );
    check('Dừng đọc stream khi vượt maxBytes (không CL)', true);
  } finally {
    http.request = originalRequest;
  }

  console.log('[ssrf] phản hồi chậm (timeout trước headers)');
  http.request = (opts, callback) => {
    const req = new EventEmitter();
    wireMockRequestDestroy(req);
    req.setTimeout = () => {};
    req.end = () => {
      /* never respond */
    };
    return req;
  };
  try {
    await assert.rejects(
      () =>
        ssrf.fetchPublicHtmlSafe('http://example.com', {
          allowHost: (h) => h === 'example.com',
          timeoutMs: 200,
          maxBytes: 10_000,
        }),
      (e) => e.code === 'TIMEOUT',
    );
    check('Timeout trước khi nhận phản hồi', true);
  } finally {
    http.request = originalRequest;
  }

  console.log('[ssrf] timeout khi đang đọc body');
  http.request = (opts, callback) => {
    const req = new EventEmitter();
    let destroyed = false;
    req.destroy = (error) => {
      destroyed = true;
      if (error) queueMicrotask(() => req.emit('error', error));
    };
    req.setTimeout = () => {};
    req.end = () => {
      queueMicrotask(() => {
        if (destroyed) return;
        const res = new EventEmitter();
        res.statusCode = 200;
        res.headers = { 'content-type': 'text/html' };
        res.destroy = () => {};
        callback(res);
        res.emit('data', Buffer.from('<html>'));
        setTimeout(() => {
          if (destroyed) return;
          res.emit('data', Buffer.alloc(4096));
          res.emit('end');
        }, 800);
      });
    };
    return req;
  };
  try {
    await assert.rejects(
      () =>
        ssrf.fetchPublicHtmlSafe('http://example.com', {
          allowHost: (h) => h === 'example.com',
          timeoutMs: 200,
          maxBytes: 100_000,
          minExtractChars: 0,
        }),
      (e) => e.code === 'TIMEOUT',
    );
    check('Timeout trong lúc đọc body (stream chậm)', true);
  } finally {
    http.request = originalRequest;
  }

  console.log('[ssrf] redirect hợp lệ (public hop 2)');
  let hop = 0;
  const captionInScript =
    'Serum dưỡng ẩm cho da nhạy cảm — chỉ nằm trong JSON script Facebook.';
  const hop2Html = `<html><head><title>OK</title></head><body><script>{"message":{"__typename":"TextWithEntities","text":"${captionInScript}"}}</script></body></html>`;
  http.request = (opts, callback) => {
    hop++;
    const req = new EventEmitter();
    wireMockRequestDestroy(req);
    req.end = () =>
      queueMicrotask(() => {
        const res = new EventEmitter();
        res.destroy = () => {};
        if (hop === 1) {
          res.statusCode = 302;
          res.headers = { location: 'http://example.com/after-redirect' };
          callback(res);
          res.emit('end');
          return;
        }
        res.statusCode = 200;
        res.headers = { 'content-type': 'text/html' };
        callback(res);
        res.emit('data', Buffer.from(hop2Html, 'utf8'));
        res.emit('end');
      });
    return req;
  };
  try {
    const fetched = await ssrf.fetchPublicHtmlSafe('http://example.com/start', {
      allowHost: (h) => h === 'example.com',
      maxRedirects: 3,
      includeHtml: true,
      preserveScriptTagsInHtml: true,
      minExtractChars: 0,
    });
    check('Redirect public → 200 (2 hop)', hop === 2 && fetched.finalUrl.includes('/after-redirect'));
    check(
      'HTML giữ thẻ script (server-side)',
      typeof fetched.html === 'string' && fetched.html.includes('TextWithEntities'),
    );
    const cap = extractFacebookCaptionFromHtml(fetched.html);
    check('Caption chỉ trong JSON script', cap.text.includes('Serum dưỡng ẩm'));
  } finally {
    http.request = originalRequest;
  }

  console.log('[facebook-policy] caption qua fetch wrapper');
  http.request = (opts, callback) => {
    const req = new EventEmitter();
    wireMockRequestDestroy(req);
    req.end = () =>
      queueMicrotask(() => {
        const res = new EventEmitter();
        res.statusCode = 200;
        res.headers = { 'content-type': 'text/html' };
        res.destroy = () => {};
        callback(res);
        const body = `<html><body><script>{"message":{"text":"Demo caption từ Facebook JSON nhúng"}}</script></body></html>`;
        res.emit('data', Buffer.from(body, 'utf8'));
        res.emit('end');
      });
    return req;
  };
  try {
    ssrf.__setDnsLookupForTests(async () => [{ address: '93.184.216.34', family: 4 }]);
    const fetched = await policy.fetchPublicHtmlSafe('http://www.facebook.com/post/qa', {
      timeoutMs: 5000,
      maxBytes: 500_000,
    });
    const cap = extractFacebookCaptionFromHtml(fetched.html);
    check('Policy fetch + extract caption JSON', cap.text.includes('Demo caption'));
    check('Policy text không chứa script (strip body)', !fetched.text.includes('Demo caption'));
  } finally {
    http.request = originalRequest;
  }

  console.log('[chatbot] map lỗi người dùng');
  await assert.rejects(
    () => crawl.fetchAndExtractUrl('http://127.0.0.1/'),
    (e) => e instanceof crawl.CrawlValidationError && e.message === 'Không quét URL nội bộ.',
  );
  check('Chatbot URL nội bộ → CrawlValidationError', true);

  console.log('[facebook-policy] map lỗi người dùng');
  await assert.rejects(
    () => policy.assertPublicHttpUrl('file:///etc/passwd'),
    (e) => e instanceof crawl.CrawlValidationError && e.message.includes('http'),
  );
  check('Policy scheme lỗi → CrawlValidationError', true);

  ssrf.__setDnsLookupForTests(null);

  console.log('\n[kiểm kê — CHƯA CHUYỂN]');
  console.log('  - worker/rag-source-sync: Graph API cố định, redirect=error (khác cơ chế SSRF user URL)');
  console.log('  - worker/auto-post-publish: URL ảnh đăng Facebook (cần rà riêng)');
  console.log('  - email-marketing subscribeUrl: webhook bên thứ ba (cần allowlist riêng)');
  console.log('  - openai/video-transcription: URL do user — đã dùng assertPublicHttpUrl (giữ)');

  console.log('\n[CHƯA KIỂM CHỨNG — browser QA]');
  console.log('  - UI Chatbot crawl URL (web QA + api-qa :4001)');
  console.log('  - UI nhập policy Facebook / import-url (web QA + api-qa :4001)');
  console.log('  - Chạy: node scripts/run-prompt3-url-fetch-qa.cjs (regression + docker); browser thủ công hoặc run-hrm-finance-qa-browser stack');

  const failed = (process.exitCode ?? 0) !== 0;
  console.log(`\n${ok} case PASS${failed ? ' (có FAIL)' : ''}`);
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});