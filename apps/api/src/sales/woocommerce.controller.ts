import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { SalesSensitiveRedactInterceptor } from './sales-sensitive-redact.interceptor';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { assertSalesInventoryWrite, SALES_PERMISSIONS } from './sales.rbac';
import {
  WooBrowseDto,
  WooCategoryUrlDto,
  WooConnectionDto,
  WooDraftDto,
} from './dto/woocommerce.dto';
import { WooCommerceService } from './woocommerce.service';

@Controller('sales/woocommerce')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@RequirePermissions(SALES_PERMISSIONS.inventoryWrite)
@UseInterceptors(SalesSensitiveRedactInterceptor)
export class WooCommerceController {
  constructor(private readonly woo: WooCommerceService) {}
  @Get() list(@CurrentUser() user: AuthUser) {
    assertSalesInventoryWrite(user);
    return this.woo.list(user.organizationId);
  }
  @Post() connect(@CurrentUser() user: AuthUser, @Body() dto: WooConnectionDto) {
    assertSalesInventoryWrite(user);
    return this.woo.connect(user.organizationId, dto);
  }
  @Get(':id/categories') categories(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    assertSalesInventoryWrite(user);
    return this.woo.categories(user.organizationId, id);
  }
  @Post(':id/category-url') resolve(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WooCategoryUrlDto,
  ) {
    assertSalesInventoryWrite(user);
    return this.woo.resolveCategory(user.organizationId, id, dto.url);
  }
  @Get(':id/products') products(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: WooBrowseDto,
  ) {
    assertSalesInventoryWrite(user);
    return this.woo.browse(user.organizationId, id, dto.page, dto.categoryId);
  }
  @Post(':id/import') draft(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WooDraftDto,
  ) {
    assertSalesInventoryWrite(user);
    return this.woo.draft(user.organizationId, id, user.id, dto);
  }
}
