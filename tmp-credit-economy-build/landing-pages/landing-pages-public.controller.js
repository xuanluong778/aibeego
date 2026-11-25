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
exports.LandingPagesPublicController = void 0;
const common_1 = require("@nestjs/common");
const landing_pages_service_1 = require("./landing-pages.service");
const landing_page_template_pack_service_1 = require("./landing-page-template-pack.service");
const landing_pages_dto_1 = require("./dto/landing-pages.dto");
const landing_page_chatbot_service_1 = require("./landing-page-chatbot.service");
/** Public landing pages — no JWT. Builder code is never loaded here. */
let LandingPagesPublicController = class LandingPagesPublicController {
    service;
    templatePacks;
    chatbot;
    constructor(service, templatePacks, chatbot) {
        this.service = service;
        this.templatePacks = templatePacks;
        this.chatbot = chatbot;
    }
    clientIp(req) {
        const xf = req.headers['x-forwarded-for'];
        if (typeof xf === 'string' && xf.trim()) {
            const first = xf.split(',')[0]?.trim() || '';
            if (first)
                return first.slice(0, 64);
        }
        return (req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 64);
    }
    /** Used only by the ingress/edge permission check; no draft or ownership token is exposed. */
    async resolveDomain(host, res) {
        const row = await this.service.resolveDomainHost(host);
        if (!row)
            throw new common_1.ForbiddenException('Tên miền chưa xác minh hoặc trang chưa xuất bản');
        res.setHeader('X-LP-Public-Key', row.publicKey);
        res.setHeader('X-LP-Page-Id', row.pageId);
        return { pageId: row.pageId, publicKey: row.publicKey };
    }
    async allowCertificate(domain) {
        const row = await this.service.resolveDomainHost(domain);
        if (!row)
            throw new common_1.ForbiddenException('Tên miền chưa đủ điều kiện cấp chứng chỉ');
        return { allowed: true };
    }
    /** Published HTML source is public. Draft HTML requires the asset key. */
    templateHtml(templateId, key) {
        return this.templatePacks.openPublicHtml(templateId, key);
    }
    /** Draft images require the unguessable key. Published images are public. */
    templateAsset(templateId, file, key) {
        return this.templatePacks.openPublicAsset(templateId, file, key);
    }
    /** Draft preview by opaque token — must be registered before :slug. */
    getByPreviewToken(token, req) {
        return this.service.getPublicByPreviewToken(token, this.clientIp(req));
    }
    async getBySlug(slug, organizationId, req) {
        const org = await this.service.domainOrganization(req?.headers.host || '', slug, organizationId);
        return this.service.getPublicBySlug(slug, org);
    }
    async submitLead(slug, dto, req, organizationId) {
        const org = await this.service.domainOrganization(req.headers.host || '', slug, organizationId);
        return this.service.submitPublicLead(slug, dto, this.clientIp(req), org);
    }
    chatbotConfig(slug, organizationId, previewToken, req) {
        const origin = String(req.headers.origin || '');
        const referer = String(req.headers.referer || '');
        return this.chatbot.getPublicConfig(slug, organizationId, previewToken, origin, referer);
    }
    chatbotMessage(slug, dto, organizationId, previewToken, req) {
        const origin = String(req.headers.origin || '');
        const referer = String(req.headers.referer || '');
        return this.chatbot.processMessage(slug, { message: dto.message, sessionId: dto.sessionId, pageUrl: dto.pageUrl }, organizationId, previewToken ?? dto.previewToken, origin, referer, this.clientIp(req));
    }
    chatbotLead(slug, dto, organizationId, previewToken, req) {
        const origin = String(req.headers.origin || '');
        const referer = String(req.headers.referer || '');
        return this.chatbot.submitLead(slug, {
            sessionId: dto.sessionId,
            name: dto.name,
            phone: dto.phone,
            email: dto.email,
            need: dto.need,
            pageUrl: dto.pageUrl,
        }, organizationId, previewToken ?? dto.previewToken, this.clientIp(req), origin, referer);
    }
    async trackEvent(slug, dto, req, organizationId) {
        const org = await this.service.domainOrganization(req.headers.host || '', slug, organizationId);
        return this.service.trackPublicEvent(slug, dto, this.clientIp(req), org);
    }
};
exports.LandingPagesPublicController = LandingPagesPublicController;
__decorate([
    (0, common_1.Get)('domains/resolve'),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    __param(0, (0, common_1.Query)('host')),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], LandingPagesPublicController.prototype, "resolveDomain", null);
