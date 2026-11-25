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
exports.ContactsLegacyController = exports.CustomersController = void 0;
const common_1 = require("@nestjs/common");
const customers_service_1 = require("./customers.service");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permissions_guard_1 = require("../common/guards/permissions.guard");
const require_permissions_decorator_1 = require("../common/decorators/require-permissions.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const customer_dto_1 = require("./dto/customer.dto");
const customer_note_dto_1 = require("./dto/customer-note.dto");
let CustomersController = class CustomersController {
    service;
    constructor(service) {
        this.service = service;
    }
    listSources() {
        return this.service.listSources();
    }
    findAll(user, query) {
        return this.service.findAll(user.organizationId, query);
    }
    getHistory(user, id) {
        return this.service.getHistory(user.organizationId, id);
    }
    addNote(user, id, dto) {
        return this.service.addNote(user.organizationId, id, user.id, dto.content);
    }
    findOne(user, id) {
        return this.service.findOne(user.organizationId, id);
    }
    create(user, dto) {
        return this.service.create(user.organizationId, dto);
    }
    update(user, id, dto) {
        return this.service.update(user.organizationId, id, dto);
    }
    remove(user, id) {
        return this.service.remove(user.organizationId, id);
    }
};
exports.CustomersController = CustomersController;
__decorate([
    (0, common_1.Get)('sources'),
    (0, require_permissions_decorator_1.RequirePermissions)('customer.read'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CustomersController.prototype, "listSources", null);
__decorate([
    (0, common_1.Get)(),
    (0, require_permissions_decorator_1.RequirePermissions)('customer.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, customer_dto_1.CustomerQueryDto]),
    __metadata("design:returntype", void 0)
], CustomersController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id/history'),
    (0, require_permissions_decorator_1.RequirePermissions)('customer.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CustomersController.prototype, "getHistory", null);
__decorate([
    (0, common_1.Post)(':id/notes'),
    (0, require_permissions_decorator_1.RequirePermissions)('customer.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, customer_note_dto_1.CreateCustomerNoteDto]),
    __metadata("design:returntype", void 0)
], CustomersController.prototype, "addNote", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('customer.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CustomersController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    (0, require_permissions_decorator_1.RequirePermissions)('customer.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, customer_dto_1.CreateCustomerDto]),
    __metadata("design:returntype", void 0)
], CustomersController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('customer.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, customer_dto_1.UpdateCustomerDto]),
    __metadata("design:returntype", void 0)
], CustomersController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('customer.write'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CustomersController.prototype, "remove", null);
exports.CustomersController = CustomersController = __decorate([
    (0, common_1.Controller)('customers'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [customers_service_1.CustomersService])
], CustomersController);
/** Alias /contacts cho backward compatibility */
let ContactsLegacyController = class ContactsLegacyController {
    service;
    constructor(service) {
        this.service = service;
    }
    findAll(user) {
        return this.service.findAllLegacy(user.organizationId);
    }
    create(user, dto) {
        return this.service.create(user.organizationId, dto);
    }
};
exports.ContactsLegacyController = ContactsLegacyController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ContactsLegacyController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, customer_dto_1.CreateCustomerDto]),
    __metadata("design:returntype", void 0)
], ContactsLegacyController.prototype, "create", null);
exports.ContactsLegacyController = ContactsLegacyController = __decorate([
    (0, common_1.Controller)('contacts'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __metadata("design:paramtypes", [customers_service_1.CustomersService])
], ContactsLegacyController);
