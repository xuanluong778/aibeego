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
exports.LandingPagesController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permissions_guard_1 = require("../common/guards/permissions.guard");
const require_permissions_decorator_1 = require("../common/decorators/require-permissions.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const upload_policy_1 = require("../common/uploads/upload-policy");
const platform_admin_guard_1 = require("../common/guards/platform-admin.guard");
const landing_pages_service_1 = require("./landing-pages.service");
const landing_page_template_pack_service_1 = require("./landing-page-template-pack.service");
const template_pack_1 = require("./template-pack");
const landing_pages_dto_1 = require("./dto/landing-pages.dto");
const templateZipUpload = (0, platform_express_1.FileInterceptor)('file', {
    storage: (0, multer_1.memoryStorage)(),
    limits: { fileSize: template_pack_1.TEMPLATE_PACK_MAX_ZIP_BYTES, files: 1 },
});
const templateBulkUpload = (0, platform_express_1.FilesInterceptor)('files', 300, {
    storage: (0, multer_1.memoryStorage)(),
    limits: { fileSize: template_pack_1.TEMPLATE_BULK_MAX_ZIP_BYTES, files: 300 },
});
let LandingPagesController = class LandingPagesController {
    service;
    templatePacks;
    constructor(service, templatePacks) {
        this.service = service;
        this.templatePacks = templatePacks;
    }
    overview(user) {
        return this.service.overview(user.organizationId);
    }
    getBusinessProfile(user) {
        return this.service.getBusinessProfile(user.organizationId);
    }
    upsertBusinessProfile(user, dto) {
        return this.service.upsertBusinessProfile(user, dto);
    }
    analytics(user, query) {
        return this.service.analytics(user.organizationId, query);
    }
    domains(user) {
        return this.service.listDomains(user.organizationId);
    }
    generate(user, dto) {
        return this.service.generateAi(user, dto);
    }
    suggestBrief(user, dto) {
        return this.service.suggestAiBrief(user, dto);
    }
    templateContent(user, id, dto) {
        return this.service.generateTemplateContent(user, id, dto);
    }
    validateTemplateImages(user, id, dto) {
        return this.service.validateTemplateContentImages(user, id, dto.imageIds);
    }
    readTemplateUrl(user, id, dto) {
        return this.service.readTemplateContentUrl(user, id, dto);
    }
    importTemplateUrlImage(user, id, dto) {
        return this.service.importTemplateUrlImage(user, id, dto);
    }
    crawlUrl(user, dto) {
        return this.service.crawlPublicUrl(user, dto);
    }
    listTemplates(user, query) {
        return this.service.listTemplates(user.organizationId, query, user);
    }
    importTemplatePack(user, file) {
        return this.templatePacks.importNew(user, file);
    }
    importTemplatePacksBulk(user, files) {
        return this.templatePacks.importBulk(user, files);
    }
    async exportAllTemplatePacks(user) {
        const pack = await this.templatePacks.exportAll(user);
        return new common_1.StreamableFile(pack.body, {
            type: 'application/zip',
            disposition: `attachment; filename="${pack.filename}"`,
        });
    }
    async exportTemplatePack(user, idOrSlug) {
        const pack = await this.templatePacks.exportPack(user, idOrSlug);
        return new common_1.StreamableFile(pack.body, {
            type: 'application/zip',
            disposition: `attachment; filename="${pack.filename}"`,
        });
    }
    importTemplatePackUpdate(user, idOrSlug, file) {
        return this.templatePacks.importUpdate(user, idOrSlug, file);
    }
    publishTemplatePack(user, idOrSlug) {
        return this.templatePacks.publish(user, idOrSlug);
    }
    templatePackVersions(user, idOrSlug) {
        return this.templatePacks.listVersions(user, idOrSlug);
    }
    restoreTemplatePack(user, idOrSlug, version) {
        const v = Number(version);
        if (!Number.isInteger(v) || v < 1)
            throw new common_1.BadRequestException('Version không hợp lệ');
        return this.templatePacks.restore(user, idOrSlug, v);
    }
    getTemplate(user, idOrSlug) {
        return this.service.getTemplate(user.organizationId, idOrSlug, user);
    }
    list(user, query) {
        return this.service.listPages(user.organizationId, query);
    }
    create(user, dto) {
        return this.service.create(user, dto);
    }
    get(user, id) {
        return this.service.get(user, id);
    }
    update(user, id, dto) {
        return this.service.update(user, id, dto);
    }
    applyBusinessProfile(user, id, dto) {
        return this.service.applyBusinessProfileToPage(user, id, dto);
    }
    aiSuggestField(user, id, dto) {
        return this.service.suggestInlineField(user, id, dto);
    }
    pageDoctor(user, id) {
        return this.service.runPageDoctor(user, id);
    }
    applyPageDoctor(user, id, dto) {
        return this.service.applyPageDoctor(user, id, dto);
    }
    listVersions(user, id) {
        return this.service.listPageVersions(user, id);
    }
    getVersion(user, id, version) {
        const v = Number(version);
        if (!Number.isInteger(v) || v < 1) {
            throw new common_1.BadRequestException('Version không hợp lệ');
        }
        return this.service.getPageVersion(user, id, v);
    }
    restoreVersion(user, id, version, dto) {
        const v = Number(version);
        if (!Number.isInteger(v) || v < 1) {
            throw new common_1.BadRequestException('Version không hợp lệ');
        }
        return this.service.restorePageVersion(user, id, v, dto);
    }
    previewTokenStatus(user, id) {
        return this.service.getPreviewTokenStatus(user, id);
    }
    issuePreviewToken(user, id, body) {
        return this.service.issuePreviewToken(user, id, {
            expiresInHours: body?.expiresInHours,
        });
    }
    revokePreviewToken(user, id) {
        return this.service.revokePreviewToken(user, id);
    }
    recoverDraft(user, id, dto) {
        return this.service.recoverDraft(user, id, dto);
    }
    autosave(user, id, dto) {
        return this.service.autosave(user, id, dto);
    }
    uploadImage(user, id, file) {
        return this.service.uploadPublicImage(user, id, file);
    }
    uploadBackground(user, id, file) {
        return this.service.uploadPublicBackground(user, id, file);
    }
    listMedia(user, id, scope, q) {
        return this.service.listMedia(user, id, { scope, q });
    }
    publicationOptions(user, id) {
        return this.service.publicationOptions(user, id);
    }
    subdomainAvailability(user, id, label) {
        return this.service.subdomainAvailability(user, id, label);
    }
    publish(user, id, dto) {
        return this.service.publish(user, id, dto);
    }
    unpublish(user, id) {
        return this.service.unpublish(user, id);
    }
    duplicate(user, id) {
        return this.service.duplicate(user, id);
    }
    archive(user, id) {
        return this.service.archive(user, id);
    }
    bulkDelete(user, body) {
        return this.service.bulkDelete(user, body?.ids || []);
    }
    delete(user, id) {
        return this.service.delete(user, id);
    }
    deletePost(user, id) {
        return this.service.delete(user, id);
    }
    upsertDomain(user, id, dto) {
        return this.service.upsertDomain(user, id, dto);
    }
    verifyDomain(user, id) {
        return this.service.verifyDomain(user, id);
    }
    removeDomain(user, id) {
        return this.service.removeDomain(user, id);
    }
};
exports.LandingPagesController = LandingPagesController;
__decorate([
    (0, common_1.Get)('overview'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "overview", null);
__decorate([
    (0, common_1.Get)('business-profile'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "getBusinessProfile", null);
__decorate([
    (0, common_1.Patch)('business-profile'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, landing_pages_dto_1.UpsertBusinessProfileDto]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "upsertBusinessProfile", null);
__decorate([
    (0, common_1.Get)('analytics'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, landing_pages_dto_1.LandingPageAnalyticsQueryDto]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "analytics", null);
__decorate([
    (0, common_1.Get)('domains'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "domains", null);
__decorate([
    (0, common_1.Post)('generate'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, landing_pages_dto_1.GenerateLandingPageAiDto]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "generate", null);
__decorate([
    (0, common_1.Post)('ai-suggest-brief'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, landing_pages_dto_1.SuggestLandingPageBriefDto]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "suggestBrief", null);
__decorate([
    (0, common_1.Post)(':id/ai-template-content'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, landing_pages_dto_1.GenerateTemplateContentDto]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "templateContent", null);
__decorate([
    (0, common_1.Post)(':id/ai-template-content/validate-images'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, landing_pages_dto_1.ValidateTemplateContentImagesDto]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "validateTemplateImages", null);
__decorate([
    (0, common_1.Post)(':id/ai-template-content/read-url'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, landing_pages_dto_1.CrawlLandingPageUrlDto]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "readTemplateUrl", null);
__decorate([
    (0, common_1.Post)(':id/ai-template-content/import-url-image'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, landing_pages_dto_1.ImportTemplateUrlImageDto]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "importTemplateUrlImage", null);
__decorate([
    (0, common_1.Post)('crawl-url'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, landing_pages_dto_1.CrawlLandingPageUrlDto]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "crawlUrl", null);
__decorate([
    (0, common_1.Get)('templates'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, landing_pages_dto_1.ListLandingPageTemplatesQueryDto]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "listTemplates", null);
__decorate([
    (0, common_1.Post)('templates/packs'),
    (0, common_1.UseGuards)(platform_admin_guard_1.PlatformAdminGuard),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    (0, common_1.UseInterceptors)(templateZipUpload),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "importTemplatePack", null);
__decorate([
    (0, common_1.Post)('templates/packs/bulk'),
    (0, common_1.UseGuards)(platform_admin_guard_1.PlatformAdminGuard),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    (0, common_1.UseInterceptors)(templateBulkUpload),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.UploadedFiles)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Array]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "importTemplatePacksBulk", null);
__decorate([
    (0, common_1.Get)('templates/packs/export-all'),
    (0, common_1.UseGuards)(platform_admin_guard_1.PlatformAdminGuard),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], LandingPagesController.prototype, "exportAllTemplatePacks", null);
__decorate([
    (0, common_1.Get)('templates/:idOrSlug/pack'),
    (0, common_1.UseGuards)(platform_admin_guard_1.PlatformAdminGuard),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('idOrSlug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], LandingPagesController.prototype, "exportTemplatePack", null);
__decorate([
    (0, common_1.Post)('templates/:idOrSlug/pack'),
    (0, common_1.UseGuards)(platform_admin_guard_1.PlatformAdminGuard),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    (0, common_1.UseInterceptors)(templateZipUpload),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('idOrSlug')),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "importTemplatePackUpdate", null);
__decorate([
    (0, common_1.Post)('templates/:idOrSlug/publish'),
    (0, common_1.UseGuards)(platform_admin_guard_1.PlatformAdminGuard),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('idOrSlug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "publishTemplatePack", null);
__decorate([
    (0, common_1.Get)('templates/:idOrSlug/versions'),
    (0, common_1.UseGuards)(platform_admin_guard_1.PlatformAdminGuard),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('idOrSlug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "templatePackVersions", null);
__decorate([
    (0, common_1.Post)('templates/:idOrSlug/versions/:version/restore'),
    (0, common_1.UseGuards)(platform_admin_guard_1.PlatformAdminGuard),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('idOrSlug')),
    __param(2, (0, common_1.Param)('version')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "restoreTemplatePack", null);
__decorate([
    (0, common_1.Get)('templates/:idOrSlug'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('idOrSlug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "getTemplate", null);
__decorate([
    (0, common_1.Get)(),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, landing_pages_dto_1.ListLandingPagesQueryDto]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, landing_pages_dto_1.CreateLandingPageDto]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "get", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, landing_pages_dto_1.UpdateLandingPageDto]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/apply-business-profile'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, landing_pages_dto_1.ApplyBusinessProfileDto]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "applyBusinessProfile", null);
__decorate([
    (0, common_1.Post)(':id/ai-suggest-field'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, landing_pages_dto_1.InlineAiSuggestFieldDto]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "aiSuggestField", null);
__decorate([
    (0, common_1.Post)(':id/page-doctor'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "pageDoctor", null);
__decorate([
    (0, common_1.Post)(':id/page-doctor/apply'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, landing_pages_dto_1.ApplyPageDoctorDto]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "applyPageDoctor", null);
__decorate([
    (0, common_1.Get)(':id/versions'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "listVersions", null);
__decorate([
    (0, common_1.Get)(':id/versions/:version'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('version')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "getVersion", null);
__decorate([
    (0, common_1.Post)(':id/versions/:version/restore'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('version')),
    __param(3, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, landing_pages_dto_1.RestoreLandingPageVersionDto]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "restoreVersion", null);
__decorate([
    (0, common_1.Get)(':id/preview-token'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "previewTokenStatus", null);
__decorate([
    (0, common_1.Post)(':id/preview-token'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "issuePreviewToken", null);
__decorate([
    (0, common_1.Post)(':id/preview-token/revoke'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "revokePreviewToken", null);
__decorate([
    (0, common_1.Post)(':id/recover-draft'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, landing_pages_dto_1.AutosaveLandingPageDto]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "recoverDraft", null);
__decorate([
    (0, common_1.Post)(':id/autosave'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, landing_pages_dto_1.AutosaveLandingPageDto]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "autosave", null);
__decorate([
    (0, common_1.Post)(':id/upload-image'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', (0, upload_policy_1.createUploadMulterOptions)('image'))),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "uploadImage", null);
__decorate([
    (0, common_1.Post)(':id/upload-background'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', (0, upload_policy_1.createUploadMulterOptions)('lp_background'))),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "uploadBackground", null);
__decorate([
    (0, common_1.Get)(':id/media'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('scope')),
    __param(3, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "listMedia", null);
__decorate([
    (0, common_1.Get)(':id/publication-options'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "publicationOptions", null);
__decorate([
    (0, common_1.Get)(':id/subdomain-availability'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('label')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "subdomainAvailability", null);
__decorate([
    (0, common_1.Post)(':id/publish'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, landing_pages_dto_1.PublishLandingPageDto]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "publish", null);
__decorate([
    (0, common_1.Post)(':id/unpublish'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "unpublish", null);
__decorate([
    (0, common_1.Post)(':id/duplicate'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "duplicate", null);
__decorate([
    (0, common_1.Post)(':id/archive'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "archive", null);
__decorate([
    (0, common_1.Post)('bulk-delete'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "bulkDelete", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "delete", null);
__decorate([
    (0, common_1.Post)(':id/delete'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "deletePost", null);
__decorate([
    (0, common_1.Post)(':id/domain'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, landing_pages_dto_1.UpsertCustomDomainDto]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "upsertDomain", null);
__decorate([
    (0, common_1.Post)(':id/domain/verify'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "verifyDomain", null);
__decorate([
    (0, common_1.Delete)(':id/domain'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LandingPagesController.prototype, "removeDomain", null);
exports.LandingPagesController = LandingPagesController = __decorate([
    (0, common_1.Controller)('landing-pages'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [landing_pages_service_1.LandingPagesService,
        landing_page_template_pack_service_1.LandingPageTemplatePackService])
], LandingPagesController);
