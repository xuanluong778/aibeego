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
var LandingPageChatbotService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LandingPageChatbotService = void 0;
const plan_billed_chat_1 = require("../chatbot-cskh/utils/plan-billed-chat");
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../prisma/prisma.service");
const rate_limit_service_1 = require("../common/services/rate-limit.service");
const chatbot_cskh_service_1 = require("../chatbot-cskh/chatbot-cskh.service");
const openai_service_1 = require("../openai/openai.service");
const events_gateway_1 = require("../events/events.gateway");
const leads_service_1 = require("../leads/leads.service");
const database_2 = require("@marketingspa/database");
const landing_page_chatbot_context_1 = require("./landing-page-chatbot-context");
const landing_page_chatbot_replies_1 = require("./landing-page-chatbot-replies");
const landing_page_chatbot_notification_service_1 = require("./landing-page-chatbot-notification.service");
const chatbot_constants_1 = require("../chatbot-cskh/utils/chatbot-constants");
const landing_page_chatbot_rollout_util_1 = require("./landing-page-chatbot-rollout.util");
let LandingPageChatbotService = LandingPageChatbotService_1 = class LandingPageChatbotService {
    prisma;
    rateLimit;
    chatbot;
    openAi;
    events;
    leads;
    notifications;
    logger = new common_1.Logger(LandingPageChatbotService_1.name);
    constructor(prisma, rateLimit, chatbot, openAi, events, leads, notifications) {
        this.prisma = prisma;
        this.rateLimit = rateLimit;
        this.chatbot = chatbot;
        this.openAi = openAi;
        this.events = events;
        this.leads = leads;
        this.notifications = notifications;
    }
    async assertChatbotReadyForPublish(organizationId, spec) {
        const cfg = spec.chatbot;
        if (!cfg?.enabled)
            return;
        (0, landing_page_chatbot_rollout_util_1.assertLpChatbotOrgTrialAllowed)(organizationId);
        await this.resolveBindings(organizationId, cfg, true);
    }
    readChatbot(spec) {
        return (0, shared_1.sanitizeLandingPageChatbotConfig)(spec.chatbot);
    }
    pickHostname(origin, referer) {
        for (const raw of [origin, referer]) {
            if (!raw?.trim())
                continue;
            try {
                return new URL(raw).hostname.toLowerCase();
            }
            catch {
                /* skip */
            }
        }
        return null;
    }
    pageHostKeys(page) {
        const hosts = new Set();
        if (page.customDomain?.trim())
            hosts.add(page.customDomain.trim().toLowerCase());
        if (page.subdomainSlug?.trim()) {
            const base = (process.env.LANDING_PAGE_PUBLIC_HOST || process.env.WEB_PUBLIC_HOST || '')
                .trim()
                .toLowerCase();
            if (base)
                hosts.add(`${page.subdomainSlug.trim().toLowerCase()}.${base}`);
        }
        hosts.add('localhost');
        hosts.add('127.0.0.1');
        return [...hosts];
    }
    hostMatchesPage(page, host) {
        if (!host)
            return false;
        const keys = this.pageHostKeys(page);
        return keys.some((h) => host === h || host.endsWith(`.${h}`));
    }
    async resolvePageBySlug(slug, organizationId, previewToken, origin, referer) {
        const slugClean = String(slug || '').trim();
        if (!slugClean)
            return null;
        if (previewToken) {
            const clean = String(previewToken).replace(/[^a-f0-9]/gi, '').slice(0, 64);
            if (clean.length < 32)
                return null;
            const row = await this.prisma.landingPage.findFirst({
                where: {
                    previewToken: clean,
                    previewExpiresAt: { gt: new Date() },
                    status: { not: database_1.LandingPageStatus.ARCHIVED },
                },
            });
            if (!row || row.slug !== slugClean)
                return null;
            const spec = row.draftSpec;
            const chatbot = this.readChatbot(spec);
            if (!chatbot?.enabled || !chatbot.botId)
                return null;
            const bind = await this.resolveBindings(row.organizationId, chatbot, false);
            if (!bind)
                return null;
            return {
                id: row.id,
                organizationId: row.organizationId,
                slug: row.slug,
                status: row.status,
                customDomain: row.customDomain,
                customDomainStatus: row.customDomainStatus,
                subdomainSlug: row.subdomainSlug,
                spec,
                chatbot,
                preview: true,
            };
        }
        const orgFilter = organizationId?.trim();
        const matches = await this.prisma.landingPage.findMany({
            where: {
                slug: slugClean,
                status: database_1.LandingPageStatus.PUBLISHED,
                ...(orgFilter ? { organizationId: orgFilter } : {}),
            },
            orderBy: { publishedAt: 'desc' },
        });
        if (!matches.length)
            return null;
        let row = matches[0];
        if (matches.length > 1 && !orgFilter) {
            const host = this.pickHostname(origin ?? '', referer ?? '');
            const narrowed = matches.filter((m) => this.hostMatchesPage(m, host));
            if (narrowed.length === 1)
                row = narrowed[0];
            else
                return null;
        }
        if (!row)
            return null;
        if (!row.publishedSpec)
            return null;
        const spec = row.publishedSpec;
        const chatbot = this.readChatbot(spec);
        if (!chatbot?.enabled || !chatbot.botId)
            return null;
        const bind = await this.resolveBindings(row.organizationId, chatbot, false);
        if (!bind)
            return null;
        return {
            id: row.id,
            organizationId: row.organizationId,
            slug: row.slug,
            status: row.status,
            customDomain: row.customDomain,
            customDomainStatus: row.customDomainStatus,
            subdomainSlug: row.subdomainSlug,
            spec,
            chatbot,
            preview: false,
        };
    }
    rolloutDeny(page) {
        return (0, landing_page_chatbot_rollout_util_1.lpChatbotPublicDenyCode)(page.organizationId, {
            customDomain: page.customDomain,
            customDomainStatus: page.customDomainStatus,
        }, { preview: page.preview });
    }
    /** Anti-hotlink for custom domain only; authorization is page↔bot↔org in resolvePageBySlug. */
    hostAllowed(page, origin, referer) {
        const custom = String(page.customDomain || '').trim();
        if (!custom)
            return true;
        if (page.preview)
            return true;
        const host = this.pickHostname(origin, referer);
        if (!host)
            return false;
        const customLow = custom.toLowerCase();
        return host === customLow || host.endsWith(`.${customLow}`);
    }
    async resolveBindings(organizationId, cfg, strict) {
        if (!cfg.botId) {
            if (strict)
                throw new common_1.BadRequestException('Chatbot: thiếu bot.');
            return null;
        }
        const bot = await this.prisma.chatbotBot.findFirst({
            where: { id: cfg.botId, organizationId },
        });
        if (!bot) {
            if (strict)
                throw new common_1.BadRequestException('Chatbot: bot không thuộc tổ chức.');
            return null;
        }
        if (bot.status !== database_1.ChatbotBotStatus.ACTIVE) {
            if (strict)
                throw new common_1.BadRequestException('Chatbot: bot chưa ACTIVE.');
            return null;
        }
        const scope = cfg.knowledgeSourceIds?.length ? cfg.knowledgeSourceIds : undefined;
        const ready = await this.chatbot.getReadyKnowledge(organizationId, bot.id);
        const legacy = scope ? ready.filter(source => scope.includes(source.id)) : ready;
        const sharedKb = bot.knowledgeBaseId
            ? await this.loadSharedKbKnowledgeSources(organizationId, bot.knowledgeBaseId, bot.id)
            : [];
        let sources = bot.knowledgeBaseId ? sharedKb : legacy;
        let effectiveScope = scope;
        if (scope?.length) {
            const scoped = sources.filter(source => scope.includes(source.id));
            if (scoped.length)
                sources = scoped;
            else
                effectiveScope = undefined;
        }
        const sharedCount = bot.knowledgeBaseId
            ? await this.prisma.ragKbDocument.count({
                where: {
                    organizationId,
                    knowledgeBaseId: bot.knowledgeBaseId,
                    knowledgeBase: { organizationId },
                    status: { in: ['ready', 'active'] },
                    OR: [{ sourceId: null }, { source: { is: { enabled: true, deletedAt: null } } }],
                },
            })
            : 0;
        const knowledgeCount = bot.knowledgeBaseId ? Math.max(sharedCount, sources.length) : sources.length;
        if (strict && !knowledgeCount) {
            throw new common_1.BadRequestException('Chatbot: không có nguồn tri thức sẵn sàng trong phạm vi đã chọn.');
        }
        const local = (0, shared_1.validateLandingPageChatbotConfigLocal)(cfg, {
            requireKnowledge: strict,
            knowledgeCount,
        });
        if (strict && !local.ok) {
            throw new common_1.BadRequestException(local.errors.join('; '));
        }
        return { bot, sources, knowledgeSourceIds: effectiveScope };
    }
    /** Map shared RAG KB markdown into the LP knowledge parser (id prefix `rag:`). */
    async loadSharedKbKnowledgeSources(organizationId, knowledgeBaseId, botId) {
        const docs = await this.prisma.ragKbDocument.findMany({
            where: {
                organizationId,
                knowledgeBaseId,
                status: { in: ['ready', 'active'] },
                OR: [{ sourceId: null }, { source: { is: { enabled: true, deletedAt: null } } }],
            },
            orderBy: { updatedAt: 'desc' },
            select: { id: true, title: true, content: true, status: true, updatedAt: true },
        });
        return docs.map(doc => ({
            id: `rag:${doc.id}`,
            organizationId,
            botId,
            sourceType: database_1.ChatbotSourceType.MANUAL,
            title: doc.title,
            url: null,
            content: doc.content,
            status: doc.status,
            crawlError: null,
            createdAt: doc.updatedAt,
            updatedAt: doc.updatedAt,
        }));
    }
    async getPublicConfig(slug, organizationId, previewToken, origin, referer) {
        const page = await this.resolvePageBySlug(slug, organizationId, previewToken, origin, referer);
        if (!page)
            return { ok: true, enabled: false };
        if (!this.hostAllowed(page, origin, referer)) {
            return { ok: true, enabled: false, code: 'origin_denied' };
        }
        const deny = this.rolloutDeny(page);
        if (deny) {
            return { ok: true, enabled: false, code: deny };
        }
        const bind = await this.resolveBindings(page.organizationId, page.chatbot, false);
        if (!bind)
            return { ok: true, enabled: false };
        const { bot } = bind;
        const greet = page.chatbot.greeting?.trim() ||
            bot.greeting?.trim() ||
            (0, chatbot_constants_1.defaultGreeting)(bot.botName, bot.businessName ?? '', bot.consultationTone);
        const publicCfg = (0, shared_1.buildLandingPageChatbotPublicConfig)({
            pageId: page.id,
            slug: page.slug,
            config: page.chatbot,
            fallbackBotName: bot.botName,
            fallbackGreeting: greet,
            hotline: bot.hotline ?? undefined,
        });
        return {
            ok: true,
            enabled: true,
            preview: page.preview,
            config: publicCfg,
        };
    }
    async processMessage(slug, dto, organizationId, previewToken, origin, referer, ip) {
        const page = await this.resolvePageBySlug(slug, organizationId, previewToken, origin, referer);
        if (!page) {
            return { ok: false, message: 'Chatbot không khả dụng trên trang này.', reply: 'Chatbot không khả dụng.' };
        }
        if (!this.hostAllowed(page, origin, referer)) {
            return { ok: false, code: 'origin_denied', message: 'Chatbot không khả dụng trên tên miền này.' };
        }
        const deny = this.rolloutDeny(page);
        if (deny) {
            return {
                ok: false,
                code: deny,
                message: 'Chatbot landing page đang thử nghiệm có kiểm soát.',
                reply: 'Chatbot tạm không khả dụng trên trang này.',
            };
        }
        if (page.preview) {
            try {
                this.rateLimit.assertWithinLimit(`lp:cb:preview:ip:${ip || 'na'}`, 45, 60_000, 'Quá nhiều tin nhắn preview');
                this.rateLimit.assertWithinLimit(`lp:cb:preview:page:${page.id}`, 150, 60_000, 'Preview chatbot tạm giới hạn');
            }
            catch (err) {
                if (err instanceof common_1.HttpException && err.getStatus() === 429) {
                    const message = typeof err.getResponse() === 'string'
                        ? err.getResponse()
                        : err.getResponse()?.message || 'Quá nhiều yêu cầu';
                    return {
                        ok: false,
                        code: 'rate_limited',
                        message: String(message),
                        reply: String(message),
                        preview: true,
                    };
                }
                throw err;
            }
        }
        const rateKey = `lp:cb:${page.id}:${ip || 'na'}:${dto.sessionId || 'anon'}`;
        try {
            this.rateLimit.assertWithinLimit(rateKey, 30, 60_000, 'Quá nhiều tin nhắn chatbot');
            this.rateLimit.assertWithinLimit(`lp:cb:page:${page.id}`, 400, 60_000, 'Chatbot tạm giới hạn');
        }
        catch (err) {
            if (err instanceof common_1.HttpException && err.getStatus() === 429) {
                const message = typeof err.getResponse() === 'string'
                    ? err.getResponse()
                    : err.getResponse()?.message || 'Quá nhiều yêu cầu';
                return {
                    ok: false,
                    code: 'rate_limited',
                    message: String(message),
                    reply: String(message),
                };
            }
            throw err;
        }
        const bind = await this.resolveBindings(page.organizationId, page.chatbot, false);
        if (!bind) {
            return { ok: false, message: 'Chatbot chưa sẵn sàng.', reply: 'Chatbot chưa sẵn sàng.' };
        }
        const { bot, sources, knowledgeSourceIds } = bind;
        const usage = await this.chatbot.getUsageSnapshot(page.organizationId);
        if (!usage.allowed && !page.preview) {
            // Preserve the quota guard and return before any AI call or conversation write.
            const declined = (0, landing_page_chatbot_replies_1.declinesLandingPageContact)(dto.message);
            return {
                ok: true,
                code: 'limit_exceeded',
                reply: declined ? 'Dạ, em tiếp tục tư vấn trực tiếp tại đây. Anh/chị muốn tìm hiểu thêm nội dung nào ạ?' : landing_page_chatbot_replies_1.LANDING_PAGE_HANDOFF_REPLY,
                show_lead: !declined && page.chatbot.enableHandoff !== false,
                no_data: true,
                used_ai: false,
            };
        }
        const sessionId = this.normalizeSession(dto.sessionId, page.preview);
        const conversation = await this.getOrCreateConversation(page, bot.id, sessionId);
        const userText = String(dto.message || '').trim().slice(0, 2000);
        if (!userText) {
            return { ok: false, message: 'Tin nhắn trống.', reply: 'Vui lòng nhập nội dung.' };
        }
        const userMessage = await this.prisma.chatbotMessage.create({
            data: { conversationId: conversation.id, role: 'user', message: userText },
        });
        if (conversation.humanTakeover) {
            const staffMsg = 'Nhân viên đang hỗ trợ bạn. Vui lòng chờ phản hồi.';
            await this.prisma.chatbotMessage.create({
                data: { conversationId: conversation.id, role: 'system', message: staffMsg },
            });
            return { ok: true, reply: staffMsg, human_takeover: true, conversation_id: conversation.id };
        }
        const [history, settings] = await Promise.all([
            this.prisma.chatbotMessage.findMany({
                where: { conversationId: conversation.id, id: { not: userMessage.id } },
                orderBy: { createdAt: 'desc' },
                take: 24,
            }),
            this.chatbot.getSettings(page.organizationId),
        ]);
        const openAiChat = (0, plan_billed_chat_1.planBilledChat)(this.prisma, page.organizationId, this.openAi.isConfigured()
            ? async (input) => this.openAi.chatCompletion({
                model: input.model,
                temperature: input.temperature,
                maxTokens: 500,
                responseFormat: input.responseFormat || 'json_object',
                messages: [
                    { role: 'system', content: input.systemPrompt },
                    ...input.history.slice(-12),
                    { role: 'user', content: input.userText },
                ],
            })
            : undefined);
        const previousState = history.find(message => {
            const meta = message.metadata;
            return message.role === 'assistant' && meta?.landingPageId === page.id && Boolean(meta.conversationState);
        })?.metadata;
        const knowledge = await this.chatbot.getReplyKnowledge(page.organizationId, bot.id, userText, [...history].reverse());
        let aiResult = await (0, landing_page_chatbot_replies_1.generateLandingPageChatbotReply)({
            bot,
            userText,
            sources,
            knowledge,
            history: history.reverse(),
            conversationState: (0, landing_page_chatbot_context_1.readLandingPageConversationState)(previousState?.conversationState),
            settings,
            usageAllowed: usage.allowed || page.preview,
            openAiChat,
            knowledgeSourceIds: knowledgeSourceIds ?? page.chatbot.knowledgeSourceIds,
            customGreeting: page.chatbot.greeting,
            enableHandoff: page.chatbot.enableHandoff,
        });
        aiResult = await this.chatbot.guardReplyKnowledge(page.organizationId, bot.id, knowledge, aiResult);
        await this.prisma.chatbotMessage.create({
            data: {
                conversationId: conversation.id,
                role: 'assistant',
                message: aiResult.reply,
                metadata: {
                    landingPageId: page.id,
                    conversationState: aiResult.conversationState,
                    answerMode: aiResult.answerMode || 'knowledge',
                    ...(aiResult.evidence?.length ? { evidence: aiResult.evidence } : {}),
                },
            },
        });
        await this.prisma.chatbotConversation.update({
            where: { id: conversation.id },
            data: { lastUserMessageAt: new Date(), updatedAt: new Date() },
        });
        if (aiResult.usedAi && !page.preview) {
            await this.chatbot.recordAiReplyUsage(page.organizationId, bot.id);
        }
        else if (aiResult.usedAi && page.preview) {
            this.logger.log(JSON.stringify({
                event: 'lp_chatbot_preview_ai',
                organizationId: page.organizationId,
                landingPageId: page.id,
                botId: bot.id,
                conversationId: conversation.id,
            }));
        }
        try {
            if (!page.preview) {
                this.events.broadcastChatbotMessageNew(page.organizationId, {
                    conversationId: conversation.id,
                    channel: 'website',
                    preview: userText.slice(0, 120),
                    botId: bot.id,
                });
            }
        }
        catch {
            /* ignore */
        }
        return {
            ok: true,
            reply: aiResult.reply,
            session_id: sessionId,
            show_lead: page.chatbot.enableHandoff !== false && aiResult.showLead,
            contact_requested: (0, landing_page_chatbot_replies_1.requestsLandingPageContact)(userText),
            no_data: aiResult.noData,
            used_ai: aiResult.usedAi,
            preview: page.preview,
            ...(aiResult.evidence?.length ? { evidence: aiResult.evidence } : {}),
        };
    }
    async submitLead(slug, dto, organizationId, previewToken, ip, origin, referer) {
        if (previewToken) {
            const page = await this.resolvePageBySlug(slug, organizationId, previewToken, origin, referer);
            if (!page?.preview) {
                throw new common_1.NotFoundException('Preview không hợp lệ hoặc đã hết hạn');
            }
            return { ok: true, message: 'Xem trước — không ghi lead.', preview: true, skipped: true };
        }
        const page = await this.resolvePageBySlug(slug, organizationId, undefined, origin, referer);
        if (!page?.chatbot.enableHandoff) {
            throw new common_1.NotFoundException('Handoff không bật');
        }
        const deny = this.rolloutDeny(page);
        if (deny) {
            throw new common_1.BadRequestException({
                code: deny,
                message: 'Chatbot lead handoff tạm không khả dụng trên trang này.',
            });
        }
        try {
            this.rateLimit.assertWithinLimit(`lp:cb:lead:${page.id}:${ip || 'na'}`, 8, 60_000, 'Quá nhiều gửi lead');
        }
        catch (err) {
            if (err instanceof common_1.HttpException && err.getStatus() === 429)
                throw err;
            throw err;
        }
        const bind = await this.resolveBindings(page.organizationId, page.chatbot, false);
        if (!bind)
            throw new common_1.BadRequestException('Chatbot không hợp lệ');
        const { bot } = bind;
        const phone = String(dto.phone || '')
            .replace(/\s+/g, '')
            .slice(0, 32);
        const name = String(dto.name || 'Khách chatbot').trim().slice(0, 120);
        const email = String(dto.email || '').trim().toLowerCase().slice(0, 160);
        if (!phone && !email)
            throw new common_1.BadRequestException('Vui lòng nhập số điện thoại hoặc email để nhân viên liên hệ.');
        if (phone && !/^\+?[0-9().-]{6,32}$/.test(phone))
            throw new common_1.BadRequestException('Số điện thoại không hợp lệ.');
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            throw new common_1.BadRequestException('Email không hợp lệ.');
        const sessionId = this.normalizeSession(dto.sessionId, false);
        const conversation = await this.getOrCreateConversation(page, bot.id, sessionId);
        const recentDup = await this.prisma.chatbotLead.findFirst({
            where: {
                conversationId: conversation.id,
                ...(phone ? { phone } : { phone: null, need: { contains: `Email liên hệ: ${email}\n` } }),
                createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
            },
            orderBy: { createdAt: 'desc' },
        });
        const pageUrl = (dto.pageUrl || '').slice(0, 2000);
        const need = `${email ? `Email liên hệ: ${email}\n` : ''}${dto.need || `Lead landing page «${slug}» (chatbot widget)`}`.slice(0, 2000);
        const lead = recentDup || await this.prisma.chatbotLead.create({
            data: {
                organizationId: page.organizationId,
                botId: bot.id,
                conversationId: conversation.id,
                name,
                phone: phone || null,
                need,
                pageUrl,
            },
        });
        await this.prisma.chatbotConversation.update({
            where: { id: conversation.id },
            data: {
                visitorName: name || conversation.visitorName,
                ...(phone ? { visitorPhone: phone } : {}),
                status: 'NEEDS_STAFF',
            },
        });
        const leadSource = await this.prisma.leadSource.upsert({
            where: { organizationId_code: { organizationId: page.organizationId, code: 'CHATBOT' } },
            create: { organizationId: page.organizationId, code: 'CHATBOT', name: 'Chatbot', isActive: true }, update: {},
        });
        const crm = (0, shared_1.resolveLeadFormBlockFromSpec)(page.spec)?.crm;
        let crmLead = recentDup && conversation.linkedLeadId ? await this.prisma.lead.findFirst({ where: { id: conversation.linkedLeadId, organizationId: page.organizationId, ...(phone ? { phone } : { email }) } }) : null;
        if (!crmLead)
            crmLead = await this.leads.create(page.organizationId, {
                leadSourceId: leadSource.id, name, phone: phone || undefined, email: email || undefined,
                landingPageId: page.id, pipelineId: crm?.pipelineId, stageId: crm?.stageId,
                assignedToId: crm?.assignedToId, autoAssign: crm?.autoAssign,
                note: `${need}\nlandingPageId=${page.id}`,
                attribution: { landingPage: pageUrl || `landing_page:${page.id}`, channel: database_2.AdPlatform.OTHER },
            });
        const crmLeadId = crmLead.id;
        await this.prisma.chatbotConversation.update({ where: { id: conversation.id }, data: { linkedLeadId: crmLeadId, ...(phone ? { visitorPhone: phone } : {}), ...(crmLead.assignedToId ? { assignedEmployeeId: crmLead.assignedToId } : {}) } });
        const notification = await this.notifications.enqueue({ organizationId: page.organizationId, landingPageId: page.id, slug: page.slug, chatbotLeadId: lead.id, crmLeadId, conversationId: conversation.id });
        return {
            ok: true,
            message: 'Thông tin đã được tiếp nhận. Nhân viên phụ trách sẽ liên hệ tư vấn cho anh/chị.',
            notification,
            deduped: Boolean(recentDup),
            lead_id: lead.id,
            crm_lead_id: crmLeadId,
            conversation_id: conversation.id,
            landing_page_id: page.id,
        };
    }
    normalizeSession(sessionId, preview) {
        const raw = String(sessionId || '').replace(/[^\w-]/g, '').slice(0, 80);
        const base = raw || `lp-${Date.now().toString(36)}`;
        return preview ? `preview-${base}` : base;
    }
    async getOrCreateConversation(page, botId, sessionId) {
        const channelRef = `landing_page:${page.id}`;
        const existing = await this.prisma.chatbotConversation.findUnique({
            where: { botId_sessionId: { botId, sessionId } },
        });
        if (existing)
            return existing;
        return this.prisma.chatbotConversation.create({
            data: {
                organizationId: page.organizationId,
                botId,
                sessionId,
                channel: page.preview ? 'landing_preview' : 'landing_page',
                channelRef,
            },
        });
    }
};
exports.LandingPageChatbotService = LandingPageChatbotService;
exports.LandingPageChatbotService = LandingPageChatbotService = LandingPageChatbotService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        rate_limit_service_1.RateLimitService,
        chatbot_cskh_service_1.ChatbotCskhService,
        openai_service_1.OpenAiService,
        events_gateway_1.EventsGateway,
        leads_service_1.LeadsService,
        landing_page_chatbot_notification_service_1.LandingPageChatbotNotificationService])
], LandingPageChatbotService);
