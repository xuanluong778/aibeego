import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Transform, Type, type TransformFnParams } from 'class-transformer';
import { SalesOrderStatus } from '@marketingspa/database';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class SalesOrderItemDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  productName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sku?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lineDiscount?: number;
}

export class CreateSalesOrderDto {
  @IsUUID()
  customerId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  customerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesOrderItemDto)
  items!: SalesOrderItemDto[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  shippingFee?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}

export class UpdateSalesOrderDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  customerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesOrderItemDto)
  items?: SalesOrderItemDto[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  shippingFee?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class UpdateSalesOrderStatusDto {
  @IsEnum(SalesOrderStatus)
  status!: SalesOrderStatus;
}

export class SalesOrderQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(SalesOrderStatus)
  status?: SalesOrderStatus;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

// Read the original input: implicit conversion must not turn blanks/booleans into 0
// or numeric identifiers into strings before validation.
const productText = ({ obj, key }: TransformFnParams) => {
  const raw = obj[key];
  return typeof raw === 'string' ? raw.trim() : raw;
};
const productNumber = ({ obj, key }: TransformFnParams) => {
  const raw = obj[key];
  if (raw === undefined || typeof raw === 'number') return raw;
  if (typeof raw === 'string' && /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw.trim()))
    return Number(raw);
  return Number.NaN;
};

export class CreateSalesProductDto {
  @IsOptional()
  @Transform(productText)
  @IsString()
  @MaxLength(120)
  model?: string;
  @Transform(productText)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @Transform(productText)
  @IsString()
  @MaxLength(64)
  sku?: string;

  @IsOptional()
  @Transform(productText)
  @IsString()
  @MaxLength(64)
  barcode?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Transform(productText)
  @IsString()
  @MaxLength(32)
  unit?: string;

  @IsOptional()
  @Transform(productNumber)
  @IsNumber()
  @Min(0)
  @Max(9999999999.99)
  price?: number;

  @IsOptional()
  @Transform(productNumber)
  @IsNumber()
  @Min(0)
  @Max(9999999999.99)
  costPrice?: number;

  /** Tồn đầu kỳ — tạo lô OPENING (chỉ lúc tạo) */
  @IsOptional()
  @Transform(productNumber)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  stockQty?: number;

  @IsOptional()
  @Transform(productNumber)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  minStockQty?: number;

  @IsOptional()
  @Transform(productText)
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class UpdateSalesProductDto {
  @IsOptional()
  @Transform(productText)
  @IsString()
  @MaxLength(120)
  model?: string;
  @ValidateIf((_, value) => value !== undefined)
  @Transform(productText)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @Transform(productText)
  @IsString()
  @MaxLength(64)
  sku?: string;

  @IsOptional()
  @Transform(productText)
  @IsString()
  @MaxLength(64)
  barcode?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;

  @IsOptional()
  @Transform(productText)
  @IsString()
  @MaxLength(32)
  unit?: string;

  @IsOptional()
  @Transform(productNumber)
  @IsNumber()
  @Min(0)
  @Max(9999999999.99)
  price?: number;

  @IsOptional()
  @Transform(productNumber)
  @IsNumber()
  @Min(0)
  @Max(9999999999.99)
  costPrice?: number;

  @IsOptional()
  @Transform(productNumber)
  @IsInt()
  @Min(0)
  @Max(2147483647)
  minStockQty?: number;

  @ValidateIf((_, value) => value !== undefined)
  @Transform(({ obj, key }) => obj[key])
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(productText)
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class SalesProductQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsString()
  active?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;
}

export class CreateCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;
}

export class StockInboundDto {
  @IsUUID()
  productId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  batchCode!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  importedAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class StockOutboundDto {
  @IsUUID()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class StockAdjustDto {
  @IsUUID()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  delta!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class StockBatchQueryDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsString()
  includeExpired?: string;
}

export class StockMovementQueryDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsString()
  type?: string;
}

export class ProductLookupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  q!: string;
}

export class CreateStocktakeDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  productIds?: string[];
}

export class StocktakeLineUpdateDto {
  @IsUUID()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  countedQty!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateStocktakeLinesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StocktakeLineUpdateDto)
  lines!: StocktakeLineUpdateDto[];
}

export class StocktakeQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  status?: string;
}

export class ReconcileQueryDto {
  @IsOptional()
  @IsString()
  fix?: string;
}

export class RecordSalesPaymentDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  method?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  transactionRef?: string;

  @IsOptional()
  @IsString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  idempotencyKey!: string;
}

export class CreateSalesReturnDto {
  @IsUUID()
  orderId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  /** RESTOCK nhập lại kho bán; HOLD/SCRAP chỉ ghi nhận trả, không cộng tồn bán. */
  @IsOptional()
  @IsIn(['RESTOCK', 'HOLD', 'SCRAP'])
  disposition?: 'RESTOCK' | 'HOLD' | 'SCRAP';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  refundAmount?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSalesReturnItemDto)
  items!: CreateSalesReturnItemDto[];
}

export class CreateSalesReturnItemDto {
  @IsUUID()
  orderItemId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  refundAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CreateSupplierDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  taxCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CreatePurchaseOrderDto {
  @IsUUID()
  supplierId!: string;

  @IsOptional()
  @IsString()
  expectedDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items!: PurchaseOrderItemDto[];
}

export class PurchaseOrderItemDto {
  @IsUUID()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost!: number;
}

export class ReceivePurchaseOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceivePurchaseOrderItemDto)
  items!: ReceivePurchaseOrderItemDto[];

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  idempotencyKey!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class ReceivePurchaseOrderItemDto {
  @IsOptional()
  @IsUUID()
  purchaseOrderItemId?: string;

  @IsOptional()
  @IsUUID()
  productId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  batchCode?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;
}

export class SalesReportQueryDto {
  @IsOptional()
  @IsString()
  preset?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}

export class PurchaseOrderQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  status?: string;
}

export class SupplierQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  search?: string;
}
