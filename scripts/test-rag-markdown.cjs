const assert = require('node:assert/strict');
const { ragWebsiteMarkdown } = require('../packages/shared/dist/rag-website-markdown');
const { collectRagWebsite } = require('../packages/shared/dist/rag-source-collect');
const html = `<html><body><header>Unrelated menu</header><nav>Repeated navigation</nav><main>
<h1>Doanh nghiệp Việt</h1><p>Dịch vụ SEO được tư vấn theo nhu cầu của khách hàng.</p>
<h2>Chính sách ưu đãi</h2><p>Ưu đãi đến 30/11/2026. Không áp dụng sau thời hạn.</p>
<ul><li>Tư vấn chiến lược</li><li>Hỗ trợ kỹ thuật</li></ul>
<table><tr><th>Dịch vụ</th><th>Giá</th></tr><tr><td>SEO cơ bản</td><td>5.000.000 ₫</td></tr></table>
<p><a href="/lien-he">Liên hệ</a></p><a href="javascript:alert(1)">Unsafe</a>
<script>window.attack=true</script><img src="https://tracking.example/pixel"></main><footer>Repeated footer</footer></body></html>`;
(async () => {
  const md = ragWebsiteMarkdown(html, 'https://example.com/');
  for (const expected of [
    '### Doanh nghiệp Việt',
    '#### Chính sách ưu đãi',
    '\n- ',
    '30/11/2026',
    '| Dịch vụ | Giá |',
    '| SEO cơ bản | 5.000.000 ₫ |',
    'https://example.com/lien-he',
  ])
    assert(md.includes(expected), expected + '\n' + md);
  for (const removed of [
    'Repeated navigation',
    'Repeated footer',
    'Unrelated menu',
    'window.attack',
    'javascript:',
    'tracking.example',
  ])
    assert(!md.includes(removed), removed);
  const block =
    '<div><div><p>Repeated responsive block with sufficiently long factual content describing the company and its services for a reader.</p><p>Second paragraph must stay with the first one.</p></div></div>';
  const unique = ragWebsiteMarkdown(
    `<main>${block}${block}<p>Separate unique policy.</p></main>`,
    'https://example.com/',
  );
  assert.equal(unique.split('Repeated responsive block').length - 1, 1);
  assert(unique.includes('Second paragraph'));
  assert(unique.includes('Separate unique policy'));
  const cleaned = ragWebsiteMarkdown(
    '<main><p>Useful company information.</p>[ux_image2type id="42"]<a href="/"><img src="logo.png"></a></main>',
    'https://example.com/',
  );
  assert.equal(cleaned, 'Useful company information.');
  let collected;
  await collectRagWebsite(
    'https://example.com/',
    async (item) => {
      if (item) collected = item;
    },
    {
      wait: async () => {},
      fetchHtml: async (url) => ({
        finalUrl: url,
        title: 'Test',
        text: 'Flat fallback',
        html,
        contentType: 'text/html',
      }),
    },
  );
  assert(collected.content.includes('### Doanh nghiệp Việt'));
  assert(collected.content.includes('| SEO cơ bản | 5.000.000 ₫ |'));
  assert(!collected.content.includes('Flat fallback'));
  console.log(
    'PASS: HTML becomes structured Markdown; paragraphs, lists, tables, prices, expiry dates and source links preserved; navigation, scripts and tracking images excluded.',
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
