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
exports.CampaignsService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const bullmq_1 = require("bullmq");
const queue_constants_1 = require("../queue/queue.constants");
const events_gateway_1 = require("../events/events.gateway");
const queue_enqueue_service_1 = require("../common/services/queue-enqueue.service");
const tenant_ownership_service_1 = require("../common/services/tenant-ownership.service");
let CampaignsService = class CampaignsService {
    prisma;
    campaignQueue;
    events;
    queueEnqueue;
    tenant;
    constructor(prisma, campaignQueue, events, queueEnqueue, tenant) {
        this.prisma = prisma;
        this.campaignQueue = campaignQueue;
        this.events = events;
        this.queueEnqueue = queueEnqueue;
        this.tenant = tenant;
    }
    findAll(organizationId) {
        return this.prisma.campaign.findMany({
            where: { organizationId },
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { customers: true } } },
        });
    }
    async findOne(organizationId, id) {
        const campaign = await this.prisma.campaign.findFirst({
            where: { id, organizationId },
            include: { customers: { include: { customer: true } } },
        });
        if (!campaign)
            throw new common_1.NotFoundException('Campaign không tồn tại');
        return campaign;
    }
    async create(organizationId, dto) {
        for (const customerId of dto.contactIds) {
            await this.tenant.assertCustomer(organizationId, customerId);
        }
        return this.prisma.campaign.create({
            data: {
                name: dto.name,
                channel: dto.channel,
                scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
                organizationId,
                customers: {
                    create: dto.contactIds.map((customerId) => ({ customerId })),
                },
            },
            include: { _count: { select: { customers: true } } },
        });
    }
    async enqueueSend(organizationId, id) {
        const campaign = await this.findOne(organizationId, id);
        if (campaign.status !== database_1.MarketingCampaignStatus.DRAFT &&
            campaign.status !== database_1.MarketingCampaignStatus.SCHEDULED) {
            throw new common_1.BadRequestException('Campaign không thể gửi ở trạng thái hiện tại');
        }
        await this.prisma.campaign.update({
            where: { id },
            data: { status: database_1.MarketingCampaignStatus.RUNNING },
        });
        await this.queueEnqueue.add(this.campaignQueue, 'send-campaign', {
            campaignId: id,
            organizationId,
        });
        // Broadcast realtime update
        this.events.broadcastCampaignUpdate(organizationId, {
            campaignId: id,
            status: database_1.MarketingCampaignStatus.RUNNING,
        });
        return { message: 'Campaign đã được đưa vào hàng đợi', campaignId: id };
    }
};
exports.CampaignsService = CampaignsService;
exports.CampaignsService = CampaignsService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(queue_constants_1.CAMPAIGN_QUEUE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        bullmq_1.Queue,
        events_gateway_1.EventsGateway,
        queue_enqueue_service_1.QueueEnqueueService,
        tenant_ownership_service_1.TenantOwnershipService])
], CampaignsService);
