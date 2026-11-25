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
exports.HrmTimesheetService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const database_2 = require("@marketingspa/database");
let HrmTimesheetService = class HrmTimesheetService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async list(organizationId, query) {
        return this.prisma.timesheetPeriod.findMany({
            where: {
                organizationId,
                ...(query.branchId !== undefined && { branchId: query.branchId }),
                ...(query.year !== undefined && { year: query.year }),
                ...(query.month !== undefined && { month: query.month }),
            },
            orderBy: [{ year: 'desc' }, { month: 'desc' }],
            include: {
                lockedBy: { select: { id: true, name: true, email: true } },
                branch: { select: { id: true, name: true } },
                _count: { select: { attendanceDays: true } },
            },
        });
    }
    async create(organizationId, dto, actor) {
        try {
            const period = await this.prisma.timesheetPeriod.create({
                data: {
                    organizationId,
                    branchId: dto.branchId ?? null,
                    year: dto.year,
                    month: dto.month,
                },
            });
            await this.audit.log({
                organizationId,
                userId: actor?.userId,
                action: 'hrm.timesheet.create',
                entityType: 'TimesheetPeriod',
                entityId: period.id,
                metadata: { after: { year: dto.year, month: dto.month, branchId: dto.branchId ?? null } },
                ipAddress: actor?.ipAddress,
            });
            return period;
        }
        catch (e) {
            if (e instanceof database_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                throw new common_1.ConflictException('Kỳ bảng công đã tồn tại');
            }
            throw e;
        }
    }
    async getOrCreateForDate(organizationId, branchId, workDate) {
        const year = workDate.getUTCFullYear();
        const month = workDate.getUTCMonth() + 1;
        const existing = await this.prisma.timesheetPeriod.findFirst({
            where: {
                organizationId,
                branchId,
                year,
                month,
            },
        });
        if (existing)
            return existing;
        return this.prisma.timesheetPeriod.create({
            data: { organizationId, branchId, year, month },
        });
    }
    async assertPeriodOpenForDate(organizationId, branchId, workDate) {
        const year = workDate.getUTCFullYear();
        const month = workDate.getUTCMonth() + 1;
        const period = await this.prisma.timesheetPeriod.findFirst({
            where: { organizationId, branchId, year, month },
        });
        if (period?.status === database_1.TimesheetStatus.LOCKED) {
            throw new common_1.BadRequestException('Bảng công tháng này đã khóa — không thể sửa trực tiếp');
        }
    }
    async lock(organizationId, id, actor) {
        const period = await this.findPeriod(organizationId, id);
        if (period.status === database_1.TimesheetStatus.LOCKED)
            return period;
        const before = { status: period.status, lockedAt: period.lockedAt, lockedById: period.lockedById };
        const updated = await this.prisma.timesheetPeriod.update({
            where: { id },
            data: {
                status: database_1.TimesheetStatus.LOCKED,
                lockedAt: new Date(),
                lockedById: actor?.userId,
                unlockReason: null,
            },
        });
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'hrm.timesheet.lock',
            entityType: 'TimesheetPeriod',
            entityId: id,
            metadata: {
                before,
                after: { status: database_1.TimesheetStatus.LOCKED, lockedAt: updated.lockedAt, lockedById: updated.lockedById },
            },
            ipAddress: actor?.ipAddress,
        });
        return updated;
    }
    async unlock(organizationId, id, reason, actor) {
        const trimmed = reason?.trim();
        if (!trimmed || trimmed.length < 3) {
            throw new common_1.BadRequestException('Mở khóa kỳ công bắt buộc nhập lý do (≥ 3 ký tự)');
        }
        const period = await this.findPeriod(organizationId, id);
        if (period.status !== database_1.TimesheetStatus.LOCKED) {
            throw new common_1.BadRequestException('Kỳ công chưa bị khóa');
        }
        const before = {
            status: period.status,
            lockedAt: period.lockedAt,
            lockedById: period.lockedById,
        };
        const updated = await this.prisma.timesheetPeriod.update({
            where: { id: period.id },
            data: {
                status: database_1.TimesheetStatus.OPEN,
                lockedAt: null,
                lockedById: null,
                unlockReason: trimmed,
            },
        });
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'hrm.timesheet.unlock',
            entityType: 'TimesheetPeriod',
            entityId: id,
            metadata: {
                before,
                after: { status: database_1.TimesheetStatus.OPEN, unlockReason: trimmed },
                reason: trimmed,
            },
            ipAddress: actor?.ipAddress,
        });
        return updated;
    }
    async findPeriod(organizationId, id) {
        const period = await this.prisma.timesheetPeriod.findFirst({
            where: { id, organizationId },
        });
        if (!period)
            throw new common_1.NotFoundException('Kỳ bảng công không tồn tại');
        return period;
    }
    periodForWorkDate(workDateInput) {
        const workDate = (0, database_2.parseWorkDate)(workDateInput);
        return {
            workDate,
            year: workDate.getUTCFullYear(),
            month: workDate.getUTCMonth() + 1,
        };
    }
};
exports.HrmTimesheetService = HrmTimesheetService;
exports.HrmTimesheetService = HrmTimesheetService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], HrmTimesheetService);
