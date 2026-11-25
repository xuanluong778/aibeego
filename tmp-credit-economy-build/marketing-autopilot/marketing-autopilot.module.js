"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketingAutopilotModule = void 0;
const common_1 = require("@nestjs/common");
const marketing_autopilot_controller_1 = require("./marketing-autopilot.controller");
const marketing_autopilot_service_1 = require("./marketing-autopilot.service");
const marketing_autopilot_content_draft_service_1 = require("./marketing-autopilot-content-draft.service");
const marketing_autopilot_draft_adapter_1 = require("./marketing-autopilot-draft.adapter");
const marketing_autopilot_planner_service_1 = require("./marketing-autopilot-planner.service");
const marketing_autopilot_autofill_service_1 = require("./marketing-autopilot-autofill.service");
const marketing_context_engine_service_1 = require("./context/marketing-context-engine.service");
const marketing_context_cache_service_1 = require("./context/marketing-context-cache.service");
const marketing_context_datasources_service_1 = require("./context/marketing-context-datasources.service");
const marketing_autopilot_outcome_learning_service_1 = require("./outcome/marketing-autopilot-outcome-learning.service");
const marketing_autopilot_outcome_loop_service_1 = require("./outcome/marketing-autopilot-outcome-loop.service");
const marketing_mission_orchestrator_service_1 = require("./orchestrator/marketing-mission-orchestrator.service");
const marketing_autopilot_executor_service_1 = require("./orchestrator/marketing-autopilot-executor.service");
const marketing_autopilot_execution_engine_service_1 = require("./orchestrator/marketing-autopilot-execution-engine.service");
const content_marketing_module_1 = require("../content-marketing/content-marketing.module");
const automation_module_1 = require("../automation/automation.module");
const messaging_campaign_module_1 = require("../messaging-campaign/messaging-campaign.module");
const auto_post_module_1 = require("../auto-post/auto-post.module");
const chatbot_cskh_module_1 = require("../chatbot-cskh/chatbot-cskh.module");
const ai_ads_manager_module_1 = require("../ai-ads-manager/ai-ads-manager.module");
const domain_stubs_1 = require("./compat/domain-stubs");
let MarketingAutopilotModule = class MarketingAutopilotModule {
};
exports.MarketingAutopilotModule = MarketingAutopilotModule;
exports.MarketingAutopilotModule = MarketingAutopilotModule = __decorate([
    (0, common_1.Module)({
        imports: [
            content_marketing_module_1.ContentMarketingModule,
            automation_module_1.AutomationModule,
            messaging_campaign_module_1.MessagingCampaignModule,
            auto_post_module_1.AutoPostModule,
            chatbot_cskh_module_1.ChatbotCskhModule,
            ai_ads_manager_module_1.AiAdsManagerModule,
        ],
        controllers: [marketing_autopilot_controller_1.MarketingAutopilotController],
        providers: [
            marketing_autopilot_service_1.MarketingAutopilotService,
            marketing_autopilot_draft_adapter_1.MarketingAutopilotDraftAdapter,
            marketing_autopilot_content_draft_service_1.MarketingAutopilotContentDraftService,
            marketing_autopilot_planner_service_1.MarketingAutopilotPlannerService,
            marketing_autopilot_autofill_service_1.MarketingAutopilotAutofillService,
            marketing_context_engine_service_1.MarketingContextEngineService,
            marketing_context_cache_service_1.MarketingContextCacheService,
            marketing_context_datasources_service_1.MarketingContextDatasourcesService,
            marketing_autopilot_outcome_learning_service_1.MarketingAutopilotOutcomeLearningService,
            marketing_autopilot_outcome_loop_service_1.MarketingAutopilotOutcomeLoopService,
            marketing_autopilot_executor_service_1.MarketingAutopilotExecutorService,
            marketing_autopilot_execution_engine_service_1.MarketingAutopilotExecutionEngineService,
            marketing_mission_orchestrator_service_1.MarketingMissionOrchestratorService,
            domain_stubs_1.FunnelBuilderService,
            domain_stubs_1.FunnelGeneratorService,
            domain_stubs_1.FunnelLifecycleService,
            domain_stubs_1.EmailMarketingService,
            domain_stubs_1.LeadScoringService,
        ],
        exports: [
            marketing_autopilot_outcome_learning_service_1.MarketingAutopilotOutcomeLearningService,
            marketing_autopilot_outcome_loop_service_1.MarketingAutopilotOutcomeLoopService,
            marketing_mission_orchestrator_service_1.MarketingMissionOrchestratorService,
            marketing_autopilot_execution_engine_service_1.MarketingAutopilotExecutionEngineService,
        ],
    })
], MarketingAutopilotModule);
