"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LandingPagesModule = void 0;
const landing_page_chatbot_notification_service_1 = require("./landing-page-chatbot-notification.service");
const common_1 = require("@nestjs/common");
const landing_pages_controller_1 = require("./landing-pages.controller");
const landing_pages_public_controller_1 = require("./landing-pages-public.controller");
const landing_pages_service_1 = require("./landing-pages.service");
const landing_page_template_pack_service_1 = require("./landing-page-template-pack.service");
const landing_page_ai_service_1 = require("./landing-page-ai.service");
const leads_module_1 = require("../leads/leads.module");
const crm_module_1 = require("../crm/crm.module");
const chatbot_cskh_module_1 = require("../chatbot-cskh/chatbot-cskh.module");
const openai_module_1 = require("../openai/openai.module");
const events_module_1 = require("../events/events.module");
const landing_page_chatbot_service_1 = require("./landing-page-chatbot.service");
let LandingPagesModule = class LandingPagesModule {
};
exports.LandingPagesModule = LandingPagesModule;
exports.LandingPagesModule = LandingPagesModule = __decorate([
    (0, common_1.Module)({
        imports: [leads_module_1.LeadsModule, crm_module_1.CrmModule, chatbot_cskh_module_1.ChatbotCskhModule, openai_module_1.OpenAiModule, events_module_1.EventsModule],
        controllers: [landing_pages_controller_1.LandingPagesController, landing_pages_public_controller_1.LandingPagesPublicController],
        providers: [
            landing_pages_service_1.LandingPagesService,
            landing_page_ai_service_1.LandingPageAiService,
            landing_page_template_pack_service_1.LandingPageTemplatePackService,
            landing_page_chatbot_service_1.LandingPageChatbotService,
            landing_page_chatbot_notification_service_1.LandingPageChatbotNotificationService,
        ],
        exports: [landing_pages_service_1.LandingPagesService, landing_page_ai_service_1.LandingPageAiService],
    })
], LandingPagesModule);
