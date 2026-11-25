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
exports.HrmShiftPoliciesController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permissions_guard_1 = require("../common/guards/permissions.guard");
const require_permissions_decorator_1 = require("../common/decorators/require-permissions.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const client_ip_decorator_1 = require("../common/decorators/client-ip.decorator");
const hrm_shift_policies_service_1 = require("./hrm-shift-policies.service");
const shift_dto_1 = require("./dto/shift.dto");
let HrmShiftPoliciesController = class HrmShiftPoliciesController {
    policies;
    constructor(policies) {
        this.policies = policies;
    }
    findAll(user, branchId, includeInactive) {
        return this.policies.findAll(user.organizationId, {
            branchId,
            includeInactive: includeInactive === 'true' || includeInactive === '1',
        });
    }
    create(user, dto, ipAddress) {
        return this.policies.create(user.organizationId, dto, {
            userId: user.id,
            ipAddress,
            role: user.role,
            employeeId: user.employeeId,
        });
    }
    findOne(user, id) {
        return this.policies.findOne(user.organizationId, id);
    }
    update(user, id, dto, ipAddress) {
        return this.policies.update(user.organizationId, id, dto, {
            userId: user.id,
            ipAddress,
            role: user.role,
            employeeId: user.employeeId,
        });
    }
    deactivate(user, id, ipAddress) {
        return this.policies.setActive(user.organizationId, id, false, {
            userId: user.id,
            ipAddress,
            role: user.role,
            employeeId: user.employeeId,
        });
    }
    activate(user, id, ipAddress) {
        return this.policies.setActive(user.organizationId, id, true, {
            userId: user.id,
            ipAddress,
            role: user.role,
            employeeId: user.employeeId,
        });
    }
    remove(user, id, ipAddress) {
        return this.policies.remove(user.organizationId, id, {
            userId: user.id,
            ipAddress,
            role: user.role,
            employeeId: user.employeeId,
        });
    }
};
exports.HrmShiftPoliciesController = HrmShiftPoliciesController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.attendance.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('branchId')),
    __param(2, (0, common_1.Query)('includeInactive')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], HrmShiftPoliciesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.attendance.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, shift_dto_1.CreateWorkShiftPolicyDto, String]),
    __metadata("design:returntype", void 0)
], HrmShiftPoliciesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.attendance.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], HrmShiftPoliciesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.attendance.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, shift_dto_1.UpdateWorkShiftPolicyDto, String]),
    __metadata("design:returntype", void 0)
], HrmShiftPoliciesController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/deactivate'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.attendance.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], HrmShiftPoliciesController.prototype, "deactivate", null);
__decorate([
    (0, common_1.Post)(':id/activate'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.attendance.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], HrmShiftPoliciesController.prototype, "activate", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.attendance.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], HrmShiftPoliciesController.prototype, "remove", null);
exports.HrmShiftPoliciesController = HrmShiftPoliciesController = __decorate([
    (0, common_1.Controller)('hrm/shift-policies'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [hrm_shift_policies_service_1.HrmShiftPoliciesService])
], HrmShiftPoliciesController);
