/**
 * Landing Page — Inline field-level AI (suggest only; never mutates page).
 */

import { z } from 'zod';
import type { LandingPageBlockType } from './landing-page-types';
import type { LandingPageAiGoal } from './landing-page-generator';
import { LANDING_PAGE_AI_GOAL_LABELS } from './landing-page-generator';
import type { BusinessProfileData } from './landing-page-business-profile';

export const LANDING_PAGE_INLINE_AI_ACTIONS = [
  'suggest_3',
  'more_engaging',
  'shorter',
  'more_conversion',
  'more_professional',
  'more_friendly',
  'fix_spelling',
  'rewrite',
] as const;
export type LandingPageInlineAiAction = (typeof LANDING_PAGE_INLINE_AI_ACTIONS)[number];

export const LANDING_PAGE_INLINE_AI_ACTION_LABELS: Record<LandingPageInlineAiAction, string> = {
  suggest_3: 'Gợi ý 3 phiên bản',
  more_engaging: 'Viết hấp dẫn hơn',
  shorter: 'Viết ngắn hơn',
  more_conversion: 'Tăng chuyển đổi',
  more_professional: 'Chuyên nghiệp hơn',
  more_friendly: 'Thân thiện hơn',
  fix_spelling: 'Sửa chính tả',
  rewrite: 'Viết lại',
};

/** Fields that may show ✨ AI in the builder inspector. */
export const LANDING_PAGE_INLINE_AI_FIELD_KINDS = [
  'seo.title',
  'seo.metaDescription',
  'headline',
  'subheadline',
  'body',
  'ctaLabel',
  'item.title',
  'item.description',
  'item.question',
  'item.answer',
  'item.quote',
  'item.author',
  'item.role',
  'field.label',
  'field.placeholder',
  'plan.subheadline',
  'plan.feature',
] as const;
export type LandingPageInlineAiFieldKind = (typeof LANDING_PAGE_INLINE_AI_FIELD_KINDS)[number];

const INLINE_AI_BLOCK_TYPES = [
  'Hero',
  'Benefits',
  'Features',
  'Product',
  'Pricing',
  'Testimonials',
  'Gallery',
  'Video',
  'Process',
  'Guarantee',
  'FAQ',
  'LeadForm',
  'CTA',
  'Footer',
  'SEO',
] as const;

export const landingPageInlineAiRequestSchema = z.object({
  action: z.enum(LANDING_PAGE_INLINE_AI_ACTIONS),
  fieldKind: z.enum(LANDING_PAGE_INLINE_AI_FIELD_KINDS),
  currentContent: z.string().max(4000).default(''),
  blockType: z.enum(INLINE_AI_BLOCK_TYPES).optional().default('Hero'),
  pageGoal: z.enum(['lead', 'sales', 'signup', 'consult', 'event']).optional().default('lead'),
  blockContext: z.string().max(2000).optional().default(''),
  useBusinessProfile: z.boolean().optional().default(true),
});

export type LandingPageInlineAiRequest = z.infer<typeof landingPageInlineAiRequestSchema>;

export const landingPageInlineAiResultSchema = z.object({
  schemaVersion: z.literal('landing-page-inline-ai.v1'),
  options: z.tuple([z.string().min(1).max(2000), z.string().min(1).max(2000), z.string().min(1).max(2000)]),
  mode: z.enum(['ai', 'fallback']),
  fieldKind: z.enum(LANDING_PAGE_INLINE_AI_FIELD_KINDS),
  action: z.enum(LANDING_PAGE_INLINE_AI_ACTIONS),
});

export type LandingPageInlineAiResult = z.infer<typeof landingPageInlineAiResultSchema>;

export function parseLandingPageInlineAiResult(raw: unknown): LandingPageInlineAiResult {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  let options = Array.isArray(obj.options) ? obj.options.map((o) => String(o ?? '').trim()) : [];
  options = options.filter(Boolean).slice(0, 3);
  while (options.length < 3) {
    options.push(options[options.length - 1] || 'Gợi ý đang trống — thử lại');
  }
  return landingPageInlineAiResultSchema.parse({
    schemaVersion: 'landing-page-inline-ai.v1',
    options: [options[0], options[1], options[2]],
    mode: obj.mode === 'fallback' ? 'fallback' : 'ai',
    fieldKind: obj.fieldKind,
    action: obj.action,
  });
}

