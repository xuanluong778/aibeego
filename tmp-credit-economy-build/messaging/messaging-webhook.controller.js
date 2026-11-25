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
var MessagingWebhookController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagingWebhookController = void 0;
const common_1 = require("@nestjs/common");
const messaging_webhook_ingress_service_1 = require("./messaging-webhook-ingress.service");
/** Public webhook ingress — controller chỉ nhận & enqueue, không gọi provider API */
let MessagingWebhookController = MessagingWebhookController_1 = class MessagingWebhookController {
    ingress;
    logger = new common_1.Logger(MessagingWebhookController_1.name);
    constructor(ingress) {
        this.ingress = ingress;
    }
    verifyMessenger(mode, token, challenge) {
        return this.ingress.verifyMessengerChallenge(mode, token, challenge);
    }
    receiveMessenger(req, body, signature) {
        const raw = req.rawBody ?? Buffer.from(JSON.stringify(body));
        // Fail-closed sync trước khi trả 200 — không log token/secret
        this.ingress.assertMessengerSignature(raw, signature);
        void this.ingress.ingestMessenger(raw, body, signature).catch((err) => {
            this.logger.warn(`Messenger ingest error: ${err.message}`);
        });
        return { ok: true };
    }
    async receiveZalo(req, body, signature) {
        const raw = req.rawBody ?? Buffer.from(JSON.stringify(body));
        // Fail-closed sync trước khi trả 200
        await this.ingress.assertZaloSignature(raw, body, signature);
        void this.ingress.ingestZalo(raw, body, signature).catch((err) => {
            this.logger.warn(`Zalo ingest error: ${err.message}`);
        });
        return { ok: true };
    }
};
exports.MessagingWebhookController = MessagingWebhookController;
__decorate([
    (0, common_1.Get)('messenger'),
    (0, common_1.Header)('Content-Type', 'text/plain'),
    __param(0, (0, common_1.Query)('hub.mode')),
    __param(1, (0, common_1.Query)('hub.verify_token')),
    __param(2, (0, common_1.Query)('hub.challenge')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], MessagingWebhookController.prototype, "verifyMessenger", null);
__decorate([
    (0, common_1.Post)('messenger'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('x-hub-signature-256')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", void 0)
], MessagingWebhookController.prototype, "receiveMessenger", null);
__decorate([
    (0, common_1.Post)('zalo'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('x-zevent-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", Promise)
], MessagingWebhookController.prototype, "receiveZalo", null);
exports.MessagingWebhookController = MessagingWebhookController = MessagingWebhookController_1 = __decorate([
    (0, common_1.Controller)('messaging/webhooks'),
    __metadata("design:paramtypes", [messaging_webhook_ingress_service_1.MessagingWebhookIngressService])
], MessagingWebhookController);
