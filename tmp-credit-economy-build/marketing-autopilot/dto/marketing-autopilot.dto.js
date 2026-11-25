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
exports.AutofillMarketingAutopilotDto = exports.MarketingAutopilotRegenerateContentDto = exports.MarketingAutopilotConfirmDraftDto = exports.MarketingAutopilotProjectParamsDto = exports.UpdateMarketingAutopilotProjectDto = exports.MarketingAutopilotProjectQueryDto = exports.CreateMarketingAutopilotProjectDto = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const shared_1 = require("@marketingspa/shared");
const pagination_dto_1 = require("../../common/dto/pagination.dto");
const marketing_autopilot_project_list_util_1 = require("../marketing-autopilot-project-list.util");
const DRAFT_TYPE_VALUES = [...shared_1.MARKETING_AUTOPILOT_DRAFT_TYPES];
class CreateMarketingAutopilotProjectDto {
    projectName;
    productName;
    productPrice;
    customerProfile;
    targetArea;
    monthlyBudget;
    primaryGoal;
    /** Optional client key to prevent duplicate creates on double-submit. */
    idempotencyKey;
}
exports.CreateMarketingAutopilotProjectDto = CreateMarketingAutopilotProjectDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateMarketingAutopilotProjectDto.prototype, "projectName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateMarketingAutopilotProjectDto.prototype, "productName", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CreateMarketingAutopilotProjectDto.prototype, "productPrice", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateMarketingAutopilotProjectDto.prototype, "customerProfile", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateMarketingAutopilotProjectDto.prototype, "targetArea", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateMarketingAutopilotProjectDto.prototype, "monthlyBudget", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateMarketingAutopilotProjectDto.prototype, "primaryGoal", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateMarketingAutopilotProjectDto.prototype, "idempotencyKey", void 0);
class MarketingAutopilotProjectQueryDto extends pagination_dto_1.PaginationDto {
    includeArchived;
    /** Search project name or product (case-insensitive). */
    q;
    datePreset;
    dateFrom;
    dateTo;
    status;
    goal;
    product;
    budgetMin;
    budgetMax;
    quickFilter;
    sort;
}
exports.MarketingAutopilotProjectQueryDto = MarketingAutopilotProjectQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => value === true || value === 'true' || value === '1'),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], MarketingAutopilotProjectQueryDto.prototype, "includeArchived", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MarketingAutopilotProjectQueryDto.prototype, "q", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([...marketing_autopilot_project_list_util_1.PROJECT_DATE_PRESETS]),
    __metadata("design:type", String)
], MarketingAutopilotProjectQueryDto.prototype, "datePreset", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], MarketingAutopilotProjectQueryDto.prototype, "dateFrom", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], MarketingAutopilotProjectQueryDto.prototype, "dateTo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MarketingAutopilotProjectQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MarketingAutopilotProjectQueryDto.prototype, "goal", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MarketingAutopilotProjectQueryDto.prototype, "product", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], MarketingAutopilotProjectQueryDto.prototype, "budgetMin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], MarketingAutopilotProjectQueryDto.prototype, "budgetMax", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([...marketing_autopilot_project_list_util_1.PROJECT_QUICK_FILTERS]),
    __metadata("design:type", String)
], MarketingAutopilotProjectQueryDto.prototype, "quickFilter", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)([...marketing_autopilot_project_list_util_1.PROJECT_SORT_OPTIONS]),
    __metadata("design:type", String)
], MarketingAutopilotProjectQueryDto.prototype, "sort", void 0);
class UpdateMarketingAutopilotProjectDto {
    projectName;
    productName;
    productPrice;
    customerProfile;
    targetArea;
    monthlyBudget;
    primaryGoal;
    goals;
    channels;
}
exports.UpdateMarketingAutopilotProjectDto = UpdateMarketingAutopilotProjectDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateMarketingAutopilotProjectDto.prototype, "projectName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpdateMarketingAutopilotProjectDto.prototype, "productName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateMarketingAutopilotProjectDto.prototype, "productPrice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpdateMarketingAutopilotProjectDto.prototype, "customerProfile", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpdateMarketingAutopilotProjectDto.prototype, "targetArea", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], UpdateMarketingAutopilotProjectDto.prototype, "monthlyBudget", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], UpdateMarketingAutopilotProjectDto.prototype, "primaryGoal", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], UpdateMarketingAutopilotProjectDto.prototype, "goals", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], UpdateMarketingAutopilotProjectDto.prototype, "channels", void 0);
class MarketingAutopilotProjectParamsDto {
    id;
}
exports.MarketingAutopilotProjectParamsDto = MarketingAutopilotProjectParamsDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MarketingAutopilotProjectParamsDto.prototype, "id", void 0);
class MarketingAutopilotConfirmDraftDto {
    idempotencyKey;
    /**
     * Optional filter — if omitted, creates drafts for all nextBestActions (legacy).
     * Transforms drop null/undefined (JSON converts undefined → null) before IsIn.
     */
    draftTypes;
}
exports.MarketingAutopilotConfirmDraftDto = MarketingAutopilotConfirmDraftDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], MarketingAutopilotConfirmDraftDto.prototype, "idempotencyKey", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => {
        if (value == null)
            return undefined;
        if (!Array.isArray(value))
            return value;
        const cleaned = value
            .filter((item) => typeof item === 'string' && item.trim().length > 0)
            .map((item) => item.trim());
        return cleaned.length ? Array.from(new Set(cleaned)) : undefined;
    }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsIn)(DRAFT_TYPE_VALUES, {
        each: true,
        message: `draftTypes phải là một trong: ${DRAFT_TYPE_VALUES.join(', ')}`,
    }),
    __metadata("design:type", Array)
], MarketingAutopilotConfirmDraftDto.prototype, "draftTypes", void 0);
/** Regenerate content draft (optional single idea index 1–5). */
class MarketingAutopilotRegenerateContentDto {
    ideaIndex;
}
exports.MarketingAutopilotRegenerateContentDto = MarketingAutopilotRegenerateContentDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(5),
    __metadata("design:type", Number)
], MarketingAutopilotRegenerateContentDto.prototype, "ideaIndex", void 0);
/** Additive autofill request — does not change create-project contract. */
class AutofillMarketingAutopilotDto {
    goals;
    productId;
    customerMode;
    segmentId;
}
exports.AutofillMarketingAutopilotDto = AutofillMarketingAutopilotDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], AutofillMarketingAutopilotDto.prototype, "goals", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AutofillMarketingAutopilotDto.prototype, "productId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['ai', 'segment', 'manual']),
    __metadata("design:type", String)
], AutofillMarketingAutopilotDto.prototype, "customerMode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AutofillMarketingAutopilotDto.prototype, "segmentId", void 0);
