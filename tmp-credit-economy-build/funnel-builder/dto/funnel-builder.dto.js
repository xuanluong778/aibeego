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
exports.ListFunnelBlueprintsQueryDto = exports.ApplyFunnelBlueprintDto = exports.GenerateFunnelBlueprintDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class GenerateFunnelBlueprintDto {
    prompt;
    industryHint;
    includeAutomations;
}
exports.GenerateFunnelBlueprintDto = GenerateFunnelBlueprintDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], GenerateFunnelBlueprintDto.prototype, "prompt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], GenerateFunnelBlueprintDto.prototype, "industryHint", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], GenerateFunnelBlueprintDto.prototype, "includeAutomations", void 0);
class ApplyFunnelBlueprintDto {
    blueprintId;
    /** Optional inline draft — used when applying without saving first */
    draft;
    applyStages;
    applyFlows;
    /** Soft-deactivate org stages whose code is not in the draft */
    deactivateMissingStages;
    /** Create flows as active (requires automation.campaign.approve / OWNER) */
    activateFlows;
    /** Gắn AutomationFlow.funnelId = FunnelRecommendation.id */
    funnelId;
}
exports.ApplyFunnelBlueprintDto = ApplyFunnelBlueprintDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ApplyFunnelBlueprintDto.prototype, "blueprintId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], ApplyFunnelBlueprintDto.prototype, "draft", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ApplyFunnelBlueprintDto.prototype, "applyStages", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ApplyFunnelBlueprintDto.prototype, "applyFlows", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ApplyFunnelBlueprintDto.prototype, "deactivateMissingStages", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ApplyFunnelBlueprintDto.prototype, "activateFlows", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ApplyFunnelBlueprintDto.prototype, "funnelId", void 0);
class ListFunnelBlueprintsQueryDto {
    status;
    take;
}
exports.ListFunnelBlueprintsQueryDto = ListFunnelBlueprintsQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['DRAFT', 'APPLIED', 'DISCARDED']),
    __metadata("design:type", String)
], ListFunnelBlueprintsQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(50),
    __metadata("design:type", Number)
], ListFunnelBlueprintsQueryDto.prototype, "take", void 0);
