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
exports.LeadsController = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const leads_service_1 = require("./leads.service");
const funnel_analytics_service_1 = require("./funnel-analytics.service");
const customer_journey_service_1 = require("../crm/customer-journey.service");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permissions_guard_1 = require("../common/guards/permissions.guard");
const require_permissions_decorator_1 = require("../common/decorators/require-permissions.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const lead_dto_1 = require("./dto/lead.dto");
const funnel_dto_1 = require("./dto/funnel.dto");
let LeadsController = class LeadsController {
    service;
    funnelAnalyticsService;
    customerJourney;
    constructor(service, funnelAnalyticsService, customerJourney) {
        this.service = service;
        this.funnelAnalyticsService = funnelAnalyticsService;
        this.customerJourney = customerJourney;
    }
    findAll(user, query) {
        return this.service.findAll(user.organizationId, query);
    }
    kanban(user, query) {
        return this.service.getKanban(user.organizationId, query);
    }
    kanbanColumn(user, status, query) {
        return this.service.getKanbanColumn(user.organizationId, status, query);
    }
    staleAlerts(user, query) {
        return this.service.findStaleLeads(user.organizationId, query.minutes ?? 10);
    }
    funnelStats(user, query) {
        return this.service.getFunnelStats(user.organizationId, query);
    }
    pipelineCounts(user) {
        return this.service.countByPipeline(user.organizationId);
    }
    funnelAnalytics(user, query) {
        return this.funnelAnalyticsService.getAnalytics(user.organizationId, query);
    }
    leadJourney(user, id) {
        return this.customerJourney.getLeadJourney(user.organizationId, id);
    }
    listSavedViews(user) {
        return this.service.listSavedViews(user.organizationId, user.id);
    }
    createSavedView(user, dto) {
        return this.service.createSavedView(user.organizationId, user.id, dto);
    }
    updateSavedView(user, id, dto) {
        return this.service.updateSavedView(user.organizationId, user.id, id, dto);
    }
    deleteSavedView(user, id) {
        return this.service.deleteSavedView(user.organizationId, user.id, id);
    }
    bulk(user, dto) {
        return this.service.bulkAction(user.organizationId, dto, user.id);
    }
    findOne(user, id) {
        return this.service.findOne(user.organizationId, id);
    }
    create(user, dto) {
        return this.service.create(user.organizationId, dto, user.id);
    }
    update(user, id, dto) {
        return this.service.update(user.organizationId, id, dto);
    }
    updateStatus(user, id, dto) {
        return this.service.updateStatus(user.organizationId, id, dto, user.id);
    }
    assign(user, id, dto) {
        return this.service.assign(user.organizationId, id, dto, user.id);
    }
    convertCustomer(user, id) {
        return this.service.convertToCustomer(user.organizationId, id, user.id);
    }
    activity(user, id) {
        return this.service.listActivity(user.organizationId, id);
    }
    addNote(user, id, body) {
        return this.service.addNote(user.organizationId, id, body.content, user.id);
    }
    remove(user, id) {
        return this.service.remove(user.organizationId, id);
    }
};
exports.LeadsController = LeadsController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, lead_dto_1.LeadQueryDto]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('kanban'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, lead_dto_1.LeadKanbanQueryDto]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "kanban", null);
__decorate([
    (0, common_1.Get)('kanban/:status'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('status')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, lead_dto_1.LeadKanbanColumnQueryDto]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "kanbanColumn", null);
__decorate([
    (0, common_1.Get)('alerts/stale'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, lead_dto_1.StaleLeadQueryDto]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "staleAlerts", null);
__decorate([
    (0, common_1.Get)('funnel/stats'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, funnel_dto_1.FunnelQueryDto]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "funnelStats", null);
__decorate([
    (0, common_1.Get)('pipeline-counts'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "pipelineCounts", null);
__decorate([
    (0, common_1.Get)('funnel/analytics'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, funnel_dto_1.FunnelAnalyticsQueryDto]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "funnelAnalytics", null);
__decorate([
    (0, common_1.Get)(':id/journey'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "leadJourney", null);
__decorate([
    (0, common_1.Get)('saved-views'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "listSavedViews", null);
__decorate([
    (0, common_1.Post)('saved-views'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, lead_dto_1.CreateLeadSavedViewDto]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "createSavedView", null);
__decorate([
    (0, common_1.Patch)('saved-views/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, lead_dto_1.UpdateLeadSavedViewDto]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "updateSavedView", null);
__decorate([
    (0, common_1.Delete)('saved-views/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "deleteSavedView", null);
__decorate([
    (0, common_1.Post)('bulk'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, lead_dto_1.BulkLeadActionDto]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "bulk", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, lead_dto_1.CreateLeadDto]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, lead_dto_1.UpdateLeadDto]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, lead_dto_1.UpdateLeadStatusDto]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Patch)(':id/assign'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, lead_dto_1.AssignLeadDto]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "assign", null);
__decorate([
    (0, common_1.Post)(':id/convert-customer'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "convertCustomer", null);
__decorate([
    (0, common_1.Get)(':id/activity'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "activity", null);
__decorate([
    (0, common_1.Post)(':id/notes'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "addNote", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], LeadsController.prototype, "remove", null);
exports.LeadsController = LeadsController = __decorate([
    (0, common_1.Controller)('leads'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [leads_service_1.LeadsService,
        funnel_analytics_service_1.FunnelAnalyticsService,
        customer_journey_service_1.CustomerJourneyService])
], LeadsController);
