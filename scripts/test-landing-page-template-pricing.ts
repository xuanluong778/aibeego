import assert from 'node:assert/strict';
import {
  collectTemplateContentSlots, normalizeTemplateContentBrief, fallbackTemplateContent,
  applyTemplateContent, validateTemplateContentProposals, protectedTemplateSlotIds,
} from '../packages/shared/src/landing-page-template-content';
import { parseTemplateVnd, templatePriceOffer } from '../packages/shared/src/landing-page-template-pricing';
import { LANDING_PAGE_SYSTEM_TEMPLATES } from '../packages/shared/src/landing-page-templates';
import { sanitizeLandingPagePersistSpec, validateLandingPageSpec } from '../packages/shared/src/landing-page-lifecycle';
import type { LandingPageCountdownBlock } from '../packages/shared/src/landing-page-types';

let checks = 0;
const test = (name: string, run: () => void) => { run(); checks++; console.log(`PASS ${name}`); };
const spec = structuredClone(LANDING_PAGE_SYSTEM_TEMPLATES.find(t => t.slug === 'agency-portfolio-cream-editorial')!.spec);
if (!spec.blocks.some(b => b.type === 'Countdown')) spec.blocks.splice(2, 0, {
  id: 'offer-countdown', type: 'Countdown', enabled: true, endsAt: '2037-01-01T00:00:00+07:00', headline: 'Đếm ngược mẫu', expireBehavior: 'zero',
} as LandingPageCountdownBlock);
const slots = collectTemplateContentSlots(spec);
const priceSlots = slots.filter(s => s.blockType === 'Pricing' && s.field === 'price');
const target = priceSlots[1] || priceSlots[0]!;
const brief = normalizeTemplateContentBrief({
  productName: 'Khóa học SEO Digi', brandName: 'Digi', description: 'Thực hành trên website\nNghiên cứu từ khóa', targetCustomer: 'Người học SEO',
  goal: 'consult', imageIds: [], originalPrice: '10.000.000', salePrice: '4000000', pricingTargetId: target.id,
});
const proposals = fallbackTemplateContent(slots, brief);
const selected = proposals.filter(p => p.status === 'ready' || (p.status === 'missing' && p.action === 'hide')).map(p => p.slotId);
const applied = applyTemplateContent(spec, spec, proposals, selected, []);

test('VND inputs normalize common grouping and derive the exact 60% discount', () => {
  for (const value of ['10000000', '10.000.000', '10,000,000', '10 000 000', '10.000.000 ₫']) assert.equal(parseTemplateVnd(value), 10000000);
  const offer = templatePriceOffer(brief)!;
  assert.equal(offer.percentLabel, '60%'); assert.equal(offer.priceLabel, '4.000.000 ₫');
  assert.equal(brief.originalPrice, '10000000'); assert.equal(brief.salePrice, '4000000');
});
test('Bad, negative, ambiguous and unsafe values are rejected on the shared API/UI boundary', () => {
  for (const value of ['-100', '0', '1e7', '10.50', '10,000.000', '1000000000000000', '<b>4000000</b>']) assert.throws(() => parseTemplateVnd(value), value);
  for (const raw of [{ originalPrice: '', salePrice: '4' }, { originalPrice: '4', salePrice: '4' }, { originalPrice: '4', salePrice: '5' }]) assert.throws(() => normalizeTemplateContentBrief({ ...brief, ...raw }));
  assert.throws(() => normalizeTemplateContentBrief({ ...brief, schedule: '2020-01-01T00:00:00Z' }));
});
test('The selected stable price-box ID gets prices and product copy; other boxes are offered for hiding', () => {
  assert.deepEqual(applied.conflicts, []);
  const block = applied.spec.blocks.find(b => b.id === target.blockId) as any;
  const plan = block.plans.find((p: any) => p.id === target.itemId);
  assert.equal(plan.name, brief.productName); assert.equal(plan.price, '4.000.000 ₫'); assert.equal(plan.originalPrice, '10.000.000 ₫');
  assert.equal(plan.period, ''); assert.doesNotMatch(plan.features.join(' '), /Định vị|thông điệp|hình ảnh/);
  assert.ok(!block.hidden);
  for (const other of block.plans.filter((p: any) => p.id !== target.itemId)) assert.equal(applied.spec.meta?.elementHidden?.[`${block.id}::item:${other.id}`], true);
  const reordered = structuredClone(spec); (reordered.blocks.find(b => b.id === target.blockId) as any).plans.reverse();
  const changed = applyTemplateContent(reordered, spec, proposals, selected, []);
  assert.equal((changed.spec.blocks.find(b => b.id === target.blockId) as any).plans.find((p: any) => p.id === target.itemId).price, '4.000.000 ₫');
});
test('Generating offer copy preserves the existing countdown and deadline when the new deadline is blank', () => {
  const before = spec.blocks.find(b => b.type === 'Countdown') as any;
  const after = applied.spec.blocks.find(b => b.id === before.id) as any;
  assert.equal(after.clockMode, before.clockMode); assert.equal(after.endsAt, before.endsAt);
  assert.equal(after.price, '4.000.000 ₫'); assert.equal(after.originalPrice, '10.000.000 ₫');
  assert.match(after.headline, /Học phí ưu đãi.*60%/); assert.equal(after.ctaLabel, 'Tư vấn học phí và lịch học');
  assert.ok(!after.hidden);
});

