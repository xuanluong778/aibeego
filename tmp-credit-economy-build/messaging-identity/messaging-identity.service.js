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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagingIdentityService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const database_2 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const tenant_ownership_service_1 = require("../common/services/tenant-ownership.service");
const audit_service_1 = require("../audit/audit.service");
const token_security_util_1 = require("../common/utils/token-security.util");
const messaging_eligibility_service_1 = require("../messaging/messaging-eligibility.service");
const pagination_util_1 = require("../common/utils/pagination.util");
let MessagingIdentityService = class MessagingIdentityService {
    prisma;
    tenant;
    audit;
    eligibility;
    constructor(prisma, tenant, audit, eligibility) {
        this.prisma = prisma;
        this.tenant = tenant;
        this.audit = audit;
        this.eligibility = eligibility;
    }
    async list(organizationId, query) {
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        let integrationScopeKey = query.integrationScopeKey;
        if (query.connectionId) {
            const conn = await this.prisma.messagingChannelConnection.findFirst({
                where: { id: query.connectionId, organizationId },
            });
            if (conn) {
                integrationScopeKey = (0, database_2.buildIntegrationScopeKey)({
                    channel: conn.channel,
                    channelAccountRef: conn.accountRef,
                });
            }
        }
        const where = {
            organizationId,
            ...(query.channel && { channel: query.channel }),
            ...(query.customerId && { customerId: query.customerId }),
            ...(query.leadId && { leadId: query.leadId }),
            ...(!query.includeMerged && { mergedIntoId: null }),
            ...(integrationScopeKey && { integrationScopeKey }),
            ...(query.consentStatus && { consentStatus: query.consentStatus }),
            ...(query.followStatus && { followStatus: query.followStatus }),
        };
        const andClauses = [];
        if (query.search) {
            andClauses.push({
                OR: [
                    { displayName: { contains: query.search, mode: 'insensitive' } },
                    { phoneNormalized: { contains: query.search.replace(/\D/g, '') } },
                    { externalUserId: { contains: query.search } },
                ],
            });
        }
        if (query.inactiveDays) {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - query.inactiveDays);
            andClauses.push({ OR: [{ lastInboundAt: { lt: cutoff } }, { lastInboundAt: null }] });
        }
        if (query.tag) {
            andClauses.push({
                OR: [
                    { customer: { tags: { has: query.tag } } },
                    { lead: { tags: { has: query.tag } } },
                ],
            });
        }
        if (query.hasAppointment) {
            andClauses.push({
                OR: [
                    { customer: { appointments: { some: {} } } },
                    { lead: { appointments: { some: {} } } },
                ],
            });
        }
        if (query.hasOrder) {
            andClauses.push({
                OR: [{ customer: { orders: { some: {} } } }, { lead: { orders: { some: {} } } }],
            });
        }
        if (andClauses.length)
            where.AND = andClauses;
        if (query.lastInboundFrom || query.lastInboundTo) {
            where.lastInboundAt = {
                ...(query.lastInboundFrom && { gte: new Date(query.lastInboundFrom) }),
                ...(query.lastInboundTo && { lte: new Date(query.lastInboundTo) }),
            };
        }
        if (query.linkedType === 'customer')
            where.customerId = { not: null };
        if (query.linkedType === 'lead')
            where.leadId = { not: null };
        if (query.linkedType === 'unlinked') {
            where.customerId = null;
            where.leadId = null;
        }
        if (query.stageId) {
            where.lead = { stageId: query.stageId };
        }
        if (query.pipelineStatus) {
            where.lead = { pipelineStatus: query.pipelineStatus };
        }
        const [rows, total] = await Promise.all([
            this.prisma.messagingContactIdentity.findMany({
                where,
                skip,
                take,
                orderBy: { lastInboundAt: 'desc' },
                include: {
                    customer: {
                        select: {
                            id: true,
                            name: true,
                            phone: true,
                            tags: true,
                            branch: { select: { id: true, name: true } },
                            assignedEmployee: { select: { id: true, name: true } },
                        },
                    },
                    lead: {
                        select: {
                            id: true,
                            name: true,
                            phone: true,
                            tags: true,
                            pipelineStatus: true,
                            branch: { select: { id: true, name: true } },
                            assignedTo: { select: { id: true, name: true } },
                            stage: { select: { id: true, name: true } },
                        },
                    },
                    integration: { select: { id: true, provider: true, status: true } },
                },
            }),
            this.prisma.messagingContactIdentity.count({ where }),
        ]);
        const items = await Promise.all(rows.map(async (row) => {
            const accountRef = row.integrationScopeKey.includes(':')
                ? row.integrationScopeKey.split(':').slice(1).join(':')
                : row.integrationScopeKey;
            const base = {
                ...row,
                externalUserId: (0, token_security_util_1.maskExternalId)(row.externalUserId),
                externalUserIdRaw: undefined,
                accountRef,
                eligibility: null,
            };
            if (query.connectionId && query.campaignType && query.channel) {
                base.eligibility = await this.eligibility.check({
                    organizationId,
                    channel: query.channel,
                    campaignType: query.campaignType,
                    identityId: row.id,
                    connectionId: query.connectionId,
                    templateId: query.templateId,
                    leadId: row.leadId ?? undefined,
                    customerId: row.customerId ?? undefined,
                });
            }
            return base;
        }));
        return (0, pagination_util_1.buildPaginatedResult)(items, total, page, pageSize);
    }
    async findOne(organizationId, id) {
        const row = await this.prisma.messagingContactIdentity.findFirst({
            where: { id, organizationId },
            include: {
                customer: true,
                lead: true,
                integration: true,
                mergedFrom: { where: { mergedIntoId: id } },
            },
        });
        if (!row)
            throw new common_1.NotFoundException('Identity không tồn tại');
        return row;
    }
    /** Upsert từ webhook Messenger / Zalo — không tự gộp theo tên */
    async upsert(organizationId, dto, userId) {
        if (dto.integrationId) {
            await this.tenant.assertIntegration(organizationId, dto.integrationId);
        }
        if (dto.chatbotConversationId) {
            const conv = await this.prisma.chatbotConversation.findFirst({
                where: { id: dto.chatbotConversationId, organizationId },
            });
            if (!conv)
                throw new common_1.NotFoundException('Hội thoại chatbot không tồn tại');
        }
        const integrationScopeKey = (0, database_2.buildIntegrationScopeKey)({
            integrationId: dto.integrationId,
            channel: dto.channel,
            channelAccountRef: dto.channelAccountRef,
        });
        const phoneNormalized = (0, database_2.normalizeMessagingPhone)(dto.phone);
        const now = new Date();
        const direction = dto.metadata?.direction;
        const existing = await this.prisma.messagingContactIdentity.findFirst({
            where: {
                organizationId,
                integrationScopeKey,
                externalUserId: dto.externalUserId,
            },
        });
        const phoneVerifiedAt = dto.phoneVerified && phoneNormalized
            ? existing?.phoneVerifiedAt ?? now
            : existing?.phoneVerifiedAt;
        if (existing) {
            const identity = await this.prisma.messagingContactIdentity.update({
                where: { id: existing.id },
                data: {
                    externalConversationId: dto.externalConversationId ?? existing.externalConversationId,
                    displayName: dto.displayName ?? existing.displayName,
                    avatarUrl: dto.avatarUrl ?? existing.avatarUrl,
                    phoneRaw: dto.phone ?? existing.phoneRaw,
                    phoneNormalized: phoneNormalized ?? existing.phoneNormalized,
                    phoneVerifiedAt,
                    followStatus: dto.followStatus ?? existing.followStatus,
                    consentStatus: dto.consentStatus ?? existing.consentStatus,
                    isBlocked: dto.isBlocked ?? existing.isBlocked,
                    optedOut: dto.optedOut ?? existing.optedOut,
                    chatbotConversationId: dto.chatbotConversationId ?? existing.chatbotConversationId,
                    metadata: dto.metadata
                        ? { ...(existing.metadata ?? {}), ...dto.metadata }
                        : undefined,
                    lastInboundAt: direction === 'inbound' ? now : existing.lastInboundAt,
                    lastOutboundAt: direction === 'outbound' ? now : existing.lastOutboundAt,
                },
            });
            await this.audit.log({
                organizationId,
                userId,
                action: 'MESSAGING_IDENTITY_UPDATED',
                entityType: 'MESSAGING_IDENTITY',
                entityId: identity.id,
                metadata: {
                    channel: dto.channel,
                    externalUserId: dto.externalUserId,
                    integrationScopeKey,
                },
            });
            return identity;
        }
        const identity = await this.prisma.messagingContactIdentity.create({
            data: {
                organizationId,
                channel: dto.channel,
                integrationId: dto.integrationId,
                integrationScopeKey,
                externalUserId: dto.externalUserId,
                externalConversationId: dto.externalConversationId,
                displayName: dto.displayName,
                avatarUrl: dto.avatarUrl,
                phoneRaw: dto.phone,
                phoneNormalized,
                phoneVerifiedAt,
                followStatus: dto.followStatus,
                consentStatus: dto.consentStatus,
                isBlocked: dto.isBlocked ?? false,
                optedOut: dto.optedOut ?? false,
                chatbotConversationId: dto.chatbotConversationId,
                metadata: (dto.metadata ?? {}),
                lastInboundAt: direction === 'inbound' ? now : undefined,
                lastOutboundAt: direction === 'outbound' ? now : undefined,
            },
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'MESSAGING_IDENTITY_CREATED',
            entityType: 'MESSAGING_IDENTITY',
            entityId: identity.id,
            metadata: {
                channel: dto.channel,
                externalUserId: dto.externalUserId,
                integrationScopeKey,
            },
        });
        return identity;
    }
    /** Liên kết thủ công theo Customer/Lead ID — không theo tên */
    async linkManual(organizationId, identityId, dto, userId) {
        if (!dto.customerId && !dto.leadId) {
            throw new common_1.BadRequestException('Cần customerId hoặc leadId');
        }
        const identity = await this.findOne(organizationId, identityId);
        if (identity.mergedIntoId) {
            throw new common_1.BadRequestException('Identity đã được gộp vào identity khác');
        }
        if (dto.customerId) {
            await this.tenant.assertCustomer(organizationId, dto.customerId);
        }
        if (dto.leadId) {
            await this.tenant.assertLead(organizationId, dto.leadId);
        }
        const updated = await this.prisma.messagingContactIdentity.update({
            where: { id: identityId },
            data: {
                customerId: dto.customerId ?? identity.customerId,
                leadId: dto.leadId ?? identity.leadId,
                linkSource: dto.customerId && dto.leadId
                    ? database_1.MessagingIdentityLinkSource.MANUAL
                    : dto.customerId
                        ? database_1.MessagingIdentityLinkSource.CUSTOMER_ID
                        : database_1.MessagingIdentityLinkSource.LEAD_ID,
            },
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'MESSAGING_IDENTITY_LINKED',
            entityType: 'MESSAGING_IDENTITY',
            entityId: identityId,
            metadata: { customerId: dto.customerId, leadId: dto.leadId },
        });
        return updated;
    }
    /** Liên kết theo SĐT đã xác minh — không auto theo tên */
    async linkByVerifiedPhone(organizationId, identityId, userId) {
        const identity = await this.findOne(organizationId, identityId);
        if (!identity.phoneVerifiedAt || !identity.phoneNormalized) {
            throw new common_1.BadRequestException('SĐT chưa được xác minh trên identity này');
        }
        if (identity.mergedIntoId) {
            throw new common_1.BadRequestException('Identity đã được gộp');
        }
        const phone = identity.phoneNormalized;
        const customer = await this.prisma.customer.findFirst({
            where: { organizationId, phone, isActive: true },
        });
        const lead = customer
            ? null
            : await this.prisma.lead.findFirst({
                where: { organizationId, phone },
                orderBy: { createdAt: 'desc' },
            });
        if (!customer && !lead) {
            throw new common_1.NotFoundException('Không tìm thấy Customer/Lead khớp SĐT đã xác minh');
        }
        const updated = await this.prisma.messagingContactIdentity.update({
            where: { id: identityId },
            data: {
                customerId: customer?.id,
                leadId: lead?.id,
                linkSource: database_1.MessagingIdentityLinkSource.PHONE_VERIFIED,
            },
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'MESSAGING_IDENTITY_PHONE_LINKED',
            entityType: 'MESSAGING_IDENTITY',
            entityId: identityId,
            metadata: { phone, customerId: customer?.id, leadId: lead?.id },
        });
        return updated;
    }
    /** Gợi ý liên kết — chỉ SĐT đã xác minh hoặc ID nguồn rõ ràng */
    async suggestLinks(organizationId, identityId) {
        const identity = await this.findOne(organizationId, identityId);
        const suggestions = [];
        if (identity.phoneVerifiedAt && identity.phoneNormalized) {
            const [customers, leads] = await Promise.all([
                this.prisma.customer.findMany({
                    where: {
                        organizationId,
                        isActive: true,
                        phone: identity.phoneNormalized,
                    },
                    take: 5,
                }),
                this.prisma.lead.findMany({
                    where: { organizationId, phone: identity.phoneNormalized },
                    take: 5,
                    orderBy: { createdAt: 'desc' },
                }),
            ]);
            for (const c of customers) {
                suggestions.push({
                    type: 'customer',
                    id: c.id,
                    name: c.name,
                    phone: c.phone,
                    reason: 'phone_verified_match',
                });
            }
            for (const l of leads) {
                suggestions.push({
                    type: 'lead',
                    id: l.id,
                    name: l.name,
                    phone: l.phone,
                    reason: 'phone_verified_match',
                });
            }
        }
        const metaLeadId = identity.metadata?.sourceLeadId;
        if (metaLeadId) {
            const lead = await this.prisma.lead.findFirst({
                where: { id: metaLeadId, organizationId },
            });
            if (lead) {
                suggestions.push({
                    type: 'lead',
                    id: lead.id,
                    name: lead.name,
                    phone: lead.phone,
                    reason: 'source_lead_id',
                });
            }
        }
        return { identityId, suggestions };
    }
    /** Gộp thủ công Messenger + Zalo identity vào một primary */
    async mergeIdentities(organizationId, dto, userId) {
        if (dto.secondaryIdentityIds.includes(dto.primaryIdentityId)) {
            throw new common_1.BadRequestException('Primary không được nằm trong danh sách secondary');
        }
        const [primary, ...secondaries] = await Promise.all([
            this.findOne(organizationId, dto.primaryIdentityId),
            ...dto.secondaryIdentityIds.map((id) => this.findOne(organizationId, id)),
        ]);
        if (primary.mergedIntoId) {
            throw new common_1.BadRequestException('Primary đã bị gộp vào identity khác');
        }
        for (const s of secondaries) {
            if (s.mergedIntoId) {
                throw new common_1.BadRequestException(`Identity ${s.id} đã được gộp trước đó`);
            }
            if (s.organizationId !== organizationId) {
                throw new common_1.NotFoundException('Identity không tồn tại');
            }
        }
        const snapshot = secondaries.map((s) => ({ ...s }));
        await this.prisma.$transaction(async (tx) => {
            for (const s of secondaries) {
                await tx.messagingContactIdentity.update({
                    where: { id: s.id },
                    data: { mergedIntoId: primary.id },
                });
            }
            const patch = {};
            if (!primary.customerId) {
                const cid = secondaries.find((s) => s.customerId)?.customerId;
                if (cid)
                    patch.customer = { connect: { id: cid } };
            }
            if (!primary.leadId) {
                const lid = secondaries.find((s) => s.leadId)?.leadId;
                if (lid)
                    patch.lead = { connect: { id: lid } };
            }
            if (!primary.phoneVerifiedAt) {
                const verified = secondaries.find((s) => s.phoneVerifiedAt);
                if (verified?.phoneNormalized) {
                    patch.phoneNormalized = verified.phoneNormalized;
                    patch.phoneRaw = verified.phoneRaw;
                    patch.phoneVerifiedAt = verified.phoneVerifiedAt;
                }
            }
            if (Object.keys(patch).length) {
                await tx.messagingContactIdentity.update({
                    where: { id: primary.id },
                    data: patch,
                });
            }
            await tx.messagingIdentityMergeLog.create({
                data: {
                    organizationId,
                    primaryIdentityId: primary.id,
                    mergedIdentityIds: dto.secondaryIdentityIds,
                    mergedByUserId: userId,
                    snapshot: snapshot,
                },
            });
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'MESSAGING_IDENTITY_MERGED',
            entityType: 'MESSAGING_IDENTITY',
            entityId: primary.id,
            metadata: { merged: dto.secondaryIdentityIds },
        });
        return this.findOne(organizationId, primary.id);
    }
    /** Hoàn tác gộp identity */
    async undoMerge(organizationId, mergeLogId, userId) {
        const log = await this.prisma.messagingIdentityMergeLog.findFirst({
            where: { id: mergeLogId, organizationId },
        });
        if (!log)
            throw new common_1.NotFoundException('Log gộp không tồn tại');
        if (log.undoneAt) {
            throw new common_1.BadRequestException('Gộp này đã được hoàn tác');
        }
        const snapshots = log.snapshot;
        await this.prisma.$transaction(async (tx) => {
            for (const snap of snapshots) {
                const id = snap.id;
                await tx.messagingContactIdentity.update({
                    where: { id },
                    data: {
                        mergedIntoId: null,
                        customerId: snap.customerId ?? null,
                        leadId: snap.leadId ?? null,
                        linkSource: snap.linkSource,
                        phoneNormalized: snap.phoneNormalized ?? null,
                        phoneRaw: snap.phoneRaw ?? null,
                        phoneVerifiedAt: snap.phoneVerifiedAt
                            ? new Date(snap.phoneVerifiedAt)
                            : null,
                    },
                });
            }
            await tx.messagingIdentityMergeLog.update({
                where: { id: mergeLogId },
                data: { undoneAt: new Date(), undoneByUserId: userId },
            });
        });
        await this.audit.log({
            organizationId,
            userId,
            action: 'MESSAGING_IDENTITY_MERGE_UNDONE',
            entityType: 'MESSAGING_IDENTITY_MERGE_LOG',
            entityId: mergeLogId,
            metadata: { primaryIdentityId: log.primaryIdentityId },
        });
        return { ok: true, mergeLogId };
    }
    async listMergeLogs(organizationId, primaryIdentityId) {
        return this.prisma.messagingIdentityMergeLog.findMany({
            where: {
                organizationId,
                ...(primaryIdentityId && { primaryIdentityId }),
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    }
};
exports.MessagingIdentityService = MessagingIdentityService;
exports.MessagingIdentityService = MessagingIdentityService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)((0, common_1.forwardRef)(() => messaging_eligibility_service_1.MessagingEligibilityService))),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        tenant_ownership_service_1.TenantOwnershipService,
        audit_service_1.AuditService,
        messaging_eligibility_service_1.MessagingEligibilityService])
], MessagingIdentityService);
