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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatbotCskhPublicService = void 0;
const plan_billed_chat_1 = require("./utils/plan-billed-chat");
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const openai_service_1 = require("../openai/openai.service");
const chatbot_cskh_service_1 = require("./chatbot-cskh.service");
const events_gateway_1 = require("../events/events.gateway");
const leads_service_1 = require("../leads/leads.service");
const chatbot_ai_util_1 = require("./utils/chatbot-ai.util");
const chatbot_constants_1 = require("./utils/chatbot-constants");
function parseAttributionFromPageUrl(pageUrl) {
    if (!pageUrl)
        return undefined;
    try {
        const u = new URL(pageUrl);
        const q = u.searchParams;
        const get = (k) => q.get(k) || undefined;
        return {
            channel: (get('gclid')
                ? database_1.AdPlatform.GOOGLE
                : get('fbclid')
                    ? database_1.AdPlatform.META
                    : database_1.AdPlatform.OTHER),
            utmSource: get('utm_source'),
            utmMedium: get('utm_medium'),
            utmCampaign: get('utm_campaign'),
            utmContent: get('utm_content'),
            utmTerm: get('utm_term'),
            fbclid: get('fbclid'),
            gclid: get('gclid'),
            landingPage: pageUrl,
            referrer: get('referrer') || get('utm_referrer'),
        };
    }
    catch {
        return { landingPage: pageUrl, channel: database_1.AdPlatform.OTHER };
    }
}
let ChatbotCskhPublicService = class ChatbotCskhPublicService {
    prisma;
    chatbot;
    openAi;
    events;
    leads;
    rateLimits = new Map();
    minIntervalMs = 2000;
    constructor(prisma, chatbot, openAi, events, leads) {
        this.prisma = prisma;
        this.chatbot = chatbot;
        this.openAi = openAi;
        this.events = events;
        this.leads = leads;
    }
    async getPublicConfig(botId, pageUrl = '', origin = '') {
        const evalResult = await this.evaluateBot(botId, pageUrl, origin);
        if (!evalResult.allowed) {
            return { ok: true, blocked: true, ...evalResult };
        }
        return { ok: true, blocked: false, ...evalResult };
    }
    async processMessage(dto, origin = '', referer = '') {
        const evalResult = await this.evaluateBot(dto.botId, dto.pageUrl ?? '', origin, referer);
        if (!evalResult.allowed) {
            return {
                ok: false,
                message: evalResult.message,
                reply: evalResult.message,
                code: evalResult.code,
            };
        }
        const rateKey = `${dto.botId}:${dto.sessionId ?? 'anon'}`;
        if (!this.checkRateLimit(rateKey)) {
            return {
                ok: false,
                code: 'rate_limited',
                message: 'Bạn gửi tin nhắn quá nhanh. Vui lòng đợi vài giây rồi thử lại.',
                reply: 'Bạn gửi tin nhắn quá nhanh. Vui lòng đợi vài giây rồi thử lại.',
            };
        }
        const bot = await this.chatbot.findBotPublic(dto.botId);
        if (!bot) {
            return { ok: false, message: 'Chatbot không hợp lệ.', reply: 'Chatbot không hợp lệ.' };
        }
        const sessionId = this.normalizeSession(dto.sessionId);
        const conversation = await this.getOrCreateConversation(bot.organizationId, bot.id, sessionId);
        const userMessage = await this.prisma.chatbotMessage.create({
            data: {
                conversationId: conversation.id,
                role: 'user',
                message: dto.message.trim(),
            },
        });
        try {
            this.events.broadcastChatbotMessageNew(bot.organizationId, {
                conversationId: conversation.id,
                channel: 'website',
                preview: dto.message.trim().slice(0, 120),
                visitorName: conversation.visitorName || undefined,
                botId: bot.id,
            });
        }
        catch {
            /* ignore realtime errors */
        }
        if (conversation.humanTakeover) {
            const staffMsg = 'Nhân viên đang hỗ trợ bạn. Bot đã tạm dừng — vui lòng chờ phản hồi từ spa.';
            await this.prisma.chatbotMessage.create({
                data: {
                    conversationId: conversation.id,
                    role: 'system',
                    message: staffMsg,
                },
            });
            return {
                ok: true,
                reply: staffMsg,
                human_takeover: true,
                conversation_id: conversation.id,
                linked_lead_id: conversation.linkedLeadId,
            };
        }
        const [sources, history, settings, usage] = await Promise.all([
            bot.knowledgeBaseId ? Promise.resolve([]) : this.prisma.chatbotKnowledgeSource.findMany({
                where: { organizationId: bot.organizationId, botId: bot.id, status: { in: ['active', 'ready'] } },
            }),
            this.prisma.chatbotMessage.findMany({
                where: { conversationId: conversation.id, id: { not: userMessage.id } },
                orderBy: { createdAt: 'desc' },
                take: 20,
            }),
            this.chatbot.getSettings(bot.organizationId),
            this.chatbot.getUsageSnapshot(bot.organizationId),
        ]);
        const openAiChat = (0, plan_billed_chat_1.planBilledChat)(this.prisma, bot.organizationId, this.openAi.isConfigured()
            ? async (input) => this.openAi.chatCompletion({
                model: input.model,
                temperature: input.temperature,
                maxTokens: 500,
                responseFormat: input.responseFormat,
                messages: [
                    { role: 'system', content: input.systemPrompt },
                    ...input.history.slice(-8),
                    { role: 'user', content: input.userText },
                ],
            })
            : undefined);
        history.reverse();
        const knowledge = await this.chatbot.getReplyKnowledge(bot.organizationId, bot.id, dto.message, history);
        let aiResult = await (0, chatbot_ai_util_1.generateAiReply)({
            bot,
            userText: dto.message,
            sources,
            knowledge,
            history,
            settings,
            usageAllowed: usage.allowed,
            openAiChat,
        });
        aiResult = await this.chatbot.guardReplyKnowledge(bot.organizationId, bot.id, knowledge, aiResult);
        await this.prisma.chatbotMessage.create({
            data: {
                conversationId: conversation.id,
                role: 'assistant',
                message: aiResult.reply,
                metadata: { retrievalMode: knowledge?.mode || 'legacy', evidence: aiResult.evidence || [], blockedCode: aiResult.blockedCode || null },
            },
        });
        await this.prisma.chatbotConversation.update({
            where: { id: conversation.id },
            data: { lastUserMessageAt: new Date(), updatedAt: new Date() },
        });
        if (aiResult.usedAi) {
            await this.incrementUsage(bot.organizationId, bot.id);
        }
        return {
            ok: true,
            reply: aiResult.reply,
            session_id: sessionId,
            show_lead: aiResult.showLead,
            no_data: aiResult.noData,
            used_ai: aiResult.usedAi,
            evidence: aiResult.evidence || [],
        };
    }
    async submitLead(dto) {
        const evalResult = await this.evaluateBot(dto.botId, dto.pageUrl ?? '');
        if (!evalResult.allowed) {
            return { ok: false, message: evalResult.message, code: evalResult.code };
        }
        const bot = await this.chatbot.findBotPublic(dto.botId);
        if (!bot) {
            return { ok: false, message: 'Chatbot không hợp lệ.' };
        }
        const sessionId = this.normalizeSession(dto.sessionId);
        const conversation = await this.getOrCreateConversation(bot.organizationId, bot.id, sessionId);
        const lead = await this.prisma.chatbotLead.create({
            data: {
                organizationId: bot.organizationId,
                botId: bot.id,
                conversationId: conversation.id,
                name: dto.name,
                phone: dto.phone,
                need: dto.need,
                pageUrl: dto.pageUrl,
            },
        });
        await this.prisma.chatbotConversation.update({
            where: { id: conversation.id },
            data: {
                visitorName: dto.name || conversation.visitorName,
                visitorPhone: dto.phone,
                status: 'NEEDS_STAFF',
            },
        });
        const leadSource = await this.prisma.leadSource.findFirst({
            where: { organizationId: bot.organizationId, code: 'CHATBOT' },
        });
        if (leadSource) {
            const crmLead = await this.leads.create(bot.organizationId, {
                leadSourceId: leadSource.id,
                name: dto.name || 'Khách chatbot',
                phone: dto.phone,
                note: dto.need || 'Lead từ Chatbot CSKH',
                attribution: parseAttributionFromPageUrl(dto.pageUrl),
            });
            await this.prisma.chatbotConversation.update({
                where: { id: conversation.id },
                data: { linkedLeadId: crmLead.id, visitorPhone: dto.phone },
            });
        }
        return {
            ok: true,
            message: 'Cảm ơn bạn! Nhân viên sẽ liên hệ sớm nhất.',
            lead_id: lead.id,
        };
    }
    async evaluateBot(botId, pageUrl = '', origin = '', referer = '') {
        const bot = await this.chatbot.findBotPublic(botId);
        if (!bot) {
            return { allowed: false, code: 'not_found', message: 'Chatbot không khả dụng.' };
        }
        if (!this.validateOrigin(bot.allowedDomains, origin, referer, pageUrl)) {
            return {
                allowed: false,
                code: 'origin_denied',
                message: 'Chatbot không khả dụng trên website này.',
            };
        }
        if (bot.status !== database_1.ChatbotBotStatus.ACTIVE) {
            const code = bot.status === 'PAUSED' ? 'bot_paused' : 'bot_inactive';
            return {
                allowed: false,
                code,
                message: code === 'bot_paused'
                    ? 'Chatbot đang bảo trì. Bạn có thể gọi hotline trên website.'
                    : 'Chatbot đang tạm dừng. Vui lòng liên hệ trực tiếp qua website.',
            };
        }
        const usage = await this.chatbot.getUsageSnapshot(bot.organizationId);
        if (!usage.allowed) {
            return {
                allowed: false,
                code: 'limit_exceeded',
                message: chatbot_constants_1.CREDIT_EXHAUSTED_MESSAGE,
                usage: { used: usage.used, limit: usage.limit, remaining: usage.remaining },
            };
        }
        const greeting = bot.greeting?.trim() ||
            (0, chatbot_constants_1.defaultGreeting)(bot.botName, bot.businessName ?? '', bot.consultationTone);
        return {
            allowed: true,
            code: 'ok',
            bot_id: bot.id,
            bot_name: bot.botName,
            business_name: bot.businessName ?? '',
            hotline: bot.hotline ?? '',
            greeting,
            avatar_url: '/chatbot/cskh-launcher.png',
        };
    }
    validateOrigin(allowedDomains, origin, referer, pageUrl) {
        const allowed = (allowedDomains ?? '')
            .split(/[,\s;]+/)
            .map((d) => d.trim().toLowerCase())
            .filter(Boolean);
        if (!allowed.length)
            return true;
        const candidates = [origin, referer, pageUrl].filter(Boolean);
        for (const url of candidates) {
            try {
                const host = new URL(url).hostname.toLowerCase();
                if (allowed.some((d) => host === d || host.endsWith(`.${d}`)))
                    return true;
            }
            catch {
                /* skip invalid url */
            }
        }
        return false;
    }
    checkRateLimit(key) {
        const now = Date.now();
        const bucket = this.rateLimits.get(key);
        if (!bucket || now > bucket.resetAt) {
            this.rateLimits.set(key, { count: 1, resetAt: now + this.minIntervalMs });
            return true;
        }
        if (bucket.count >= 3)
            return false;
        bucket.count += 1;
        return true;
    }
    normalizeSession(sessionId) {
        const s = (sessionId ?? '').trim();
        if (s.length >= 8 && s.length <= 64)
            return s;
        return this.chatbot.newSessionId();
    }
    async getOrCreateConversation(organizationId, botId, sessionId) {
        const existing = await this.prisma.chatbotConversation.findUnique({
            where: { botId_sessionId: { botId, sessionId } },
        });
        if (existing)
            return existing;
        return this.prisma.chatbotConversation.create({
            data: {
                organizationId,
                botId,
                sessionId,
                channel: 'website',
                status: 'OPEN',
            },
        });
    }
    async incrementUsage(organizationId, botId) {
        const month = new Date().toISOString().slice(0, 7);
        await this.prisma.chatbotUsage.upsert({
            where: {
                organizationId_month_botId: { organizationId, month, botId },
            },
            create: { organizationId, botId, month, aiReplies: 1 },
            update: { aiReplies: { increment: 1 } },
        });
    }
};
exports.ChatbotCskhPublicService = ChatbotCskhPublicService;
exports.ChatbotCskhPublicService = ChatbotCskhPublicService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        chatbot_cskh_service_1.ChatbotCskhService,
        openai_service_1.OpenAiService,
        events_gateway_1.EventsGateway,
        leads_service_1.LeadsService])
], ChatbotCskhPublicService);
