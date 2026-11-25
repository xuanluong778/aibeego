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
var MetaFanpageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaFanpageService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const common_2 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const queue_constants_1 = require("../queue/queue.constants");
const meta_fanpage_queue_1 = require("./meta-fanpage.queue");
const meta_fanpage_access_1 = require("./meta-fanpage-access");
let MetaFanpageService = MetaFanpageService_1 = class MetaFanpageService {
    config;
    prisma;
    autoPostQueue;
    logger = new common_1.Logger(MetaFanpageService_1.name);
    constructor(config, prisma, autoPostQueue) {
        this.config = config;
        this.prisma = prisma;
        this.autoPostQueue = autoPostQueue;
    }
    get graphVersion() {
        return (this.config.get('META_GRAPH_VERSION')?.trim() ||
            this.config.get('META_API_VERSION')?.trim() ||
            'v21.0');
    }
    get pageId() {
        return this.config.get('META_PAGE_ID')?.trim() || undefined;
    }
    /** Chỉ dùng nội bộ — tuyệt đối không trả về API / log. */
    get pageAccessToken() {
        return this.config.get('META_PAGE_ACCESS_TOKEN')?.trim() || undefined;
    }
    isConfigured() {
        return Boolean(this.pageId && this.pageAccessToken);
    }
    /** Chỉ dùng nội bộ backend (Auto Post sync) — không expose ra HTTP. */
    getEnvCredentials() {
        if (!this.isConfigured())
            return null;
        return { pageId: this.pageId, accessToken: this.pageAccessToken };
    }
    maskPageId(pageId) {
        if (pageId.length <= 8)
            return `${pageId.slice(0, 2)}***`;
        return `${pageId.slice(0, 4)}***${pageId.slice(-4)}`;
    }
    async getStatus() {
        if (!this.isConfigured()) {
            return {
                connected: false,
                configured: false,
                pageId: null,
                pageIdMasked: null,
                pageName: null,
                graphVersion: this.graphVersion,
                message: 'Chưa cấu hình META_PAGE_ID và Page Token (backend .env).',
            };
        }
        const pageId = this.pageId;
        try {
            const page = await this.graphGet(`/${pageId}`, { fields: 'id,name' });
            return {
                connected: true,
                configured: true,
                pageId: page.id,
                pageIdMasked: this.maskPageId(page.id),
                pageName: page.name ?? null,
                graphVersion: this.graphVersion,
                message: 'Fanpage đã kết nối.',
            };
        }
        catch (e) {
            const mapped = this.mapMetaError(e);
            return {
                connected: false,
                configured: true,
                pageId,
                pageIdMasked: this.maskPageId(pageId),
                pageName: null,
                graphVersion: this.graphVersion,
                message: mapped.message,
                errorCode: mapped.errorCode,
            };
        }
    }
    async publishNow(user, dto) {
        (0, meta_fanpage_access_1.assertCanUseServerEnvFanpage)(user, (k) => this.config.get(k) ?? process.env[k]);
        this.ensureConfigured();
        const message = dto.message.trim();
        const link = dto.link?.trim() || undefined;
        const imageUrl = dto.imageUrl?.trim() || undefined;
        if (!message) {
            throw new common_1.BadRequestException('Nội dung bài đăng không được trống');
        }
        if (link && imageUrl) {
            throw new common_1.BadRequestException('Chỉ hỗ trợ một trong hai: link hoặc ảnh (không gửi cả hai cùng lúc).');
        }
        this.assertHttpUrl(link, 'Link');
        this.assertHttpUrl(imageUrl, 'Ảnh');
        const pageId = this.pageId;
        const status = await this.getStatus();
        const pageName = status.pageName ?? 'Fanpage';
        const history = await this.prisma.autoPost.create({
            data: {
                userId: user.id,
                organizationId: user.organizationId,
                fanpageId: null,
                fanpagePageId: pageId,
                fanpageName: pageName,
                postType: database_1.AutoPostType.SPA_SALES,
                topic: message.slice(0, 120) || 'Đăng Fanpage',
                caption: message,
                imageUrl: imageUrl ?? null,
                linkUrl: link ?? null,
                status: database_1.AutoPostStatus.PUBLISHING,
                approvedAt: new Date(),
            },
        });
        try {
            const result = imageUrl
                ? await this.publishPhoto(pageId, message, imageUrl)
                : await this.publishFeed(pageId, message, link);
            const published = await this.prisma.autoPost.update({
                where: { id: history.id },
                data: {
                    status: database_1.AutoPostStatus.PUBLISHED,
                    publishedAt: new Date(),
                    facebookPostId: result.id,
                    errorMessage: null,
                    fanpageName: pageName,
                },
            });
            await this.prisma.autoPostPublishLog.create({
                data: {
                    userId: user.id,
                    postId: published.id,
                    action: 'meta_fanpage_publish_now',
                    status: 'success',
                    facebookPostId: result.id,
                },
            });
            await this.prisma.autoPostApiLog.create({
                data: {
                    userId: user.id,
                    postId: published.id,
                    action: 'meta_fanpage_publish',
                    statusCode: 200,
                    message: `Đã đăng bài ${result.id}`,
                },
            });
            return {
                success: true,
                postId: published.id,
                facebookPostId: result.id,
                publishedAt: published.publishedAt,
                pageIdMasked: this.maskPageId(pageId),
                pageName,
                status: published.status,
            };
        }
        catch (e) {
            const mapped = this.mapMetaError(e);
            await this.prisma.autoPost.update({
                where: { id: history.id },
                data: {
                    status: database_1.AutoPostStatus.FAILED,
                    errorMessage: mapped.message,
                },
            });
            await this.prisma.autoPostPublishLog.create({
                data: {
                    userId: user.id,
                    postId: history.id,
                    action: 'meta_fanpage_publish_now',
                    status: 'failed',
                    errorMessage: mapped.message,
                },
            });
            await this.prisma.autoPostApiLog.create({
                data: {
                    userId: user.id,
                    postId: history.id,
                    action: 'meta_fanpage_publish',
                    statusCode: mapped.statusCode,
                    errorCode: mapped.errorCode,
                    message: mapped.message,
                },
            });
            throw mapped.exception;
        }
    }
    /**
     * Chuẩn bị job BullMQ cho lịch đăng sau này — chưa gọi từ API public.
     * Worker sẽ xử lý job `meta-fanpage-publish` khi bật schedule.
     */
    async enqueueScheduledPublish(data, delayMs) {
        const job = await this.autoPostQueue.add(meta_fanpage_queue_1.META_FANPAGE_PUBLISH_JOB, data, {
            delay: Math.max(0, delayMs),
            removeOnComplete: true,
            jobId: data.historyPostId
                ? `meta-fanpage-${data.historyPostId}`
                : undefined,
        });
        return { jobId: String(job.id) };
    }
    ensureConfigured() {
        if (!this.isConfigured()) {
            throw new common_1.ServiceUnavailableException('Chưa cấu hình META_PAGE_ID và Page Token trên server (.env).');
        }
    }
    assertHttpUrl(value, label) {
        if (!value)
            return;
        try {
            const u = new URL(value);
            if (u.protocol !== 'http:' && u.protocol !== 'https:') {
                throw new Error('bad protocol');
            }
        }
        catch {
            throw new common_1.BadRequestException(`${label} phải là URL http/https hợp lệ`);
        }
    }
    async publishFeed(pageId, message, link) {
        const body = { message };
        if (link)
            body.link = link;
        return this.graphPost(`/${pageId}/feed`, body);
    }
    async publishPhoto(pageId, caption, imageUrl) {
        return this.graphPost(`/${pageId}/photos`, {
            url: imageUrl,
            caption,
        });
    }
    graphUrl(path) {
        const clean = path.startsWith('/') ? path : `/${path}`;
        return `https://graph.facebook.com/${this.graphVersion}${clean}`;
    }
    async graphGet(path, query = {}) {
        const token = this.pageAccessToken;
        const params = new URLSearchParams({ ...query, access_token: token });
        const url = `${this.graphUrl(path)}?${params.toString()}`;
        const res = await fetch(url);
        return this.parseGraphResponse(res);
    }
    async graphPost(path, body) {
        const token = this.pageAccessToken;
        const params = new URLSearchParams({ ...body, access_token: token });
        const res = await fetch(this.graphUrl(path), {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });
        return this.parseGraphResponse(res);
    }
    async parseGraphResponse(res) {
        const raw = (await res.json());
        if (!res.ok || raw.error) {
            const msg = raw.error?.message ?? `Meta API error (${res.status})`;
            // Không log URL/body (có thể chứa token)
            this.logger.warn(`Meta Graph thất bại status=${res.status} code=${raw.error?.code ?? 'n/a'} type=${raw.error?.type ?? 'n/a'}`);
            const err = new Error(msg);
            err.metaCode = raw.error?.code;
            err.metaType = raw.error?.type;
            err.httpStatus = res.status;
            throw err;
        }
        return raw;
    }
    mapMetaError(e) {
        const err = e;
        const code = err.metaCode;
        const msg = err.message || 'Meta API error';
        if (code === 190 || /session has expired|invalid oauth|cannot parse access token/i.test(msg)) {
            const message = 'Token Fanpage hết hạn hoặc không hợp lệ. Cập nhật META_PAGE_ACCESS_TOKEN trên server.';
            return {
                message,
                errorCode: 'TOKEN_INVALID',
                statusCode: 401,
                exception: new common_1.UnauthorizedException(message),
            };
        }
        if (code === 200 ||
            code === 10 ||
            /permission|(#200)|pages_manage_posts|not authorized/i.test(msg)) {
            const message = 'Thiếu quyền đăng bài trên Fanpage (cần pages_manage_posts). Kiểm tra token Page.';
            return {
                message,
                errorCode: 'PERMISSION_DENIED',
                statusCode: 400,
                exception: new common_1.BadRequestException(message),
            };
        }
        if (code === 100 ||
            /unsupported get request|does not exist|page id/i.test(msg)) {
            const message = 'Page ID không hợp lệ hoặc token không thuộc Fanpage này. Kiểm tra META_PAGE_ID.';
            return {
                message,
                errorCode: 'INVALID_PAGE_ID',
                statusCode: 400,
                exception: new common_1.BadRequestException(message),
            };
        }
        if (code === 4 || code === 17 || code === 32 || /rate limit|too many calls/i.test(msg)) {
            const message = 'Meta đang giới hạn tần suất (rate limit). Thử lại sau vài phút.';
            return {
                message,
                errorCode: 'RATE_LIMIT',
                statusCode: 503,
                exception: new common_1.ServiceUnavailableException(message),
            };
        }
        const message = `Meta API: ${msg}`;
        return {
            message,
            errorCode: code != null ? String(code) : 'META_ERROR',
            statusCode: err.httpStatus && err.httpStatus >= 400 ? err.httpStatus : 400,
            exception: new common_1.BadRequestException(message),
        };
    }
};
exports.MetaFanpageService = MetaFanpageService;
exports.MetaFanpageService = MetaFanpageService = MetaFanpageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_2.Inject)(queue_constants_1.AUTO_POST_QUEUE)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService, Function])
], MetaFanpageService);
