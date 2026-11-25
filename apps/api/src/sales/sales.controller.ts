import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { SalesStockMovementType } from '@marketingspa/database';
import type { Response } from 'express';
import { SalesService } from './sales.service';
import { InventoryService } from './inventory.service';
import { StocktakeService } from './stocktake.service';
import { SalesPaymentService } from './payment.service';
import { SalesReturnService } from './return.service';
import { SalesPurchaseService } from './purchase.service';
import { SalesReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import {
  SALES_PERMISSIONS,
  assertSalesOrderRead,
  assertSalesOrderWrite,
  assertSalesInventoryRead,
  assertSalesInventoryWrite,
  assertSalesReceiveWrite,
  assertSalesStocktakeWrite,
  assertSalesPaymentCollect,
  assertSalesPaymentRefund,
  assertSalesReportExport,
} from './sales.rbac';
import { redactReportCsvBody } from './sales-response-redact.util';
import { SalesSensitiveRedactInterceptor } from './sales-sensitive-redact.interceptor';
import {
  CreateCategoryDto,
  CreatePurchaseOrderDto,
  CreateSalesOrderDto,
  CreateSalesProductDto,
  CreateSalesReturnDto,
  CreateStocktakeDto,
  CreateSupplierDto,
  ProductLookupDto,
  PurchaseOrderQueryDto,
  ReceivePurchaseOrderDto,
  RecordSalesPaymentDto,
  ReconcileQueryDto,
  SalesOrderQueryDto,
  SalesProductQueryDto,
  SalesReportQueryDto,
  StockAdjustDto,
  StockBatchQueryDto,
  StockInboundDto,
  StockMovementQueryDto,
  StockOutboundDto,
  StocktakeQueryDto,
  SupplierQueryDto,
  UpdateSalesOrderDto,
  UpdateSalesOrderStatusDto,
  UpdateSalesProductDto,
  UpdateStocktakeLinesDto,
} from './dto/sales.dto';

@Controller('sales')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@UseInterceptors(SalesSensitiveRedactInterceptor)
export class SalesController {
  constructor(
    private readonly service: SalesService,
    private readonly inventory: InventoryService,
    private readonly stocktake: StocktakeService,
    private readonly payments: SalesPaymentService,
    private readonly returns: SalesReturnService,
    private readonly purchase: SalesPurchaseService,
    private readonly reports: SalesReportsService,
  ) {}

  @Get('reports/summary')
  @RequirePermissions(SALES_PERMISSIONS.read)
  async reportSummary(@CurrentUser() user: AuthUser, @Query() query: SalesReportQueryDto) {
    assertSalesOrderRead(user);
    return this.reports.summary(user.organizationId, query);
  }

  @Get('reports/export.csv')
  @RequirePermissions(SALES_PERMISSIONS.read)
  async reportCsv(
    @CurrentUser() user: AuthUser,
    @Query() query: SalesReportQueryDto,
    @Res() res: Response,
  ) {
    assertSalesOrderRead(user);
    assertSalesReportExport(user);
    const file = await this.reports.exportCsv(user.organizationId, query);
    const body = redactReportCsvBody(file.body, user);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(body);
  }

  @Get('orders')
  @RequirePermissions(SALES_PERMISSIONS.read)
  listOrders(@CurrentUser() user: AuthUser, @Query() query: SalesOrderQueryDto) {
    assertSalesOrderRead(user);
    return this.service.listOrders(user.organizationId, query);
  }

  @Get('orders/:id')
  @RequirePermissions(SALES_PERMISSIONS.read)
  getOrder(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    assertSalesOrderRead(user);
    return this.service.getOrder(user.organizationId, id);
  }

  @Post('orders')
  @RequirePermissions(SALES_PERMISSIONS.write)
  createOrder(@CurrentUser() user: AuthUser, @Body() dto: CreateSalesOrderDto) {
    assertSalesOrderWrite(user);
    return this.service.createOrder(user.organizationId, dto, user.id);
  }

  @Patch('orders/:id')
  @RequirePermissions(SALES_PERMISSIONS.write)
  updateOrder(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateSalesOrderDto,
  ) {
    assertSalesOrderWrite(user);
    return this.service.updateOrder(user.organizationId, id, dto, user.id);
  }

  @Post('orders/:id/status')
  @RequirePermissions(SALES_PERMISSIONS.write)
  updateStatus(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateSalesOrderStatusDto,
  ) {
    assertSalesOrderWrite(user);
    return this.service.updateStatus(user.organizationId, id, dto.status, user.id);
  }

  @Post('orders/:id/export')
  @RequirePermissions(SALES_PERMISSIONS.write)
  exportOrder(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    assertSalesInventoryWrite(user);
    return this.service.exportOrder(user.organizationId, id, user.id);
  }

  @Get('orders/:id/payments')
  @RequirePermissions(SALES_PERMISSIONS.read)
  listPayments(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    assertSalesOrderRead(user);
    return this.payments.list(user.organizationId, id);
  }

  @Post('orders/:id/payments')
  @RequirePermissions(SALES_PERMISSIONS.write)
  addPayment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RecordSalesPaymentDto,
  ) {
    assertSalesPaymentCollect(user);
    return this.payments.addPayment(user.organizationId, id, dto, user.id);
  }

  @Post('orders/:id/refunds')
  @RequirePermissions(SALES_PERMISSIONS.write)
  addRefund(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: RecordSalesPaymentDto,
  ) {
    assertSalesPaymentRefund(user);
    return this.payments.addRefund(user.organizationId, id, dto, user.id);
  }

  @Post('returns/preview')
  @RequirePermissions(SALES_PERMISSIONS.read)
  previewReturn(@CurrentUser() user: AuthUser, @Body() dto: CreateSalesReturnDto) {
    assertSalesOrderRead(user);
    return this.returns.preview(user.organizationId, dto);
  }

  @Post('returns')
  @RequirePermissions(SALES_PERMISSIONS.write)
  createReturn(@CurrentUser() user: AuthUser, @Body() dto: CreateSalesReturnDto) {
    assertSalesInventoryWrite(user);
    return this.returns.createAndConfirm(user.organizationId, dto, user.id);
  }

  @Get('returns')
  @RequirePermissions(SALES_PERMISSIONS.read)
  listReturns(@CurrentUser() user: AuthUser, @Query('orderId') orderId?: string) {
    assertSalesOrderRead(user);
    return this.returns.list(user.organizationId, orderId);
  }

  @Get('returns/:id')
  @RequirePermissions(SALES_PERMISSIONS.read)
  getReturn(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    assertSalesOrderRead(user);
    return this.returns.get(user.organizationId, id);
  }

  @Get('products/lookup')
  @RequirePermissions(SALES_PERMISSIONS.read)
  lookupProduct(@CurrentUser() user: AuthUser, @Query() query: ProductLookupDto) {
    assertSalesInventoryRead(user);
    return this.inventory.lookupProduct(user.organizationId, query.q);
  }

  @Get('products')
  @RequirePermissions(SALES_PERMISSIONS.read)
  async listProducts(@CurrentUser() user: AuthUser, @Query() query: SalesProductQueryDto) {
    assertSalesInventoryRead(user);
    return this.service.listProducts(user.organizationId, query);
  }

  @Post('products')
  @RequirePermissions(SALES_PERMISSIONS.write)
  createProduct(@CurrentUser() user: AuthUser, @Body() dto: CreateSalesProductDto) {
    assertSalesInventoryWrite(user);
    return this.service.createProduct(user.organizationId, dto, user.id);
  }
  @Get('products/:id')
  @RequirePermissions(SALES_PERMISSIONS.read)
  async getProduct(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    assertSalesInventoryRead(user);
    return this.service.getProduct(user.organizationId, id);
  }

  @Patch('products/:id')
  @RequirePermissions(SALES_PERMISSIONS.write)
  updateProduct(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateSalesProductDto,
  ) {
    assertSalesInventoryWrite(user);
    return this.service.updateProduct(user.organizationId, id, dto, user.id);
  }

  @Get('categories')
  @RequirePermissions(SALES_PERMISSIONS.read)
  listCategories(@CurrentUser() user: AuthUser) {
    assertSalesInventoryRead(user);
    return this.service.listCategories(user.organizationId);
  }

  @Post('categories')
  @RequirePermissions(SALES_PERMISSIONS.write)
  createCategory(@CurrentUser() user: AuthUser, @Body() dto: CreateCategoryDto) {
    assertSalesInventoryWrite(user);
    return this.service.createCategory(user.organizationId, dto.name);
  }

  @Get('suppliers')
  @RequirePermissions(SALES_PERMISSIONS.read)
  listSuppliers(@CurrentUser() user: AuthUser, @Query() query: SupplierQueryDto) {
    assertSalesInventoryRead(user);
    return this.purchase.listSuppliers(user.organizationId, query);
  }

  @Post('suppliers')
  @RequirePermissions(SALES_PERMISSIONS.write)
  createSupplier(@CurrentUser() user: AuthUser, @Body() dto: CreateSupplierDto) {
    assertSalesInventoryWrite(user);
    return this.purchase.createSupplier(user.organizationId, dto, user.id);
  }

  @Get('purchase-orders')
  @RequirePermissions(SALES_PERMISSIONS.read)
  listPos(@CurrentUser() user: AuthUser, @Query() query: PurchaseOrderQueryDto) {
    assertSalesInventoryRead(user);
    return this.purchase.listPurchaseOrders(user.organizationId, query);
  }

  @Get('purchase-orders/:id')
  @RequirePermissions(SALES_PERMISSIONS.read)
  getPo(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    assertSalesInventoryRead(user);
    return this.purchase.getPurchaseOrder(user.organizationId, id);
  }

  @Post('purchase-orders')
  @RequirePermissions(SALES_PERMISSIONS.write)
  createPo(@CurrentUser() user: AuthUser, @Body() dto: CreatePurchaseOrderDto) {
    assertSalesReceiveWrite(user);
    return this.purchase.createPurchaseOrder(user.organizationId, dto, user.id);
  }

  @Post('purchase-orders/:id/receive')
  @RequirePermissions(SALES_PERMISSIONS.write)
  receivePo(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReceivePurchaseOrderDto,
  ) {
    assertSalesReceiveWrite(user);
    return this.purchase.receiveGoods(user.organizationId, id, dto, user.id);
  }

  @Get('stock/batches')
  @RequirePermissions(SALES_PERMISSIONS.read)
  listBatches(@CurrentUser() user: AuthUser, @Query() query: StockBatchQueryDto) {
    assertSalesInventoryRead(user);
    return this.inventory.listBatches(user.organizationId, query);
  }

  @Get('stock/movements')
  @RequirePermissions(SALES_PERMISSIONS.read)
  listMovements(@CurrentUser() user: AuthUser, @Query() query: StockMovementQueryDto) {
    assertSalesInventoryRead(user);
    return this.inventory.listMovements(user.organizationId, {
      ...query,
      type: query.type as SalesStockMovementType | undefined,
    });
  }

  @Get('stock/alerts')
  @RequirePermissions(SALES_PERMISSIONS.read)
  alerts(@CurrentUser() user: AuthUser) {
    assertSalesInventoryRead(user);
    return this.inventory.getAlerts(user.organizationId);
  }

  @Get('stock/reconcile')
  @RequirePermissions(SALES_PERMISSIONS.read)
  reconcile(@CurrentUser() user: AuthUser, @Query() _query: ReconcileQueryDto) {
    assertSalesInventoryRead(user);
    return this.inventory.reconcile(user.organizationId, { fix: false });
  }

  @Post('stock/reconcile/fix')
  @RequirePermissions(SALES_PERMISSIONS.write)
  reconcileFix(@CurrentUser() user: AuthUser) {
    assertSalesInventoryWrite(user);
    return this.inventory.reconcile(user.organizationId, {
      fix: true,
      performedById: user.id,
    });
  }

  @Post('stock/inbound')
  @RequirePermissions(SALES_PERMISSIONS.write)
  inbound(@CurrentUser() user: AuthUser, @Body() dto: StockInboundDto) {
    assertSalesInventoryWrite(user);
    return this.inventory.inbound(user.organizationId, dto, user.id);
  }

  @Post('stock/outbound')
  @RequirePermissions(SALES_PERMISSIONS.write)
  outbound(@CurrentUser() user: AuthUser, @Body() dto: StockOutboundDto) {
    assertSalesInventoryWrite(user);
    return this.inventory.outbound(user.organizationId, dto, user.id);
  }

  @Post('stock/adjust')
  @RequirePermissions(SALES_PERMISSIONS.write)
  adjust(@CurrentUser() user: AuthUser, @Body() dto: StockAdjustDto) {
    assertSalesInventoryWrite(user);
    return this.inventory.adjust(user.organizationId, dto, user.id);
  }

  @Get('stocktakes')
  @RequirePermissions(SALES_PERMISSIONS.read)
  listStocktakes(@CurrentUser() user: AuthUser, @Query() query: StocktakeQueryDto) {
    assertSalesInventoryRead(user);
    return this.stocktake.list(user.organizationId, query);
  }

  @Get('stocktakes/:id')
  @RequirePermissions(SALES_PERMISSIONS.read)
  getStocktake(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    assertSalesInventoryRead(user);
    return this.stocktake.get(user.organizationId, id);
  }

  @Post('stocktakes')
  @RequirePermissions(SALES_PERMISSIONS.write)
  createStocktake(@CurrentUser() user: AuthUser, @Body() dto: CreateStocktakeDto) {
    assertSalesStocktakeWrite(user);
    return this.stocktake.create(user.organizationId, dto, user.id);
  }

  @Patch('stocktakes/:id/lines')
  @RequirePermissions(SALES_PERMISSIONS.write)
  updateStocktakeLines(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateStocktakeLinesDto,
  ) {
    assertSalesStocktakeWrite(user);
    return this.stocktake.updateLines(user.organizationId, id, dto.lines, user.id);
  }

  @Post('stocktakes/:id/confirm')
  @RequirePermissions(SALES_PERMISSIONS.write)
  confirmStocktake(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    assertSalesStocktakeWrite(user);
    return this.stocktake.confirm(user.organizationId, id, user.id);
  }

  @Post('stocktakes/:id/cancel')
  @RequirePermissions(SALES_PERMISSIONS.write)
  cancelStocktake(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    assertSalesStocktakeWrite(user);
    return this.stocktake.cancel(user.organizationId, id, user.id);
  }
}
