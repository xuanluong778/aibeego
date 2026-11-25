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
exports.OAuthReturnDto = exports.CampaignsQueryDto = exports.PublishDraftDto = exports.GenerateAdDraftDto = exports.UpsertEmailReportDto = exports.ConnectGmailDto = exports.ConnectGoogleDto = exports.CampaignActionDto = exports.UpdateAutomationRuleDto = exports.CreateAutomationRuleDto = exports.EmergencyStopDto = exports.UpdateAutoModeDto = exports.SyncAdsDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const database_1 = require("@marketingspa/database");
class SyncAdsDto {
    dateFrom;
    dateTo;
    platform;
}
exports.SyncAdsDto = SyncAdsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SyncAdsDto.prototype, "dateFrom", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SyncAdsDto.prototype, "dateTo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.AdPlatform),
    __metadata("design:type", String)
], SyncAdsDto.prototype, "platform", void 0);
class UpdateAutoModeDto {
    autoModeEnabled;
    dailyBudgetLimit;
    maxTogglesPerDay;
    maxBudgetChangePercent;
    mcpMode;
    minSpendForAction;
    ruleCooldownMinutes;
    ruleLookbackDays;
}
exports.UpdateAutoModeDto = UpdateAutoModeDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateAutoModeDto.prototype, "autoModeEnabled", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateAutoModeDto.prototype, "dailyBudgetLimit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], UpdateAutoModeDto.prototype, "maxTogglesPerDay", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateAutoModeDto.prototype, "maxBudgetChangePercent", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateAutoModeDto.prototype, "mcpMode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateAutoModeDto.prototype, "minSpendForAction", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateAutoModeDto.prototype, "ruleCooldownMinutes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateAutoModeDto.prototype, "ruleLookbackDays", void 0);
class EmergencyStopDto {
    emergencyStop;
}
exports.EmergencyStopDto = EmergencyStopDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], EmergencyStopDto.prototype, "emergencyStop", void 0);
class CreateAutomationRuleDto {
    name;
    ruleType;
    platform;
    threshold;
    spendThreshold;
    enabled;
}
exports.CreateAutomationRuleDto = CreateAutomationRuleDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateAutomationRuleDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(database_1.AdAutomationRuleType),
    __metadata("design:type", String)
], CreateAutomationRuleDto.prototype, "ruleType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.AdPlatform),
    __metadata("design:type", String)
], CreateAutomationRuleDto.prototype, "platform", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateAutomationRuleDto.prototype, "threshold", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateAutomationRuleDto.prototype, "spendThreshold", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateAutomationRuleDto.prototype, "enabled", void 0);
class UpdateAutomationRuleDto {
    name;
    threshold;
    spendThreshold;
    enabled;
}
exports.UpdateAutomationRuleDto = UpdateAutomationRuleDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateAutomationRuleDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateAutomationRuleDto.prototype, "threshold", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpdateAutomationRuleDto.prototype, "spendThreshold", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateAutomationRuleDto.prototype, "enabled", void 0);
class CampaignActionDto {
    campaignId;
}
exports.CampaignActionDto = CampaignActionDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CampaignActionDto.prototype, "campaignId", void 0);
class ConnectGoogleDto {
    refreshToken;
    customerId;
    customerName;
    loginCustomerId;
    accountName;
}
exports.ConnectGoogleDto = ConnectGoogleDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConnectGoogleDto.prototype, "refreshToken", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConnectGoogleDto.prototype, "customerId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConnectGoogleDto.prototype, "customerName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConnectGoogleDto.prototype, "loginCustomerId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConnectGoogleDto.prototype, "accountName", void 0);
class ConnectGmailDto {
    refreshToken;
    email;
}
exports.ConnectGmailDto = ConnectGmailDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConnectGmailDto.prototype, "refreshToken", void 0);
__decorate([
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], ConnectGmailDto.prototype, "email", void 0);
class UpsertEmailReportDto {
    enabled;
    schedule;
    recipientEmail;
    reportOnLoss;
    reportOnLowRoas;
    reportOnAutoPause;
}
exports.UpsertEmailReportDto = UpsertEmailReportDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertEmailReportDto.prototype, "enabled", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(database_1.AdEmailReportSchedule),
    __metadata("design:type", String)
], UpsertEmailReportDto.prototype, "schedule", void 0);
__decorate([
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], UpsertEmailReportDto.prototype, "recipientEmail", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertEmailReportDto.prototype, "reportOnLoss", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertEmailReportDto.prototype, "reportOnLowRoas", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertEmailReportDto.prototype, "reportOnAutoPause", void 0);
class GenerateAdDraftDto {
    platform;
    objective;
    budget;
    product;
    audience;
}
exports.GenerateAdDraftDto = GenerateAdDraftDto;
__decorate([
    (0, class_validator_1.IsEnum)(database_1.AdPlatform),
    __metadata("design:type", String)
], GenerateAdDraftDto.prototype, "platform", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenerateAdDraftDto.prototype, "objective", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], GenerateAdDraftDto.prototype, "budget", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenerateAdDraftDto.prototype, "product", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenerateAdDraftDto.prototype, "audience", void 0);
class PublishDraftDto {
    draftId;
}
exports.PublishDraftDto = PublishDraftDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PublishDraftDto.prototype, "draftId", void 0);
class CampaignsQueryDto {
    dateFrom;
    dateTo;
    page;
    pageSize;
    platform;
}
exports.CampaignsQueryDto = CampaignsQueryDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CampaignsQueryDto.prototype, "dateFrom", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CampaignsQueryDto.prototype, "dateTo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CampaignsQueryDto.prototype, "page", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CampaignsQueryDto.prototype, "pageSize", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CampaignsQueryDto.prototype, "platform", void 0);
class OAuthReturnDto {
    provider;
}
exports.OAuthReturnDto = OAuthReturnDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.AdConnectionProvider),
    __metadata("design:type", String)
], OAuthReturnDto.prototype, "provider", void 0);
