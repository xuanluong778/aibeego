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
exports.SalesController = void 0;
const common_1 = require("@nestjs/common");
const sales_service_1 = require("./sales.service");
const inventory_service_1 = require("./inventory.service");
const stocktake_service_1 = require("./stocktake.service");
const payment_service_1 = require("./payment.service");
const return_service_1 = require("./return.service");
const purchase_service_1 = require("./purchase.service");
const reports_service_1 = require("./reports.service");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permissions_guard_1 = require("../common/guards/permissions.guard");
const require_permissions_decorator_1 = require("../common/decorators/require-permissions.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const sales_rbac_1 = require("./sales.rbac");
const sales_dto_1 = require("./dto/sales.dto");
let SalesController = class SalesController {
    service;
    inventory;
    stocktake;
    payments;
    returns;
    purchase;
    reports;
    constructor(service, inventory, stocktake, payments, returns, purchase, reports) {
        this.service = service;
        this.inventory = inventory;
        this.stocktake = stocktake;
        this.payments = payments;
        this.returns = returns;
        this.purchase = purchase;
        this.reports = reports;
    }
    reportSummary(user, query) {
        return this.reports.summary(user.organizationId, query);
    }
    async reportCsv(user, query, res) {
        const file = await this.reports.exportCsv(user.organizationId, query);
        res.setHeader('Content-Type', file.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
        res.send(file.body);
    }
    listOrders(user, query) {
        return this.service.listOrders(user.organizationId, query);
    }
    getOrder(user, id) {
        return this.service.getOrder(user.organizationId, id);
    }
    createOrder(user, dto) {
        return this.service.createOrder(user.organizationId, dto, user.id);
    }
    updateOrder(user, id, dto) {
        return this.service.updateOrder(user.organizationId, id, dto, user.id);
    }
    updateStatus(user, id, dto) {
        return this.service.updateStatus(user.organizationId, id, dto.status, user.id);
    }
    exportOrder(user, id) {
        return this.service.exportOrder(user.organizationId, id, user.id);
    }
    listPayments(user, id) {
        return this.payments.list(user.organizationId, id);
    }
    addPayment(user, id, dto) {
        return this.payments.addPayment(user.organizationId, id, dto, user.id);
    }
    addRefund(user, id, dto) {
        return this.payments.addRefund(user.organizationId, id, dto, user.id);
    }
    createReturn(user, dto) {
        return this.returns.createAndConfirm(user.organizationId, dto, user.id);
    }
    listReturns(user, orderId) {
        return this.returns.list(user.organizationId, orderId);
    }
    getReturn(user, id) {
        return this.returns.get(user.organizationId, id);
    }
    lookupProduct(user, query) {
        (0, sales_rbac_1.assertSalesReadPermission)(user);
        return this.inventory.lookupProduct(user.organizationId, query.q);
    }
    listProducts(user, query) {
        (0, sales_rbac_1.assertSalesReadPermission)(user);
        return this.service.listProducts(user.organizationId, query);
    }
    createProduct(user, dto) {
        (0, sales_rbac_1.assertSalesWritePermission)(user);
        return this.service.createProduct(user.organizationId, dto, user.id);
    }
    getProduct(user, id) {
        (0, sales_rbac_1.assertSalesReadPermission)(user);
        return this.service.getProduct(user.organizationId, id);
    }
    updateProduct(user, id, dto) {
        (0, sales_rbac_1.assertSalesWritePermission)(user);
        return this.service.updateProduct(user.organizationId, id, dto, user.id);
    }
    listCategories(user) {
        return this.service.listCategories(user.organizationId);
    }
    createCategory(user, dto) {
        (0, sales_rbac_1.assertSalesWritePermission)(user);
        return this.service.createCategory(user.organizationId, dto.name);
    }
    listSuppliers(user, query) {
        return this.purchase.listSuppliers(user.organizationId, query);
    }
    createSupplier(user, dto) {
        return this.purchase.createSupplier(user.organizationId, dto, user.id);
    }
    listPos(user, query) {
        return this.purchase.listPurchaseOrders(user.organizationId, query);
    }
    getPo(user, id) {
        return this.purchase.getPurchaseOrder(user.organizationId, id);
    }
    createPo(user, dto) {
        return this.purchase.createPurchaseOrder(user.organizationId, dto, user.id);
    }
    receivePo(user, id, dto) {
        return this.purchase.receiveGoods(user.organizationId, id, dto, user.id);
    }
    listBatches(user, query) {
        return this.inventory.listBatches(user.organizationId, query);
    }
    listMovements(user, query) {
        return this.inventory.listMovements(user.organizationId, {
            ...query,
            type: query.type,
        });
    }
    alerts(user) {
        return this.inventory.getAlerts(user.organizationId);
    }
    reconcile(user, _query) {
        return this.inventory.reconcile(user.organizationId, { fix: false });
    }
    reconcileFix(user) {
        (0, sales_rbac_1.assertSalesWritePermission)(user);
        return this.inventory.reconcile(user.organizationId, {
            fix: true,
            performedById: user.id,
        });
    }
    inbound(user, dto) {
        (0, sales_rbac_1.assertSalesWritePermission)(user);
        return this.inventory.inbound(user.organizationId, dto, user.id);
    }
    outbound(user, dto) {
        (0, sales_rbac_1.assertSalesWritePermission)(user);
        return this.inventory.outbound(user.organizationId, dto, user.id);
    }
    adjust(user, dto) {
        (0, sales_rbac_1.assertSalesWritePermission)(user);
        return this.inventory.adjust(user.organizationId, dto, user.id);
    }
    listStocktakes(user, query) {
        return this.stocktake.list(user.organizationId, query);
    }
    getStocktake(user, id) {
        return this.stocktake.get(user.organizationId, id);
    }
    createStocktake(user, dto) {
        return this.stocktake.create(user.organizationId, dto, user.id);
    }
    updateStocktakeLines(user, id, dto) {
        return this.stocktake.updateLines(user.organizationId, id, dto.lines, user.id);
    }
    confirmStocktake(user, id) {
        return this.stocktake.confirm(user.organizationId, id, user.id);
    }
    cancelStocktake(user, id) {
        return this.stocktake.cancel(user.organizationId, id, user.id);
    }
};
exports.SalesController = SalesController;
__decorate([
    (0, common_1.Get)('reports/summary'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.read),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, sales_dto_1.SalesReportQueryDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "reportSummary", null);
__decorate([
    (0, common_1.Get)('reports/export.csv'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.read),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, sales_dto_1.SalesReportQueryDto, Object]),
    __metadata("design:returntype", Promise)
], SalesController.prototype, "reportCsv", null);
__decorate([
    (0, common_1.Get)('orders'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.read),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, sales_dto_1.SalesOrderQueryDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "listOrders", null);
__decorate([
    (0, common_1.Get)('orders/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.read),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "getOrder", null);
__decorate([
    (0, common_1.Post)('orders'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.write),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, sales_dto_1.CreateSalesOrderDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "createOrder", null);
__decorate([
    (0, common_1.Patch)('orders/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.write),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, sales_dto_1.UpdateSalesOrderDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "updateOrder", null);
__decorate([
    (0, common_1.Post)('orders/:id/status'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.write),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, sales_dto_1.UpdateSalesOrderStatusDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Post)('orders/:id/export'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.write),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "exportOrder", null);
__decorate([
    (0, common_1.Get)('orders/:id/payments'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.read),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "listPayments", null);
__decorate([
    (0, common_1.Post)('orders/:id/payments'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.write),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, sales_dto_1.RecordSalesPaymentDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "addPayment", null);
__decorate([
    (0, common_1.Post)('orders/:id/refunds'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.write),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, sales_dto_1.RecordSalesPaymentDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "addRefund", null);
__decorate([
    (0, common_1.Post)('returns'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.write),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, sales_dto_1.CreateSalesReturnDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "createReturn", null);
__decorate([
    (0, common_1.Get)('returns'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.read),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "listReturns", null);
__decorate([
    (0, common_1.Get)('returns/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.read),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "getReturn", null);
__decorate([
    (0, common_1.Get)('products/lookup'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.read),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, sales_dto_1.ProductLookupDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "lookupProduct", null);
__decorate([
    (0, common_1.Get)('products'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.read),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, sales_dto_1.SalesProductQueryDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "listProducts", null);
__decorate([
    (0, common_1.Post)('products'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.write),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, sales_dto_1.CreateSalesProductDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "createProduct", null);
__decorate([
    (0, common_1.Get)('products/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.read),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "getProduct", null);
__decorate([
    (0, common_1.Patch)('products/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.write),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, sales_dto_1.UpdateSalesProductDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "updateProduct", null);
__decorate([
    (0, common_1.Get)('categories'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.read),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "listCategories", null);
__decorate([
    (0, common_1.Post)('categories'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.write),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, sales_dto_1.CreateCategoryDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "createCategory", null);
__decorate([
    (0, common_1.Get)('suppliers'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.read),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, sales_dto_1.SupplierQueryDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "listSuppliers", null);
__decorate([
    (0, common_1.Post)('suppliers'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.write),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, sales_dto_1.CreateSupplierDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "createSupplier", null);
__decorate([
    (0, common_1.Get)('purchase-orders'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.read),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, sales_dto_1.PurchaseOrderQueryDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "listPos", null);
__decorate([
    (0, common_1.Get)('purchase-orders/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.read),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "getPo", null);
__decorate([
    (0, common_1.Post)('purchase-orders'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.write),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, sales_dto_1.CreatePurchaseOrderDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "createPo", null);
__decorate([
    (0, common_1.Post)('purchase-orders/:id/receive'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.write),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, sales_dto_1.ReceivePurchaseOrderDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "receivePo", null);
__decorate([
    (0, common_1.Get)('stock/batches'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.read),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, sales_dto_1.StockBatchQueryDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "listBatches", null);
__decorate([
    (0, common_1.Get)('stock/movements'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.read),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, sales_dto_1.StockMovementQueryDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "listMovements", null);
__decorate([
    (0, common_1.Get)('stock/alerts'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.read),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "alerts", null);
__decorate([
    (0, common_1.Get)('stock/reconcile'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.read),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, sales_dto_1.ReconcileQueryDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "reconcile", null);
__decorate([
    (0, common_1.Post)('stock/reconcile/fix'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.write),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "reconcileFix", null);
__decorate([
    (0, common_1.Post)('stock/inbound'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.write),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, sales_dto_1.StockInboundDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "inbound", null);
__decorate([
    (0, common_1.Post)('stock/outbound'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.write),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, sales_dto_1.StockOutboundDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "outbound", null);
__decorate([
    (0, common_1.Post)('stock/adjust'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.write),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, sales_dto_1.StockAdjustDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "adjust", null);
__decorate([
    (0, common_1.Get)('stocktakes'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.read),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, sales_dto_1.StocktakeQueryDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "listStocktakes", null);
__decorate([
    (0, common_1.Get)('stocktakes/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.read),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "getStocktake", null);
__decorate([
    (0, common_1.Post)('stocktakes'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.write),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, sales_dto_1.CreateStocktakeDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "createStocktake", null);
__decorate([
    (0, common_1.Patch)('stocktakes/:id/lines'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.write),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, sales_dto_1.UpdateStocktakeLinesDto]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "updateStocktakeLines", null);
__decorate([
    (0, common_1.Post)('stocktakes/:id/confirm'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.write),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "confirmStocktake", null);
__decorate([
    (0, common_1.Post)('stocktakes/:id/cancel'),
    (0, require_permissions_decorator_1.RequirePermissions)(sales_rbac_1.SALES_PERMISSIONS.write),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], SalesController.prototype, "cancelStocktake", null);
exports.SalesController = SalesController = __decorate([
    (0, common_1.Controller)('sales'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [sales_service_1.SalesService,
        inventory_service_1.InventoryService,
        stocktake_service_1.StocktakeService,
        payment_service_1.SalesPaymentService,
        return_service_1.SalesReturnService,
        purchase_service_1.SalesPurchaseService,
        reports_service_1.SalesReportsService])
], SalesController);
