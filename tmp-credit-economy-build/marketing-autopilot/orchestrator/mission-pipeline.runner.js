"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMarketingMissionPipeline = runMarketingMissionPipeline;
/**
 * Marketing Mission pipeline runner (A→Z).
 * Injectable deps so API (Nest) and worker (prisma) can both resume the same steps.
 */
const database_1 = require("@marketingspa/database");
const shared_1 = require("@marketingspa/shared");
function asSteps(raw) {
    if (raw && typeof raw === 'object')
        return raw;
    return (0, shared_1.emptyMissionStepsMap)();
}
function stepDone(steps, step) {
    return steps[step]?.status === 'done' || steps[step]?.status === 'skipped';
}
async function patchMission(prisma, missionId, data) {
    return prisma.marketingMission.update({
        where: { id: missionId },
        data,
    });
}
/**
 * Run / resume mission until READY_FOR_APPROVAL or FAILED.
 * Idempotent: skips steps already marked done.
 */
async function runMarketingMissionPipeline(missionId, deps) {
    const { prisma } = deps;
    const log = deps.logger ?? console;
    const mission = await prisma.marketingMission.findFirst({
        where: { id: missionId },
    });
    if (!mission) {
        throw new Error(`MarketingMission not found: ${missionId}`);
    }
    // Post-generation / post-approval: do not re-run planner/executor.
    // Legacy: RUNNING without readyAt = still generating (fall through).
    const postGen = mission.status === 'READY_FOR_APPROVAL' ||
        mission.status === 'APPROVED' ||
        mission.status === 'QUEUED' ||
        (mission.status === 'RUNNING' && !!mission.readyAt);
    if (postGen) {
        return {
            status: mission.status,
            currentStep: mission.currentStep,
            progressPercent: mission.progressPercent,
        };
    }
    const project = await prisma.marketingAutopilotProject.findFirst({
        where: { id: mission.projectId, organizationId: mission.organizationId },
    });
    if (!project) {
        await patchMission(prisma, missionId, {
            status: 'FAILED',
            errorJson: { message: 'Project not found for mission' },
            lastErrorAt: new Date(),
        });
        throw new Error('Project not found for mission');
    }
    const user = {
        id: mission.createdById,
        organizationId: mission.organizationId,
        email: '',
        name: '',
        role: 'OWNER',
    };
    let steps = asSteps(mission.stepsJson);
    let analysis = (await prisma.marketingAutopilotAnalysis.findFirst({
        where: { projectId: project.id, organizationId: mission.organizationId },
        orderBy: { createdAt: 'desc' },
    })) ?? null;
    await patchMission(prisma, missionId, {
        status: 'GENERATING',
        attemptCount: (mission.attemptCount ?? 0) + 1,
    });
    const finishStep = async (step, outcome, meta) => {
        steps = (0, shared_1.markMissionStep)(steps, step, {
            status: outcome,
            finishedAt: new Date().toISOString(),
            meta,
        });
        await patchMission(prisma, missionId, {
            currentStep: step,
            progressPercent: (0, shared_1.marketingMissionProgressPercent)(step),
            stepsJson: steps,
        });
    };
    const failStep = async (step, err) => {
        const message = err instanceof Error ? err.message : String(err);
        steps = (0, shared_1.markMissionStep)(steps, step, {
            status: 'failed',
            finishedAt: new Date().toISOString(),
            error: message,
        });
        await patchMission(prisma, missionId, {
            status: 'FAILED',
            currentStep: step,
            progressPercent: (0, shared_1.marketingMissionProgressPercent)(step),
            stepsJson: steps,
            errorJson: { step, message },
            lastErrorAt: new Date(),
        });
        throw err instanceof Error ? err : new Error(message);
    };
    const startStep = async (step) => {
        steps = (0, shared_1.markMissionStep)(steps, step, {
            status: 'running',
            startedAt: new Date().toISOString(),
        });
        await patchMission(prisma, missionId, {
            currentStep: step,
            progressPercent: (0, shared_1.marketingMissionProgressPercent)(step),
            stepsJson: steps,
            status: 'GENERATING',
        });
    };
    // --- BRIEF ---
    if (!stepDone(steps, 'BRIEF')) {
        await startStep('BRIEF');
        try {
            const briefOk = !!project.productName?.trim() &&
                !!project.customerProfile?.trim() &&
                !!project.primaryGoal?.trim();
            if (!briefOk)
                throw new Error('Brief thiếu productName / customerProfile / primaryGoal');
            await finishStep('BRIEF', 'done', { projectId: project.id });
        }
        catch (err) {
            await failStep('BRIEF', err);
        }
    }
    // --- CONTEXT ---
    if (!stepDone(steps, 'CONTEXT')) {
        await startStep('CONTEXT');
        try {
            let snapshotId = null;
            if (deps.getContext) {
                try {
                    const ctx = await deps.getContext(mission.organizationId, user);
                    snapshotId = ctx.snapshotId ?? null;
                }
                catch (ctxErr) {
                    log.warn(`[mission ${missionId}] Context V2 fallback: ${ctxErr instanceof Error ? ctxErr.message : String(ctxErr)}`);
                }
            }
            await finishStep('CONTEXT', 'done', { snapshotId, fallback: !snapshotId });
        }
        catch (err) {
            // Context must never kill workflow
            log.warn(`[mission ${missionId}] CONTEXT soft-fail`);
            await finishStep('CONTEXT', 'skipped', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
    // --- DIAGNOSE / PLANNER / NBA (reuse persisted analysis from create; OpenAI already fell back) ---
    for (const step of ['DIAGNOSE', 'PLANNER', 'NBA']) {
        if (stepDone(steps, step))
            continue;
        await startStep(step);
        try {
            if (!analysis?.recommendationJson) {
                throw new Error('Thiếu analysis — chạy lại Phân tích và lưu project');
            }
            const rec = analysis.recommendationJson;
            if (step === 'DIAGNOSE') {
                const plan = rec.plan;
                const diagnosis = plan?.businessDiagnosis ?? rec.strategyV2;
                await finishStep(step, 'done', {
                    hasDiagnosis: !!diagnosis,
                    engine: analysis.engine,
                });
            }
            else if (step === 'PLANNER') {
                await finishStep(step, 'done', {
                    engine: analysis.engine,
                    hasPlan: !!rec.plan,
                });
            }
            else {
                const nba = Array.isArray(rec.nextBestActions) ? rec.nextBestActions : [];
                await finishStep(step, 'done', { actionCount: nba.length });
            }
        }
        catch (err) {
            await failStep(step, err);
        }
    }
    // --- STRATEGY ---
    if (!stepDone(steps, 'STRATEGY')) {
        await startStep('STRATEGY');
        try {
            const rec = (analysis?.recommendationJson ?? project.analysisJson);
            const summary = (typeof rec.summary === 'string' && rec.summary) ||
                project.analysisSummary ||
                'Strategy draft';
            await finishStep('STRATEGY', 'done', {
                summary: summary.slice(0, 240),
                score: typeof rec.score === 'number' ? rec.score : null,
            });
        }
        catch (err) {
            await failStep('STRATEGY', err);
        }
    }
    // --- BLUEPRINT ---
    let blueprint = null;
    if (!stepDone(steps, 'BLUEPRINT')) {
        await startStep('BLUEPRINT');
        try {
            const rec = (analysis?.recommendationJson ?? project.analysisJson);
            const safePlan = (0, shared_1.normalizeAutopilotPlanForDraft)(rec.plan, {
                productName: project.productName,
                primaryGoal: project.primaryGoal,
                customerProfile: project.customerProfile,
                targetArea: project.targetArea,
                productPrice: Number(project.productPrice) || 0,
            });
            blueprint = (0, shared_1.buildCampaignBlueprintFromPlan)(safePlan, rec);
            await patchMission(prisma, missionId, {
                blueprintJson: blueprint,
            });
            await finishStep('BLUEPRINT', 'done', {
                assetsToCreate: blueprint.assetsToCreate,
                draftOnly: true,
            });
        }
        catch (err) {
            await failStep('BLUEPRINT', err);
        }
    }
    else {
        blueprint = mission.blueprintJson;
    }
    // --- ASSETS (AI Executor: real domain drafts via existing services) ---
    if (!stepDone(steps, 'ASSETS')) {
        await startStep('ASSETS');
        try {
            const rec = (analysis?.recommendationJson ?? project.analysisJson);
            const safePlan = (0, shared_1.normalizeAutopilotPlanForDraft)(rec.plan, {
                productName: project.productName,
                primaryGoal: project.primaryGoal,
                customerProfile: project.customerProfile,
                targetArea: project.targetArea,
                productPrice: Number(project.productPrice) || 0,
            });
            const idempotencyKey = `mission-assets:${mission.id}`;
            let draftRun = await prisma.marketingAutopilotDraftRun.findFirst({
                where: { organizationId: mission.organizationId, idempotencyKey },
            });
            if (!draftRun) {
                draftRun = await prisma.marketingAutopilotDraftRun.create({
                    data: {
                        organizationId: mission.organizationId,
                        createdById: mission.createdById,
                        projectId: project.id,
                        idempotencyKey,
                        status: 'COMPLETED',
                        blockedActionsJson: { source: 'marketing_mission_orchestrator' },
                    },
                });
            }
            const projectCtx = {
                id: project.id,
                name: project.name,
                productName: project.productName,
                primaryGoal: project.primaryGoal,
                customerProfile: project.customerProfile,
                targetArea: project.targetArea,
                productPrice: Number(project.productPrice) || 0,
            };
            let createdMeta = {};
            if (deps.executeAssets) {
                const exec = await deps.executeAssets({
                    missionId: mission.id,
                    user,
                    project: projectCtx,
                    plan: safePlan,
                    draftRunId: draftRun.id,
                });
                createdMeta = {
                    executor: true,
                    assetCount: exec.assets.length,
                    modules: Array.from(new Set(exec.assets.map((a) => a.module))),
                    skipped: exec.skipped,
                    draftRegistry: exec.draftRegistry.map((d) => d.type),
                };
                if (exec.assets.length === 0) {
                    throw new Error('AI Executor không tạo được asset nào');
                }
            }
            else {
                // Legacy fallback: 4 draft types only
                const existing = await prisma.marketingAutopilotDraft.findMany({
                    where: {
                        organizationId: mission.organizationId,
                        projectId: project.id,
                        missionId: mission.id,
                    },
                });
                const have = new Set(existing.map((d) => d.type));
                const createdTypes = [];
                for (const type of shared_1.MARKETING_MISSION_AUTO_DRAFT_TYPES) {
                    if (have.has(type)) {
                        createdTypes.push(type);
                        continue;
                    }
                    const adapterResult = await deps.createDraft(type, user, safePlan, projectCtx);
                    await prisma.marketingAutopilotDraft.create({
                        data: {
                            organizationId: mission.organizationId,
                            createdById: mission.createdById,
                            projectId: project.id,
                            runId: draftRun.id,
                            missionId: mission.id,
                            type,
                            status: 'DRAFT',
                            payload: {
                                generatedBy: 'marketing_mission_orchestrator',
                                draftOnly: true,
                                liveActionsEnabled: false,
                                plan: safePlan,
                                adapter: adapterResult,
                            },
                        },
                    });
                    createdTypes.push(type);
                }
                createdMeta = { createdTypes, executor: false };
            }
            await prisma.marketingAutopilotProject.update({
                where: { id: project.id },
                data: { status: 'DRAFTS_CREATED' },
            });
            await finishStep('ASSETS', 'done', createdMeta);
        }
        catch (err) {
            await failStep('ASSETS', err);
        }
    }
    // --- VALIDATE ---
    if (!stepDone(steps, 'VALIDATE')) {
        await startStep('VALIDATE');
        try {
            const drafts = await prisma.marketingAutopilotDraft.findMany({
                where: {
                    organizationId: mission.organizationId,
                    projectId: project.id,
                    missionId: mission.id,
                },
            });
            const missionAssets = prisma.marketingMissionAsset
                ? await prisma.marketingMissionAsset.findMany({
                    where: { organizationId: mission.organizationId, missionId: mission.id },
                })
                : [];
            const types = new Set(drafts.map((d) => d.type));
            const missingCore = shared_1.MARKETING_MISSION_AUTO_DRAFT_TYPES.filter((t) => !types.has(t));
            const hasFunnel = types.has('FUNNEL_DRAFT') ||
                missionAssets.some((a) => a.entityType === 'funnel_recommendation' || a.assetType === 'FUNNEL_DRAFT');
            if (!hasFunnel) {
                throw new Error('Thiếu funnel thật (FunnelRecommendation + completeSpec)');
            }
            if (missingCore.length && missionAssets.length === 0) {
                throw new Error(`Thiếu draft assets: ${missingCore.join(', ')}`);
            }
            for (const d of drafts) {
                if (d.organizationId !== mission.organizationId) {
                    throw new Error('Tenant isolation violation on draft');
                }
                const payload = (d.payload ?? {});
                if (payload.liveActionsEnabled === true) {
                    throw new Error(`Draft ${d.type} không được liveActionsEnabled`);
                }
            }
            await finishStep('VALIDATE', 'done', {
                draftCount: drafts.length,
                missionAssetCount: missionAssets.length,
                draftOnly: true,
            });
        }
        catch (err) {
            await failStep('VALIDATE', err);
        }
    }
    // --- READY_FOR_APPROVAL ---
    steps = (0, shared_1.markMissionStep)(steps, 'READY_FOR_APPROVAL', {
        status: 'done',
        finishedAt: new Date().toISOString(),
    });
    const ready = await patchMission(prisma, missionId, {
        status: 'READY_FOR_APPROVAL',
        currentStep: 'READY_FOR_APPROVAL',
        progressPercent: 100,
        stepsJson: steps,
        readyAt: new Date(),
        errorJson: database_1.Prisma.DbNull,
    });
    await prisma.marketingAutopilotProject.update({
        where: { id: project.id },
        data: { status: 'READY_FOR_APPROVAL' },
    });
    // silence unused
    void shared_1.MARKETING_MISSION_STEPS;
    void blueprint;
    return {
        status: ready.status,
        currentStep: ready.currentStep,
        progressPercent: ready.progressPercent,
    };
}
