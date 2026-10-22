/**
 * Landing Page — AI Page Doctor (scores + safe patch proposals).
 * Deterministic heuristic analysis; AI may refine copy only via patches.
 */

import { z } from 'zod';
import type { LandingPageBlock, LandingPageSpec } from './landing-page-types';
import { markLandingPageFieldSources } from './landing-page-business-profile';

export const LANDING_PAGE_DOCTOR_DIMS = [
  'headline',
  'clarity',
  'cta',
  'trust',
  'offer',
  'formFriction',
  'faq',
  'seo',
  'mobileReadability',
  'completeness',
] as const;
export type LandingPageDoctorDim = (typeof LANDING_PAGE_DOCTOR_DIMS)[number];

export const landingPageDoctorFindingSchema = z.object({
  dim: z.enum(LANDING_PAGE_DOCTOR_DIMS),
  status: z.enum(['good', 'warn', 'bad']),
  score: z.number().min(0).max(100),
  message: z.string().max(400),
  suggestion: z.string().max(600).optional(),
});

export type LandingPageDoctorFinding = z.infer<typeof landingPageDoctorFindingSchema>;

export const landingPageDoctorPatchSchema = z.object({
  id: z.string().max(64),
  kind: z.enum([
    'set_seo_title',
    'set_seo_meta',
    'set_block_field',
    'set_lead_submit_label',
    'add_faq_item',
    'add_guarantee_body',
  ]),
  label: z.string().max(200),
  path: z.string().max(120),
  before: z.string().max(2000).optional(),
  after: z.string().max(2000),
  blockId: z.string().max(64).optional(),
  field: z.string().max(40).optional(),
});

export type LandingPageDoctorPatch = z.infer<typeof landingPageDoctorPatchSchema>;

export const landingPageDoctorReportSchema = z.object({
  schemaVersion: z.literal('landing-page-page-doctor.v1'),
  overallScore: z.number().min(0).max(100),
  findings: z.array(landingPageDoctorFindingSchema).min(1).max(20),
  patches: z.array(landingPageDoctorPatchSchema).max(20),
  mode: z.enum(['heuristic', 'ai', 'fallback']),
  warnings: z.array(z.string().max(300)).max(10).optional().default([]),
});

export type LandingPageDoctorReport = z.infer<typeof landingPageDoctorReportSchema>;

function blockByType(spec: LandingPageSpec, type: string): LandingPageBlock | undefined {
  return spec.blocks.find((b) => b.type === type && b.enabled !== false);
}

function textLen(v: unknown): number {
  return typeof v === 'string' ? v.trim().length : 0;
}

