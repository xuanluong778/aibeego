"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HrmEmployeesService = void 0;
const database_1 = require("@marketingspa/database");
const common_1 = require("@nestjs/common");
const bcrypt = __importStar(require("bcryptjs"));
const database_2 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const pagination_util_1 = require("../common/utils/pagination.util");
const BCRYPT_ROUNDS = 12;
const employeeListInclude = {
    branch: true,
    department: true,
    manager: { select: { id: true, name: true, code: true, position: true } },
    user: { include: { role: true } },
};
let HrmEmployeesService = class HrmEmployeesService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async findAll(organizationId, query) {
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        const text = (query.q ?? query.search)?.trim();
        const where = {
            organizationId,
            ...(query.branchId && { branchId: query.branchId }),
            ...(query.departmentId && { departmentId: query.departmentId }),
            ...(query.status && { status: query.status }),
            ...(query.employmentType && { employmentType: query.employmentType }),
            ...(query.position && {
                position: { contains: query.position, mode: 'insensitive' },
            }),
            ...(query.isActive !== undefined && { isActive: query.isActive }),
            ...(text && {
                OR: [
                    { name: { contains: text, mode: 'insensitive' } },
                    { phone: { contains: text } },
                    { email: { contains: text, mode: 'insensitive' } },
                    { code: { contains: text, mode: 'insensitive' } },
                    { position: { contains: text, mode: 'insensitive' } },
                ],
            }),
        };
        const [items, total] = await Promise.all([
            this.prisma.employee.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: employeeListInclude,
            }),
            this.prisma.employee.count({ where }),
        ]);
        return (0, pagination_util_1.buildPaginatedResult)(items, total, page, pageSize);
    }
    async findOne(organizationId, id) {
        const employee = await this.prisma.employee.findFirst({
            where: { id, organizationId },
            include: {
                ...employeeListInclude,
                contracts: {
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
                _count: {
                    select: { documents: { where: { isArchived: false } } },
                },
            },
        });
        if (!employee)
            throw new common_1.NotFoundException('Nhân viên không tồn tại');
        const { _count, ...rest } = employee;
        return {
            ...rest,
            documentsCount: _count.documents,
        };
    }
    async ensureEmployee(organizationId, id) {
        const employee = await this.prisma.employee.findFirst({
            where: { id, organizationId },
        });
        if (!employee)
            throw new common_1.NotFoundException('Nhân viên không tồn tại');
        return employee;
    }
    parseDate(value) {
        if (value === undefined)
            return undefined;
        if (value === null)
            return null;
        return new Date(value);
    }
    async create(organizationId, dto, actor) {
        if (dto.managerId) {
            await this.ensureEmployee(organizationId, dto.managerId);
        }
        if (dto.departmentId) {
            const dept = await this.prisma.department.findFirst({
                where: { id: dto.departmentId, organizationId },
            });
            if (!dept)
                throw new common_1.BadRequestException('Phòng ban không tồn tại');
        }
        if (dto.code) {
            const codeTaken = await this.prisma.employee.findFirst({
                where: { organizationId, code: dto.code },
            });
            if (codeTaken)
                throw new common_1.ConflictException('Mã nhân viên đã tồn tại');
        }
        const employee = await this.prisma.employee.create({
            data: {
                organizationId,
                name: dto.name,
                code: dto.code,
                phone: dto.phone,
                email: dto.email,
                position: dto.position,
                branchId: dto.branchId,
                departmentId: dto.departmentId,
                managerId: dto.managerId,
                employmentType: dto.employmentType,
                status: dto.status,
                avatarUrl: dto.avatarUrl,
                dateOfBirth: this.parseDate(dto.dateOfBirth) ?? undefined,
                legalIdNumber: dto.legalIdNumber,
                address: dto.address,
                startDate: this.parseDate(dto.startDate) ?? undefined,
                endDate: this.parseDate(dto.endDate) ?? undefined,
                hiredAt: this.parseDate(dto.hiredAt) ?? undefined,
                isActive: dto.isActive ?? true,
            },
            include: employeeListInclude,
        });
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'hrm.employee.create',
            entityType: 'Employee',
            entityId: employee.id,
            metadata: {
                after: {
                    name: employee.name,
                    code: employee.code,
                    branchId: employee.branchId,
                    departmentId: employee.departmentId,
                    employmentType: employee.employmentType,
                    status: employee.status,
                },
            },
            ipAddress: actor?.ipAddress,
        });
        return employee;
    }
    async update(organizationId, id, dto, actor) {
        const before = await this.findOne(organizationId, id);
        if (dto.managerId) {
            if (dto.managerId === id) {
                throw new common_1.BadRequestException('Không thể đặt chính mình làm quản lý');
            }
            await this.ensureEmployee(organizationId, dto.managerId);
        }
        if (dto.departmentId) {
            const dept = await this.prisma.department.findFirst({
                where: { id: dto.departmentId, organizationId },
            });
            if (!dept)
                throw new common_1.BadRequestException('Phòng ban không tồn tại');
        }
        if (dto.code !== undefined && dto.code !== before.code) {
            const codeTaken = await this.prisma.employee.findFirst({
                where: { organizationId, code: dto.code, NOT: { id } },
            });
            if (codeTaken)
                throw new common_1.ConflictException('Mã nhân viên đã tồn tại');
        }
        const employee = await this.prisma.employee.update({
            where: { id },
            data: {
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.code !== undefined && { code: dto.code }),
                ...(dto.phone !== undefined && { phone: dto.phone }),
                ...(dto.email !== undefined && { email: dto.email }),
                ...(dto.position !== undefined && { position: dto.position }),
                ...(dto.branchId !== undefined && { branchId: dto.branchId }),
                ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
                ...(dto.managerId !== undefined && { managerId: dto.managerId }),
                ...(dto.employmentType !== undefined && { employmentType: dto.employmentType }),
                ...(dto.status !== undefined && { status: dto.status }),
                ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
                ...(dto.dateOfBirth !== undefined && {
                    dateOfBirth: this.parseDate(dto.dateOfBirth),
                }),
                ...(dto.legalIdNumber !== undefined && { legalIdNumber: dto.legalIdNumber }),
                ...(dto.address !== undefined && { address: dto.address }),
                ...(dto.startDate !== undefined && { startDate: this.parseDate(dto.startDate) }),
                ...(dto.endDate !== undefined && { endDate: this.parseDate(dto.endDate) }),
                ...(dto.hiredAt !== undefined && { hiredAt: this.parseDate(dto.hiredAt) }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            },
            include: employeeListInclude,
        });
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'hrm.employee.update',
            entityType: 'Employee',
            entityId: id,
            metadata: {
                before: {
                    name: before.name,
                    code: before.code,
                    branchId: before.branchId,
                    departmentId: before.departmentId,
                    managerId: before.managerId,
                    employmentType: before.employmentType,
                    status: before.status,
                    isActive: before.isActive,
                    position: before.position,
                },
                after: {
                    name: employee.name,
                    code: employee.code,
                    branchId: employee.branchId,
                    departmentId: employee.departmentId,
                    managerId: employee.managerId,
                    employmentType: employee.employmentType,
                    status: employee.status,
                    isActive: employee.isActive,
                    position: employee.position,
                },
            },
            ipAddress: actor?.ipAddress,
        });
        return employee;
    }
    async deactivate(organizationId, id, actor) {
        const before = await this.ensureEmployee(organizationId, id);
        const employee = await this.prisma.employee.update({
            where: { id },
            data: {
                status: database_2.EmployeeStatus.TERMINATED,
                isActive: false,
                endDate: before.endDate ?? new Date(),
            },
            include: employeeListInclude,
        });
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'hrm.employee.deactivate',
            entityType: 'Employee',
            entityId: id,
            metadata: {
                before: { status: before.status, isActive: before.isActive },
                after: { status: employee.status, isActive: employee.isActive },
            },
            ipAddress: actor?.ipAddress,
        });
        return employee;
    }
    async createAccount(organizationId, employeeId, dto, actor) {
        const employee = await this.prisma.employee.findFirst({
            where: { id: employeeId, organizationId },
            include: { user: true },
        });
        if (!employee)
            throw new common_1.NotFoundException('Nhân viên không tồn tại');
        if (employee.user) {
            throw new common_1.ConflictException('Nhân viên đã có tài khoản');
        }
        const emailTaken = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (emailTaken)
            throw new common_1.ConflictException('Email đã được sử dụng');
        const role = await this.prisma.role.findFirst({
            where: { organizationId, code: dto.roleCode },
        });
        if (!role)
            throw new common_1.BadRequestException(`Role ${dto.roleCode} không tồn tại`);
        const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
        const user = await new database_1.PlanPolicy(this.prisma).resource(organizationId, 'users', (tx) => tx.user.count({ where: { organizationId, isActive: true } }), (tx) => tx.user.create({
            data: {
                email: dto.email,
                passwordHash,
                name: dto.name?.trim() || employee.name,
                organizationId,
                roleId: role.id,
                employeeId: employee.id,
            },
            include: { role: true },
        }));
        if (!employee.email) {
            await this.prisma.employee.update({
                where: { id: employee.id },
                data: { email: dto.email },
            });
        }
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'hrm.account.create',
            entityType: 'Employee',
            entityId: employeeId,
            metadata: {
                after: {
                    userId: user.id,
                    email: user.email,
                    roleCode: role.code,
                },
            },
            ipAddress: actor?.ipAddress,
        });
        const { passwordHash: _pw, ...safe } = user;
        void _pw;
        return safe;
    }
    async resetPassword(organizationId, employeeId, dto, actor) {
        const employee = await this.prisma.employee.findFirst({
            where: { id: employeeId, organizationId },
            include: { user: true },
        });
        if (!employee)
            throw new common_1.NotFoundException('Nhân viên không tồn tại');
        if (!employee.user) {
            throw new common_1.BadRequestException('Nhân viên chưa có tài khoản');
        }
        const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
        await this.prisma.user.update({
            where: { id: employee.user.id },
            data: { passwordHash },
        });
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'hrm.account.reset_password',
            entityType: 'Employee',
            entityId: employeeId,
            metadata: { userId: employee.user.id },
            ipAddress: actor?.ipAddress,
        });
        return { success: true };
    }
};
exports.HrmEmployeesService = HrmEmployeesService;
exports.HrmEmployeesService = HrmEmployeesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], HrmEmployeesService);
