/** Content patches target renderer fields by stable identity. No model-provided paths are executed. */
import type { LandingPageSpec } from './landing-page-types';
import type { TemplateEditorialContext } from './landing-page-template-editorial';
import { templatePriceOffer } from './landing-page-template-pricing';
import { isGenericTemplateHeading } from './landing-page-template-copy-quality';
export { parseTemplateVnd, formatTemplateVnd, templatePriceOffer, enforceTemplatePricingOffer } from './landing-page-template-pricing';
export { reviewTemplateContent } from './landing-page-template-content-review';
export type { TemplateContentReviewIssue } from './landing-page-template-content-review';
export {
  planTemplateContent,
  fallbackTemplateContent,
  validateTemplateContentProposals,
  isGroundedTemplateText,
  templateContentActionLabel,
} from './landing-page-template-content-plan';

export type TemplateContentBrief = {
  productName: string;
  brandName: string;
  description: string;
  targetCustomer: string;
  goal: 'sales' | 'consult';
  price?: string;
  originalPrice?: string;
  salePrice?: string;
  /** Exact stable price slot selected by the user, not an array index. */
  pricingTargetId?: string;
  offer?: string;
  policy?: string;
  reviews?: string;
  curriculum?: string;
  schedule?: string;
  commitments?: string;
  /** Backend-attached public page text; data only, never instructions. */
  sourceText?: string;
  /** Attached from the server-owned URL receipt, never trusted from the request body. */
  sourceContext?: TemplateEditorialContext;
  imageIds: string[];
  primaryImageId?: string;
};
export type TemplateContentImage = { id: string; url: string; name: string };
export type TemplateContentSlot = {
  id: string;
  blockId: string;
  blockType: string;
  itemId?: string;
  collection?: 'items' | 'plans' | 'fields';
  field: string;
  elementId?: string;
  itemIndex?: number;
  occurrence?: number;
  kind: 'text' | 'image' | 'visibility';
  role:
    | 'headline'
    | 'description'
    | 'benefit'
    | 'fact'
    | 'curriculum'
    | 'cta'
    | 'price'
    | 'policy'
    | 'review'
    | 'image'
    | 'alt'
    | 'schedule'
    | 'visibility'
    | 'seo'
    | 'form-label';
  label: string;
  maxLength: number;
  current: string;
  locked: boolean;
  actionTarget?: string;
  actionType?: 'submit' | 'form' | 'anchor' | 'phone' | 'email' | 'zalo' | 'checkout' | 'external';
  inputName?: string;
  /** Server-assigned source facts for this item; never used as a write path. */
  editorialFactIds?: string[];
  blockHidden?: boolean;
};
export type TemplateContentProposal = {
  slotId: string;
  source?: 'ai' | 'fallback' | 'user';
  text?: string;
  imageId?: string;
  status: 'ready' | 'missing' | 'unchanged';
  action?: 'hide' | 'clear' | 'show';
  priceGroupId?: string;
  /** Derived from explicit pricing inputs; edit those inputs to change these proposals. */
  priceControlled?: boolean;
  reason?: string;
  evidence?: string[];
  validationIssue?: string;
};
export type TemplateContentSectionPlan = {
  blockId: string;
  blockType: string;
  question: string;
  purpose: string;
  occurrence: number;
};
export type TemplateContentResult = {
  slots: TemplateContentSlot[];
  proposals: TemplateContentProposal[];
  protectedSlotIds: string[];
  images: TemplateContentImage[];
  source: 'ai' | 'fallback' | 'mixed';
  warning?: string;
  outline?: TemplateContentSectionPlan[];
  validationSummary?: Record<string, number>;
  urlSource?: { sourceUrl: string; finalUrl: string; readAt: string };
};

