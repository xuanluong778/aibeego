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
exports.UpsertMessagingIdentityDto = exports.MessagingIdentityQueryDto = exports.MergeIdentitiesDto = exports.LinkIdentityDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const database_1 = require("@marketingspa/database");
const pagination_dto_1 = require("../../common/dto/pagination.dto");
class LinkIdentityDto {
    customerId;
    leadId;
}
exports.LinkIdentityDto = LinkIdentityDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LinkIdentityDto.prototype, "customerId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LinkIdentityDto.prototype, "leadId", void 0);
class MergeIdentitiesDto {
    primaryIdentityId;
    secondaryIdentityIds;
}
exports.MergeIdentitiesDto = MergeIdentitiesDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MergeIdentitiesDto.prototype, "primaryIdentityId", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsUUID)('4', { each: true }),
    __metadata("design:type", Array)
], MergeIdentitiesDto.prototype, "secondaryIdentityIds", void 0);
class MessagingIdentityQueryDto extends pagination_dto_1.PaginationDto {
    campaignType;
    channel;
    connectionId;
    consentStatus;
    customerId;
    followStatus;
    stageId;
    hasAppointment;
    hasOrder;
    inactiveDays;
    includeMerged;
    integrationScopeKey;
    lastInboundFrom;
    lastInboundTo;
    leadId;
    linkedType;
    pipelineStatus;
    search;
    tag;
    templateId;
}
exports.MessagingIdentityQueryDto = MessagingIdentityQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['automation', 'broadcast', 'transactional', 'template']),
    __metadata("design:type", String)
], MessagingIdentityQueryDto.prototype, "campaignType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.MessageChannel),
    __metadata("design:type", String)
], MessagingIdentityQueryDto.prototype, "channel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MessagingIdentityQueryDto.prototype, "connectionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.MessagingConsentStatus),
    __metadata("design:type", String)
], MessagingIdentityQueryDto.prototype, "consentStatus", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MessagingIdentityQueryDto.prototype, "customerId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.MessagingFollowStatus),
    __metadata("design:type", String)
], MessagingIdentityQueryDto.prototype, "followStatus", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MessagingIdentityQueryDto.prototype, "stageId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], MessagingIdentityQueryDto.prototype, "hasAppointment", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], MessagingIdentityQueryDto.prototype, "hasOrder", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], MessagingIdentityQueryDto.prototype, "inactiveDays", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], MessagingIdentityQueryDto.prototype, "includeMerged", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MessagingIdentityQueryDto.prototype, "integrationScopeKey", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MessagingIdentityQueryDto.prototype, "lastInboundFrom", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MessagingIdentityQueryDto.prototype, "lastInboundTo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MessagingIdentityQueryDto.prototype, "leadId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['customer', 'lead', 'unlinked']),
    __metadata("design:type", String)
], MessagingIdentityQueryDto.prototype, "linkedType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.LeadPipelineStatus),
    __metadata("design:type", String)
], MessagingIdentityQueryDto.prototype, "pipelineStatus", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MessagingIdentityQueryDto.prototype, "search", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MessagingIdentityQueryDto.prototype, "tag", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MessagingIdentityQueryDto.prototype, "templateId", void 0);
class UpsertMessagingIdentityDto {
    avatarUrl;
    channel;
    channelAccountRef;
    chatbotConversationId;
    consentStatus;
    displayName;
    externalConversationId;
    externalUserId;
    followStatus;
    integrationId;
    isBlocked;
    metadata;
    optedOut;
    phone;
    phoneVerified;
}
exports.UpsertMessagingIdentityDto = UpsertMessagingIdentityDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertMessagingIdentityDto.prototype, "avatarUrl", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(database_1.MessageChannel),
    __metadata("design:type", String)
], UpsertMessagingIdentityDto.prototype, "channel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertMessagingIdentityDto.prototype, "channelAccountRef", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertMessagingIdentityDto.prototype, "chatbotConversationId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.MessagingConsentStatus),
    __metadata("design:type", String)
], UpsertMessagingIdentityDto.prototype, "consentStatus", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertMessagingIdentityDto.prototype, "displayName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertMessagingIdentityDto.prototype, "externalConversationId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertMessagingIdentityDto.prototype, "externalUserId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.MessagingFollowStatus),
    __metadata("design:type", String)
], UpsertMessagingIdentityDto.prototype, "followStatus", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertMessagingIdentityDto.prototype, "integrationId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertMessagingIdentityDto.prototype, "isBlocked", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], UpsertMessagingIdentityDto.prototype, "metadata", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertMessagingIdentityDto.prototype, "optedOut", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertMessagingIdentityDto.prototype, "phone", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertMessagingIdentityDto.prototype, "phoneVerified", void 0);
