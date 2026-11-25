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
exports.BindFunnelChatbotDto = exports.SubmitFunnelPublicLeadDto = void 0;
const class_validator_1 = require("class-validator");
class SubmitFunnelPublicLeadDto {
    answers;
    attribution;
    formId;
    landingPage;
    referrer;
}
exports.SubmitFunnelPublicLeadDto = SubmitFunnelPublicLeadDto;
__decorate([
    (0, class_validator_1.Allow)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], SubmitFunnelPublicLeadDto.prototype, "answers", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Allow)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], SubmitFunnelPublicLeadDto.prototype, "attribution", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], SubmitFunnelPublicLeadDto.prototype, "formId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], SubmitFunnelPublicLeadDto.prototype, "landingPage", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], SubmitFunnelPublicLeadDto.prototype, "referrer", void 0);
class BindFunnelChatbotDto {
    botId;
}
exports.BindFunnelChatbotDto = BindFunnelChatbotDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], BindFunnelChatbotDto.prototype, "botId", void 0);
