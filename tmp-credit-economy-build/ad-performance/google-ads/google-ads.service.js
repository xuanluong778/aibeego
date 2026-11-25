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
var GoogleAdsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleAdsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const database_1 = require("@marketingspa/database");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../audit/audit.service");
const redis_constants_1 = require("../../redis/redis.constants");
const token_security_util_1 = require("../../common/utils/token-security.util");
const ad_connection_facade_1 = require("../ad-connection.facade");
const ads_sync_queue_service_1 = require("../ads-sync-queue.service");
const google_ads_api_service_1 = require("./google-ads-api.service");
const shared_1 = require("@marketingspa/shared");
const STATE_TTL_SEC = 600;
const STATE_PREFIX = 'oauth:google-ads:state:';
const ADWORDS_SCOPE = 'https://www.googleapis.com/auth/adwords';
let GoogleAdsService = GoogleAdsService_1 = class GoogleAdsService {
    prisma;
    config;
    googleApi;
    connections;
    adsSyncQueue;
    audit;
    redis;
    logger = new common_1.Logger(GoogleAdsService_1.name);
    /** Dev fallback when Redis unavailable — not for production scale. */
    memoryStates = new Map();
    constructor(prisma, config, googleApi, connections, adsSyncQueue, audit, redis) {
        this.prisma = prisma;
        this.config = config;
        this.googleApi = googleApi;
        this.connections = connections;
        this.adsSyncQueue = adsSyncQueue;
        this.audit = audit;
        this.redis = redis;
    }
    async getOAuthStartUrl(user, returnTo) {
        this.ensureGoogleConfig();
        const state = await this.createOneTimeState({
            userId: user.id,
            organizationId: user.organizationId,
            returnTo: returnTo ?? 'ads',
        });
        const url = this.googleApi.buildOAuthUrl(state);
        this.logger.log(`Google Ads OAuth start org=…${user.organizationId.slice(-6)} redirectUri=${this.config.get('GOOGLE_ADS_REDIRECT_URI')?.trim()?.replace(/\/+$/, '')}`);
        return { url };
    }
    async handleOAuthCallback(code, state, error) {
        const appUrl = this.config.get('APP_URL') ?? 'http://localhost:3000';
        const base = `${appUrl}/ads`;
        if (error) {
            return {
                redirectUrl: `${base}?google=error&message=${encodeURIComponent(error)}`,
            };
        }
        if (!code || !state) {
            return { redirectUrl: `${base}?google=error&message=missing_code` };
        }
        let payload;
        try {
            payload = await this.consumeOneTimeState(state);
        }
        catch {
            return { redirectUrl: `${base}?google=error&message=invalid_state` };
        }
        try {
            const tokens = await this.googleApi.exchangeCodeForTokens(code);
            if (!tokens.refreshToken) {
                throw new common_1.BadRequestException('Google không trả refresh token — thử ngắt kết nối app trong Google Account và kết nối lại');
            }
            const existingBefore = await this.prisma.adConnection.findUnique({
                where: {
                    organizationId_provider: {
                        organizationId: payload.organizationId,
                        provider: database_1.AdConnectionProvider.GOOGLE,
                    },
                },
            });
            const prevCustomerId = (0, shared_1.normalizeGoogleCustomerId)(existingBefore?.externalAccountId);
            const prevMeta = (existingBefore?.metadata ?? {});
            const grantedScopes = (tokens.scope ?? ADWORDS_SCOPE)
                .split(/\s+/)
                .map((s) => s.trim())
                .filter(Boolean);
            if (!grantedScopes.some((s) => s.includes('adwords'))) {
                grantedScopes.push(ADWORDS_SCOPE);
            }
            await this.connections.upsertEncryptedCredentials({
                organizationId: payload.organizationId,
                userId: payload.userId,
                provider: database_1.AdConnectionProvider.GOOGLE,
                plaintextPayload: JSON.stringify({ refreshToken: tokens.refreshToken }),
                status: database_1.AdConnectionStatus.CONNECTED,
                scopes: grantedScopes,
                tokenExpiresAt: null,
                metadata: {
                    ...prevMeta,
                    pendingCustomerSelection: !prevCustomerId,
                    oauthReconnectedAt: new Date().toISOString(),
                    oauthScopes: grantedScopes,
                },
            });
            await this.audit.log({
                organizationId: payload.organizationId,
                userId: payload.userId,
                action: 'GOOGLE_ADS_OAUTH_CONNECTED',
                entityType: 'AD_CONNECTION',
                entityId: payload.organizationId,
                metadata: (0, token_security_util_1.redactForAudit)({ provider: 'GOOGLE' }),
            });
            const customers = await this.discoverCustomers(payload.organizationId);
            const previouslySelected = await this.prisma.adGoogleAdsAccount.findMany({
                where: { organizationId: payload.organizationId, isSelected: true },
                select: { customerId: true },
            });
            const restoreIds = new Set(previouslySelected.map((a) => a.customerId));
            if (prevCustomerId)
                restoreIds.add(prevCustomerId);
            const restored = customers.filter((c) => restoreIds.has(c.customerId));
            if (restored.length > 0) {
                let i = 0;
                for (const acc of restored) {
                    await this.applyCustomerSelection(payload.organizationId, payload.userId, {
                        customerId: acc.customerId,
                        customerName: acc.name,
                        loginCustomerId: acc.loginCustomerId ?? undefined,
                    }, {
                        autoSync: i === 0,
                        keepOthers: true,
                        setPrimary: i === 0,
                        discovered: customers,
                    });
                    i += 1;
                }
                return { redirectUrl: `${base}?google=connected&sync=started&reconnected=1` };
            }
            if (customers.length === 1) {
                const only = customers[0];
                await this.applyCustomerSelection(payload.organizationId, payload.userId, {
                    customerId: only.customerId,
                    customerName: only.name,
                    loginCustomerId: only.loginCustomerId ?? undefined,
                }, { autoSync: true });
                return { redirectUrl: `${base}?google=connected&sync=started` };
            }
            if (customers.length === 0) {
                return {
                    redirectUrl: `${base}?google=error&message=${encodeURIComponent('Không tìm thấy tài khoản Google Ads')}`,
                };
            }
            return { redirectUrl: `${base}?google=select_account` };
        }
        catch (e) {
            await this.handleTokenError(payload.organizationId, e);
            const message = e instanceof Error ? e.message : 'oauth_failed';
            this.logger.warn(`Google OAuth callback failed org=…${payload.organizationId.slice(-6)}: ${message.slice(0, 200)}`);
            return {
                redirectUrl: `${base}?google=error&message=${encodeURIComponent(message)}`,
            };
        }
    }
    async getStatus(user) {
        const pub = await this.connections.getPublic(user.organizationId, database_1.AdConnectionProvider.GOOGLE);
        const row = await this.prisma.adConnection.findUnique({
            where: {
                organizationId_provider: {
                    organizationId: user.organizationId,
                    provider: database_1.AdConnectionProvider.GOOGLE,
                },
            },
        });
        const meta = (row?.metadata ?? {});
        const linked = await this.prisma.adGoogleAdsAccount.findMany({
            where: { organizationId: user.organizationId, isSelected: true },
            orderBy: { createdAt: 'asc' },
        });
        let status = pub.status;
        if (!pub.hasCredentials)
            status = database_1.AdConnectionStatus.DISCONNECTED;
        else if (meta.pendingCustomerSelection && !pub.externalAccountId)
            status = 'PENDING_ACCOUNT';
        else if (pub.status === database_1.AdConnectionStatus.CONNECTED)
            status = 'CONNECTED';
        return {
            status,
            connected: pub.hasCredentials && pub.status === database_1.AdConnectionStatus.CONNECTED,
            customerId: pub.externalAccountId,
            customerName: pub.accountName,
            lastSyncAt: pub.lastSyncAt,
            lastError: pub.lastError,
            pendingCustomerSelection: Boolean(meta.pendingCustomerSelection && !pub.externalAccountId),
            loginCustomerId: meta.loginCustomerId ?? linked[0]?.loginCustomerId ?? null,
            accounts: linked.map((a) => ({
                customerId: a.customerId,
                loginCustomerId: a.loginCustomerId,
                name: a.name,
                isManager: a.isManager,
                accessType: a.accessType,
                isSelected: a.isSelected,
            })),
        };
    }
    async listCustomers(user) {
        try {
            const items = await this.discoverCustomers(user.organizationId);
            return { items };
        }
        catch (e) {
            await this.throwUserFacingGoogleError(user.organizationId, e);
        }
    }
    async listLinkedAccounts(user) {
        const items = await this.prisma.adGoogleAdsAccount.findMany({
            where: { organizationId: user.organizationId },
            orderBy: { createdAt: 'asc' },
        });
        return {
            items: items.map((a) => ({
                customerId: a.customerId,
                loginCustomerId: a.loginCustomerId,
                name: a.name,
                currency: a.currency,
                timezone: a.timezone,
                isManager: a.isManager,
                isSelected: a.isSelected,
                accessType: a.accessType,
            })),
        };
    }
    async selectCustomer(user, dto) {
        try {
            await this.applyCustomerSelection(user.organizationId, user.id, dto, { autoSync: true });
        }
        catch (e) {
            await this.throwUserFacingGoogleError(user.organizationId, e);
        }
        return {
            message: 'Đã chọn tài khoản Google Ads',
            customerId: (0, shared_1.normalizeGoogleCustomerId)(dto.customerId),
        };
    }
    async selectAccounts(user, dto) {
        const accounts = dto.accounts ?? [];
        if (!accounts.length)
            throw new common_1.BadRequestException('Chọn ít nhất một tài khoản Google Ads');
        try {
            const discovered = await this.discoverCustomers(user.organizationId);
            let i = 0;
            for (const acc of accounts) {
                await this.applyCustomerSelection(user.organizationId, user.id, acc, {
                    autoSync: i === 0,
                    keepOthers: true,
                    setPrimary: i === 0,
                    discovered,
                });
                i += 1;
            }
        }
        catch (e) {
            await this.throwUserFacingGoogleError(user.organizationId, e);
        }
        if (dto.deselectOthers) {
            const keep = new Set(accounts.map((a) => (0, shared_1.normalizeGoogleCustomerId)(a.customerId)));
            await this.prisma.adGoogleAdsAccount.updateMany({
                where: {
                    organizationId: user.organizationId,
                    customerId: { notIn: [...keep] },
                },
                data: { isSelected: false },
            });
        }
        return {
            message: `Đã liên kết ${accounts.length} tài khoản Google Ads`,
            customerIds: accounts.map((a) => (0, shared_1.normalizeGoogleCustomerId)(a.customerId)),
        };
    }
    async sync(user, dto) {
        return this.adsSyncQueue.enqueueGoogleSync(user, {
            dateFrom: dto.dateFrom,
            dateTo: dto.dateTo,
        });
    }
    async getSyncJob(user, jobId) {
        return this.adsSyncQueue.getJob(user, jobId);
    }
    async disconnect(user) {
        const organizationId = user.organizationId;
        try {
            await this.connections.clearCredentials(organizationId, database_1.AdConnectionProvider.GOOGLE, user.id);
        }
        catch (e) {
            if (!(e instanceof common_1.NotFoundException))
                throw e;
        }
        await this.prisma.adGoogleAdsAccount.updateMany({
            where: { organizationId },
            data: { isSelected: false },
        });
        await this.audit.log({
            organizationId,
            userId: user.id,
            action: 'GOOGLE_ADS_DISCONNECTED',
            entityType: 'AD_CONNECTION',
            entityId: organizationId,
            metadata: (0, token_security_util_1.redactForAudit)({ provider: 'GOOGLE' }),
        });
        return { message: 'Đã ngắt kết nối Google Ads' };
    }
    /**
     * Per-tenant discovery: ListAccessibleCustomers → direct detail → MCC customer_client.
     * Never uses GOOGLE_ADS_LOGIN_CUSTOMER_ID (that ID belongs to one operator, not every tenant).
     */
    async discoverCustomers(organizationId) {
        const refreshToken = await this.connections.getGoogleRefreshToken(organizationId);
        const accessToken = await this.googleApi.refreshAccessToken(refreshToken);
        const accessibleIds = await this.googleApi.listAccessibleCustomers(accessToken);
        const direct = [];
        const childrenByManager = {};
        for (const id of accessibleIds.slice(0, 50)) {
            try {
                const detail = await this.googleApi.getCustomerDetail(accessToken, id, null);
                direct.push({
                    customerId: detail.id,
                    name: detail.name,
                    currency: detail.currency,
                    timezone: detail.timezone,
                    isManager: detail.isManager,
                });
                if (detail.isManager) {
                    try {
                        childrenByManager[id] = await this.googleApi.listCustomerClients(accessToken, id);
                    }
                    catch (e) {
                        if (e instanceof google_ads_api_service_1.GoogleAdsRateLimitError || e instanceof google_ads_api_service_1.GoogleAdsTwoFactorError) {
                            throw e;
                        }
                        this.logger.debug(`MCC children skip …${id.slice(-4)}: ${e instanceof Error ? e.message : e}`);
                    }
                }
            }
            catch (e) {
                if (e instanceof google_ads_api_service_1.GoogleAdsRateLimitError || e instanceof google_ads_api_service_1.GoogleAdsTwoFactorError)
                    throw e;
                if (e instanceof google_ads_api_service_1.GoogleAdsTokenExpiredError)
                    throw e;
                this.logger.debug(`Direct access skip …${id.slice(-4)}: ${e instanceof Error ? e.message : e}`);
            }
        }
        return (0, shared_1.mergeGoogleAdsHierarchy)({ accessibleIds, direct, childrenByManager });
    }
    async applyCustomerSelection(organizationId, userId, dto, opts) {
        const customerId = (0, shared_1.normalizeGoogleCustomerId)(dto.customerId);
        if (!customerId)
            throw new common_1.BadRequestException('Customer ID không hợp lệ');
        const setPrimary = opts?.setPrimary !== false;
        const discovered = opts?.discovered ?? (await this.discoverCustomers(organizationId));
        const match = discovered.find((c) => c.customerId === customerId);
        const requestedLogin = (0, shared_1.normalizeGoogleCustomerId)(dto.loginCustomerId) || null;
        const loginCustomerId = match?.loginCustomerId ??
            (requestedLogin && requestedLogin !== customerId ? requestedLogin : null);
        const refreshToken = await this.connections.getGoogleRefreshToken(organizationId);
        const accessToken = await this.googleApi.refreshAccessToken(refreshToken);
        const detail = await this.googleApi.getCustomerDetail(accessToken, customerId, loginCustomerId);
        const connection = await this.connections.upsertEncryptedCredentials({
            organizationId,
            userId,
            provider: database_1.AdConnectionProvider.GOOGLE,
            plaintextPayload: JSON.stringify({ refreshToken }),
            status: database_1.AdConnectionStatus.CONNECTED,
            ...(setPrimary
                ? {
                    externalAccountId: customerId,
                    externalAccountName: dto.customerName?.trim() || detail.name,
                    metadata: {
                        loginCustomerId,
                        pendingCustomerSelection: false,
                        currency: detail.currency,
                        timezone: detail.timezone,
                        accessType: match?.accessType ?? (loginCustomerId ? 'mcc' : 'direct'),
                    },
                }
                : {}),
        });
        await this.prisma.adGoogleAdsAccount.upsert({
            where: {
                organizationId_customerId: { organizationId, customerId },
            },
            create: {
                organizationId,
                connectionId: connection.id,
                customerId,
                loginCustomerId,
                name: dto.customerName?.trim() || detail.name,
                currency: detail.currency,
                timezone: detail.timezone,
                isManager: detail.isManager,
                isSelected: true,
                accessType: match?.accessType ?? (loginCustomerId ? 'mcc' : 'direct'),
            },
            update: {
                connectionId: connection.id,
                loginCustomerId,
                name: dto.customerName?.trim() || detail.name,
                currency: detail.currency,
                timezone: detail.timezone,
                isManager: detail.isManager,
                isSelected: true,
                accessType: match?.accessType ?? (loginCustomerId ? 'mcc' : 'direct'),
                lastError: null,
            },
        });
        if (!opts?.keepOthers && setPrimary) {
            await this.prisma.adGoogleAdsAccount.updateMany({
                where: { organizationId, customerId: { not: customerId } },
                data: { isSelected: false },
            });
        }
        await this.prisma.adPlatformAccount.upsert({
            where: {
                userId_platform_externalId: {
                    userId,
                    platform: database_1.AdPlatform.GOOGLE,
                    externalId: customerId,
                },
            },
            create: {
                userId,
                organizationId,
                platform: database_1.AdPlatform.GOOGLE,
                externalId: customerId,
                name: detail.name,
                currency: detail.currency,
                timezone: detail.timezone,
                isActive: true,
            },
            update: {
                name: detail.name,
                currency: detail.currency,
                timezone: detail.timezone,
                isActive: true,
            },
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'GOOGLE_ADS_CUSTOMER_SELECTED',
            entityType: 'AD_CONNECTION',
            entityId: organizationId,
            metadata: (0, token_security_util_1.redactForAudit)({ customerId, loginCustomerId }),
        });
        if (opts?.autoSync) {
            const stubUser = { id: userId, organizationId };
            try {
                await this.adsSyncQueue.enqueueGoogleSync(stubUser, {});
            }
            catch (e) {
                if (e instanceof common_1.BadRequestException || e.status === 409) {
                    this.logger.debug(`Google auto-sync skipped: ${e instanceof Error ? e.message : e}`);
                }
                else {
                    throw e;
                }
            }
        }
    }
    ensureGoogleConfig() {
        const id = this.config.get('GOOGLE_CLIENT_ID')?.trim();
        const secret = this.config.get('GOOGLE_CLIENT_SECRET')?.trim();
        const devToken = this.config.get('GOOGLE_ADS_DEVELOPER_TOKEN')?.trim();
        const redirect = this.config.get('GOOGLE_ADS_REDIRECT_URI')?.trim();
        if (!id || !secret || !devToken || !redirect) {
            throw new common_1.BadRequestException('Google Ads OAuth chưa cấu hình (GOOGLE_CLIENT_ID/SECRET/DEVELOPER_TOKEN/REDIRECT_URI)');
        }
    }
    stateSecret() {
        const key = this.config.get('JWT_SECRET') ?? this.config.get('ENCRYPTION_KEY');
        if (!key || key.length < 16) {
            throw new common_1.BadRequestException('JWT_SECRET/ENCRYPTION_KEY chưa cấu hình cho OAuth state');
        }
        return key;
    }
    signStateId(stateId) {
        return (0, crypto_1.createHmac)('sha256', this.stateSecret()).update(stateId).digest('hex');
    }
    verifyStateSignature(stateId, sig) {
        const expected = this.signStateId(stateId);
        const a = Buffer.from(sig, 'hex');
        const b = Buffer.from(expected, 'hex');
        if (a.length !== b.length || !(0, crypto_1.timingSafeEqual)(a, b)) {
            throw new common_1.UnauthorizedException('Invalid OAuth state signature');
        }
    }
    async createOneTimeState(payload) {
        const stateId = (0, crypto_1.randomBytes)(24).toString('hex');
        const key = `${STATE_PREFIX}${stateId}`;
        const serialized = JSON.stringify(payload);
        if (this.redis) {
            const ok = await this.redis.set(key, serialized, 'EX', STATE_TTL_SEC, 'NX');
            if (ok !== 'OK') {
                throw new common_1.BadRequestException('OAuth state busy — thử lại');
            }
        }
        else {
            this.memoryStates.set(stateId, {
                payload,
                expiresAt: Date.now() + STATE_TTL_SEC * 1000,
            });
        }
        return `${stateId}.${this.signStateId(stateId)}`;
    }
    async consumeOneTimeState(state) {
        const [stateId, sig] = state.split('.');
        if (!stateId || !sig)
            throw new common_1.UnauthorizedException('Invalid OAuth state');
        this.verifyStateSignature(stateId, sig);
        const key = `${STATE_PREFIX}${stateId}`;
        let raw = null;
        if (this.redis) {
            raw = await this.redis.getdel(key);
        }
        else {
            const entry = this.memoryStates.get(stateId);
            if (entry && entry.expiresAt > Date.now()) {
                raw = JSON.stringify(entry.payload);
            }
            this.memoryStates.delete(stateId);
        }
        if (!raw)
            throw new common_1.UnauthorizedException('OAuth state expired or reused');
        return JSON.parse(raw);
    }
    async handleTokenError(organizationId, err) {
        const detail = this.extractParsed(err);
        const lastError = (detail
            ? `${detail.errorCode || detail.rpcStatus || `HTTP_${detail.httpStatus}`}: ${detail.message}`
            : err instanceof Error
                ? err.message
                : 'google_ads_error').slice(0, 400);
        if (err instanceof google_ads_api_service_1.GoogleAdsTokenExpiredError) {
            await this.prisma.adConnection.updateMany({
                where: { organizationId, provider: database_1.AdConnectionProvider.GOOGLE },
                data: { status: database_1.AdConnectionStatus.TOKEN_EXPIRED, lastError },
            });
        }
        else if (err instanceof google_ads_api_service_1.GoogleAdsTwoFactorError) {
            await this.prisma.adConnection.updateMany({
                where: { organizationId, provider: database_1.AdConnectionProvider.GOOGLE },
                data: {
                    status: database_1.AdConnectionStatus.ERROR,
                    lastError,
                },
            });
        }
        else if (err instanceof google_ads_api_service_1.GoogleAdsPermissionError || err instanceof google_ads_api_service_1.GoogleAdsRequestError) {
            await this.prisma.adConnection.updateMany({
                where: { organizationId, provider: database_1.AdConnectionProvider.GOOGLE },
                data: {
                    status: err instanceof google_ads_api_service_1.GoogleAdsPermissionError
                        ? database_1.AdConnectionStatus.INSUFFICIENT_PERMISSIONS
                        : database_1.AdConnectionStatus.ERROR,
                    lastError,
                },
            });
        }
    }
    extractParsed(err) {
        if (err instanceof google_ads_api_service_1.GoogleAdsPermissionError ||
            err instanceof google_ads_api_service_1.GoogleAdsTokenExpiredError ||
            err instanceof google_ads_api_service_1.GoogleAdsTwoFactorError ||
            err instanceof google_ads_api_service_1.GoogleAdsRateLimitError ||
            err instanceof google_ads_api_service_1.GoogleAdsRequestError) {
            return err.parsed;
        }
        return undefined;
    }
    googleErrorResponseBody(err, parsed) {
        const code = parsed?.errorCode || parsed?.rpcStatus || err.name || 'GOOGLE_ADS_ERROR';
        return {
            message: err.message,
            code,
            googleAdsErrorCode: parsed?.errorCode ?? null,
            googleAdsStatus: parsed?.rpcStatus ?? null,
            requestId: parsed?.requestId ?? null,
            guidance: parsed?.guidance ?? null,
            classification: parsed?.classification ?? null,
        };
    }
    async throwUserFacingGoogleError(organizationId, err) {
        await this.handleTokenError(organizationId, err);
        if (err instanceof google_ads_api_service_1.GoogleAdsTokenExpiredError) {
            throw new common_1.UnauthorizedException(this.googleErrorResponseBody(new Error('Google Ads token hết hạn hoặc bị thu hồi — kết nối lại OAuth'), err.parsed));
        }
        if (err instanceof google_ads_api_service_1.GoogleAdsTwoFactorError) {
            throw new common_1.BadRequestException(this.googleErrorResponseBody(err, err.parsed));
        }
        if (err instanceof google_ads_api_service_1.GoogleAdsPermissionError) {
            throw new common_1.ForbiddenException(this.googleErrorResponseBody(err, err.parsed));
        }
        if (err instanceof google_ads_api_service_1.GoogleAdsRequestError) {
            const status = err.parsed.httpStatus;
            if (status === 404) {
                throw new common_1.NotFoundException(this.googleErrorResponseBody(err, err.parsed));
            }
            throw new common_1.BadRequestException(this.googleErrorResponseBody(err, err.parsed));
        }
        if (err instanceof common_1.BadRequestException)
            throw err;
        const message = err instanceof Error ? err.message.slice(0, 200) : 'google_ads_failed';
        throw new common_1.BadRequestException(message);
    }
};
exports.GoogleAdsService = GoogleAdsService;
exports.GoogleAdsService = GoogleAdsService = GoogleAdsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(6, (0, common_1.Optional)()),
    __param(6, (0, common_1.Inject)(redis_constants_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        google_ads_api_service_1.GoogleAdsApiService,
        ad_connection_facade_1.AdConnectionFacade,
        ads_sync_queue_service_1.AdsSyncQueueService,
        audit_service_1.AuditService, Function])
], GoogleAdsService);
