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
var GoogleAdsAutopilotService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleAdsAutopilotService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("bullmq");
const database_1 = require("@marketingspa/database");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const queue_constants_1 = require("../queue/queue.constants");
const ads_efficiency_util_1 = require("./ads-efficiency.util");
let GoogleAdsAutopilotService = GoogleAdsAutopilotService_1 = class GoogleAdsAutopilotService {
    prisma;
    audit;
    autopilotQueue;
    logger = new common_1.Logger(GoogleAdsAutopilotService_1.name);
    constructor(prisma, audit, autopilotQueue) {
        this.prisma = prisma;
        this.audit = audit;
        this.autopilotQueue = autopilotQueue;
    }
    async getConfig(user, customerIdRaw) {
        const customerId = (0, shared_1.normalizeGoogleCustomerId)(customerIdRaw);
        if (!customerId)
            throw new common_1.BadRequestException('Customer ID không hợp lệ');
        await this.assertCustomerOwned(user.organizationId, customerId);
        const config = await this.prisma.googleAdsAutopilotConfig.findUnique({
            where: { organizationId_customerId: { organizationId: user.organizationId, customerId } },
        });
        return { config: config ? this.toPublicConfig(config) : null };
    }
    async upsertConfig(user, dto) {
        const customerId = (0, shared_1.normalizeGoogleCustomerId)(dto.customerId);
        if (!customerId)
            throw new common_1.BadRequestException('Customer ID không hợp lệ');
        const account = await this.assertCustomerOwned(user.organizationId, customerId);
        const mode = dto.mode ? shared_1.googleAdsAutopilotModeSchema.parse(dto.mode) : undefined;
        shared_1.googleAdsAutopilotGuardrailSchema.parse({
            maxDailyBudget: dto.maxDailyBudget ?? null,
            maxMonthlyBudget: dto.maxMonthlyBudget ?? null,
            maxBudgetIncreasePct: dto.maxBudgetIncreasePct ?? 20,
            maxBudgetDecreasePct: dto.maxBudgetDecreasePct ?? 20,
            targetCpa: dto.targetCpa ?? null,
            targetCpl: dto.targetCpl ?? null,
            targetRoas: dto.targetRoas ?? null,
            stopLossDailySpend: dto.stopLossDailySpend ?? null,
            minSpendForAction: dto.minSpendForAction ?? null,
            minClicksForAction: dto.minClicksForAction ?? null,
            minConversionsForAction: dto.minConversionsForAction ?? null,
            gracePeriodHours: dto.gracePeriodHours ?? 24,
            maxActionsPerDay: dto.maxActionsPerDay ?? 10,
        });
        const data = {
            organizationId: user.organizationId,
            customerId,
            loginCustomerId: (0, shared_1.normalizeGoogleCustomerId)(dto.loginCustomerId) || account.loginCustomerId,
            enabled: dto.enabled ?? false,
            mode: mode ?? 'RECOMMEND_ONLY',
            maxDailyBudget: dto.maxDailyBudget,
            maxMonthlyBudget: dto.maxMonthlyBudget,
            maxBudgetIncreasePct: dto.maxBudgetIncreasePct ?? 20,
            maxBudgetDecreasePct: dto.maxBudgetDecreasePct ?? 20,
            targetCpa: dto.targetCpa,
            targetCpl: dto.targetCpl,
            targetRoas: dto.targetRoas,
            stopLossDailySpend: dto.stopLossDailySpend,
            minSpendForAction: dto.minSpendForAction,
            minClicksForAction: dto.minClicksForAction,
            minConversionsForAction: dto.minConversionsForAction,
            gracePeriodHours: dto.gracePeriodHours ?? 24,
            maxActionsPerDay: dto.maxActionsPerDay ?? 10,
            emergencyStop: dto.emergencyStop ?? false,
            writeWhitelistEnabled: dto.writeWhitelistEnabled ?? false,
            cooldownMinutes: dto.cooldownMinutes ?? 60,
            allowAutoPause: dto.allowAutoPause ?? true,
            minRoas: dto.minRoas,
        };
        const config = await this.prisma.googleAdsAutopilotConfig.upsert({
            where: { organizationId_customerId: { organizationId: user.organizationId, customerId } },
            create: data,
            update: {
                ...data,
                organizationId: undefined,
                customerId: undefined,
            },
        });
        await this.audit.log({
            organizationId: user.organizationId,
            userId: user.id,
            action: 'GOOGLE_ADS_AUTOPILOT_CONFIG_UPSERT',
            entityType: 'GoogleAdsAutopilotConfig',
            entityId: config.id,
            metadata: { customerId, enabled: config.enabled, mode: config.mode },
        });
        return { config: this.toPublicConfig(config) };
    }
    async listProposals(user, customerIdRaw, status) {
        const customerId = (0, shared_1.normalizeGoogleCustomerId)(customerIdRaw);
        if (!customerId)
            throw new common_1.BadRequestException('Customer ID không hợp lệ');
        await this.assertCustomerOwned(user.organizationId, customerId);
        const items = await this.prisma.googleAdsAutopilotProposal.findMany({
            where: {
                organizationId: user.organizationId,
                customerId,
                ...(status ? { status: status } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        return { items: items.map((p) => this.toPublicProposal(p)) };
    }
    async listActions(user, customerIdRaw) {
        const customerId = (0, shared_1.normalizeGoogleCustomerId)(customerIdRaw);
        if (!customerId)
            throw new common_1.BadRequestException('Customer ID không hợp lệ');
        await this.assertCustomerOwned(user.organizationId, customerId);
        const items = await this.prisma.googleAdsAutopilotAction.findMany({
            where: { organizationId: user.organizationId, customerId },
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: { outcomes: true },
        });
        return { items: items.map((a) => this.toPublicAction(a)) };
    }
    async approveProposal(user, proposalId, dto) {
        const proposal = await this.requireProposal(user, proposalId);
        if (proposal.status !== database_1.GoogleAdsAutopilotProposalStatus.PENDING) {
            throw new common_1.BadRequestException(`Proposal status ${proposal.status} không thể duyệt`);
        }
        const config = await this.prisma.googleAdsAutopilotConfig.findUnique({
            where: { id: proposal.configId },
        });
        if (!config)
            throw new common_1.NotFoundException('Autopilot config không tồn tại');
        const providerWrite = (0, shared_1.canAutopilotProviderWrite)({
            customerId: config.customerId,
            writeWhitelistEnabled: config.writeWhitelistEnabled,
        });
        const now = new Date();
        const result = await this.prisma.$transaction(async (tx) => {
            const claimed = await tx.googleAdsAutopilotProposal.updateMany({
                where: {
                    id: proposalId,
                    organizationId: user.organizationId,
                    status: database_1.GoogleAdsAutopilotProposalStatus.PENDING,
                },
                data: {
                    status: database_1.GoogleAdsAutopilotProposalStatus.APPROVED,
                    approvedByUserId: user.id,
                    approvedAt: now,
                },
            });
            if (claimed.count === 0) {
                const current = await tx.googleAdsAutopilotProposal.findFirst({
                    where: { id: proposalId, organizationId: user.organizationId },
                    include: { action: true },
                });
                if (current?.status === database_1.GoogleAdsAutopilotProposalStatus.APPROVED && current.action) {
                    return { actionId: current.action.id, alreadyApproved: true };
                }
                throw new common_1.BadRequestException(`Proposal status ${current?.status ?? 'unknown'} không thể duyệt (race/conflict)`);
            }
            const action = await tx.googleAdsAutopilotAction.create({
                data: {
                    proposalId: proposal.id,
                    configId: config.id,
                    organizationId: user.organizationId,
                    customerId: config.customerId,
                    actionType: proposal.actionType,
                    status: database_1.GoogleAdsAutopilotActionStatus.PENDING,
                    idempotencyKey: (0, shared_1.buildAutopilotActionIdempotencyKey)(proposal.id),
                    beforeState: proposal.beforeState,
                    afterState: proposal.afterState,
                    payload: proposal.payload,
                    providerWriteEnabled: providerWrite,
                },
            });
            for (const horizon of ['H24', 'D3', 'D7']) {
                await tx.googleAdsAutopilotOutcome.create({
                    data: {
                        actionId: action.id,
                        organizationId: user.organizationId,
                        horizon,
                        metricsBefore: proposal.evidence,
                        metricsAfter: {},
                        scheduledFor: new Date(now.getTime() + shared_1.AUTOPILOT_OUTCOME_HORIZONS_MS[horizon]),
                    },
                });
            }
            return { actionId: action.id, alreadyApproved: false };
        });
        if (!result.alreadyApproved) {
            await this.autopilotQueue.add('execute-autopilot-action', { kind: 'execute', organizationId: user.organizationId, actionId: result.actionId }, { jobId: `autopilot-exec:${result.actionId}`, removeOnComplete: 100 });
        }
        await this.audit.log({
            organizationId: user.organizationId,
            userId: user.id,
            action: 'GOOGLE_ADS_AUTOPILOT_PROPOSAL_APPROVED',
            entityType: 'GoogleAdsAutopilotProposal',
            entityId: proposalId,
            metadata: { actionId: result.actionId, note: dto.note, alreadyApproved: result.alreadyApproved },
        });
        return {
            proposal: this.toPublicProposal({ ...proposal, status: database_1.GoogleAdsAutopilotProposalStatus.APPROVED }),
            actionId: result.actionId,
        };
    }
    async rejectProposal(user, proposalId, dto) {
        const proposal = await this.requireProposal(user, proposalId);
        if (proposal.status !== database_1.GoogleAdsAutopilotProposalStatus.PENDING) {
            throw new common_1.BadRequestException(`Proposal status ${proposal.status} không thể từ chối`);
        }
        const updated = await this.prisma.googleAdsAutopilotProposal.update({
            where: { id: proposalId },
            data: {
                status: database_1.GoogleAdsAutopilotProposalStatus.REJECTED,
                rejectedAt: new Date(),
                rejectionReason: dto.reason,
            },
        });
        await this.audit.log({
            organizationId: user.organizationId,
            userId: user.id,
            action: 'GOOGLE_ADS_AUTOPILOT_PROPOSAL_REJECTED',
            entityType: 'GoogleAdsAutopilotProposal',
            entityId: proposalId,
            metadata: { reason: dto.reason },
        });
        return { proposal: this.toPublicProposal(updated) };
    }
    async triggerScan(user, customerIdRaw) {
        const customerId = (0, shared_1.normalizeGoogleCustomerId)(customerIdRaw);
        if (!customerId)
            throw new common_1.BadRequestException('Customer ID không hợp lệ');
        const config = await this.prisma.googleAdsAutopilotConfig.findUnique({
            where: { organizationId_customerId: { organizationId: user.organizationId, customerId } },
        });
        if (!config)
            throw new common_1.NotFoundException('Chưa cấu hình Autopilot cho customer này');
        await this.autopilotQueue.add('scan-autopilot-config', { kind: 'scan', organizationId: user.organizationId, configId: config.id }, { jobId: `autopilot-scan:${config.id}:${Date.now()}`, removeOnComplete: 50 });
        return { queued: true, configId: config.id };
    }
    async requireProposal(user, proposalId) {
        const proposal = await this.prisma.googleAdsAutopilotProposal.findFirst({
            where: { id: proposalId, organizationId: user.organizationId },
        });
        if (!proposal)
            throw new common_1.NotFoundException('Proposal không tồn tại');
        return proposal;
    }
    async assertCustomerOwned(organizationId, customerId) {
        const account = await this.prisma.adGoogleAdsAccount.findFirst({
            where: { organizationId, customerId, isSelected: true },
        });
        if (!account) {
            throw new common_1.ForbiddenException('Tài khoản Google Ads không thuộc tenant hoặc chưa được chọn');
        }
        return account;
    }
    toPublicConfig(row) {
        return {
            id: row.id,
            customerId: row.customerId,
            loginCustomerId: row.loginCustomerId,
            enabled: row.enabled,
            mode: row.mode,
            maxDailyBudget: row.maxDailyBudget ? (0, ads_efficiency_util_1.decimalToNumber)(row.maxDailyBudget) : null,
            maxMonthlyBudget: row.maxMonthlyBudget ? (0, ads_efficiency_util_1.decimalToNumber)(row.maxMonthlyBudget) : null,
            maxBudgetIncreasePct: row.maxBudgetIncreasePct,
            maxBudgetDecreasePct: row.maxBudgetDecreasePct,
            targetCpa: row.targetCpa ? (0, ads_efficiency_util_1.decimalToNumber)(row.targetCpa) : null,
            targetCpl: row.targetCpl ? (0, ads_efficiency_util_1.decimalToNumber)(row.targetCpl) : null,
            targetRoas: row.targetRoas ? (0, ads_efficiency_util_1.decimalToNumber)(row.targetRoas) : null,
            stopLossDailySpend: row.stopLossDailySpend ? (0, ads_efficiency_util_1.decimalToNumber)(row.stopLossDailySpend) : null,
            minSpendForAction: row.minSpendForAction ? (0, ads_efficiency_util_1.decimalToNumber)(row.minSpendForAction) : null,
            minClicksForAction: row.minClicksForAction,
            minConversionsForAction: row.minConversionsForAction,
            gracePeriodHours: row.gracePeriodHours,
            maxActionsPerDay: row.maxActionsPerDay,
            actionsToday: row.actionsToday,
            emergencyStop: row.emergencyStop,
            writeWhitelistEnabled: row.writeWhitelistEnabled,
            cooldownMinutes: row.cooldownMinutes,
            allowAutoPause: row.allowAutoPause,
            minRoas: row.minRoas ? (0, ads_efficiency_util_1.decimalToNumber)(row.minRoas) : null,
            lastActionAt: row.lastActionAt?.toISOString() ?? null,
            lastScanAt: row.lastScanAt?.toISOString() ?? null,
            createdAt: row.createdAt.toISOString(),
            updatedAt: row.updatedAt.toISOString(),
        };
    }
    toPublicProposal(row) {
        return {
            id: row.id,
            actionType: row.actionType,
            status: row.status,
            riskLevel: row.riskLevel,
            autoEligible: row.autoEligible,
            campaignId: row.campaignId,
            externalCampaignId: row.externalCampaignId,
            keywordText: row.keywordText,
            reason: row.reason,
            policyDecision: row.policyDecision,
            createdAt: row.createdAt.toISOString(),
            approvedAt: row.approvedAt?.toISOString() ?? null,
            rejectedAt: row.rejectedAt?.toISOString() ?? null,
            rejectionReason: row.rejectionReason,
        };
    }
    toPublicAction(row) {
        return {
            id: row.id,
            actionType: row.actionType,
            status: row.status,
            providerWriteEnabled: row.providerWriteEnabled,
            providerResult: row.providerResult,
            lastError: row.lastError,
            executedAt: row.executedAt?.toISOString() ?? null,
            completedAt: row.completedAt?.toISOString() ?? null,
            createdAt: row.createdAt.toISOString(),
            outcomes: row.outcomes.map((o) => ({
                horizon: o.horizon,
                verdict: o.verdict,
                evaluatedAt: o.evaluatedAt?.toISOString() ?? null,
            })),
        };
    }
};
exports.GoogleAdsAutopilotService = GoogleAdsAutopilotService;
exports.GoogleAdsAutopilotService = GoogleAdsAutopilotService = GoogleAdsAutopilotService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(queue_constants_1.ADS_AUTOPILOT_QUEUE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        bullmq_1.Queue])
], GoogleAdsAutopilotService);
