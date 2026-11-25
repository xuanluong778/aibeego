"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagingModule = void 0;
const common_1 = require("@nestjs/common");
const channel_connections_controller_1 = require("./channel-connections.controller");
const channel_connections_service_1 = require("./channel-connections.service");
const messaging_webhook_controller_1 = require("./messaging-webhook.controller");
const messaging_webhook_ingress_service_1 = require("./messaging-webhook-ingress.service");
const messaging_provider_registry_1 = require("./providers/messaging-provider.registry");
const messaging_identity_module_1 = require("../messaging-identity/messaging-identity.module");
const messaging_eligibility_controller_1 = require("./messaging-eligibility.controller");
const messaging_eligibility_service_1 = require("./messaging-eligibility.service");
const messaging_org_policy_controller_1 = require("./messaging-org-policy.controller");
const messaging_org_policy_service_1 = require("./messaging-org-policy.service");
let MessagingModule = class MessagingModule {
};
exports.MessagingModule = MessagingModule;
exports.MessagingModule = MessagingModule = __decorate([
    (0, common_1.Module)({
        imports: [(0, common_1.forwardRef)(() => messaging_identity_module_1.MessagingIdentityModule)],
        controllers: [
            channel_connections_controller_1.ChannelConnectionsController,
            messaging_webhook_controller_1.MessagingWebhookController,
            messaging_eligibility_controller_1.MessagingEligibilityController,
            messaging_org_policy_controller_1.MessagingOrgPolicyController,
        ],
        providers: [
            channel_connections_service_1.ChannelConnectionsService,
            messaging_webhook_ingress_service_1.MessagingWebhookIngressService,
            messaging_provider_registry_1.MessagingProviderRegistry,
            messaging_eligibility_service_1.MessagingEligibilityService,
            messaging_org_policy_service_1.MessagingOrgPolicyService,
        ],
        exports: [
            channel_connections_service_1.ChannelConnectionsService,
            messaging_webhook_ingress_service_1.MessagingWebhookIngressService,
            messaging_provider_registry_1.MessagingProviderRegistry,
            messaging_eligibility_service_1.MessagingEligibilityService,
            messaging_org_policy_service_1.MessagingOrgPolicyService,
        ],
    })
], MessagingModule);
