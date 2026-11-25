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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailMarketingPublicController = void 0;
const common_1 = require("@nestjs/common");
const email_marketing_service_1 = require("./email-marketing.service");
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
function readWebhookPayload(req) {
    if (req.rawBody?.length) {
        const text = req.rawBody.toString('utf8');
        try {
            return JSON.parse(text);
        }
        catch {
            return text;
        }
    }
    if (typeof req.body === 'string') {
        try {
            return JSON.parse(req.body);
        }
        catch {
            return req.body;
        }
    }
    return req.body ?? {};
}
let EmailMarketingPublicController = class EmailMarketingPublicController {
    service;
    constructor(service) {
        this.service = service;
    }
    unsubscribe(rid) {
        return this.service.unsubscribeByRecipient(rid);
    }
    async open(rid, res) {
        await this.service.trackOpen(rid);
        res.setHeader('Content-Type', 'image/gif');
        res.end(PIXEL);
    }
    async click(rid, url, res) {
        const dest = await this.service.trackClick(rid, url);
        res.redirect(dest.startsWith('http') ? dest : '/');
    }
    async sesEvents(req, res) {
        const payload = readWebhookPayload(req);
        const rawBody = req.rawBody?.length ? req.rawBody.toString('utf8') : undefined;
        const testSignatureHeader = typeof req.headers['x-sns-test-signature'] === 'string'
            ? req.headers['x-sns-test-signature']
            : undefined;
        const result = await this.service.handleSesEvent(payload, { rawBody, testSignatureHeader });
        if (!result.ok && typeof result.statusCode === 'number' && result.statusCode !== 200) {
            res.status(result.statusCode);
        }
        return result;
    }
};
exports.EmailMarketingPublicController = EmailMarketingPublicController;
__decorate([
    (0, common_1.Get)('unsubscribe'),
    __param(0, (0, common_1.Query)('rid')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], EmailMarketingPublicController.prototype, "unsubscribe", null);
__decorate([
    (0, common_1.Get)('open/:rid'),
    (0, common_1.Header)('Content-Type', 'image/gif'),
    (0, common_1.Header)('Cache-Control', 'no-store, no-cache, must-revalidate'),
    __param(0, (0, common_1.Param)('rid')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], EmailMarketingPublicController.prototype, "open", null);
__decorate([
    (0, common_1.Get)('click/:rid'),
    __param(0, (0, common_1.Param)('rid')),
    __param(1, (0, common_1.Query)('url')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], EmailMarketingPublicController.prototype, "click", null);
__decorate([
    (0, common_1.Post)('ses-events'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], EmailMarketingPublicController.prototype, "sesEvents", null);
exports.EmailMarketingPublicController = EmailMarketingPublicController = __decorate([
    (0, common_1.Controller)('email-marketing/public'),
    __metadata("design:paramtypes", [email_marketing_service_1.EmailMarketingService])
], EmailMarketingPublicController);
