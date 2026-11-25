import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import type { WsCampaignUpdate } from '@marketingspa/shared';

export interface WsLeadNewPayload {
  leadId: string;
  name: string;
  pipelineStatus: string;
}

export interface WsAppointmentNewPayload {
  appointmentId: string;
  scheduledAt: string;
  customerName?: string;
}

export interface WsLeadStalePayload {
  count: number;
  leads: { id: string; name: string; createdAt: string }[];
}

export interface WsLeadStatusChangedPayload {
  leadId: string;
  name: string;
  previousStatus: string;
  pipelineStatus: string;
}

export interface WsChatbotMessageNewPayload {
  conversationId: string;
  channel: string;
  preview: string;
  visitorName?: string;
  pageName?: string;
  botId?: string;
}

/** Socket.IO gateway — realtime theo organization room (JWT bắt buộc) */
@WebSocketGateway({
  cors: {
    origin: [
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.APP_URL,
      'https://aibeego.com',
      'https://www.aibeego.com',
      'https://marketingautoaz.com',
      'https://www.marketingautoaz.com',
      'http://localhost:3000',
      'http://127.0.0.1:3002',
    ].filter(Boolean) as string[],
    credentials: true,
  },
  namespace: '/events',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    const authToken = client.handshake.auth?.token as string | undefined;
    const queryToken = client.handshake.query?.token as string | undefined;
    if (queryToken && !authToken) {
      this.logger.warn(
        'Socket auth: query token deprecated — gửi handshake.auth.token (Bearer access JWT)',
      );
    }
    const token = authToken ?? queryToken;

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        organizationId: string;
      }>(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });

      if (!payload.organizationId) {
        client.disconnect(true);
        return;
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, isActive: true, deletedAt: true, organizationId: true },
      });
      if (!user || !user.isActive || user.deletedAt) {
        client.disconnect(true);
        return;
      }
      if (user.organizationId !== payload.organizationId) {
        client.disconnect(true);
        return;
      }

      client.data.userId = payload.sub;
      client.data.organizationId = payload.organizationId;
      const room = `org:${payload.organizationId}`;
      client.data.orgRoom = room;
      client.join(room);

      const recheckMs = parseInt(this.config.get<string>('AUTH_SOCKET_RECHECK_MS', '30000'), 10) || 30_000;
      const timer = setInterval(() => {
        void this.enforceSocketMembership(client).then((ok) => {
          if (!ok) {
            clearInterval(timer);
          }
        });
      }, recheckMs);
      client.on('disconnect', () => clearInterval(timer));
    } catch (err) {
      this.logger.debug(`Socket auth failed: ${err instanceof Error ? err.message : err}`);
      client.disconnect(true);
    }
  }

  /** Kiểm tra user còn active và đúng org — ngắt room cũ khi đổi trạng thái. */
  async enforceSocketMembership(client: Socket): Promise<boolean> {
    const userId = client.data.userId as string | undefined;
    const orgId = client.data.organizationId as string | undefined;
    const room = client.data.orgRoom as string | undefined;
    if (!userId || !orgId || !room) {
      client.disconnect(true);
      return false;
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true, deletedAt: true, organizationId: true },
    });
    if (!user || !user.isActive || user.deletedAt || user.organizationId !== orgId) {
      client.leave(room);
      client.disconnect(true);
      return false;
    }
    return true;
  }

  handleDisconnect(_client: Socket) {
    // Room cleanup tự động bởi Socket.IO
  }

  emitToOrg(organizationId: string, event: string, payload: unknown) {
    this.server.to(`org:${organizationId}`).emit(event, payload);
  }

  private broadcastToOrg(organizationId: string, event: string, payload: unknown) {
    this.emitToOrg(organizationId, event, payload);
  }

  broadcastCampaignUpdate(organizationId: string, payload: WsCampaignUpdate) {
    this.broadcastToOrg(organizationId, 'campaign:update', payload);
  }

  broadcastLeadNew(organizationId: string, payload: WsLeadNewPayload) {
    this.broadcastToOrg(organizationId, 'lead:new', payload);
  }

  broadcastAppointmentNew(organizationId: string, payload: WsAppointmentNewPayload) {
    this.broadcastToOrg(organizationId, 'appointment:new', payload);
  }

  broadcastLeadStaleAlert(organizationId: string, payload: WsLeadStalePayload) {
    this.broadcastToOrg(organizationId, 'lead:stale-alert', payload);
  }

  broadcastLeadStatusChanged(organizationId: string, payload: WsLeadStatusChangedPayload) {
    this.broadcastToOrg(organizationId, 'lead:status-changed', payload);
  }

  broadcastChatbotMessageNew(organizationId: string, payload: WsChatbotMessageNewPayload) {
    this.broadcastToOrg(organizationId, 'chatbot:message-new', payload);
  }
}
