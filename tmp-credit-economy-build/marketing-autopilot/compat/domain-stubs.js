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
var FunnelBuilderService_1, FunnelGeneratorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadScoringService = exports.EmailMarketingService = exports.FunnelLifecycleService = exports.FunnelGeneratorService = exports.FunnelBuilderService = void 0;
/**
 * Minimum Autopilot integrations for origin/main (no Funnel Builder / Email Marketing / Lead Scoring modules).
 * Stores drafts in Autopilot-owned tables. Never publishes ads/email/funnel live.
 */
const common_1 = require("@nestjs/common");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../../prisma/prisma.service");
let FunnelBuilderService = FunnelBuilderService_1 = class FunnelBuilderService {
    logger = new common_1.Logger(FunnelBuilderService_1.name);
    async generate(_user, _dto) {
        throw new Error('FunnelBuilder CRM seed not available on this baseline');
    }
    async apply(_user, _dto, _canActivateFlows) {
        throw new Error('FunnelBuilder apply not available on this baseline');
    }
};
exports.FunnelBuilderService = FunnelBuilderService;
exports.FunnelBuilderService = FunnelBuilderService = FunnelBuilderService_1 = __decorate([
    (0, common_1.Injectable)()
], FunnelBuilderService);
let FunnelGeneratorService = FunnelGeneratorService_1 = class FunnelGeneratorService {
    prisma;
    logger = new common_1.Logger(FunnelGeneratorService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async generate(user, dto, _opts) {
        const preview = (0, shared_1.buildFallbackFunnelRecommendations)(dto.prompt || 'Autopilot Funnel');
        const row = await this.prisma.marketingAutopilotFunnelSpec.create({
            data: {
                organizationId: user.organizationId,
                createdById: user.id,
                prompt: preview.prompt,
                source: 'fallback',
                status: 'DRAFT',
                result: preview,
                selectedSlug: preview.recommendations[0]?.templateSlug ?? 'consultation',
                selectedAt: new Date(),
            },
        });
        this.logger.debug(`Autopilot funnel spec ${row.id} created (fallback)`);
        return {
            id: row.id,
            recommendations: preview.recommendations,
        };
    }
    async generateComplete(_user, id) {
        const complete = (0, shared_1.buildFallbackFunnelComplete)({ templateSlug: 'consultation' });
        await this.prisma.marketingAutopilotFunnelSpec.update({
            where: { id },
            data: {
                selectedSlug: 'consultation',
                selectedAt: new Date(),
                completeSpec: complete,
                completeSource: 'fallback',
                completeGeneratedAt: new Date(),
            },
        });
        return { recommendationId: id, mode: 'draft' };
    }
};
exports.FunnelGeneratorService = FunnelGeneratorService;
exports.FunnelGeneratorService = FunnelGeneratorService = FunnelGeneratorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FunnelGeneratorService);
let FunnelLifecycleService = class FunnelLifecycleService {
    async publish(_user, _id, _summary, _canActivateFlows) {
        throw new Error('Funnel publish not available on this baseline — kept DRAFT');
    }
    async pause(_user, _id) {
        throw new Error('Funnel pause not available on this baseline');
    }
};
exports.FunnelLifecycleService = FunnelLifecycleService;
exports.FunnelLifecycleService = FunnelLifecycleService = __decorate([
    (0, common_1.Injectable)()
], FunnelLifecycleService);
let EmailMarketingService = class EmailMarketingService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createCampaign(organizationId, dto, userId) {
        return this.prisma.marketingAutopilotEmailDraft.create({
            data: {
                organizationId,
                name: dto.name,
                subject: dto.subject ?? null,
                createdByUserId: userId ?? null,
                status: 'DRAFT',
            },
        });
    }
    async sendCampaign(_organizationId, _campaignId) {
        throw new Error('Email send not available on this baseline');
    }
};
exports.EmailMarketingService = EmailMarketingService;
exports.EmailMarketingService = EmailMarketingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], EmailMarketingService);
let LeadScoringService = class LeadScoringService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async upsertConfig(organizationId, funnelId, dto) {
        return this.prisma.marketingAutopilotScoringConfig.upsert({
            where: { funnelId },
            create: {
                organizationId,
                funnelId,
                maxScore: dto.maxScore ?? 100,
                mqlThreshold: dto.mqlThreshold ?? 50,
                sqlThreshold: dto.sqlThreshold ?? 80,
                isActive: dto.isActive ?? true,
                source: dto.source ?? 'executor',
            },
            update: { source: dto.source ?? 'executor' },
        });
    }
};
exports.LeadScoringService = LeadScoringService;
exports.LeadScoringService = LeadScoringService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LeadScoringService);
