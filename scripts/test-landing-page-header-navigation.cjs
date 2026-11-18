const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const file = path.resolve(__dirname, '../apps/web/src/components/landing-pages/landing-page-header-navigation.tsx');
require.extensions['.css'] = () => {};
const mod = new Module(file, module);
mod.filename = file;
mod.paths = Module._nodeModulePaths(path.dirname(file));
mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const { resolveHeaderLinks, LandingPageHeaderNavigation } = mod.exports;
const block = (type, id, enabled = true) => ({ type, id, enabled });
const blocks = [block('Header','head'),block('Hero','hero-new'),block('Features','features-new'),block('Pricing','pricing-new'),block('FAQ','faq-new'),block('Gallery','disabled',false),block('LeadForm','form-new')];
assert.deepEqual(resolveHeaderLinks('', blocks), [
  {label:'Dịch vụ',href:'#features-new'}, {label:'Bảng giá',href:'#pricing-new'},
  {label:'Hỏi đáp',href:'#faq-new'}, {label:'Liên hệ',href:'#form-new'},
]);
assert.deepEqual(resolveHeaderLinks('Trang chủ|Dịch vụ|Bảng giá|Liên hệ', blocks).map(x=>x.href), ['#hero-new','#features-new','#pricing-new','#form-new']);
assert.equal(resolveHeaderLinks('Dự án', blocks).length, 0);
assert.deepEqual(resolveHeaderLinks('Dịch vụ|Đầu ra|Quy trình|Hợp tác|FAQ', [block('Hero','hero'), block('Features','services'), block('Gallery','outputs'),block('Process','process'),block('Pricing','engagement'),block('FAQ','faq')]).map(x=>x.href), ['#services','#outputs','#process','#engagement','#faq']);
assert.deepEqual(resolveHeaderLinks('Đầu ra|Hợp tác', [block('Gallery','outputs'),block('Pricing','engagement')]).map(x=>x.href), ['#outputs','#engagement']);
assert.equal(resolveHeaderLinks('', [{...block('Features','hidden'), hidden:true}]).length, 0);
assert.deepEqual(resolveHeaderLinks('', [block('Header','header')]), []);
assert.equal(resolveHeaderLinks(' |  | ',blocks).length,4);
assert.equal(resolveHeaderLinks('BẢNG GIÁ',blocks)[0].href,'#pricing-new');
const before = JSON.stringify(blocks);
resolveHeaderLinks('', blocks);
assert.equal(JSON.stringify(blocks), before);
const shared = require('../packages/shared/dist/index.js');
let builtins = 0;
for (const template of shared.LANDING_PAGE_SYSTEM_TEMPLATES) {
  const spec = shared.cloneLandingPageSpecWithNewIds(shared.sanitizeLandingPageSpec(structuredClone(template.spec)));
  for (const header of spec.blocks.filter(b=>b.type==='Header' && b.enabled)) {
    for (const link of resolveHeaderLinks(header.body,spec.blocks)) {
      assert(spec.blocks.some(b=>b.enabled && '#'+b.id===link.href), template.slug+': valid target');
    }
    builtins++;
  }
}
let database = 0;
if (process.argv[2]) {
  for (const template of JSON.parse(fs.readFileSync(process.argv[2],'utf8'))) {
    for (const header of template.spec.blocks.filter(b=>b.type==='Header' && b.enabled)) {
      const links = resolveHeaderLinks(header.body,template.spec.blocks);
      assert(links.length > 0, template.slug+': restored navigation');
      for (const link of links) assert(template.spec.blocks.some(b=>b.enabled && '#'+b.id===link.href),template.slug+': valid target');
      database++;
    }
  }
}
const webRequire = Module.createRequire(path.resolve(__dirname,'../apps/web/package.json'));
const React = webRequire('react');
const { renderToStaticMarkup } = webRequire('react-dom/server');
const html = renderToStaticMarkup(React.createElement(LandingPageHeaderNavigation,{body:'',blocks,headerId:'head'}));
assert(html.includes('href="#features-new"'));
assert(html.includes('aria-expanded="false"'));
assert(html.includes('aria-controls="lp-header-menu-head"'));
console.log(`PASS header navigation: semantics, empty data, disabled sections, cloned IDs, immutability, SSR, ${builtins} built-in headers, ${database} database templates`);
