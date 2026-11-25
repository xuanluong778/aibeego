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
exports.AttributionController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const attribution_dashboard_service_1 = require("./attribution-dashboard.service");
const attribution_service_1 = require("./attribution.service");
const offline_conversion_service_1 = require("./offline-conversion.service");
const attribution_dto_1 = require("./dto/attribution.dto");
const prisma_service_1 = require("../prisma/prisma.service");
const common_2 = require("@nestjs/common");
let AttributionController = class AttributionController {
    dashboard;
    attribution;
    offline;
    prisma;
    constructor(dashboard, attribution, offline, prisma) {
        this.dashboard = dashboard;
        this.attribution = attribution;
        this.offline = offline;
        this.prisma = prisma;
    }
    getDashboard(user, query) {
        return this.dashboard.getDashboard(user.organizationId, query);
    }
    async getLeadAttribution(user, leadId) {
        const row = await this.prisma.leadAttribution.findFirst({
            where: { organizationId: user.organizationId, leadId },
            include: {
                adCampaign: true,
                adSet: true,
                ad: true,
                lead: { select: { id: true, name: true, phone: true, email: true } },
            },
        });
        if (!row)
            throw new common_2.NotFoundException('Không tìm thấy attribution');
        return row;
    }
    async upsert(user, leadId, dto) {
        return this.attribution.upsertLeadAttribution(user.organizationId, leadId, dto);
    }
    listOfflineJobs(user) {
        return this.prisma.offlineConversionJob.findMany({
            where: { organizationId: user.organizationId },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
    }
    async retryOfflineJob(user, id) {
        const job = await this.prisma.offlineConversionJob.findFirst({
            where: { id, organizationId: user.organizationId },
        });
        if (!job)
            throw new common_2.NotFoundException('Job không tồn tại');
        await this.offline.enqueuePendingJobs(user.organizationId, [job.id]);
        return { message: 'Đã xếp hàng retry', jobId: job.id };
    }
};
exports.AttributionController = AttributionController;
__decorate([
    (0, common_1.Get)('dashboard'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, attribution_dto_1.AttributionDashboardQueryDto]),
    __metadata("design:returntype", void 0)
], AttributionController.prototype, "getDashboard", null);
__decorate([
    (0, common_1.Get)('leads/:leadId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('leadId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AttributionController.prototype, "getLeadAttribution", null);
__decorate([
    (0, common_1.Post)('leads/:leadId'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('leadId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, attribution_dto_1.AttributionInputDto]),
    __metadata("design:returntype", Promise)
], AttributionController.prototype, "upsert", null);
__decorate([
    (0, common_1.Get)('offline-jobs'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AttributionController.prototype, "listOfflineJobs", null);
__decorate([
    (0, common_1.Post)('offline-jobs/:id/retry'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], AttributionController.prototype, "retryOfflineJob", null);
exports.AttributionController = AttributionController = __decorate([
    (0, common_1.Controller)('attribution'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __metadata("design:paramtypes", [attribution_dashboard_service_1.AttributionDashboardService,
        attribution_service_1.AttributionService,
        offline_conversion_service_1.OfflineConversionService,
        prisma_service_1.PrismaService])
], AttributionController);
