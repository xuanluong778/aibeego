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
exports.FacebookLiveInsightsQueryDto = exports.FacebookCampaignsQueryDto = exports.SyncFacebookAdsDto = exports.SetCampaignStatusDto = exports.UpdateCampaignScheduleDto = exports.UpdateCampaignBudgetDto = exports.CreatePausedAdStackDto = exports.CreatePausedAdTargetingDto = exports.CreateFacebookCampaignDto = exports.ConnectFacebookTokenDto = exports.SelectAdAccountDto = exports.FACEBOOK_CAMPAIGN_OBJECTIVES = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
/** Objective Outcome hợp lệ (campaign + ad set). */
exports.FACEBOOK_CAMPAIGN_OBJECTIVES = [
    'OUTCOME_ENGAGEMENT',
    'OUTCOME_TRAFFIC',
    'OUTCOME_LEADS',
    'OUTCOME_AWARENESS',
    'OUTCOME_SALES',
];
class SelectAdAccountDto {
    adAccountId;
    adAccountName;
}
exports.SelectAdAccountDto = SelectAdAccountDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SelectAdAccountDto.prototype, "adAccountId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SelectAdAccountDto.prototype, "adAccountName", void 0);
/** Kết nối bằng User Access Token (test) — bỏ qua OAuth. */
class ConnectFacebookTokenDto {
    /** Dán token từ Graph API Explorer / MetaAdsMCP. */
    accessToken;
    /** true = dùng META_ACCESS_TOKEN trên server (.env), không gửi token từ browser. */
    useEnvToken;
    adAccountId;
}
exports.ConnectFacebookTokenDto = ConnectFacebookTokenDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(20),
    (0, class_validator_1.MaxLength)(2048),
    __metadata("design:type", String)
], ConnectFacebookTokenDto.prototype, "accessToken", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ConnectFacebookTokenDto.prototype, "useEnvToken", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ConnectFacebookTokenDto.prototype, "adAccountId", void 0);
class CreateFacebookCampaignDto {
    name;
    objective;
}
exports.CreateFacebookCampaignDto = CreateFacebookCampaignDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreateFacebookCampaignDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(exports.FACEBOOK_CAMPAIGN_OBJECTIVES),
    __metadata("design:type", String)
], CreateFacebookCampaignDto.prototype, "objective", void 0);
/** Targeting tối giản cho App Review (PAUSED). */
class CreatePausedAdTargetingDto {
    countries;
    ageMin;
    ageMax;
}
exports.CreatePausedAdTargetingDto = CreatePausedAdTargetingDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], CreatePausedAdTargetingDto.prototype, "countries", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(13),
    (0, class_validator_1.Max)(65),
    __metadata("design:type", Number)
], CreatePausedAdTargetingDto.prototype, "ageMin", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(13),
    (0, class_validator_1.Max)(65),
    __metadata("design:type", Number)
], CreatePausedAdTargetingDto.prototype, "ageMax", void 0);
/**
 * Tạo thật Campaign → Ad Set → Creative → Ad ở PAUSED.
 * Không ACTIVE — reviewer không cần chi tiền.
 */
