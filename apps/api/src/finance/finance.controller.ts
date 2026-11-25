import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { FINANCE_PERMISSIONS, assertFinanceExpenseManage, assertFinanceOrderManage, assertFinancePaymentRecord, assertFinancePaymentRefund, assertFinanceRead } from './finance.rbac';
import {
  CreateOrderDto,
  CreatePaymentDto,
  CreateExpenseDto,
  UpdateExpenseDto,
  FinanceQueryDto,
  DashboardQueryDto,
} from './dto/finance.dto';

@Controller('finance')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class FinanceController {
  constructor(private readonly service: FinanceService) {}

  @Get('dashboard')
  @RequirePermissions(FINANCE_PERMISSIONS.read)
  dashboard(@CurrentUser() user: AuthUser, @Query() query: DashboardQueryDto) {
    assertFinanceRead(user);
    return this.service.getDashboard(user.organizationId, query);
  }

  @Get('orders')
  @RequirePermissions(FINANCE_PERMISSIONS.read)
  listOrders(@CurrentUser() user: AuthUser, @Query() query: FinanceQueryDto) {
    assertFinanceRead(user);
    return this.service.listOrders(user.organizationId, query);
  }

  @Post('orders')
  @RequirePermissions(FINANCE_PERMISSIONS.orderManage)
  createOrder(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    assertFinanceOrderManage(user);
    return this.service.createOrder(user.organizationId, dto, user.id);
  }

  @Post('orders/:id/cancel')
  @RequirePermissions(FINANCE_PERMISSIONS.orderManage)
  cancelOrder(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    assertFinanceOrderManage(user);
    return this.service.cancelOrder(user.organizationId, id, user.id);
  }

  @Get('payments')
  @RequirePermissions(FINANCE_PERMISSIONS.read)
  listPayments(@CurrentUser() user: AuthUser, @Query() query: FinanceQueryDto) {
    assertFinanceRead(user);
    return this.service.listPayments(user.organizationId, query);
  }

  @Post('payments')
  @RequirePermissions(FINANCE_PERMISSIONS.paymentRecord)
  createPayment(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentDto) {
    assertFinancePaymentRecord(user);
    return this.service.createPayment(user.organizationId, dto, user.id);
  }

  @Post('payments/:id/refund')
  @RequirePermissions(FINANCE_PERMISSIONS.paymentRefund)
  refundPayment(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    assertFinancePaymentRefund(user);
    return this.service.refundPayment(user.organizationId, id, user.id);
  }

  @Get('expenses')
  @RequirePermissions(FINANCE_PERMISSIONS.read)
  listExpenses(@CurrentUser() user: AuthUser, @Query() query: FinanceQueryDto) {
    assertFinanceRead(user);
    return this.service.listExpenses(user.organizationId, query);
  }

  @Post('expenses')
  @RequirePermissions(FINANCE_PERMISSIONS.expenseManage)
  createExpense(@CurrentUser() user: AuthUser, @Body() dto: CreateExpenseDto) {
    assertFinanceExpenseManage(user);
    return this.service.createExpense(user.organizationId, dto);
  }

  @Patch('expenses/:id')
  @RequirePermissions(FINANCE_PERMISSIONS.expenseManage)
  updateExpense(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    assertFinanceExpenseManage(user);
    return this.service.updateExpense(user.organizationId, id, dto);
  }

  @Delete('expenses/:id')
  @RequirePermissions(FINANCE_PERMISSIONS.expenseManage)
  removeExpense(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    assertFinanceExpenseManage(user);
    return this.service.removeExpense(user.organizationId, id);
  }
}
