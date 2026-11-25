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
exports.GoogleAdsController = void 0;
const common_1 = require("@nestjs/common");
const google_ads_service_1 = require("./google-ads.service");
const auth_guard_1 = require("../../common/guards/auth.guard");
const tenant_guard_1 = require("../../common/guards/tenant.guard");
const permissions_guard_1 = require("../../common/guards/permissions.guard");
const require_permissions_decorator_1 = require("../../common/decorators/require-permissions.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const google_ads_dto_1 = require("./dto/google-ads.dto");
let GoogleAdsController = class GoogleAdsController {
    service;
    constructor(service) {
        this.service = service;
    }
    oauthStart(user, returnTo) {
        return this.service.getOAuthStartUrl(user, returnTo);
    }
    async oauthCallback(code, state, error, res) {
        const { redirectUrl } = await this.service.handleOAuthCallback(code, state, error);
        return res.redirect(redirectUrl);
    }
    status(user) {
        return this.service.getStatus(user);
    }
    customers(user) {
        return this.service.listCustomers(user);
    }
    accounts(user) {
        return this.service.listLinkedAccounts(user);
    }
    selectCustomer(user, dto) {
        return this.service.selectCustomer(user, dto);
    }
    selectAccounts(user, dto) {
        return this.service.selectAccounts(user, dto);
    }
    sync(user, dto) {
        return this.service.sync(user, dto);
    }
    syncJob(user, jobId) {
        return this.service.getSyncJob(user, jobId);
    }
    disconnect(user) {
        return this.service.disconnect(user);
    }
};
exports.GoogleAdsController = GoogleAdsController;
__decorate([
    (0, common_1.Get)('oauth/start'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.connect'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('returnTo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GoogleAdsController.prototype, "oauthStart", null);
__decorate([
    (0, common_1.Get)('oauth/callback'),
    __param(0, (0, common_1.Query)('code')),
    __param(1, (0, common_1.Query)('state')),
    __param(2, (0, common_1.Query)('error')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], GoogleAdsController.prototype, "oauthCallback", null);
__decorate([
    (0, common_1.Get)('status'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], GoogleAdsController.prototype, "status", null);
__decorate([
    (0, common_1.Get)('customers'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.connect'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], GoogleAdsController.prototype, "customers", null);
__decorate([
    (0, common_1.Get)('accounts'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], GoogleAdsController.prototype, "accounts", null);
__decorate([
    (0, common_1.Post)('customer'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.connect'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, google_ads_dto_1.SelectGoogleCustomerDto]),
    __metadata("design:returntype", void 0)
], GoogleAdsController.prototype, "selectCustomer", null);
__decorate([
    (0, common_1.Post)('accounts'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.connect'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, google_ads_dto_1.SelectGoogleAccountsDto]),
    __metadata("design:returntype", void 0)
], GoogleAdsController.prototype, "selectAccounts", null);
__decorate([
    (0, common_1.Post)('sync'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.sync'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, google_ads_dto_1.SyncGoogleAdsDto]),
    __metadata("design:returntype", void 0)
], GoogleAdsController.prototype, "sync", null);
__decorate([
    (0, common_1.Get)('sync-jobs/:jobId'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('jobId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], GoogleAdsController.prototype, "syncJob", null);
__decorate([
    (0, common_1.Delete)('disconnect'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.connect'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], GoogleAdsController.prototype, "disconnect", null);
exports.GoogleAdsController = GoogleAdsController = __decorate([
    (0, common_1.Controller)('ad-performance/google'),
    __metadata("design:paramtypes", [google_ads_service_1.GoogleAdsService])
], GoogleAdsController);
