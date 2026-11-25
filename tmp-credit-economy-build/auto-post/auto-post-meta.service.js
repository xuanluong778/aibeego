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
var AutoPostMetaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoPostMetaService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const auto_post_meta_pages_util_1 = require("./auto-post-meta-pages.util");
const auto_post_config_1 = require("./auto-post-config");
const assert_auto_post_meta_oauth_1 = require("./assert-auto-post-meta-oauth");
const auto_post_media_util_1 = require("./auto-post-media.util");
const auto_post_publish_errors_1 = require("./auto-post-publish-errors");
const meta_graph_http_1 = require("./meta-graph-http");
const meta_graph_usage_service_1 = require("./meta-graph-usage.service");
let AutoPostMetaService = AutoPostMetaService_1 = class AutoPostMetaService {
    config;
    usage;
    logger = new common_1.Logger(AutoPostMetaService_1.name);
    constructor(config, usage) {
        this.config = config;
        this.usage = usage;
    }
    env(key) {
        return this.config.get(key) ?? process.env[key];
    }
    get apiVersion() {
        return this.env('META_API_VERSION') ?? 'v21.0';
    }
    get appId() {
        const id = (0, auto_post_config_1.resolveMetaAppId)((k) => this.env(k));
        if (!id)
            throw new Error('META_APP_ID / FACEBOOK_APP_ID chưa cấu hình');
        return id;
    }
    get appSecret() {
        const secret = (0, auto_post_config_1.resolveMetaAppSecret)((k) => this.env(k));
        if (!secret)
            throw new Error('META_APP_SECRET / FACEBOOK_APP_SECRET chưa cấu hình');
        return secret;
    }
    get loginConfigId() {
        return (0, auto_post_config_1.resolveMetaLoginConfigId)((k) => this.env(k));
    }
    get redirectUri() {
        return (0, assert_auto_post_meta_oauth_1.resolveAutoPostOAuthRedirectUri)((k) => this.env(k));
    }
    /** Fail-fast App ID / config_id / redirect Ai Bee Go trước khi build OAuth URL. */
    assertProductionOAuthConfig() {
        return (0, assert_auto_post_meta_oauth_1.assertAutoPostMetaOAuthConfig)((k) => this.env(k));
    }
    getOAuthScopes() {
        return (0, auto_post_config_1.resolveAutoPostMetaScopes)((k) => this.env(k));
    }
    /**
     * Facebook Login for Business (app Business) — chỉ dùng config_id.
     * Không truyền scope=pages_* kèm config_id: Meta sẽ báo "Invalid Scopes".
     * Quyền Pages phải khai trong Login Configuration trên Meta Developer.
     * Standard Login (không có config_id) vẫn dùng scope như cũ.
     */
    buildOAuthUrl(state) {
        const asserted = this.assertProductionOAuthConfig();
        const params = new URLSearchParams({
            client_id: asserted.appId,
            redirect_uri: asserted.redirectUri,
            state,
            response_type: 'code',
            display: 'page',
            auth_type: 'rerequest',
            return_scopes: 'true',
        });
        const configId = asserted.loginConfigId || this.loginConfigId;
        if (configId) {
            params.set('config_id', configId);
            const overrideDefault = (this.env('META_LOGIN_OVERRIDE_DEFAULT_RESPONSE_TYPE') ?? '')
                .trim()
                .toLowerCase() === 'true';
            if (overrideDefault) {
                params.set('override_default_response_type', 'true');
            }
            // Mặc định KHÔNG append scope khi có config_id (tránh Invalid Scopes).
            // Chỉ bật META_OAUTH_APPEND_SCOPES=true nếu Configuration là loại hỗ trợ thêm scope.
            const appendScopes = (this.env('META_OAUTH_APPEND_SCOPES') ?? 'false').trim().toLowerCase() === 'true';
            if (appendScopes) {
                params.set('scope', this.getOAuthScopes().join(','));
            }
        }
        else {
            params.set('scope', this.getOAuthScopes().join(','));
        }
        return `https://www.facebook.com/${this.apiVersion}/dialog/oauth?${params.toString()}`;
    }
    async exchangeCodeForToken(code) {
        const params = new URLSearchParams({
            client_id: this.appId,
            client_secret: this.appSecret,
            redirect_uri: this.redirectUri,
            code,
        });
        return this.getJson(`https://graph.facebook.com/${this.apiVersion}/oauth/access_token?${params.toString()}`);
    }
    async exchangeForLongLivedToken(shortLivedToken) {
        const params = new URLSearchParams({
            grant_type: 'fb_exchange_token',
            client_id: this.appId,
            client_secret: this.appSecret,
            fb_exchange_token: shortLivedToken,
        });
        return this.getJson(`https://graph.facebook.com/${this.apiVersion}/oauth/access_token?${params.toString()}`);
    }
    async getMe(accessToken) {
        return this.getJson(`https://graph.facebook.com/${this.apiVersion}/me?fields=id,name`, accessToken);
    }
    async getGrantedPermissions(accessToken) {
        const rows = await this.getPermissionStatuses(accessToken);
        return rows.filter((r) => r.status === 'granted').map((r) => r.permission);
    }
    /** Toàn bộ /me/permissions (granted + declined) — không log token. */
    async getPermissionStatuses(accessToken) {
        const data = await this.getJson(`https://graph.facebook.com/${this.apiVersion}/me/permissions`, accessToken);
        return (data.data ?? [])
            .filter((row) => Boolean(row.permission))
            .map((row) => {
            const statusRaw = String(row.status ?? '').toLowerCase();
            const status = statusRaw === 'granted'
                ? 'granted'
                : statusRaw === 'declined'
                    ? 'declined'
                    : statusRaw === 'expired'
                        ? 'expired'
                        : 'unknown';
            return { permission: row.permission, status };
        });
    }
    /** Quyền thực tế: union /me/permissions + debug_token.scopes. */
    async resolveGrantedScopes(accessToken) {
        const [fromPermissions, debug] = await Promise.all([
            this.getGrantedPermissions(accessToken).catch(() => []),
            this.debugToken(accessToken).catch(() => ({ is_valid: false, scopes: [] })),
        ]);
        return (0, auto_post_meta_pages_util_1.mergeGrantedScopes)(fromPermissions, debug.scopes);
    }
    /**
     * Chẩn đoán quyền sau OAuth — log an toàn tên + status, không log token.
     * Trả về granted + declined + missing required.
     */
    async diagnoseUserPermissions(accessToken) {
        const permissions = await this.getPermissionStatuses(accessToken).catch(() => []);
        const debug = await this.debugToken(accessToken).catch(() => ({
            is_valid: false,
            scopes: [],
        }));
        const grantedSet = new Set(permissions.filter((p) => p.status === 'granted').map((p) => p.permission));
        for (const s of debug.scopes ?? []) {
            if (s && !grantedSet.has(s)) {
                grantedSet.add(s);
                permissions.push({ permission: s, status: 'granted' });
            }
        }
        const granted = [...grantedSet];
        const declined = permissions
            .filter((p) => p.status === 'declined')
            .map((p) => p.permission);
        const missingRequired = (0, auto_post_meta_pages_util_1.missingRequiredPageScopes)(granted);
        this.logger.log(`Meta permissions diag granted=[${granted.join(',')}] declined=[${declined.join(',')}] missing=[${missingRequired.join(',')}]`);
        return { permissions, granted, declined, missingRequired };
    }
    /** Lấy toàn bộ Fanpage user quản trị — pagination, fields id/name/access_token/tasks. */
    async getManagedPages(accessToken) {
        return (0, auto_post_meta_pages_util_1.fetchAllManagedPages)((url) => this.getJson(url, accessToken), this.apiVersion);
    }
    async publishPagePost(pageId, pageAccessToken, payload) {
        const media = (0, auto_post_media_util_1.normalizePublishMedia)({
            imageUrl: payload.imageUrl,
            linkUrl: payload.link,
        });
        if (media.note) {
            this.logger.log(`publish media normalize: ${media.note}`);
        }
        let published;
        if (media.imageUrl) {
            const params = new URLSearchParams({
                url: media.imageUrl,
                caption: payload.message,
                published: 'true',
                access_token: pageAccessToken,
            });
            const res = await fetch(`https://graph.facebook.com/${this.apiVersion}/${pageId}/photos?${params.toString()}`, { method: 'POST' });
            published = await this.parsePublishResponse(res);
        }
        else {
            const body = {
                message: payload.message,
                published: 'true',
                access_token: pageAccessToken,
            };
            if (media.linkUrl) {
                body.link = media.linkUrl;
            }
            const res = await fetch(`https://graph.facebook.com/${this.apiVersion}/${pageId}/feed`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            published = await this.parsePublishResponse(res);
        }
        const permalinkUrl = await this.fetchPostPermalink(published.id, pageAccessToken);
        return { ...published, permalinkUrl };
    }
    /** Lấy permalink công khai — page id trên URL thường khác Graph page id. */
    async fetchPostPermalink(postId, pageAccessToken) {
        try {
            const url = `https://graph.facebook.com/${this.apiVersion}/${encodeURIComponent(postId)}` +
                `?fields=permalink_url,is_published` +
                `&access_token=${encodeURIComponent(pageAccessToken)}`;
            const res = await fetch(url);
            const body = (await res.json());
            if (!res.ok || body.error) {
                this.logger.warn(`fetch permalink failed for ${postId}: ${body.error?.message || res.status}`);
                return null;
            }
            if (body.is_published === false) {
                this.logger.warn(`Meta post ${postId} is_published=false`);
            }
            return body.permalink_url?.trim() || null;
        }
        catch (err) {
            this.logger.warn(`fetch permalink error: ${err instanceof Error ? err.message : String(err)}`);
            return null;
        }
    }
    /**
     * Kiểm tra bài còn trên Fanpage không.
     * - exists: Graph trả về id
     * - deleted: object không còn
     * - unknown: lỗi mạng / token hết hạn — không được xóa bản ghi local
     *
     * Lưu ý: bài đã xóa thường trả OAuthException code 10 + "does not exist"
     * (không phải chỉ code 100). Không được coi mọi OAuthException là unknown.
     */
    async checkFacebookPostExists(postId, pageAccessToken) {
        const id = postId?.trim();
        if (!id)
            return 'unknown';
        try {
            const url = `https://graph.facebook.com/${this.apiVersion}/${encodeURIComponent(id)}` +
                `?fields=id` +
                `&access_token=${encodeURIComponent(pageAccessToken)}`;
            const res = await fetch(url);
            const body = (await res.json());
            if (res.ok && body.id && !body.error)
                return 'exists';
            const code = body.error?.code;
            const subcode = body.error?.error_subcode;
            const msg = (body.error?.message || '').toLowerCase();
            // Token hết hạn / invalid — giữ bản ghi local
            if (code === 190)
                return 'unknown';
            // Rate limit
            if (code === 4 || code === 17 || code === 32 || res.status === 429)
                return 'unknown';
            if (code === 10 ||
                code === 100 ||
                subcode === 33 ||
                msg.includes('does not exist') ||
                msg.includes('unsupported get request')) {
                return 'deleted';
            }
            this.logger.warn(`checkFacebookPostExists unknown for ${id}: ${body.error?.message || res.status}`);
            return 'unknown';
        }
        catch (err) {
            this.logger.warn(`checkFacebookPostExists error: ${err instanceof Error ? err.message : String(err)}`);
            return 'unknown';
        }
    }
    /**
     * Danh sách id bài còn trên Fanpage (published_posts).
     * Tin cậy hơn GET từng post (GET hay trả code 10 mơ hồ).
     * Trả null nếu API lỗi — caller không được purge.
     */
    async listPublishedPostIds(pageId, pageAccessToken, sinceUnix) {
        const id = pageId?.trim();
        if (!id || !pageAccessToken)
            return null;
        const found = new Set();
        let nextUrl = `https://graph.facebook.com/${this.apiVersion}/${encodeURIComponent(id)}/published_posts` +
            `?fields=id` +
            `&since=${Math.max(0, Math.floor(sinceUnix))}` +
            `&limit=100` +
            `&access_token=${encodeURIComponent(pageAccessToken)}`;
        try {
            for (let page = 0; nextUrl && page < 10; page += 1) {
                const res = await fetch(nextUrl);
                const body = (await res.json());
                if (!res.ok || body.error) {
                    this.logger.warn(`listPublishedPostIds failed for ${id}: ${body.error?.message || res.status}`);
                    return null;
                }
                for (const row of body.data ?? []) {
                    if (row.id)
                        found.add(row.id);
                }
                nextUrl = body.paging?.next?.trim() || null;
            }
            return found;
        }
        catch (err) {
            this.logger.warn(`listPublishedPostIds error: ${err instanceof Error ? err.message : String(err)}`);
            return null;
        }
    }
    /** Xác nhận page token còn dùng được trước khi tin kết quả "post deleted". */
    async assertPageTokenUsable(pageId, pageAccessToken) {
        const id = pageId?.trim();
        if (!id || !pageAccessToken)
            return false;
        try {
            const url = `https://graph.facebook.com/${this.apiVersion}/${encodeURIComponent(id)}` +
                `?fields=id` +
                `&access_token=${encodeURIComponent(pageAccessToken)}`;
            const res = await fetch(url);
            const body = (await res.json());
            return Boolean(res.ok && body.id && !body.error);
        }
        catch {
            return false;
        }
    }
    async debugToken(accessToken) {
        const params = new URLSearchParams({
            input_token: accessToken,
            access_token: `${this.appId}|${this.appSecret}`,
        });
        const res = await this.getJson(`https://graph.facebook.com/${this.apiVersion}/debug_token?${params.toString()}`);
        return res.data;
    }
    async parsePublishResponse(res) {
        const body = (await res.json());
        if (!res.ok || body.error) {
            const err = body.error ?? { message: `Meta API error (${res.status})` };
            const user = (0, auto_post_publish_errors_1.formatMetaGraphErrorUserFacing)(err);
            const tech = (0, auto_post_publish_errors_1.formatMetaGraphErrorTechnical)(err);
            this.logger.warn(`Meta publish failed: ${tech}`);
            throw new Error(user === tech ? user : `${user} (${tech})`);
        }
        if (!body.id)
            throw new Error('Meta không trả về post id');
        return { id: body.id };
    }
    async getJson(url, accessToken) {
        const result = await (0, meta_graph_http_1.metaGraphFetchJson)(url, {
            accessToken,
            maxRetries: 2,
            onUsage: (u) => {
                void this.usage.record(u);
            },
            logger: this.logger,
        });
        return result.data;
    }
};
exports.AutoPostMetaService = AutoPostMetaService;
exports.AutoPostMetaService = AutoPostMetaService = AutoPostMetaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        meta_graph_usage_service_1.MetaGraphUsageService])
], AutoPostMetaService);
