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
var FacebookAdsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FacebookAdsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const database_1 = require("@marketingspa/database");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../../prisma/prisma.service");
const ad_connection_facade_1 = require("../ad-connection.facade");
const ads_sync_queue_service_1 = require("../ads-sync-queue.service");
const meta_graph_api_service_1 = require("./meta-graph-api.service");
const STATE_TTL_MS = 10 * 60 * 1000;
let FacebookAdsService = FacebookAdsService_1 = class FacebookAdsService {
    prisma;
    config;
    meta;
    connections;
    adsSyncQueue;
    logger = new common_1.Logger(FacebookAdsService_1.name);
    constructor(prisma, config, meta, connections, adsSyncQueue) {
        this.prisma = prisma;
        this.config = config;
        this.meta = meta;
        this.connections = connections;
        this.adsSyncQueue = adsSyncQueue;
    }
    async getOAuthStartUrl(user, returnTo) {
        this.ensureMetaConfig();
        const state = this.signState(user.id, user.organizationId, returnTo);
        return { url: this.meta.buildOAuthUrl(state) };
    }
    async handleOAuthCallback(code, state, error) {
        const appUrl = this.config.get('APP_URL') ?? 'http://localhost:3000';
        let returnTo;
        if (state) {
            try {
                ({ returnTo } = this.verifyState(state));
            }
            catch {
                /* handled below */
            }
        }
        const base = returnTo === 'ads'
            ? `${appUrl}/ads`
            : `${appUrl}/business-goals?tab=ad-performance`;
        if (error) {
            return {
                redirectUrl: `${base}${returnTo === 'ads' ? '?' : '&'}facebook=error&message=${encodeURIComponent(error)}`,
            };
        }
        if (!code || !state) {
            return {
                redirectUrl: `${base}${returnTo === 'ads' ? '?' : '&'}facebook=error&message=missing_code`,
            };
        }
        let userId;
        let organizationId;
        try {
            ({ userId, organizationId, returnTo } = this.verifyState(state));
        }
        catch {
            return {
                redirectUrl: `${base}${returnTo === 'ads' ? '?' : '&'}facebook=error&message=invalid_state`,
            };
        }
        const successBase = returnTo === 'ads'
            ? `${appUrl}/ads?facebook=connected`
            : `${appUrl}/business-goals?tab=ad-performance&facebook=connected`;
        try {
            const short = await this.meta.exchangeCodeForToken(code);
            const longLived = await this.meta.exchangeForLongLivedToken(short.access_token);
            const accessToken = longLived.access_token;
            const me = await this.meta.getMe(accessToken);
            const expiresAt = longLived.expires_in
                ? new Date(Date.now() + longLived.expires_in * 1000)
                : null;
            const scopes = this.meta.getOAuthScopes();
            await this.connections.upsertEncryptedCredentials({
                organizationId,
                userId,
                provider: database_1.AdConnectionProvider.META,
                plaintextPayload: accessToken,
                status: database_1.AdConnectionStatus.CONNECTED,
                scopes,
                tokenExpiresAt: expiresAt,
            });
            await this.prisma.facebookAdsConnection.upsert({
                where: { organizationId },
                create: {
                    organizationId,
                    connectedByUserId: userId,
                    facebookUserId: me.id,
                    status: database_1.FacebookAdsConnectionStatus.CONNECTED,
                    scopes,
                },
                update: {
                    connectedByUserId: userId,
                    facebookUserId: me.id,
                    status: database_1.FacebookAdsConnectionStatus.CONNECTED,
                    scopes,
                    lastSyncError: null,
                },
            });
            return { redirectUrl: successBase };
        }
        catch (e) {
            const message = e instanceof Error ? e.message : 'oauth_failed';
            this.logger.warn(`Facebook OAuth callback failed for user ${userId}: ${message}`);
            const errSep = returnTo === 'ads' ? '?' : '&';
            return {
                redirectUrl: `${base}${errSep}facebook=error&message=${encodeURIComponent(message)}`,
            };
        }
    }
    async getStatus(user) {
        const organizationId = user.organizationId;
        const row = await this.prisma.facebookAdsConnection.findUnique({
            where: { organizationId },
        });
        const adConn = await this.connections.getPublic(organizationId, database_1.AdConnectionProvider.META);
        if (!adConn.hasCredentials) {
            return {
                status: 'DISCONNECTED',
                connected: false,
                selectedAdAccountId: null,
                selectedAdAccountName: null,
                lastSyncAt: null,
                lastSyncStatus: null,
                lastSyncError: null,
                tokenExpiresAt: null,
            };
        }
        let status = this.toPublicStatus(row?.status ?? database_1.FacebookAdsConnectionStatus.CONNECTED);
        if (adConn.tokenExpiresAt && adConn.tokenExpiresAt.getTime() < Date.now()) {
            status = 'TOKEN_EXPIRED';
            if (row) {
                await this.prisma.facebookAdsConnection.update({
                    where: { organizationId },
                    data: { status: database_1.FacebookAdsConnectionStatus.TOKEN_EXPIRED },
                });
            }
        }
        return {
            status,
            connected: status === 'CONNECTED' || status === 'SYNCING',
            selectedAdAccountId: row?.selectedAdAccountId ?? null,
            selectedAdAccountName: row?.selectedAdAccountName ?? null,
            lastSyncAt: row?.lastSyncAt ?? null,
            lastSyncStatus: row?.lastSyncStatus ?? null,
            lastSyncError: row?.lastSyncError ?? null,
            tokenExpiresAt: adConn.tokenExpiresAt,
            facebookUserId: row?.facebookUserId ?? null,
        };
    }
    async listAdAccounts(user) {
        const organizationId = user.organizationId;
        const accessToken = await this.getValidAccessToken(organizationId);
        try {
            const accounts = await this.meta.getAdAccounts(accessToken);
            const active = accounts.filter((a) => a.account_status === undefined || a.account_status === 1);
            if (active.length === 0 && accounts.length === 0) {
                await this.prisma.facebookAdsConnection.update({
                    where: { organizationId },
                    data: { status: database_1.FacebookAdsConnectionStatus.NO_AD_ACCOUNT_ACCESS },
                });
                throw new common_1.BadRequestException('Không có quyền truy cập tài khoản quảng cáo nào');
            }
            return {
                items: accounts.map((a) => ({
                    id: a.id,
                    accountId: a.account_id,
                    name: a.name,
                    currency: a.currency ?? 'USD',
                    accountStatus: a.account_status,
                })),
            };
        }
        catch (e) {
            if (e instanceof common_1.BadRequestException)
                throw e;
            await this.handleTokenError(organizationId, e);
            throw e;
        }
    }
    async selectAdAccount(user, dto) {
        const organizationId = user.organizationId;
        await this.ensureConnection(organizationId);
        await this.prisma.facebookAdsConnection.update({
            where: { organizationId },
            data: {
                selectedAdAccountId: dto.adAccountId,
                selectedAdAccountName: dto.adAccountName ?? dto.adAccountId,
                status: database_1.FacebookAdsConnectionStatus.CONNECTED,
            },
        });
        await this.prisma.adConnection.updateMany({
            where: { organizationId, provider: database_1.AdConnectionProvider.META },
            data: {
                externalAccountId: dto.adAccountId,
                externalAccountName: dto.adAccountName ?? dto.adAccountId,
            },
        });
        return { message: 'Đã chọn tài khoản quảng cáo', adAccountId: dto.adAccountId };
    }
    /**
     * API chỉ enqueue BullMQ — không đọc token vào queue (AdsSyncQueueService).
     */
    async sync(user, dto) {
        return this.adsSyncQueue.enqueueMetaSync(user, {
            dateFrom: dto.dateFrom,
            dateTo: dto.dateTo,
            campaignId: dto.campaignId,
        });
    }
    async getCampaigns(user, query) {
        const organizationId = user.organizationId;
        const conn = await this.prisma.facebookAdsConnection.findUnique({
            where: { organizationId },
        });
        const adAccountId = query.adAccountId ?? conn?.selectedAdAccountId;
        if (!adAccountId) {
            return { items: [], adAccountId: null };
        }
        const dateFrom = this.parseDate(query.dateFrom);
        const dateTo = this.parseDate(query.dateTo);
        const rows = await this.prisma.facebookAdsCampaignSnapshot.findMany({
            where: {
                organizationId,
                adAccountId,
                dateFrom,
                dateTo,
                ...(query.campaignId ? { campaignId: query.campaignId } : {}),
            },
            orderBy: { spend: 'desc' },
        });
        return {
            adAccountId,
            items: rows.map((r) => ({
                campaignId: r.campaignId,
                campaignName: r.campaignName,
                campaignType: r.campaignType,
                objective: r.objective,
                spend: Number(r.spend),
                impressions: r.impressions,
                reach: r.reach,
                frequency: Number(r.frequency),
                cpm: Number(r.cpm),
                cpc: Number(r.cpc),
                ctr: Number(r.ctr),
                clicks: r.clicks,
                results: Number(r.results),
                costPerResult: Number(r.costPerResult),
                purchaseRoas: r.purchaseRoas ? Number(r.purchaseRoas) : null,
                resultRate: Number(r.resultRate),
                syncedAt: r.syncedAt,
            })),
        };
    }
    async listSyncLogs(user, limit = 10) {
        const items = await this.prisma.facebookAdsSyncLog.findMany({
            where: { organizationId: user.organizationId },
            orderBy: { syncStartedAt: 'desc' },
            take: limit,
        });
        return {
            items: items.map((l) => ({
                id: l.id,
                adAccountId: l.adAccountId,
                dateFrom: l.dateFrom,
                dateTo: l.dateTo,
                syncStartedAt: l.syncStartedAt,
                syncFinishedAt: l.syncFinishedAt,
                status: l.status,
                errorMessage: l.errorMessage,
                campaignsSynced: l.campaignsSynced,
            })),
        };
    }
    async disconnect(user) {
        const organizationId = user.organizationId;
        await this.prisma.facebookAdsCampaignSnapshot.deleteMany({ where: { organizationId } });
        await this.prisma.facebookAdsSyncLog.deleteMany({ where: { organizationId } });
        await this.prisma.facebookAdsConnection.deleteMany({ where: { organizationId } });
        try {
            await this.connections.clearCredentials(organizationId, database_1.AdConnectionProvider.META, user.id);
        }
        catch (e) {
            // Không có AdConnection — vẫn coi disconnect FacebookAds* thành công
            if (!(e instanceof common_1.NotFoundException))
                throw e;
        }
        return { message: 'Đã ngắt kết nối Facebook Ads' };
    }
    async setCampaignActive(organizationId, campaignId, active) {
        const accessToken = await this.getValidAccessToken(organizationId);
        await this.meta.updateCampaignStatus(accessToken, campaignId, active);
    }
    async ensureConnection(organizationId) {
        const row = await this.prisma.facebookAdsConnection.findUnique({
            where: { organizationId },
        });
        const adConn = await this.connections.getPublic(organizationId, database_1.AdConnectionProvider.META);
        if (!row || !adConn.hasCredentials) {
            throw new common_1.BadRequestException('Chưa kết nối Facebook Ads');
        }
        return row;
    }
    async getValidAccessToken(organizationId) {
        await this.ensureConnection(organizationId);
        try {
            return await this.connections.getMetaAccessToken(organizationId);
        }
        catch (e) {
            await this.handleTokenError(organizationId, e);
            throw e;
        }
    }
    async handleTokenError(organizationId, error) {
        const msg = error instanceof Error ? error.message.toLowerCase() : '';
        if (msg.includes('expired') ||
            msg.includes('invalid oauth') ||
            msg.includes('session has expired') ||
            msg.includes('error validating access token') ||
            msg.includes('token đã hết hạn')) {
            await this.prisma.facebookAdsConnection.updateMany({
                where: { organizationId },
                data: { status: database_1.FacebookAdsConnectionStatus.TOKEN_EXPIRED },
            });
        }
    }
    ensureMetaConfig() {
        this.meta.appId;
        this.meta.appSecret;
    }
    parseDate(iso) {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime()))
            throw new common_1.BadRequestException('Ngày không hợp lệ');
        return d;
    }
    toPublicStatus(status) {
        return status;
    }
    signState(userId, organizationId, returnTo) {
        const payload = `${userId}:${organizationId}:${returnTo ?? ''}:${Date.now() + STATE_TTL_MS}`;
        const sig = (0, crypto_1.createHmac)('sha256', this.getStateSecret()).update(payload).digest('hex');
        return Buffer.from(`${payload}:${sig}`).toString('base64url');
    }
    verifyState(state) {
        try {
            const decoded = Buffer.from(state, 'base64url').toString('utf8');
            const lastColon = decoded.lastIndexOf(':');
            const sig = decoded.slice(lastColon + 1);
            const payload = decoded.slice(0, lastColon);
            const expected = (0, crypto_1.createHmac)('sha256', this.getStateSecret()).update(payload).digest('hex');
            const sigBuf = Buffer.from(sig, 'hex');
            const expBuf = Buffer.from(expected, 'hex');
            if (sigBuf.length !== expBuf.length || !(0, crypto_1.timingSafeEqual)(sigBuf, expBuf)) {
                throw new Error('bad sig');
            }
            const [userId, organizationId, returnTo, expStr] = payload.split(':');
            if (!userId || !organizationId || !expStr)
                throw new Error('bad payload');
            if (Date.now() > parseInt(expStr, 10))
                throw new Error('expired');
            return { userId, organizationId, returnTo: returnTo || undefined };
        }
        catch {
            throw new common_1.UnauthorizedException('State OAuth không hợp lệ');
        }
    }
    getStateSecret() {
        const secret = this.config.get('JWT_SECRET');
        if (!secret)
            throw new common_1.BadRequestException('JWT_SECRET chưa được cấu hình');
        return secret;
    }
};
exports.FacebookAdsService = FacebookAdsService;
exports.FacebookAdsService = FacebookAdsService = FacebookAdsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        meta_graph_api_service_1.MetaGraphApiService,
        ad_connection_facade_1.AdConnectionFacade,
        ads_sync_queue_service_1.AdsSyncQueueService])
], FacebookAdsService);
