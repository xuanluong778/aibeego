"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const industry_context_util_1 = require("./industry-context.util");
const industry_suggestions_logic_1 = require("./industry-suggestions.logic");
const advanced_article_logic_1 = require("./advanced-article-logic");
const content_marketing_logic_1 = require("./content-marketing-logic");
function assert(cond, msg) {
    if (!cond)
        throw new Error(msg);
}
async function main() {
    const tech = (0, industry_context_util_1.resolveIndustryContext)({ industryName: 'Công nghệ' });
    assert(tech.label === 'Công nghệ', 'tech label');
    assert(!tech.isSpaBeauty, 'tech not spa');
    assert(!tech.isRegulated, 'tech not regulated');
    const health = (0, industry_context_util_1.resolveIndustryContext)({ industryName: 'Sức khỏe' });
    assert(health.isRegulated && health.regulatedKind === 'health', 'health regulated');
    const custom = (0, industry_context_util_1.resolveIndustryContext)({ customIndustry: 'Pet Grooming cao cấp' });
    assert(custom.isCustom && !custom.isSpaBeauty, 'custom not spa');
    const { block } = (0, industry_context_util_1.buildFullIndustryPromptContext)({
        industry: { industryName: 'Bất động sản' },
        productService: 'Căn hộ 2PN',
        targetAudience: 'Gia đình trẻ',
        goal: 'lead',
        tone: 'tin cậy',
        pronoun: 'anh/em',
        platform: 'facebook',
        length: 'medium',
        cta: 'Đặt lịch xem nhà',
        keywords: 'căn hộ quận 7',
        brandInfo: 'ABC Realty',
    });
    assert(block.includes('Bất động sản'), 'block has industry');
    assert(/CẤM chèn spa/i.test(block), 'block forbids spa');
    const spaSug = await (0, industry_suggestions_logic_1.buildIndustrySuggestions)({ industryName: 'Spa/Làm đẹp' });
    assert(spaSug.source === 'catalog', 'spa catalog');
    assert(spaSug.hashtags.some((h) => /spa/i.test(h)), 'spa hashtags');
    const techSug = await (0, industry_suggestions_logic_1.buildIndustrySuggestions)({ industryName: 'Công nghệ' });
    assert(techSug.source === 'catalog', 'tech catalog');
    assert(!techSug.hashtags.some((h) => /#spa/i.test(h)), 'tech no spa hashtag');
    const eduSug = await (0, industry_suggestions_logic_1.buildIndustrySuggestions)({ industryName: 'Giáo dục' });
    assert(eduSug.topics.length >= 3, 'edu topics');
    const foodSug = await (0, industry_suggestions_logic_1.buildIndustrySuggestions)({ industryName: 'Ẩm thực' });
    assert(foodSug.ctas.some((c) => /đặt bàn|order|ship|check-in/i.test(c)), 'food cta');
    const customSug = await (0, industry_suggestions_logic_1.buildIndustrySuggestions)({ customIndustry: 'Xe máy điện' });
    assert(customSug.isCustom, 'custom flag');
    assert(customSug.industry === 'Xe máy điện', 'custom name');
    assert(!/#spa/i.test(customSug.hashtags.join(' ')), 'custom no spa tag');
    const baseDto = {
        writingStyle: 'expert_consultant',
        demographic: 'female_25_35',
        articleGoal: 'direct_sales',
        productService: 'Phần mềm CRM',
        painPoints: 'Quản lý khách hàng phân tán, đội sale quên follow-up',
        postLength: 'medium',
        ctaType: 'inbox',
        industryName: 'Công nghệ',
    };
    const article = (0, advanced_article_logic_1.templateGenerateAdvanced)(baseDto);
    assert(!(0, industry_context_util_1.containsSpaLeakage)(article.final_article, tech), 'article no spa leak');
    assert(!/#spa/i.test(article.hashtags.join(' ')), 'article hashtags clean');
    const reDto = {
        ...baseDto,
        productService: 'Căn hộ view sông',
        painPoints: 'Lo pháp lý, sợ mua nhầm dự án',
        industryName: 'Bất động sản',
    };
    const re = (0, advanced_article_logic_1.templateGenerateAdvanced)(reDto);
    assert(!/\bspa\b/i.test(re.final_article), 'bds no spa');
    const foodDto = {
        ...baseDto,
        productService: 'Set lẩu hải sản',
        painPoints: 'Cuối tuần không biết ăn gì với nhóm bạn',
        industryName: 'Ẩm thực',
    };
    const food = (0, advanced_article_logic_1.templateGenerateAdvanced)(foodDto);
    assert(!/\bspa\b|#lamdep/i.test(food.final_article + food.hashtags.join(' ')), 'food clean');
    const eduDto = {
        ...baseDto,
        productService: 'Khóa IELTS online',
        painPoints: 'Học mãi không lên band',
        industryName: 'Giáo dục',
    };
    const edu = (0, advanced_article_logic_1.templateGenerateAdvanced)(eduDto);
    assert(!/\bspa\b/i.test(edu.final_article), 'edu clean');
    const freeDto = {
        ...baseDto,
        productService: 'Gói bảo dưỡng định kỳ',
        painPoints: 'Xe hay hỏng đột xuất, tốn chi phí',
        customIndustry: 'Garage xe máy',
        industryName: '',
    };
    const free = (0, advanced_article_logic_1.templateGenerateAdvanced)(freeDto);
    assert(!/\bspa\b/i.test(free.final_article), 'custom garage clean');
    const policy = (0, content_marketing_logic_1.checkAdPolicyRisk)({
        content: 'Cam kết chữa khỏi 100% và kết quả chắc chắn giảm 10kg trong 7 ngày',
        industryName: 'Giảm cân',
    });
    assert(policy.isRegulatedIndustry, 'policy regulated');
    assert(policy.requiresModerationAck, 'policy ack');
    assert(policy.riskLevel !== 'low' || policy.flaggedPhrases.length > 0, 'policy flagged');
    assert((0, industry_context_util_1.regulatedComplianceBlock)(health).includes('CẤM'), 'compliance block');
    console.log('PASS industry-adaptive content checks');
}
main().catch((e) => {
    console.error('FAIL', e);
    process.exit(1);
});
