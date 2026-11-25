"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SPA_BEAUTY_SLUG = exports.SPA_BEAUTY_INDUSTRY_NAME = exports.SPA_BEAUTY_INDUSTRY_ID = void 0;
exports.resolveIndustryContext = resolveIndustryContext;
exports.slugifyIndustry = slugifyIndustry;
exports.industryExpertIntro = industryExpertIntro;
exports.industryBrandBridge = industryBrandBridge;
exports.regulatedComplianceBlock = regulatedComplianceBlock;
exports.buildFullIndustryPromptContext = buildFullIndustryPromptContext;
exports.containsSpaLeakage = containsSpaLeakage;
const content_industry_constants_1 = require("./content-industry.constants");
var content_industry_constants_2 = require("./content-industry.constants");
Object.defineProperty(exports, "SPA_BEAUTY_INDUSTRY_ID", { enumerable: true, get: function () { return content_industry_constants_2.SPA_BEAUTY_INDUSTRY_ID; } });
Object.defineProperty(exports, "SPA_BEAUTY_INDUSTRY_NAME", { enumerable: true, get: function () { return content_industry_constants_2.SPA_BEAUTY_INDUSTRY_NAME; } });
Object.defineProperty(exports, "SPA_BEAUTY_SLUG", { enumerable: true, get: function () { return content_industry_constants_2.SPA_BEAUTY_SLUG; } });
const REGULATED_PATTERNS = [
    { kind: 'gynecology', re: /phụ khoa|phu khoa|sản phụ|phụ sản/i },
    { kind: 'weight_loss', re: /giảm cân|giam can|giảm béo|detox giảm/i },
    { kind: 'insurance', re: /bảo hiểm|bao hiem|insurance/i },
    { kind: 'health', re: /sức khỏe|suc khoe|y tế|yte|healthcare|health\b|nha khoa|phòng khám/i },
];
/** Nhãn ngành cho prompt AI — ưu tiên custom → name → Spa/Làm đẹp (compat). */
function resolveIndustryContext(input) {
    const custom = input?.customIndustry?.trim() || '';
    const name = input?.industryName?.trim() || '';
    const label = custom || name || content_industry_constants_1.SPA_BEAUTY_INDUSTRY_NAME;
    const isCustom = Boolean(custom);
    const isSpaBeauty = !isCustom &&
        (input?.industryId === content_industry_constants_1.SPA_BEAUTY_INDUSTRY_ID ||
            label === content_industry_constants_1.SPA_BEAUTY_INDUSTRY_NAME ||
            /^spa\s*\/\s*làm\s*đẹp$/i.test(label) ||
            /^spa\/làm đẹp$/i.test(label));
    let regulatedKind = null;
    for (const p of REGULATED_PATTERNS) {
        if (p.re.test(label)) {
            regulatedKind = p.kind;
            break;
        }
    }
    return {
        label,
        isSpaBeauty,
        isCustom,
        isRegulated: regulatedKind != null,
        regulatedKind,
        slugHint: slugifyIndustry(label),
    };
}
function slugifyIndustry(label) {
    return (label
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'custom');
}
function industryExpertIntro(ctx, isSpaBeautyFlag) {
    const isSpa = typeof ctx === 'string' ? Boolean(isSpaBeautyFlag) : ctx.isSpaBeauty;
    const label = typeof ctx === 'string' ? ctx : ctx.label;
    if (isSpa) {
        return 'Bạn là chuyên gia content marketing spa/wellness / làm đẹp tại Việt Nam.';
    }
    return `Bạn là chuyên gia content marketing ngành "${label}" tại Việt Nam. Tuyệt đối KHÔNG dùng thuật ngữ spa, liệu trình thẩm mỹ, chăm sóc da, hoặc ngữ cảnh làm đẹp trừ khi ngành đúng là Spa/Làm đẹp.`;
}
/** Block gắn thương hiệu — chỉ spa khi ngành spa; ngành khác dùng cầu nối trung tính. */
function industryBrandBridge(ctx) {
    if (ctx.isSpaBeauty) {
        return 'Một spa tử tế không chỉ làm da khách đẹp hơn — mà làm họ tin lại vào chính mình. Chăm sóc bản thân không phải phù phiếm, đó là lòng tự trọng.';
    }
    return `Thương hiệu ngành "${ctx.label}" nên hiện diện tự nhiên qua giá trị thật, câu chuyện khách hàng và chuyên môn — không nhồi quảng cáo lộ liễu, không mượn ngữ cảnh spa/làm đẹp.`;
}
function regulatedComplianceBlock(ctx) {
    if (!ctx.isRegulated) {
        return 'Tuân thủ chính sách nền tảng: tránh cam kết tuyệt đối, tránh nội dung gây hiểu nhầm.';
    }
    const kindLabel = ctx.regulatedKind === 'insurance'
        ? 'bảo hiểm'
        : ctx.regulatedKind === 'gynecology'
            ? 'phụ khoa'
            : ctx.regulatedKind === 'weight_loss'
                ? 'giảm cân'
                : 'sức khỏe';
    return `NGÀNH NHẠY CẢM (${kindLabel}): CẤM cam kết chữa khỏi, kết quả chắc chắn 100%, "đảm bảo hiệu quả", thay thế tư vấn y tế/chuyên gia. Dùng ngôn ngữ thận trọng: "có thể hỗ trợ", "tùy cơ địa", "tham khảo chuyên gia". Thêm disclaimer ngắn khi phù hợp.`;
}
/** Ghép ngữ cảnh đầy đủ cho mọi prompt generate. */
function buildFullIndustryPromptContext(input) {
    const ctx = resolveIndustryContext(input.industry);
    const lines = [
        `Ngành nghề: ${ctx.label}${ctx.isCustom ? ' (ngành tùy chỉnh — tự suy luận thuật ngữ phù hợp)' : ''}`,
        `Sản phẩm/dịch vụ: ${input.productService?.trim() || '(chưa cung cấp)'}`,
        `Khách hàng mục tiêu: ${input.targetAudience?.trim() || '(AI suy luận hợp lý theo ngành)'}`,
        `Mục tiêu bài viết: ${input.goal?.trim() || '(tăng nhận diện / chuyển đổi)'}`,
        `Giọng văn: ${input.tone?.trim() || '(phù hợp ngành)'}`,
        `Cách xưng hô: ${input.pronoun?.trim() || '(AI tự chọn phù hợp)'}`,
        `Nền tảng đăng: ${input.platform?.trim() || 'facebook'}`,
        `Độ dài: ${input.length?.trim() || 'vừa'}`,
        `CTA mong muốn: ${input.cta?.trim() || '(AI đề xuất CTA phù hợp ngành)'}`,
        `Từ khóa / thương hiệu: ${[input.keywords, input.brandInfo].filter(Boolean).join(' | ') || '(không bắt buộc)'}`,
        regulatedComplianceBlock(ctx),
        ctx.isSpaBeauty
            ? 'Được phép dùng thuật ngữ spa/làm đẹp khi hợp ngữ cảnh.'
            : 'CẤM chèn spa, liệu trình da, chăm sóc da, thẩm mỹ viện trừ khi user nêu rõ trong sản phẩm.',
    ];
    return { ctx, block: lines.join('\n') };
}
function containsSpaLeakage(text, ctx) {
    if (ctx.isSpaBeauty)
        return false;
    return /\bspa\b|liệu trình\s*(da|trẻ hóa)|chăm sóc da|#spa\b|#lamdep\b|thẩm mỹ viện|facial|skincare/i.test(text);
}
