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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdUrlAnalyzeService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const shared_1 = require("@marketingspa/shared");
const ssrf_fetch_1 = require("@marketingspa/shared/dist/ssrf-fetch");
const redis_constants_1 = require("../redis/redis.constants");
const queue_constants_1 = require("../queue/queue.constants");
const rate_limit_service_1 = require("../common/services/rate-limit.service");
const queue_enqueue_service_1 = require("../common/services/queue-enqueue.service");
let AdUrlAnalyzeService = class AdUrlAnalyzeService {
    redis;
    queue;
    rateLimit;
    queueEnqueue;
    constructor(redis, queue, rateLimit, queueEnqueue) {
        this.redis = redis;
        this.queue = queue;
        this.rateLimit = rateLimit;
        this.queueEnqueue = queueEnqueue;
    }
    async save(job) {
        await this.redis.set((0, shared_1.adUrlAnalyzeRedisKey)(job.id), JSON.stringify(job), 'EX', shared_1.AD_URL_ANALYZE_LIMITS.redisTtlSeconds);
    }
    async load(jobId) {
        const raw = await this.redis.get((0, shared_1.adUrlAnalyzeRedisKey)(jobId));
        if (!raw)
            return null;
        try {
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    async start(user, body) {
        this.rateLimit.assertWithinLimit(`ad-url-analyze:user:${user.organizationId}:${user.id}`, shared_1.AD_URL_ANALYZE_LIMITS.rateLimitMax, shared_1.AD_URL_ANALYZE_LIMITS.rateLimitWindowMs, 'Bạn đã phân tích quá nhiều link trong thời gian ngắn. Thử lại sau vài phút.');
        this.rateLimit.assertWithinLimit(`ad-url-analyze:org:${user.organizationId}`, shared_1.AD_URL_ANALYZE_LIMITS.orgRateLimitMax, shared_1.AD_URL_ANALYZE_LIMITS.orgRateLimitWindowMs, 'Tổ chức đã đạt giới hạn phân tích link. Thử lại sau vài phút.');
        let parsedUrl;
        try {
            parsedUrl = await (0, ssrf_fetch_1.assertPublicHttpUrl)(body.sourceUrl);
        }
        catch (e) {
            if (e instanceof ssrf_fetch_1.SsrfValidationError) {
                throw new common_1.BadRequestException({ message: e.message, code: e.code });
            }
            throw e;
        }
        const id = (0, crypto_1.randomUUID)();
        const now = new Date().toISOString();
        const job = {
            id,
            organizationId: user.organizationId,
            userId: user.id,
            status: 'pending',
            stage: 'queued',
            stageLabel: shared_1.AD_URL_ANALYZE_STAGE_LABELS.queued,
            progressPercent: 5,
            sourceUrl: parsedUrl.toString(),
            adPostKind: body.adPostKind === 'service' ? 'service' : 'product',
            errorCode: null,
            errorMessage: null,
            result: null,
            createdAt: now,
            updatedAt: now,
            completedAt: null,
        };
        await this.save(job);
        const payload = shared_1.adUrlAnalyzeQueuePayloadSchema.parse({
            jobId: id,
            organizationId: user.organizationId,
            userId: user.id,
            sourceUrl: parsedUrl.toString(),
            adPostKind: job.adPostKind,
            brandName: body.brandName?.trim() || undefined,
        });
        await this.queueEnqueue.add(this.queue, 'ad-url-analyze', payload, {
            jobId: `ad-url-analyze-${id}`,
            attempts: 2,
            backoff: { type: 'exponential', delay: 3000 },
            removeOnComplete: 100,
            removeOnFail: 50,
        });
        return job;
    }
    async get(user, jobId) {
        const job = await this.load(jobId);
        if (!job)
            throw new common_1.NotFoundException('Không tìm thấy job phân tích link.');
        if (job.organizationId !== user.organizationId || job.userId !== user.id) {
            throw new common_1.ForbiddenException('Không có quyền xem job này.');
        }
        return job;
    }
    async cancel(user, jobId) {
        const job = await this.get(user, jobId);
        if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
            return job;
        }
        const next = {
            ...job,
            status: 'cancelled',
            stage: 'cancelled',
            stageLabel: shared_1.AD_URL_ANALYZE_STAGE_LABELS.cancelled,
            progressPercent: 100,
            updatedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            errorCode: 'CANCELLED',
            errorMessage: 'Người dùng đã hủy phân tích.',
        };
        await this.save(next);
        try {
            const bullJob = await this.queue.getJob(`ad-url-analyze-${jobId}`);
            if (bullJob)
                await bullJob.remove();
        }
        catch {
            /* ignore */
        }
        return next;
    }
};
exports.AdUrlAnalyzeService = AdUrlAnalyzeService;
exports.AdUrlAnalyzeService = AdUrlAnalyzeService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_constants_1.REDIS_CLIENT)),
    __param(1, (0, common_1.Inject)(queue_constants_1.AD_URL_ANALYZE_QUEUE)),
    __metadata("design:paramtypes", [Function, Function, rate_limit_service_1.RateLimitService,
        queue_enqueue_service_1.QueueEnqueueService])
], AdUrlAnalyzeService);
