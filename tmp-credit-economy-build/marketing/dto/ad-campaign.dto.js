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
exports.MarketingReportQueryDto = exports.AdCampaignQueryDto = exports.CreateAdDailyStatDto = exports.CreateAdCampaignDto = exports.CreateAdAccountDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const database_1 = require("@marketingspa/database");
const pagination_dto_1 = require("../../common/dto/pagination.dto");
class CreateAdAccountDto {
    platform;
    name;
    externalId;
    currency;
}
exports.CreateAdAccountDto = CreateAdAccountDto;
__decorate([
    (0, class_validator_1.IsEnum)(database_1.AdPlatform),
    __metadata("design:type", String)
], CreateAdAccountDto.prototype, "platform", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateAdAccountDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateAdAccountDto.prototype, "externalId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateAdAccountDto.prototype, "currency", void 0);
class CreateAdCampaignDto {
    adAccountId;
    name;
    platform;
    budget;
    startDate;
    endDate;
    note;
}
exports.CreateAdCampaignDto = CreateAdCampaignDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateAdCampaignDto.prototype, "adAccountId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateAdCampaignDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(database_1.AdPlatform),
    __metadata("design:type", String)
], CreateAdCampaignDto.prototype, "platform", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], CreateAdCampaignDto.prototype, "budget", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateAdCampaignDto.prototype, "startDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateAdCampaignDto.prototype, "endDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateAdCampaignDto.prototype, "note", void 0);
class CreateAdDailyStatDto {
    adCampaignId;
    date;
    impressions;
    clicks;
    spend;
    leads;
    conversions;
}
exports.CreateAdDailyStatDto = CreateAdDailyStatDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateAdDailyStatDto.prototype, "adCampaignId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateAdDailyStatDto.prototype, "date", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateAdDailyStatDto.prototype, "impressions", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateAdDailyStatDto.prototype, "clicks", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], CreateAdDailyStatDto.prototype, "spend", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateAdDailyStatDto.prototype, "leads", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateAdDailyStatDto.prototype, "conversions", void 0);
class AdCampaignQueryDto extends pagination_dto_1.PaginationDto {
    status;
    platform;
}
exports.AdCampaignQueryDto = AdCampaignQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.AdCampaignStatus),
    __metadata("design:type", String)
], AdCampaignQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.AdPlatform),
    __metadata("design:type", String)
], AdCampaignQueryDto.prototype, "platform", void 0);
class MarketingReportQueryDto {
    adCampaignId;
    from;
    to;
}
exports.MarketingReportQueryDto = MarketingReportQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MarketingReportQueryDto.prototype, "adCampaignId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], MarketingReportQueryDto.prototype, "from", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], MarketingReportQueryDto.prototype, "to", void 0);
