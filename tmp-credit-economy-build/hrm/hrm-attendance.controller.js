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
exports.HrmAttendanceController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permissions_guard_1 = require("../common/guards/permissions.guard");
const require_permissions_decorator_1 = require("../common/decorators/require-permissions.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const client_ip_decorator_1 = require("../common/decorators/client-ip.decorator");
const hrm_attendance_service_1 = require("./hrm-attendance.service");
const attendance_dto_1 = require("./dto/attendance.dto");
let HrmAttendanceController = class HrmAttendanceController {
    attendance;
    constructor(attendance) {
        this.attendance = attendance;
    }
    async exportDays(user, query, res) {
        const file = await this.attendance.exportDays(user.organizationId, query, user);
        res.setHeader('Content-Type', file.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
        res.send(file.content);
    }
    listDays(user, query) {
        return this.attendance.listDays(user.organizationId, query, user);
    }
    today(user) {
        return this.attendance.getTodayPunchState(user.organizationId, user);
    }
    punch(user, dto, ipAddress) {
        return this.attendance.punch(user.organizationId, dto, {
            userId: user.id,
            ipAddress,
            role: user.role,
            employeeId: user.employeeId,
        });
    }
    correctDay(user, id, dto, ipAddress) {
        return this.attendance.correctDay(user.organizationId, id, dto, {
            userId: user.id,
            ipAddress,
            role: user.role,
            employeeId: user.employeeId,
        });
    }
    createAdjustment(user, dto, ipAddress) {
        return this.attendance.createAdjustment(user.organizationId, dto, {
            userId: user.id,
            ipAddress,
            role: user.role,
            employeeId: user.employeeId,
        });
    }
    listQrTokens(user, branchId) {
        return this.attendance.listQrTokens(user.organizationId, branchId);
    }
    createQrToken(user, dto, ipAddress) {
        return this.attendance.createQrToken(user.organizationId, dto, {
            userId: user.id,
            ipAddress,
        });
    }
};
exports.HrmAttendanceController = HrmAttendanceController;
__decorate([
    (0, common_1.Get)('days/export'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.attendance.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, attendance_dto_1.AttendanceExportQueryDto, Object]),
    __metadata("design:returntype", Promise)
], HrmAttendanceController.prototype, "exportDays", null);
__decorate([
    (0, common_1.Get)('days'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.attendance.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, attendance_dto_1.AttendanceDaysQueryDto]),
    __metadata("design:returntype", void 0)
], HrmAttendanceController.prototype, "listDays", null);
__decorate([
    (0, common_1.Get)('today'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.attendance.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], HrmAttendanceController.prototype, "today", null);
__decorate([
    (0, common_1.Post)('punch'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.attendance.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, attendance_dto_1.AttendancePunchDto, String]),
    __metadata("design:returntype", void 0)
], HrmAttendanceController.prototype, "punch", null);
__decorate([
    (0, common_1.Post)('days/:id/correct'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.attendance.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, attendance_dto_1.CorrectAttendanceDayDto, String]),
    __metadata("design:returntype", void 0)
], HrmAttendanceController.prototype, "correctDay", null);
__decorate([
    (0, common_1.Post)('adjustments'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.attendance.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, attendance_dto_1.CreateAttendanceAdjustmentDto, String]),
    __metadata("design:returntype", void 0)
], HrmAttendanceController.prototype, "createAdjustment", null);
__decorate([
    (0, common_1.Get)('qr-tokens'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.attendance.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('branchId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], HrmAttendanceController.prototype, "listQrTokens", null);
__decorate([
    (0, common_1.Post)('qr-tokens'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.attendance.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, attendance_dto_1.CreateAttendanceQrTokenDto, String]),
    __metadata("design:returntype", void 0)
], HrmAttendanceController.prototype, "createQrToken", null);
exports.HrmAttendanceController = HrmAttendanceController = __decorate([
    (0, common_1.Controller)('hrm/attendance'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [hrm_attendance_service_1.HrmAttendanceService])
], HrmAttendanceController);
