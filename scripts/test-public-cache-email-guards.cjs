/**
 * LP cache tags + email click verify (unit, không production).
 * Build @marketingspa/shared qua tsconfig package trước khi require dist.
 */
const assert = require('node:assert/strict');
const { resolve } = require('path');
const { buildSharedPackage } = require('./build-shared-package.cjs');

const cwd = resolve(__dirname, '..');
const built = buildSharedPackage(cwd);
if (!built.ok) {
  console.error(`[email-click-unit] FAIL build shared — ${built.detail}`);
  process.exit(1);
}

const {
  landingPagePublicCacheTags,
  landingPagePublicPath,
  landingPageScopeCacheTag,
  LANDING_PAGE_APEX_SLUG_AMBIGUITY_NOTE,
} = require('../packages/shared/dist/landing-page-public-cache');
const {
  collectEmailTrackableDestinations,
  signEmailClickDestination,
  resolveEmailClickDestination,
  normalizeEmailClickUrl,
  emailClickUrlMatchesAllowed,
} = require('../packages/shared/dist/email-click-destination');
const {
  signLandingPageCacheRetryToken,
  verifyLandingPageCacheRetryToken,
} = require('../packages/shared/dist/landing-page-cache-retry-token');
const { rewriteEmailTrackedLinks } = require('../packages/shared/dist/email-tracked-links');

const org = '11111111-1111-4111-8111-111111111111';
const page = '22222222-2222-4222-8222-222222222222';

function pass(name) {
  console.log(`  [PASS] ${name}`);
}

