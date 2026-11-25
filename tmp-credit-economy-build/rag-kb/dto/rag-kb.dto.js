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
exports.UpdateRagDocumentDto = exports.ConnectKnowledgeZaloOaDto = exports.ConnectSharedKnowledgeDto = exports.RagKbSearchDto = exports.ImportRagKbUrlDto = exports.ImportRagKbTextDto = exports.UpdateRagKbDto = exports.CreateRagKbDto = exports.ToggleRagSourceDto = exports.CreateRagSourceDto = void 0;
const class_validator_1 = require("class-validator");
class CreateRagSourceDto {
    kind;
    url;
    facebookPageId;
}
exports.CreateRagSourceDto = CreateRagSourceDto;
__decorate([
    (0, class_validator_1.IsIn)(['WEBSITE', 'FACEBOOK']),
    __metadata("design:type", String)
], CreateRagSourceDto.prototype, "kind", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(1800),
    __metadata("design:type", String)
], CreateRagSourceDto.prototype, "url", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], CreateRagSourceDto.prototype, "facebookPageId", void 0);
class ToggleRagSourceDto {
    enabled;
}
exports.ToggleRagSourceDto = ToggleRagSourceDto;
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ToggleRagSourceDto.prototype, "enabled", void 0);
class CreateRagKbDto {
    name;
    description;
    isDefault;
}
exports.CreateRagKbDto = CreateRagKbDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CreateRagKbDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateRagKbDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateRagKbDto.prototype, "isDefault", void 0);
class UpdateRagKbDto {
    description;
    isDefault;
    name;
}
exports.UpdateRagKbDto = UpdateRagKbDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateRagKbDto.prototype, "description", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateRagKbDto.prototype, "isDefault", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateRagKbDto.prototype, "name", void 0);
class ImportRagKbTextDto {
    content;
    title;
}
exports.ImportRagKbTextDto = ImportRagKbTextDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], ImportRagKbTextDto.prototype, "content", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], ImportRagKbTextDto.prototype, "title", void 0);
class ImportRagKbUrlDto {
    title;
    url;
}
exports.ImportRagKbUrlDto = ImportRagKbUrlDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ImportRagKbUrlDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], ImportRagKbUrlDto.prototype, "url", void 0);
class RagKbSearchDto {
    knowledgeBaseId;
    query;
}
exports.RagKbSearchDto = RagKbSearchDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], RagKbSearchDto.prototype, "knowledgeBaseId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], RagKbSearchDto.prototype, "query", void 0);
class ConnectSharedKnowledgeDto {
    knowledgeBaseId;
    zaloAutoReply;
}
exports.ConnectSharedKnowledgeDto = ConnectSharedKnowledgeDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], ConnectSharedKnowledgeDto.prototype, "knowledgeBaseId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], ConnectSharedKnowledgeDto.prototype, "zaloAutoReply", void 0);
class ConnectKnowledgeZaloOaDto {
    botId;
}
exports.ConnectKnowledgeZaloOaDto = ConnectKnowledgeZaloOaDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], ConnectKnowledgeZaloOaDto.prototype, "botId", void 0);
class UpdateRagDocumentDto {
    title;
    content;
}
exports.UpdateRagDocumentDto = UpdateRagDocumentDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], UpdateRagDocumentDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], UpdateRagDocumentDto.prototype, "content", void 0);
