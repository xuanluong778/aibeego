import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { createUploadMulterOptions } from '../common/uploads/upload-policy';
import { PaginationDto } from '../common/dto/pagination.dto';
import { assertSalesInventoryWrite, SALES_PERMISSIONS } from './sales.rbac';
import { ProductImportService } from './product-import.service';
import {
  ProductImportConfirmDto,
  ProductImportPreviewDto,
  ProductImportUploadDto,
} from './dto/product-import.dto';
import { IMPORT_LIMITS, productImportTemplate } from './product-spreadsheet.util';
import { SalesSensitiveRedactInterceptor } from './sales-sensitive-redact.interceptor';

@Controller('sales/product-imports')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@RequirePermissions(SALES_PERMISSIONS.inventoryWrite)
@UseInterceptors(SalesSensitiveRedactInterceptor)
export class ProductImportController {
  constructor(private readonly imports: ProductImportService) {}

  @Get('template')
  async template(
    @CurrentUser() user: AuthUser,
    @Query('format') format = 'xlsx',
    @Res() res: Response,
  ) {
    assertSalesInventoryWrite(user);
    if (!['csv', 'xlsx'].includes(format))
      throw new BadRequestException('Chọn mẫu .csv hoặc .xlsx.');
    const body = await productImportTemplate(format as 'csv' | 'xlsx');
    res.setHeader(
      'Content-Type',
      format === 'csv'
        ? 'text/csv; charset=utf-8'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="sales-products-template.${format}"`,
    );
    res.send(body);
  }
  @Get()
  history(@CurrentUser() user: AuthUser, @Query() query: PaginationDto) {
    assertSalesInventoryWrite(user);
    return this.imports.history(user.organizationId, query);
  }
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      ...createUploadMulterOptions('spreadsheet'),
      limits: { fileSize: IMPORT_LIMITS.bytes, files: 1, fields: 0, parts: 2 },
    }),
  )
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query() query: ProductImportUploadDto,
  ) {
    assertSalesInventoryWrite(user);
    return this.imports.upload(
      user.organizationId,
      user.id,
      file,
      query.clientToken,
      query.delimiter,
    );
  }
  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    assertSalesInventoryWrite(user);
    return this.imports.get(user.organizationId, id);
  }
  @Get(':id/rows')
  rows(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationDto,
  ) {
    assertSalesInventoryWrite(user);
    return this.imports.rows(user.organizationId, id, query);
  }
  @Get(':id/report.csv')
  async report(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    assertSalesInventoryWrite(user);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="sales-import-${id}.csv"`);
    res.send(await this.imports.report(user.organizationId, id));
  }
  @Post(':id/preview')
  preview(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProductImportPreviewDto,
  ) {
    assertSalesInventoryWrite(user);
    return this.imports.preview(user.organizationId, id, dto);
  }
  @Post(':id/confirm')
  confirm(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProductImportConfirmDto,
  ) {
    assertSalesInventoryWrite(user);
    return this.imports.confirm(user.organizationId, id, dto.previewVersion);
  }
  @Post(':id/process')
  process(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    assertSalesInventoryWrite(user);
    return this.imports.process(user.organizationId, id, user.id);
  }
  @Post(':id/retry')
  retry(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    assertSalesInventoryWrite(user);
    return this.imports.retry(user.organizationId, id);
  }
}