__decorate([
    (0, common_1.Get)('domains/allow-certificate'),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    __param(0, (0, common_1.Query)('domain')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], LandingPagesPublicController.prototype, "allowCertificate", null);
__decorate([
    (0, common_1.Get)('template-html/:templateId'),
    (0, common_1.Header)('Content-Type', 'text/html; charset=utf-8'),
    (0, common_1.Header)('X-Content-Type-Options', 'nosniff'),
    (0, common_1.Header)('Content-Security-Policy', "default-src 'none'; script-src 'none'; style-src 'unsafe-inline' https: data:; img-src 'self' https: data: blob:; font-src https: data:; media-src https: data:; connect-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'"),
    (0, common_1.Header)('Cache-Control', 'private, no-cache'),
    __param(0, (0, common_1.Param)('templateId')),
    __param(1, (0, common_1.Query)('k')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], LandingPagesPublicController.prototype, "templateHtml", null);
__decorate([
    (0, common_1.Get)('template-assets/:templateId/:file'),
    (0, common_1.Header)('X-Content-Type-Options', 'nosniff'),
    (0, common_1.Header)('Cache-Control', 'private, max-age=300'),
    __param(0, (0, common_1.Param)('templateId')),
    __param(1, (0, common_1.Param)('file')),
    __param(2, (0, common_1.Query)('k')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", void 0)
], LandingPagesPublicController.prototype, "templateAsset", null);
__decorate([
    (0, common_1.Get)('preview/:token'),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], LandingPagesPublicController.prototype, "getByPreviewToken", null);
__decorate([
    (0, common_1.Get)(':slug'),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], LandingPagesPublicController.prototype, "getBySlug", null);
__decorate([
    (0, common_1.Post)(':slug/lead'),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, landing_pages_dto_1.SubmitLandingPageLeadDto, Object, String]),
    __metadata("design:returntype", Promise)
], LandingPagesPublicController.prototype, "submitLead", null);
__decorate([
    (0, common_1.Get)(':slug/chatbot/config'),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Query)('organizationId')),
    __param(2, (0, common_1.Query)('previewToken')),
    __param(3, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], LandingPagesPublicController.prototype, "chatbotConfig", null);
__decorate([
    (0, common_1.Post)(':slug/chatbot/message'),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __param(3, (0, common_1.Query)('previewToken')),
    __param(4, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, landing_pages_dto_1.LandingPageChatbotMessageDto, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], LandingPagesPublicController.prototype, "chatbotMessage", null);
__decorate([
    (0, common_1.Post)(':slug/chatbot/lead'),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Query)('organizationId')),
    __param(3, (0, common_1.Query)('previewToken')),
    __param(4, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, landing_pages_dto_1.LandingPageChatbotLeadDto, Object, Object, Object]),
    __metadata("design:returntype", void 0)
], LandingPagesPublicController.prototype, "chatbotLead", null);
__decorate([
    (0, common_1.Post)(':slug/events'),
    __param(0, (0, common_1.Param)('slug')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Query)('organizationId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, landing_pages_dto_1.TrackLandingPageEventDto, Object, String]),
    __metadata("design:returntype", Promise)
], LandingPagesPublicController.prototype, "trackEvent", null);
exports.LandingPagesPublicController = LandingPagesPublicController = __decorate([
    (0, common_1.Controller)('landing-pages/public'),
    __metadata("design:paramtypes", [landing_pages_service_1.LandingPagesService,
        landing_page_template_pack_service_1.LandingPageTemplatePackService,
        landing_page_chatbot_service_1.LandingPageChatbotService])
], LandingPagesPublicController);
