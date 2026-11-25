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
exports.HrmOvertimeController = exports.HrmLeaveController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permissions_guard_1 = require("../common/guards/permissions.guard");
const require_permissions_decorator_1 = require("../common/decorators/require-permissions.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const client_ip_decorator_1 = require("../common/decorators/client-ip.decorator");
const upload_policy_1 = require("../common/uploads/upload-policy");
const hrm_leave_service_1 = require("./hrm-leave.service");
const leave_dto_1 = require("./dto/leave.dto");
let HrmLeaveController = class HrmLeaveController {
    leave;
    constructor(leave) {
        this.leave = leave;
    }
    list(user, query) {
        return this.leave.listLeave(user.organizationId, query, user);
    }
    balance(user, query) {
        return this.leave.getBalance(user.organizationId, query, user);
    }
    create(user, dto, file, ipAddress) {
        return this.leave.createLeave(user.organizationId, dto, file, {
            userId: user.id,
            ipAddress,
            role: user.role,
            employeeId: user.employeeId,
        });
    }
    async attachment(user, id, res) {
        const { file, mime, filename } = await this.leave.getLeaveAttachment(user.organizationId, id, user);
        res.setHeader('Content-Type', mime);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
        return file;
    }
    approve(user, id, dto, ipAddress) {
        return this.leave.approveLeave(user.organizationId, id, dto, user.id, {
            userId: user.id,
            ipAddress,
            role: user.role,
            employeeId: user.employeeId,
        });
    }
    reject(user, id, dto, ipAddress) {
        return this.leave.rejectLeave(user.organizationId, id, dto, user.id, {
            userId: user.id,
            ipAddress,
            role: user.role,
            employeeId: user.employeeId,
        });
    }
    cancel(user, id, dto, ipAddress) {
        return this.leave.cancelLeave(user.organizationId, id, dto, {
            userId: user.id,
            ipAddress,
            role: user.role,
            employeeId: user.employeeId,
        });
    }
};
exports.HrmLeaveController = HrmLeaveController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.leave.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, leave_dto_1.LeaveRequestQueryDto]),
    __metadata("design:returntype", void 0)
], HrmLeaveController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('balance'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.leave.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, leave_dto_1.LeaveBalanceQueryDto]),
    __metadata("design:returntype", void 0)
], HrmLeaveController.prototype, "balance", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.leave.write'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', (0, upload_policy_1.createUploadMulterOptions)('document'))),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.UploadedFile)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, leave_dto_1.CreateLeaveRequestDto, Object, String]),
    __metadata("design:returntype", void 0)
], HrmLeaveController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id/attachment'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.leave.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], HrmLeaveController.prototype, "attachment", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.leave.approve'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, leave_dto_1.LeaveDecisionDto, String]),
    __metadata("design:returntype", void 0)
], HrmLeaveController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/reject'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.leave.approve'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, leave_dto_1.LeaveRejectDto, String]),
    __metadata("design:returntype", void 0)
], HrmLeaveController.prototype, "reject", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.leave.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, leave_dto_1.LeaveCancelDto, String]),
    __metadata("design:returntype", void 0)
], HrmLeaveController.prototype, "cancel", null);
exports.HrmLeaveController = HrmLeaveController = __decorate([
    (0, common_1.Controller)('hrm/leave-requests'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [hrm_leave_service_1.HrmLeaveService])
], HrmLeaveController);
let HrmOvertimeController = class HrmOvertimeController {
    leave;
    constructor(leave) {
        this.leave = leave;
    }
    list(user, query) {
        return this.leave.listOvertime(user.organizationId, query, user);
    }
    create(user, dto, ipAddress) {
        return this.leave.createOvertime(user.organizationId, dto, {
            userId: user.id,
            ipAddress,
            role: user.role,
            employeeId: user.employeeId,
        });
    }
    approve(user, id, dto, ipAddress) {
        return this.leave.approveOvertime(user.organizationId, id, dto, user.id, {
            userId: user.id,
            ipAddress,
            role: user.role,
            employeeId: user.employeeId,
        });
    }
    reject(user, id, dto, ipAddress) {
        return this.leave.rejectOvertime(user.organizationId, id, dto, user.id, {
            userId: user.id,
            ipAddress,
            role: user.role,
            employeeId: user.employeeId,
        });
    }
    cancel(user, id, dto, ipAddress) {
        return this.leave.cancelOvertime(user.organizationId, id, dto, {
            userId: user.id,
            ipAddress,
            role: user.role,
            employeeId: user.employeeId,
        });
    }
};
exports.HrmOvertimeController = HrmOvertimeController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.leave.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, leave_dto_1.OvertimeRequestQueryDto]),
    __metadata("design:returntype", void 0)
], HrmOvertimeController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.leave.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, leave_dto_1.CreateOvertimeRequestDto, String]),
    __metadata("design:returntype", void 0)
], HrmOvertimeController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.leave.approve'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, leave_dto_1.LeaveDecisionDto, String]),
    __metadata("design:returntype", void 0)
], HrmOvertimeController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/reject'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.leave.approve'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, leave_dto_1.LeaveRejectDto, String]),
    __metadata("design:returntype", void 0)
], HrmOvertimeController.prototype, "reject", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.leave.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, leave_dto_1.LeaveCancelDto, String]),
    __metadata("design:returntype", void 0)
], HrmOvertimeController.prototype, "cancel", null);
exports.HrmOvertimeController = HrmOvertimeController = __decorate([
    (0, common_1.Controller)('hrm/overtime-requests'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [hrm_leave_service_1.HrmLeaveService])
], HrmOvertimeController);
