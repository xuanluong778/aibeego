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
exports.HrmTimesheetController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permissions_guard_1 = require("../common/guards/permissions.guard");
const require_permissions_decorator_1 = require("../common/decorators/require-permissions.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const client_ip_decorator_1 = require("../common/decorators/client-ip.decorator");
const hrm_timesheet_service_1 = require("./hrm-timesheet.service");
const attendance_dto_1 = require("./dto/attendance.dto");
let HrmTimesheetController = class HrmTimesheetController {
    timesheet;
    constructor(timesheet) {
        this.timesheet = timesheet;
    }
    list(user, query) {
        return this.timesheet.list(user.organizationId, query);
    }
    create(user, dto, ipAddress) {
        return this.timesheet.create(user.organizationId, dto, {
            userId: user.id,
            ipAddress,
        });
    }
    lock(user, id, ipAddress) {
        return this.timesheet.lock(user.organizationId, id, {
            userId: user.id,
            ipAddress,
        });
    }
    unlock(user, id, dto, ipAddress) {
        return this.timesheet.unlock(user.organizationId, id, dto.reason, {
            userId: user.id,
            ipAddress,
        });
    }
};
exports.HrmTimesheetController = HrmTimesheetController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.attendance.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, attendance_dto_1.TimesheetPeriodQueryDto]),
    __metadata("design:returntype", void 0)
], HrmTimesheetController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.attendance.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, attendance_dto_1.CreateTimesheetPeriodDto, String]),
    __metadata("design:returntype", void 0)
], HrmTimesheetController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':id/lock'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.attendance.lock'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], HrmTimesheetController.prototype, "lock", null);
__decorate([
    (0, common_1.Post)(':id/unlock'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.attendance.lock'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, attendance_dto_1.UnlockTimesheetPeriodDto, String]),
    __metadata("design:returntype", void 0)
], HrmTimesheetController.prototype, "unlock", null);
exports.HrmTimesheetController = HrmTimesheetController = __decorate([
    (0, common_1.Controller)('hrm/timesheet-periods'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [hrm_timesheet_service_1.HrmTimesheetService])
], HrmTimesheetController);
