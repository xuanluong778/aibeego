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
exports.MarketingAutopilotController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const marketing_autopilot_service_1 = require("./marketing-autopilot.service");
const marketing_context_engine_service_1 = require("./context/marketing-context-engine.service");
const marketing_autopilot_autofill_service_1 = require("./marketing-autopilot-autofill.service");
const marketing_autopilot_outcome_learning_service_1 = require("./outcome/marketing-autopilot-outcome-learning.service");
const marketing_autopilot_outcome_loop_service_1 = require("./outcome/marketing-autopilot-outcome-loop.service");
const marketing_mission_orchestrator_service_1 = require("./orchestrator/marketing-mission-orchestrator.service");
const marketing_autopilot_dto_1 = require("./dto/marketing-autopilot.dto");
let MarketingAutopilotController = class MarketingAutopilotController {
    service;
    contextEngine;
    autofillService;
    outcomeLearning;
    outcomeLoop;
    missionOrchestrator;
    constructor(service, contextEngine, autofillService, outcomeLearning, outcomeLoop, missionOrchestrator) {
        this.service = service;
        this.contextEngine = contextEngine;
        this.autofillService = autofillService;
        this.outcomeLearning = outcomeLearning;
        this.outcomeLoop = outcomeLoop;
        this.missionOrchestrator = missionOrchestrator;
    }
    getContext(user) {
        return this.contextEngine.getContext(user.organizationId, { user });
    }
    refreshContext(user) {
        return this.contextEngine.refreshContext(user.organizationId, user);
    }
    status(user) {
        return this.service.getStatus(user.organizationId);
    }
    getFormOptions(user) {
        return this.autofillService.getFormOptions(user.organizationId);
    }
    autofill(user, body) {
        return this.autofillService.autofill(user, body);
    }
    getProjectFilterOptions(user) {
        return this.service.getProjectFilterOptions(user.organizationId);
    }
    findAll(user, query) {
        return this.service.findAll(user.organizationId, query);
    }
    findOne(user, id) {
        return this.service.findOne(user.organizationId, id);
    }
    create(user, dto) {
        return this.service.create(user, dto);
    }
    updateProject(user, id, dto) {
        return this.service.updateProject(user, id, dto);
    }
    archiveProject(user, id) {
        return this.service.archiveProject(user, id);
    }
    getPlan(user, id) {
        return this.service.getPlan(user.organizationId, id);
    }
    regenerateContentIdeas(user, id, body) {
        return this.service.regenerateProjectContentDraft(user, id, body.ideaIndex);
    }
    saveContentIdeaToStudio(user, id, ideaIndex) {
        return this.service.saveContentIdeaToStudio(user, id, Number(ideaIndex));
    }
    getContentIdeas(user, id) {
        return this.service.getProjectContentIdeas(user, id);
    }
    confirmDraft(user, id, body, headerIdempotencyKey) {
        const idempotencyKey = headerIdempotencyKey?.trim() || body.idempotencyKey?.trim();
        return this.service.confirmDraft(user, id, idempotencyKey, body.draftTypes);
    }
    /** Additive: latest AI Orchestrator mission for a project. */
    getProjectMission(user, id) {
        return this.missionOrchestrator.getLatestMissionForProject(user.organizationId, id);
    }
    getMission(user, missionId) {
        return this.missionOrchestrator.getMission(user.organizationId, missionId);
    }
    resumeMission(user, missionId) {
        return this.missionOrchestrator.resumeMission(user, missionId);
    }
    /** Approval-first: Duyệt & chạy — immutable snapshot, no per-draft approve. */
    approveMission(user, missionId) {
        return this.missionOrchestrator.approveAndRun(user, missionId);
    }
    getBusinessLearnings(user) {
        return this.outcomeLearning.getLearningsForUser(user);
    }
    listOutcomeTracks(user, projectId) {
        return this.outcomeLearning.listTracksForOrg(user.organizationId, projectId);
    }
    evaluateDueOutcomes(user) {
        return this.outcomeLearning.evaluateDue(user.organizationId);
    }
    /** Outcome loop state for mission (additive — UI can poll later). */
    getMissionOutcomeLoop(user, missionId) {
        return this.outcomeLoop.getLoopPublic(user.organizationId, missionId);
    }
    listOptimizationProposals(user, missionId) {
        return this.outcomeLoop.listProposals(user.organizationId, missionId);
    }
    /** APPROVAL_AUTOPILOT: user duyệt đề xuất tối ưu trước khi apply. */
    approveOptimizationProposal(user, proposalId) {
        return this.outcomeLoop.approveProposal(user, proposalId);
    }
};
exports.MarketingAutopilotController = MarketingAutopilotController;
__decorate([
    (0, common_1.Get)('context'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MarketingAutopilotController.prototype, "getContext", null);
__decorate([
    (0, common_1.Post)('context/refresh'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MarketingAutopilotController.prototype, "refreshContext", null);
__decorate([
    (0, common_1.Get)('status'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MarketingAutopilotController.prototype, "status", null);
__decorate([
    (0, common_1.Get)('form-options'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MarketingAutopilotController.prototype, "getFormOptions", null);
__decorate([
    (0, common_1.Post)('autofill'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, marketing_autopilot_dto_1.AutofillMarketingAutopilotDto]),
    __metadata("design:returntype", void 0)
], MarketingAutopilotController.prototype, "autofill", null);
__decorate([
    (0, common_1.Get)('projects/filter-options'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MarketingAutopilotController.prototype, "getProjectFilterOptions", null);
__decorate([
    (0, common_1.Get)('projects'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, marketing_autopilot_dto_1.MarketingAutopilotProjectQueryDto]),
    __metadata("design:returntype", void 0)
], MarketingAutopilotController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('projects/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MarketingAutopilotController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)('projects'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, marketing_autopilot_dto_1.CreateMarketingAutopilotProjectDto]),
    __metadata("design:returntype", void 0)
], MarketingAutopilotController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)('projects/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, marketing_autopilot_dto_1.UpdateMarketingAutopilotProjectDto]),
    __metadata("design:returntype", void 0)
], MarketingAutopilotController.prototype, "updateProject", null);
__decorate([
    (0, common_1.Delete)('projects/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MarketingAutopilotController.prototype, "archiveProject", null);
__decorate([
    (0, common_1.Get)('projects/:id/plan'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MarketingAutopilotController.prototype, "getPlan", null);
__decorate([
    (0, common_1.Post)('projects/:id/content-ideas/regenerate'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, marketing_autopilot_dto_1.MarketingAutopilotRegenerateContentDto]),
    __metadata("design:returntype", void 0)
], MarketingAutopilotController.prototype, "regenerateContentIdeas", null);
__decorate([
    (0, common_1.Post)('projects/:id/content-ideas/:ideaIndex/save-studio'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Param)('ideaIndex')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], MarketingAutopilotController.prototype, "saveContentIdeaToStudio", null);
__decorate([
    (0, common_1.Get)('projects/:id/content-ideas'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MarketingAutopilotController.prototype, "getContentIdeas", null);
__decorate([
    (0, common_1.Post)('projects/:id/confirm'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Headers)('idempotency-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, marketing_autopilot_dto_1.MarketingAutopilotConfirmDraftDto, String]),
    __metadata("design:returntype", void 0)
], MarketingAutopilotController.prototype, "confirmDraft", null);
__decorate([
    (0, common_1.Get)('projects/:id/mission'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MarketingAutopilotController.prototype, "getProjectMission", null);
__decorate([
    (0, common_1.Get)('missions/:missionId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('missionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MarketingAutopilotController.prototype, "getMission", null);
__decorate([
    (0, common_1.Post)('missions/:missionId/resume'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('missionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MarketingAutopilotController.prototype, "resumeMission", null);
__decorate([
    (0, common_1.Post)('missions/:missionId/approve'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('missionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MarketingAutopilotController.prototype, "approveMission", null);
__decorate([
    (0, common_1.Get)('business-learnings'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MarketingAutopilotController.prototype, "getBusinessLearnings", null);
__decorate([
    (0, common_1.Get)('outcome-tracks'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MarketingAutopilotController.prototype, "listOutcomeTracks", null);
__decorate([
    (0, common_1.Post)('outcome-tracks/evaluate-due'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], MarketingAutopilotController.prototype, "evaluateDueOutcomes", null);
__decorate([
    (0, common_1.Get)('missions/:missionId/outcome-loop'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('missionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MarketingAutopilotController.prototype, "getMissionOutcomeLoop", null);
__decorate([
    (0, common_1.Get)('missions/:missionId/optimization-proposals'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('missionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MarketingAutopilotController.prototype, "listOptimizationProposals", null);
__decorate([
    (0, common_1.Post)('optimization-proposals/:proposalId/approve'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('proposalId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MarketingAutopilotController.prototype, "approveOptimizationProposal", null);
exports.MarketingAutopilotController = MarketingAutopilotController = __decorate([
    (0, common_1.Controller)('marketing-autopilot'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __metadata("design:paramtypes", [marketing_autopilot_service_1.MarketingAutopilotService,
        marketing_context_engine_service_1.MarketingContextEngineService,
        marketing_autopilot_autofill_service_1.MarketingAutopilotAutofillService,
        marketing_autopilot_outcome_learning_service_1.MarketingAutopilotOutcomeLearningService,
        marketing_autopilot_outcome_loop_service_1.MarketingAutopilotOutcomeLoopService,
        marketing_mission_orchestrator_service_1.MarketingMissionOrchestratorService])
], MarketingAutopilotController);
