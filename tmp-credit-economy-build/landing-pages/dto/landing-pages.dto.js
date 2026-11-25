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
exports.LandingPageChatbotLeadDto = exports.LandingPageChatbotMessageDto = exports.TrackLandingPageEventDto = exports.SubmitLandingPageLeadDto = exports.LandingPageAnalyticsQueryDto = exports.RestoreLandingPageVersionDto = exports.ApplyPageDoctorDto = exports.CrawlLandingPageUrlDto = exports.InlineAiSuggestFieldDto = exports.ApplyBusinessProfileDto = exports.UpsertBusinessProfileDto = exports.GenerateLandingPageAiDto = exports.SuggestLandingPageBriefDto = exports.UpsertCustomDomainDto = exports.PublishLandingPageDto = exports.AutosaveLandingPageDto = exports.UpdateLandingPageDto = exports.CreateLandingPageDto = exports.ListLandingPageTemplatesQueryDto = exports.ListLandingPagesQueryDto = exports.ValidateTemplateContentImagesDto = exports.ImportTemplateUrlImageDto = exports.GenerateTemplateContentDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class GenerateTemplateContentDto {
    brief;
    /** Current unsaved canvas, used for suggestions only; never persisted by this endpoint. */
    snapshot;
    blockId;
    sourceId;
    idempotencyKey;
}
exports.GenerateTemplateContentDto = GenerateTemplateContentDto;
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], GenerateTemplateContentDto.prototype, "brief", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], GenerateTemplateContentDto.prototype, "snapshot", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(180),
    __metadata("design:type", String)
], GenerateTemplateContentDto.prototype, "blockId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], GenerateTemplateContentDto.prototype, "sourceId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], GenerateTemplateContentDto.prototype, "idempotencyKey", void 0);
class ImportTemplateUrlImageDto {
    sourceId;
    imageUrl;
}
exports.ImportTemplateUrlImageDto = ImportTemplateUrlImageDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], ImportTemplateUrlImageDto.prototype, "sourceId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], ImportTemplateUrlImageDto.prototype, "imageUrl", void 0);
class ValidateTemplateContentImagesDto {
    imageIds;
}
exports.ValidateTemplateContentImagesDto = ValidateTemplateContentImagesDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(30),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MaxLength)(300, { each: true }),
    __metadata("design:type", Array)
], ValidateTemplateContentImagesDto.prototype, "imageIds", void 0);
const THEMES = ['MODERN', 'PREMIUM', 'MINIMAL', 'BOLD', 'CORPORATE'];
const STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];
const EVENT_TYPES = ['PAGE_VIEW', 'CTA_CLICK', 'FORM_START', 'FORM_SUBMIT', 'LEAD'];
class ListLandingPagesQueryDto {
    status;
    q;
}
exports.ListLandingPagesQueryDto = ListLandingPagesQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([...STATUSES, 'ALL']),
    __metadata("design:type", String)
], ListLandingPagesQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], ListLandingPagesQueryDto.prototype, "q", void 0);
class ListLandingPageTemplatesQueryDto {
    category;
    theme;
    /** Free-text search on name / description / tags / slug. */
    q;
    /** Filter by design family (editorial | minimal | luxury | …). */
    designFamily;
    /** Filter by conversion goal (lead | booking | purchase | …). */
    conversionGoal;
    includeSystem;
}
exports.ListLandingPageTemplatesQueryDto = ListLandingPageTemplatesQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], ListLandingPageTemplatesQueryDto.prototype, "category", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([...THEMES]),
    __metadata("design:type", String)
], ListLandingPageTemplatesQueryDto.prototype, "theme", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], ListLandingPageTemplatesQueryDto.prototype, "q", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(32),
    __metadata("design:type", String)
], ListLandingPageTemplatesQueryDto.prototype, "designFamily", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(32),
    __metadata("design:type", String)
], ListLandingPageTemplatesQueryDto.prototype, "conversionGoal", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Boolean),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ListLandingPageTemplatesQueryDto.prototype, "includeSystem", void 0);
class CreateLandingPageDto {
    /** Explicit blank starter; omitted by template and AI/URL creation. */
    mode;
    /** Confirmed AI preview, saved atomically with the new draft. */
    draftSpec;
    name;
    slug;
    templateSlug;
    templateId;
    theme;
    /** Optional client key — retries with same key reuse the same page (no duplicate). */
    idempotencyKey;
}
exports.CreateLandingPageDto = CreateLandingPageDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['blank']),
    __metadata("design:type", String)
], CreateLandingPageDto.prototype, "mode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateLandingPageDto.prototype, "draftSpec", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateLandingPageDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], CreateLandingPageDto.prototype, "slug", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], CreateLandingPageDto.prototype, "templateSlug", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], CreateLandingPageDto.prototype, "templateId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([...THEMES]),
    __metadata("design:type", String)
], CreateLandingPageDto.prototype, "theme", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], CreateLandingPageDto.prototype, "idempotencyKey", void 0);
class UpdateLandingPageDto {
    name;
    slug;
    theme;
    draftSpec;
    seoTitle;
    seoDescription;
    seoCanonical;
    ogImage;
    robotsIndex;
    subdomainSlug;
    trackingConfig;
}
exports.UpdateLandingPageDto = UpdateLandingPageDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], UpdateLandingPageDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], UpdateLandingPageDto.prototype, "slug", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([...THEMES]),
    __metadata("design:type", String)
], UpdateLandingPageDto.prototype, "theme", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateLandingPageDto.prototype, "draftSpec", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], UpdateLandingPageDto.prototype, "seoTitle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], UpdateLandingPageDto.prototype, "seoDescription", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], UpdateLandingPageDto.prototype, "seoCanonical", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], UpdateLandingPageDto.prototype, "ogImage", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateLandingPageDto.prototype, "robotsIndex", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], UpdateLandingPageDto.prototype, "subdomainSlug", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateLandingPageDto.prototype, "trackingConfig", void 0);
class AutosaveLandingPageDto {
    draftSpec;
    name;
    /** Monotonic client revision — stale (lower) saves are rejected. */
    clientRevision;
    /** Revision this tab last loaded or saved. Must match the stored draft. */
    baseRevision;
    /** Idempotency / trace id from builder (optional). */
    requestId;
}
exports.AutosaveLandingPageDto = AutosaveLandingPageDto;
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], AutosaveLandingPageDto.prototype, "draftSpec", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], AutosaveLandingPageDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], AutosaveLandingPageDto.prototype, "clientRevision", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], AutosaveLandingPageDto.prototype, "baseRevision", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], AutosaveLandingPageDto.prototype, "requestId", void 0);
class PublishLandingPageDto {
    publicationTarget;
    subdomainSlug;
    note;
    /** Draft revision that just autosaved. Publish refuses a different stored revision. */
    clientRevision;
}
exports.PublishLandingPageDto = PublishLandingPageDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['path', 'subdomain']),
    __metadata("design:type", String)
], PublishLandingPageDto.prototype, "publicationTarget", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(63),
    __metadata("design:type", String)
], PublishLandingPageDto.prototype, "subdomainSlug", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], PublishLandingPageDto.prototype, "note", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PublishLandingPageDto.prototype, "clientRevision", void 0);
class UpsertCustomDomainDto {
    customDomain;
}
exports.UpsertCustomDomainDto = UpsertCustomDomainDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], UpsertCustomDomainDto.prototype, "customDomain", void 0);
class SuggestLandingPageBriefDto {
    field;
    businessType;
    brandName;
    productService;
    targetCustomer;
    painPoint;
    uspBenefits;
    pageGoal;
    idempotencyKey;
}
exports.SuggestLandingPageBriefDto = SuggestLandingPageBriefDto;
__decorate([
    (0, class_validator_1.IsIn)(['targetCustomer', 'painPoint', 'uspBenefits']),
    __metadata("design:type", String)
], SuggestLandingPageBriefDto.prototype, "field", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], SuggestLandingPageBriefDto.prototype, "businessType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], SuggestLandingPageBriefDto.prototype, "brandName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], SuggestLandingPageBriefDto.prototype, "productService", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(400),
    __metadata("design:type", String)
], SuggestLandingPageBriefDto.prototype, "targetCustomer", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(400),
    __metadata("design:type", String)
], SuggestLandingPageBriefDto.prototype, "painPoint", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(800),
    __metadata("design:type", String)
], SuggestLandingPageBriefDto.prototype, "uspBenefits", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['lead', 'sales', 'signup', 'consult', 'event']),
    __metadata("design:type", String)
], SuggestLandingPageBriefDto.prototype, "pageGoal", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], SuggestLandingPageBriefDto.prototype, "idempotencyKey", void 0);
class GenerateLandingPageAiDto {
    ctaLabel;
    ctaUrl;
    imageUrl;
    logoUrl;
    brandColor;
    guarantee;
    contactPhone;
    contactEmail;
    contactAddress;
    /** The UI has already shown and let the user edit extracted/profile data. */
    sourceReviewed;
    productService;
    brandName;
    price;
    targetCustomer;
    /** Optional in AI-first create — server derives USP when empty. */
    uspBenefits;
    pageGoal;
    extraNotes;
    /** Optional public URL — server enriches brief via SSRF-safe fetch. */
    sourceUrl;
    /** If set, apply AI copy onto this page draft */
    landingPageId;
    /** Optional client key — retries reuse prior generate result for same org/key. */
    idempotencyKey;
    /** Merge tenant BusinessProfile into AI brief context. */
    useBusinessProfile;
    /** Explicit catalog template — AI fills content into this schema. */
    templateSlug;
    /** Business type signal for AI template selection (e.g. spa, saas, agency). */
    businessType;
    /** Offer / promotion signal for template selection. */
    offer;
    /** Pain point — deepens AI benefits / FAQ. */
    painPoint;
    /** Copy tone. */
    tone;
}
exports.GenerateLandingPageAiDto = GenerateLandingPageAiDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], GenerateLandingPageAiDto.prototype, "ctaLabel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], GenerateLandingPageAiDto.prototype, "ctaUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], GenerateLandingPageAiDto.prototype, "imageUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], GenerateLandingPageAiDto.prototype, "logoUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(32),
    __metadata("design:type", String)
], GenerateLandingPageAiDto.prototype, "brandColor", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(400),
    __metadata("design:type", String)
], GenerateLandingPageAiDto.prototype, "guarantee", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], GenerateLandingPageAiDto.prototype, "contactPhone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", String)
], GenerateLandingPageAiDto.prototype, "contactEmail", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], GenerateLandingPageAiDto.prototype, "contactAddress", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], GenerateLandingPageAiDto.prototype, "sourceReviewed", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], GenerateLandingPageAiDto.prototype, "productService", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], GenerateLandingPageAiDto.prototype, "brandName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], GenerateLandingPageAiDto.prototype, "price", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(400),
    __metadata("design:type", String)
], GenerateLandingPageAiDto.prototype, "targetCustomer", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(800),
    __metadata("design:type", String)
], GenerateLandingPageAiDto.prototype, "uspBenefits", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['lead', 'sales', 'signup', 'consult', 'event']),
    __metadata("design:type", String)
], GenerateLandingPageAiDto.prototype, "pageGoal", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1200),
    __metadata("design:type", String)
], GenerateLandingPageAiDto.prototype, "extraNotes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], GenerateLandingPageAiDto.prototype, "sourceUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], GenerateLandingPageAiDto.prototype, "landingPageId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], GenerateLandingPageAiDto.prototype, "idempotencyKey", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], GenerateLandingPageAiDto.prototype, "useBusinessProfile", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], GenerateLandingPageAiDto.prototype, "templateSlug", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], GenerateLandingPageAiDto.prototype, "businessType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], GenerateLandingPageAiDto.prototype, "offer", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(400),
    __metadata("design:type", String)
], GenerateLandingPageAiDto.prototype, "painPoint", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['professional', 'bold', 'friendly']),
    __metadata("design:type", String)
], GenerateLandingPageAiDto.prototype, "tone", void 0);
class UpsertBusinessProfileDto {
    brandName;
    companyName;
    website;
    industry;
    description;
    productService;
    targetCustomer;
    usp;
    hotline;
    email;
    address;
    logoUrl;
    brandColor;
    facebookUrl;
    socialLinks;
    defaultCta;
}
exports.UpsertBusinessProfileDto = UpsertBusinessProfileDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], UpsertBusinessProfileDto.prototype, "brandName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", String)
], UpsertBusinessProfileDto.prototype, "companyName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], UpsertBusinessProfileDto.prototype, "website", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], UpsertBusinessProfileDto.prototype, "industry", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], UpsertBusinessProfileDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(400),
    __metadata("design:type", String)
], UpsertBusinessProfileDto.prototype, "productService", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(400),
    __metadata("design:type", String)
], UpsertBusinessProfileDto.prototype, "targetCustomer", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(800),
    __metadata("design:type", String)
], UpsertBusinessProfileDto.prototype, "usp", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], UpsertBusinessProfileDto.prototype, "hotline", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", String)
], UpsertBusinessProfileDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], UpsertBusinessProfileDto.prototype, "address", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], UpsertBusinessProfileDto.prototype, "logoUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(32),
    __metadata("design:type", String)
], UpsertBusinessProfileDto.prototype, "brandColor", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], UpsertBusinessProfileDto.prototype, "facebookUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpsertBusinessProfileDto.prototype, "socialLinks", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], UpsertBusinessProfileDto.prototype, "defaultCta", void 0);
class ApplyBusinessProfileDto {
    force;
    pageGoal;
}
exports.ApplyBusinessProfileDto = ApplyBusinessProfileDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ApplyBusinessProfileDto.prototype, "force", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['lead', 'sales', 'signup', 'consult', 'event']),
    __metadata("design:type", String)
], ApplyBusinessProfileDto.prototype, "pageGoal", void 0);
class InlineAiSuggestFieldDto {
    action;
    fieldKind;
    currentContent;
    blockType;
    pageGoal;
    blockContext;
    useBusinessProfile;
}
exports.InlineAiSuggestFieldDto = InlineAiSuggestFieldDto;
__decorate([
    (0, class_validator_1.IsIn)([
        'suggest_3',
        'more_engaging',
        'shorter',
        'clearer',
        'more_conversion',
        'more_professional',
        'more_friendly',
        'fix_spelling',
        'rewrite',
    ]),
    __metadata("design:type", String)
], InlineAiSuggestFieldDto.prototype, "action", void 0);
__decorate([
    (0, class_validator_1.IsIn)([
        'seo.title',
        'chatbot.greeting',
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
    ]),
    __metadata("design:type", String)
], InlineAiSuggestFieldDto.prototype, "fieldKind", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], InlineAiSuggestFieldDto.prototype, "currentContent", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([
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
    ]),
    __metadata("design:type", String)
], InlineAiSuggestFieldDto.prototype, "blockType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['lead', 'sales', 'signup', 'consult', 'event']),
    __metadata("design:type", String)
], InlineAiSuggestFieldDto.prototype, "pageGoal", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], InlineAiSuggestFieldDto.prototype, "blockContext", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], InlineAiSuggestFieldDto.prototype, "useBusinessProfile", void 0);
class CrawlLandingPageUrlDto {
    url;
}
exports.CrawlLandingPageUrlDto = CrawlLandingPageUrlDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], CrawlLandingPageUrlDto.prototype, "url", void 0);
class ApplyPageDoctorDto {
    report;
    /** Patch ids user selected to apply. */
    selectedPatchIds;
    /** Idempotent Apply — retries must not create duplicate versions / double-charge. */
    idempotencyKey;
}
exports.ApplyPageDoctorDto = ApplyPageDoctorDto;
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], ApplyPageDoctorDto.prototype, "report", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], ApplyPageDoctorDto.prototype, "selectedPatchIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], ApplyPageDoctorDto.prototype, "idempotencyKey", void 0);
class RestoreLandingPageVersionDto {
    /** Optional note for the new “before restore” snapshot. */
    note;
}
exports.RestoreLandingPageVersionDto = RestoreLandingPageVersionDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], RestoreLandingPageVersionDto.prototype, "note", void 0);
class LandingPageAnalyticsQueryDto {
    pageId;
    utmSource;
    utmMedium;
    utmCampaign;
    device;
    from;
    to;
}
exports.LandingPageAnalyticsQueryDto = LandingPageAnalyticsQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], LandingPageAnalyticsQueryDto.prototype, "pageId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], LandingPageAnalyticsQueryDto.prototype, "utmSource", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], LandingPageAnalyticsQueryDto.prototype, "utmMedium", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", String)
], LandingPageAnalyticsQueryDto.prototype, "utmCampaign", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], LandingPageAnalyticsQueryDto.prototype, "device", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LandingPageAnalyticsQueryDto.prototype, "from", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LandingPageAnalyticsQueryDto.prototype, "to", void 0);
class SubmitLandingPageLeadDto {
    fields;
    blockId;
    /** Honeypot — must be empty */
    website;
    attribution;
    referrer;
    landingPageUrl;
    visitorId;
    sessionId;
    device;
}
exports.SubmitLandingPageLeadDto = SubmitLandingPageLeadDto;
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], SubmitLandingPageLeadDto.prototype, "fields", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], SubmitLandingPageLeadDto.prototype, "blockId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], SubmitLandingPageLeadDto.prototype, "website", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], SubmitLandingPageLeadDto.prototype, "attribution", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], SubmitLandingPageLeadDto.prototype, "referrer", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], SubmitLandingPageLeadDto.prototype, "landingPageUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], SubmitLandingPageLeadDto.prototype, "visitorId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], SubmitLandingPageLeadDto.prototype, "sessionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], SubmitLandingPageLeadDto.prototype, "device", void 0);
class TrackLandingPageEventDto {
    eventType;
    visitorId;
    sessionId;
    device;
    utmSource;
    utmMedium;
    utmCampaign;
    utmContent;
    utmTerm;
    referrer;
    meta;
    /** Honeypot — bots only */
    website;
}
exports.TrackLandingPageEventDto = TrackLandingPageEventDto;
__decorate([
    (0, class_validator_1.IsIn)([...EVENT_TYPES]),
    __metadata("design:type", Object)
], TrackLandingPageEventDto.prototype, "eventType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], TrackLandingPageEventDto.prototype, "visitorId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], TrackLandingPageEventDto.prototype, "sessionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(40),
    __metadata("design:type", String)
], TrackLandingPageEventDto.prototype, "device", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], TrackLandingPageEventDto.prototype, "utmSource", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], TrackLandingPageEventDto.prototype, "utmMedium", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", String)
], TrackLandingPageEventDto.prototype, "utmCampaign", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", String)
], TrackLandingPageEventDto.prototype, "utmContent", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", String)
], TrackLandingPageEventDto.prototype, "utmTerm", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], TrackLandingPageEventDto.prototype, "referrer", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], TrackLandingPageEventDto.prototype, "meta", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], TrackLandingPageEventDto.prototype, "website", void 0);
class LandingPageChatbotMessageDto {
    message;
    sessionId;
    pageUrl;
    /** Draft preview token — isolates sessions; never trusted for bot binding. */
    previewToken;
}
exports.LandingPageChatbotMessageDto = LandingPageChatbotMessageDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], LandingPageChatbotMessageDto.prototype, "message", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], LandingPageChatbotMessageDto.prototype, "sessionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], LandingPageChatbotMessageDto.prototype, "pageUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], LandingPageChatbotMessageDto.prototype, "previewToken", void 0);
class LandingPageChatbotLeadDto {
    name;
    phone;
    email;
    need;
    sessionId;
    pageUrl;
    previewToken;
}
exports.LandingPageChatbotLeadDto = LandingPageChatbotLeadDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], LandingPageChatbotLeadDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(6),
    (0, class_validator_1.MaxLength)(32),
    __metadata("design:type", String)
], LandingPageChatbotLeadDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.MaxLength)(160),
    __metadata("design:type", String)
], LandingPageChatbotLeadDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], LandingPageChatbotLeadDto.prototype, "need", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], LandingPageChatbotLeadDto.prototype, "sessionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], LandingPageChatbotLeadDto.prototype, "pageUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], LandingPageChatbotLeadDto.prototype, "previewToken", void 0);
