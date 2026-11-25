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
var ZaloWebhookController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZaloWebhookController = void 0;
const common_1 = require("@nestjs/common");
const messaging_webhook_ingress_service_1 = require("../messaging/messaging-webhook-ingress.service");
/**
 * Public Zalo OA webhook — production callback URL:
 *   POST https://aibeego.com/api/v1/webhooks/zalo
 *
 * Thin ingress: verify + enqueue via MessagingWebhookIngressService; always 200.
 * Alias of messaging path kept for backward compatibility.
 */
let ZaloWebhookController = ZaloWebhookController_1 = class ZaloWebhookController {
    ingress;
    logger = new common_1.Logger(ZaloWebhookController_1.name);
    constructor(ingress) {
        this.ingress = ingress;
    }
    receiveZalo(req, body, signature) {
        const raw = req.rawBody ?? Buffer.from(JSON.stringify(body ?? {}));
        void this.ingress.ingestZalo(raw, body, signature).catch((err) => {
            // Log lỗi xử lý — không log token/secret
            this.logger.warn(`Zalo webhook ingest error: ${err.message}`);
        });
        return { ok: true };
    }
};
exports.ZaloWebhookController = ZaloWebhookController;
__decorate([
    (0, common_1.Post)('zalo'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('x-zevent-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String]),
    __metadata("design:returntype", void 0)
], ZaloWebhookController.prototype, "receiveZalo", null);
exports.ZaloWebhookController = ZaloWebhookController = ZaloWebhookController_1 = __decorate([
    (0, common_1.Controller)('webhooks'),
    __metadata("design:paramtypes", [messaging_webhook_ingress_service_1.MessagingWebhookIngressService])
], ZaloWebhookController);
