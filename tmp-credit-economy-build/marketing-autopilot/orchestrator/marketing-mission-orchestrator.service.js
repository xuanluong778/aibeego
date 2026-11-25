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
var MarketingMissionOrchestratorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketingMissionOrchestratorService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../../prisma/prisma.service");
const queue_enqueue_service_1 = require("../../common/services/queue-enqueue.service");
const queue_constants_1 = require("../../queue/queue.constants");
const marketing_autopilot_draft_adapter_1 = require("../marketing-autopilot-draft.adapter");
const marketing_context_engine_service_1 = require("../context/marketing-context-engine.service");
const marketing_autopilot_executor_service_1 = require("./marketing-autopilot-executor.service");
const marketing_autopilot_execution_engine_service_1 = require("./marketing-autopilot-execution-engine.service");
const marketing_autopilot_outcome_loop_service_1 = require("../outcome/marketing-autopilot-outcome-loop.service");
const mission_pipeline_runner_1 = require("./mission-pipeline.runner");
let MarketingMissionOrchestratorService = MarketingMissionOrchestratorService_1 = class MarketingMissionOrchestratorService {
    prisma;
    enqueue;
    missionQueue;
    draftAdapter;
    contextEngine;
    executor;
    executionEngine;
    outcomeLoop;
    logger = new common_1.Logger(MarketingMissionOrchestratorService_1.name);
    constructor(prisma, enqueue, missionQueue, draftAdapter, contextEngine, executor, executionEngine, outcomeLoop) {
        this.prisma = prisma;
        this.enqueue = enqueue;
        this.missionQueue = missionQueue;
        this.draftAdapter = draftAdapter;
        this.contextEngine = contextEngine;
        this.executor = executor;
        this.executionEngine = executionEngine;
        this.outcomeLoop = outcomeLoop;
    }
    /**
     * Additive hook after classic create(): open mission + enqueue BullMQ (+ inline kick).
     * Does not change create() response contract beyond optional `mission` field.
     */
    async startMissionAfterCreate(user, project, opts) {
        const idempotencyKey = (0, shared_1.resolveMissionIdempotencyKey)({
            clientKey: opts?.idempotencyKey,
            projectId: project.id,
        });
        const existing = await this.prisma.marketingMission.findFirst({
            where: { organizationId: user.organizationId, idempotencyKey },
        });
        if (existing) {
            this.kickMissionPipeline(existing.id, user.organizationId, project.id);
            return this.toPublicMission(existing);
        }
        const mission = await this.prisma.marketingMission.create({
            data: {
                organizationId: user.organizationId,
                createdById: user.id,
                projectId: project.id,
                idempotencyKey,
                status: 'DRAFT',
                currentStep: 'BRIEF',
                progressPercent: 0,
                stepsJson: (0, shared_1.emptyMissionStepsMap)(),
            },
        });
        await this.prisma.marketingAutopilotProject.update({
            where: { id: project.id },
            data: { status: 'ORCHESTRATING' },
        });
        // Inline first — BullMQ jobId must not contain ":"; enqueue must never block the pipeline.
        this.kickMissionPipeline(mission.id, user.organizationId, project.id);
        return this.toPublicMission(mission);
    }
    /** BullMQ rejects custom ids that contain ":". */
    missionJobId(missionId) {
        return `marketing-mission-${missionId}`;
    }
    kickMissionPipeline(missionId, organizationId, projectId) {
        void this.processMission(missionId).catch((err) => {
            this.logger.warn(`Inline mission ${missionId} failed (worker may retry): ${err instanceof Error ? err.message : String(err)}`);
        });
        void this.enqueueMission(missionId, organizationId, projectId).catch((err) => {
            this.logger.warn(`Enqueue mission ${missionId} failed: ${err instanceof Error ? err.message : String(err)}`);
        });
    }
    async enqueueMission(missionId, organizationId, projectId) {
        await this.enqueue.add(this.missionQueue, 'run-marketing-mission', { missionId, organizationId, projectId }, {
            jobId: this.missionJobId(missionId),
            attempts: 5,
            backoff: { type: 'exponential', delay: 3000 },
            removeOnComplete: 100,
            removeOnFail: 200,
        });
    }
    async processMission(missionId) {
        return (0, mission_pipeline_runner_1.runMarketingMissionPipeline)(missionId, {
            prisma: this.prisma,
            logger: this.logger,
            getContext: async (organizationId, user) => {
                const res = await this.contextEngine.getContext(organizationId, { user });
                return { snapshotId: res.snapshotId };
            },
            createDraft: (type, user, plan, project) => this.draftAdapter.createDraft(type, user, plan, project),
            executeAssets: (input) => this.executor.executeMissionAssets(input),
        });
    }
    async getLatestMissionForProject(organizationId, projectId) {
        const mission = await this.prisma.marketingMission.findFirst({
            where: { organizationId, projectId },
            orderBy: { createdAt: 'desc' },
            include: {
                drafts: {
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                },
                assets: {
                    orderBy: { createdAt: 'desc' },
                    take: 50,
                },
                approvals: {
                    orderBy: { version: 'desc' },
                    take: 1,
                },
            },
        });
        if (!mission)
            return null;
        return this.toPublicMissionDetailed(mission);
    }
    async getMission(organizationId, missionId) {
        const mission = await this.prisma.marketingMission.findFirst({
            where: { id: missionId, organizationId },
            include: {
                drafts: { orderBy: { createdAt: 'desc' }, take: 20 },
                assets: { orderBy: { createdAt: 'desc' }, take: 50 },
                approvals: { orderBy: { version: 'desc' }, take: 1 },
            },
        });
        if (!mission) {
            throw new common_1.NotFoundException('Không tìm thấy Marketing Mission');
        }
        return this.toPublicMissionDetailed(mission);
    }
    /** Resume failed mission (additive). */
    async resumeMission(user, missionId) {
        const mission = await this.prisma.marketingMission.findFirst({
            where: { id: missionId, organizationId: user.organizationId },
        });
        if (!mission) {
            throw new common_1.NotFoundException('Không tìm thấy Marketing Mission');
        }
        if (mission.status === 'READY_FOR_APPROVAL' ||
            mission.status === 'APPROVED' ||
            mission.status === 'QUEUED' ||
            (mission.status === 'RUNNING' && mission.readyAt)) {
            return this.getMission(user.organizationId, mission.id);
        }
        await this.prisma.marketingMission.update({
            where: { id: mission.id },
            data: { status: 'DRAFT', errorJson: database_1.Prisma.DbNull },
        });
        this.kickMissionPipeline(mission.id, user.organizationId, mission.projectId);
        return this.getMission(user.organizationId, mission.id);
    }
    /**
     * Approval-first: one-click approve all drafts — immutable snapshot + QUEUED → RUNNING.
     * Does not require per-draft approval. Does not live-publish Facebook/Ads.
     */
    async approveAndRun(user, missionId) {
        const mission = await this.prisma.marketingMission.findFirst({
            where: { id: missionId, organizationId: user.organizationId },
            include: {
                assets: { orderBy: { createdAt: 'asc' } },
                approvals: { orderBy: { version: 'desc' }, take: 1 },
            },
        });
        if (!mission) {
            throw new common_1.NotFoundException('Không tìm thấy Marketing Mission');
        }
        // Idempotent: already approved → return latest
        if (mission.status === 'APPROVED' ||
            mission.status === 'QUEUED' ||
            (mission.status === 'RUNNING' && mission.readyAt)) {
            return this.getMission(user.organizationId, mission.id);
        }
        if (mission.status !== 'READY_FOR_APPROVAL') {
            throw new common_1.BadRequestException(`Mission chưa READY_FOR_APPROVAL (hiện: ${mission.status}). Đợi AI hoàn tất trước khi duyệt.`);
        }
        const analysis = await this.prisma.marketingAutopilotAnalysis.findFirst({
            where: { projectId: mission.projectId, organizationId: user.organizationId },
            orderBy: { createdAt: 'desc' },
        });
        const analysisJson = (analysis?.recommendationJson ?? {});
        const plan = analysisJson.plan ?? analysisJson;
        const nextVersion = (mission.approvalVersion ?? 0) + 1;
        const approvedAt = new Date();
        const snapshot = (0, shared_1.buildImmutableApprovalSnapshot)({
            version: nextVersion,
            missionId: mission.id,
            projectId: mission.projectId,
            organizationId: user.organizationId,
            plan,
            analysis: analysisJson,
            blueprint: mission.blueprintJson,
            assets: mission.assets.map((a) => ({
                module: a.module,
                entityType: a.entityType,
                entityId: a.entityId,
                status: a.status,
                adapter: a.adapter,
            })),
            approver: {
                id: user.id,
                email: user.email,
                name: user.name,
            },
            approvedAt: approvedAt.toISOString(),
        });
        let approval;
        try {
            approval = await this.prisma.$transaction(async (tx) => {
                // Optimistic concurrency: only one approver wins READY_FOR_APPROVAL → APPROVED
                const claimed = await tx.marketingMission.updateMany({
                    where: {
                        id: mission.id,
                        organizationId: user.organizationId,
                        status: 'READY_FOR_APPROVAL',
                    },
                    data: {
                        status: 'APPROVED',
                        approvedAt,
                        approvalVersion: nextVersion,
                    },
                });
                if (claimed.count !== 1) {
                    throw new common_1.BadRequestException('Mission đã được duyệt bởi phiên khác hoặc không còn READY_FOR_APPROVAL.');
                }
                const row = await tx.marketingMissionApproval.create({
                    data: {
                        organizationId: user.organizationId,
                        missionId: mission.id,
                        projectId: mission.projectId,
                        version: nextVersion,
                        approvedById: user.id,
                        approvedAt,
                        snapshotJson: snapshot,
                        runStatus: 'APPROVED',
                    },
                });
                await tx.marketingAutopilotProject.update({
                    where: { id: mission.projectId },
                    data: { status: 'APPROVED' },
                });
                return row;
            });
        }
        catch (err) {
            // Unique (missionId, version) race → treat as already approved
            const code = err?.code;
            if (code === 'P2002') {
                return this.getMission(user.organizationId, mission.id);
            }
            if (err instanceof common_1.BadRequestException) {
                // Lost race after another approver claimed — return latest mission state
                const latest = await this.getMission(user.organizationId, mission.id);
                if (latest.status === 'APPROVED' ||
                    latest.status === 'QUEUED' ||
                    latest.status === 'RUNNING') {
                    return latest;
                }
                throw err;
            }
            throw err;
        }
        // APPROVED → QUEUED → RUNNING (soft run; no live Facebook/Ads publish)
        void this.runApprovedMission(mission.id, approval.id).catch((err) => {
            this.logger.warn(`Approved run ${mission.id} failed: ${err instanceof Error ? err.message : String(err)}`);
        });
        return this.getMission(user.organizationId, mission.id);
    }
    /** Post-approval runner: QUEUED → RUNNING → Execution Engine (gated). */
    async runApprovedMission(missionId, approvalId) {
        const mission = await this.prisma.marketingMission.findFirst({
            where: { id: missionId },
        });
        if (!mission)
            return;
        await this.prisma.marketingMission.update({
            where: { id: missionId },
            data: { status: 'QUEUED' },
        });
        await this.prisma.marketingMissionApproval.update({
            where: { id: approvalId },
            data: { runStatus: 'QUEUED' },
        });
        await this.prisma.marketingAutopilotProject.update({
            where: { id: mission.projectId },
            data: { status: 'QUEUED' },
        });
        await this.prisma.marketingMission.update({
            where: { id: missionId },
            data: { status: 'RUNNING' },
        });
        await this.prisma.marketingMissionApproval.update({
            where: { id: approvalId },
            data: { runStatus: 'RUNNING', startedAt: new Date() },
        });
        await this.prisma.marketingAutopilotProject.update({
            where: { id: mission.projectId },
            data: { status: 'RUNNING' },
        });
        // Mark registry assets as APPROVED before execution gates
        await this.prisma.marketingMissionAsset.updateMany({
            where: { missionId, status: 'DRAFT' },
            data: { status: 'APPROVED' },
        });
        const user = {
            id: mission.createdById,
            organizationId: mission.organizationId,
            email: '',
            name: '',
            role: 'OWNER',
        };
        let execResult = null;
        try {
            execResult = await this.executionEngine.executeApprovedMission({
                user,
                missionId,
                approvalId,
            });
            this.logger.log(`[execution] mission ${missionId} executed=${execResult.executed} blocked=${execResult.blocked} failed=${execResult.failed} skipped=${execResult.skipped}`);
        }
        catch (err) {
            this.logger.warn(`[execution] mission ${missionId} engine error (mission continues): ${err instanceof Error ? err.message : String(err)}`);
        }
        await this.prisma.marketingMissionApproval.update({
            where: { id: approvalId },
            data: {
                runStatus: 'COMPLETED',
                completedAt: new Date(),
            },
        });
        this.logger.log(`[approval] mission ${missionId} RUNNING+EXECUTED — snapshot immutable; gated outbound`);
        void this.outcomeLoop
            .startMissionLoop({
            organizationId: mission.organizationId,
            missionId,
            projectId: mission.projectId,
            approvalId,
        })
            .catch((err) => {
            this.logger.warn(`[outcome-loop] start failed for ${missionId}: ${err instanceof Error ? err.message : String(err)}`);
        });
        return execResult;
    }
    /**
     * Public enricher for list/detail — pass analysisJson when already loaded (findAll).
     */
    async toPublicMissionDetailed(mission, analysisJsonHint) {
        const base = this.toPublicMission(mission);
        let analysisJson = analysisJsonHint ?? null;
        if (!analysisJson) {
            const analysis = await this.prisma.marketingAutopilotAnalysis.findFirst({
                where: {
                    projectId: mission.projectId,
                    organizationId: mission.organizationId,
                },
                orderBy: { createdAt: 'desc' },
            });
            analysisJson = (analysis?.recommendationJson ?? {});
        }
        const plan = analysisJson.plan ?? analysisJson;
        const latestApproval = mission.approvals?.[0] ?? null;
        const approvalSummary = (0, shared_1.buildMissionApprovalSummary)({
            status: mission.status,
            currentStep: mission.currentStep,
            currentStepLabel: base.currentStepLabel,
            progressPercent: mission.progressPercent,
            plan,
            analysis: analysisJson,
            blueprint: mission.blueprintJson,
            assets: mission.assets ?? [],
            approval: latestApproval
                ? {
                    id: latestApproval.id,
                    version: latestApproval.version,
                    approvedAt: latestApproval.approvedAt,
                    approvedById: latestApproval.approvedById,
                    runStatus: latestApproval.runStatus,
                }
                : null,
        });
        return {
            ...base,
            approvedAt: mission.approvedAt ?? null,
            approvalVersion: mission.approvalVersion ?? 0,
            approval: latestApproval
                ? {
                    id: latestApproval.id,
                    version: latestApproval.version,
                    approvedAt: latestApproval.approvedAt,
                    approvedById: latestApproval.approvedById,
                    runStatus: latestApproval.runStatus,
                    snapshot: latestApproval.snapshotJson ?? null,
                }
                : null,
            approvalSummary,
            planPreview: plan,
        };
    }
    toPublicMission(mission) {
        const step = mission.currentStep;
        return {
            id: mission.id,
            organizationId: mission.organizationId,
            createdById: mission.createdById,
            projectId: mission.projectId,
            idempotencyKey: mission.idempotencyKey,
            status: mission.status,
            currentStep: mission.currentStep,
            currentStepLabel: shared_1.MARKETING_MISSION_STEP_LABELS[step] ?? mission.currentStep,
            progressPercent: mission.progressPercent,
            steps: mission.stepsJson,
            blueprint: mission.blueprintJson,
            error: mission.errorJson ?? null,
            attemptCount: mission.attemptCount ?? 0,
            readyAt: mission.readyAt ?? null,
            createdAt: mission.createdAt,
            updatedAt: mission.updatedAt,
            drafts: mission.drafts ?? [],
            assets: mission.assets ?? [],
            orchestrator: 'marketing-autopilot-a-z',
            draftOnly: true,
            liveActionsEnabled: false,
        };
    }
};
exports.MarketingMissionOrchestratorService = MarketingMissionOrchestratorService;
exports.MarketingMissionOrchestratorService = MarketingMissionOrchestratorService = MarketingMissionOrchestratorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(queue_constants_1.MARKETING_AUTOPILOT_MISSION_QUEUE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        queue_enqueue_service_1.QueueEnqueueService, Function, marketing_autopilot_draft_adapter_1.MarketingAutopilotDraftAdapter,
        marketing_context_engine_service_1.MarketingContextEngineService,
        marketing_autopilot_executor_service_1.MarketingAutopilotExecutorService,
        marketing_autopilot_execution_engine_service_1.MarketingAutopilotExecutionEngineService,
        marketing_autopilot_outcome_loop_service_1.MarketingAutopilotOutcomeLoopService])
], MarketingMissionOrchestratorService);
