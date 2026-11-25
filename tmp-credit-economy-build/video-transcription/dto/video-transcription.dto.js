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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryVideoTranscriptionChunkDto = exports.PatchVideoTranscriptionTextDto = exports.ProbeVideoTranscriptionUrlDto = exports.CreateVideoTranscriptionDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
function toBool(v) {
    if (v === true || v === 'true' || v === '1' || v === 1)
        return true;
    if (v === false || v === 'false' || v === '0' || v === 0)
        return false;
    return undefined;
}
class CreateVideoTranscriptionDto {
    glossary;
    language;
    ownershipConfirmed;
    sourceUrl;
    sourceTitle;
    thumbnailUrl;
    durationSeconds;
}
exports.CreateVideoTranscriptionDto = CreateVideoTranscriptionDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], CreateVideoTranscriptionDto.prototype, "glossary", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateVideoTranscriptionDto.prototype, "language", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(({ value }) => toBool(value)),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateVideoTranscriptionDto.prototype, "ownershipConfirmed", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateVideoTranscriptionDto.prototype, "sourceUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateVideoTranscriptionDto.prototype, "sourceTitle", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateVideoTranscriptionDto.prototype, "thumbnailUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateVideoTranscriptionDto.prototype, "durationSeconds", void 0);
class ProbeVideoTranscriptionUrlDto {
    url;
}
exports.ProbeVideoTranscriptionUrlDto = ProbeVideoTranscriptionUrlDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    __metadata("design:type", String)
], ProbeVideoTranscriptionUrlDto.prototype, "url", void 0);
class PatchVideoTranscriptionTextDto {
    cleanedTranscript;
}
exports.PatchVideoTranscriptionTextDto = PatchVideoTranscriptionTextDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], PatchVideoTranscriptionTextDto.prototype, "cleanedTranscript", void 0);
class RetryVideoTranscriptionChunkDto {
    chunkIndex;
}
exports.RetryVideoTranscriptionChunkDto = RetryVideoTranscriptionChunkDto;
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], RetryVideoTranscriptionChunkDto.prototype, "chunkIndex", void 0);
