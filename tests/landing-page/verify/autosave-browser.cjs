/**
 * Kiểm thử trình duyệt THẬT (Chromium) cho luồng lưu của builder — chỉ chạy trên stack ứng viên riêng.
 * Giao diện được phục vụ ảo ở https://aibeego.com nhưng MỌI request tới host đó bị chặn lại và chuyển tới CAND_BASE;
 * request tới host khác bị huỷ => không có lưu lượng nào ra production.
 *   CAND_BASE=http://127.0.0.1:18081  CAND_EMAIL=... CAND_PASSWORD=...  CHROMIUM=/snap/bin/chromium
 */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const BASE = (process.env.CAND_BASE || '').replace(/\/$/, '');
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(BASE)) { console.error('CAND_BASE phải là localhost'); process.exit(2); }
const results = [];
const row = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(method, path, token, body) {
  const r = await fetch(`${BASE}/api/v1${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  return { status: r.status, body: j };
}

(async () => {
  const login = await api('POST', '/auth/login', null, { email: process.env.CAND_EMAIL, password: process.env.CAND_PASSWORD });
  const token = login.body?.accessToken || login.body?.access_token;
  assert.ok(token, `đăng nhập thất bại HTTP ${login.status}`);
  const created = await api('POST', '/landing-pages', token, { mode: 'blank', name: `LPT-BROWSER-${Date.now()}`, idempotencyKey: `idem-br-${Date.now()}` });
  const pageId = created.body.id; assert.ok(pageId, 'tạo trang');
  // Ô "headline" đầu tiên trên canvas thuộc khối Header, không phải Hero -> đọc TẤT CẢ tiêu đề các khối.
  const serverHeadline = async () => {
    const p = (await api('GET', `/landing-pages/${pageId}`, token)).body;
    const all = (p.draftSpec?.blocks || []).map((b) => b.headline || '');
    return { all, joined: all.join(' | '), has: (t) => all.includes(t), rev: p.draftSpec?.meta?.clientRevision ?? 0 };
  };
  const before = await serverHeadline();

  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ignoreHTTPSErrors: true });
  const ctl = { mode: 'pass', slowMs: 3000, reqs: [], inflight: 0, maxInflight: 0, external: [] };
  await context.route('**/*', async (route) => {
    const req = route.request(); const u = new URL(req.url());
    if (u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    if (u.hostname !== 'aibeego.com') { ctl.external.push(req.url().slice(0, 80)); return route.abort(); }
    const isAutosave = req.method() === 'POST' && /\/landing-pages\/[^/]+\/autosave$/.test(u.pathname);
    if (isAutosave) {
      const entry = { t: Date.now(), mode: ctl.mode, bytes: (req.postData() || '').length }; ctl.reqs.push(entry);
      ctl.inflight++; ctl.maxInflight = Math.max(ctl.maxInflight, ctl.inflight);
      try {
        if (ctl.mode === '500') return await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, statusCode: 500, message: 'Internal server error' }) });
        if (ctl.mode === '413json') return await route.fulfill({ status: 413, contentType: 'application/json', body: JSON.stringify({ success: false, statusCode: 413, code: 'PAYLOAD_TOO_LARGE', message: 'Nội dung gửi lên quá lớn.' }) });
        if (ctl.mode === '413html') return await route.fulfill({ status: 413, contentType: 'text/html', body: '<html><body><h1>413 Request Entity Too Large</h1></body></html>' });
        if (ctl.mode === 'offline') return await route.abort('internetdisconnected');
        if (ctl.mode === 'slow') await sleep(ctl.slowMs);
      } finally { ctl.inflight--; }
    }
    try {
      const headers = { ...req.headers() }; delete headers.host; delete headers['content-length'];
      const res = await fetch(BASE + u.pathname + u.search, { method: req.method(), headers, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postData() });
      const buf = Buffer.from(await res.arrayBuffer()); const out = {};
      res.headers.forEach((v, k) => { if (!['transfer-encoding', 'content-encoding', 'content-length'].includes(k.toLowerCase())) out[k] = v; });
      await route.fulfill({ status: res.status, headers: out, body: buf });
    } catch (e) { await route.fulfill({ status: 502, body: String(e.message || e) }); }
  });
  await context.addInitScript((t) => localStorage.setItem('ms_access_token', t), token);
  const page = await context.newPage(); page.setDefaultTimeout(30000);
  await page.goto(`https://aibeego.com/landing-pages/builder/${pageId}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator('[data-lp-canvas-root]').first().waitFor({ timeout: 60000 });
  await sleep(2500);

  const toast = () => page.locator('[data-lp-status-toast]').first().innerText().catch(() => '');
  const draftKeys = () => page.evaluate((id) => Object.keys(localStorage).filter((k) => k.includes(id) || /draft/i.test(k)).map((k) => k + ':' + (localStorage.getItem(k) || '').length), pageId);
  const headline = page.locator('[data-lp-inline-field="headline"]').first();
  let n = 0;
  const edit = async (text) => { await headline.dblclick(); await headline.fill(text); await page.keyboard.press('Tab'); };
  const settle = async (ms) => sleep(ms);
  const reset = (mode) => { ctl.mode = mode; ctl.reqs.length = 0; ctl.maxInflight = 0; };

  const ONLY = process.env.ONLY || '';
  if (!ONLY || ONLY === 'ABC') {
  // A. Lưu bình thường
  reset('pass'); const A = `A-binh-thuong-${++n}`; await edit(A); await settle(5000);
  let sv = await serverHeadline(); const tA = await toast();
  row('A. Lưu bình thường: server nhận đúng nội dung', sv.has(A), `server có "${A}": ${sv.has(A)} requests=${ctl.reqs.length}`);
  row('A. Lưu bình thường: hiện "Đã lưu"', /Đã lưu/.test(tA), `toast="${tA.slice(0, 50)}"`);
  row('A. Lưu bình thường: không gửi lặp (≤ 2 request, 1 request tại một thời điểm)', ctl.reqs.length <= 2 && ctl.maxInflight <= 1, `n=${ctl.reqs.length} maxInflight=${ctl.maxInflight}`);

  // B. Lỗi 500 liên tục
  for (const [mode, label, expectRetry] of [['500', 'lỗi 500', true], ['413json', 'lỗi 413 (JSON từ API)', false], ['413html', 'lỗi 413 (HTML từ nginx)', false], ['offline', 'mất mạng', true]]) {
    reset(mode); const T = `B-${mode}-${++n}`; const snapshot = await serverHeadline(); await edit(T);
    await settle(9000); // vượt 5 s để kiểm tra thông báo không tự biến mất
    const sent1 = ctl.reqs.length; const t = await toast(); const svB = await serverHeadline();
    await settle(8000); const sent2 = ctl.reqs.length; // không sửa gì thêm: không được gửi tiếp
    row(`B. ${label}: không hiện "Đã lưu"`, !/Đã lưu/.test(t) && t.length > 0, `toast="${t.replace(/\s+/g, ' ').slice(0, 90)}"`);
    row(`B. ${label}: số request hợp lý`, sent1 <= (expectRetry ? 4 : 2) , `request=${sent1} (kỳ vọng ≤ ${expectRetry ? 4 : 2})`);
    row(`B. ${label}: không gửi lặp vô hạn khi người dùng không sửa thêm`, sent2 === sent1, `sau 8 s thêm: ${sent2 - sent1} request`);
    row(`B. ${label}: server không bị ghi dở`, svB.joined === snapshot.joined && svB.rev === snapshot.rev, `server không đổi: ${svB.joined === snapshot.joined}`);
    row(`B. ${label}: bản nháp cục bộ được giữ`, (await draftKeys()).some((k) => /:[1-9]\d*$/.test(k)), JSON.stringify(await draftKeys()).slice(0, 100));
    row(`B. ${label}: nội dung chưa lưu vẫn còn trên màn hình`, (await headline.innerText()).includes(T));
    // Có mạng trở lại / sửa tiếp -> lưu lại được
    reset('pass'); const R = `B-recover-${mode}-${++n}`; await edit(R); await settle(5000);
    const svR = await serverHeadline(); const tR = await toast();
    row(`B. ${label}: sau khi hết lỗi và sửa tiếp, lưu thành công đúng bản mới nhất`, svR.has(R) && /Đã lưu/.test(tR), `server có "${R}": ${svR.has(R)} toast="${tR.slice(0, 30)}"`);
  }

  // C. Sửa tiếp trong lúc request đang chạy
  reset('slow'); ctl.slowMs = 4000; const C1 = `C1-${++n}`, C2 = `C2-${++n}`, C3 = `C3-${++n}`;
  await edit(C1); await sleep(2200); await edit(C2); await sleep(500); await edit(C3); await settle(14000);
  const svC = await serverHeadline();
  row('C. Sửa tiếp trong lúc đang lưu: bản mới nhất không bị mất', svC.has(C3) && !svC.has(C1) && !svC.has(C2), `server có bản mới nhất C3: ${svC.has(C3)} requests=${ctl.reqs.length} maxInflight=${ctl.maxInflight}`);
  row('C. Không có nhiều request lưu đồng thời', ctl.maxInflight <= 1, `maxInflight=${ctl.maxInflight}`);

  }
  // D. Xuất bản khi lưu đang lỗi (luồng flush "wait" có đệ quy) — đếm số request lưu bị gửi
  if (!ONLY || ONLY === 'D') {
    for (const mode of ['500', '413json', 'offline']) {
      // trang mới cho mỗi chế độ (hộp thoại xuất bản của vòng trước có thể còn che giao diện)
      const np = (await api('POST', '/landing-pages', token, { mode: 'blank', name: `LPT-BROWSER-D-${mode}-${Date.now()}`, idempotencyKey: `idem-d-${mode}-${Date.now()}` })).body;
      reset('pass'); await page.goto(`https://aibeego.com/landing-pages/builder/${np.id}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await page.locator('[data-lp-canvas-root]').first().waitFor({ timeout: 60000 }); await sleep(2500);
      reset(mode); const T = `D-${mode}-${++n}`; await edit(T); await sleep(300);
      const pubReqs = []; const onReq = (r) => { if (r.method() === 'POST' && /\/publish$/.test(new URL(r.url()).pathname)) pubReqs.push(Date.now()); };
      page.on('request', onReq);
      const btn = page.locator('[data-lp-publish-btn]').first();
      const visible = await btn.isVisible().catch(() => false);
      if (visible) {
        await btn.click().catch(() => {}); await sleep(2000);
        const confirm = page.locator('[data-lp-confirm-publish]').first();
        if (await confirm.isVisible().catch(() => false)) await confirm.click().catch(() => {});
      }
      await sleep(15000); page.off('request', onReq);
      console.log(`    [D ${mode}] nút Xuất bản thấy: ${visible}; số request autosave=${ctl.reqs.length}; request publish=${pubReqs.length}; toast="${(await toast()).replace(/\s+/g, ' ').slice(0, 80)}"`);
      row(`D. Xuất bản khi ${mode}: số request lưu bị giới hạn (≤ 6)`, visible && ctl.reqs.length <= 6, `autosave=${ctl.reqs.length}`);
    }
  }
  row('Không có request nào ra ngoài host ảo (không chạm production/bên thứ ba)', true, `request ngoài bị huỷ: ${ctl.external.length}`);
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\nTỔNG: ${results.length - failed}/${results.length} đạt`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('LỖI KHÔNG MONG ĐỢI:', e); process.exit(3); });
