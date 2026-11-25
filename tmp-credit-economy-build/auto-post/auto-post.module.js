"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoPostModule = void 0;
const common_1 = require("@nestjs/common");
const auto_post_controller_1 = require("./auto-post.controller");
const auto_post_service_1 = require("./auto-post.service");
const auto_post_facebook_service_1 = require("./auto-post-facebook.service");
const auto_post_meta_service_1 = require("./auto-post-meta.service");
const auto_post_meta_compliance_service_1 = require("./auto-post-meta-compliance.service");
const auto_post_facebook_page_details_service_1 = require("./auto-post-facebook-page-details.service");
const meta_graph_usage_service_1 = require("./meta-graph-usage.service");
const meta_graph_metrics_service_1 = require("./meta-graph-metrics.service");
const meta_fanpage_module_1 = require("../meta-fanpage/meta-fanpage.module");
const messaging_module_1 = require("../messaging/messaging.module");
const chatbot_cskh_module_1 = require("../chatbot-cskh/chatbot-cskh.module");
let AutoPostModule = class AutoPostModule {
};
exports.AutoPostModule = AutoPostModule;
exports.AutoPostModule = AutoPostModule = __decorate([
    (0, common_1.Module)({
        imports: [meta_fanpage_module_1.MetaFanpageModule, messaging_module_1.MessagingModule, (0, common_1.forwardRef)(() => chatbot_cskh_module_1.ChatbotCskhModule)],
        controllers: [auto_post_controller_1.AutoPostController],
        providers: [
            auto_post_service_1.AutoPostService,
            auto_post_facebook_service_1.AutoPostFacebookService,
            auto_post_meta_service_1.AutoPostMetaService,
            auto_post_meta_compliance_service_1.AutoPostMetaComplianceService,
            auto_post_facebook_page_details_service_1.AutoPostFacebookPageDetailsService,
            meta_graph_usage_service_1.MetaGraphUsageService,
            meta_graph_metrics_service_1.MetaGraphMetricsService,
        ],
        exports: [auto_post_service_1.AutoPostService, auto_post_facebook_service_1.AutoPostFacebookService, auto_post_meta_compliance_service_1.AutoPostMetaComplianceService],
    })
], AutoPostModule);
