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
var ChatbotZaloKnowledgeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatbotZaloKnowledgeService = void 0;
const plan_billed_chat_1 = require("./utils/plan-billed-chat");
const common_1 = require("@nestjs/common");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../prisma/prisma.service");
const openai_service_1 = require("../openai/openai.service");
const messaging_webhook_ingress_service_1 = require("../messaging/messaging-webhook-ingress.service");
const channel_connections_service_1 = require("../messaging/channel-connections.service");
const chatbot_cskh_service_1 = require("./chatbot-cskh.service");
const chatbot_ai_util_1 = require("./utils/chatbot-ai.util");
/** Only authenticated Zalo ingress can invoke this handler; no new public endpoint. */
let ChatbotZaloKnowledgeService = ChatbotZaloKnowledgeService_1 = class ChatbotZaloKnowledgeService {
    prisma;
    chatbot;
    ai;
    ingress;
    connections;
    logger = new common_1.Logger(ChatbotZaloKnowledgeService_1.name);
    constructor(prisma, chatbot, ai, ingress, connections) {
        this.prisma = prisma;
        this.chatbot = chatbot;
        this.ai = ai;
        this.ingress = ingress;
        this.connections = connections;
    }
    onModuleInit() {
        this.ingress.registerChatbotZaloHandler((id, org, payload) => {
            void this.process(id, org, payload).catch(() => this.logger.warn('Zalo knowledge reply failed; no provider data logged.'));
        });
    }
    async process(connectionId, organizationId, payload) {
        const connection = await this.prisma.messagingChannelConnection.findFirst({
            where: {
                id: connectionId,
                organizationId,
                channel: 'ZALO',
                providerKind: 'ZALO_OA',
                status: 'ACTIVE',
                isPaused: false,
            },
        });
        const botId = connection?.metadata?.botId;
        if (!connection || !botId)
            return;
        const bot = await this.prisma.chatbotBot.findFirst({
            where: { id: botId, organizationId, status: 'ACTIVE', knowledgeBaseId: { not: null } },
        });
        const channel = await this.prisma.chatbotChannel.findFirst({
            where: { botId, organizationId, channelType: 'ZALO' },
        });
        if (!bot || !channel?.config?.zaloAutoReply)
            return;
        for (const event of (0, shared_1.normalizeZaloWebhook)(payload, connection.accountRef)) {
            if (event.accountRef !== connection.accountRef ||
                event.direction !== 'inbound' ||
                event.eventType !== 'message' ||
                !event.text?.trim() ||
                !event.externalUserId)
                continue;
            const usage = await this.chatbot.getUsageSnapshot(organizationId);
            if (!usage.allowed)
                continue;
            const sessionId = `zalo:${connection.accountRef}:${event.externalUserId}`;
            const conv = await this.prisma.chatbotConversation.upsert({
                where: { botId_sessionId: { botId, sessionId } },
                create: {
                    organizationId,
                    botId,
                    sessionId,
                    channel: 'zalo',
                    channelRef: connection.accountRef,
                    externalUserId: event.externalUserId,
                },
                update: {},
            });
            if (conv.organizationId !== organizationId || conv.humanTakeover)
                continue;
            const externalId = event.rawEventKey.slice(0, 128);
            let incoming;
            try {
                incoming = await this.prisma.chatbotMessage.create({
                    data: {
                        conversationId: conv.id,
                        role: 'user',
                        message: event.text.slice(0, 2000),
                        externalMessageId: externalId,
                        direction: 'INBOUND',
                        senderType: 'CUSTOMER',
                    },
                });
            }
            catch (error) {
                if (error.code === 'P2002')
                    continue;
                throw error;
            }
            const [history, settings] = await Promise.all([
                this.prisma.chatbotMessage.findMany({
                    where: { conversationId: conv.id, id: { not: incoming.id } },
                    orderBy: { createdAt: 'desc' },
                    take: 16,
                }),
                this.chatbot.getSettings(organizationId),
            ]);
            history.reverse();
            const knowledge = await this.chatbot.getReplyKnowledge(organizationId, botId, event.text, history);
            let result = await (0, chatbot_ai_util_1.generateAiReply)({
                bot,
                userText: event.text,
                sources: [],
                history,
                settings,
                usageAllowed: usage.allowed,
                knowledge,
                openAiChat: (0, plan_billed_chat_1.planBilledChat)(this.prisma, organizationId, this.ai.isConfigured()
                    ? (input) => this.ai.chatCompletion({
                        model: input.model,
                        responseFormat: input.responseFormat,
                        temperature: input.temperature,
                        maxTokens: 700,
                        messages: [
                            { role: 'system', content: input.systemPrompt },
                            ...input.history,
                            { role: 'user', content: input.userText },
                        ],
                    })
                    : undefined),
            });
            result = await this.chatbot.guardReplyKnowledge(organizationId, botId, knowledge, result);
            const stillLinked = await this.prisma.messagingChannelConnection.findFirst({
                where: { id: connection.id, organizationId, isPaused: false, status: 'ACTIVE' },
            });
            const enabled = await this.prisma.chatbotChannel.findFirst({
                where: { id: channel.id, organizationId },
            });
            const freshConv = await this.prisma.chatbotConversation.findFirst({
                where: { id: conv.id, organizationId },
            });
            if (stillLinked?.metadata?.botId !== botId ||
                !enabled?.config?.zaloAutoReply ||
                freshConv?.humanTakeover)
                continue;
            const pending = await this.prisma.chatbotMessage.create({
                data: {
                    conversationId: conv.id,
                    role: 'assistant',
                    message: result.reply,
                    status: 'SENDING',
                    senderType: 'BOT',
                    direction: 'OUTBOUND',
                    metadata: {
                        evidence: result.evidence || [],
                        blockedCode: result.blockedCode || null,
                    },
                },
            });
            try {
                const { accessToken } = await this.connections.ensureFreshZaloAccessToken(organizationId, connection.id);
                const sent = await (0, shared_1.sendZaloOaHttp)({
                    accessToken,
                    recipientId: event.externalUserId,
                    text: result.reply.slice(0, 2000),
                });
                await this.prisma.chatbotMessage.update({
                    where: { id: pending.id },
                    data: {
                        status: sent.success ? 'SENT' : 'FAILED',
                        errorCode: sent.success ? null : 'ZALO_SEND_ERROR',
                    },
                });
            }
            catch {
                await this.prisma.chatbotMessage.update({
                    where: { id: pending.id },
                    data: { status: 'FAILED', errorCode: 'ZALO_SEND_ERROR' },
                });
            }
            if (result.usedAi)
                await this.chatbot.recordAiReplyUsage(organizationId, botId);
            await this.prisma.chatbotConversation.update({
                where: { id: conv.id },
                data: { lastUserMessageAt: new Date() },
            });
        }
    }
};
exports.ChatbotZaloKnowledgeService = ChatbotZaloKnowledgeService;
exports.ChatbotZaloKnowledgeService = ChatbotZaloKnowledgeService = ChatbotZaloKnowledgeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        chatbot_cskh_service_1.ChatbotCskhService,
        openai_service_1.OpenAiService,
        messaging_webhook_ingress_service_1.MessagingWebhookIngressService,
        channel_connections_service_1.ChannelConnectionsService])
], ChatbotZaloKnowledgeService);
