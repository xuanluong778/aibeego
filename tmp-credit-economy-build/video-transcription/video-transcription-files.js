"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_MEDIA_EXT = exports.ALLOWED_MEDIA_MIME = void 0;
exports.videoTranscriptionUploadsRoot = videoTranscriptionUploadsRoot;
exports.ensureOrgWorkDir = ensureOrgWorkDir;
exports.removeWorkDir = removeWorkDir;
const path_1 = require("path");
const fs_1 = require("fs");
const common_1 = require("@nestjs/common");
const log = new common_1.Logger('VideoTranscriptionFiles');
/** Absolute uploads root for video transcription workdirs */
function videoTranscriptionUploadsRoot() {
    const fromEnv = process.env.VIDEO_TRANSCRIPTION_UPLOAD_DIR?.trim();
    if (fromEnv)
        return fromEnv;
    // apps/api cwd → monorepo uploads/
    return (0, path_1.join)(process.cwd(), '..', '..', 'uploads', 'video-transcriptions');
}
function ensureOrgWorkDir(organizationId, transcriptionId) {
    const relative = (0, path_1.join)(organizationId, transcriptionId);
    const absolute = (0, path_1.join)(videoTranscriptionUploadsRoot(), relative);
    (0, fs_1.mkdirSync)(absolute, { recursive: true });
    return { absolute, relative };
}
function removeWorkDir(absolutePath) {
    if (!absolutePath)
        return;
    try {
        if ((0, fs_1.existsSync)(absolutePath)) {
            (0, fs_1.rmSync)(absolutePath, { recursive: true, force: true });
            log.log(`Removed temp dir ${absolutePath}`);
        }
    }
    catch (err) {
        log.warn(`Failed to remove temp dir ${absolutePath}: ${err instanceof Error ? err.message : err}`);
    }
}
exports.ALLOWED_MEDIA_MIME = new Set([
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/webm',
    'audio/ogg',
    'application/octet-stream',
]);
exports.ALLOWED_MEDIA_EXT = new Set([
    '.mp4',
    '.webm',
    '.mov',
    '.avi',
    '.mkv',
    '.mp3',
    '.wav',
    '.m4a',
    '.ogg',
    '.aac',
]);
