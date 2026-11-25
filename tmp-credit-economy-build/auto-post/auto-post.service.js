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
var AutoPostService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoPostService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const openai_service_1 = require("../openai/openai.service");
const queue_constants_1 = require("../queue/queue.constants");
const redis_constants_1 = require("../redis/redis.constants");
const queue_enqueue_service_1 = require("../common/services/queue-enqueue.service");
const auto_post_facebook_service_1 = require("./auto-post-facebook.service");
const auto_post_meta_service_1 = require("./auto-post-meta.service");
const auto_post_ai_logic_1 = require("./auto-post-ai.logic");
const auto_post_publish_errors_1 = require("./auto-post-publish-errors");
const auto_post_media_util_1 = require("./auto-post-media.util");
const meta_fanpage_access_1 = require("../meta-fanpage/meta-fanpage-access");
const auto_post_publish_lock_1 = require("./auto-post-publish-lock");
const meta_graph_metrics_service_1 = require("./meta-graph-metrics.service");
const EDITABLE_STATUSES = [
    database_1.AutoPostStatus.DRAFT,
    database_1.AutoPostStatus.PENDING,
    database_1.AutoPostStatus.FAILED,
];
const CLAIMABLE_FOR_PUBLISH = [
    database_1.AutoPostStatus.DRAFT,
    database_1.AutoPostStatus.PENDING,
    database_1.AutoPostStatus.FAILED,
    database_1.AutoPostStatus.CANCELLED,
    database_1.AutoPostStatus.SCHEDULED,
];
let AutoPostService = AutoPostService_1 = class AutoPostService {
    prisma;
    openai;
    facebook;
    meta;
    metrics;
    autoPostQueue;
    queueEnqueue;
    redis;
    logger = new common_1.Logger(AutoPostService_1.name);
    constructor(prisma, openai, facebook, meta, metrics, autoPostQueue, queueEnqueue, redis) {
        this.prisma = prisma;
        this.openai = openai;
        this.facebook = facebook;
        this.meta = meta;
        this.metrics = metrics;
        this.autoPostQueue = autoPostQueue;
        this.queueEnqueue = queueEnqueue;
        this.redis = redis;
    }
    status(user) {
        const metaConfigured = Boolean((process.env.META_APP_ID || process.env.FACEBOOK_APP_ID) &&
            (process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET));
        const metaLoginConfigIdValue = process.env.META_LOGIN_CONFIG_ID?.trim() ||
            process.env.FACEBOOK_LOGIN_CONFIG_ID?.trim() ||
            process.env.FACEBOOK_CONFIG_ID?.trim() ||
            '';
        const metaLoginConfigId = Boolean(metaLoginConfigIdValue);
        const metaPageEnvConfigured = Boolean(process.env.META_PAGE_ID?.trim() && process.env.META_PAGE_ACCESS_TOKEN?.trim());
        const oauthConnectionEnabled = (process.env.OAUTH_CONNECTION ?? '').trim().toLowerCase() === 'true';
        const oauthCanary = (process.env.AUTO_POST_OAUTH_CANARY ?? '').trim().toLowerCase() === 'true';
        const allowedOrgIds = (0, meta_fanpage_access_1.parseMetaFanpageAllowedOrgIds)((k) => process.env[k]);
        const canUseServerEnv = user
            ? (0, meta_fanpage_access_1.canUseServerEnvFanpage)({ role: user.role, organizationId: user.organizationId }, allowedOrgIds)
            : false;
        // USER: chỉ biết có thể kết nối Facebook hay không — không lộ env/config kỹ thuật
        const facebookConnectAvailable = oauthConnectionEnabled && metaConfigured && metaLoginConfigId;
        const publicStatus = {
            aiConfigured: this.openai.isConfigured(),
            facebookConnectAvailable,
        };
        if (!canUseServerEnv) {
            return publicStatus;
        }
        // SUPER_ADMIN / allowlist: khu vực cấu hình nâng cao + chẩn đoán
        return {
            ...publicStatus,
            metaConfigured,
            metaLoginConfigId,
            metaLoginConfigIdValue,
            metaAppId: process.env.META_APP_ID?.trim() || process.env.FACEBOOK_APP_ID?.trim() || null,
            metaPageEnvConfigured,
            canUseServerEnv: true,
            oauthConnectionEnabled,
            oauthCanary,
            allowlistOrgCount: allowedOrgIds.length,
            currentOrgAllowlisted: Boolean(user?.organizationId && allowedOrgIds.includes(user.organizationId)),
            isSuperAdmin: user?.role === 'SUPER_ADMIN',
        };
    }
    async generateAi(user, dto) {
        return (0, auto_post_ai_logic_1.generateAutoPostContent)(this.openai, dto);
    }
    async rewriteAi(_user, dto) {
        return (0, auto_post_ai_logic_1.rewriteAutoPostContent)(this.openai, dto.mode, dto.caption, dto.cta);
    }
    async saveDraft(user, dto) {
        const fanpage = await this.resolveFanpage(user.id, user.organizationId, dto.fanpageId);
        const data = await this.buildPostData(user, dto, fanpage);
        if (dto.id) {
            const existing = await this.requireOwnedPost(user.id, user.organizationId, dto.id);
            if (!EDITABLE_STATUSES.includes(existing.status)) {
                throw new common_1.BadRequestException('Không thể sửa bài ở trạng thái hiện tại');
            }
            const updated = await this.prisma.autoPost.update({
                where: { id: dto.id },
                data: { ...data, status: database_1.AutoPostStatus.DRAFT },
            });
            return this.serializePost(updated);
        }
        const created = await this.prisma.autoPost.create({
            data: { ...data, status: database_1.AutoPostStatus.DRAFT },
        });
        return this.serializePost(created);
    }
    async updatePost(user, dto) {
        const existing = await this.requireOwnedPost(user.id, user.organizationId, dto.id);
        if (!EDITABLE_STATUSES.includes(existing.status)) {
            throw new common_1.BadRequestException('Không thể cập nhật bài ở trạng thái hiện tại');
        }
        const fanpage = await this.resolveFanpage(user.id, user.organizationId, dto.fanpageId);
        const data = await this.buildPostData(user, dto, fanpage);
        const updated = await this.prisma.autoPost.update({
            where: { id: dto.id },
            data,
        });
        return this.serializePost(updated);
    }
    async listPosts(userId, organizationId, status, industryFilter) {
        const custom = industryFilter?.customIndustry?.trim();
        await this.purgePostsDeletedOnFacebook(userId, organizationId);
        const items = await this.prisma.autoPost.findMany({
            where: {
                userId,
                organizationId,
                ...(status ? { status } : {}),
                ...(industryFilter?.industryId
                    ? { industryId: industryFilter.industryId }
                    : custom
                        ? { customIndustry: { equals: custom, mode: 'insensitive' } }
                        : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
        return { items: items.map((p) => this.serializePost(p)) };
    }
    /**
     * Bài Đã đăng nhưng đã bị xóa trên Fanpage → xóa khỏi Lịch đăng & lịch sử.
     * Dùng published_posts (tin cậy hơn GET từng post). Lỗi token/API → bỏ qua.
     */
    async purgePostsDeletedOnFacebook(userId, organizationId) {
        const published = await this.prisma.autoPost.findMany({
            where: {
                userId,
                organizationId,
                status: database_1.AutoPostStatus.PUBLISHED,
                facebookPostId: { not: null },
                fanpageId: { not: null },
            },
            select: {
                id: true,
                fanpageId: true,
                facebookPostId: true,
                publishedAt: true,
            },
            take: 100,
            orderBy: { publishedAt: 'desc' },
        });
        if (!published.length)
            return;
        const byFanpage = new Map();
        for (const post of published) {
            if (!post.fanpageId)
                continue;
            const list = byFanpage.get(post.fanpageId) ?? [];
            list.push(post);
            byFanpage.set(post.fanpageId, list);
        }
        const deletedIds = [];
        for (const [fanpageId, posts] of byFanpage) {
            let pageId;
            let accessToken;
            try {
                const tok = await this.facebook.getPageAccessToken(userId, organizationId, fanpageId);
                const usable = await this.meta.assertPageTokenUsable(tok.pageId, tok.accessToken);
                if (!usable) {
                    this.logger.warn(`purge: page token not usable for fanpage ${fanpageId}`);
                    continue;
                }
                pageId = tok.pageId;
                accessToken = tok.accessToken;
            }
            catch (err) {
                this.logger.warn(`purge: skip fanpage ${fanpageId}: ${err instanceof Error ? err.message : String(err)}`);
                continue;
            }
            const times = posts
                .map((p) => p.publishedAt?.getTime())
                .filter((t) => typeof t === 'number' && Number.isFinite(t));
            const oldestMs = times.length ? Math.min(...times) : Date.now() - 7 * 86400_000;
            const sinceUnix = Math.floor(oldestMs / 1000) - 86400;
            const liveIds = await this.meta.listPublishedPostIds(pageId, accessToken, sinceUnix);
            if (!liveIds)
                continue;
            for (const post of posts) {
                const fbId = post.facebookPostId?.trim();
                if (!fbId)
                    continue;
                if (!liveIds.has(fbId)) {
                    deletedIds.push(post.id);
                }
            }
        }
        if (!deletedIds.length)
            return;
        await this.prisma.autoPost.deleteMany({
            where: {
                id: { in: deletedIds },
                userId,
                organizationId,
                status: database_1.AutoPostStatus.PUBLISHED,
            },
        });
        this.logger.log(`Purged ${deletedIds.length} auto-post(s) deleted on Facebook for user ${userId}`);
    }
    async getPost(userId, organizationId, id) {
        const post = await this.requireOwnedPost(userId, organizationId, id);
        return this.serializePost(post);
    }
    async deletePost(userId, organizationId, id) {
        const post = await this.requireOwnedPost(userId, organizationId, id);
        if (post.status === database_1.AutoPostStatus.PUBLISHING ||
            post.status === database_1.AutoPostStatus.PUBLISHED) {
            throw new common_1.BadRequestException('Không thể xóa bài đã/đang đăng');
        }
        await this.prisma.autoPost.delete({ where: { id } });
        return { ok: true };
    }
    /**
     * Đăng ngay — hỗ trợ nhiều Fanpage:
     * - Mỗi fanpageId → 1 AutoPost riêng (jobId `auto-post-${postId}`, log, status, facebookPostId riêng)
     * - Idempotent theo từng post/page
     * - Không fallback SERVER_ENV
     */
    async publishNow(userId, organizationId, dto) {
        const postId = typeof dto === 'string' ? dto : dto.postId;
        const fanpageIds = typeof dto === 'string' ? undefined : dto.fanpageIds;
        const source = await this.requireOwnedPost(userId, organizationId, postId);
        const targets = await this.resolvePublishTargets(userId, organizationId, source.fanpageId, fanpageIds);
        const postIds = await this.ensurePostsForFanpages(userId, organizationId, source, targets);
        const items = [];
        for (const id of postIds) {
            items.push(await this.publishSinglePost(userId, organizationId, id));
        }
        return items.length === 1 ? items[0] : { items };
    }
    async schedule(userId, organizationId, dto) {
        const scheduledAt = new Date(dto.scheduledAt);
        if (Number.isNaN(scheduledAt.getTime())) {
            throw new common_1.BadRequestException('Thời gian lên lịch không hợp lệ');
        }
        if (scheduledAt.getTime() <= Date.now()) {
            throw new common_1.BadRequestException('Không thể lên lịch ở thời gian quá khứ');
        }
        const source = await this.requireOwnedPost(userId, organizationId, dto.postId);
        const targets = await this.resolvePublishTargets(userId, organizationId, source.fanpageId, dto.fanpageIds);
        const postIds = await this.ensurePostsForFanpages(userId, organizationId, source, targets);
        const items = [];
        for (const id of postIds) {
            items.push(await this.scheduleSinglePost(userId, organizationId, id, scheduledAt));
        }
        return items.length === 1 ? items[0] : { items };
    }
    async publishSinglePost(userId, organizationId, postId) {
        const post = await this.requireOwnedPost(userId, organizationId, postId);
        // Idempotent: đã đăng thành công thì trả về bài hiện có (không gọi Graph lại)
        if (post.status === database_1.AutoPostStatus.PUBLISHED && post.facebookPostId) {
            this.metrics.duplicatePublishPrevented();
            return this.serializePost(post);
        }
        this.assertPublishable(post);
        const owner = `api:${(0, crypto_1.randomUUID)()}:${process.pid}`;
        let lockKey = null;
        if (this.redis) {
            const lock = await (0, auto_post_publish_lock_1.acquireAutoPostPublishLock)(this.redis, organizationId, postId, owner);
            if (!lock.ok) {
                this.metrics.duplicatePublishPrevented();
                const current = await this.requireOwnedPost(userId, organizationId, postId);
                if (current.status === database_1.AutoPostStatus.PUBLISHED && current.facebookPostId) {
                    return this.serializePost(current);
                }
                throw new common_1.BadRequestException('Bài đang được đăng');
            }
            lockKey = lock.key;
        }
        try {
            // Re-check after lock — worker có thể vừa publish
            const latest = await this.requireOwnedPost(userId, organizationId, postId);
            if (latest.status === database_1.AutoPostStatus.PUBLISHED && latest.facebookPostId) {
                return this.serializePost(latest);
            }
            const claimed = await this.prisma.autoPost.updateMany({
                where: {
                    id: postId,
                    userId,
                    organizationId,
                    status: { in: CLAIMABLE_FOR_PUBLISH },
                    facebookPostId: null,
                },
                data: {
                    status: database_1.AutoPostStatus.PUBLISHING,
                    approvedAt: new Date(),
                    errorMessage: null,
                },
            });
            if (claimed.count !== 1) {
                const current = await this.requireOwnedPost(userId, organizationId, postId);
                if (current.status === database_1.AutoPostStatus.PUBLISHED && current.facebookPostId) {
                    return this.serializePost(current);
                }
                if (current.status === database_1.AutoPostStatus.PUBLISHING) {
                    throw new common_1.BadRequestException('Bài đang được đăng');
                }
                throw new common_1.BadRequestException('Không thể đăng bài ở trạng thái hiện tại');
            }
            // Hủy delayed job nếu đang SCHEDULED
            try {
                const job = await this.autoPostQueue.getJob(`auto-post-${postId}`);
                if (job)
                    await job.remove();
            }
            catch {
                /* ignore */
            }
            try {
                const published = await this.executePublish(userId, organizationId, latest);
                const updated = await this.prisma.autoPost.update({
                    where: { id: postId },
                    data: {
                        status: database_1.AutoPostStatus.PUBLISHED,
                        publishedAt: new Date(),
                        facebookPostId: published.id,
                        facebookPermalink: published.permalinkUrl,
                        scheduledAt: null,
                        errorMessage: null,
                    },
                });
                await this.prisma.autoPostPublishLog.create({
                    data: {
                        userId,
                        postId,
                        action: 'publish_now',
                        status: 'success',
                        facebookPostId: published.id,
                    },
                });
                return this.serializePost(updated);
            }
            catch (e) {
                const raw = e instanceof Error ? e.message : 'Đăng bài thất bại';
                const msg = (0, auto_post_publish_errors_1.sanitizePublishErrorMessage)(raw);
                const userMsg = (0, auto_post_publish_errors_1.friendlyPublishError)(msg);
                await this.facebook.logApiError(userId, 'publish_now', msg, postId);
                await this.prisma.autoPost.update({
                    where: { id: postId },
                    data: { status: database_1.AutoPostStatus.FAILED, errorMessage: msg },
                });
                await this.prisma.autoPostPublishLog.create({
                    data: {
                        userId,
                        postId,
                        action: 'publish_now',
                        status: 'failed',
                        errorMessage: msg,
                    },
                });
                if ((0, auto_post_publish_errors_1.isPermanentPublishError)(msg)) {
                    throw new common_1.BadRequestException(userMsg);
                }
                throw new common_1.BadRequestException(userMsg);
            }
        }
        finally {
            if (this.redis && lockKey) {
                await (0, auto_post_publish_lock_1.releaseAutoPostPublishLock)(this.redis, lockKey, owner);
            }
        }
    }
    async scheduleSinglePost(userId, organizationId, postId, scheduledAt) {
        const post = await this.requireOwnedPost(userId, organizationId, postId);
        this.assertPublishable(post);
        // Preflight quyền/token trước khi xếp lịch — không fallback SERVER_ENV
        await this.facebook.assertCanPublish(userId, organizationId, post.fanpageId);
        const updated = await this.prisma.autoPost.update({
            where: { id: postId },
            data: {
                status: database_1.AutoPostStatus.SCHEDULED,
                scheduledAt,
                approvedAt: new Date(),
                errorMessage: null,
            },
        });
        const delay = scheduledAt.getTime() - Date.now();
        await this.queueEnqueue.add(this.autoPostQueue, 'publish-scheduled', { postId, userId, organizationId }, {
            jobId: `auto-post-${postId}`,
            delay,
            removeOnComplete: true,
            attempts: 3,
            backoff: { type: 'exponential', delay: 10_000 },
        });
        await this.prisma.autoPostPublishLog.create({
            data: {
                userId,
                postId,
                action: 'scheduled',
                status: 'success',
            },
        });
        return this.serializePost(updated);
    }
    async resolvePublishTargets(userId, organizationId, existingFanpageId, fanpageIds) {
        const ids = [
            ...new Set((fanpageIds?.length ? fanpageIds : existingFanpageId ? [existingFanpageId] : [])
                .map((id) => String(id || '').trim())
                .filter(Boolean)),
        ];
        if (ids.length === 0) {
            throw new common_1.BadRequestException('Vui lòng chọn ít nhất một Fanpage trước khi đăng');
        }
        const pages = await this.prisma.autoPostFacebookPage.findMany({
            where: {
                id: { in: ids },
                userId,
                connection: { organizationId },
            },
        });
        if (pages.length !== ids.length) {
            throw new common_1.NotFoundException('Một hoặc nhiều Fanpage không tồn tại hoặc không thuộc tổ chức của bạn');
        }
        // Preserve requested order
        const byId = new Map(pages.map((p) => [p.id, p]));
        return ids.map((id) => {
            const p = byId.get(id);
            return { id: p.id, pageId: p.pageId, pageName: p.pageName };
        });
    }
    /** Clone AutoPost per Fanpage — mỗi page có postId / job / status / log riêng. */
    async ensurePostsForFanpages(userId, organizationId, source, targets) {
        const postIds = [];
        for (let i = 0; i < targets.length; i++) {
            const target = targets[i];
            const canReuseSource = i === 0 &&
                (!source.fanpageId || source.fanpageId === target.id) &&
                source.status !== database_1.AutoPostStatus.PUBLISHED &&
                source.status !== database_1.AutoPostStatus.PUBLISHING;
            if (canReuseSource) {
                await this.prisma.autoPost.update({
                    where: { id: source.id },
                    data: {
                        fanpageId: target.id,
                        fanpagePageId: target.pageId,
                        fanpageName: target.pageName,
                        status: database_1.AutoPostStatus.DRAFT,
                        errorMessage: null,
                    },
                });
                postIds.push(source.id);
                continue;
            }
            const clone = await this.prisma.autoPost.create({
                data: {
                    userId,
                    organizationId,
                    fanpageId: target.id,
                    fanpagePageId: target.pageId,
                    fanpageName: target.pageName,
                    postType: source.postType,
                    topic: source.topic,
                    caption: source.caption,
                    imageUrl: source.imageUrl,
                    linkUrl: source.linkUrl,
                    hashtags: source.hashtags,
                    cta: source.cta,
                    spaService: source.spaService,
                    industryId: source.industryId,
                    industryName: source.industryName,
                    customIndustry: source.customIndustry,
                    targetAudience: source.targetAudience,
                    tone: source.tone,
                    promotion: source.promotion,
                    status: database_1.AutoPostStatus.DRAFT,
                },
            });
            postIds.push(clone.id);
        }
        return postIds;
    }
    async cancelSchedule(userId, organizationId, postId) {
        const post = await this.requireOwnedPost(userId, organizationId, postId);
        if (post.status !== database_1.AutoPostStatus.SCHEDULED) {
            throw new common_1.BadRequestException('Bài không ở trạng thái đã lên lịch');
        }
        const job = await this.autoPostQueue.getJob(`auto-post-${postId}`);
        if (job)
            await job.remove();
        const updated = await this.prisma.autoPost.update({
            where: { id: postId },
            data: {
                status: database_1.AutoPostStatus.CANCELLED,
                scheduledAt: null,
            },
        });
        return this.serializePost(updated);
    }
    async retry(userId, organizationId, postId) {
        const post = await this.requireOwnedPost(userId, organizationId, postId);
        if (post.status !== database_1.AutoPostStatus.FAILED) {
            throw new common_1.BadRequestException('Chỉ có thể thử lại bài ở trạng thái lỗi');
        }
        if ((0, auto_post_publish_errors_1.isPermanentPublishError)(post.errorMessage)) {
            throw new common_1.BadRequestException(post.errorMessage?.includes('MISSING_PERMISSION')
                ? 'MISSING_PERMISSION: Không thể thử lại — thiếu quyền pages_manage_posts. Kết nối lại Fanpage.'
                : 'NEEDS_RECONNECT: Không thể thử lại — token hết hạn hoặc lỗi quyền. Kết nối lại Fanpage.');
        }
        return this.publishNow(userId, organizationId, postId);
    }
    /** Called by worker for scheduled posts (API-side helper / tests) */
    async publishScheduledPost(postId, userId, organizationId) {
        const post = await this.prisma.autoPost.findFirst({
            where: { id: postId, userId, organizationId },
        });
        if (!post)
            return { skipped: true, reason: 'not_found' };
        if (post.status === database_1.AutoPostStatus.PUBLISHED && post.facebookPostId) {
            return { ok: true, facebookPostId: post.facebookPostId, idempotent: true };
        }
        if (post.status !== database_1.AutoPostStatus.SCHEDULED) {
            return { skipped: true, reason: 'not_scheduled' };
        }
        if (!post.approvedAt) {
            await this.prisma.autoPost.update({
                where: { id: postId },
                data: { status: database_1.AutoPostStatus.FAILED, errorMessage: 'Bài chưa được duyệt' },
            });
            return { skipped: true, reason: 'not_approved' };
        }
        const claimed = await this.prisma.autoPost.updateMany({
            where: {
                id: postId,
                userId,
                organizationId,
                status: database_1.AutoPostStatus.SCHEDULED,
                facebookPostId: null,
            },
            data: { status: database_1.AutoPostStatus.PUBLISHING },
        });
        if (claimed.count !== 1) {
            return { skipped: true, reason: 'already_claimed' };
        }
        try {
            const published = await this.executePublish(userId, organizationId, post);
            await this.prisma.autoPost.update({
                where: { id: postId },
                data: {
                    status: database_1.AutoPostStatus.PUBLISHED,
                    publishedAt: new Date(),
                    facebookPostId: published.id,
                    facebookPermalink: published.permalinkUrl,
                    errorMessage: null,
                },
            });
            await this.prisma.autoPostPublishLog.create({
                data: {
                    userId,
                    postId,
                    action: 'scheduled_publish',
                    status: 'success',
                    facebookPostId: published.id,
                },
            });
            return { ok: true, facebookPostId: published.id };
        }
        catch (e) {
            const raw = e instanceof Error ? e.message : 'Đăng bài thất bại';
            const msg = (0, auto_post_publish_errors_1.sanitizePublishErrorMessage)(raw);
            await this.facebook.logApiError(userId, 'scheduled_publish', msg, postId);
            await this.prisma.autoPost.update({
                where: { id: postId },
                data: { status: database_1.AutoPostStatus.FAILED, errorMessage: msg },
            });
            await this.prisma.autoPostPublishLog.create({
                data: {
                    userId,
                    postId,
                    action: 'scheduled_publish',
                    status: 'failed',
                    errorMessage: msg,
                },
            });
            if ((0, auto_post_publish_errors_1.isPermanentPublishError)(msg)) {
                return { failed: true, permanent: true, error: msg };
            }
            throw e;
        }
    }
    /** Worker scan fallback for overdue scheduled posts */
    async processDueScheduledPosts() {
        const due = await this.prisma.autoPost.findMany({
            where: {
                status: database_1.AutoPostStatus.SCHEDULED,
                scheduledAt: { lte: new Date() },
                approvedAt: { not: null },
            },
            take: 20,
        });
        let processed = 0;
        for (const post of due) {
            try {
                await this.publishScheduledPost(post.id, post.userId, post.organizationId);
                processed++;
            }
            catch {
                /* logged in publishScheduledPost */
            }
        }
        return { due: due.length, processed };
    }
    async executePublish(userId, organizationId, post) {
        if (!post.fanpageId)
            throw new common_1.BadRequestException('Chưa chọn Fanpage');
        if (!post.caption?.trim())
            throw new common_1.BadRequestException('Nội dung bài đăng trống');
        const { pageId, accessToken } = await this.facebook.getPageAccessToken(userId, organizationId, post.fanpageId);
        await new database_2.PlanPolicy(this.prisma).consume(organizationId, 'posts', `post:${post.id}`);
        const result = await this.meta.publishPagePost(pageId, accessToken, {
            message: post.caption.trim(),
            link: post.linkUrl ?? undefined,
            imageUrl: post.imageUrl ?? undefined,
        });
        return { id: result.id, permalinkUrl: result.permalinkUrl ?? null };
    }
    assertPublishable(post) {
        if (!post.fanpageId)
            throw new common_1.BadRequestException('Vui lòng chọn Fanpage trước khi đăng');
        if (!post.caption?.trim())
            throw new common_1.BadRequestException('Nội dung bài đăng không được trống');
        if (post.status === database_1.AutoPostStatus.PUBLISHED || post.facebookPostId) {
            // Idempotent path handled in publishNow; here for schedule/assert
            if (post.status === database_1.AutoPostStatus.PUBLISHED) {
                throw new common_1.BadRequestException('Bài đã được đăng');
            }
        }
        if (post.status === database_1.AutoPostStatus.PUBLISHING) {
            throw new common_1.BadRequestException('Bài đang được đăng');
        }
    }
    async buildPostData(user, dto, fanpage) {
        let media;
        try {
            media = (0, auto_post_media_util_1.normalizePublishMedia)({
                imageUrl: dto.imageUrl,
                linkUrl: dto.linkUrl,
            });
        }
        catch (e) {
            throw new common_1.BadRequestException(e instanceof Error ? e.message : 'Media không hợp lệ');
        }
        const custom = dto.customIndustry?.trim() || null;
        let industryId = null;
        let industryName = null;
        let customIndustry = null;
        if (custom) {
            customIndustry = custom;
            industryName = custom;
        }
        else if (dto.industryId) {
            const industry = await this.prisma.contentIndustry.findFirst({
                where: { id: dto.industryId, isActive: true },
            });
            if (!industry)
                throw new common_1.BadRequestException('industryId không hợp lệ hoặc đã ẩn');
            industryId = industry.id;
            industryName = industry.name;
        }
        else if (dto.industryName?.trim()) {
            industryName = dto.industryName.trim();
        }
        return {
            userId: user.id,
            organizationId: user.organizationId,
            fanpageId: fanpage?.id ?? null,
            fanpagePageId: fanpage?.pageId ?? null,
            fanpageName: fanpage?.pageName ?? null,
            postType: dto.postType,
            topic: dto.topic.trim(),
            caption: dto.caption.trim(),
            imageUrl: media.imageUrl ?? null,
            linkUrl: media.linkUrl ?? null,
            hashtags: dto.hashtags?.trim() || null,
            cta: dto.cta?.trim() || null,
            spaService: dto.spaService?.trim() || null,
            industryId,
            industryName,
            customIndustry,
            targetAudience: dto.targetAudience?.trim() || null,
            tone: dto.tone?.trim() || null,
            promotion: dto.promotion?.trim() || null,
        };
    }
    async resolveFanpage(userId, organizationId, fanpageId) {
        if (!fanpageId)
            return null;
        const page = await this.prisma.autoPostFacebookPage.findFirst({
            where: { id: fanpageId, userId, connection: { organizationId } },
        });
        if (!page)
            throw new common_1.NotFoundException('Fanpage không tồn tại');
        return { id: page.id, pageId: page.pageId, pageName: page.pageName };
    }
    async requireOwnedPost(userId, organizationId, id) {
        const post = await this.prisma.autoPost.findFirst({
            where: { id, userId, organizationId },
        });
        if (!post)
            throw new common_1.NotFoundException('Bài đăng không tồn tại');
        return post;
    }
    serializePost(post) {
        return {
            ...post,
            industryId: post.industryId ?? null,
            industryName: post.industryName ?? null,
            customIndustry: post.customIndustry ?? null,
            facebookPermalink: post.facebookPermalink ?? null,
            facebookPostUrl: post.facebookPermalink ||
                (0, auto_post_publish_errors_1.buildFacebookPostUrl)(post.facebookPostId, post.fanpagePageId),
            scheduledAt: post.scheduledAt?.toISOString() ?? null,
            publishedAt: post.publishedAt?.toISOString() ?? null,
            approvedAt: post.approvedAt?.toISOString() ?? null,
            createdAt: post.createdAt.toISOString(),
            updatedAt: post.updatedAt.toISOString(),
        };
    }
};
exports.AutoPostService = AutoPostService;
exports.AutoPostService = AutoPostService = AutoPostService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(5, (0, common_1.Inject)(queue_constants_1.AUTO_POST_QUEUE)),
    __param(7, (0, common_1.Optional)()),
    __param(7, (0, common_1.Inject)(redis_constants_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        openai_service_1.OpenAiService,
        auto_post_facebook_service_1.AutoPostFacebookService,
        auto_post_meta_service_1.AutoPostMetaService,
        meta_graph_metrics_service_1.MetaGraphMetricsService, Function, queue_enqueue_service_1.QueueEnqueueService, Function])
], AutoPostService);
const database_2 = require("@marketingspa/database");
