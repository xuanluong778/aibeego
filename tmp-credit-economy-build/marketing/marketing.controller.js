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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketingController = void 0;
const common_1 = require("@nestjs/common");
const marketing_service_1 = require("./marketing.service");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const lead_source_dto_1 = require("./dto/lead-source.dto");
const ad_campaign_dto_1 = require("./dto/ad-campaign.dto");
let MarketingController = class MarketingController {
    service;
    constructor(service) {
        this.service = service;
    }
    listLeadSources(user, query) {
        return this.service.listLeadSources(user.organizationId, query);
    }
    createLeadSource(user, dto) {
        return this.service.createLeadSource(user.organizationId, dto);
    }
    updateLeadSource(user, id, dto) {
        return this.service.updateLeadSource(user.organizationId, id, dto);
    }
    listAdAccounts(user) {
        return this.service.listAdAccounts(user.organizationId);
    }
    createAdAccount(user, dto) {
        return this.service.createAdAccount(user.organizationId, dto);
    }
    listAdCampaigns(user, query) {
        return this.service.listAdCampaigns(user.organizationId, query);
    }
    createAdCampaign(user, dto) {
        return this.service.createAdCampaign(user.organizationId, dto);
    }
    createAdDailyStat(user, dto) {
        return this.service.createAdDailyStat(user.organizationId, dto);
    }
    reports(user, query) {
        return this.service.getCampaignReports(user.organizationId, query);
    }
};
exports.MarketingController = MarketingController;
__decorate([
    (0, common_1.Get)('lead-sources'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, lead_source_dto_1.LeadSourceQueryDto]),
    __metadata("design:returntype", void 0)
], MarketingController.prototype, "listLeadSources", null);
__decorate([
    (0, common_1.Post)('lead-sources'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, lead_source_dto_1.CreateLeadSourceDto]),
    __metadata("design:returntype", void 0)
], MarketingController.prototype, "createLeadSource", null);
__decorate([
    (0, common_1.Patch)('lead-sources/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, lead_source_dto_1.UpdateLeadSourceDto]),
    __metadata("design:returntype", void 0)
], MarketingController.prototype, "updateLeadSource", null);
__decorate([
    (0, common_1.Get)('ad-accounts'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MarketingController.prototype, "listAdAccounts", null);
__decorate([
    (0, common_1.Post)('ad-accounts'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ad_campaign_dto_1.CreateAdAccountDto]),
    __metadata("design:returntype", void 0)
], MarketingController.prototype, "createAdAccount", null);
__decorate([
    (0, common_1.Get)('ad-campaigns'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ad_campaign_dto_1.AdCampaignQueryDto]),
    __metadata("design:returntype", void 0)
], MarketingController.prototype, "listAdCampaigns", null);
__decorate([
    (0, common_1.Post)('ad-campaigns'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ad_campaign_dto_1.CreateAdCampaignDto]),
    __metadata("design:returntype", void 0)
], MarketingController.prototype, "createAdCampaign", null);
__decorate([
    (0, common_1.Post)('ad-daily-stats'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ad_campaign_dto_1.CreateAdDailyStatDto]),
    __metadata("design:returntype", void 0)
], MarketingController.prototype, "createAdDailyStat", null);
__decorate([
    (0, common_1.Get)('reports'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ad_campaign_dto_1.MarketingReportQueryDto]),
    __metadata("design:returntype", void 0)
], MarketingController.prototype, "reports", null);
exports.MarketingController = MarketingController = __decorate([
    (0, common_1.Controller)('marketing'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __metadata("design:paramtypes", [marketing_service_1.MarketingService])
], MarketingController);
