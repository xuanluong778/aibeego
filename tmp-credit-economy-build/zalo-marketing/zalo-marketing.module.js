"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZaloMarketingModule = void 0;
const common_1 = require("@nestjs/common");
const zalo_marketing_controller_1 = require("./zalo-marketing.controller");
const zalo_marketing_public_controller_1 = require("./zalo-marketing-public.controller");
const zalo_marketing_service_1 = require("./zalo-marketing.service");
const zalo_oauth_service_1 = require("./zalo-oauth.service");
const messaging_module_1 = require("../messaging/messaging.module");
const messaging_campaign_module_1 = require("../messaging-campaign/messaging-campaign.module");
let ZaloMarketingModule = class ZaloMarketingModule {
};
exports.ZaloMarketingModule = ZaloMarketingModule;
exports.ZaloMarketingModule = ZaloMarketingModule = __decorate([
    (0, common_1.Module)({
        imports: [messaging_module_1.MessagingModule, messaging_campaign_module_1.MessagingCampaignModule],
        controllers: [zalo_marketing_controller_1.ZaloMarketingController, zalo_marketing_public_controller_1.ZaloMarketingPublicController],
        providers: [zalo_marketing_service_1.ZaloMarketingService, zalo_oauth_service_1.ZaloOAuthService],
        exports: [zalo_marketing_service_1.ZaloMarketingService],
    })
], ZaloMarketingModule);
