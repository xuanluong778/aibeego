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
exports.HrmShiftAssignmentsController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permissions_guard_1 = require("../common/guards/permissions.guard");
const require_permissions_decorator_1 = require("../common/decorators/require-permissions.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const client_ip_decorator_1 = require("../common/decorators/client-ip.decorator");
const hrm_shift_assignments_service_1 = require("./hrm-shift-assignments.service");
const shift_dto_1 = require("./dto/shift.dto");
let HrmShiftAssignmentsController = class HrmShiftAssignmentsController {
    assignments;
    constructor(assignments) {
        this.assignments = assignments;
    }
    calendar(user, query) {
        return this.assignments.calendar(user.organizationId, query, user);
    }
    findAll(user, query) {
        return this.assignments.findAll(user.organizationId, query, user);
    }
    create(user, dto, ipAddress) {
        return this.assignments.create(user.organizationId, dto, {
            userId: user.id,
            ipAddress,
            role: user.role,
            employeeId: user.employeeId,
        });
    }
    bulk(user, dto, ipAddress) {
        return this.assignments.bulkAssign(user.organizationId, dto, {
            userId: user.id,
            ipAddress,
            role: user.role,
            employeeId: user.employeeId,
        });
    }
    update(user, id, dto, ipAddress) {
        return this.assignments.update(user.organizationId, id, dto, {
            userId: user.id,
            ipAddress,
            role: user.role,
            employeeId: user.employeeId,
        });
    }
    remove(user, id, ipAddress) {
        return this.assignments.remove(user.organizationId, id, {
            userId: user.id,
            ipAddress,
            role: user.role,
            employeeId: user.employeeId,
        });
    }
};
exports.HrmShiftAssignmentsController = HrmShiftAssignmentsController;
__decorate([
    (0, common_1.Get)('calendar'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.attendance.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, shift_dto_1.ShiftCalendarQueryDto]),
    __metadata("design:returntype", void 0)
], HrmShiftAssignmentsController.prototype, "calendar", null);
__decorate([
    (0, common_1.Get)(),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.attendance.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, shift_dto_1.ShiftAssignmentQueryDto]),
    __metadata("design:returntype", void 0)
], HrmShiftAssignmentsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.attendance.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, shift_dto_1.CreateShiftAssignmentDto, String]),
    __metadata("design:returntype", void 0)
], HrmShiftAssignmentsController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('bulk'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.attendance.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, shift_dto_1.BulkShiftAssignmentDto, String]),
    __metadata("design:returntype", void 0)
], HrmShiftAssignmentsController.prototype, "bulk", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.attendance.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, shift_dto_1.UpdateShiftAssignmentDto, String]),
    __metadata("design:returntype", void 0)
], HrmShiftAssignmentsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.attendance.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], HrmShiftAssignmentsController.prototype, "remove", null);
exports.HrmShiftAssignmentsController = HrmShiftAssignmentsController = __decorate([
    (0, common_1.Controller)('hrm/shift-assignments'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [hrm_shift_assignments_service_1.HrmShiftAssignmentsService])
], HrmShiftAssignmentsController);
