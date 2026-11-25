"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.__test = void 0;
exports.analyzeOpinionSource = analyzeOpinionSource;
/**
 * POST /content-marketing/opinion/analyze
 * Resolve source (website SSRF-safe / Facebook Graph / paste / transcript) → structured AI brief.
 */
const common_1 = require("@nestjs/common");
const website_crawl_util_1 = require("../chatbot-cskh/utils/website-crawl.util");
const facebook_policy_import_logic_1 = require("./facebook-policy/facebook-policy-import.logic");
const facebook_policy_url_parse_1 = require("./facebook-policy/facebook-policy-url-parse");
const SINGLE_SOURCE_WARNING = 'Thông tin chưa được kiểm chứng từ nhiều phía';
const DEFAULT_ANGLES = [
    'Cuộc sống',
    'Đạo đức',
    'Trách nhiệm cộng đồng',
    'Bài học cá nhân',
    'Kinh doanh',
];
function emptyResult(partial) {
    return {
        sourceSummary: '',
        confirmedFacts: [],
        unverifiedClaims: [],
        mainControversy: '',
        suggestedAngles: [],
        missingInformation: [],
        warnings: [],
        insufficientData: true,
        ...partial,
    };
}
function ensureSingleSourceWarning(warnings, sourceCount) {
    const out = [...warnings];
    if (sourceCount <= 1 && !out.some((w) => w.includes('chưa được kiểm chứng'))) {
        out.push(SINGLE_SOURCE_WARNING);
    }
    return out;
}
function templateOpinionAnalyze(sourceText) {
    const text = sourceText.trim().slice(0, 4000);
    const first = text.split(/\n/).find((l) => l.trim())?.trim() ||
        'Sự việc đang được bàn luận trên dư luận.';
    const claimish = Array.from(text.matchAll(/(?:bị cáo buộc|bị tố|người ta nói|đồn rằng|theo tin đồn|có ý kiến cho rằng)[^.!?\n]{0,120}/giu))
        .map((m) => m[0].trim())
        .slice(0, 4);
    const factish = Array.from(text.matchAll(/(?:theo|ngày|tại|xảy ra|được ghi nhận|cơ quan|cảnh sát|bệnh viện)[^.!?\n]{10,140}/giu))
        .map((m) => m[0].trim())
        .slice(0, 4);
    return {
        sourceSummary: first.slice(0, 280) + (first.length > 280 ? '…' : ''),
        confirmedFacts: factish.length > 0
            ? factish
            : ['Chỉ có mô tả từ một nguồn — chưa đủ để xác nhận dữ kiện độc lập.'],
        unverifiedClaims: claimish.length > 0
            ? claimish
            : ['Các nhận định mang tính ý kiến / cáo buộc trong nguồn chưa được đối chiếu.'],
        mainControversy: 'Công chúng đang bất đồng về cách đánh giá đúng–sai và trách nhiệm liên quan sự việc (chưa kết luận).',
        suggestedAngles: DEFAULT_ANGLES.slice(0, 5),
        missingInformation: [
            'Thiếu phản hồi từ các bên liên quan',
            'Thiếu nguồn độc lập thứ hai',
            'Thiếu timeline / bằng chứng gốc nếu có',
        ],
        warnings: [SINGLE_SOURCE_WARNING],
        extractedText: text.slice(0, 8000),
        insufficientData: text.length < 40,
        analysisSource: 'template',
    };
}
async function resolveSourceText(params) {
    const warnings = [];
    const parts = [];
    let sourceType = 'manual';
    let insufficientData = false;
    let message;
    const pasted = (params.dto.sourceText ?? '').trim();
    const transcript = (params.dto.transcript ?? '').trim();
    const url = (params.dto.sourceUrl ?? '').trim();
    if (pasted) {
        parts.push(pasted);
        sourceType = 'paste';
    }
    if (transcript) {
        parts.push(`[Transcript]\n${transcript}`);
        if (sourceType === 'manual')
            sourceType = 'transcript';
    }
    if (url) {
        try {
            const kind = (0, facebook_policy_url_parse_1.detectPolicyUrlKind)(url, params.dto.urlKind);
            const imported = await (0, facebook_policy_import_logic_1.importPolicyUrl)({
                url,
                urlKind: kind === 'unknown' ? 'website' : kind,
                fanpageId: params.dto.fanpageId,
                userId: params.userId,
                organizationId: params.organizationId,
                prisma: params.prisma,
                config: params.config,
            });
            sourceType = imported.sourceType;
            warnings.push(...(imported.warnings || []));
            if (imported.insufficientData) {
                insufficientData = true;
                message =
                    imported.message ||
                        'Không lấy đủ nội dung từ URL — hãy dán nội dung hoặc transcript thủ công.';
            }
            const chunk = [imported.headline, imported.primaryText, imported.description]
                .filter(Boolean)
                .join('\n\n')
                .trim();
            if (chunk)
                parts.push(chunk);
            else if (!pasted && !transcript) {
                insufficientData = true;
                message =
                    message ||
                        'Không lấy được nội dung từ URL — hãy dán nội dung hoặc transcript thủ công.';
            }
        }
        catch (e) {
            if (e instanceof website_crawl_util_1.CrawlValidationError || e instanceof common_1.BadRequestException) {
                throw e instanceof common_1.BadRequestException
                    ? e
                    : new common_1.BadRequestException(e.message);
            }
            warnings.push(e instanceof Error ? e.message : 'Lỗi khi tải URL');
            if (!pasted && !transcript) {
                return {
                    text: '',
                    sourceType: 'url_failed',
                    warnings,
                    sourceCount: 0,
                    insufficientData: true,
                    message: 'Không lấy được nội dung từ URL — hãy dán nội dung hoặc transcript thủ công.',
                };
            }
        }
    }
    const text = parts.join('\n\n').trim();
    // Count discrete source channels (url fetch vs paste vs transcript)
    let sourceCount = 0;
    if (url && text)
        sourceCount += 1;
    if (pasted)
        sourceCount += 1;
    if (transcript)
        sourceCount += 1;
    if (sourceCount === 0 && text)
        sourceCount = 1;
    if (!text) {
        return {
            text: '',
            sourceType,
            warnings,
            sourceCount: 0,
            insufficientData: true,
            message: message ||
                'Thiếu nội dung nguồn. Cung cấp URL, dán nội dung hoặc transcript thủ công.',
        };
    }
    return {
        text,
        sourceType,
        warnings,
        sourceCount: Math.max(1, sourceCount),
        insufficientData: insufficientData || text.length < 40,
        message,
    };
}
async function aiOpinionAnalyze(sourceText, openai) {
    const prompt = `Bạn là biên tập viên trung lập (tiếng Việt). Phân tích nguồn tin dưới đây để phục vụ viết chính kiến.

QUY TẮC BẮT BUỘC:
- Tóm tắt ngắn gọn, đúng nguồn — không thêm tình tiết.
- Phân biệt rõ: dữ kiện có thể xác nhận từ nguồn vs lời cáo buộc / ý kiến chưa kiểm chứng.
- KHÔNG kết luận ai đúng hoặc sai.
- KHÔNG bịa phát ngôn, động cơ, hoặc tình tiết không có trong nguồn.
- Nếu chỉ thấy một nguồn, thêm cảnh báo đúng câu: "${SINGLE_SOURCE_WARNING}"
- Gợi ý 3–5 góc nhìn để người dùng chọn (Cuộc sống / Đạo đức / Cộng đồng / Kinh doanh / Người nổi tiếng / Bài học cá nhân…).

Trả JSON thuần đúng schema:
{
  "sourceSummary": "",
  "confirmedFacts": [],
  "unverifiedClaims": [],
  "mainControversy": "",
  "suggestedAngles": [],
  "missingInformation": [],
  "warnings": []
}

Nguồn:
"""
${sourceText.slice(0, 7000)}
"""`;
    const raw = await openai.chatCompletion({
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 1200,
        temperature: 0.2,
    });
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    const fallback = templateOpinionAnalyze(sourceText);
    const warnings = ensureSingleSourceWarning(Array.isArray(parsed.warnings) ? parsed.warnings.filter(Boolean) : fallback.warnings, 1);
    const angles = Array.isArray(parsed.suggestedAngles)
        ? parsed.suggestedAngles.filter(Boolean).slice(0, 5)
        : fallback.suggestedAngles;
    return {
        sourceSummary: (parsed.sourceSummary || fallback.sourceSummary).trim(),
        confirmedFacts: Array.isArray(parsed.confirmedFacts)
            ? parsed.confirmedFacts.filter(Boolean).slice(0, 8)
            : fallback.confirmedFacts,
        unverifiedClaims: Array.isArray(parsed.unverifiedClaims)
            ? parsed.unverifiedClaims.filter(Boolean).slice(0, 8)
            : fallback.unverifiedClaims,
        mainControversy: (parsed.mainControversy || fallback.mainControversy).trim(),
        suggestedAngles: angles.length >= 3 ? angles : DEFAULT_ANGLES.slice(0, 5),
        missingInformation: Array.isArray(parsed.missingInformation)
            ? parsed.missingInformation.filter(Boolean).slice(0, 8)
            : fallback.missingInformation,
        warnings,
        extractedText: sourceText.slice(0, 8000),
        analysisSource: 'ai',
    };
}
async function analyzeOpinionSource(params) {
    const url = (params.dto.sourceUrl ?? '').trim();
    const pasted = (params.dto.sourceText ?? '').trim();
    const transcript = (params.dto.transcript ?? '').trim();
    if (!url && !pasted && !transcript) {
        return emptyResult({
            message: 'Thiếu nội dung nguồn. Cung cấp URL website/Facebook, dán nội dung hoặc transcript.',
            warnings: [],
        });
    }
    let resolved;
    try {
        resolved = await resolveSourceText(params);
    }
    catch (e) {
        if (e instanceof common_1.BadRequestException)
            throw e;
        if (e instanceof website_crawl_util_1.CrawlValidationError) {
            throw new common_1.BadRequestException(e.message);
        }
        throw e;
    }
    if (!resolved.text) {
        return emptyResult({
            warnings: ensureSingleSourceWarning(resolved.warnings, 0),
            sourceType: resolved.sourceType,
            insufficientData: true,
            message: resolved.message,
        });
    }
    let analysis;
    if (params.openai?.isConfigured()) {
        try {
            analysis = await aiOpinionAnalyze(resolved.text, params.openai);
        }
        catch {
            analysis = templateOpinionAnalyze(resolved.text);
        }
    }
    else {
        analysis = templateOpinionAnalyze(resolved.text);
    }
    analysis.warnings = ensureSingleSourceWarning([...resolved.warnings, ...analysis.warnings], resolved.sourceCount);
    analysis.sourceType = resolved.sourceType;
    analysis.extractedText = resolved.text.slice(0, 8000);
    analysis.insufficientData = resolved.insufficientData;
    if (resolved.message)
        analysis.message = resolved.message;
    if (analysis.suggestedAngles.length < 3) {
        analysis.suggestedAngles = DEFAULT_ANGLES.slice(0, 5);
    }
    return analysis;
}
/** Exported for unit tests without network */
exports.__test = {
    templateOpinionAnalyze,
    ensureSingleSourceWarning,
    SINGLE_SOURCE_WARNING,
    emptyResult,
};
