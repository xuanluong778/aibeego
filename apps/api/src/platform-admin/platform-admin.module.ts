import { Module } from '@nestjs/common';
import { PlatformAdminController } from './platform-admin.controller';
import { PlatformAdminService } from './platform-admin.service';
import { PlatformAdminOpsService } from './platform-admin-ops.service';
import { CreditCostsAdminController } from './credit-costs-admin.controller';
import { CreditCostsAdminService } from './credit-costs-admin.service';

@Module({
  controllers: [PlatformAdminController, CreditCostsAdminController],
  providers: [PlatformAdminService, PlatformAdminOpsService, CreditCostsAdminService],
})
export class PlatformAdminModule {}
