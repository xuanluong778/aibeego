"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiAdsManagerModule = void 0;
const common_1 = require("@nestjs/common");
const ai_ads_manager_controller_1 = require("./ai-ads-manager.controller");
const ai_ads_manager_service_1 = require("./ai-ads-manager.service");
const google_ads_campaign_builder_service_1 = require("./google-ads-campaign-builder.service");
const google_ads_autopilot_service_1 = require("./google-ads-autopilot.service");
const google_ads_optimization_service_1 = require("./google-ads-optimization.service");
const ad_performance_module_1 = require("../ad-performance/ad-performance.module");
const openai_module_1 = require("../openai/openai.module");
const ads_mcp_module_1 = require("../ads-mcp/ads-mcp.module");
const ads_actions_module_1 = require("../ads-actions/ads-actions.module");
let AiAdsManagerModule = class AiAdsManagerModule {
};
exports.AiAdsManagerModule = AiAdsManagerModule;
exports.AiAdsManagerModule = AiAdsManagerModule = __decorate([
    (0, common_1.Module)({
        imports: [ad_performance_module_1.AdPerformanceModule, openai_module_1.OpenAiModule, ads_mcp_module_1.AdsMcpModule, ads_actions_module_1.AdsActionsModule],
        controllers: [ai_ads_manager_controller_1.AiAdsManagerController],
        providers: [
            ai_ads_manager_service_1.AiAdsManagerService,
            google_ads_campaign_builder_service_1.GoogleAdsCampaignBuilderService,
            google_ads_autopilot_service_1.GoogleAdsAutopilotService,
            google_ads_optimization_service_1.GoogleAdsOptimizationService,
        ],
        exports: [ai_ads_manager_service_1.AiAdsManagerService],
    })
], AiAdsManagerModule);
