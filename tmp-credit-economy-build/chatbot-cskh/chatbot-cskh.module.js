"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatbotCskhModule = void 0;
const common_1 = require("@nestjs/common");
const chatbot_cskh_controller_1 = require("./chatbot-cskh.controller");
const chatbot_cskh_public_controller_1 = require("./chatbot-cskh-public.controller");
const chatbot_facebook_webhook_controller_1 = require("./chatbot-facebook-webhook.controller");
const chatbot_cskh_service_1 = require("./chatbot-cskh.service");
const chatbot_cskh_public_service_1 = require("./chatbot-cskh-public.service");
const chatbot_suggest_service_1 = require("./chatbot-suggest.service");
const chatbot_facebook_webhook_service_1 = require("./chatbot-facebook-webhook.service");
const events_module_1 = require("../events/events.module");
const attribution_module_1 = require("../attribution/attribution.module");
const leads_module_1 = require("../leads/leads.module");
const messaging_module_1 = require("../messaging/messaging.module");
const rag_kb_module_1 = require("../rag-kb/rag-kb.module");
const chatbot_zalo_knowledge_service_1 = require("./chatbot-zalo-knowledge.service");
let ChatbotCskhModule = class ChatbotCskhModule {
};
exports.ChatbotCskhModule = ChatbotCskhModule;
exports.ChatbotCskhModule = ChatbotCskhModule = __decorate([
    (0, common_1.Module)({
        imports: [events_module_1.EventsModule, attribution_module_1.AttributionModule, leads_module_1.LeadsModule, messaging_module_1.MessagingModule, rag_kb_module_1.RagKbModule],
        controllers: [
            chatbot_cskh_controller_1.ChatbotCskhController,
            chatbot_cskh_public_controller_1.ChatbotCskhPublicController,
            chatbot_facebook_webhook_controller_1.ChatbotFacebookWebhookController,
        ],
        providers: [
            chatbot_zalo_knowledge_service_1.ChatbotZaloKnowledgeService,
            chatbot_cskh_service_1.ChatbotCskhService,
            chatbot_cskh_public_service_1.ChatbotCskhPublicService,
            chatbot_suggest_service_1.ChatbotSuggestService,
            chatbot_facebook_webhook_service_1.ChatbotFacebookWebhookService,
        ],
        exports: [chatbot_cskh_service_1.ChatbotCskhService, chatbot_facebook_webhook_service_1.ChatbotFacebookWebhookService],
    })
], ChatbotCskhModule);
