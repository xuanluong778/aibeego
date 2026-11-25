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
exports.CheckMessagingEligibilityDto = void 0;
const class_validator_1 = require("class-validator");
const database_1 = require("@marketingspa/database");
class CheckMessagingEligibilityDto {
    accountRef;
    campaignType;
    channel;
    connectionId;
    customerId;
    externalUserId;
    flowId;
    identityId;
    leadId;
    providerModeHint;
    templateId;
}
exports.CheckMessagingEligibilityDto = CheckMessagingEligibilityDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CheckMessagingEligibilityDto.prototype, "accountRef", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['automation', 'broadcast', 'transactional', 'template']),
    __metadata("design:type", String)
], CheckMessagingEligibilityDto.prototype, "campaignType", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.MessageChannel),
    __metadata("design:type", String)
], CheckMessagingEligibilityDto.prototype, "channel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CheckMessagingEligibilityDto.prototype, "connectionId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CheckMessagingEligibilityDto.prototype, "customerId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CheckMessagingEligibilityDto.prototype, "externalUserId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CheckMessagingEligibilityDto.prototype, "flowId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CheckMessagingEligibilityDto.prototype, "identityId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CheckMessagingEligibilityDto.prototype, "leadId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['MESSENGER_STANDARD', 'MESSENGER_UTILITY', 'ZALO_OA_CONSULT', 'ZALO_OA_BROADCAST', 'ZBS_TEMPLATE']),
    __metadata("design:type", String)
], CheckMessagingEligibilityDto.prototype, "providerModeHint", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CheckMessagingEligibilityDto.prototype, "templateId", void 0);
