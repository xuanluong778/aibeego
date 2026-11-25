"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailMarketingModule = void 0;
const common_1 = require("@nestjs/common");
const email_marketing_controller_1 = require("./email-marketing.controller");
const email_marketing_public_controller_1 = require("./email-marketing-public.controller");
const email_marketing_service_1 = require("./email-marketing.service");
const email_marketing_queue_service_1 = require("./email-marketing-queue.service");
const email_router_service_1 = require("../email/email-router.service");
const brevo_webhook_service_1 = require("./brevo-webhook.service");
const brevo_webhook_controller_1 = require("../webhooks/brevo-webhook.controller");
let EmailMarketingModule = class EmailMarketingModule {
};
exports.EmailMarketingModule = EmailMarketingModule;
exports.EmailMarketingModule = EmailMarketingModule = __decorate([
    (0, common_1.Module)({
        controllers: [
            email_marketing_controller_1.EmailMarketingController,
            email_marketing_public_controller_1.EmailMarketingPublicController,
            brevo_webhook_controller_1.BrevoWebhookController,
        ],
        providers: [
            email_marketing_service_1.EmailMarketingService,
            email_marketing_queue_service_1.EmailMarketingQueueService,
            email_router_service_1.EmailRouterService,
            brevo_webhook_service_1.BrevoWebhookService,
        ],
        exports: [email_marketing_service_1.EmailMarketingService, email_router_service_1.EmailRouterService, brevo_webhook_service_1.BrevoWebhookService],
    })
], EmailMarketingModule);