export function normalizeTemplateContentBrief(
  raw: TemplateContentBrief,
  allowIncomplete = false,
): TemplateContentBrief {
  if (!raw || typeof raw !== 'object') throw new Error('Thiếu thông tin sản phẩm / dịch vụ.');
  const limits = {
    productName: 200,
    brandName: 120,
    description: 2400,
    targetCustomer: 400,
    price: 200,
    originalPrice: 40,
    salePrice: 40,
    pricingTargetId: 500,
    offer: 600,
    policy: 1600,
    reviews: 2400,
    curriculum: 2400,
    schedule: 200,
    commitments: 1200,
    sourceText: 32000,
  };
  const clean: Record<string, unknown> = {};
  for (const [key, max] of Object.entries(limits)) {
    const value = (raw as unknown as Record<string, unknown>)[key];
    if (value != null && typeof value !== 'string') throw new Error('Thông tin không hợp lệ.');
    const text = String(value || '').trim();
    if (text.length > max) throw new Error(`Thông tin ${key} quá dài.`);
    clean[key] = text;
  }
  if (
    !clean.productName ||
    !clean.description ||
    (!allowIncomplete && (!clean.brandName || !clean.targetCustomer))
  )
    throw new Error('Nhập tên sản phẩm / dịch vụ, thương hiệu, mô tả và khách hàng mục tiêu.');
  if (raw.goal !== 'sales' && raw.goal !== 'consult')
    throw new Error('Mục tiêu trang không hợp lệ.');
  if (
    !Array.isArray(raw.imageIds) ||
    raw.imageIds.length > 30 ||
    raw.imageIds.some((id) => typeof id !== 'string' || id.length > 300)
  )
    throw new Error('Danh sách ảnh không hợp lệ.');
  const imageIds = [...new Set(raw.imageIds)];
  const offer = templatePriceOffer(clean as TemplateContentBrief);
  if (offer) {
    if (clean.schedule && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*(?:Z|[+-]\d{2}:\d{2})$/.test(String(clean.schedule)) || !Number.isFinite(Date.parse(String(clean.schedule))) || Date.parse(String(clean.schedule)) <= Date.now()))
      throw new Error('Thời gian kết thúc ưu đãi phải là một thời điểm hợp lệ trong tương lai.');
    clean.originalPrice = String(offer.original);
    clean.salePrice = offer.sale === undefined ? '' : String(offer.sale);
    clean.price = offer.priceLabel;
  }
  if (raw.primaryImageId && !imageIds.includes(raw.primaryImageId))
    throw new Error('Ảnh chính phải nằm trong danh sách ảnh đã chọn.');
  return {
    ...clean,
    goal: raw.goal,
    imageIds,
    primaryImageId: raw.primaryImageId,
  } as TemplateContentBrief;
}

