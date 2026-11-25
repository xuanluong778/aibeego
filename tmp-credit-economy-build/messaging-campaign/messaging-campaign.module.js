"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagingCampaignModule = void 0;
const common_1 = require("@nestjs/common");
const messaging_campaign_controller_1 = require("./messaging-campaign.controller");
const messaging_campaign_service_1 = require("./messaging-campaign.service");
const messaging_campaign_segment_service_1 = require("./messaging-campaign-segment.service");
const messaging_campaign_queue_service_1 = require("./messaging-campaign-queue.service");
const messaging_module_1 = require("../messaging/messaging.module");
const audit_module_1 = require("../audit/audit.module");
let MessagingCampaignModule = class MessagingCampaignModule {
};
exports.MessagingCampaignModule = MessagingCampaignModule;
exports.MessagingCampaignModule = MessagingCampaignModule = __decorate([
    (0, common_1.Module)({
        imports: [messaging_module_1.MessagingModule, audit_module_1.AuditModule],
        controllers: [messaging_campaign_controller_1.MessagingCampaignController],
        providers: [
            messaging_campaign_service_1.MessagingCampaignService,
            messaging_campaign_segment_service_1.MessagingCampaignSegmentService,
            messaging_campaign_queue_service_1.MessagingCampaignQueueService,
        ],
        exports: [
            messaging_campaign_service_1.MessagingCampaignService,
            messaging_campaign_segment_service_1.MessagingCampaignSegmentService,
            messaging_campaign_queue_service_1.MessagingCampaignQueueService,
        ],
    })
], MessagingCampaignModule);