export function blockHintForInlineAi(
  blockType: LandingPageBlockType | 'SEO',
  fieldKind: LandingPageInlineAiFieldKind,
): string {
  if (blockType === 'Testimonials' || fieldKind === 'item.quote') {
    return 'Testimonials: chỉ gợi ý cấu trúc/placeholder (vd. "[Tên khách] — nhận xét ngắn về lợi ích"). KHÔNG bịa review thật, tên người thật, hoặc số liệu giả.';
  }
  const map: Partial<Record<LandingPageBlockType | 'SEO', string>> = {
    Hero: 'Hero: headline/subheadline thu hút, rõ lợi ích.',
    Benefits: 'Benefits: lợi ích ngắn, cụ thể, dễ scan.',
    Features: 'Features: tính năng rõ ràng, không jargon thừa.',
    Product: 'Product: mô tả sản phẩm/dịch vụ hấp dẫn.',
    Pricing: 'Pricing: value proposition / lý do chọn gói.',
    Process: 'Process: các bước rõ ràng, hành động.',
    Guarantee: 'Guarantee: cam kết tin cậy, không phóng đại.',
    FAQ: 'FAQ: câu hỏi thực tế + trả lời ngắn, hữu ích.',
    LeadForm: 'LeadForm: label/placeholder rõ, thân thiện.',
    CTA: 'CTA: copy thúc đẩy hành động, ngắn.',
    SEO: 'SEO: title/meta tiếng Việt, tự nhiên, không nhồi keyword.',
    Footer: 'Footer: ngắn gọn.',
    Gallery: 'Gallery: chú thích ngắn.',
    Video: 'Video: tiêu đề ngắn.',
  };
  return map[blockType] || 'Viết tiếng Việt, rõ ràng, conversion-focused.';
}

export function buildInlineAiPrompt(input: {
  action: LandingPageInlineAiAction;
  fieldKind: LandingPageInlineAiFieldKind;
  currentContent: string;
  blockType: LandingPageBlockType | 'SEO';
  pageGoal: LandingPageAiGoal;
  blockContext?: string;
  profile?: BusinessProfileData | null;
}): string {
  const goal = LANDING_PAGE_AI_GOAL_LABELS[input.pageGoal] || input.pageGoal;
  const actionLabel = LANDING_PAGE_INLINE_AI_ACTION_LABELS[input.action];
  const brand =
    input.profile?.brandName?.trim() ||
    input.profile?.companyName?.trim() ||
    '';
  const lines = [
    'Bạn là copywriter landing page tiếng Việt.',
    'Trả về ĐÚNG 1 JSON object, không markdown.',
    'schemaVersion="landing-page-inline-ai.v1"',
    'Bắt buộc: options = mảng đúng 3 chuỗi khác nhau (3 phiên bản).',
    'Chỉ viết lại NỘI DUNG FIELD được yêu cầu — không đổi toàn trang, không HTML.',
    'TRUST: Không bịa tên khách hàng, review thật, doanh thu, chứng nhận, hotline, giá, % ưu đãi nếu không có trong context/profile.',
    'Testimonials: chỉ placeholder dạng [Tên khách] — không đặt tên người thật.',
    `Action: ${actionLabel} (${input.action})`,
    `Field: ${input.fieldKind}`,
    `Block type: ${input.blockType}`,
    `Mục tiêu trang: ${goal}`,
    brand ? `Thương hiệu: ${brand}` : '',
    input.profile?.productService ? `Sản phẩm/DV: ${input.profile.productService}` : '',
    input.profile?.usp ? `USP: ${input.profile.usp}` : '',
    input.profile?.targetCustomer ? `KH mục tiêu: ${input.profile.targetCustomer}` : '',
    blockHintForInlineAi(input.blockType, input.fieldKind),
    input.blockContext ? `Context block (tham khảo, không copy nguyên): ${input.blockContext.slice(0, 800)}` : '',
    `Nội dung hiện tại:\n${(input.currentContent || '(trống)').slice(0, 1500)}`,
    'JSON mẫu: {"schemaVersion":"landing-page-inline-ai.v1","options":["...","...","..."],"mode":"ai"}',
  ];
  return lines.filter(Boolean).join('\n');
}

function clampOpt(s: string, max = 400): string {
  return s.replace(/<[^>]+>/g, '').trim().slice(0, max) || 'Gợi ý mẫu';
}

