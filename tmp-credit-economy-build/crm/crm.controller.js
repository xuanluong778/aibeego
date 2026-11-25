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
exports.CrmController = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permissions_guard_1 = require("../common/guards/permissions.guard");
const require_permissions_decorator_1 = require("../common/decorators/require-permissions.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const pipeline_service_1 = require("./pipeline.service");
const lead_assignment_service_1 = require("./lead-assignment.service");
const customer_360_service_1 = require("./customer-360.service");
const customer_journey_service_1 = require("./customer-journey.service");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
class UpsertStageDto {
    id;
    pipelineId;
    name;
    code;
    category;
    position;
    color;
    probability;
    slaMinutes;
    isWon;
    isLost;
    /** @deprecated use isLost */
    isLostStage;
    isActive;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertStageDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertStageDto.prototype, "pipelineId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertStageDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertStageDto.prototype, "code", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.FunnelStageCategory),
    __metadata("design:type", String)
], UpsertStageDto.prototype, "category", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpsertStageDto.prototype, "position", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertStageDto.prototype, "color", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], UpsertStageDto.prototype, "probability", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Object)
], UpsertStageDto.prototype, "slaMinutes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertStageDto.prototype, "isWon", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertStageDto.prototype, "isLost", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertStageDto.prototype, "isLostStage", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertStageDto.prototype, "isActive", void 0);
class UpsertAssignmentRuleDto {
    id;
    name;
    branchId;
    leadSourceId;
    adCampaignId;
    minScore;
    maxScore;
    mode;
    employeeIds;
    priority;
    reassignOnSla;
    notifyManager;
    isActive;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertAssignmentRuleDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertAssignmentRuleDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertAssignmentRuleDto.prototype, "branchId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertAssignmentRuleDto.prototype, "leadSourceId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpsertAssignmentRuleDto.prototype, "adCampaignId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], UpsertAssignmentRuleDto.prototype, "minScore", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], UpsertAssignmentRuleDto.prototype, "maxScore", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(database_1.LeadAssignmentMode),
    __metadata("design:type", String)
], UpsertAssignmentRuleDto.prototype, "mode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], UpsertAssignmentRuleDto.prototype, "employeeIds", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], UpsertAssignmentRuleDto.prototype, "priority", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertAssignmentRuleDto.prototype, "reassignOnSla", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertAssignmentRuleDto.prototype, "notifyManager", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertAssignmentRuleDto.prototype, "isActive", void 0);
class MergeCustomersDto {
    primaryId;
    secondaryId;
}
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MergeCustomersDto.prototype, "primaryId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], MergeCustomersDto.prototype, "secondaryId", void 0);
class ClaimLeadDto {
    employeeId;
}
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ClaimLeadDto.prototype, "employeeId", void 0);
let CrmController = class CrmController {
    pipeline;
    assignment;
    customer360;
    customerJourney;
    constructor(pipeline, assignment, customer360, customerJourney) {
        this.pipeline = pipeline;
        this.assignment = assignment;
        this.customer360 = customer360;
        this.customerJourney = customerJourney;
    }
    async getPipeline(user) {
        return this.pipeline.ensureDefaultPipeline(user.organizationId);
    }
    listPipelines(user) {
        return this.pipeline.listPipelines(user.organizationId);
    }
    upsertStage(user, dto) {
        return this.pipeline.upsertStage(user.organizationId, dto);
    }
    deactivateStage(user, id) {
        return this.pipeline.deactivateStage(user.organizationId, id);
    }
    listRules(user) {
        return this.assignment.listRules(user.organizationId);
    }
    upsertRule(user, dto) {
        return this.assignment.upsertRule(user.organizationId, dto);
    }
    deleteRule(user, id) {
        return this.assignment.deleteRule(user.organizationId, id);
    }
    claim(user, id, dto) {
        return this.assignment.claimLead(user.organizationId, id, dto.employeeId);
    }
    customer360View(user, id) {
        return this.customer360.get360(user.organizationId, id);
    }
    duplicates(user, id) {
        return this.customer360.findDuplicates(user.organizationId, id);
    }
    merge(user, dto) {
        return this.customer360.mergeCustomers(user.organizationId, dto.primaryId, dto.secondaryId, user.id);
    }
    leadJourney(user, leadId) {
        return this.customerJourney.getLeadJourney(user.organizationId, leadId);
    }
};
exports.CrmController = CrmController;
__decorate([
    (0, common_1.Get)('pipeline'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CrmController.prototype, "getPipeline", null);
__decorate([
    (0, common_1.Get)('pipelines'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CrmController.prototype, "listPipelines", null);
__decorate([
    (0, common_1.Post)('pipeline/stages'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, UpsertStageDto]),
    __metadata("design:returntype", void 0)
], CrmController.prototype, "upsertStage", null);
__decorate([
    (0, common_1.Patch)('pipeline/stages/:id/deactivate'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CrmController.prototype, "deactivateStage", null);
__decorate([
    (0, common_1.Get)('assignment-rules'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CrmController.prototype, "listRules", null);
__decorate([
    (0, common_1.Post)('assignment-rules'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, UpsertAssignmentRuleDto]),
    __metadata("design:returntype", void 0)
], CrmController.prototype, "upsertRule", null);
__decorate([
    (0, common_1.Delete)('assignment-rules/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CrmController.prototype, "deleteRule", null);
__decorate([
    (0, common_1.Post)('leads/:id/claim'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, ClaimLeadDto]),
    __metadata("design:returntype", void 0)
], CrmController.prototype, "claim", null);
__decorate([
    (0, common_1.Get)('customers/:id/360'),
    (0, require_permissions_decorator_1.RequirePermissions)('customer.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CrmController.prototype, "customer360View", null);
__decorate([
    (0, common_1.Get)('customers/:id/duplicates'),
    (0, require_permissions_decorator_1.RequirePermissions)('customer.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CrmController.prototype, "duplicates", null);
__decorate([
    (0, common_1.Post)('customers/merge'),
    (0, require_permissions_decorator_1.RequirePermissions)('customer.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, MergeCustomersDto]),
    __metadata("design:returntype", void 0)
], CrmController.prototype, "merge", null);
__decorate([
    (0, common_1.Get)('leads/:leadId/journey'),
    (0, require_permissions_decorator_1.RequirePermissions)('lead.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('leadId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CrmController.prototype, "leadJourney", null);
exports.CrmController = CrmController = __decorate([
    (0, common_1.Controller)('crm'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [pipeline_service_1.PipelineService,
        lead_assignment_service_1.LeadAssignmentService,
        customer_360_service_1.Customer360Service,
        customer_journey_service_1.CustomerJourneyService])
], CrmController);
