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
exports.EmployeesController = void 0;
const common_1 = require("@nestjs/common");
const employees_service_1 = require("./employees.service");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permissions_guard_1 = require("../common/guards/permissions.guard");
const require_permissions_decorator_1 = require("../common/decorators/require-permissions.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const client_ip_decorator_1 = require("../common/decorators/client-ip.decorator");
const employee_dto_1 = require("./dto/employee.dto");
const performance_dto_1 = require("./dto/performance.dto");
let EmployeesController = class EmployeesController {
    service;
    constructor(service) {
        this.service = service;
    }
    findAll(user, query) {
        return this.service.findAll(user.organizationId, query);
    }
    getPerformance(user, id, query) {
        return this.service.getPerformance(user.organizationId, id, query);
    }
    findOne(user, id) {
        return this.service.findOne(user.organizationId, id);
    }
    create(user, dto, ipAddress) {
        return this.service.create(user.organizationId, dto, {
            userId: user.id,
            ipAddress,
        });
    }
    update(user, id, dto, ipAddress) {
        return this.service.update(user.organizationId, id, dto, {
            userId: user.id,
            ipAddress,
        });
    }
    remove(user, id, ipAddress) {
        return this.service.remove(user.organizationId, id, {
            userId: user.id,
            ipAddress,
        });
    }
};
exports.EmployeesController = EmployeesController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.employee.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, employee_dto_1.EmployeeQueryDto]),
    __metadata("design:returntype", void 0)
], EmployeesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id/performance'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.employee.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, performance_dto_1.EmployeePerformanceQueryDto]),
    __metadata("design:returntype", void 0)
], EmployeesController.prototype, "getPerformance", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.employee.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], EmployeesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.employee.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, employee_dto_1.CreateEmployeeDto, String]),
    __metadata("design:returntype", void 0)
], EmployeesController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.employee.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, employee_dto_1.UpdateEmployeeDto, String]),
    __metadata("design:returntype", void 0)
], EmployeesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.employee.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], EmployeesController.prototype, "remove", null);
exports.EmployeesController = EmployeesController = __decorate([
    (0, common_1.Controller)('employees'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [employees_service_1.EmployeesService])
], EmployeesController);
