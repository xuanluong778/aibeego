"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MARKETINGAUTOAZ_GOOGLE_ADS_OAUTH_REDIRECT_URI = void 0;
exports.resolveGoogleAdsRedirectUri = resolveGoogleAdsRedirectUri;
const common_1 = require("@nestjs/common");
/** Production callback — single source of truth for authorize + token exchange. */
exports.MARKETINGAUTOAZ_GOOGLE_ADS_OAUTH_REDIRECT_URI = 'https://aibeego.com/api/v1/ad-performance/google/oauth/callback';
function resolveGoogleAdsRedirectUri(get) {
    const raw = get('GOOGLE_ADS_REDIRECT_URI')?.trim();
    if (!raw) {
        throw new common_1.BadRequestException('GOOGLE_ADS_REDIRECT_URI chưa cấu hình');
    }
    const uri = raw.replace(/\/+$/, '');
    if (!/^https:\/\//i.test(uri) && process.env.NODE_ENV === 'production') {
        throw new common_1.BadRequestException('GOOGLE_ADS_REDIRECT_URI phải dùng HTTPS trên production');
    }
    if (uri.includes('/ai-ads-manager/google/oauth/callback')) {
        throw new common_1.BadRequestException('GOOGLE_ADS_REDIRECT_URI phải là /ad-performance/google/oauth/callback (callback handler thật)');
    }
    const appUrl = (get('APP_URL') ?? '').replace(/\/+$/, '');
    if (process.env.NODE_ENV === 'production' &&
        (appUrl.includes('aibeego.com') || appUrl.includes('marketingautoaz.com')) &&
        uri !== exports.MARKETINGAUTOAZ_GOOGLE_ADS_OAUTH_REDIRECT_URI) {
        throw new common_1.BadRequestException(`GOOGLE_ADS_REDIRECT_URI production phải là ${exports.MARKETINGAUTOAZ_GOOGLE_ADS_OAUTH_REDIRECT_URI}`);
    }
    return uri;
}
