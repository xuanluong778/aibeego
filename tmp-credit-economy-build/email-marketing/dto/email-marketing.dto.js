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
exports.SendTestEmailDto = exports.GenerateEmailContentDto = exports.CreateEmailAutomationFromRecipeDto = exports.UpdateEmailAutomationDto = exports.CreateEmailAutomationDto = exports.UpdateSenderDomainDto = exports.CreateSenderDomainDto = exports.CreateEmailSuppressionDto = exports.ScheduleEmailCampaignDto = exports.UpdateEmailCampaignDto = exports.CreateEmailCampaignDto = exports.CreateEmailSegmentDto = exports.AddListMemberDto = exports.CreateEmailListDto = exports.UpdateEmailContactDto = exports.CreateEmailContactDto = exports.UpdateEmailTemplateDto = exports.CreateEmailTemplateDto = exports.ContactQueryDto = exports.CampaignRecipientQueryDto = exports.CAMPAIGN_RECIPIENT_METRICS = exports.CampaignQueryDto = exports.AudienceMembersQueryDto = exports.AudiencePreviewQueryDto = exports.EmailSearchQueryDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const database_1 = require("@marketingspa/database");
const pagination_dto_1 = require("../../common/dto/pagination.dto");
class EmailSearchQueryDto extends pagination_dto_1.PaginationDto {
    search;
}
exports.EmailSearchQueryDto = EmailSearchQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], EmailSearchQueryDto.prototype, "search", void 0);
class AudiencePreviewQueryDto {
    listId;
}
exports.AudiencePreviewQueryDto = AudiencePreviewQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], AudiencePreviewQueryDto.prototype, "listId", void 0);
class AudienceMembersQueryDto extends pagination_dto_1.PaginationDto {
    listId;
    search;
    /** eligible | all — default eligible (exclude suppression/unsub/bounce) */
    filter;
}
exports.AudienceMembersQueryDto = AudienceMembersQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], AudienceMembersQueryDto.prototype, "listId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AudienceMembersQueryDto.prototype, "search", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AudienceMembersQueryDto.prototype, "filter", void 0);
class CampaignQueryDto extends pagination_dto_1.PaginationDto {
    status;
}
exports.CampaignQueryDto = CampaignQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.EmailCampaignStatus),
    __metadata("design:type", String)
], CampaignQueryDto.prototype, "status", void 0);
exports.CAMPAIGN_RECIPIENT_METRICS = [
    'sent',
    'delivered',
    'opened',
    'clicked',
    'bounced',
    'unsubscribed',
];
class CampaignRecipientQueryDto extends pagination_dto_1.PaginationDto {
    search;
    metric;
}
exports.CampaignRecipientQueryDto = CampaignRecipientQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CampaignRecipientQueryDto.prototype, "search", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(exports.CAMPAIGN_RECIPIENT_METRICS),
    __metadata("design:type", String)
], CampaignRecipientQueryDto.prototype, "metric", void 0);
class ContactQueryDto extends pagination_dto_1.PaginationDto {
    search;
    status;
    listId;
    tag;
    source;
    crmStage;
}
exports.ContactQueryDto = ContactQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ContactQueryDto.prototype, "search", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.EmailContactStatus),
    __metadata("design:type", String)
], ContactQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ContactQueryDto.prototype, "listId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ContactQueryDto.prototype, "tag", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ContactQueryDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ContactQueryDto.prototype, "crmStage", void 0);
class CreateEmailTemplateDto {
    name;
    subject;
    previewText;
    htmlBody;
    textBody;
    category;
    isActive;
}
exports.CreateEmailTemplateDto = CreateEmailTemplateDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreateEmailTemplateDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreateEmailTemplateDto.prototype, "subject", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateEmailTemplateDto.prototype, "previewText", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreateEmailTemplateDto.prototype, "htmlBody", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateEmailTemplateDto.prototype, "textBody", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateEmailTemplateDto.prototype, "category", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateEmailTemplateDto.prototype, "isActive", void 0);
class UpdateEmailTemplateDto {
    name;
    subject;
    previewText;
    htmlBody;
    textBody;
    category;
    isActive;
}
exports.UpdateEmailTemplateDto = UpdateEmailTemplateDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateEmailTemplateDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateEmailTemplateDto.prototype, "subject", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateEmailTemplateDto.prototype, "previewText", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateEmailTemplateDto.prototype, "htmlBody", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateEmailTemplateDto.prototype, "textBody", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateEmailTemplateDto.prototype, "category", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateEmailTemplateDto.prototype, "isActive", void 0);
class CreateEmailContactDto {
    email;
    name;
    phone;
    source;
    tags;
    crmStage;
    customFields;
    listId;
}
exports.CreateEmailContactDto = CreateEmailContactDto;
__decorate([
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], CreateEmailContactDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateEmailContactDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateEmailContactDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateEmailContactDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreateEmailContactDto.prototype, "tags", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateEmailContactDto.prototype, "crmStage", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateEmailContactDto.prototype, "customFields", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateEmailContactDto.prototype, "listId", void 0);
class UpdateEmailContactDto {
    name;
    phone;
    source;
    tags;
    crmStage;
    status;
    listId;
    customFields;
}
exports.UpdateEmailContactDto = UpdateEmailContactDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateEmailContactDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateEmailContactDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateEmailContactDto.prototype, "source", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], UpdateEmailContactDto.prototype, "tags", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateEmailContactDto.prototype, "crmStage", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.EmailContactStatus),
    __metadata("design:type", String)
], UpdateEmailContactDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpdateEmailContactDto.prototype, "listId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], UpdateEmailContactDto.prototype, "customFields", void 0);
class CreateEmailListDto {
    name;
    description;
}
exports.CreateEmailListDto = CreateEmailListDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreateEmailListDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateEmailListDto.prototype, "description", void 0);
class AddListMemberDto {
    contactId;
    email;
    name;
}
exports.AddListMemberDto = AddListMemberDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], AddListMemberDto.prototype, "contactId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], AddListMemberDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AddListMemberDto.prototype, "name", void 0);
class CreateEmailSegmentDto {
    name;
    rules;
}
exports.CreateEmailSegmentDto = CreateEmailSegmentDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreateEmailSegmentDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreateEmailSegmentDto.prototype, "rules", void 0);
class CreateEmailCampaignDto {
    name;
    subject;
    templateId;
    listId;
    segmentId;
    senderDomainId;
    contactIds;
}
exports.CreateEmailCampaignDto = CreateEmailCampaignDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreateEmailCampaignDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateEmailCampaignDto.prototype, "subject", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateEmailCampaignDto.prototype, "templateId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateEmailCampaignDto.prototype, "listId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateEmailCampaignDto.prototype, "segmentId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateEmailCampaignDto.prototype, "senderDomainId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], CreateEmailCampaignDto.prototype, "contactIds", void 0);
class UpdateEmailCampaignDto {
    name;
    subject;
    templateId;
    listId;
    segmentId;
    senderDomainId;
    contactIds;
}
exports.UpdateEmailCampaignDto = UpdateEmailCampaignDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateEmailCampaignDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateEmailCampaignDto.prototype, "subject", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpdateEmailCampaignDto.prototype, "templateId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpdateEmailCampaignDto.prototype, "listId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpdateEmailCampaignDto.prototype, "segmentId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpdateEmailCampaignDto.prototype, "senderDomainId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], UpdateEmailCampaignDto.prototype, "contactIds", void 0);
class ScheduleEmailCampaignDto {
    scheduledAt;
}
exports.ScheduleEmailCampaignDto = ScheduleEmailCampaignDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ScheduleEmailCampaignDto.prototype, "scheduledAt", void 0);
class CreateEmailSuppressionDto {
    email;
    reason;
    note;
}
exports.CreateEmailSuppressionDto = CreateEmailSuppressionDto;
__decorate([
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], CreateEmailSuppressionDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.EmailSuppressionReason),
    __metadata("design:type", String)
], CreateEmailSuppressionDto.prototype, "reason", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateEmailSuppressionDto.prototype, "note", void 0);
class CreateSenderDomainDto {
    domain;
    fromName;
    fromEmail;
    replyTo;
}
exports.CreateSenderDomainDto = CreateSenderDomainDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreateSenderDomainDto.prototype, "domain", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreateSenderDomainDto.prototype, "fromName", void 0);
__decorate([
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], CreateSenderDomainDto.prototype, "fromEmail", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], CreateSenderDomainDto.prototype, "replyTo", void 0);
class UpdateSenderDomainDto {
    fromName;
    fromEmail;
    replyTo;
}
exports.UpdateSenderDomainDto = UpdateSenderDomainDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], UpdateSenderDomainDto.prototype, "fromName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], UpdateSenderDomainDto.prototype, "fromEmail", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", Object)
], UpdateSenderDomainDto.prototype, "replyTo", void 0);
class CreateEmailAutomationDto {
    name;
    trigger;
    status;
    templateId;
    listId;
    delayMinutes;
    recipeId;
    action;
    scoreDelta;
    targetStage;
    waitDays;
}
exports.CreateEmailAutomationDto = CreateEmailAutomationDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreateEmailAutomationDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(database_1.EmailAutomationTrigger),
    __metadata("design:type", String)
], CreateEmailAutomationDto.prototype, "trigger", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.EmailAutomationStatus),
    __metadata("design:type", String)
], CreateEmailAutomationDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateEmailAutomationDto.prototype, "templateId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateEmailAutomationDto.prototype, "listId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateEmailAutomationDto.prototype, "delayMinutes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateEmailAutomationDto.prototype, "recipeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.EmailAutomationAction),
    __metadata("design:type", String)
], CreateEmailAutomationDto.prototype, "action", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateEmailAutomationDto.prototype, "scoreDelta", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateEmailAutomationDto.prototype, "targetStage", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateEmailAutomationDto.prototype, "waitDays", void 0);
class UpdateEmailAutomationDto {
    name;
    trigger;
    status;
    templateId;
    listId;
    delayMinutes;
    action;
    scoreDelta;
    targetStage;
    waitDays;
}
exports.UpdateEmailAutomationDto = UpdateEmailAutomationDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateEmailAutomationDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.EmailAutomationTrigger),
    __metadata("design:type", String)
], UpdateEmailAutomationDto.prototype, "trigger", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.EmailAutomationStatus),
    __metadata("design:type", String)
], UpdateEmailAutomationDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpdateEmailAutomationDto.prototype, "templateId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpdateEmailAutomationDto.prototype, "listId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateEmailAutomationDto.prototype, "delayMinutes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.EmailAutomationAction),
    __metadata("design:type", String)
], UpdateEmailAutomationDto.prototype, "action", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateEmailAutomationDto.prototype, "scoreDelta", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateEmailAutomationDto.prototype, "targetStage", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateEmailAutomationDto.prototype, "waitDays", void 0);
class CreateEmailAutomationFromRecipeDto {
    recipeId;
    templateId;
    listId;
    waitDays;
    scoreDelta;
    targetStage;
    activate;
}
exports.CreateEmailAutomationFromRecipeDto = CreateEmailAutomationFromRecipeDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreateEmailAutomationFromRecipeDto.prototype, "recipeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateEmailAutomationFromRecipeDto.prototype, "templateId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateEmailAutomationFromRecipeDto.prototype, "listId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateEmailAutomationFromRecipeDto.prototype, "waitDays", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateEmailAutomationFromRecipeDto.prototype, "scoreDelta", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateEmailAutomationFromRecipeDto.prototype, "targetStage", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateEmailAutomationFromRecipeDto.prototype, "activate", void 0);
class GenerateEmailContentDto {
    prompt;
}
exports.GenerateEmailContentDto = GenerateEmailContentDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    (0, class_validator_1.MaxLength)(800),
    __metadata("design:type", String)
], GenerateEmailContentDto.prototype, "prompt", void 0);
class SendTestEmailDto {
    to;
    subject;
    htmlBody;
    previewText;
}
exports.SendTestEmailDto = SendTestEmailDto;
__decorate([
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], SendTestEmailDto.prototype, "to", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], SendTestEmailDto.prototype, "subject", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], SendTestEmailDto.prototype, "htmlBody", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SendTestEmailDto.prototype, "previewText", void 0);
