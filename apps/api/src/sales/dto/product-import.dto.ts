import { Transform } from 'class-transformer';
import { IsInt, IsObject, IsOptional, IsUUID, IsIn, Min, Max } from 'class-validator';

export class ProductImportUploadDto {
  @IsUUID() clientToken!: string;
  @IsOptional() @IsIn(['auto', ',', ';']) delimiter?: 'auto' | ',' | ';';
}
export class ProductImportPreviewDto {
  @Transform(({ obj, key }) => obj[key]) @IsInt() @Min(0) @Max(9) sheetIndex!: number;
  @IsObject() mapping!: Record<string, number>;
  @IsObject() options!: {
    mode: 'skip' | 'update';
    createCategories: boolean;
    updateFields: string[];
  };
}
export class ProductImportConfirmDto {
  @Transform(({ obj, key }) => obj[key]) @IsInt() @Min(1) previewVersion!: number;
}
