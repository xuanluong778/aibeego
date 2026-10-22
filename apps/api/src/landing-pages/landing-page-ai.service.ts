import { Injectable, Logger } from '@nestjs/common';
import {
  applyLandingPageAiCopyToSpec,
  buildFallbackLandingPageAiCopy,
  buildFallbackInlineAiOptions,
  buildInlineAiPrompt,
  classifyLpAiFailure,
  extractJsonObject,
  LANDING_PAGE_AI_GOAL_LABELS,
  normalizeInlineAiRequest,
  normalizeLandingPageAiBrief,
  parseLandingPageAiCopy,
  parseLandingPageInlineAiResult,
  sanitizeInlineAiTrustOptions,
  shouldSkipOpenAiInlineSuggest,
  type BusinessProfileData,
  type LandingPageAiBrief,
  type LandingPageAiCopy,
  type LandingPageInlineAiRequest,
  type LandingPageInlineAiResult,
  type LandingPageSpec,
} from '@marketingspa/shared';
import { OpenAiService } from '../openai/openai.service';

@Injectable()
export class LandingPageAiService {
  private readonly logger = new Logger(LandingPageAiService.name);

  constructor(private readonly openai: OpenAiService) {}

  async generate(
    briefInput: LandingPageAiBrief,
  ): Promise<{ copy: LandingPageAiCopy; source: 'ai' | 'fallback'; warning?: string }> {
    const brief = normalizeLandingPageAiBrief(briefInput);
    if (!this.openai.isConfigured()) {
      return {
        copy: buildFallbackLandingPageAiCopy(brief),
        source: 'fallback',
        warning: 'OpenAI chưa cấu hình — dùng fallback copy',
      };
    }
    try {
      const goalLabel = LANDING_PAGE_AI_GOAL_LABELS[brief.pageGoal || 'lead'];
      const prompt = [
        'Bạn là copywriter landing page commercial/premium. Trả về ĐÚNG 1 JSON object, không markdown.',
        'schemaVersion phải là "landing-page-generator.v1".',
        'Keys bắt buộc: schemaVersion, headline, subheadline, painPoints[], usp, benefits[], cta, pricingCopy, faq[{question,answer}], seoTitle, metaDescription, mode:"ai".',
        'Keys khuyến nghị (để copy SÂU): benefitDetails[] (mỗi benefit 1 mô tả riêng 1–2 câu), features[], featureDetails[], processSteps[{title,description}], guarantee, theme, footerBody, leadFormHeadline.',
        `Thương hiệu: ${brief.brandName || 'chưa nêu'}`,
        `Loại hình / ngành: ${brief.businessType || 'chưa nêu'}`,
        `Sản phẩm/dịch vụ: ${brief.productService}`,
        `Giá / offer (CHỈ dùng nếu có): ${brief.offer || brief.price || 'chưa nêu'}`,
        `Khách hàng mục tiêu: ${brief.targetCustomer}`,
        `Pain point: ${brief.painPoint || 'suy từ audience + USP'}`,
        `Mục tiêu trang: ${goalLabel} (${brief.pageGoal || 'lead'})`,
        `Tone: ${brief.tone || 'professional'}`,
        `USP/lợi ích: ${brief.uspBenefits}`,
        brief.extraNotes ? `Ghi chú thêm: ${brief.extraNotes}` : '',
        brief.sourceUrl ? `Nguồn URL: ${brief.sourceUrl}` : '',
        'Viết tiếng Việt, conversion-focused, ĐỦ SÂU (không headline 5 từ + benefit 3 từ).',
        'Mỗi benefit/feature/process phải có description RIÊNG — không lặp lại cùng một câu USP.',
        'Narrative: pain → USP → benefit → CTA khớp goal.',
        'CẤM: bịa testimonial, tên khách, logo, rating sao, % tăng trưởng, doanh thu, hotline, chứng nhận nếu brief không có.',
        'Nếu thiếu số liệu: viết định tính rõ ràng, không bịa số.',
      ]
        .filter(Boolean)
        .join('\n');

      const raw = await this.openai.chatCompletion({
        messages: [
          { role: 'system', content: 'Output valid JSON only. No fake social proof or invented metrics.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.45,
        maxTokens: 3200,
        timeoutMs: 32000,
      });
      const parsed = parseLandingPageAiCopy(extractJsonObject(raw));
      return { copy: { ...parsed, mode: 'ai' }, source: 'ai' };
    } catch (err) {
      const classified = classifyLpAiFailure(err);
      this.logger.warn(`AI generate fallback: ${classified.code} ${String(err)}`);
      return {
        copy: buildFallbackLandingPageAiCopy(brief),
        source: 'fallback',
        warning: `${classified.message} (đã dùng fallback — không trừ credit thêm khi retry idempotent)`,
      };
    }
  }

  /**
   * Field-level inline AI: returns 3 options only — never mutates LandingPageSpec.
   */
  async suggestField(
    requestInput: LandingPageInlineAiRequest,
    profile?: BusinessProfileData | null,
  ): Promise<{ result: LandingPageInlineAiResult; source: 'ai' | 'fallback'; warning?: string }> {
    const req = normalizeInlineAiRequest(requestInput);
    const brand =
      profile?.brandName?.trim() || profile?.companyName?.trim() || undefined;

    const withTrust = (result: LandingPageInlineAiResult, mode: 'ai' | 'fallback') => {
      const options = sanitizeInlineAiTrustOptions(result.options, {
        blockType: req.blockType,
        fieldKind: req.fieldKind,
        currentContent: req.currentContent,
        blockContext: req.blockContext,
        profile,
      });
      return parseLandingPageInlineAiResult({
        ...result,
        options,
        mode,
      });
    };

    const fallback = (): LandingPageInlineAiResult =>
      withTrust(
        parseLandingPageInlineAiResult({
          schemaVersion: 'landing-page-inline-ai.v1',
          options: buildFallbackInlineAiOptions({
            action: req.action,
            fieldKind: req.fieldKind,
            currentContent: req.currentContent,
            blockType: req.blockType,
            brandName: brand,
          }),
          mode: 'fallback',
          fieldKind: req.fieldKind,
          action: req.action,
        }),
        'fallback',
      );

    // Empty / invalid input → do not call OpenAI (cost guard).
    if (shouldSkipOpenAiInlineSuggest(req.currentContent)) {
      return {
        result: fallback(),
        source: 'fallback',
        warning: 'Nội dung trống/ngắn — dùng fallback, không gọi OpenAI',
      };
    }

    if (!this.openai.isConfigured()) {
      return {
        result: fallback(),
        source: 'fallback',
        warning: 'OpenAI chưa cấu hình — dùng fallback',
      };
    }

    try {
      const prompt = buildInlineAiPrompt({
        action: req.action,
        fieldKind: req.fieldKind,
        currentContent: req.currentContent,
        blockType: req.blockType,
        pageGoal: req.pageGoal,
        blockContext: req.blockContext,
        profile,
      });
      const raw = await this.openai.chatCompletion({
        messages: [
          {
            role: 'system',
            content:
              'Output valid JSON only. Exactly 3 options. Vietnamese. Never invent phones, prices, discounts, fake reviews, or real customer names.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: req.action === 'fix_spelling' ? 0.2 : 0.55,
        maxTokens: 900,
        timeoutMs: 20000,
      });
      const extracted = extractJsonObject(raw);
      const extractedObj =
        extracted && typeof extracted === 'object' ? (extracted as Record<string, unknown>) : {};
      const parsed = withTrust(
        parseLandingPageInlineAiResult({
          ...extractedObj,
          fieldKind: req.fieldKind,
          action: req.action,
          mode: 'ai',
        }),
        'ai',
      );
      return { result: parsed, source: 'ai' };
    } catch (err) {
      const classified = classifyLpAiFailure(err);
      this.logger.warn(`Inline AI fallback: ${classified.code} ${String(err)}`);
      return {
        result: fallback(),
        source: 'fallback',
        warning: classified.message,
      };
    }
  }

  applyToSpec(spec: LandingPageSpec, copy: LandingPageAiCopy): LandingPageSpec {
    return applyLandingPageAiCopyToSpec(spec, copy);
  }
}
