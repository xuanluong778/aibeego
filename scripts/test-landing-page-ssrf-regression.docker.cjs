/**
 * Landing Page URL crawl — subset ssrf-fetch (chạy trong sidecar /app).
 */
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const http = require('node:http');
const https = require('node:https');
const ssrf = require('/app/node_modules/@marketingspa/shared/dist/ssrf-fetch');

const { fetchPublicHtmlSafe, fetchPublicImageSafe, __setDnsLookupForTests, isPrivateOrReservedIp } =
  ssrf;

function wireMockRequestDestroy(req) {
  req.destroy = (error) => {
    if (error) queueMicrotask(() => req.emit('error', error));
  };
}

const html = `<!doctype html><html><head><title>LP</title></head><body><main><p>Nội dung chính đủ dài cho min extract chars test.</p><script>SECRET_SCRIPT</script></main></body></html>`;

async function main() {
  let ok = 0;
  const pass = (n) => {
    console.log(`  [PASS] ${n}`);
    ok++;
  };

  const originalHttp = http.request;
  const originalHttps = https.request;
  const calls = [];
  const route = (options, callback) => {
    calls.push(options);
    const req = new EventEmitter();
    wireMockRequestDestroy(req);
    let destroyed = false;
    const origDestroy = req.destroy.bind(req);
    req.destroy = (error) => {
      destroyed = true;
      origDestroy(error);
    };
    req.end = () =>
      setImmediate(() => {
        if (destroyed || options.path === '/timeout') return;
        const res = new EventEmitter();
        res.destroy = () => res.emit('aborted');
        const path = options.path;
        res.statusCode = path.startsWith('/redirect') || path === '/loop' ? 302 : 200;
        res.headers = {
          'content-type': path === '/image' ? 'image/png' : 'text/html',
          ...(path === '/redirect-public' ? { location: 'https://other.test/content' } : {}),
          ...(path === '/loop' ? { location: '/loop' } : {}),
          ...(path === '/oversize-header' ? { 'content-length': '50000' } : {}),
        };
        callback(res);
        if (destroyed) return;
        if (path === '/oversize-stream') {
          res.emit('data', Buffer.alloc(60));
          res.emit('data', Buffer.alloc(60));
        } else {
          res.emit(
            'data',
            path === '/image'
              ? Buffer.from('89504e470d0a1a0a' + '00'.repeat(20), 'hex')
              : Buffer.from(html),
          );
        }
        if (!destroyed) res.emit('end');
      });
    return req;
  };
  http.request = route;
  https.request = route;

  __setDnsLookupForTests(async (host) => [
    { address: host === 'internal.test' ? '10.0.0.5' : '93.184.216.34', family: 4 },
  ]);

  try {
    const out = await fetchPublicHtmlSafe('https://source.test/redirect-public', { includeHtml: true });
    assert.equal(out.finalUrl, 'https://other.test/content');
    assert.ok(out.html && !out.html.includes('SECRET_SCRIPT'));
    pass('LP redirect public + strip script khỏi text/html an toàn');

    for (const path of ['/oversize-stream', '/oversize-header']) {
      await assert.rejects(
        () => fetchPublicHtmlSafe(`https://source.test${path}`, { maxBytes: 100 }),
        (e) => e.code === 'TOO_LARGE',
      );
    }
    pass('LP giới hạn stream / Content-Length');

    await assert.rejects(
      () => fetchPublicHtmlSafe('https://source.test/timeout', { timeoutMs: 25 }),
      (e) => e.code === 'TIMEOUT',
    );
    pass('LP timeout');

    assert.equal((await fetchPublicImageSafe('https://source.test/image')).mimetype, 'image/png');
    pass('LP fetchPublicImageSafe');

    assert.equal(isPrivateOrReservedIp('::1'), true);
    assert.equal(isPrivateOrReservedIp('2606:4700:4700::1111'), false);
    pass('LP isPrivateOrReservedIp');
  } finally {
    http.request = originalHttp;
    https.request = originalHttps;
    __setDnsLookupForTests(null);
  }

  console.log(`\n[landing-ssrf] ${ok} case PASS`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});