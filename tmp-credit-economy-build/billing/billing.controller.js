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
exports.BillingController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const platform_admin_guard_1 = require("../common/guards/platform-admin.guard");
// TenantGuard: tenant routes; PlatformAdminGuard: /admin/billing/*
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const skip_subscription_decorator_1 = require("../common/decorators/skip-subscription.decorator");
const billing_service_1 = require("./billing.service");
const billing_dto_1 = require("./dto/billing.dto");
const client_ip_decorator_1 = require("../common/decorators/client-ip.decorator");
let BillingController = class BillingController {
    billing;
    constructor(billing) {
        this.billing = billing;
    }
    /** Public pricing table */
    listPlans() {
        return this.billing.listPlans();
    }
    currentSubscription(user) {
        return this.billing.getCurrentSubscription(user.organizationId, {
            email: user.email,
            role: user.role,
        });
    }
    entitlements(user) {
        return this.billing.getPlanEntitlements(user.organizationId);
    }
    trialStatus(user) {
        return this.billing.getCurrentSubscription(user.organizationId, {
            email: user.email,
            role: user.role,
        });
    }
    /** User chủ động kích hoạt dùng thử 3 ngày */
    activateTrial(user, dto, ip) {
        return this.billing.activateTrial(user, dto, { ip });
    }
    createOrder(user, dto) {
        return this.billing.createOrder(user.organizationId, user.id, dto.planCode);
    }
    createCreditOrder(user, dto) {
        return this.billing.createCreditOrder(user.organizationId, user.id, dto.packageCode);
    }
    listOrders(user) {
        return this.billing.listMyOrders(user.organizationId);
    }
    getOrder(user, idOrCode) {
        return this.billing.getOrder(user.organizationId, idOrCode);
    }
    cancelOrder(user, id) {
        return this.billing.cancelOrder(user.organizationId, user.id, id);
    }
    /** SePay webhook — public, authenticated by API key / HMAC */
    sepayWebhook(req, headers, body) {
        const raw = req.rawBody ?? Buffer.from(JSON.stringify(body));
        return this.billing.handleSepayWebhook(raw, headers, body);
    }
    adminOrders(query) {
        return this.billing.adminListOrders(query);
    }
    adminTransactions(query) {
        return this.billing.adminListTransactions(query);
    }
    adminReprocess(user, id, dto, ip) {
        return this.billing.adminReprocessTransaction(user, id, dto, ip);
    }
    adminSubscriptions(page, pageSize, organizationId) {
        return this.billing.adminListSubscriptions({
            page: Math.max(1, Number(page) || 1),
            pageSize: Math.min(100, Math.max(1, Number(pageSize) || 20)),
            organizationId: organizationId || undefined,
        });
    }
    adminReview(user, dto, ip) {
        return this.billing.adminMarkNeedsReview(user.id, user.organizationId, dto.orderId, dto.note ?? '', ip);
    }
    adminGetTrialSettings() {
        return this.billing.getTrialSettings();
    }
    adminUpdateTrialSettings(dto) {
        return this.billing.updateTrialSettings(dto);
    }
};
exports.BillingController = BillingController;
__decorate([
    (0, common_1.Get)('billing/plans'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "listPlans", null);
__decorate([
    (0, common_1.Get)('billing/subscription'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "currentSubscription", null);
__decorate([
    (0, common_1.Get)('billing/entitlements'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "entitlements", null);
__decorate([
    (0, common_1.Get)('billing/trial/status'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "trialStatus", null);
__decorate([
    (0, common_1.Post)('billing/trial/activate'),
    (0, common_1.HttpCode)(200),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, billing_dto_1.ActivateTrialDto, String]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "activateTrial", null);
__decorate([
    (0, common_1.Post)('billing/orders'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, billing_dto_1.CreatePaymentOrderDto]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "createOrder", null);
__decorate([
    (0, common_1.Post)('billing/credit-orders'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, billing_dto_1.CreateCreditOrderDto]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "createCreditOrder", null);
__decorate([
    (0, common_1.Get)('billing/orders'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "listOrders", null);
__decorate([
    (0, common_1.Get)('billing/orders/:idOrCode'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('idOrCode')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "getOrder", null);
__decorate([
    (0, common_1.Post)('billing/orders/:id/cancel'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "cancelOrder", null);
__decorate([
    (0, common_1.Post)('payments/sepay/webhook'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "sepayWebhook", null);
__decorate([
    (0, common_1.Get)('admin/billing/orders'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, platform_admin_guard_1.PlatformAdminGuard),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [billing_dto_1.AdminPaymentOrdersQueryDto]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "adminOrders", null);
__decorate([
    (0, common_1.Get)('admin/billing/transactions'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, platform_admin_guard_1.PlatformAdminGuard),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [billing_dto_1.AdminBillingTransactionsQueryDto]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "adminTransactions", null);
__decorate([
    (0, common_1.Post)('admin/billing/transactions/:id/reprocess'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, platform_admin_guard_1.PlatformAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, billing_dto_1.AdminReprocessTransactionDto, String]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "adminReprocess", null);
__decorate([
    (0, common_1.Get)('admin/billing/subscriptions'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, platform_admin_guard_1.PlatformAdminGuard),
    __param(0, (0, common_1.Query)('page')),
    __param(1, (0, common_1.Query)('pageSize')),
    __param(2, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "adminSubscriptions", null);
__decorate([
    (0, common_1.Post)('admin/billing/orders/review'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, platform_admin_guard_1.PlatformAdminGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, billing_dto_1.AdminManualReviewDto, String]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "adminReview", null);
__decorate([
    (0, common_1.Get)('admin/billing/trial-settings'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, platform_admin_guard_1.PlatformAdminGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "adminGetTrialSettings", null);
__decorate([
    (0, common_1.Post)('admin/billing/trial-settings'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, platform_admin_guard_1.PlatformAdminGuard),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [billing_dto_1.AdminUpdateTrialSettingsDto]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "adminUpdateTrialSettings", null);
exports.BillingController = BillingController = __decorate([
    (0, common_1.Controller)(),
    (0, skip_subscription_decorator_1.SkipSubscription)(),
    __metadata("design:paramtypes", [billing_service_1.BillingService])
], BillingController);
