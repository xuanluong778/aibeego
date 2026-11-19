import {
  BadRequestException,
  Injectable,
  NotFoundException,
  HttpException,
  Logger,
} from '@nestjs/common';
import {
  ChatbotBotStatus,
  LandingPageDomainStatus,
  LandingPageStatus,
} from '@marketingspa/database';
import type { LandingPageChatbotConfig, LandingPageSpec } from '@marketingspa/shared';
import {
  buildLandingPageChatbotPublicConfig,
  sanitizeLandingPageChatbotConfig,
  validateLandingPageChatbotConfigLocal,
  resolveLeadFormBlockFromSpec,
} from '@marketingspa/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RateLimitService } from '../common/services/rate-limit.service';
import { ChatbotCskhService } from '../chatbot-cskh/chatbot-cskh.service';
import { OpenAiService } from '../openai/openai.service';
import { EventsGateway } from '../events/events.gateway';
import { LeadsService } from '../leads/leads.service';
import { AdPlatform } from '@marketingspa/database';
import { generateLandingPageChatbotReply, requestsLandingPageContact, declinesLandingPageContact, LANDING_PAGE_HANDOFF_REPLY } from './landing-page-chatbot-replies';
import { LandingPageChatbotNotificationService } from './landing-page-chatbot-notification.service';
import { CREDIT_EXHAUSTED_MESSAGE, defaultGreeting } from '../chatbot-cskh/utils/chatbot-constants';
import type { PublicMessageDto, PublicLeadDto } from '../chatbot-cskh/dto/chatbot-cskh.dto';
import {
  assertLpChatbotOrgTrialAllowed,
  lpChatbotPublicDenyCode,
} from './landing-page-chatbot-rollout.util';

type ResolvedPage = {
  id: string;
  organizationId: string;
  slug: string;
  status: LandingPageStatus;
  customDomain: string | null;
  customDomainStatus: LandingPageDomainStatus | null;
  subdomainSlug: string | null;
  spec: LandingPageSpec;
  chatbot: LandingPageChatbotConfig;
  preview: boolean;
};

@Injectable()
export class LandingPageChatbotService {
  private readonly logger = new Logger(LandingPageChatbotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rateLimit: RateLimitService,
    private readonly chatbot: ChatbotCskhService,
    private readonly openAi: OpenAiService,
    private readonly events: EventsGateway,
    private readonly leads: LeadsService,
    private readonly notifications: LandingPageChatbotNotificationService,
  ) {}

  async assertChatbotReadyForPublish(
    organizationId: string,
    spec: LandingPageSpec,
  ): Promise<void> {
    const cfg = spec.chatbot;
    if (!cfg?.enabled) return;
    assertLpChatbotOrgTrialAllowed(organizationId);
    await this.resolveBindings(organizationId, cfg, true);
  }

  private readChatbot(spec: LandingPageSpec): LandingPageChatbotConfig | undefined {
    return sanitizeLandingPageChatbotConfig(spec.chatbot);
  }

  private pickHostname(origin: string, referer: string): string | null {
    for (const raw of [origin, referer]) {
      if (!raw?.trim()) continue;
      try {
        return new URL(raw).hostname.toLowerCase();
      } catch {
        /* skip */
      }
    }
    return null;
  }

  private pageHostKeys(page: {
    customDomain: string | null;
    subdomainSlug: string | null;
  }): string[] {
    const hosts = new Set<string>();
    if (page.customDomain?.trim()) hosts.add(page.customDomain.trim().toLowerCase());
    if (page.subdomainSlug?.trim()) {
      const base = (process.env.LANDING_PAGE_PUBLIC_HOST || process.env.WEB_PUBLIC_HOST || '')
        .trim()
        .toLowerCase();
      if (base) hosts.add(`${page.subdomainSlug.trim().toLowerCase()}.${base}`);
    }
    hosts.add('localhost');
    hosts.add('127.0.0.1');
    return [...hosts];
  }

  private hostMatchesPage(
    page: { customDomain: string | null; subdomainSlug: string | null },
    host: string | null,
  ): boolean {
    if (!host) return false;
    const keys = this.pageHostKeys(page);
    return keys.some((h) => host === h || host.endsWith(`.${h}`));
  }

