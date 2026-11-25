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
exports.PipelineService = exports.DEFAULT_PIPELINE = exports.DEFAULT_PIPELINE_STAGES = void 0;
exports.parseLegacyStatus = parseLegacyStatus;
exports.categoryForLegacy = categoryForLegacy;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
/** Canonical spa default stages — codes mirror LeadPipelineStatus for legacy compat */
exports.DEFAULT_PIPELINE_STAGES = [
    {
        name: 'Lead mới',
        code: 'NEW',
        category: database_1.FunnelStageCategory.OPEN,
        position: 0,
        color: '#3b82f6',
        probability: 10,
        slaMinutes: 15,
        legacyStatus: database_1.LeadPipelineStatus.NEW,
    },
    {
        name: 'Đã liên hệ',
        code: 'CONTACTED',
        category: database_1.FunnelStageCategory.IN_PROGRESS,
        position: 1,
        color: '#06b6d4',
        probability: 20,
        slaMinutes: 60,
        legacyStatus: database_1.LeadPipelineStatus.CONTACTED,
    },
    {
        name: 'Đủ điều kiện',
        code: 'QUALIFIED',
        category: database_1.FunnelStageCategory.QUALIFIED,
        position: 2,
        color: '#8b5cf6',
        probability: 40,
        slaMinutes: 120,
        legacyStatus: database_1.LeadPipelineStatus.QUALIFIED,
    },
    {
        name: 'Đã đặt lịch',
        code: 'BOOKED',
        category: database_1.FunnelStageCategory.BOOKING,
        position: 3,
        color: '#f59e0b',
        probability: 50,
        slaMinutes: 1440,
        legacyStatus: database_1.LeadPipelineStatus.BOOKED,
    },
    {
        name: 'Đã xác nhận',
        code: 'CONFIRMED',
        category: database_1.FunnelStageCategory.BOOKING,
        position: 4,
        color: '#f97316',
        probability: 60,
        slaMinutes: 720,
        legacyStatus: database_1.LeadPipelineStatus.CONFIRMED,
    },
    {
        name: 'Đã đến',
        code: 'VISITED',
        category: database_1.FunnelStageCategory.BOOKING,
        position: 5,
        color: '#a855f7',
        probability: 70,
        legacyStatus: database_1.LeadPipelineStatus.VISITED,
    },
    {
        name: 'Đã mua',
        code: 'PURCHASED',
        category: database_1.FunnelStageCategory.WON,
        position: 6,
        color: '#22c55e',
        probability: 100,
        isWon: true,
        legacyStatus: database_1.LeadPipelineStatus.PURCHASED,
    },
    {
        name: 'Mất lead',
        code: 'LOST',
        category: database_1.FunnelStageCategory.LOST,
        position: 7,
        color: '#9ca3af',
        probability: 0,
        isLost: true,
        legacyStatus: database_1.LeadPipelineStatus.LOST,
    },
];
/** @deprecated alias — use DEFAULT_PIPELINE_STAGES */
exports.DEFAULT_PIPELINE = exports.DEFAULT_PIPELINE_STAGES.map((s) => ({
    name: s.name,
    code: s.legacyStatus,
    position: s.position,
    color: s.color,
    isLostStage: !!s.isLost,
}));
const LEGACY_STATUS_SET = new Set(Object.values(database_1.LeadPipelineStatus));
function parseLegacyStatus(code) {
    if (!code)
        return null;
    return LEGACY_STATUS_SET.has(code) ? code : null;
}
function categoryForLegacy(status) {
    switch (status) {
        case database_1.LeadPipelineStatus.NEW:
            return database_1.FunnelStageCategory.OPEN;
        case database_1.LeadPipelineStatus.CONTACTED:
            return database_1.FunnelStageCategory.IN_PROGRESS;
        case database_1.LeadPipelineStatus.QUALIFIED:
            return database_1.FunnelStageCategory.QUALIFIED;
        case database_1.LeadPipelineStatus.BOOKED:
        case database_1.LeadPipelineStatus.CONFIRMED:
        case database_1.LeadPipelineStatus.VISITED:
            return database_1.FunnelStageCategory.BOOKING;
        case database_1.LeadPipelineStatus.PURCHASED:
            return database_1.FunnelStageCategory.WON;
        case database_1.LeadPipelineStatus.LOST:
            return database_1.FunnelStageCategory.LOST;
        default:
            return database_1.FunnelStageCategory.CUSTOM;
    }
}
let PipelineService = class PipelineService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async ensureDefaultPipeline(organizationId) {
        let pipeline = await this.prisma.funnelPipeline.findFirst({
            where: { organizationId, isDefault: true, isActive: true },
            orderBy: { position: 'asc' },
        });
        if (!pipeline) {
            pipeline = await this.prisma.funnelPipeline.create({
                data: {
                    organizationId,
                    name: 'Pipeline mặc định',
                    description: 'Default spa/beauty pipeline',
                    isDefault: true,
                    isActive: true,
                    position: 0,
                },
            });
        }
        const stageCount = await this.prisma.funnelStage.count({
            where: { organizationId, pipelineId: pipeline.id },
        });
        if (stageCount === 0) {
            await this.prisma.funnelStage.createMany({
                data: exports.DEFAULT_PIPELINE_STAGES.map((s) => ({
                    organizationId,
                    pipelineId: pipeline.id,
                    name: s.name,
                    code: s.code,
                    category: s.category,
                    position: s.position,
                    color: s.color,
                    probability: new database_1.Prisma.Decimal(s.probability),
                    slaMinutes: s.slaMinutes ?? null,
                    isWon: !!s.isWon,
                    isLost: !!s.isLost,
                    isDefault: s.code === 'NEW',
                    isActive: true,
                    legacyStatus: s.legacyStatus ?? null,
                })),
            });
        }
        else {
            // Backfill legacyStatus / category gaps for older rows
            for (const seed of exports.DEFAULT_PIPELINE_STAGES) {
                await this.prisma.funnelStage.updateMany({
                    where: {
                        organizationId,
                        pipelineId: pipeline.id,
                        code: seed.code,
                        legacyStatus: null,
                    },
                    data: {
                        legacyStatus: seed.legacyStatus,
                        category: seed.category,
                        isWon: !!seed.isWon,
                        isLost: !!seed.isLost,
                    },
                });
            }
        }
        return this.getPipelineWithStages(organizationId, pipeline.id);
    }
    listPipelines(organizationId) {
        return this.prisma.funnelPipeline.findMany({
            where: { organizationId, isActive: true },
            orderBy: [{ isDefault: 'desc' }, { position: 'asc' }],
            include: {
                stages: {
                    where: { isActive: true },
                    orderBy: { position: 'asc' },
                },
            },
        });
    }
    async getPipelineWithStages(organizationId, pipelineId) {
        const pipeline = pipelineId
            ? await this.prisma.funnelPipeline.findFirst({
                where: { id: pipelineId, organizationId },
            })
            : await this.prisma.funnelPipeline.findFirst({
                where: { organizationId, isDefault: true, isActive: true },
                orderBy: { position: 'asc' },
            });
        if (!pipeline) {
            return this.ensureDefaultPipeline(organizationId);
        }
        const stages = await this.prisma.funnelStage.findMany({
            where: { organizationId, pipelineId: pipeline.id, isActive: true },
            orderBy: { position: 'asc' },
        });
        return { ...pipeline, stages };
    }
    /** Flat active stages for default pipeline — backward compatible with old listStages() */
    async listStages(organizationId, pipelineId) {
        const pipeline = await this.ensureDefaultPipeline(organizationId);
        const pid = pipelineId ?? pipeline.id;
        return this.prisma.funnelStage.findMany({
            where: { organizationId, pipelineId: pid, isActive: true },
            orderBy: { position: 'asc' },
        });
    }
    async upsertStage(organizationId, data) {
        const defaultPipe = await this.ensureDefaultPipeline(organizationId);
        const pipelineId = data.pipelineId ?? defaultPipe.id;
        const ownedPipe = await this.prisma.funnelPipeline.findFirst({
            where: { id: pipelineId, organizationId },
        });
        if (!ownedPipe)
            throw new common_1.NotFoundException('Funnel pipeline not found');
        const isLost = data.isLost ?? data.isLostStage;
        const code = (data.code ?? data.name).trim().toUpperCase().replace(/\s+/g, '_');
        const legacyStatus = parseLegacyStatus(code);
        if (data.id) {
            const owned = await this.prisma.funnelStage.findFirst({
                where: { id: data.id, organizationId },
            });
            if (!owned)
                throw new common_1.NotFoundException('Funnel stage not found');
            return this.prisma.funnelStage.update({
                where: { id: data.id },
                data: {
                    name: data.name,
                    code: data.code ?? owned.code,
                    category: data.category,
                    position: data.position,
                    color: data.color,
                    probability: data.probability !== undefined
                        ? new database_1.Prisma.Decimal(data.probability)
                        : undefined,
                    slaMinutes: data.slaMinutes === undefined ? undefined : data.slaMinutes,
                    isWon: data.isWon,
                    isLost,
                    isActive: data.isActive,
                    legacyStatus: data.code !== undefined ? legacyStatus : undefined,
                },
            });
        }
        return this.prisma.funnelStage.create({
            data: {
                organizationId,
                pipelineId,
                name: data.name,
                code,
                category: data.category ?? (legacyStatus ? categoryForLegacy(legacyStatus) : database_1.FunnelStageCategory.CUSTOM),
                position: data.position ?? 99,
                color: data.color,
                probability: new database_1.Prisma.Decimal(data.probability ?? 0),
                slaMinutes: data.slaMinutes ?? null,
                isWon: data.isWon ?? legacyStatus === database_1.LeadPipelineStatus.PURCHASED,
                isLost: isLost ?? legacyStatus === database_1.LeadPipelineStatus.LOST,
                isActive: data.isActive ?? true,
                isDefault: code === 'NEW',
                legacyStatus,
            },
        });
    }
    async deactivateStage(organizationId, id) {
        return this.prisma.funnelStage.updateMany({
            where: { id, organizationId },
            data: { isActive: false },
        });
    }
    async resolveStageForStatus(organizationId, status, pipelineId) {
        const pipeline = await this.ensureDefaultPipeline(organizationId);
        const pid = pipelineId ?? pipeline.id;
        return this.prisma.funnelStage.findFirst({
            where: {
                organizationId,
                pipelineId: pid,
                isActive: true,
                OR: [{ legacyStatus: status }, { code: status }],
            },
            orderBy: { position: 'asc' },
        });
    }
    async resolveStageById(organizationId, stageId) {
        const stage = await this.prisma.funnelStage.findFirst({
            where: { id: stageId, organizationId, isActive: true },
        });
        if (!stage)
            throw new common_1.NotFoundException('Funnel stage not found');
        return stage;
    }
    /**
     * Dual-write payload for Lead: stage + pipeline + legacy pipelineStatus when mappable.
     */
    leadPointersFromStage(stage) {
        const legacy = stage.legacyStatus ??
            parseLegacyStatus(stage.code) ??
            (stage.isWon
                ? database_1.LeadPipelineStatus.PURCHASED
                : stage.isLost
                    ? database_1.LeadPipelineStatus.LOST
                    : undefined);
        return {
            stageId: stage.id,
            pipelineId: stage.pipelineId,
            ...(legacy ? { pipelineStatus: legacy } : {}),
        };
    }
    async applyStageProposals(organizationId, stages, opts) {
        const pipeline = await this.ensureDefaultPipeline(organizationId);
        const pipelineId = opts?.pipelineId ?? pipeline.id;
        const owned = await this.prisma.funnelPipeline.findFirst({
            where: { id: pipelineId, organizationId },
        });
        if (!owned)
            throw new common_1.BadRequestException('Invalid pipelineId');
        const existing = await this.prisma.funnelStage.findMany({
            where: { organizationId, pipelineId },
        });
        const byCode = new Map(existing.map((s) => [s.code.toUpperCase(), s]));
        const applied = [];
        for (const proposal of stages) {
            const code = proposal.code.trim().toUpperCase().replace(/\s+/g, '_');
            const legacyStatus = parseLegacyStatus(code);
            const isLost = proposal.isLost ?? proposal.isLostStage ?? code === 'LOST';
            const isWon = proposal.isWon ?? code === 'PURCHASED';
            const category = proposal.category ??
                (legacyStatus ? categoryForLegacy(legacyStatus) : database_1.FunnelStageCategory.CUSTOM);
            const row = byCode.get(code);
            if (row) {
                const updated = await this.prisma.funnelStage.update({
                    where: { id: row.id },
                    data: {
                        name: proposal.name,
                        position: proposal.position,
                        color: proposal.color ?? row.color,
                        category,
                        probability: new database_1.Prisma.Decimal(proposal.probability ?? Number(row.probability)),
                        slaMinutes: proposal.slaMinutes === undefined ? row.slaMinutes : proposal.slaMinutes,
                        isWon,
                        isLost,
                        isActive: true,
                        isDefault: code === 'NEW',
                        legacyStatus: legacyStatus ?? row.legacyStatus,
                    },
                });
                applied.push({ id: updated.id, code, name: updated.name });
            }
            else {
                const nameTaken = existing.find((s) => s.name === proposal.name);
                const name = nameTaken ? `${proposal.name} (${code})` : proposal.name;
                const created = await this.prisma.funnelStage.create({
                    data: {
                        organizationId,
                        pipelineId,
                        name,
                        code,
                        category,
                        position: proposal.position,
                        color: proposal.color,
                        probability: new database_1.Prisma.Decimal(proposal.probability ?? 0),
                        slaMinutes: proposal.slaMinutes ?? null,
                        isWon,
                        isLost,
                        isDefault: code === 'NEW',
                        isActive: true,
                        legacyStatus,
                    },
                });
                applied.push({ id: created.id, code, name: created.name });
                existing.push(created);
                byCode.set(code, created);
            }
        }
        if (opts?.deactivateMissing) {
            const keep = new Set(stages.map((s) => s.code.trim().toUpperCase().replace(/\s+/g, '_')));
            await this.prisma.funnelStage.updateMany({
                where: {
                    organizationId,
                    pipelineId,
                    isActive: true,
                    code: { notIn: [...keep] },
                },
                data: { isActive: false },
            });
        }
        return {
            pipelineId,
            stages: applied,
            pipeline: await this.listStages(organizationId, pipelineId),
        };
    }
};
exports.PipelineService = PipelineService;
exports.PipelineService = PipelineService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PipelineService);
