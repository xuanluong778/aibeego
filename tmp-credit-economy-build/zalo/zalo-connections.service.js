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
var ZaloConnectionsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZaloConnectionsService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const shared_1 = require("@marketingspa/shared");
const channel_connections_service_1 = require("../messaging/channel-connections.service");
const prisma_service_1 = require("../prisma/prisma.service");
let ZaloConnectionsService = ZaloConnectionsService_1 = class ZaloConnectionsService {
    channels;
    prisma;
    logger = new common_1.Logger(ZaloConnectionsService_1.name);
    constructor(channels, prisma) {
        this.channels = channels;
        this.prisma = prisma;
    }
    async list(organizationId) {
        const rows = await this.prisma.messagingChannelConnection.findMany({
            where: {
                organizationId,
                channel: database_1.MessageChannel.ZALO,
                providerKind: database_1.MessagingProviderKind.ZALO_OA,
            },
            orderBy: { updatedAt: 'desc' },
        });
        return rows.map((r) => this.channels.toZaloPublic(r));
    }
    async create(organizationId, dto, userId) {
        const connected = await this.channels.connectZaloOa(organizationId, dto, userId);
        const row = await this.prisma.messagingChannelConnection.findFirst({
            where: { id: connected.id, organizationId },
        });
        if (!row)
            throw new common_1.NotFoundException('Không tạo được kết nối Zalo OA');
        return this.channels.toZaloPublic(row);
    }
    async test(organizationId, id, userId) {
        await this.ensureZaloOa(organizationId, id);
        // Refresh token trước nếu sắp hết hạn — rồi validate qua OA API
        try {
            await this.channels.ensureFreshZaloAccessToken(organizationId, id);
        }
        catch (err) {
            this.logger.warn(`Zalo test pre-refresh skipped: ${err instanceof Error ? err.message : 'error'}`);
        }
        const result = await this.channels.test(organizationId, id, userId);
        const row = await this.prisma.messagingChannelConnection.findFirst({
            where: { id, organizationId },
        });
        return {
            valid: result.valid,
            message: result.message,
            displayName: result.displayName,
            connection: row ? this.channels.toZaloPublic(row) : null,
        };
    }
    async refreshToken(organizationId, id, userId) {
        await this.ensureZaloOa(organizationId, id);
        return this.channels.refreshZaloOaToken(organizationId, id, userId);
    }
    async remove(organizationId, id, userId) {
        await this.ensureZaloOa(organizationId, id);
        return this.channels.remove(organizationId, id, userId);
    }
    /**
     * Gửi text/image/file từ Ai Bee Go → user Zalo.
     * Tự refresh token; không log token/secret.
     */
    async sendMessage(organizationId, id, dto) {
        await this.ensureZaloOa(organizationId, id);
        if (!dto.text?.trim() && !dto.imageUrl?.trim() && !dto.fileUrl?.trim()) {
            throw new common_1.BadRequestException('Cần text, imageUrl hoặc fileUrl');
        }
        const { accessToken } = await this.channels.ensureFreshZaloAccessToken(organizationId, id);
        if (!accessToken) {
            throw new common_1.BadRequestException('Thiếu access token Zalo OA');
        }
        const result = await (0, shared_1.sendZaloOaHttp)({
            accessToken,
            recipientId: dto.userId.trim(),
            text: dto.text,
            imageUrl: dto.imageUrl,
            fileUrl: dto.fileUrl,
        });
        if (!result.success) {
            this.logger.warn(`Zalo send failed connection=${id.slice(0, 8)}… retryable=${result.retryable} status=${result.httpStatus ?? ''}`);
            throw new common_1.BadRequestException(result.message || 'Gửi Zalo thất bại');
        }
        // Persist outbound into CSKH inbox when conversation exists / can be created
        await this.persistOutboundInbox({
            organizationId,
            connectionId: id,
            userId: dto.userId.trim(),
            text: dto.text?.trim() || (dto.imageUrl ? '[image]' : dto.fileUrl ? '[file]' : ''),
            externalMessageId: result.messageId,
        }).catch((err) => {
            this.logger.warn(`Zalo inbox outbound persist: ${err.message}`);
        });
        return {
            ok: true,
            messageId: result.messageId,
            message: result.message,
        };
    }
    async health(organizationId) {
        const where = {
            channel: database_1.MessageChannel.ZALO,
            providerKind: database_1.MessagingProviderKind.ZALO_OA,
        };
        if (organizationId)
            where.organizationId = organizationId;
        const rows = await this.prisma.messagingChannelConnection.findMany({
            where,
            select: {
                id: true,
                organizationId: true,
                accountRef: true,
                status: true,
                tokenExpiresAt: true,
                isPaused: true,
                encryptedCredentials: true,
            },
            take: 50,
        });
        const now = Date.now();
        let active = 0;
        let expiringSoon = 0;
        let expired = 0;
        let missingSecret = 0;
        for (const row of rows) {
            if (row.isPaused || row.status === database_1.MessagingChannelAccountStatus.PAUSED)
                continue;
            if (row.status === database_1.MessagingChannelAccountStatus.ACTIVE)
                active += 1;
            if (row.tokenExpiresAt && row.tokenExpiresAt.getTime() < now)
                expired += 1;
            else if (row.tokenExpiresAt && row.tokenExpiresAt.getTime() - now < 24 * 3600_000) {
                expiringSoon += 1;
            }
            // Presence check only — do not decrypt secrets into logs
            if (!row.encryptedCredentials)
                missingSecret += 1;
        }
        const ok = active > 0 && expired === 0;
        return {
            status: ok ? 'ok' : rows.length ? 'degraded' : 'idle',
            connections: rows.length,
            active,
            expiringSoon,
            expired,
            missingCredentials: missingSecret,
            appIdConfigured: Boolean(process.env.ZALO_APP_ID?.trim()),
            appSecretConfigured: Boolean(process.env.ZALO_APP_SECRET?.trim()),
        };
    }
    async ensureZaloOa(organizationId, id) {
        const row = await this.prisma.messagingChannelConnection.findFirst({
            where: {
                id,
                organizationId,
                channel: database_1.MessageChannel.ZALO,
                providerKind: database_1.MessagingProviderKind.ZALO_OA,
            },
        });
        if (!row)
            throw new common_1.NotFoundException('Kết nối Zalo OA không tồn tại');
        return row;
    }
    async persistOutboundInbox(params) {
        const conn = await this.prisma.messagingChannelConnection.findFirst({
            where: { id: params.connectionId, organizationId: params.organizationId },
        });
        if (!conn)
            return;
        const sessionId = `zalo:${conn.accountRef}:${params.userId}`.slice(0, 64);
        let conversation = await this.prisma.chatbotConversation.findFirst({
            where: { organizationId: params.organizationId, sessionId },
        });
        if (!conversation) {
            const bot = await this.prisma.chatbotBot.findFirst({
                where: { organizationId: params.organizationId, status: 'ACTIVE' },
                orderBy: { createdAt: 'asc' },
            });
            if (!bot)
                return;
            conversation = await this.prisma.chatbotConversation.create({
                data: {
                    organizationId: params.organizationId,
                    botId: bot.id,
                    sessionId,
                    channel: 'zalo',
                    channelRef: conn.accountRef,
                    externalUserId: params.userId,
                    visitorName: `Zalo …${params.userId.slice(-4)}`,
                    status: 'OPEN',
                },
            });
        }
        const externalMessageId = params.externalMessageId?.slice(0, 128) || null;
        if (externalMessageId) {
            const dup = await this.prisma.chatbotMessage.findFirst({
                where: { conversationId: conversation.id, externalMessageId },
                select: { id: true },
            });
            if (dup)
                return;
        }
        await this.prisma.chatbotMessage.create({
            data: {
                conversationId: conversation.id,
                role: 'assistant',
                message: params.text.slice(0, 2000),
                status: 'SENT',
                direction: 'OUTBOUND',
                senderType: 'STAFF',
                externalMessageId,
            },
        });
    }
};
exports.ZaloConnectionsService = ZaloConnectionsService;
exports.ZaloConnectionsService = ZaloConnectionsService = ZaloConnectionsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [channel_connections_service_1.ChannelConnectionsService,
        prisma_service_1.PrismaService])
], ZaloConnectionsService);
