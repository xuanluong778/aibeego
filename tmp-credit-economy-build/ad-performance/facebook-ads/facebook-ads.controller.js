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
exports.FacebookAdsController = void 0;
const common_1 = require("@nestjs/common");
const facebook_ads_service_1 = require("./facebook-ads.service");
const auth_guard_1 = require("../../common/guards/auth.guard");
const tenant_guard_1 = require("../../common/guards/tenant.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const facebook_ads_dto_1 = require("./dto/facebook-ads.dto");
let FacebookAdsController = class FacebookAdsController {
    service;
    constructor(service) {
        this.service = service;
    }
    oauthStart(user) {
        return this.service.getOAuthStartUrl(user);
    }
    async oauthCallback(code, state, error, res) {
        const { redirectUrl } = await this.service.handleOAuthCallback(code, state, error);
        return res.redirect(redirectUrl);
    }
    status(user) {
        return this.service.getStatus(user);
    }
    adAccounts(user) {
        return this.service.listAdAccounts(user);
    }
    selectAdAccount(user, dto) {
        return this.service.selectAdAccount(user, dto);
    }
    sync(user, dto) {
        return this.service.sync(user, dto);
    }
    campaigns(user, query) {
        return this.service.getCampaigns(user, query);
    }
    syncLogs(user) {
        return this.service.listSyncLogs(user);
    }
    disconnect(user) {
        return this.service.disconnect(user);
    }
};
exports.FacebookAdsController = FacebookAdsController;
__decorate([
    (0, common_1.Get)('oauth/start'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], FacebookAdsController.prototype, "oauthStart", null);
__decorate([
    (0, common_1.Get)('oauth/callback'),
    __param(0, (0, common_1.Query)('code')),
    __param(1, (0, common_1.Query)('state')),
    __param(2, (0, common_1.Query)('error')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], FacebookAdsController.prototype, "oauthCallback", null);
__decorate([
    (0, common_1.Get)('status'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], FacebookAdsController.prototype, "status", null);
__decorate([
    (0, common_1.Get)('ad-accounts'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], FacebookAdsController.prototype, "adAccounts", null);
__decorate([
    (0, common_1.Post)('ad-account'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, facebook_ads_dto_1.SelectAdAccountDto]),
    __metadata("design:returntype", void 0)
], FacebookAdsController.prototype, "selectAdAccount", null);
__decorate([
    (0, common_1.Post)('sync'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, facebook_ads_dto_1.SyncFacebookAdsDto]),
    __metadata("design:returntype", void 0)
], FacebookAdsController.prototype, "sync", null);
__decorate([
    (0, common_1.Get)('campaigns'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, facebook_ads_dto_1.FacebookCampaignsQueryDto]),
    __metadata("design:returntype", void 0)
], FacebookAdsController.prototype, "campaigns", null);
__decorate([
    (0, common_1.Get)('sync-logs'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], FacebookAdsController.prototype, "syncLogs", null);
__decorate([
    (0, common_1.Delete)('disconnect'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], FacebookAdsController.prototype, "disconnect", null);
exports.FacebookAdsController = FacebookAdsController = __decorate([
    (0, common_1.Controller)('ad-performance/facebook'),
    __metadata("design:paramtypes", [facebook_ads_service_1.FacebookAdsService])
], FacebookAdsController);
