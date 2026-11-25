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
exports.VideoTranscriptionController = void 0;
const multer_1 = require("multer");
const path_1 = require("path");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const shared_1 = require("@marketingspa/shared");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const upload_policy_1 = require("../common/uploads/upload-policy");
const video_transcription_service_1 = require("./video-transcription.service");
const video_transcription_dto_1 = require("./dto/video-transcription.dto");
const video_transcription_files_1 = require("./video-transcription-files");
const maxBytes = () => Number(process.env.VIDEO_TRANSCRIPTION_MAX_FILE_BYTES) > 0
    ? Number(process.env.VIDEO_TRANSCRIPTION_MAX_FILE_BYTES)
    : shared_1.VIDEO_TRANSCRIPTION_LIMITS.maxFileBytes;
let VideoTranscriptionController = class VideoTranscriptionController {
    service;
    constructor(service) {
        this.service = service;
    }
    create(user, dto, file) {
        return this.service.create(user, dto, file);
    }
    probeUrl(user, dto) {
        return this.service.probeUrl(user, dto.url);
    }
    getGlossary(user) {
        return this.service.getGlossary(user);
    }
    getById(user, id) {
        return this.service.getById(user, id);
    }
    async downloadVideo(user, id) {
        const { file } = await this.service.downloadVideo(user, id);
        return file;
    }
    async downloadTranscript(user, id) {
        const { file } = await this.service.downloadTranscript(user, id);
        return file;
    }
    patchText(user, id, dto) {
        return this.service.updateText(user, id, dto.cleanedTranscript);
    }
    retry(user, id) {
        return this.service.retry(user, id);
    }
    cancel(user, id) {
        return this.service.cancel(user, id);
    }
    retryChunk(user, id, dto) {
        return this.service.retryChunk(user, id, dto.chunkIndex);
    }
};
exports.VideoTranscriptionController = VideoTranscriptionController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        ...(0, upload_policy_1.createUploadMulterOptions)('video_transcription'),
        storage: (0, multer_1.diskStorage)({
            destination: (_req, _file, cb) => {
                const dir = (0, path_1.join)((0, video_transcription_files_1.videoTranscriptionUploadsRoot)(), '_incoming');
                (0, fs_1.mkdirSync)(dir, { recursive: true });
                cb(null, dir);
            },
            filename: (_req, file, cb) => {
                try {
                    const safe = (0, upload_policy_1.sanitizeOriginalName)(file.originalname || 'video.bin');
                    const ext = (0, path_1.extname)(safe).slice(0, 10) || '.bin';
                    cb(null, `${(0, crypto_1.randomUUID)()}${ext}`);
                }
                catch (e) {
                    cb(e, '');
                }
            },
        }),
        limits: { fileSize: maxBytes() },
    })),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, video_transcription_dto_1.CreateVideoTranscriptionDto, Object]),
    __metadata("design:returntype", void 0)
], VideoTranscriptionController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('probe-url'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, video_transcription_dto_1.ProbeVideoTranscriptionUrlDto]),
    __metadata("design:returntype", void 0)
], VideoTranscriptionController.prototype, "probeUrl", null);
__decorate([
    (0, common_1.Get)('glossary'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], VideoTranscriptionController.prototype, "getGlossary", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], VideoTranscriptionController.prototype, "getById", null);
__decorate([
    (0, common_1.Get)(':id/download-video'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], VideoTranscriptionController.prototype, "downloadVideo", null);
__decorate([
    (0, common_1.Get)(':id/download-transcript'),
    (0, common_1.Header)('Content-Type', 'text/plain; charset=utf-8'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], VideoTranscriptionController.prototype, "downloadTranscript", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, video_transcription_dto_1.PatchVideoTranscriptionTextDto]),
    __metadata("design:returntype", void 0)
], VideoTranscriptionController.prototype, "patchText", null);
__decorate([
    (0, common_1.Post)(':id/retry'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], VideoTranscriptionController.prototype, "retry", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], VideoTranscriptionController.prototype, "cancel", null);
__decorate([
    (0, common_1.Post)(':id/retry-chunk'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, video_transcription_dto_1.RetryVideoTranscriptionChunkDto]),
    __metadata("design:returntype", void 0)
], VideoTranscriptionController.prototype, "retryChunk", null);
exports.VideoTranscriptionController = VideoTranscriptionController = __decorate([
    (0, common_1.Controller)('video-transcriptions'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __metadata("design:paramtypes", [video_transcription_service_1.VideoTranscriptionService])
], VideoTranscriptionController);
