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
exports.ListFunnelLifecycleQueryDto = exports.FunnelRestoreVersionDto = exports.FunnelPublishDto = void 0;
const class_validator_1 = require("class-validator");
const shared_1 = require("@marketingspa/shared");
class FunnelPublishDto {
    summary;
}
exports.FunnelPublishDto = FunnelPublishDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], FunnelPublishDto.prototype, "summary", void 0);
class FunnelRestoreVersionDto {
    versionId;
}
exports.FunnelRestoreVersionDto = FunnelRestoreVersionDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], FunnelRestoreVersionDto.prototype, "versionId", void 0);
class ListFunnelLifecycleQueryDto {
    status;
}
exports.ListFunnelLifecycleQueryDto = ListFunnelLifecycleQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(shared_1.FUNNEL_PUBLISH_STATUSES),
    __metadata("design:type", String)
], ListFunnelLifecycleQueryDto.prototype, "status", void 0);
