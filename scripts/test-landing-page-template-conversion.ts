import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LANDING_PAGE_SYSTEM_TEMPLATES } from '../packages/shared/src/landing-page-templates';
import { collectTemplateContentSlots, fallbackTemplateContent, applyTemplateContent, validateTemplateContentProposals, protectedTemplateSlotIds } from '../packages/shared/src/landing-page-template-content';
import { reviewTemplateContent } from '../packages/shared/src/landing-page-template-content-review';
import { isGenericTemplateHeading } from '../packages/shared/src/landing-page-template-copy-quality';
import { extractTemplateUrlSource, templateUrlBrief } from '../packages/shared/src/landing-page-template-url';
import { buildEditorialContext, validateEditorialText } from '../packages/shared/src/landing-page-template-editorial';
import { LP_CONVERSION_TYPOGRAPHY_CSS } from '../apps/web/src/components/landing-pages/landing-page-responsive-foundation';

let checks = 0;
const test = (name: string, run: () => void) => { run(); checks++; console.log(`PASS ${name}`); };
const spec = structuredClone(LANDING_PAGE_SYSTEM_TEMPLATES.find(t => t.slug === 'agency-portfolio-cream-editorial')!.spec);
spec.blocks.push({ id: 'unrelated-launch', type: 'Countdown', enabled: true, headline: 'Đếm ngược đến ngày ra mắt Aibeego', endsAt: '2037-01-01T00:00:00Z' } as any);
const source = extractTemplateUrlSource('<main><h1>Khóa học SEO thực chiến</h1><h2>Chương trình học</h2><h3>Nghiên cứu từ khóa</h3><p>Nhóm từ khóa theo mục tiêu nội dung.</p><h3>SEO Onpage</h3><p>Thực hành SEO Onpage trên website.</p><h3>Technical SEO</h3><p>Đọc dữ liệu website.</p><h2>Phương pháp đào tạo</h2><h3>Thực hành trên website</h3><p>Thực hành trên website học viên.</p><h2>Ai nên tham gia?</h2><ul><li>Người làm marketing</li><li>Chủ doanh nghiệp</li></ul></main>', 'https://example.com/', 'https://example.com/');
const brief = { ...templateUrlBrief(source), sourceText: source.text, sourceContext: buildEditorialContext(source), brandName: 'SEO Digi', goal: 'consult' as const, imageIds: [], originalPrice: '5000000', salePrice: '2500000' };
assert.ok(brief.sourceContext);
const slots = collectTemplateContentSlots(spec), proposals = fallbackTemplateContent(slots, brief);
const applied = applyTemplateContent(spec, spec, proposals, proposals.filter(p => p.status === 'ready' || (p.status === 'missing' && p.action === 'hide')).map(p => p.slotId), []).spec;

