/**
 * JSON-LD serializer — tiếng Việt, dấu nháy, <>, Unicode, canonical URL.
 * node scripts/with-root-env.cjs pnpm exec tsx scripts/test-safe-json-ld.ts
 */
import assert from 'node:assert/strict';
import { serializeJsonLd } from '../apps/web/src/lib/safe-json-ld';

const cases = [
  {
    name: 'Tiêu đề spa "Gold" & giá < 500k',
    description: 'Mô tả có dấu "nháy đơn" và </script><script>alert(1)',
    url: 'https://spa.example.com/p/khám-phá?ref=vi',
  },
  {
    name: 'Unicode — café résumé 日本語 🇻🇳',
    description: 'Dòng mô tả\xA0và ký tự đặc biệt\u2028\u2029',
    url: 'https://x.example/p/路径',
  },
];

let passed = 0;
for (const sample of cases) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: sample.name,
    description: sample.description,
    url: sample.url,
  };
  const html = serializeJsonLd(jsonLd);
  assert.ok(!html.includes('</script>'), 'must not contain raw </script>');
  assert.ok(!html.includes('<script'), 'must not contain raw <script');
  const parsed = JSON.parse(html) as typeof jsonLd;
  assert.equal(parsed.name, sample.name);
  assert.equal(parsed.description, sample.description);
  assert.equal(parsed.url, sample.url);
  passed++;
  console.log(`[PASS] JSON-LD round-trip: ${sample.name.slice(0, 40)}…`);
}

// XSS breakout string must stay inside JSON string literals after serialize
const evil = { '@type': 'WebPage', name: '</script><img onerror=1>' };
const evilHtml = serializeJsonLd(evil);
assert.ok(evilHtml.includes('\\u003c/script\\u003e') || !evilHtml.includes('</script>'));
assert.equal(JSON.parse(evilHtml).name, evil.name);
console.log('[PASS] JSON-LD angle brackets escaped');
console.log(`\n${passed + 1}/${passed + 1} PASS`);