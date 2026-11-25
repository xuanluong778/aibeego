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
var BrevoWebhookController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrevoWebhookController = void 0;
const common_1 = require("@nestjs/common");
const brevo_webhook_service_1 = require("../email-marketing/brevo-webhook.service");
/**
 * Public Brevo transactional webhook:
 *   POST https://aibeego.com/api/v1/webhooks/brevo
 *
 * Auth: header `x-maz-brevo-secret` (or `x-brevo-webhook-secret`) = BREVO_WEBHOOK_SECRET.
 * Always responds quickly with 2xx after accept; processing is sync but lightweight.
 * Không log API key / full email.
 */
let BrevoWebhookController = BrevoWebhookController_1 = class BrevoWebhookController {
    brevoWebhooks;
    logger = new common_1.Logger(BrevoWebhookController_1.name);
    constructor(brevoWebhooks) {
        this.brevoWebhooks = brevoWebhooks;
    }
    async receiveBrevo(req, res, mazSecret, brevoSecret, authorization) {
        const secret = mazSecret ||
            brevoSecret ||
            (authorization?.toLowerCase().startsWith('bearer ')
                ? authorization.slice(7).trim()
                : undefined);
        if (!this.brevoWebhooks.verifySecret(secret)) {
            this.logger.warn('[brevo-webhook] unauthorized');
            throw new common_1.UnauthorizedException('Invalid Brevo webhook secret');
        }
        const body = req.body;
        // Fire processing; return 200 quickly — await still usually <100ms; keep await for reliability
        try {
            const result = await this.brevoWebhooks.handlePayload(body);
            return result;
        }
        catch (err) {
            this.logger.warn(`[brevo-webhook] process error: ${err instanceof Error ? err.message : 'error'}`);
            // Still 200 to avoid Brevo retry storms on poison payloads after auth passed
            res.status(200);
            return { ok: true, accepted: 0, error: 'process_error' };
        }
    }
};
exports.BrevoWebhookController = BrevoWebhookController;
__decorate([
    (0, common_1.Post)('brevo'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __param(2, (0, common_1.Headers)('x-maz-brevo-secret')),
    __param(3, (0, common_1.Headers)('x-brevo-webhook-secret')),
    __param(4, (0, common_1.Headers)('authorization')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String, String]),
    __metadata("design:returntype", Promise)
], BrevoWebhookController.prototype, "receiveBrevo", null);
exports.BrevoWebhookController = BrevoWebhookController = BrevoWebhookController_1 = __decorate([
    (0, common_1.Controller)('webhooks'),
    __metadata("design:paramtypes", [brevo_webhook_service_1.BrevoWebhookService])
], BrevoWebhookController);
