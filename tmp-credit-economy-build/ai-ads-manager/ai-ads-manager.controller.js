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
exports.AiAdsManagerController = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permissions_guard_1 = require("../common/guards/permissions.guard");
const require_permissions_decorator_1 = require("../common/decorators/require-permissions.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const ai_ads_manager_service_1 = require("./ai-ads-manager.service");
const google_ads_campaign_builder_service_1 = require("./google-ads-campaign-builder.service");
const google_ads_autopilot_service_1 = require("./google-ads-autopilot.service");
const google_ads_optimization_service_1 = require("./google-ads-optimization.service");
const ai_ads_manager_dto_1 = require("./dto/ai-ads-manager.dto");
const google_ads_campaign_builder_dto_1 = require("./dto/google-ads-campaign-builder.dto");
const google_ads_autopilot_dto_1 = require("./dto/google-ads-autopilot.dto");
const google_ads_optimization_dto_1 = require("./dto/google-ads-optimization.dto");
const google_ads_dto_1 = require("../ad-performance/google-ads/dto/google-ads.dto");
let AiAdsManagerController = class AiAdsManagerController {
    service;
    campaignBuilder;
    autopilot;
    optimization;
    constructor(service, campaignBuilder, autopilot, optimization) {
        this.service = service;
        this.campaignBuilder = campaignBuilder;
        this.autopilot = autopilot;
        this.optimization = optimization;
    }
    dashboard(user, q) {
        return this.service.getDashboard(user, q.dateFrom, q.dateTo);
    }
    connections(user) {
        return this.service.getConnections(user);
    }
    metaOAuthStart(user) {
        return this.service.getMetaOAuthStart(user);
    }
    googleOAuthStart(user) {
        return this.service.getGoogleOAuthStart(user);
    }
    googleCustomers(user) {
        return this.service.listGoogleCustomers(user);
    }
    selectGoogleCustomer(user, dto) {
        return this.service.selectGoogleCustomer(user, {
            customerId: dto.customerId,
            customerName: dto.customerName,
            loginCustomerId: dto.loginCustomerId,
        });
    }
    googleAccounts(user) {
        return this.service.listGoogleLinkedAccounts(user);
    }
    selectGoogleAccounts(user, dto) {
        return this.service.selectGoogleAccounts(user, dto);
    }
    syncGoogle(user, dto) {
        return this.service.syncGoogleOnly(user, { dateFrom: dto.dateFrom, dateTo: dto.dateTo });
    }
    /** Paste refresh token bị từ chối — dùng google/oauth/start */
    connectGoogle(user, dto) {
        return this.service.connectGoogle(user, dto);
    }
    connectGmail(user, dto) {
        return this.service.connectGmail(user, dto);
    }
    disconnect(user, provider) {
        return this.service.disconnect(user, provider);
    }
    sync(user, dto) {
        return this.service.sync(user, dto);
    }
    listSyncJobs(user, limit) {
        return this.service.listSyncJobs(user, limit ? Number(limit) : 30);
    }
    getSyncJob(user, jobId) {
        return this.service.getSyncJob(user, jobId);
    }
    campaigns(user, q) {
        return this.service.getCampaigns(user, q.dateFrom, q.dateTo, {
            platform: q.platform,
            page: q.page ? Number(q.page) : 1,
            pageSize: q.pageSize ? Number(q.pageSize) : 20,
        });
    }
    settings(user) {
        return this.service.getSettings(user);
    }
    updateAutoMode(user, dto) {
        return this.service.updateAutoMode(user, dto);
    }
    emergencyStop(user, dto) {
        return this.service.setEmergencyStop(user, dto.emergencyStop);
    }
    listRules(user) {
        return this.service.listRules(user);
    }
    createRule(user, dto) {
        return this.service.createRule(user, dto);
    }
    updateRule(user, id, dto) {
        return this.service.updateRule(user, id, dto);
    }
    deleteRule(user, id) {
        return this.service.deleteRule(user, id);
    }
    pauseCampaign(user, dto) {
        return this.service.pauseCampaign(user, dto.campaignId);
    }
    enableCampaign(user, dto) {
        return this.service.enableCampaign(user, dto.campaignId);
    }
    optimizeCampaign(user, dto) {
        return this.service.optimizeCampaign(user, dto.campaignId);
    }
    logs(user, limit) {
        return this.service.listLogs(user, limit ? parseInt(limit, 10) : 50);
    }
    drafts(user) {
        return this.service.listDrafts(user);
    }
    generateDraft(user, dto) {
        return this.service.generateDraft(user, dto);
    }
    publishDraft(user, dto) {
        return this.service.publishDraft(user, dto.draftId);
    }
    listCampaignBuilderDrafts(user) {
        return this.campaignBuilder.listDrafts(user);
    }
    createCampaignBuilderDraft(user, dto) {
        return this.campaignBuilder.createDraft(user, dto);
    }
    getCampaignBuilderDraft(user, id) {
        return this.campaignBuilder.getDraft(user, id);
    }
    previewCampaignBuilderDraft(user, id) {
        return this.campaignBuilder.preview(user, id);
    }
    preflightCampaignBuilderDraft(user, id) {
        return this.campaignBuilder.preflight(user, id);
    }
    approveCampaignBuilderDraft(user, id, dto) {
        return this.campaignBuilder.approve(user, id, dto.confirm);
    }
    deployCampaignBuilderDraft(user, id) {
        return this.campaignBuilder.deploy(user, id);
    }
    getCampaignBuilderDeployment(user, id) {
        return this.campaignBuilder.getDeployment(user, id);
    }
    retryCampaignBuilderDeployment(user, id) {
        return this.campaignBuilder.retry(user, id);
    }
    getAutopilotConfig(user, q) {
        return this.autopilot.getConfig(user, q.customerId);
    }
    upsertAutopilotConfig(user, dto) {
        return this.autopilot.upsertConfig(user, dto);
    }
    listAutopilotProposals(user, customerId, status) {
        return this.autopilot.listProposals(user, customerId, status);
    }
    listAutopilotActions(user, customerId) {
        return this.autopilot.listActions(user, customerId);
    }
    approveAutopilotProposal(user, id, dto) {
        return this.autopilot.approveProposal(user, id, dto);
    }
    rejectAutopilotProposal(user, id, dto) {
        return this.autopilot.rejectProposal(user, id, dto);
    }
    triggerAutopilotScan(user, customerId) {
        return this.autopilot.triggerScan(user, customerId);
    }
    analyzeOptimization(user, dto) {
        return this.optimization.analyze(user, dto);
    }
    async explainOptimization(user, dto) {
        const result = await this.optimization.analyze(user, dto);
        const explanation = await this.optimization.explain(user, result);
        return { ...result, ai: explanation };
    }
    emailReports(user) {
        return this.service.getEmailReports(user);
    }
    upsertEmailReport(user, dto) {
        return this.service.upsertEmailReport(user, dto);
    }
    sendReport(user, q) {
        return this.service.sendReport(user, q.dateFrom, q.dateTo);
    }
};
exports.AiAdsManagerController = AiAdsManagerController;
__decorate([
    (0, common_1.Get)('dashboard'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ai_ads_manager_dto_1.CampaignsQueryDto]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "dashboard", null);
__decorate([
    (0, common_1.Get)('connections'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "connections", null);
__decorate([
    (0, common_1.Get)('meta/oauth/start'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.connect'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "metaOAuthStart", null);
__decorate([
    (0, common_1.Get)('google/oauth/start'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.connect'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "googleOAuthStart", null);
__decorate([
    (0, common_1.Get)('google/customers'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.connect'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "googleCustomers", null);
__decorate([
    (0, common_1.Post)('google/customer'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.connect'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ai_ads_manager_dto_1.ConnectGoogleDto]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "selectGoogleCustomer", null);
__decorate([
    (0, common_1.Get)('google/accounts'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "googleAccounts", null);
__decorate([
    (0, common_1.Post)('google/accounts'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.connect'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, google_ads_dto_1.SelectGoogleAccountsDto]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "selectGoogleAccounts", null);
__decorate([
    (0, common_1.Post)('google/sync'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.sync'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ai_ads_manager_dto_1.SyncAdsDto]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "syncGoogle", null);
__decorate([
    (0, common_1.Post)('connections/google'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.connect'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ai_ads_manager_dto_1.ConnectGoogleDto]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "connectGoogle", null);
__decorate([
    (0, common_1.Post)('connections/gmail'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.connect'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ai_ads_manager_dto_1.ConnectGmailDto]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "connectGmail", null);
__decorate([
    (0, common_1.Delete)('connections/:provider'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.connect'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('provider')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "disconnect", null);
__decorate([
    (0, common_1.Post)('sync'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.sync'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ai_ads_manager_dto_1.SyncAdsDto]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "sync", null);
__decorate([
    (0, common_1.Get)('sync-jobs'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "listSyncJobs", null);
__decorate([
    (0, common_1.Get)('sync-jobs/:jobId'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('jobId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "getSyncJob", null);
__decorate([
    (0, common_1.Get)('campaigns'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ai_ads_manager_dto_1.CampaignsQueryDto]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "campaigns", null);
__decorate([
    (0, common_1.Get)('settings'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "settings", null);
__decorate([
    (0, common_1.Patch)('settings/auto-mode'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ai_ads_manager_dto_1.UpdateAutoModeDto]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "updateAutoMode", null);
__decorate([
    (0, common_1.Patch)('settings/emergency-stop'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ai_ads_manager_dto_1.EmergencyStopDto]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "emergencyStop", null);
__decorate([
    (0, common_1.Get)('rules'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "listRules", null);
__decorate([
    (0, common_1.Post)('rules'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ai_ads_manager_dto_1.CreateAutomationRuleDto]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "createRule", null);
__decorate([
    (0, common_1.Patch)('rules/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, ai_ads_manager_dto_1.UpdateAutomationRuleDto]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "updateRule", null);
__decorate([
    (0, common_1.Delete)('rules/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "deleteRule", null);
__decorate([
    (0, common_1.Post)('campaigns/pause'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ai_ads_manager_dto_1.CampaignActionDto]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "pauseCampaign", null);
__decorate([
    (0, common_1.Post)('campaigns/enable'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ai_ads_manager_dto_1.CampaignActionDto]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "enableCampaign", null);
__decorate([
    (0, common_1.Post)('campaigns/optimize'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.analyze'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ai_ads_manager_dto_1.CampaignActionDto]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "optimizeCampaign", null);
__decorate([
    (0, common_1.Get)('logs'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "logs", null);
__decorate([
    (0, common_1.Get)('drafts'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "drafts", null);
__decorate([
    (0, common_1.Post)('drafts/generate'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.analyze'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ai_ads_manager_dto_1.GenerateAdDraftDto]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "generateDraft", null);
__decorate([
    (0, common_1.Post)('drafts/publish'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ai_ads_manager_dto_1.PublishDraftDto]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "publishDraft", null);
__decorate([
    (0, common_1.Get)('google/campaign-builder/drafts'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "listCampaignBuilderDrafts", null);
__decorate([
    (0, common_1.Post)('google/campaign-builder/drafts'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.analyze'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, google_ads_campaign_builder_dto_1.CreateGoogleAdsCampaignDraftDto]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "createCampaignBuilderDraft", null);
__decorate([
    (0, common_1.Get)('google/campaign-builder/drafts/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "getCampaignBuilderDraft", null);
__decorate([
    (0, common_1.Post)('google/campaign-builder/drafts/:id/preview'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "previewCampaignBuilderDraft", null);
__decorate([
    (0, common_1.Post)('google/campaign-builder/drafts/:id/preflight'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.analyze'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "preflightCampaignBuilderDraft", null);
__decorate([
    (0, common_1.Post)('google/campaign-builder/drafts/:id/approve'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, google_ads_campaign_builder_dto_1.ApproveGoogleAdsCampaignDraftDto]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "approveCampaignBuilderDraft", null);
__decorate([
    (0, common_1.Post)('google/campaign-builder/drafts/:id/deploy'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "deployCampaignBuilderDraft", null);
__decorate([
    (0, common_1.Get)('google/campaign-builder/deployments/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "getCampaignBuilderDeployment", null);
__decorate([
    (0, common_1.Post)('google/campaign-builder/deployments/:id/retry'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "retryCampaignBuilderDeployment", null);
__decorate([
    (0, common_1.Get)('google/autopilot/config'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, google_ads_autopilot_dto_1.GoogleAdsAutopilotCustomerQueryDto]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "getAutopilotConfig", null);
__decorate([
    (0, common_1.Post)('google/autopilot/config'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, google_ads_autopilot_dto_1.UpsertGoogleAdsAutopilotConfigDto]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "upsertAutopilotConfig", null);
__decorate([
    (0, common_1.Get)('google/autopilot/proposals'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('customerId')),
    __param(2, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "listAutopilotProposals", null);
__decorate([
    (0, common_1.Get)('google/autopilot/actions'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('customerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "listAutopilotActions", null);
__decorate([
    (0, common_1.Post)('google/autopilot/proposals/:id/approve'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, google_ads_autopilot_dto_1.ApproveAutopilotProposalDto]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "approveAutopilotProposal", null);
__decorate([
    (0, common_1.Post)('google/autopilot/proposals/:id/reject'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, google_ads_autopilot_dto_1.RejectAutopilotProposalDto]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "rejectAutopilotProposal", null);
__decorate([
    (0, common_1.Post)('google/autopilot/scan'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.analyze'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('customerId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "triggerAutopilotScan", null);
__decorate([
    (0, common_1.Post)('google/optimization/analyze'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.analyze'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, google_ads_optimization_dto_1.GoogleAdsOptimizationAnalyzeDto]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "analyzeOptimization", null);
__decorate([
    (0, common_1.Post)('google/optimization/explain'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.analyze'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, google_ads_optimization_dto_1.GoogleAdsOptimizationAnalyzeDto]),
    __metadata("design:returntype", Promise)
], AiAdsManagerController.prototype, "explainOptimization", null);
__decorate([
    (0, common_1.Get)('email-reports'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "emailReports", null);
__decorate([
    (0, common_1.Post)('email-reports'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ai_ads_manager_dto_1.UpsertEmailReportDto]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "upsertEmailReport", null);
__decorate([
    (0, common_1.Post)('email-reports/send'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.analyze'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ai_ads_manager_dto_1.CampaignsQueryDto]),
    __metadata("design:returntype", void 0)
], AiAdsManagerController.prototype, "sendReport", null);
exports.AiAdsManagerController = AiAdsManagerController = __decorate([
    (0, common_1.Controller)('ai-ads-manager'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [ai_ads_manager_service_1.AiAdsManagerService,
        google_ads_campaign_builder_service_1.GoogleAdsCampaignBuilderService,
        google_ads_autopilot_service_1.GoogleAdsAutopilotService,
        google_ads_optimization_service_1.GoogleAdsOptimizationService])
], AiAdsManagerController);
