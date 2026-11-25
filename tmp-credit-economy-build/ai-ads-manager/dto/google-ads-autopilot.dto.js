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
exports.RejectAutopilotProposalDto = exports.ApproveAutopilotProposalDto = exports.GoogleAdsAutopilotCustomerQueryDto = exports.UpsertGoogleAdsAutopilotConfigDto = void 0;
const class_validator_1 = require("class-validator");
const database_1 = require("@marketingspa/database");
class UpsertGoogleAdsAutopilotConfigDto {
    customerId;
    loginCustomerId;
    enabled;
    mode;
    maxDailyBudget;
    maxMonthlyBudget;
    maxBudgetIncreasePct;
    maxBudgetDecreasePct;
    targetCpa;
    targetCpl;
    targetRoas;
    stopLossDailySpend;
    minSpendForAction;
    minClicksForAction;
    minConversionsForAction;
    gracePeriodHours;
    maxActionsPerDay;
    emergencyStop;
    writeWhitelistEnabled;
    cooldownMinutes;
    allowAutoPause;
    minRoas;
}
exports.UpsertGoogleAdsAutopilotConfigDto = UpsertGoogleAdsAutopilotConfigDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertGoogleAdsAutopilotConfigDto.prototype, "customerId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertGoogleAdsAutopilotConfigDto.prototype, "loginCustomerId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertGoogleAdsAutopilotConfigDto.prototype, "enabled", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.GoogleAdsAutopilotMode),
    __metadata("design:type", String)
], UpsertGoogleAdsAutopilotConfigDto.prototype, "mode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpsertGoogleAdsAutopilotConfigDto.prototype, "maxDailyBudget", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpsertGoogleAdsAutopilotConfigDto.prototype, "maxMonthlyBudget", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], UpsertGoogleAdsAutopilotConfigDto.prototype, "maxBudgetIncreasePct", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], UpsertGoogleAdsAutopilotConfigDto.prototype, "maxBudgetDecreasePct", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpsertGoogleAdsAutopilotConfigDto.prototype, "targetCpa", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpsertGoogleAdsAutopilotConfigDto.prototype, "targetCpl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpsertGoogleAdsAutopilotConfigDto.prototype, "targetRoas", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpsertGoogleAdsAutopilotConfigDto.prototype, "stopLossDailySpend", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpsertGoogleAdsAutopilotConfigDto.prototype, "minSpendForAction", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpsertGoogleAdsAutopilotConfigDto.prototype, "minClicksForAction", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpsertGoogleAdsAutopilotConfigDto.prototype, "minConversionsForAction", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(168),
    __metadata("design:type", Number)
], UpsertGoogleAdsAutopilotConfigDto.prototype, "gracePeriodHours", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], UpsertGoogleAdsAutopilotConfigDto.prototype, "maxActionsPerDay", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertGoogleAdsAutopilotConfigDto.prototype, "emergencyStop", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertGoogleAdsAutopilotConfigDto.prototype, "writeWhitelistEnabled", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(1440),
    __metadata("design:type", Number)
], UpsertGoogleAdsAutopilotConfigDto.prototype, "cooldownMinutes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertGoogleAdsAutopilotConfigDto.prototype, "allowAutoPause", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpsertGoogleAdsAutopilotConfigDto.prototype, "minRoas", void 0);
class GoogleAdsAutopilotCustomerQueryDto {
    customerId;
}
exports.GoogleAdsAutopilotCustomerQueryDto = GoogleAdsAutopilotCustomerQueryDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GoogleAdsAutopilotCustomerQueryDto.prototype, "customerId", void 0);
class ApproveAutopilotProposalDto {
    note;
}
exports.ApproveAutopilotProposalDto = ApproveAutopilotProposalDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ApproveAutopilotProposalDto.prototype, "note", void 0);
class RejectAutopilotProposalDto {
    reason;
}
exports.RejectAutopilotProposalDto = RejectAutopilotProposalDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RejectAutopilotProposalDto.prototype, "reason", void 0);
