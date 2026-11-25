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
exports.MessagingCampaignController = void 0;
const common_1 = require("@nestjs/common");
const messaging_campaign_service_1 = require("./messaging-campaign.service");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permissions_guard_1 = require("../common/guards/permissions.guard");
const require_permissions_decorator_1 = require("../common/decorators/require-permissions.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const messaging_campaign_dto_1 = require("./dto/messaging-campaign.dto");
let MessagingCampaignController = class MessagingCampaignController {
    service;
    constructor(service) {
        this.service = service;
    }
    list(user, query) {
        return this.service.list(user.organizationId, query);
    }
    create(user, dto) {
        return this.service.create(user.organizationId, dto, user.id);
    }
    dashboard(user, id) {
        return this.service.getDashboard(user.organizationId, id);
    }
    async export(user, id, format, reveal, res) {
        const file = await this.service.exportRecipients(user.organizationId, id, {
            format,
            userId: user.id,
            userRole: user.role,
            permissions: user.permissions,
            reveal: reveal === '1' || reveal === 'true',
        });
        res.setHeader('Content-Type', file.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
        res.send(file.content);
    }
    findOne(user, id) {
        return this.service.findOne(user.organizationId, id);
    }
    update(user, id, dto) {
        return this.service.update(user.organizationId, id, dto, user.id);
    }
    previewSegment(user, id) {
        return this.service.previewSegment(user.organizationId, id);
    }
    previewEligibility(user, id, dto) {
        return this.service.previewEligibility(user.organizationId, id, dto);
    }
    testSend(user, id, dto) {
        return this.service.testSend(user.organizationId, id, dto, user.id);
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
    resume(user, id) {
        return this.service.resume(user.organizationId, id, user.id);
    }
    cancel(user, id) {
        return this.service.cancel(user.organizationId, id, user.id);
    }
    duplicate(user, id) {
        return this.service.duplicate(user.organizationId, id, user.id);
    }
    remove(user, id) {
        return this.service.remove(user.organizationId, id, user.id);
    }
};
exports.MessagingCampaignController = MessagingCampaignController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, messaging_campaign_dto_1.MessagingCampaignQueryDto]),
    __metadata("design:returntype", void 0)
], MessagingCampaignController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, messaging_campaign_dto_1.CreateMessagingCampaignDto]),
    __metadata("design:returntype", void 0)
], MessagingCampaignController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id/dashboard'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MessagingCampaignController.prototype, "dashboard", null);
__decorate([
    (0, common_1.Get)(':id/export'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('format')),
    __param(3, (0, common_1.Query)('reveal')),
    __param(4, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], MessagingCampaignController.prototype, "export", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MessagingCampaignController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, messaging_campaign_dto_1.UpdateMessagingCampaignDto]),
    __metadata("design:returntype", void 0)
], MessagingCampaignController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/preview-segment'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MessagingCampaignController.prototype, "previewSegment", null);
__decorate([
    (0, common_1.Post)(':id/preview-eligibility'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, messaging_campaign_dto_1.PreviewEligibilityDto]),
    __metadata("design:returntype", void 0)
], MessagingCampaignController.prototype, "previewEligibility", null);
__decorate([
    (0, common_1.Post)(':id/test-send'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.send'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, messaging_campaign_dto_1.TestSendMessagingCampaignDto]),
    __metadata("design:returntype", void 0)
], MessagingCampaignController.prototype, "testSend", null);
__decorate([
    (0, common_1.Post)(':id/schedule'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.approve'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, messaging_campaign_dto_1.ScheduleMessagingCampaignDto]),
    __metadata("design:returntype", void 0)
], MessagingCampaignController.prototype, "schedule", null);
__decorate([
    (0, common_1.Post)(':id/start'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.send'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MessagingCampaignController.prototype, "start", null);
__decorate([
    (0, common_1.Post)(':id/pause'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.pause'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MessagingCampaignController.prototype, "pause", null);
__decorate([
    (0, common_1.Post)(':id/resume'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.pause'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MessagingCampaignController.prototype, "resume", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.pause'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MessagingCampaignController.prototype, "cancel", null);
__decorate([
    (0, common_1.Post)(':id/duplicate'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MessagingCampaignController.prototype, "duplicate", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MessagingCampaignController.prototype, "remove", null);
exports.MessagingCampaignController = MessagingCampaignController = __decorate([
    (0, common_1.Controller)('automation/messaging-campaigns'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [messaging_campaign_service_1.MessagingCampaignService])
], MessagingCampaignController);
