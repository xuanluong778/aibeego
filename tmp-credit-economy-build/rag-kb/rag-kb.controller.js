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
exports.RagKbController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const upload_policy_1 = require("../common/uploads/upload-policy");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const rag_kb_service_1 = require("./rag-kb.service");
const rag_source_service_1 = require("./rag-source.service");
const rag_kb_dto_1 = require("./dto/rag-kb.dto");
const rag_kb_dto_2 = require("./dto/rag-kb.dto");
let RagKbController = class RagKbController {
    service;
    sources;
    constructor(service, sources) {
        this.service = service;
        this.sources = sources;
    }
    facebookPages(user) { return this.sources.pages(user.organizationId); }
    async exportMarkdown(user, id, res) {
        const file = await this.service.exportMarkdown(user.organizationId, id);
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
        res.setHeader('Cache-Control', 'private, no-store');
        res.send(file.body);
    }
    listSources(user, id) { return this.sources.list(user.organizationId, id); }
    createSource(user, id, dto) { return this.sources.create(user.organizationId, id, dto); }
    syncSource(user, id, sourceId) { return this.sources.sync(user.organizationId, id, sourceId); }
    toggleSource(user, id, sourceId, dto) { return this.sources.toggle(user.organizationId, id, sourceId, dto.enabled); }
    removeSource(user, id, sourceId) { return this.sources.remove(user.organizationId, id, sourceId); }
    list(user) {
        return this.service.list(user.organizationId);
    }
    create(user, dto) {
        return this.service.create(user.organizationId, dto);
    }
    search(user, dto) {
        return this.service.search(user.organizationId, dto);
    }
    listChatbots(user) {
        return this.service.listChatbotsForKnowledge(user.organizationId);
    }
    listZaloOas(user) {
        return this.service.listZaloOasForKnowledge(user.organizationId);
    }
    connectChatbot(user, botId, dto) {
        return this.service.connectBotKnowledge(user.organizationId, botId, dto);
    }
    consolidateChatbot(user, botId) {
        return this.service.consolidateBotKnowledge(user.organizationId, botId);
    }
    connectZaloOa(user, connectionId, dto) {
        return this.service.connectZaloOaBot(user.organizationId, connectionId, dto.botId ?? null);
    }
    get(user, id) {
        return this.service.get(user.organizationId, id);
    }
    update(user, id, dto) {
        return this.service.update(user.organizationId, id, dto);
    }
    remove(user, id) {
        return this.service.remove(user.organizationId, id);
    }
    reindex(user, id) {
        return this.service.reindex(user.organizationId, id);
    }
    importText(user, id, dto) {
        return this.service.importText(user.organizationId, id, dto);
    }
    importUrl(user, id, dto) {
        return this.service.importUrl(user.organizationId, id, dto);
    }
    importFile(user, id, file) {
        return this.service.importFile(user.organizationId, id, file || {});
    }
    getDocument(user, id, docId) {
        return this.service.getDocumentDetail(user.organizationId, id, docId);
    }
    updateDocument(user, id, docId, dto) {
        return this.service.updateDocument(user.organizationId, id, docId, dto);
    }
    async downloadDocument(user, id, docId, res) {
        const file = await this.service.downloadDocument(user.organizationId, id, docId);
        res.setHeader('Content-Type', file.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
        res.send(file.body);
    }
    deleteDocument(user, id, docId) {
        return this.service.deleteDocument(user.organizationId, id, docId);
    }
};
exports.RagKbController = RagKbController;
__decorate([
    (0, common_1.Get)('facebook-pages'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RagKbController.prototype, "facebookPages", null);
__decorate([
    (0, common_1.Get)(':id/export.md'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], RagKbController.prototype, "exportMarkdown", null);
__decorate([
    (0, common_1.Get)(':id/sources'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], RagKbController.prototype, "listSources", null);
__decorate([
    (0, common_1.Post)(':id/sources'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, rag_kb_dto_1.CreateRagSourceDto]),
    __metadata("design:returntype", void 0)
], RagKbController.prototype, "createSource", null);
__decorate([
    (0, common_1.Post)(':id/sources/:sourceId/sync'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('sourceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], RagKbController.prototype, "syncSource", null);
__decorate([
    (0, common_1.Patch)(':id/sources/:sourceId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('sourceId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, rag_kb_dto_1.ToggleRagSourceDto]),
    __metadata("design:returntype", void 0)
], RagKbController.prototype, "toggleSource", null);
__decorate([
    (0, common_1.Delete)(':id/sources/:sourceId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('sourceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], RagKbController.prototype, "removeSource", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RagKbController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, rag_kb_dto_2.CreateRagKbDto]),
    __metadata("design:returntype", void 0)
], RagKbController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('search'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, rag_kb_dto_2.RagKbSearchDto]),
    __metadata("design:returntype", void 0)
], RagKbController.prototype, "search", null);
__decorate([
    (0, common_1.Get)('chatbots'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RagKbController.prototype, "listChatbots", null);
__decorate([
    (0, common_1.Get)('zalo-oas'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], RagKbController.prototype, "listZaloOas", null);
__decorate([
    (0, common_1.Patch)('chatbots/:botId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('botId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, rag_kb_dto_2.ConnectSharedKnowledgeDto]),
    __metadata("design:returntype", void 0)
], RagKbController.prototype, "connectChatbot", null);
__decorate([
    (0, common_1.Post)('chatbots/:botId/consolidate'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('botId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], RagKbController.prototype, "consolidateChatbot", null);
__decorate([
    (0, common_1.Patch)('zalo-oas/:connectionId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('connectionId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, rag_kb_dto_2.ConnectKnowledgeZaloOaDto]),
    __metadata("design:returntype", void 0)
], RagKbController.prototype, "connectZaloOa", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], RagKbController.prototype, "get", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, rag_kb_dto_2.UpdateRagKbDto]),
    __metadata("design:returntype", void 0)
], RagKbController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], RagKbController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/reindex'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], RagKbController.prototype, "reindex", null);
__decorate([
    (0, common_1.Post)(':id/import/text'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, rag_kb_dto_2.ImportRagKbTextDto]),
    __metadata("design:returntype", void 0)
], RagKbController.prototype, "importText", null);
__decorate([
    (0, common_1.Post)(':id/import/url'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, rag_kb_dto_2.ImportRagKbUrlDto]),
    __metadata("design:returntype", void 0)
], RagKbController.prototype, "importUrl", null);
__decorate([
    (0, common_1.Post)(':id/import/file'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', (0, upload_policy_1.createUploadMulterOptions)('kb_text'))),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], RagKbController.prototype, "importFile", null);
__decorate([
    (0, common_1.Get)(':id/documents/:docId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('docId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], RagKbController.prototype, "getDocument", null);
__decorate([
    (0, common_1.Patch)(':id/documents/:docId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('docId')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, rag_kb_dto_2.UpdateRagDocumentDto]),
    __metadata("design:returntype", void 0)
], RagKbController.prototype, "updateDocument", null);
__decorate([
    (0, common_1.Get)(':id/documents/:docId/download'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('docId')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", Promise)
], RagKbController.prototype, "downloadDocument", null);
__decorate([
    (0, common_1.Delete)(':id/documents/:docId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('docId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], RagKbController.prototype, "deleteDocument", null);
exports.RagKbController = RagKbController = __decorate([
    (0, common_1.Controller)('rag-kb'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __metadata("design:paramtypes", [rag_kb_service_1.RagKbService, rag_source_service_1.RagSourceService])
], RagKbController);
