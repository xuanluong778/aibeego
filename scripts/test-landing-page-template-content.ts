import assert from 'node:assert/strict';
import { LANDING_PAGE_SYSTEM_TEMPLATES } from '../packages/shared/src/landing-page-templates';
import { sanitizeLandingPagePersistSpec } from '../packages/shared/src/landing-page-lifecycle';
import {
  applyTemplateContent,
  collectTemplateContentSlots,
  fallbackTemplateContent,
  isGroundedTemplateText,
  normalizeTemplateContentBrief,
  protectedTemplateSlotIds,
  validateTemplateContentProposals,
} from '../packages/shared/src/landing-page-template-content';
import type { LandingPageSpec } from '../packages/shared/src/landing-page-types';

let checks = 0;
function check(name: string, fn: () => void) {
  fn();
  checks++;
  console.log(`PASS ${name}`);
}
const brief = normalizeTemplateContentBrief({
  productName: 'Bình giữ nhiệt 500 ml',
  brandName: 'An Nhiên',
  description: 'Dung tích 500 ml\nCó nắp khóa',
  targetCustomer: 'Nhân viên văn phòng',
  goal: 'consult',
  imageIds: ['photo-1', 'photo-2'],
  primaryImageId: 'photo-2',
});
const images = [
  { id: 'photo-1', url: '/uploads/public/landing-pages/qa/one/product.png', name: 'Chi tiết' },
  { id: 'photo-2', url: '/uploads/public/landing-pages/qa/one/main.png', name: 'Ảnh chính' },
];
const templates = [
  'product-launch',
  'product-launch-trust-reviews',
  'agency-portfolio-cream-editorial',
].map((slug) => {
  const template = LANDING_PAGE_SYSTEM_TEMPLATES.find((t) => t.slug === slug);
  assert.ok(template, `Missing actual catalog template ${slug}`);
  return template;
});
assert.notDeepEqual(
  templates[0]!.spec.blocks.map((b) => b.type),
  templates[1]!.spec.blocks.map((b) => b.type),
);
for (const template of templates) {
  const spec = structuredClone(template.spec),
    before = JSON.stringify(spec),
    slots = collectTemplateContentSlots(spec),
    proposals = fallbackTemplateContent(slots, brief);
  check(`${template.slug}: slots use exact existing block and item IDs`, () => {
    assert.ok(slots.length > 20);
    assert.equal(new Set(slots.map((s) => s.id)).size, slots.length);
    for (const slot of slots)
      assert.ok(slot.blockId === '@page' || spec.blocks.some((b) => b.id === slot.blockId));
  });
  check(`${template.slug}: missing facts and sample claims remain flagged`, () => {
    assert.ok(proposals.some((p) => p.status === 'missing'));
    assert.ok(
      slots
        .filter((s) => ['price', 'policy', 'review'].includes(s.role))
        .every((s) => proposals.find((p) => p.slotId === s.id)?.status === 'missing'),
    );
    assert.ok(proposals.every((p) => !p.text?.includes('48 giờ')));
  });
  check(`${template.slug}: hero uses the explicitly selected main image`, () => {
    const hero = slots.find((s) => s.blockType === 'Hero' && s.kind === 'image');
    assert.ok(hero);
    assert.equal(proposals.find((p) => p.slotId === hero.id)?.imageId, 'photo-2');
  });
  const ready = proposals.filter((p) => p.status === 'ready').map((p) => p.slotId);
  const applied = applyTemplateContent(spec, spec, proposals, ready, images);
  check(
    `${template.slug}: preview is a clone and content-only application preserves design/structure`,
    () => {
      assert.equal(JSON.stringify(spec), before);
      assert.ok(applied.applied.length > 5);
      assert.deepEqual(applied.conflicts, []);
      const restore = collectTemplateContentSlots(applied.spec).map((s) => ({
        slotId: s.id,
        status: 'ready' as const,
        ...(s.kind === 'image'
          ? { imageId: s.id }
          : { text: slots.find((old) => old.id === s.id)!.current }),
      }));
      // Verify every changed primitive path is an existing allowlisted text/image field.
      const changed: string[] = [];
      function diff(a: any, b: any, path = '') {
        if (JSON.stringify(a) === JSON.stringify(b)) return;
        if (!a || !b || typeof a !== 'object' || typeof b !== 'object') {
          changed.push(path);
          return;
        }
        assert.deepEqual(
          Object.keys(a).sort(),
          Object.keys(b).sort(),
          `No keys added or removed at ${path}`,
        );
        for (const key of Object.keys(a)) diff(a[key], b[key], `${path}.${key}`);
      }
      // Provenance metadata and previously empty renderer fields can now be populated.
      const comparableBefore = structuredClone(spec),
        comparableAfter = structuredClone(applied.spec);
      comparableAfter.meta = comparableBefore.meta;
      function alignEmptyFields(a: any, b: any) {
        if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return;
        for (const key of Object.keys(b)) {
          if (!(key in a)) a[key] = typeof b[key] === 'string' ? '' : b[key];
          else alignEmptyFields(a[key], b[key]);
        }
      }
      alignEmptyFields(comparableBefore, comparableAfter);
      diff(comparableBefore, comparableAfter);
      assert.ok(
        changed.every(
          (path) =>
            /\.(headline|subheadline|body|ctaLabel|imageUrl|title|metaDescription|ogImage|description|price|quote|author|question|answer|name|label|placeholder|submitLabel|alt|text|bullets|features|copyright|badge|successMessage|footerText)$/.test(
              path,
            ) || /\.(bullets|features|trustPoints|captionOverrides|itemCaptions)\.\d+$/.test(path),
        ),
        changed.join('\n'),
      );
      assert.deepEqual(
        applied.spec.meta?.fieldSources &&
          Object.values(applied.spec.meta.fieldSources).every((s) => s === 'ai'),
        true,
      );
      assert.deepEqual(applied.spec.themeTokens, spec.themeTokens);
      for (const block of spec.blocks.filter((b) => b.type === 'LeadForm') as any[]) {
        const next = applied.spec.blocks.find((b) => b.id === block.id) as any;
        for (const key of ['crm', 'formTheme', 'successAction', 'redirectUrl'])
          assert.deepEqual(next[key], block[key]);
        assert.deepEqual(
          next.fields.map((f: any) => ({
            id: f.id,
            type: f.type,
            name: f.name,
            required: f.required,
            options: f.options,
          })),
          block.fields.map((f: any) => ({
            id: f.id,
            type: f.type,
            name: f.name,
            required: f.required,
            options: f.options,
          })),
        );
      }
      assert.equal(restore.length, slots.length);
    },
  );
  check(`${template.slug}: one-block selection changes only that exact block`, () => {
    const heroId = slots.find((s) => s.blockType === 'Hero')!.blockId;
    const subset = ready.filter((id) => slots.find((s) => s.id === id)?.blockId === heroId);
    const partial = applyTemplateContent(spec, spec, proposals, subset, images).spec;
    for (const block of spec.blocks.filter((b) => b.id !== heroId))
      assert.deepEqual(
        partial.blocks.find((b) => b.id === block.id),
        block,
      );
  });
  check(
    `${template.slug}: serialization/autosave normalization retains applied content and stable IDs`,
    () => {
      const saved = sanitizeLandingPagePersistSpec(applied.spec);
      const reloaded = JSON.parse(JSON.stringify(saved)) as LandingPageSpec;
      for (const id of applied.applied)
        assert.equal(
          collectTemplateContentSlots(reloaded).find((s) => s.id === id)?.current,
          collectTemplateContentSlots(applied.spec).find((s) => s.id === id)?.current,
        );
    },
  );
  check(`${template.slug}: history restores the whole application in one operation`, () => {
    const history = [structuredClone(spec)];
    let current = applied.spec;
    current = history.pop()!;
    assert.deepEqual(current, spec);
  });
  check(
    `${template.slug}: manual changes are protected and newly changed fields need value-specific confirmation`,
    () => {
      const headline = slots.find((s) => s.blockType === 'Hero' && s.field === 'headline')!;
      const edited = structuredClone(spec);
      (edited.blocks.find((b) => b.id === headline.blockId) as any).headline =
        'Nội dung tôi tự viết';
      assert.ok(protectedTemplateSlotIds(edited, spec).includes(headline.id));
      const stale = applyTemplateContent(edited, spec, proposals, [headline.id], images);
      assert.deepEqual(stale.conflicts, [headline.id]);
      assert.deepEqual(stale.spec, edited);
      const confirmed = applyTemplateContent(edited, spec, proposals, [headline.id], images, {
        [headline.id]: 'Nội dung tôi tự viết',
      });
      assert.deepEqual(confirmed.conflicts, []);
      assert.equal(confirmed.applied.length, 1);
      (edited.blocks.find((b) => b.id === headline.blockId) as any).headline =
        'Thay đổi thêm lần nữa';
      assert.deepEqual(
        applyTemplateContent(edited, spec, proposals, [headline.id], images, {
          [headline.id]: 'Nội dung tôi tự viết',
        }).conflicts,
        [headline.id],
      );
    },
  );
  check(
    `${template.slug}: moving or resizing during review preserves the latest coordinates`,
    () => {
      const moved = structuredClone(spec);
      moved.blocks[0]!.freeLayout = { x: 73, y: 109, width: 700, height: 400 };
      const next = applyTemplateContent(moved, spec, proposals, ready, images).spec;
      assert.deepEqual(next.blocks[0]!.freeLayout, moved.blocks[0]!.freeLayout);
    },
  );
  check(
    `${template.slug}: removed, locked, foreign and duplicate patch IDs cannot mutate other fields`,
    () => {
      const malicious = [
        {
          slotId: `${slots[0]!.blockId}::ctaUrl`,
          text: 'javascript:alert(1)',
          status: 'ready' as const,
        },
        { slotId: '__proto__::polluted', text: 'yes', status: 'ready' as const },
      ];
      assert.deepEqual(
        applyTemplateContent(
          spec,
          spec,
          malicious,
          malicious.map((p) => p.slotId),
          images,
        ).spec,
        spec,
      );
      const locked = structuredClone(spec);
      locked.blocks.forEach((b) => {
        b.locked = true;
      });
      const blockReady = ready.filter((id) => slots.find((s) => s.id === id)?.blockId !== '@page');
      assert.equal(
        applyTemplateContent(locked, spec, proposals, blockReady, images).applied.length,
        0,
      );
      assert.equal(
        applyTemplateContent(
          spec,
          spec,
          proposals.filter((p) => p.imageId),
          ready,
          [],
        ).applied.length,
        0,
      );
    },
  );
  check(
    `${template.slug}: AI output validation rejects invented prices, facts, claims and image IDs`,
    () => {
      const list = slots
        .filter((s) => s.kind === 'text')
        .map((s) => ({
          slotId: s.id,
          text: 'Giữ nhiệt 48 giờ, bảo hành 99 năm, giá 1 đồng',
          status: 'ready',
        }));
      const validated = validateTemplateContentProposals({ proposals: list }, slots, brief);
      assert.ok(validated.every((p) => !p.text?.includes('48 giờ')));
      assert.throws(() =>
        validateTemplateContentProposals(
          { proposals: [{ slotId: 'foreign', text: 'x' }] },
          slots,
          brief,
        ),
      );
      assert.throws(() =>
        validateTemplateContentProposals({ proposals: [list[0], list[0]] }, slots, brief),
      );
      const fact = slots.find((s) => s.role === 'benefit' && s.field === 'description')!;
      assert.equal(
        isGroundedTemplateText('chống nước', { ...brief, description: 'Không chống nước' }, fact),
        false,
      );
    },
  );
}
check('Brief requires all required fields, valid goal and an owned selected main image ID', () => {
  assert.throws(() => normalizeTemplateContentBrief({ ...brief, productName: '' }));
  assert.throws(() => normalizeTemplateContentBrief({ ...brief, primaryImageId: 'not-selected' }));
  assert.throws(() => normalizeTemplateContentBrief({ ...brief, goal: 'other' as any }));
});
check('Confirmed price, policy and real reviews are copied exactly, never synthesized', () => {
  const spec = structuredClone(templates[0]!.spec);
  spec.blocks.push({
    id: 'existing-review-slot',
    type: 'Testimonials',
    enabled: true,
    items: [{ id: 'review-1', author: 'Tên mẫu', quote: 'Đánh giá mẫu' }],
  });
  const pricing = spec.blocks.find((b) => b.type === 'Pricing') as any;
  pricing.plans = pricing.plans.slice(0, 1);
  const complete = {
    ...brief,
    price: '350.000đ',
    policy: 'Đổi trả 7 ngày nếu lỗi sản xuất',
    reviews: 'Lan | Tôi thích nắp khóa',
  };
  const slots = collectTemplateContentSlots(spec),
    proposals = fallbackTemplateContent(slots, complete);
  const price = slots.find((s) => s.role === 'price' && s.field === 'price')!;
  assert.equal(proposals.find((p) => p.slotId === price.id)?.text, complete.price);
  assert.ok(proposals.some((p) => p.text === 'Tôi thích nắp khóa'));
  assert.ok(proposals.some((p) => p.text === complete.policy));
});
check(
  'Empty existing renderer fields are available without inventing navigation properties',
  () => {
    const spec = structuredClone(templates[0]!.spec);
    const hero = spec.blocks.find((block) => block.type === 'Hero') as any;
    hero.imageUrl = null;
    hero.body = '';
    const slots = collectTemplateContentSlots(spec);
    assert.ok(
      slots.some(
        (slot) => slot.blockId === hero.id && slot.field === 'body' && slot.current === '',
      ),
    );
    assert.ok(!slots.some((slot) => slot.blockType === 'Header' && slot.field === 'body'));
  },
);
check('Nested element locks and item reordering preserve exact element identity', () => {
  const spec = structuredClone(templates[0]!.spec);
  const block = spec.blocks.find((block) => block.type === 'Benefits') as any;
  const itemId = block.items[0].id;
  const slot = collectTemplateContentSlots(spec).find(
    (slot) => slot.itemId === itemId && slot.field === 'title',
  )!;
  const reordered = structuredClone(spec);
  (reordered.blocks.find((value) => value.id === block.id) as any).items.reverse();
  const changed = applyTemplateContent(
    reordered,
    spec,
    [{ slotId: slot.id, text: 'Nội dung đã duyệt', status: 'ready' }],
    [slot.id],
    images,
  );
  assert.equal(
    (changed.spec.blocks.find((value) => value.id === block.id) as any).items.find(
      (value: any) => value.id === itemId,
    ).title,
    'Nội dung đã duyệt',
  );
  spec.meta = { ...spec.meta, elementLocked: { [`${block.id}::itemTitle:${itemId}`]: true } };
  assert.equal(
    collectTemplateContentSlots(spec).find((value) => value.id === slot.id)?.locked,
    true,
  );
});
check('When AI leaves a supplied fact empty, the exact supplied fact remains available', () => {
  const slots = collectTemplateContentSlots(templates[0]!.spec);
  const proposals = validateTemplateContentProposals(
    { proposals: slots.map((slot) => ({ slotId: slot.id, status: 'missing' })) },
    slots,
    brief,
  );
  assert.ok(proposals.some((proposal) => proposal.text === 'Dung tích 500 ml'));
  assert.ok(proposals.some((proposal) => proposal.status === 'missing'));
});
console.log(
  JSON.stringify({
    passed: true,
    checks,
    templates: templates.map((t) => ({
      slug: t.slug,
      name: t.name,
      architecture: t.spec.meta?.architectureRecipe?.id,
    })),
  }),
);
