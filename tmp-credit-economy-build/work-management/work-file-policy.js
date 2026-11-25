"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORK_UPLOAD_MAX_BYTES = exports.sanitizeOriginalName = void 0;
exports.classifyWorkUpload = classifyWorkUpload;
const common_1 = require("@nestjs/common");
const upload_policy_1 = require("../common/uploads/upload-policy");
Object.defineProperty(exports, "sanitizeOriginalName", { enumerable: true, get: function () { return upload_policy_1.sanitizeOriginalName; } });
function classifyWorkUpload(originalName, mimeType, size) {
    const classified = (0, upload_policy_1.assertUploadFile)('work', {
        originalname: originalName,
        mimetype: mimeType,
        size,
    });
    const kindMap = {
        '.jpg': 'image',
        '.jpeg': 'image',
        '.png': 'image',
        '.gif': 'image',
        '.webp': 'image',
        '.pdf': 'pdf',
        '.doc': 'doc',
        '.docx': 'doc',
        '.xls': 'sheet',
        '.xlsx': 'sheet',
        '.mp4': 'video',
        '.webm': 'video',
        '.mov': 'video',
        '.zip': 'zip',
    };
    const kind = kindMap[classified.ext];
    if (!kind)
        throw new common_1.BadRequestException('Loại file không được phép');
    return { ...classified, kind };
}
exports.WORK_UPLOAD_MAX_BYTES = 100 * 1024 * 1024;
