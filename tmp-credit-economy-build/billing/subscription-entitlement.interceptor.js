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
exports.SubscriptionEntitlementInterceptor = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const skip_subscription_decorator_1 = require("../common/decorators/skip-subscription.decorator");
const billing_service_1 = require("./billing.service");
/** Path prefix (sau global prefix api/v1) được mở khi đã login nhưng chưa có gói */
const ALLOW_PREFIXES = [
    '/auth',
    '/billing',
    '/payments',
    '/health',
    '/admin', // PlatformAdminGuard riêng; SUPER_ADMIN cũng bypass bên dưới
    '/organizations',
    '/affiliate/track',
    // Public webhooks / OAuth callback — không có user hoặc không cần gói
    '/chatbot-cskh/public',
    '/chatbot-cskh/facebook',
    '/messaging/webhooks',
    '/ad-performance/facebook/oauth',
    '/ad-performance/google/oauth',
];
function normalizePath(url) {
    const path = (url || '').split('?')[0] || '';
    // req.url có thể là /api/v1/... hoặc /billing/...
    const stripped = path.replace(/^\/api\/v1/, '') || '/';
    return stripped.startsWith('/') ? stripped : `/${stripped}`;
}
let SubscriptionEntitlementInterceptor = class SubscriptionEntitlementInterceptor {
    reflector;
    billing;
    constructor(reflector, billing) {
        this.reflector = reflector;
        this.billing = billing;
    }
    async intercept(context, next) {
        const skip = this.reflector.getAllAndOverride(skip_subscription_decorator_1.SKIP_SUBSCRIPTION_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (skip)
            return next.handle();
        const req = context.switchToHttp().getRequest();
        const user = req.user;
        // Public / chưa auth — JwtAuthGuard trên route sẽ chặn nếu cần
        if (!user?.organizationId)
            return next.handle();
        // Platform SUPER_ADMIN không bị khóa gói SaaS
        if (user.role === 'SUPER_ADMIN')
            return next.handle();
        const path = normalizePath(req.originalUrl || req.url || req.path || '');
        if (ALLOW_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
            return next.handle();
        }
        const ent = await this.billing.hasValidEntitlement(user.organizationId);
        if (!ent.ok) {
            const code = ent.reason === 'TRIAL_EXPIRED' ? 'TRIAL_EXPIRED' : 'SUBSCRIPTION_REQUIRED';
            const message = ent.reason === 'TRIAL_EXPIRED'
                ? 'Thời gian dùng thử đã kết thúc. Vui lòng thanh toán để tiếp tục sử dụng Ai Bee Go.'
                : ent.reason === 'EXPIRED'
                    ? 'Gói đã hết hạn. Vui lòng gia hạn để tiếp tục sử dụng.'
                    : 'Vui lòng thanh toán hoặc kích hoạt dùng thử để sử dụng tính năng này.';
            throw new common_1.ForbiddenException({
                statusCode: 403,
                code,
                message,
                subscriptionStatus: ent.reason,
                redirectTo: '/pricing',
            });
        }
        // Trial: chỉ cho phép prefix tính năng được cấu hình
        if (ent.isTrial) {
            const allowed = await this.billing.isFeatureAllowedForOrg(user.organizationId, path.replace(/^\//, ''));
            if (!allowed) {
                throw new common_1.ForbiddenException({
                    statusCode: 403,
                    code: 'FEATURE_NOT_IN_TRIAL',
                    message: 'Tính năng này không nằm trong gói dùng thử. Vui lòng nâng cấp để sử dụng.',
                    subscriptionStatus: 'TRIALING',
                    redirectTo: '/pricing',
                });
            }
        }
        if (!ent.isTrial && !(await this.billing.isFeatureAllowedForOrg(user.organizationId, path))) {
            throw new common_1.ForbiddenException({ statusCode: 403, code: 'FEATURE_NOT_IN_PLAN',
                message: 'Tính năng này cần gói Pro hoặc VIP. Vui lòng nâng gói.', redirectTo: '/pricing' });
        }
        return next.handle();
    }
};
exports.SubscriptionEntitlementInterceptor = SubscriptionEntitlementInterceptor;
exports.SubscriptionEntitlementInterceptor = SubscriptionEntitlementInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector,
        billing_service_1.BillingService])
], SubscriptionEntitlementInterceptor);
