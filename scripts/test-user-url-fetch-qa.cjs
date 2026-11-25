/**
 * QA: Chatbot + Facebook policy URL fetch (shared ssrf-fetch).
 * node scripts/test-user-url-fetch-qa.cjs
 */
const assert = require('node:assert/strict');
const http = require('node:http');
const { EventEmitter } = require('node:events');

const ssrf = require('./packages/shared/dist/ssrf-fetch');
const crawl = require('./apps/api/dist/chatbot-cskh/utils/website-crawl.util');
const policy = require('./apps/api/dist/content-marketing/facebook-policy/facebook-policy-ssrf-fetch');

const pass = (name) => console.log(`  [PASS] ${name}`);
const fail = (name, detail) => {
  console.log(`  [FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
  process.exitCode = 1;
};

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

  console.log('[ssrf] phản hồi quá lớn (stream)');
  http.request = (opts, callback) => {
    const req = new EventEmitter();
    req.destroy = () => {};
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
    check('Dừng đọc khi vượt maxBytes', true);
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

  const failed = (process.exitCode ?? 0) !== 0;
  console.log(`\n${ok}/${ok + (failed ? 1 : 0)} không FAIL`);
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});