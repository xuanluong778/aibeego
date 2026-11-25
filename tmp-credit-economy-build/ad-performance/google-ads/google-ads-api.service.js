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
var GoogleAdsApiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleAdsApiService = exports.GoogleAdsRequestError = exports.GoogleAdsPermissionError = exports.GoogleAdsTwoFactorError = exports.GoogleAdsTokenExpiredError = exports.GoogleAdsRateLimitError = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const shared_1 = require("@marketingspa/shared");
const assert_google_ads_oauth_1 = require("./assert-google-ads-oauth");
class GoogleAdsRateLimitError extends Error {
    retryAfterMs;
    parsed;
    constructor(message, retryAfterMs, parsed) {
        super(message);
        this.retryAfterMs = retryAfterMs;
        this.parsed = parsed;
        this.name = 'GoogleAdsRateLimitError';
    }
}
exports.GoogleAdsRateLimitError = GoogleAdsRateLimitError;
class GoogleAdsTokenExpiredError extends Error {
    parsed;
    constructor(message, parsed) {
        super(message);
        this.parsed = parsed;
        this.name = 'GoogleAdsTokenExpiredError';
    }
}
exports.GoogleAdsTokenExpiredError = GoogleAdsTokenExpiredError;
class GoogleAdsTwoFactorError extends Error {
    parsed;
    constructor(message, parsed) {
        super(message);
        this.parsed = parsed;
        this.name = 'GoogleAdsTwoFactorError';
    }
}
exports.GoogleAdsTwoFactorError = GoogleAdsTwoFactorError;
class GoogleAdsPermissionError extends Error {
    parsed;
    constructor(message, parsed) {
        super(message);
        this.parsed = parsed;
        this.name = 'GoogleAdsPermissionError';
    }
}
exports.GoogleAdsPermissionError = GoogleAdsPermissionError;
/** Non-classified Google Ads API failure with structured details for the client. */
class GoogleAdsRequestError extends Error {
    parsed;
    constructor(message, parsed) {
        super(message);
        this.parsed = parsed;
        this.name = 'GoogleAdsRequestError';
    }
}
exports.GoogleAdsRequestError = GoogleAdsRequestError;
const ADWORDS_SCOPE = 'https://www.googleapis.com/auth/adwords';
let GoogleAdsApiService = GoogleAdsApiService_1 = class GoogleAdsApiService {
    config;
    logger = new common_1.Logger(GoogleAdsApiService_1.name);
    constructor(config) {
        this.config = config;
    }
    buildOAuthUrl(state) {
        const clientId = this.requireClientId();
        const redirectUri = this.requireRedirectUri();
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: ADWORDS_SCOPE,
            access_type: 'offline',
            prompt: 'consent',
            include_granted_scopes: 'true',
            state,
        });
        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }
    async exchangeCodeForTokens(code) {
        const body = new URLSearchParams({
            code,
            client_id: this.requireClientId(),
            client_secret: this.requireClientSecret(),
            redirect_uri: this.requireRedirectUri(),
            grant_type: 'authorization_code',
        });
        const res = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
            body: body.toString(),
        });
        const json = (await res.json());
        if (!res.ok || !json.access_token) {
            const msg = json.error_description ?? json.error ?? 'google_oauth_exchange_failed';
            this.logger.warn(`Google OAuth exchange failed: ${msg.slice(0, 120)}`);
            throw new common_1.BadRequestException('Không đổi được mã OAuth Google Ads');
        }
        const scope = (json.scope ?? '').trim();
        if (scope && !scope.includes('adwords')) {
            this.logger.warn(`Google OAuth missing adwords scope; granted=${scope.slice(0, 200)}`);
            throw new common_1.BadRequestException('OAuth thiếu scope Google Ads (adwords). Bấm Kết nối lại Google và chấp nhận quyền Quảng cáo.');
        }
        return {
            accessToken: json.access_token,
            refreshToken: json.refresh_token,
            expiresIn: json.expires_in,
            scope: scope || ADWORDS_SCOPE,
        };
    }
    async refreshAccessToken(refreshToken) {
        const body = new URLSearchParams({
            client_id: this.requireClientId(),
            client_secret: this.requireClientSecret(),
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        });
        const res = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
            body: body.toString(),
        });
        const json = (await res.json());
        if (!res.ok || !json.access_token) {
            const msg = json.error_description ?? json.error ?? 'oauth_refresh_failed';
            if ((0, shared_1.isGoogleAdsInvalidGrant)(json.error, json.error_description)) {
                throw new GoogleAdsTokenExpiredError('Google refresh token hết hạn hoặc bị thu hồi');
            }
            throw new Error(msg);
        }
        return json.access_token;
    }
    async listAccessibleCustomers(accessToken) {
        const res = await fetch(`https://googleads.googleapis.com/${this.apiVersion()}/customers:listAccessibleCustomers`, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${accessToken}`,
                'developer-token': this.requireDeveloperToken(),
            },
        });
        const body = await this.parseGoogleJson(res);
        if (!res.ok || body.error) {
            this.throwNormalized(res.status, body, res.headers);
        }
        return (0, shared_1.parseListAccessibleCustomerIds)(body.resourceNames);
    }
    async getCustomerDetail(accessToken, customerId, loginCustomerId) {
        const cid = (0, shared_1.normalizeGoogleCustomerId)(customerId);
        const query = 'SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.manager FROM customer LIMIT 1';
        const body = await this.search(accessToken, cid, query, loginCustomerId);
        const customer = body.results?.[0]?.customer;
        return {
            id: cid,
            name: customer?.descriptiveName?.trim() || cid,
            currency: customer?.currencyCode ?? 'USD',
            timezone: customer?.timeZone ?? 'UTC',
            isManager: Boolean(customer?.manager),
        };
    }
    async listCustomerClients(accessToken, managerCustomerId) {
        const mid = (0, shared_1.normalizeGoogleCustomerId)(managerCustomerId);
        const query = [
            'SELECT',
            'customer_client.client_customer,',
            'customer_client.descriptive_name,',
            'customer_client.currency_code,',
            'customer_client.time_zone,',
            'customer_client.manager,',
            'customer_client.status',
            'FROM customer_client',
            "WHERE customer_client.status != 'CANCELED'",
        ].join(' ');
        const body = await this.search(accessToken, mid, query, mid);
        const items = [];
        for (const row of body.results ?? []) {
            const cc = row.customerClient;
            const id = (0, shared_1.normalizeGoogleCustomerId)(String(cc?.clientCustomer ?? '').replace(/^customers\//i, ''));
            if (!id || id === mid)
                continue;
            items.push({
                customerId: id,
                name: cc?.descriptiveName?.trim() || id,
                currency: cc?.currencyCode ?? 'USD',
                timezone: cc?.timeZone ?? 'UTC',
                isManager: Boolean(cc?.manager),
            });
        }
        return items;
    }
    async search(accessToken, customerId, query, loginCustomerId) {
        const cid = (0, shared_1.normalizeGoogleCustomerId)(customerId);
        const res = await fetch(`https://googleads.googleapis.com/${this.apiVersion()}/customers/${cid}/googleAds:search`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
                'developer-token': this.requireDeveloperToken(),
                ...(0, shared_1.googleAdsLoginHeaders)(cid, loginCustomerId),
            },
            body: JSON.stringify({ query }),
        });
        const body = await this.parseGoogleJson(res);
        if (!res.ok || body.error) {
            this.throwNormalized(res.status, body, res.headers);
        }
        return body;
    }
    async parseGoogleJson(res) {
        const text = await res.text();
        try {
            return JSON.parse(text);
        }
        catch {
            const requestId = res.headers.get('request-id') ?? res.headers.get('x-request-id');
            this.logger.warn(`Google Ads non-JSON response status=${res.status} apiVersion=${this.apiVersion()} requestId=${requestId ?? '-'}`);
            const parsed = (0, shared_1.parseGoogleAdsErrorResponse)({
                httpStatus: res.status,
                body: {
                    error: {
                        status: res.status === 404 ? 'NOT_FOUND' : 'UNKNOWN',
                        message: `Google Ads non-JSON response (${res.status})`,
                    },
                },
                requestIdHeader: requestId,
            });
            throw new GoogleAdsRequestError((0, shared_1.formatGoogleAdsUserMessage)(parsed), parsed);
        }
    }
    throwNormalized(status, body, headers) {
        const requestIdHeader = headers.get('request-id') ?? headers.get('x-request-id');
        const parsed = (0, shared_1.parseGoogleAdsErrorResponse)({
            httpStatus: status,
            body,
            requestIdHeader,
        });
        this.logger.warn(`Google Ads API error ${(0, shared_1.formatGoogleAdsLogLine)(parsed, this.apiVersion())}`);
        const userMsg = (0, shared_1.formatGoogleAdsUserMessage)(parsed);
        if (parsed.classification === 'two_factor' ||
            (0, shared_1.isGoogleAdsTwoFactorMessage)(parsed.message) ||
            (0, shared_1.isGoogleAdsTwoFactorMessage)(parsed.errorCode ?? '')) {
            throw new GoogleAdsTwoFactorError('Tài khoản Google Ads yêu cầu xác minh 2 bước — bật 2FA rồi kết nối lại', parsed);
        }
        if (parsed.classification === 'rate_limit' || status === 429) {
            const retryAfterMs = (() => {
                const h = headers.get('retry-after');
                return h ? Math.max(1_000, Number(h) * 1000 || 30_000) : 30_000;
            })();
            throw new GoogleAdsRateLimitError('Google Ads rate limit', retryAfterMs, parsed);
        }
        if (parsed.classification === 'auth' || status === 401) {
            throw new GoogleAdsTokenExpiredError('Google Ads token hết hạn — kết nối lại OAuth', parsed);
        }
        if (parsed.classification === 'permission' ||
            parsed.classification === 'developer_token' ||
            parsed.classification === 'customer' ||
            status === 403) {
            throw new GoogleAdsPermissionError(userMsg, parsed);
        }
        throw new GoogleAdsRequestError(userMsg, parsed);
    }
    apiVersion() {
        return this.config.get('GOOGLE_ADS_API_VERSION') ?? 'v22';
    }
    requireClientId() {
        const id = this.config.get('GOOGLE_CLIENT_ID')?.trim();
        if (!id)
            throw new common_1.BadRequestException('GOOGLE_CLIENT_ID chưa cấu hình');
        return id;
    }
    requireClientSecret() {
        const s = this.config.get('GOOGLE_CLIENT_SECRET')?.trim();
        if (!s)
            throw new common_1.BadRequestException('GOOGLE_CLIENT_SECRET chưa cấu hình');
        return s;
    }
    requireDeveloperToken() {
        const t = this.config.get('GOOGLE_ADS_DEVELOPER_TOKEN')?.trim();
        if (!t)
            throw new common_1.BadRequestException('GOOGLE_ADS_DEVELOPER_TOKEN chưa cấu hình');
        return t;
    }
    requireRedirectUri() {
        return (0, assert_google_ads_oauth_1.resolveGoogleAdsRedirectUri)((key) => this.config.get(key));
    }
};
exports.GoogleAdsApiService = GoogleAdsApiService;
exports.GoogleAdsApiService = GoogleAdsApiService = GoogleAdsApiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GoogleAdsApiService);
