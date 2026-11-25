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
var TeleprompterRecordingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeleprompterRecordingService = void 0;
/**
 * Teleprompter browser recordings — multipart/chunk upload to disk storage.
 * Lives in ContentMarketingModule (no standalone Teleprompter Nest module).
 */
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const fs_1 = require("fs");
const path_1 = require("path");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const database_1 = require("@marketingspa/database");
const teleprompter_recording_files_1 = require("./teleprompter-recording-files");
function mapPublic(row) {
    return {
        id: row.id,
        title: row.title,
        recordingType: row.recordingType,
        mimeType: row.mimeType,
        size: row.size,
        duration: row.duration,
        status: row.status,
        teleprompterSourceId: row.teleprompterSourceId,
        sourceTitle: row.teleprompterSource?.sourceTitle ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
}
let TeleprompterRecordingService = TeleprompterRecordingService_1 = class TeleprompterRecordingService {
    prisma;
    config;
    log = new common_1.Logger(TeleprompterRecordingService_1.name);
    constructor(prisma, config) {
        this.prisma = prisma;
        this.config = config;
    }
    ownedWhere(user, id) {
        return {
            id,
            organizationId: user.organizationId,
            userId: user.id,
            deletedAt: null,
        };
    }
    async findOwnedOrThrow(user, id) {
        const row = await this.prisma.contentTeleprompterRecording.findFirst({
            where: this.ownedWhere(user, id),
            include: {
                teleprompterSource: { select: { id: true, sourceTitle: true } },
            },
        });
        if (!row) {
            throw new common_1.NotFoundException('Không tìm thấy recording hoặc không có quyền truy cập');
        }
        return row;
    }
    async cleanupStaleUploads(limit = 50) {
        const cutoff = new Date(Date.now() - teleprompter_recording_files_1.TELEPROMPTER_RECORDING_LIMITS.incompleteTtlMs);
        const stale = await this.prisma.contentTeleprompterRecording.findMany({
            where: {
                status: { in: ['uploading', 'failed', 'cancelled'] },
                deletedAt: null,
                updatedAt: { lt: cutoff },
            },
            take: limit,
            select: { id: true, storageKey: true },
        });
        let n = 0;
        for (const row of stale) {
            (0, teleprompter_recording_files_1.removeRecordingObject)(row.storageKey);
            await this.prisma.contentTeleprompterRecording.update({
                where: { id: row.id },
                data: { deletedAt: new Date(), status: 'cancelled' },
            });
            n += 1;
        }
        if (n)
            this.log.log(`Cleaned ${n} stale teleprompter uploads`);
        return n;
    }
    async initUpload(user, dto) {
        await this.cleanupStaleUploads(20);
        const check = (0, teleprompter_recording_files_1.validateInitParams)({
            title: dto.title,
            recordingType: dto.recordingType,
            mimeType: dto.mimeType,
            size: dto.size,
            duration: dto.duration,
            partSize: dto.partSize,
        });
        if (!check.ok)
            throw new common_1.BadRequestException(check.message);
        const { definition } = await (0, database_1.organizationPlan)(this.prisma, user.organizationId);
        if (definition && dto.size > definition.limits.uploadMb * 1024 * 1024) {
            throw new database_1.PlanPolicyError('PLAN_LIMIT_REACHED', 'Bản quay vượt dung lượng mỗi tệp của gói.', { resource: 'uploadMb', limit: definition.limits.uploadMb });
        }
        let teleprompterSourceId = null;
        if (dto.teleprompterSourceId?.trim()) {
            const src = await this.prisma.contentTeleprompterSource.findFirst({
                where: {
                    id: dto.teleprompterSourceId.trim(),
                    organizationId: user.organizationId,
                    userId: user.id,
                },
                select: { id: true },
            });
            if (!src) {
                throw new common_1.BadRequestException('teleprompterSourceId không hợp lệ hoặc không thuộc bạn');
            }
            teleprompterSourceId = src.id;
        }
        const id = (0, crypto_1.randomUUID)();
        const mimeType = dto.mimeType.split(';')[0].trim().toLowerCase();
        const storageKey = (0, teleprompter_recording_files_1.buildStorageKey)(user.organizationId, id, mimeType);
        (0, teleprompter_recording_files_1.ensureRecordingDirs)(storageKey);
        const partSize = dto.partSize || teleprompter_recording_files_1.TELEPROMPTER_RECORDING_LIMITS.defaultPartSize;
        const totalParts = Math.ceil(dto.size / partSize);
        const row = await this.prisma.contentTeleprompterRecording.create({
            data: {
                id,
                organizationId: user.organizationId,
                userId: user.id,
                teleprompterSourceId,
                title: (0, teleprompter_recording_files_1.sanitizeTitle)(dto.title),
                recordingType: dto.recordingType,
                mimeType,
                size: Math.round(dto.size),
                duration: Math.max(0, Math.round(dto.duration || 0)),
                storageKey,
                status: 'uploading',
            },
        });
        return {
            id: row.id,
            uploadId: row.id,
            status: row.status,
            partSize,
            maxPartSize: teleprompter_recording_files_1.TELEPROMPTER_RECORDING_LIMITS.maxPartSize,
            totalParts,
            maxFileBytes: (0, teleprompter_recording_files_1.maxRecordingFileBytes)(),
            expiresInSec: Math.floor(teleprompter_recording_files_1.TELEPROMPTER_RECORDING_LIMITS.incompleteTtlMs / 1000),
        };
    }
    async uploadPart(user, id, partNumber, file, rawBuffer) {
        const row = await this.findOwnedOrThrow(user, id);
        if (row.status !== 'uploading') {
            throw new common_1.BadRequestException('Recording không ở trạng thái uploading');
        }
        const body = rawBuffer ?? file?.buffer;
        if (!body || !body.length) {
            throw new common_1.BadRequestException('Thiếu dữ liệu part');
        }
        if (body.length > teleprompter_recording_files_1.TELEPROMPTER_RECORDING_LIMITS.maxPartSize) {
            throw new common_1.PayloadTooLargeException('Part vượt giới hạn');
        }
        if (partNumber === 1) {
            const sniffed = (0, teleprompter_recording_files_1.sniffContainerMime)(body);
            if (!(0, teleprompter_recording_files_1.mimeCompatible)(row.mimeType, sniffed, row.recordingType)) {
                await this.prisma.contentTeleprompterRecording.update({
                    where: { id: row.id },
                    data: { status: 'failed' },
                });
                throw new common_1.BadRequestException(`MIME spoofing hoặc định dạng không khớp (declared=${row.mimeType}, sniffed=${sniffed ?? 'unknown'})`);
            }
        }
        const partsDir = (0, teleprompter_recording_files_1.partsDirFromKey)(row.storageKey);
        const writtenParts = (0, teleprompter_recording_files_1.listWrittenParts)(row.storageKey);
        let running = body.length;
        for (const n of writtenParts) {
            if (n === partNumber)
                continue;
            const p = (0, path_1.join)(partsDir, String(n));
            if ((0, fs_1.existsSync)(p))
                running += (0, fs_1.statSync)(p).size;
        }
        if (running > row.size + teleprompter_recording_files_1.TELEPROMPTER_RECORDING_LIMITS.maxPartSize) {
            throw new common_1.PayloadTooLargeException('Tổng dung lượng upload vượt quá size đã khai báo');
        }
        if (running > (0, teleprompter_recording_files_1.maxRecordingFileBytes)()) {
            throw new common_1.PayloadTooLargeException('File vượt giới hạn hệ thống');
        }
        try {
            const result = await (0, teleprompter_recording_files_1.writePart)(row.storageKey, partNumber, body);
            await this.prisma.contentTeleprompterRecording.update({
                where: { id: row.id },
                data: { updatedAt: new Date() },
            });
            return {
                id: row.id,
                partNumber,
                etag: result.etag,
                bytes: result.bytes,
                receivedParts: (0, teleprompter_recording_files_1.listWrittenParts)(row.storageKey).length,
            };
        }
        catch (err) {
            throw new common_1.BadRequestException(err instanceof Error ? err.message : 'Upload part thất bại');
        }
    }
    async completeUpload(user, id, dto) {
        const row = await this.findOwnedOrThrow(user, id);
        if (row.status !== 'uploading') {
            throw new common_1.BadRequestException('Recording không ở trạng thái uploading');
        }
        const onDisk = (0, teleprompter_recording_files_1.listWrittenParts)(row.storageKey);
        if (!onDisk.length) {
            throw new common_1.BadRequestException('Chưa có part nào được upload');
        }
        let expected = onDisk;
        if (dto.parts?.length) {
            const claimed = dto.parts.map((p) => p.partNumber).sort((a, b) => a - b);
            for (const n of claimed) {
                if (!onDisk.includes(n)) {
                    throw new common_1.BadRequestException(`Thiếu part ${n} trên server — upload lỗi giữa chừng`);
                }
            }
            for (let i = 1; i <= claimed.length; i++) {
                if (!claimed.includes(i)) {
                    throw new common_1.BadRequestException(`Part không liên tục — thiếu part ${i}`);
                }
            }
            expected = claimed;
        }
        else {
            for (let i = 1; i <= onDisk.length; i++) {
                if (!onDisk.includes(i)) {
                    throw new common_1.BadRequestException(`Upload lỗi giữa chừng — thiếu part ${i}`);
                }
            }
        }
        let finalSize;
        try {
            finalSize = await (0, plan_storage_1.writePlanFile)(this.prisma, user.organizationId, (0, teleprompter_recording_files_1.absoluteFromKey)(row.storageKey), row.size, () => (0, teleprompter_recording_files_1.assemblePartsAsync)(row.storageKey, expected));
        }
        catch (err) {
            await this.prisma.contentTeleprompterRecording.update({
                where: { id: row.id },
                data: { status: 'failed' },
            });
            throw new common_1.BadRequestException(err instanceof Error ? err.message : 'Ghép file thất bại');
        }
        if (finalSize > (0, teleprompter_recording_files_1.maxRecordingFileBytes)()) {
            (0, teleprompter_recording_files_1.removeRecordingObject)(row.storageKey);
            await this.prisma.contentTeleprompterRecording.update({
                where: { id: row.id },
                data: { status: 'failed', deletedAt: new Date() },
            });
            throw new common_1.PayloadTooLargeException('File vượt giới hạn sau khi ghép');
        }
        if (finalSize > row.size * 1.05 + 1024) {
            (0, teleprompter_recording_files_1.removeRecordingObject)(row.storageKey);
            await this.prisma.contentTeleprompterRecording.update({
                where: { id: row.id },
                data: { status: 'failed', deletedAt: new Date() },
            });
            throw new common_1.BadRequestException('Dung lượng thực tế vượt size đã khai báo');
        }
        const updated = await this.prisma.contentTeleprompterRecording.update({
            where: { id: row.id },
            data: { status: 'ready', size: finalSize },
            include: {
                teleprompterSource: { select: { id: true, sourceTitle: true } },
            },
        });
        return mapPublic(updated);
    }
    async cancelUpload(user, id) {
        const row = await this.findOwnedOrThrow(user, id);
        if (row.status === 'ready') {
            throw new common_1.BadRequestException('Không thể cancel recording đã ready — dùng xóa');
        }
        (0, teleprompter_recording_files_1.removeRecordingObject)(row.storageKey);
        const updated = await this.prisma.contentTeleprompterRecording.update({
            where: { id: row.id },
            data: { status: 'cancelled', deletedAt: new Date() },
            include: {
                teleprompterSource: { select: { id: true, sourceTitle: true } },
            },
        });
        return mapPublic(updated);
    }
    async list(user, query) {
        await this.cleanupStaleUploads(10);
        const take = Math.min(Math.max(query.limit || 30, 1), 100);
        const rows = await this.prisma.contentTeleprompterRecording.findMany({
            where: {
                organizationId: user.organizationId,
                userId: user.id,
                deletedAt: null,
                status: query.status || 'ready',
                ...(query.cursor ? { createdAt: { lt: new Date(query.cursor) } } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take,
            include: {
                teleprompterSource: { select: { id: true, sourceTitle: true } },
            },
        });
        return {
            items: rows.map(mapPublic),
            nextCursor: rows.length === take ? rows[rows.length - 1].createdAt.toISOString() : null,
        };
    }
    async detail(user, id) {
        const row = await this.findOwnedOrThrow(user, id);
        return mapPublic(row);
    }
    async rename(user, id, title) {
        await this.findOwnedOrThrow(user, id);
        const updated = await this.prisma.contentTeleprompterRecording.update({
            where: { id },
            data: { title: (0, teleprompter_recording_files_1.sanitizeTitle)(title) },
            include: {
                teleprompterSource: { select: { id: true, sourceTitle: true } },
            },
        });
        return mapPublic(updated);
    }
    /**
     * Soft-delete metadata. Object policy: delete storage object immediately;
     * keep metadata row with deletedAt for audit (no storage path ever returned).
     */
    async softDelete(user, id) {
        const row = await this.findOwnedOrThrow(user, id);
        (0, teleprompter_recording_files_1.removeRecordingObject)(row.storageKey);
        await this.prisma.contentTeleprompterRecording.update({
            where: { id: row.id },
            data: { deletedAt: new Date() },
        });
        return { id: row.id, deleted: true };
    }
    async createDownloadUrl(user, id) {
        const row = await this.findOwnedOrThrow(user, id);
        if (row.status !== 'ready' || !(0, teleprompter_recording_files_1.objectExists)(row.storageKey)) {
            throw new common_1.BadRequestException('Recording chưa sẵn sàng để tải');
        }
        const ttl = teleprompter_recording_files_1.TELEPROMPTER_RECORDING_LIMITS.downloadUrlTtlSec;
        const exp = Math.floor(Date.now() / 1000) + ttl;
        const token = (0, teleprompter_recording_files_1.signDownloadToken)({
            recordingId: row.id,
            organizationId: user.organizationId,
            userId: user.id,
            exp,
        });
        const port = this.config.get('PORT', 4000);
        const base = this.config.get('API_PUBLIC_URL')?.replace(/\/$/, '') || `http://127.0.0.1:${port}`;
        const path = `/api/v1/content-marketing/teleprompter-signed/${row.id}?token=${encodeURIComponent(token)}`;
        return {
            url: `${base}${path}`,
            path,
            expiresAt: new Date(exp * 1000).toISOString(),
            expiresIn: ttl,
            filename: (0, teleprompter_recording_files_1.filenameFromTitle)(row.title, row.mimeType),
        };
    }
    async streamDownloadByToken(id, token) {
        const payload = (0, teleprompter_recording_files_1.verifyDownloadToken)(token);
        if (!payload || payload.recordingId !== id) {
            throw new common_1.UnauthorizedException('Signed URL không hợp lệ hoặc đã hết hạn');
        }
        const row = await this.prisma.contentTeleprompterRecording.findFirst({
            where: {
                id,
                organizationId: payload.organizationId,
                userId: payload.userId,
                deletedAt: null,
                status: 'ready',
            },
        });
        if (!row || !(0, teleprompter_recording_files_1.objectExists)(row.storageKey)) {
            throw new common_1.NotFoundException('Recording không còn tồn tại');
        }
        const abs = (0, teleprompter_recording_files_1.absoluteFromKey)(row.storageKey);
        const stream = (0, fs_1.createReadStream)(abs);
        const filename = (0, teleprompter_recording_files_1.filenameFromTitle)(row.title, row.mimeType);
        return new common_1.StreamableFile(stream, {
            type: row.mimeType,
            disposition: `attachment; filename="${filename.replace(/"/g, '')}"`,
            length: (0, teleprompter_recording_files_1.objectSize)(row.storageKey) || undefined,
        });
    }
    async streamOwned(user, id) {
        const row = await this.findOwnedOrThrow(user, id);
        if (row.status !== 'ready' || !(0, teleprompter_recording_files_1.objectExists)(row.storageKey)) {
            throw new common_1.BadRequestException('Recording chưa sẵn sàng');
        }
        return new common_1.StreamableFile((0, teleprompter_recording_files_1.openObjectStream)(row.storageKey), {
            type: row.mimeType,
            disposition: `attachment; filename="${(0, teleprompter_recording_files_1.filenameFromTitle)(row.title, row.mimeType).replace(/"/g, '')}"`,
            length: (0, teleprompter_recording_files_1.objectSize)(row.storageKey) || undefined,
        });
    }
};
exports.TeleprompterRecordingService = TeleprompterRecordingService;
exports.TeleprompterRecordingService = TeleprompterRecordingService = TeleprompterRecordingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], TeleprompterRecordingService);
const plan_storage_1 = require("../common/uploads/plan-storage");
