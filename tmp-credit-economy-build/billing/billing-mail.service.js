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
var BillingMailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingMailService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const nodemailer_1 = __importDefault(require("nodemailer"));
let BillingMailService = BillingMailService_1 = class BillingMailService {
    config;
    logger = new common_1.Logger(BillingMailService_1.name);
    transporter = null;
    constructor(config) {
        this.config = config;
    }
    smtpConfigured() {
        return Boolean((this.config.get('SMTP_HOST') || '').trim() &&
            (this.config.get('SMTP_USER') || '').trim() &&
            (this.config.get('SMTP_PASS') || '').trim());
    }
    getTransporter() {
        if (this.transporter)
            return this.transporter;
        const host = (this.config.get('SMTP_HOST') || '').trim();
        const port = Number(this.config.get('SMTP_PORT') || '587');
        const user = (this.config.get('SMTP_USER') || '').trim();
        const pass = (this.config.get('SMTP_PASS') || '').replace(/\s+/g, '');
        this.transporter = nodemailer_1.default.createTransport({
            host,
            port,
            secure: port === 465,
            auth: { user, pass },
        });
        return this.transporter;
    }
    fromAddress() {
        const user = (this.config.get('SMTP_USER') || '').trim();
        const configured = (this.config.get('SMTP_FROM') || '').trim();
        if (configured && user && configured.toLowerCase().includes(user.toLowerCase())) {
            return configured;
        }
        return user ? `MarketingSpa <${user}>` : configured || 'thegioimarketingdigi@gmail.com';
    }
    async sendPaymentSuccess(params) {
        const subject = `Thanh toán thành công — ${params.orderCode}`;
        const amount = params.amountVnd.toLocaleString('vi-VN');
        const end = params.periodEnd.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        const text = [
            `Xin chào ${params.name},`,
            '',
            `Thanh toán đơn ${params.orderCode} đã thành công.`,
            `Gói: ${params.planName}`,
            `Số tiền: ${amount}đ`,
            `Hạn sử dụng đến: ${end}`,
            '',
            'Cảm ơn bạn đã sử dụng MarketingSpa.',
        ].join('\n');
        if (!this.smtpConfigured()) {
            this.logger.warn(`[billing-mail:dev] ${subject} → ${params.email}`);
            this.logger.log(text);
            return;
        }
        try {
            await this.getTransporter().sendMail({
                from: this.fromAddress(),
                to: params.email,
                subject,
                text,
            });
            this.logger.log(`[billing-mail:sent] ${params.email} ${params.orderCode}`);
        }
        catch (e) {
            this.logger.error(`[billing-mail:fail] ${params.email} ${e instanceof Error ? e.message : String(e)}`);
        }
    }
};
exports.BillingMailService = BillingMailService;
exports.BillingMailService = BillingMailService = BillingMailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], BillingMailService);
