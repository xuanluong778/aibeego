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
exports.BusinessGoalsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const calculate_util_1 = require("./utils/calculate.util");
const pagination_util_1 = require("../common/utils/pagination.util");
let BusinessGoalsService = class BusinessGoalsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    calculate(dto) {
        const result = (0, calculate_util_1.calculateBusinessGoals)(dto);
        return {
            inputs: dto,
            ...result,
        };
    }
    async findAll(organizationId, query) {
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        const where = { organizationId };
        const [items, total] = await Promise.all([
            this.prisma.businessGoalScenario.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    branch: { select: { id: true, name: true } },
                    createdBy: { select: { id: true, name: true } },
                },
            }),
            this.prisma.businessGoalScenario.count({ where }),
        ]);
        return (0, pagination_util_1.buildPaginatedResult)(items, total, page, pageSize);
    }
    async findOne(organizationId, id) {
        const scenario = await this.prisma.businessGoalScenario.findFirst({
            where: { id, organizationId },
            include: {
                branch: { select: { id: true, name: true } },
                createdBy: { select: { id: true, name: true } },
            },
        });
        if (!scenario) {
            throw new common_1.NotFoundException('Không tìm thấy kịch bản mục tiêu kinh doanh');
        }
        return scenario;
    }
    async create(user, dto) {
        if (dto.branchId) {
            const branch = await this.prisma.branch.findFirst({
                where: { id: dto.branchId, organizationId: user.organizationId },
            });
            if (!branch) {
                throw new common_1.NotFoundException('Chi nhánh không tồn tại');
            }
        }
        const calc = (0, calculate_util_1.calculateBusinessGoals)(dto);
        return this.prisma.businessGoalScenario.create({
            data: {
                organizationId: user.organizationId,
                branchId: dto.branchId ?? null,
                name: dto.name,
                averageRevenuePerTransaction: dto.averageRevenuePerTransaction,
                currentTransactionCount: dto.currentTransactionCount,
                variableCostRate: dto.variableCostRate,
                fixedCost: dto.fixedCost,
                leadConversionRate: dto.leadConversionRate,
                targetProfit: dto.targetProfit,
                calculatedRevenue: calc.totalRevenue,
                calculatedGrossProfit: calc.grossProfit,
                calculatedNetProfit: calc.netProfit,
                breakEvenTransactions: calc.breakEvenTransactions,
                breakEvenLeads: calc.breakEvenLeads,
                targetTransactions: calc.targetTransactions,
                targetLeads: calc.targetLeads,
                createdById: user.id,
            },
            include: {
                branch: { select: { id: true, name: true } },
                createdBy: { select: { id: true, name: true } },
            },
        });
    }
    async remove(organizationId, id) {
        const existing = await this.prisma.businessGoalScenario.findFirst({
            where: { id, organizationId },
        });
        if (!existing) {
            throw new common_1.NotFoundException('Không tìm thấy kịch bản mục tiêu kinh doanh');
        }
        await this.prisma.businessGoalScenario.delete({ where: { id } });
        return { success: true };
    }
};
exports.BusinessGoalsService = BusinessGoalsService;
exports.BusinessGoalsService = BusinessGoalsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BusinessGoalsService);
