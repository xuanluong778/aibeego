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
var ZaloOAuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZaloOAuthService = exports.ZALO_OA_OAUTH_CANONICAL_REDIRECT_URI = exports.ZALO_OA_OAUTH_CALLBACK_PATH = exports.ZALO_OA_OAUTH_COOKIE = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto_1 = require("crypto");
const shared_1 = require("@marketingspa/shared");
const assert_encryption_key_1 = require("../common/utils/assert-encryption-key");
const STATE_TTL_MS = 10 * 60 * 1000;
exports.ZALO_OA_OAUTH_COOKIE = 'zalo_oa_oauth';
/** Canonical production callback — must match Zalo Developer Console exactly. */
exports.ZALO_OA_OAUTH_CALLBACK_PATH = '/api/v1/zalo-marketing/public/oauth/callback';
exports.ZALO_OA_OAUTH_CANONICAL_REDIRECT_URI = 'https://aibeego.com/api/v1/zalo-marketing/public/oauth/callback';
let ZaloOAuthService = ZaloOAuthService_1 = class ZaloOAuthService {
    config;
    logger = new common_1.Logger(ZaloOAuthService_1.name);
    constructor(config) {
        this.config = config;
    }
    isConfigured() {
        return Boolean(this.getAppId() && this.getAppSecret() && this.getRedirectUri());
    }
    getAppId() {
        return (this.config.get('ZALO_APP_ID') ?? '').trim();
    }
    getAppSecret() {
        return (this.config.get('ZALO_APP_SECRET') ?? '').trim();
    }
    /**
     * PKCE optional. Zalo OA console often stores a static Code Challenge;
     * a random per-click challenge (or a huge `state`) is reported as -14003.
     * Default OFF so authorize URL matches working OA links: app_id + redirect_uri only.
     */
    isPkceEnabled() {
        const raw = (this.config.get('ZALO_OAUTH_PKCE') ?? 'false').trim().toLowerCase();
        return raw === '1' || raw === 'true' || raw === 'yes';
    }
    /**
     * Putting CSRF `state` on the Zalo authorize URL is optional.
     * Working OA links (EzyOA / Zalo docs samples) send only app_id + redirect_uri.
     * A 300+ char signed state is a known source of -14003 after Zalo login.
     */
    sendStateQuery() {
        const raw = (this.config.get('ZALO_OAUTH_SEND_STATE') ?? 'false').trim().toLowerCase();
        return raw === '1' || raw === 'true' || raw === 'yes';
    }
    /**
     * Single production redirect_uri source of truth.
     * Prefer ZALO_REDIRECT_URI (alias ZALO_OAUTH_REDIRECT_URI).
     * Production hard-fallback = canonical HTTPS callback (no trailing slash).
     */
    getRedirectUri() {
        const explicit = (this.config.get('ZALO_REDIRECT_URI') ??
            this.config.get('ZALO_OAUTH_REDIRECT_URI') ??
            '').trim();
        if (explicit) {
            return this.normalizeRedirectUri(explicit);
        }
        const nodeEnv = (this.config.get('NODE_ENV') ?? '').trim();
        if (nodeEnv === 'production') {
            return exports.ZALO_OA_OAUTH_CANONICAL_REDIRECT_URI;
        }
        const apiBase = (this.config.get('API_PUBLIC_URL') ?? '').trim() ||
            (this.config.get('NEXT_PUBLIC_API_URL') ?? '').trim() ||
            'http://localhost:4000';
        return this.normalizeRedirectUri(`${apiBase.replace(/\/$/, '')}${exports.ZALO_OA_OAUTH_CALLBACK_PATH}`);
    }
    normalizeRedirectUri(raw) {
        const trimmed = String(raw || '')
            .trim()
            .replace(/^['"]|['"]$/g, '')
            .replace(/[\r\n\t]/g, '');
        if (!trimmed)
            return '';
        try {
            const u = new URL(trimmed);
            if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
                u.pathname = u.pathname.replace(/\/+$/, '');
            }
            u.hash = '';
            u.search = '';
            return `${u.protocol}//${u.host}${u.pathname}`;
        }
        catch {
            return trimmed.replace(/\/+$/, '');
        }
    }
    getEncryptionKey() {
        return (0, assert_encryption_key_1.assertEncryptionKeyConfigured)(this.config.get('ENCRYPTION_KEY'));
    }
    createPkce() {
        const codeVerifier = (0, crypto_1.randomBytes)(32).toString('base64url');
        const codeChallenge = (0, crypto_1.createHash)('sha256').update(codeVerifier).digest('base64url');
        return { codeVerifier, codeChallenge };
    }
    /**
     * Build authorize query with encodeURIComponent (RFC 3986) — not URLSearchParams
     * (`+` encoding). Endpoint: /v4/oa/permission (OA), NOT /v4/permission (User Login).
     */
    buildAuthorizeUrl(params) {
        const parts = [
            `app_id=${encodeURIComponent(params.appId.trim())}`,
            `redirect_uri=${encodeURIComponent(params.redirectUri.trim())}`,
        ];
        if (params.state?.trim()) {
            parts.push(`state=${encodeURIComponent(params.state.trim())}`);
        }
        if (params.codeChallenge?.trim()) {
            parts.push(`code_challenge=${encodeURIComponent(params.codeChallenge.trim())}`);
            parts.push('code_challenge_method=S256');
        }
        return `https://oauth.zaloapp.com/v4/oa/permission?${parts.join('&')}`;
    }
    signPayload(payload) {
        const raw = JSON.stringify(payload);
        const sig = (0, crypto_1.createHmac)('sha256', this.getEncryptionKey()).update(raw).digest('hex');
        return Buffer.from(`${raw}:${sig}`).toString('base64url');
    }
    createPendingSession(params) {
        if (!this.isConfigured()) {
            throw new common_1.UnauthorizedException('Chưa cấu hình ZALO_APP_ID / ZALO_APP_SECRET / ZALO_REDIRECT_URI');
        }
        const redirectUri = this.getRedirectUri();
        const appId = this.getAppId();
        const usePkce = this.isPkceEnabled();
        const pkce = usePkce ? this.createPkce() : null;
        const ts = Date.now();
        const nonce = (0, crypto_1.randomBytes)(16).toString('hex');
        const payload = {
            userId: params.userId,
            organizationId: params.organizationId,
            returnPath: params.returnPath?.trim() || '/zalo-marketing?tab=oa',
            ts,
            nonce,
            ...(pkce ? { codeVerifier: pkce.codeVerifier } : {}),
        };
        const token = this.signPayload(payload);
        const sendState = this.sendStateQuery();
        const url = this.buildAuthorizeUrl({
            appId,
            redirectUri,
            state: sendState ? token : undefined,
            codeChallenge: pkce?.codeChallenge,
        });
        const built = new URL(url);
        const fromParams = built.searchParams.get('redirect_uri');
        if (fromParams !== redirectUri) {
            this.logger.error(`Zalo OA OAuth redirect_uri encode mismatch got=${fromParams} expected=${redirectUri}`);
            throw new common_1.UnauthorizedException('redirect_uri encode mismatch');
        }
        if (!built.pathname.endsWith('/oa/permission')) {
            throw new common_1.UnauthorizedException('Invalid OA OAuth endpoint');
        }
        this.logger.log(`Zalo OA OAuth start appId=…${appId.slice(-6)} redirectUri=${redirectUri} pkce=${usePkce} sendState=${sendState} urlLen=${url.length} org=…${params.organizationId.slice(-6)} authorize=${built.origin}${built.pathname}`);
        return {
            state: token,
            url,
            redirectUri,
            appIdMasked: `…${appId.slice(-6)}`,
            cookieValue: token,
            cookieName: exports.ZALO_OA_OAUTH_COOKIE,
        };
    }
    /** @deprecated use createPendingSession */
    createState(params) {
        return this.createPendingSession(params);
    }
    verifySignedToken(token) {
        let decoded;
        try {
            decoded = Buffer.from(token, 'base64url').toString('utf8');
        }
        catch {
            throw new common_1.UnauthorizedException('State OAuth không hợp lệ');
        }
        const sep = decoded.lastIndexOf(':');
        if (sep <= 0)
            throw new common_1.UnauthorizedException('State OAuth không hợp lệ');
        const raw = decoded.slice(0, sep);
        const sig = decoded.slice(sep + 1);
        const expected = (0, crypto_1.createHmac)('sha256', this.getEncryptionKey()).update(raw).digest('hex');
        const a = Buffer.from(sig);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !(0, crypto_1.timingSafeEqual)(a, b)) {
            throw new common_1.UnauthorizedException('State OAuth không hợp lệ');
        }
        const payload = JSON.parse(raw);
        if (!payload.userId || !payload.organizationId || !payload.nonce || !payload.ts) {
            throw new common_1.UnauthorizedException('State OAuth không hợp lệ');
        }
        if (this.isPkceEnabled() && !payload.codeVerifier) {
            throw new common_1.UnauthorizedException('State OAuth thiếu PKCE — hãy Kết nối OA lại');
        }
        if (Date.now() - payload.ts > STATE_TTL_MS) {
            throw new common_1.UnauthorizedException('State OAuth đã hết hạn');
        }
        return payload;
    }
    verifyState(state) {
        return this.verifySignedToken(state);
    }
    resolveCallbackSession(state, cookieValue) {
        if (state?.trim()) {
            return this.verifySignedToken(state.trim());
        }
        if (cookieValue?.trim()) {
            return this.verifySignedToken(cookieValue.trim());
        }
        throw new common_1.UnauthorizedException('Thiếu phiên OAuth — hãy bấm Kết nối OA lại');
    }
    async exchangeCode(code, codeVerifier) {
        const redirectUri = this.getRedirectUri();
        const appId = this.getAppId();
        this.logger.log(`Zalo OA OAuth exchange appId=…${appId.slice(-6)} redirectUri=${redirectUri} pkce=${Boolean(codeVerifier)}`);
        return (0, shared_1.exchangeZaloOaOAuthCode)({
            appId,
            appSecret: this.getAppSecret(),
            code,
            redirectUri,
            codeVerifier: codeVerifier || undefined,
        });
    }
    async refresh(refreshToken) {
        return (0, shared_1.refreshZaloOaAccessToken)({
            appId: this.getAppId(),
            appSecret: this.getAppSecret(),
            refreshToken,
        });
    }
    async fetchOaInfo(accessToken) {
        return (0, shared_1.fetchZaloOaInfo)(accessToken);
    }
    getPublicConfig() {
        const appId = this.getAppId();
        return {
            configured: this.isConfigured(),
            flow: 'oa/permission',
            authorizeHost: 'oauth.zaloapp.com',
            authorizePath: '/v4/oa/permission',
            redirectUri: this.getRedirectUri(),
            appIdMasked: appId ? `…${appId.slice(-6)}` : null,
            pkce: this.isPkceEnabled(),
            sendState: this.sendStateQuery(),
        };
    }
    buildSuccessRedirect(returnPath) {
        const appUrl = (this.config.get('APP_URL') ??
            this.config.get('NEXT_PUBLIC_APP_URL') ??
            'http://localhost:3000').replace(/\/$/, '');
        const path = returnPath?.startsWith('/') ? returnPath : '/zalo-marketing?tab=oa';
        const join = path.includes('?') ? '&' : '?';
        return `${appUrl}${path}${join}oauth=success`;
    }
    buildErrorRedirect(message, returnPath) {
        const appUrl = (this.config.get('APP_URL') ??
            this.config.get('NEXT_PUBLIC_APP_URL') ??
            'http://localhost:3000').replace(/\/$/, '');
        const path = returnPath?.startsWith('/') ? returnPath : '/zalo-marketing?tab=oa';
        const join = path.includes('?') ? '&' : '?';
        return `${appUrl}${path}${join}oauth=error&msg=${encodeURIComponent(message.slice(0, 160))}`;
    }
};
exports.ZaloOAuthService = ZaloOAuthService;
exports.ZaloOAuthService = ZaloOAuthService = ZaloOAuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], ZaloOAuthService);
