import { LandingPageChatbotNotificationService } from './landing-page-chatbot-notification.service';
import { Module } from '@nestjs/common';
import { LandingPagesController } from './landing-pages.controller';
import { LandingPagesPublicController } from './landing-pages-public.controller';
import { LandingPagesService } from './landing-pages.service';
import { LandingPageTemplatePackService } from './landing-page-template-pack.service';
import { LandingPageAiService } from './landing-page-ai.service';
import { LeadsModule } from '../leads/leads.module';
import { CrmModule } from '../crm/crm.module';
import { ChatbotCskhModule } from '../chatbot-cskh/chatbot-cskh.module';
import { OpenAiModule } from '../openai/openai.module';
import { EventsModule } from '../events/events.module';
import { LandingPageChatbotService } from './landing-page-chatbot.service';
import { LandingPagePublicCacheService } from './landing-page-public-cache.service';

@Module({
  imports: [LeadsModule, CrmModule, ChatbotCskhModule, OpenAiModule, EventsModule],
  controllers: [LandingPagesController, LandingPagesPublicController],
  providers: [
    LandingPagesService,
    LandingPageAiService,
    LandingPageTemplatePackService,
    LandingPageChatbotService,
    LandingPageChatbotNotificationService,
    LandingPagePublicCacheService,
  ],
  exports: [LandingPagesService, LandingPageAiService],
})
export class LandingPagesModule {}
