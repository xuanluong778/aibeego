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
exports.FunnelBuilderController = void 0;
const common_1 = require("@nestjs/common");
const funnel_builder_service_1 = require("./funnel-builder.service");
const funnel_template_service_1 = require("./funnel-template.service");
const funnel_generator_service_1 = require("./funnel-generator.service");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permissions_guard_1 = require("../common/guards/permissions.guard");
const require_permissions_decorator_1 = require("../common/decorators/require-permissions.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const funnel_builder_dto_1 = require("./dto/funnel-builder.dto");
const funnel_template_dto_1 = require("./dto/funnel-template.dto");
const funnel_generator_dto_1 = require("./dto/funnel-generator.dto");
const funnel_capture_dto_1 = require("./dto/funnel-capture.dto");
const funnel_lead_capture_service_1 = require("./funnel-lead-capture.service");
const lead_scoring_service_1 = require("../crm/lead-scoring.service");
const customer_journey_service_1 = require("../crm/customer-journey.service");
const funnel_validator_service_1 = require("./funnel-validator.service");
const funnel_consultant_service_1 = require("./funnel-consultant.service");
const funnel_lifecycle_service_1 = require("./funnel-lifecycle.service");
const funnel_inline_edit_service_1 = require("./funnel-inline-edit.service");
const funnel_canvas_runtime_service_1 = require("../crm/funnel-canvas-runtime.service");
const funnel_scoring_dto_1 = require("./dto/funnel-scoring.dto");
const customer_journey_dto_1 = require("./dto/customer-journey.dto");
const funnel_consultant_dto_1 = require("./dto/funnel-consultant.dto");
const funnel_lifecycle_dto_1 = require("./dto/funnel-lifecycle.dto");
const funnel_inline_edit_dto_1 = require("./dto/funnel-inline-edit.dto");
let FunnelBuilderController = class FunnelBuilderController {
    service;
    templates;
    generator;
    capture;
    scoring;
    journey;
    validator;
    consultant;
    lifecycle;
    inlineEdit;
    canvasRuntime;
    constructor(service, templates, generator, capture, scoring, journey, validator, consultant, lifecycle, inlineEdit, canvasRuntime) {
        this.service = service;
        this.templates = templates;
        this.generator = generator;
        this.capture = capture;
        this.scoring = scoring;
        this.journey = journey;
        this.validator = validator;
        this.consultant = consultant;
        this.lifecycle = lifecycle;
        this.inlineEdit = inlineEdit;
        this.canvasRuntime = canvasRuntime;
    }
    canActivateFlows(user) {
        return (user.role === 'OWNER' ||
            (user.permissions ?? []).includes('automation.campaign.approve'));
    }
    // --- AI Funnel Generator (preview only) ---
    generateRecommendations(user, dto) {
        return this.generator.generate(user, dto);
    }
    listRecommendations(user) {
        return this.generator.list(user.organizationId);
    }
    funnelQuota(user) {
        return this.lifecycle.getQuota(user.organizationId);
    }
    getRecommendation(user, id) {
        return this.generator.get(user.organizationId, id);
    }
    selectRecommendation(user, id, dto) {
        return this.generator.select(user.organizationId, id, dto);
    }
    generateCompleteFunnel(user, id) {
        return this.generator.generateComplete(user, id);
    }
    saveCompleteDraft(user, id, dto) {
        return this.generator.saveCompleteDraft(user, id, dto);
    }
    getPreviewForm(user, id) {
        return this.inlineEdit.getPreviewForm(user, id);
    }
    saveInlineContent(user, id, dto) {
        return this.inlineEdit.saveInlineContent(user, id, dto.patch);
    }
    publishLiveUpdate(user, id, dto) {
        return this.lifecycle.publishLiveUpdate(user, id, dto.summary);
    }
    getFunnelForm(id) {
        return this.capture.getPublicForm(id);
    }
    bindChatbot(user, id, dto) {
        return this.capture.bindChatbot(user, id, dto.botId);
    }
    async validateRecommendation(user, id, explain) {
        const rec = await this.generator.get(user.organizationId, id);
        if (!rec.completeSpec) {
            return {
                ready: false,
                canActivate: false,
                score: 0,
                blocking: ['Chưa có Funnel Complete spec — generate complete trước'],
                message: 'Chưa có complete spec',
            };
        }
        const validation = this.validator.validateCompleteSpec(rec.completeSpec);
        const withExplain = explain === '1' || explain === 'true';
        const explanation = withExplain ? await this.validator.explain(validation) : undefined;
        return { ...validation, explanation };
    }
    async validatePayload(body) {
        const validation = body.completeSpec
            ? this.validator.validateCompleteSpec(body.completeSpec)
            : body.draft
                ? this.validator.validateBlueprintDraft(body.draft)
                : null;
        if (!validation) {
            return { error: 'Cần completeSpec hoặc draft' };
        }
        const explanation = body.explain ? await this.validator.explain(validation) : undefined;
        return { ...validation, explanation };
    }
    proposeConsultant(user, id, dto) {
        return this.consultant.propose(user, id, dto);
    }
    applyConsultant(user, id, dto) {
        return this.consultant.apply(user, id, dto);
    }
    preparePublish(user, id) {
        return this.lifecycle.preparePublish(user, id);
    }
    publishFunnel(user, id, dto) {
        return this.lifecycle.publish(user, id, dto.summary, this.canActivateFlows(user));
    }
    pauseFunnel(user, id) {
        return this.lifecycle.pause(user, id);
    }
    archiveFunnel(user, id) {
        return this.lifecycle.archive(user, id);
    }
    deleteFunnel(user, id) {
        return this.lifecycle.delete(user, id);
    }
    cloneFunnel(user, id) {
        return this.lifecycle.clone(user, id);
    }
    listFunnelVersions(user, id) {
        return this.lifecycle.listVersions(user.organizationId, id);
    }
    diffFunnelVersion(user, id, versionId) {
        return this.lifecycle.diffVersion(user.organizationId, id, versionId);
    }
    restoreFunnelVersion(user, id, versionId) {
        return this.lifecycle.restoreVersion(user, id, versionId);
    }
    runtimeLogs(user, id, leadId) {
        return this.canvasRuntime.listLogs(user.organizationId, id, leadId);
    }
    getScoring(user, id) {
        return this.scoring.getConfig(user.organizationId, id);
    }
    proposeScoring(user, id) {
        return this.scoring.propose(user.organizationId, id);
    }
    applyScoringProposal(user, id) {
        return this.scoring.applyProposed(user.organizationId, id);
    }
    upsertScoring(user, id, dto) {
        return this.scoring.upsertConfig(user.organizationId, id, dto);
    }
    // --- Template Engine ---
    listTemplates(user, query) {
        return this.templates.list(user.organizationId, query);
    }
    syncTemplates() {
        return this.templates.ensureSystemTemplates();
    }
    getTemplate(user, idOrSlug) {
        return this.templates.get(user.organizationId, idOrSlug);
    }
    cloneTemplate(user, idOrSlug, dto) {
        return this.templates.clone(user, idOrSlug, dto);
    }
    updateTemplate(user, id, dto) {
        return this.templates.update(user, id, dto);
    }
    applyTemplate(user, idOrSlug, dto) {
        return this.templates.apply(user, idOrSlug, dto, this.canActivateFlows(user));
    }
    discardTemplate(user, id) {
        return this.templates.discard(user.organizationId, id);
    }
    // --- AI Blueprints ---
    list(user, query) {
        return this.service.listBlueprints(user.organizationId, query);
    }
    get(user, id) {
        return this.service.getBlueprint(user.organizationId, id);
    }
    generate(user, dto) {
        return this.service.generate(user, dto);
    }
    apply(user, dto) {
        return this.service.apply(user, dto, this.canActivateFlows(user));
    }
    funnelJourney(user, id, query) {
        return this.journey.getFunnelJourney(user.organizationId, id, query);
    }
    discard(user, id) {
        return this.service.discard(user.organizationId, id);
    }
};
exports.FunnelBuilderController = FunnelBuilderController;
__decorate([
    (0, common_1.Post)('generate-recommendations'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, funnel_generator_dto_1.GenerateFunnelRecommendationsDto]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "generateRecommendations", null);
__decorate([
    (0, common_1.Get)('recommendations'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "listRecommendations", null);
__decorate([
    (0, common_1.Get)('quota'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "funnelQuota", null);
__decorate([
    (0, common_1.Get)('recommendations/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "getRecommendation", null);
__decorate([
    (0, common_1.Post)('recommendations/:id/select'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, funnel_generator_dto_1.SelectFunnelRecommendationDto]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "selectRecommendation", null);
__decorate([
    (0, common_1.Post)('recommendations/:id/generate-complete'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "generateCompleteFunnel", null);
__decorate([
    (0, common_1.Patch)('recommendations/:id/complete-draft'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, funnel_generator_dto_1.SaveFunnelCompleteDraftDto]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "saveCompleteDraft", null);
__decorate([
    (0, common_1.Get)('recommendations/:id/preview-form'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "getPreviewForm", null);
__decorate([
    (0, common_1.Patch)('recommendations/:id/inline-content'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, funnel_inline_edit_dto_1.FunnelInlineContentPatchDto]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "saveInlineContent", null);
__decorate([
    (0, common_1.Post)('recommendations/:id/publish-live-update'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, funnel_inline_edit_dto_1.FunnelPublishLiveUpdateDto]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "publishLiveUpdate", null);
__decorate([
    (0, common_1.Get)('recommendations/:id/form'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "getFunnelForm", null);
__decorate([
    (0, common_1.Post)('recommendations/:id/bind-chatbot'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, funnel_capture_dto_1.BindFunnelChatbotDto]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "bindChatbot", null);
__decorate([
    (0, common_1.Get)('recommendations/:id/validate'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('explain')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], FunnelBuilderController.prototype, "validateRecommendation", null);
__decorate([
    (0, common_1.Post)('validate'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], FunnelBuilderController.prototype, "validatePayload", null);
__decorate([
    (0, common_1.Post)('recommendations/:id/consultant/propose'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, funnel_consultant_dto_1.FunnelConsultantProposeDto]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "proposeConsultant", null);
__decorate([
    (0, common_1.Post)('recommendations/:id/consultant/apply'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, funnel_consultant_dto_1.FunnelConsultantApplyDto]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "applyConsultant", null);
__decorate([
    (0, common_1.Post)('recommendations/:id/prepare-publish'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "preparePublish", null);
__decorate([
    (0, common_1.Post)('recommendations/:id/publish'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, funnel_lifecycle_dto_1.FunnelPublishDto]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "publishFunnel", null);
__decorate([
    (0, common_1.Post)('recommendations/:id/pause'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "pauseFunnel", null);
__decorate([
    (0, common_1.Post)('recommendations/:id/archive'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "archiveFunnel", null);
__decorate([
    (0, common_1.Delete)('recommendations/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "deleteFunnel", null);
__decorate([
    (0, common_1.Post)('recommendations/:id/clone'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "cloneFunnel", null);
__decorate([
    (0, common_1.Get)('recommendations/:id/versions'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "listFunnelVersions", null);
__decorate([
    (0, common_1.Get)('recommendations/:id/versions/:versionId/diff'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('versionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "diffFunnelVersion", null);
__decorate([
    (0, common_1.Post)('recommendations/:id/versions/:versionId/restore'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('versionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "restoreFunnelVersion", null);
__decorate([
    (0, common_1.Get)('recommendations/:id/runtime'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)('leadId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "runtimeLogs", null);
__decorate([
    (0, common_1.Get)('recommendations/:id/scoring'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "getScoring", null);
__decorate([
    (0, common_1.Post)('recommendations/:id/scoring/propose'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "proposeScoring", null);
__decorate([
    (0, common_1.Post)('recommendations/:id/scoring/apply-proposal'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "applyScoringProposal", null);
__decorate([
    (0, common_1.Patch)('recommendations/:id/scoring'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, funnel_scoring_dto_1.UpsertFunnelScoringDto]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "upsertScoring", null);
__decorate([
    (0, common_1.Get)('templates'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, funnel_template_dto_1.ListFunnelTemplatesQueryDto]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "listTemplates", null);
__decorate([
    (0, common_1.Post)('templates/sync'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "syncTemplates", null);
__decorate([
    (0, common_1.Get)('templates/:idOrSlug'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('idOrSlug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "getTemplate", null);
__decorate([
    (0, common_1.Post)('templates/:idOrSlug/clone'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('idOrSlug')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, funnel_template_dto_1.CloneFunnelTemplateDto]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "cloneTemplate", null);
__decorate([
    (0, common_1.Patch)('templates/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, funnel_template_dto_1.UpdateFunnelTemplateDto]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "updateTemplate", null);
__decorate([
    (0, common_1.Post)('templates/:idOrSlug/apply'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('idOrSlug')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, funnel_template_dto_1.ApplyFunnelTemplateDto]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "applyTemplate", null);
__decorate([
    (0, common_1.Patch)('templates/:id/discard'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "discardTemplate", null);
__decorate([
    (0, common_1.Get)('blueprints'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, funnel_builder_dto_1.ListFunnelBlueprintsQueryDto]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('blueprints/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "get", null);
__decorate([
    (0, common_1.Post)('generate'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, funnel_builder_dto_1.GenerateFunnelBlueprintDto]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "generate", null);
__decorate([
    (0, common_1.Post)('apply'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, funnel_builder_dto_1.ApplyFunnelBlueprintDto]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "apply", null);
__decorate([
    (0, common_1.Get)('recommendations/:id/journey'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, customer_journey_dto_1.FunnelJourneyQueryDto]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "funnelJourney", null);
__decorate([
    (0, common_1.Patch)('blueprints/:id/discard'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FunnelBuilderController.prototype, "discard", null);
exports.FunnelBuilderController = FunnelBuilderController = __decorate([
    (0, common_1.Controller)('funnel-builder'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [funnel_builder_service_1.FunnelBuilderService,
        funnel_template_service_1.FunnelTemplateService,
        funnel_generator_service_1.FunnelGeneratorService,
        funnel_lead_capture_service_1.FunnelLeadCaptureService,
        lead_scoring_service_1.LeadScoringService,
        customer_journey_service_1.CustomerJourneyService,
        funnel_validator_service_1.FunnelValidatorService,
        funnel_consultant_service_1.FunnelConsultantService,
        funnel_lifecycle_service_1.FunnelLifecycleService,
        funnel_inline_edit_service_1.FunnelInlineEditService,
        funnel_canvas_runtime_service_1.FunnelCanvasRuntimeService])
], FunnelBuilderController);
