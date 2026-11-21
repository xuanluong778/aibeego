import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { normalizeZaloWebhook, sendZaloOaHttp } from '@marketingspa/shared';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAiService } from '../openai/openai.service';
import { MessagingWebhookIngressService } from '../messaging/messaging-webhook-ingress.service';
import { ChannelConnectionsService } from '../messaging/channel-connections.service';
import { ChatbotCskhService } from './chatbot-cskh.service';
import { generateAiReply } from './utils/chatbot-ai.util';
import type { ChatbotConversation, MessagingChannelConnection } from '@marketingspa/database';

/** Only authenticated Zalo ingress can invoke this handler; no new public endpoint. */
@Injectable()
export class ChatbotZaloKnowledgeService implements OnModuleInit {
  private readonly logger = new Logger(ChatbotZaloKnowledgeService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatbot: ChatbotCskhService,
    private readonly ai: OpenAiService,
    private readonly ingress: MessagingWebhookIngressService,
    private readonly connections: ChannelConnectionsService,
  ) {}
  onModuleInit() {
    this.ingress.registerChatbotZaloHandler((id, org, payload) => {
      void this.process(id, org, payload).catch(() =>
        this.logger.warn('Zalo knowledge reply failed; no provider data logged.'),
      );
    });
  }
  async process(connectionId: string, organizationId: string, payload: unknown) {
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
    const botId = (connection?.metadata as { botId?: string } | null)?.botId;
    if (!connection || !botId) return;
    const bot = await this.prisma.chatbotBot.findFirst({
      where: { id: botId, organizationId, status: 'ACTIVE', knowledgeBaseId: { not: null } },
    });
    const channel = await this.prisma.chatbotChannel.findFirst({
      where: { botId, organizationId, channelType: 'ZALO' },
    });
    if (!bot || !(channel?.config as { zaloAutoReply?: boolean } | null)?.zaloAutoReply) return;
    for (const event of normalizeZaloWebhook(payload, connection.accountRef)) {
      if (
        event.accountRef !== connection.accountRef ||
        event.direction !== 'inbound' ||
        event.eventType !== 'message' ||
        !event.text?.trim() ||
        !event.externalUserId
      )
        continue;
      const usage = await this.chatbot.getUsageSnapshot(organizationId);
      if (!usage.allowed) continue;
      const sessionId = `zalo:${connection.accountRef}:${event.externalUserId}`;
      const conv: ChatbotConversation = await this.prisma.chatbotConversation.upsert({
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
      if (conv.organizationId !== organizationId || conv.humanTakeover) continue;
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
      } catch (error) {
        if ((error as { code?: string }).code === 'P2002') continue;
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
      const knowledge = await this.chatbot.getReplyKnowledge(
        organizationId,
        botId,
        event.text,
        history,
      );
      let result = await generateAiReply({
        bot,
        userText: event.text,
        sources: [],
        history,
        settings,
        usageAllowed: usage.allowed,
        knowledge,
        openAiChat: this.ai.isConfigured()
          ? (input) =>
              this.ai.chatCompletion({
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
          : undefined,
      });
      result = await this.chatbot.guardReplyKnowledge(organizationId, botId, knowledge, result);
      const stillLinked: MessagingChannelConnection | null =
        await this.prisma.messagingChannelConnection.findFirst({
          where: { id: connection.id, organizationId, isPaused: false, status: 'ACTIVE' },
        });
      const enabled = await this.prisma.chatbotChannel.findFirst({
        where: { id: channel!.id, organizationId },
      });
      const freshConv = await this.prisma.chatbotConversation.findFirst({
        where: { id: conv.id, organizationId },
      });
      if (
        (stillLinked?.metadata as { botId?: string } | null)?.botId !== botId ||
        !(enabled?.config as { zaloAutoReply?: boolean } | null)?.zaloAutoReply ||
        freshConv?.humanTakeover
      )
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
          } as object,
        },
      });
      try {
        const { accessToken } = await this.connections.ensureFreshZaloAccessToken(
          organizationId,
          connection.id,
        );
        const sent = await sendZaloOaHttp({
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
      } catch {
        await this.prisma.chatbotMessage.update({
          where: { id: pending.id },
          data: { status: 'FAILED', errorCode: 'ZALO_SEND_ERROR' },
        });
      }
      if (result.usedAi) await this.chatbot.recordAiReplyUsage(organizationId, botId);
      await this.prisma.chatbotConversation.update({
        where: { id: conv.id },
        data: { lastUserMessageAt: new Date() },
      });
    }
  }
}
