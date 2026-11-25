/**
 * JSON-LD — đồng bộ với apps/web/src/lib/safe-json-ld.ts
 */
const assert = require('node:assert/strict');

function serializeJsonLd(data) {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

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
  const parsed = JSON.parse(html);
  assert.equal(parsed.name, sample.name);
  assert.equal(parsed.description, sample.description);
  assert.equal(parsed.url, sample.url);
  passed++;
  console.log(`[PASS] JSON-LD round-trip: ${sample.name.slice(0, 40)}…`);
}

const evil = { '@type': 'WebPage', name: '</script><img onerror=1>' };
const evilHtml = serializeJsonLd(evil);
assert.ok(!evilHtml.includes('</script>'));
assert.equal(JSON.parse(evilHtml).name, evil.name);
console.log('[PASS] JSON-LD angle brackets escaped');
console.log(`\n${passed + 1}/${passed + 1} PASS`);