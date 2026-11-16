import assert from 'node:assert/strict';
import fs from 'node:fs';
import { sourceSections, buildEditorialContext, validateEditorialText } from '../packages/shared/src/landing-page-template-editorial';
import { extractTemplateUrlSource, templateUrlBrief } from '../packages/shared/src/landing-page-template-url';
import { applyTemplateContent, collectTemplateContentSlots, fallbackTemplateContent, reviewTemplateContent } from '../packages/shared/src/landing-page-template-content';
import { LANDING_PAGE_SYSTEM_TEMPLATES } from '../packages/shared/src/landing-page-templates';

let checks = 0;
function test(name: string, run: () => void) { run(); checks++; console.log(`PASS ${name}`); }
const spec = structuredClone(LANDING_PAGE_SYSTEM_TEMPLATES.find(t => t.slug === 'agency-portfolio-cream-editorial')!.spec);
const slots = collectTemplateContentSlots(spec);
const brief = { productName: 'Khóa học thiết kế', brandName: 'Xưởng Học', description: 'Đào tạo thiết kế với giáo trình cụ thể.', targetCustomer: 'Người mới', goal: 'consult' as const, imageIds: [] };
const base = fallbackTemplateContent(slots, brief);

test('Partial selection identifies remaining sample headings and unconfirmed visible sections', () => {
  const partial = applyTemplateContent(spec, spec, base, [], []);
  const issues = reviewTemplateContent(partial.spec, slots, base);
  assert.ok(issues.some(i => i.kind === 'unapplied-heading' && i.blockId === spec.blocks.find(b => b.type === 'Hero')!.id));
  assert.ok(issues.some(i => i.kind === 'pending-hide' && i.blockId === spec.blocks.find(b => b.type === 'Pricing')!.id));
  assert.deepEqual(partial.spec, spec);
});
test('Reviewed hides remove child warnings; locked sections stay visible and remain reviewable', () => {
  const selected = base.filter(p => p.status === 'ready' || (p.status === 'missing' && p.action === 'hide')).map(p => p.slotId);
  const applied = applyTemplateContent(spec, spec, base, selected, []);
  assert.deepEqual(applied.conflicts, []);
  const issues = reviewTemplateContent(applied.spec, slots, base);
  assert.ok(!issues.some(i => i.kind === 'pending-hide'));
  const locked = structuredClone(spec);
  locked.blocks.find(b => b.type === 'Pricing')!.locked = true;
  const lockedSlots = collectTemplateContentSlots(locked);
  const lockedBase = fallbackTemplateContent(lockedSlots, brief);
  const result = applyTemplateContent(locked, locked, lockedBase, selected, []);
  assert.ok(!result.spec.blocks.find(b => b.type === 'Pricing')!.hidden);
  assert.ok(reviewTemplateContent(result.spec, lockedSlots, lockedBase).some(i => i.blockId === locked.blocks.find(b => b.type === 'Pricing')!.id));
});
test('An edited proposal is reflected in actual preview and does not trigger a stale-heading warning', () => {
  const hero = slots.find(s => s.blockType === 'Hero' && s.field === 'headline')!;
  const p = [{ slotId: hero.id, text: 'Khám phá khóa học thiết kế', status: 'ready' as const, source: 'user' as const }];
  const applied = applyTemplateContent(spec, spec, p, [hero.id], []);
  assert.deepEqual(reviewTemplateContent(applied.spec, [hero], p), []);
});
test('Structured and plain source budgets match, even with many long sections', () => {
  const entries = Array.from({ length: 100 }, (_, i) => [
    { tag: 'h2', text: `Phần ${i}`, order: i * 2 },
    { tag: 'p', text: 'Nội dung nguồn hữu ích. '.repeat(400), order: i * 2 + 1 },
  ]).flat();
  const result = sourceSections(entries);
  assert.ok(result.text.length <= 32000);
  assert.ok(result.sections.every(s => s.paragraphs.every(p => result.text.includes(p))));
  assert.ok(JSON.stringify(result.sections).length < 50000);
});
const source = extractTemplateUrlSource(`<main><h1>Khóa học Thiết kế đồ họa</h1><p>Chương trình đào tạo thiết kế dành cho người mới, có nội dung rõ ràng để tìm hiểu trước khi học.</p><h2>Đối tượng phù hợp với ai?</h2><p>Người mới bắt đầu</p><p>Nhân viên thiết kế</p><h2>Chương trình học</h2><h3>Màu sắc và bố cục</h3><p>Phân tích màu sắc và cách sắp xếp bố cục.</p><h3>Thiết kế chữ</h3><p>Tìm hiểu chữ trong thiết kế.</p><h3>Đồ án cuối khóa</h3><p>Hệ thống kiến thức qua đồ án thiết kế.</p><h2>Phương pháp học</h2><p>Trao đổi nội dung theo từng học phần thiết kế.</p></main>`, 'https://course.test', 'https://course.test');
test('Non-SEO courses get structured editorial without injected Google, website or SEO copy', () => {
  const context = buildEditorialContext(source)!;
  assert.ok(context);
  assert.equal(context.topic, 'Thiết kế đồ họa');
  const courseBrief = { ...brief, ...templateUrlBrief(source), brandName: 'Xưởng Học', sourceContext: context };
  const proposals = fallbackTemplateContent(slots, courseBrief);
  assert.doesNotMatch(proposals.map(p => p.text || '').join(' '), /\bSEO\b|Google|GA4|website/i);
  const selected = proposals.filter(p => p.status === 'ready' || (p.status === 'missing' && p.action === 'hide')).map(p => p.slotId);
  const applied = applyTemplateContent(spec, spec, proposals, selected, []).spec;
  const curriculum = applied.blocks.find(b => b.type === 'Features') as any;
  assert.ok(!curriculum.hidden, 'a spare card must not hide the entire valid curriculum');
  const visible = curriculum.items.filter((item: any) => !applied.meta?.elementHidden?.[`${curriculum.id}::item:${item.id}`]);
  assert.equal(visible.length, 3);
  assert.equal(new Set(visible.map((item: any) => item.title)).size, 3);
});
test('Fact references do not authorize unrelated percentages, free tuition or numeric claims', () => {
  const context = { kind: 'course' as const, topic: 'SEO', brand: 'Digi', facts: [{ id: 'f1', kind: 'benefit' as const, title: 'Thực hành SEO', text: 'Bài tập 80 giúp tìm hiểu SEO trên website.' }] };
  const hero = slots.find(s => s.blockType === 'Hero' && s.field === 'headline')!;
  const withSource = { ...brief, sourceContext: context };
  for (const text of ['Thực hành SEO 80%', 'Học SEO miễn phí', 'Học SEO 80 buổi']) assert.equal(validateEditorialText(text, hero, withSource, ['f1']), false, text);
  assert.equal(validateEditorialText('Thực hành SEO trên website', hero, withSource, ['f1']), true);
});
test('Generic fallback never turns a long fragment into an unfinished sentence', () => {
  const hero = slots.find(s => s.blockType === 'Hero' && s.field === 'subheadline')!;
  const proposals = fallbackTemplateContent([hero], { ...brief, sourceText: 'Nguồn', description: 'Một đoạn nội dung chưa có điểm kết thúc '.repeat(40) });
  assert.equal(proposals[0]!.status, 'missing');
});
if (fs.existsSync('.tmp/lp-seo-editorial/source.html')) test('The SEO source keeps its complete curriculum visible after the actual full-review selection', () => {
  const file = '.tmp/lp-seo-editorial/source.html';
  const seoSource = extractTemplateUrlSource(fs.readFileSync(file, 'utf8'), 'https://daotaoseodigi.com/', 'https://daotaoseodigi.com/');
  const context = buildEditorialContext(seoSource)!;
  const seoBrief = { ...brief, ...templateUrlBrief(seoSource), sourceContext: context };
  const proposals = fallbackTemplateContent(slots, seoBrief);
  const selected = proposals.filter(p => p.status === 'ready' || (p.status === 'missing' && p.action === 'hide')).map(p => p.slotId);
  const applied = applyTemplateContent(spec, spec, proposals, selected, []).spec;
  const curriculum = applied.blocks.find(b => b.type === 'Features') as any;
  assert.ok(!curriculum.hidden);
  const visibleCopy = curriculum.items.filter((item: any) => !applied.meta?.elementHidden?.[`${curriculum.id}::item:${item.id}`])
    .map((item: any) => `${item.title} ${item.description}`).join(' ');
  for (const fact of context.facts.filter(f => f.kind === 'curriculum')) assert.ok(visibleCopy.includes(fact.title), fact.title);
});
else console.log('SKIP real-source curriculum visibility: local source snapshot not available');
console.log(JSON.stringify({ passed: true, checks, database: 'none', provider: 'none' }));
