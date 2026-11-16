import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LANDING_PAGE_SYSTEM_TEMPLATES } from '../packages/shared/src/landing-page-templates';
import { sanitizeLandingPagePersistSpec } from '../packages/shared/src/landing-page-lifecycle';
import {
  applyTemplateContent,
  collectTemplateContentSlots,
  fallbackTemplateContent,
  isGroundedTemplateText,
  normalizeTemplateContentBrief,
  planTemplateContent,
  protectedTemplateSlotIds,
  templateContentActionLabel,
  validateTemplateContentProposals,
} from '../packages/shared/src/landing-page-template-content';
import type { LandingPageSpec } from '../packages/shared/src/landing-page-types';

const fixturePath = process.env.LP_SEO_FIXTURE || '.tmp/lp-content-v2/seo-page.json';
// Real local regression snapshot is optional; CI can run on the same catalog layout.
const actual = (
  fs.existsSync(fixturePath)
    ? JSON.parse(fs.readFileSync(fixturePath, 'utf8')).draftSpec
    : LANDING_PAGE_SYSTEM_TEMPLATES.find((t) => t.slug === 'agency-portfolio-cream-editorial')!.spec
) as LandingPageSpec;
const product = LANDING_PAGE_SYSTEM_TEMPLATES.find((t) => t.slug === 'product-launch')!.spec;
export const seoBrief = normalizeTemplateContentBrief({
  productName: 'Đào tạo SEO',
  brandName: 'Thế giới digi',
  description: 'Đào tạo SEO theo nhu cầu tìm hiểu của người học.',
  targetCustomer: 'Người đang tìm hiểu SEO',
  goal: 'consult',
  imageIds: ['owned-seo'],
  primaryImageId: 'owned-seo',
});
const images = [
  { id: 'owned-seo', url: '/uploads/public/landing-pages/qa/seo.png', name: 'Ảnh SEO đã chọn' },
];
let checks = 0;
const test = (name: string, fn: () => void) => {
  fn();
  checks++;
  console.log(`PASS ${name}`);
};

