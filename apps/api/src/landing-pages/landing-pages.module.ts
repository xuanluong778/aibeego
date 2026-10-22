import { Module } from '@nestjs/common';
import { LandingPagesController } from './landing-pages.controller';
import { LandingPagesPublicController } from './landing-pages-public.controller';
import { LandingPagesService } from './landing-pages.service';
import { LandingPageAiService } from './landing-page-ai.service';
import { LeadsModule } from '../leads/leads.module';
import { CrmModule } from '../crm/crm.module';

@Module({
  imports: [LeadsModule, CrmModule],
  controllers: [LandingPagesController, LandingPagesPublicController],
  providers: [LandingPagesService, LandingPageAiService],
  exports: [LandingPagesService, LandingPageAiService],
})
export class LandingPagesModule {}
