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
var ZaloMarketingPublicController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZaloMarketingPublicController = void 0;
const common_1 = require("@nestjs/common");
const zalo_marketing_service_1 = require("./zalo-marketing.service");
const zalo_oauth_service_1 = require("./zalo-oauth.service");
let ZaloMarketingPublicController = ZaloMarketingPublicController_1 = class ZaloMarketingPublicController {
    service;
    oauth;
    logger = new common_1.Logger(ZaloMarketingPublicController_1.name);
    constructor(service, oauth) {
        this.service = service;
        this.oauth = oauth;
    }
    async oauthCallback(code, state, oaId, error, errorDescription, errorReason, req, res) {
        let returnPath = '/zalo-marketing?tab=oa';
        const redirectUri = this.oauth.getRedirectUri();
        const appId = this.oauth.getAppId();
        const cookieValue = typeof req.cookies?.[zalo_oauth_service_1.ZALO_OA_OAUTH_COOKIE] === 'string'
            ? req.cookies[zalo_oauth_service_1.ZALO_OA_OAUTH_COOKIE]
            : undefined;
        try {
            if (error || !code) {
                const reason = [error, errorReason, errorDescription]
                    .filter(Boolean)
                    .join(' | ')
                    .slice(0, 200);
                this.logger.warn(`Zalo OA OAuth callback rejected appId=…${appId.slice(-6)} redirectUri=${redirectUri} reason=${reason || 'missing_code'} hasCookie=${Boolean(cookieValue)} hasState=${Boolean(state)}`);
                throw new Error(errorDescription || errorReason || error || 'OAuth bị hủy hoặc thiếu mã');
            }
            const payload = this.oauth.resolveCallbackSession(state, cookieValue);
            returnPath = payload.returnPath || returnPath;
            const result = await this.service.handleOAuthCallback(code, state, cookieValue, oaId);
            this.logger.log(`Zalo OA OAuth callback OK appId=…${appId.slice(-6)} redirectUri=${redirectUri} oa=…${String(result.oaId || oaId || '').slice(-6)} org=…${String(result.organizationId).slice(-6)}`);
            res.clearCookie(zalo_oauth_service_1.ZALO_OA_OAUTH_COOKIE, { path: '/' });
            res.redirect(result.redirectUrl);
        }
        catch (e) {
            const msg = e instanceof Error ? e.message : 'OAuth thất bại';
            this.logger.warn(`Zalo OA OAuth callback FAIL appId=…${appId.slice(-6)} redirectUri=${redirectUri} msg=${msg.slice(0, 160)}`);
            res.redirect(this.oauth.buildErrorRedirect(msg, returnPath));
        }
    }
    /** Safe public config for ops — no secrets */
    oauthConfig() {
        return this.oauth.getPublicConfig();
    }
};
exports.ZaloMarketingPublicController = ZaloMarketingPublicController;
__decorate([
    (0, common_1.Get)('oauth/callback'),
    __param(0, (0, common_1.Query)('code')),
    __param(1, (0, common_1.Query)('state')),
    __param(2, (0, common_1.Query)('oa_id')),
    __param(3, (0, common_1.Query)('error')),
    __param(4, (0, common_1.Query)('error_description')),
    __param(5, (0, common_1.Query)('error_reason')),
    __param(6, (0, common_1.Req)()),
    __param(7, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object, Object, Object, Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ZaloMarketingPublicController.prototype, "oauthCallback", null);
__decorate([
    (0, common_1.Get)('oauth/config'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ZaloMarketingPublicController.prototype, "oauthConfig", null);
exports.ZaloMarketingPublicController = ZaloMarketingPublicController = ZaloMarketingPublicController_1 = __decorate([
    (0, common_1.Controller)('zalo-marketing/public'),
    __metadata("design:paramtypes", [zalo_marketing_service_1.ZaloMarketingService,
        zalo_oauth_service_1.ZaloOAuthService])
], ZaloMarketingPublicController);
