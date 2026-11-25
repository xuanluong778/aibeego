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
var AutoPostFacebookPageDetailsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoPostFacebookPageDetailsService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const encryption_util_1 = require("../common/utils/encryption.util");
const assert_encryption_key_1 = require("../common/utils/assert-encryption-key");
const config_1 = require("@nestjs/config");
const redis_constants_1 = require("../redis/redis.constants");
const auto_post_meta_service_1 = require("./auto-post-meta.service");
const auto_post_facebook_page_details_cache_1 = require("./auto-post-facebook-page-details.cache");
const auto_post_facebook_page_details_logic_1 = require("./auto-post-facebook-page-details.logic");
const auto_post_facebook_page_details_types_1 = require("./auto-post-facebook-page-details.types");
const meta_graph_http_1 = require("./meta-graph-http");
const meta_graph_usage_service_1 = require("./meta-graph-usage.service");
const meta_graph_metrics_service_1 = require("./meta-graph-metrics.service");
let AutoPostFacebookPageDetailsService = AutoPostFacebookPageDetailsService_1 = class AutoPostFacebookPageDetailsService {
    prisma;
    config;
    meta;
    usage;
    metrics;
    logger = new common_1.Logger(AutoPostFacebookPageDetailsService_1.name);
    cache;
    constructor(prisma, config, meta, usage, metrics, redis) {
        this.prisma = prisma;
        this.config = config;
        this.meta = meta;
        this.usage = usage;
        this.metrics = metrics;
        this.cache = new auto_post_facebook_page_details_cache_1.FanpageDetailsRedisCache(redis);
    }
    /** Dùng khi reconnect / disconnect / đổi quyền — drop cache org. */
    async invalidateOrgCache(organizationId) {
        await this.cache.invalidateOrganization(organizationId);
    }
    async invalidateFanpageCache(organizationId, fanpageId) {
        await this.cache.invalidate(organizationId, fanpageId, { dropStale: true });
    }
    getEncryptionKey() {
        return (0, assert_encryption_key_1.assertEncryptionKeyConfigured)(this.config.get('ENCRYPTION_KEY'));
    }
    /**
     * Xem chi tiết = snapshot lần đồng bộ Graph gần nhất (không gọi Facebook).
     * Query refresh=true vẫn live-fetch (tương thích test cũ) và persist nếu thành công.
     */
    async getPageDetails(userId, organizationId, fanpageId, options) {
        const refresh = Boolean(options?.refresh);
        if (refresh) {
            return this.syncPageDetails(userId, organizationId, fanpageId);
        }
        const snapshot = await this.loadPersistedSnapshot(organizationId, fanpageId);
        if (snapshot) {
            this.metrics.cacheHit();
            return snapshot;
        }
        return this.buildUnsyncedStub(userId, organizationId, fanpageId);
    }
    /**
     * Đồng bộ live từ Graph bằng Page Access Token.
     * Thành công → lưu lastSyncedAt + snapshot. Lỗi → giữ dữ liệu cũ, trả lỗi rõ.
     */
    async syncPageDetails(userId, organizationId, fanpageId) {
        try {
            return await this.fetchAndBuild(userId, organizationId, fanpageId);
        }
        catch (err) {
            await this.recordSyncFailure(organizationId, fanpageId, err);
            this.rethrowAsHttp(err);
        }
    }
    async fetchAndBuild(userId, organizationId, fanpageId) {
        const resolved = await this.resolvePageTokenForRead(userId, organizationId, fanpageId);
        const permissions = (0, auto_post_facebook_page_details_logic_1.buildPermissionsFlags)(resolved.scopes);
        const warnings = [];
        // Chỉ chặn sớm khi user từ chối tường minh — còn lại thử Graph (metadata luôn hữu ích)
        if (!resolved.isEnvToken && resolved.permissionDeclined) {
            throw new common_1.ForbiddenException({
                code: 'permission_declined',
                legacyCode: 'MISSING_PAGES_READ_ENGAGEMENT',
                message: auto_post_facebook_page_details_logic_1.PERMISSION_DECLINED_MESSAGE,
            });
        }
        let pageMeta;
        let recentPosts = [];
        let postsError = null;
        try {
            pageMeta = await this.fetchPageMetadata(resolved);
        }
        catch (err) {
            this.rethrowAsHttp(err);
        }
        try {
            recentPosts = await this.fetchRecentPosts(resolved);
        }
        catch (err) {
            const classified = this.classifyThrown(err);
            if (classified.code === 'expired_token' ||
                classified.code === 'TOKEN_EXPIRED' ||
                classified.code === 'invalid_page_token' ||
                classified.code === 'wrong_page_id' ||
                classified.code === 'PAGE_ACCESS_REVOKED') {
                // Token/page sai ảnh hưởng cả metadata đã lấy — báo lỗi cứng
                this.rethrowAsHttp(err);
            }
            postsError = classified.message;
            warnings.push(classified.code === 'permission_missing' || classified.code === 'permission_declined'
                ? `Đã tải thông tin Fanpage. Không đọc được bài viết từ Facebook: ${classified.message}`
                : classified.code === 'rate_limited' || classified.code === 'META_RATE_LIMIT'
                    ? `Không tải được bài đăng gần đây do giới hạn Facebook: ${classified.message}`
                    : `Không tải được danh sách bài đăng gần đây: ${classified.message}`);
            const previous = await this.loadPersistedSnapshot(organizationId, fanpageId);
            recentPosts = previous?.recentPosts ?? [];
        }
        const apiVersion = this.meta.apiVersion;
        const pageFields = auto_post_facebook_page_details_logic_1.FANPAGE_DETAILS_PAGE_FIELDS.join(',');
        const postFields = auto_post_facebook_page_details_logic_1.FANPAGE_DETAILS_SAFE_POST_FIELDS.join(',');
        const syncedAt = new Date();
        const latestPostAt = this.latestPostDate(recentPosts);
        const response = {
            page: pageMeta,
            recentPosts,
            permissions: {
                ...permissions,
                pages_read_engagement: permissions.pages_read_engagement || resolved.isEnvToken,
            },
            refreshedAt: syncedAt.toISOString(),
            warnings,
            cached: false,
            stale: false,
            dataSource: 'live',
            pageTokenRefreshed: resolved.pageTokenRefreshed,
            syncStatus: 'Đồng bộ thành công từ Facebook',
            graphEndpoints: {
                page: `GET https://graph.facebook.com/${apiVersion}/{page-id}?fields=${pageFields}`,
                posts: `GET https://graph.facebook.com/${apiVersion}/{page-id}/published_posts?fields=${postFields}&limit=${auto_post_facebook_page_details_types_1.FANPAGE_DETAILS_POST_LIMIT}`,
            },
            postsError,
            lastSyncedAt: syncedAt.toISOString(),
            lastPostCreatedAt: latestPostAt?.toISOString() ?? null,
            lastSyncedAtDisplay: (0, auto_post_facebook_page_details_logic_1.formatHoChiMinhDateTime)(syncedAt),
            lastPostCreatedAtDisplay: (0, auto_post_facebook_page_details_logic_1.formatHoChiMinhDateTime)(latestPostAt),
        };
        await this.persistSuccessfulSync(organizationId, fanpageId, response, syncedAt, latestPostAt);
        await this.cache.set(organizationId, fanpageId, response);
        return response;
    }
    latestPostDate(posts) {
        for (const post of posts) {
            if (!post.createdTime)
                continue;
            const d = new Date(post.createdTime);
            if (!Number.isNaN(d.getTime()))
                return d;
        }
        return null;
    }
    async loadPersistedSnapshot(organizationId, fanpageId) {
        const row = await this.prisma.autoPostFacebookPage.findFirst({
            where: { id: fanpageId, connection: { organizationId } },
            select: {
                lastSyncSnapshot: true,
                lastSyncedAt: true,
                lastPostCreatedAt: true,
            },
        });
        if (!row?.lastSyncSnapshot || !row.lastSyncedAt)
            return null;
        const raw = row.lastSyncSnapshot;
        if (!raw || typeof raw !== 'object' || Array.isArray(raw))
            return null;
        const snap = raw;
        if (!snap.page || !Array.isArray(snap.recentPosts))
            return null;
        if ((0, auto_post_facebook_page_details_logic_1.snapshotHasTokenLeak)(snap)) {
            this.logger.warn(`Dropped leaked snapshot org=${organizationId} fanpage=${fanpageId}`);
            return null;
        }
        return {
            ...snap,
            cached: true,
            stale: false,
            dataSource: 'sync',
            syncStatus: 'Đồng bộ thành công từ Facebook',
            lastSyncedAt: row.lastSyncedAt.toISOString(),
            lastPostCreatedAt: row.lastPostCreatedAt?.toISOString() ?? snap.lastPostCreatedAt ?? null,
            lastSyncedAtDisplay: (0, auto_post_facebook_page_details_logic_1.formatHoChiMinhDateTime)(row.lastSyncedAt),
            lastPostCreatedAtDisplay: (0, auto_post_facebook_page_details_logic_1.formatHoChiMinhDateTime)(row.lastPostCreatedAt ?? snap.lastPostCreatedAt),
        };
    }
    async buildUnsyncedStub(_userId, organizationId, fanpageId) {
        const page = await this.prisma.autoPostFacebookPage.findFirst({
            where: { id: fanpageId, connection: { organizationId } },
            include: {
                connection: { select: { scopes: true, organizationId: true } },
            },
        });
        if (!page || page.connection.organizationId !== organizationId) {
            throw new common_1.NotFoundException({
                code: 'NOT_FOUND',
                message: 'Fanpage không tồn tại hoặc không thuộc tổ chức của bạn.',
            });
        }
        const permissions = (0, auto_post_facebook_page_details_logic_1.buildPermissionsFlags)(page.connection.scopes ?? []);
        return {
            page: {
                id: page.id,
                pageId: page.pageId,
                name: page.pageName,
                pictureUrl: page.pagePictureUrl,
                coverUrl: null,
                category: null,
                about: null,
                description: null,
                website: null,
                link: null,
                username: null,
                phone: null,
                emails: null,
                location: null,
                followersCount: null,
                fanCount: null,
            },
            recentPosts: [],
            permissions,
            refreshedAt: '',
            warnings: [
                'Chưa đồng bộ từ Facebook. Bấm Đồng bộ thông tin Fanpage để lấy dữ liệu và bài viết mới nhất.',
            ],
            cached: false,
            stale: false,
            dataSource: 'none',
            syncStatus: null,
            postsError: null,
            lastSyncedAt: null,
            lastPostCreatedAt: null,
            lastSyncedAtDisplay: null,
            lastPostCreatedAtDisplay: null,
        };
    }
    async persistSuccessfulSync(organizationId, fanpageId, response, syncedAt, latestPostAt) {
        if ((0, auto_post_facebook_page_details_logic_1.snapshotHasTokenLeak)(response)) {
            this.logger.error(`Refuse persist snapshot: token leak org=${organizationId}`);
            throw new common_1.HttpException({ code: 'META_API_ERROR', message: 'Không lưu được dữ liệu đồng bộ.' }, common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
        const stored = {
            ...response,
            cached: true,
            stale: false,
            dataSource: 'sync',
        };
        await this.prisma.autoPostFacebookPage.updateMany({
            where: { id: fanpageId, connection: { organizationId } },
            data: {
                lastSyncedAt: syncedAt,
                lastPostCreatedAt: latestPostAt,
                lastSyncSnapshot: stored,
                lastSyncError: null,
                pageName: response.page.name || undefined,
                pagePictureUrl: response.page.pictureUrl,
            },
        });
    }
    async recordSyncFailure(organizationId, fanpageId, err) {
        const classified = this.classifyThrown(err);
        await this.prisma.autoPostFacebookPage
            .updateMany({
            where: { id: fanpageId, connection: { organizationId } },
            data: { lastSyncError: classified.message.slice(0, 500) },
        })
            .catch(() => undefined);
    }
    async resolvePageTokenForRead(userId, organizationId, fanpageId) {
        const page = await this.prisma.autoPostFacebookPage.findFirst({
            where: {
                id: fanpageId,
                connection: { organizationId },
            },
            include: {
                connection: {
                    select: {
                        id: true,
                        userId: true,
                        status: true,
                        scopes: true,
                        tokenExpiresAt: true,
                        organizationId: true,
                        encryptedAccessToken: true,
                        updatedAt: true,
                    },
                },
            },
        });
        // Ownership: page thuộc org; user phải là chủ connection hoặc cùng org (tenant guard đã gắn org)
        if (!page || page.connection.organizationId !== organizationId) {
            throw new common_1.NotFoundException({
                code: 'NOT_FOUND',
                message: 'Fanpage không tồn tại hoặc không thuộc tổ chức của bạn.',
            });
        }
        if (page.userId !== userId && page.connection.userId !== userId) {
            // Vẫn cho phép nếu cùng org và connection của org — prefer org scope
            // Chặn khi page.userId khác và connection không thuộc org (đã check org ở trên)
        }
        const conn = page.connection;
        if (conn.status === database_1.AutoPostFacebookConnectionStatus.DISCONNECTED ||
            conn.status === database_1.AutoPostFacebookConnectionStatus.ERROR) {
            throw new common_1.UnauthorizedException({
                code: 'expired_token',
                legacyCode: 'TOKEN_EXPIRED',
                message: 'Kết nối Facebook chưa sẵn sàng. Vui lòng kết nối lại Facebook.',
            });
        }
        if (conn.status === database_1.AutoPostFacebookConnectionStatus.TOKEN_EXPIRED ||
            (conn.tokenExpiresAt && conn.tokenExpiresAt.getTime() < Date.now())) {
            await this.prisma.autoPostFacebookConnection.updateMany({
                where: { organizationId },
                data: {
                    status: database_1.AutoPostFacebookConnectionStatus.TOKEN_EXPIRED,
                    lastError: 'NEEDS_RECONNECT: Token Facebook đã hết hạn',
                },
            });
            throw new common_1.UnauthorizedException({
                code: 'expired_token',
                legacyCode: 'TOKEN_EXPIRED',
                message: 'Token Facebook đã hết hạn. Vui lòng kết nối lại Facebook.',
            });
        }
        let scopes = Array.isArray(conn.scopes) ? [...conn.scopes] : [];
        const isEnvToken = scopes.includes('env_page_token');
        let permissionDeclined = false;
        let pageTokenRefreshed = false;
        // Live /me/permissions + làm mới Page token từ /me/accounts (OAuth)
        if (!isEnvToken && conn.encryptedAccessToken) {
            let userToken = null;
            try {
                userToken = (0, encryption_util_1.decryptSecret)(conn.encryptedAccessToken, this.getEncryptionKey());
            }
            catch {
                throw new common_1.UnauthorizedException({
                    code: 'invalid_page_token',
                    legacyCode: 'TOKEN_EXPIRED',
                    message: 'Không đọc được User Access Token. Vui lòng kết nối lại Facebook.',
                });
            }
            if (userToken?.trim()) {
                try {
                    const diag = await this.meta.diagnoseUserPermissions(userToken);
                    scopes = (0, auto_post_facebook_page_details_logic_1.mergeConnectionScopes)(scopes, diag.granted, diag.declined);
                    permissionDeclined = diag.declined.includes('pages_read_engagement');
                    // Cập nhật scopes đã kiểm tra — union, không thu hẹp (trừ declined)
                    if (diag.granted.length || diag.declined.length) {
                        await this.prisma.autoPostFacebookConnection.update({
                            where: { id: conn.id },
                            data: { scopes },
                        });
                    }
                }
                catch (err) {
                    const classified = this.classifyThrown(err);
                    if (classified.code === 'expired_token' ||
                        classified.code === 'TOKEN_EXPIRED' ||
                        classified.code === 'invalid_page_token') {
                        this.rethrowAsHttp(err);
                    }
                    this.logger.warn(`Live /me/permissions failed org=${organizationId}: ${classified.message}`);
                }
                // Làm mới Page Access Token đúng fanpageId — không giữ token cũ nếu Meta trả mới
                if ((0, auto_post_facebook_page_details_logic_1.hasPagesReadEngagement)(scopes) || scopes.includes('pages_show_list')) {
                    try {
                        const managed = await this.meta.getManagedPages(userToken);
                        const match = managed.find((p) => p.id === page.pageId);
                        if (!match) {
                            throw new common_1.ForbiddenException({
                                code: 'wrong_page_id',
                                legacyCode: 'PAGE_ACCESS_REVOKED',
                                message: 'Fanpage không còn trong /me/accounts của kết nối hiện tại. Chọn lại Fanpage hoặc kết nối lại Facebook.',
                            });
                        }
                        if (!match.access_token?.trim()) {
                            throw new common_1.UnauthorizedException({
                                code: 'invalid_page_token',
                                legacyCode: 'TOKEN_EXPIRED',
                                message: 'Meta không trả Page Access Token cho Fanpage này.',
                            });
                        }
                        const encrypted = (0, encryption_util_1.encryptSecret)(match.access_token, this.getEncryptionKey());
                        await this.prisma.autoPostFacebookPage.update({
                            where: { id: page.id },
                            data: {
                                encryptedPageAccessToken: encrypted,
                                pageName: match.name || page.pageName,
                                pagePictureUrl: match.picture?.data?.url ?? page.pagePictureUrl,
                            },
                        });
                        pageTokenRefreshed = true;
                        // Dùng token mới ngay — không đọc lại bản cũ
                        return {
                            rowId: page.id,
                            pageId: page.pageId,
                            pageName: match.name || page.pageName,
                            pagePictureUrl: match.picture?.data?.url ?? page.pagePictureUrl,
                            accessToken: match.access_token,
                            scopes,
                            isEnvToken,
                            permissionDeclined,
                            pageTokenRefreshed,
                        };
                    }
                    catch (err) {
                        if (err instanceof common_1.HttpException)
                            throw err;
                        const classified = this.classifyThrown(err);
                        this.logger.warn(`Refresh page token failed org=${organizationId} pageId=${page.pageId}: ${classified.message}`);
                        // Fallback stored token nếu refresh fail không phải wrong_page / auth
                        if (classified.code === 'wrong_page_id' ||
                            classified.code === 'expired_token' ||
                            classified.code === 'TOKEN_EXPIRED' ||
                            classified.code === 'invalid_page_token' ||
                            classified.code === 'rate_limited') {
                            this.rethrowAsHttp(err);
                        }
                    }
                }
            }
        }
        let accessToken;
        try {
            accessToken = (0, encryption_util_1.decryptSecret)(page.encryptedPageAccessToken, this.getEncryptionKey());
        }
        catch {
            throw new common_1.UnauthorizedException({
                code: 'invalid_page_token',
                legacyCode: 'TOKEN_EXPIRED',
                message: 'Không đọc được token Fanpage. Vui lòng kết nối lại Facebook.',
            });
        }
        if (!accessToken?.trim()) {
            throw new common_1.UnauthorizedException({
                code: 'invalid_page_token',
                legacyCode: 'TOKEN_EXPIRED',
                message: 'Token Fanpage trống. Vui lòng kết nối lại Facebook.',
            });
        }
        return {
            rowId: page.id,
            pageId: page.pageId,
            pageName: page.pageName,
            pagePictureUrl: page.pagePictureUrl,
            accessToken,
            scopes,
            isEnvToken,
            permissionDeclined,
            pageTokenRefreshed,
        };
    }
    async fetchPageMetadata(resolved) {
        const fields = auto_post_facebook_page_details_logic_1.FANPAGE_DETAILS_PAGE_FIELDS.join(',');
        const url = `https://graph.facebook.com/${this.meta.apiVersion}/${encodeURIComponent(resolved.pageId)}` +
            `?fields=${encodeURIComponent(fields)}`;
        const raw = await this.graphGet(url, resolved.accessToken, 'page_metadata');
        return (0, auto_post_facebook_page_details_logic_1.mapMetaPageToDetails)(raw, {
            id: resolved.rowId,
            pageId: resolved.pageId,
            pageName: resolved.pageName,
            pagePictureUrl: resolved.pagePictureUrl,
        });
    }
    async fetchRecentPosts(resolved) {
        const fields = auto_post_facebook_page_details_logic_1.FANPAGE_DETAILS_SAFE_POST_FIELDS.join(',');
        const url = `https://graph.facebook.com/${this.meta.apiVersion}/${encodeURIComponent(resolved.pageId)}/published_posts` +
            `?fields=${encodeURIComponent(fields)}&limit=${auto_post_facebook_page_details_types_1.FANPAGE_DETAILS_POST_LIMIT}`;
        try {
            const body = await this.graphGet(url, resolved.accessToken, 'published_posts');
            return (0, auto_post_facebook_page_details_logic_1.mapMetaPosts)(body.data, auto_post_facebook_page_details_types_1.FANPAGE_DETAILS_POST_LIMIT);
        }
        catch (err) {
            const classified = this.classifyThrown(err);
            if (classified.code === 'META_API_ERROR' || classified.code === 'PAGE_ACCESS_REVOKED') {
                const fallback = `https://graph.facebook.com/${this.meta.apiVersion}/${encodeURIComponent(resolved.pageId)}/posts` +
                    `?fields=${encodeURIComponent(fields)}&limit=${auto_post_facebook_page_details_types_1.FANPAGE_DETAILS_POST_LIMIT}`;
                const body = await this.graphGet(fallback, resolved.accessToken, 'posts');
                return (0, auto_post_facebook_page_details_logic_1.mapMetaPosts)(body.data, auto_post_facebook_page_details_types_1.FANPAGE_DETAILS_POST_LIMIT);
            }
            throw err;
        }
    }
    async graphGet(url, accessToken, endpoint) {
        try {
            this.metrics.graphRequest(endpoint);
            const result = await (0, meta_graph_http_1.metaGraphFetchJson)(url, {
                accessToken,
                maxRetries: 2,
                onUsage: (u) => {
                    void this.usage.record(u);
                    if (u.nearLimit)
                        this.metrics.rateLimit();
                },
                onRetry: () => this.metrics.retry(),
                logger: this.logger,
            });
            return result.data;
        }
        catch (err) {
            const httpErr = err;
            if (httpErr?.rateLimited)
                this.metrics.rateLimit();
            throw err;
        }
    }
    classifyThrown(err) {
        const httpErr = err;
        if (httpErr?.network) {
            return (0, auto_post_facebook_page_details_logic_1.classifyMetaGraphError)({ message: httpErr.message || 'network' });
        }
        if (httpErr?.metaError)
            return (0, auto_post_facebook_page_details_logic_1.classifyMetaGraphError)(httpErr.metaError);
        if (err instanceof Error)
            return (0, auto_post_facebook_page_details_logic_1.classifyMetaGraphError)({ message: err.message });
        return (0, auto_post_facebook_page_details_logic_1.classifyMetaGraphError)({ message: 'unknown' });
    }
    rethrowAsHttp(err) {
        if (err instanceof common_1.HttpException)
            throw err;
        const classified = this.classifyThrown(err);
        const legacy = (0, auto_post_facebook_page_details_logic_1.toLegacyErrorCode)(classified.code);
        throw new common_1.HttpException({
            code: classified.code,
            legacyCode: legacy !== classified.code ? legacy : undefined,
            message: classified.message,
        }, classified.httpStatus === 429
            ? common_1.HttpStatus.TOO_MANY_REQUESTS
            : classified.httpStatus === 401
                ? common_1.HttpStatus.UNAUTHORIZED
                : classified.httpStatus === 403
                    ? common_1.HttpStatus.FORBIDDEN
                    : classified.httpStatus === 503
                        ? common_1.HttpStatus.SERVICE_UNAVAILABLE
                        : common_1.HttpStatus.BAD_GATEWAY);
    }
};
exports.AutoPostFacebookPageDetailsService = AutoPostFacebookPageDetailsService;
exports.AutoPostFacebookPageDetailsService = AutoPostFacebookPageDetailsService = AutoPostFacebookPageDetailsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(5, (0, common_1.Optional)()),
    __param(5, (0, common_1.Inject)(redis_constants_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        auto_post_meta_service_1.AutoPostMetaService,
        meta_graph_usage_service_1.MetaGraphUsageService,
        meta_graph_metrics_service_1.MetaGraphMetricsService, Function])
], AutoPostFacebookPageDetailsService);
