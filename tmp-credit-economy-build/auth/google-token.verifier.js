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
exports.GoogleTokenVerifier = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const google_auth_library_1 = require("google-auth-library");
let GoogleTokenVerifier = class GoogleTokenVerifier {
    config;
    client = null;
    constructor(config) {
        this.config = config;
    }
    getClient() {
        if (!this.client) {
            this.client = new google_auth_library_1.OAuth2Client();
        }
        return this.client;
    }
    getAudience() {
        const clientId = (this.config.get('GOOGLE_CLIENT_ID') || '').trim();
        if (!clientId) {
            throw new common_1.UnauthorizedException('Google Sign-In chưa được cấu hình trên server');
        }
        return clientId;
    }
    async verifyIdToken(idToken) {
        const audience = this.getAudience();
        let payload;
        try {
            const ticket = await this.getClient().verifyIdToken({
                idToken,
                audience,
            });
            payload = ticket.getPayload();
        }
        catch {
            throw new common_1.UnauthorizedException('Google token không hợp lệ hoặc đã hết hạn');
        }
        if (!payload?.sub || !payload.email) {
            throw new common_1.UnauthorizedException('Google token thiếu thông tin người dùng');
        }
        // Chống token giả / chưa verify email
        if (payload.email_verified !== true) {
            throw new common_1.UnauthorizedException('Email Google chưa được xác minh');
        }
        if (payload.aud !== audience) {
            throw new common_1.UnauthorizedException('Google token không thuộc ứng dụng này');
        }
        return {
            googleSub: payload.sub,
            email: payload.email.toLowerCase().trim(),
            emailVerified: true,
            name: (payload.name || payload.email.split('@')[0] || 'Google User').trim(),
            avatarUrl: payload.picture?.trim() || null,
        };
    }
};
exports.GoogleTokenVerifier = GoogleTokenVerifier;
exports.GoogleTokenVerifier = GoogleTokenVerifier = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GoogleTokenVerifier);
