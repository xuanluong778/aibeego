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
exports.PlatformAdminController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../common/guards/auth.guard");
const platform_admin_guard_1 = require("../common/guards/platform-admin.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const client_ip_decorator_1 = require("../common/decorators/client-ip.decorator");
const platform_admin_service_1 = require("./platform-admin.service");
const platform_admin_ops_service_1 = require("./platform-admin-ops.service");
const platform_admin_dto_1 = require("./dto/platform-admin.dto");
let PlatformAdminController = class PlatformAdminController {
    admin;
    ops;
    constructor(admin, ops) {
        this.admin = admin;
        this.ops = ops;
    }
    overview() {
        return this.admin.overview();
    }
    listOrganizations(query) {
        return this.admin.listOrganizations(query);
    }
    getOrganization(id) {
        return this.admin.getOrganization(id);
    }
    setOrganizationStatus(user, id, dto, ip) {
        return this.admin.setOrganizationActive(user, id, dto, ip);
    }
    listUsers(query) {
        return this.admin.listUsers(query);
    }
    getUser(id) {
        return this.admin.getUser(id);
    }
    setUserStatus(user, id, dto, ip) {
        return this.admin.setUserActive(user, id, dto, ip);
    }
    forceLogout(user, id, dto, ip) {
        return this.admin.forceLogout(user, id, dto, ip);
    }
    /** Soft delete — giữ billing/audit; revoke session ngay */
    softDeleteUser(user, id, dto, ip) {
        return this.admin.softDeleteUser(user, id, dto, ip);
    }
    /** Tặng thời gian (ngày/tháng/năm) — idempotent */
    giftTime(user, id, dto, ip) {
        return this.admin.giftTimeToUser(user, id, dto, ip);
    }
    listSubscriptions(query) {
        return this.admin.listSubscriptions(query);
    }
    getSubscription(id) {
        return this.admin.getSubscription(id);
    }
    extend(user, id, dto, ip) {
        return this.admin.extendSubscription(user, id, dto, ip);
    }
    upgrade12m(user, id, dto, ip) {
        return this.admin.upgradeTo12m(user, id, dto, ip);
    }
    usage(query) {
        return this.ops.listUsage(query);
    }
    integrationsHealth() {
        return this.ops.integrationsHealth();
    }
    failedJobs(query) {
        return this.ops.listFailedJobs(query);
    }
    retryJob(user, type, id, dto, ip) {
        return this.ops.retryJob(user, type, id, dto, ip);
    }
    auditLogs(query) {
        return this.ops.listAuditLogs(query);
    }
};
exports.PlatformAdminController = PlatformAdminController;
__decorate([
    (0, common_1.Get)('overview'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PlatformAdminController.prototype, "overview", null);
__decorate([
    (0, common_1.Get)('organizations'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [platform_admin_dto_1.AdminListQueryDto]),
    __metadata("design:returntype", void 0)
], PlatformAdminController.prototype, "listOrganizations", null);
__decorate([
    (0, common_1.Get)('organizations/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PlatformAdminController.prototype, "getOrganization", null);
__decorate([
    (0, common_1.Patch)('organizations/:id/status'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, platform_admin_dto_1.AdminSetActiveDto, String]),
    __metadata("design:returntype", void 0)
], PlatformAdminController.prototype, "setOrganizationStatus", null);
__decorate([
    (0, common_1.Get)('users'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [platform_admin_dto_1.AdminListQueryDto]),
    __metadata("design:returntype", void 0)
], PlatformAdminController.prototype, "listUsers", null);
__decorate([
    (0, common_1.Get)('users/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PlatformAdminController.prototype, "getUser", null);
__decorate([
    (0, common_1.Patch)('users/:id/status'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, platform_admin_dto_1.AdminSetActiveDto, String]),
    __metadata("design:returntype", void 0)
], PlatformAdminController.prototype, "setUserStatus", null);
__decorate([
    (0, common_1.Post)('users/:id/force-logout'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, platform_admin_dto_1.AdminReasonDto, String]),
    __metadata("design:returntype", void 0)
], PlatformAdminController.prototype, "forceLogout", null);
__decorate([
    (0, common_1.Post)('users/:id/soft-delete'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, platform_admin_dto_1.AdminSoftDeleteUserDto, String]),
    __metadata("design:returntype", void 0)
], PlatformAdminController.prototype, "softDeleteUser", null);
__decorate([
    (0, common_1.Post)('users/:id/gift-time'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, platform_admin_dto_1.AdminGiftTimeDto, String]),
    __metadata("design:returntype", void 0)
], PlatformAdminController.prototype, "giftTime", null);
__decorate([
    (0, common_1.Get)('subscriptions'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [platform_admin_dto_1.AdminListQueryDto]),
    __metadata("design:returntype", void 0)
], PlatformAdminController.prototype, "listSubscriptions", null);
__decorate([
    (0, common_1.Get)('subscriptions/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PlatformAdminController.prototype, "getSubscription", null);
__decorate([
    (0, common_1.Post)('subscriptions/:id/extend'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, platform_admin_dto_1.AdminExtendSubscriptionDto, String]),
    __metadata("design:returntype", void 0)
], PlatformAdminController.prototype, "extend", null);
__decorate([
    (0, common_1.Post)('subscriptions/:id/upgrade-12m'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, platform_admin_dto_1.AdminReasonDto, String]),
    __metadata("design:returntype", void 0)
], PlatformAdminController.prototype, "upgrade12m", null);
__decorate([
    (0, common_1.Get)('usage'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [platform_admin_dto_1.AdminUsageQueryDto]),
    __metadata("design:returntype", void 0)
], PlatformAdminController.prototype, "usage", null);
__decorate([
    (0, common_1.Get)('integrations/health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PlatformAdminController.prototype, "integrationsHealth", null);
__decorate([
    (0, common_1.Get)('jobs/failed'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [platform_admin_dto_1.AdminJobsQueryDto]),
    __metadata("design:returntype", void 0)
], PlatformAdminController.prototype, "failedJobs", null);
__decorate([
    (0, common_1.Post)('jobs/:type/:id/retry'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('type')),
    __param(2, (0, common_1.Param)('id')),
    __param(3, (0, common_1.Body)()),
    __param(4, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, platform_admin_dto_1.AdminReasonDto, String]),
    __metadata("design:returntype", void 0)
], PlatformAdminController.prototype, "retryJob", null);
__decorate([
    (0, common_1.Get)('audit-logs'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [platform_admin_dto_1.AdminAuditQueryDto]),
    __metadata("design:returntype", void 0)
], PlatformAdminController.prototype, "auditLogs", null);
exports.PlatformAdminController = PlatformAdminController = __decorate([
    (0, common_1.Controller)('admin'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, platform_admin_guard_1.PlatformAdminGuard),
    __metadata("design:paramtypes", [platform_admin_service_1.PlatformAdminService,
        platform_admin_ops_service_1.PlatformAdminOpsService])
], PlatformAdminController);
