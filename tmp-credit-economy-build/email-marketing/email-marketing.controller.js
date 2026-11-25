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
exports.EmailMarketingController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const upload_policy_1 = require("../common/uploads/upload-policy");
const email_marketing_service_1 = require("./email-marketing.service");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permissions_guard_1 = require("../common/guards/permissions.guard");
const require_permissions_decorator_1 = require("../common/decorators/require-permissions.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const email_marketing_dto_1 = require("./dto/email-marketing.dto");
let EmailMarketingController = class EmailMarketingController {
    service;
    constructor(service) {
        this.service = service;
    }
    overview(user) {
        return this.service.overview(user.organizationId);
    }
    audiencePreview(user, query) {
        return this.service.previewAudience(user.organizationId, query.listId);
    }
    audienceMembers(user, query) {
        return this.service.listAudienceMembers(user.organizationId, query);
    }
    reports(user) {
        return this.service.reports(user.organizationId);
    }
    listTemplates(user, query) {
        return this.service.listTemplates(user.organizationId, query);
    }
    createTemplate(user, dto) {
        return this.service.createTemplate(user.organizationId, dto, user.id);
    }
    generateContent(user, dto) {
        return this.service.generateEmailContent(user.organizationId, dto.prompt);
    }
    sendTest(user, dto) {
        return this.service.sendTestEmail(dto, user.organizationId);
    }
    updateTemplate(user, id, dto) {
        return this.service.updateTemplate(user.organizationId, id, dto);
    }
    deleteTemplate(user, id) {
        return this.service.deleteTemplate(user.organizationId, id);
    }
    listContacts(user, query) {
        return this.service.listContacts(user.organizationId, query);
    }
    contactFacets(user) {
        return this.service.contactFacets(user.organizationId);
    }
    createContact(user, dto) {
        return this.service.createContact(user.organizationId, dto);
    }
    importCustomers(user) {
        return this.service.importFromCustomers(user.organizationId);
    }
    syncCrm(user) {
        return this.service.syncFromCrm(user.organizationId);
    }
    importFile(user, file, listId) {
        return this.service.importSpreadsheet(user.organizationId, file, listId);
    }
    updateContact(user, id, dto) {
        return this.service.updateContact(user.organizationId, id, dto);
    }
    deleteContact(user, id) {
        return this.service.deleteContact(user.organizationId, id);
    }
    listLists(user, query) {
        return this.service.listLists(user.organizationId, query);
    }
    createList(user, dto) {
        return this.service.createList(user.organizationId, dto);
    }
    updateList(user, id, dto) {
        return this.service.updateList(user.organizationId, id, dto);
    }
    deleteList(user, id) {
        return this.service.deleteList(user.organizationId, id);
    }
    listMembers(user, id, query) {
        return this.service.listMembers(user.organizationId, id, query);
    }
    addMember(user, id, dto) {
        return this.service.addListMember(user.organizationId, id, dto);
    }
    removeMember(user, id, contactId) {
        return this.service.removeListMember(user.organizationId, id, contactId);
    }
    listSegments(user, query) {
        return this.service.listSegments(user.organizationId, query);
    }
    createSegment(user, dto) {
        return this.service.createSegment(user.organizationId, dto);
    }
    updateSegment(user, id, dto) {
        return this.service.updateSegment(user.organizationId, id, dto);
    }
    deleteSegment(user, id) {
        return this.service.deleteSegment(user.organizationId, id);
    }
    listCampaigns(user, query) {
        return this.service.listCampaigns(user.organizationId, query);
    }
    createCampaign(user, dto) {
        return this.service.createCampaign(user.organizationId, dto, user.id);
    }
    getCampaign(user, id) {
        return this.service.getCampaign(user.organizationId, id);
    }
    updateCampaign(user, id, dto) {
        return this.service.updateCampaign(user.organizationId, id, dto);
    }
    deleteCampaign(user, id) {
        return this.service.deleteCampaign(user.organizationId, id);
    }
    sendCampaign(user, id) {
        return this.service.sendCampaign(user.organizationId, id);
    }
    scheduleCampaign(user, id, dto) {
        return this.service.scheduleCampaign(user.organizationId, id, dto);
    }
    pauseCampaign(user, id) {
        return this.service.pauseCampaign(user.organizationId, id);
    }
    cancelCampaign(user, id) {
        return this.service.cancelCampaign(user.organizationId, id);
    }
    listRecipients(user, id, query) {
        return this.service.listRecipients(user.organizationId, id, query);
    }
    listSuppressions(user, query) {
        return this.service.listSuppressions(user.organizationId, query);
    }
    createSuppression(user, dto) {
        return this.service.createSuppression(user.organizationId, dto);
    }
    deleteSuppression(user, id) {
        return this.service.deleteSuppression(user.organizationId, id);
    }
    listDomains(user) {
        return this.service.listDomains(user.organizationId);
    }
    createDomain(user, dto) {
        return this.service.createDomain(user.organizationId, dto);
    }
    updateDomain(user, id, dto) {
        return this.service.updateDomain(user.organizationId, id, dto);
    }
    verifyDomain(user, id) {
        return this.service.verifyDomain(user.organizationId, id);
    }
    checkDomain(user, id) {
        return this.service.checkDomain(user.organizationId, id);
    }
    deleteDomain(user, id) {
        return this.service.deleteDomain(user.organizationId, id);
    }
    listAutomationRecipes(user) {
        return this.service.listAutomationRecipes(user.organizationId);
    }
    listCrmStages(user) {
        return this.service.listCrmStagesForAutomation(user.organizationId);
    }
    listAutomations(user) {
        return this.service.listAutomations(user.organizationId);
    }
    createAutomationFromRecipe(user, dto) {
        return this.service.createAutomationFromRecipe(user.organizationId, dto);
    }
    createAutomation(user, dto) {
        return this.service.createAutomation(user.organizationId, dto);
    }
    updateAutomation(user, id, dto) {
        return this.service.updateAutomation(user.organizationId, id, dto);
    }
    deleteAutomation(user, id) {
        return this.service.deleteAutomation(user.organizationId, id);
    }
    runAutomation(user, id) {
        return this.service.runAutomation(user.organizationId, id);
    }
};
exports.EmailMarketingController = EmailMarketingController;
__decorate([
    (0, common_1.Get)('overview'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "overview", null);
__decorate([
    (0, common_1.Get)('audience-preview'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, email_marketing_dto_1.AudiencePreviewQueryDto]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "audiencePreview", null);
__decorate([
    (0, common_1.Get)('audience-members'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, email_marketing_dto_1.AudienceMembersQueryDto]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "audienceMembers", null);
__decorate([
    (0, common_1.Get)('reports'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "reports", null);
__decorate([
    (0, common_1.Get)('templates'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, email_marketing_dto_1.EmailSearchQueryDto]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "listTemplates", null);
__decorate([
    (0, common_1.Post)('templates'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, email_marketing_dto_1.CreateEmailTemplateDto]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "createTemplate", null);
__decorate([
    (0, common_1.Post)('generate'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, email_marketing_dto_1.GenerateEmailContentDto]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "generateContent", null);
__decorate([
    (0, common_1.Post)('send-test'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.send'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, email_marketing_dto_1.SendTestEmailDto]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "sendTest", null);
__decorate([
    (0, common_1.Patch)('templates/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, email_marketing_dto_1.UpdateEmailTemplateDto]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "updateTemplate", null);
__decorate([
    (0, common_1.Delete)('templates/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "deleteTemplate", null);
__decorate([
    (0, common_1.Get)('contacts'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, email_marketing_dto_1.ContactQueryDto]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "listContacts", null);
__decorate([
    (0, common_1.Get)('contacts/facets'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "contactFacets", null);
__decorate([
    (0, common_1.Post)('contacts'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, email_marketing_dto_1.CreateEmailContactDto]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "createContact", null);
__decorate([
    (0, common_1.Post)('contacts/import-customers'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "importCustomers", null);
__decorate([
    (0, common_1.Post)('contacts/sync-crm'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "syncCrm", null);
__decorate([
    (0, common_1.Post)('contacts/import-file'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', (0, upload_policy_1.createUploadMulterOptions)('spreadsheet'))),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Query)('listId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "importFile", null);
__decorate([
    (0, common_1.Patch)('contacts/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, email_marketing_dto_1.UpdateEmailContactDto]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "updateContact", null);
__decorate([
    (0, common_1.Delete)('contacts/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "deleteContact", null);
__decorate([
    (0, common_1.Get)('lists'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, email_marketing_dto_1.EmailSearchQueryDto]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "listLists", null);
__decorate([
    (0, common_1.Post)('lists'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, email_marketing_dto_1.CreateEmailListDto]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "createList", null);
__decorate([
    (0, common_1.Patch)('lists/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, email_marketing_dto_1.CreateEmailListDto]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "updateList", null);
__decorate([
    (0, common_1.Delete)('lists/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "deleteList", null);
__decorate([
    (0, common_1.Get)('lists/:id/members'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, email_marketing_dto_1.EmailSearchQueryDto]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "listMembers", null);
__decorate([
    (0, common_1.Post)('lists/:id/members'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, email_marketing_dto_1.AddListMemberDto]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "addMember", null);
__decorate([
    (0, common_1.Delete)('lists/:id/members/:contactId'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('contactId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "removeMember", null);
__decorate([
    (0, common_1.Get)('segments'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, email_marketing_dto_1.EmailSearchQueryDto]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "listSegments", null);
__decorate([
    (0, common_1.Post)('segments'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, email_marketing_dto_1.CreateEmailSegmentDto]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "createSegment", null);
__decorate([
    (0, common_1.Patch)('segments/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, email_marketing_dto_1.CreateEmailSegmentDto]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "updateSegment", null);
__decorate([
    (0, common_1.Delete)('segments/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "deleteSegment", null);
__decorate([
    (0, common_1.Get)('campaigns'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, email_marketing_dto_1.CampaignQueryDto]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "listCampaigns", null);
__decorate([
    (0, common_1.Post)('campaigns'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, email_marketing_dto_1.CreateEmailCampaignDto]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "createCampaign", null);
__decorate([
    (0, common_1.Get)('campaigns/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "getCampaign", null);
__decorate([
    (0, common_1.Patch)('campaigns/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, email_marketing_dto_1.UpdateEmailCampaignDto]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "updateCampaign", null);
__decorate([
    (0, common_1.Delete)('campaigns/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "deleteCampaign", null);
__decorate([
    (0, common_1.Post)('campaigns/:id/send'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.send'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "sendCampaign", null);
__decorate([
    (0, common_1.Post)('campaigns/:id/schedule'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.send'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, email_marketing_dto_1.ScheduleEmailCampaignDto]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "scheduleCampaign", null);
__decorate([
    (0, common_1.Post)('campaigns/:id/pause'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.send'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "pauseCampaign", null);
__decorate([
    (0, common_1.Post)('campaigns/:id/cancel'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.send'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "cancelCampaign", null);
__decorate([
    (0, common_1.Get)('campaigns/:id/recipients'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, email_marketing_dto_1.CampaignRecipientQueryDto]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "listRecipients", null);
__decorate([
    (0, common_1.Get)('suppressions'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, email_marketing_dto_1.EmailSearchQueryDto]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "listSuppressions", null);
__decorate([
    (0, common_1.Post)('suppressions'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, email_marketing_dto_1.CreateEmailSuppressionDto]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "createSuppression", null);
__decorate([
    (0, common_1.Delete)('suppressions/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "deleteSuppression", null);
__decorate([
    (0, common_1.Get)('domains'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "listDomains", null);
__decorate([
    (0, common_1.Post)('domains'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, email_marketing_dto_1.CreateSenderDomainDto]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "createDomain", null);
__decorate([
    (0, common_1.Patch)('domains/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, email_marketing_dto_1.UpdateSenderDomainDto]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "updateDomain", null);
__decorate([
    (0, common_1.Post)('domains/:id/verify'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "verifyDomain", null);
__decorate([
    (0, common_1.Post)('domains/:id/check'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "checkDomain", null);
__decorate([
    (0, common_1.Delete)('domains/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "deleteDomain", null);
__decorate([
    (0, common_1.Get)('automations/recipes'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "listAutomationRecipes", null);
__decorate([
    (0, common_1.Get)('automations/crm-stages'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "listCrmStages", null);
__decorate([
    (0, common_1.Get)('automations'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "listAutomations", null);
__decorate([
    (0, common_1.Post)('automations/from-recipe'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, email_marketing_dto_1.CreateEmailAutomationFromRecipeDto]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "createAutomationFromRecipe", null);
__decorate([
    (0, common_1.Post)('automations'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, email_marketing_dto_1.CreateEmailAutomationDto]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "createAutomation", null);
__decorate([
    (0, common_1.Patch)('automations/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, email_marketing_dto_1.UpdateEmailAutomationDto]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "updateAutomation", null);
__decorate([
    (0, common_1.Delete)('automations/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "deleteAutomation", null);
__decorate([
    (0, common_1.Post)('automations/:id/run'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.send'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], EmailMarketingController.prototype, "runAutomation", null);
exports.EmailMarketingController = EmailMarketingController = __decorate([
    (0, common_1.Controller)('email-marketing'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [email_marketing_service_1.EmailMarketingService])
], EmailMarketingController);
