import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { InventoryService } from './inventory.service';
import { StocktakeService } from './stocktake.service';
import { SalesPaymentService } from './payment.service';
import { SalesReturnService } from './return.service';
import { SalesPurchaseService } from './purchase.service';
import { SalesReportsService } from './reports.service';
import { SalesDocumentCodeService } from './sales-document-code.service';
import { SalesSensitiveRedactInterceptor } from './sales-sensitive-redact.interceptor';
import { ProductImportController } from './product-import.controller';
import { ProductImportService } from './product-import.service';
import { WooCommerceController } from './woocommerce.controller';
import { WooCommerceService } from './woocommerce.service';

@Module({
  controllers: [SalesController, ProductImportController, WooCommerceController],
  providers: [
    SalesDocumentCodeService,
    SalesService,
    ProductImportService,
    WooCommerceService,
    InventoryService,
    StocktakeService,
    SalesPaymentService,
    SalesReturnService,
    SalesPurchaseService,
    SalesReportsService,
    SalesSensitiveRedactInterceptor,
  ],
  exports: [
    SalesService,
    InventoryService,
    StocktakeService,
    SalesPaymentService,
    SalesReturnService,
    SalesPurchaseService,
    SalesReportsService,
  ],
})
export class SalesModule {}