for (const [name, base, brief] of [
  ['seo-actual-page', actual, seoBrief],
  [
    'product',
    product,
    {
      ...seoBrief,
      productName: 'Bình 500 ml',
      brandName: 'An Nhiên',
      description: 'Dung tích 500 ml\nCó nắp khóa',
      targetCustomer: 'Nhân viên văn phòng',
      goal: 'sales' as const,
    },
  ],
] as const) {
  const slots = collectTemplateContentSlots(base),
    proposals = fallbackTemplateContent(slots, brief);
  const selected = proposals
    .filter((p) => p.status === 'ready' || (p.status === 'missing' && p.action === 'hide'))
    .map((p) => p.slotId);
  const outcome = applyTemplateContent(base, base, proposals, selected, images);
  test(`${name}: collection covers SEO, alt, FAQ, forms, arrays, price and schedule targets`, () => {
    assert.ok(slots.some((s) => s.field === 'seo.title'));
    assert.ok(slots.some((s) => s.field === 'imageStyle.alt'));
    const form = base.blocks.find((b) => b.type === 'LeadForm')!;
    assert.ok(
      slots.some(
        (s) => s.blockId === form.id && s.field === 'submitLabel' && s.actionType === 'submit',
      ),
    );
    for (const b of base.blocks)
      if (b.type === 'FAQ')
        for (const item of b.items)
          assert.ok(slots.some((s) => s.itemId === item.id && s.field === 'answer'));
    assert.equal(new Set(slots.map((s) => s.id)).size, slots.length);
  });
  test(`${name}: proposals are complete and preserve layout, form configuration and destinations`, () => {
    assert.deepEqual(outcome.conflicts, []);
    assert.ok(outcome.applied.length > 30);
    assert.deepEqual(outcome.spec.themeTokens, base.themeTokens);
    assert.equal(outcome.spec.blocks.length, base.blocks.length);
    for (const before of base.blocks as any[]) {
      const after = outcome.spec.blocks.find((b) => b.id === before.id) as any;
      for (const key of [
        'style',
        'responsiveStyle',
        'freeLayout',
        'responsiveFreeLayout',
        'spacing',
        'variant',
        'ctaUrl',
        'crm',
        'formTheme',
        'expireBehavior',
        'expireCtaUrl',
      ])
        assert.deepEqual(after[key], before[key], key);
      for (const key of ['items', 'plans', 'fields'])
        if (before[key])
          assert.deepEqual(
            after[key].map((item: any) => item.id),
            before[key].map((item: any) => item.id),
          );
      if (before.fields)
        for (const field of before.fields) {
          const afterField = after.fields.find((f: any) => f.id === field.id);
          for (const key of ['name', 'fieldType', 'required', 'options'])
            assert.deepEqual(afterField[key], field[key]);
        }
      if (before.plans)
        for (const plan of before.plans)
          assert.equal(after.plans.find((p: any) => p.id === plan.id).ctaUrl, plan.ctaUrl);
    }
  });
  test(`${name}: preview uses exactly the same atomic operation as application`, () => {
    const clone = structuredClone(base);
    const preview = applyTemplateContent(clone, base, proposals, selected, images);
    assert.deepEqual(preview.spec, outcome.spec);
    assert.deepEqual(clone, base);
  });
  test(`${name}: one-block application does not change other blocks or SEO`, () => {
    const target = base.blocks.find((b) => b.type === 'Benefits')!;
    const partial = applyTemplateContent(
      base,
      base,
      proposals,
      selected.filter((id) => slots.find((s) => s.id === id)?.blockId === target.id),
      images,
    );
    for (const block of base.blocks.filter((b) => b.id !== target.id))
      assert.deepEqual(
        partial.spec.blocks.find((b) => b.id === block.id),
        block,
      );
    assert.deepEqual(partial.spec.seo, base.seo);
  });
  test(`${name}: autosave normalization retains approved metadata, alt and hidden state`, () => {
    const saved = sanitizeLandingPagePersistSpec(outcome.spec),
      reload = sanitizeLandingPagePersistSpec(JSON.parse(JSON.stringify(saved)));
    assert.deepEqual(reload, saved);
    assert.equal(saved.seo.title, outcome.spec.seo.title);
    assert.equal(saved.seo.metaDescription, outcome.spec.seo.metaDescription);
    assert.equal(
      saved.blocks.filter((b) => b.hidden).length,
      outcome.spec.blocks.filter((b) => b.hidden).length,
    );
    const hero = saved.blocks.find((b) => b.type === 'Hero') as any;
    assert.ok(hero.imageStyle.alt.includes(brief.productName));
  });
  test(`${name}: missing facts require explicit hiding approval`, () => {
    const ready = proposals.filter((p) => p.status === 'ready').map((p) => p.slotId);
    const withoutHide = applyTemplateContent(base, base, proposals, ready, images);
    assert.equal(
      withoutHide.spec.blocks.filter((b) => b.hidden).length,
      base.blocks.filter((b) => b.hidden).length,
    );
    assert.ok(outcome.spec.blocks.some((b) => b.type === 'Pricing' && b.hidden));
  });
  test(`${name}: locked content is never changed; concurrent edits cause no partial commit`, () => {
    const heroSlot = slots.find((s) => s.blockType === 'Hero' && s.field === 'headline')!;
    const edited = structuredClone(base);
    (edited.blocks.find((b) => b.id === heroSlot.blockId) as any).headline = 'Tiêu đề tôi vừa sửa';
    assert.ok(protectedTemplateSlotIds(edited, base).includes(heroSlot.id));
    const conflict = applyTemplateContent(edited, base, proposals, selected, images);
    assert.ok(conflict.conflicts.includes(heroSlot.id));
    assert.deepEqual(conflict.spec, edited);
    assert.deepEqual(conflict.applied, []);
    const approved = applyTemplateContent(edited, base, proposals, selected, images, {
      [heroSlot.id]: 'Tiêu đề tôi vừa sửa',
    });
    assert.deepEqual(approved.conflicts, []);
    edited.blocks.find((b) => b.id === heroSlot.blockId)!.locked = true;
    assert.equal(
      applyTemplateContent(edited, base, proposals, [heroSlot.id], images).applied.length,
      0,
    );
  });
  test(`${name}: patch identity survives item reorder and invalid IDs cannot write configuration`, () => {
    const slot = slots.find((s) => s.blockType === 'Benefits' && s.itemId && s.field === 'title')!;
    const moved = structuredClone(base),
      list = moved.blocks.find((b) => b.id === slot.blockId) as any;
    list.items.reverse();
    const changed = applyTemplateContent(moved, base, proposals, [slot.id], images);
    assert.equal(
      (changed.spec.blocks.find((b) => b.id === slot.blockId) as any).items.find(
        (i: any) => i.id === slot.itemId,
      ).title,
      proposals.find((p) => p.slotId === slot.id)?.text,
    );
    assert.deepEqual(
      applyTemplateContent(
        base,
        base,
        [{ slotId: `${slot.blockId}::ctaUrl`, text: 'javascript:bad', status: 'ready' }],
        [`${slot.blockId}::ctaUrl`],
        images,
      ).spec,
      base,
    );
  });
}
test('Actual SEO case has distinct questions, no remaining wrong-topic visible copy and no demo countdown after review', () => {
  const slots = collectTemplateContentSlots(actual),
    proposals = fallbackTemplateContent(slots, seoBrief),
    selected = proposals
      .filter((p) => p.status === 'ready' || (p.action === 'hide' && p.status === 'missing'))
      .map((p) => p.slotId);
  const applied = applyTemplateContent(actual, actual, proposals, selected, images).spec;
  const visible = applied.blocks.filter((b) => !b.hidden);
  const text = JSON.stringify(visible);
  for (const bad of [
    'chiến lược thương hiệu',
    'Định vị thương hiệu',
    'Hệ thống thông điệp',
    'Studio Sáng tạo',
    'Mốc demo',
    'Lợi ích sản phẩm',
    'Đặc điểm sản phẩm',
    'Trao đổi dự án',
  ])
    assert.ok(!text.includes(bad), bad);
  assert.ok(applied.blocks.some((b) => b.type === 'Countdown' && b.hidden));
  const benefits = visible.filter((b) => b.type === 'Benefits') as any[];
  assert.notEqual(benefits[0].headline, benefits[1].headline);
  assert.ok(applied.seo.title.includes('Đào tạo SEO'));
  assert.ok(applied.seo.metaDescription.includes('Thế giới digi'));
  assert.ok(planTemplateContent(slots, seoBrief).some((s) => s.question === 'Học gì?'));
});
test('Validator accepts natural paraphrases and exposes unsupported claims instead of requiring exact quotes', () => {
  const slots = collectTemplateContentSlots(actual);
  const slot = slots.find((s) => s.blockType === 'Benefits' && s.field === 'subheadline')!;
  const text = 'Tìm hiểu SEO từ nhu cầu và mục tiêu của bạn.';
  assert.equal(isGroundedTemplateText(text, seoBrief, slot), true);
  assert.equal(
    validateTemplateContentProposals(
      { proposals: [{ slotId: slot.id, text, status: 'ready' }] },
      slots,
      seoBrief,
    ).find((p) => p.slotId === slot.id)?.text,
    text,
  );
  const invalid = validateTemplateContentProposals(
    {
      proposals: [{ slotId: slot.id, text: 'Cam kết lên top Google sau 7 ngày', status: 'ready' }],
    },
    slots,
    seoBrief,
  ).find((p) => p.slotId === slot.id)!;
  assert.equal(invalid.validationIssue, 'AI_UNSUPPORTED_ASSERTION');
  assert.ok(!invalid.text?.includes('7 ngày'));
  assert.throws(() =>
    validateTemplateContentProposals(
      { proposals: [{ slotId: 'invented', text }] },
      slots,
      seoBrief,
    ),
  );
});
test('Unconfirmed course outcomes, facilities and support cannot leak through generic captions or benefits', () => {
  const slot = collectTemplateContentSlots(actual).find(
    (s) => s.blockType === 'Gallery' && s.field === 'description',
  )!;
  for (const text of [
    'Môi trường học tập hiện đại, đầy đủ tiện nghi.',
    'Khóa học cung cấp từ kiến thức nền tảng đến các kỹ thuật SEO nâng cao.',
    'Hỗ trợ tư vấn sau khóa học',
    'Nội dung khóa học phong phú, phù hợp thị trường.',
    'Khóa học giúp bạn hiểu rõ SEO và áp dụng vào thực tế.',
    'Khóa học trang bị cho bạn kiến thức tối ưu hóa nội dung và cấu trúc website.',
    'Bạn sẽ được hướng dẫn sử dụng các công cụ SEO phổ biến.',
    'Chiến lược SEO nâng cao',
    'Bạn sẽ biết cách phân tích và đánh giá hiệu quả của các chiến dịch SEO đã thực hiện.',
    'Học viên sẽ nhận được tài liệu học tập đầy đủ và hữu ích.',
    'Cập nhật xu hướng mới',
    'Khóa học sẽ cung cấp thông tin về các xu hướng SEO mới nhất để bạn không bị lạc hậu.',
    'Hình ảnh về quá trình học tập và giảng dạy.',
  ]) {
    assert.equal(isGroundedTemplateText(text, seoBrief, slot), false, text);
    assert.equal(isGroundedTemplateText(text, { ...seoBrief, description: text }, slot), true, `confirmed: ${text}`);
  }
});
test('Hiding a section cannot bypass locked children or silently discard manual changes', () => {
  const copy = structuredClone(actual),
    feature = copy.blocks.find((b) => b.type === 'Features') as any;
  copy.meta = {
    ...copy.meta,
    elementLocked: { [`${feature.id}::itemTitle:${feature.items[0].id}`]: true },
  };
  assert.equal(
    collectTemplateContentSlots(copy).find((s) => s.id === `${feature.id}::hidden`)?.locked,
    true,
  );
  copy.meta.elementLocked = {};
  copy.meta.fieldSources = { [`${feature.id}.items.${feature.items[0].id}.title`]: 'user' };
  assert.ok(protectedTemplateSlotIds(copy, actual).includes(`${feature.id}::hidden`));
});
test('Hidden duplicate sections do not change the editorial identity of remaining sections', () => {
  const copy = structuredClone(actual),
    features = copy.blocks.filter((b) => b.type === 'Features');
  const id = features[1]!.id;
  features[0]!.hidden = true;
  assert.equal(collectTemplateContentSlots(copy).find((s) => s.blockId === id)?.occurrence, 1);
  assert.match(
    planTemplateContent(collectTemplateContentSlots(copy), seoBrief).find((s) => s.blockId === id)!
      .question,
    /chuẩn bị/,
  );
});
test('Empty renderer fields are mapped; verified curriculum and dates fill only the supplied facts', () => {
  const copy = structuredClone(actual),
    faq = copy.blocks.find((b) => b.type === 'FAQ') as any;
  faq.items[0].answer = '';
  const slots = collectTemplateContentSlots(copy);
  assert.ok(slots.some((s) => s.itemId === faq.items[0].id && s.field === 'answer' && !s.current));
  const brief = {
    ...seoBrief,
    curriculum: 'Nghiên cứu từ khóa\nTối ưu nội dung\nĐọc dữ liệu tìm kiếm',
    schedule: '2027-02-03T19:00:00+07:00',
  };
  const proposals = fallbackTemplateContent(slots, brief);
  assert.ok(proposals.some((p) => p.text === 'Nghiên cứu từ khóa'));
  assert.ok(proposals.some((p) => p.text === brief.schedule));
  assert.equal(
    proposals.find(
      (p) => p.slotId === `${copy.blocks.find((b) => b.type === 'Countdown')!.id}::hidden`,
    )?.status,
    'unchanged',
  );
});
test('Proposal provenance distinguishes accepted AI, omitted slots, fallback and manual edits', () => {
  const slots = collectTemplateContentSlots(actual);
  const title = slots.find((s) => s.blockType === 'Hero' && s.field === 'headline')!;
  const fallback = fallbackTemplateContent(slots, seoBrief);
  assert.ok(fallback.every((p) => p.source === 'fallback'));
  const accepted = validateTemplateContentProposals(
    { proposals: [{ slotId: title.id, text: 'Đào tạo SEO', status: 'ready' }] },
    [title],
    seoBrief,
  )[0]!;
  assert.equal(accepted.source, 'ai');
  const omitted = validateTemplateContentProposals({ proposals: [] }, [title], seoBrief)[0]!;
  assert.equal(omitted.source, 'fallback');
  assert.equal(omitted.validationIssue, 'AI_SLOT_MISSING');
  const manual = { ...accepted, text: 'Khóa học SEO', source: 'user' as const };
  const applied = applyTemplateContent(actual, actual, [manual], [title.id], []);
  assert.deepEqual(applied.conflicts, []);
  assert.equal(applied.spec.meta?.fieldSources?.[`${title.blockId}.${title.field}`], 'user');
  assert.ok(protectedTemplateSlotIds(applied.spec, actual).includes(title.id));
});

test('CTA wording follows actual phone, email, form and submit destinations', () => {
  const slot = collectTemplateContentSlots(actual).find((s) => s.role === 'cta')!;
  for (const [actionType, text] of [
    ['phone', 'Gọi để trao đổi'],
    ['email', 'Gửi email'],
    ['submit', 'Gửi yêu cầu tư vấn'],
    ['form', 'Nhận tư vấn khóa học'],
  ] as const)
    assert.equal(templateContentActionLabel({ ...slot, actionType }, seoBrief), text);
});
console.log(
  JSON.stringify({
    passed: true,
    checks,
    actualPage: '2a68892a-e811-4647-a29c-600827b46cc8',
    product: 'product-launch',
  }),
);
