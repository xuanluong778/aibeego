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
exports.SelectOAuthPagesDto = exports.SelectAutoPostPageDto = exports.AutoPostListQueryDto = exports.ScheduleAutoPostDto = exports.PublishAutoPostDto = exports.UpdateAutoPostDto = exports.SaveAutoPostDraftDto = exports.RewriteAutoPostDto = exports.GenerateAutoPostDto = void 0;
const class_validator_1 = require("class-validator");
const database_1 = require("@marketingspa/database");
class GenerateAutoPostDto {
    postType;
    topic;
    spaService;
    targetAudience;
    tone;
    promotion;
    linkUrl;
    hashtags;
    cta;
}
exports.GenerateAutoPostDto = GenerateAutoPostDto;
__decorate([
    (0, class_validator_1.IsEnum)(database_1.AutoPostType),
    __metadata("design:type", String)
], GenerateAutoPostDto.prototype, "postType", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], GenerateAutoPostDto.prototype, "topic", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], GenerateAutoPostDto.prototype, "spaService", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], GenerateAutoPostDto.prototype, "targetAudience", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], GenerateAutoPostDto.prototype, "tone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], GenerateAutoPostDto.prototype, "promotion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], GenerateAutoPostDto.prototype, "linkUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], GenerateAutoPostDto.prototype, "hashtags", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], GenerateAutoPostDto.prototype, "cta", void 0);
class RewriteAutoPostDto {
    mode;
    caption;
    cta;
}
exports.RewriteAutoPostDto = RewriteAutoPostDto;
__decorate([
    (0, class_validator_1.IsEnum)(['rewrite', 'shorten', 'stronger_cta']),
    __metadata("design:type", String)
], RewriteAutoPostDto.prototype, "mode", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], RewriteAutoPostDto.prototype, "caption", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RewriteAutoPostDto.prototype, "cta", void 0);
class SaveAutoPostDraftDto {
    id;
    postType;
    topic;
    caption;
    fanpageId;
    imageUrl;
    linkUrl;
    hashtags;
    cta;
    spaService;
    targetAudience;
    tone;
    promotion;
    customIndustry;
    industryId;
    industryName;
}
exports.SaveAutoPostDraftDto = SaveAutoPostDraftDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SaveAutoPostDraftDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(database_1.AutoPostType),
    __metadata("design:type", String)
], SaveAutoPostDraftDto.prototype, "postType", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], SaveAutoPostDraftDto.prototype, "topic", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SaveAutoPostDraftDto.prototype, "caption", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SaveAutoPostDraftDto.prototype, "fanpageId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SaveAutoPostDraftDto.prototype, "imageUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SaveAutoPostDraftDto.prototype, "linkUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SaveAutoPostDraftDto.prototype, "hashtags", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SaveAutoPostDraftDto.prototype, "cta", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SaveAutoPostDraftDto.prototype, "spaService", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SaveAutoPostDraftDto.prototype, "targetAudience", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SaveAutoPostDraftDto.prototype, "tone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SaveAutoPostDraftDto.prototype, "promotion", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SaveAutoPostDraftDto.prototype, "customIndustry", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SaveAutoPostDraftDto.prototype, "industryId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SaveAutoPostDraftDto.prototype, "industryName", void 0);
class UpdateAutoPostDto extends SaveAutoPostDraftDto {
}
exports.UpdateAutoPostDto = UpdateAutoPostDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpdateAutoPostDto.prototype, "id", void 0);
class PublishAutoPostDto {
    postId;
    fanpageIds;
}
exports.PublishAutoPostDto = PublishAutoPostDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PublishAutoPostDto.prototype, "postId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], PublishAutoPostDto.prototype, "fanpageIds", void 0);
class ScheduleAutoPostDto {
    postId;
    scheduledAt;
    fanpageIds;
}
exports.ScheduleAutoPostDto = ScheduleAutoPostDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ScheduleAutoPostDto.prototype, "postId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ScheduleAutoPostDto.prototype, "scheduledAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], ScheduleAutoPostDto.prototype, "fanpageIds", void 0);
class AutoPostListQueryDto {
    status;
    customIndustry;
    industryId;
}
exports.AutoPostListQueryDto = AutoPostListQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.AutoPostStatus),
    __metadata("design:type", String)
], AutoPostListQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AutoPostListQueryDto.prototype, "customIndustry", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AutoPostListQueryDto.prototype, "industryId", void 0);
class SelectAutoPostPageDto {
    fanpageId;
}
exports.SelectAutoPostPageDto = SelectAutoPostPageDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SelectAutoPostPageDto.prototype, "fanpageId", void 0);
/** Chọn Fanpage sau OAuth — chỉ lưu Page user chủ động chọn (Facebook Page ID). */
class SelectOAuthPagesDto {
    pageIds;
    /** Legacy: chọn 1 page */
    pageId;
}
exports.SelectOAuthPagesDto = SelectOAuthPagesDto;
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayNotEmpty)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], SelectOAuthPagesDto.prototype, "pageIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SelectOAuthPagesDto.prototype, "pageId", void 0);
