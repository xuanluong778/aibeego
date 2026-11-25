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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var AuthMailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthMailService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nodemailer_1 = __importDefault(require("nodemailer"));
let AuthMailService = AuthMailService_1 = class AuthMailService {
    config;
    logger = new common_1.Logger(AuthMailService_1.name);
    transporter = null;
    constructor(config) {
        this.config = config;
    }
    smtpConfigured() {
        return Boolean((this.config.get('SMTP_HOST') || '').trim() &&
            (this.config.get('SMTP_USER') || '').trim() &&
            (this.config.get('SMTP_PASS') || '').trim());
    }
    /** Gmail App Password thường hiện có khoảng trắng — bỏ khoảng trắng khi auth */
    smtpPass() {
        return (this.config.get('SMTP_PASS') || '').replace(/\s+/g, '');
    }
    getTransporter() {
        if (this.transporter)
            return this.transporter;
        const host = (this.config.get('SMTP_HOST') || '').trim();
        const port = Number(this.config.get('SMTP_PORT') || '587');
        const user = (this.config.get('SMTP_USER') || '').trim();
        const pass = this.smtpPass();
        this.transporter = nodemailer_1.default.createTransport({
            host,
            port,
            secure: port === 465,
            auth: { user, pass },
        });
        return this.transporter;
    }
    fromAddress() {
        const configured = (this.config.get('SMTP_FROM') || '').trim();
        const user = (this.config.get('SMTP_USER') || '').trim();
        // Gmail yêu cầu From trùng (hoặc alias của) tài khoản đăng nhập SMTP
        if (configured && user && configured.toLowerCase().includes(user.toLowerCase())) {
            return configured;
        }
        if (user)
            return `MarketingSpa <${user}>`;
        return configured || 'thegioimarketingdigi@gmail.com';
    }
    /** Gửi email xác minh / đặt lại mật khẩu. */
    async sendActionLink(type, email, token) {
        const appUrl = (this.config.get('APP_URL') ?? 'http://localhost:3000').replace(/\/$/, '');
        const path = type === 'verify-email'
            ? `/verify-email?token=${encodeURIComponent(token)}`
            : `/reset-password?token=${encodeURIComponent(token)}`;
        const link = `${appUrl}${path}`;
        const subject = type === 'verify-email' ? 'Xác minh email MarketingSpa' : 'Đặt lại mật khẩu MarketingSpa';
        const text = `Xin chào,\n\nMở liên kết sau (có hiệu lực giới hạn):\n${link}\n\nNếu bạn không yêu cầu, hãy bỏ qua email này.`;
        await this.dispatch(email, subject, text);
    }
    async sendRegistrationOtp(email, otp, name) {
        const subject = 'Mã OTP đăng ký MarketingSpa';
        const text = [
            `Xin chào ${name},`,
            '',
            `Mã OTP đăng ký của bạn là: ${otp}`,
            'Mã có hiệu lực trong 5 phút và chỉ dùng một lần.',
            '',
            'Nếu bạn không yêu cầu đăng ký, hãy bỏ qua email này.',
        ].join('\n');
        const html = `
      <p>Xin chào <strong>${escapeHtml(name)}</strong>,</p>
      <p>Mã OTP đăng ký MarketingSpa của bạn:</p>
      <p style="font-size:28px;letter-spacing:8px;font-weight:700">${escapeHtml(otp)}</p>
      <p>Mã có hiệu lực trong <strong>5 phút</strong> và chỉ dùng một lần.</p>
      <p style="color:#666">Nếu bạn không yêu cầu đăng ký, hãy bỏ qua email này.</p>
    `;
        await this.dispatch(email, subject, text, { html, debugOtp: otp, requireSmtp: true });
    }
    async dispatch(email, subject, text, opts) {
        const allowDevFallback = (this.config.get('AUTH_OTP_DEV_FALLBACK') || '').trim() === 'true' ||
            (this.config.get('NODE_ENV') || '').trim() === 'development';
        if (!this.smtpConfigured()) {
            if (opts?.requireSmtp && !allowDevFallback) {
                this.logger.error(`[mail] SMTP chưa cấu hình — không thể gửi OTP tới ${email}`);
                throw new common_1.ServiceUnavailableException('Hệ thống chưa cấu hình gửi email. Vui lòng thử lại sau hoặc liên hệ hỗ trợ.');
            }
            this.logger.warn(`[mail:dev-fallback] SMTP chưa cấu hình — to=${email} subject=${subject}` +
                (opts?.debugOtp ? ` otp=${opts.debugOtp}` : ''));
            this.logger.log(text);
            return;
        }
        try {
            await this.getTransporter().sendMail({
                from: this.fromAddress(),
                to: email,
                subject,
                text,
                html: opts?.html,
            });
            this.logger.log(`[mail:sent] to=${email} subject=${subject}`);
        }
        catch (e) {
            this.logger.error(`[mail:fail] to=${email} ${e instanceof Error ? e.message : String(e)}`);
            throw new common_1.ServiceUnavailableException('Không gửi được email OTP. Vui lòng thử lại sau hoặc kiểm tra cấu hình SMTP.');
        }
    }
};
exports.AuthMailService = AuthMailService;
exports.AuthMailService = AuthMailService = AuthMailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AuthMailService);
function escapeHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
