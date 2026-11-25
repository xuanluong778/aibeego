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
exports.TestSendMessagingCampaignDto = exports.ScheduleMessagingCampaignDto = exports.PreviewEligibilityDto = exports.MessagingCampaignQueryDto = exports.UpdateMessagingCampaignDto = exports.CreateMessagingCampaignDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const database_1 = require("@marketingspa/database");
class CreateMessagingCampaignDto {
    name;
    channel;
    campaignType;
    channelConnectionId;
    integrationId;
    messageTemplateId;
    segmentConfig;
    variables;
    timezone;
}
exports.CreateMessagingCampaignDto = CreateMessagingCampaignDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateMessagingCampaignDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(database_1.MessageChannel),
    __metadata("design:type", String)
], CreateMessagingCampaignDto.prototype, "channel", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(database_1.MessagingCampaignKind),
    __metadata("design:type", String)
], CreateMessagingCampaignDto.prototype, "campaignType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateMessagingCampaignDto.prototype, "channelConnectionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateMessagingCampaignDto.prototype, "integrationId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateMessagingCampaignDto.prototype, "messageTemplateId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateMessagingCampaignDto.prototype, "segmentConfig", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateMessagingCampaignDto.prototype, "variables", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateMessagingCampaignDto.prototype, "timezone", void 0);
class UpdateMessagingCampaignDto {
    name;
    channel;
    campaignType;
    channelConnectionId;
    integrationId;
    messageTemplateId;
    segmentConfig;
    variables;
    timezone;
}
exports.UpdateMessagingCampaignDto = UpdateMessagingCampaignDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], UpdateMessagingCampaignDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.MessageChannel),
    __metadata("design:type", String)
], UpdateMessagingCampaignDto.prototype, "channel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.MessagingCampaignKind),
    __metadata("design:type", String)
], UpdateMessagingCampaignDto.prototype, "campaignType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateMessagingCampaignDto.prototype, "channelConnectionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateMessagingCampaignDto.prototype, "integrationId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateMessagingCampaignDto.prototype, "messageTemplateId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateMessagingCampaignDto.prototype, "segmentConfig", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateMessagingCampaignDto.prototype, "variables", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateMessagingCampaignDto.prototype, "timezone", void 0);
class MessagingCampaignQueryDto {
    page;
    pageSize;
    status;
    channel;
    search;
}
exports.MessagingCampaignQueryDto = MessagingCampaignQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], MessagingCampaignQueryDto.prototype, "page", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], MessagingCampaignQueryDto.prototype, "pageSize", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.MessagingCampaignStatus),
    __metadata("design:type", String)
], MessagingCampaignQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.MessageChannel),
    __metadata("design:type", String)
], MessagingCampaignQueryDto.prototype, "channel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MessagingCampaignQueryDto.prototype, "search", void 0);
class PreviewEligibilityDto {
    limit;
    identityIds;
}
exports.PreviewEligibilityDto = PreviewEligibilityDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(2000),
    __metadata("design:type", Number)
], PreviewEligibilityDto.prototype, "limit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], PreviewEligibilityDto.prototype, "identityIds", void 0);
class ScheduleMessagingCampaignDto {
    scheduledAt;
    timezone;
}
exports.ScheduleMessagingCampaignDto = ScheduleMessagingCampaignDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ScheduleMessagingCampaignDto.prototype, "scheduledAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ScheduleMessagingCampaignDto.prototype, "timezone", void 0);
class TestSendMessagingCampaignDto {
    identityId;
    customerId;
    leadId;
    context;
}
exports.TestSendMessagingCampaignDto = TestSendMessagingCampaignDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TestSendMessagingCampaignDto.prototype, "identityId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TestSendMessagingCampaignDto.prototype, "customerId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TestSendMessagingCampaignDto.prototype, "leadId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], TestSendMessagingCampaignDto.prototype, "context", void 0);
