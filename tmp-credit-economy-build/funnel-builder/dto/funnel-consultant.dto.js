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
exports.FunnelConsultantApplyDto = exports.FunnelConsultantProposeDto = void 0;
const class_validator_1 = require("class-validator");
const shared_1 = require("@marketingspa/shared");
class FunnelConsultantProposeDto {
    prompt;
    intent;
    includeAnalytics;
}
exports.FunnelConsultantProposeDto = FunnelConsultantProposeDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], FunnelConsultantProposeDto.prototype, "prompt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(shared_1.FUNNEL_CONSULTANT_INTENTS),
    __metadata("design:type", String)
], FunnelConsultantProposeDto.prototype, "intent", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], FunnelConsultantProposeDto.prototype, "includeAnalytics", void 0);
class FunnelConsultantApplyDto {
    /** Must be true — never apply without explicit user confirmation */
    confirm;
    complete;
    specHash;
}
exports.FunnelConsultantApplyDto = FunnelConsultantApplyDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], FunnelConsultantApplyDto.prototype, "confirm", void 0);
__decorate([
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], FunnelConsultantApplyDto.prototype, "complete", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], FunnelConsultantApplyDto.prototype, "specHash", void 0);
