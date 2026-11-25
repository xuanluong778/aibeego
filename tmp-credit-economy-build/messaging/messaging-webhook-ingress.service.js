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
var MessagingWebhookIngressService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagingWebhookIngressService = void 0;
const crypto_1 = require("crypto");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const database_1 = require("@marketingspa/database");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../prisma/prisma.service");
const queue_enqueue_service_1 = require("../common/services/queue-enqueue.service");
const queue_constants_1 = require("../queue/queue.constants");
const channel_connections_service_1 = require("./channel-connections.service");
const messaging_provider_registry_1 = require("./providers/messaging-provider.registry");
let MessagingWebhookIngressService = MessagingWebhookIngressService_1 = class MessagingWebhookIngressService {
    prisma;
    config;
    channelConnections;
    providers;
    queueEnqueue;
    webhookQueue;
    logger = new common_1.Logger(MessagingWebhookIngressService_1.name);
    chatbotPageHandler = null;
    chatbotZaloHandler = null;
    registerChatbotZaloHandler(handler) { this.chatbotZaloHandler = handler; }
    constructor(prisma, config, channelConnections, providers, queueEnqueue, webhookQueue) {
        this.prisma = prisma;
        this.config = config;
        this.channelConnections = channelConnections;
        this.providers = providers;
        this.queueEnqueue = queueEnqueue;
        this.webhookQueue = webhookQueue;
    }
    /** Chatbot CSKH đăng ký để nhận chung payload Messenger (tránh miss khi Meta gọi URL messaging). */
    registerChatbotPageHandler(handler) {
        this.chatbotPageHandler = handler;
    }
    verifyMessengerChallenge(mode, token, challenge) {
        const expected = this.config.get('CSKH_FB_WEBHOOK_VERIFY_TOKEN') ?? '';
        if (mode === 'subscribe' && token === expected && challenge) {
            return challenge;
        }
        return 'Forbidden';
    }
    /**
     * Fail-closed: khi META_APP_SECRET đã cấu hình, bắt buộc X-Hub-Signature-256 hợp lệ.
     * Không log secret / raw signature đầy đủ.
     */
    assertMessengerSignature(rawBody, signature) {
        const appSecret = this.config.get('META_APP_SECRET') ??
            this.config.get('FACEBOOK_APP_SECRET') ??
            '';
        if (!appSecret) {
            this.logger.error('META_APP_SECRET missing — rejecting Messenger webhook (fail-closed)');
            throw new common_1.UnauthorizedException('Meta webhook secret not configured');
        }
        const provider = this.providers.get(database_1.MessagingProviderKind.MESSENGER);
        if (!signature ||
            !provider.verifyWebhookSignature ||
            !provider.verifyWebhookSignature(rawBody, signature, appSecret)) {
            this.logger.warn(`Messenger webhook signature rejected (sig=${signature ? 'present' : 'missing'})`);
            throw new common_1.UnauthorizedException('Invalid Meta webhook signature');
        }
    }
    /** Trả response nhanh — xử lý nặng qua queue */
    async ingestMessenger(rawBody, payload, signature) {
        this.assertMessengerSignature(rawBody, signature);
        try {
            this.chatbotPageHandler?.(payload);
        }
        catch (err) {
            this.logger.warn(`Chatbot page handler: ${err.message}`);
        }
        const body = payload;
        const pageId = body.entry?.[0]?.id;
        if (!pageId)
            return;
        const connection = await this.channelConnections.findByAccountRef(database_1.MessageChannel.MESSENGER, pageId);
        if (!connection || connection.isPaused)
            return;
        const provider = this.providers.get(database_1.MessagingProviderKind.MESSENGER);
        const events = provider.normalizeWebhook(payload, pageId);
        await this.enqueueEvents(connection, events, payload);
    }
    /**
     * Fail-closed Zalo OA webhook auth — thiếu secret/signature hoặc sai chữ ký → 401.
     * Verifies official mac=sha256(appId+body+timestamp+oaSecret) (+ legacy HMAC).
     * Không log secret.
     */
    async assertZaloSignature(rawBody, payload, signature) {
        const body = payload;
        const oaId = typeof body.oa_id === 'string' ? body.oa_id.trim() : '';
        if (!oaId) {
            throw new common_1.UnauthorizedException('Zalo webhook missing oa_id');
        }
        if (!signature?.trim()) {
            throw new common_1.UnauthorizedException('Invalid Zalo webhook signature');
        }
        const connection = await this.channelConnections.findByAccountRef(database_1.MessageChannel.ZALO, oaId);
        if (!connection || connection.isPaused) {
            throw new common_1.UnauthorizedException('Zalo OA connection not found or paused');
        }
        const secret = await this.resolveZaloWebhookSecret(oaId, connection.encryptedCredentials);
        if (!secret) {
            this.logger.warn(`Zalo webhook rejected — missing webhookSecret oa=${oaId}`);
            throw new common_1.UnauthorizedException('Zalo webhook secret not configured');
        }
        const appId = (this.config.get('ZALO_APP_ID') ?? '').trim() ||
            (this.config.get('ZALO_OA_APP_ID') ?? '').trim();
        const ok = (0, shared_1.verifyZaloWebhookSignature)({
            rawBody,
            signature,
            appId,
            timestamp: body.timestamp ?? '',
            oaSecretKey: secret,
            allowLegacyHmac: true,
        });
        if (!ok) {
            this.logger.warn(`Zalo webhook signature rejected oa=${oaId}`);
            throw new common_1.UnauthorizedException('Invalid Zalo webhook signature');
        }
    }
    /** Prefer connection secret; fall back to sibling rows / env (never logged). */
    async resolveZaloWebhookSecret(oaId, encryptedCredentials) {
        const fromConn = this.channelConnections.decryptCredentials(encryptedCredentials);
        const direct = (fromConn.webhookSecret || fromConn.oaSecretKey || '').trim();
        if (direct)
            return direct;
        const siblings = await this.prisma.messagingChannelConnection.findMany({
            where: { channel: database_1.MessageChannel.ZALO, accountRef: oaId },
            select: { encryptedCredentials: true },
            take: 10,
        });
        for (const row of siblings) {
            const c = this.channelConnections.decryptCredentials(row.encryptedCredentials);
            const s = (c.webhookSecret || c.oaSecretKey || '').trim();
            if (s)
                return s;
        }
        return ((this.config.get('ZALO_OA_WEBHOOK_SECRET') ?? '').trim() ||
            (this.config.get('ZALO_WEBHOOK_SECRET') ?? '').trim());
    }
    async ingestZalo(rawBody, payload, signature) {
        await this.assertZaloSignature(rawBody, payload, signature);
        const body = payload;
        const oaId = String(body.oa_id || '').trim();
        const connection = await this.channelConnections.findByAccountRef(database_1.MessageChannel.ZALO, oaId);
        if (!connection || connection.isPaused)
            return;
        const provider = this.providers.get(database_1.MessagingProviderKind.ZALO_OA);
        const events = provider.normalizeWebhook(payload, oaId);
        await this.enqueueEvents(connection, events, payload);
        this.chatbotZaloHandler?.(connection.id, connection.organizationId, payload);
    }
    async enqueueEvents(connection, events, payload) {
        if (!events.length) {
            events = [{ rawEventKey: this.fallbackEventKey(connection, payload) }];
        }
        for (const event of events) {
            const eventKey = event.rawEventKey;
            try {
                await this.prisma.messagingWebhookEvent.create({
                    data: {
                        organizationId: connection.organizationId,
                        channel: connection.channel,
                        eventKey,
                    },
                });
            }
            catch (err) {
                if (err.code === 'P2002') {
                    continue;
                }
                throw err;
            }
            const jobData = {
                organizationId: connection.organizationId,
                channel: connection.channel,
                providerKind: connection.providerKind,
                connectionId: connection.id,
                accountRef: connection.accountRef,
                payload,
            };
            await this.queueEnqueue.add(this.webhookQueue, 'process-webhook', jobData, {
                jobId: `${connection.channel}:${eventKey}`.slice(0, 120),
                removeOnComplete: 1000,
                removeOnFail: 5000,
            });
        }
    }
    fallbackEventKey(connection, payload) {
        const hash = (0, crypto_1.createHash)('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 32);
        return `${connection.channel}:${connection.accountRef}:${hash}`;
    }
};
exports.MessagingWebhookIngressService = MessagingWebhookIngressService;
exports.MessagingWebhookIngressService = MessagingWebhookIngressService = MessagingWebhookIngressService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(5, (0, common_1.Inject)(queue_constants_1.MESSAGING_WEBHOOK_QUEUE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        channel_connections_service_1.ChannelConnectionsService,
        messaging_provider_registry_1.MessagingProviderRegistry,
        queue_enqueue_service_1.QueueEnqueueService, Function])
], MessagingWebhookIngressService);