function uid(p: string): string {
  return `${p}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Heuristic Page Doctor — never invents testimonials or metrics. */
export function analyzeLandingPageHeuristic(spec: LandingPageSpec): LandingPageDoctorReport {
  const findings: LandingPageDoctorFinding[] = [];
  const patches: LandingPageDoctorPatch[] = [];
  const hero = blockByType(spec, 'Hero');
  const cta = blockByType(spec, 'CTA');
  const lead = blockByType(spec, 'LeadForm');
  const faq = blockByType(spec, 'FAQ');
  const guarantee = blockByType(spec, 'Guarantee');
  const testimonials = blockByType(spec, 'Testimonials');
  const benefits = blockByType(spec, 'Benefits');

  const heroHeadline = hero && 'headline' in hero ? String((hero as { headline?: string }).headline || '') : '';
  const heroSub = hero && 'subheadline' in hero ? String((hero as { subheadline?: string }).subheadline || '') : '';
  const ctaLabel =
    (hero && 'ctaLabel' in hero ? String((hero as { ctaLabel?: string }).ctaLabel || '') : '') ||
    (cta && 'ctaLabel' in cta ? String((cta as { ctaLabel?: string }).ctaLabel || '') : '');

  // headline
  {
    const len = textLen(heroHeadline);
    let status: 'good' | 'warn' | 'bad' = 'good';
    let score = 85;
    let message = '✓ Headline rõ ràng';
    let suggestion: string | undefined;
    if (len < 12) {
      status = 'bad';
      score = 35;
      message = '⚠ Headline quá ngắn hoặc trống';
      suggestion = 'Viết headline 40–80 ký tự, nêu lợi ích chính.';
      if (hero) {
        patches.push({
          id: uid('p'),
          kind: 'set_block_field',
          label: 'Cải thiện Hero headline',
          path: `${hero.id}.headline`,
          blockId: hero.id,
          field: 'headline',
          before: heroHeadline,
          after: 'Giải pháp rõ ràng giúp bạn đạt kết quả nhanh hơn',
        });
      }
    } else if (len > 120) {
      status = 'warn';
      score = 60;
      message = '⚠ Headline hơi dài';
      suggestion = 'Rút gọn dưới 100 ký tự để dễ đọc trên mobile.';
    }
    findings.push({ dim: 'headline', status, score, message, suggestion });
  }

  // clarity
  {
    const subOk = textLen(heroSub) >= 20;
    const hasBenefits =
      benefits &&
      'items' in benefits &&
      Array.isArray((benefits as { items?: unknown[] }).items) &&
      (benefits as { items: unknown[] }).items.length >= 2;
    const score = (subOk ? 40 : 15) + (hasBenefits ? 45 : 20);
    findings.push({
      dim: 'clarity',
      status: score >= 75 ? 'good' : score >= 50 ? 'warn' : 'bad',
      score,
      message: score >= 75 ? '✓ Thông điệp khá rõ' : '⚠ Cần làm rõ lợi ích / subheadline',
      suggestion: !subOk
        ? 'Thêm subheadline giải thích lợi ích trong 1–2 câu.'
        : !hasBenefits
          ? 'Thêm 3–5 benefits cụ thể.'
          : undefined,
    });
    if (hero && textLen(heroSub) < 20) {
      patches.push({
        id: uid('p'),
        kind: 'set_block_field',
        label: 'Bổ sung Hero subheadline',
        path: `${hero.id}.subheadline`,
        blockId: hero.id,
        field: 'subheadline',
        before: heroSub,
        after: 'Một giải pháp dễ dùng, hỗ trợ nhanh — phù hợp nhu cầu thực tế của bạn.',
      });
    }
  }

  // CTA
  {
    const len = textLen(ctaLabel);
    const score = len >= 6 && len <= 40 ? 90 : len ? 55 : 25;
    findings.push({
      dim: 'cta',
      status: score >= 75 ? 'good' : score >= 50 ? 'warn' : 'bad',
      score,
      message: score >= 75 ? '✓ CTA có mặt' : '⚠ CTA yếu hoặc thiếu',
      suggestion: score < 75 ? 'Dùng CTA hành động ngắn: “Nhận tư vấn miễn phí”.' : undefined,
    });
    if (hero && len < 6) {
      patches.push({
        id: uid('p'),
        kind: 'set_block_field',
        label: 'Cập nhật CTA Hero',
        path: `${hero.id}.ctaLabel`,
        blockId: hero.id,
        field: 'ctaLabel',
        before: ctaLabel,
        after: 'Nhận tư vấn miễn phí',
      });
    }
  }

  // trust
  {
    const hasG =
      guarantee &&
      'body' in guarantee &&
      textLen((guarantee as { body?: string }).body) >= 20;
    const hasT =
      testimonials &&
      'items' in testimonials &&
      Array.isArray((testimonials as { items?: unknown[] }).items) &&
      (testimonials as { items: unknown[] }).items.length > 0;
    // Do NOT invent testimonials — only suggest guarantee text.
    const score = (hasG ? 50 : 20) + (hasT ? 40 : 15);
    findings.push({
      dim: 'trust',
      status: score >= 70 ? 'good' : 'warn',
      score,
      message: hasT || hasG ? '✓ Có tín hiệu tin cậy' : '⚠ Thiếu trust / social proof',
      suggestion: !hasG
        ? 'Thêm cam kết rõ (không bịa review). Có thể dùng placeholder testimonial nếu cần.'
        : undefined,
    });
    if (guarantee && !hasG) {
      patches.push({
        id: uid('p'),
        kind: 'add_guarantee_body',
        label: 'Bổ sung nội dung Guarantee',
        path: `${guarantee.id}.body`,
        blockId: guarantee.id,
        field: 'body',
        before: String((guarantee as { body?: string }).body || ''),
        after: 'Cam kết hỗ trợ rõ ràng — tư vấn trung thực, không phát sinh phí ẩn.',
      });
    }
  }

  // offer
  {
    const pricing = blockByType(spec, 'Pricing');
    const score = pricing ? 80 : 45;
    findings.push({
      dim: 'offer',
      status: pricing ? 'good' : 'warn',
      score,
      message: pricing ? '✓ Có block Pricing/offer' : '⚠ Chưa có offer/pricing rõ',
      suggestion: pricing ? undefined : 'Thêm Pricing hoặc nêu giá trị ưu đãi (chỉ khi có thật).',
    });
  }

  // form friction
  {
    const fields =
      lead && 'fields' in lead && Array.isArray((lead as { fields?: unknown[] }).fields)
        ? (lead as { fields: unknown[] }).fields
        : [];
    const n = fields.length;
    const score = !lead ? 30 : n <= 4 ? 88 : n <= 6 ? 65 : 40;
    findings.push({
      dim: 'formFriction',
      status: score >= 75 ? 'good' : score >= 50 ? 'warn' : 'bad',
      score,
      message: !lead
        ? '⚠ Thiếu LeadForm'
        : n <= 4
          ? '✓ Form gọn'
          : '⚠ Form quá nhiều field',
      suggestion: n > 4 ? 'Giữ 2–4 field bắt buộc (tên, SĐT, email).' : undefined,
    });
    if (lead && 'submitLabel' in lead && textLen((lead as { submitLabel?: string }).submitLabel) < 4) {
      patches.push({
        id: uid('p'),
        kind: 'set_lead_submit_label',
        label: 'Cải thiện nút gửi form',
        path: `${lead.id}.submitLabel`,
        blockId: lead.id,
        field: 'submitLabel',
        before: String((lead as { submitLabel?: string }).submitLabel || ''),
        after: 'Gửi thông tin',
      });
    }
  }

  // FAQ
  {
    const items =
      faq && 'items' in faq && Array.isArray((faq as { items?: unknown[] }).items)
        ? (faq as { items: unknown[] }).items
        : [];
    const score = items.length >= 3 ? 90 : items.length >= 1 ? 60 : 35;
    findings.push({
      dim: 'faq',
      status: score >= 75 ? 'good' : score >= 50 ? 'warn' : 'bad',
      score,
      message: items.length >= 3 ? '✓ FAQ đủ' : '⚠ FAQ thiếu',
      suggestion: items.length < 3 ? 'Thêm FAQ về giá, thời gian, cam kết.' : undefined,
    });
    if (faq && items.length < 2) {
      patches.push({
        id: uid('p'),
        kind: 'add_faq_item',
        label: 'Thêm FAQ mẫu',
        path: `${faq.id}.items`,
        blockId: faq.id,
        after: JSON.stringify({
          question: 'Tôi nhận phản hồi sau bao lâu?',
          answer: 'Thường trong 24 giờ làm việc sau khi để lại thông tin.',
        }),
      });
    }
  }

  // SEO
  {
    const titleOk = textLen(spec.seo.title) >= 10 && textLen(spec.seo.title) <= 70;
    const metaOk = textLen(spec.seo.metaDescription) >= 50;
    const score = (titleOk ? 50 : 20) + (metaOk ? 45 : 15);
    findings.push({
      dim: 'seo',
      status: score >= 75 ? 'good' : 'warn',
      score,
      message: score >= 75 ? '✓ SEO cơ bản ổn' : '⚠ SEO title/meta cần chỉnh',
      suggestion: !titleOk ? 'SEO title 30–60 ký tự.' : !metaOk ? 'Meta 120–160 ký tự.' : undefined,
    });
    if (!titleOk) {
      patches.push({
        id: uid('p'),
        kind: 'set_seo_title',
        label: 'Cải thiện SEO title',
        path: 'seo.title',
        before: spec.seo.title,
        after: (heroHeadline || spec.seo.title || 'Landing Page').slice(0, 60),
      });
    }
    if (!metaOk) {
      patches.push({
        id: uid('p'),
        kind: 'set_seo_meta',
        label: 'Cải thiện meta description',
        path: 'seo.metaDescription',
        before: spec.seo.metaDescription,
        after: (heroSub || spec.seo.metaDescription || 'Mô tả ngắn lợi ích chính của trang.').slice(
          0,
          160,
        ),
      });
    }
  }

  // mobile / readability
  {
    const longBlocks = spec.blocks.filter((b) => {
      const body = 'body' in b ? textLen((b as { body?: string }).body) : 0;
      const sub = 'subheadline' in b ? textLen((b as { subheadline?: string }).subheadline) : 0;
      return body > 800 || sub > 280;
    }).length;
    const score = longBlocks ? 55 : 88;
    findings.push({
      dim: 'mobileReadability',
      status: longBlocks ? 'warn' : 'good',
      score,
      message: longBlocks ? '⚠ Một số đoạn hơi dài trên mobile' : '✓ Độ dài copy ổn',
      suggestion: longBlocks ? 'Rút gọn đoạn dài, xuống dòng rõ.' : undefined,
    });
  }

  // completeness
  {
    const needed = ['Hero', 'LeadForm', 'CTA', 'Footer'];
    const have = needed.filter((t) => spec.blocks.some((b) => b.type === t && b.enabled !== false));
    const score = Math.round((have.length / needed.length) * 100);
    findings.push({
      dim: 'completeness',
      status: score >= 75 ? 'good' : 'warn',
      score,
      message: `✓ Có ${have.length}/${needed.length} block cốt lõi`,
      suggestion: score < 100 ? `Thiếu: ${needed.filter((t) => !have.includes(t)).join(', ')}` : undefined,
    });
  }

  const overallScore = Math.round(
    findings.reduce((s, f) => s + f.score, 0) / Math.max(1, findings.length),
  );

  return landingPageDoctorReportSchema.parse({
    schemaVersion: 'landing-page-page-doctor.v1',
    overallScore,
    findings,
    patches: patches.slice(0, 12),
    mode: 'heuristic',
    warnings: [
      'Không bịa testimonial/số liệu.',
      'Không đổi tracking/domain/publish.',
      'Không xóa block quan trọng tự động.',
    ],
  });
}

/**
 * Apply selected doctor patches. Never removes blocks. Never touches tracking.
 * Marks applied fields as `ai`.
 */
export function applyLandingPageDoctorPatches(
  spec: LandingPageSpec,
  patches: LandingPageDoctorPatch[],
  selectedIds: string[],
): LandingPageSpec {
  const allow = new Set(selectedIds);
  let next = structuredClone(spec) as LandingPageSpec;
  const sourceKeys: string[] = [];

  for (const p of patches) {
    if (!allow.has(p.id)) continue;
    if (p.kind === 'set_seo_title') {
      next.seo = { ...next.seo, title: p.after.slice(0, 120) };
      sourceKeys.push('seo.title');
      continue;
    }
    if (p.kind === 'set_seo_meta') {
      next.seo = { ...next.seo, metaDescription: p.after.slice(0, 320) };
      sourceKeys.push('seo.metaDescription');
      continue;
    }
    if (
      (p.kind === 'set_block_field' ||
        p.kind === 'set_lead_submit_label' ||
        p.kind === 'add_guarantee_body') &&
      p.blockId &&
      p.field
    ) {
      next = {
        ...next,
        blocks: next.blocks.map((b) => {
          if (b.id !== p.blockId) return b;
          return { ...b, [p.field!]: p.after } as LandingPageBlock;
        }),
      };
      sourceKeys.push(`${p.blockId}.${p.field}`);
      continue;
    }
    if (p.kind === 'add_faq_item' && p.blockId) {
      let parsed: { question: string; answer: string };
      try {
        parsed = JSON.parse(p.after) as { question: string; answer: string };
      } catch {
        continue;
      }
      next = {
        ...next,
        blocks: next.blocks.map((b) => {
          if (b.id !== p.blockId || b.type !== 'FAQ') return b;
          const items = [
            ...((b as { items?: Array<{ id: string; question: string; answer: string }> }).items ||
              []),
            {
              id: uid('q'),
              question: String(parsed.question || '').slice(0, 200),
              answer: String(parsed.answer || '').slice(0, 600),
            },
          ].slice(0, 20);
          return { ...b, items } as LandingPageBlock;
        }),
      };
      sourceKeys.push(`${p.blockId}.items`);
    }
  }

  return markLandingPageFieldSources(next, sourceKeys, 'ai');
}
