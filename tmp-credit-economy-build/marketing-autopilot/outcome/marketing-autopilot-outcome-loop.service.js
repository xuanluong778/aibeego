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
var MarketingAutopilotOutcomeLoopService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketingAutopilotOutcomeLoopService = void 0;
/**
 * Outcome Learning Loop service — RUN → MONITOR → DIAGNOSE → RECOMMEND → OPTIMIZE → LEARN
 */
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../../prisma/prisma.service");
const audit_service_1 = require("../../audit/audit.service");
const marketing_context_engine_service_1 = require("../context/marketing-context-engine.service");
const marketing_autopilot_outcome_learning_service_1 = require("./marketing-autopilot-outcome-learning.service");
let MarketingAutopilotOutcomeLoopService = MarketingAutopilotOutcomeLoopService_1 = class MarketingAutopilotOutcomeLoopService {
    prisma;
    audit;
    contextEngine;
    outcomeLearning;
    logger = new common_1.Logger(MarketingAutopilotOutcomeLoopService_1.name);
    constructor(prisma, audit, contextEngine, outcomeLearning) {
        this.prisma = prisma;
        this.audit = audit;
        this.contextEngine = contextEngine;
        this.outcomeLearning = outcomeLearning;
    }
    async getAutopilotMode(organizationId) {
        const row = await this.prisma.marketingAutopilotGuardrail.findUnique({
            where: { organizationId },
        });
        if (!row)
            return shared_1.DEFAULT_AUTOPILOT_MODE;
        if (row.fullAutopilotEnabled && row.autopilotMode === 'FULL_AUTOPILOT') {
            return 'FULL_AUTOPILOT';
        }
        return row.autopilotMode ?? shared_1.DEFAULT_AUTOPILOT_MODE;
    }
    /** Start loop after mission execution completes (RUN step). */
    async startMissionLoop(input) {
        const mode = await this.getAutopilotMode(input.organizationId);
        const mission = await this.prisma.marketingMission.findFirst({
            where: { id: input.missionId, organizationId: input.organizationId },
        });
        if (!mission)
            return null;
        const existingLoop = await this.prisma.marketingAutopilotOutcomeLoop.findUnique({
            where: { missionId: input.missionId },
        });
        if (existingLoop?.status === 'COMPLETED' && existingLoop.currentStep === 'LEARN') {
            return this.getLoopPublic(input.organizationId, input.missionId);
        }
        const loop = await this.prisma.marketingAutopilotOutcomeLoop.upsert({
            where: { missionId: input.missionId },
            create: {
                organizationId: input.organizationId,
                missionId: input.missionId,
                projectId: input.projectId,
                currentStep: 'RUN',
                status: 'ACTIVE',
                autopilotMode: mode,
            },
            update: {
                status: 'ACTIVE',
                autopilotMode: mode,
            },
        });
        await this.recordMissionOutcomeBaseline(input);
        await this.audit.log({
            organizationId: input.organizationId,
            action: 'AUTOPILOT_OUTCOME_LOOP_STARTED',
            entityType: 'MARKETING_MISSION',
            entityId: input.missionId,
            metadata: { step: 'RUN', autopilotMode: mode, approvalId: input.approvalId ?? null },
        });
        return this.advanceLoop(input.organizationId, input.missionId);
    }
    async recordMissionOutcomeBaseline(input) {
        const mission = await this.prisma.marketingMission.findFirst({
            where: { id: input.missionId, organizationId: input.organizationId },
        });
        if (!mission)
            return;
        const project = await this.prisma.marketingAutopilotProject.findFirst({
            where: { id: input.projectId, organizationId: input.organizationId },
        });
        const ctx = await this.contextEngine.getContext(input.organizationId);
        const before = (0, shared_1.extractMissionOutcomeMetrics)(ctx.snapshot.metrics);
        const existing = await this.prisma.marketingAutopilotOutcomeTrack.findFirst({
            where: { organizationId: input.organizationId, missionId: input.missionId },
        });
        if (existing)
            return existing;
        const track = await this.prisma.marketingAutopilotOutcomeTrack.create({
            data: {
                organizationId: input.organizationId,
                createdById: mission.createdById,
                projectId: input.projectId,
                missionId: input.missionId,
                actionType: 'STRATEGY',
                status: 'OPEN',
                recommendationJson: { source: 'mission_execution' },
                beforeMetricsJson: before,
                beforeSnapshotId: ctx.snapshotId ?? null,
                baselineAt: new Date(),
                productName: project?.productName ?? '',
                customerProfile: project?.customerProfile ?? '',
                targetArea: project?.targetArea ?? '',
                primaryGoal: project?.primaryGoal ?? '',
                channelsJson: [],
                offerJson: {},
            },
        });
        for (const days of shared_1.OUTCOME_LEARNING_HORIZONS) {
            const existingEval = await this.prisma.marketingAutopilotOutcomeEvaluation.findFirst({
                where: { trackId: track.id, horizonDays: days },
            });
            if (existingEval)
                continue;
            await this.prisma.marketingAutopilotOutcomeEvaluation.create({
                data: {
                    organizationId: input.organizationId,
                    trackId: track.id,
                    horizonDays: days,
                    dueAt: new Date(Date.now() + days * 24 * 3600 * 1000),
                    status: 'PENDING',
                },
            });
        }
        return track;
    }
    /** Advance loop one step and execute step handler. */
    async advanceLoop(organizationId, missionId) {
        const loop = await this.prisma.marketingAutopilotOutcomeLoop.findFirst({
            where: { missionId, organizationId },
        });
        if (!loop)
            throw new common_1.NotFoundException('Outcome loop not found');
        const next = (0, shared_1.nextOutcomeLoopStep)(loop.currentStep);
        if (!next) {
            await this.prisma.marketingAutopilotOutcomeLoop.update({
                where: { id: loop.id },
                data: { status: 'COMPLETED', currentStep: 'LEARN' },
            });
            return this.getLoopPublic(organizationId, missionId);
        }
        await this.prisma.marketingAutopilotOutcomeLoop.update({
            where: { id: loop.id },
            data: { currentStep: next },
        });
        switch (next) {
            case 'MONITOR':
                return this.runMonitor(organizationId, missionId);
            case 'DIAGNOSE':
                return this.runDiagnose(organizationId, missionId);
            case 'RECOMMEND':
                return this.runRecommend(organizationId, missionId);
            case 'OPTIMIZE':
                return this.runOptimize(organizationId, missionId);
            case 'LEARN':
                return this.runLearn(organizationId, missionId);
            default:
                return this.getLoopPublic(organizationId, missionId);
        }
    }
    async runMonitor(organizationId, missionId) {
        const loop = await this.prisma.marketingAutopilotOutcomeLoop.findFirst({
            where: { missionId, organizationId },
        });
        if (!loop)
            throw new common_1.NotFoundException('Outcome loop not found');
        const ctx = await this.contextEngine.getContext(organizationId);
        const windows = {};
        for (const days of shared_1.OUTCOME_LEARNING_HORIZONS) {
            windows[days] = (0, shared_1.extractMissionOutcomeMetrics)(ctx.snapshot.metrics, {
                horizonDays: days,
                capturedAt: new Date().toISOString(),
            });
        }
        await this.prisma.marketingAutopilotOutcomeLoop.update({
            where: { id: loop.id },
            data: {
                monitorJson: windows,
                lastMonitorAt: new Date(),
            },
        });
        await this.audit.log({
            organizationId,
            action: 'AUTOPILOT_OUTCOME_MONITOR',
            entityType: 'MARKETING_MISSION',
            entityId: missionId,
            metadata: { windows: Object.keys(windows), correlationOnly: true },
        });
        return this.advanceLoop(organizationId, missionId);
    }
    async runDiagnose(organizationId, missionId) {
        const loop = await this.prisma.marketingAutopilotOutcomeLoop.findFirst({
            where: { missionId, organizationId },
        });
        if (!loop)
            throw new common_1.NotFoundException('Outcome loop not found');
        const monitor = (loop.monitorJson ?? {});
        const primary = monitor[7] ?? monitor[1] ?? monitor[30];
        if (!primary) {
            const ctx = await this.contextEngine.getContext(organizationId);
            const m = (0, shared_1.extractMissionOutcomeMetrics)(ctx.snapshot.metrics, { horizonDays: 7 });
            Object.assign(monitor, { 7: m });
        }
        const metrics = primary ?? monitor[7] ?? (0, shared_1.extractMissionOutcomeMetrics)({});
        const track = await this.prisma.marketingAutopilotOutcomeTrack.findFirst({
            where: { organizationId, missionId },
        });
        const baseline = track?.beforeMetricsJson
            ? track.beforeMetricsJson
            : null;
        const guardrailRow = await this.prisma.marketingAutopilotGuardrail.findUnique({
            where: { organizationId },
        });
        const guardrail = (0, shared_1.normalizeGuardrailFromDb)(guardrailRow);
        const readinessOpts = {
            loopStartedAt: loop.createdAt,
            now: new Date(),
            horizonDays: metrics.horizonDays ?? 7,
        };
        const diagnoseResult = (0, shared_1.diagnoseMissionOutcomesWithReadiness)(metrics, baseline, readinessOpts);
        const stopLoss = diagnoseResult.verdict === 'READY'
            ? (0, shared_1.checkMissionStopLoss)(metrics, guardrail, readinessOpts)
            : { triggered: false };
        if (stopLoss.triggered) {
            await this.applyStopLoss(organizationId, missionId, stopLoss);
        }
        const diagnosisPayload = diagnoseResult.verdict === 'READY'
            ? diagnoseResult.diagnoses
            : [{ verdict: diagnoseResult.verdict, readiness: diagnoseResult.readiness }];
        await this.prisma.marketingAutopilotOutcomeLoop.update({
            where: { id: loop.id },
            data: {
                diagnosisJson: diagnosisPayload,
                lastDiagnoseAt: new Date(),
                stopLossActive: stopLoss.triggered,
                status: stopLoss.triggered ? 'PAUSED_STOP_LOSS' : loop.status,
            },
        });
        await this.audit.log({
            organizationId,
            action: 'AUTOPILOT_OUTCOME_DIAGNOSE',
            entityType: 'MARKETING_MISSION',
            entityId: missionId,
            metadata: {
                diagnosisCount: diagnoseResult.diagnoses.length,
                dataVerdict: diagnoseResult.verdict,
                stopLoss: stopLoss.triggered ? stopLoss.reason : null,
                correlationOnly: true,
            },
        });
        return this.advanceLoop(organizationId, missionId);
    }
    async acquireMutationLock(organizationId, lockKey, holder, ttlMs = shared_1.OUTCOME_MUTATION_LOCK_TTL_MS) {
        const now = new Date();
        await this.prisma.marketingAutopilotOutcomeMutationLock.deleteMany({
            where: { organizationId, expiresAt: { lt: now } },
        });
        const existing = await this.prisma.marketingAutopilotOutcomeMutationLock.findUnique({
            where: { organizationId_lockKey: { organizationId, lockKey } },
        });
        if (existing && existing.expiresAt > now) {
            return false;
        }
        if (existing) {
            await this.prisma.marketingAutopilotOutcomeMutationLock.update({
                where: { id: existing.id },
                data: { holder, expiresAt: new Date(now.getTime() + ttlMs) },
            });
            return true;
        }
        try {
            await this.prisma.marketingAutopilotOutcomeMutationLock.create({
                data: {
                    organizationId,
                    lockKey,
                    holder,
                    expiresAt: new Date(now.getTime() + ttlMs),
                },
            });
            return true;
        }
        catch {
            return false;
        }
    }
    async releaseMutationLock(organizationId, lockKey) {
        await this.prisma.marketingAutopilotOutcomeMutationLock.deleteMany({
            where: { organizationId, lockKey },
        });
    }
    async applyStopLoss(organizationId, missionId, stopLoss) {
        if (!stopLoss.triggered || !stopLoss.reason)
            return;
        const lockKey = (0, shared_1.buildOutcomeMutationLockKey)(missionId, 'stop-loss');
        const locked = await this.acquireMutationLock(organizationId, lockKey, 'api:stop-loss');
        if (!locked) {
            this.logger.warn(`[stop-loss] skip duplicate — lock held for ${missionId}`);
            return;
        }
        try {
            const existing = await this.prisma.marketingAutopilotStopLossEvent.findFirst({
                where: { organizationId, missionId, reason: stopLoss.reason, resolvedAt: null },
            });
            if (existing)
                return;
            await this.prisma.marketingAutopilotStopLossEvent.create({
                data: {
                    organizationId,
                    missionId,
                    reason: stopLoss.reason,
                    triggerJson: (stopLoss.trigger ?? {}),
                    pausedModules: (stopLoss.pauseModules ?? []),
                },
            });
            const modules = stopLoss.pauseModules ?? ['ADS'];
            await this.prisma.marketingMissionAsset.updateMany({
                where: {
                    missionId,
                    organizationId,
                    module: { in: modules },
                    status: { in: ['EXECUTED', 'APPROVED', 'DRAFT'] },
                },
                data: { status: 'PAUSED_STOP_LOSS' },
            });
            for (const mod of modules) {
                if (mod === 'AUTOMATION') {
                    const assets = await this.prisma.marketingMissionAsset.findMany({
                        where: { missionId, organizationId, module: 'AUTOMATION' },
                    });
                    for (const a of assets) {
                        await this.prisma.automationFlow.updateMany({
                            where: { id: a.entityId, organizationId },
                            data: { isPaused: true },
                        });
                    }
                }
            }
            this.logger.warn(`[stop-loss] mission ${missionId} ${stopLoss.reason}: paused ${modules.join(',')}`);
        }
        finally {
            await this.releaseMutationLock(organizationId, lockKey);
        }
    }
    async runRecommend(organizationId, missionId) {
        const loop = await this.prisma.marketingAutopilotOutcomeLoop.findFirst({
            where: { missionId, organizationId },
        });
        if (!loop)
            throw new common_1.NotFoundException('Outcome loop not found');
        const diagnoses = Array.isArray(loop.diagnosisJson)
            ? loop.diagnosisJson
            : [];
        const mode = loop.autopilotMode ?? shared_1.DEFAULT_AUTOPILOT_MODE;
        const recs = (0, shared_1.buildOptimizationRecommendations)(diagnoses, mode);
        const monitor = (loop.monitorJson ?? {});
        const metricsSnapshot = monitor[7] ?? monitor[1] ?? monitor[30] ?? (0, shared_1.extractMissionOutcomeMetrics)({});
        for (const rec of recs) {
            const existing = await this.prisma.marketingAutopilotOptimizationProposal.findFirst({
                where: {
                    organizationId,
                    missionId,
                    diagnosisKind: rec.diagnosisKind,
                    status: { in: ['PENDING_APPROVAL', 'APPROVED', 'APPLIED'] },
                },
            });
            if (existing)
                continue;
            try {
                await this.prisma.marketingAutopilotOptimizationProposal.create({
                    data: {
                        organizationId,
                        missionId,
                        projectId: loop.projectId,
                        diagnosisKind: rec.diagnosisKind,
                        title: rec.title,
                        summary: rec.summary,
                        recommendationJson: rec,
                        metricsSnapshotJson: metricsSnapshot,
                        status: rec.requiresApproval ? 'PENDING_APPROVAL' : 'APPROVED',
                        correlationOnly: true,
                        ...(rec.requiresApproval ? {} : { approvedAt: new Date() }),
                    },
                });
            }
            catch (err) {
                if (!(err instanceof database_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
                    throw err;
                }
            }
        }
        await this.prisma.marketingAutopilotOutcomeLoop.update({
            where: { id: loop.id },
            data: { lastRecommendAt: new Date() },
        });
        return this.advanceLoop(organizationId, missionId);
    }
    async runOptimize(organizationId, missionId) {
        const loop = await this.prisma.marketingAutopilotOutcomeLoop.findFirst({
            where: { missionId, organizationId },
        });
        if (!loop)
            throw new common_1.NotFoundException('Outcome loop not found');
        const mode = loop.autopilotMode ?? shared_1.DEFAULT_AUTOPILOT_MODE;
        if (mode === 'FULL_AUTOPILOT') {
            const approved = await this.prisma.marketingAutopilotOptimizationProposal.findMany({
                where: {
                    organizationId,
                    missionId,
                    status: 'APPROVED',
                },
            });
            for (const p of approved) {
                if (p.status !== 'APPROVED')
                    continue;
                await this.applyProposalInternal(organizationId, p.id, null);
            }
        }
        // APPROVAL_AUTOPILOT: wait for user approve via API — no auto apply
        await this.prisma.marketingAutopilotOutcomeLoop.update({
            where: { id: loop.id },
            data: { lastOptimizeAt: new Date() },
        });
        return this.advanceLoop(organizationId, missionId);
    }
    async runLearn(organizationId, missionId) {
        const loop = await this.prisma.marketingAutopilotOutcomeLoop.findFirst({
            where: { missionId, organizationId },
        });
        if (!loop)
            throw new common_1.NotFoundException('Outcome loop not found');
        const track = await this.prisma.marketingAutopilotOutcomeTrack.findFirst({
            where: { organizationId, missionId },
        });
        if (track) {
            await this.outcomeLearning.evaluateDue(organizationId, { forceTrackId: track.id });
        }
        const diagnoses = Array.isArray(loop.diagnosisJson) ? loop.diagnosisJson : [];
        for (const d of diagnoses) {
            if (!d.kind)
                continue;
            await this.prisma.marketingAutopilotBusinessLearning.upsert({
                where: {
                    organizationId_category_key: {
                        organizationId,
                        category: 'DIAGNOSIS',
                        key: `mission:${missionId}:${d.kind}`,
                    },
                },
                create: {
                    organizationId,
                    category: 'DIAGNOSIS',
                    key: `mission:${missionId}:${d.kind}`,
                    title: d.title ?? d.kind,
                    summary: `${d.summary ?? ''} (correlation only)`,
                    confidence: 'LOW',
                    sampleSize: 1,
                    correlationOnly: true,
                    evidenceJson: { missionId, kind: d.kind },
                    sourceTrackIds: track ? [track.id] : [],
                },
                update: {
                    lastObservedAt: new Date(),
                    sampleSize: { increment: 1 },
                    summary: `${d.summary ?? ''} (correlation only)`,
                },
            });
        }
        await this.prisma.marketingAutopilotOutcomeLoop.update({
            where: { id: loop.id },
            data: {
                lastLearnAt: new Date(),
                status: 'COMPLETED',
                currentStep: 'LEARN',
            },
        });
        await this.audit.log({
            organizationId,
            action: 'AUTOPILOT_OUTCOME_LEARN',
            entityType: 'MARKETING_MISSION',
            entityId: missionId,
            metadata: { correlationOnly: true },
        });
        return this.getLoopPublic(organizationId, missionId);
    }
    /** User approves optimization proposal (APPROVAL_AUTOPILOT). */
    async approveProposal(user, proposalId) {
        const proposal = await this.prisma.marketingAutopilotOptimizationProposal.findFirst({
            where: { id: proposalId, organizationId: user.organizationId },
        });
        if (!proposal)
            throw new common_1.NotFoundException('Optimization proposal not found');
        if (proposal.status !== 'PENDING_APPROVAL') {
            throw new common_1.BadRequestException(`Proposal status ${proposal.status} — không duyệt được`);
        }
        const rec = proposal.recommendationJson;
        const module = rec.module ?? proposal.diagnosisKind;
        const lockKey = (0, shared_1.buildOutcomeMutationLockKey)(proposal.missionId, `module:${module}`);
        const locked = await this.acquireMutationLock(user.organizationId, lockKey, `api:approve:${user.id}`);
        if (!locked) {
            throw new common_1.BadRequestException('Optimization đang được xử lý — thử lại sau');
        }
        try {
            const mission = await this.prisma.marketingMission.findFirst({
                where: { id: proposal.missionId, organizationId: user.organizationId },
            });
            if (!mission)
                throw new common_1.NotFoundException('Mission not found');
            const ctx = await this.contextEngine.getContext(user.organizationId);
            const currentMetrics = (0, shared_1.extractMissionOutcomeMetrics)(ctx.snapshot.metrics, {
                horizonDays: 7,
            });
            const proposalMetrics = (proposal.metricsSnapshotJson ??
                {});
            const loop = await this.prisma.marketingAutopilotOutcomeLoop.findUnique({
                where: { missionId: proposal.missionId },
            });
            const guardrailRow = await this.prisma.marketingAutopilotGuardrail.findUnique({
                where: { organizationId: user.organizationId },
            });
            const guardrail = (0, shared_1.normalizeGuardrailFromDb)(guardrailRow);
            const readiness = (0, shared_1.assessOutcomeDataReadiness)(currentMetrics, {
                loopStartedAt: loop?.createdAt ?? proposal.createdAt,
            });
            const recheck = (0, shared_1.recheckProposalBeforeApply)({
                proposalMetrics,
                currentMetrics,
                proposalCreatedAt: proposal.createdAt,
                missionStatus: mission.status,
                guardrail,
                integrationOk: true,
                permissionOk: true,
                readiness,
            });
            if (!recheck.allowed) {
                await this.prisma.marketingAutopilotOptimizationProposal.update({
                    where: { id: proposalId },
                    data: {
                        status: recheck.blockStatus ?? 'BLOCKED_GUARDRAIL',
                        blockedReason: recheck.blockReason ?? 'RECHECK_FAILED',
                    },
                });
                return {
                    applied: false,
                    blocked: true,
                    status: recheck.blockStatus,
                    reason: recheck.blockReason,
                };
            }
            await this.prisma.marketingAutopilotOptimizationProposal.update({
                where: { id: proposalId },
                data: {
                    status: 'APPROVED',
                    approvedById: user.id,
                    approvedAt: new Date(),
                },
            });
            return this.applyProposalInternal(user.organizationId, proposalId, user.id, {
                lockAlreadyHeld: true,
                lockKey,
            });
        }
        finally {
            await this.releaseMutationLock(user.organizationId, lockKey);
        }
    }
    async applyProposalInternal(organizationId, proposalId, userId, opts) {
        const proposal = await this.prisma.marketingAutopilotOptimizationProposal.findFirst({
            where: { id: proposalId, organizationId },
        });
        if (!proposal || proposal.status !== 'APPROVED') {
            return { applied: false, reason: 'not_approved' };
        }
        if (proposal.appliedAt) {
            return { applied: false, reason: 'already_applied', proposalId };
        }
        const rec = proposal.recommendationJson;
        const module = rec.module ?? proposal.diagnosisKind;
        const lockKey = opts?.lockKey ?? (0, shared_1.buildOutcomeMutationLockKey)(proposal.missionId, `module:${module}`);
        if (!opts?.lockAlreadyHeld) {
            const locked = await this.acquireMutationLock(organizationId, lockKey, userId ? `api:apply:${userId}` : 'optimize:auto');
            if (!locked) {
                return { applied: false, reason: 'concurrency_lock' };
            }
        }
        try {
            const fresh = await this.prisma.marketingAutopilotOptimizationProposal.findUnique({
                where: { id: proposalId },
            });
            if (!fresh || fresh.status !== 'APPROVED' || fresh.appliedAt) {
                return { applied: false, reason: 'already_applied' };
            }
            // Safe apply within guardrail — pause related assets, no live send/publish
            if (proposal.diagnosisKind === 'TRACKING_ERROR' ||
                proposal.diagnosisKind === 'ADS_INEFFICIENT') {
                await this.prisma.marketingMissionAsset.updateMany({
                    where: {
                        missionId: proposal.missionId,
                        organizationId,
                        module: { in: ['ADS', 'CONTENT'] },
                    },
                    data: { status: 'PAUSED_OPTIMIZATION' },
                });
            }
            if (proposal.diagnosisKind === 'AUTOMATION_ERROR') {
                const assets = await this.prisma.marketingMissionAsset.findMany({
                    where: { missionId: proposal.missionId, organizationId, module: 'AUTOMATION' },
                });
                for (const a of assets) {
                    await this.prisma.automationFlow.updateMany({
                        where: { id: a.entityId, organizationId },
                        data: { isPaused: true },
                    });
                }
            }
            await this.prisma.marketingAutopilotOptimizationProposal.update({
                where: { id: proposalId },
                data: { status: 'APPLIED', appliedAt: new Date() },
            });
            await this.audit.log({
                organizationId,
                userId: userId ?? undefined,
                action: 'AUTOPILOT_OPTIMIZATION_APPLIED',
                entityType: 'MARKETING_OPTIMIZATION_PROPOSAL',
                entityId: proposalId,
                metadata: {
                    missionId: proposal.missionId,
                    diagnosisKind: proposal.diagnosisKind,
                    module,
                    correlationOnly: true,
                },
            });
            return { applied: true, proposalId, module };
        }
        finally {
            if (!opts?.lockAlreadyHeld) {
                await this.releaseMutationLock(organizationId, lockKey);
            }
        }
    }
    async getLoopPublic(organizationId, missionId) {
        const loop = await this.prisma.marketingAutopilotOutcomeLoop.findFirst({
            where: { missionId, organizationId },
        });
        if (!loop)
            return null;
        const proposals = await this.prisma.marketingAutopilotOptimizationProposal.findMany({
            where: { missionId, organizationId },
            orderBy: { createdAt: 'desc' },
            take: 20,
        });
        const stopLossEvents = await this.prisma.marketingAutopilotStopLossEvent.findMany({
            where: { missionId, organizationId },
            orderBy: { createdAt: 'desc' },
            take: 5,
        });
        return {
            ...loop,
            proposals,
            stopLossEvents,
            correlationOnly: true,
            disclaimer: 'Outcome Learning dựa trên tương quan — không dự báo, không khẳng định nhân quả.',
        };
    }
    async listProposals(organizationId, missionId) {
        return this.prisma.marketingAutopilotOptimizationProposal.findMany({
            where: { organizationId, missionId },
            orderBy: { createdAt: 'desc' },
        });
    }
    /** Worker/cron: tick active loops at MONITOR step. */
    async tickActiveLoops(organizationId) {
        const loops = await this.prisma.marketingAutopilotOutcomeLoop.findMany({
            where: {
                status: { in: ['ACTIVE', 'PAUSED_STOP_LOSS'] },
                currentStep: { in: ['MONITOR', 'DIAGNOSE', 'RECOMMEND'] },
                ...(organizationId ? { organizationId } : {}),
            },
            take: 20,
        });
        const results = [];
        for (const loop of loops) {
            try {
                if (loop.currentStep === 'MONITOR') {
                    results.push(await this.runMonitor(loop.organizationId, loop.missionId));
                }
                else if (loop.currentStep === 'DIAGNOSE') {
                    results.push(await this.runDiagnose(loop.organizationId, loop.missionId));
                }
                else if (loop.currentStep === 'RECOMMEND') {
                    results.push(await this.runRecommend(loop.organizationId, loop.missionId));
                }
            }
            catch (err) {
                this.logger.warn(`Loop tick ${loop.missionId} failed: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        return { processed: results.length };
    }
};
exports.MarketingAutopilotOutcomeLoopService = MarketingAutopilotOutcomeLoopService;
exports.MarketingAutopilotOutcomeLoopService = MarketingAutopilotOutcomeLoopService = MarketingAutopilotOutcomeLoopService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        marketing_context_engine_service_1.MarketingContextEngineService,
        marketing_autopilot_outcome_learning_service_1.MarketingAutopilotOutcomeLearningService])
], MarketingAutopilotOutcomeLoopService);
