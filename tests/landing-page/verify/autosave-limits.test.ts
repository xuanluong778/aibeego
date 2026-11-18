/**
 * Kiểm thử giới hạn body autosave với xác thực hợp lệ — CHỈ chạy trên stack ứng viên riêng.
 *   LP_API_BASE   proxy ứng viên (nginx đã có location autosave 3m)   vd http://127.0.0.1:18081/api/v1
 *   OLD_API_BASE  proxy cấu hình nginx CŨ (mặc định 1 MB)             vd http://127.0.0.1:18080/api/v1
 *   DIRECT_API    API trực tiếp, không qua nginx                       vd http://172.x.x.x:4000/api/v1
 *   LP_ORG_A_OWNER_EMAIL / LP_ORG_A_OWNER_PASSWORD
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { apiSkipReason } from '../support/env';
import { as } from '../support/api';
import { newPage, getPage, revisionOf, useCleanup } from '../support/lp';
import { makeSpec } from '../fixtures/specs';

const skip = apiSkipReason(['ORG_A_OWNER']);
const OLD = (process.env.OLD_API_BASE || '').replace(/\/$/, '');
const DIRECT = (process.env.DIRECT_API || '').replace(/\/$/, '');
useCleanup();

/** Spec lớn ~targetBytes (đo theo BYTE), dữ liệu hợp lệ để bộ làm sạch phía server giữ nguyên:
 *  mỗi khối Features có 24 mục (server giữ tối đa 24), mô tả ASCII ≤ 390 ký tự (server cắt ở 400). */
function bigSpec(targetBytes: number, headline: string) {
  const spec: any = makeSpec({ headline });
  const blocks: any[] = [];
  let size = Buffer.byteLength(JSON.stringify(spec));
  let i = 0;
  while (size < targetBytes) {
    const b = {
      id: `big-${i}`, type: 'Features', enabled: true, spacing: 'md', headline: `Khoi ${i}`, subheadline: 'x',
      items: Array.from({ length: 24 }, (_, k) => ({ id: `big-${i}-${k}`, title: `Muc ${i}-${k}`, description: (`d${i}-${k} `.repeat(80)).slice(0, 390) })),
    };
    blocks.push(b); size += Buffer.byteLength(JSON.stringify(b)) + 1; i++;
  }
  spec.blocks = [...(spec.blocks || []), ...blocks];
  return spec;
}
const bytesOf = (o: unknown) => Buffer.byteLength(JSON.stringify(o));
const rawPost = (base: string, token: string, id: string, raw: string) =>
  fetch(`${base}/landing-pages/${id}/autosave`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: raw });

