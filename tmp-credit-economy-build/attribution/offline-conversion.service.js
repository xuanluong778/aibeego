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
var OfflineConversionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OfflineConversionService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const queue_constants_1 = require("../queue/queue.constants");
const queue_enqueue_service_1 = require("../common/services/queue-enqueue.service");
let OfflineConversionService = OfflineConversionService_1 = class OfflineConversionService {
    prisma;
    queueEnqueue;
    queue;
    logger = new common_1.Logger(OfflineConversionService_1.name);
    constructor(prisma, queueEnqueue, queue) {
        this.prisma = prisma;
        this.queueEnqueue = queueEnqueue;
        this.queue = queue;
    }
    async enqueuePendingJobs(organizationId, jobIds) {
        for (const jobId of jobIds) {
            await this.queueEnqueue.add(this.queue, 'send-offline-conversion', { organizationId, jobId }, {
                jobId: `offline-conv-${jobId}`,
                attempts: 5,
                backoff: { type: 'exponential', delay: 30_000 },
                removeOnComplete: 200,
                removeOnFail: 100,
            });
        }
    }
    /**
     * Processor logic — gọi từ worker. Chưa gắn token thật → mô phỏng SENT/SKIPPED an toàn.
     * Không gửi dữ liệu giả lên Meta/Google production.
     */
    async processJob(organizationId, jobId) {
        const job = await this.prisma.offlineConversionJob.findFirst({
            where: { id: jobId, organizationId },
        });
        if (!job)
            return { skipped: true, reason: 'not_found' };
        if (job.status === database_1.OfflineConversionStatus.SENT) {
            return { skipped: true, reason: 'already_sent' };
        }
        const metaToken = process.env.META_CAPI_ACCESS_TOKEN?.trim();
        const googleEnabled = process.env.GOOGLE_ENHANCED_CONVERSIONS_ENABLED === 'true';
        try {
            if (job.provider === database_1.OfflineConversionProvider.META_CAPI) {
                if (!metaToken) {
                    await this.prisma.offlineConversionJob.update({
                        where: { id: job.id },
                        data: {
                            status: database_1.OfflineConversionStatus.SKIPPED,
                            lastError: 'META_CAPI_ACCESS_TOKEN chưa cấu hình',
                            attemptCount: { increment: 1 },
                            response: { skipped: true },
                        },
                    });
                    return { skipped: true, reason: 'meta_not_configured' };
                }
                // Placeholder for real CAPI HTTP call — keep idempotent
                this.logger.log(`[META_CAPI] would send job=${job.id} event=${job.eventType}`);
            }
            if (job.provider === database_1.OfflineConversionProvider.GOOGLE_ENHANCED) {
                if (!googleEnabled) {
                    await this.prisma.offlineConversionJob.update({
                        where: { id: job.id },
                        data: {
                            status: database_1.OfflineConversionStatus.SKIPPED,
                            lastError: 'GOOGLE_ENHANCED_CONVERSIONS_ENABLED != true',
                            attemptCount: { increment: 1 },
                            response: { skipped: true },
                        },
                    });
                    return { skipped: true, reason: 'google_not_configured' };
                }
                this.logger.log(`[GOOGLE_EC] would send job=${job.id} event=${job.eventType}`);
            }
            await this.prisma.offlineConversionJob.update({
                where: { id: job.id },
                data: {
                    status: database_1.OfflineConversionStatus.SENT,
                    sentAt: new Date(),
                    attemptCount: { increment: 1 },
                    response: { ok: true, simulated: !(metaToken || googleEnabled) },
                    lastError: null,
                },
            });
            return { ok: true };
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : 'send failed';
            await this.prisma.offlineConversionJob.update({
                where: { id: job.id },
                data: {
                    status: database_1.OfflineConversionStatus.FAILED,
                    lastError: msg,
                    attemptCount: { increment: 1 },
                    nextRetryAt: new Date(Date.now() + 5 * 60_000),
                },
            });
            throw err;
        }
    }
};
exports.OfflineConversionService = OfflineConversionService;
exports.OfflineConversionService = OfflineConversionService = OfflineConversionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(queue_constants_1.OFFLINE_CONVERSION_QUEUE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        queue_enqueue_service_1.QueueEnqueueService, Function])
], OfflineConversionService);