function actionType(target: string, submit = false): TemplateContentSlot['actionType'] {
  if (submit) return 'submit';
  if (/^tel:/i.test(target)) return 'phone';
  if (/^mailto:/i.test(target)) return 'email';
  if (/zalo\.me/i.test(target)) return 'zalo';
  if (/^#(?:lead-form|form|register|signup)/i.test(target)) return 'form';
  if (target.startsWith('#')) return 'anchor';
  if (/checkout|payment|stripe\.com/i.test(target)) return 'checkout';
  return 'external';
}
const ITEM_FIELDS: Record<string, string> = {
  title: 'itemTitle',
  description: 'itemDesc',
  imageUrl: 'itemImage',
  quote: 'itemQuote',
  author: 'itemAuthor',
  question: 'itemQuestion',
  answer: 'itemAnswer',
};
const PLAN_FIELDS: Record<string, string> = {
  name: 'planName',
  price: 'planPrice',
  originalPrice: 'planOriginalPrice',
  ctaLabel: 'planCta',
};
const cloneValue = (value: unknown): string =>
  value == null ? '' : typeof value === 'string' ? value : JSON.stringify(value);

/** Only schema fields that are displayed by the renderer, including existing empty slots. */
export function collectTemplateContentSlots(spec: LandingPageSpec, includeHiddenOffers = false): TemplateContentSlot[] {
  if (spec.meta?.htmlSource) return [];
  const slots: TemplateContentSlot[] = [],
    occurrences = new Map<string, number>();
  const addSeo = (field: 'title' | 'metaDescription') =>
    slots.push({
      id: `@page::seo.${field}`,
      blockId: '@page',
      blockType: 'SEO',
      field: `seo.${field}`,
      kind: 'text',
      role: 'seo',
      label: field === 'title' ? 'SEO title' : 'Meta description',
      maxLength: field === 'title' ? 65 : 160,
      current: spec.seo[field] || '',
      locked: false,
    });
  addSeo('title');
  addSeo('metaDescription');
  slots.push({
    id: '@page::seo.ogImage',
    blockId: '@page',
    blockType: 'SEO',
    field: 'seo.ogImage',
    kind: 'image',
    role: 'image',
    label: 'Ảnh chia sẻ / OG image',
    maxLength: 2000,
    current: spec.seo.ogImage || '',
    locked: false,
  });
  for (const block of spec.blocks) {
    const occurrence = occurrences.get(block.type) || 0;
    occurrences.set(block.type, occurrence + 1);
    if (block.enabled === false || (block.hidden && !(includeHiddenOffers && ['Pricing', 'Countdown'].includes(block.type)))) continue;
    const b = block as unknown as Record<string, any>;
    const add = (
      field: string,
      role: TemplateContentSlot['role'],
      label: string,
      item?: Record<string, any>,
      collection?: TemplateContentSlot['collection'],
      index?: number,
    ) => {
      const owner = item || b;
      const path = field.split('.');
      let value: any = owner;
      for (const part of path) value = value?.[part];
      // An empty field is still an addressable renderer slot. Missing array entries are never created.
      if (value != null && typeof value !== 'string') return;
      const nested = item ? `${collection}.${item.id}.` : '';
      const id = `${block.id}::${nested}${field}`;
      const alias = item
        ? `${((collection === 'plans' ? PLAN_FIELDS : collection === 'fields' ? { label: 'fieldLabel', placeholder: 'fieldPlaceholder' } : ITEM_FIELDS) as Record<string, string>)[field] || field}:${item.id}`
        : field.startsWith('trustPoints.')
          ? `trustPoint:${path[1]}`
          : ({ imageUrl: 'image', ctaLabel: 'ctaLabel' } as Record<string, string>)[field] || field;
      const elementId = `${block.id}::${alias}`;
      const parentId = item
        ? `${block.id}::item:${item.id}`
        : '';
      const target =
        role === 'cta'
          ? field === 'submitLabel'
            ? 'submit'
            : String(owner.ctaUrl || b.ctaUrl || '#lead-form')
          : undefined;
      const maxLength =
        role === 'cta'
          ? 36
          : role === 'alt'
            ? 140
            : field === 'headline'
              ? block.type === 'Hero'
                ? 90
                : 70
              : ['title', 'name', 'question', 'label'].includes(field)
                ? 80
                : field === 'subheadline'
                  ? 180
                  : role === 'schedule'
                    ? 100
                    : 260;
      slots.push({
        id,
        blockId: block.id,
        blockType: block.type,
        blockHidden: !!block.hidden,
        itemId: item?.id,
        collection,
        itemIndex: index,
        occurrence,
        field,
        elementId,
        role,
        kind: role === 'image' ? 'image' : 'text',
        label,
        maxLength,
        current: cloneValue(value),
        locked:
          !!block.locked ||
          [
            id,
            elementId,
            parentId,
            ...(field === 'imageStyle.alt'
              ? [`${block.id}::${item ? `itemImage:${item.id}` : 'image'}`]
              : []),
          ].some((key) => !!spec.meta?.elementLocked?.[key] || !!spec.meta?.elementHidden?.[key]),
        ...(target
          ? { actionTarget: target, actionType: actionType(target, target === 'submit') }
          : {}),
        ...(collection === 'fields' ? { inputName: String(owner.name || '') } : {}),
      });
    };
    const image = (
      item?: Record<string, any>,
      collection?: TemplateContentSlot['collection'],
      index?: number,
    ) => {
      add('imageUrl', 'image', 'Ảnh', item, collection, index);
      add('imageStyle.alt', 'alt', 'Alt / chú thích ảnh', item, collection, index);
    };
    const head = () => {
      add('headline', 'headline', block.type === 'Hero' ? 'H1' : 'H2');
      add('subheadline', 'description', 'Mô tả ngắn');
    };
    if (
      [
        'Benefits',
        'Features',
        'Gallery',
        'Process',
        'FAQ',
        'CTA',
        'Pricing',
        'Guarantee',
        'Testimonials',
        'Product',
      ].includes(block.type)
    )
      add('eyebrow', 'headline', 'Nhãn phần');
    if (block.type === 'Header') {
      add('headline', 'headline', 'Thương hiệu');
      add('ctaLabel', 'cta', 'Nhãn nút');
    } else if (block.type === 'LeadForm') {
      head();
      add('submitLabel', 'cta', 'Nhãn gửi biểu mẫu');
      add('successMessage', 'description', 'Thông báo đã gửi');
      add('footerText', 'description', 'Chú thích biểu mẫu');
      for (const [index, field] of (b.fields || []).entries()) {
        add('label', 'form-label', 'Nhãn trường', field, 'fields', index);
        add('placeholder', 'form-label', 'Gợi ý nhập liệu', field, 'fields', index);
      }
    } else if (block.type === 'Countdown') {
      head();
      add('endsAt', 'schedule', 'Mốc thời gian đã xác nhận');
      add('kicker', 'headline', 'Nhãn lịch');
      add('originalPrice', 'price', 'Giá gốc');
      add('price', 'price', 'Giá bán / khuyến mãi');
      add('clockMode', 'price', 'Chế độ đồng hồ / ưu đãi');
      add('ctaLabel', 'cta', 'Nút đăng ký ưu đãi');
      add('expireMessage', 'description', 'Thông báo hết hạn');
      if (b.showSignup) {
        add('formHeadline', 'headline', 'Tiêu đề đăng ký');
        add('submitLabel', 'cta', 'Nhãn đăng ký');
      }
    } else if (block.type === 'FAQ') {
      add('headline', 'headline', 'H2');
      for (const [index, item] of (b.items || []).entries()) {
        add('question', 'headline', 'Câu hỏi', item, 'items', index);
        add('answer', 'description', 'Trả lời', item, 'items', index);
      }
    } else if (block.type === 'Pricing') {
      head();
      for (const [index, plan] of (b.plans || []).entries()) {
        add('name', 'price', 'Tên gói đã xác nhận', plan, 'plans', index);
        add('price', 'price', 'Giá đã xác nhận', plan, 'plans', index);
        add('originalPrice', 'price', 'Giá gốc gạch ngang', plan, 'plans', index);
        add('period', 'price', 'Đơn vị giá', plan, 'plans', index);
        add('ctaLabel', 'cta', 'Nhãn nút', plan, 'plans', index);
        (plan.features || []).forEach((_: string, i: number) =>
          add(`features.${i}`, 'price', 'Nội dung gói đã xác nhận', plan, 'plans', index),
        );
      }
    } else if (['Hero', 'CTA', 'Guarantee', 'Footer'].includes(block.type)) {
      head();
      add('body', block.type === 'Guarantee' ? 'policy' : 'description', 'Nội dung');
      add('ctaLabel', 'cta', 'Nhãn nút');
      if (block.type === 'Hero' || typeof b.imageUrl === 'string') image();
      (b.trustPoints || []).forEach((_: string, index: number) =>
        add(`trustPoints.${index}`, 'benefit', 'Ý chính'),
      );
      if (block.type === 'Hero')
        for (const field of ['eventDate', 'eventTime', 'eventFormat'])
          if (b[field] != null && b[field] !== '') add(field, 'schedule', 'Thông tin lịch');
    } else if (Array.isArray(b.items)) {
      head();
      for (const [index, item] of b.items.entries()) {
        if (typeof item?.id !== 'string') continue;
        if (block.type === 'Testimonials') {
          for (const field of ['quote', 'author', 'role'])
            add(field, 'review', 'Đánh giá đã xác nhận', item, 'items', index);
          continue;
        }
        const role = block.type === 'Features' && occurrence === 0 ? 'curriculum' : 'benefit';
        add('title', role, 'Tiêu đề box', item, 'items', index);
        add('description', role, 'Mô tả box', item, 'items', index);
        if (block.type === 'Gallery' || block.type === 'Product' || item.imageUrl != null)
          image(item, 'items', index);
        if (item.role != null) add('role', 'review', 'Vai trò đã xác nhận', item, 'items', index);
      }
    } else if (block.type === 'Video') {
      add('headline', 'headline', 'H2');
    }
    if (
      ['Countdown', 'Pricing', 'Guarantee', 'Testimonials', 'Speaker', 'Benefits', 'Features', 'Process', 'Gallery', 'Product'].includes(block.type)
    ) {
      slots.push({
        id: `${block.id}::hidden`,
        blockId: block.id,
        blockType: block.type,
        blockHidden: !!block.hidden,
        field: 'hidden',
        kind: 'visibility',
        role: 'visibility',
        label: 'Duyệt ẩn khối thiếu dữ liệu',
        maxLength: 0,
        occurrence,
        current: JSON.stringify(block),
        locked: !!block.locked || (!block.hidden && slots.some((s) => s.blockId === block.id && s.locked)),
      });
    }
    // Extra template cards can be hidden explicitly when the source has fewer distinct facts.
    if (['Benefits', 'Features', 'Process', 'Gallery', 'Product', 'Pricing'].includes(block.type)) {
      const collection = block.type === 'Pricing' ? 'plans' : 'items';
      for (const [index, item] of (b[collection] || []).entries()) {
        if (typeof item?.id !== 'string') continue;
        const elementId = `${block.id}::item:${item.id}`;
        slots.push({ id: `${block.id}::${collection}.${item.id}.hidden`, blockId: block.id, blockType: block.type,
          itemId: item.id, collection, itemIndex: index, occurrence, field: 'hidden',
          kind: 'visibility', role: 'visibility', label: 'Duyệt ẩn thẻ thiếu dữ liệu', maxLength: 0,
          current: JSON.stringify(item), elementId,
          locked: !!block.locked || !!spec.meta?.elementHidden?.[elementId] ||
            !!spec.meta?.elementLocked?.[elementId] || slots.some(s => s.blockId === block.id && s.itemId === item.id && s.locked),
        });
      }
    }
  }
  if (
    new Set(slots.map((s) => s.id)).size !== slots.length ||
    new Set(spec.blocks.map((b) => b.id)).size !== spec.blocks.length
  )
    throw new Error('ID khối hoặc phần tử bị trùng.');
  return slots;
}

function ownerFor(
  spec: LandingPageSpec,
  slot: TemplateContentSlot,
): Record<string, any> | undefined {
  if (slot.blockId === '@page') return spec as unknown as Record<string, any>;
  const block = spec.blocks.find((b) => b.id === slot.blockId) as Record<string, any> | undefined;
  return !slot.itemId
    ? block
    : block?.[slot.collection || 'items']?.find((item: any) => item.id === slot.itemId);
}
function readSlot(spec: LandingPageSpec, slot: TemplateContentSlot): string {
  let value: any = ownerFor(spec, slot);
  if (slot.kind === 'visibility') return JSON.stringify(value);
  for (const part of slot.field.split('.')) value = value?.[part];
  return cloneValue(value);
}
function writeSlot(spec: LandingPageSpec, slot: TemplateContentSlot, text: string) {
  let value: any = ownerFor(spec, slot);
  if (!value) return false;
  const parts = slot.field.split('.');
  for (const part of parts.slice(0, -1)) {
    if (['__proto__', 'constructor', 'prototype'].includes(part)) return false;
    if (value[part] == null && part === 'imageStyle') value[part] = {};
    value = value[part];
    if (!value || typeof value !== 'object') return false;
  }
  const key = parts[parts.length - 1]!;
  if (['__proto__', 'constructor', 'prototype'].includes(key)) return false;
  value[key] = text;
  return true;
}

export function protectedTemplateSlotIds(
  spec: LandingPageSpec,
  template?: LandingPageSpec,
  includeHiddenOffers = false,
): string[] {
  const slots = collectTemplateContentSlots(spec, includeHiddenOffers),
    originals = template ? collectTemplateContentSlots(template, includeHiddenOffers) : [];
  const key = (s: TemplateContentSlot) =>
    `${s.blockType}:${s.occurrence || 0}:${s.collection || ''}:${s.itemIndex ?? ''}:${s.field}`;
  const values = new Map(
    originals.filter((s) => s.kind !== 'visibility').map((s) => [key(s), s.current]),
  );
  const protectedIds = new Set<string>();
  for (const slot of slots.filter((s) => s.kind !== 'visibility')) {
    const sources = spec.meta?.fieldSources || {};
    const source =
      sources[
        slot.blockId === '@page'
          ? slot.field
          : `${slot.blockId}.${slot.itemId ? `${slot.collection}.${slot.itemId}.` : ''}${slot.field}`
      ];
    const groupedSource = sources[`${slot.blockId}.${slot.collection || slot.field}`];
    if (
      slot.locked ||
      source === 'user' ||
      groupedSource === 'user' ||
      (source !== 'ai' && !(slot.field === 'headline' && isGenericTemplateHeading(slot.current)) &&
        (!values.has(key(slot)) || values.get(key(slot)) !== slot.current))
    )
      protectedIds.add(slot.id);
  }
  for (const slot of slots.filter((s) => s.kind === 'visibility'))
    if (slot.locked || slots.some((s) => s.blockId === slot.blockId && (!slot.itemId || s.itemId === slot.itemId) && protectedIds.has(s.id)))
      protectedIds.add(slot.id);
  return [...protectedIds];
}

/** Same atomic patch engine for preview and commit. Approval of hiding is explicit, never inferred. */
export function applyTemplateContent(
  current: LandingPageSpec,
  snapshot: LandingPageSpec,
  proposals: TemplateContentProposal[],
  selectedIds: string[],
  images: TemplateContentImage[],
  confirmedValues: Record<string, string> = {},
): { spec: LandingPageSpec; applied: string[]; conflicts: string[] } {
  const next = structuredClone(current),
    includeHiddenOffers = proposals.some(p => p.action === 'show'),
    slots = new Map(collectTemplateContentSlots(snapshot, includeHiddenOffers).map((s) => [s.id, s]));
  const live = new Map(collectTemplateContentSlots(current, includeHiddenOffers).map((s) => [s.id, s]));
  const selected = new Set(selectedIds),
    applied: string[] = [],
    conflicts: string[] = [],
    seen = new Set<string>();
  const priceGroups = new Map<string, string[]>();
  for (const proposal of proposals) if (proposal.priceGroupId)
    priceGroups.set(proposal.priceGroupId, [...(priceGroups.get(proposal.priceGroupId) || []), proposal.slotId]);
  for (const ids of priceGroups.values()) if (ids.some(id => selected.has(id)) && !ids.every(id => selected.has(id))) conflicts.push(...ids);
  for (const proposal of proposals) {
    if (
      !selected.has(proposal.slotId) ||
      seen.has(proposal.slotId) ||
      (proposal.status !== 'ready' && proposal.action !== 'hide')
    )
      continue;
    seen.add(proposal.slotId);
    const slot = slots.get(proposal.slotId),
      now = live.get(proposal.slotId);
    if (!slot) continue;
    if (
      !now ||
      now.locked ||
      now.blockType !== slot.blockType ||
      now.kind !== slot.kind ||
      (readSlot(current, slot) !== slot.current &&
        confirmedValues[slot.id] !== readSlot(current, slot))
    ) {
      conflicts.push(slot.id);
      continue;
    }
    if (slot.kind === 'visibility') {
      if (proposal.action !== 'hide' && proposal.action !== 'show') continue;
      if (slot.itemId && slot.elementId) {
        next.meta = { ...next.meta, elementHidden: { ...next.meta?.elementHidden, [slot.elementId]: true } };
        applied.push(slot.id);
        continue;
      }
      const block = next.blocks.find((b) => b.id === slot.blockId);
      if (block) {
        block.hidden = proposal.action !== 'show';
        applied.push(slot.id);
      }
      continue;
    }
    if (proposal.action === 'hide' && slot.kind === 'image') {
      if (slot.blockId === '@page') {
        next.seo.ogImage = null;
        applied.push(slot.id);
        continue;
      }
      next.meta = {
        ...next.meta,
        elementHidden: {
          ...next.meta?.elementHidden,
          [slot.elementId || `${slot.blockId}::image`]: true,
        },
      };
      applied.push(slot.id);
      continue;
    }
    const text =
      slot.kind === 'image'
        ? images.find((image) => image.id === proposal.imageId)?.url
        : proposal.text;
    const clearable = proposal.action === 'clear' && slot.kind === 'text' &&
      (slot.field === 'originalPrice' || slot.field === 'period' || /^features\.\d+$/.test(slot.field));
    if (
      typeof text !== 'string' ||
      (!text.trim() && !clearable) ||
      (slot.kind === 'text' && (text.length > slot.maxLength || /[<>]/.test(text)))
    )
      continue;
    if (writeSlot(next, slot, text)) {
      applied.push(slot.id);
      const sourceKey =
        slot.blockId === '@page'
          ? slot.field
          : `${slot.blockId}.${slot.itemId ? `${slot.collection}.${slot.itemId}.` : ''}${slot.field}`;
      next.meta = {
        ...next.meta,
        fieldSources: {
          ...next.meta?.fieldSources,
          [sourceKey]: proposal.source === 'user' ? 'user' : 'ai',
        },
      };
    }
  }
  // No partial commits when another writer changed a selected slot.
  if (conflicts.length) return { spec: structuredClone(current), applied: [], conflicts };
  return { spec: next, applied, conflicts };
}
