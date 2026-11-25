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
var FunnelBuilderService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FunnelBuilderService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../prisma/prisma.service");
const openai_service_1 = require("../openai/openai.service");
const pipeline_service_1 = require("../crm/pipeline.service");
const automation_service_1 = require("../automation/automation.service");
let FunnelBuilderService = FunnelBuilderService_1 = class FunnelBuilderService {
    prisma;
    openAi;
    pipeline;
    automation;
    logger = new common_1.Logger(FunnelBuilderService_1.name);
    constructor(prisma, openAi, pipeline, automation) {
        this.prisma = prisma;
        this.openAi = openAi;
        this.pipeline = pipeline;
        this.automation = automation;
    }
    listBlueprints(organizationId, query) {
        return this.prisma.funnelBlueprint.findMany({
            where: {
                organizationId,
                ...(query.status && { status: query.status }),
            },
            orderBy: { createdAt: 'desc' },
            take: query.take ?? 20,
            select: {
                id: true,
                name: true,
                prompt: true,
                status: true,
                source: true,
                summary: true,
                createdAt: true,
                appliedAt: true,
            },
        });
    }
    async getBlueprint(organizationId, id) {
        const row = await this.prisma.funnelBlueprint.findFirst({
            where: { id, organizationId },
        });
        if (!row)
            throw new common_1.NotFoundException('Funnel blueprint not found');
        return row;
    }
    async generate(user, dto) {
        const includeAutomations = dto.includeAutomations !== false;
        let draft;
        let source = 'fallback';
        try {
            if (this.openAi.isConfigured()) {
                draft = await this.generateWithAi(dto.prompt, dto.industryHint, includeAutomations);
                source = 'ai';
            }
            else {
                draft = (0, shared_1.normalizeFunnelBlueprintDraft)((0, shared_1.buildDefaultFunnelBlueprintDraft)(dto.prompt, {
                    industryHint: dto.industryHint,
                    flows: includeAutomations
                        ? undefined
                        : [],
                }));
                if (!includeAutomations) {
                    draft = { ...draft, flows: [] };
                }
            }
        }
        catch (err) {
            this.logger.warn(`AI funnel generate failed, using fallback: ${String(err)}`);
            draft = (0, shared_1.normalizeFunnelBlueprintDraft)((0, shared_1.buildDefaultFunnelBlueprintDraft)(dto.prompt, {
                industryHint: dto.industryHint,
            }));
            if (!includeAutomations)
                draft = { ...draft, flows: [] };
            source = 'fallback';
        }
        draft = (0, shared_1.normalizeFunnelBlueprintDraft)(draft);
        const row = await this.prisma.funnelBlueprint.create({
            data: {
                organizationId: user.organizationId,
                createdById: user.id,
                name: draft.name,
                prompt: dto.prompt,
                draft: draft,
                status: database_1.FunnelBlueprintStatus.DRAFT,
                source,
                summary: draft.summary,
            },
        });
        return {
            id: row.id,
            name: row.name,
            status: row.status,
            source: row.source,
            summary: row.summary,
            draft,
            createdAt: row.createdAt,
        };
    }
    async apply(user, dto, canActivateFlows) {
        const applyStages = dto.applyStages !== false;
        const applyFlows = dto.applyFlows !== false;
        let blueprintId = dto.blueprintId;
        let draft;
        if (dto.blueprintId) {
            const row = await this.getBlueprint(user.organizationId, dto.blueprintId);
            draft = (0, shared_1.normalizeFunnelBlueprintDraft)((0, shared_1.parseFunnelBlueprintDraft)(row.draft));
            blueprintId = row.id;
        }
        else if (dto.draft) {
            draft = (0, shared_1.normalizeFunnelBlueprintDraft)((0, shared_1.parseFunnelBlueprintDraft)(dto.draft));
            const created = await this.prisma.funnelBlueprint.create({
                data: {
                    organizationId: user.organizationId,
                    createdById: user.id,
                    name: draft.name,
                    prompt: draft.summary ?? draft.name,
                    draft: draft,
                    status: database_1.FunnelBlueprintStatus.DRAFT,
                    source: 'manual',
                    summary: draft.summary,
                },
            });
            blueprintId = created.id;
        }
        else {
            throw new common_1.BadRequestException('Cần blueprintId hoặc draft');
        }
        if (dto.activateFlows === true && canActivateFlows) {
            const validation = (0, shared_1.validateFunnelBlueprintDraft)(draft);
            if (!validation.canActivate) {
                throw new common_1.BadRequestException({
                    message: 'Funnel chưa đạt điểm activate — chạy validator trước',
                    score: validation.score,
                    blocking: validation.blocking,
                    warnings: validation.warnings,
                });
            }
        }
        const stageResult = applyStages
            ? await this.pipeline.applyStageProposals(user.organizationId, draft.stages.map((s) => ({
                name: s.name,
                code: s.code,
                position: s.position,
                color: s.color,
                category: s.category,
                probability: s.probability,
                slaMinutes: s.slaMinutes,
                isWon: s.isWon,
                isLost: s.isLost ?? s.isLostStage,
            })), { deactivateMissing: dto.deactivateMissingStages === true })
            : { stages: [], pipeline: await this.pipeline.listStages(user.organizationId), pipelineId: undefined };
        const createdFlows = [];
        if (applyFlows && draft.flows.length > 0) {
            const activate = dto.activateFlows === true && canActivateFlows;
            for (const flow of draft.flows) {
                const created = await this.automation.createFlow(user.organizationId, {
                    name: flow.name,
                    triggerType: flow.triggerType,
                    funnelId: dto.funnelId,
                    delayMinutes: flow.delayMinutes ?? 0,
                    channel: flow.channel,
                    actions: flow.actions,
                    isActive: activate,
                    isPaused: false,
                }, user.id, canActivateFlows);
                createdFlows.push({
                    id: created.id,
                    name: created.name,
                    triggerType: created.triggerType,
                });
            }
        }
        const appliedMeta = {
            stagesApplied: stageResult.stages.length,
            flowsCreated: createdFlows.length,
            activateFlows: dto.activateFlows === true && canActivateFlows,
        };
        await this.prisma.funnelBlueprint.update({
            where: { id: blueprintId },
            data: {
                status: database_1.FunnelBlueprintStatus.APPLIED,
                appliedAt: new Date(),
                appliedMeta: appliedMeta,
                draft: draft,
                name: draft.name,
                summary: draft.summary,
            },
        });
        return {
            blueprintId,
            draft,
            stages: stageResult.stages,
            pipeline: stageResult.pipeline,
            flows: createdFlows,
            meta: appliedMeta,
        };
    }
    async discard(organizationId, id) {
        await this.getBlueprint(organizationId, id);
        return this.prisma.funnelBlueprint.update({
            where: { id },
            data: { status: database_1.FunnelBlueprintStatus.DISCARDED },
            select: { id: true, status: true },
        });
    }
    async generateWithAi(prompt, industryHint, includeAutomations) {
        const system = `Bạn là kiến trúc sư phễu CRM cho SaaS spa/beauty multi-tenant.
Trả về ĐÚNG 1 JSON object (không markdown) theo schema:
{
  "name": string,
  "summary": string,
  "industryHint": string,
  "stages": [{ "name": string, "code": string, "category"?: "OPEN"|"IN_PROGRESS"|"QUALIFIED"|"BOOKING"|"WON"|"LOST"|"CUSTOM", "position": number, "color"?: "#hex", "probability"?: number, "slaMinutes"?: number, "isWon"?: boolean, "isLost"?: boolean }],
  "flows": [{ "name": string, "triggerType": "LEAD_CREATED"|"LEAD_UNTOUCHED"|"LEAD_BOOKED"|"APPOINTMENT_CREATED"|"APPOINTMENT_24H_BEFORE"|"APPOINTMENT_2H_BEFORE"|"NO_SHOW"|"ORDER_COMPLETED"|"MANUAL"|..., "delayMinutes"?: number, "channel"?: "SMS"|"ZALO"|"EMAIL"|"MESSENGER", "actions": [{ "type": "CREATE_TASK"|"CHANGE_STATUS"|"ADD_TAG"|"ASSIGN_EMPLOYEE"|"SEND_MESSAGE"|"SEND_EMAIL"|"CREATE_APPOINTMENT", ... }], "rationale"?: string }]
}
Quy tắc:
- Stage code tự do trong pipeline; với spa nên dùng NEW/CONTACTED/QUALIFIED/BOOKED/CONFIRMED/VISITED/PURCHASED/LOST để tương thích legacy.
- Mỗi code xuất hiện tối đa 1 lần.
- LOST → isLost=true, category=LOST; PURCHASED → isWon=true, category=WON.
- flows dùng action types đã liệt kê; CHANGE_STATUS có thể dùng pipelineStatus (code) hoặc stageId.
- ${includeAutomations ? 'Tạo 2–5 flows thực tế.' : 'flows phải là [].'}
- Ngôn ngữ tên stage/flow: tiếng Việt.`;
        const userMsg = [
            `Yêu cầu người dùng: ${prompt}`,
            industryHint ? `Ngành gợi ý: ${industryHint}` : null,
        ]
            .filter(Boolean)
            .join('\n');
        const raw = await this.openAi.chatCompletion({
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: userMsg },
            ],
            temperature: 0.4,
            maxTokens: 2000,
            timeoutMs: 45_000,
        });
        const jsonText = extractJsonObject(raw);
        const parsed = (0, shared_1.parseFunnelBlueprintDraft)(JSON.parse(jsonText));
        if (!includeAutomations) {
            return (0, shared_1.normalizeFunnelBlueprintDraft)({ ...parsed, flows: [] });
        }
        return (0, shared_1.normalizeFunnelBlueprintDraft)(parsed);
    }
};
exports.FunnelBuilderService = FunnelBuilderService;
exports.FunnelBuilderService = FunnelBuilderService = FunnelBuilderService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        openai_service_1.OpenAiService,
        pipeline_service_1.PipelineService,
        automation_service_1.AutomationService])
], FunnelBuilderService);
function extractJsonObject(text) {
    const trimmed = text.trim();
    if (trimmed.startsWith('{'))
        return trimmed;
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence?.[1])
        return fence[1].trim();
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start)
        return trimmed.slice(start, end + 1);
    throw new Error('AI response is not JSON');
}
