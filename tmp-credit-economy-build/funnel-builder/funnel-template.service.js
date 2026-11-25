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
var FunnelTemplateService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FunnelTemplateService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../prisma/prisma.service");
const funnel_builder_service_1 = require("./funnel-builder.service");
let FunnelTemplateService = FunnelTemplateService_1 = class FunnelTemplateService {
    prisma;
    funnelBuilder;
    logger = new common_1.Logger(FunnelTemplateService_1.name);
    constructor(prisma, funnelBuilder) {
        this.prisma = prisma;
        this.funnelBuilder = funnelBuilder;
    }
    async onModuleInit() {
        try {
            await this.ensureSystemTemplates();
        }
        catch (err) {
            this.logger.warn(`ensureSystemTemplates skipped: ${String(err)}`);
        }
    }
    /** Idempotent seed of 10 system templates from shared catalog */
    async ensureSystemTemplates() {
        for (const def of shared_1.DEFAULT_FUNNEL_TEMPLATES) {
            const existing = await this.prisma.funnelTemplate.findFirst({
                where: { organizationId: null, isSystem: true, slug: def.slug },
            });
            const payload = this.toRowData(def, {
                organizationId: null,
                isSystem: true,
                sourceTemplateId: null,
            });
            if (existing) {
                await this.prisma.funnelTemplate.update({
                    where: { id: existing.id },
                    data: {
                        ...payload,
                        version: existing.version,
                        updatedAt: new Date(),
                    },
                });
            }
            else {
                await this.prisma.funnelTemplate.create({ data: payload });
            }
        }
        return { synced: shared_1.DEFAULT_FUNNEL_TEMPLATES.length };
    }
    async list(organizationId, query) {
        await this.ensureSystemTemplates();
        const includeSystem = query.orgOnly === true ? false : query.includeSystem !== false;
        const items = await this.prisma.funnelTemplate.findMany({
            where: {
                isActive: true,
                ...(query.category ? { category: query.category } : {}),
                OR: [
                    ...(includeSystem ? [{ organizationId: null, isSystem: true }] : []),
                    { organizationId },
                ],
            },
            orderBy: [{ isSystem: 'desc' }, { category: 'asc' }, { name: 'asc' }],
            select: {
                id: true,
                organizationId: true,
                sourceTemplateId: true,
                slug: true,
                name: true,
                description: true,
                category: true,
                tags: true,
                goal: true,
                requiredInputs: true,
                isSystem: true,
                version: true,
                createdAt: true,
                updatedAt: true,
                _count: { select: { clones: true } },
            },
        });
        return { items };
    }
    async get(organizationId, idOrSlug) {
        await this.ensureSystemTemplates();
        const row = await this.prisma.funnelTemplate.findFirst({
            where: {
                OR: [
                    { id: idOrSlug, organizationId: null, isSystem: true },
                    { id: idOrSlug, organizationId },
                    { slug: idOrSlug, organizationId: null, isSystem: true },
                    { slug: idOrSlug, organizationId },
                ],
            },
        });
        if (!row)
            throw new common_1.NotFoundException('Funnel template not found');
        return this.serialize(row);
    }
    async clone(user, idOrSlug, dto) {
        const source = await this.getOwnedOrSystem(user.organizationId, idOrSlug);
        const def = (0, shared_1.parseFunnelTemplateDefinition)(source.definition);
        const slugBase = (dto.slug ?? `${def.slug}-copy`).toLowerCase().replace(/[^a-z0-9-]+/g, '-');
        const slug = await this.uniqueOrgSlug(user.organizationId, slugBase);
        const name = dto.name ?? `${def.name} (org)`;
        const customized = this.applyInputValues(def, dto.inputValues);
        const row = await this.prisma.funnelTemplate.create({
            data: this.toRowData({ ...customized, slug, name }, {
                organizationId: user.organizationId,
                isSystem: false,
                sourceTemplateId: source.id,
                createdById: user.id,
            }),
        });
        return this.serialize(row);
    }
    async update(user, id, dto) {
        const existing = await this.prisma.funnelTemplate.findFirst({
            where: { id, organizationId: user.organizationId, isSystem: false },
        });
        if (!existing) {
            throw new common_1.NotFoundException('Chỉ chỉnh được template đã clone về tổ chức');
        }
        let definition = (0, shared_1.parseFunnelTemplateDefinition)(existing.definition);
        if (dto.definition) {
            definition = (0, shared_1.parseFunnelTemplateDefinition)({
                ...definition,
                ...dto.definition,
                slug: definition.slug,
            });
        }
        else {
            definition = (0, shared_1.parseFunnelTemplateDefinition)({
                ...definition,
                name: dto.name ?? definition.name,
                description: dto.description ?? definition.description,
                category: dto.category ?? definition.category,
                tags: dto.tags ?? definition.tags,
                goal: dto.goal ?? definition.goal,
                requiredInputs: dto.requiredInputs ?? definition.requiredInputs,
                nodes: dto.nodes ?? definition.nodes,
                connections: dto.connections ?? definition.connections,
                recommendedAutomation: dto.recommendedAutomation ?? definition.recommendedAutomation,
            });
        }
        const updated = await this.prisma.funnelTemplate.update({
            where: { id },
            data: {
                name: definition.name,
                description: definition.description,
                category: definition.category,
                tags: definition.tags,
                goal: definition.goal,
                requiredInputs: definition.requiredInputs,
                nodes: definition.nodes,
                connections: definition.connections,
                recommendedAutomation: definition.recommendedAutomation,
                definition: definition,
                isActive: dto.isActive ?? existing.isActive,
                version: existing.version + 1,
            },
        });
        return this.serialize(updated);
    }
    async discard(organizationId, id) {
        const existing = await this.prisma.funnelTemplate.findFirst({
            where: { id, organizationId, isSystem: false },
        });
        if (!existing)
            throw new common_1.NotFoundException('Org template not found');
        return this.prisma.funnelTemplate.update({
            where: { id },
            data: { isActive: false },
            select: { id: true, isActive: true },
        });
    }
    /**
     * Clone-if-needed → create blueprint from template → apply stages/flows via FunnelBuilderService
     */
    async apply(user, idOrSlug, dto, canActivateFlows) {
        let template = await this.prisma.funnelTemplate.findFirst({
            where: {
                OR: [
                    { id: idOrSlug, organizationId: user.organizationId },
                    { slug: idOrSlug, organizationId: user.organizationId },
                ],
                isActive: true,
            },
        });
        if (!template) {
            // Auto-clone system template then apply
            const cloned = await this.clone(user, idOrSlug, {
                inputValues: dto.inputValues,
                name: dto.pipelineName,
            });
            template = await this.prisma.funnelTemplate.findFirstOrThrow({
                where: { id: cloned.id },
            });
        }
        const def = this.applyInputValues((0, shared_1.parseFunnelTemplateDefinition)(template.definition), dto.inputValues);
        const draft = (0, shared_1.templateDefinitionToBlueprintDraft)(def, {
            name: dto.pipelineName ?? def.name,
            includeAutomations: dto.applyFlows !== false,
        });
        const applied = await this.funnelBuilder.apply(user, {
            draft: draft,
            applyStages: dto.applyStages !== false,
            applyFlows: dto.applyFlows !== false,
            activateFlows: dto.activateFlows === true,
            deactivateMissingStages: dto.deactivateMissingStages === true,
        }, canActivateFlows);
        return {
            templateId: template.id,
            templateSlug: template.slug,
            ...applied,
        };
    }
    async getOwnedOrSystem(organizationId, idOrSlug) {
        const row = await this.prisma.funnelTemplate.findFirst({
            where: {
                isActive: true,
                OR: [
                    { id: idOrSlug, organizationId: null, isSystem: true },
                    { id: idOrSlug, organizationId },
                    { slug: idOrSlug, organizationId: null, isSystem: true },
                    { slug: idOrSlug, organizationId },
                ],
            },
        });
        if (!row)
            throw new common_1.NotFoundException('Funnel template not found');
        return row;
    }
    async uniqueOrgSlug(organizationId, base) {
        let slug = base.slice(0, 56) || 'template';
        let i = 0;
        while (true) {
            const candidate = i === 0 ? slug : `${slug}-${i}`;
            const hit = await this.prisma.funnelTemplate.findFirst({
                where: { organizationId, slug: candidate },
                select: { id: true },
            });
            if (!hit)
                return candidate;
            i += 1;
            if (i > 50)
                throw new common_1.BadRequestException('Không tạo được slug template');
        }
    }
    applyInputValues(def, values) {
        if (!values || Object.keys(values).length === 0)
            return def;
        const filled = def.requiredInputs.map((input) => ({
            ...input,
            helpText: values[input.key] != null
                ? `Giá trị: ${String(values[input.key])}`
                : input.helpText,
        }));
        const summaryBits = def.requiredInputs
            .filter((i) => values[i.key] != null)
            .map((i) => `${i.label}: ${String(values[i.key])}`);
        return (0, shared_1.parseFunnelTemplateDefinition)({
            ...def,
            requiredInputs: filled,
            description: [def.description, summaryBits.length ? summaryBits.join(' · ') : null]
                .filter(Boolean)
                .join(' — '),
        });
    }
    toRowData(def, meta) {
        return {
            organizationId: meta.organizationId,
            sourceTemplateId: meta.sourceTemplateId,
            createdById: meta.createdById,
            slug: def.slug,
            name: def.name,
            description: def.description,
            category: def.category,
            tags: def.tags ?? [],
            goal: def.goal,
            requiredInputs: def.requiredInputs,
            nodes: def.nodes,
            connections: def.connections,
            recommendedAutomation: def.recommendedAutomation,
            definition: def,
            isSystem: meta.isSystem,
            isActive: true,
        };
    }
    serialize(row) {
        return {
            id: row.id,
            organizationId: row.organizationId,
            sourceTemplateId: row.sourceTemplateId,
            slug: row.slug,
            name: row.name,
            description: row.description,
            category: row.category,
            tags: row.tags,
            goal: row.goal,
            requiredInputs: row.requiredInputs,
            nodes: row.nodes,
            connections: row.connections,
            recommendedAutomation: row.recommendedAutomation,
            definition: row.definition,
            isSystem: row.isSystem,
            isActive: row.isActive,
            version: row.version,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            canEdit: !row.isSystem && !!row.organizationId,
        };
    }
};
exports.FunnelTemplateService = FunnelTemplateService;
exports.FunnelTemplateService = FunnelTemplateService = FunnelTemplateService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        funnel_builder_service_1.FunnelBuilderService])
], FunnelTemplateService);
