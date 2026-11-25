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
exports.LogQueryDto = exports.PreviewMessageTemplateDto = exports.TemplateQueryDto = exports.SimulateAutomationDto = exports.UpdateAutomationFlowDto = exports.CreateAutomationFlowDto = exports.UpdateMessageTemplateDto = exports.CreateMessageTemplateDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const database_1 = require("@marketingspa/database");
const pagination_dto_1 = require("../../common/dto/pagination.dto");
class CreateMessageTemplateDto {
    name;
    channel;
    subject;
    body;
    variables;
    isActive;
    approvalStatus;
    campaignKind;
    contentBlocks;
    ctaLabel;
    ctaUrl;
    mediaUrl;
    providerMode;
    providerTemplateId;
    variableFallbacks;
}
exports.CreateMessageTemplateDto = CreateMessageTemplateDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreateMessageTemplateDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(database_1.MessageChannel),
    __metadata("design:type", String)
], CreateMessageTemplateDto.prototype, "channel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateMessageTemplateDto.prototype, "subject", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreateMessageTemplateDto.prototype, "body", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateMessageTemplateDto.prototype, "variables", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateMessageTemplateDto.prototype, "isActive", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.MessageTemplateApprovalStatus),
    __metadata("design:type", String)
], CreateMessageTemplateDto.prototype, "approvalStatus", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.MessagingCampaignKind),
    __metadata("design:type", String)
], CreateMessageTemplateDto.prototype, "campaignKind", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], CreateMessageTemplateDto.prototype, "contentBlocks", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateMessageTemplateDto.prototype, "ctaLabel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateMessageTemplateDto.prototype, "ctaUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateMessageTemplateDto.prototype, "mediaUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateMessageTemplateDto.prototype, "providerMode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateMessageTemplateDto.prototype, "providerTemplateId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], CreateMessageTemplateDto.prototype, "variableFallbacks", void 0);
class UpdateMessageTemplateDto {
    name;
    channel;
    subject;
    body;
    variables;
    isActive;
    contentBlocks;
    variableFallbacks;
}
exports.UpdateMessageTemplateDto = UpdateMessageTemplateDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateMessageTemplateDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.MessageChannel),
    __metadata("design:type", String)
], UpdateMessageTemplateDto.prototype, "channel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateMessageTemplateDto.prototype, "subject", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateMessageTemplateDto.prototype, "body", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], UpdateMessageTemplateDto.prototype, "variables", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateMessageTemplateDto.prototype, "isActive", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], UpdateMessageTemplateDto.prototype, "contentBlocks", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], UpdateMessageTemplateDto.prototype, "variableFallbacks", void 0);
class CreateAutomationFlowDto {
    name;
    triggerType;
    /** FunnelRecommendation.id — bắt buộc cho flow mới (Prompt 9) */
    funnelId;
    messageTemplateId;
    channel;
    delayMinutes;
    triggerConfig;
    isActive;
    actions;
    cooldownMinutes;
    isPaused;
    maxSendsPerDay;
    quietHoursEnd;
    quietHoursStart;
}
exports.CreateAutomationFlowDto = CreateAutomationFlowDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreateAutomationFlowDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(database_1.AutomationTriggerType),
    __metadata("design:type", String)
], CreateAutomationFlowDto.prototype, "triggerType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateAutomationFlowDto.prototype, "funnelId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateAutomationFlowDto.prototype, "messageTemplateId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.MessageChannel),
    __metadata("design:type", String)
], CreateAutomationFlowDto.prototype, "channel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateAutomationFlowDto.prototype, "delayMinutes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateAutomationFlowDto.prototype, "triggerConfig", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateAutomationFlowDto.prototype, "isActive", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], CreateAutomationFlowDto.prototype, "actions", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateAutomationFlowDto.prototype, "cooldownMinutes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateAutomationFlowDto.prototype, "isPaused", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateAutomationFlowDto.prototype, "maxSendsPerDay", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateAutomationFlowDto.prototype, "quietHoursEnd", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateAutomationFlowDto.prototype, "quietHoursStart", void 0);
class UpdateAutomationFlowDto {
    name;
    triggerType;
    messageTemplateId;
    channel;
    delayMinutes;
    triggerConfig;
    isActive;
    actions;
}
exports.UpdateAutomationFlowDto = UpdateAutomationFlowDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateAutomationFlowDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.AutomationTriggerType),
    __metadata("design:type", String)
], UpdateAutomationFlowDto.prototype, "triggerType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpdateAutomationFlowDto.prototype, "messageTemplateId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.MessageChannel),
    __metadata("design:type", String)
], UpdateAutomationFlowDto.prototype, "channel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateAutomationFlowDto.prototype, "delayMinutes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateAutomationFlowDto.prototype, "triggerConfig", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateAutomationFlowDto.prototype, "isActive", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], UpdateAutomationFlowDto.prototype, "actions", void 0);
class SimulateAutomationDto {
    customerId;
    leadId;
    context;
}
exports.SimulateAutomationDto = SimulateAutomationDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SimulateAutomationDto.prototype, "customerId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SimulateAutomationDto.prototype, "leadId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], SimulateAutomationDto.prototype, "context", void 0);
class TemplateQueryDto extends pagination_dto_1.PaginationDto {
    channel;
}
exports.TemplateQueryDto = TemplateQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.MessageChannel),
    __metadata("design:type", String)
], TemplateQueryDto.prototype, "channel", void 0);
class PreviewMessageTemplateDto {
    context;
}
exports.PreviewMessageTemplateDto = PreviewMessageTemplateDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], PreviewMessageTemplateDto.prototype, "context", void 0);
class LogQueryDto extends pagination_dto_1.PaginationDto {
    channel;
}
exports.LogQueryDto = LogQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.MessageChannel),
    __metadata("design:type", String)
], LogQueryDto.prototype, "channel", void 0);
