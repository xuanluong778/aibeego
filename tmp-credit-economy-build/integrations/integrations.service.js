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
exports.IntegrationsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const ad_connection_facade_1 = require("../ad-performance/ad-connection.facade");
const ads_normalized_service_1 = require("../ad-performance/ads-normalized.service");
const encryption_util_1 = require("../common/utils/encryption.util");
const token_security_util_1 = require("../common/utils/token-security.util");
const connectors_1 = require("../marketing/connectors");
const PROVIDER_LABELS = {
    [database_1.IntegrationProvider.META_ADS]: 'Facebook Ads',
    [database_1.IntegrationProvider.GOOGLE_ADS]: 'Google Ads',
    [database_1.IntegrationProvider.ZALO_OA]: 'Zalo OA / ZNS',
    [database_1.IntegrationProvider.SMS]: 'SMS',
    [database_1.IntegrationProvider.EMAIL]: 'Email',
};
/**
 * Integrations: kênh messaging giữ credential riêng.
 * META_ADS / GOOGLE_ADS chỉ facade → AdConnection (ad-performance) — không kho token riêng.
 */
let IntegrationsService = class IntegrationsService {
    prisma;
    config;
    audit;
    adConnections;
    normalizedAds;
    constructor(prisma, config, audit, adConnections, normalizedAds) {
        this.prisma = prisma;
        this.config = config;
        this.audit = audit;
        this.adConnections = adConnections;
        this.normalizedAds = normalizedAds;
    }
    async list(organizationId) {
        const existing = await this.prisma.integration.findMany({ where: { organizationId } });
        const byProvider = new Map(existing.map((i) => [i.provider, i]));
        const items = await Promise.all(connectors_1.ALL_INTEGRATION_PROVIDERS.map(async (provider) => {
            if ((0, connectors_1.isAdsIntegrationProvider)(provider)) {
                return this.adConnections.getAdsStatusForIntegrationProvider(organizationId, provider);
            }
            const row = byProvider.get(provider);
            return row
                ? this.toPublic(row)
                : {
                    provider,
                    label: PROVIDER_LABELS[provider],
                    status: database_1.IntegrationStatus.DISCONNECTED,
                    hasCredentials: false,
                    maskedHint: null,
                    lastTestedAt: null,
                    updatedAt: null,
                };
        }));
        (0, token_security_util_1.assertNoCredentialLeak)(items);
        return items;
    }
    async connect(organizationId, provider, dto, userId) {
        if ((0, connectors_1.isAdsIntegrationProvider)(provider)) {
            throw new common_1.BadRequestException('META_ADS/GOOGLE_ADS không lưu credential tại Integrations. Kết nối qua /ads (AdConnection / OAuth).');
        }
        const encryptionKey = this.getEncryptionKey();
        const connector = (0, connectors_1.createConnector)(provider);
        const connectResult = await connector.connect(dto.credentials);
        if (!connectResult.success) {
            throw new common_1.BadRequestException(connectResult.message);
        }
        const encryptedCredentials = (0, encryption_util_1.encryptSecret)(JSON.stringify(dto.credentials), encryptionKey);
        const accountHint = Object.values(dto.credentials).find((v) => v?.trim());
        const metadata = (0, token_security_util_1.sanitizePublicMetadata)({
            accountHint: accountHint ? (0, encryption_util_1.maskSecret)(accountHint) : undefined,
            externalAccountId: connectResult.externalAccountId
                ? (0, encryption_util_1.maskSecret)(connectResult.externalAccountId)
                : undefined,
        });
        const row = await this.prisma.integration.upsert({
            where: { organizationId_provider: { organizationId, provider } },
            create: {
                organizationId,
                provider,
                status: database_1.IntegrationStatus.ACTIVE,
                encryptedCredentials,
                metadata: metadata,
                lastTestedAt: new Date(),
            },
            update: {
                status: database_1.IntegrationStatus.ACTIVE,
                encryptedCredentials,
                metadata: metadata,
                lastTestedAt: new Date(),
            },
        });
        const integration = this.toPublic(row);
        (0, token_security_util_1.assertNoCredentialLeak)(integration, accountHint);
        await this.audit.log({
            organizationId,
            userId,
            action: 'INTEGRATION_CONNECTED',
            entityType: 'INTEGRATION',
            entityId: row.id,
            metadata: (0, token_security_util_1.redactForAudit)({ provider, status: database_1.IntegrationStatus.ACTIVE }),
        });
        return {
            message: connectResult.message,
            integration,
        };
    }
    async test(organizationId, provider, userId) {
        if ((0, connectors_1.isAdsIntegrationProvider)(provider)) {
            const status = await this.adConnections.getAdsStatusForIntegrationProvider(organizationId, provider);
            return {
                success: status.hasCredentials && status.status === 'ACTIVE',
                message: status.hasCredentials
                    ? 'AdConnection OK (credential tại AdConnection, không phải Integration)'
                    : 'Chưa kết nối Ads — mở /ads để OAuth',
                integration: status,
            };
        }
        const row = await this.ensureIntegration(organizationId, provider);
        if (!row.encryptedCredentials) {
            throw new common_1.BadRequestException('Chưa cấu hình credentials');
        }
        const credentials = JSON.parse((0, encryption_util_1.decryptSecret)(row.encryptedCredentials, this.getEncryptionKey()));
        const connector = (0, connectors_1.createConnector)(provider);
        const result = await connector.testConnection();
        const nextStatus = this.mapTestStatus(result.message, result.success);
        const updated = await this.prisma.integration.update({
            where: { id: row.id },
            data: { status: nextStatus, lastTestedAt: new Date() },
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'INTEGRATION_TESTED',
            entityType: 'INTEGRATION',
            entityId: row.id,
            metadata: (0, token_security_util_1.redactForAudit)({
                provider,
                success: result.success,
                status: nextStatus,
            }),
        });
        const integration = this.toPublic(updated);
        (0, token_security_util_1.assertNoCredentialLeak)(integration);
        return { success: result.success, message: result.message, integration };
    }
    async disconnect(organizationId, provider, userId) {
        if ((0, connectors_1.isAdsIntegrationProvider)(provider)) {
            throw new common_1.BadRequestException('Ngắt Ads tại /ads (AdConnection). Integrations không giữ credential Ads.');
        }
        const row = await this.ensureIntegration(organizationId, provider);
        const updated = await this.prisma.integration.update({
            where: { id: row.id },
            data: {
                status: database_1.IntegrationStatus.DISCONNECTED,
                encryptedCredentials: null,
                metadata: {},
            },
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'INTEGRATION_DISCONNECTED',
            entityType: 'INTEGRATION',
            entityId: row.id,
            metadata: (0, token_security_util_1.redactForAudit)({ provider }),
        });
        return { message: 'Đã ngắt kết nối', integration: this.toPublic(updated) };
    }
    /**
     * Ads: trả metric chuẩn hóa từ ad-performance (không mock).
     * Kênh khác: mock connector (legacy messaging preview).
     */
    async fetchCampaigns(organizationId, provider) {
        if ((0, connectors_1.isAdsIntegrationProvider)(provider)) {
            // Ads: đọc insight đã chuẩn hóa từ AdConnection sync (Meta/Google) — không mock
            const to = new Date();
            const from = new Date();
            from.setDate(from.getDate() - 7);
            const dateFrom = from.toISOString().slice(0, 10);
            const dateTo = to.toISOString().slice(0, 10);
            const platformFilter = provider === database_1.IntegrationProvider.GOOGLE_ADS ? 'GOOGLE' : 'META';
            const insights = await this.normalizedAds.listInsights(organizationId, dateFrom, dateTo, {
                page: 1,
                pageSize: 100,
                platform: platformFilter,
            });
            return {
                items: insights.items.map((r) => ({
                    id: r.externalCampaignId,
                    name: r.campaignName,
                    spend: Number(r.spend),
                    platform: r.platform,
                })),
                message: 'Nguồn: AdsNormalizedService / AdConnection (không phải Integration credential)',
                source: 'AdsNormalizedService',
            };
        }
        const row = await this.ensureIntegration(organizationId, provider);
        if (row.status !== database_1.IntegrationStatus.ACTIVE) {
            return { items: [], message: 'Chưa kết nối' };
        }
        const connector = (0, connectors_1.createConnector)(provider);
        const items = await connector.fetchCampaigns();
        return { items, message: '[MOCK] Placeholder campaigns (non-Ads channel)' };
    }
    mapTestStatus(message, success) {
        if (success)
            return database_1.IntegrationStatus.ACTIVE;
        const lower = message.toLowerCase();
        if (lower.includes('expired') || lower.includes('hết hạn')) {
            return database_1.IntegrationStatus.EXPIRED;
        }
        if (lower.includes('reauth') ||
            lower.includes('unauthorized') ||
            lower.includes('xác thực lại')) {
            return database_1.IntegrationStatus.REAUTH_REQUIRED;
        }
        return database_1.IntegrationStatus.ERROR;
    }
    async ensureIntegration(organizationId, provider) {
        const row = await this.prisma.integration.findFirst({
            where: { organizationId, provider },
        });
        if (!row) {
            throw new common_1.NotFoundException('Integration chưa được cấu hình');
        }
        return row;
    }
    getEncryptionKey() {
        const key = this.config.get('ENCRYPTION_KEY');
        if (!key) {
            throw new common_1.BadRequestException('ENCRYPTION_KEY chưa được cấu hình trên server');
        }
        return key;
    }
    toPublic(row) {
        return {
            provider: row.provider,
            label: PROVIDER_LABELS[row.provider],
            status: row.status,
            hasCredentials: !!row.encryptedCredentials,
            maskedHint: row.metadata && typeof row.metadata === 'object'
                ? (row.metadata.accountHint ?? null)
                : null,
            metadata: (0, token_security_util_1.sanitizePublicMetadata)(row.metadata),
            lastTestedAt: row.lastTestedAt,
            updatedAt: row.updatedAt,
        };
    }
};
exports.IntegrationsService = IntegrationsService;
exports.IntegrationsService = IntegrationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        audit_service_1.AuditService,
        ad_connection_facade_1.AdConnectionFacade,
        ads_normalized_service_1.AdsNormalizedService])
], IntegrationsService);
