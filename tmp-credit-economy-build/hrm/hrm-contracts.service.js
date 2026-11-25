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
exports.HrmContractsService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const hrm_employees_service_1 = require("./hrm-employees.service");
let HrmContractsService = class HrmContractsService {
    prisma;
    audit;
    employees;
    constructor(prisma, audit, employees) {
        this.prisma = prisma;
        this.audit = audit;
        this.employees = employees;
    }
    async listByEmployee(organizationId, employeeId) {
        await this.employees.ensureEmployee(organizationId, employeeId);
        return this.prisma.employmentContract.findMany({
            where: { organizationId, employeeId },
            orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
        });
    }
    async create(organizationId, employeeId, dto, actor) {
        const employee = await this.employees.ensureEmployee(organizationId, employeeId);
        const contract = await this.prisma.employmentContract.create({
            data: {
                organizationId,
                employeeId,
                branchId: employee.branchId,
                title: dto.title,
                contractType: dto.contractType,
                status: dto.status ?? database_1.EmploymentContractStatus.DRAFT,
                salaryBase: dto.salaryBase !== undefined ? new database_1.Prisma.Decimal(dto.salaryBase) : undefined,
                startDate: new Date(dto.startDate),
                endDate: dto.endDate ? new Date(dto.endDate) : undefined,
                notes: dto.notes,
                fileUrl: dto.fileUrl,
                code: dto.code,
                currency: dto.currency ?? 'VND',
                createdById: actor?.userId,
            },
        });
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'hrm.contract.create',
            entityType: 'EmploymentContract',
            entityId: contract.id,
            metadata: {
                after: {
                    employeeId,
                    title: contract.title,
                    contractType: contract.contractType,
                    status: contract.status,
                    salaryBase: contract.salaryBase?.toString() ?? null,
                    startDate: contract.startDate,
                    endDate: contract.endDate,
                    version: contract.version,
                },
            },
            ipAddress: actor?.ipAddress,
        });
        return contract;
    }
    async update(organizationId, id, dto, actor) {
        const existing = await this.prisma.employmentContract.findFirst({
            where: { id, organizationId },
        });
        if (!existing)
            throw new common_1.NotFoundException('Hợp đồng không tồn tại');
        const termsChanged = (dto.salaryBase !== undefined &&
            String(dto.salaryBase) !== (existing.salaryBase?.toString() ?? undefined)) ||
            (dto.contractType !== undefined && dto.contractType !== existing.contractType) ||
            (dto.startDate !== undefined &&
                new Date(dto.startDate).getTime() !== existing.startDate.getTime()) ||
            (dto.endDate !== undefined &&
                (dto.endDate === null
                    ? existing.endDate !== null
                    : !existing.endDate ||
                        new Date(dto.endDate).getTime() !== existing.endDate.getTime()));
        if (termsChanged) {
            const result = await this.prisma.$transaction(async (tx) => {
                await tx.employmentContract.update({
                    where: { id: existing.id },
                    data: { status: database_1.EmploymentContractStatus.TERMINATED },
                });
                const nextStatus = dto.status ??
                    (existing.status === database_1.EmploymentContractStatus.DRAFT
                        ? database_1.EmploymentContractStatus.DRAFT
                        : database_1.EmploymentContractStatus.ACTIVE);
                return tx.employmentContract.create({
                    data: {
                        organizationId,
                        employeeId: existing.employeeId,
                        branchId: existing.branchId,
                        title: dto.title ?? existing.title,
                        contractType: dto.contractType ?? existing.contractType,
                        status: nextStatus,
                        salaryBase: dto.salaryBase !== undefined
                            ? new database_1.Prisma.Decimal(dto.salaryBase)
                            : existing.salaryBase,
                        currency: dto.currency ?? existing.currency,
                        startDate: dto.startDate ? new Date(dto.startDate) : existing.startDate,
                        endDate: dto.endDate === undefined
                            ? existing.endDate
                            : dto.endDate === null
                                ? null
                                : new Date(dto.endDate),
                        notes: dto.notes === undefined ? existing.notes : dto.notes,
                        fileUrl: dto.fileUrl === undefined ? existing.fileUrl : dto.fileUrl,
                        code: dto.code === undefined ? existing.code : dto.code,
                        version: existing.version + 1,
                        previousContractId: existing.id,
                        createdById: actor?.userId,
                    },
                });
            });
            await this.audit.log({
                organizationId,
                userId: actor?.userId,
                action: 'hrm.contract.version',
                entityType: 'EmploymentContract',
                entityId: result.id,
                metadata: {
                    before: {
                        id: existing.id,
                        version: existing.version,
                        salaryBase: existing.salaryBase?.toString() ?? null,
                        contractType: existing.contractType,
                        startDate: existing.startDate,
                        endDate: existing.endDate,
                        status: existing.status,
                    },
                    after: {
                        id: result.id,
                        version: result.version,
                        previousContractId: result.previousContractId,
                        salaryBase: result.salaryBase?.toString() ?? null,
                        contractType: result.contractType,
                        startDate: result.startDate,
                        endDate: result.endDate,
                        status: result.status,
                    },
                },
                ipAddress: actor?.ipAddress,
            });
            return result;
        }
        if (dto.title === undefined &&
            dto.status === undefined &&
            dto.notes === undefined &&
            dto.fileUrl === undefined &&
            dto.code === undefined &&
            dto.currency === undefined) {
            throw new common_1.BadRequestException('Không có thay đổi');
        }
        const updated = await this.prisma.employmentContract.update({
            where: { id },
            data: {
                ...(dto.title !== undefined && { title: dto.title }),
                ...(dto.status !== undefined && { status: dto.status }),
                ...(dto.notes !== undefined && { notes: dto.notes }),
                ...(dto.fileUrl !== undefined && { fileUrl: dto.fileUrl }),
                ...(dto.code !== undefined && { code: dto.code }),
                ...(dto.currency !== undefined && { currency: dto.currency }),
            },
        });
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'hrm.contract.update',
            entityType: 'EmploymentContract',
            entityId: id,
            metadata: {
                before: {
                    title: existing.title,
                    status: existing.status,
                    notes: existing.notes,
                    fileUrl: existing.fileUrl,
                },
                after: {
                    title: updated.title,
                    status: updated.status,
                    notes: updated.notes,
                    fileUrl: updated.fileUrl,
                },
            },
            ipAddress: actor?.ipAddress,
        });
        return updated;
    }
};
exports.HrmContractsService = HrmContractsService;
exports.HrmContractsService = HrmContractsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        hrm_employees_service_1.HrmEmployeesService])
], HrmContractsService);
