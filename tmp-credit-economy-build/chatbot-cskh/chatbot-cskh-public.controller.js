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
exports.ChatbotCskhPublicController = void 0;
const common_1 = require("@nestjs/common");
const chatbot_cskh_public_service_1 = require("./chatbot-cskh-public.service");
const chatbot_cskh_dto_1 = require("./dto/chatbot-cskh.dto");
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};
let ChatbotCskhPublicController = class ChatbotCskhPublicController {
    publicService;
    constructor(publicService) {
        this.publicService = publicService;
    }
    preflight(res) {
        Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
        res.send();
    }
    async config(botId, pageUrl, origin, res) {
        const payload = await this.publicService.getPublicConfig(botId, pageUrl ?? '', origin ?? '');
        Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
        res.json(payload);
    }
    async message(dto, origin, referer, res) {
        const payload = await this.publicService.processMessage(dto, origin ?? '', referer ?? '');
        const status = payload.code === 'rate_limited' ? 429 : 200;
        Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
        res.status(status).json(payload);
    }
    async lead(dto, res) {
        const payload = await this.publicService.submitLead(dto);
        Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
        res.json(payload);
    }
};
exports.ChatbotCskhPublicController = ChatbotCskhPublicController;
__decorate([
    (0, common_1.Options)('config'),
    (0, common_1.Options)('message'),
    (0, common_1.Options)('lead'),
    (0, common_1.HttpCode)(204),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChatbotCskhPublicController.prototype, "preflight", null);
__decorate([
    (0, common_1.Get)('config'),
    __param(0, (0, common_1.Query)('botId')),
    __param(1, (0, common_1.Query)('pageUrl')),
    __param(2, (0, common_1.Headers)('origin')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, Object]),
    __metadata("design:returntype", Promise)
], ChatbotCskhPublicController.prototype, "config", null);
__decorate([
    (0, common_1.Post)('message'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Headers)('origin')),
    __param(2, (0, common_1.Headers)('referer')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [chatbot_cskh_dto_1.PublicMessageDto, String, String, Object]),
    __metadata("design:returntype", Promise)
], ChatbotCskhPublicController.prototype, "message", null);
__decorate([
    (0, common_1.Post)('lead'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [chatbot_cskh_dto_1.PublicLeadDto, Object]),
    __metadata("design:returntype", Promise)
], ChatbotCskhPublicController.prototype, "lead", null);
exports.ChatbotCskhPublicController = ChatbotCskhPublicController = __decorate([
    (0, common_1.Controller)('chatbot-cskh/public'),
    __metadata("design:paramtypes", [chatbot_cskh_public_service_1.ChatbotCskhPublicService])
], ChatbotCskhPublicController);
