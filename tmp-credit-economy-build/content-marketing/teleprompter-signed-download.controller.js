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
exports.TeleprompterSignedDownloadController = void 0;
/**
 * Signed download — token-only; no JWT required (URL expires via HMAC exp).
 */
const common_1 = require("@nestjs/common");
const teleprompter_recording_service_1 = require("./teleprompter-recording.service");
let TeleprompterSignedDownloadController = class TeleprompterSignedDownloadController {
    recordings;
    constructor(recordings) {
        this.recordings = recordings;
    }
    download(id, token) {
        if (!token?.trim()) {
            throw new common_1.UnauthorizedException('Thiếu token tải xuống');
        }
        return this.recordings.streamDownloadByToken(id, token.trim());
    }
};
exports.TeleprompterSignedDownloadController = TeleprompterSignedDownloadController;
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('token')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], TeleprompterSignedDownloadController.prototype, "download", null);
exports.TeleprompterSignedDownloadController = TeleprompterSignedDownloadController = __decorate([
    (0, common_1.Controller)('content-marketing/teleprompter-signed'),
    __metadata("design:paramtypes", [teleprompter_recording_service_1.TeleprompterRecordingService])
], TeleprompterSignedDownloadController);
