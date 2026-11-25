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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentMarketingController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const upload_policy_1 = require("../common/uploads/upload-policy");
const content_marketing_service_1 = require("./content-marketing.service");
const content_industry_service_1 = require("./content-industry.service");
const opinion_voice_profile_service_1 = require("./opinion-voice-profile.service");
const teleprompter_source_service_1 = require("./teleprompter-source.service");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const platform_admin_guard_1 = require("../common/guards/platform-admin.guard");
const content_marketing_dto_1 = require("./dto/content-marketing.dto");
const facebook_policy_dto_1 = require("./dto/facebook-policy.dto");
const content_industry_dto_1 = require("./dto/content-industry.dto");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const ad_url_analyze_service_1 = require("./ad-url-analyze.service");
let ContentMarketingController = class ContentMarketingController {
    service;
    industries;
    voiceProfiles;
    teleprompterSources;
    adUrlAnalyze;
    constructor(service, industries, voiceProfiles, teleprompterSources, adUrlAnalyze) {
        this.service = service;
        this.industries = industries;
        this.voiceProfiles = voiceProfiles;
        this.teleprompterSources = teleprompterSources;
        this.adUrlAnalyze = adUrlAnalyze;
    }
    status() {
        return this.service.status();
    }
    listIndustries(query) {
        return this.industries.listPublic(query.q);
    }
    industrySuggestions(dto) {
        return this.service.industrySuggestions(dto);
    }
    getIndustryPreference(user) {
        return this.industries.getPreference(user);
    }
    upsertIndustryPreference(user, dto) {
        return this.industries.upsertPreference(user, dto);
    }
    adminListIndustries() {
        return this.industries.adminList();
    }
    adminCreateIndustry(dto) {
        return this.industries.adminCreate(dto);
    }
    adminUpdateIndustry(id, dto) {
        return this.industries.adminUpdate(id, dto);
    }
    adminHideIndustry(id) {
        return this.industries.adminHide(id);
    }
    generateAdvanced(user, dto) {
        return this.service.generateAdvanced(dto, user.organizationId);
    }
    rewriteAdvanced(user, dto) {
        return this.service.rewriteAdvanced(dto, user.organizationId);
    }
    optimizeAdvancedCta(dto) {
        return this.service.optimizeAdvancedCta(dto);
    }
    generateAdvancedTitles(dto) {
        return this.service.generateAdvancedTitles(dto);
    }
    suggestAdvancedField(dto) {
        return this.service.suggestAdvancedField(dto);
    }
    generate(dto) {
        return this.service.generate(dto);
    }
    analyzeVideo(dto) {
        return this.service.analyzeVideo(dto);
    }
    checkPolicy(dto) {
        return this.service.checkPolicy(dto);
    }
    score(dto) {
        return this.service.score(dto);
    }
    rewrite(dto) {
        return this.service.rewrite(dto);
    }
    suggestInsights(dto) {
        return this.service.suggestInsights(dto);
    }
    suggestCta(dto) {
        return this.service.suggestCta(dto);
    }
    startAdUrlAnalyze(user, dto) {
        return this.adUrlAnalyze.start(user, dto);
    }
    getAdUrlAnalyze(user, id) {
        return this.adUrlAnalyze.get(user, id);
    }
    cancelAdUrlAnalyze(user, id) {
        return this.adUrlAnalyze.cancel(user, id);
    }
    suggestPersonalIdeas(dto) {
        return this.service.suggestPersonalIdeas(dto);
    }
    suggestPersonalTitles(dto) {
        return this.service.suggestPersonalTitles(dto);
    }
    analyzeOpinionStory(dto) {
        return this.service.analyzeOpinionStory(dto);
    }
    analyzeOpinion(user, dto) {
        return this.service.analyzeOpinion(dto, user.id, user.organizationId);
    }
    generateOpinion(dto) {
        return this.service.generateOpinion(dto);
    }
    rewriteOpinion(dto) {
        return this.service.rewriteOpinion(dto);
    }
    scoreOpinionNaturalness(dto) {
        return this.service.scoreOpinionNaturalness(dto);
    }
    suggestOpinionField(dto) {
        return this.service.suggestOpinionField(dto);
    }
    getOpinionVoiceProfile(user) {
        return this.voiceProfiles.getProfile(user);
    }
    upsertOpinionVoiceProfile(user, dto) {
        return this.voiceProfiles.upsertProfile(user, dto);
    }
    rewriteTeleprompterScript(dto) {
        return this.service.rewriteTeleprompterScript(dto);
    }
    upsertTeleprompterSource(user, dto) {
        return this.teleprompterSources.upsert(user, dto);
    }
    getTeleprompterSource(user, id) {
        return this.teleprompterSources.getById(user, id);
    }
    checkFacebookPolicy(user, dto) {
        return this.service.checkFacebookPolicy(dto, user.organizationId);
    }
    rewriteFacebookPolicy(user, dto) {
        return this.service.rewriteFacebookPolicy(dto, user.organizationId);
    }
    importFacebookPolicyUrl(user, dto) {
        return this.service.importFacebookPolicyUrl(dto, user.id, user.organizationId);
    }
    analyzeFacebookPolicyMedia(dto, files) {
        return this.service.analyzeFacebookPolicyMedia(dto, files?.file?.[0], files?.thumbnail?.[0]);
    }
};
exports.ContentMarketingController = ContentMarketingController;
__decorate([
    (0, common_1.Get)('status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "status", null);
__decorate([
    (0, common_1.Get)('industries'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [content_industry_dto_1.ListIndustriesQueryDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "listIndustries", null);
__decorate([
    (0, common_1.Post)('industry-suggestions'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [content_marketing_dto_1.IndustrySuggestionsDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "industrySuggestions", null);
__decorate([
    (0, common_1.Get)('industry-preference'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "getIndustryPreference", null);
__decorate([
    (0, common_1.Put)('industry-preference'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, content_industry_dto_1.UpsertIndustryPreferenceDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "upsertIndustryPreference", null);
__decorate([
    (0, common_1.Get)('admin/industries'),
    (0, common_1.UseGuards)(platform_admin_guard_1.PlatformAdminGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "adminListIndustries", null);
__decorate([
    (0, common_1.Post)('admin/industries'),
    (0, common_1.UseGuards)(platform_admin_guard_1.PlatformAdminGuard),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [content_industry_dto_1.CreateContentIndustryDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "adminCreateIndustry", null);
__decorate([
    (0, common_1.Patch)('admin/industries/:id'),
    (0, common_1.UseGuards)(platform_admin_guard_1.PlatformAdminGuard),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, content_industry_dto_1.UpdateContentIndustryDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "adminUpdateIndustry", null);
__decorate([
    (0, common_1.Post)('admin/industries/:id/hide'),
    (0, common_1.UseGuards)(platform_admin_guard_1.PlatformAdminGuard),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "adminHideIndustry", null);
__decorate([
    (0, common_1.Post)('generate-advanced'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, content_marketing_dto_1.GenerateAdvancedArticleDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "generateAdvanced", null);
__decorate([
    (0, common_1.Post)('advanced/rewrite'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, content_marketing_dto_1.RewriteAdvancedArticleDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "rewriteAdvanced", null);
__decorate([
    (0, common_1.Post)('advanced/optimize-cta'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [content_marketing_dto_1.OptimizeAdvancedCtaDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "optimizeAdvancedCta", null);
__decorate([
    (0, common_1.Post)('advanced/titles'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [content_marketing_dto_1.GenerateAdvancedTitlesDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "generateAdvancedTitles", null);
__decorate([
    (0, common_1.Post)('advanced/suggest-field'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [content_marketing_dto_1.SuggestAdvancedFieldDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "suggestAdvancedField", null);
__decorate([
    (0, common_1.Post)('generate'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [content_marketing_dto_1.GenerateContentDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "generate", null);
__decorate([
    (0, common_1.Post)('analyze-video'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [content_marketing_dto_1.AnalyzeVideoDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "analyzeVideo", null);
__decorate([
    (0, common_1.Post)('check-policy'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [content_marketing_dto_1.CheckPolicyDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "checkPolicy", null);
__decorate([
    (0, common_1.Post)('score'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [content_marketing_dto_1.ScoreContentDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "score", null);
__decorate([
    (0, common_1.Post)('rewrite'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [content_marketing_dto_1.RewriteContentDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "rewrite", null);
__decorate([
    (0, common_1.Post)('suggest-insights'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [content_marketing_dto_1.SuggestAdInsightsDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "suggestInsights", null);
__decorate([
    (0, common_1.Post)('suggest-cta'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [content_marketing_dto_1.SuggestAdCtaDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "suggestCta", null);
__decorate([
    (0, common_1.Post)('ad-url-analyze'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, content_marketing_dto_1.StartAdUrlAnalyzeDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "startAdUrlAnalyze", null);
__decorate([
    (0, common_1.Get)('ad-url-analyze/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "getAdUrlAnalyze", null);
__decorate([
    (0, common_1.Post)('ad-url-analyze/:id/cancel'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "cancelAdUrlAnalyze", null);
__decorate([
    (0, common_1.Post)('suggest-personal-ideas'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [content_marketing_dto_1.SuggestPersonalIdeasDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "suggestPersonalIdeas", null);
__decorate([
    (0, common_1.Post)('suggest-personal-titles'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [content_marketing_dto_1.SuggestPersonalTitlesDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "suggestPersonalTitles", null);
__decorate([
    (0, common_1.Post)('analyze-opinion-story'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [content_marketing_dto_1.AnalyzeOpinionStoryDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "analyzeOpinionStory", null);
__decorate([
    (0, common_1.Post)('opinion/analyze'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, content_marketing_dto_1.OpinionAnalyzeDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "analyzeOpinion", null);
__decorate([
    (0, common_1.Post)('opinion/generate'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [content_marketing_dto_1.OpinionGenerateDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "generateOpinion", null);
__decorate([
    (0, common_1.Post)('opinion/rewrite'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [content_marketing_dto_1.OpinionRewriteDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "rewriteOpinion", null);
__decorate([
    (0, common_1.Post)('opinion/score-naturalness'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [content_marketing_dto_1.OpinionScoreNaturalnessDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "scoreOpinionNaturalness", null);
__decorate([
    (0, common_1.Post)('opinion/suggest-field'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [content_marketing_dto_1.OpinionSuggestFieldDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "suggestOpinionField", null);
__decorate([
    (0, common_1.Get)('opinion/voice-profile'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "getOpinionVoiceProfile", null);
__decorate([
    (0, common_1.Put)('opinion/voice-profile'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, content_marketing_dto_1.UpsertOpinionVoiceProfileDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "upsertOpinionVoiceProfile", null);
__decorate([
    (0, common_1.Post)('teleprompter/rewrite'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [content_marketing_dto_1.TeleprompterScriptRewriteDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "rewriteTeleprompterScript", null);
__decorate([
    (0, common_1.Post)('teleprompter-source'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, content_marketing_dto_1.UpsertTeleprompterSourceDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "upsertTeleprompterSource", null);
__decorate([
    (0, common_1.Get)('teleprompter-source/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "getTeleprompterSource", null);
__decorate([
    (0, common_1.Post)('facebook-policy/check'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, facebook_policy_dto_1.FacebookPolicyCheckDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "checkFacebookPolicy", null);
__decorate([
    (0, common_1.Post)('facebook-policy/rewrite'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, facebook_policy_dto_1.FacebookPolicyRewriteDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "rewriteFacebookPolicy", null);
__decorate([
    (0, common_1.Post)('facebook-policy/import-url'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, facebook_policy_dto_1.FacebookPolicyImportUrlDto]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "importFacebookPolicyUrl", null);
__decorate([
    (0, common_1.Post)('facebook-policy/analyze-media'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileFieldsInterceptor)([
        { name: 'file', maxCount: 1 },
        { name: 'thumbnail', maxCount: 1 },
    ], {
        ...(0, upload_policy_1.createUploadMulterOptions)('media'),
        limits: { fileSize: 25 * 1024 * 1024, files: 2 },
    })),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [facebook_policy_dto_1.FacebookPolicyAnalyzeMediaDto, Object]),
    __metadata("design:returntype", void 0)
], ContentMarketingController.prototype, "analyzeFacebookPolicyMedia", null);
exports.ContentMarketingController = ContentMarketingController = __decorate([
    (0, common_1.Controller)('content-marketing'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __metadata("design:paramtypes", [content_marketing_service_1.ContentMarketingService,
        content_industry_service_1.ContentIndustryService,
        opinion_voice_profile_service_1.OpinionVoiceProfileService,
        teleprompter_source_service_1.TeleprompterSourceService,
        ad_url_analyze_service_1.AdUrlAnalyzeService])
], ContentMarketingController);
