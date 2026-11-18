import assert from 'node:assert/strict';
import fs from 'node:fs';
import { extractTemplateUrlSource, templateUrlBrief } from '../packages/shared/src/landing-page-template-url';
import { buildEditorialContext, completeCopy, editorialFactIdsFor, editorialRole, validateEditorialText } from '../packages/shared/src/landing-page-template-editorial';
import { collectTemplateContentSlots, fallbackTemplateContent, applyTemplateContent, planTemplateContent } from '../packages/shared/src/landing-page-template-content';
import { sanitizeLandingPagePersistSpec } from '../packages/shared/src/landing-page-lifecycle';
import { LANDING_PAGE_SYSTEM_TEMPLATES } from '../packages/shared/src/landing-page-templates';
const modules=['Google crawl, index và ranking','Nghiên cứu từ khóa và content SEO','Entity và Google Stacking','Cấu trúc website Silo và Topic Cluster','SEO Audit website','Tối ưu SEO Onpage','Triển khai Internal Link','Technical SEO và Schema','Traffic User','Tổng kết khóa học'];
const fixture=`<html><head><meta property="og:site_name" content="Đào Tạo SEO Digi | Thông tin đào tạo"></head><body><nav>Studio Sáng tạo, dự án agency</nav><main><h1>Khóa học SEO chuyên sâu</h1><p>Chương trình học SEO gắn với thực hành trên website.</p><h2>Ai nên tham gia khóa học?</h2><ul><li>Người làm marketing</li><li>Chủ doanh nghiệp</li><li>Người chuyển sang nghề SEO</li><li>Sinh viên</li></ul><h2>Rào cản khi tự học SEO</h2><h3>Thiếu lộ trình</h3><p>Không biết nên học phần nào trước để triển khai trên website.</p><h2>Lợi ích của khóa học</h2><h3>Ứng dụng vào website</h3><p>Liên kết kiến thức SEO với việc thực hành và phân tích dữ liệu.</p><h1>Khóa học SEO chuyên sâu</h1>${modules.map(title=>`<h3>${title}</h3><p>Học phần ${title} trong chương trình đào tạo SEO.</p>`).join('')}<h2>Phương pháp đào tạo</h2><h3>Thực hành trên website</h3><p>Thực hành tối ưu website và đọc dữ liệu bằng GA4, Search Console.</p><h2>Quy trình tham gia</h2><h3>Bước 1</h3><p>Đăng ký tư vấn khóa học</p><h3>Bước 2</h3><p>Chuẩn bị máy tính</p><h2>Thông tin đăng ký</h2><p>Gửi thông tin qua biểu mẫu để xác nhận học phí và lịch học.</p></main></body></html>`;
const actualPath='.tmp/lp-seo-editorial/source.html';
const source=extractTemplateUrlSource(fs.existsSync(actualPath)?fs.readFileSync(actualPath,'utf8'):fixture,'https://daotaoseodigi.com/','https://daotaoseodigi.com/');
const context=buildEditorialContext(source)!;
const brief={...templateUrlBrief(source),sourceText:source.text,sourceContext:context,goal:'consult' as const,imageIds:[]} as any;
const spec=structuredClone(LANDING_PAGE_SYSTEM_TEMPLATES.find(t=>t.slug==='agency-portfolio-cream-editorial')!.spec);
// Exercise the duplicate benefits sections present on the reported user layout.
if(spec.blocks.filter(b=>b.type==='Benefits').length===1){
  const original=spec.blocks.find(b=>b.type==='Benefits')!,duplicate=structuredClone(original) as any;
  duplicate.id+='-second';duplicate.items=duplicate.items.map((item:any)=>({...item,id:item.id+'-second'}));
  spec.blocks.splice(spec.blocks.indexOf(original)+1,0,duplicate);
}
const slots=collectTemplateContentSlots(spec),proposals=fallbackTemplateContent(slots,brief);
let checks=0;const test=(name:string,run:()=>void)=>{run();checks++;console.log(`PASS ${name}`);};
test('Real source has one course title, clean brand, four audiences and all ten unique modules',()=>{
  assert.ok(context);assert.equal(context.facts.filter(f=>f.kind==='curriculum').length,10);
  assert.equal(context.facts.filter(f=>f.kind==='audience').length,4);
  assert.doesNotMatch(source.title,/CHUYÊN SÂU.*CHUYÊN SÂU/i);assert.equal(source.brand,'Đào Tạo SEO Digi');
  assert.ok(source.text.length<=32000);assert.ok(brief.curriculum.includes('Tổng kết')||brief.curriculum.includes('Tổng kết'));
});
test('Duplicate mobile content is removed and inline fragments form complete paragraphs',()=>{
  const html=fixture.replace('</main>',`<h2>Thông tin đăng ký</h2><p>Gửi thông tin qua biểu mẫu để xác nhận học phí và lịch học.</p><p>Học <strong>SEO</strong> theo lộ trình.</p></main>`);
  const extracted=extractTemplateUrlSource(html,source.sourceUrl,source.finalUrl);
  assert.equal(extracted.text.split('Gửi thông tin qua biểu mẫu để xác nhận học phí và lịch học.').length-1,1);
  assert.ok(extracted.text.includes('Học SEO theo lộ trình.'));
});
test('Editorial journey gives duplicate block types different duties without moving blocks',()=>{
  const plan=planTemplateContent(slots,brief);
  const benefits=slots.filter(s=>s.blockType==='Benefits'&&s.field==='headline');
  assert.deepEqual(benefits.map(editorialRole),['problem','benefit']);
  assert.match(plan.find(p=>p.blockId===benefits[0]!.blockId)!.question,/khó khăn/);
  assert.ok(new Set(plan.map(p=>p.blockId)).size===plan.length);
});
const selected=proposals.filter(p=>p.status==='ready'||p.action==='hide').map(p=>p.slotId);
const applied=applyTemplateContent(spec,spec,proposals,selected,[]);
test('All curriculum modules fit existing cards with complete copy, distinct headings and no unrelated demo',()=>{
  assert.deepEqual(applied.conflicts,[]);
  const corpus=proposals.filter(p=>slots.find(s=>s.id===p.slotId)?.blockType==='Features').map(p=>p.text||'').join(' ');
  for(const fact of context.facts.filter(f=>f.kind==='curriculum'))assert.ok(corpus.includes(fact.title),fact.title);
  for(const p of proposals.filter(p=>p.status==='ready'&&p.text))assert.ok(p.text!.length<=slots.find(s=>s.id===p.slotId)!.maxLength);
  assert.doesNotMatch(proposals.map(p=>p.text||'').join(' '),/Studio Sáng tạo|Trao đổi dự án|Lợi ích sản phẩm|chiến lược thương hiệu/i);
  assert.equal(applied.spec.blocks.length,spec.blocks.length);assert.deepEqual(applied.spec.themeTokens,spec.themeTokens);
});
test('Missing sensitive sections are proposed for hiding; source never invents amounts, dates or promises',()=>{
  for(const type of ['Pricing','Guarantee']){const b=spec.blocks.find(b=>b.type===type);if(b)assert.equal(applied.spec.blocks.find(x=>x.id===b.id)!.hidden,true);}
  const fact=context.facts.find(f=>f.kind==='curriculum')!,slot=slots.find(s=>s.blockType==='Hero'&&s.field==='headline')!;
  for(const text of ['Cam kết lên top sau 7 ngày','Học phí chỉ 999.000 đồng','Nhận chứng chỉ ngay','Ưu đãi duy nhất hôm nay','Thu nhập 30 triệu mỗi tháng'])assert.equal(validateEditorialText(text,slot,brief,[fact.id]),false,text);
});
test('Fact IDs permit natural editorial paraphrases and reject fabricated references or skipped modules',()=>{
  const slot=slots.find(s=>s.blockType==='Features'&&s.field==='description')!;
  slot.editorialFactIds=editorialFactIdsFor(slot,slots,brief);
  const fact=context.facts.find(f=>f.id===slot.editorialFactIds![0])!;
  assert.equal(validateEditorialText('Nội dung học SEO theo chương trình.',slot,brief,['fabricated']),false);
  if(slot.editorialFactIds.length>1)assert.equal(validateEditorialText(fact.title,slot,brief,[fact.id]),false);
  if(slot.editorialFactIds.length>1)assert.equal(validateEditorialText('Học nguyên lý hoạt động của Google và website.',slot,brief,slot.editorialFactIds),false,'citing all modules does not excuse omitting them from the actual copy');
});
test('Long copy is rewritten or marked missing instead of cut at an arbitrary offset; persisted labels retain design',()=>{
  assert.equal(completeCopy('Câu ngắn. '+ 'Một câu rất dài chưa có dấu kết thúc '.repeat(30),30),'Câu ngắn.');
  assert.equal(completeCopy('Một câu rất dài chưa có dấu kết thúc '.repeat(30),30),'');
  const saved=sanitizeLandingPagePersistSpec(applied.spec);
  const block=saved.blocks.find(b=>b.type==='Features')!;assert.equal(block.eyebrow,'CHƯƠNG TRÌNH HỌC');
});
console.log(JSON.stringify({passed:true,checks,actualSource:fs.existsSync(actualPath),facts:context.facts.length,modules:context.facts.filter(f=>f.kind==='curriculum').length,sourceChars:source.text.length}));
