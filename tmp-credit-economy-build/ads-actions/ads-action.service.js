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
var AdsActionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdsActionService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const bullmq_1 = require("bullmq");
const database_1 = require("@marketingspa/database");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const queue_constants_1 = require("../queue/queue.constants");
const token_security_util_1 = require("../common/utils/token-security.util");
const ads_efficiency_util_1 = require("../ai-ads-manager/ads-efficiency.util");
let AdsActionService = AdsActionService_1 = class AdsActionService {
    prisma;
    audit;
    config;
    actionQueue;
    logger = new common_1.Logger(AdsActionService_1.name);
    constructor(prisma, audit, config, actionQueue) {
        this.prisma = prisma;
        this.audit = audit;
        this.config = config;
        this.actionQueue = actionQueue;
    }
    /** Kill-switch: ADS_ACTIONS_LIVE=false tắt toàn bộ write action. */
    writeActionsEnabled() {
        return (0, shared_1.isAdsActionsLive)({
            ADS_ACTIONS_LIVE: this.config.get('ADS_ACTIONS_LIVE'),
        });
    }
    providerWriteEnabled() {
        return (this.writeActionsEnabled() &&
            String(this.config.get('ADS_ACTIONS_PROVIDER_WRITE') ?? 'false').toLowerCase() === 'true');
    }
    async list(user, status, limit = 40) {
        const items = await this.prisma.adsActionRequest.findMany({
            where: {
                organizationId: user.organizationId,
                ...(status ? { status: status } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: Math.min(limit, 100),
        });
        const payload = {
            items: items.map((r) => this.toPublic(r)),
            writeActionsEnabled: this.writeActionsEnabled(),
        };
        (0, token_security_util_1.assertNoCredentialLeak)(payload);
        return payload;
    }
    async get(user, id) {
        const row = await this.prisma.adsActionRequest.findFirst({
            where: { id, organizationId: user.organizationId },
        });
        if (!row)
            throw new common_1.NotFoundException('Không tìm thấy AdsActionRequest');
        const payload = this.toPublic(row);
        (0, token_security_util_1.assertNoCredentialLeak)(payload);
        return payload;
    }
    /**
     * AI / human / rule đề xuất — tạo DRAFT với before/after.
     * AI không được approve tại đây.
     */
    async propose(user, input) {
        const parsed = shared_1.adsActionProposeSchema.parse({
            organizationId: user.organizationId,
            requestedByUserId: user.id,
            campaignId: input.campaignId,
            draftId: input.draftId,
            recommendationId: input.recommendationId,
            platform: input.platform,
            actionType: input.actionType,
            source: input.source ?? (input.aiGenerated ? 'AI' : 'HUMAN'),
            beforeState: input.beforeState,
            afterState: input.afterState,
            payload: input.payload ?? {},
            evidence: input.evidence ?? {},
            reason: input.reason,
            budgetLimit: input.budgetLimit,
            proposedBudget: input.proposedBudget,
            idempotencyKey: input.idempotencyKey,
            aiGenerated: input.aiGenerated ?? input.source === 'AI',
        });
        await this.assertBudgetWithinLimit(user, parsed.proposedBudget, parsed.budgetLimit);
        const existing = await this.prisma.adsActionRequest.findUnique({
            where: { idempotencyKey: parsed.idempotencyKey },
        });
        if (existing) {
            if (existing.organizationId !== user.organizationId) {
                throw new common_1.ForbiddenException('Idempotency key thuộc org khác');
            }
            return this.toPublic(existing);
        }
        const status = input.submitForApproval
            ? database_1.AdsActionRequestStatus.PENDING_APPROVAL
            : database_1.AdsActionRequestStatus.DRAFT;
        const row = await this.prisma.adsActionRequest.create({
            data: {
                organizationId: parsed.organizationId,
                requestedByUserId: parsed.requestedByUserId,
                campaignId: parsed.campaignId,
                draftId: parsed.draftId,
                recommendationId: parsed.recommendationId,
                platform: parsed.platform,
                actionType: parsed.actionType,
                source: parsed.source,
                status,
                beforeState: parsed.beforeState,
                afterState: parsed.afterState,
                payload: parsed.payload,
                evidence: parsed.evidence,
                reason: parsed.reason,
                budgetLimit: parsed.budgetLimit,
                proposedBudget: parsed.proposedBudget,
                idempotencyKey: parsed.idempotencyKey,
                aiGenerated: parsed.aiGenerated,
                providerWriteEnabled: false,
                submittedAt: input.submitForApproval ? new Date() : null,
            },
        });
        await this.audit.log({
            organizationId: user.organizationId,
            userId: user.id,
            action: 'ADS_ACTION_PROPOSED',
            entityType: 'AdsActionRequest',
            entityId: row.id,
            metadata: {
                actionType: row.actionType,
                source: row.source,
                status: row.status,
                aiGenerated: row.aiGenerated,
            },
        });
        return this.toPublic(row);
    }
    async submitForApproval(user, id) {
        const row = await this.requireOwned(user, id);
        if (row.status !== database_1.AdsActionRequestStatus.DRAFT &&
            row.status !== database_1.AdsActionRequestStatus.PROPOSED) {
            throw new common_1.BadRequestException('Chỉ DRAFT/PROPOSED mới submit phê duyệt');
        }
        const updated = await this.prisma.adsActionRequest.update({
            where: { id },
            data: {
                status: database_1.AdsActionRequestStatus.PENDING_APPROVAL,
                submittedAt: new Date(),
            },
        });
        await this.audit.log({
            organizationId: user.organizationId,
            userId: user.id,
            action: 'ADS_ACTION_SUBMITTED',
            entityType: 'AdsActionRequest',
            entityId: id,
        });
        return this.toPublic(updated);
    }
    /**
     * Phê duyệt — bắt buộc ads.manage.
     * AI/RULE: approver ≠ requester.
     * Feature flag tắt → không enqueue write.
     */
    async approve(user, id) {
        const row = await this.requireOwned(user, id);
        shared_1.adsActionApproveSchema.parse({
            organizationId: user.organizationId,
            actionRequestId: id,
            approvedByUserId: user.id,
        });
        if (row.status !== database_1.AdsActionRequestStatus.PENDING_APPROVAL) {
            throw new common_1.BadRequestException('Chỉ PENDING_APPROVAL mới được phê duyệt');
        }
        try {
            (0, shared_1.assertApproverAllowed)({
                source: row.source,
                aiGenerated: row.aiGenerated,
                requestedByUserId: row.requestedByUserId,
                approvedByUserId: user.id,
            });
        }
        catch (err) {
            throw new common_1.ForbiddenException(err instanceof Error ? err.message : 'Không được tự phê duyệt');
        }
        await this.assertBudgetWithinLimit(user, row.proposedBudget != null ? (0, ads_efficiency_util_1.decimalToNumber)(row.proposedBudget) : undefined, row.budgetLimit != null ? (0, ads_efficiency_util_1.decimalToNumber)(row.budgetLimit) : undefined);
        if (!this.writeActionsEnabled()) {
            const skipped = await this.prisma.adsActionRequest.update({
                where: { id },
                data: {
                    status: database_1.AdsActionRequestStatus.SKIPPED_DISABLED,
                    approvedByUserId: user.id,
                    approvedAt: new Date(),
                    lastError: 'ADS_ACTIONS_LIVE=false — write action bị tắt',
                    result: {
                        skipped: true,
                        reason: 'feature_flag_disabled',
                        providerWrite: false,
                    },
                },
            });
            await this.audit.log({
                organizationId: user.organizationId,
                userId: user.id,
                action: 'ADS_ACTION_SKIPPED_DISABLED',
                entityType: 'AdsActionRequest',
                entityId: id,
            });
            return this.toPublic(skipped);
        }
        const approved = await this.prisma.adsActionRequest.update({
            where: { id },
            data: {
                status: database_1.AdsActionRequestStatus.APPROVED,
                approvedByUserId: user.id,
                approvedAt: new Date(),
                providerWriteEnabled: this.providerWriteEnabled(),
            },
        });
        await this.audit.log({
            organizationId: user.organizationId,
            userId: user.id,
            action: 'ADS_ACTION_APPROVED',
            entityType: 'AdsActionRequest',
            entityId: id,
            metadata: { approvedByUserId: user.id, requestedByUserId: row.requestedByUserId },
        });
        return this.enqueue(user, approved.id);
    }
    /**
     * MCP AUTO: queue trong giới hạn — không cần người duyệt thứ hai.
     * Tôn trọng ADS_ACTIONS_LIVE + budget. Không ENABLE campaign.
     */
    async systemAutoApproveForMcp(organizationId, actionRequestId, requestedByUserId) {
        const row = await this.prisma.adsActionRequest.findFirst({
            where: { id: actionRequestId, organizationId },
        });
        if (!row)
            throw new common_1.NotFoundException('Không tìm thấy AdsActionRequest');
        if (row.requestedByUserId !== requestedByUserId) {
            throw new common_1.ForbiddenException('Ownership mismatch');
        }
        if (row.status !== database_1.AdsActionRequestStatus.PENDING_APPROVAL &&
            row.status !== database_1.AdsActionRequestStatus.DRAFT &&
            row.status !== database_1.AdsActionRequestStatus.PROPOSED) {
            return this.toPublic(row);
        }
        if (row.actionType === database_1.AdsActionType.ENABLE_CAMPAIGN) {
            throw new common_1.BadRequestException('MCP AUTO không được tự bật lại quảng cáo');
        }
        await this.assertBudgetWithinLimit({ organizationId, id: requestedByUserId }, row.proposedBudget != null ? (0, ads_efficiency_util_1.decimalToNumber)(row.proposedBudget) : undefined, row.budgetLimit != null ? (0, ads_efficiency_util_1.decimalToNumber)(row.budgetLimit) : undefined);
        if (!this.writeActionsEnabled()) {
            const skipped = await this.prisma.adsActionRequest.update({
                where: { id: actionRequestId },
                data: {
                    status: database_1.AdsActionRequestStatus.SKIPPED_DISABLED,
                    approvedAt: new Date(),
                    lastError: 'ADS_ACTIONS_LIVE=false — MCP AUTO bỏ qua write',
                    result: { skipped: true, reason: 'feature_flag_disabled', actor: 'MCP_AUTO' },
                },
            });
            return this.toPublic(skipped);
        }
        await this.prisma.adsActionRequest.update({
            where: { id: actionRequestId },
            data: {
                status: database_1.AdsActionRequestStatus.APPROVED,
                approvedAt: new Date(),
                providerWriteEnabled: this.providerWriteEnabled(),
                reason: `${row.reason ?? ''} [MCP_AUTO]`.trim(),
            },
        });
        await this.audit.log({
            organizationId,
            userId: requestedByUserId,
            action: 'ADS_ACTION_MCP_AUTO_APPROVED',
            entityType: 'AdsActionRequest',
            entityId: actionRequestId,
            metadata: { actor: 'MCP_AUTO', actionType: row.actionType },
        });
        return this.enqueue({ organizationId, id: requestedByUserId }, actionRequestId);
    }
    async reject(user, id, rejectionReason) {
        const row = await this.requireOwned(user, id);
        shared_1.adsActionRejectSchema.parse({
            organizationId: user.organizationId,
            actionRequestId: id,
            rejectedByUserId: user.id,
            rejectionReason,
        });
        if (row.status !== database_1.AdsActionRequestStatus.PENDING_APPROVAL &&
            row.status !== database_1.AdsActionRequestStatus.DRAFT) {
            throw new common_1.BadRequestException('Không thể từ chối ở trạng thái hiện tại');
        }
        const updated = await this.prisma.adsActionRequest.update({
            where: { id },
            data: {
                status: database_1.AdsActionRequestStatus.REJECTED,
                approvedByUserId: user.id,
                rejectionReason,
                approvedAt: new Date(),
            },
        });
        await this.audit.log({
            organizationId: user.organizationId,
            userId: user.id,
            action: 'ADS_ACTION_REJECTED',
            entityType: 'AdsActionRequest',
            entityId: id,
            metadata: { rejectionReason },
        });
        return this.toPublic(updated);
    }
    async enqueue(user, actionRequestId) {
        const payload = shared_1.adsActionQueuePayloadSchema.parse({
            organizationId: user.organizationId,
            actionRequestId,
        });
        this.assertSafePayload(payload);
        const job = await this.actionQueue.add('ads-action-execute', payload, {
            jobId: `ads-action:${actionRequestId}`,
            attempts: 3,
            backoff: { type: 'exponential', delay: 3000 },
            removeOnComplete: 100,
            removeOnFail: 50,
        });
        const updated = await this.prisma.adsActionRequest.update({
            where: { id: actionRequestId },
            data: {
                status: database_1.AdsActionRequestStatus.QUEUED,
                bullJobId: String(job.id),
            },
        });
        await this.audit.log({
            organizationId: user.organizationId,
            userId: user.id,
            action: 'ADS_ACTION_QUEUED',
            entityType: 'AdsActionRequest',
            entityId: actionRequestId,
            metadata: { bullJobId: String(job.id) },
        });
        this.logger.log(`Queued AdsActionRequest ${actionRequestId} job=${job.id}`);
        return this.toPublic(updated);
    }
    async assertBudgetWithinLimit(user, proposedBudget, explicitLimit) {
        if (proposedBudget == null)
            return;
        const settings = await this.prisma.adManagerSettings.findFirst({
            where: { organizationId: user.organizationId },
            orderBy: { updatedAt: 'desc' },
        });
        const limit = explicitLimit ??
            (settings?.dailyBudgetLimit != null ? (0, ads_efficiency_util_1.decimalToNumber)(settings.dailyBudgetLimit) : undefined);
        if (limit != null && proposedBudget > limit) {
            throw new common_1.BadRequestException(`Ngân sách đề xuất ${proposedBudget} vượt giới hạn ${limit}`);
        }
    }
    async requireOwned(user, id) {
        const row = await this.prisma.adsActionRequest.findFirst({
            where: { id, organizationId: user.organizationId },
        });
        if (!row)
            throw new common_1.NotFoundException('Không tìm thấy AdsActionRequest');
        return row;
    }
    assertSafePayload(payload) {
        const json = JSON.stringify(payload);
        if (/access[_-]?token|refresh[_-]?token|encrypted|bearer|password|secret/i.test(json)) {
            throw new common_1.BadRequestException('Ads action payload không được chứa credential');
        }
    }
    toPublic(row) {
        const pub = shared_1.adsActionPublicSchema.parse({
            id: row.id,
            organizationId: row.organizationId,
            requestedByUserId: row.requestedByUserId,
            approvedByUserId: row.approvedByUserId,
            campaignId: row.campaignId,
            platform: row.platform,
            actionType: row.actionType,
            source: row.source,
            status: row.status,
            beforeState: row.beforeState,
            afterState: row.afterState,
            payload: row.payload ?? {},
            evidence: row.evidence ?? {},
            result: row.result,
            reason: row.reason,
            rejectionReason: row.rejectionReason,
            budgetLimit: row.budgetLimit != null ? (0, ads_efficiency_util_1.decimalToNumber)(row.budgetLimit) : null,
            proposedBudget: row.proposedBudget != null ? (0, ads_efficiency_util_1.decimalToNumber)(row.proposedBudget) : null,
            idempotencyKey: row.idempotencyKey,
            aiGenerated: row.aiGenerated,
            providerWriteEnabled: row.providerWriteEnabled,
            proposedAt: row.proposedAt.toISOString(),
            submittedAt: row.submittedAt?.toISOString() ?? null,
            approvedAt: row.approvedAt?.toISOString() ?? null,
            executedAt: row.executedAt?.toISOString() ?? null,
            verifiedAt: row.verifiedAt?.toISOString() ?? null,
            createdAt: row.createdAt.toISOString(),
        });
        return { ...pub, lastError: row.lastError ?? null };
    }
};
exports.AdsActionService = AdsActionService;
exports.AdsActionService = AdsActionService = AdsActionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)(queue_constants_1.ADS_ACTION_QUEUE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        config_1.ConfigService,
        bullmq_1.Queue])
], AdsActionService);