async function main() {
  const tagsA = landingPagePublicCacheTags({ organizationId: org, pageId: page, slug: 'sale' });
  const tagsB = landingPagePublicCacheTags({
    organizationId: '33333333-3333-4333-8333-333333333333',
    pageId: '44444444-4444-4444-8444-444444444444',
    slug: 'sale',
  });
  assert.ok(tagsA.includes(`lp-public-${org}-sale`));
  assert.ok(tagsA.includes(`lp-public-page-${page}`));
  assert.notDeepEqual(tagsA, tagsB);
  assert.ok(tagsA.includes(landingPageScopeCacheTag('sale')));
  pass('Cache tag theo org + page + lp-scope (slug trùng không lẫn tag org)');

  assert.equal(landingPagePublicPath('my-page'), '/p/my-page');
  assert.ok(LANDING_PAGE_APEX_SLUG_AMBIGUITY_NOTE.includes('slug'));
  pass('Path revalidate + ghi chú apex slug trùng tenant');

  const html = `<a href="https://shop.test/a">A</a><a href="https://evil.test/x">skip</a>`;
  const allowed = collectEmailTrackableDestinations(`<a href="https://shop.test/a">A</a>`);
  assert.deepEqual(allowed, ['https://shop.test/a']);

  const secret = 'unit-test-email-click-secret-32chars!!';
  const rid = '55555555-5555-4555-8555-555555555555';
  const cid = '66666666-6666-4666-8666-666666666666';
  const dest = 'https://shop.test/a';
  const sig = signEmailClickDestination(rid, cid, dest, secret);
  const signed = resolveEmailClickDestination({
    requestedUrl: dest,
    signature: sig,
    recipientId: rid,
    campaignId: cid,
    allowedDestinations: allowed,
    signSecret: secret,
    safeFallbackUrl: 'https://safe.test/',
  });
  assert.equal(signed.ok, true);
  assert.equal(signed.mode, 'signed');
  pass('Link mới: chữ ký hợp lệ → đích xác minh');

  const legacy = resolveEmailClickDestination({
    requestedUrl: dest,
    recipientId: rid,
    campaignId: cid,
    allowedDestinations: allowed,
    safeFallbackUrl: 'https://safe.test/',
  });
  assert.equal(legacy.ok, true);
  assert.equal(legacy.mode, 'legacy');
  pass('Link cũ: url khớp mẫu chiến dịch');

  const tampered = resolveEmailClickDestination({
    requestedUrl: 'https://evil.test/phish',
    recipientId: rid,
    campaignId: cid,
    allowedDestinations: allowed,
    signSecret: secret,
    safeFallbackUrl: 'https://safe.test/',
  });
  assert.equal(tampered.ok, false);
  assert.equal(tampered.destination, 'https://safe.test/');
  pass('Đích lạ → fallback an toàn, không ghi sự kiện (verify fail)');

  const clickBase = 'https://app.test/api/v1/email-marketing/public/click/' + rid;
  const out = rewriteEmailTrackedLinks(html, clickBase, 'https://app.test/unsub', {
    campaignId: cid,
    recipientId: rid,
    clickSignSecret: secret,
  });
  assert.match(out, /sig=/);
  assert.doesNotMatch(out, /href="https:\/\/evil\.test/);
  pass('Rewrite chỉ bọc https hợp lệ + thêm sig');

  const withFrag = 'https://shop.test/landing?utm_source=email#pricing';
  assert.equal(
    normalizeEmailClickUrl(withFrag),
    'https://shop.test/landing?utm_source=email#pricing',
  );
  const allowedFrag = collectEmailTrackableDestinations(`<a href="${withFrag}">Go</a>`);
  const sigFrag = signEmailClickDestination(rid, cid, withFrag, secret);
  const signedFrag = resolveEmailClickDestination({
    requestedUrl: withFrag,
    signature: sigFrag,
    recipientId: rid,
    campaignId: cid,
    allowedDestinations: allowedFrag,
    signSecret: secret,
    safeFallbackUrl: 'https://safe.test/',
  });
  assert.equal(signedFrag.ok, true);
  assert.match(signedFrag.destination, /#pricing/);
  pass('Link ký mới giữ query + fragment');

  const legacyFragTpl = 'https://shop.test/landing?utm_source=email#pricing';
  const legacyFragReq = 'https://shop.test/landing?utm_source=email';
  assert.ok(emailClickUrlMatchesAllowed(legacyFragReq, legacyFragTpl));
  const legacyFrag = resolveEmailClickDestination({
    requestedUrl: legacyFragReq,
    recipientId: rid,
    campaignId: cid,
    allowedDestinations: [legacyFragTpl],
    safeFallbackUrl: 'https://safe.test/',
  });
  assert.equal(legacyFrag.ok, true);
  assert.equal(legacyFrag.destination, legacyFragReq);
  pass('Link cũ không hash — khớp mẫu có #pricing (tương thích)');

  const badSig = resolveEmailClickDestination({
    requestedUrl: withFrag,
    signature: 'invalid-sig',
    recipientId: rid,
    campaignId: cid,
    allowedDestinations: allowedFrag,
    signSecret: secret,
    safeFallbackUrl: 'https://safe.test/',
  });
  assert.equal(badSig.ok, false);
  assert.equal(badSig.reason, 'bad_signature');
  pass('Chữ ký sai → fallback');

  const tplPlain = 'https://shop.test/landing?utm_source=email';
  assert.equal(
    resolveEmailClickDestination({
      requestedUrl: 'https://shop.test/landing?utm_source=email#evil',
      recipientId: rid,
      campaignId: cid,
      allowedDestinations: [tplPlain],
      safeFallbackUrl: 'https://safe.test/',
    }).ok,
    false,
  );
  pass('Legacy: từ chối fragment thêm vào (mẫu không có #)');

  const tplFragChanged = resolveEmailClickDestination({
    requestedUrl: 'https://shop.test/landing#other',
    recipientId: rid,
    campaignId: cid,
    allowedDestinations: [legacyFragTpl],
    safeFallbackUrl: 'https://safe.test/',
  });
  assert.equal(tplFragChanged.ok, false);
  pass('Legacy: từ chối fragment đổi (#pricing → #other)');

  const lpSecret = 'lp-cache-retry-token-secret-32chars!';
  const scope = { organizationId: org, pageId: page, slug: 'sale' };
  const token = signLandingPageCacheRetryToken(scope, lpSecret, 60_000);
  const good = verifyLandingPageCacheRetryToken(token, lpSecret);
  assert.equal(good.ok, true);
  pass('Cache retry token hợp lệ sau xóa');

  const parts = token.split('.');
  const tokenTampered = `${parts[0]}x.${parts[1]}`;
  assert.equal(verifyLandingPageCacheRetryToken(tokenTampered, lpSecret).ok, false);
  pass('Cache retry token bị sửa → từ chối');

  const expired = signLandingPageCacheRetryToken(scope, lpSecret, 1_000, Date.now() - 5_000);
  assert.equal(verifyLandingPageCacheRetryToken(expired, lpSecret).reason, 'expired');
  pass('Cache retry token hết hạn');

  assert.equal(good.scope.organizationId === org, true);
  assert.equal(good.scope.organizationId === '33333333-3333-4333-8333-333333333333', false);
  pass('Tài khoản khác tổ chức — API so khớp token org với session (403)');

  console.log('\n[email-click-unit] 17 case PASS — LP cache token + email fragment');
  console.log('[email-click-unit] HTTP/browser A≠B isolation — CHƯA KIỂM CHỨNG');
  console.log('[email-click-unit] Chiến dịch QA email thật — CHƯA KIỂM CHỨNG');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});