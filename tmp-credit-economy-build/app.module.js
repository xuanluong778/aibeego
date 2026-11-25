"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const env_paths_1 = require("./config/env-paths");
const common_module_1 = require("./common/common.module");
const prisma_module_1 = require("./prisma/prisma.module");
const redis_module_1 = require("./redis/redis.module");
const queue_module_1 = require("./queue/queue.module");
const health_module_1 = require("./health/health.module");
const auth_module_1 = require("./auth/auth.module");
const events_module_1 = require("./events/events.module");
const organizations_module_1 = require("./organizations/organizations.module");
const employees_module_1 = require("./employees/employees.module");
const hrm_module_1 = require("./hrm/hrm.module");
const work_management_module_1 = require("./work-management/work-management.module");
const customers_module_1 = require("./customers/customers.module");
const leads_module_1 = require("./leads/leads.module");
const appointments_module_1 = require("./appointments/appointments.module");
const finance_module_1 = require("./finance/finance.module");
const marketing_module_1 = require("./marketing/marketing.module");
const automation_module_1 = require("./automation/automation.module");
const audit_module_1 = require("./audit/audit.module");
const integrations_module_1 = require("./integrations/integrations.module");
const business_goals_module_1 = require("./business-goals/business-goals.module");
const chatbot_cskh_module_1 = require("./chatbot-cskh/chatbot-cskh.module");
const openai_module_1 = require("./openai/openai.module");
const ad_performance_module_1 = require("./ad-performance/ad-performance.module");
const content_marketing_module_1 = require("./content-marketing/content-marketing.module");
const ai_ads_manager_module_1 = require("./ai-ads-manager/ai-ads-manager.module");
const ads_mcp_module_1 = require("./ads-mcp/ads-mcp.module");
const ads_actions_module_1 = require("./ads-actions/ads-actions.module");
const auto_post_module_1 = require("./auto-post/auto-post.module");
const meta_fanpage_module_1 = require("./meta-fanpage/meta-fanpage.module");
const rag_kb_module_1 = require("./rag-kb/rag-kb.module");
const attribution_module_1 = require("./attribution/attribution.module");
const crm_module_1 = require("./crm/crm.module");
const messaging_identity_module_1 = require("./messaging-identity/messaging-identity.module");
const messaging_module_1 = require("./messaging/messaging.module");
const messaging_campaign_module_1 = require("./messaging-campaign/messaging-campaign.module");
const billing_module_1 = require("./billing/billing.module");
const credit_module_1 = require("./credit/credit.module");
const platform_admin_module_1 = require("./platform-admin/platform-admin.module");
const affiliate_module_1 = require("./affiliate/affiliate.module");
const video_transcription_module_1 = require("./video-transcription/video-transcription.module");
const marketing_autopilot_module_1 = require("./marketing-autopilot/marketing-autopilot.module");
const funnel_builder_module_1 = require("./funnel-builder/funnel-builder.module");
const landing_pages_module_1 = require("./landing-pages/landing-pages.module");
const email_marketing_module_1 = require("./email-marketing/email-marketing.module");
const zalo_marketing_module_1 = require("./zalo-marketing/zalo-marketing.module");
const zalo_module_1 = require("./zalo/zalo.module");
const sales_module_1 = require("./sales/sales.module");
const assistant_module_1 = require("./assistant/assistant.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: (0, env_paths_1.resolveEnvFilePaths)(),
            }),
            common_module_1.CommonModule,
            openai_module_1.OpenAiModule,
            audit_module_1.AuditModule,
            prisma_module_1.PrismaModule,
            redis_module_1.RedisModule,
            queue_module_1.QueueModule,
            health_module_1.HealthModule,
            auth_module_1.AuthModule,
            events_module_1.EventsModule,
            organizations_module_1.OrganizationsModule,
            employees_module_1.EmployeesModule,
            hrm_module_1.HrmModule,
            work_management_module_1.WorkManagementModule,
            customers_module_1.CustomersModule,
            leads_module_1.LeadsModule,
            appointments_module_1.AppointmentsModule,
            finance_module_1.FinanceModule,
            marketing_module_1.MarketingModule,
            automation_module_1.AutomationModule,
            integrations_module_1.IntegrationsModule,
            business_goals_module_1.BusinessGoalsModule,
            chatbot_cskh_module_1.ChatbotCskhModule,
            ad_performance_module_1.AdPerformanceModule,
            ads_mcp_module_1.AdsMcpModule,
            ads_actions_module_1.AdsActionsModule,
            content_marketing_module_1.ContentMarketingModule,
            ai_ads_manager_module_1.AiAdsManagerModule,
            auto_post_module_1.AutoPostModule,
            meta_fanpage_module_1.MetaFanpageModule,
            rag_kb_module_1.RagKbModule,
            attribution_module_1.AttributionModule,
            crm_module_1.CrmModule,
            funnel_builder_module_1.FunnelBuilderModule,
            landing_pages_module_1.LandingPagesModule,
            messaging_identity_module_1.MessagingIdentityModule,
            messaging_module_1.MessagingModule,
            messaging_campaign_module_1.MessagingCampaignModule,
            email_marketing_module_1.EmailMarketingModule,
            zalo_marketing_module_1.ZaloMarketingModule,
            zalo_module_1.ZaloModule,
            sales_module_1.SalesModule,
            assistant_module_1.AssistantModule,
            marketing_autopilot_module_1.MarketingAutopilotModule,
            credit_module_1.CreditModule,
            billing_module_1.BillingModule,
            platform_admin_module_1.PlatformAdminModule,
            affiliate_module_1.AffiliateModule,
            video_transcription_module_1.VideoTranscriptionModule,
        ],
    })
], AppModule);
