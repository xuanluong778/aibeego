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
exports.WooCommerceController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permissions_guard_1 = require("../common/guards/permissions.guard");
const require_permissions_decorator_1 = require("../common/decorators/require-permissions.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const sales_rbac_1 = require("./sales.rbac");
const woocommerce_dto_1 = require("./dto/woocommerce.dto");
const woocommerce_service_1 = require("./woocommerce.service");
let WooCommerceController = class WooCommerceController {
    woo;
    constructor(woo) {
        this.woo = woo;
    }
    list(user) {
        (0, sales_rbac_1.assertSalesWritePermission)(user);
        return this.woo.list(user.organizationId);
    }
    connect(user, dto) {
        (0, sales_rbac_1.assertSalesWritePermission)(user);
        return this.woo.connect(user.organizationId, dto);
    }
    categories(user, id) {
        (0, sales_rbac_1.assertSalesWritePermission)(user);
        return this.woo.categories(user.organizationId, id);
    }
    resolve(user, id, dto) {
        (0, sales_rbac_1.assertSalesWritePermission)(user);
        return this.woo.resolveCategory(user.organizationId, id, dto.url);
    }
    products(user, id, dto) {
        (0, sales_rbac_1.assertSalesWritePermission)(user);
        return this.woo.browse(user.organizationId, id, dto.page, dto.categoryId);
    }
    draft(user, id, dto) {
        (0, sales_rbac_1.assertSalesWritePermission)(user);
        return this.woo.draft(user.organizationId, id, user.id, dto);
    }
};
exports.WooCommerceController = WooCommerceController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], WooCommerceController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, woocommerce_dto_1.WooConnectionDto]),
    __metadata("design:returntype", void 0)
], WooCommerceController.prototype, "connect", null);
__decorate([
    (0, common_1.Get)(':id/categories'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WooCommerceController.prototype, "categories", null);
__decorate([
    (0, common_1.Post)(':id/category-url'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, woocommerce_dto_1.WooCategoryUrlDto]),
    __metadata("design:returntype", void 0)
], WooCommerceController.prototype, "resolve", null);
__decorate([
    (0, common_1.Get)(':id/products'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, woocommerce_dto_1.WooBrowseDto]),
    __metadata("design:returntype", void 0)
], WooCommerceController.prototype, "products", null);
__decorate([
    (0, common_1.Post)(':id/import'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, woocommerce_dto_1.WooDraftDto]),
    __metadata("design:returntype", void 0)
], WooCommerceController.prototype, "draft", null);
exports.WooCommerceController = WooCommerceController = __decorate([
    (0, common_1.Controller)('sales/woocommerce'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.write),
    __metadata("design:paramtypes", [woocommerce_service_1.WooCommerceService])
], WooCommerceController);
