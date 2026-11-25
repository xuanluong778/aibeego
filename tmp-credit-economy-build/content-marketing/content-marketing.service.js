"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentMarketingService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const openai_service_1 = require("../openai/openai.service");
const prisma_service_1 = require("../prisma/prisma.service");
const content_marketing_logic_1 = require("./content-marketing-logic");
const ad_product_service_logic_1 = require("./ad-product-service.logic");
const advanced_article_logic_1 = require("./advanced-article-logic");
const advanced_field_suggest_logic_1 = require("./advanced-field-suggest.logic");
const industry_suggestions_logic_1 = require("./industry-suggestions.logic");
const facebook_policy_logic_1 = require("./facebook-policy/facebook-policy.logic");
const opinion_story_logic_1 = require("./opinion-story.logic");
const opinion_analyze_logic_1 = require("./opinion-analyze.logic");
const opinion_generate_logic_1 = require("./opinion-generate.logic");
const opinion_score_naturalness_logic_1 = require("./opinion-score-naturalness.logic");
const opinion_suggest_field_logic_1 = require("./opinion-suggest-field.logic");
const teleprompter_script_logic_1 = require("./teleprompter-script.logic");
const facebook_policy_import_logic_1 = require("./facebook-policy/facebook-policy-import.logic");
const facebook_policy_media_logic_1 = require("./facebook-policy/facebook-policy-media.logic");
const facebook_policy_merge_logic_1 = require("./facebook-policy/facebook-policy-merge.logic");
let ContentMarketingService = class ContentMarketingService {
    openai;
    prisma;
    config;
    constructor(openai, prisma, config) {
        this.openai = openai;
        this.prisma = prisma;
        this.config = config;
    }
    industrySuggestions(dto) {
        return (0, industry_suggestions_logic_1.buildIndustrySuggestions)(dto, this.openai);
    }
    async generateAdvanced(dto, organizationId) {
        return (0, advanced_article_logic_1.generateAdvancedArticle)(dto, this.openai);
    }
    async rewriteAdvanced(dto, organizationId) {
        return (0, advanced_article_logic_1.rewriteAdvancedArticle)(dto, this.openai);
    }
    async optimizeAdvancedCta(dto) {
        return (0, advanced_article_logic_1.optimizeAdvancedCta)(dto, this.openai);
    }
    async generateAdvancedTitles(dto) {
        return (0, advanced_article_logic_1.generateAdvancedTitles)(dto, this.openai);
    }
    suggestAdvancedField(dto) {
        return (0, advanced_field_suggest_logic_1.suggestAdvancedField)(dto, this.openai);
    }
    async generate(dto) {
        if (dto.mode === 'personal') {
            const generated = dto.creationMode === 'opinion'
                ? await (0, opinion_story_logic_1.generateOpinionContent)(dto, this.openai)
                : await (0, content_marketing_logic_1.generatePersonalContent)(dto, this.openai);
            const score = (0, content_marketing_logic_1.scorePersonalContent)({ content: generated.content, mode: 'personal' });
            return { ...generated, score };
        }
        try {
            (0, ad_product_service_logic_1.assertExclusiveProductService)(dto);
        }
        catch (e) {
            throw new common_1.BadRequestException(e instanceof Error ? e.message : 'Invalid ad payload');
        }
        const generated = await (0, content_marketing_logic_1.generateMarketingContent)(dto, this.openai);
        const policy = (0, content_marketing_logic_1.checkAdPolicyRisk)({
            content: generated.content,
            platform: dto.platform,
            industryId: dto.industryId,
            industryName: dto.industryName,
            customIndustry: dto.customIndustry,
        });
        const score = (0, content_marketing_logic_1.scoreAdContent)({
            content: generated.content,
            platform: dto.platform,
            mode: dto.mode,
            adObjective: dto.adObjective,
            industryId: dto.industryId,
            industryName: dto.industryName,
            customIndustry: dto.customIndustry,
        }, policy);
        return { ...generated, policy, score };
    }
    analyzeVideo(dto) {
        return (0, content_marketing_logic_1.analyzeVideoAngle)(dto, this.openai);
    }
    analyzeOpinionStory(dto) {
        return (0, opinion_story_logic_1.analyzeOpinionStory)(dto, this.openai);
    }
    analyzeOpinion(dto, userId, organizationId) {
        return (0, opinion_analyze_logic_1.analyzeOpinionSource)({
            dto,
            userId,
            organizationId,
            prisma: this.prisma,
            config: this.config,
            openai: this.openai,
        });
    }
    generateOpinion(dto) {
        return (0, opinion_generate_logic_1.generateOpinionPair)(dto, this.openai);
    }
    rewriteOpinion(dto) {
        return (0, opinion_generate_logic_1.rewriteOpinionPair)(dto, this.openai);
    }
    rewriteTeleprompterScript(dto) {
        return (0, teleprompter_script_logic_1.rewriteTeleprompterScript)(dto.script, dto.mode, this.openai, dto.title);
    }
    scoreOpinionNaturalness(dto) {
        return (0, opinion_score_naturalness_logic_1.scoreOpinionNaturalness)(dto, this.openai);
    }
    suggestOpinionField(dto) {
        return (0, opinion_suggest_field_logic_1.suggestOpinionField)(dto, this.openai);
    }
    checkPolicy(dto) {
        return (0, content_marketing_logic_1.checkAdPolicyRisk)(dto);
    }
    score(dto) {
        if (dto.mode === 'personal') {
            return (0, content_marketing_logic_1.scorePersonalContent)(dto);
        }
        const policy = (0, content_marketing_logic_1.checkAdPolicyRisk)({
            content: dto.content,
            platform: dto.platform,
            industryId: dto.industryId,
            industryName: dto.industryName,
            customIndustry: dto.customIndustry,
        });
        return { ...(0, content_marketing_logic_1.scoreAdContent)(dto, policy), policy };
    }
    rewrite(dto) {
        return (0, content_marketing_logic_1.rewriteContentVariant)(dto, this.openai);
    }
    suggestInsights(dto) {
        return (0, content_marketing_logic_1.suggestAdInsights)(dto, this.openai);
    }
    suggestCta(dto) {
        return (0, content_marketing_logic_1.suggestAdCta)(dto, this.openai);
    }
    suggestPersonalIdeas(dto) {
        return (0, content_marketing_logic_1.suggestPersonalIdeas)(dto, this.openai);
    }
    suggestPersonalTitles(dto) {
        return (0, content_marketing_logic_1.suggestPersonalTitles)(dto, this.openai);
    }
    checkFacebookPolicy(dto, organizationId) {
        const input = this.normalizeFacebookPolicyInput(dto, organizationId);
        const hasMediaExtras = Boolean(input.imageOcrText?.trim() || input.transcript?.trim() || input.landingPageText?.trim());
        if (!hasMediaExtras) {
            return (0, facebook_policy_logic_1.checkFacebookAdPolicy)(input, this.openai);
        }
        const media = [];
        if (input.imageOcrText?.trim()) {
            media.push({
                mediaType: 'image',
                ocrText: input.imageOcrText,
                transcript: '',
                caption: '',
                visualNotes: [],
                regions: [],
                findings: (0, facebook_policy_media_logic_1.findingsFromMediaText)(input.imageOcrText, 'img'),
                insufficientData: false,
                statusHint: 'OK',
                warnings: [],
            });
        }
        if (input.transcript?.trim()) {
            media.push({
                mediaType: 'transcript',
                ocrText: '',
                transcript: input.transcript,
                caption: '',
                visualNotes: [],
                regions: [],
                findings: (0, facebook_policy_media_logic_1.findingsFromMediaText)(input.transcript, 'tr'),
                insufficientData: false,
                statusHint: 'OK',
                warnings: [],
            });
        }
        return (0, facebook_policy_merge_logic_1.checkFacebookAdPolicyMerged)({
            input,
            media,
            landingImport: input.landingPageText?.trim()
                ? {
                    sourceType: 'landing_page',
                    url: input.landingUrl || '',
                    editable: true,
                    primaryText: input.landingPageText,
                    warnings: [],
                    insufficientData: false,
                    landing: (0, facebook_policy_import_logic_1.analyzeLandingSignals)('', input.landingPageText),
                }
                : undefined,
            openai: this.openai,
        });
    }
    rewriteFacebookPolicy(dto, organizationId) {
        const input = this.normalizeFacebookPolicyInput(dto, organizationId);
        const primaryText = input.primaryText?.trim() || input.contentToRewrite?.trim() || '';
        return (0, facebook_policy_logic_1.rewriteFacebookAdPolicy)({
            ...input,
            primaryText: primaryText || input.primaryText,
        }, this.openai);
    }
    /** Map FE aliases; drop UI-only fields; org from JWT only. */
    normalizeFacebookPolicyInput(dto, organizationId) {
        const primaryText = [
            dto.primaryText,
            dto.content,
            dto.text,
            dto.adCopy,
            dto.contentToRewrite,
        ]
            .map((s) => (typeof s === 'string' ? s.trim() : ''))
            .find((s) => s.length > 0);
        return {
            headline: dto.headline,
            primaryText: primaryText || dto.primaryText,
            description: dto.description,
            cta: dto.cta,
            productService: dto.productService,
            audience: dto.audience,
            country: dto.country,
            ageMin: dto.ageMin,
            ageMax: dto.ageMax,
            specialAdCategory: dto.specialAdCategory,
            brandName: dto.brandName,
            contentToRewrite: dto.contentToRewrite,
            imageOcrText: dto.imageOcrText,
            transcript: dto.transcript,
            landingPageText: dto.landingPageText,
            landingUrl: dto.landingUrl,
            organizationId: organizationId ?? null,
        };
    }
    async importFacebookPolicyUrl(dto, userId, organizationId) {
        try {
            return await (0, facebook_policy_import_logic_1.importPolicyUrl)({
                url: dto.url,
                urlKind: dto.urlKind,
                fanpageId: dto.fanpageId,
                userId,
                organizationId,
                prisma: this.prisma,
                config: this.config,
            });
        }
        catch (e) {
            throw new common_1.BadRequestException(e instanceof Error ? e.message : 'Import URL thất bại');
        }
    }
    async analyzeFacebookPolicyMedia(dto, file, thumb) {
        if (file?.buffer?.length) {
            const { assertUploadFile } = await Promise.resolve().then(() => __importStar(require('../common/uploads/upload-policy')));
            assertUploadFile('media', {
                originalname: file.originalname || 'media.bin',
                mimetype: file.mimetype,
                size: file.size ?? file.buffer.length,
            });
        }
        const mediaType = dto.mediaType ||
            (file?.mimetype?.startsWith('video/')
                ? 'video'
                : file?.mimetype?.startsWith('image/')
                    ? 'image'
                    : dto.transcript?.trim()
                        ? 'transcript'
                        : 'image');
        if (mediaType === 'transcript' || (!file && dto.transcript?.trim())) {
            return (0, facebook_policy_media_logic_1.analyzePolicyTranscriptOnly)({
                transcript: dto.transcript || '',
                caption: dto.caption,
            });
        }
        if (!file?.buffer?.length && !dto.transcript?.trim()) {
            return {
                mediaType,
                ocrText: '',
                transcript: '',
                caption: dto.caption || '',
                visualNotes: [],
                regions: [],
                findings: [],
                insufficientData: true,
                statusHint: 'INSUFFICIENT_DATA',
                message: 'INSUFFICIENT_DATA: thiếu file hoặc transcript',
                warnings: ['Cần upload ảnh/video hoặc dán transcript.'],
            };
        }
        if (mediaType === 'video') {
            return (0, facebook_policy_media_logic_1.analyzePolicyVideo)({
                buffer: file?.buffer,
                mimeType: file?.mimetype,
                filename: file?.originalname,
                caption: dto.caption,
                manualTranscript: dto.transcript,
                thumbnailBuffer: thumb?.buffer,
                thumbnailMime: thumb?.mimetype,
                openai: this.openai,
            });
        }
        return (0, facebook_policy_media_logic_1.analyzePolicyImage)({
            buffer: file.buffer,
            mimeType: file?.mimetype || 'image/jpeg',
            filename: file?.originalname,
            caption: dto.caption,
            openai: this.openai,
        });
    }
    status() {
        return {
            aiConfigured: this.openai.isConfigured(),
            model: this.openai.getDefaultModel(),
        };
    }
};
exports.ContentMarketingService = ContentMarketingService;
exports.ContentMarketingService = ContentMarketingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [openai_service_1.OpenAiService,
        prisma_service_1.PrismaService,
        config_1.ConfigService])
], ContentMarketingService);
