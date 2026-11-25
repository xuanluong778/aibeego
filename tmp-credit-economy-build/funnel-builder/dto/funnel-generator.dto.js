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
exports.SaveFunnelCompleteDraftDto = exports.SelectFunnelRecommendationDto = exports.GenerateFunnelRecommendationsDto = void 0;
const class_validator_1 = require("class-validator");
class GenerateFunnelRecommendationsDto {
    /** "Bạn muốn AI tạo phễu như thế nào?" */
    prompt;
    productService;
    goal;
    price;
    budget;
    region;
    audience;
    channels;
    notes;
    /** @deprecated use productService / structured brief */
    industryHint;
    /** @deprecated use region */
    regionHint;
    /** @deprecated use budget */
    budgetHint;
}
exports.GenerateFunnelRecommendationsDto = GenerateFunnelRecommendationsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], GenerateFunnelRecommendationsDto.prototype, "prompt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], GenerateFunnelRecommendationsDto.prototype, "productService", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], GenerateFunnelRecommendationsDto.prototype, "goal", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(80),
    __metadata("design:type", String)
], GenerateFunnelRecommendationsDto.prototype, "price", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], GenerateFunnelRecommendationsDto.prototype, "budget", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], GenerateFunnelRecommendationsDto.prototype, "region", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(300),
    __metadata("design:type", String)
], GenerateFunnelRecommendationsDto.prototype, "audience", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(12),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MaxLength)(40, { each: true }),
    __metadata("design:type", Array)
], GenerateFunnelRecommendationsDto.prototype, "channels", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1000),
    __metadata("design:type", String)
], GenerateFunnelRecommendationsDto.prototype, "notes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], GenerateFunnelRecommendationsDto.prototype, "industryHint", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], GenerateFunnelRecommendationsDto.prototype, "regionHint", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], GenerateFunnelRecommendationsDto.prototype, "budgetHint", void 0);
class SelectFunnelRecommendationDto {
    templateSlug;
}
exports.SelectFunnelRecommendationDto = SelectFunnelRecommendationDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], SelectFunnelRecommendationDto.prototype, "templateSlug", void 0);
class SaveFunnelCompleteDraftDto {
    /** Full funnel-complete.v1 JSON (draft). Server re-validates schema + graph. */
    complete;
}
exports.SaveFunnelCompleteDraftDto = SaveFunnelCompleteDraftDto;
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], SaveFunnelCompleteDraftDto.prototype, "complete", void 0);
