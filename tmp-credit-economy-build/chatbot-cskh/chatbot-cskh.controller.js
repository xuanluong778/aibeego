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
exports.ChatbotCskhController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const upload_policy_1 = require("../common/uploads/upload-policy");
const chatbot_cskh_service_1 = require("./chatbot-cskh.service");
const chatbot_suggest_service_1 = require("./chatbot-suggest.service");
const chatbot_facebook_webhook_service_1 = require("./chatbot-facebook-webhook.service");
const openai_service_1 = require("../openai/openai.service");
const realtime_bridge_service_1 = require("../events/realtime-bridge.service");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permissions_guard_1 = require("../common/guards/permissions.guard");
const require_permissions_decorator_1 = require("../common/decorators/require-permissions.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const chatbot_cskh_dto_1 = require("./dto/chatbot-cskh.dto");
const chatbot_suggest_dto_1 = require("./dto/chatbot-suggest.dto");
let ChatbotCskhController = class ChatbotCskhController {
    service;
    suggestService;
    openAi;
    facebookWebhook;
    realtimeBridge;
    constructor(service, suggestService, openAi, facebookWebhook, realtimeBridge) {
        this.service = service;
        this.suggestService = suggestService;
        this.openAi = openAi;
        this.facebookWebhook = facebookWebhook;
        this.realtimeBridge = realtimeBridge;
    }
    getOptions(query) {
        return this.suggestService.getOptions(query.industry);
    }
    suggest(dto) {
        return this.suggestService.suggest(dto);
    }
    overview(user) {
        return this.service.getOverview(user.organizationId);
    }
    listBots(user) {
        return this.service.listBots(user.organizationId);
    }
    createBot(user, dto) {
        return this.service.createBot(user.organizationId, dto);
    }
    getBot(user, id) {
        return this.service.getBot(user.organizationId, id);
    }
    updateBot(user, id, dto) {
        return this.service.updateBot(user.organizationId, id, dto);
    }
    deleteBot(user, id) {
        return this.service.deleteBot(user.organizationId, id);
    }
    embed(user, id) {
        return this.service.getEmbedCode(user.organizationId, id);
    }
    listKnowledge(user, botId) {
        return this.service.listKnowledge(user.organizationId, botId);
    }
    createKnowledge(user, dto) {
        return this.service.createKnowledge(user.organizationId, dto);
    }
    uploadKnowledgeDiagram(user, file, body) {
        return this.service.uploadKnowledgeDiagram(user.organizationId, {
            botId: body.botId || '',
            title: body.title,
            filename: file?.originalname || 'diagram.txt',
            buffer: file?.buffer || Buffer.alloc(0),
            replaceExisting: body.replaceExisting === '1' || body.replaceExisting === 'true',
        });
    }
    crawlKnowledgeFromUrl(user, dto) {
        return this.service.crawlKnowledgeFromUrl(user.organizationId, dto);
    }
    deleteKnowledge(user, id) {
        return this.service.deleteKnowledge(user.organizationId, id);
    }
    listChannels(user) {
        return this.service.listChannels(user.organizationId);
    }
    createChannel(user, dto) {
        return this.service.createChannel(user.organizationId, dto);
    }
    deleteChannel(user, id) {
        return this.service.deleteChannel(user.organizationId, id);
    }
    listInboxChannelOptions(user, botId) {
        return this.service.listInboxChannelOptions(user.organizationId, botId || null);
    }
    /** Gắn Zalo OA vào Project/Bot để hiện trong bộ lọc hộp thư */
    attachZaloOa(user, dto) {
        return this.service.attachZaloOaToBot(user.organizationId, dto);
    }
    listInbox(user, limit, cursor, botId, channel, channelId) {
        return this.service.listConversations(user.organizationId, limit ? Number(limit) : 25, cursor || null, {
            maxLimit: 50,
            botId: botId || null,
            channel: channel || null,
            channelId: channelId || null,
        });
    }
    /** Badge + dropdown header — phải khai báo trước inbox/:id */
    getUnreadSummary(user, limit, botId, channel, channelId) {
        return this.service.getUnreadInboxSummary(user.organizationId, limit ? Number(limit) : 15, {
            botId: botId || null,
            channel: channel || null,
            channelId: channelId || null,
        });
    }
    getInbox(user, id) {
        return this.service.getConversation(user.organizationId, id);
    }
    markInboxRead(user, id) {
        return this.service.markConversationRead(user.organizationId, id);
    }
    takeover(user, id, body) {
        return this.service.takeoverConversation(user.organizationId, id, body);
    }
    replyInbox(user, id, body) {
        return this.service.replyInboxMessage(user.organizationId, id, body);
    }
    listLeads(user, limit) {
        return this.service.listLeads(user.organizationId, limit ? Number(limit) : 50);
    }
    getSettings(user) {
        return this.service.getSettings(user.organizationId);
    }
    getOpenAiStatus(test) {
        return this.openAi.getStatus(test === '1' || test === 'true');
    }
    updateSettings(user, dto) {
        return this.service.updateSettings(user.organizationId, dto);
    }
    listFacebook(user) {
        return this.service.listFacebookPages(user.organizationId);
    }
    async facebookWebhookStatus(user) {
        const status = await this.facebookWebhook.getPublicConnectStatus(user.organizationId);
        return {
            ...status,
            realtime: this.realtimeBridge.getStatus(),
        };
    }
    connectFacebook(user, dto) {
        return this.service.connectFacebookPage(user.organizationId, dto);
    }
    syncMessagingFromChatbot(user) {
        return this.service.syncMessagingFromChatbotPages(user.organizationId, user.id);
    }
    disconnectFacebook(user, id) {
        return this.service.disconnectFacebookPage(user.organizationId, id);
    }
};
exports.ChatbotCskhController = ChatbotCskhController;
__decorate([
    (0, common_1.Get)('options'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [chatbot_suggest_dto_1.ChatbotOptionsQueryDto]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "getOptions", null);
__decorate([
    (0, common_1.Post)('suggest'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [chatbot_suggest_dto_1.ChatbotSuggestDto]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "suggest", null);
__decorate([
    (0, common_1.Get)('overview'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "overview", null);
__decorate([
    (0, common_1.Get)('bots'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "listBots", null);
__decorate([
    (0, common_1.Post)('bots'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, chatbot_cskh_dto_1.CreateChatbotBotDto]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "createBot", null);
__decorate([
    (0, common_1.Get)('bots/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "getBot", null);
__decorate([
    (0, common_1.Patch)('bots/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, chatbot_cskh_dto_1.UpdateChatbotBotDto]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "updateBot", null);
__decorate([
    (0, common_1.Delete)('bots/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "deleteBot", null);
__decorate([
    (0, common_1.Get)('bots/:id/embed'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "embed", null);
__decorate([
    (0, common_1.Get)('knowledge'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('botId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "listKnowledge", null);
__decorate([
    (0, common_1.Post)('knowledge'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, chatbot_cskh_dto_1.CreateKnowledgeSourceDto]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "createKnowledge", null);
__decorate([
    (0, common_1.Post)('knowledge/diagram'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', (0, upload_policy_1.createUploadMulterOptions)('diagram'))),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, Object]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "uploadKnowledgeDiagram", null);
__decorate([
    (0, common_1.Post)('knowledge/crawl'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, chatbot_cskh_dto_1.CrawlKnowledgeUrlDto]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "crawlKnowledgeFromUrl", null);
__decorate([
    (0, common_1.Delete)('knowledge/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "deleteKnowledge", null);
__decorate([
    (0, common_1.Get)('channels'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "listChannels", null);
__decorate([
    (0, common_1.Post)('channels'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, chatbot_cskh_dto_1.CreateChannelDto]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "createChannel", null);
__decorate([
    (0, common_1.Delete)('channels/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "deleteChannel", null);
__decorate([
    (0, common_1.Get)('inbox/channel-options'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('botId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "listInboxChannelOptions", null);
__decorate([
    (0, common_1.Post)('zalo-oa/attach'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, chatbot_cskh_dto_1.AttachZaloOaDto]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "attachZaloOa", null);
__decorate([
    (0, common_1.Get)('inbox'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('cursor')),
    __param(3, (0, common_1.Query)('botId')),
    __param(4, (0, common_1.Query)('channel')),
    __param(5, (0, common_1.Query)('channelId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "listInbox", null);
__decorate([
    (0, common_1.Get)('inbox/unread-summary'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('botId')),
    __param(3, (0, common_1.Query)('channel')),
    __param(4, (0, common_1.Query)('channelId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "getUnreadSummary", null);
__decorate([
    (0, common_1.Get)('inbox/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "getInbox", null);
__decorate([
    (0, common_1.Post)('inbox/:id/read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "markInboxRead", null);
__decorate([
    (0, common_1.Post)('inbox/:id/takeover'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "takeover", null);
__decorate([
    (0, common_1.Post)('inbox/:id/reply'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, chatbot_cskh_dto_1.ReplyInboxMessageDto]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "replyInbox", null);
__decorate([
    (0, common_1.Get)('leads'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "listLeads", null);
__decorate([
    (0, common_1.Get)('settings'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "getSettings", null);
__decorate([
    (0, common_1.Get)('openai/status'),
    __param(0, (0, common_1.Query)('test')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "getOpenAiStatus", null);
__decorate([
    (0, common_1.Patch)('settings'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, chatbot_cskh_dto_1.UpdateSettingsDto]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "updateSettings", null);
__decorate([
    (0, common_1.Get)('facebook/pages'),
    (0, common_1.UseGuards)(permissions_guard_1.PermissionsGuard),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "listFacebook", null);
__decorate([
    (0, common_1.Get)('facebook/webhook-status'),
    (0, common_1.UseGuards)(permissions_guard_1.PermissionsGuard),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatbotCskhController.prototype, "facebookWebhookStatus", null);
__decorate([
    (0, common_1.Post)('facebook/pages'),
    (0, common_1.UseGuards)(permissions_guard_1.PermissionsGuard),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.integration.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, chatbot_cskh_dto_1.ConnectFacebookPageDto]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "connectFacebook", null);
__decorate([
    (0, common_1.Post)('facebook/pages/sync-messaging'),
    (0, common_1.UseGuards)(permissions_guard_1.PermissionsGuard),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.integration.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "syncMessagingFromChatbot", null);
__decorate([
    (0, common_1.Delete)('facebook/pages/:id'),
    (0, common_1.UseGuards)(permissions_guard_1.PermissionsGuard),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.integration.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ChatbotCskhController.prototype, "disconnectFacebook", null);
exports.ChatbotCskhController = ChatbotCskhController = __decorate([
    (0, common_1.Controller)('chatbot-cskh'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __metadata("design:paramtypes", [chatbot_cskh_service_1.ChatbotCskhService,
        chatbot_suggest_service_1.ChatbotSuggestService,
        openai_service_1.OpenAiService,
        chatbot_facebook_webhook_service_1.ChatbotFacebookWebhookService,
        realtime_bridge_service_1.RealtimeBridgeService])
], ChatbotCskhController);
