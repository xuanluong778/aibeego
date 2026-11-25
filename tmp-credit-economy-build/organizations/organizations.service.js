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
exports.OrganizationsService = void 0;
const database_1 = require("@marketingspa/database");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let OrganizationsService = class OrganizationsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    getCurrent(organizationId) {
        return this.prisma.organization.findFirst({
            where: { id: organizationId },
            include: {
                branches: { where: { isActive: true }, orderBy: { name: 'asc' } },
                _count: {
                    select: {
                        customers: true,
                        leads: true,
                        employees: true,
                        appointments: true,
                    },
                },
            },
        });
    }
    async update(organizationId, dto) {
        await this.ensureOrg(organizationId);
        return this.prisma.organization.update({
            where: { id: organizationId },
            data: dto,
        });
    }
    listBranches(organizationId) {
        return this.prisma.branch.findMany({
            where: { organizationId },
            orderBy: { name: 'asc' },
        });
    }
    async createBranch(organizationId, dto) {
        return new database_1.PlanPolicy(this.prisma).resource(organizationId, 'branches', (tx) => tx.branch.count({ where: { organizationId, isActive: true } }), (tx) => tx.branch.create({
            data: { ...dto, organizationId },
        }));
    }
    async updateBranch(organizationId, branchId, dto) {
        const before = await this.ensureBranch(organizationId, branchId);
        if (dto.isActive && !before.isActive)
            return new database_1.PlanPolicy(this.prisma).resource(organizationId, 'branches', (tx) => tx.branch.count({ where: { organizationId, isActive: true } }), (tx) => tx.branch.update({ where: { id: branchId }, data: dto }));
        return this.prisma.branch.update({ where: { id: branchId }, data: dto });
    }
    async deleteBranch(organizationId, branchId) {
        await this.ensureBranch(organizationId, branchId);
        return this.prisma.branch.update({
            where: { id: branchId },
            data: { isActive: false },
        });
    }
    async ensureOrg(organizationId) {
        const org = await this.prisma.organization.findFirst({ where: { id: organizationId } });
        if (!org)
            throw new common_1.NotFoundException('Organization không tồn tại');
        return org;
    }
    async ensureBranch(organizationId, branchId) {
        const branch = await this.prisma.branch.findFirst({
            where: { id: branchId, organizationId },
        });
        if (!branch)
            throw new common_1.NotFoundException('Chi nhánh không tồn tại');
        return branch;
    }
};
exports.OrganizationsService = OrganizationsService;
exports.OrganizationsService = OrganizationsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OrganizationsService);
