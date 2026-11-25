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
exports.AdsSyncQueueService = void 0;
const crypto_1 = require("crypto");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const queue_enqueue_service_1 = require("../common/services/queue-enqueue.service");
const queue_constants_1 = require("../queue/queue.constants");
const token_security_util_1 = require("../common/utils/token-security.util");
function buildIdempotencyKey(parts) {
    const raw = [
        parts.organizationId,
        parts.connectionId,
        parts.accountId,
        parts.dateFrom,
        parts.dateTo,
        parts.platform,
    ].join('|');
    return (0, crypto_1.createHash)('sha256').update(raw).digest('hex');
}
let AdsSyncQueueService = class AdsSyncQueueService {
    prisma;
    config;
    audit;
    queueEnqueue;
    adsSyncQueue;
    constructor(prisma, config, audit, queueEnqueue, adsSyncQueue) {
        this.prisma = prisma;
        this.config = config;
        this.audit = audit;
        this.queueEnqueue = queueEnqueue;
        this.adsSyncQueue = adsSyncQueue;
    }
    /**
     * API chỉ tạo AdsSyncJob + enqueue ID payload — không đọc/đưa token vào queue.
     */
    async enqueueMetaSync(user, dto) {
        const organizationId = user.organizationId;
        const connection = await this.prisma.adConnection.findUnique({
            where: {
                organizationId_provider: {
                    organizationId,
                    provider: database_1.AdConnectionProvider.META,
                },
            },
        });
        if (!connection?.encryptedCredentials) {
            throw new common_1.BadRequestException('Chưa kết nối Facebook Ads');
        }
        const meta = await this.prisma.facebookAdsConnection.findUnique({
            where: { organizationId },
        });
        const accountId = meta?.selectedAdAccountId ?? connection.externalAccountId;
        if (!accountId) {
            throw new common_1.BadRequestException('Vui lòng chọn tài khoản quảng cáo trước khi đồng bộ');
        }
        // Incremental: nếu thiếu dateFrom → từ lastSyncAt (hoặc 7 ngày)
        const dateTo = this.parseDateOnly(dto.dateTo ?? new Date().toISOString().slice(0, 10));
        let dateFromStr = dto.dateFrom;
        if (!dateFromStr) {
            const last = connection.lastSyncAt ?? meta?.lastSyncAt;
            if (last) {
                dateFromStr = last.toISOString().slice(0, 10);
            }
            else {
                const d = new Date(dateTo);
                d.setDate(d.getDate() - 7);
                dateFromStr = d.toISOString().slice(0, 10);
            }
        }
        const dateFrom = this.parseDateOnly(dateFromStr);
        if (dateFrom > dateTo) {
            throw new common_1.BadRequestException('Từ ngày phải trước đến ngày');
        }
        // Chống 2 job cùng account đang chạy
        const running = await this.prisma.adsSyncJob.findFirst({
            where: {
                organizationId,
                platform: database_1.AdsSyncPlatform.META,
                accountId,
                status: { in: [database_1.AdsSyncJobStatus.QUEUED, database_1.AdsSyncJobStatus.RUNNING] },
            },
            orderBy: { createdAt: 'desc' },
        });
        if (running) {
            throw new common_1.ConflictException({
                message: 'Đã có job đồng bộ đang chạy cho tài khoản này',
                jobId: running.id,
                status: running.status,
                progressPercent: running.progressPercent,
            });
        }
        const dateFromKey = dateFrom.toISOString().slice(0, 10);
        const dateToKey = dateTo.toISOString().slice(0, 10);
        const idempotencyKey = buildIdempotencyKey({
            organizationId,
            connectionId: connection.id,
            accountId,
            dateFrom: dateFromKey,
            dateTo: dateToKey,
            platform: 'META',
        });
        // Idempotent: job SUCCEEDED cùng key trong 1h → trả lại, không tạo trùng
        const existingDone = await this.prisma.adsSyncJob.findUnique({
            where: { idempotencyKey },
        });
        if (existingDone?.status === database_1.AdsSyncJobStatus.SUCCEEDED &&
            existingDone.finishedAt &&
            Date.now() - existingDone.finishedAt.getTime() < 60 * 60 * 1000) {
            return {
                jobId: existingDone.id,
                status: existingDone.status,
                queued: false,
                reused: true,
                message: 'Đã đồng bộ gần đây (idempotent)',
                progressPercent: 100,
            };
        }
        const maxAttempts = Number(this.config.get('ADS_SYNC_MAX_ATTEMPTS') ?? 5);
        let job;
        if (existingDone && existingDone.status !== database_1.AdsSyncJobStatus.RUNNING) {
            job = await this.prisma.adsSyncJob.update({
                where: { id: existingDone.id },
                data: {
                    status: database_1.AdsSyncJobStatus.QUEUED,
                    progressPercent: 0,
                    progressMessage: 'Đang xếp hàng',
                    campaignsSynced: 0,
                    attemptCount: 0,
                    lastError: null,
                    startedAt: null,
                    finishedAt: null,
                    requestedByUserId: user.id,
                    metadata: {
                        campaignId: dto.campaignId ?? null,
                        incremental: !dto.dateFrom,
                    },
                },
            });
        }
        else {
            job = await this.prisma.adsSyncJob.create({
                data: {
                    organizationId,
                    connectionId: connection.id,
                    accountId,
                    platform: database_1.AdsSyncPlatform.META,
                    status: database_1.AdsSyncJobStatus.QUEUED,
                    dateFrom,
                    dateTo,
                    idempotencyKey,
                    maxAttempts,
                    requestedByUserId: user.id,
                    progressMessage: 'Đang xếp hàng',
                    metadata: {
                        campaignId: dto.campaignId ?? null,
                        incremental: !dto.dateFrom,
                    },
                },
            });
        }
        await this.prisma.facebookAdsConnection.updateMany({
            where: { organizationId },
            data: {
                status: database_1.FacebookAdsConnectionStatus.SYNCING,
            },
        });
        const payload = {
            organizationId,
            connectionId: connection.id,
            accountId,
            dateFrom: dateFromKey,
            dateTo: dateToKey,
            jobId: job.id,
            platform: 'META',
        };
        // Guard: payload must never contain token-like keys
        this.assertSafePayload(payload);
        await this.queueEnqueue.add(this.adsSyncQueue, 'ads-sync', payload, {
            jobId: `ads-sync-${job.id}`,
            attempts: maxAttempts,
            backoff: { type: 'exponential', delay: 5_000 },
            removeOnComplete: 100,
            removeOnFail: 200,
        });
        await this.prisma.adsSyncJob.update({
            where: { id: job.id },
            data: { bullJobId: `ads-sync-${job.id}` },
        });
        await this.audit.log({
            organizationId,
            userId: user.id,
            action: 'ADS_SYNC_QUEUED',
            entityType: 'ADS_SYNC_JOB',
            entityId: job.id,
            metadata: (0, token_security_util_1.redactForAudit)({
                platform: 'META',
                accountId,
                dateFrom: dateFromKey,
                dateTo: dateToKey,
                connectionId: connection.id,
            }),
        });
        return {
            jobId: job.id,
            status: database_1.AdsSyncJobStatus.QUEUED,
            queued: true,
            reused: false,
            message: 'Đã xếp hàng đồng bộ Ads',
            progressPercent: 0,
            dateFrom: dateFromKey,
            dateTo: dateToKey,
        };
    }
    /**
     * Google Ads sync — payload ID-only; refresh token chỉ giải mã ở worker.
     */
    async enqueueGoogleSync(user, dto) {
        const organizationId = user.organizationId;
        const connection = await this.prisma.adConnection.findUnique({
            where: {
                organizationId_provider: {
                    organizationId,
                    provider: database_1.AdConnectionProvider.GOOGLE,
                },
            },
        });
        if (!connection?.encryptedCredentials) {
            throw new common_1.BadRequestException('Chưa kết nối Google Ads');
        }
        const accountId = connection.externalAccountId;
        if (!accountId) {
            throw new common_1.BadRequestException('Vui lòng chọn Google Ads customer trước khi đồng bộ');
        }
        const dateTo = this.parseDateOnly(dto.dateTo ?? new Date().toISOString().slice(0, 10));
        let dateFromStr = dto.dateFrom;
        if (!dateFromStr) {
            if (connection.lastSyncAt) {
                dateFromStr = connection.lastSyncAt.toISOString().slice(0, 10);
            }
            else {
                const d = new Date(dateTo);
                d.setDate(d.getDate() - 7);
                dateFromStr = d.toISOString().slice(0, 10);
            }
        }
        const dateFrom = this.parseDateOnly(dateFromStr);
        if (dateFrom > dateTo) {
            throw new common_1.BadRequestException('Từ ngày phải trước đến ngày');
        }
        const running = await this.prisma.adsSyncJob.findFirst({
            where: {
                organizationId,
                platform: database_1.AdsSyncPlatform.GOOGLE,
                accountId,
                status: { in: [database_1.AdsSyncJobStatus.QUEUED, database_1.AdsSyncJobStatus.RUNNING] },
            },
            orderBy: { createdAt: 'desc' },
        });
        if (running) {
            throw new common_1.ConflictException({
                message: 'Đã có job đồng bộ Google đang chạy cho tài khoản này',
                jobId: running.id,
                status: running.status,
                progressPercent: running.progressPercent,
            });
        }
        const dateFromKey = dateFrom.toISOString().slice(0, 10);
        const dateToKey = dateTo.toISOString().slice(0, 10);
        const idempotencyKey = buildIdempotencyKey({
            organizationId,
            connectionId: connection.id,
            accountId,
            dateFrom: dateFromKey,
            dateTo: dateToKey,
            platform: 'GOOGLE',
        });
        const existingDone = await this.prisma.adsSyncJob.findUnique({
            where: { idempotencyKey },
        });
        if (existingDone?.status === database_1.AdsSyncJobStatus.SUCCEEDED &&
            existingDone.finishedAt &&
            Date.now() - existingDone.finishedAt.getTime() < 60 * 60 * 1000) {
            return {
                jobId: existingDone.id,
                status: existingDone.status,
                queued: false,
                reused: true,
                message: 'Đã đồng bộ Google gần đây (idempotent)',
                progressPercent: 100,
            };
        }
        const maxAttempts = Number(this.config.get('ADS_SYNC_MAX_ATTEMPTS') ?? 5);
        const meta = (connection.metadata ?? {});
        let job;
        if (existingDone && existingDone.status !== database_1.AdsSyncJobStatus.RUNNING) {
            job = await this.prisma.adsSyncJob.update({
                where: { id: existingDone.id },
                data: {
                    status: database_1.AdsSyncJobStatus.QUEUED,
                    progressPercent: 0,
                    progressMessage: 'Đang xếp hàng Google Ads',
                    campaignsSynced: 0,
                    attemptCount: 0,
                    lastError: null,
                    startedAt: null,
                    finishedAt: null,
                    requestedByUserId: user.id,
                    metadata: {
                        loginCustomerId: meta.loginCustomerId ?? null,
                        incremental: !dto.dateFrom,
                    },
                },
            });
        }
        else {
            job = await this.prisma.adsSyncJob.create({
                data: {
                    organizationId,
                    connectionId: connection.id,
                    accountId,
                    platform: database_1.AdsSyncPlatform.GOOGLE,
                    status: database_1.AdsSyncJobStatus.QUEUED,
                    dateFrom,
                    dateTo,
                    idempotencyKey,
                    maxAttempts,
                    requestedByUserId: user.id,
                    progressMessage: 'Đang xếp hàng Google Ads',
                    metadata: {
                        loginCustomerId: meta.loginCustomerId ?? null,
                        incremental: !dto.dateFrom,
                    },
                },
            });
        }
        const payload = {
            organizationId,
            connectionId: connection.id,
            accountId,
            dateFrom: dateFromKey,
            dateTo: dateToKey,
            jobId: job.id,
            platform: 'GOOGLE',
        };
        this.assertSafePayload(payload);
        await this.queueEnqueue.add(this.adsSyncQueue, 'ads-sync', payload, {
            jobId: `ads-sync-${job.id}`,
            attempts: maxAttempts,
            backoff: { type: 'exponential', delay: 5_000 },
            removeOnComplete: 100,
            removeOnFail: 200,
        });
        await this.prisma.adsSyncJob.update({
            where: { id: job.id },
            data: { bullJobId: `ads-sync-${job.id}` },
        });
        await this.audit.log({
            organizationId,
            userId: user.id,
            action: 'ADS_SYNC_QUEUED',
            entityType: 'ADS_SYNC_JOB',
            entityId: job.id,
            metadata: (0, token_security_util_1.redactForAudit)({
                platform: 'GOOGLE',
                accountId,
                dateFrom: dateFromKey,
                dateTo: dateToKey,
                connectionId: connection.id,
            }),
        });
        return {
            jobId: job.id,
            status: database_1.AdsSyncJobStatus.QUEUED,
            queued: true,
            reused: false,
            message: 'Đã xếp hàng đồng bộ Google Ads',
            progressPercent: 0,
            dateFrom: dateFromKey,
            dateTo: dateToKey,
        };
    }
    async getJob(user, jobId) {
        const job = await this.prisma.adsSyncJob.findFirst({
            where: { id: jobId, organizationId: user.organizationId },
        });
        if (!job)
            throw new common_1.NotFoundException('Không tìm thấy tài nguyên');
        return this.toPublic(job);
    }
    async listJobs(user, limit = 20) {
        const items = await this.prisma.adsSyncJob.findMany({
            where: { organizationId: user.organizationId },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
        return { items: items.map((j) => this.toPublic(j)) };
    }
    toPublic(job) {
        return {
            id: job.id,
            status: job.status,
            platform: job.platform,
            accountId: job.accountId,
            dateFrom: job.dateFrom,
            dateTo: job.dateTo,
            progressPercent: job.progressPercent,
            progressMessage: job.progressMessage,
            campaignsSynced: job.campaignsSynced,
            attemptCount: job.attemptCount,
            lastError: job.lastError,
            startedAt: job.startedAt,
            finishedAt: job.finishedAt,
            createdAt: job.createdAt,
        };
    }
    assertSafePayload(payload) {
        const json = JSON.stringify(payload);
        const forbidden = /access[_-]?token|refresh[_-]?token|encrypted|bearer|password|secret/i;
        if (forbidden.test(json)) {
            throw new common_1.BadRequestException('Ads sync payload không được chứa credential');
        }
    }
    parseDateOnly(iso) {
        const d = new Date(iso.slice(0, 10) + 'T00:00:00.000Z');
        if (Number.isNaN(d.getTime()))
            throw new common_1.BadRequestException('Ngày không hợp lệ');
        return d;
    }
};
exports.AdsSyncQueueService = AdsSyncQueueService;
exports.AdsSyncQueueService = AdsSyncQueueService = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, common_1.Inject)(queue_constants_1.ADS_SYNC_QUEUE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        audit_service_1.AuditService,
        queue_enqueue_service_1.QueueEnqueueService, Function])
], AdsSyncQueueService);