  private async resolvePageBySlug(
    slug: string,
    organizationId?: string,
    previewToken?: string,
    origin?: string,
    referer?: string,
  ): Promise<ResolvedPage | null> {
    const slugClean = String(slug || '').trim();
    if (!slugClean) return null;

    if (previewToken) {
      const clean = String(previewToken).replace(/[^a-f0-9]/gi, '').slice(0, 64);
      if (clean.length < 32) return null;
      const row = await this.prisma.landingPage.findFirst({
        where: {
          previewToken: clean,
          previewExpiresAt: { gt: new Date() },
          status: { not: LandingPageStatus.ARCHIVED },
        },
      });
      if (!row || row.slug !== slugClean) return null;
      const spec = row.draftSpec as LandingPageSpec;
      const chatbot = this.readChatbot(spec);
      if (!chatbot?.enabled || !chatbot.botId) return null;
      const bind = await this.resolveBindings(row.organizationId, chatbot, false);
      if (!bind) return null;
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
        status: LandingPageStatus.PUBLISHED,
        ...(orgFilter ? { organizationId: orgFilter } : {}),
      },
      orderBy: { publishedAt: 'desc' },
    });
    if (!matches.length) return null;

    let row = matches[0];
    if (matches.length > 1 && !orgFilter) {
      const host = this.pickHostname(origin ?? '', referer ?? '');
      const narrowed = matches.filter((m) => this.hostMatchesPage(m, host));
      if (narrowed.length === 1) row = narrowed[0];
      else return null;
    }

    if (!row) return null;
    if (!row.publishedSpec) return null;
    const spec = row.publishedSpec as LandingPageSpec;
    const chatbot = this.readChatbot(spec);
    if (!chatbot?.enabled || !chatbot.botId) return null;
    const bind = await this.resolveBindings(row.organizationId, chatbot, false);
    if (!bind) return null;
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

  private rolloutDeny(page: ResolvedPage): string | null {
    return lpChatbotPublicDenyCode(
      page.organizationId,
      {
        customDomain: page.customDomain,
        customDomainStatus: page.customDomainStatus,
      },
      { preview: page.preview },
    );
  }

  /** Anti-hotlink for custom domain only; authorization is page↔bot↔org in resolvePageBySlug. */
  private hostAllowed(page: ResolvedPage, origin: string, referer: string): boolean {
    const custom = String(page.customDomain || '').trim();
    if (!custom) return true;
    if (page.preview) return true;
    const host = this.pickHostname(origin, referer);
    if (!host) return false;
    const customLow = custom.toLowerCase();
    return host === customLow || host.endsWith(`.${customLow}`);
  }

  private async resolveBindings(
    organizationId: string,
    cfg: LandingPageChatbotConfig,
    strict: boolean,
  ) {
    if (!cfg.botId) {
      if (strict) throw new BadRequestException('Chatbot: thiếu bot.');
      return null;
    }
    const bot = await this.prisma.chatbotBot.findFirst({
      where: { id: cfg.botId, organizationId },
    });
    if (!bot) {
      if (strict) throw new BadRequestException('Chatbot: bot không thuộc tổ chức.');
      return null;
    }
    if (bot.status !== ChatbotBotStatus.ACTIVE) {
      if (strict) throw new BadRequestException('Chatbot: bot chưa ACTIVE.');
      return null;
    }

    const scope = cfg.knowledgeSourceIds?.length ? cfg.knowledgeSourceIds : undefined;
    const ready = await this.chatbot.getReadyKnowledge(organizationId, bot.id);
    const sources = scope ? ready.filter(source => scope.includes(source.id)) : ready;
    if (strict && !sources.length) {
      throw new BadRequestException(
        'Chatbot: không có nguồn tri thức sẵn sàng trong phạm vi đã chọn.',
      );
    }
  const local = validateLandingPageChatbotConfigLocal(cfg, {
      requireKnowledge: strict,
      knowledgeCount: sources.length,
    });
    if (strict && !local.ok) {
      throw new BadRequestException(local.errors.join('; '));
    }
    return { bot, sources };
  }

  async getPublicConfig(
    slug: string,
    organizationId: string | undefined,
    previewToken: string | undefined,
    origin: string,
    referer: string,
  ) {
    const page = await this.resolvePageBySlug(slug, organizationId, previewToken, origin, referer);
    if (!page) return { ok: true, enabled: false };
    if (!this.hostAllowed(page, origin, referer)) {
      return { ok: true, enabled: false, code: 'origin_denied' };
    }
    const deny = this.rolloutDeny(page);
    if (deny) {
      return { ok: true, enabled: false, code: deny };
    }
    const bind = await this.resolveBindings(page.organizationId, page.chatbot, false);
    if (!bind) return { ok: true, enabled: false };
    const { bot } = bind;
    const greet =
      page.chatbot.greeting?.trim() ||
      bot.greeting?.trim() ||
      defaultGreeting(bot.botName, bot.businessName ?? '', bot.consultationTone);
    const publicCfg = buildLandingPageChatbotPublicConfig({
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

  async processMessage(
    slug: string,
    dto: Omit<PublicMessageDto, 'botId'>,
    organizationId: string | undefined,
    previewToken: string | undefined,
    origin: string,
    referer: string,
    ip?: string,
  ) {
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
        this.rateLimit.assertWithinLimit(
          `lp:cb:preview:ip:${ip || 'na'}`,
          45,
          60_000,
          'Quá nhiều tin nhắn preview',
        );
        this.rateLimit.assertWithinLimit(
          `lp:cb:preview:page:${page.id}`,
          150,
          60_000,
          'Preview chatbot tạm giới hạn',
        );
      } catch (err) {
        if (err instanceof HttpException && err.getStatus() === 429) {
          const message =
            typeof err.getResponse() === 'string'
              ? err.getResponse()
              : (err.getResponse() as { message?: string })?.message || 'Quá nhiều yêu cầu';
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
    } catch (err) {
      if (err instanceof HttpException && err.getStatus() === 429) {
        const message =
          typeof err.getResponse() === 'string'
            ? err.getResponse()
            : (err.getResponse() as { message?: string })?.message || 'Quá nhiều yêu cầu';
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
    const { bot, sources } = bind;

    const usage = await this.chatbot.getUsageSnapshot(page.organizationId);
    if (!usage.allowed && !page.preview) {
      // Preserve the quota guard and return before any AI call or conversation write.
      const declined = declinesLandingPageContact(dto.message);
      return {
        ok: true,
        code: 'limit_exceeded',
        reply: declined ? 'Dạ, em tiếp tục tư vấn trực tiếp tại đây. Anh/chị muốn tìm hiểu thêm nội dung nào ạ?' : LANDING_PAGE_HANDOFF_REPLY,
        show_lead: !declined && page.chatbot.enableHandoff !== false,
        no_data: true,
        used_ai: false,
      };
    }

    const sessionId = this.normalizeSession(dto.sessionId, page.preview);
    const conversation = await this.getOrCreateConversation(
      page,
      bot.id,
      sessionId,
    );

    const userText = String(dto.message || '').trim().slice(0, 2000);
    if (!userText) {
      return { ok: false, message: 'Tin nhắn trống.', reply: 'Vui lòng nhập nội dung.' };
    }

    await this.prisma.chatbotMessage.create({
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
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      this.chatbot.getSettings(page.organizationId),
    ]);

    const openAiChat = this.openAi.isConfigured()
      ? async (input: {
          model: string;
          systemPrompt: string;
          history: Array<{ role: string; content: string }>;
          userText: string;
          temperature: number;
        }) =>
          this.openAi.chatCompletion({
            model: input.model,
            temperature: input.temperature,
            maxTokens: 500,
            messages: [
              { role: 'system', content: input.systemPrompt },
              ...input.history.slice(-6),
              { role: 'user', content: input.userText },
            ],
          })
      : undefined;

    const aiResult = await generateLandingPageChatbotReply({
      bot,
      userText,
      sources,
      history: history.reverse(),
      settings,
      usageAllowed: usage.allowed || page.preview,
      openAiChat,
      knowledgeSourceIds: page.chatbot.knowledgeSourceIds,
      customGreeting: page.chatbot.greeting,
    });

    await this.prisma.chatbotMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        message: aiResult.reply,
        ...(aiResult.evidence?.length
          ? { metadata: { evidence: aiResult.evidence, landingPageId: page.id } as object }
          : {}),
      },
    });

    await this.prisma.chatbotConversation.update({
      where: { id: conversation.id },
      data: { lastUserMessageAt: new Date(), updatedAt: new Date() },
    });

    if (aiResult.usedAi && !page.preview) {
      await this.chatbot.recordAiReplyUsage(page.organizationId, bot.id);
    } else if (aiResult.usedAi && page.preview) {
      this.logger.log(
        JSON.stringify({
          event: 'lp_chatbot_preview_ai',
          organizationId: page.organizationId,
          landingPageId: page.id,
          botId: bot.id,
          conversationId: conversation.id,
        }),
      );
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
    } catch {
      /* ignore */
    }

    return {
      ok: true,
      reply: aiResult.reply,
      session_id: sessionId,
      show_lead: page.chatbot.enableHandoff !== false && aiResult.showLead,
      contact_requested: requestsLandingPageContact(userText),
      no_data: aiResult.noData,
      used_ai: aiResult.usedAi,
      preview: page.preview,
      ...(aiResult.evidence?.length ? { evidence: aiResult.evidence } : {}),
    };
  }

  async submitLead(
    slug: string,
    dto: {name?:string;phone?:string;email?:string;need?:string;sessionId?:string;pageUrl?:string},
    organizationId: string | undefined,
    previewToken: string | undefined,
    ip?: string,
    origin?: string,
    referer?: string,
  ) {
    if (previewToken) {
      const page = await this.resolvePageBySlug(slug, organizationId, previewToken, origin, referer);
      if (!page?.preview) {
        throw new NotFoundException('Preview không hợp lệ hoặc đã hết hạn');
      }
      return { ok: true, message: 'Xem trước — không ghi lead.', preview: true, skipped: true };
    }
    const page = await this.resolvePageBySlug(slug, organizationId, undefined, origin, referer);
    if (!page?.chatbot.enableHandoff) {
      throw new NotFoundException('Handoff không bật');
    }
    const deny = this.rolloutDeny(page);
    if (deny) {
      throw new BadRequestException({
        code: deny,
        message: 'Chatbot lead handoff tạm không khả dụng trên trang này.',
      });
    }
    try {
      this.rateLimit.assertWithinLimit(`lp:cb:lead:${page.id}:${ip || 'na'}`, 8, 60_000, 'Quá nhiều gửi lead');
    } catch (err) {
      if (err instanceof HttpException && err.getStatus() === 429) throw err;
      throw err;
    }

    const bind = await this.resolveBindings(page.organizationId, page.chatbot, false);
    if (!bind) throw new BadRequestException('Chatbot không hợp lệ');
    const { bot } = bind;

    const phone = String(dto.phone || '')
      .replace(/\s+/g, '')
      .slice(0, 32);
    const name = String(dto.name || 'Khách chatbot').trim().slice(0, 120);
    const email=String(dto.email||'').trim().toLowerCase().slice(0,160);
    if (!phone && !email) throw new BadRequestException('Vui lòng nhập số điện thoại hoặc email để nhân viên liên hệ.');
    if (phone && !/^\+?[0-9().-]{6,32}$/.test(phone)) throw new BadRequestException('Số điện thoại không hợp lệ.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Email không hợp lệ.');

    const sessionId = this.normalizeSession(dto.sessionId, false);
    const conversation = await this.getOrCreateConversation(page, bot.id, sessionId);

    const recentDup = await this.prisma.chatbotLead.findFirst({
      where: {
        conversationId: conversation.id,
        ...(phone ? {phone} : {phone:null,need:{contains:`Email liên hệ: ${email}\n`}}),
        createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    });
    const pageUrl = (dto.pageUrl || '').slice(0, 2000);
    const need = `${email?`Email liên hệ: ${email}\n`:''}${dto.need || `Lead landing page «${slug}» (chatbot widget)`}`.slice(0,2000);

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
        ...(phone ? {visitorPhone:phone} : {}),
        status: 'NEEDS_STAFF',
      },
    });

    const leadSource = await this.prisma.leadSource.upsert({
      where:{organizationId_code:{organizationId:page.organizationId,code:'CHATBOT'}},
      create:{organizationId:page.organizationId,code:'CHATBOT',name:'Chatbot',isActive:true},update:{},
    });
    const crm = resolveLeadFormBlockFromSpec(page.spec)?.crm;
    let crmLead = recentDup && conversation.linkedLeadId ? await this.prisma.lead.findFirst({where:{id:conversation.linkedLeadId,organizationId:page.organizationId,...(phone?{phone}:{email})}}) : null;
    if (!crmLead) crmLead = await this.leads.create(page.organizationId, {
      leadSourceId:leadSource.id, name, phone:phone||undefined, email:email||undefined,
      landingPageId:page.id, pipelineId:crm?.pipelineId,stageId:crm?.stageId,
      assignedToId:crm?.assignedToId,autoAssign:crm?.autoAssign,
      note:`${need}\nlandingPageId=${page.id}`,
      attribution:{landingPage:pageUrl||`landing_page:${page.id}`,channel:AdPlatform.OTHER},
    });
    const crmLeadId=crmLead.id;
    await this.prisma.chatbotConversation.update({where:{id:conversation.id},data:{linkedLeadId:crmLeadId,...(phone?{visitorPhone:phone}:{}),...(crmLead.assignedToId?{assignedEmployeeId:crmLead.assignedToId}:{})}});
    const notification = await this.notifications.enqueue({organizationId:page.organizationId,landingPageId:page.id,slug:page.slug,chatbotLeadId:lead.id,crmLeadId,conversationId:conversation.id});

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

  private normalizeSession(sessionId: string | undefined, preview: boolean): string {
    const raw = String(sessionId || '').replace(/[^\w-]/g, '').slice(0, 80);
    const base = raw || `lp-${Date.now().toString(36)}`;
    return preview ? `preview-${base}` : base;
  }

  private async getOrCreateConversation(
    page: ResolvedPage,
    botId: string,
    sessionId: string,
  ) {
    const channelRef = `landing_page:${page.id}`;
    const existing = await this.prisma.chatbotConversation.findUnique({
      where: { botId_sessionId: { botId, sessionId } },
    });
    if (existing) return existing;
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
}