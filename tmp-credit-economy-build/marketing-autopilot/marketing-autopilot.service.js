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
var MarketingAutopilotService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketingAutopilotService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const database_1 = require("@marketingspa/database");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const pagination_util_1 = require("../common/utils/pagination.util");
const marketing_autopilot_draft_adapter_1 = require("./marketing-autopilot-draft.adapter");
const marketing_autopilot_content_draft_service_1 = require("./marketing-autopilot-content-draft.service");
const marketing_context_engine_service_1 = require("./context/marketing-context-engine.service");
const marketing_autopilot_planner_service_1 = require("./marketing-autopilot-planner.service");
const marketing_autopilot_outcome_learning_service_1 = require("./outcome/marketing-autopilot-outcome-learning.service");
const marketing_mission_orchestrator_service_1 = require("./orchestrator/marketing-mission-orchestrator.service");
const marketing_autopilot_project_list_util_1 = require("./marketing-autopilot-project-list.util");
let MarketingAutopilotService = MarketingAutopilotService_1 = class MarketingAutopilotService {
    prisma;
    config;
    audit;
    draftAdapter;
    contentDraft;
    contextEngine;
    planner;
    outcomeLearning;
    missionOrchestrator;
    logger = new common_1.Logger(MarketingAutopilotService_1.name);
    constructor(prisma, config, audit, draftAdapter, contentDraft, contextEngine, planner, outcomeLearning, missionOrchestrator) {
        this.prisma = prisma;
        this.config = config;
        this.audit = audit;
        this.draftAdapter = draftAdapter;
        this.contentDraft = contentDraft;
        this.contextEngine = contextEngine;
        this.planner = planner;
        this.outcomeLearning = outcomeLearning;
        this.missionOrchestrator = missionOrchestrator;
    }
    isEnabled() {
        return (this.config.get('FEATURE_MARKETING_AUTOPILOT') ?? 'false').trim() === 'true';
    }
    getStatus(organizationId) {
        return {
            enabled: this.isEnabled(),
            organizationId,
            liveActionsEnabled: false,
            facebookSafetyMode: 'read-only',
        };
    }
    async findAll(organizationId, query) {
        this.assertEnabled();
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        const where = (0, marketing_autopilot_project_list_util_1.buildProjectListWhere)(organizationId, query);
        const orderBy = (0, marketing_autopilot_project_list_util_1.buildProjectListOrderBy)(query.sort);
        const [items, total] = await Promise.all([
            this.prisma.marketingAutopilotProject.findMany({
                where,
                skip,
                take,
                orderBy,
                include: {
                    createdBy: { select: { id: true, name: true, email: true } },
                    analyses: { take: 1, orderBy: { createdAt: 'desc' } },
                    drafts: { orderBy: { createdAt: 'desc' }, take: 40 },
                    missions: {
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                        include: {
                            assets: { orderBy: { createdAt: 'desc' }, take: 50 },
                            approvals: { orderBy: { version: 'desc' }, take: 1 },
                        },
                    },
                },
            }),
            this.prisma.marketingAutopilotProject.count({ where }),
        ]);
        const mapped = await Promise.all(items.map(async (item) => {
            const analysisJson = (item.analyses?.[0]?.recommendationJson ??
                item.analysisJson);
            const latestMission = item.missions?.[0];
            if (latestMission &&
                latestMission.status === 'DRAFT' &&
                (latestMission.progressPercent ?? 0) === 0) {
                this.missionOrchestrator.kickMissionPipeline(latestMission.id, item.organizationId, item.id);
            }
            return {
                ...item,
                drafts: this.enrichDraftRecords(item.drafts ?? []),
                mission: latestMission
                    ? await this.missionOrchestrator.toPublicMissionDetailed(latestMission, analysisJson)
                    : null,
                missions: undefined,
            };
        }));
        return (0, pagination_util_1.buildPaginatedResult)(mapped, total, page, pageSize);
    }
    async getProjectFilterOptions(organizationId) {
        this.assertEnabled();
        const baseWhere = {
            organizationId,
            deletedAt: null,
        };
        const [productRows, statusRows, goalRows, budgetAgg] = await Promise.all([
            this.prisma.marketingAutopilotProject.findMany({
                where: baseWhere,
                select: { productName: true },
                distinct: ['productName'],
                orderBy: { productName: 'asc' },
                take: 200,
            }),
            this.prisma.marketingAutopilotProject.findMany({
                where: baseWhere,
                select: { status: true },
                distinct: ['status'],
                orderBy: { status: 'asc' },
                take: 50,
            }),
            this.prisma.marketingAutopilotProject.findMany({
                where: baseWhere,
                select: { primaryGoal: true },
                orderBy: { createdAt: 'desc' },
                take: 500,
            }),
            this.prisma.marketingAutopilotProject.aggregate({
                where: baseWhere,
                _min: { monthlyBudget: true },
                _max: { monthlyBudget: true },
            }),
        ]);
        const goalSet = new Set();
        for (const row of goalRows) {
            const parts = row.primaryGoal
                .split(/[,;|/]/)
                .map((s) => s.trim())
                .filter(Boolean);
            for (const p of parts.length ? parts : [row.primaryGoal.trim()]) {
                if (p)
                    goalSet.add(p);
            }
        }
        return {
            products: productRows.map((r) => r.productName).filter(Boolean),
            statuses: statusRows.map((r) => r.status).filter(Boolean),
            goals: Array.from(goalSet).slice(0, 40),
            budgetMin: budgetAgg._min.monthlyBudget ? Number(budgetAgg._min.monthlyBudget) : 0,
            budgetMax: budgetAgg._max.monthlyBudget ? Number(budgetAgg._max.monthlyBudget) : 0,
        };
    }
    async findOne(organizationId, id) {
        this.assertEnabled();
        const item = await this.prisma.marketingAutopilotProject.findFirst({
            where: { id, organizationId, deletedAt: null },
            include: {
                createdBy: { select: { id: true, name: true, email: true } },
                analyses: { orderBy: { createdAt: 'desc' } },
                drafts: { orderBy: { createdAt: 'desc' }, take: 40 },
                missions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: {
                        assets: { orderBy: { createdAt: 'desc' }, take: 50 },
                        approvals: { orderBy: { version: 'desc' }, take: 1 },
                    },
                },
            },
        });
        if (!item) {
            throw new common_1.NotFoundException('Không tìm thấy project Marketing Autopilot');
        }
        const analysisJson = (item.analyses?.[0]?.recommendationJson ??
            item.analysisJson);
        return {
            ...item,
            drafts: this.enrichDraftRecords(item.drafts ?? []),
            mission: item.missions?.[0]
                ? await this.missionOrchestrator.toPublicMissionDetailed(item.missions[0], analysisJson)
                : null,
            missions: undefined,
        };
    }
    async updateProject(user, projectId, dto) {
        this.assertEnabled();
        const project = await this.getProjectForMutation(user, projectId);
        const latestMission = await this.prisma.marketingMission.findFirst({
            where: { projectId: project.id, organizationId: user.organizationId },
            orderBy: { createdAt: 'desc' },
            include: { assets: { take: 1, select: { id: true } } },
        });
        const assetsFrozen = this.isProjectAssetsFrozen(project.status, latestMission);
        const existingSnapshot = project.inputSnapshot && typeof project.inputSnapshot === 'object'
            ? project.inputSnapshot
            : {};
        const goals = dto.goals?.filter((g) => g.trim()).length ? dto.goals.map((g) => g.trim()) : undefined;
        const primaryGoal = dto.primaryGoal?.trim() ??
            (goals?.length ? goals.join(', ') : undefined) ??
            project.primaryGoal;
        const nextSnapshot = {
            ...existingSnapshot,
            primaryGoal,
            briefUpdatedAt: new Date().toISOString(),
            assetsFrozen,
        };
        if (dto.projectName !== undefined)
            nextSnapshot.projectName = dto.projectName;
        if (dto.productName !== undefined)
            nextSnapshot.productName = dto.productName;
        if (dto.productPrice !== undefined)
            nextSnapshot.productPrice = dto.productPrice;
        if (dto.customerProfile !== undefined)
            nextSnapshot.customerProfile = dto.customerProfile;
        if (dto.targetArea !== undefined)
            nextSnapshot.targetArea = dto.targetArea;
        if (dto.monthlyBudget !== undefined)
            nextSnapshot.monthlyBudget = dto.monthlyBudget;
        if (goals?.length)
            nextSnapshot.goals = goals;
        if (dto.channels !== undefined)
            nextSnapshot.channels = dto.channels.filter((c) => c.trim());
        const updateData = {
            primaryGoal,
            inputSnapshot: nextSnapshot,
        };
        if (dto.projectName !== undefined) {
            updateData.name = dto.projectName.trim() || project.name;
        }
        else if (dto.productName !== undefined || dto.primaryGoal !== undefined || goals?.length) {
            updateData.name = `${(dto.productName ?? project.productName).trim()} - ${primaryGoal.trim()}`;
        }
        if (dto.productName !== undefined)
            updateData.productName = dto.productName.trim();
        if (dto.productPrice !== undefined)
            updateData.productPrice = new database_1.Prisma.Decimal(dto.productPrice);
        if (dto.customerProfile !== undefined)
            updateData.customerProfile = dto.customerProfile.trim();
        if (dto.targetArea !== undefined)
            updateData.targetArea = dto.targetArea.trim();
        if (dto.monthlyBudget !== undefined)
            updateData.monthlyBudget = new database_1.Prisma.Decimal(dto.monthlyBudget);
        await this.prisma.marketingAutopilotProject.update({
            where: { id: project.id },
            data: updateData,
        });
        await this.audit.log({
            organizationId: user.organizationId,
            userId: user.id,
            action: 'marketing_autopilot_project_update',
            entityType: 'marketing_autopilot_project',
            entityId: project.id,
            metadata: {
                assetsFrozen,
                fields: Object.keys(dto).filter((k) => dto[k] !== undefined),
            },
        });
        const detail = await this.findOne(user.organizationId, project.id);
        return {
            ...detail,
            briefOnly: assetsFrozen,
            assetsFrozen,
            message: assetsFrozen
                ? 'Brief đã lưu. Mission và tài sản đang chạy không bị thay đổi.'
                : 'Brief project đã được cập nhật.',
        };
    }
    async archiveProject(user, projectId) {
        this.assertEnabled();
        const project = await this.getProjectForMutation(user, projectId);
        const now = new Date();
        await this.prisma.marketingAutopilotProject.update({
            where: { id: project.id },
            data: {
                deletedAt: now,
                archivedAt: now,
                archivedById: user.id,
                status: 'ARCHIVED',
            },
        });
        await this.audit.log({
            organizationId: user.organizationId,
            userId: user.id,
            action: 'marketing_autopilot_project_archive',
            entityType: 'marketing_autopilot_project',
            entityId: project.id,
            metadata: { previousStatus: project.status },
        });
        return {
            id: project.id,
            archived: true,
            deletedAt: now.toISOString(),
            message: 'Project đã lưu trữ. Mission và tài sản liên quan vẫn giữ nguyên.',
        };
    }
    async getProjectForMutation(user, projectId) {
        const project = await this.prisma.marketingAutopilotProject.findFirst({
            where: { id: projectId, organizationId: user.organizationId },
        });
        if (!project) {
            throw new common_1.NotFoundException('Không tìm thấy project Marketing Autopilot');
        }
        this.assertProjectWritable(user, project);
        return project;
    }
    assertProjectWritable(user, project) {
        if (project.organizationId !== user.organizationId) {
            throw new common_1.ForbiddenException('Không có quyền truy cập project này');
        }
        if (project.deletedAt) {
            throw new common_1.BadRequestException('Project đã được lưu trữ');
        }
        const elevated = user.role === 'OWNER' || user.role === 'ADMIN';
        if (!elevated && project.createdById !== user.id) {
            throw new common_1.ForbiddenException('Chỉ người tạo hoặc quản trị viên mới được chỉnh sửa/xóa project');
        }
    }
    isProjectAssetsFrozen(projectStatus, mission) {
        if (projectStatus === 'RUNNING')
            return true;
        if (!mission)
            return false;
        const frozenStatuses = new Set([
            'RUNNING',
            'APPROVED',
            'QUEUED',
            'DRAFTS_CREATED',
            'READY_FOR_APPROVAL',
            'ORCHESTRATING',
            'GENERATING',
        ]);
        if (frozenStatuses.has(mission.status))
            return true;
        return (mission.assets?.length ?? 0) > 0;
    }
    async getPlan(organizationId, projectId) {
        this.assertEnabled();
        const analysis = await this.prisma.marketingAutopilotAnalysis.findFirst({
            where: { projectId, organizationId },
            orderBy: { createdAt: 'desc' },
        });
        if (!analysis) {
            throw new common_1.NotFoundException('Không tìm thấy plan Marketing Autopilot');
        }
        const payload = analysis.recommendationJson;
        return payload;
    }
    enrichDraftRecords(drafts) {
        return drafts.map((d) => {
            const payload = (d.payload && typeof d.payload === 'object' ? d.payload : {});
            const adapterRaw = payload.adapter;
            const adapter = (adapterRaw && typeof adapterRaw === 'object' ? adapterRaw : {});
            const externalEntityId = typeof adapter.externalEntityId === 'string' && adapter.externalEntityId.trim()
                ? adapter.externalEntityId.trim()
                : null;
            const type = d.type;
            const adapterEditUrl = typeof adapter.editUrl === 'string' && adapter.editUrl.trim()
                ? adapter.editUrl.trim()
                : null;
            const editUrl = adapterEditUrl ?? (0, shared_1.resolveAutopilotDraftEditUrl)(type, externalEntityId);
            const metadata = adapter.metadata && typeof adapter.metadata === 'object'
                ? adapter.metadata
                : {};
            const contentIdeas = Array.isArray(metadata.contentIdeas) ? metadata.contentIdeas : undefined;
            return {
                ...d,
                status: d.status === 'CREATED' ? 'DRAFT' : d.status || 'DRAFT',
                draftId: d.id,
                type,
                editUrl,
                externalEntityId,
                externalEntityType: typeof adapter.externalEntityType === 'string' ? adapter.externalEntityType : null,
                contentIdeas,
            };
        });
    }
    mapConfirmDraftResponse(draftRun, drafts) {
        const enriched = this.enrichDraftRecords(drafts).map((d) => ({
            ...d,
            status: 'DRAFT',
        }));
        return {
            draftRun,
            drafts: enriched,
            results: enriched.map((d) => ({
                draftId: d.draftId,
                type: d.type,
                status: d.status,
                editUrl: d.editUrl,
                externalEntityId: d.externalEntityId,
                externalEntityType: d.externalEntityType,
            })),
        };
    }
    async confirmDraft(user, projectId, idempotencyKey, draftTypesFilter) {
        this.assertEnabled();
        const project = await this.prisma.marketingAutopilotProject.findFirst({
            where: { id: projectId, organizationId: user.organizationId },
            include: { analyses: { take: 1, orderBy: { createdAt: 'desc' } } },
        });
        if (!project) {
            throw new common_1.NotFoundException('Không tìm thấy project Marketing Autopilot');
        }
        const latestAnalysis = project.analyses?.[0];
        const key = (0, shared_1.resolveConfirmIdempotencyKey)({
            clientKey: idempotencyKey,
            projectId: project.id,
            analysisId: latestAnalysis?.id ?? null,
        });
        const analysis = (latestAnalysis?.recommendationJson ??
            project.analysisJson);
        const requested = Array.isArray(analysis.nextBestActions) ? analysis.nextBestActions : [];
        const normalizedFilter = (0, shared_1.normalizeConfirmDraftTypesFilter)(draftTypesFilter);
        if (Array.isArray(draftTypesFilter) && draftTypesFilter.length > 0 && !normalizedFilter) {
            throw new common_1.BadRequestException(`draftTypes không hợp lệ. Chỉ chấp nhận: CONTENT_DRAFT, FUNNEL_DRAFT, AUTOMATION_DRAFT, CAMPAIGN_DRAFT. Nhận được: ${JSON.stringify(draftTypesFilter)}`);
        }
        const { allowed: uniqueDraftTypesToCreate, blocked: blockedHighRiskActionSuggestions } = (0, shared_1.resolveConfirmDraftTypes)(requested, normalizedFilter);
        if (normalizedFilter?.length && uniqueDraftTypesToCreate.length === 0) {
            throw new common_1.BadRequestException(`Không tạo được Draft: loại bị khóa an toàn hoặc không hỗ trợ (${blockedHighRiskActionSuggestions.join(', ') || 'unknown'}).`);
        }
        const runStatus = uniqueDraftTypesToCreate.length > 0 ? 'COMPLETED' : 'BLOCKED';
        const existingRun = await this.prisma.marketingAutopilotDraftRun.findFirst({
            where: {
                organizationId: user.organizationId,
                idempotencyKey: key,
            },
            include: { drafts: true },
        });
        if (existingRun && (0, shared_1.shouldReuseDraftRun)(existingRun.idempotencyKey, key)) {
            return this.mapConfirmDraftResponse(existingRun, existingRun.drafts);
        }
        const safePlan = (0, shared_1.normalizeAutopilotPlanForDraft)(analysis?.plan, {
            productName: project.productName,
            primaryGoal: project.primaryGoal,
            customerProfile: project.customerProfile,
            targetArea: project.targetArea,
            productPrice: Number(project.productPrice) || 0,
        });
        const payloadCommon = {
            generatedBy: 'marketing_autopilot_mvp',
            policy: analysis.safety?.policy ?? 'READ_ONLY',
            blockedHighRiskActionSuggestions,
            plan: safePlan,
            nextBestActions: analysis.nextBestActions,
            kpi: safePlan.kpi,
            timeline: safePlan.timeline,
            draftOnly: true,
            liveActionsEnabled: false,
        };
        const adapterResults = [];
        const orderedTypes = (0, shared_1.sortDraftTypesByDependency)(uniqueDraftTypesToCreate);
        for (const type of orderedTypes) {
            try {
                // Idempotent: reuse existing real domain draft for this project+type
                const existingDraft = await this.prisma.marketingAutopilotDraft.findFirst({
                    where: {
                        organizationId: user.organizationId,
                        projectId: project.id,
                        type,
                        status: { in: ['DRAFT', 'CREATED'] },
                    },
                    orderBy: { createdAt: 'desc' },
                });
                if (existingDraft) {
                    const payload = (existingDraft.payload ?? {});
                    if (payload.adapter?.externalEntityId) {
                        adapterResults.push({
                            type,
                            adapterResult: {
                                externalEntityId: payload.adapter.externalEntityId,
                                externalEntityType: payload.adapter.externalEntityType ?? `autopilot_${type.toLowerCase()}`,
                                adapter: payload.adapter.adapter ?? 'reused',
                                editUrl: payload.adapter.editUrl ??
                                    (0, shared_1.resolveAutopilotDraftEditUrl)(type, payload.adapter.externalEntityId),
                                metadata: payload.adapter.metadata,
                            },
                        });
                        continue;
                    }
                }
                const adapterResult = await this.draftAdapter.createDraft(type, user, safePlan, {
                    id: project.id,
                    name: project.name,
                    productName: project.productName,
                    primaryGoal: project.primaryGoal,
                    customerProfile: project.customerProfile,
                    targetArea: project.targetArea,
                    productPrice: Number(project.productPrice) || 0,
                });
                adapterResults.push({
                    type,
                    adapterResult: {
                        ...adapterResult,
                        editUrl: adapterResult.editUrl ??
                            (0, shared_1.resolveAutopilotDraftEditUrl)(type, adapterResult.externalEntityId),
                    },
                });
            }
            catch (err) {
                const detail = err instanceof Error ? err.message : String(err);
                this.logger.error(`confirmDraft adapter ${type} failed project=${project.id} org=${user.organizationId}: ${detail}`, err instanceof Error ? err.stack : undefined);
                if (err instanceof common_1.BadRequestException)
                    throw err;
                throw new common_1.BadRequestException(`Không tạo được ${type}: ${detail}`);
            }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let confirmResult;
        try {
            confirmResult = await this.prisma.$transaction(async (tx) => {
                const draftRun = await tx.marketingAutopilotDraftRun.create({
                    data: {
                        organizationId: user.organizationId,
                        createdById: user.id,
                        projectId: project.id,
                        idempotencyKey: key,
                        status: runStatus,
                        blockedActionsJson: {
                            blockedHighRiskActionSuggestions,
                        },
                    },
                });
                const createdDrafts = await Promise.all(adapterResults.map(({ type, adapterResult }) => tx.marketingAutopilotDraft.create({
                    data: {
                        organizationId: user.organizationId,
                        createdById: user.id,
                        projectId: project.id,
                        runId: draftRun.id,
                        type,
                        status: 'DRAFT',
                        payload: {
                            ...payloadCommon,
                            adapter: adapterResult,
                        },
                    },
                })));
                this.audit.log({
                    organizationId: user.organizationId,
                    userId: user.id,
                    action: 'marketing_autopilot_confirm_draft',
                    entityType: 'marketing_autopilot_draft_run',
                    entityId: draftRun.id,
                    metadata: {
                        projectId: project.id,
                        idempotencyKey: key,
                        blockedHighRiskActionSuggestions,
                        draftTypes: uniqueDraftTypesToCreate,
                        externalEntities: adapterResults.map((r) => ({
                            type: r.type,
                            externalEntityType: r.adapterResult.externalEntityType,
                            externalEntityId: r.adapterResult.externalEntityId,
                        })),
                    },
                }, tx);
                await tx.marketingAutopilotProject.update({
                    where: { id: project.id },
                    data: { status: 'DRAFTS_CREATED' },
                });
                return { draftRun, drafts: createdDrafts };
            });
        }
        catch (err) {
            const code = err?.code;
            if (code === 'P2002') {
                const raced = await this.prisma.marketingAutopilotDraftRun.findFirst({
                    where: { organizationId: user.organizationId, idempotencyKey: key },
                    include: { drafts: true },
                });
                if (raced)
                    return this.mapConfirmDraftResponse(raced, raced.drafts);
            }
            throw err;
        }
        // Link MissionAsset when mission exists (confirm path = same real assets as executor)
        try {
            const mission = await this.prisma.marketingMission.findFirst({
                where: { projectId: project.id, organizationId: user.organizationId },
                orderBy: { createdAt: 'desc' },
            });
            if (mission) {
                for (const { type, adapterResult } of adapterResults) {
                    const editUrl = adapterResult.editUrl ??
                        (0, shared_1.resolveAutopilotDraftEditUrl)(type, adapterResult.externalEntityId);
                    await this.prisma.marketingMissionAsset.upsert({
                        where: {
                            organizationId_entityType_entityId: {
                                organizationId: user.organizationId,
                                entityType: adapterResult.externalEntityType,
                                entityId: adapterResult.externalEntityId,
                            },
                        },
                        create: {
                            organizationId: user.organizationId,
                            missionId: mission.id,
                            module: type === 'CONTENT_DRAFT'
                                ? 'CONTENT'
                                : type === 'FUNNEL_DRAFT'
                                    ? 'FUNNEL'
                                    : type === 'AUTOMATION_DRAFT'
                                        ? 'AUTOMATION'
                                        : 'CAMPAIGN',
                            assetType: type,
                            recommendationId: `nba:${type}`,
                            entityType: adapterResult.externalEntityType,
                            entityId: adapterResult.externalEntityId,
                            editUrl,
                            status: 'DRAFT',
                            adapter: adapterResult.adapter,
                            metadataJson: {
                                missionId: mission.id,
                                draftOnly: true,
                                source: 'confirm_draft',
                                editUrl,
                            },
                        },
                        update: {
                            missionId: mission.id,
                            editUrl,
                            assetType: type,
                            recommendationId: `nba:${type}`,
                            status: 'DRAFT',
                        },
                    });
                }
            }
        }
        catch (err) {
            this.logger.warn(`confirmDraft MissionAsset link soft-fail: ${err instanceof Error ? err.message : String(err)}`);
        }
        // Outcome Learning: baseline after Draft (outside TX; no live action)
        try {
            const { snapshot, snapshotId } = await this.contextEngine.getContext(user.organizationId, {
                user,
            });
            await this.outcomeLearning.recordDraftBaselines({
                organizationId: user.organizationId,
                createdById: user.id,
                projectId: project.id,
                analysisId: latestAnalysis?.id ?? null,
                draftRunId: confirmResult.draftRun.id,
                drafts: confirmResult.drafts.map((d) => ({
                    id: d.id,
                    type: d.type,
                    recommendationId: `nba:${d.type}`,
                })),
                productName: project.productName,
                customerProfile: project.customerProfile,
                targetArea: project.targetArea,
                primaryGoal: project.primaryGoal,
                analysis,
                snapshot,
                snapshotId,
            });
        }
        catch (err) {
            // Non-blocking: draft creation must not fail if outcome tracking fails
            this.logger.warn(`[outcome-learning] draft baseline failed: ${err instanceof Error ? err.message : String(err)}`);
        }
        return this.mapConfirmDraftResponse(confirmResult.draftRun, confirmResult.drafts);
    }
    async create(user, dto) {
        this.assertEnabled();
        const { snapshot, snapshotId } = await this.contextEngine.getContext(user.organizationId, { user });
        const businessLearnings = await this.outcomeLearning.getBusinessLearningsForPlanner(user.organizationId);
        const context = { snapshot, snapshotId, businessLearnings };
        const { analysis, engine } = await this.planner.plan(dto, context, () => this.buildHeuristicAnalysis(dto, context));
        const inputSnapshot = {
            projectName: dto.projectName ?? null,
            productName: dto.productName,
            productPrice: dto.productPrice,
            customerProfile: dto.customerProfile,
            targetArea: dto.targetArea,
            monthlyBudget: dto.monthlyBudget,
            primaryGoal: dto.primaryGoal,
        };
        const created = await this.prisma.$transaction(async (tx) => {
            const project = await tx.marketingAutopilotProject.create({
                data: {
                    organizationId: user.organizationId,
                    createdById: user.id,
                    name: dto.projectName?.trim() || `${dto.productName.trim()} - ${dto.primaryGoal.trim()}`,
                    status: 'ANALYZED',
                    productName: dto.productName.trim(),
                    productPrice: new database_1.Prisma.Decimal(dto.productPrice),
                    customerProfile: dto.customerProfile.trim(),
                    targetArea: dto.targetArea.trim(),
                    monthlyBudget: new database_1.Prisma.Decimal(dto.monthlyBudget),
                    primaryGoal: dto.primaryGoal.trim(),
                    inputSnapshot,
                    analysisSummary: analysis.summary,
                    analysisJson: analysis,
                },
                include: {
                    createdBy: { select: { id: true, name: true, email: true } },
                },
            });
            const analysisRow = await tx.marketingAutopilotAnalysis.create({
                data: {
                    projectId: project.id,
                    organizationId: user.organizationId,
                    createdById: user.id,
                    engine,
                    summary: analysis.summary,
                    recommendationJson: analysis,
                },
            });
            return {
                project,
                analysisRow,
            };
        });
        try {
            await this.outcomeLearning.recordStrategyBaseline({
                organizationId: user.organizationId,
                createdById: user.id,
                projectId: created.project.id,
                analysisId: created.analysisRow.id,
                productName: created.project.productName,
                customerProfile: created.project.customerProfile,
                targetArea: created.project.targetArea,
                primaryGoal: created.project.primaryGoal,
                analysis,
                snapshot,
                snapshotId,
            });
        }
        catch (err) {
            console.warn(`[outcome-learning] strategy baseline failed: ${err instanceof Error ? err.message : String(err)}`);
        }
        // Additive AI Orchestrator A→Z — does not replace classic create response fields.
        let mission = null;
        try {
            mission = await this.missionOrchestrator.startMissionAfterCreate(user, created.project);
        }
        catch (err) {
            this.logger.warn(`[mission] start after create failed: ${err instanceof Error ? err.message : String(err)}`);
        }
        return {
            ...created.project,
            analyses: [
                {
                    id: created.analysisRow.id,
                    projectId: created.project.id,
                    organizationId: user.organizationId,
                    createdById: user.id,
                    engine,
                    summary: analysis.summary,
                    recommendationJson: analysis,
                    createdAt: created.analysisRow.createdAt,
                },
            ],
            mission,
        };
    }
    /** Heuristic fallback when LLM unavailable or invalid. */
    buildHeuristicAnalysis(input, context) {
        const budgetMonthly = Number(input.monthlyBudget || 0);
        const price = Number(input.productPrice || 0);
        const safeBudget = Number.isFinite(budgetMonthly) ? budgetMonthly : 0;
        const ctx = context?.snapshot;
        const actualLeads = ctx?.metrics.leads.total;
        const actualBookings = ctx?.metrics.bookings.total;
        const actualConversion = ctx?.metrics.conversion.leadToBookingRate;
        const actualAdsSpend = ctx?.metrics.ads.spend;
        const actualRoas = ctx?.metrics.ads.roas;
        const estimatedLeadTarget = actualLeads !== null && actualLeads !== undefined && actualLeads > 0
            ? Math.max(actualLeads, 10)
            : price > 0
                ? Math.max(10, Math.round((safeBudget / Math.max(price, 1)) * 12))
                : 10;
        const estimatedBookings = actualBookings !== null && actualBookings !== undefined && actualBookings > 0
            ? actualBookings
            : Math.max(3, Math.round(estimatedLeadTarget * 0.1));
        const targetArea = input.targetArea.trim();
        const targetProfile = input.customerProfile.trim();
        const suggestedChannels = actualAdsSpend !== null && actualAdsSpend !== undefined && actualAdsSpend > 0
            ? ['Facebook Ads', 'Remarketing CRM', 'Content Studio', 'Chatbot CSKH', 'Email chăm sóc']
            : safeBudget >= 20_000_000
                ? ['Content Studio', 'Facebook Ads', 'Remarketing CRM', 'Chatbot CSKH', 'Email chăm sóc']
                : ['Content Studio', 'Chatbot CSKH', 'Email chăm sóc'];
        const budgetSplit = safeBudget >= 20_000_000
            ? [
                { channel: 'Facebook Ads', percent: 45 },
                { channel: 'Content Studio', percent: 20 },
                { channel: 'CRM + Funnel', percent: 20 },
                { channel: 'Email/Chatbot chăm sóc', percent: 15 },
            ]
            : [
                { channel: 'Content Studio', percent: 35 },
                { channel: 'Chatbot CSKH', percent: 25 },
                { channel: 'CRM + Funnel', percent: 25 },
                { channel: 'Email chăm sóc', percent: 15 },
            ];
        const valueProps = [
            `Tập trung "${input.primaryGoal.trim()}" theo khu vực ${targetArea}`,
            `Ưu tiên thông điệp phù hợp chân dung: ${targetProfile}`,
            `Tối ưu lead-to-booking bằng nurturing + kịch bản chatbot`,
        ];
        const communications = {
            email: ['Chuỗi 3 email: chào mừng → chứng cứ → CTA đặt lịch'],
            messenger: ['Kịch bản nhắn: phân loại → tư vấn → chốt lịch'],
            zalo: ['Chuỗi nhắn: nhắc nhẹ + gợi ý nội dung phù hợp'],
        };
        const plan = {
            customersTarget: {
                targetProfile,
                personas: targetProfile
                    .split(/[,;]\s*/g)
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .slice(0, 4),
                targetArea,
            },
            customerProfile: targetProfile,
            offer: {
                productName: input.productName.trim(),
                productPrice: price,
                primaryGoal: input.primaryGoal.trim(),
                valueProps,
            },
            funnel: {
                stages: [
                    { name: 'Awareness', objective: 'Tạo nhận biết và kéo đúng nhóm quan tâm' },
                    { name: 'Consideration', objective: 'Nâng niềm tin bằng nội dung + chứng cứ' },
                    { name: 'Conversion', objective: 'Chuyển đổi bằng CTA và form/lead capture' },
                    { name: 'Retention', objective: 'Nurturing sau lead để tăng booking/đăng ký' },
                ],
            },
            content: {
                channels: ['Content Studio', 'Chatbot CSKH', 'Email chăm sóc'],
                themes: [
                    `Angle theo lợi ích cho ${targetArea}`,
                    `Angle theo nỗi đau và giải pháp cho nhóm ${targetProfile}`,
                    `Angle theo case/kinh nghiệm (dạng review)`,
                ],
                formats: ['Short video', 'Carousel', 'Landpage copy', 'Email sequence', 'Chatbot script'],
            },
            ads: {
                strategy: actualAdsSpend !== null && actualAdsSpend !== undefined && actualAdsSpend > 0
                    ? `Đã có spend ${Math.round(actualAdsSpend).toLocaleString('vi-VN')} VND` +
                        (actualRoas !== null && actualRoas !== undefined
                            ? `, ROAS ${actualRoas.toFixed(2)} — ưu tiên scale segment hiệu quả.`
                            : ' — tiếp tục test creative trước khi scale.')
                    : safeBudget >= 20_000_000
                        ? 'Dùng ads để mở rộng phễu, sau đó remarketing bằng CRM segment.'
                        : 'Chủ yếu ưu tiên content + nurturing; ads nếu có chỉ dùng ở mức thử nghiệm.',
                budgetSharePercent: budgetSplit.find((x) => x.channel === 'Facebook Ads')?.percent ?? 0,
            },
            crm: {
                leadScoring: `Scoring theo: mức độ quan tâm (${input.primaryGoal.trim()}), nguồn lead, mức tương tác chatbot.`,
                lifecycle: ['New Lead', 'Qualified', 'Booked/Converted', 'Nurturing', 'Re-activation'],
                segmentation: ['Theo khu vực', 'Theo mục tiêu', 'Theo mức tương tác chatbot'],
            },
            chatbot: {
                purpose: 'Hỏi đáp nhanh, tư vấn đúng nhu cầu và đẩy về CTA đặt lịch',
                keyFlows: [
                    'Chào + phân loại nhu cầu',
                    'Hỏi khu vực & thời gian phù hợp',
                    'Đề xuất gói/giải pháp theo primaryGoal',
                    'Chốt lịch/đăng ký và tạo lead cho CRM',
                ],
            },
            communications,
            emailMessengerZalo: communications,
            remarketing: {
                audiences: ['Đã tương tác nội dung nhưng chưa booking', 'Đã chat nhưng chưa chốt'],
                cadence: 'Nhắc lại trong 7-14-21 ngày theo mức độ tương tác',
                messageTheme: `Giải pháp nhắm vào "${input.primaryGoal.trim()}" + lợi ích theo ${targetArea}`,
            },
            kpi: {
                kpis: [
                    {
                        name: 'Leads / tháng',
                        target: estimatedLeadTarget,
                        unit: 'lead',
                    },
                    {
                        name: 'Booking / tháng',
                        target: estimatedBookings,
                        unit: 'booking',
                    },
                    {
                        name: 'Lead-to-booking rate',
                        target: actualConversion ?? 10,
                        unit: '%',
                    },
                ],
            },
            budget: {
                monthlyBudget: safeBudget,
                split: budgetSplit,
            },
            timeline: {
                phases: [
                    { phase: 'Tuần 1-2', focus: 'Chốt funnel + content outline + lead scoring', durationWeeks: 2 },
                    { phase: 'Tuần 3', focus: 'Soạn chatbot/automation kịch bản + sequence email/Messenger/Zalo', durationWeeks: 1 },
                    { phase: 'Tuần 4', focus: 'Chuẩn bị campaign draft + remarketing segments', durationWeeks: 1 },
                ],
            },
        };
        const risks = [
            'MVP chỉ tạo draft: không thực hiện action thật lên CRM/Funnel/Email/Ads/Facebook.',
            'Kết quả phụ thuộc dữ liệu CRM, tệp khách và creative sẵn có.',
        ];
        if (safeBudget < price) {
            risks.push('Ngân sách tháng đang thấp hơn giá sản phẩm; nên ưu tiên content + nurturing trước scale.');
        }
        const nextSteps = [
            `Preview plan trước khi xác nhận tạo Draft cho project "${input.productName.trim()}".`,
            `Tạo draft Funnel để định nghĩa stages: Awareness → Conversion → Retention.`,
            `Tạo draft Automation/Chatbot để nurturing lead và tăng booking.`,
            `Tạo draft Campaign để đảm bảo thông điệp và CTA nhất quán.`,
        ];
        if (ctx?.insights?.length) {
            for (const insight of ctx.insights.slice(0, 3)) {
                if (insight.confidence !== 'INSUFFICIENT_DATA') {
                    nextSteps.unshift(`${insight.title}: ${insight.summary} (evidence: ${insight.evidence})`);
                }
            }
        }
        const scoreBase = Math.min(90, 40 + Math.round((safeBudget / Math.max(price, 1)) * 5));
        const contextBoost = ctx?.metrics.leads.total && ctx.metrics.leads.total > 20 ? 5 : 0;
        const ranked = (0, shared_1.rankNextBestActionsV3)({
            organizationId: context?.snapshot.organizationId,
            metrics: ctx?.metrics,
            insights: ctx?.insights,
            bottlenecks: ctx?.bottlenecks,
            opportunities: ctx?.opportunities,
            timeRange: ctx?.timeRange ?? null,
            monthlyBudget: safeBudget,
            primaryGoal: input.primaryGoal,
            safety: { draftOnly: true },
            candidates: [
                {
                    type: 'CONTENT_DRAFT',
                    label: 'Content Draft',
                    rationale: 'Tạo outline nội dung theo funnel và KPI lead-to-booking',
                    priority: 2,
                },
                {
                    type: 'FUNNEL_DRAFT',
                    label: 'Funnel Draft',
                    rationale: 'Soạn funnel stages và mục tiêu cho từng stage',
                    priority: 3,
                },
                {
                    type: 'AUTOMATION_DRAFT',
                    label: 'Automation Draft',
                    rationale: 'Chuẩn bị kịch bản chatbot/automation và mapping sang CRM stages',
                    priority: 1,
                },
                {
                    type: 'CAMPAIGN_DRAFT',
                    label: 'Campaign Draft',
                    rationale: 'Tạo draft campaign/remarketing segments + chuỗi email/Messenger/Zalo',
                    priority: 4,
                },
            ],
        });
        const nextBestActions = ranked.map((a) => ({
            type: a.type,
            label: a.label ?? a.title,
            rationale: a.whyNow,
            evidence: {
                reason: a.whyNow,
                evidence: a.evidence,
                source: 'nba-engine-v3',
                confidence: a.confidence,
                expectedImpact: a.expectedImpact,
                riskLevel: a.riskLevel,
            },
            priority: a.priority,
            title: a.title,
            whyNow: a.whyNow,
            confidence: a.confidence,
            expectedImpact: a.expectedImpact,
            estimatedCost: a.estimatedCost,
            riskLevel: a.riskLevel,
            recommendedDraft: a.recommendedDraft,
            evidenceText: a.evidence,
        }));
        const simSource = (0, shared_1.pickBudgetSimSource)({
            metrics: ctx?.metrics,
            timeRange: ctx?.timeRange ?? null,
            windows: ctx?.windows,
            productPrice: price,
        });
        const budgetScenarios = (0, shared_1.simulateBudgetScenarios)({
            metrics: simSource.metrics,
            productPrice: price,
            customBudget: safeBudget,
            timeRange: simSource.timeRange ?? null,
        });
        return {
            summary: `Autopilot (context-aware) đề xuất triển khai "${input.primaryGoal.trim()}" cho "${input.productName.trim()}" ` +
                `theo khu vực ${targetArea}.` +
                (actualLeads ? ` Dữ liệu thật: ${actualLeads} lead trong 30 ngày.` : ' Chưa đủ dữ liệu lead — dùng ước tính.') +
                ` MVP sẽ tạo draft để bạn review trước khi bật action thật.`,
            score: Math.max(45, scoreBase + contextBoost),
            suggestedChannels,
            risks,
            nextSteps,
            budgetSplit,
            plan,
            nextBestActions,
            budgetScenarios,
            nbaEngine: {
                version: 'v3',
                rankedAt: new Date().toISOString(),
                maxActions: 5,
            },
            contextUsed: ctx
                ? {
                    snapshotId: context?.snapshotId ?? null,
                    generatedAt: ctx.generatedAt,
                    insightCount: ctx.insights.length,
                    topInsights: ctx.insights.slice(0, 5).map((i) => ({
                        title: i.title,
                        evidence: i.evidence,
                        confidence: i.confidence,
                    })),
                }
                : undefined,
            plannerMeta: {
                engine: 'heuristic-orchestrator',
                usedLlm: false,
                fallbackReason: null,
            },
            safety: {
                policy: 'READ_ONLY',
                highRiskActionSuggestionsBlocked: [],
            },
        };
    }
    assertEnabled() {
        if (!this.isEnabled()) {
            throw new common_1.NotFoundException('Marketing Autopilot chưa được bật');
        }
    }
    async loadProjectPlan(user, projectId) {
        const project = await this.prisma.marketingAutopilotProject.findFirst({
            where: { id: projectId, organizationId: user.organizationId },
            include: { analyses: { take: 1, orderBy: { createdAt: 'desc' } } },
        });
        if (!project)
            throw new common_1.NotFoundException('Không tìm thấy project Marketing Autopilot');
        const analysis = (project.analyses?.[0]?.recommendationJson ??
            project.analysisJson);
        const plan = (0, shared_1.normalizeAutopilotPlanForDraft)(analysis?.plan ?? analysis, {
            productName: project.productName,
            primaryGoal: project.primaryGoal,
            customerProfile: project.customerProfile,
            targetArea: project.targetArea,
            productPrice: Number(project.productPrice) || undefined,
        });
        return { project, plan };
    }
    async getProjectContentIdeas(user, projectId) {
        this.assertEnabled();
        const { project } = await this.loadProjectPlan(user, projectId);
        const contentDraft = await this.prisma.marketingAutopilotDraft.findFirst({
            where: { projectId, organizationId: user.organizationId, type: 'CONTENT_DRAFT' },
            orderBy: { createdAt: 'desc' },
        });
        const payload = (contentDraft?.payload ?? {});
        const metaIdeas = payload.adapter?.metadata?.contentIdeas;
        if (Array.isArray(metaIdeas) && metaIdeas.length >= 5) {
            return {
                projectId,
                contentId: payload.adapter?.externalEntityId ?? contentDraft?.id,
                ideas: metaIdeas,
                draftOnly: true,
            };
        }
        const tele = await this.prisma.contentTeleprompterSource.findFirst({
            where: {
                organizationId: user.organizationId,
                userId: user.id,
                clientContentId: `autopilot-content-${projectId}`,
            },
            orderBy: { updatedAt: 'desc' },
        });
        const bundle = tele ? (0, shared_1.parseAutopilotContentBundleFromScript)(tele.editedScript) : null;
        return {
            projectId,
            contentId: tele?.id ?? null,
            ideas: bundle?.ideas ?? [],
            draftOnly: true,
        };
    }
    async regenerateProjectContentDraft(user, projectId, ideaIndex) {
        this.assertEnabled();
        const { project, plan } = await this.loadProjectPlan(user, projectId);
        const existing = await this.prisma.contentTeleprompterSource.findFirst({
            where: {
                organizationId: user.organizationId,
                userId: user.id,
                clientContentId: `autopilot-content-${projectId}`,
            },
        });
        let bundle = await this.contentDraft.generateBundle(plan, {
            id: project.id,
            name: project.name,
            productName: project.productName,
            productPrice: Number(project.productPrice) || undefined,
            customerProfile: project.customerProfile,
            targetArea: project.targetArea,
            primaryGoal: project.primaryGoal,
        });
        if (ideaIndex != null && ideaIndex >= 1 && ideaIndex <= 5) {
            const current = existing
                ? (0, shared_1.parseAutopilotContentBundleFromScript)(existing.editedScript)
                : null;
            if (current?.ideas?.length) {
                const input = this.contentDraft.buildInputFromPlan(plan, {
                    productName: project.productName,
                    productPrice: Number(project.productPrice) || undefined,
                    customerProfile: project.customerProfile,
                    targetArea: project.targetArea,
                    primaryGoal: project.primaryGoal,
                });
                const fresh = (0, shared_1.generateAutopilotContentIdeas)(input, { variantSeed: Date.now() + ideaIndex });
                const replacement = fresh.ideas[ideaIndex - 1];
                if (replacement) {
                    bundle = {
                        ...current,
                        ideas: current.ideas.map((i) => (i.index === ideaIndex ? { ...replacement, index: ideaIndex } : i)),
                    };
                }
            }
        }
        const row = await this.contentDraft.upsertTeleprompterFromBundle(user, { id: project.id, name: project.name }, bundle, existing?.id);
        return {
            contentId: row.id,
            editUrl: (0, shared_1.resolveAutopilotDraftEditUrl)('CONTENT_DRAFT', row.id),
            ideas: bundle.ideas,
            draftOnly: true,
        };
    }
    async saveContentIdeaToStudio(user, projectId, ideaIndex) {
        this.assertEnabled();
        const { project } = await this.loadProjectPlan(user, projectId);
        const loaded = await this.getProjectContentIdeas(user, projectId);
        const idea = loaded.ideas.find((i) => i.index === ideaIndex);
        if (!idea)
            throw new common_1.NotFoundException(`Không tìm thấy content idea #${ideaIndex}`);
        const row = await this.contentDraft.saveIdeaToStudio(user, { id: project.id, name: project.name }, idea);
        return {
            contentId: row.id,
            editUrl: (0, shared_1.resolveAutopilotDraftEditUrl)('CONTENT_DRAFT', row.id),
            draftOnly: true,
        };
    }
};
exports.MarketingAutopilotService = MarketingAutopilotService;
exports.MarketingAutopilotService = MarketingAutopilotService = MarketingAutopilotService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        audit_service_1.AuditService,
        marketing_autopilot_draft_adapter_1.MarketingAutopilotDraftAdapter,
        marketing_autopilot_content_draft_service_1.MarketingAutopilotContentDraftService,
        marketing_context_engine_service_1.MarketingContextEngineService,
        marketing_autopilot_planner_service_1.MarketingAutopilotPlannerService,
        marketing_autopilot_outcome_learning_service_1.MarketingAutopilotOutcomeLearningService,
        marketing_mission_orchestrator_service_1.MarketingMissionOrchestratorService])
], MarketingAutopilotService);