/** Deterministic fallback — never invent fake testimonials. */
export function buildFallbackInlineAiOptions(input: {
  action: LandingPageInlineAiAction;
  fieldKind: LandingPageInlineAiFieldKind;
  currentContent: string;
  blockType: LandingPageBlockType | 'SEO';
  brandName?: string;
}): [string, string, string] {
  const raw = (input.currentContent || '').trim();
  const brand = input.brandName?.trim() || 'thương hiệu';
  const isTestimonial =
    input.blockType === 'Testimonials' ||
    input.fieldKind === 'item.quote' ||
    input.fieldKind === 'item.author';

  if (isTestimonial) {
    return [
      clampOpt('[Tên khách] — “Kết quả rõ sau 2 tuần sử dụng.”'),
      clampOpt('[Tên khách] — “Tư vấn nhanh, dễ hiểu, đáng tin.”'),
      clampOpt('[Tên khách / Vai trò] — “Quy trình chuyên nghiệp, hỗ trợ tốt.”'),
    ];
  }

  const base = raw || `${brand} — giải pháp phù hợp nhu cầu của bạn`;
  const short = clampOpt(base.split(/[.!?。]/).filter(Boolean)[0] || base, 120);
  const engaging = clampOpt(
    raw ? `${base} — trải nghiệm khác biệt ngay hôm nay` : `Khám phá ${brand}: lợi ích rõ ràng, dễ bắt đầu`,
  );
  const conversion = clampOpt(
    input.fieldKind === 'ctaLabel'
      ? raw
        ? `${raw} ngay`
        : 'Nhận tư vấn miễn phí'
      : raw
        ? `${base} Đăng ký để được tư vấn trong 24 giờ.`
        : `Đăng ký nhận tư vấn từ ${brand}`,
  );
  const pro = clampOpt(raw ? base.replace(/\s+/g, ' ') : `Giải pháp chuyên nghiệp từ ${brand}`);
  const friendly = clampOpt(
    raw ? `Cùng ${brand} giúp bạn: ${short}` : `Chúng tôi đồng hành cùng bạn — ${brand}`,
  );

  switch (input.action) {
    case 'shorter':
      return [short, clampOpt(short.slice(0, Math.max(24, Math.floor(short.length * 0.7))), 100), clampOpt(`${brand}: ${short}`, 100)];
    case 'more_engaging':
      return [engaging, clampOpt(`✨ ${short} — bắt đầu hôm nay`), clampOpt(`Vì sao chọn ${brand}? ${short}`)];
    case 'more_conversion':
      return [
        conversion,
        clampOpt(`${short} — để lại thông tin để được liên hệ`),
        clampOpt(`Chỉ còn vài bước để trải nghiệm ${brand}`),
      ];
    case 'more_professional':
      return [pro, clampOpt(`${brand} cung cấp giải pháp rõ ràng, đo lường được.`), clampOpt(`Cam kết chất lượng — ${short}`)];
    case 'more_friendly':
      return [friendly, clampOpt(`Xin chào! ${short}`), clampOpt(`Hãy để ${brand} hỗ trợ bạn một cách nhẹ nhàng.`)];
    case 'fix_spelling':
      return [clampOpt(base), clampOpt(base.replace(/\s{2,}/g, ' ')), short];
    case 'rewrite':
      return [engaging, pro, friendly];
    case 'suggest_3':
    default:
      return [engaging, conversion, pro];
  }
}

export function normalizeInlineAiRequest(raw: unknown): LandingPageInlineAiRequest {
  return landingPageInlineAiRequestSchema.parse(raw ?? {});
}

/** Stable hash of field content at request time (stale detection). */
export function hashInlineAiFieldContent(content: string): string {
  const s = String(content ?? '');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

/** Empty / tiny input → skip OpenAI; fallback is enough. */
export function shouldSkipOpenAiInlineSuggest(content: string): boolean {
  const t = String(content ?? '').trim();
  return t.length < 2;
}

/**
 * Post-process options: strip invented phones/prices/% when not in allowed context.
 * Testimonials must stay placeholder-shaped.
 */
export function sanitizeInlineAiTrustOptions(
  options: [string, string, string],
  ctx: {
    blockType: LandingPageBlockType | 'SEO';
    fieldKind: LandingPageInlineAiFieldKind;
    currentContent?: string;
    blockContext?: string;
    profile?: BusinessProfileData | null;
  },
): [string, string, string] {
  const allowed = [
    ctx.currentContent || '',
    ctx.blockContext || '',
    ctx.profile?.hotline || '',
    ctx.profile?.defaultCta || '',
    ctx.profile?.usp || '',
    ctx.profile?.productService || '',
    ctx.profile?.description || '',
  ].join('\n');

  const phoneRe = /(?:\+?84|0)\d[\d\s.-]{7,14}\d/g;
  const priceRe = /\d{1,3}(?:[.,]\d{3})+\s*(?:đ|vnd|vnđ|\$)|\$\s*\d+/gi;
  const pctRe = /\d{1,3}\s*%|\d{1,3}\s*phần\s*trăm/gi;
  const allowedPhones = new Set((allowed.match(phoneRe) || []).map((p) => p.replace(/\s+/g, '')));

  const scrub = (text: string): string => {
    let out = text;
    out = out.replace(phoneRe, (m) =>
      allowedPhones.has(m.replace(/\s+/g, '')) ? m : '[hotline]',
    );
    if (!priceRe.test(allowed)) out = out.replace(priceRe, '[giá]');
    priceRe.lastIndex = 0;
    if (!pctRe.test(allowed)) out = out.replace(pctRe, '');
    pctRe.lastIndex = 0;
    return out.replace(/\s{2,}/g, ' ').trim();
  };

  const isTestimonial =
    ctx.blockType === 'Testimonials' ||
    ctx.fieldKind === 'item.quote' ||
    ctx.fieldKind === 'item.author';

  const next = options.map((o, i) => {
    let t = scrub(String(o || ''));
    if (isTestimonial) {
      // Force placeholder shape — never keep inventing real-looking names.
      if (!/\[/.test(t) && !/Tên khách/i.test(t)) {
        t = `[Tên khách] — “${t.replace(/^["“]|["”]$/g, '').slice(0, 120)}”`;
      }
      t = t.replace(
        /\b(Anh|Chị|Mr\.|Mrs\.|Ms\.)\s+[A-ZÀ-Ỵ][\wÀ-ỹ]{1,20}\b/g,
        '[Tên khách]',
      );
    }
    return clampOpt(t || `Gợi ý ${i + 1}`, 2000);
  }) as [string, string, string];

  return next;
}

