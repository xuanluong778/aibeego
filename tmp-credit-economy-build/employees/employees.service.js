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
exports.EmployeesService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const pagination_util_1 = require("../common/utils/pagination.util");
let EmployeesService = class EmployeesService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async findAll(organizationId, query) {
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        const where = {
            organizationId,
            ...(query.branchId && { branchId: query.branchId }),
            ...(query.isActive !== undefined && { isActive: query.isActive }),
            ...(query.search && {
                OR: [
                    { name: { contains: query.search, mode: 'insensitive' } },
                    { phone: { contains: query.search } },
                    { email: { contains: query.search, mode: 'insensitive' } },
                ],
            }),
        };
        const [items, total] = await Promise.all([
            this.prisma.employee.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: { branch: true, user: { include: { role: true } } },
            }),
            this.prisma.employee.count({ where }),
        ]);
        return (0, pagination_util_1.buildPaginatedResult)(items, total, page, pageSize);
    }
    async findOne(organizationId, id) {
        const employee = await this.prisma.employee.findFirst({
            where: { id, organizationId },
            include: { branch: true, user: { include: { role: true } } },
        });
        if (!employee)
            throw new common_1.NotFoundException('Nhân viên không tồn tại');
        return employee;
    }
    async create(organizationId, dto, actor) {
        const employee = await this.prisma.employee.create({
            data: {
                organizationId,
                name: dto.name,
                phone: dto.phone,
                email: dto.email,
                position: dto.position,
                branchId: dto.branchId,
            },
            include: { branch: true },
        });
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'employee.create',
            entityType: 'Employee',
            entityId: employee.id,
            metadata: { after: { name: employee.name, branchId: employee.branchId, position: employee.position } },
            ipAddress: actor?.ipAddress,
        });
        return employee;
    }
    async update(organizationId, id, dto, actor) {
        const before = await this.findOne(organizationId, id);
        if (dto.roleCode) {
            const role = await this.prisma.role.findFirst({
                where: { organizationId, code: dto.roleCode },
            });
            if (!role)
                throw new common_1.BadRequestException(`Role ${dto.roleCode} không tồn tại`);
            const employee = await this.prisma.employee.findFirst({
                where: { id, organizationId },
                include: { user: true },
            });
            if (employee?.user) {
                await this.prisma.user.update({
                    where: { id: employee.user.id },
                    data: { roleId: role.id },
                });
            }
        }
        const { roleCode: _roleCode, ...data } = dto;
        void _roleCode;
        const employee = await this.prisma.employee.update({
            where: { id },
            data,
            include: { branch: true, user: { include: { role: true } } },
        });
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'employee.update',
            entityType: 'Employee',
            entityId: id,
            metadata: {
                before: {
                    name: before.name,
                    branchId: before.branchId,
                    position: before.position,
                    isActive: before.isActive,
                    roleCode: before.user?.role?.code,
                },
                after: {
                    name: employee.name,
                    branchId: employee.branchId,
                    position: employee.position,
                    isActive: employee.isActive,
                    roleCode: employee.user?.role?.code ?? dto.roleCode,
                },
            },
            ipAddress: actor?.ipAddress,
        });
        return employee;
    }
    async remove(organizationId, id, actor) {
        await this.findOne(organizationId, id);
        const employee = await this.prisma.employee.update({
            where: { id },
            data: { isActive: false },
        });
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'employee.deactivate',
            entityType: 'Employee',
            entityId: id,
            metadata: { before: { isActive: true }, after: { isActive: false } },
            ipAddress: actor?.ipAddress,
        });
        return employee;
    }
    /** KPI hiệu suất nhân viên theo khoảng thời gian */
    async getPerformance(organizationId, employeeId, query) {
        await this.findOne(organizationId, employeeId);
        const to = query.to ? new Date(query.to) : new Date();
        to.setHours(23, 59, 59, 999);
        const from = query.from ? new Date(query.from) : new Date(to.getFullYear(), to.getMonth(), 1);
        from.setHours(0, 0, 0, 0);
        const leadWhere = {
            organizationId,
            assignedToId: employeeId,
            createdAt: { gte: from, lte: to },
        };
        const contactedStatuses = [
            database_1.LeadPipelineStatus.CONTACTED,
            database_1.LeadPipelineStatus.BOOKED,
            database_1.LeadPipelineStatus.VISITED,
            database_1.LeadPipelineStatus.PURCHASED,
        ];
        const arrivedStatuses = [database_1.AppointmentStatus.ARRIVED, database_1.AppointmentStatus.COMPLETED];
        const [leadsReceived, leadsContacted, appointmentsCreated, customersArrived, customersPurchased, revenueAgg,] = await Promise.all([
            this.prisma.lead.count({ where: leadWhere }),
            this.prisma.lead.count({
                where: { ...leadWhere, pipelineStatus: { in: contactedStatuses } },
            }),
            this.prisma.appointment.count({
                where: {
                    organizationId,
                    employeeId,
                    createdAt: { gte: from, lte: to },
                },
            }),
            this.prisma.appointment.count({
                where: {
                    organizationId,
                    employeeId,
                    scheduledAt: { gte: from, lte: to },
                    status: { in: arrivedStatuses },
                },
            }),
            this.prisma.lead.count({
                where: { ...leadWhere, pipelineStatus: database_1.LeadPipelineStatus.PURCHASED },
            }),
            this.prisma.order.aggregate({
                where: {
                    organizationId,
                    status: database_1.OrderStatus.PAID,
                    orderedAt: { gte: from, lte: to },
                    customer: {
                        leads: { some: { assignedToId: employeeId } },
                    },
                },
                _sum: { total: true },
            }),
        ]);
        const revenue = Number(revenueAgg._sum.total ?? 0);
        const closeRate = leadsReceived > 0 ? Math.round((customersPurchased / leadsReceived) * 1000) / 10 : null;
        return {
            employeeId,
            from: from.toISOString(),
            to: to.toISOString(),
            leadsReceived,
            leadsContacted,
            appointmentsCreated,
            customersArrived,
            customersPurchased,
            revenue,
            closeRate,
        };
    }
};
exports.EmployeesService = EmployeesService;
exports.EmployeesService = EmployeesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], EmployeesService);