test('A confirmed offer cannot revive an unrelated launch or leave extra demo pricing cards', () => {
  assert.equal(applied.blocks.find(b => b.id === 'unrelated-launch')!.hidden, true);
  const pricing = applied.blocks.find(b => b.type === 'Pricing') as any;
  assert.ok(!pricing.hidden);
  assert.equal(pricing.plans.filter((p: any) => !applied.meta?.elementHidden?.[`${pricing.id}::item:${p.id}`]).length, 1);
});
test('AI generic headings are rejected in source and manual brief modes', () => {
  const slot = slots.find(s => s.blockType === 'Hero' && s.field === 'headline')!;
  for (const text of ['Lợi ích sản phẩm', 'Ảnh sản phẩm', 'Đặc điểm sản phẩm', 'Tìm hiểu thêm về sản phẩm']) {
    for (const input of [brief, { ...brief, sourceContext: undefined, sourceText: undefined }]) {
      const result = validateTemplateContentProposals({ proposals: [{ slotId: slot.id, text }] }, [slot], input)[0];
      assert.equal(result.validationIssue, 'AI_GENERIC_HEADING');
      assert.ok(!isGenericTemplateHeading(result.text || ''));
    }
  }
});
test('Unattributed legacy placeholder headings can be replaced, while explicit user edits stay protected', () => {
  const copy = structuredClone(spec), b = copy.blocks.find(b => b.type === 'Benefits') as any;
  b.headline = 'Lợi ích sản phẩm';
  assert.ok(!protectedTemplateSlotIds(copy).includes(`${b.id}::headline`));
  copy.meta = { ...copy.meta, fieldSources: { [`${b.id}.headline`]: 'user' } };
  assert.ok(protectedTemplateSlotIds(copy).includes(`${b.id}::headline`));
  copy.meta.fieldSources = {};
  b.headline = 'Nội dung riêng do tôi biên tập';
  assert.ok(protectedTemplateSlotIds(copy).includes(`${b.id}::headline`));
});
test('Preview checks actual surviving headings, including partial selections and repeated sections', () => {
  const dirty = structuredClone(applied);
  const blocks = dirty.blocks.filter(b => !b.hidden && ['Hero', 'CTA'].includes(b.type)) as any[];
  blocks[0].headline = 'Lợi ích sản phẩm'; blocks[1].headline = 'Lợi ích sản phẩm';
  const issues = reviewTemplateContent(dirty, slots, proposals);
  assert.ok(issues.some(i => i.kind === 'generic-heading'));
  assert.ok(issues.some(i => i.kind === 'duplicate-heading'));
  assert.ok(issues.some(i => i.kind === 'unapplied-heading'));
  blocks[1].hidden = true;
  assert.ok(!reviewTemplateContent(dirty, slots, proposals).some(i => i.kind === 'duplicate-heading'));
});
test('Applied visible section headings communicate specific roles and CTA headings differ', () => {
  for (const b of applied.blocks as any[]) if (!b.hidden && b.headline) assert.ok(!isGenericTemplateHeading(b.headline), b.headline);
  const titles = applied.blocks.filter(b => !b.hidden && b.type === 'CTA').map((b: any) => b.headline);
  assert.equal(new Set(titles).size, titles.length);
});
test('Consultation CTAs describe the next step; discount offers do not turn them into purchases', () => {
  const submit = slots.find(s=>s.blockType==='LeadForm'&&s.field==='submitLabel')!;
  const hero = slots.find(s=>s.blockType==='Hero'&&s.role==='cta')!;
  const consult = fallbackTemplateContent(slots,brief);
  assert.equal(consult.find(p=>p.slotId===submit.id)?.text,'Gửi yêu cầu tư vấn ngay');
  assert.equal(consult.find(p=>p.slotId===hero.id)?.text,'Nhận tư vấn lộ trình học');
  const sales = fallbackTemplateContent(slots,{...brief,goal:'sales'});
  assert.match(sales.find(p=>p.slotId===submit.id)!.text!,/Đăng ký ngay.*50%/);
  const phoneSlots=slots.map(s=>s.id===hero.id?{...s,actionType:'phone' as const}:s);
  assert.equal(fallbackTemplateContent(phoneSlots,brief).find(p=>p.slotId===hero.id)?.text,'Gọi để trao đổi');
  const offerTitle=consult.find(p=>slots.find(s=>s.id===p.slotId)?.blockType==='Countdown'&&slots.find(s=>s.id===p.slotId)?.field==='headline');
  assert.doesNotMatch(offerTitle?.text||'',/hôm nay|sắp hết|chỉ còn/i);
});
test('Free material mentioned on a source page cannot become an unconfirmed enrollment promise', () => {
  const input=structuredClone(brief), slot=slots.find(s=>s.blockType==='Hero'&&s.field==='trustPoints.1')!;
  input.sourceContext!.facts.push({id:'free-resource',kind:'overview',title:'Tài liệu SEO miễn phí',text:'Tài liệu SEO miễn phí trên website.'});
  assert.equal(validateEditorialText('Tài liệu học miễn phí, dễ tiếp cận và thực hành ngay.',slot,input,['free-resource']),false);
});
test('Hierarchy is scoped to generated copy with simulated mobile/tablet sizes and user-size exceptions', () => {
  assert.match(LP_CONVERSION_TYPOGRAPHY_CSS, /--lp-copy-h1: 2rem/);
  assert.match(LP_CONVERSION_TYPOGRAPHY_CSS, /--lp-copy-h2: 1\.5rem/);
  assert.match(LP_CONVERSION_TYPOGRAPHY_CSS, /not\(\[style\*="font-size"\]\)/);
  assert.match(LP_CONVERSION_TYPOGRAPHY_CSS, /not\(\[data-lp-size-accepted="1"\] \*\)/);
  const renderer = fs.readFileSync('apps/web/src/components/landing-pages/landing-page-renderer.tsx', 'utf8');
  assert.ok(renderer.includes('scopeLegacyLandingPageCss(LP_RESPONSIVE_FOUNDATION_CSS) + LP_CONVERSION_TYPOGRAPHY_CSS'));
  const dialog = fs.readFileSync('apps/web/src/components/landing-pages/landing-page-template-content-dialog.tsx', 'utf8');
  assert.doesNotMatch(dialog, /filter\(issue => issue.kind !== 'unapplied-heading'\)/);
});
console.log(JSON.stringify({ passed: true, checks, database: 'none', provider: 'none' }));
