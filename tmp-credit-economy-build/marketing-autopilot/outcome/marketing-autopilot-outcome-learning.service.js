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
var MarketingAutopilotOutcomeLearningService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketingAutopilotOutcomeLearningService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../../prisma/prisma.service");
const marketing_context_engine_service_1 = require("../context/marketing-context-engine.service");
let MarketingAutopilotOutcomeLearningService = MarketingAutopilotOutcomeLearningService_1 = class MarketingAutopilotOutcomeLearningService {
    prisma;
    contextEngine;
    logger = new common_1.Logger(MarketingAutopilotOutcomeLearningService_1.name);
    constructor(prisma, contextEngine) {
        this.prisma = prisma;
        this.contextEngine = contextEngine;
    }
    async recordStrategyBaseline(input) {
        const before = (0, shared_1.extractOutcomeMetrics)(input.snapshot.metrics);
        const channels = input.analysis.suggestedChannels ?? [];
        const offer = {
            productName: input.productName,
            productPrice: input.analysis.plan?.offer?.productPrice ?? null,
            valueProps: input.analysis.plan?.offer?.valueProps ?? [],
            valueProposition: input.analysis.plan?.valueProposition ?? null,
        };
        const track = await this.prisma.marketingAutopilotOutcomeTrack.create({
            data: {
                organizationId: input.organizationId,
                createdById: input.createdById,
                projectId: input.projectId,
                analysisId: input.analysisId ?? null,
                actionType: 'STRATEGY',
                status: 'OPEN',
                recommendationJson: {
                    summary: input.analysis.summary,
                    nextBestActions: input.analysis.nextBestActions ?? [],
                    budgetSplit: input.analysis.budgetSplit ?? [],
                    score: input.analysis.score,
                },
                beforeMetricsJson: before,
                beforeSnapshotId: input.snapshotId ?? null,
                baselineAt: new Date(),
                productName: input.productName,
                customerProfile: input.customerProfile,
                targetArea: input.targetArea,
                primaryGoal: input.primaryGoal,
                channelsJson: channels,
                offerJson: offer,
            },
        });
        await this.scheduleEvaluations(track.id, input.organizationId, track.baselineAt);
        return track;
    }
    async recordDraftBaselines(input) {
        const before = (0, shared_1.extractOutcomeMetrics)(input.snapshot.metrics);
        const channels = input.analysis.suggestedChannels ?? [];
        const offer = {
            productName: input.productName,
            productPrice: input.analysis.plan?.offer?.productPrice ?? null,
            valueProps: input.analysis.plan?.offer?.valueProps ?? [],
        };
        const created = [];
        for (const draft of input.drafts) {
            const recommendationId = draft.recommendationId ?? `nba:${draft.type}`;
            const track = await this.prisma.marketingAutopilotOutcomeTrack.create({
                data: {
                    organizationId: input.organizationId,
                    createdById: input.createdById,
                    projectId: input.projectId,
                    missionId: input.missionId ?? null,
                    analysisId: input.analysisId ?? null,
                    draftRunId: input.draftRunId,
                    draftId: draft.id,
                    recommendationId,
                    actionType: 'DRAFT',
                    draftType: draft.type,
                    status: 'OPEN',
                    recommendationJson: {
                        summary: input.analysis.summary,
                        draftType: draft.type,
                        recommendationId,
                        nextBestActions: (input.analysis.nextBestActions ?? []).filter((a) => (a.recommendedDraft ?? a.type) === draft.type),
                    },
                    beforeMetricsJson: before,
                    beforeSnapshotId: input.snapshotId ?? null,
                    baselineAt: new Date(),
                    productName: input.productName,
                    customerProfile: input.customerProfile,
                    targetArea: input.targetArea,
                    primaryGoal: input.primaryGoal,
                    channelsJson: channels,
                    offerJson: offer,
                },
            });
            await this.scheduleEvaluations(track.id, input.organizationId, track.baselineAt);
            created.push(track);
        }
        return created;
    }
    async scheduleEvaluations(trackId, organizationId, baselineAt) {
        const rows = shared_1.OUTCOME_LEARNING_HORIZONS.map((days) => ({
            organizationId,
            trackId,
            horizonDays: days,
            dueAt: new Date(baselineAt.getTime() + days * 24 * 60 * 60 * 1000),
            status: 'PENDING',
        }));
        await this.prisma.marketingAutopilotOutcomeEvaluation.createMany({ data: rows });
    }
    async evaluateDue(organizationId, opts) {
        const now = opts?.now ?? new Date();
        const where = {
            status: 'PENDING',
            ...(organizationId ? { organizationId } : {}),
            ...(opts?.forceTrackId
                ? { trackId: opts.forceTrackId }
                : { dueAt: { lte: now } }),
        };
        const due = await this.prisma.marketingAutopilotOutcomeEvaluation.findMany({
            where,
            include: { track: true },
            orderBy: { dueAt: 'asc' },
            take: 100,
        });
        const results = [];
        for (const evaluation of due) {
            results.push(await this.evaluateOne(evaluation.id, { now }));
        }
        return results;
    }
    async evaluateOne(evaluationId, opts) {
        const evaluation = await this.prisma.marketingAutopilotOutcomeEvaluation.findUnique({
            where: { id: evaluationId },
            include: { track: true },
        });
        if (!evaluation)
            throw new common_1.NotFoundException('Outcome evaluation not found');
        const orgId = evaluation.organizationId;
        let after = opts?.afterMetrics;
        let snapshotId = opts?.snapshotId ?? null;
        if (!after) {
            const ctx = await this.contextEngine.getContext(orgId);
            after = (0, shared_1.extractOutcomeMetrics)(ctx.snapshot.metrics);
            snapshotId = ctx.snapshotId ?? null;
        }
        const before = evaluation.track.beforeMetricsJson;
        const outcome = (0, shared_1.computeOutcome)(before, after);
        const updated = await this.prisma.marketingAutopilotOutcomeEvaluation.update({
            where: { id: evaluation.id },
            data: {
                status: 'DONE',
                evaluatedAt: opts?.now ?? new Date(),
                afterMetricsJson: after,
                afterSnapshotId: snapshotId,
                outcomeJson: outcome,
            },
            include: { track: true },
        });
        await this.prisma.marketingAutopilotOutcomeTrack.update({
            where: { id: evaluation.trackId },
            data: { status: evaluation.horizonDays >= 30 ? 'COMPLETED' : 'EVALUATING' },
        });
        if (evaluation.horizonDays >= 7) {
            await this.upsertLearningsFromOutcome(updated.track, outcome, after, evaluation.horizonDays);
        }
        return updated;
    }
    /** Force-evaluate a track horizon (tests / manual backfill). Tenant-scoped. */
    async forceEvaluateHorizon(organizationId, trackId, horizonDays, afterMetrics) {
        const track = await this.prisma.marketingAutopilotOutcomeTrack.findFirst({
            where: { id: trackId, organizationId },
        });
        if (!track)
            throw new common_1.NotFoundException('Outcome track not found for organization');
        const evaluation = await this.prisma.marketingAutopilotOutcomeEvaluation.findFirst({
            where: { trackId, organizationId, horizonDays },
        });
        if (!evaluation)
            throw new common_1.NotFoundException('Outcome evaluation horizon not found');
        return this.evaluateOne(evaluation.id, { afterMetrics, now: new Date() });
    }
    async upsertLearningsFromOutcome(track, outcome, after, horizonDays) {
        const channels = Array.isArray(track.channelsJson)
            ? track.channelsJson
            : [];
        const offer = (track.offerJson ?? {});
        const items = [];
        if (track.productName.trim()) {
            items.push({
                category: 'OFFER',
                key: (0, shared_1.normalizeLearningKey)(`offer:${track.productName}`),
                title: `Offer: ${track.productName}`,
                summary: outcome.verdict === 'IMPROVED'
                    ? `Offer "${track.productName}" đi kèm outcome cải thiện sau ${horizonDays} ngày (tương quan).`
                    : outcome.verdict === 'DECLINED'
                        ? `Offer "${track.productName}" đi kèm outcome kém hơn sau ${horizonDays} ngày (tương quan).`
                        : `Offer "${track.productName}" có outcome hỗn hợp/thiếu dữ liệu sau ${horizonDays} ngày.`,
                confidence: outcome.verdict === 'INSUFFICIENT_DATA' ? 'INSUFFICIENT_DATA' : 'LOW',
                evidence: { verdict: outcome.verdict, horizonDays, offer },
            });
        }
        if (track.customerProfile.trim()) {
            items.push({
                category: 'SEGMENT',
                key: (0, shared_1.normalizeLearningKey)(`segment:${track.customerProfile}`),
                title: `Segment: ${track.customerProfile.slice(0, 80)}`,
                summary: `Segment theo profile "${track.customerProfile.slice(0, 120)}" — verdict ${outcome.verdict} @${horizonDays}d (correlation only).`,
                confidence: outcome.verdict === 'INSUFFICIENT_DATA' ? 'INSUFFICIENT_DATA' : 'LOW',
                evidence: {
                    verdict: outcome.verdict,
                    targetArea: track.targetArea,
                    customerProfile: track.customerProfile,
                },
            });
        }
        for (const ch of channels.slice(0, 5)) {
            items.push({
                category: 'CONTENT_CHANNEL',
                key: (0, shared_1.normalizeLearningKey)(`channel:${ch}`),
                title: `Channel: ${ch}`,
                summary: `Kênh "${ch}" xuất hiện trong recommendation với verdict ${outcome.verdict} @${horizonDays}d.`,
                confidence: 'LOW',
                evidence: { channel: ch, verdict: outcome.verdict, horizonDays },
            });
        }
        if (after.cpl != null || after.conversionRate != null) {
            items.push({
                category: 'METRIC_BASELINE',
                key: 'metric-baseline-org',
                title: 'CPL / booking rate lịch sử',
                summary: `CPL=${after.cpl ?? 'n/a'}, conversion=${after.conversionRate ?? 'n/a'}%, bookings=${after.bookings ?? 'n/a'} (snapshot sau ${horizonDays}d).`,
                confidence: after.cpl != null || after.conversionRate != null ? 'MEDIUM' : 'INSUFFICIENT_DATA',
                evidence: {
                    cpl: after.cpl,
                    cpa: after.cpa,
                    conversionRate: after.conversionRate,
                    roas: after.roas,
                    bookings: after.bookings,
                    leads: after.leads,
                },
            });
        }
        const tacticLabel = track.actionType === 'DRAFT' && track.draftType
            ? `Draft ${track.draftType}`
            : `Strategy ${track.primaryGoal || 'plan'}`;
        if (outcome.verdict === 'IMPROVED') {
            items.push({
                category: 'TACTIC_SUCCESS',
                key: (0, shared_1.normalizeLearningKey)(`success:${tacticLabel}`),
                title: `Chiến thuật hiệu quả (tương quan): ${tacticLabel}`,
                summary: `${tacticLabel} đi kèm cải thiện metric sau ${horizonDays} ngày. Không khẳng định nhân quả.`,
                confidence: 'LOW',
                evidence: { verdict: outcome.verdict, deltas: outcome.deltas, horizonDays },
            });
        }
        else if (outcome.verdict === 'DECLINED') {
            items.push({
                category: 'TACTIC_FAILED',
                key: (0, shared_1.normalizeLearningKey)(`failed:${tacticLabel}`),
                title: `Chiến thuật kém hiệu quả (tương quan): ${tacticLabel}`,
                summary: `${tacticLabel} đi kèm metric xấu đi sau ${horizonDays} ngày. Cần kiểm chứng — correlation ≠ causation.`,
                confidence: 'LOW',
                evidence: { verdict: outcome.verdict, deltas: outcome.deltas, horizonDays },
            });
        }
        for (const item of items) {
            const existing = await this.prisma.marketingAutopilotBusinessLearning.findUnique({
                where: {
                    organizationId_category_key: {
                        organizationId: track.organizationId,
                        category: item.category,
                        key: item.key,
                    },
                },
                select: { sourceTrackIds: true, sampleSize: true },
            });
            const prev = Array.isArray(existing?.sourceTrackIds)
                ? existing.sourceTrackIds
                : [];
            const sourceTrackIds = [...new Set([...prev, track.id])].slice(-20);
            await this.prisma.marketingAutopilotBusinessLearning.upsert({
                where: {
                    organizationId_category_key: {
                        organizationId: track.organizationId,
                        category: item.category,
                        key: item.key,
                    },
                },
                create: {
                    organizationId: track.organizationId,
                    category: item.category,
                    key: item.key,
                    title: item.title,
                    summary: item.summary,
                    evidenceJson: item.evidence,
                    confidence: item.confidence,
                    sampleSize: 1,
                    correlationOnly: true,
                    sourceTrackIds: sourceTrackIds,
                    isActive: true,
                    lastObservedAt: new Date(),
                },
                update: {
                    title: item.title,
                    summary: item.summary,
                    evidenceJson: item.evidence,
                    confidence: item.confidence,
                    sampleSize: (existing?.sampleSize ?? 0) + 1,
                    correlationOnly: true,
                    lastObservedAt: new Date(),
                    isActive: true,
                    sourceTrackIds: sourceTrackIds,
                },
            });
        }
    }
    async getBusinessLearningsForPlanner(organizationId, limit = 20) {
        const rows = await this.prisma.marketingAutopilotBusinessLearning.findMany({
            where: { organizationId, isActive: true },
            orderBy: [{ lastObservedAt: 'desc' }, { sampleSize: 'desc' }],
            take: limit,
        });
        const items = rows.map((r) => ({
            category: r.category,
            key: r.key,
            title: r.title,
            summary: r.summary,
            confidence: r.confidence,
            sampleSize: r.sampleSize,
            correlationOnly: true,
            evidence: (r.evidenceJson ?? {}),
        }));
        return (0, shared_1.buildPlannerBusinessLearningsPayload)(items);
    }
    async listTracksForOrg(organizationId, projectId) {
        return this.prisma.marketingAutopilotOutcomeTrack.findMany({
            where: {
                organizationId,
                ...(projectId ? { projectId } : {}),
            },
            include: { evaluations: { orderBy: { horizonDays: 'asc' } } },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    }
    /** Tenant isolation helper for tests/API. */
    async assertTrackBelongsToOrg(trackId, organizationId) {
        const track = await this.prisma.marketingAutopilotOutcomeTrack.findFirst({
            where: { id: trackId, organizationId },
        });
        if (!track)
            throw new common_1.NotFoundException('Outcome track not found');
        return track;
    }
    async getLearningsForUser(user) {
        return this.getBusinessLearningsForPlanner(user.organizationId);
    }
};
exports.MarketingAutopilotOutcomeLearningService = MarketingAutopilotOutcomeLearningService;
exports.MarketingAutopilotOutcomeLearningService = MarketingAutopilotOutcomeLearningService = MarketingAutopilotOutcomeLearningService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        marketing_context_engine_service_1.MarketingContextEngineService])
], MarketingAutopilotOutcomeLearningService);
