import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { AdminUpdateCreditCostDto } from './dto/admin-credit-cost.dto';
import { CreditCostsAdminService } from './credit-costs-admin.service';

@Controller('admin/credit-costs')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class CreditCostsAdminController {
  constructor(private readonly costs: CreditCostsAdminService) {}

  @Get()
  list() { return this.costs.list(); }

  @Patch(':featureCode')
  update(@CurrentUser() user: AuthUser, @Param('featureCode') code: string,
    @Body() dto: AdminUpdateCreditCostDto, @ClientIp() ip?: string) {
    return this.costs.update(user, code, dto, ip);
  }
}
