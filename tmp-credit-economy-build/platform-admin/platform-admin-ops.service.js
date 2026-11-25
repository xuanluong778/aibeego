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
exports.PlatformAdminOpsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const redis_constants_1 = require("../redis/redis.constants");
const queue_constants_1 = require("../queue/queue.constants");
const queue_enqueue_service_1 = require("../common/services/queue-enqueue.service");
const token_security_util_1 = require("../common/utils/token-security.util");
const shared_1 = require("@marketingspa/shared");
const WORKER_HEARTBEAT_KEY = 'marketingspa:worker:heartbeat';
let PlatformAdminOpsService = class PlatformAdminOpsService {
    prisma;
    audit;
    config;
    queueEnqueue;
    redis;
    adsSyncQueue;
    adsActionQueue;
    offlineQueue;
    constructor(prisma, audit, config, queueEnqueue, redis, adsSyncQueue, adsActionQueue, offlineQueue) {
        this.prisma = prisma;
        this.audit = audit;
        this.config = config;
        this.queueEnqueue = queueEnqueue;
        this.redis = redis;
        this.adsSyncQueue = adsSyncQueue;
        this.adsActionQueue = adsActionQueue;
        this.offlineQueue = offlineQueue;
    }
    async listUsage(query) {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 20;
        const where = {};
        if (query.organizationId)
            where.id = query.organizationId;
        if (query.q?.trim()) {
            const q = query.q.trim();
            where.OR = [
                { name: { contains: q, mode: 'insensitive' } },
                { slug: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
            ];
        }
        const [total, orgs] = await Promise.all([
            this.prisma.organization.count({ where }),
            this.prisma.organization.findMany({
                where,
                select: { id: true, name: true, slug: true, email: true, isActive: true },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
        ]);
        const month = new Date().toISOString().slice(0, 7);
        const items = await Promise.all(orgs.map(async (org) => {
            const [leads, posts, postsWithImage, chatbot, adSpend, creditWallet, creditDebits, aiReports,] = await Promise.all([
                this.prisma.lead.count({ where: { organizationId: org.id } }),
                this.prisma.autoPost.count({ where: { organizationId: org.id } }),
                this.prisma.autoPost.count({
                    where: { organizationId: org.id, imageUrl: { not: null } },
                }),
                this.prisma.chatbotUsage.aggregate({
                    where: { organizationId: org.id, month },
                    _sum: { aiReplies: true, creditsUsed: true },
                }),
                this.prisma.adInsight.aggregate({
                    where: { organizationId: org.id },
                    _sum: { spend: true },
                }),
                this.prisma.creditWallet.findUnique({ where: { organizationId: org.id } }),
                this.prisma.creditTransaction.aggregate({
                    where: { organizationId: org.id, type: 'USAGE' },
                    _sum: { amount: true },
                }),
                this.prisma.aiReport.count({ where: { organizationId: org.id } }),
            ]);
            const aiReplies = chatbot._sum.aiReplies ?? 0;
            const chatbotCredits = chatbot._sum.creditsUsed ?? 0;
            const adsSpend = Number(adSpend._sum.spend ?? 0);
            const creditCost = Number(creditDebits._sum?.amount ?? 0);
            return {
                organizationId: org.id,
                organization: org,
                month,
                usage: {
                    ai: { replies: aiReplies, reports: aiReports, chatbotCredits },
                    posts,
                    images: postsWithImage,
                    chatbot: { aiReplies, creditsUsed: chatbotCredits },
                    leads,
                    ads: { spend: adsSpend },
                    cost: {
                        creditDebits: creditCost,
                        creditBalance: Number(creditWallet?.balance ?? 0),
                        adsSpend,
                    },
                },
            };
        }));
        return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) || 1 };
    }
    async integrationsHealth() {
        const sepayConfigured = !!(this.config.get('SEPAY_API_TOKEN')?.trim() ||
            this.config.get('SEPAY_WEBHOOK_SECRET')?.trim());
        let redisOk = false;
        let workerOk = false;
        try {
            redisOk = (await this.redis.ping()) === 'PONG';
            if (redisOk) {
                const hb = await this.redis.get(WORKER_HEARTBEAT_KEY);
                if (hb) {
                    const age = Date.now() - parseInt(hb, 10);
                    workerOk = !Number.isNaN(age) && age < 120_000;
                }
            }
        }
        catch {
            redisOk = false;
            workerOk = false;
        }
        const queues = [
            { key: 'ADS_SYNC', queue: this.adsSyncQueue, name: shared_1.QUEUE_NAMES.ADS_SYNC },
            { key: 'ADS_ACTION', queue: this.adsActionQueue, name: shared_1.QUEUE_NAMES.ADS_ACTION },
            {
                key: 'OFFLINE_CONVERSION',
                queue: this.offlineQueue,
                name: shared_1.QUEUE_NAMES.OFFLINE_CONVERSION,
            },
        ];
        const bullmq = await Promise.all(queues.map(async (q) => {
            try {
                const counts = await q.queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
                return {
                    key: q.key,
                    name: q.name,
                    ok: true,
                    counts,
                };
            }
            catch (e) {
                return {
                    key: q.key,
                    name: q.name,
                    ok: false,
                    error: e instanceof Error ? e.message : 'queue_error',
                    counts: null,
                };
            }
        }));
        const [integrations, adConnections, messaging] = await Promise.all([
            this.prisma.integration.groupBy({
                by: ['provider', 'status'],
                _count: { _all: true },
            }),
            this.prisma.adConnection.groupBy({
                by: ['provider', 'status'],
                _count: { _all: true },
            }),
            this.prisma.messagingChannelConnection.groupBy({
                by: ['channel', 'status'],
                _count: { _all: true },
            }),
        ]);
        const fold = (rows) => {
            const map = {};
            for (const r of rows) {
                const bucket = map[r.key] ?? (map[r.key] = {});
                bucket[r.status] = (bucket[r.status] ?? 0) + r.count;
            }
            return map;
        };
        const byIntegrationProvider = fold(integrations.map((i) => ({
            key: i.provider,
            status: i.status,
            count: i._count._all,
        })));
        const byAdProvider = fold(adConnections.map((a) => ({
            key: String(a.provider),
            status: String(a.status),
            count: a._count._all,
        })));
        const byMessagingChannel = fold(messaging.map((m) => ({
            key: String(m.channel),
            status: String(m.status),
            count: m._count._all,
        })));
        return {
            sepay: {
                configured: sepayConfigured,
                // Không trả token/secret — chỉ trạng thái cấu hình
                authModes: ['API_KEY', 'HMAC'],
            },
            redis: { ok: redisOk },
            worker: { ok: workerOk },
            bullmq,
            meta: {
                integrations: byIntegrationProvider[database_1.IntegrationProvider.META_ADS] ?? {},
                adConnections: byAdProvider.META ?? {},
                messaging: byMessagingChannel.MESSENGER ?? {},
            },
            google: {
                integrations: byIntegrationProvider[database_1.IntegrationProvider.GOOGLE_ADS] ?? {},
                adConnections: byAdProvider.GOOGLE ?? {},
            },
            zalo: {
                integrations: byIntegrationProvider[database_1.IntegrationProvider.ZALO_OA] ?? {},
                messaging: byMessagingChannel.ZALO ?? {},
            },
            counts: {
                integrations: byIntegrationProvider,
                adConnections: byAdProvider,
                messaging: byMessagingChannel,
            },
        };
    }
    async listFailedJobs(query) {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 20;
        const type = query.type || 'all';
        const [adsSync, adsAction, offline] = await Promise.all([
            type === 'all' || type === 'ads_sync'
                ? this.prisma.adsSyncJob.findMany({
                    where: {
                        status: database_1.AdsSyncJobStatus.FAILED,
                        ...(query.organizationId ? { organizationId: query.organizationId } : {}),
                    },
                    orderBy: { updatedAt: 'desc' },
                    take: pageSize,
                    select: {
                        id: true,
                        organizationId: true,
                        platform: true,
                        status: true,
                        attemptCount: true,
                        maxAttempts: true,
                        lastError: true,
                        bullJobId: true,
                        createdAt: true,
                        updatedAt: true,
                        organization: { select: { id: true, name: true, slug: true } },
                    },
                })
                : Promise.resolve([]),
            type === 'all' || type === 'ads_action'
                ? this.prisma.adsActionRequest.findMany({
                    where: {
                        status: database_1.AdsActionRequestStatus.FAILED,
                        ...(query.organizationId ? { organizationId: query.organizationId } : {}),
                    },
                    orderBy: { updatedAt: 'desc' },
                    take: pageSize,
                    select: {
                        id: true,
                        organizationId: true,
                        platform: true,
                        actionType: true,
                        status: true,
                        attemptCount: true,
                        maxAttempts: true,
                        lastError: true,
                        bullJobId: true,
                        createdAt: true,
                        updatedAt: true,
                        organization: { select: { id: true, name: true, slug: true } },
                    },
                })
                : Promise.resolve([]),
            type === 'all' || type === 'offline_conversion'
                ? this.prisma.offlineConversionJob.findMany({
                    where: {
                        status: database_1.OfflineConversionStatus.FAILED,
                        ...(query.organizationId ? { organizationId: query.organizationId } : {}),
                    },
                    orderBy: { createdAt: 'desc' },
                    take: pageSize,
                    select: {
                        id: true,
                        organizationId: true,
                        provider: true,
                        status: true,
                        attemptCount: true,
                        lastError: true,
                        createdAt: true,
                        organization: { select: { id: true, name: true, slug: true } },
                    },
                })
                : Promise.resolve([]),
        ]);
        const items = [
            ...adsSync.map((j) => ({
                type: 'ads_sync',
                id: j.id,
                organizationId: j.organizationId,
                organization: j.organization,
                status: j.status,
                attemptCount: j.attemptCount,
                maxAttempts: j.maxAttempts,
                lastError: j.lastError,
                bullJobId: j.bullJobId,
                platform: j.platform,
                createdAt: j.createdAt,
                updatedAt: j.updatedAt,
                retryable: true,
            })),
            ...adsAction.map((j) => ({
                type: 'ads_action',
                id: j.id,
                organizationId: j.organizationId,
                organization: j.organization,
                status: j.status,
                attemptCount: j.attemptCount,
                maxAttempts: j.maxAttempts,
                lastError: j.lastError,
                bullJobId: j.bullJobId,
                platform: j.platform,
                actionType: j.actionType,
                createdAt: j.createdAt,
                updatedAt: j.updatedAt,
                retryable: true,
            })),
            ...offline.map((j) => ({
                type: 'offline_conversion',
                id: j.id,
                organizationId: j.organizationId,
                organization: j.organization,
                status: j.status,
                attemptCount: j.attemptCount,
                maxAttempts: null,
                lastError: j.lastError,
                bullJobId: null,
                provider: j.provider,
                createdAt: j.createdAt,
                updatedAt: j.createdAt,
                retryable: true,
            })),
        ].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
        // Lightweight paging over merged list
        const sliced = items.slice((page - 1) * pageSize, page * pageSize);
        return {
            items: sliced,
            total: items.length,
            page,
            pageSize,
            totalPages: Math.ceil(items.length / pageSize) || 1,
        };
    }
    async retryJob(actor, type, id, dto, ipAddress) {
        if (!['ads_sync', 'ads_action', 'offline_conversion'].includes(type)) {
            throw new common_1.BadRequestException('Loại job không hỗ trợ retry');
        }
        if (type === 'ads_sync') {
            const job = await this.prisma.adsSyncJob.findUnique({ where: { id } });
            if (!job)
                throw new common_1.NotFoundException('Không tìm thấy ads_sync job');
            if (job.status !== database_1.AdsSyncJobStatus.FAILED) {
                throw new common_1.BadRequestException('Chỉ retry job FAILED');
            }
            const before = {
                status: job.status,
                attemptCount: job.attemptCount,
                lastError: job.lastError,
            };
            const updated = await this.prisma.adsSyncJob.update({
                where: { id },
                data: {
                    status: database_1.AdsSyncJobStatus.QUEUED,
                    progressPercent: 0,
                    progressMessage: 'Admin retry',
                    lastError: null,
                    startedAt: null,
                    finishedAt: null,
                    attemptCount: 0,
                },
            });
            const dateFrom = job.dateFrom.toISOString().slice(0, 10);
            const dateTo = job.dateTo.toISOString().slice(0, 10);
            const payload = {
                organizationId: job.organizationId,
                connectionId: job.connectionId,
                accountId: job.accountId,
                dateFrom,
                dateTo,
                jobId: job.id,
                platform: job.platform === 'GOOGLE' ? 'GOOGLE' : 'META',
            };
            // Remove old bull job id collision
            try {
                const old = await this.adsSyncQueue.getJob(`ads-sync-${job.id}`);
                if (old)
                    await old.remove();
            }
            catch {
                /* ignore */
            }
            await this.queueEnqueue.add(this.adsSyncQueue, 'ads-sync', payload, {
                jobId: `ads-sync-${job.id}`,
                attempts: job.maxAttempts,
                backoff: { type: 'exponential', delay: 5_000 },
                removeOnComplete: 100,
                removeOnFail: 200,
            });
            await this.audit.log({
                organizationId: job.organizationId,
                userId: actor.id,
                action: 'ADMIN_JOB_RETRY',
                entityType: 'ADS_SYNC_JOB',
                entityId: id,
                ipAddress,
                metadata: {
                    reason: dto.reason,
                    result: 'queued',
                    before,
                    after: { status: updated.status, attemptCount: updated.attemptCount },
                    type,
                },
            });
            return { result: 'queued', type, id, before, after: { status: updated.status } };
        }
        if (type === 'ads_action') {
            const job = await this.prisma.adsActionRequest.findUnique({ where: { id } });
            if (!job)
                throw new common_1.NotFoundException('Không tìm thấy ads_action');
            if (job.status !== database_1.AdsActionRequestStatus.FAILED) {
                throw new common_1.BadRequestException('Chỉ retry job FAILED');
            }
            const before = {
                status: job.status,
                attemptCount: job.attemptCount,
                lastError: job.lastError,
            };
            try {
                const old = await this.adsActionQueue.getJob(`ads-action:${job.id}`);
                if (old)
                    await old.remove();
            }
            catch {
                /* ignore */
            }
            const payload = {
                organizationId: job.organizationId,
                actionRequestId: job.id,
            };
            const bull = await this.adsActionQueue.add('ads-action-execute', payload, {
                jobId: `ads-action:${job.id}`,
                attempts: job.maxAttempts,
                backoff: { type: 'exponential', delay: 3000 },
                removeOnComplete: 100,
                removeOnFail: 50,
            });
            const updated = await this.prisma.adsActionRequest.update({
                where: { id },
                data: {
                    status: database_1.AdsActionRequestStatus.QUEUED,
                    lastError: null,
                    bullJobId: String(bull.id),
                    attemptCount: 0,
                },
            });
            await this.audit.log({
                organizationId: job.organizationId,
                userId: actor.id,
                action: 'ADMIN_JOB_RETRY',
                entityType: 'ADS_ACTION_REQUEST',
                entityId: id,
                ipAddress,
                metadata: {
                    reason: dto.reason,
                    result: 'queued',
                    before,
                    after: { status: updated.status, bullJobId: updated.bullJobId },
                    type,
                },
            });
            return { result: 'queued', type, id, before, after: { status: updated.status } };
        }
        // offline_conversion
        const job = await this.prisma.offlineConversionJob.findUnique({ where: { id } });
        if (!job)
            throw new common_1.NotFoundException('Không tìm thấy offline conversion job');
        if (job.status !== database_1.OfflineConversionStatus.FAILED) {
            throw new common_1.BadRequestException('Chỉ retry job FAILED');
        }
        const before = {
            status: job.status,
            attemptCount: job.attemptCount,
            lastError: job.lastError,
        };
        const updated = await this.prisma.offlineConversionJob.update({
            where: { id },
            data: {
                status: database_1.OfflineConversionStatus.PENDING,
                lastError: null,
                nextRetryAt: new Date(),
            },
        });
        try {
            const old = await this.offlineQueue.getJob(`offline-conv-${job.id}`);
            if (old)
                await old.remove();
        }
        catch {
            /* ignore */
        }
        await this.queueEnqueue.add(this.offlineQueue, 'send-offline-conversion', { organizationId: job.organizationId, jobId: job.id }, {
            jobId: `offline-conv-${job.id}`,
            attempts: 5,
            backoff: { type: 'exponential', delay: 30_000 },
            removeOnComplete: 200,
            removeOnFail: 100,
        });
        await this.audit.log({
            organizationId: job.organizationId,
            userId: actor.id,
            action: 'ADMIN_JOB_RETRY',
            entityType: 'OFFLINE_CONVERSION_JOB',
            entityId: id,
            ipAddress,
            metadata: {
                reason: dto.reason,
                result: 'queued',
                before,
                after: { status: updated.status },
                type,
            },
        });
        return { result: 'queued', type, id, before, after: { status: updated.status } };
    }
    async listAuditLogs(query) {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 20;
        const where = {};
        if (query.organizationId)
            where.organizationId = query.organizationId;
        if (query.action?.trim())
            where.action = { contains: query.action.trim(), mode: 'insensitive' };
        if (query.entityType?.trim())
            where.entityType = query.entityType.trim();
        if (query.entityId?.trim())
            where.entityId = query.entityId.trim();
        if (query.userId?.trim())
            where.userId = query.userId.trim();
        if (query.q?.trim()) {
            const q = query.q.trim();
            where.OR = [
                { action: { contains: q, mode: 'insensitive' } },
                { entityType: { contains: q, mode: 'insensitive' } },
                { entityId: { contains: q } },
            ];
        }
        if (query.from || query.to) {
            where.createdAt = {};
            if (query.from)
                where.createdAt.gte = new Date(query.from);
            if (query.to)
                where.createdAt.lte = new Date(query.to);
        }
        const [total, rows] = await Promise.all([
            this.prisma.auditLog.count({ where }),
            this.prisma.auditLog.findMany({
                where,
                include: {
                    user: { select: { id: true, email: true, name: true, role: { select: { code: true } } } },
                    organization: { select: { id: true, name: true, slug: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
        ]);
        return {
            items: rows.map((r) => {
                const meta = ((0, token_security_util_1.redactForAudit)(r.metadata ?? {}) || {});
                return {
                    id: r.id,
                    createdAt: r.createdAt,
                    ipAddress: r.ipAddress,
                    requestId: r.requestId,
                    action: r.action,
                    entityType: r.entityType,
                    entityId: r.entityId,
                    organizationId: r.organizationId,
                    organization: r.organization,
                    admin: r.user
                        ? {
                            id: r.user.id,
                            email: r.user.email,
                            name: r.user.name,
                            role: r.user.role.code,
                        }
                        : null,
                    reason: typeof meta.reason === 'string' ? meta.reason : meta.note ?? null,
                    before: meta.before ?? null,
                    after: meta.after ?? null,
                    result: meta.result ?? null,
                    metadata: meta,
                };
            }),
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize) || 1,
        };
    }
};
exports.PlatformAdminOpsService = PlatformAdminOpsService;
exports.PlatformAdminOpsService = PlatformAdminOpsService = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, common_1.Inject)(redis_constants_1.REDIS_CLIENT)),
    __param(5, (0, common_1.Inject)(queue_constants_1.ADS_SYNC_QUEUE)),
    __param(6, (0, common_1.Inject)(queue_constants_1.ADS_ACTION_QUEUE)),
    __param(7, (0, common_1.Inject)(queue_constants_1.OFFLINE_CONVERSION_QUEUE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        config_1.ConfigService,
        queue_enqueue_service_1.QueueEnqueueService, Function, Function, Function, Function])
], PlatformAdminOpsService);
