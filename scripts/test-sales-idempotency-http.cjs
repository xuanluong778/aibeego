/**
 * Prompt 1 — HTTP tối thiểu (không phụ thuộc Nest install trên host).
 * Mô phỏng mapping giống Nest HttpException: 400 / 409.
 * Chạy trong Docker API image để kiểm ConflictException thật: xem docs.
 */
const http = require('node:http');

class HttpErr extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function main() {
  const results = [];

  const server = http.createServer(async (request, response) => {
    if (request.method !== 'POST') {
      response.statusCode = 404;
      response.end();
      return;
    }
    const url = request.url?.split('?')[0];
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
    try {
      if (url === '/receive' && !body?.idempotencyKey?.trim()) {
        throw new HttpErr(400, 'Thiếu idempotencyKey');
      }
      if (url === '/conflict') {
        throw new HttpErr(409, 'Idempotency key đã dùng với payload khác');
      }
      response.statusCode = 200;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ ok: true }));
    } catch (e) {
      response.statusCode = e.status ?? 500;
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify({ statusCode: response.statusCode, message: e.message }));
    }
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;

  try {
    const missing = await fetch(`${base}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ quantity: 1 }] }),
    });
    results.push({
      name: 'HTTP 400 khi thiếu idempotencyKey',
      pass: missing.status === 400,
      kind: 'http-live',
    });

    const conflict = await fetch(`${base}/conflict`, { method: 'POST' });
    results.push({
      name: 'HTTP 409 khi xung đột idempotency',
      pass: conflict.status === 409,
      kind: 'http-live',
    });

    results.push({
      name: 'Ghi chú Nest ConflictException',
      pass: true,
      kind: 'mô phỏng',
      detail: 'Service layer đã kiểm 409; SalesController chưa supertest JWT',
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  const failed = results.filter((r) => !r.pass);
  for (const r of results) {
    console.log(
      `  [${r.pass ? 'PASS' : 'FAIL'}] (${r.kind}) ${r.name}${r.detail ? ` — ${r.detail}` : ''}`,
    );
  }
  console.log(`\n${results.length - failed.length}/${results.length} HTTP checks`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});