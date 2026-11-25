"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StartAdUrlAnalyzeDto = exports.UpsertTeleprompterSourceDto = exports.UpsertOpinionVoiceProfileDto = exports.TeleprompterScriptRewriteDto = exports.OpinionSuggestFieldDto = exports.OpinionScoreNaturalnessDto = exports.OpinionRewriteDto = exports.OpinionGenerateDto = exports.OpinionAnalyzeDto = exports.IndustrySuggestionsDto = exports.SuggestAdvancedFieldDto = exports.AnalyzeOpinionStoryDto = exports.SuggestPersonalTitlesDto = exports.SuggestPersonalIdeasDto = exports.SuggestAdCtaDto = exports.SuggestAdInsightsDto = exports.RewriteAdvancedArticleDto = exports.GenerateAdvancedTitlesDto = exports.OptimizeAdvancedCtaDto = exports.GenerateAdvancedArticleDto = exports.RewriteContentDto = exports.ScoreContentDto = exports.CheckPolicyDto = exports.AnalyzeVideoDto = exports.GenerateContentDto = exports.TELEPROMPTER_SCRIPT_REWRITE_MODES = exports.OPINION_REWRITE_MODES = exports.REWRITE_MODES = exports.PERSONAL_REWRITE_MODES = exports.PERSONAL_TITLE_COUNTS = exports.OPINION_LENGTHS = exports.OPINION_INTENSITIES = exports.OPINION_PRONOUNS = exports.OPINION_ANGLES = exports.OPINION_STANCES = exports.PERSONAL_CREATION_MODES = exports.POST_LENGTHS = exports.PERSONAL_POST_GOALS = exports.PERSONAL_TONES = exports.PERSONAL_POST_TYPES = exports.PLATFORMS = exports.AD_OBJECTIVES = exports.AD_CONTENT_TYPES = exports.CONTENT_TONES = exports.AdServicePayloadDto = exports.AdProductPayloadDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const advanced_article_config_1 = require("../advanced-article-config");
const brand_post_config_1 = require("../brand-post-config");
class AdProductPayloadDto {
    name;
    category;
    features;
    benefits;
    differentiators;
    price;
    warranty;
    proof;
    offer;
}
exports.AdProductPayloadDto = AdProductPayloadDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], AdProductPayloadDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], AdProductPayloadDto.prototype, "category", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], AdProductPayloadDto.prototype, "features", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], AdProductPayloadDto.prototype, "benefits", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], AdProductPayloadDto.prototype, "differentiators", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], AdProductPayloadDto.prototype, "price", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], AdProductPayloadDto.prototype, "warranty", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], AdProductPayloadDto.prototype, "proof", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], AdProductPayloadDto.prototype, "offer", void 0);
class AdServicePayloadDto {
    name;
    suitableCustomers;
    problems;
    process;
    highlights;
    expectedBenefits;
    duration;
    location;
    experts;
    proof;
    offer;
}
exports.AdServicePayloadDto = AdServicePayloadDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], AdServicePayloadDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], AdServicePayloadDto.prototype, "suitableCustomers", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], AdServicePayloadDto.prototype, "problems", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], AdServicePayloadDto.prototype, "process", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], AdServicePayloadDto.prototype, "highlights", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], AdServicePayloadDto.prototype, "expectedBenefits", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], AdServicePayloadDto.prototype, "duration", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], AdServicePayloadDto.prototype, "location", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], AdServicePayloadDto.prototype, "experts", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], AdServicePayloadDto.prototype, "proof", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], AdServicePayloadDto.prototype, "offer", void 0);
exports.CONTENT_TONES = [
    'bold',
    'edgy',
    'friendly',
    'humorous',
    'educational',
    'philosophical',
    'realistic',
    'storytelling',
    'trending',
    'expert',
    'empathetic',
    'direct_sale',
];
exports.AD_CONTENT_TYPES = [
    'inbox',
    'lead',
    'sales',
    'remarketing',
    'promo',
    'case_study',
    'video_script',
    'hook_3s',
];
exports.AD_OBJECTIVES = [
    'messages',
    'engagement',
    'lead_form',
    'landing_conversion',
    'direct_sales',
    'remarketing',
    'brand_awareness',
];
exports.PLATFORMS = ['facebook', 'tiktok', 'zalo'];
exports.PERSONAL_POST_TYPES = [
    'knowledge_sharing',
    'humor',
    'philosophy',
    'touching',
    'motivational',
    'personal_story',
    'realistic_view',
    'personal_trend',
    'failure_lesson',
    'success_experience',
    'community_engagement',
];
exports.PERSONAL_TONES = [
    'approachable',
    'humorous',
    'playful',
    'deep',
    'philosophical',
    'touching',
    'inspiring',
    'bold',
    'realistic',
    'everyday',
    'positive',
    'sincere',
    'mild_edgy',
    'storytelling',
    'bold_may_tao',
];
exports.PERSONAL_POST_GOALS = [
    'engagement',
    'knowledge',
    'inspiration',
    'humor',
    'touching_story',
    'personal_view',
    'trend',
    'personal_branding',
];
exports.POST_LENGTHS = ['short', 'medium', 'long'];
exports.PERSONAL_CREATION_MODES = ['topic', 'opinion'];
exports.OPINION_STANCES = [
    'agree',
    'disagree',
    'neutral',
    'multi',
    'custom',
];
exports.OPINION_ANGLES = [
    'life',
    'ethics',
    'community',
    'business',
    'celebrity',
    'personal_lesson',
];
exports.OPINION_PRONOUNS = [
    'toi_cac_ban',
    'minh_moi_nguoi',
    'anh_em',
    'co_chu_anh_chi',
];
exports.OPINION_INTENSITIES = [
    'gentle',
    'deep',
    'frank',
    'emotional',
    'motivational',
    'strong',
];
exports.OPINION_LENGTHS = ['1min', '3min', '5min', 'facebook'];
exports.PERSONAL_TITLE_COUNTS = [5, 10, 20];
exports.PERSONAL_REWRITE_MODES = [
    'funnier',
    'deeper',
    'more_emotional',
    'more_motivational',
    'shorter',
    'longer',
    'hooks_5',
    'openers_5',
    'ab_3',
];
exports.REWRITE_MODES = [
    'stronger',
    'safer',
    'shorter',
    'longer',
    'funnier',
    'hooks_5',
    'cta_5',
    'ab_3',
];
exports.OPINION_REWRITE_MODES = [
    'more_casual',
    'more_natural',
    'more_spoken',
    'less_preachy',
    'more_frank',
    'more_deep',
    'shorten',
    'shorten_1min',
    'rewrite_all',
];
exports.TELEPROMPTER_SCRIPT_REWRITE_MODES = [
    'to_spoken',
    'more_natural',
    'more_casual',
    'less_written',
    'less_preachy',
    'more_frank',
    'more_deep',
    'shorten_1min',
    'shorten_3min',
    'shorten_5min',
];
class GenerateContentDto {
    mode;
    productService;
    /** product | service — optional; default product when mode=ad */
    adPostKind;
    brandName;
    product;
    service;
    targetAudience;
    painPoints;
    benefits;
    offer;
    adObjective;
    platform;
    cta;
    tone;
    adContentType;
    personalPostType;
    videoUrl;
    transcript;
    postTopic;
    postGoal;
    personalTone;
    postLength;
    personalAngle;
    storyIdea;
    brandArticleGenre;
    brandPronoun;
    brandVoiceIntensity;
    /** topic = chủ đề thương hiệu; opinion = góc nhìn & chính kiến */
    creationMode;
    topicGroupId;
    topicGroupLabel;
    industryId;
    industryName;
    customIndustry;
    opinionSourceUrl;
    opinionSourceText;
    opinionSummary;
    opinionDebateIssue;
    opinionStance;
    opinionStanceCustom;
    opinionAngle;
    opinionPronoun;
    opinionIntensity;
    opinionLength;
    opinionThesis;
}
exports.GenerateContentDto = GenerateContentDto;
__decorate([
    (0, class_validator_1.IsIn)(['ad', 'personal']),
    __metadata("design:type", String)
], GenerateContentDto.prototype, "mode", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], GenerateContentDto.prototype, "productService", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['product', 'service']),
    __metadata("design:type", String)
], GenerateContentDto.prototype, "adPostKind", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], GenerateContentDto.prototype, "brandName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => AdProductPayloadDto),
    __metadata("design:type", AdProductPayloadDto)
], GenerateContentDto.prototype, "product", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => AdServicePayloadDto),
    __metadata("design:type", AdServicePayloadDto)
], GenerateContentDto.prototype, "service", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], GenerateContentDto.prototype, "targetAudience", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], GenerateContentDto.prototype, "painPoints", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], GenerateContentDto.prototype, "benefits", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], GenerateContentDto.prototype, "offer", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.AD_OBJECTIVES),
    __metadata("design:type", Object)
], GenerateContentDto.prototype, "adObjective", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.PLATFORMS),
    __metadata("design:type", Object)
], GenerateContentDto.prototype, "platform", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], GenerateContentDto.prototype, "cta", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.CONTENT_TONES),
    __metadata("design:type", Object)
], GenerateContentDto.prototype, "tone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.AD_CONTENT_TYPES),
    __metadata("design:type", Object)
], GenerateContentDto.prototype, "adContentType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.PERSONAL_POST_TYPES),
    __metadata("design:type", Object)
], GenerateContentDto.prototype, "personalPostType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], GenerateContentDto.prototype, "videoUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(8000),
    __metadata("design:type", String)
], GenerateContentDto.prototype, "transcript", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], GenerateContentDto.prototype, "postTopic", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.PERSONAL_POST_GOALS),
    __metadata("design:type", Object)
], GenerateContentDto.prototype, "postGoal", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.PERSONAL_TONES),
    __metadata("design:type", Object)
], GenerateContentDto.prototype, "personalTone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.POST_LENGTHS),
    __metadata("design:type", Object)
], GenerateContentDto.prototype, "postLength", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], GenerateContentDto.prototype, "personalAngle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(3000),
    __metadata("design:type", String)
], GenerateContentDto.prototype, "storyIdea", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(brand_post_config_1.BRAND_ARTICLE_GENRES),
    __metadata("design:type", Object)
], GenerateContentDto.prototype, "brandArticleGenre", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(brand_post_config_1.BRAND_PRONOUNS),
    __metadata("design:type", Object)
], GenerateContentDto.prototype, "brandPronoun", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(brand_post_config_1.BRAND_VOICE_INTENSITIES),
    __metadata("design:type", Object)
], GenerateContentDto.prototype, "brandVoiceIntensity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.PERSONAL_CREATION_MODES),
    __metadata("design:type", Object)
], GenerateContentDto.prototype, "creationMode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], GenerateContentDto.prototype, "topicGroupId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], GenerateContentDto.prototype, "topicGroupLabel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], GenerateContentDto.prototype, "industryId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], GenerateContentDto.prototype, "industryName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], GenerateContentDto.prototype, "customIndustry", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], GenerateContentDto.prototype, "opinionSourceUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(8000),
    __metadata("design:type", String)
], GenerateContentDto.prototype, "opinionSourceText", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(3000),
    __metadata("design:type", String)
], GenerateContentDto.prototype, "opinionSummary", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], GenerateContentDto.prototype, "opinionDebateIssue", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.OPINION_STANCES),
    __metadata("design:type", Object)
], GenerateContentDto.prototype, "opinionStance", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], GenerateContentDto.prototype, "opinionStanceCustom", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.OPINION_ANGLES),
    __metadata("design:type", Object)
], GenerateContentDto.prototype, "opinionAngle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.OPINION_PRONOUNS),
    __metadata("design:type", Object)
], GenerateContentDto.prototype, "opinionPronoun", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.OPINION_INTENSITIES),
    __metadata("design:type", Object)
], GenerateContentDto.prototype, "opinionIntensity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.OPINION_LENGTHS),
    __metadata("design:type", Object)
], GenerateContentDto.prototype, "opinionLength", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], GenerateContentDto.prototype, "opinionThesis", void 0);
class AnalyzeVideoDto {
    videoUrl;
    transcript;
}
exports.AnalyzeVideoDto = AnalyzeVideoDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], AnalyzeVideoDto.prototype, "videoUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(8000),
    __metadata("design:type", String)
], AnalyzeVideoDto.prototype, "transcript", void 0);
class CheckPolicyDto {
    content;
    platform;
    industryId;
    industryName;
    customIndustry;
}
exports.CheckPolicyDto = CheckPolicyDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(8000),
    __metadata("design:type", String)
], CheckPolicyDto.prototype, "content", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.PLATFORMS),
    __metadata("design:type", Object)
], CheckPolicyDto.prototype, "platform", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CheckPolicyDto.prototype, "industryId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CheckPolicyDto.prototype, "industryName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CheckPolicyDto.prototype, "customIndustry", void 0);
class ScoreContentDto {
    content;
    platform;
    mode;
    adObjective;
    customIndustry;
    industryId;
    industryName;
}
exports.ScoreContentDto = ScoreContentDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(8000),
    __metadata("design:type", String)
], ScoreContentDto.prototype, "content", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.PLATFORMS),
    __metadata("design:type", Object)
], ScoreContentDto.prototype, "platform", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['ad', 'personal']),
    __metadata("design:type", String)
], ScoreContentDto.prototype, "mode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.AD_OBJECTIVES),
    __metadata("design:type", Object)
], ScoreContentDto.prototype, "adObjective", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ScoreContentDto.prototype, "customIndustry", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ScoreContentDto.prototype, "industryId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ScoreContentDto.prototype, "industryName", void 0);
class RewriteContentDto {
    content;
    mode;
    studioMode;
    platform;
    tone;
    personalTone;
    industryId;
    industryName;
    customIndustry;
}
exports.RewriteContentDto = RewriteContentDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(8000),
    __metadata("design:type", String)
], RewriteContentDto.prototype, "content", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RewriteContentDto.prototype, "mode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['ad', 'personal']),
    __metadata("design:type", String)
], RewriteContentDto.prototype, "studioMode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.PLATFORMS),
    __metadata("design:type", Object)
], RewriteContentDto.prototype, "platform", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RewriteContentDto.prototype, "tone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.PERSONAL_TONES),
    __metadata("design:type", Object)
], RewriteContentDto.prototype, "personalTone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], RewriteContentDto.prototype, "industryId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], RewriteContentDto.prototype, "industryName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], RewriteContentDto.prototype, "customIndustry", void 0);
class GenerateAdvancedArticleDto {
    productService;
    price;
    combo;
    gift;
    offerDeadline;
    salesArea;
    certification;
    caseStudy;
    painPoints;
    desires;
    differentiator;
    ctaType;
    writingStyle;
    demographic;
    articleGoal;
    postLength;
    industryId;
    industryName;
    customIndustry;
}
exports.GenerateAdvancedArticleDto = GenerateAdvancedArticleDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], GenerateAdvancedArticleDto.prototype, "productService", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], GenerateAdvancedArticleDto.prototype, "price", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], GenerateAdvancedArticleDto.prototype, "combo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], GenerateAdvancedArticleDto.prototype, "gift", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], GenerateAdvancedArticleDto.prototype, "offerDeadline", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], GenerateAdvancedArticleDto.prototype, "salesArea", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], GenerateAdvancedArticleDto.prototype, "certification", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], GenerateAdvancedArticleDto.prototype, "caseStudy", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], GenerateAdvancedArticleDto.prototype, "painPoints", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], GenerateAdvancedArticleDto.prototype, "desires", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], GenerateAdvancedArticleDto.prototype, "differentiator", void 0);
__decorate([
    (0, class_validator_1.IsIn)(advanced_article_config_1.ADVANCED_CTA_TYPES),
    __metadata("design:type", Object)
], GenerateAdvancedArticleDto.prototype, "ctaType", void 0);
__decorate([
    (0, class_validator_1.IsIn)(advanced_article_config_1.ADVANCED_WRITING_STYLES),
    __metadata("design:type", Object)
], GenerateAdvancedArticleDto.prototype, "writingStyle", void 0);
__decorate([
    (0, class_validator_1.IsIn)(advanced_article_config_1.ADVANCED_DEMOGRAPHICS),
    __metadata("design:type", Object)
], GenerateAdvancedArticleDto.prototype, "demographic", void 0);
__decorate([
    (0, class_validator_1.IsIn)(advanced_article_config_1.ADVANCED_ARTICLE_GOALS),
    __metadata("design:type", Object)
], GenerateAdvancedArticleDto.prototype, "articleGoal", void 0);
__decorate([
    (0, class_validator_1.IsIn)(exports.POST_LENGTHS),
    __metadata("design:type", Object)
], GenerateAdvancedArticleDto.prototype, "postLength", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], GenerateAdvancedArticleDto.prototype, "industryId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], GenerateAdvancedArticleDto.prototype, "industryName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], GenerateAdvancedArticleDto.prototype, "customIndustry", void 0);
class OptimizeAdvancedCtaDto {
    finalArticle;
    ctaType;
    productService;
    articleGoal;
    industryId;
    industryName;
    customIndustry;
}
exports.OptimizeAdvancedCtaDto = OptimizeAdvancedCtaDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(15000),
    __metadata("design:type", String)
], OptimizeAdvancedCtaDto.prototype, "finalArticle", void 0);
__decorate([
    (0, class_validator_1.IsIn)(advanced_article_config_1.ADVANCED_CTA_TYPES),
    __metadata("design:type", Object)
], OptimizeAdvancedCtaDto.prototype, "ctaType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], OptimizeAdvancedCtaDto.prototype, "productService", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(advanced_article_config_1.ADVANCED_ARTICLE_GOALS),
    __metadata("design:type", Object)
], OptimizeAdvancedCtaDto.prototype, "articleGoal", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], OptimizeAdvancedCtaDto.prototype, "industryId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], OptimizeAdvancedCtaDto.prototype, "industryName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], OptimizeAdvancedCtaDto.prototype, "customIndustry", void 0);
class GenerateAdvancedTitlesDto {
    finalArticle;
    productService;
    demographic;
    industryId;
    industryName;
    customIndustry;
}
exports.GenerateAdvancedTitlesDto = GenerateAdvancedTitlesDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(15000),
    __metadata("design:type", String)
], GenerateAdvancedTitlesDto.prototype, "finalArticle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], GenerateAdvancedTitlesDto.prototype, "productService", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(advanced_article_config_1.ADVANCED_DEMOGRAPHICS),
    __metadata("design:type", Object)
], GenerateAdvancedTitlesDto.prototype, "demographic", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], GenerateAdvancedTitlesDto.prototype, "industryId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], GenerateAdvancedTitlesDto.prototype, "industryName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], GenerateAdvancedTitlesDto.prototype, "customIndustry", void 0);
class RewriteAdvancedArticleDto extends GenerateAdvancedArticleDto {
    previousArticle;
}
exports.RewriteAdvancedArticleDto = RewriteAdvancedArticleDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(15000),
    __metadata("design:type", String)
], RewriteAdvancedArticleDto.prototype, "previousArticle", void 0);
class SuggestAdInsightsDto {
    productService;
    targetAudience;
    platform;
    adObjective;
}
exports.SuggestAdInsightsDto = SuggestAdInsightsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], SuggestAdInsightsDto.prototype, "productService", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], SuggestAdInsightsDto.prototype, "targetAudience", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.PLATFORMS),
    __metadata("design:type", Object)
], SuggestAdInsightsDto.prototype, "platform", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.AD_OBJECTIVES),
    __metadata("design:type", Object)
], SuggestAdInsightsDto.prototype, "adObjective", void 0);
class SuggestAdCtaDto {
    productService;
    targetAudience;
    platform;
    offer;
    adObjective;
    adContentType;
}
exports.SuggestAdCtaDto = SuggestAdCtaDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], SuggestAdCtaDto.prototype, "productService", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], SuggestAdCtaDto.prototype, "targetAudience", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.PLATFORMS),
    __metadata("design:type", Object)
], SuggestAdCtaDto.prototype, "platform", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], SuggestAdCtaDto.prototype, "offer", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.AD_OBJECTIVES),
    __metadata("design:type", Object)
], SuggestAdCtaDto.prototype, "adObjective", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.AD_CONTENT_TYPES),
    __metadata("design:type", Object)
], SuggestAdCtaDto.prototype, "adContentType", void 0);
class SuggestPersonalIdeasDto {
    postTopic;
    topicGroupId;
    topicGroupLabel;
    targetAudience;
    postGoal;
    personalPostType;
    personalTone;
}
exports.SuggestPersonalIdeasDto = SuggestPersonalIdeasDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], SuggestPersonalIdeasDto.prototype, "postTopic", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], SuggestPersonalIdeasDto.prototype, "topicGroupId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], SuggestPersonalIdeasDto.prototype, "topicGroupLabel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], SuggestPersonalIdeasDto.prototype, "targetAudience", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.PERSONAL_POST_GOALS),
    __metadata("design:type", Object)
], SuggestPersonalIdeasDto.prototype, "postGoal", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.PERSONAL_POST_TYPES),
    __metadata("design:type", Object)
], SuggestPersonalIdeasDto.prototype, "personalPostType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.PERSONAL_TONES),
    __metadata("design:type", Object)
], SuggestPersonalIdeasDto.prototype, "personalTone", void 0);
class SuggestPersonalTitlesDto {
    topicGroupId;
    topicGroupLabel;
    subtopicId;
    subtopicLabel;
    count;
    tone;
    pronoun;
    audience;
    goal;
}
exports.SuggestPersonalTitlesDto = SuggestPersonalTitlesDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], SuggestPersonalTitlesDto.prototype, "topicGroupId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], SuggestPersonalTitlesDto.prototype, "topicGroupLabel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], SuggestPersonalTitlesDto.prototype, "subtopicId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], SuggestPersonalTitlesDto.prototype, "subtopicLabel", void 0);
__decorate([
    (0, class_validator_1.IsIn)(exports.PERSONAL_TITLE_COUNTS),
    __metadata("design:type", Object)
], SuggestPersonalTitlesDto.prototype, "count", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.PERSONAL_TONES),
    __metadata("design:type", Object)
], SuggestPersonalTitlesDto.prototype, "tone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(brand_post_config_1.BRAND_PRONOUNS),
    __metadata("design:type", Object)
], SuggestPersonalTitlesDto.prototype, "pronoun", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], SuggestPersonalTitlesDto.prototype, "audience", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.PERSONAL_POST_GOALS),
    __metadata("design:type", Object)
], SuggestPersonalTitlesDto.prototype, "goal", void 0);
class AnalyzeOpinionStoryDto {
    sourceUrl;
    sourceText;
}
exports.AnalyzeOpinionStoryDto = AnalyzeOpinionStoryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], AnalyzeOpinionStoryDto.prototype, "sourceUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(8000),
    __metadata("design:type", String)
], AnalyzeOpinionStoryDto.prototype, "sourceText", void 0);
class SuggestAdvancedFieldDto {
    field;
    productService;
    demographic;
    articleGoal;
    writingStyle;
    painPoints;
    currentValue;
}
exports.SuggestAdvancedFieldDto = SuggestAdvancedFieldDto;
__decorate([
    (0, class_validator_1.IsIn)(advanced_article_config_1.ADVANCED_SUGGEST_FIELDS),
    __metadata("design:type", Object)
], SuggestAdvancedFieldDto.prototype, "field", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], SuggestAdvancedFieldDto.prototype, "productService", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(advanced_article_config_1.ADVANCED_DEMOGRAPHICS),
    __metadata("design:type", Object)
], SuggestAdvancedFieldDto.prototype, "demographic", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(advanced_article_config_1.ADVANCED_ARTICLE_GOALS),
    __metadata("design:type", Object)
], SuggestAdvancedFieldDto.prototype, "articleGoal", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(advanced_article_config_1.ADVANCED_WRITING_STYLES),
    __metadata("design:type", Object)
], SuggestAdvancedFieldDto.prototype, "writingStyle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], SuggestAdvancedFieldDto.prototype, "painPoints", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], SuggestAdvancedFieldDto.prototype, "currentValue", void 0);
class IndustrySuggestionsDto {
    industryId;
    industryName;
    customIndustry;
    q;
}
exports.IndustrySuggestionsDto = IndustrySuggestionsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], IndustrySuggestionsDto.prototype, "industryId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], IndustrySuggestionsDto.prototype, "industryName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], IndustrySuggestionsDto.prototype, "customIndustry", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], IndustrySuggestionsDto.prototype, "q", void 0);
class OpinionAnalyzeDto {
    story;
    transcript;
    url;
    fanpageId;
    sourceText;
    sourceUrl;
    urlKind;
}
exports.OpinionAnalyzeDto = OpinionAnalyzeDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionAnalyzeDto.prototype, "story", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionAnalyzeDto.prototype, "transcript", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionAnalyzeDto.prototype, "url", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionAnalyzeDto.prototype, "fanpageId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionAnalyzeDto.prototype, "sourceText", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionAnalyzeDto.prototype, "sourceUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionAnalyzeDto.prototype, "urlKind", void 0);
class OpinionGenerateDto {
    topic;
    stance;
    angle;
    pronoun;
    intensity;
    length;
    story;
    avoidWords;
    closingPhrases;
    commonPhrases;
    confirmedFacts;
    hideNames;
    openingPhrases;
    preferredWords;
    quickAngleLabel;
    sampleParagraph;
    selectedAngle;
    sourceSummary;
    subtopic;
    themeId;
    unverifiedClaims;
    userViewpoint;
}
exports.OpinionGenerateDto = OpinionGenerateDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionGenerateDto.prototype, "topic", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionGenerateDto.prototype, "stance", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionGenerateDto.prototype, "angle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionGenerateDto.prototype, "pronoun", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionGenerateDto.prototype, "intensity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionGenerateDto.prototype, "length", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionGenerateDto.prototype, "story", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], OpinionGenerateDto.prototype, "avoidWords", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], OpinionGenerateDto.prototype, "closingPhrases", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], OpinionGenerateDto.prototype, "commonPhrases", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], OpinionGenerateDto.prototype, "confirmedFacts", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], OpinionGenerateDto.prototype, "hideNames", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], OpinionGenerateDto.prototype, "openingPhrases", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], OpinionGenerateDto.prototype, "preferredWords", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionGenerateDto.prototype, "quickAngleLabel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionGenerateDto.prototype, "sampleParagraph", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionGenerateDto.prototype, "selectedAngle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionGenerateDto.prototype, "sourceSummary", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionGenerateDto.prototype, "subtopic", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionGenerateDto.prototype, "themeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], OpinionGenerateDto.prototype, "unverifiedClaims", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionGenerateDto.prototype, "userViewpoint", void 0);
class OpinionRewriteDto extends OpinionGenerateDto {
    content;
    mode;
    facebookPost;
    rewriteMode;
    videoHook;
    videoScript;
}
exports.OpinionRewriteDto = OpinionRewriteDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionRewriteDto.prototype, "content", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionRewriteDto.prototype, "mode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionRewriteDto.prototype, "facebookPost", void 0);
__decorate([
    (0, class_validator_1.IsIn)(exports.OPINION_REWRITE_MODES),
    __metadata("design:type", String)
], OpinionRewriteDto.prototype, "rewriteMode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionRewriteDto.prototype, "videoHook", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionRewriteDto.prototype, "videoScript", void 0);
class OpinionScoreNaturalnessDto {
    content;
    contentType;
}
exports.OpinionScoreNaturalnessDto = OpinionScoreNaturalnessDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionScoreNaturalnessDto.prototype, "content", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionScoreNaturalnessDto.prototype, "contentType", void 0);
class OpinionSuggestFieldDto {
    field;
    context;
    currentDebateIssue;
    currentSummary;
    currentValue;
    sourceText;
    subtopic;
    themeLabel;
}
exports.OpinionSuggestFieldDto = OpinionSuggestFieldDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionSuggestFieldDto.prototype, "field", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionSuggestFieldDto.prototype, "context", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionSuggestFieldDto.prototype, "currentDebateIssue", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionSuggestFieldDto.prototype, "currentSummary", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionSuggestFieldDto.prototype, "currentValue", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionSuggestFieldDto.prototype, "sourceText", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionSuggestFieldDto.prototype, "subtopic", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], OpinionSuggestFieldDto.prototype, "themeLabel", void 0);
class TeleprompterScriptRewriteDto {
    script;
    mode;
    title;
}
exports.TeleprompterScriptRewriteDto = TeleprompterScriptRewriteDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], TeleprompterScriptRewriteDto.prototype, "script", void 0);
__decorate([
    (0, class_validator_1.IsIn)(exports.TELEPROMPTER_SCRIPT_REWRITE_MODES),
    __metadata("design:type", String)
], TeleprompterScriptRewriteDto.prototype, "mode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TeleprompterScriptRewriteDto.prototype, "title", void 0);
class UpsertOpinionVoiceProfileDto {
    name;
    style;
    notes;
    avoidWords;
    closingPhrases;
    openingPhrases;
    preferredWords;
    pronoun;
    sampleParagraph;
    scope;
}
exports.UpsertOpinionVoiceProfileDto = UpsertOpinionVoiceProfileDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertOpinionVoiceProfileDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertOpinionVoiceProfileDto.prototype, "style", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertOpinionVoiceProfileDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], UpsertOpinionVoiceProfileDto.prototype, "avoidWords", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], UpsertOpinionVoiceProfileDto.prototype, "closingPhrases", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], UpsertOpinionVoiceProfileDto.prototype, "openingPhrases", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], UpsertOpinionVoiceProfileDto.prototype, "preferredWords", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertOpinionVoiceProfileDto.prototype, "pronoun", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertOpinionVoiceProfileDto.prototype, "sampleParagraph", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertOpinionVoiceProfileDto.prototype, "scope", void 0);
class UpsertTeleprompterSourceDto {
    title;
    content;
    sourceType;
    url;
    clientContentId;
    editedScript;
    estimatedDuration;
    facebookPost;
    id;
    originalScript;
    sourceContentId;
    sourceRoute;
    sourceTitle;
    videoHook;
}
exports.UpsertTeleprompterSourceDto = UpsertTeleprompterSourceDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertTeleprompterSourceDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertTeleprompterSourceDto.prototype, "content", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertTeleprompterSourceDto.prototype, "sourceType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertTeleprompterSourceDto.prototype, "url", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertTeleprompterSourceDto.prototype, "clientContentId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertTeleprompterSourceDto.prototype, "editedScript", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertTeleprompterSourceDto.prototype, "estimatedDuration", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertTeleprompterSourceDto.prototype, "facebookPost", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertTeleprompterSourceDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertTeleprompterSourceDto.prototype, "originalScript", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertTeleprompterSourceDto.prototype, "sourceContentId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertTeleprompterSourceDto.prototype, "sourceRoute", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertTeleprompterSourceDto.prototype, "sourceTitle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertTeleprompterSourceDto.prototype, "videoHook", void 0);
class StartAdUrlAnalyzeDto {
    sourceUrl;
    adPostKind;
    brandName;
}
exports.StartAdUrlAnalyzeDto = StartAdUrlAnalyzeDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], StartAdUrlAnalyzeDto.prototype, "sourceUrl", void 0);
__decorate([
    (0, class_validator_1.IsIn)(['product', 'service']),
    __metadata("design:type", String)
], StartAdUrlAnalyzeDto.prototype, "adPostKind", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], StartAdUrlAnalyzeDto.prototype, "brandName", void 0);
