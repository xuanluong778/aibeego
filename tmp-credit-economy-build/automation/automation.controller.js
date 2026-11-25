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
exports.AutomationController = void 0;
const common_1 = require("@nestjs/common");
const automation_service_1 = require("./automation.service");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permissions_guard_1 = require("../common/guards/permissions.guard");
const require_permissions_decorator_1 = require("../common/decorators/require-permissions.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const automation_dto_1 = require("./dto/automation.dto");
let AutomationController = class AutomationController {
    service;
    constructor(service) {
        this.service = service;
    }
    canApprove(user) {
        return (user.role === 'OWNER' ||
            (user.permissions ?? []).includes('automation.campaign.approve'));
    }
    listVariables() {
        return this.service.getVariableCatalog();
    }
    listTemplates(user, query) {
        return this.service.listTemplates(user.organizationId, query);
    }
    createTemplate(user, dto) {
        return this.service.createTemplate(user.organizationId, dto, user.id);
    }
    updateTemplate(user, id, dto) {
        return this.service.updateTemplate(user.organizationId, id, dto, user.id);
    }
    previewTemplate(user, id, dto) {
        return this.service.previewTemplate(user.organizationId, id, dto);
    }
    deleteTemplate(user, id) {
        return this.service.deleteTemplate(user.organizationId, id, user.id);
    }
    listFunnels(user) {
        return this.service.listFunnels(user.organizationId);
    }
    listFlows(user) {
        return this.service.listFlows(user.organizationId);
    }
    createFlow(user, dto) {
        return this.service.createFlow(user.organizationId, dto, user.id, this.canApprove(user));
    }
    updateFlow(user, id, dto) {
        return this.service.updateFlow(user.organizationId, id, dto, user.id, this.canApprove(user));
    }
    approveFlow(user, id) {
        return this.service.approveFlow(user.organizationId, id, user.id);
    }
    deleteFlow(user, id) {
        return this.service.deleteFlow(user.organizationId, id, user.id);
    }
    pauseFlow(user, id, body) {
        return this.service.pauseFlow(user.organizationId, id, body.isPaused ?? true, user.id);
    }
    simulate(user, id, dto) {
        return this.service.simulate(user.organizationId, id, dto, user.id);
    }
    listLogs(user, query) {
        return this.service.listLogs(user.organizationId, query);
    }
};
exports.AutomationController = AutomationController;
__decorate([
    (0, common_1.Get)('variables'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AutomationController.prototype, "listVariables", null);
__decorate([
    (0, common_1.Get)('templates'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, automation_dto_1.TemplateQueryDto]),
    __metadata("design:returntype", void 0)
], AutomationController.prototype, "listTemplates", null);
__decorate([
    (0, common_1.Post)('templates'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.template.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, automation_dto_1.CreateMessageTemplateDto]),
    __metadata("design:returntype", void 0)
], AutomationController.prototype, "createTemplate", null);
__decorate([
    (0, common_1.Patch)('templates/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.template.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, automation_dto_1.UpdateMessageTemplateDto]),
    __metadata("design:returntype", void 0)
], AutomationController.prototype, "updateTemplate", null);
__decorate([
    (0, common_1.Post)('templates/:id/preview'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, automation_dto_1.PreviewMessageTemplateDto]),
    __metadata("design:returntype", void 0)
], AutomationController.prototype, "previewTemplate", null);
__decorate([
    (0, common_1.Delete)('templates/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.template.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AutomationController.prototype, "deleteTemplate", null);
__decorate([
    (0, common_1.Get)('funnels'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AutomationController.prototype, "listFunnels", null);
__decorate([
    (0, common_1.Get)('flows'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AutomationController.prototype, "listFlows", null);
__decorate([
    (0, common_1.Post)('flows'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, automation_dto_1.CreateAutomationFlowDto]),
    __metadata("design:returntype", void 0)
], AutomationController.prototype, "createFlow", null);
__decorate([
    (0, common_1.Patch)('flows/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, automation_dto_1.UpdateAutomationFlowDto]),
    __metadata("design:returntype", void 0)
], AutomationController.prototype, "updateFlow", null);
__decorate([
    (0, common_1.Post)('flows/:id/approve'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.approve'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AutomationController.prototype, "approveFlow", null);
__decorate([
    (0, common_1.Delete)('flows/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.create'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AutomationController.prototype, "deleteFlow", null);
__decorate([
    (0, common_1.Patch)('flows/:id/pause'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.pause'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], AutomationController.prototype, "pauseFlow", null);
__decorate([
    (0, common_1.Post)('flows/:id/simulate'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.send'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, automation_dto_1.SimulateAutomationDto]),
    __metadata("design:returntype", void 0)
], AutomationController.prototype, "simulate", null);
__decorate([
    (0, common_1.Get)('logs'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.logs.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, automation_dto_1.LogQueryDto]),
    __metadata("design:returntype", void 0)
], AutomationController.prototype, "listLogs", null);
exports.AutomationController = AutomationController = __decorate([
    (0, common_1.Controller)('automation'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [automation_service_1.AutomationService])
], AutomationController);
