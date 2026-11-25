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
exports.FunnelInlineEditService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../prisma/prisma.service");
let FunnelInlineEditService = class FunnelInlineEditService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    canEditFunnel(user) {
        if (user.role === 'OWNER' || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
            return true;
        }
        return (user.permissions ?? []).includes('lead.write');
    }
    async getPreviewForm(user, recommendationId) {
        const canEdit = this.canEditFunnel(user);
        const rec = await this.prisma.funnelRecommendation.findFirst({
            where: { id: recommendationId, organizationId: user.organizationId },
        });
        if (!rec)
            throw new common_1.NotFoundException('Funnel không tồn tại');
        if (rec.status === 'ARCHIVED') {
            throw new common_1.BadRequestException('Funnel đã lưu trữ — không xem preview');
        }
        if (!rec.completeSpec) {
            throw new common_1.BadRequestException('Funnel chưa có nội dung — hãy tạo phễu trước');
        }
        let spec;
        try {
            spec = (0, shared_1.parseFunnelCompleteSpec)(rec.completeSpec);
        }
        catch {
            throw new common_1.BadRequestException('completeSpec không hợp lệ');
        }
        let hasUnpublishedChanges = false;
        if (rec.status === 'ACTIVE' && rec.publishedSpec) {
            try {
                const published = (0, shared_1.parseFunnelCompleteSpec)(rec.publishedSpec);
                hasUnpublishedChanges = (0, shared_1.funnelInlineContentChanged)(published, spec);
            }
            catch {
                hasUnpublishedChanges = true;
            }
        }
        const formId = spec.nodes.find((n) => n.type === 'FORM')?.id ?? rec.id;
        return {
            id: rec.id,
            formId,
            name: spec.name,
            offer: spec.offer,
            cta: spec.cta,
            summary: spec.summary,
            leadForm: spec.leadForm,
            appearance: spec.appearance ?? null,
            status: rec.status,
            canEdit,
            editMode: canEdit,
            liveFrozen: rec.status === 'ACTIVE',
            hasUnpublishedChanges,
            publishedVersion: rec.publishedVersion,
            previewOnly: rec.status !== 'ACTIVE',
        };
    }
    async saveInlineContent(user, recommendationId, rawPatch) {
        if (!this.canEditFunnel(user)) {
            throw new common_1.ForbiddenException('Không có quyền chỉnh sửa phễu');
        }
        const rec = await this.prisma.funnelRecommendation.findFirst({
            where: { id: recommendationId, organizationId: user.organizationId },
        });
        if (!rec)
            throw new common_1.NotFoundException('Funnel không tồn tại');
        if (rec.status === 'ARCHIVED') {
            throw new common_1.BadRequestException('Funnel ARCHIVED — không sửa');
        }
        if (!rec.completeSpec) {
            throw new common_1.BadRequestException('Chưa có completeSpec');
        }
        let current;
        try {
            current = (0, shared_1.parseFunnelCompleteSpec)(rec.completeSpec);
        }
        catch {
            throw new common_1.BadRequestException('completeSpec hiện tại không hợp lệ');
        }
        const patch = (0, shared_1.sanitizeFunnelInlineContentPatch)(rawPatch);
        const merged = (0, shared_1.applyFunnelInlineContentPatch)(current, patch);
        await this.prisma.funnelRecommendation.update({
            where: { id: rec.id },
            data: { completeSpec: merged },
        });
        let hasUnpublishedChanges = rec.status === 'ACTIVE';
        if (rec.status === 'ACTIVE' && rec.publishedSpec) {
            try {
                const published = (0, shared_1.parseFunnelCompleteSpec)(rec.publishedSpec);
                hasUnpublishedChanges = (0, shared_1.funnelInlineContentChanged)(published, merged);
            }
            catch {
                hasUnpublishedChanges = true;
            }
        }
        return {
            recommendationId: rec.id,
            complete: merged,
            saved: true,
            liveFrozen: rec.status === 'ACTIVE',
            hasUnpublishedChanges,
            publishedVersion: rec.publishedVersion,
        };
    }
    diffDraftVsLive(recommendationId, organizationId) {
        return this.prisma.funnelRecommendation.findFirst({
            where: { id: recommendationId, organizationId },
            select: { completeSpec: true, publishedSpec: true, status: true },
        }).then((rec) => {
            if (!rec?.completeSpec || !rec.publishedSpec || rec.status !== 'ACTIVE')
                return [];
            try {
                const before = (0, shared_1.parseFunnelCompleteSpec)(rec.publishedSpec);
                const after = (0, shared_1.parseFunnelCompleteSpec)(rec.completeSpec);
                return (0, shared_1.diffFunnelCompleteSpecs)(before, after);
            }
            catch {
                return [{ path: 'spec', before: 'invalid', after: 'invalid' }];
            }
        });
    }
};
exports.FunnelInlineEditService = FunnelInlineEditService;
exports.FunnelInlineEditService = FunnelInlineEditService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FunnelInlineEditService);
