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
exports.MarketingAutopilotCommandCenterService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const shared_1 = require("@marketingspa/shared");
const marketing_context_engine_service_1 = require("../context/marketing-context-engine.service");
const marketing_autopilot_guardrail_service_1 = require("../marketing-autopilot-guardrail.service");
const prisma_service_1 = require("../../prisma/prisma.service");
let MarketingAutopilotCommandCenterService = class MarketingAutopilotCommandCenterService {
    contextEngine;
    guardrailService;
    prisma;
    constructor(contextEngine, guardrailService, prisma) {
        this.contextEngine = contextEngine;
        this.guardrailService = guardrailService;
        this.prisma = prisma;
    }
    async getCommandCenter(organizationId, user) {
        const { snapshot, fromCache, snapshotId } = await this.contextEngine.getContext(organizationId, { user });
        const guardrail = await this.guardrailService.getOrCreate(organizationId);
        const effectiveMode = this.guardrailService.resolveEffectiveMode(guardrail);
        const metrics = snapshot.metrics;
        const input = {
            organizationId: snapshot.organizationId,
            generatedAt: snapshot.generatedAt,
            timeRange: snapshot.timeRange,
            engineVersion: snapshot.engineVersion,
            fromCache,
            metrics: {
                leads: metrics.leads,
                bookings: metrics.bookings,
                revenue: metrics.revenue,
                ads: metrics.ads,
                customers: metrics.customers,
                email: metrics.email,
                zalo: metrics.zalo,
                automation: metrics.automation,
                funnel: metrics.funnel,
                conversion: metrics.conversion,
                businessEvents: metrics.businessEvents,
            },
            sources: snapshot.sources,
            bottlenecks: snapshot.bottlenecks,
            opportunities: snapshot.opportunities,
            insights: snapshot.insights,
        };
        const { kpis, requiredCoverage } = (0, shared_1.buildCommandCenterBoard)(input);
        const nextBestActions = (0, shared_1.buildCommandCenterActions)(input);
        const noFakeMetrics = (0, shared_1.assertCommandCenterNoFakeMetrics)({ kpis, actions: nextBestActions });
        const minimumData = (0, shared_1.commandCenterHasMinimumContext)(snapshot.sources);
        const present = snapshot.sources.map((s) => s.domain);
        const coveragePass = requiredCoverage.every((d) => present.includes(d));
        const [pendingApprovals, runningMissions, recentExecutions, pendingOptimizations] = await Promise.all([
            this.prisma.marketingMission.count({
                where: { organizationId, status: 'READY_FOR_APPROVAL' },
            }),
            this.prisma.marketingMission.count({
                where: {
                    organizationId,
                    status: { in: ['QUEUED', 'RUNNING', 'APPROVED'] },
                },
            }),
            this.prisma.marketingAutopilotExecutionLog.findMany({
                where: { organizationId },
                orderBy: { createdAt: 'desc' },
                take: 8,
                select: {
                    id: true,
                    missionId: true,
                    module: true,
                    entityType: true,
                    entityId: true,
                    action: true,
                    result: true,
                    message: true,
                    createdAt: true,
                },
            }),
            this.prisma.marketingAutopilotOptimizationProposal.count({
                where: { organizationId, status: 'PENDING_APPROVAL' },
            }),
        ]);
        const recentErrors = recentExecutions.filter((l) => l.result === 'FAILED' || l.result.startsWith('BLOCKED_'));
        const result = {
            version: shared_1.COMMAND_CENTER_VERSION,
            snapshotId,
            fromCache,
            generatedAt: snapshot.generatedAt,
            timeRange: snapshot.timeRange,
            engineVersion: snapshot.engineVersion,
            lifecycle: shared_1.AUTOPILOT_ACTION_LIFECYCLE,
            kpis,
            nextBestActions,
            sources: snapshot.sources,
            coverage: {
                required: requiredCoverage,
                present,
                okCount: snapshot.sources.filter((s) => s.status === 'OK').length,
                minimumData,
                pass: coveragePass,
            },
            noFakeMetrics,
            safety: {
                draftOnly: effectiveMode === 'RECOMMEND_ONLY',
                approvalRequired: effectiveMode !== 'FULL_AUTOPILOT',
                llmInventedMetrics: false,
                facebookReadOnly: !guardrail.allowFacebookPublish,
            },
            operational: {
                autopilotMode: guardrail.autopilotMode,
                effectiveMode,
                fullAutopilotEnabled: guardrail.fullAutopilotEnabled,
                fullAutopilotActive: (0, shared_1.isFullAutopilotActive)(guardrail),
                emergencyStop: guardrail.emergencyStop,
                cooldownMinutes: guardrail.cooldownMinutes,
                pendingMissionApprovals: pendingApprovals,
                runningMissions,
                pendingOptimizationApprovals: pendingOptimizations,
                recentExecutions,
                recentErrors,
                liveChannels: {
                    email: guardrail.allowEmailSend,
                    googleAds: guardrail.allowGoogleAdsPublish,
                    automation: guardrail.allowAutomationActivation,
                    zalo: guardrail.allowZaloSend,
                    facebook: guardrail.allowFacebookPublish,
                },
            },
        };
        void (0, database_1.recordActivationEvent)(this.prisma, {
            organizationId,
            eventType: database_1.ACTIVATION_EVENT.FIRST_AUTOPILOT_ANALYSIS,
            source: 'autopilot.command_center',
        }).catch(() => undefined);
        return result;
    }
};
exports.MarketingAutopilotCommandCenterService = MarketingAutopilotCommandCenterService;
exports.MarketingAutopilotCommandCenterService = MarketingAutopilotCommandCenterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [marketing_context_engine_service_1.MarketingContextEngineService,
        marketing_autopilot_guardrail_service_1.MarketingAutopilotGuardrailService,
        prisma_service_1.PrismaService])
], MarketingAutopilotCommandCenterService);
