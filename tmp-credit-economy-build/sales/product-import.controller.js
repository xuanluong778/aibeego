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
exports.ProductImportController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permissions_guard_1 = require("../common/guards/permissions.guard");
const require_permissions_decorator_1 = require("../common/decorators/require-permissions.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const upload_policy_1 = require("../common/uploads/upload-policy");
const pagination_dto_1 = require("../common/dto/pagination.dto");
const sales_rbac_1 = require("./sales.rbac");
const product_import_service_1 = require("./product-import.service");
const product_import_dto_1 = require("./dto/product-import.dto");
const product_spreadsheet_util_1 = require("./product-spreadsheet.util");
let ProductImportController = class ProductImportController {
    imports;
    constructor(imports) {
        this.imports = imports;
    }
    async template(user, format = 'xlsx', res) {
        (0, sales_rbac_1.assertSalesWritePermission)(user);
        if (!['csv', 'xlsx'].includes(format))
            throw new common_1.BadRequestException('Chọn mẫu .csv hoặc .xlsx.');
        const body = await (0, product_spreadsheet_util_1.productImportTemplate)(format);
        res.setHeader('Content-Type', format === 'csv'
            ? 'text/csv; charset=utf-8'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="sales-products-template.${format}"`);
        res.send(body);
    }
    history(user, query) {
        (0, sales_rbac_1.assertSalesWritePermission)(user);
        return this.imports.history(user.organizationId, query);
    }
    upload(user, file, query) {
        (0, sales_rbac_1.assertSalesWritePermission)(user);
        return this.imports.upload(user.organizationId, user.id, file, query.clientToken, query.delimiter);
    }
    get(user, id) {
        (0, sales_rbac_1.assertSalesWritePermission)(user);
        return this.imports.get(user.organizationId, id);
    }
    rows(user, id, query) {
        (0, sales_rbac_1.assertSalesWritePermission)(user);
        return this.imports.rows(user.organizationId, id, query);
    }
    async report(user, id, res) {
        (0, sales_rbac_1.assertSalesWritePermission)(user);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="sales-import-${id}.csv"`);
        res.send(await this.imports.report(user.organizationId, id));
    }
    preview(user, id, dto) {
        (0, sales_rbac_1.assertSalesWritePermission)(user);
        return this.imports.preview(user.organizationId, id, dto);
    }
    confirm(user, id, dto) {
        (0, sales_rbac_1.assertSalesWritePermission)(user);
        return this.imports.confirm(user.organizationId, id, dto.previewVersion);
    }
    process(user, id) {
        (0, sales_rbac_1.assertSalesWritePermission)(user);
        return this.imports.process(user.organizationId, id, user.id);
    }
    retry(user, id) {
        (0, sales_rbac_1.assertSalesWritePermission)(user);
        return this.imports.retry(user.organizationId, id);
    }
};
exports.ProductImportController = ProductImportController;
__decorate([
    (0, common_1.Get)('template'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('format')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", Promise)
], ProductImportController.prototype, "template", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, pagination_dto_1.PaginationDto]),
    __metadata("design:returntype", void 0)
], ProductImportController.prototype, "history", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        ...(0, upload_policy_1.createUploadMulterOptions)('spreadsheet'),
        limits: { fileSize: product_spreadsheet_util_1.IMPORT_LIMITS.bytes, files: 1, fields: 0, parts: 2 },
    })),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, product_import_dto_1.ProductImportUploadDto]),
    __metadata("design:returntype", void 0)
], ProductImportController.prototype, "upload", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ProductImportController.prototype, "get", null);
__decorate([
    (0, common_1.Get)(':id/rows'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, pagination_dto_1.PaginationDto]),
    __metadata("design:returntype", void 0)
], ProductImportController.prototype, "rows", null);
__decorate([
    (0, common_1.Get)(':id/report.csv'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ProductImportController.prototype, "report", null);
__decorate([
    (0, common_1.Post)(':id/preview'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, product_import_dto_1.ProductImportPreviewDto]),
    __metadata("design:returntype", void 0)
], ProductImportController.prototype, "preview", null);
__decorate([
    (0, common_1.Post)(':id/confirm'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, product_import_dto_1.ProductImportConfirmDto]),
    __metadata("design:returntype", void 0)
], ProductImportController.prototype, "confirm", null);
__decorate([
    (0, common_1.Post)(':id/process'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ProductImportController.prototype, "process", null);
__decorate([
    (0, common_1.Post)(':id/retry'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseUUIDPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ProductImportController.prototype, "retry", null);
exports.ProductImportController = ProductImportController = __decorate([
    (0, common_1.Controller)('sales/product-imports'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.write),
    __metadata("design:paramtypes", [product_import_service_1.ProductImportService])
], ProductImportController);
