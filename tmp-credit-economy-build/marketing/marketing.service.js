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
exports.MarketingService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const tenant_ownership_service_1 = require("../common/services/tenant-ownership.service");
const pagination_util_1 = require("../common/utils/pagination.util");
const platform_lead_source_util_1 = require("../common/utils/platform-lead-source.util");
let MarketingService = class MarketingService {
    prisma;
    tenant;
    constructor(prisma, tenant) {
        this.prisma = prisma;
        this.tenant = tenant;
    }
    // --- Lead Sources ---
    async listLeadSources(organizationId, query) {
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        const where = { organizationId };
        const [items, total] = await Promise.all([
            this.prisma.leadSource.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
            this.prisma.leadSource.count({ where }),
        ]);
        return (0, pagination_util_1.buildPaginatedResult)(items, total, page, pageSize);
    }
    createLeadSource(organizationId, dto) {
        return this.prisma.leadSource.create({
            data: { organizationId, name: dto.name, code: dto.code },
        });
    }
    async updateLeadSource(organizationId, id, dto) {
        await this.ensureLeadSource(organizationId, id);
        return this.prisma.leadSource.update({ where: { id }, data: dto });
    }
    // --- Ad Accounts ---
    listAdAccounts(organizationId) {
        return this.prisma.adAccount.findMany({
            where: { organizationId },
            include: { campaigns: true },
        });
    }
    createAdAccount(organizationId, dto) {
        return this.prisma.adAccount.create({ data: { organizationId, ...dto } });
    }
    // --- Ad Campaigns ---
    async listAdCampaigns(organizationId, query) {
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        const where = {
            organizationId,
            ...(query.status && { status: query.status }),
            ...(query.platform && { platform: query.platform }),
        };
        const [items, total] = await Promise.all([
            this.prisma.adCampaign.findMany({
                where,
                skip,
                take,
                include: { adAccount: true, dailyStats: { take: 7, orderBy: { date: 'desc' } } },
            }),
            this.prisma.adCampaign.count({ where }),
        ]);
        return (0, pagination_util_1.buildPaginatedResult)(items, total, page, pageSize);
    }
    async createAdCampaign(organizationId, dto) {
        await this.tenant.assertAdAccount(organizationId, dto.adAccountId);
        return this.prisma.adCampaign.create({
            data: {
                organizationId,
                adAccountId: dto.adAccountId,
                name: dto.name,
                platform: dto.platform,
                budget: dto.budget != null ? new database_1.Prisma.Decimal(dto.budget) : undefined,
                startDate: dto.startDate ? new Date(dto.startDate) : undefined,
                endDate: dto.endDate ? new Date(dto.endDate) : undefined,
                note: dto.note,
            },
        });
    }
    async createAdDailyStat(organizationId, dto) {
        await this.tenant.assertAdCampaign(organizationId, dto.adCampaignId);
        return this.prisma.adDailyStat.create({
            data: {
                organizationId,
                adCampaignId: dto.adCampaignId,
                date: new Date(dto.date),
                impressions: dto.impressions ?? 0,
                clicks: dto.clicks ?? 0,
                spend: new database_1.Prisma.Decimal(dto.spend),
                leads: dto.leads ?? 0,
                conversions: dto.conversions ?? 0,
            },
        });
    }
    /** CPL, cost/booking, cost/purchase, revenue/campaign */
    async getCampaignReports(organizationId, query) {
        const from = query.from ? new Date(query.from) : new Date(Date.now() - 30 * 86400000);
        const to = query.to ? new Date(query.to) : new Date();
        const campaigns = await this.prisma.adCampaign.findMany({
            where: {
                organizationId,
                ...(query.adCampaignId && { id: query.adCampaignId }),
            },
            include: {
                dailyStats: {
                    where: { date: { gte: from, lte: to } },
                },
                expenses: {
                    where: { expenseDate: { gte: from, lte: to } },
                },
            },
        });
        const reports = await Promise.all(campaigns.map(async (c) => {
            const spendFromStats = c.dailyStats.reduce((s, d) => s + Number(d.spend), 0);
            const spendFromExpenses = c.expenses.reduce((s, e) => s + Number(e.amount), 0);
            const totalSpend = spendFromStats + spendFromExpenses;
            const leadsFromStats = c.dailyStats.reduce((s, d) => s + d.leads, 0);
            const codes = (0, platform_lead_source_util_1.leadSourceCodesForPlatform)(c.platform);
            const sources = codes.length > 0
                ? await this.prisma.leadSource.findMany({
                    where: { organizationId, code: { in: codes } },
                    select: { id: true },
                })
                : [];
            const sourceIds = sources.map((s) => s.id);
            const leadWhere = {
                organizationId,
                createdAt: { gte: from, lte: to },
                ...(sourceIds.length > 0 && { leadSourceId: { in: sourceIds } }),
            };
            const [crmLeads, bookedLeads, purchasedLeads, revenue] = await Promise.all([
                sourceIds.length > 0 ? this.prisma.lead.count({ where: leadWhere }) : Promise.resolve(0),
                this.prisma.lead.count({
                    where: {
                        ...leadWhere,
                        pipelineStatus: {
                            in: [
                                database_1.LeadPipelineStatus.BOOKED,
                                database_1.LeadPipelineStatus.VISITED,
                                database_1.LeadPipelineStatus.PURCHASED,
                            ],
                        },
                    },
                }),
                this.prisma.lead.count({
                    where: { ...leadWhere, pipelineStatus: database_1.LeadPipelineStatus.PURCHASED },
                }),
                sourceIds.length > 0
                    ? this.prisma.order.aggregate({
                        where: {
                            organizationId,
                            status: database_1.OrderStatus.PAID,
                            orderedAt: { gte: from, lte: to },
                            customer: { leadSourceId: { in: sourceIds } },
                        },
                        _sum: { total: true },
                    })
                    : Promise.resolve({ _sum: { total: null } }),
            ]);
            const totalLeads = Math.max(leadsFromStats, crmLeads);
            const totalRevenue = Number(revenue._sum.total ?? 0);
            const profit = totalRevenue - totalSpend;
            return {
                campaignId: c.id,
                campaignName: c.name,
                platform: c.platform,
                totalSpend,
                totalLeads,
                bookedLeads,
                purchasedLeads,
                revenue: totalRevenue,
                profit,
                cpl: totalLeads > 0 ? totalSpend / totalLeads : null,
                costPerBooking: bookedLeads > 0 ? totalSpend / bookedLeads : null,
                costPerPurchase: purchasedLeads > 0 ? totalSpend / purchasedLeads : null,
            };
        }));
        return { from: from.toISOString(), to: to.toISOString(), campaigns: reports };
    }
    async ensureLeadSource(organizationId, id) {
        const src = await this.prisma.leadSource.findFirst({ where: { id, organizationId } });
        if (!src)
            throw new common_1.NotFoundException('Nguồn lead không tồn tại');
        return src;
    }
};
exports.MarketingService = MarketingService;
exports.MarketingService = MarketingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        tenant_ownership_service_1.TenantOwnershipService])
], MarketingService);
