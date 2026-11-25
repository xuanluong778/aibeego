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
exports.HrmEmployeesController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permissions_guard_1 = require("../common/guards/permissions.guard");
const require_permissions_decorator_1 = require("../common/decorators/require-permissions.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const client_ip_decorator_1 = require("../common/decorators/client-ip.decorator");
const upload_policy_1 = require("../common/uploads/upload-policy");
const hrm_employees_service_1 = require("./hrm-employees.service");
const hrm_contracts_service_1 = require("./hrm-contracts.service");
const hrm_documents_service_1 = require("./hrm-documents.service");
const employee_dto_1 = require("./dto/employee.dto");
const account_dto_1 = require("./dto/account.dto");
const contract_dto_1 = require("./dto/contract.dto");
const document_dto_1 = require("./dto/document.dto");
let HrmEmployeesController = class HrmEmployeesController {
    employees;
    contracts;
    documents;
    constructor(employees, contracts, documents) {
        this.employees = employees;
        this.contracts = contracts;
        this.documents = documents;
    }
    findAll(user, query) {
        return this.employees.findAll(user.organizationId, query);
    }
    create(user, dto, ipAddress) {
        return this.employees.create(user.organizationId, dto, {
            userId: user.id,
            ipAddress,
        });
    }
    deactivate(user, id, ipAddress) {
        return this.employees.deactivate(user.organizationId, id, {
            userId: user.id,
            ipAddress,
        });
    }
    createAccount(user, id, dto, ipAddress) {
        return this.employees.createAccount(user.organizationId, id, dto, {
            userId: user.id,
            ipAddress,
        });
    }
    resetPassword(user, id, dto, ipAddress) {
        return this.employees.resetPassword(user.organizationId, id, dto, {
            userId: user.id,
            ipAddress,
        });
    }
    listContracts(user, id) {
        return this.contracts.listByEmployee(user.organizationId, id);
    }
    createContract(user, id, dto, ipAddress) {
        return this.contracts.create(user.organizationId, id, dto, {
            userId: user.id,
            ipAddress,
        });
    }
    listDocuments(user, id) {
        return this.documents.listByEmployee(user.organizationId, id);
    }
    uploadDocument(user, id, file, meta, ipAddress) {
        return this.documents.upload(user.organizationId, id, file, meta, {
            userId: user.id,
            ipAddress,
        });
    }
    createDocument(user, id, dto, ipAddress) {
        return this.documents.create(user.organizationId, id, dto, {
            userId: user.id,
            ipAddress,
        });
    }
    update(user, id, dto, ipAddress) {
        return this.employees.update(user.organizationId, id, dto, {
            userId: user.id,
            ipAddress,
        });
    }
    findOne(user, id) {
        return this.employees.findOne(user.organizationId, id);
    }
};
exports.HrmEmployeesController = HrmEmployeesController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.employee.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, employee_dto_1.HrmEmployeeQueryDto]),
    __metadata("design:returntype", void 0)
], HrmEmployeesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.employee.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, employee_dto_1.CreateHrmEmployeeDto, String]),
    __metadata("design:returntype", void 0)
], HrmEmployeesController.prototype, "create", null);
__decorate([
    (0, common_1.Post)(':id/deactivate'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.employee.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], HrmEmployeesController.prototype, "deactivate", null);
__decorate([
    (0, common_1.Post)(':id/account'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.account.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, account_dto_1.CreateEmployeeAccountDto, String]),
    __metadata("design:returntype", void 0)
], HrmEmployeesController.prototype, "createAccount", null);
__decorate([
    (0, common_1.Post)(':id/account/reset-password'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.account.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, account_dto_1.ResetEmployeePasswordDto, String]),
    __metadata("design:returntype", void 0)
], HrmEmployeesController.prototype, "resetPassword", null);
__decorate([
    (0, common_1.Get)(':id/contracts'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.contract.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], HrmEmployeesController.prototype, "listContracts", null);
__decorate([
    (0, common_1.Post)(':id/contracts'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.contract.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, contract_dto_1.CreateEmploymentContractDto, String]),
    __metadata("design:returntype", void 0)
], HrmEmployeesController.prototype, "createContract", null);
__decorate([
    (0, common_1.Get)(':id/documents'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.document.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], HrmEmployeesController.prototype, "listDocuments", null);
__decorate([
    (0, common_1.Post)(':id/documents/upload'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.document.write'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', (0, upload_policy_1.createUploadMulterOptions)('document'))),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.UploadedFile)()),
    __param(3, (0, common_1.Body)()),
    __param(4, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object, document_dto_1.UploadEmployeeDocumentMetaDto, String]),
    __metadata("design:returntype", void 0)
], HrmEmployeesController.prototype, "uploadDocument", null);
__decorate([
    (0, common_1.Post)(':id/documents'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.document.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, document_dto_1.CreateEmployeeDocumentDto, String]),
    __metadata("design:returntype", void 0)
], HrmEmployeesController.prototype, "createDocument", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.employee.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, client_ip_decorator_1.ClientIp)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, employee_dto_1.UpdateHrmEmployeeDto, String]),
    __metadata("design:returntype", void 0)
], HrmEmployeesController.prototype, "update", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('hrm.employee.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], HrmEmployeesController.prototype, "findOne", null);
exports.HrmEmployeesController = HrmEmployeesController = __decorate([
    (0, common_1.Controller)('hrm/employees'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [hrm_employees_service_1.HrmEmployeesService,
        hrm_contracts_service_1.HrmContractsService,
        hrm_documents_service_1.HrmDocumentsService])
], HrmEmployeesController);
