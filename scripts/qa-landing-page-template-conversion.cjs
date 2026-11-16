// Isolated CSS QA; does not replace a full renderer/browser integration test.
require('./run-landing-page-url-upgrade-tests.cjs');
const fs = require('node:fs');
const { LP_RESPONSIVE_FOUNDATION_CSS, LP_CONVERSION_TYPOGRAPHY_CSS } = require('../apps/web/src/components/landing-pages/landing-page-responsive-foundation.ts');
const dir = '.tmp/lp-conversion';
fs.mkdirSync(dir, { recursive: true });
for (const viewport of ['desktop', 'tablet', 'mobile']) {
  fs.writeFileSync(`${dir}/${viewport}.html`, `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  body{margin:0;padding:24px;font-family:Arial;background:#f7f6f1;color:#153f46}main{max-width:1040px;margin:auto}h1,h2,h3{max-width:100%}article{padding:24px;background:white;border-radius:16px;margin-block:24px}
  ${LP_RESPONSIVE_FOUNDATION_CSS}${LP_CONVERSION_TYPOGRAPHY_CSS}</style>
  <main data-lp-canvas-root data-lp-content-typography="conversion" data-lp-viewport="${viewport}">
  <h1>Học SEO có lộ trình, biết cách làm trên website</h1><p>Từ nền tảng đến triển khai SEO. Dành cho người làm marketing và chủ doanh nghiệp.</p>
  <h2>Thực hành trên website, đọc kết quả từ dữ liệu</h2><article><h3>Đưa kiến thức vào website của bạn</h3><p>Thực hành trên dự án thực tế để kết nối nội dung học với từng việc cần triển khai trên website.</p></article>
  <h3 id="custom" style="font-size:25px">Cỡ chữ đã chỉnh</h3>
  <span data-lp-size-accepted="1"><h2 id="accepted" style="font-size:27px">Tiêu đề đã duyệt</h2></span>
  </main><pre id="measurements"></pre><script>
  const root=document.querySelector('main'),sizes=[...root.querySelectorAll('h1,h2,h3')].slice(0,3).map(e=>parseFloat(getComputedStyle(e).fontSize));
  const result={viewport:${JSON.stringify(viewport)},sizes,custom:parseFloat(getComputedStyle(document.querySelector('#custom')).fontSize),accepted:parseFloat(getComputedStyle(document.querySelector('#accepted')).fontSize),overflow:document.documentElement.scrollWidth>innerWidth};
  result.passed=sizes[0]>sizes[1]&&sizes[1]>sizes[2]&&result.custom===25&&result.accepted===27&&!result.overflow;
  document.querySelector('#measurements').textContent=JSON.stringify(result);document.title=result.passed?'PASS':'FAIL';
  </script></html>`);
}
console.log('Created isolated typography QA in .tmp/lp-conversion');
