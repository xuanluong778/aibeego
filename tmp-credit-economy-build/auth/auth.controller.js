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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const auth_service_1 = require("./auth.service");
const login_dto_1 = require("./dto/login.dto");
const register_dto_1 = require("./dto/register.dto");
const google_auth_dto_1 = require("./dto/google-auth.dto");
const registration_otp_dto_1 = require("./dto/registration-otp.dto");
const update_locale_dto_1 = require("./dto/update-locale.dto");
const auth_guard_1 = require("../common/guards/auth.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const client_ip_decorator_1 = require("../common/decorators/client-ip.decorator");
const skip_subscription_decorator_1 = require("../common/decorators/skip-subscription.decorator");
const auth_security_dto_1 = require("./dto/auth-security.dto");
const auth_cookie_util_1 = require("./auth-cookie.util");
function normalizeRef(raw) {
    if (!raw?.trim())
        return undefined;
    const code = raw.trim().toUpperCase();
    return /^[A-Z0-9]{4,32}$/.test(code) ? code : undefined;
}
function readCookie(req, name) {
    const parsed = req.cookies?.[name];
    if (parsed)
        return normalizeRef(parsed);
    const raw = String(req.headers.cookie || '');
    const re = new RegExp(`(?:^|;\\s*)${name}=([^;]+)`, 'i');
    const m = raw.match(re);
    if (!m?.[1])
        return undefined;
    try {
        return normalizeRef(decodeURIComponent(m[1]));
    }
    catch {
        return normalizeRef(m[1]);
    }
}
/** Ưu tiên: HttpOnly msa_ref → msa_ref_js → header X-Affiliate-Ref */
function readReferralCode(req, bodyCode) {
    return (readCookie(req, 'msa_ref') ||
        readCookie(req, 'msa_ref_js') ||
        normalizeRef(String(req.headers['x-affiliate-ref'] || '')) ||
        normalizeRef(bodyCode));
}
function authMeta(req, ip, bodyCode) {
    return {
        ip,
        userAgent: req.headers['user-agent'],
        referralCode: readReferralCode(req, bodyCode),
    };
}
let AuthController = class AuthController {
    authService;
    config;
    constructor(authService, config) {
        this.authService = authService;
        this.config = config;
    }
    async register(dto, req, res, ip) {
        const result = await this.authService.register(dto, authMeta(req, ip));
        (0, auth_cookie_util_1.setRefreshCookie)(res, result.refreshToken, this.config);
        const { refreshToken: _rt, ...body } = result;
        return body;
    }
    /** Gửi OTP đăng ký (chưa tạo tài khoản) */
    sendRegistrationOtp(dto, req, ip) {
        return this.authService.sendRegistrationOtp(dto, authMeta(req, ip, dto.referralCode));
    }
    /** Gửi lại OTP */
    resendRegistrationOtp(dto, req, ip) {
        return this.authService.resendRegistrationOtp(dto.registrationId, authMeta(req, ip));
    }
    /** Xác minh OTP → tạo User + Organization + đăng nhập */
    async verifyRegistrationOtp(dto, req, res, ip) {
        const result = await this.authService.verifyRegistrationOtp(dto.registrationId, dto.otp, authMeta(req, ip));
        (0, auth_cookie_util_1.setRefreshCookie)(res, result.refreshToken, this.config);
        const { refreshToken: _rt, ...body } = result;
        return body;
    }
    async login(dto, req, res, ip) {
        const result = await this.authService.login(dto, authMeta(req, ip));
        (0, auth_cookie_util_1.setRefreshCookie)(res, result.refreshToken, this.config);
        const { refreshToken: _rt, ...body } = result;
        return body;
    }
    async google(dto, req, res, ip) {
        const result = await this.authService.loginWithGoogle(dto.idToken, authMeta(req, ip, dto.referralCode));
        (0, auth_cookie_util_1.setRefreshCookie)(res, result.refreshToken, this.config);
        const { refreshToken: _rt, ...body } = result;
        return body;
    }
    async refresh(req, res, ip) {
        const refreshToken = req.cookies?.[auth_cookie_util_1.REFRESH_COOKIE_NAME] ??
            (typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined);
        if (!refreshToken) {
            (0, auth_cookie_util_1.clearRefreshCookie)(res, this.config);
            throw new common_1.UnauthorizedException('Refresh token required');
        }
        const result = await this.authService.refresh(refreshToken, authMeta(req, ip));
        (0, auth_cookie_util_1.setRefreshCookie)(res, result.refreshToken, this.config);
        const { refreshToken: _rt, ...body } = result;
        return body;
    }
    async logout(user, req, res, ip) {
        const refreshToken = req.cookies?.[auth_cookie_util_1.REFRESH_COOKIE_NAME];
        const out = await this.authService.logout(user.id, refreshToken, ip);
        (0, auth_cookie_util_1.clearRefreshCookie)(res, this.config);
        return out;
    }
    async logoutAll(user, res, ip) {
        const out = await this.authService.logoutAll(user.id, ip);
        (0, auth_cookie_util_1.clearRefreshCookie)(res, this.config);
        return out;
    }
    forgotPassword(dto, ip) {
        return this.authService.forgotPassword(dto.email, ip);
    }
    resetPassword(dto, ip) {
        return this.authService.resetPassword(dto.token, dto.password, ip);
    }
    verifyEmail(dto, ip) {
        return this.authService.verifyEmail(dto.token, ip);
    }
    resendVerification(user) {
        return this.authService.resendVerification(user.id);
    }
    changePassword(user, dto, ip) {
        return this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword, ip);
    }
    me(user) {
        return this.authService.getCurrentUser(user.id);
    }
    updateLocale(user, dto) {
        return this.authService.updateLocale(user.id, dto.locale);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('register'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_dto_1.RegisterDto, Object, Object, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "register", null);
__decorate([
    (0, common_1.Post)('register/send-otp'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_dto_1.RegisterDto, Object, String]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "sendRegistrationOtp", null);
__decorate([
    (0, common_1.Post)('register/resend-otp'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [registration_otp_dto_1.ResendRegistrationOtpDto, Object, String]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "resendRegistrationOtp", null);
__decorate([
    (0, common_1.Post)('register/verify-otp'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [registration_otp_dto_1.VerifyRegistrationOtpDto, Object, Object, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verifyRegistrationOtp", null);
__decorate([
    (0, common_1.Post)('login'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto, Object, Object, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('google'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [google_auth_dto_1.GoogleAuthDto, Object, Object, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "google", null);
__decorate([
    (0, common_1.Post)('refresh'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __param(2, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, common_1.Post)('logout'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Post)('logout-all'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __param(2, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logoutAll", null);
__decorate([
    (0, common_1.Post)('forgot-password'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_security_dto_1.ForgotPasswordDto, String]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "forgotPassword", null);
__decorate([
    (0, common_1.Post)('reset-password'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_security_dto_1.ResetPasswordDto, String]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "resetPassword", null);
__decorate([
    (0, common_1.Post)('verify-email'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_security_dto_1.VerifyEmailDto, String]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "verifyEmail", null);
__decorate([
    (0, common_1.Post)('resend-verification'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "resendVerification", null);
__decorate([
    (0, common_1.Post)('change-password'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, auth_security_dto_1.ChangePasswordDto, String]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "changePassword", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "me", null);
__decorate([
    (0, common_1.Patch)('locale'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_locale_dto_1.UpdateLocaleDto]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "updateLocale", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    (0, skip_subscription_decorator_1.SkipSubscription)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        config_1.ConfigService])
], AuthController);
