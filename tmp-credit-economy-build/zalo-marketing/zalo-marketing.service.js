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
exports.ZaloMarketingService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const shared_1 = require("@marketingspa/shared");
const database_2 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const channel_connections_service_1 = require("../messaging/channel-connections.service");
const messaging_campaign_service_1 = require("../messaging-campaign/messaging-campaign.service");
const messaging_campaign_segment_service_1 = require("../messaging-campaign/messaging-campaign-segment.service");
const messaging_eligibility_service_1 = require("../messaging/messaging-eligibility.service");
const email_spreadsheet_util_1 = require("../email-marketing/email-spreadsheet.util");
const zalo_oauth_service_1 = require("./zalo-oauth.service");
const messaging_campaign_types_1 = require("../messaging-campaign/messaging-campaign.types");
const ZALO_CHANNEL = database_1.MessageChannel.ZALO;
let ZaloMarketingService = class ZaloMarketingService {
    prisma;
    channelConnections;
    campaigns;
    segment;
    eligibility;
    oauth;
    constructor(prisma, channelConnections, campaigns, segment, eligibility, oauth) {
        this.prisma = prisma;
        this.channelConnections = channelConnections;
        this.campaigns = campaigns;
        this.segment = segment;
        this.eligibility = eligibility;
        this.oauth = oauth;
    }
    async overview(organizationId) {
        const [oaCount, zbsCount, campaigns, templates, recent] = await Promise.all([
            this.prisma.messagingChannelConnection.count({
                where: {
                    organizationId,
                    channel: ZALO_CHANNEL,
                    providerKind: database_1.MessagingProviderKind.ZALO_OA,
                    status: 'ACTIVE',
                    isPaused: false,
                },
            }),
            this.prisma.messagingChannelConnection.count({
                where: {
                    organizationId,
                    channel: ZALO_CHANNEL,
                    providerKind: database_1.MessagingProviderKind.ZBS_TEMPLATE,
                    status: 'ACTIVE',
                    isPaused: false,
                },
            }),
            this.prisma.messagingCampaign.groupBy({
                by: ['status'],
                where: { organizationId, channel: ZALO_CHANNEL },
                _count: { _all: true },
            }),
            this.prisma.messageTemplate.count({
                where: {
                    organizationId,
                    channel: ZALO_CHANNEL,
                    providerMode: 'ZBS_TEMPLATE',
                    isActive: true,
                },
            }),
            this.prisma.messagingCampaign.findMany({
                where: { organizationId, channel: ZALO_CHANNEL },
                orderBy: { updatedAt: 'desc' },
                take: 5,
                select: {
                    id: true,
                    name: true,
                    status: true,
                    campaignType: true,
                    sentCount: true,
                    deliveredCount: true,
                    failedCount: true,
                    totalRecipients: true,
                    updatedAt: true,
                },
            }),
        ]);
        const statusMap = Object.fromEntries(campaigns.map((c) => [c.status, c._count._all]));
        const running = statusMap[database_1.MessagingCampaignStatus.RUNNING] ?? 0;
        const completed = statusMap[database_1.MessagingCampaignStatus.COMPLETED] ?? 0;
        return {
            oaConnections: oaCount,
            zbsConnections: zbsCount,
            zbsTemplates: templates,
            campaignsRunning: running,
            campaignsCompleted: completed,
            oauthConfigured: this.oauth.isConfigured(),
            oauthRedirectUri: this.oauth.getRedirectUri(),
            oauthAppIdMasked: this.oauth.getAppId()
                ? `…${this.oauth.getAppId().slice(-6)}`
                : null,
            oauthPkce: this.oauth.isPkceEnabled(),
            oauthFlow: 'oa/permission',
            recentCampaigns: recent.map((c) => ({
                ...c,
                updatedAt: c.updatedAt.toISOString(),
            })),
        };
    }
    async listOas(organizationId) {
        const all = await this.channelConnections.list(organizationId);
        return all.filter((c) => c.channel === ZALO_CHANNEL);
    }
    async getOa(organizationId, id) {
        await this.ensureZaloOaRow(organizationId, id);
        return this.channelConnections.getPublic(organizationId, id);
    }
    async disconnectOa(organizationId, id, userId) {
        await this.ensureZaloOaRow(organizationId, id);
        return this.channelConnections.disconnectZaloOa(organizationId, id, userId);
    }
    async refreshOa(organizationId, id, userId) {
        await this.ensureZaloOaRow(organizationId, id);
        const refreshed = await this.channelConnections.refreshZaloOaToken(organizationId, id, userId);
        return { connection: refreshed };
    }
    async startOAuth(userId, organizationId, returnPath) {
        return this.oauth.createState({ userId, organizationId, returnPath });
    }
    async handleOAuthCallback(code, state, cookieValue, callbackOaId) {
        const payload = this.oauth.resolveCallbackSession(state, cookieValue);
        const tokens = await this.oauth.exchangeCode(code, payload.codeVerifier);
        const oa = await this.oauth.fetchOaInfo(tokens.accessToken);
        const oaId = oa.oa_id?.trim() || callbackOaId?.trim();
        if (!oaId) {
            throw new common_1.BadRequestException('Zalo không trả về OA ID');
        }
        if (callbackOaId?.trim() && oa.oa_id?.trim() && callbackOaId.trim() !== oa.oa_id.trim()) {
            throw new common_1.BadRequestException('OA ID callback không khớp thông tin OA từ Zalo');
        }
        await this.channelConnections.upsertZaloOaOAuth(payload.organizationId, {
            oaId,
            oaName: oa.name,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            tokenExpiresAt: tokens.expiresAt,
            userId: payload.userId,
        });
        return {
            redirectUrl: this.oauth.buildSuccessRedirect(payload.returnPath),
            oaId,
            oaName: oa.name,
            organizationId: payload.organizationId,
        };
    }
    async connectZbs(organizationId, dto, userId) {
        if (dto.oaConnectionId) {
            await this.ensureZaloConnection(organizationId, dto.oaConnectionId);
        }
        const conn = await this.channelConnections.connectZbs(organizationId, {
            appId: dto.appId,
            secretKey: dto.secretKey,
            accessToken: dto.accessToken,
            accountRef: dto.accountRef,
            displayName: dto.displayName,
        }, userId);
        if (dto.oaConnectionId) {
            await this.prisma.messagingChannelConnection.update({
                where: { id: conn.id },
                data: {
                    metadata: {
                        oaConnectionId: dto.oaConnectionId,
                    },
                },
            });
        }
        return conn;
    }
    async syncZbsTemplates(organizationId, connectionId, userId) {
        const conn = await this.ensureZbsConnection(organizationId, connectionId);
        const credentials = this.channelConnections.decryptCredentials(conn.encryptedCredentials);
        const accessToken = credentials.accessToken?.trim();
        if (!accessToken)
            throw new common_1.BadRequestException('Thiếu access token ZBS');
        const remote = await (0, shared_1.listZaloZbsTemplates)({ accessToken, limit: 200 });
        let synced = 0;
        for (const item of remote) {
            const templateId = String(item.template_id || '').trim();
            if (!templateId)
                continue;
            const vars = (0, shared_1.extractZbsTemplateVariables)(item);
            const approvalStatus = (0, shared_1.mapZaloTemplateApprovalStatus)(item.status || '');
            const existing = await this.prisma.messageTemplate.findFirst({
                where: { organizationId, providerTemplateId: templateId, channel: ZALO_CHANNEL },
            });
            const data = {
                name: item.template_name || templateId,
                body: item.preview_text || item.template_name || templateId,
                variables: vars.map((v) => v.key),
                variableFallbacks: Object.fromEntries(vars.map((v) => [v.key, ''])),
                providerTemplateId: templateId,
                providerMode: 'ZBS_TEMPLATE',
                campaignKind: database_1.MessagingCampaignKind.TEMPLATE,
                approvalStatus,
                isActive: approvalStatus === database_1.MessageTemplateApprovalStatus.APPROVED,
            };
            if (existing) {
                await this.prisma.messageTemplate.update({ where: { id: existing.id }, data });
            }
            else {
                await this.prisma.messageTemplate.create({
                    data: { organizationId, channel: ZALO_CHANNEL, ...data },
                });
            }
            synced += 1;
        }
        await this.prisma.messagingChannelConnection.update({
            where: { id: conn.id },
            data: { lastSyncedAt: new Date() },
        });
        return { synced, total: remote.length, connectionId };
    }
    async listZbsTemplates(organizationId, connectionId) {
        if (connectionId)
            await this.ensureZbsConnection(organizationId, connectionId);
        const rows = await this.prisma.messageTemplate.findMany({
            where: {
                organizationId,
                channel: ZALO_CHANNEL,
                providerMode: 'ZBS_TEMPLATE',
            },
            orderBy: [{ approvalStatus: 'asc' }, { name: 'asc' }],
        });
        return rows;
    }
    async listCampaigns(organizationId, query) {
        return this.campaigns.list(organizationId, {
            ...query,
            channel: ZALO_CHANNEL,
        });
    }
    async getCampaign(organizationId, id) {
        const campaign = await this.campaigns.findOne(organizationId, id);
        this.assertZaloCampaign(campaign.channel);
        return campaign;
    }
    async createCampaign(organizationId, dto, userId) {
        const oa = await this.ensureZaloConnection(organizationId, dto.channelConnectionId);
        const allowed = [
            database_1.MessagingCampaignKind.BROADCAST,
            database_1.MessagingCampaignKind.TRANSACTIONAL,
            database_1.MessagingCampaignKind.TEMPLATE,
        ];
        if (!allowed.includes(dto.campaignType)) {
            throw new common_1.BadRequestException('Zalo Marketing chỉ hỗ trợ Broadcast, Tin tư vấn (TRANSACTIONAL) hoặc ZBS Template');
        }
        if (dto.campaignType === database_1.MessagingCampaignKind.TEMPLATE) {
            if (!dto.messageTemplateId) {
                throw new common_1.BadRequestException('ZBS cần chọn template đã duyệt');
            }
            if (!dto.zbsConnectionId) {
                throw new common_1.BadRequestException('ZBS cần chọn kết nối ZBS');
            }
            await this.ensureZbsConnection(organizationId, dto.zbsConnectionId);
            const tmpl = await this.prisma.messageTemplate.findFirst({
                where: {
                    id: dto.messageTemplateId,
                    organizationId,
                    channel: ZALO_CHANNEL,
                    providerMode: 'ZBS_TEMPLATE',
                },
            });
            if (!tmpl)
                throw new common_1.BadRequestException('Template ZBS không tồn tại');
            if (tmpl.approvalStatus !== database_1.MessageTemplateApprovalStatus.APPROVED &&
                !tmpl.isActive) {
                throw new common_1.BadRequestException('Template ZBS chưa được duyệt');
            }
        }
        if (dto.campaignType === database_1.MessagingCampaignKind.BROADCAST) {
            const body = (dto.variables?.body || dto.variables?.message || '').trim();
            if (!body && !dto.variables?.mediaUrl) {
                throw new common_1.BadRequestException('Broadcast cần nội dung hoặc ảnh');
            }
        }
        if (dto.campaignType === database_1.MessagingCampaignKind.TRANSACTIONAL) {
            const body = (dto.variables?.body || dto.variables?.message || '').trim();
            if (!body)
                throw new common_1.BadRequestException('Tin tư vấn cần nội dung');
        }
        // Audience luôn gắn OA (follower / consult window). ZBS chỉ dùng lúc gửi.
        const segmentConfig = this.normalizeSegmentForMode(dto.campaignType, (dto.segmentConfig ?? {}), oa.accountRef);
        const variables = {
            ...(dto.variables ?? {}),
            ...(dto.zbsConnectionId ? { zbsConnectionId: dto.zbsConnectionId } : {}),
        };
        return this.campaigns.create(organizationId, {
            name: dto.name,
            channel: ZALO_CHANNEL,
            campaignType: dto.campaignType,
            channelConnectionId: dto.channelConnectionId,
            messageTemplateId: dto.messageTemplateId,
            segmentConfig: segmentConfig,
            variables,
            timezone: dto.timezone,
        }, userId);
    }
    normalizeSegmentForMode(kind, segment, oaAccountRef) {
        const scopeKey = (0, database_2.buildIntegrationScopeKey)({
            channel: ZALO_CHANNEL,
            channelAccountRef: oaAccountRef,
        });
        const base = {
            ...segment,
            integrationScopeKey: segment.integrationScopeKey || scopeKey,
            excludeSuppressed: segment.excludeSuppressed !== false,
        };
        if (kind === database_1.MessagingCampaignKind.BROADCAST) {
            return {
                ...base,
                followStatuses: ['FOLLOWING'],
                requireOptIn: false,
            };
        }
        if (kind === database_1.MessagingCampaignKind.TRANSACTIONAL) {
            return {
                ...base,
                requireOptIn: true,
                // Eligibility 48h cửa sổ tư vấn được worker/API kiểm tra trước enqueue
            };
        }
        return base;
    }
    async updateCampaign(organizationId, id, dto, userId) {
        const existing = await this.getCampaign(organizationId, id);
        if (dto.channelConnectionId) {
            await this.ensureZaloConnection(organizationId, dto.channelConnectionId);
        }
        if (dto.zbsConnectionId) {
            await this.ensureZbsConnection(organizationId, dto.zbsConnectionId);
        }
        const nextType = dto.campaignType ?? existing.campaignType;
        const oaId = dto.channelConnectionId ?? existing.channelConnectionId;
        let segmentConfig = dto.segmentConfig;
        if (oaId && (dto.segmentConfig || dto.campaignType)) {
            const oa = await this.ensureZaloConnection(organizationId, oaId);
            segmentConfig = this.normalizeSegmentForMode(nextType, (dto.segmentConfig ?? existing.segmentConfig ?? {}), oa.accountRef);
        }
        const variables = {
            ...(existing.variables ?? {}),
            ...(dto.variables ?? {}),
            ...(dto.zbsConnectionId ? { zbsConnectionId: dto.zbsConnectionId } : {}),
        };
        return this.campaigns.update(organizationId, id, {
            name: dto.name,
            campaignType: dto.campaignType,
            channelConnectionId: dto.channelConnectionId ?? undefined,
            messageTemplateId: dto.messageTemplateId ?? undefined,
            segmentConfig: segmentConfig,
            variables,
            timezone: dto.timezone,
        }, userId);
    }
    async previewAudience(organizationId, dto) {
        const connectionId = dto.channelConnectionId;
        if (!connectionId)
            throw new common_1.BadRequestException('Chọn OA trước khi xem khách');
        const oa = await this.ensureZaloConnection(organizationId, connectionId);
        const kind = dto.campaignType ?? database_1.MessagingCampaignKind.BROADCAST;
        const segmentConfig = this.normalizeSegmentForMode(kind, (dto.segmentConfig ?? {}), oa.accountRef);
        const preview = await this.segment.preview(organizationId, ZALO_CHANNEL, segmentConfig, connectionId);
        let eligible = 0;
        let ineligible = 0;
        let estimatedCost = 0;
        const reasonBreakdown = {};
        const sampleLimit = Math.min(preview.identityIds.length, 200);
        const eligibilityType = (0, messaging_campaign_types_1.mapCampaignKindToEligibilityType)(kind);
        for (const identityId of preview.identityIds.slice(0, sampleLimit)) {
            const result = await this.eligibility.check({
                organizationId,
                channel: ZALO_CHANNEL,
                campaignType: eligibilityType,
                identityId,
                connectionId,
            });
            if (result.eligible) {
                eligible += 1;
                estimatedCost += result.estimatedCost ?? 0;
            }
            else {
                ineligible += 1;
                const code = result.reasonCode ?? 'UNKNOWN';
                reasonBreakdown[code] = (reasonBreakdown[code] ?? 0) + 1;
            }
        }
        const conditions = kind === database_1.MessagingCampaignKind.BROADCAST
            ? 'Chỉ người đang Quan tâm OA; kiểm tra quota broadcast; loại opt-out/block'
            : kind === database_1.MessagingCampaignKind.TRANSACTIONAL
                ? 'Chỉ user đã tương tác/opt-in trong cửa sổ tư vấn 48h; quyền OA/tier'
                : 'Template ZBS đã duyệt; gửi theo UID/SĐT đủ điều kiện; trừ chi phí nếu API trả về';
        return {
            ...preview,
            campaignType: kind,
            conditions,
            oa: { id: oa.id, accountRef: oa.accountRef, displayName: oa.displayName },
            eligible,
            ineligible,
            estimatedCost,
            reasonBreakdown,
            scanned: sampleLimit,
            totalAudience: preview.total,
        };
    }
    async previewCampaign(organizationId, id, dto) {
        const campaign = await this.getCampaign(organizationId, id);
        const segmentConfig = (campaign.segmentConfig ?? {});
        const identityIds = dto.sampleIdentityIds?.length
            ? dto.sampleIdentityIds
            : segmentConfig.identityIds?.slice(0, 5) ?? [];
        const samples = await this.prisma.messagingContactIdentity.findMany({
            where: { organizationId, id: { in: identityIds } },
            take: 5,
        });
        const template = campaign.messageTemplateId
            ? await this.prisma.messageTemplate.findFirst({
                where: { id: campaign.messageTemplateId, organizationId },
            })
            : null;
        const campaignVars = (campaign.variables ?? {});
        const body = template?.body || campaignVars.body || '';
        return {
            campaignId: id,
            samples: samples.map((identity) => {
                const ctx = {
                    ...(0, shared_1.pickCampaignRenderVariables)(campaignVars),
                    phone: identity.phoneNormalized ?? '',
                    order_code: campaignVars.order_code ?? '',
                    voucher: campaignVars.voucher ?? '',
                };
                const names = (0, shared_1.resolveMessagingDisplayNames)(identity.displayName);
                ctx.full_name = names.full_name;
                ctx.first_name = names.first_name;
                ctx.customer_name = names.customer_name;
                ctx.name = names.full_name;
                const { rendered, missingKeys } = (0, shared_1.renderTemplateWithFallbacks)(body, ctx, {
                    ...shared_1.MESSAGING_NAME_FALLBACKS,
                    ...(template?.variableFallbacks ?? {}),
                });
                return {
                    identityId: identity.id,
                    displayName: identity.displayName,
                    phone: identity.phoneNormalized,
                    externalUserId: identity.externalUserId,
                    rendered,
                    missingKeys,
                };
            }),
        };
    }
    async importAudience(organizationId, connectionId, file) {
        if (!file?.buffer?.length)
            throw new common_1.BadRequestException('Thiếu file CSV/XLSX');
        const conn = await this.ensureZaloConnection(organizationId, connectionId);
        const scopeKey = (0, database_2.buildIntegrationScopeKey)({
            channel: ZALO_CHANNEL,
            channelAccountRef: conn.accountRef,
        });
        const rows = (0, email_spreadsheet_util_1.parseContactSpreadsheet)(file);
        const identityIds = [];
        for (const row of rows) {
            const phone = (row.phone || '').replace(/\D/g, '');
            const uid = (row.uid || '').trim();
            const name = (row.name || '').trim() || 'Khách Zalo';
            if (!phone && !uid)
                continue;
            const externalUserId = uid || phone;
            const existing = await this.prisma.messagingContactIdentity.findFirst({
                where: {
                    organizationId,
                    channel: ZALO_CHANNEL,
                    integrationScopeKey: scopeKey,
                    externalUserId,
                },
            });
            if (existing) {
                await this.prisma.messagingContactIdentity.update({
                    where: { id: existing.id },
                    data: {
                        displayName: name,
                        phoneNormalized: phone || existing.phoneNormalized,
                    },
                });
                identityIds.push(existing.id);
                continue;
            }
            const created = await this.prisma.messagingContactIdentity.create({
                data: {
                    organizationId,
                    channel: ZALO_CHANNEL,
                    integrationScopeKey: scopeKey,
                    externalUserId,
                    displayName: name,
                    phoneNormalized: phone || null,
                    consentStatus: database_1.MessagingConsentStatus.UNKNOWN,
                },
            });
            identityIds.push(created.id);
        }
        return {
            imported: identityIds.length,
            identityIds,
            segmentConfig: { identityIds, integrationScopeKey: scopeKey },
        };
    }
    async testZbsSend(organizationId, dto) {
        const conn = await this.ensureZbsConnection(organizationId, dto.connectionId);
        const credentials = this.channelConnections.decryptCredentials(conn.encryptedCredentials);
        const phone = dto.phone?.trim();
        const userId = dto.userId?.trim();
        if (!phone && !userId)
            throw new common_1.BadRequestException('Cần SĐT hoặc UID');
        const live = process.env.MESSAGING_LIVE_SEND === 'true' ||
            (process.env.MESSAGING_LIVE_OA_IDS ?? '')
                .split(',')
                .map((s) => s.trim())
                .includes(conn.accountRef);
        if (!live) {
            return {
                dryRun: true,
                message: 'Dry-run — bật MESSAGING_LIVE_SEND hoặc thêm OA vào MESSAGING_LIVE_OA_IDS',
            };
        }
        const result = await (0, shared_1.sendZbsTemplateHttp)({
            accessToken: credentials.accessToken ?? '',
            phone,
            userId,
            templateId: dto.templateId,
            templateData: dto.templateData,
        });
        return result;
    }
    async reports(organizationId) {
        const campaigns = await this.prisma.messagingCampaign.findMany({
            where: { organizationId, channel: ZALO_CHANNEL },
            orderBy: { updatedAt: 'desc' },
            take: 100,
            select: {
                id: true,
                name: true,
                status: true,
                campaignType: true,
                totalRecipients: true,
                eligibleCount: true,
                excludedCount: true,
                queuedCount: true,
                sentCount: true,
                deliveredCount: true,
                failedCount: true,
                estimatedCost: true,
                actualCost: true,
                startedAt: true,
                completedAt: true,
                updatedAt: true,
                channelConnection: { select: { displayName: true, accountRef: true } },
            },
        });
        const totals = campaigns.reduce((acc, c) => {
            acc.recipients += c.totalRecipients;
            acc.sent += c.sentCount;
            acc.delivered += c.deliveredCount;
            acc.failed += c.failedCount;
            acc.cost += Number(c.actualCost ?? c.estimatedCost ?? 0);
            return acc;
        }, { recipients: 0, sent: 0, delivered: 0, failed: 0, cost: 0 });
        return { totals, campaigns };
    }
    schedule(organizationId, id, dto, userId) {
        return this.campaigns.schedule(organizationId, id, dto, userId);
    }
    start(organizationId, id, userId) {
        return this.campaigns.start(organizationId, id, userId);
    }
    pause(organizationId, id, userId) {
        return this.campaigns.pause(organizationId, id, userId);
    }
    previewSegment(organizationId, id) {
        return this.campaigns.previewSegment(organizationId, id);
    }
    previewEligibility(organizationId, id, body) {
        return this.campaigns.previewEligibility(organizationId, id, body);
    }
    dashboard(organizationId, id) {
        return this.campaigns.getDashboard(organizationId, id);
    }
    remove(organizationId, id, userId) {
        return this.campaigns.remove(organizationId, id, userId);
    }
    assertZaloCampaign(channel) {
        if (channel !== ZALO_CHANNEL) {
            throw new common_1.NotFoundException('Chiến dịch Zalo không tồn tại');
        }
    }
    async ensureZaloConnection(organizationId, id) {
        return this.ensureZaloOaRow(organizationId, id);
    }
    async ensureZaloOaRow(organizationId, id) {
        const row = await this.prisma.messagingChannelConnection.findFirst({
            where: {
                id,
                organizationId,
                channel: ZALO_CHANNEL,
                providerKind: database_1.MessagingProviderKind.ZALO_OA,
            },
        });
        if (!row)
            throw new common_1.NotFoundException('OA Zalo không tồn tại hoặc thuộc tenant khác');
        return row;
    }
    async ensureZbsConnection(organizationId, id) {
        const row = await this.prisma.messagingChannelConnection.findFirst({
            where: {
                id,
                organizationId,
                channel: ZALO_CHANNEL,
                providerKind: database_1.MessagingProviderKind.ZBS_TEMPLATE,
            },
        });
        if (!row)
            throw new common_1.NotFoundException('Kết nối ZBS không tồn tại hoặc thuộc tenant khác');
        return row;
    }
};
exports.ZaloMarketingService = ZaloMarketingService;
exports.ZaloMarketingService = ZaloMarketingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        channel_connections_service_1.ChannelConnectionsService,
        messaging_campaign_service_1.MessagingCampaignService,
        messaging_campaign_segment_service_1.MessagingCampaignSegmentService,
        messaging_eligibility_service_1.MessagingEligibilityService,
        zalo_oauth_service_1.ZaloOAuthService])
], ZaloMarketingService);
