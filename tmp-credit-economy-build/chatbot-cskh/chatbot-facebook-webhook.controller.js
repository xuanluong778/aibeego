"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ChatbotFacebookWebhookController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatbotFacebookWebhookController = void 0;
const common_1 = require("@nestjs/common");
const chatbot_facebook_webhook_service_1 = require("./chatbot-facebook-webhook.service");
const messaging_webhook_ingress_service_1 = require("../messaging/messaging-webhook-ingress.service");
/**
 * Public Meta Messenger webhook (no JWT).
 * Configure in Meta App → Webhooks → Callback URL:
 *   {API_URL}/api/v1/chatbot-cskh/facebook/webhook
 * Verify token: CSKH_FB_WEBHOOK_VERIFY_TOKEN
 * Subscribed fields: messages, messaging_postbacks
 */
let ChatbotFacebookWebhookController = ChatbotFacebookWebhookController_1 = class ChatbotFacebookWebhookController {
    webhook;
    messagingIngress;
    logger = new common_1.Logger(ChatbotFacebookWebhookController_1.name);
    constructor(webhook, messagingIngress) {
        this.webhook = webhook;
        this.messagingIngress = messagingIngress;
    }
    /** Public helper for Meta console / ops — no secrets. */
    info() {
        return {
            ok: true,
            webhookPath: this.webhook.getWebhookPath(),
            webhookUrl: this.webhook.getWebhookUrl(),
            verifyTokenConfigured: Boolean(this.webhook.getVerifyToken()),
            appSecretConfigured: Boolean(this.webhook.getAppSecret()),
            signatureMode: this.webhook.getAppSecret() ? 'required' : 'fail-closed-missing-secret',
            subscribedFields: [
                'messages',
                'messaging_postbacks',
                'message_deliveries',
                'message_reads',
            ],
            note: 'Chatbot dùng chung Fanpage Auto Post. Khi có META_APP_SECRET, chữ ký X-Hub-Signature-256 bắt buộc (fail-closed).',
        };
    }
    verify(mode, token, challenge) {
        return this.webhook.verifyChallenge(mode, token, challenge);
    }
    receive(req, body, signature) {
        if (!req.rawBody?.length) {
            this.logger.warn('Meta webhook missing rawBody — signature verify may fail; check body parser');
        }
        if (!this.webhook.verifySignature(req.rawBody, signature)) {
            this.logger.warn(`Invalid Meta webhook signature rawBody=${req.rawBody?.length ?? 0}B sig=${signature ? 'yes' : 'no'}`);
            throw new common_1.ForbiddenException('Invalid signature');
        }
        const entry = Array.isArray(body.entry) ? body.entry : [];
        const pageId = String(entry[0]?.id || '').trim();
        this.logger.log(`Meta webhook POST object=${String(body.object || '-')} pageId=${pageId ? `••••${pageId.slice(-4)}` : '-'} entries=${entry.length} sig=${signature ? 'yes' : 'no'}`);
        const raw = req.rawBody ?? Buffer.from(JSON.stringify(body));
        // ingestMessenger → chatbot handler + messaging queue (một lần, chống double-process)
        void this.messagingIngress.ingestMessenger(raw, body, signature).catch((err) => {
            this.logger.warn(`Messaging/chatbot ingress: ${err.message}`);
        });
        return { ok: true };
    }
};
exports.ChatbotFacebookWebhookController = ChatbotFacebookWebhookController;
__decorate([
    (0, common_1.Get)('webhook/info'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ChatbotFacebookWebhookController.prototype, "info", null);
__decorate([
    (0, common_1.Get)('webhook'),
    (0, common_1.Header)('Content-Type', 'text/plain'),
    __param(0, (0, common_1.Query)('hub.mode')),
    __param(1, (0, common_1.Query)('hub.verify_token')),
    __param(2, (0, common_1.Query)('hub.challenge')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], ChatbotFacebookWebhookController.prototype, "verify", null);
__decorate([
    (0, common_1.Post)('webhook'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('x-hub-signature-256')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", void 0)
], ChatbotFacebookWebhookController.prototype, "receive", null);
exports.ChatbotFacebookWebhookController = ChatbotFacebookWebhookController = ChatbotFacebookWebhookController_1 = __decorate([
    (0, common_1.Controller)('chatbot-cskh/facebook'),
    __metadata("design:paramtypes", [chatbot_facebook_webhook_service_1.ChatbotFacebookWebhookService,
        messaging_webhook_ingress_service_1.MessagingWebhookIngressService])
], ChatbotFacebookWebhookController);
