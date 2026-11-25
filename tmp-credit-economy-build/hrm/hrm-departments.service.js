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
exports.HrmDepartmentsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
let HrmDepartmentsService = class HrmDepartmentsService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async findAll(organizationId, query) {
        return this.prisma.department.findMany({
            where: {
                organizationId,
                ...(query.branchId && { branchId: query.branchId }),
                ...(query.isActive !== undefined && { isActive: query.isActive }),
            },
            orderBy: { name: 'asc' },
            include: {
                branch: { select: { id: true, name: true } },
                parent: { select: { id: true, name: true, code: true } },
                _count: { select: { employees: true, children: true } },
            },
        });
    }
    async create(organizationId, dto, actor) {
        if (dto.parentId) {
            const parent = await this.prisma.department.findFirst({
                where: { id: dto.parentId, organizationId },
            });
            if (!parent)
                throw new common_1.BadRequestException('Phòng ban cha không tồn tại');
        }
        if (dto.code) {
            const taken = await this.prisma.department.findFirst({
                where: { organizationId, code: dto.code },
            });
            if (taken)
                throw new common_1.ConflictException('Mã phòng ban đã tồn tại');
        }
        const department = await this.prisma.department.create({
            data: {
                organizationId,
                name: dto.name,
                code: dto.code,
                branchId: dto.branchId,
                parentId: dto.parentId,
                isActive: dto.isActive ?? true,
            },
            include: {
                branch: { select: { id: true, name: true } },
                parent: { select: { id: true, name: true, code: true } },
            },
        });
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'hrm.department.create',
            entityType: 'Department',
            entityId: department.id,
            metadata: {
                after: {
                    name: department.name,
                    code: department.code,
                    branchId: department.branchId,
                    parentId: department.parentId,
                },
            },
            ipAddress: actor?.ipAddress,
        });
        return department;
    }
};
exports.HrmDepartmentsService = HrmDepartmentsService;
exports.HrmDepartmentsService = HrmDepartmentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], HrmDepartmentsService);
