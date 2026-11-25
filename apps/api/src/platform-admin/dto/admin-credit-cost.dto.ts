import { Type } from 'class-transformer';
import { IsDateString, IsInt, Max, Min } from 'class-validator';

export class AdminUpdateCreditCostDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  creditCost!: number;

  @IsDateString()
  expectedUpdatedAt!: string;
}
