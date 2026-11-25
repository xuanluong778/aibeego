"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalesModule = void 0;
const common_1 = require("@nestjs/common");
const sales_controller_1 = require("./sales.controller");
const sales_service_1 = require("./sales.service");
const inventory_service_1 = require("./inventory.service");
const stocktake_service_1 = require("./stocktake.service");
const payment_service_1 = require("./payment.service");
const return_service_1 = require("./return.service");
const purchase_service_1 = require("./purchase.service");
const reports_service_1 = require("./reports.service");
const product_import_controller_1 = require("./product-import.controller");
const product_import_service_1 = require("./product-import.service");
const woocommerce_controller_1 = require("./woocommerce.controller");
const woocommerce_service_1 = require("./woocommerce.service");
let SalesModule = class SalesModule {
};
exports.SalesModule = SalesModule;
exports.SalesModule = SalesModule = __decorate([
    (0, common_1.Module)({
        controllers: [sales_controller_1.SalesController, product_import_controller_1.ProductImportController, woocommerce_controller_1.WooCommerceController],
        providers: [
            sales_service_1.SalesService,
            product_import_service_1.ProductImportService,
            woocommerce_service_1.WooCommerceService,
            inventory_service_1.InventoryService,
            stocktake_service_1.StocktakeService,
            payment_service_1.SalesPaymentService,
            return_service_1.SalesReturnService,
            purchase_service_1.SalesPurchaseService,
            reports_service_1.SalesReportsService,
        ],
        exports: [
            sales_service_1.SalesService,
            inventory_service_1.InventoryService,
            stocktake_service_1.StocktakeService,
            payment_service_1.SalesPaymentService,
            return_service_1.SalesReturnService,
            purchase_service_1.SalesPurchaseService,
            reports_service_1.SalesReportsService,
        ],
    })
], SalesModule);