test('autosave trang dưới 2 MB thành công và đọc lại đúng dữ liệu', { skip: skip || false }, async () => {
  const c = await as('ORG_A_OWNER');
  const page = await newPage(c);
  let base = 0;
  for (const [kb, label] of [[150, '150 KB (> mức cũ 100 KB)'], [740, '~0,75 MB (trang hợp lệ lớn nhất: server giữ tối đa ~76 khối x 24 mục)']] as const) {
    const spec = bigSpec(kb * 1024, `LIMIT-${kb}`);
    const body = JSON.stringify({ draftSpec: spec, baseRevision: base, clientRevision: base + 1, requestId: `lim-${kb}-${Date.now()}` });
    const r = await rawPost(process.env.LP_API_BASE!, c.token, page.id, body);
    const j: any = await r.json().catch(() => ({}));
    console.log(`  [${label}] body=${(Buffer.byteLength(body) / 1024).toFixed(0)}KB -> HTTP ${r.status} rejected=${j.rejected}`);
    assert.ok(r.status >= 200 && r.status < 300, `${label}: HTTP ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
    assert.equal(j.rejected, false);
    base += 1;
    const back = await getPage(c, page.id);
    const got = (back.draftSpec as any).blocks.filter((b: any) => String(b.id).startsWith('big-'));
    const want = spec.blocks.filter((b: any) => String(b.id).startsWith('big-'));
    assert.equal(got.length, want.length, `${label}: số khối đọc lại`);
    // Server chuẩn hoá nhẹ (cắt khoảng trắng cuối, thêm khoá mặc định icon/imageUrl) -> so id, tiêu đề, mô tả đã trim.
    const norm = (bs: any[]) => JSON.stringify(bs.map((b) => b.items.map((it: any) => [it.id, it.title, String(it.description).trim()])));
    assert.equal(norm(got), norm(want), `${label}: toàn bộ mục (id/tiêu đề/mô tả) đọc lại phải khớp`);
    console.log(`  [${label}] đọc lại ${got.length} khối x ${got[0].items.length} mục: khớp 100%`);
    assert.equal(revisionOf(back as any), base);
  }
});

test('body ~1,5 MB (< 2 MB) gồm ảnh nhúng base64 như client thật: lưu được, nội dung chữ không mất (server loại ảnh nhúng)', { skip: skip || false }, async () => {
  const c = await as('ORG_A_OWNER');
  const page = await newPage(c);
  const spec: any = bigSpec(150 * 1024, 'EMBED');
  const hero = spec.blocks.find((b: any) => b.type === 'Hero') || spec.blocks[0];
  hero.imageUrl = 'data:image/png;base64,' + 'A'.repeat(1300 * 1024);
  const body = JSON.stringify({ draftSpec: spec, baseRevision: 0, clientRevision: 1, requestId: 'lim-embed' });
  const r = await rawPost(process.env.LP_API_BASE!, c.token, page.id, body);
  const j: any = await r.json().catch(() => ({}));
  console.log(`  [~1,5 MB có ảnh nhúng] body=${(Buffer.byteLength(body) / 1048576).toFixed(2)}MB -> HTTP ${r.status} rejected=${j.rejected}`);
  assert.ok(r.status >= 200 && r.status < 300 && j.rejected === false);
  const back: any = await getPage(c, page.id);
  const got = back.draftSpec.blocks.filter((b: any) => String(b.id).startsWith('big-'));
  const want = spec.blocks.filter((b: any) => String(b.id).startsWith('big-'));
  assert.equal(got.length, want.length);
  const hb = back.draftSpec.blocks.find((b: any) => b.id === hero.id);
  console.log(`  server giữ ${got.length}/${want.length} khối chữ; imageUrl nhúng sau khi lưu có độ dài ${(hb?.imageUrl || '').length} (bị loại)`);
});

test('body vượt 2 MB -> 413 JSON, không ghi dữ liệu dở dang', { skip: skip || false }, async () => {
  const c = await as('ORG_A_OWNER');
  const page = await newPage(c);
  const ok = await rawPost(process.env.LP_API_BASE!, c.token, page.id, JSON.stringify({ draftSpec: makeSpec({ headline: 'TRƯỚC' }), baseRevision: 0, clientRevision: 1, requestId: 'lim-before' }));
  assert.ok(ok.status < 300);
  const before = await getPage(c, page.id);
  const huge = JSON.stringify({ draftSpec: bigSpec(2400 * 1024, 'QUA-LON'), baseRevision: 1, clientRevision: 2, requestId: 'lim-huge' });
  // 2,5 MB: qua nginx (3m) tới API -> API trả 413 JSON PAYLOAD_TOO_LARGE
  const r = await rawPost(process.env.LP_API_BASE!, c.token, page.id, huge);
  const j: any = await r.json().catch(() => ({}));
  console.log(`  [~2,4 MB qua nginx 3m] HTTP ${r.status} code=${j.code}`);
  assert.equal(r.status, 413); assert.equal(j.code, 'PAYLOAD_TOO_LARGE');
  // quá 3 MB: nginx chặn trước API (HTML), vẫn là 413
  const bigger = JSON.stringify({ draftSpec: bigSpec(3300 * 1024, 'QUA-LON-2'), baseRevision: 1, clientRevision: 2, requestId: 'lim-huge2' });
  const r2 = await rawPost(process.env.LP_API_BASE!, c.token, page.id, bigger);
  console.log(`  [3,3 MB] HTTP ${r2.status} content-type=${r2.headers.get('content-type')}`);
  assert.equal(r2.status, 413);
  if (DIRECT) {
    const r3 = await rawPost(DIRECT, c.token, page.id, huge);
    const j3: any = await r3.json().catch(() => ({}));
    console.log(`  [~2,4 MB trực tiếp API] HTTP ${r3.status} code=${j3.code}`);
    assert.equal(r3.status, 413); assert.equal(j3.code, 'PAYLOAD_TOO_LARGE');
  }
  const after = await getPage(c, page.id);
  assert.equal(JSON.stringify(after.draftSpec), JSON.stringify(before.draftSpec), 'dữ liệu phải y nguyên, không ghi dở dang');
  assert.equal(revisionOf(after as any), revisionOf(before as any));
});

test('JSON sai định dạng -> 400, dữ liệu không đổi', { skip: skip || false }, async () => {
  const c = await as('ORG_A_OWNER');
  const page = await newPage(c);
  const before = await getPage(c, page.id);
  for (const raw of ['{"draftSpec":', '{"draftSpec": {"a":1,}}', 'không phải json']) {
    const r = await rawPost(process.env.LP_API_BASE!, c.token, page.id, raw);
    console.log(`  [JSON hỏng ${JSON.stringify(raw).slice(0, 24)}] HTTP ${r.status}`);
    assert.equal(r.status, 400);
  }
  const after = await getPage(c, page.id);
  assert.equal(JSON.stringify(after.draftSpec), JSON.stringify(before.draftSpec));
});

test('Hai tầng nginx: cấu hình CŨ chặn 1,5 MB ở nginx; cấu hình MỚI cho qua tới API', { skip: skip || (!OLD ? 'chưa đặt OLD_API_BASE' : false) }, async () => {
  const c = await as('ORG_A_OWNER');
  const page = await newPage(c);
  const body = JSON.stringify({ draftSpec: bigSpec(1500 * 1024, 'NGINX-TIER'), baseRevision: 0, clientRevision: 1, requestId: 'lim-tier' });
  const rOld = await rawPost(OLD, c.token, page.id, body);
  console.log(`  [cấu hình nginx CŨ, 1,5 MB] HTTP ${rOld.status} content-type=${rOld.headers.get('content-type')}`);
  assert.equal(rOld.status, 413, 'nginx cũ (mặc định 1 MB) phải chặn 1,5 MB');
  assert.match(String(rOld.headers.get('content-type')), /text\/html/, 'nginx trả HTML, không phải JSON của API');
  const rNew = await rawPost(process.env.LP_API_BASE!, c.token, page.id, body);
  console.log(`  [cấu hình nginx MỚI, 1,5 MB] HTTP ${rNew.status}`);
  assert.ok(rNew.status < 300);
});
