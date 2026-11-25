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
exports.AffiliateAdminController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../common/guards/auth.guard");
const platform_admin_guard_1 = require("../common/guards/platform-admin.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const client_ip_decorator_1 = require("../common/decorators/client-ip.decorator");
const affiliate_admin_service_1 = require("./affiliate-admin.service");
const affiliate_dto_1 = require("./dto/affiliate.dto");
let AffiliateAdminController = class AffiliateAdminController {
    admin;
    constructor(admin) {
        this.admin = admin;
    }
    overview() {
        return this.admin.overview();
    }
    partners(query) {
        return this.admin.listPartners(query);
    }
    setStatus(user, id, dto, ip) {
        return this.admin.setStatus(user, id, dto, ip);
    }
    setRate(user, id, dto, ip) {
        return this.admin.setRate(user, id, dto, ip);
    }
    referrals(query) {
        return this.admin.listReferrals(query);
    }
    commissions(query) {
        return this.admin.listCommissions(query);
    }
    approveCommission(user, id, dto, ip) {
        return this.admin.approveCommission(user, id, dto, ip);
    }
    reverseCommission(user, id, dto, ip) {
        return this.admin.reverseCommission(user, id, dto, ip);
    }
    payouts(query) {
        return this.admin.listPayouts(query);
    }
    approvePayout(user, id, dto, ip) {
        return this.admin.approvePayout(user, id, dto, ip);
    }
    rejectPayout(user, id, dto, ip) {
        return this.admin.rejectPayout(user, id, dto, ip);
    }
    markPaid(user, id, dto, ip) {
        return this.admin.markPayoutPaid(user, id, dto, ip);
    }
    fraud(query) {
        return this.admin.listFraud(query);
    }
    settings() {
        return this.admin.getSettings();
    }
    updateSettings(user, dto, ip) {
        return this.admin.updateSettings(user, dto, ip);
    }
    audit(query) {
        return this.admin.listAudit(query);
    }
};
exports.AffiliateAdminController = AffiliateAdminController;
__decorate([
    (0, common_1.Get)('overview'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AffiliateAdminController.prototype, "overview", null);
__decorate([
    (0, common_1.Get)('partners'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [affiliate_dto_1.AffiliateListQueryDto]),
    __metadata("design:returntype", void 0)
], AffiliateAdminController.prototype, "partners", null);
__decorate([
    (0, common_1.Patch)('partners/:id/status'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, affiliate_dto_1.AdminSetAffiliateStatusDto, String]),
    __metadata("design:returntype", void 0)
], AffiliateAdminController.prototype, "setStatus", null);
__decorate([
    (0, common_1.Patch)('partners/:id/rate'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, affiliate_dto_1.AdminSetRateDto, String]),
    __metadata("design:returntype", void 0)
], AffiliateAdminController.prototype, "setRate", null);
__decorate([
    (0, common_1.Get)('referrals'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [affiliate_dto_1.AffiliateListQueryDto]),
    __metadata("design:returntype", void 0)
], AffiliateAdminController.prototype, "referrals", null);
__decorate([
    (0, common_1.Get)('commissions'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [affiliate_dto_1.AffiliateListQueryDto]),
    __metadata("design:returntype", void 0)
], AffiliateAdminController.prototype, "commissions", null);
__decorate([
    (0, common_1.Post)('commissions/:id/approve'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, affiliate_dto_1.AffiliateReasonDto, String]),
    __metadata("design:returntype", void 0)
], AffiliateAdminController.prototype, "approveCommission", null);
__decorate([
    (0, common_1.Post)('commissions/:id/reverse'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, affiliate_dto_1.AdminReverseCommissionDto, String]),
    __metadata("design:returntype", void 0)
], AffiliateAdminController.prototype, "reverseCommission", null);
__decorate([
    (0, common_1.Get)('payouts'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [affiliate_dto_1.AffiliateListQueryDto]),
    __metadata("design:returntype", void 0)
], AffiliateAdminController.prototype, "payouts", null);
__decorate([
    (0, common_1.Post)('payouts/:id/approve'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, affiliate_dto_1.AffiliateReasonDto, String]),
    __metadata("design:returntype", void 0)
], AffiliateAdminController.prototype, "approvePayout", null);
__decorate([
    (0, common_1.Post)('payouts/:id/reject'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, affiliate_dto_1.AffiliateReasonDto, String]),
    __metadata("design:returntype", void 0)
], AffiliateAdminController.prototype, "rejectPayout", null);
__decorate([
    (0, common_1.Post)('payouts/:id/mark-paid'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, affiliate_dto_1.AdminPayoutDecisionDto, String]),
    __metadata("design:returntype", void 0)
], AffiliateAdminController.prototype, "markPaid", null);
__decorate([
    (0, common_1.Get)('fraud'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [affiliate_dto_1.AffiliateListQueryDto]),
    __metadata("design:returntype", void 0)
], AffiliateAdminController.prototype, "fraud", null);
__decorate([
    (0, common_1.Get)('settings'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AffiliateAdminController.prototype, "settings", null);
__decorate([
    (0, common_1.Patch)('settings'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, affiliate_dto_1.AdminUpdateSettingsDto, String]),
    __metadata("design:returntype", void 0)
], AffiliateAdminController.prototype, "updateSettings", null);
__decorate([
    (0, common_1.Get)('audit-logs'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [affiliate_dto_1.AffiliateListQueryDto]),
    __metadata("design:returntype", void 0)
], AffiliateAdminController.prototype, "audit", null);
exports.AffiliateAdminController = AffiliateAdminController = __decorate([
    (0, common_1.Controller)('admin/affiliate'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, platform_admin_guard_1.PlatformAdminGuard),
    __metadata("design:paramtypes", [affiliate_admin_service_1.AffiliateAdminService])
], AffiliateAdminController);
