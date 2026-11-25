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
exports.HrmLeaveService = void 0;
const plan_storage_1 = require("../common/uploads/plan-storage");
const common_1 = require("@nestjs/common");
const fs_1 = require("fs");
const path_1 = require("path");
const crypto_1 = require("crypto");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const pagination_util_1 = require("../common/utils/pagination.util");
const hrm_employees_service_1 = require("./hrm-employees.service");
const hrm_attendance_service_1 = require("./hrm-attendance.service");
const hrm_timesheet_service_1 = require("./hrm-timesheet.service");
const hrm_attendance_scope_1 = require("./hrm-attendance-scope");
const database_2 = require("@marketingspa/database");
const LEAVE_MIME_ALLOW = new Set([
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const LEAVE_MAX_BYTES = 5 * 1024 * 1024;
const LEAVE_INCLUDE = {
    employee: { select: { id: true, name: true, code: true } },
    branch: { select: { id: true, name: true } },
    approver: { select: { id: true, name: true, email: true } },
};
const OT_INCLUDE = {
    employee: { select: { id: true, name: true, code: true } },
    branch: { select: { id: true, name: true } },
    approver: { select: { id: true, name: true, email: true } },
};
let HrmLeaveService = class HrmLeaveService {
    prisma;
    audit;
    employees;
    attendance;
    timesheet;
    constructor(prisma, audit, employees, attendance, timesheet) {
        this.prisma = prisma;
        this.audit = audit;
        this.employees = employees;
        this.attendance = attendance;
        this.timesheet = timesheet;
    }
    async scopeFor(organizationId, user) {
        if (!user?.role)
            return { mode: 'all' };
        return (0, hrm_attendance_scope_1.resolveHrmAccessScope)(this.prisma, organizationId, user);
    }
    applyEmployeeScope(scope, employeeId) {
        if (employeeId) {
            if (scope.mode === 'ids' && !scope.employeeIds.includes(employeeId)) {
                throw new common_1.ForbiddenException('Không có quyền xem nhân viên này');
            }
            return employeeId;
        }
        if (scope.mode === 'ids') {
            return { in: scope.employeeIds.length ? scope.employeeIds : ['__none__'] };
        }
        return undefined;
    }
    async listLeave(organizationId, query, user) {
        const scope = await this.scopeFor(organizationId, user);
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        const employeeFilter = this.applyEmployeeScope(scope, query.employeeId);
        const where = {
            organizationId,
            ...(query.branchId && { branchId: query.branchId }),
            ...(employeeFilter !== undefined && { employeeId: employeeFilter }),
            ...(query.status && { status: query.status }),
        };
        const [items, total] = await Promise.all([
            this.prisma.leaveRequest.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: LEAVE_INCLUDE,
            }),
            this.prisma.leaveRequest.count({ where }),
        ]);
        return (0, pagination_util_1.buildPaginatedResult)(items, total, page, pageSize);
    }
    async getBalance(organizationId, query, user) {
        const scope = await this.scopeFor(organizationId, user);
        const employeeId = query.employeeId ?? user?.employeeId;
        if (!employeeId)
            throw new common_1.BadRequestException('Thiếu employeeId');
        (0, hrm_attendance_scope_1.assertEmployeeInScope)(scope, employeeId, 'xem số dư phép của');
        const employee = await this.employees.ensureEmployee(organizationId, employeeId);
        const year = query.year ?? new Date().getUTCFullYear();
        const from = new Date(Date.UTC(year, 0, 1));
        const to = new Date(Date.UTC(year, 11, 31));
        const approved = await this.prisma.leaveRequest.findMany({
            where: {
                organizationId,
                employeeId,
                status: database_1.LeaveRequestStatus.APPROVED,
                fromDate: { lte: to },
                toDate: { gte: from },
            },
            select: { leaveType: true, days: true, fromDate: true, toDate: true },
        });
        const usedByType = {};
        for (const row of approved) {
            const key = row.leaveType;
            usedByType[key] = (usedByType[key] ?? 0) + Number(row.days);
        }
        const types = Object.values(database_1.LeaveType);
        const balances = types.map((leaveType) => {
            const quota = (0, database_2.resolveLeaveQuota)(leaveType, employee.metadata);
            const used = usedByType[leaveType] ?? 0;
            return {
                leaveType,
                year,
                quota,
                used,
                remaining: quota == null ? null : Math.max(0, Math.round((quota - used) * 10) / 10),
            };
        });
        return { employeeId, year, balances };
    }
    async createLeave(organizationId, dto, file, actor) {
        const scope = await this.scopeFor(organizationId, actor?.role ? { role: actor.role, employeeId: actor.employeeId } : undefined);
        const employeeId = dto.employeeId ?? actor?.employeeId;
        if (!employeeId)
            throw new common_1.BadRequestException('Thiếu employeeId');
        if (actor?.role) {
            (0, hrm_attendance_scope_1.assertCanCreateLeaveOt)({ role: actor.role, employeeId: actor.employeeId }, employeeId, scope);
        }
        const employee = await this.employees.ensureEmployee(organizationId, employeeId);
        const dayPart = dto.dayPart ?? database_1.LeaveDayPart.FULL;
        let days;
        try {
            days = (0, database_2.computeLeaveDays)({
                fromDate: dto.fromDate,
                toDate: dto.toDate,
                dayPart,
            });
        }
        catch (e) {
            const code = e instanceof Error ? e.message : '';
            if (code === 'INVALID_DATE_RANGE') {
                throw new common_1.BadRequestException('Ngày kết thúc phải sau hoặc bằng ngày bắt đầu');
            }
            if (code === 'HALF_DAY_SINGLE_DATE') {
                throw new common_1.BadRequestException('Nửa ngày chỉ áp dụng khi từ ngày = đến ngày');
            }
            throw e;
        }
        const fromDate = (0, database_2.parseWorkDate)(dto.fromDate);
        const toDate = (0, database_2.parseWorkDate)(dto.toDate);
        await this.assertNoLeaveOverlap(organizationId, employeeId, fromDate, toDate);
        await this.assertLeaveBalance(organizationId, employee, dto.leaveType, days, fromDate);
        const attachment = file ? await this.saveLeaveAttachment(organizationId, file) : null;
        const created = await this.prisma.leaveRequest.create({
            data: {
                organizationId,
                branchId: dto.branchId ?? employee.branchId,
                employeeId,
                leaveType: dto.leaveType,
                dayPart,
                fromDate,
                toDate,
                days: new database_1.Prisma.Decimal(days),
                reason: dto.reason,
                attachmentKey: attachment?.key,
                attachmentName: attachment?.name,
                attachmentMime: attachment?.mime,
                attachmentSize: attachment?.size,
            },
        });
        const request = await this.prisma.leaveRequest.update({
            where: { id: created.id },
            data: {
                attachmentUrl: attachment
                    ? `/api/v1/hrm/leave-requests/${created.id}/attachment`
                    : null,
            },
            include: LEAVE_INCLUDE,
        });
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'hrm.leave.create',
            entityType: 'LeaveRequest',
            entityId: request.id,
            metadata: {
                after: {
                    leaveType: dto.leaveType,
                    dayPart,
                    fromDate: dto.fromDate,
                    toDate: dto.toDate,
                    days,
                    hasAttachment: !!attachment,
                },
            },
            ipAddress: actor?.ipAddress,
        });
        return request;
    }
    async approveLeave(organizationId, id, dto, approverId, actor) {
        const request = await this.findLeave(organizationId, id);
        const scope = await this.scopeFor(organizationId, actor?.role ? { role: actor.role, employeeId: actor.employeeId } : undefined);
        if (actor?.role) {
            (0, hrm_attendance_scope_1.assertCanApproveLeaveOt)({ role: actor.role, employeeId: actor.employeeId }, request.employeeId, scope);
        }
        if (request.status !== database_1.LeaveRequestStatus.PENDING) {
            throw new common_1.BadRequestException('Đơn phép không ở trạng thái chờ duyệt');
        }
        await this.assertRangePeriodsOpen(organizationId, request.branchId, request.fromDate, request.toDate);
        const updated = await this.prisma.$transaction(async (tx) => {
            const result = await tx.leaveRequest.updateMany({
                where: { id, organizationId, status: database_1.LeaveRequestStatus.PENDING },
                data: {
                    status: database_1.LeaveRequestStatus.APPROVED,
                    approverId,
                    decidedAt: new Date(),
                    decisionNote: dto.decisionNote,
                },
            });
            if (result.count !== 1) {
                throw new common_1.BadRequestException('Đơn phép đã được xử lý');
            }
            return tx.leaveRequest.findFirstOrThrow({
                where: { id, organizationId },
                include: LEAVE_INCLUDE,
            });
        });
        // Rebuild idempotent — chỉ lấy đơn APPROVED, không cộng trùng cùng request
        await this.rebuildLeaveRange(organizationId, request.employeeId, request.fromDate, request.toDate);
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'hrm.leave.approve',
            entityType: 'LeaveRequest',
            entityId: id,
            metadata: {
                before: { status: database_1.LeaveRequestStatus.PENDING },
                after: { status: database_1.LeaveRequestStatus.APPROVED },
                attendanceUpdated: {
                    employeeId: request.employeeId,
                    fromDate: (0, database_2.workDateKey)(request.fromDate),
                    toDate: (0, database_2.workDateKey)(request.toDate),
                },
            },
            ipAddress: actor?.ipAddress,
        });
        return updated;
    }
    async rejectLeave(organizationId, id, dto, approverId, actor) {
        if (!dto.decisionNote?.trim() || dto.decisionNote.trim().length < 3) {
            throw new common_1.BadRequestException('Từ chối bắt buộc nhập lý do (≥ 3 ký tự)');
        }
        const request = await this.findLeave(organizationId, id);
        const scope = await this.scopeFor(organizationId, actor?.role ? { role: actor.role, employeeId: actor.employeeId } : undefined);
        if (actor?.role) {
            (0, hrm_attendance_scope_1.assertCanApproveLeaveOt)({ role: actor.role, employeeId: actor.employeeId }, request.employeeId, scope);
        }
        if (request.status !== database_1.LeaveRequestStatus.PENDING) {
            throw new common_1.BadRequestException('Đơn phép không ở trạng thái chờ duyệt');
        }
        const updated = await this.prisma.leaveRequest.update({
            where: { id },
            data: {
                status: database_1.LeaveRequestStatus.REJECTED,
                approverId,
                decidedAt: new Date(),
                decisionNote: dto.decisionNote.trim(),
            },
            include: LEAVE_INCLUDE,
        });
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'hrm.leave.reject',
            entityType: 'LeaveRequest',
            entityId: id,
            metadata: {
                before: { status: database_1.LeaveRequestStatus.PENDING },
                after: { status: database_1.LeaveRequestStatus.REJECTED, decisionNote: dto.decisionNote.trim() },
                reason: dto.decisionNote.trim(),
            },
            ipAddress: actor?.ipAddress,
        });
        return updated;
    }
    async cancelLeave(organizationId, id, dto, actor) {
        if (!dto.reason?.trim() || dto.reason.trim().length < 3) {
            throw new common_1.BadRequestException('Hủy đơn bắt buộc nhập lý do (≥ 3 ký tự)');
        }
        const request = await this.findLeave(organizationId, id);
        const scope = await this.scopeFor(organizationId, actor?.role ? { role: actor.role, employeeId: actor.employeeId } : undefined);
        (0, hrm_attendance_scope_1.assertEmployeeInScope)(scope, request.employeeId, 'hủy đơn của');
        // Staff chỉ hủy đơn của mình; Manager/HR/Owner trong scope
        if (actor?.role &&
            actor.role !== 'OWNER' &&
            actor.role !== 'HR' &&
            actor.role !== 'MANAGER' &&
            actor.employeeId !== request.employeeId) {
            throw new common_1.ForbiddenException('Bạn chỉ được hủy đơn của chính mình');
        }
        if (request.status !== database_1.LeaveRequestStatus.PENDING &&
            request.status !== database_1.LeaveRequestStatus.APPROVED) {
            throw new common_1.BadRequestException('Chỉ hủy được đơn đang chờ duyệt hoặc đã duyệt');
        }
        const wasApproved = request.status === database_1.LeaveRequestStatus.APPROVED;
        if (wasApproved) {
            await this.assertRangePeriodsOpen(organizationId, request.branchId, request.fromDate, request.toDate);
        }
        const updated = await this.prisma.$transaction(async (tx) => {
            const result = await tx.leaveRequest.updateMany({
                where: {
                    id,
                    organizationId,
                    status: { in: [database_1.LeaveRequestStatus.PENDING, database_1.LeaveRequestStatus.APPROVED] },
                },
                data: {
                    status: database_1.LeaveRequestStatus.CANCELLED,
                    cancelledAt: new Date(),
                    cancelReason: dto.reason.trim(),
                },
            });
            if (result.count !== 1) {
                throw new common_1.BadRequestException('Không thể hủy đơn ở trạng thái hiện tại');
            }
            return tx.leaveRequest.findFirstOrThrow({
                where: { id, organizationId },
                include: LEAVE_INCLUDE,
            });
        });
        if (wasApproved) {
            await this.rebuildLeaveRange(organizationId, request.employeeId, request.fromDate, request.toDate);
        }
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'hrm.leave.cancel',
            entityType: 'LeaveRequest',
            entityId: id,
            metadata: {
                before: { status: request.status },
                after: { status: database_1.LeaveRequestStatus.CANCELLED },
                reason: dto.reason.trim(),
                attendanceUpdated: wasApproved,
            },
            ipAddress: actor?.ipAddress,
        });
        return updated;
    }
    async getLeaveAttachment(organizationId, id, user) {
        const request = await this.findLeave(organizationId, id);
        const scope = await this.scopeFor(organizationId, user);
        (0, hrm_attendance_scope_1.assertEmployeeInScope)(scope, request.employeeId, 'xem đính kèm của');
        if (!request.attachmentKey) {
            throw new common_1.NotFoundException('Đơn không có file đính kèm');
        }
        const absPath = (0, path_1.join)(process.cwd(), 'uploads', request.attachmentKey);
        if (!(0, fs_1.existsSync)(absPath)) {
            throw new common_1.NotFoundException('File đính kèm không tồn tại');
        }
        const stream = (0, fs_1.createReadStream)(absPath);
        return {
            file: new common_1.StreamableFile(stream),
            mime: request.attachmentMime ?? 'application/octet-stream',
            filename: request.attachmentName ?? 'attachment',
        };
    }
    async listOvertime(organizationId, query, user) {
        const scope = await this.scopeFor(organizationId, user);
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        const employeeFilter = this.applyEmployeeScope(scope, query.employeeId);
        const where = {
            organizationId,
            ...(query.branchId && { branchId: query.branchId }),
            ...(employeeFilter !== undefined && { employeeId: employeeFilter }),
            ...(query.status && { status: query.status }),
        };
        const [items, total] = await Promise.all([
            this.prisma.overtimeRequest.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: OT_INCLUDE,
            }),
            this.prisma.overtimeRequest.count({ where }),
        ]);
        return (0, pagination_util_1.buildPaginatedResult)(items, total, page, pageSize);
    }
    async createOvertime(organizationId, dto, actor) {
        const scope = await this.scopeFor(organizationId, actor?.role ? { role: actor.role, employeeId: actor.employeeId } : undefined);
        const employeeId = dto.employeeId ?? actor?.employeeId;
        if (!employeeId)
            throw new common_1.BadRequestException('Thiếu employeeId');
        if (actor?.role) {
            (0, hrm_attendance_scope_1.assertCanCreateLeaveOt)({ role: actor.role, employeeId: actor.employeeId }, employeeId, scope);
        }
        const employee = await this.employees.ensureEmployee(organizationId, employeeId);
        const branchId = dto.branchId ?? employee.branchId;
        if (!branchId)
            throw new common_1.BadRequestException('Nhân viên chưa gắn chi nhánh');
        const workDate = (0, database_2.parseWorkDate)(dto.workDate);
        let minutes;
        try {
            minutes = (0, database_2.computeOvertimeMinutes)({
                startAt: dto.startAt,
                endAt: dto.endAt,
                breakMinutes: dto.breakMinutes ?? 0,
            });
        }
        catch (e) {
            const code = e instanceof Error ? e.message : '';
            if (code === 'OT_END_BEFORE_START') {
                throw new common_1.BadRequestException('Giờ kết thúc OT phải sau giờ bắt đầu');
            }
            if (code === 'OT_MINUTES_TOO_SMALL') {
                throw new common_1.BadRequestException('Tổng phút OT phải ≥ 1 sau khi trừ thời gian nghỉ');
            }
            throw new common_1.BadRequestException('Thời gian OT không hợp lệ');
        }
        const startAt = new Date(dto.startAt);
        const endAt = new Date(dto.endAt);
        // Chặn OT trùng khung giờ cùng ngày (PENDING/APPROVED)
        const sameDay = await this.prisma.overtimeRequest.findMany({
            where: {
                organizationId,
                employeeId,
                workDate,
                status: { in: [database_1.LeaveRequestStatus.PENDING, database_1.LeaveRequestStatus.APPROVED] },
            },
        });
        for (const other of sameDay) {
            if (other.startAt && other.endAt) {
                if (startAt < other.endAt && endAt > other.startAt) {
                    throw new common_1.BadRequestException('Khung giờ OT trùng với đơn khác');
                }
            }
        }
        const request = await this.prisma.overtimeRequest.create({
            data: {
                organizationId,
                branchId,
                employeeId,
                workDate,
                startAt,
                endAt,
                breakMinutes: dto.breakMinutes ?? 0,
                minutes,
                reason: dto.reason,
            },
            include: OT_INCLUDE,
        });
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'hrm.overtime.create',
            entityType: 'OvertimeRequest',
            entityId: request.id,
            metadata: {
                after: {
                    workDate: dto.workDate,
                    startAt: dto.startAt,
                    endAt: dto.endAt,
                    breakMinutes: dto.breakMinutes ?? 0,
                    minutes,
                },
            },
            ipAddress: actor?.ipAddress,
        });
        return request;
    }
    async approveOvertime(organizationId, id, dto, approverId, actor) {
        const request = await this.findOvertime(organizationId, id);
        const scope = await this.scopeFor(organizationId, actor?.role ? { role: actor.role, employeeId: actor.employeeId } : undefined);
        if (actor?.role) {
            (0, hrm_attendance_scope_1.assertCanApproveLeaveOt)({ role: actor.role, employeeId: actor.employeeId }, request.employeeId, scope);
        }
        if (request.status !== database_1.LeaveRequestStatus.PENDING) {
            throw new common_1.BadRequestException('Đơn OT không ở trạng thái chờ duyệt');
        }
        await this.timesheet.assertPeriodOpenForDate(organizationId, request.branchId, request.workDate);
        const updated = await this.prisma.$transaction(async (tx) => {
            const result = await tx.overtimeRequest.updateMany({
                where: { id, organizationId, status: database_1.LeaveRequestStatus.PENDING },
                data: {
                    status: database_1.LeaveRequestStatus.APPROVED,
                    approverId,
                    decidedAt: new Date(),
                    decisionNote: dto.decisionNote,
                },
            });
            if (result.count !== 1) {
                throw new common_1.BadRequestException('Đơn OT đã được xử lý');
            }
            return tx.overtimeRequest.findFirstOrThrow({
                where: { id, organizationId },
                include: OT_INCLUDE,
            });
        });
        // Rebuild từ danh sách APPROVED — idempotent, không cộng trùng cùng request
        await this.attendance.rebuildDay(organizationId, request.employeeId, request.workDate, {
            force: true,
        });
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'hrm.overtime.approve',
            entityType: 'OvertimeRequest',
            entityId: id,
            metadata: {
                before: { status: database_1.LeaveRequestStatus.PENDING },
                after: { status: database_1.LeaveRequestStatus.APPROVED, minutes: request.minutes },
                attendanceUpdated: {
                    employeeId: request.employeeId,
                    workDate: (0, database_2.workDateKey)(request.workDate),
                },
            },
            ipAddress: actor?.ipAddress,
        });
        return updated;
    }
    async rejectOvertime(organizationId, id, dto, approverId, actor) {
        if (!dto.decisionNote?.trim() || dto.decisionNote.trim().length < 3) {
            throw new common_1.BadRequestException('Từ chối bắt buộc nhập lý do (≥ 3 ký tự)');
        }
        const request = await this.findOvertime(organizationId, id);
        const scope = await this.scopeFor(organizationId, actor?.role ? { role: actor.role, employeeId: actor.employeeId } : undefined);
        if (actor?.role) {
            (0, hrm_attendance_scope_1.assertCanApproveLeaveOt)({ role: actor.role, employeeId: actor.employeeId }, request.employeeId, scope);
        }
        if (request.status !== database_1.LeaveRequestStatus.PENDING) {
            throw new common_1.BadRequestException('Đơn OT không ở trạng thái chờ duyệt');
        }
        const updated = await this.prisma.overtimeRequest.update({
            where: { id },
            data: {
                status: database_1.LeaveRequestStatus.REJECTED,
                approverId,
                decidedAt: new Date(),
                decisionNote: dto.decisionNote.trim(),
            },
            include: OT_INCLUDE,
        });
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'hrm.overtime.reject',
            entityType: 'OvertimeRequest',
            entityId: id,
            metadata: {
                before: { status: database_1.LeaveRequestStatus.PENDING },
                after: { status: database_1.LeaveRequestStatus.REJECTED },
                reason: dto.decisionNote.trim(),
            },
            ipAddress: actor?.ipAddress,
        });
        return updated;
    }
    async cancelOvertime(organizationId, id, dto, actor) {
        if (!dto.reason?.trim() || dto.reason.trim().length < 3) {
            throw new common_1.BadRequestException('Hủy đơn bắt buộc nhập lý do (≥ 3 ký tự)');
        }
        const request = await this.findOvertime(organizationId, id);
        const scope = await this.scopeFor(organizationId, actor?.role ? { role: actor.role, employeeId: actor.employeeId } : undefined);
        (0, hrm_attendance_scope_1.assertEmployeeInScope)(scope, request.employeeId, 'hủy đơn của');
        if (actor?.role &&
            actor.role !== 'OWNER' &&
            actor.role !== 'HR' &&
            actor.role !== 'MANAGER' &&
            actor.employeeId !== request.employeeId) {
            throw new common_1.ForbiddenException('Bạn chỉ được hủy đơn của chính mình');
        }
        if (request.status !== database_1.LeaveRequestStatus.PENDING &&
            request.status !== database_1.LeaveRequestStatus.APPROVED) {
            throw new common_1.BadRequestException('Chỉ hủy được đơn đang chờ duyệt hoặc đã duyệt');
        }
        const wasApproved = request.status === database_1.LeaveRequestStatus.APPROVED;
        if (wasApproved) {
            await this.timesheet.assertPeriodOpenForDate(organizationId, request.branchId, request.workDate);
        }
        const updated = await this.prisma.$transaction(async (tx) => {
            const result = await tx.overtimeRequest.updateMany({
                where: {
                    id,
                    organizationId,
                    status: { in: [database_1.LeaveRequestStatus.PENDING, database_1.LeaveRequestStatus.APPROVED] },
                },
                data: {
                    status: database_1.LeaveRequestStatus.CANCELLED,
                    cancelledAt: new Date(),
                    cancelReason: dto.reason.trim(),
                },
            });
            if (result.count !== 1) {
                throw new common_1.BadRequestException('Không thể hủy đơn ở trạng thái hiện tại');
            }
            return tx.overtimeRequest.findFirstOrThrow({
                where: { id, organizationId },
                include: OT_INCLUDE,
            });
        });
        if (wasApproved) {
            await this.attendance.rebuildDay(organizationId, request.employeeId, request.workDate, {
                force: true,
            });
        }
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'hrm.overtime.cancel',
            entityType: 'OvertimeRequest',
            entityId: id,
            metadata: {
                before: { status: request.status },
                after: { status: database_1.LeaveRequestStatus.CANCELLED },
                reason: dto.reason.trim(),
                attendanceUpdated: wasApproved,
            },
            ipAddress: actor?.ipAddress,
        });
        return updated;
    }
    async saveLeaveAttachment(organizationId, file) {
        if (!file.buffer?.length) {
            throw new common_1.BadRequestException('File đính kèm trống');
        }
        if ((file.size ?? file.buffer.length) > LEAVE_MAX_BYTES) {
            throw new common_1.BadRequestException('File đính kèm tối đa 5MB');
        }
        const mime = file.mimetype || '';
        if (!LEAVE_MIME_ALLOW.has(mime)) {
            throw new common_1.BadRequestException('MIME không hợp lệ — chỉ PDF, JPG, PNG, WEBP, DOC, DOCX');
        }
        const dir = (0, path_1.join)(process.cwd(), 'uploads', 'hrm', organizationId, 'leave');
        if (!(0, fs_1.existsSync)(dir))
            (0, fs_1.mkdirSync)(dir, { recursive: true });
        const safeExt = (0, path_1.extname)(file.originalname || '').slice(0, 16);
        const filename = `${(0, crypto_1.randomUUID)()}${safeExt}`;
        const absPath = (0, path_1.join)(dir, filename);
        await (0, plan_storage_1.writePlanFile)(this.prisma, organizationId, absPath, file.buffer.length, async () => (0, fs_1.writeFileSync)(absPath, file.buffer));
        const key = `hrm/${organizationId}/leave/${filename}`;
        return {
            key,
            name: file.originalname || filename,
            mime,
            size: file.size ?? file.buffer.length,
        };
    }
    async assertNoLeaveOverlap(organizationId, employeeId, fromDate, toDate, excludeId) {
        const existing = await this.prisma.leaveRequest.findMany({
            where: {
                organizationId,
                employeeId,
                status: { in: [database_1.LeaveRequestStatus.PENDING, database_1.LeaveRequestStatus.APPROVED] },
                ...(excludeId && { id: { not: excludeId } }),
                fromDate: { lte: toDate },
                toDate: { gte: fromDate },
            },
            select: { id: true, fromDate: true, toDate: true, status: true },
        });
        for (const row of existing) {
            if ((0, database_2.datesOverlap)(fromDate, toDate, row.fromDate, row.toDate)) {
                throw new common_1.BadRequestException(`Trùng thời gian với đơn phép ${row.status === 'APPROVED' ? 'đã duyệt' : 'đang chờ'} (${(0, database_2.workDateKey)(row.fromDate)} → ${(0, database_2.workDateKey)(row.toDate)})`);
            }
        }
    }
    async assertLeaveBalance(organizationId, employee, leaveType, days, fromDate) {
        const quota = (0, database_2.resolveLeaveQuota)(leaveType, employee.metadata);
        if (quota == null)
            return;
        const year = fromDate.getUTCFullYear();
        const yearFrom = new Date(Date.UTC(year, 0, 1));
        const yearTo = new Date(Date.UTC(year, 11, 31));
        const approved = await this.prisma.leaveRequest.findMany({
            where: {
                organizationId,
                employeeId: employee.id,
                leaveType,
                status: database_1.LeaveRequestStatus.APPROVED,
                fromDate: { lte: yearTo },
                toDate: { gte: yearFrom },
            },
            select: { days: true },
        });
        const pending = await this.prisma.leaveRequest.findMany({
            where: {
                organizationId,
                employeeId: employee.id,
                leaveType,
                status: database_1.LeaveRequestStatus.PENDING,
                fromDate: { lte: yearTo },
                toDate: { gte: yearFrom },
            },
            select: { days: true },
        });
        const used = approved.reduce((s, r) => s + Number(r.days), 0) +
            pending.reduce((s, r) => s + Number(r.days), 0);
        if (used + days > quota + 1e-9) {
            throw new common_1.BadRequestException(`Không đủ số dư phép ${leaveType}: còn ${Math.max(0, quota - used)} ngày, đơn cần ${days} ngày`);
        }
    }
    async assertRangePeriodsOpen(organizationId, branchId, fromDate, toDate) {
        const cursor = new Date(fromDate);
        while ((0, database_2.workDateKey)(cursor) <= (0, database_2.workDateKey)(toDate)) {
            const year = cursor.getUTCFullYear();
            const month = cursor.getUTCMonth() + 1;
            const period = await this.prisma.timesheetPeriod.findFirst({
                where: { organizationId, branchId, year, month },
            });
            if (period?.status === database_1.TimesheetStatus.LOCKED) {
                throw new common_1.BadRequestException(`Bảng công ${String(month).padStart(2, '0')}/${year} đã khóa — không thể duyệt/sửa`);
            }
            // Also check org-wide period (branchId null)
            if (branchId) {
                const orgPeriod = await this.prisma.timesheetPeriod.findFirst({
                    where: { organizationId, branchId: null, year, month },
                });
                if (orgPeriod?.status === database_1.TimesheetStatus.LOCKED) {
                    throw new common_1.BadRequestException(`Bảng công ${String(month).padStart(2, '0')}/${year} đã khóa — không thể duyệt/sửa`);
                }
            }
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
    }
    async findLeave(organizationId, id) {
        const request = await this.prisma.leaveRequest.findFirst({
            where: { id, organizationId },
        });
        if (!request)
            throw new common_1.NotFoundException('Đơn phép không tồn tại');
        return request;
    }
    async findOvertime(organizationId, id) {
        const request = await this.prisma.overtimeRequest.findFirst({
            where: { id, organizationId },
        });
        if (!request)
            throw new common_1.NotFoundException('Đơn OT không tồn tại');
        return request;
    }
    async rebuildLeaveRange(organizationId, employeeId, fromDate, toDate) {
        const cursor = new Date(fromDate);
        while ((0, database_2.workDateKey)(cursor) <= (0, database_2.workDateKey)(toDate)) {
            await this.attendance.rebuildDay(organizationId, employeeId, cursor, { force: true });
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
    }
};
exports.HrmLeaveService = HrmLeaveService;
exports.HrmLeaveService = HrmLeaveService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        hrm_employees_service_1.HrmEmployeesService,
        hrm_attendance_service_1.HrmAttendanceService,
        hrm_timesheet_service_1.HrmTimesheetService])
], HrmLeaveService);