test('An explicit offer-only mode stays off and an expired timer is never extended by AI', () => {
  for (const mode of ['offer','timer'] as const) {
    const copy=structuredClone(spec),b=copy.blocks.find(b=>b.type==='Countdown') as any;
    b.clockMode=mode;b.endsAt='2020-01-01T00:00:00Z';
    const ownSlots=collectTemplateContentSlots(copy),rows=fallbackTemplateContent(ownSlots,brief);
    const result=applyTemplateContent(copy,copy,rows,rows.filter(p=>p.status==='ready'||(p.status==='missing'&&p.action==='hide')).map(p=>p.slotId),[]).spec;
    const after=result.blocks.find(x=>x.id===b.id) as any;
    assert.equal(after.clockMode,mode);assert.equal(after.endsAt,b.endsAt);
  }
});
test('An explicit future deadline enables the timer and survives autosave/reload', () => {
  const dated = { ...brief, schedule: '2037-02-03T19:00:00+07:00' };
  const copy = fallbackTemplateContent(slots, dated);
  const saved = sanitizeLandingPagePersistSpec(applyTemplateContent(spec, spec, copy, copy.filter(p => p.status === 'ready' || p.action === 'hide').map(p => p.slotId), []).spec);
  const countdown = saved.blocks.find(b => b.type === 'Countdown') as any;
  assert.equal(countdown.clockMode, 'timer'); assert.equal(countdown.endsAt, dated.schedule);
  assert.equal(countdown.price, '4.000.000 ₫'); assert.equal(countdown.originalPrice, '10.000.000 ₫');
  assert.ok(validateLandingPageSpec(saved).ok);
  assert.deepEqual(sanitizeLandingPagePersistSpec(JSON.parse(JSON.stringify(saved))), saved);
});
test('Updating only one financial field never commits a mismatched price pair', () => {
  const result = applyTemplateContent(spec, spec, proposals, [target.id], []);
  assert.ok(result.conflicts.includes(target.id)); assert.deepEqual(result.spec, spec); assert.deepEqual(result.applied, []);
});
test('Removing the discount clears the old compare-at price instead of retaining a false discount', () => {
  const nextSlots = collectTemplateContentSlots(applied.spec);
  const copy = fallbackTemplateContent(nextSlots, { ...brief, originalPrice: '8000000', salePrice: '' });
  const outcome = applyTemplateContent(applied.spec, applied.spec, copy, copy.filter(p => p.status === 'ready' || (p.status === 'missing' && p.action === 'hide')).map(p => p.slotId), []);
  assert.deepEqual(outcome.conflicts, []);
  const plan = (outcome.spec.blocks.find(b => b.id === target.blockId) as any).plans.find((p: any) => p.id === target.itemId);
  assert.equal(plan.price, '8.000.000 ₫'); assert.equal(plan.originalPrice, '');
  assert.equal(templatePriceOffer({ originalPrice: '8000000' })!.percentLabel, '');
});
test('AI output cannot change user-entered prices, promotion percentages or offer copy', () => {
  const controlled = proposals.filter(p => p.priceControlled && p.status === 'ready' && !p.action).map(p => slots.find(s => s.id === p.slotId)!);
  const validated = validateTemplateContentProposals({ proposals: controlled.map(s => ({ slotId: s.id, text: 'GIẢM 99% — 1.000 ₫', status: 'ready' })) }, slots, brief);
  for (const slot of controlled) assert.notEqual(validated.find(p => p.slotId === slot.id)?.text, 'GIẢM 99% — 1.000 ₫');
  assert.equal(validated.find(p => p.slotId === target.id)?.text, '4.000.000 ₫');
});
test('Previously hidden price and countdown blocks can be explicitly shown with the confirmed offer', () => {
  const hidden = structuredClone(applied.spec);
  for (const b of hidden.blocks) if (['Pricing', 'Countdown'].includes(b.type)) b.hidden = true;
  const hiddenSlots = collectTemplateContentSlots(hidden, true), copy = fallbackTemplateContent(hiddenSlots, brief);
  assert.ok(copy.some(p => p.action === 'show'));
  const result = applyTemplateContent(hidden, hidden, copy, copy.filter(p => p.status === 'ready' || (p.status === 'missing' && p.action === 'hide')).map(p => p.slotId), []);
  assert.deepEqual(result.conflicts, []);
  assert.ok(!result.spec.blocks.find(b => b.id === target.blockId)!.hidden);
  assert.ok(!result.spec.blocks.find(b => b.type === 'Countdown')!.hidden);
});
test('Locked prices and manually edited prices stay protected', () => {
  const locked = structuredClone(spec);
  locked.meta = { ...locked.meta, elementLocked: { [`${target.blockId}::planOriginalPrice:${target.itemId}`]: true } };
  const lockedSlots = collectTemplateContentSlots(locked), copy = fallbackTemplateContent(lockedSlots, brief);
  assert.equal(copy.find(p => p.slotId === target.id)?.status, 'missing');
  const manual = structuredClone(spec); manual.meta = { ...manual.meta, fieldSources: { [`${target.blockId}.plans.${target.itemId}.price`]: 'user' } };
  assert.ok(protectedTemplateSlotIds(manual, spec).includes(target.id));
});
test('Percentages never round a paid product up to a misleading 100% discount', () => {
  assert.equal(templatePriceOffer({ originalPrice: '1000000', salePrice: '1' })!.percentLabel, '99,99%');
  assert.equal(templatePriceOffer({ originalPrice: '1000000', salePrice: '999999' })!.percentLabel, '');
});
console.log(JSON.stringify({ passed: true, checks, database: 'none', provider: 'none' }));
