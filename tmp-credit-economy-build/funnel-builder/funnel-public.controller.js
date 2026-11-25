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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FunnelPublicController = void 0;
const common_1 = require("@nestjs/common");
const funnel_lead_capture_service_1 = require("./funnel-lead-capture.service");
const funnel_capture_dto_1 = require("./dto/funnel-capture.dto");
const funnel_scoring_dto_1 = require("./dto/funnel-scoring.dto");
const lead_scoring_service_1 = require("../crm/lead-scoring.service");
const prisma_service_1 = require("../prisma/prisma.service");
const funnel_canvas_runtime_service_1 = require("../crm/funnel-canvas-runtime.service");
/** Public lead form — no JWT. UUID of recommendation is the form token. */
let FunnelPublicController = class FunnelPublicController {
    capture;
    scoring;
    prisma;
    canvasRuntime;
    constructor(capture, scoring, prisma, canvasRuntime) {
        this.capture = capture;
        this.scoring = scoring;
        this.prisma = prisma;
        this.canvasRuntime = canvasRuntime;
    }
    getForm(id) {
        return this.capture.getPublicForm(id);
    }
    submitLead(id, dto) {
        return this.capture.submitPublicLead(id, dto);
    }
    async trackCta(id, dto) {
        const rec = await this.prisma.funnelRecommendation.findFirst({
            where: { id, status: 'ACTIVE' },
            select: { id: true, organizationId: true, status: true },
        });
        if (!rec || !dto.leadId)
            return { ok: false, skipped: true };
        const lead = await this.prisma.lead.findFirst({
            where: {
                id: dto.leadId,
                organizationId: rec.organizationId,
                funnelRecommendationId: rec.id,
            },
            select: { id: true },
        });
        if (!lead)
            return { ok: false, skipped: true };
        await this.scoring.applyEvent({
            organizationId: rec.organizationId,
            leadId: lead.id,
            eventType: 'CTA_CLICK',
            source: dto.ctaKey ?? 'public_cta',
        });
        void this.canvasRuntime.advance({
            organizationId: rec.organizationId,
            leadId: lead.id,
            event: 'CTA_CLICK',
            funnelId: rec.id,
        });
        return { ok: true };
    }
};
exports.FunnelPublicController = FunnelPublicController;
__decorate([
    (0, common_1.Get)(':id/form'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], FunnelPublicController.prototype, "getForm", null);
__decorate([
    (0, common_1.Post)(':id/lead'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, funnel_capture_dto_1.SubmitFunnelPublicLeadDto]),
    __metadata("design:returntype", void 0)
], FunnelPublicController.prototype, "submitLead", null);
__decorate([
    (0, common_1.Post)(':id/cta'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, funnel_scoring_dto_1.FunnelPublicCtaDto]),
    __metadata("design:returntype", Promise)
], FunnelPublicController.prototype, "trackCta", null);
exports.FunnelPublicController = FunnelPublicController = __decorate([
    (0, common_1.Controller)('funnel-builder/public'),
    __metadata("design:paramtypes", [funnel_lead_capture_service_1.FunnelLeadCaptureService,
        lead_scoring_service_1.LeadScoringService,
        prisma_service_1.PrismaService,
        funnel_canvas_runtime_service_1.FunnelCanvasRuntimeService])
], FunnelPublicController);
