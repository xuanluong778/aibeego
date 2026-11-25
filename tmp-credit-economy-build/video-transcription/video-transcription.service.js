"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var VideoTranscriptionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoTranscriptionService = void 0;
const plan_storage_1 = require("../common/uploads/plan-storage");
const common_1 = require("@nestjs/common");
const fs_1 = require("fs");
const path_1 = require("path");
const promises_1 = require("stream/promises");
const shared_1 = require("@marketingspa/shared");
const ssrf_fetch_1 = require("@marketingspa/shared/dist/ssrf-fetch");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const rate_limit_service_1 = require("../common/services/rate-limit.service");
const queue_enqueue_service_1 = require("../common/services/queue-enqueue.service");
const billing_service_1 = require("../billing/billing.service");
const queue_constants_1 = require("../queue/queue.constants");
const video_transcription_files_1 = require("./video-transcription-files");
const video_transcription_remote_1 = require("./video-transcription-remote");
let VideoTranscriptionService = VideoTranscriptionService_1 = class VideoTranscriptionService {
    prisma;
    rateLimit;
    queueEnqueue;
    billing;
    queue;
    logger = new common_1.Logger(VideoTranscriptionService_1.name);
    constructor(prisma, rateLimit, queueEnqueue, billing, queue) {
        this.prisma = prisma;
        this.rateLimit = rateLimit;
        this.queueEnqueue = queueEnqueue;
        this.billing = billing;
        this.queue = queue;
    }
    maxFileBytes() {
        const n = Number(process.env.VIDEO_TRANSCRIPTION_MAX_FILE_BYTES);
        return Number.isFinite(n) && n > 0 ? n : shared_1.VIDEO_TRANSCRIPTION_LIMITS.maxFileBytes;
    }
    maxDurationSeconds() {
        const n = Number(process.env.VIDEO_TRANSCRIPTION_MAX_DURATION_SECONDS);
        return Number.isFinite(n) && n > 0 ? n : shared_1.VIDEO_TRANSCRIPTION_LIMITS.maxDurationSeconds;
    }
    toPublic(row) {
        const stageMap = {
            QUEUED: 'queued',
            VALIDATING: 'validating',
            DOWNLOADING: 'downloading',
            EXTRACTING_AUDIO: 'extracting_audio',
            TRANSCRIBING: 'transcribing',
            CLEANING: 'cleaning',
            COMPLETED: 'completed',
            FAILED: 'failed',
            CANCELLED: 'cancelled',
        };
        const statusMap = {
            PENDING: 'pending',
            PROCESSING: 'processing',
            COMPLETED: 'completed',
            FAILED: 'failed',
            CANCELLED: 'cancelled',
        };
        const sourceMap = {
            UPLOAD: 'upload',
            YOUTUBE: 'youtube',
            FACEBOOK: 'facebook',
            TIKTOK: 'tiktok',
        };
        const progress = row.chunkProgress;
        const videoDownloadAvailable = Boolean(row.tempDir &&
            (!row.tempExpiresAt || row.tempExpiresAt.getTime() > Date.now()) &&
            this.findSourceInDir(row.tempDir));
        const transcriptDownloadAvailable = Boolean((row.cleanedTranscript || row.correctedTranscript || row.rawTranscript)?.trim());
        return {
            id: row.id,
            status: statusMap[row.status],
            stage: stageMap[row.stage],
            sourceType: sourceMap[row.sourceType],
            sourceUrl: row.sourceUrl,
            sourceTitle: row.sourceTitle ?? null,
            thumbnailUrl: row.thumbnailUrl ?? null,
            originalFilename: row.originalFilename,
            language: row.language,
            ownershipConfirmed: row.ownershipConfirmed,
            cancelRequested: row.cancelRequested ?? false,
            glossaryTerms: row.glossaryTerms ?? [],
            rawTranscript: row.rawTranscript,
            cleanedTranscript: row.cleanedTranscript,
            correctedTranscript: row.correctedTranscript ?? row.cleanedTranscript,
            qualityMeta: row.qualityMeta ?? null,
            durationSeconds: row.durationSeconds,
            audioDurationSeconds: row.audioDurationSeconds ?? progress?.audioDurationSeconds ?? null,
            processedDurationSeconds: row.processedDurationSeconds ?? progress?.processedDurationSeconds ?? null,
            chunkCount: row.chunkCount ?? progress?.chunkCount ?? null,
            chunksCompleted: row.chunksCompleted ?? progress?.chunksCompleted ?? null,
            firstTimestamp: progress?.firstTimestamp ?? null,
            lastTimestamp: progress?.lastTimestamp ?? null,
            resultCharCount: progress?.resultCharCount ??
                (row.cleanedTranscript ? row.cleanedTranscript.length : null),
            chunks: (progress?.chunks || []).map((c) => ({
                index: c.index,
                startSec: c.startSec,
                endSec: c.endSec,
                status: c.status,
                charCount: c.charCount,
                error: c.error ?? null,
            })),
            fileSizeBytes: row.fileSizeBytes != null ? Number(row.fileSizeBytes) : null,
            detectedLanguage: row.detectedLanguage,
            errorCode: row.errorCode,
            errorMessage: row.errorMessage,
            attemptCount: row.attemptCount,
            videoDownloadAvailable,
            transcriptDownloadAvailable,
            tempExpiresAt: row.tempExpiresAt?.toISOString() ?? null,
            maxDurationSeconds: this.maxDurationSeconds(),
            maxFileBytes: this.maxFileBytes(),
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
            completedAt: row.completedAt?.toISOString() ?? null,
        };
    }
    findSourceInDir(dir) {
        if (!dir || !(0, fs_1.existsSync)(dir))
            return null;
        try {
            const files = (0, fs_1.readdirSync)(dir).filter((f) => f.startsWith('source.'));
            return files[0] ? (0, path_1.join)(dir, files[0]) : null;
        }
        catch {
            return null;
        }
    }
    mapSourceType(sourceType) {
        if (sourceType === 'youtube')
            return database_1.VideoTranscriptionSourceType.YOUTUBE;
        if (sourceType === 'facebook')
            return database_1.VideoTranscriptionSourceType.FACEBOOK;
        if (sourceType === 'tiktok')
            return database_1.VideoTranscriptionSourceType.TIKTOK;
        return database_1.VideoTranscriptionSourceType.UPLOAD;
    }
    async probeUrl(user, url) {
        this.rateLimit.assertWithinLimit(`video-transcription-probe:${user.organizationId}:${user.id}`, shared_1.VIDEO_TRANSCRIPTION_LIMITS.rateLimitMax * 2, shared_1.VIDEO_TRANSCRIPTION_LIMITS.rateLimitWindowMs, 'Bạn đã kiểm tra URL quá nhiều lần. Thử lại sau vài phút.');
        const classified = (0, shared_1.classifyVideoSourceUrl)(url);
        if (!classified.ok || !classified.platform) {
            return {
                ok: false,
                errorCode: classified.errorCode || 'UNSUPPORTED_URL',
                message: classified.message || 'URL không được hỗ trợ',
            };
        }
        try {
            await (0, ssrf_fetch_1.assertPublicHttpUrl)(url, {
                skipCommerceHostBlock: true,
                allowHost: shared_1.isAllowedVideoTranscriptionHost,
            });
        }
        catch (err) {
            const code = err && typeof err === 'object' && 'code' in err
                ? String(err.code || 'SSRF_BLOCKED')
                : 'SSRF_BLOCKED';
            return {
                ok: false,
                platform: classified.platform,
                errorCode: code,
                message: err instanceof Error ? err.message : 'URL bị chặn vì lý do bảo mật',
            };
        }
        try {
            const meta = await (0, video_transcription_remote_1.probeVideoUrlMeta)(url, classified.platform);
            if (meta.durationSeconds != null &&
                meta.durationSeconds > this.maxDurationSeconds()) {
                return {
                    ok: false,
                    platform: classified.platform,
                    sourceType: classified.platform,
                    url,
                    title: meta.title,
                    thumbnailUrl: meta.thumbnailUrl,
                    durationSeconds: meta.durationSeconds,
                    errorCode: 'DURATION_EXCEEDED',
                    message: `Video dài hơn ${Math.round(this.maxDurationSeconds() / 60)} phút.`,
                };
            }
            return {
                ok: true,
                platform: classified.platform,
                sourceType: classified.platform,
                url,
                title: meta.title,
                thumbnailUrl: meta.thumbnailUrl,
                durationSeconds: meta.durationSeconds,
            };
        }
        catch (err) {
            return {
                ok: false,
                platform: classified.platform,
                sourceType: classified.platform,
                url,
                errorCode: err && typeof err === 'object' && 'code' in err
                    ? String(err.code || 'PROBE_FAILED')
                    : 'PROBE_FAILED',
                message: err instanceof Error ? err.message : 'Không kiểm tra được URL',
            };
        }
    }
    async create(user, dto, file) {
        if (!dto.ownershipConfirmed) {
            throw new common_1.BadRequestException({
                code: 'OWNERSHIP_REQUIRED',
                message: 'Bạn phải xác nhận video thuộc quyền sở hữu hoặc bạn có quyền sử dụng hợp pháp trước khi tiếp tục.',
            });
        }
        this.rateLimit.assertWithinLimit(`video-transcription:${user.organizationId}:${user.id}`, shared_1.VIDEO_TRANSCRIPTION_LIMITS.rateLimitMax, shared_1.VIDEO_TRANSCRIPTION_LIMITS.rateLimitWindowMs, 'Bạn đã gửi quá nhiều yêu cầu lấy văn bản. Thử lại sau vài phút.');
        await this.assertDailyQuota(user);
        const hasFile = Boolean(file && (file.size > 0 || file.buffer?.length));
        const sourceUrl = dto.sourceUrl?.trim() || '';
        if (!hasFile && !sourceUrl) {
            throw new common_1.BadRequestException({
                code: 'SOURCE_REQUIRED',
                message: 'Nhập link YouTube / Facebook / TikTok công khai hoặc tải lên file video/audio.',
            });
        }
        if (hasFile && sourceUrl) {
            throw new common_1.BadRequestException({
                code: 'SOURCE_CONFLICT',
                message: 'Chỉ chọn một nguồn: link URL hoặc file upload.',
            });
        }
        let sourceType = database_1.VideoTranscriptionSourceType.UPLOAD;
        let normalizedUrl = null;
        if (sourceUrl) {
            const classified = (0, shared_1.classifyVideoSourceUrl)(sourceUrl);
            if (!classified.ok || !classified.sourceType || classified.sourceType === 'upload') {
                throw new common_1.BadRequestException({
                    code: classified.errorCode || 'UNSUPPORTED_URL',
                    message: classified.message || 'URL không được hỗ trợ',
                });
            }
            try {
                await (0, ssrf_fetch_1.assertPublicHttpUrl)(sourceUrl, {
                    skipCommerceHostBlock: true,
                    allowHost: shared_1.isAllowedVideoTranscriptionHost,
                });
            }
            catch (err) {
                throw new common_1.BadRequestException({
                    code: err && typeof err === 'object' && 'code' in err
                        ? String(err.code || 'SSRF_BLOCKED')
                        : 'SSRF_BLOCKED',
                    message: err instanceof Error ? err.message : 'URL bị chặn vì lý do bảo mật',
                });
            }
            sourceType = this.mapSourceType(classified.sourceType);
            normalizedUrl = sourceUrl;
        }
        if (hasFile && file) {
            this.validateUpload(file);
        }
        const language = (dto.language || 'vi').trim() || 'vi';
        const requestGlossary = (0, shared_1.parseGlossaryInput)(dto.glossary);
        // Merge with saved org/user glossary
        const saved = await this.prisma.videoTranscriptionGlossary.findUnique({
            where: {
                organizationId_userId: {
                    organizationId: user.organizationId,
                    userId: user.id,
                },
            },
        });
        const glossary = (0, shared_1.parseGlossaryInput)([...(saved?.terms || []), ...requestGlossary]);
        if (requestGlossary.length) {
            await this.prisma.videoTranscriptionGlossary.upsert({
                where: {
                    organizationId_userId: {
                        organizationId: user.organizationId,
                        userId: user.id,
                    },
                },
                create: {
                    organizationId: user.organizationId,
                    userId: user.id,
                    terms: glossary,
                },
                update: { terms: glossary },
            });
        }
        const row = await this.prisma.videoTranscription.create({
            data: {
                organizationId: user.organizationId,
                userId: user.id,
                status: database_1.VideoTranscriptionStatus.PENDING,
                stage: database_1.VideoTranscriptionStage.QUEUED,
                sourceType,
                sourceUrl: normalizedUrl,
                sourceTitle: dto.sourceTitle?.trim()?.slice(0, 500) || null,
                thumbnailUrl: dto.thumbnailUrl?.trim()?.slice(0, 2000) || null,
                durationSeconds: dto.durationSeconds != null && Number.isFinite(dto.durationSeconds)
                    ? Math.ceil(dto.durationSeconds)
                    : null,
                originalFilename: hasFile && file ? (0, path_1.basename)(file.originalname).slice(0, 500) : null,
                language,
                ownershipConfirmed: true,
                glossaryTerms: glossary,
                fileSizeBytes: hasFile && file ? BigInt(file.size) : null,
                attemptCount: 0,
            },
        });
        const work = (0, video_transcription_files_1.ensureOrgWorkDir)(user.organizationId, row.id);
        try {
            if (hasFile && file) {
                const ext = this.safeExt(file.originalname);
                const dest = (0, path_1.join)(work.absolute, `source${ext}`);
                await (0, plan_storage_1.writePlanFile)(this.prisma, user.organizationId, dest, file.buffer?.length ?? file.size, () => this.writeUpload(file, dest));
            }
            await this.prisma.videoTranscription.update({
                where: { id: row.id },
                data: {
                    tempDir: work.absolute,
                    workDirRelative: work.relative,
                },
            });
            const updated = await this.enqueue(user, row.id);
            this.logger.log(`Created video transcription ${row.id} org=${user.organizationId} type=${sourceType}`);
            return updated;
        }
        catch (err) {
            (0, video_transcription_files_1.removeWorkDir)(work.absolute);
            await this.prisma.videoTranscription.update({
                where: { id: row.id },
                data: {
                    status: database_1.VideoTranscriptionStatus.FAILED,
                    stage: database_1.VideoTranscriptionStage.FAILED,
                    errorCode: 'ENQUEUE_FAILED',
                    errorMessage: err instanceof Error ? err.message : 'Enqueue failed',
                    tempDir: null,
                },
            });
            throw err;
        }
    }
    async getById(user, id) {
        const row = await this.findOwned(user, id);
        await this.cleanupIfExpired(row);
        const fresh = await this.findOwned(user, id);
        return this.toPublic(fresh);
    }
    async cleanupIfExpired(row) {
        if (!row.tempDir || !row.tempExpiresAt)
            return;
        if (row.tempExpiresAt.getTime() > Date.now())
            return;
        (0, video_transcription_files_1.removeWorkDir)(row.tempDir);
        await this.prisma.videoTranscription.update({
            where: { id: row.id },
            data: { tempDir: null, tempExpiresAt: null },
        });
    }
    async cancel(user, id) {
        const row = await this.findOwned(user, id);
        if (row.status === database_1.VideoTranscriptionStatus.COMPLETED ||
            row.status === database_1.VideoTranscriptionStatus.CANCELLED) {
            throw new common_1.BadRequestException({
                code: 'NOT_CANCELLABLE',
                message: 'Job đã kết thúc — không thể hủy.',
            });
        }
        this.rateLimit.assertWithinLimit(`video-transcription-cancel:${user.organizationId}:${user.id}`, shared_1.VIDEO_TRANSCRIPTION_LIMITS.rateLimitMax, shared_1.VIDEO_TRANSCRIPTION_LIMITS.rateLimitWindowMs, 'Bạn đã hủy quá nhiều lần. Thử lại sau vài phút.');
        for (const suffix of ['all', ...Array.from({ length: 64 }, (_, i) => String(i))]) {
            try {
                const bullJob = await this.queue.getJob(`video-transcription-${id}-${suffix}`);
                if (bullJob)
                    await bullJob.remove();
            }
            catch {
                /* ignore */
            }
        }
        (0, video_transcription_files_1.removeWorkDir)(row.tempDir);
        const updated = await this.prisma.videoTranscription.update({
            where: { id: row.id },
            data: {
                cancelRequested: true,
                status: database_1.VideoTranscriptionStatus.CANCELLED,
                stage: database_1.VideoTranscriptionStage.CANCELLED,
                errorCode: 'CANCELLED',
                errorMessage: 'Job đã bị hủy bởi người dùng',
                tempDir: null,
                tempExpiresAt: null,
                completedAt: new Date(),
            },
        });
        return this.toPublic(updated);
    }
    async downloadVideo(user, id) {
        const row = await this.findOwned(user, id);
        await this.cleanupIfExpired(row);
        const fresh = await this.findOwned(user, id);
        const source = this.findSourceInDir(fresh.tempDir);
        if (!source || !(0, fs_1.existsSync)(source)) {
            throw new common_1.BadRequestException({
                code: 'VIDEO_GONE',
                message: 'File video tạm không còn (đã hết hạn hoặc chưa tải xong). Chỉ giữ tạm ~30 phút sau khi hoàn tất.',
            });
        }
        const ext = (0, path_1.extname)(source) || '.mp4';
        const filename = `video-${id.slice(0, 8)}${ext}`;
        const stream = (0, fs_1.createReadStream)(source);
        return {
            file: new common_1.StreamableFile(stream, {
                type: 'application/octet-stream',
                disposition: `attachment; filename="${filename}"`,
                length: (0, fs_1.statSync)(source).size,
            }),
            filename,
        };
    }
    async downloadTranscript(user, id) {
        const row = await this.findOwned(user, id);
        const text = (row.cleanedTranscript ||
            row.correctedTranscript ||
            row.rawTranscript ||
            '').trim();
        if (!text) {
            throw new common_1.BadRequestException({
                code: 'TRANSCRIPT_EMPTY',
                message: 'Chưa có transcript hợp lệ để tải.',
            });
        }
        const filename = `transcript-${id.slice(0, 8)}.txt`;
        const buf = Buffer.from(text, 'utf8');
        return {
            file: new common_1.StreamableFile(buf, {
                type: 'text/plain; charset=utf-8',
                disposition: `attachment; filename="${filename}"`,
                length: buf.length,
            }),
            filename,
        };
    }
    async updateText(user, id, cleanedTranscript) {
        const row = await this.findOwned(user, id);
        if (row.status !== database_1.VideoTranscriptionStatus.COMPLETED) {
            throw new common_1.BadRequestException('Chỉ chỉnh sửa được khi đã hoàn tất chuyển văn bản.');
        }
        const updated = await this.prisma.videoTranscription.update({
            where: { id: row.id },
            data: { cleanedTranscript: cleanedTranscript.trim() },
        });
        return this.toPublic(updated);
    }
    async retry(user, id) {
        const row = await this.findOwned(user, id);
        if (row.status !== database_1.VideoTranscriptionStatus.FAILED &&
            row.status !== database_1.VideoTranscriptionStatus.CANCELLED) {
            throw new common_1.BadRequestException('Chỉ thử lại được job đã thất bại hoặc đã hủy.');
        }
        if (row.attemptCount >= shared_1.VIDEO_TRANSCRIPTION_LIMITS.maxAttempts) {
            throw new common_1.BadRequestException({
                code: 'MAX_ATTEMPTS',
                message: `Đã hết số lần thử lại (${shared_1.VIDEO_TRANSCRIPTION_LIMITS.maxAttempts}).`,
            });
        }
        this.rateLimit.assertWithinLimit(`video-transcription-retry:${user.organizationId}:${user.id}`, shared_1.VIDEO_TRANSCRIPTION_LIMITS.rateLimitMax, shared_1.VIDEO_TRANSCRIPTION_LIMITS.rateLimitWindowMs, 'Bạn đã thử lại quá nhiều lần. Thử lại sau vài phút.');
        await this.assertDailyQuota(user);
        // Ensure work dir still usable for upload; remote URLs can re-download
        if (row.sourceType === database_1.VideoTranscriptionSourceType.UPLOAD) {
            const work = row.tempDir || (0, video_transcription_files_1.ensureOrgWorkDir)(user.organizationId, row.id).absolute;
            if (!(0, fs_1.existsSync)(work) || (0, fs_1.readdirSync)(work).length === 0) {
                throw new common_1.BadRequestException({
                    code: 'SOURCE_GONE',
                    message: 'File tạm đã bị xóa. Vui lòng tải lại video và tạo yêu cầu mới.',
                });
            }
        }
        else {
            const work = (0, video_transcription_files_1.ensureOrgWorkDir)(user.organizationId, row.id);
            await this.prisma.videoTranscription.update({
                where: { id: row.id },
                data: { tempDir: work.absolute, workDirRelative: work.relative },
            });
        }
        await this.prisma.videoTranscription.update({
            where: { id: row.id },
            data: {
                status: database_1.VideoTranscriptionStatus.PENDING,
                stage: database_1.VideoTranscriptionStage.QUEUED,
                cancelRequested: false,
                errorCode: null,
                errorMessage: null,
                rawTranscript: null,
                cleanedTranscript: null,
                completedAt: null,
                tempExpiresAt: null,
            },
        });
        return this.enqueue(user, row.id);
    }
    async retryChunk(user, id, chunkIndex) {
        const row = await this.findOwned(user, id);
        if (!row.tempDir) {
            throw new common_1.BadRequestException({
                code: 'SOURCE_GONE',
                message: 'File tạm đã bị xóa. Vui lòng tạo yêu cầu mới.',
            });
        }
        const progress = row.chunkProgress;
        const chunk = progress?.chunks?.find((c) => c.index === chunkIndex);
        if (!chunk) {
            throw new common_1.BadRequestException({
                code: 'CHUNK_MISSING',
                message: `Không tìm thấy chunk #${chunkIndex}`,
            });
        }
        this.rateLimit.assertWithinLimit(`video-transcription-chunk-retry:${user.organizationId}:${user.id}`, shared_1.VIDEO_TRANSCRIPTION_LIMITS.rateLimitMax, shared_1.VIDEO_TRANSCRIPTION_LIMITS.rateLimitWindowMs, 'Bạn đã thử lại quá nhiều lần. Thử lại sau vài phút.');
        // Mark chunk pending so worker redoes it
        if (progress?.chunks) {
            const nextChunks = progress.chunks.map((c) => c.index === chunkIndex ? { ...c, status: 'pending', error: null } : c);
            await this.prisma.videoTranscription.update({
                where: { id: row.id },
                data: {
                    status: database_1.VideoTranscriptionStatus.PENDING,
                    stage: database_1.VideoTranscriptionStage.QUEUED,
                    errorCode: null,
                    errorMessage: null,
                    completedAt: null,
                    chunkProgress: { ...progress, chunks: nextChunks },
                },
            });
        }
        return this.enqueue(user, row.id, chunkIndex);
    }
    async enqueue(user, transcriptionId, chunkIndex) {
        const payload = shared_1.videoTranscriptionQueuePayloadSchema.parse({
            organizationId: user.organizationId,
            transcriptionId,
            userId: user.id,
            ...(chunkIndex != null ? { chunkIndex } : {}),
        });
        await this.queueEnqueue.add(this.queue, 'video-transcription', payload, {
            jobId: `video-transcription-${transcriptionId}-${chunkIndex ?? 'all'}`,
            attempts: shared_1.VIDEO_TRANSCRIPTION_LIMITS.maxAttempts,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: 100,
            removeOnFail: 50,
        });
        const updated = await this.prisma.videoTranscription.update({
            where: { id: transcriptionId },
            data: {
                status: database_1.VideoTranscriptionStatus.PENDING,
                stage: database_1.VideoTranscriptionStage.QUEUED,
                bullJobId: `video-transcription-${transcriptionId}`,
            },
        });
        return this.toPublic(updated);
    }
    async getGlossary(user) {
        const row = await this.prisma.videoTranscriptionGlossary.findUnique({
            where: {
                organizationId_userId: {
                    organizationId: user.organizationId,
                    userId: user.id,
                },
            },
        });
        return { terms: row?.terms ?? [] };
    }
    async findOwned(user, id) {
        const row = await this.prisma.videoTranscription.findFirst({
            where: {
                id,
                organizationId: user.organizationId,
                userId: user.id,
            },
        });
        if (!row) {
            throw new common_1.NotFoundException('Không tìm thấy yêu cầu hoặc không có quyền truy cập');
        }
        return row;
    }
    async assertDailyQuota(user) {
        const ent = await this.billing.hasValidEntitlement(user.organizationId);
        if (!ent.ok) {
            throw new common_1.ForbiddenException({
                code: 'SUBSCRIPTION_REQUIRED',
                message: 'Cần gói dịch vụ hợp lệ để dùng tính năng lấy văn bản từ video.',
            });
        }
        let planCode = null;
        const sub = await this.prisma.subscription.findFirst({
            where: { organizationId: user.organizationId },
            include: { plan: true },
            orderBy: { currentPeriodEnd: 'desc' },
        });
        planCode = sub?.plan?.code ?? null;
        const quota = (0, shared_1.resolveDailyTranscriptionQuota)(planCode, !!ent.isTrial);
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const used = await this.prisma.videoTranscription.count({
            where: {
                organizationId: user.organizationId,
                userId: user.id,
                createdAt: { gte: start },
                status: { notIn: [database_1.VideoTranscriptionStatus.FAILED, database_1.VideoTranscriptionStatus.CANCELLED] },
            },
        });
        if (used >= quota) {
            throw new common_1.ForbiddenException({
                code: 'QUOTA_EXCEEDED',
                message: `Đã hết hạn mức ${quota} lần lấy văn bản/ngày theo gói hiện tại.`,
                quota,
                used,
            });
        }
    }
    validateUpload(file) {
        if (file.size > this.maxFileBytes()) {
            throw new common_1.BadRequestException({
                code: 'FILE_TOO_LARGE',
                message: `File tối đa ${Math.round(this.maxFileBytes() / (1024 * 1024))}MB.`,
            });
        }
        const ext = this.safeExt(file.originalname).toLowerCase();
        if (!video_transcription_files_1.ALLOWED_MEDIA_EXT.has(ext)) {
            throw new common_1.BadRequestException({
                code: 'INVALID_FILE_TYPE',
                message: `Định dạng không hỗ trợ (${ext || 'unknown'}). Dùng mp4, mov, webm, mp3, wav, m4a…`,
            });
        }
        if (file.mimetype && !video_transcription_files_1.ALLOWED_MEDIA_MIME.has(file.mimetype)) {
            this.logger.warn(`Unusual mime ${file.mimetype} for ${file.originalname} — allowing by ext`);
        }
    }
    safeExt(filename) {
        const ext = (0, path_1.extname)(filename || '').toLowerCase();
        return ext && ext.length <= 10 ? ext : '.mp4';
    }
    async writeUpload(file, dest) {
        if (file.buffer && file.buffer.length) {
            const { writeFileSync, unlinkSync } = await Promise.resolve().then(() => __importStar(require('fs')));
            writeFileSync(dest, file.buffer);
            return;
        }
        if (file.path) {
            const { copyFileSync, unlinkSync } = await Promise.resolve().then(() => __importStar(require('fs')));
            copyFileSync(file.path, dest);
            try {
                unlinkSync(file.path);
            }
            catch {
                /* incoming temp */
            }
            return;
        }
        if (file.stream) {
            await (0, promises_1.pipeline)(file.stream, (0, fs_1.createWriteStream)(dest));
            return;
        }
        throw new common_1.BadRequestException('Không đọc được file upload');
    }
};
exports.VideoTranscriptionService = VideoTranscriptionService;
exports.VideoTranscriptionService = VideoTranscriptionService = VideoTranscriptionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, common_1.Inject)(queue_constants_1.VIDEO_TRANSCRIPTION_QUEUE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        rate_limit_service_1.RateLimitService,
        queue_enqueue_service_1.QueueEnqueueService,
        billing_service_1.BillingService, Function])
], VideoTranscriptionService);