class CreatePausedAdStackDto {
    /** Idempotency key — bắt buộc để hai request không tạo trùng. */
    idempotencyKey;
    campaignName;
    objective;
    adSetName;
    adName;
    /** Ngân sách ngày (đơn vị tiền tệ major, ví dụ VND hoặc USD). */
    dailyBudget;
    /** Số chữ số thập phân minor (USD=2 → *100; VND=0 → *1). Mặc định 0. */
    currencyOffset;
    startTime;
    endTime;
    targeting;
    /** Fanpage ID (bắt buộc cho object_story_spec). */
    pageId;
    primaryText;
    headline;
    linkUrl;
    imageUrl;
    videoId;
}
exports.CreatePausedAdStackDto = CreatePausedAdStackDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreatePausedAdStackDto.prototype, "idempotencyKey", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreatePausedAdStackDto.prototype, "campaignName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(exports.FACEBOOK_CAMPAIGN_OBJECTIVES),
    __metadata("design:type", String)
], CreatePausedAdStackDto.prototype, "objective", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreatePausedAdStackDto.prototype, "adSetName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], CreatePausedAdStackDto.prototype, "adName", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreatePausedAdStackDto.prototype, "dailyBudget", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(6),
    __metadata("design:type", Number)
], CreatePausedAdStackDto.prototype, "currencyOffset", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreatePausedAdStackDto.prototype, "startTime", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreatePausedAdStackDto.prototype, "endTime", void 0);
__decorate([
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => CreatePausedAdTargetingDto),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", CreatePausedAdTargetingDto)
], CreatePausedAdStackDto.prototype, "targeting", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreatePausedAdStackDto.prototype, "pageId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], CreatePausedAdStackDto.prototype, "primaryText", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], CreatePausedAdStackDto.prototype, "headline", void 0);
__decorate([
    (0, class_validator_1.IsUrl)({ require_tld: false }),
    __metadata("design:type", String)
], CreatePausedAdStackDto.prototype, "linkUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)({ require_tld: false }),
    __metadata("design:type", String)
], CreatePausedAdStackDto.prototype, "imageUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreatePausedAdStackDto.prototype, "videoId", void 0);
class UpdateCampaignBudgetDto {
    idempotencyKey;
    /** Ngân sách ngày (major units). */
    dailyBudget;
    currencyOffset;
}
exports.UpdateCampaignBudgetDto = UpdateCampaignBudgetDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], UpdateCampaignBudgetDto.prototype, "idempotencyKey", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], UpdateCampaignBudgetDto.prototype, "dailyBudget", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(6),
    __metadata("design:type", Number)
], UpdateCampaignBudgetDto.prototype, "currencyOffset", void 0);
class UpdateCampaignScheduleDto {
    idempotencyKey;
    startTime;
    endTime;
    /** Ad Set external id — nếu bỏ trống dùng ad set đầu tiên của campaign. */
    adSetId;
}
exports.UpdateCampaignScheduleDto = UpdateCampaignScheduleDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], UpdateCampaignScheduleDto.prototype, "idempotencyKey", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], UpdateCampaignScheduleDto.prototype, "startTime", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], UpdateCampaignScheduleDto.prototype, "endTime", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateCampaignScheduleDto.prototype, "adSetId", void 0);
class SetCampaignStatusDto {
    idempotencyKey;
    active;
}
exports.SetCampaignStatusDto = SetCampaignStatusDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], SetCampaignStatusDto.prototype, "idempotencyKey", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SetCampaignStatusDto.prototype, "active", void 0);
class SyncFacebookAdsDto {
    /** Bỏ trống → incremental từ lastSyncAt */
    dateFrom;
    dateTo;
    campaignId;
}
exports.SyncFacebookAdsDto = SyncFacebookAdsDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], SyncFacebookAdsDto.prototype, "dateFrom", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], SyncFacebookAdsDto.prototype, "dateTo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SyncFacebookAdsDto.prototype, "campaignId", void 0);
class FacebookCampaignsQueryDto {
    dateFrom;
    dateTo;
    adAccountId;
    campaignId;
}
exports.FacebookCampaignsQueryDto = FacebookCampaignsQueryDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], FacebookCampaignsQueryDto.prototype, "dateFrom", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], FacebookCampaignsQueryDto.prototype, "dateTo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], FacebookCampaignsQueryDto.prototype, "adAccountId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], FacebookCampaignsQueryDto.prototype, "campaignId", void 0);
class FacebookLiveInsightsQueryDto {
    dateFrom;
    dateTo;
    level;
    objectId;
    limit;
    offset;
    /** true = bỏ Redis cache, gọi Meta lại. */
    refresh;
}
exports.FacebookLiveInsightsQueryDto = FacebookLiveInsightsQueryDto;
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], FacebookLiveInsightsQueryDto.prototype, "dateFrom", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], FacebookLiveInsightsQueryDto.prototype, "dateTo", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['campaign', 'adset', 'ad']),
    __metadata("design:type", String)
], FacebookLiveInsightsQueryDto.prototype, "level", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], FacebookLiveInsightsQueryDto.prototype, "objectId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(200),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], FacebookLiveInsightsQueryDto.prototype, "limit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], FacebookLiveInsightsQueryDto.prototype, "offset", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    (0, class_transformer_1.Type)(() => Boolean),
    __metadata("design:type", Boolean)
], FacebookLiveInsightsQueryDto.prototype, "refresh", void 0);
