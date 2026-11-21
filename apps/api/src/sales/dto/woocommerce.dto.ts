import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class WooConnectionDto {
  @IsString() @MaxLength(2000) websiteUrl!: string;
  @Matches(/^ck_[a-f0-9]{40}$/) consumerKey!: string;
  @Matches(/^cs_[a-f0-9]{40}$/) consumerSecret!: string;
}
export class WooBrowseDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) categoryId?: number;
}
export class WooCategoryUrlDto {
  @IsString() @MaxLength(2000) url!: string;
}
export class WooDraftDto {
  @IsUUID() clientToken!: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  productIds!: number[];
}
