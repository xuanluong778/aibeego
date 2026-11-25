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
exports.HrmShiftAssignmentsService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const pagination_util_1 = require("../common/utils/pagination.util");
const hrm_employees_service_1 = require("./hrm-employees.service");
const hrm_timesheet_service_1 = require("./hrm-timesheet.service");
const hrm_attendance_scope_1 = require("./hrm-attendance-scope");
const roles_1 = require("../common/constants/roles");
const ASSIGN_INCLUDE = {
    employee: {
        select: {
            id: true,
            name: true,
            code: true,
            departmentId: true,
            department: { select: { id: true, name: true } },
        },
    },
    branch: { select: { id: true, name: true } },
    policy: {
        select: {
            id: true,
            name: true,
            code: true,
            startTime: true,
            endTime: true,
            crossesMidnight: true,
            breakMinutes: true,
        },
    },
};
let HrmShiftAssignmentsService = class HrmShiftAssignmentsService {
    prisma;
    audit;
    employees;
    timesheet;
    constructor(prisma, audit, employees, timesheet) {
        this.prisma = prisma;
        this.audit = audit;
        this.employees = employees;
        this.timesheet = timesheet;
    }
    async scopeFor(organizationId, user) {
        if (!user?.role)
            return { mode: 'all' };
        return (0, hrm_attendance_scope_1.resolveHrmAccessScope)(this.prisma, organizationId, user);
    }
    assertCanWriteAssignments(role) {
        if (!role || (!(0, hrm_attendance_scope_1.isHrmOrgWideRole)(role) && role !== roles_1.SYSTEM_ROLES.MANAGER)) {
            throw new common_1.ForbiddenException('Không có quyền phân ca');
        }
    }
    /** ISO weekday 1=Mon … 7=Sun from UTC midnight date */
    isoWeekday(workDate) {
        const js = workDate.getUTCDay(); // 0=Sun
        return js === 0 ? 7 : js;
    }
    eachDateInRange(from, to, weekdays) {
        const dates = [];
        const cursor = new Date(from);
        while ((0, database_1.workDateKey)(cursor) <= (0, database_1.workDateKey)(to)) {
            const wd = this.isoWeekday(cursor);
            if (!weekdays?.length || weekdays.includes(wd)) {
                dates.push(new Date(cursor));
            }
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
        return dates;
    }
    async findAll(organizationId, query, user) {
        const scope = await this.scopeFor(organizationId, user);
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        let employeeFilter;
        if (query.employeeId) {
            (0, hrm_attendance_scope_1.assertEmployeeInScope)(scope, query.employeeId, 'xem ca của');
            employeeFilter = query.employeeId;
        }
        else if (scope.mode === 'ids') {
            employeeFilter = {
                in: scope.employeeIds.length ? scope.employeeIds : ['__none__'],
            };
        }
        const where = {
            organizationId,
            ...(query.branchId && { branchId: query.branchId }),
            ...(query.policyId && { policyId: query.policyId }),
            ...(employeeFilter !== undefined && { employeeId: employeeFilter }),
            ...(query.departmentId && {
                employee: { departmentId: query.departmentId },
            }),
            ...(query.from || query.to
                ? {
                    workDate: {
                        ...(query.from && { gte: (0, database_1.parseWorkDate)(query.from) }),
                        ...(query.to && { lte: (0, database_1.parseWorkDate)(query.to) }),
                    },
                }
                : {}),
        };
        const [items, total] = await Promise.all([
            this.prisma.shiftAssignment.findMany({
                where,
                skip,
                take,
                orderBy: [{ workDate: 'asc' }, { startAt: 'asc' }],
                include: ASSIGN_INCLUDE,
            }),
            this.prisma.shiftAssignment.count({ where }),
        ]);
        return (0, pagination_util_1.buildPaginatedResult)(items, total, page, pageSize);
    }
    async calendar(organizationId, query, user) {
        const scope = await this.scopeFor(organizationId, user);
        let employeeFilter;
        if (query.employeeId) {
            (0, hrm_attendance_scope_1.assertEmployeeInScope)(scope, query.employeeId, 'xem ca của');
            employeeFilter = query.employeeId;
        }
        else if (scope.mode === 'ids') {
            employeeFilter = {
                in: scope.employeeIds.length ? scope.employeeIds : ['__none__'],
            };
        }
        const from = (0, database_1.parseWorkDate)(query.from);
        const to = (0, database_1.parseWorkDate)(query.to);
        const items = await this.prisma.shiftAssignment.findMany({
            where: {
                organizationId,
                workDate: { gte: from, lte: to },
                ...(query.branchId && { branchId: query.branchId }),
                ...(employeeFilter !== undefined && { employeeId: employeeFilter }),
                ...(query.departmentId && {
                    employee: { departmentId: query.departmentId },
                }),
            },
            orderBy: [{ workDate: 'asc' }, { startAt: 'asc' }],
            include: ASSIGN_INCLUDE,
            take: 5000,
        });
        return { from: (0, database_1.workDateKey)(from), to: (0, database_1.workDateKey)(to), items };
    }
    async loadActivePolicy(organizationId, policyId) {
        const policy = await this.prisma.workShiftPolicy.findFirst({
            where: { id: policyId, organizationId, isActive: true },
        });
        if (!policy)
            throw new common_1.NotFoundException('Ca làm việc không tồn tại hoặc đã ngưng');
        return policy;
    }
    async upsertAssignment(input) {
        const { startAt, endAt } = (0, database_1.resolveShiftWindow)(input.workDate, input.policy);
        await this.timesheet.assertPeriodOpenForDate(input.organizationId, input.branchId, input.workDate);
        const existing = await this.prisma.shiftAssignment.findFirst({
            where: {
                organizationId: input.organizationId,
                employeeId: input.employeeId,
                workDate: input.workDate,
            },
        });
        if (existing && !input.forceOverwrite) {
            return {
                status: 'conflict',
                existing,
                workDate: (0, database_1.workDateKey)(input.workDate),
                employeeId: input.employeeId,
            };
        }
        if (existing?.locked) {
            throw new common_1.BadRequestException(`Ca ngày ${(0, database_1.workDateKey)(input.workDate)} đã khóa — không thể ghi đè`);
        }
        if (existing && input.forceOverwrite) {
            const before = {
                policyId: existing.policyId,
                startAt: existing.startAt,
                endAt: existing.endAt,
            };
            const updated = await this.prisma.shiftAssignment.update({
                where: { id: existing.id },
                data: {
                    branchId: input.branchId,
                    policyId: input.policy.id,
                    startAt,
                    endAt,
                    source: database_1.ShiftAssignmentSource.MANUAL,
                    note: input.note,
                },
                include: ASSIGN_INCLUDE,
            });
            await this.audit.log({
                organizationId: input.organizationId,
                userId: input.actor?.userId,
                action: 'hrm.shift_assignment.overwrite',
                entityType: 'ShiftAssignment',
                entityId: updated.id,
                metadata: {
                    before,
                    after: {
                        policyId: input.policy.id,
                        startAt,
                        endAt,
                        workDate: (0, database_1.workDateKey)(input.workDate),
                        employeeId: input.employeeId,
                    },
                    reason: 'forceOverwrite',
                },
                ipAddress: input.actor?.ipAddress,
            });
            return { status: 'overwritten', assignment: updated };
        }
        const created = await this.prisma.shiftAssignment.create({
            data: {
                organizationId: input.organizationId,
                branchId: input.branchId,
                employeeId: input.employeeId,
                policyId: input.policy.id,
                workDate: input.workDate,
                startAt,
                endAt,
                source: database_1.ShiftAssignmentSource.POLICY,
                note: input.note,
            },
            include: ASSIGN_INCLUDE,
        });
        await this.audit.log({
            organizationId: input.organizationId,
            userId: input.actor?.userId,
            action: 'hrm.shift_assignment.create',
            entityType: 'ShiftAssignment',
            entityId: created.id,
            metadata: {
                after: {
                    employeeId: input.employeeId,
                    workDate: (0, database_1.workDateKey)(input.workDate),
                    policyId: input.policy.id,
                    startAt,
                    endAt,
                },
            },
            ipAddress: input.actor?.ipAddress,
        });
        return { status: 'created', assignment: created };
    }
    async create(organizationId, dto, actor) {
        this.assertCanWriteAssignments(actor?.role);
        const scope = await this.scopeFor(organizationId, actor?.role ? { role: actor.role, employeeId: actor.employeeId } : undefined);
        (0, hrm_attendance_scope_1.assertEmployeeInScope)(scope, dto.employeeId, 'phân ca cho');
        const employee = await this.employees.ensureEmployee(organizationId, dto.employeeId);
        const branchId = dto.branchId ?? employee.branchId;
        if (!branchId)
            throw new common_1.BadRequestException('Nhân viên chưa gắn chi nhánh');
        const policy = await this.loadActivePolicy(organizationId, dto.policyId);
        const workDate = (0, database_1.parseWorkDate)(dto.workDate);
        const result = await this.upsertAssignment({
            organizationId,
            branchId,
            employeeId: dto.employeeId,
            policy,
            workDate,
            forceOverwrite: !!dto.forceOverwrite,
            note: dto.note,
            actor,
        });
        if (result.status === 'conflict') {
            throw new common_1.ConflictException({
                message: 'Nhân viên đã có ca trong ngày này — xác nhận để ghi đè',
                conflict: {
                    workDate: result.workDate,
                    employeeId: result.employeeId,
                    existingId: result.existing.id,
                    existingPolicyId: result.existing.policyId,
                },
            });
        }
        return result.assignment;
    }
    async bulkAssign(organizationId, dto, actor) {
        this.assertCanWriteAssignments(actor?.role);
        const scope = await this.scopeFor(organizationId, actor?.role ? { role: actor.role, employeeId: actor.employeeId } : undefined);
        const from = (0, database_1.parseWorkDate)(dto.fromDate);
        const to = (0, database_1.parseWorkDate)(dto.toDate);
        if (to < from)
            throw new common_1.BadRequestException('Khoảng ngày không hợp lệ');
        const policy = await this.loadActivePolicy(organizationId, dto.policyId);
        const dates = this.eachDateInRange(from, to, dto.weekdays);
        let employeeIds = dto.employeeIds ?? [];
        if (!employeeIds.length) {
            const employees = await this.prisma.employee.findMany({
                where: {
                    organizationId,
                    isActive: true,
                    ...(dto.branchId && { branchId: dto.branchId }),
                    ...(dto.departmentId && { departmentId: dto.departmentId }),
                    ...(policy.branchId && !dto.branchId && { branchId: policy.branchId }),
                },
                select: { id: true, branchId: true },
            });
            employeeIds = employees.map((e) => e.id);
        }
        for (const eid of employeeIds) {
            (0, hrm_attendance_scope_1.assertEmployeeInScope)(scope, eid, 'phân ca cho');
        }
        if (!employeeIds.length) {
            throw new common_1.BadRequestException('Không có nhân viên nào để phân ca');
        }
        const employeeRows = await this.prisma.employee.findMany({
            where: { organizationId, id: { in: employeeIds } },
            select: { id: true, branchId: true },
        });
        const branchByEmp = new Map(employeeRows.map((e) => [e.id, e.branchId]));
        const created = [];
        const overwritten = [];
        const conflicts = [];
        for (const employeeId of employeeIds) {
            const empBranch = dto.branchId ?? branchByEmp.get(employeeId) ?? policy.branchId;
            if (!empBranch)
                continue;
            for (const workDate of dates) {
                const result = await this.upsertAssignment({
                    organizationId,
                    branchId: empBranch,
                    employeeId,
                    policy,
                    workDate,
                    forceOverwrite: !!dto.forceOverwrite,
                    note: dto.note,
                    actor,
                });
                if (result.status === 'conflict') {
                    conflicts.push({
                        employeeId,
                        workDate: result.workDate,
                        existingId: result.existing.id,
                    });
                }
                else if (result.status === 'created') {
                    created.push(result.assignment);
                }
                else {
                    overwritten.push(result.assignment);
                }
            }
        }
        if (conflicts.length && !dto.forceOverwrite) {
            throw new common_1.ConflictException({
                message: `${conflicts.length} ca trùng — gửi lại với forceOverwrite=true để ghi đè`,
                conflicts: conflicts.slice(0, 50),
                conflictCount: conflicts.length,
                createdCount: created.length,
            });
        }
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'hrm.shift_assignment.bulk',
            entityType: 'ShiftAssignment',
            metadata: {
                after: {
                    policyId: dto.policyId,
                    fromDate: dto.fromDate,
                    toDate: dto.toDate,
                    weekdays: dto.weekdays,
                    employeeCount: employeeIds.length,
                    created: created.length,
                    overwritten: overwritten.length,
                    forceOverwrite: !!dto.forceOverwrite,
                },
            },
            ipAddress: actor?.ipAddress,
        });
        return {
            created: created.length,
            overwritten: overwritten.length,
            conflicts: conflicts.length,
            items: [...created, ...overwritten].slice(0, 100),
        };
    }
    async update(organizationId, id, dto, actor) {
        this.assertCanWriteAssignments(actor?.role);
        const existing = await this.prisma.shiftAssignment.findFirst({
            where: { id, organizationId },
        });
        if (!existing)
            throw new common_1.NotFoundException('Phân ca không tồn tại');
        const scope = await this.scopeFor(organizationId, actor?.role ? { role: actor.role, employeeId: actor.employeeId } : undefined);
        (0, hrm_attendance_scope_1.assertEmployeeInScope)(scope, existing.employeeId, 'sửa ca của');
        if (existing.locked) {
            throw new common_1.BadRequestException('Ca đã khóa — không thể sửa');
        }
        await this.timesheet.assertPeriodOpenForDate(organizationId, existing.branchId, existing.workDate);
        let startAt = existing.startAt;
        let endAt = existing.endAt;
        let policyId = existing.policyId;
        if (dto.policyId) {
            const policy = await this.loadActivePolicy(organizationId, dto.policyId);
            const window = (0, database_1.resolveShiftWindow)(existing.workDate, policy);
            startAt = window.startAt;
            endAt = window.endAt;
            policyId = policy.id;
        }
        const before = {
            policyId: existing.policyId,
            startAt: existing.startAt,
            endAt: existing.endAt,
            note: existing.note,
        };
        const updated = await this.prisma.shiftAssignment.update({
            where: { id },
            data: {
                policyId,
                startAt,
                endAt,
                ...(dto.note !== undefined && { note: dto.note }),
            },
            include: ASSIGN_INCLUDE,
        });
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'hrm.shift_assignment.update',
            entityType: 'ShiftAssignment',
            entityId: id,
            metadata: { before, after: { policyId, startAt, endAt, note: dto.note } },
            ipAddress: actor?.ipAddress,
        });
        return updated;
    }
    async remove(organizationId, id, actor) {
        this.assertCanWriteAssignments(actor?.role);
        const existing = await this.prisma.shiftAssignment.findFirst({
            where: { id, organizationId },
        });
        if (!existing)
            throw new common_1.NotFoundException('Phân ca không tồn tại');
        const scope = await this.scopeFor(organizationId, actor?.role ? { role: actor.role, employeeId: actor.employeeId } : undefined);
        (0, hrm_attendance_scope_1.assertEmployeeInScope)(scope, existing.employeeId, 'xóa ca của');
        if (existing.locked) {
            throw new common_1.BadRequestException('Ca đã khóa — không thể xóa');
        }
        await this.timesheet.assertPeriodOpenForDate(organizationId, existing.branchId, existing.workDate);
        // Nếu ngày đã có punch — không xóa cứng assignment (giữ để tính công)
        const punchCount = await this.prisma.attendancePunch.count({
            where: {
                organizationId,
                employeeId: existing.employeeId,
                workDate: existing.workDate,
            },
        });
        if (punchCount > 0) {
            throw new common_1.BadRequestException('Ngày đã có dữ liệu chấm công — không xóa phân ca. Hãy đổi ca thay vì xóa.');
        }
        await this.prisma.shiftAssignment.delete({ where: { id } });
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'hrm.shift_assignment.delete',
            entityType: 'ShiftAssignment',
            entityId: id,
            metadata: {
                before: {
                    employeeId: existing.employeeId,
                    workDate: (0, database_1.workDateKey)(existing.workDate),
                    policyId: existing.policyId,
                },
            },
            ipAddress: actor?.ipAddress,
        });
        return { deleted: true, id };
    }
};
exports.HrmShiftAssignmentsService = HrmShiftAssignmentsService;
exports.HrmShiftAssignmentsService = HrmShiftAssignmentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        hrm_employees_service_1.HrmEmployeesService,
        hrm_timesheet_service_1.HrmTimesheetService])
], HrmShiftAssignmentsService);
