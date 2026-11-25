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
exports.ZaloMarketingController = void 0;
const common_1 = require("@nestjs/common");
const zalo_oauth_service_1 = require("./zalo-oauth.service");
const platform_express_1 = require("@nestjs/platform-express");
const upload_policy_1 = require("../common/uploads/upload-policy");
const zalo_marketing_service_1 = require("./zalo-marketing.service");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permissions_guard_1 = require("../common/guards/permissions.guard");
const require_permissions_decorator_1 = require("../common/decorators/require-permissions.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const zalo_marketing_dto_1 = require("./dto/zalo-marketing.dto");
let ZaloMarketingController = class ZaloMarketingController {
    service;
    constructor(service) {
        this.service = service;
    }
    overview(user) {
        return this.service.overview(user.organizationId);
    }
    reports(user) {
        return this.service.reports(user.organizationId);
    }
    listOas(user) {
        return this.service.listOas(user.organizationId);
    }
    getOa(user, id) {
        return this.service.getOa(user.organizationId, id);
    }
    disconnectOa(user, id) {
        return this.service.disconnectOa(user.organizationId, id, user.id);
    }
    refreshOa(user, id) {
        return this.service.refreshOa(user.organizationId, id, user.id);
    }
    async startOAuth(user, dto, res) {
        const started = await this.service.startOAuth(user.id, user.organizationId, dto.returnPath);
        res.cookie(zalo_oauth_service_1.ZALO_OA_OAUTH_COOKIE, started.cookieValue, {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/',
            maxAge: 10 * 60 * 1000,
        });
        return {
            url: started.url,
            state: started.state,
            redirectUri: started.redirectUri,
            appIdMasked: started.appIdMasked,
        };
    }
    connectZbs(user, dto) {
        return this.service.connectZbs(user.organizationId, dto, user.id);
    }
    syncTemplates(user, dto) {
        return this.service.syncZbsTemplates(user.organizationId, dto.connectionId, user.id);
    }
    listTemplates(user, connectionId) {
        return this.service.listZbsTemplates(user.organizationId, connectionId);
    }
    listCampaigns(user, query) {
        return this.service.listCampaigns(user.organizationId, query);
    }
    createCampaign(user, dto) {
        return this.service.createCampaign(user.organizationId, dto, user.id);
    }
    getCampaign(user, id) {
        return this.service.getCampaign(user.organizationId, id);
    }
    updateCampaign(user, id, dto) {
        return this.service.updateCampaign(user.organizationId, id, dto, user.id);
    }
    removeCampaign(user, id) {
        return this.service.remove(user.organizationId, id, user.id);
    }
    previewSegment(user, id) {
        return this.service.previewSegment(user.organizationId, id);
    }
    previewEligibility(user, id, body) {
        return this.service.previewEligibility(user.organizationId, id, body);
    }
    previewCampaign(user, id, dto) {
        return this.service.previewCampaign(user.organizationId, id, dto);
    }
    previewAudience(user, dto) {
        return this.service.previewAudience(user.organizationId, dto);
    }
    importAudience(user, connectionId, file) {
        return this.service.importAudience(user.organizationId, connectionId, file);
    }
    testZbs(user, dto) {
        return this.service.testZbsSend(user.organizationId, dto);
    }
    schedule(user, id, dto) {
        return this.service.schedule(user.organizationId, id, dto, user.id);
    }
    start(user, id) {
        return this.service.start(user.organizationId, id, user.id);
    }
    pause(user, id) {
        return this.service.pause(user.organizationId, id, user.id);
    }
    dashboard(user, id) {
        return this.service.dashboard(user.organizationId, id);
    }
};
exports.ZaloMarketingController = ZaloMarketingController;
__decorate([
    (0, common_1.Get)('overview'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ZaloMarketingController.prototype, "overview", null);
__decorate([
    (0, common_1.Get)('reports'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ZaloMarketingController.prototype, "reports", null);
__decorate([
    (0, common_1.Get)('oa'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ZaloMarketingController.prototype, "listOas", null);
__decorate([
    (0, common_1.Get)('oa/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ZaloMarketingController.prototype, "getOa", null);
__decorate([
    (0, common_1.Post)('oa/:id/disconnect'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.integration.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ZaloMarketingController.prototype, "disconnectOa", null);
__decorate([
    (0, common_1.Post)('oa/:id/refresh'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.integration.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ZaloMarketingController.prototype, "refreshOa", null);
__decorate([
    (0, common_1.Post)('oauth/start'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.integration.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, zalo_marketing_dto_1.StartZaloOAuthDto, Object]),
    __metadata("design:returntype", Promise)
], ZaloMarketingController.prototype, "startOAuth", null);
__decorate([
    (0, common_1.Post)('oa/zbs'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.integration.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, zalo_marketing_dto_1.ConnectZaloZbsDto]),
    __metadata("design:returntype", void 0)
], ZaloMarketingController.prototype, "connectZbs", null);
__decorate([
    (0, common_1.Post)('templates/sync'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.integration.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, zalo_marketing_dto_1.SyncZbsTemplatesDto]),
    __metadata("design:returntype", void 0)
], ZaloMarketingController.prototype, "syncTemplates", null);
__decorate([
    (0, common_1.Get)('templates'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('connectionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ZaloMarketingController.prototype, "listTemplates", null);
__decorate([
    (0, common_1.Get)('campaigns'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, zalo_marketing_dto_1.ZaloCampaignQueryDto]),
    __metadata("design:returntype", void 0)
], ZaloMarketingController.prototype, "listCampaigns", null);
__decorate([
    (0, common_1.Post)('campaigns'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, zalo_marketing_dto_1.CreateZaloCampaignDto]),
    __metadata("design:returntype", void 0)
], ZaloMarketingController.prototype, "createCampaign", null);
__decorate([
    (0, common_1.Get)('campaigns/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ZaloMarketingController.prototype, "getCampaign", null);
__decorate([
    (0, common_1.Patch)('campaigns/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, zalo_marketing_dto_1.UpdateZaloCampaignDto]),
    __metadata("design:returntype", void 0)
], ZaloMarketingController.prototype, "updateCampaign", null);
__decorate([
    (0, common_1.Delete)('campaigns/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ZaloMarketingController.prototype, "removeCampaign", null);
__decorate([
    (0, common_1.Post)('campaigns/:id/preview-segment'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ZaloMarketingController.prototype, "previewSegment", null);
__decorate([
    (0, common_1.Post)('campaigns/:id/preview-eligibility'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ZaloMarketingController.prototype, "previewEligibility", null);
__decorate([
    (0, common_1.Post)('campaigns/:id/preview'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, zalo_marketing_dto_1.PreviewZaloCampaignDto]),
    __metadata("design:returntype", void 0)
], ZaloMarketingController.prototype, "previewCampaign", null);
__decorate([
    (0, common_1.Post)('audience/preview'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, zalo_marketing_dto_1.PreviewZaloAudienceDto]),
    __metadata("design:returntype", void 0)
], ZaloMarketingController.prototype, "previewAudience", null);
__decorate([
    (0, common_1.Post)('audience/import'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', (0, upload_policy_1.createUploadMulterOptions)('spreadsheet'))),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('connectionId')),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ZaloMarketingController.prototype, "importAudience", null);
__decorate([
    (0, common_1.Post)('test/zbs'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.send'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, zalo_marketing_dto_1.TestZaloZbsSendDto]),
    __metadata("design:returntype", void 0)
], ZaloMarketingController.prototype, "testZbs", null);
__decorate([
    (0, common_1.Post)('campaigns/:id/schedule'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.approve'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, zalo_marketing_dto_1.ScheduleZaloCampaignDto]),
    __metadata("design:returntype", void 0)
], ZaloMarketingController.prototype, "schedule", null);
__decorate([
    (0, common_1.Post)('campaigns/:id/start'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.send'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ZaloMarketingController.prototype, "start", null);
__decorate([
    (0, common_1.Post)('campaigns/:id/pause'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.pause'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ZaloMarketingController.prototype, "pause", null);
__decorate([
    (0, common_1.Get)('campaigns/:id/dashboard'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ZaloMarketingController.prototype, "dashboard", null);
exports.ZaloMarketingController = ZaloMarketingController = __decorate([
    (0, common_1.Controller)('zalo-marketing'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [zalo_marketing_service_1.ZaloMarketingService])
], ZaloMarketingController);
