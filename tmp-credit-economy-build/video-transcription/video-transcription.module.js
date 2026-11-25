"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoTranscriptionModule = void 0;
const common_1 = require("@nestjs/common");
const video_transcription_controller_1 = require("./video-transcription.controller");
const video_transcription_service_1 = require("./video-transcription.service");
const billing_module_1 = require("../billing/billing.module");
let VideoTranscriptionModule = class VideoTranscriptionModule {
};
exports.VideoTranscriptionModule = VideoTranscriptionModule;
exports.VideoTranscriptionModule = VideoTranscriptionModule = __decorate([
    (0, common_1.Module)({
        imports: [billing_module_1.BillingModule],
        controllers: [video_transcription_controller_1.VideoTranscriptionController],
        providers: [video_transcription_service_1.VideoTranscriptionService],
        exports: [video_transcription_service_1.VideoTranscriptionService],
    })
], VideoTranscriptionModule);
