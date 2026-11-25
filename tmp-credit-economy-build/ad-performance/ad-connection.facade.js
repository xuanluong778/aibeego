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
exports.AdConnectionFacade = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const token_security_util_1 = require("../common/utils/token-security.util");
/**
 * Nguồn kết nối Ads duy nhất (organization-scoped).
 * Mọi module khác chỉ dùng facade này — không đọc Integration / FacebookAdsConnection token.
 */
let AdConnectionFacade = class AdConnectionFacade {
    prisma;
    config;
    constructor(prisma, config) {
        this.prisma = prisma;
        this.config = config;
    }
    async listPublic(organizationId) {
        const providers = [
            database_1.AdConnectionProvider.META,
            database_1.AdConnectionProvider.GOOGLE,
            database_1.AdConnectionProvider.GMAIL,
        ];
        const rows = await this.prisma.adConnection.findMany({ where: { organizationId } });
        const byProvider = new Map(rows.map((r) => [r.provider, r]));
        const items = providers.map((provider) => this.toPublic(provider, byProvider.get(provider)));
        (0, token_security_util_1.assertNoCredentialLeak)(items);
        return items;
    }
    async getPublic(organizationId, provider) {
        const row = await this.prisma.adConnection.findUnique({
            where: { organizationId_provider: { organizationId, provider } },
        });
        const item = this.toPublic(provider, row ?? undefined);
        (0, token_security_util_1.assertNoCredentialLeak)(item);
        return item;
    }
    /**
     * Map IntegrationProvider META_ADS/GOOGLE_ADS → status từ AdConnection (không đọc Integration.encryptedCredentials).
     */
    async getAdsStatusForIntegrationProvider(organizationId, integrationProvider) {
        const provider = integrationProvider === 'META_ADS' ? database_1.AdConnectionProvider.META : database_1.AdConnectionProvider.GOOGLE;
        const pub = await this.getPublic(organizationId, provider);
        const status = pub.status === database_1.AdConnectionStatus.CONNECTED
            ? 'ACTIVE'
            : pub.status === database_1.AdConnectionStatus.TOKEN_EXPIRED
                ? 'EXPIRED'
                : pub.status === database_1.AdConnectionStatus.ERROR
                    ? 'ERROR'
                    : 'DISCONNECTED';
        const payload = {
            provider: integrationProvider,
            label: integrationProvider === 'META_ADS' ? 'Facebook Ads' : 'Google Ads',
            status,
            hasCredentials: pub.hasCredentials,
            maskedHint: pub.accountName,
            lastTestedAt: pub.lastSyncAt,
            updatedAt: pub.lastSyncAt,
            credentialSource: 'AdConnection',
            connectVia: '/ads',
        };
        (0, token_security_util_1.assertNoCredentialLeak)(payload);
        return payload;
    }
    async upsertEncryptedCredentials(params) {
        const encryptedCredentials = (0, token_security_util_1.encodeStoredSecret)(params.plaintextPayload, this.getEncryptionKey());
        return this.prisma.adConnection.upsert({
            where: {
                organizationId_provider: {
                    organizationId: params.organizationId,
                    provider: params.provider,
                },
            },
            create: {
                organizationId: params.organizationId,
                userId: params.userId,
                provider: params.provider,
                status: params.status ?? database_1.AdConnectionStatus.CONNECTED,
                encryptedCredentials,
                scopes: params.scopes ?? [],
                tokenExpiresAt: params.tokenExpiresAt ?? null,
                externalAccountId: params.externalAccountId ?? null,
                externalAccountName: params.externalAccountName ?? null,
                metadata: params.metadata ?? {},
            },
            update: {
                userId: params.userId,
                status: params.status ?? database_1.AdConnectionStatus.CONNECTED,
                encryptedCredentials,
                scopes: params.scopes ?? [],
                tokenExpiresAt: params.tokenExpiresAt ?? null,
                externalAccountId: params.externalAccountId ?? undefined,
                externalAccountName: params.externalAccountName ?? undefined,
                lastError: null,
                ...(params.metadata !== undefined && { metadata: params.metadata }),
            },
        });
    }
    async clearCredentials(organizationId, provider, userId) {
        const existing = await this.prisma.adConnection.findUnique({
            where: { organizationId_provider: { organizationId, provider } },
        });
        if (!existing) {
            throw new common_1.NotFoundException('Không tìm thấy tài nguyên');
        }
        await this.prisma.adConnection.update({
            where: { id: existing.id },
            data: {
                userId,
                status: database_1.AdConnectionStatus.DISCONNECTED,
                encryptedCredentials: null,
                tokenExpiresAt: null,
                externalAccountId: null,
                externalAccountName: null,
                lastError: null,
            },
        });
        return { ok: true };
    }
    /**
     * Decrypt access/refresh payload for provider call sites inside ad-performance only.
     * Never return to controllers / queue / logs.
     */
    async getDecryptedPayload(organizationId, provider) {
        const row = await this.prisma.adConnection.findUnique({
            where: { organizationId_provider: { organizationId, provider } },
        });
        if (!row?.encryptedCredentials) {
            throw new common_1.BadRequestException(`Chưa kết nối ${provider}`);
        }
        if (row.tokenExpiresAt && row.tokenExpiresAt.getTime() < Date.now()) {
            await this.prisma.adConnection.update({
                where: { id: row.id },
                data: { status: database_1.AdConnectionStatus.TOKEN_EXPIRED },
            });
            throw new common_1.BadRequestException('Token đã hết hạn, vui lòng kết nối lại');
        }
        const plaintext = (0, token_security_util_1.decodeStoredSecret)(row.encryptedCredentials, this.getEncryptionKey());
        if (!plaintext) {
            throw new common_1.BadRequestException('Không đọc được credential đã lưu');
        }
        return {
            plaintext,
            metadata: (row.metadata ?? {}),
            tokenExpiresAt: row.tokenExpiresAt,
        };
    }
    async getMetaAccessToken(organizationId) {
        try {
            const { plaintext, metadata } = await this.getDecryptedPayload(organizationId, database_1.AdConnectionProvider.META);
            if (metadata.legacyTokenCipher) {
                return plaintext;
            }
            try {
                const parsed = JSON.parse(plaintext);
                if (parsed.accessToken)
                    return parsed.accessToken;
            }
            catch {
                /* plain */
            }
            return plaintext;
        }
        catch (e) {
            // Bootstrap từ MetaAdsMCP / env — chỉ khi org chưa có OAuth token
            const envToken = this.config.get('META_ACCESS_TOKEN')?.trim();
            if (envToken) {
                return envToken;
            }
            throw e;
        }
    }
    /** Ad account bootstrap từ env (META_AD_ACCOUNT_ID) khi org chưa chọn account. */
    getEnvMetaAdAccountId() {
        const id = this.config.get('META_AD_ACCOUNT_ID')?.trim();
        return id || null;
    }
    async getGoogleRefreshToken(organizationId) {
        const { plaintext } = await this.getDecryptedPayload(organizationId, database_1.AdConnectionProvider.GOOGLE);
        try {
            const parsed = JSON.parse(plaintext);
            if (parsed.refreshToken?.trim())
                return parsed.refreshToken.trim();
        }
        catch {
            /* plain refresh token legacy */
        }
        if (plaintext.trim())
            return plaintext.trim();
        throw new common_1.BadRequestException('Chưa có Google refresh token');
    }
    /** Safe audit helper */
    redact(payload) {
        return (0, token_security_util_1.redactForAudit)(payload);
    }
    toPublic(provider, row) {
        const status = row?.status ?? database_1.AdConnectionStatus.DISCONNECTED;
        return {
            provider,
            status,
            connected: status === database_1.AdConnectionStatus.CONNECTED,
            accountName: row?.externalAccountName ?? null,
            externalAccountId: row?.externalAccountId ?? null,
            lastSyncAt: row?.lastSyncAt ?? null,
            lastError: row?.lastError ?? null,
            tokenExpiresAt: row?.tokenExpiresAt ?? null,
            hasCredentials: !!row?.encryptedCredentials,
            credentialSource: 'AdConnection',
        };
    }
    getEncryptionKey() {
        const key = this.config.get('ENCRYPTION_KEY');
        if (!key || key.length < 16) {
            throw new common_1.BadRequestException('ENCRYPTION_KEY chưa được cấu hình');
        }
        return key;
    }
};
exports.AdConnectionFacade = AdConnectionFacade;
exports.AdConnectionFacade = AdConnectionFacade = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], AdConnectionFacade);
