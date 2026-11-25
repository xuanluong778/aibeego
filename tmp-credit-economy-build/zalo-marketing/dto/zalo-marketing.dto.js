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
exports.StartZaloOAuthDto = exports.TestZaloZbsSendDto = exports.ScheduleZaloCampaignDto = exports.PreviewZaloCampaignDto = exports.PreviewZaloAudienceDto = exports.SyncZbsTemplatesDto = exports.ConnectZaloZbsDto = exports.UpdateZaloCampaignDto = exports.CreateZaloCampaignDto = exports.ZaloCampaignQueryDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const database_1 = require("@marketingspa/database");
class ZaloCampaignQueryDto {
    page;
    pageSize;
    status;
    campaignType;
}
exports.ZaloCampaignQueryDto = ZaloCampaignQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], ZaloCampaignQueryDto.prototype, "page", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], ZaloCampaignQueryDto.prototype, "pageSize", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.MessagingCampaignStatus),
    __metadata("design:type", String)
], ZaloCampaignQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.MessagingCampaignKind),
    __metadata("design:type", String)
], ZaloCampaignQueryDto.prototype, "campaignType", void 0);
class CreateZaloCampaignDto {
    name;
    campaignType;
    channelConnectionId;
    zbsConnectionId;
    messageTemplateId;
    segmentConfig;
    variables;
    timezone;
}
exports.CreateZaloCampaignDto = CreateZaloCampaignDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateZaloCampaignDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(database_1.MessagingCampaignKind),
    __metadata("design:type", String)
], CreateZaloCampaignDto.prototype, "campaignType", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateZaloCampaignDto.prototype, "channelConnectionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateZaloCampaignDto.prototype, "zbsConnectionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateZaloCampaignDto.prototype, "messageTemplateId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateZaloCampaignDto.prototype, "segmentConfig", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateZaloCampaignDto.prototype, "variables", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateZaloCampaignDto.prototype, "timezone", void 0);
class UpdateZaloCampaignDto {
    name;
    campaignType;
    channelConnectionId;
    zbsConnectionId;
    messageTemplateId;
    segmentConfig;
    variables;
    timezone;
}
exports.UpdateZaloCampaignDto = UpdateZaloCampaignDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], UpdateZaloCampaignDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.MessagingCampaignKind),
    __metadata("design:type", String)
], UpdateZaloCampaignDto.prototype, "campaignType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateZaloCampaignDto.prototype, "channelConnectionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateZaloCampaignDto.prototype, "zbsConnectionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateZaloCampaignDto.prototype, "messageTemplateId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateZaloCampaignDto.prototype, "segmentConfig", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateZaloCampaignDto.prototype, "variables", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateZaloCampaignDto.prototype, "timezone", void 0);
class ConnectZaloZbsDto {
    appId;
    secretKey;
    accessToken;
    accountRef;
    displayName;
    oaConnectionId;
}
exports.ConnectZaloZbsDto = ConnectZaloZbsDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConnectZaloZbsDto.prototype, "appId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConnectZaloZbsDto.prototype, "secretKey", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConnectZaloZbsDto.prototype, "accessToken", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConnectZaloZbsDto.prototype, "accountRef", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConnectZaloZbsDto.prototype, "displayName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConnectZaloZbsDto.prototype, "oaConnectionId", void 0);
class SyncZbsTemplatesDto {
    connectionId;
}
exports.SyncZbsTemplatesDto = SyncZbsTemplatesDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SyncZbsTemplatesDto.prototype, "connectionId", void 0);
class PreviewZaloAudienceDto {
    channelConnectionId;
    campaignType;
    segmentConfig;
}
exports.PreviewZaloAudienceDto = PreviewZaloAudienceDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PreviewZaloAudienceDto.prototype, "channelConnectionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.MessagingCampaignKind),
    __metadata("design:type", String)
], PreviewZaloAudienceDto.prototype, "campaignType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], PreviewZaloAudienceDto.prototype, "segmentConfig", void 0);
class PreviewZaloCampaignDto {
    sampleIdentityIds;
}
exports.PreviewZaloCampaignDto = PreviewZaloCampaignDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], PreviewZaloCampaignDto.prototype, "sampleIdentityIds", void 0);
class ScheduleZaloCampaignDto {
    scheduledAt;
}
exports.ScheduleZaloCampaignDto = ScheduleZaloCampaignDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ScheduleZaloCampaignDto.prototype, "scheduledAt", void 0);
class TestZaloZbsSendDto {
    connectionId;
    templateId;
    phone;
    userId;
    templateData;
}
exports.TestZaloZbsSendDto = TestZaloZbsSendDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TestZaloZbsSendDto.prototype, "connectionId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TestZaloZbsSendDto.prototype, "templateId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TestZaloZbsSendDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], TestZaloZbsSendDto.prototype, "userId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], TestZaloZbsSendDto.prototype, "templateData", void 0);
class StartZaloOAuthDto {
    returnPath;
}
exports.StartZaloOAuthDto = StartZaloOAuthDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], StartZaloOAuthDto.prototype, "returnPath", void 0);
