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
exports.ApproveGoogleAdsCampaignDraftDto = exports.CreateGoogleAdsCampaignDraftDto = exports.GoogleAdsCampaignBriefDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class GoogleAdsCampaignBriefDto {
    product;
    landingPage;
    objective;
    location;
    audience;
    dailyBudget;
    monthlyBudget;
    currency;
}
exports.GoogleAdsCampaignBriefDto = GoogleAdsCampaignBriefDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], GoogleAdsCampaignBriefDto.prototype, "product", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], GoogleAdsCampaignBriefDto.prototype, "landingPage", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], GoogleAdsCampaignBriefDto.prototype, "objective", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], GoogleAdsCampaignBriefDto.prototype, "location", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], GoogleAdsCampaignBriefDto.prototype, "audience", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], GoogleAdsCampaignBriefDto.prototype, "dailyBudget", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], GoogleAdsCampaignBriefDto.prototype, "monthlyBudget", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(8),
    __metadata("design:type", String)
], GoogleAdsCampaignBriefDto.prototype, "currency", void 0);
class CreateGoogleAdsCampaignDraftDto {
    customerId;
    loginCustomerId;
    brief;
}
exports.CreateGoogleAdsCampaignDraftDto = CreateGoogleAdsCampaignDraftDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(5),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], CreateGoogleAdsCampaignDraftDto.prototype, "customerId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], CreateGoogleAdsCampaignDraftDto.prototype, "loginCustomerId", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => GoogleAdsCampaignBriefDto),
    __metadata("design:type", GoogleAdsCampaignBriefDto)
], CreateGoogleAdsCampaignDraftDto.prototype, "brief", void 0);
class ApproveGoogleAdsCampaignDraftDto {
    confirm;
}
exports.ApproveGoogleAdsCampaignDraftDto = ApproveGoogleAdsCampaignDraftDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ApproveGoogleAdsCampaignDraftDto.prototype, "confirm", void 0);
