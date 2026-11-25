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
exports.AffiliateController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const client_ip_decorator_1 = require("../common/decorators/client-ip.decorator");
const affiliate_service_1 = require("./affiliate.service");
const affiliate_dto_1 = require("./dto/affiliate.dto");
let AffiliateController = class AffiliateController {
    affiliate;
    constructor(affiliate) {
        this.affiliate = affiliate;
    }
    /** Public click tracking — no auth */
    track(dto, req, ip) {
        return this.affiliate.trackClick(dto, {
            ip,
            userAgent: req.headers['user-agent'],
        });
    }
    me(user) {
        return this.affiliate.overview(user);
    }
    referrals(user, page, pageSize) {
        return this.affiliate.listReferrals(user, Math.max(1, Number(page) || 1), Math.min(100, Math.max(1, Number(pageSize) || 20)));
    }
    commissions(user, page, pageSize, status) {
        return this.affiliate.listCommissions(user, Math.max(1, Number(page) || 1), Math.min(100, Math.max(1, Number(pageSize) || 20)), status);
    }
    payoutMethod(user, dto) {
        return this.affiliate.upsertPayoutMethod(user, dto);
    }
    createPayout(user, dto) {
        return this.affiliate.createPayoutRequest(user, dto);
    }
    listPayouts(user, page, pageSize) {
        return this.affiliate.listPayouts(user, Math.max(1, Number(page) || 1), Math.min(100, Math.max(1, Number(pageSize) || 20)));
    }
};
exports.AffiliateController = AffiliateController;
__decorate([
    (0, common_1.Post)('track'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [affiliate_dto_1.TrackClickDto, Object, String]),
    __metadata("design:returntype", void 0)
], AffiliateController.prototype, "track", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AffiliateController.prototype, "me", null);
__decorate([
    (0, common_1.Get)('referrals'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], AffiliateController.prototype, "referrals", null);
__decorate([
    (0, common_1.Get)('commissions'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('pageSize')),
    __param(3, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], AffiliateController.prototype, "commissions", null);
__decorate([
    (0, common_1.Post)('payout-method'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, affiliate_dto_1.UpsertPayoutMethodDto]),
    __metadata("design:returntype", void 0)
], AffiliateController.prototype, "payoutMethod", null);
__decorate([
    (0, common_1.Post)('payouts'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, affiliate_dto_1.CreatePayoutRequestDto]),
    __metadata("design:returntype", void 0)
], AffiliateController.prototype, "createPayout", null);
__decorate([
    (0, common_1.Get)('payouts'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('pageSize')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], AffiliateController.prototype, "listPayouts", null);
exports.AffiliateController = AffiliateController = __decorate([
    (0, common_1.Controller)('affiliate'),
    __metadata("design:paramtypes", [affiliate_service_1.AffiliateService])
], AffiliateController);
