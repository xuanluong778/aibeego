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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HrmAttendanceService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const database_1 = require("@marketingspa/database");
const bullmq_1 = require("bullmq");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const queue_constants_1 = require("../queue/queue.constants");
const queue_enqueue_service_1 = require("../common/services/queue-enqueue.service");
const pagination_util_1 = require("../common/utils/pagination.util");
const hrm_employees_service_1 = require("./hrm-employees.service");
const hrm_timesheet_service_1 = require("./hrm-timesheet.service");
const hrm_attendance_scope_1 = require("./hrm-attendance-scope");
const database_2 = require("@marketingspa/database");
const DAY_INCLUDE = {
    employee: {
        select: {
            id: true,
            name: true,
            code: true,
            position: true,
            departmentId: true,
            department: { select: { id: true, name: true } },
        },
    },
    branch: { select: { id: true, name: true } },
    timesheetPeriod: { select: { id: true, year: true, month: true, status: true } },
};
let HrmAttendanceService = class HrmAttendanceService {
    prisma;
    audit;
    employees;
    timesheet;
    queueEnqueue;
    rebuildQueue;
    constructor(prisma, audit, employees, timesheet, queueEnqueue, rebuildQueue) {
        this.prisma = prisma;
        this.audit = audit;
        this.employees = employees;
        this.timesheet = timesheet;
        this.queueEnqueue = queueEnqueue;
        this.rebuildQueue = rebuildQueue;
    }
    async scopeFor(organizationId, user) {
        if (!user)
            return { mode: 'all' };
        return (0, hrm_attendance_scope_1.resolveAttendanceScope)(this.prisma, organizationId, user);
    }
    buildDaysWhere(organizationId, query, scope) {
        const where = {
            organizationId,
            ...(query.branchId && { branchId: query.branchId }),
            ...(query.status && { status: query.status }),
            ...(query.departmentId && { employee: { departmentId: query.departmentId } }),
        };
        if (scope.mode === 'ids') {
            where.employeeId = { in: scope.employeeIds.length ? scope.employeeIds : ['__none__'] };
        }
        if (query.employeeId) {
            if (scope.mode === 'ids' && !scope.employeeIds.includes(query.employeeId)) {
                throw new common_1.ForbiddenException('Không có quyền xem nhân viên này');
            }
            where.employeeId = query.employeeId;
        }
        if (query.year && query.month) {
            const from = new Date(Date.UTC(query.year, query.month - 1, 1));
            const to = new Date(Date.UTC(query.year, query.month, 0));
            where.workDate = { gte: from, lte: to };
        }
        else if (query.from || query.to) {
            where.workDate = {
                ...(query.from && { gte: (0, database_2.parseWorkDate)(query.from) }),
                ...(query.to && { lte: (0, database_2.parseWorkDate)(query.to) }),
            };
        }
        return where;
    }
    async listDays(organizationId, query, user) {
        const scope = await this.scopeFor(organizationId, user);
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        const where = this.buildDaysWhere(organizationId, query, scope);
        const [items, total] = await Promise.all([
            this.prisma.attendanceDay.findMany({
                where,
                skip,
                take,
                orderBy: [{ workDate: 'desc' }, { employeeId: 'asc' }],
                include: DAY_INCLUDE,
            }),
            this.prisma.attendanceDay.count({ where }),
        ]);
        return (0, pagination_util_1.buildPaginatedResult)(items, total, page, pageSize);
    }
    async exportDays(organizationId, query, user) {
        const scope = await this.scopeFor(organizationId, user);
        const where = this.buildDaysWhere(organizationId, query, scope);
        const format = query.format === 'xlsx' ? 'xlsx' : 'csv';
        const items = await this.prisma.attendanceDay.findMany({
            where,
            orderBy: [{ workDate: 'asc' }, { employeeId: 'asc' }],
            include: DAY_INCLUDE,
            take: 10_000,
        });
        const headers = [
            'Ngày',
            'Mã NV',
            'Nhân viên',
            'Chi nhánh',
            'Phòng ban',
            'Giờ vào',
            'Giờ ra',
            'Giờ công (phút)',
            'Đi muộn (phút)',
            'Về sớm (phút)',
            'OT (phút)',
            'Trạng thái',
            'Kỳ',
        ];
        const statusLabel = {
            PRESENT: 'Đủ công',
            INCOMPLETE: 'Thiếu giờ',
            ABSENT: 'Vắng',
            LEAVE: 'Nghỉ phép',
            HOLIDAY: 'Nghỉ lễ',
        };
        const rows = items.map((row) => [
            (0, database_2.workDateKey)(row.workDate),
            row.employee?.code ?? '',
            row.employee?.name ?? '',
            row.branch?.name ?? '',
            row.employee?.department?.name ?? '',
            (0, database_2.formatHrmTime)(row.checkInAt),
            (0, database_2.formatHrmTime)(row.checkOutAt),
            String(row.workedMinutes),
            String(row.lateMinutes),
            String(row.earlyLeaveMinutes),
            String(row.otMinutes),
            statusLabel[row.status] ?? row.status,
            row.timesheetPeriod
                ? `${String(row.timesheetPeriod.month).padStart(2, '0')}/${row.timesheetPeriod.year}`
                : '',
        ]);
        const stamp = new Date().toISOString().slice(0, 10);
        if (format === 'csv') {
            const body = [headers, ...rows]
                .map((cols) => cols.map((c) => this.csvEscape(c)).join(','))
                .join('\n');
            const content = `\uFEFF${body}`;
            return {
                content: Buffer.from(content, 'utf8'),
                contentType: 'text/csv; charset=utf-8',
                filename: `bang-cong-${stamp}.csv`,
            };
        }
        const xmlRows = rows
            .map((cols) => `<Row>${cols.map((c) => `<Cell><Data ss:Type="String">${this.xmlEscape(c)}</Data></Cell>`).join('')}</Row>`)
            .join('');
        const headerRow = `<Row>${headers
            .map((c) => `<Cell><Data ss:Type="String">${this.xmlEscape(c)}</Data></Cell>`)
            .join('')}</Row>`;
        const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="BangCong">
  <Table>${headerRow}${xmlRows}</Table>
 </Worksheet>
</Workbook>`;
        return {
            content: Buffer.from(xml, 'utf8'),
            contentType: 'application/vnd.ms-excel; charset=utf-8',
            filename: `bang-cong-${stamp}.xls`,
        };
    }
    async getTodayPunchState(organizationId, user) {
        if (!user.employeeId) {
            return { employeeId: null, workDate: null, canCheckIn: false, canCheckOut: false, day: null };
        }
        const scope = await this.scopeFor(organizationId, user);
        (0, hrm_attendance_scope_1.assertEmployeeInScope)(scope, user.employeeId);
        const workDate = (0, database_2.workDateFromInstant)(new Date());
        const punches = await this.prisma.attendancePunch.findMany({
            where: { organizationId, employeeId: user.employeeId, workDate },
            orderBy: { punchedAt: 'asc' },
        });
        const checkIns = punches.filter((p) => p.type === database_1.AttendancePunchType.CHECK_IN).length;
        const checkOuts = punches.filter((p) => p.type === database_1.AttendancePunchType.CHECK_OUT).length;
        const day = await this.prisma.attendanceDay.findFirst({
            where: { organizationId, employeeId: user.employeeId, workDate },
            include: DAY_INCLUDE,
        });
        return {
            employeeId: user.employeeId,
            workDate: (0, database_2.workDateKey)(workDate),
            canCheckIn: checkIns <= checkOuts,
            canCheckOut: checkIns > checkOuts,
            day,
            punches: punches.map((p) => ({
                id: p.id,
                type: p.type,
                punchedAt: p.punchedAt,
                method: p.method,
            })),
        };
    }
    async punch(organizationId, dto, actor) {
        const scope = await this.scopeFor(organizationId, actor?.role
            ? { role: actor.role, employeeId: actor.employeeId }
            : undefined);
        const employeeId = dto.employeeId ?? actor?.employeeId ?? undefined;
        if (!employeeId) {
            throw new common_1.BadRequestException('Thiếu employeeId để chấm công');
        }
        if (actor?.role) {
            (0, hrm_attendance_scope_1.assertCanPunchForEmployee)({ role: actor.role, employeeId: actor.employeeId }, employeeId, scope);
        }
        const employee = await this.employees.ensureEmployee(organizationId, employeeId);
        const branchId = dto.branchId ?? employee.branchId;
        if (!branchId) {
            throw new common_1.BadRequestException('Nhân viên chưa gắn chi nhánh');
        }
        const punchedAt = dto.punchedAt ? new Date(dto.punchedAt) : new Date();
        const workDate = (0, database_2.workDateFromInstant)(punchedAt);
        await this.timesheet.assertPeriodOpenForDate(organizationId, branchId, workDate);
        const method = dto.method ?? database_1.AttendanceMethod.MANUAL;
        let qrTokenId;
        if (method === database_1.AttendanceMethod.QR) {
            if (!dto.qrToken)
                throw new common_1.BadRequestException('Thiếu mã QR chấm công');
            const tokenHash = this.hashToken(dto.qrToken);
            const token = await this.prisma.attendanceQrToken.findFirst({
                where: {
                    organizationId,
                    branchId,
                    tokenHash,
                    isActive: true,
                    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
                },
            });
            if (!token)
                throw new common_1.BadRequestException('Mã QR không hợp lệ hoặc đã hết hạn');
            qrTokenId = token.id;
        }
        if (method === database_1.AttendanceMethod.MANUAL && !actor?.userId) {
            throw new common_1.BadRequestException('Chấm công thủ công cần xác thực');
        }
        const existingPunches = await this.prisma.attendancePunch.findMany({
            where: { organizationId, employeeId, workDate },
            select: { type: true },
        });
        try {
            (0, database_2.assertPunchNotDuplicate)(existingPunches, dto.type);
        }
        catch (e) {
            const code = e instanceof Error ? e.message : '';
            if (code === 'DUPLICATE_CHECK_IN') {
                throw new common_1.BadRequestException('Đã chấm vào — không thể chấm vào trùng');
            }
            if (code === 'MISSING_CHECK_IN') {
                throw new common_1.BadRequestException('Chưa chấm vào — không thể chấm ra');
            }
            if (code === 'DUPLICATE_CHECK_OUT') {
                throw new common_1.BadRequestException('Đã chấm ra — không thể chấm ra trùng');
            }
            throw e;
        }
        const punch = await this.prisma.attendancePunch.create({
            data: {
                organizationId,
                branchId,
                employeeId,
                workDate,
                punchedAt,
                type: dto.type,
                method,
                latitude: dto.latitude,
                longitude: dto.longitude,
                accuracyM: dto.accuracyM,
                qrTokenId,
                kioskDeviceId: dto.kioskDeviceId,
                rawMetadata: method === database_1.AttendanceMethod.GPS
                    ? { latitude: dto.latitude, longitude: dto.longitude }
                    : undefined,
            },
        });
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'hrm.attendance.punch',
            entityType: 'AttendancePunch',
            entityId: punch.id,
            metadata: {
                after: {
                    employeeId,
                    type: dto.type,
                    method,
                    punchedAt,
                    workDate: (0, database_2.workDateKey)(workDate),
                },
            },
            ipAddress: actor?.ipAddress,
        });
        const day = await this.rebuildDay(organizationId, employeeId, workDate, { force: true });
        void this.enqueueRebuild(organizationId, employeeId, (0, database_2.workDateKey)(workDate));
        return { punch, day };
    }
    async rebuildDay(organizationId, employeeId, workDateInput, options) {
        const workDate = (0, database_2.parseWorkDate)(workDateInput);
        const employee = await this.employees.ensureEmployee(organizationId, employeeId);
        const branchId = employee.branchId;
        if (!branchId) {
            throw new common_1.BadRequestException('Nhân viên chưa gắn chi nhánh');
        }
        const existing = await this.prisma.attendanceDay.findFirst({
            where: { organizationId, employeeId, workDate },
        });
        if (existing &&
            (existing.source === 'ADJUSTMENT' || existing.source === 'MANUAL') &&
            !options?.force) {
            return this.prisma.attendanceDay.findFirstOrThrow({
                where: { id: existing.id },
                include: {
                    employee: { select: { id: true, name: true, code: true } },
                    timesheetPeriod: { select: { id: true, status: true, year: true, month: true } },
                },
            });
        }
        const [punches, shift, leaveRequests, otRequests] = await Promise.all([
            this.prisma.attendancePunch.findMany({
                where: { organizationId, employeeId, workDate },
                orderBy: { punchedAt: 'asc' },
            }),
            this.prisma.shiftAssignment.findFirst({
                where: { organizationId, employeeId, workDate },
            }),
            this.prisma.leaveRequest.findMany({
                where: {
                    organizationId,
                    employeeId,
                    status: database_1.LeaveRequestStatus.APPROVED,
                    fromDate: { lte: workDate },
                    toDate: { gte: workDate },
                },
            }),
            this.prisma.overtimeRequest.findMany({
                where: {
                    organizationId,
                    employeeId,
                    workDate,
                    status: database_1.LeaveRequestStatus.APPROVED,
                },
            }),
        ]);
        let policyPayload = null;
        if (shift?.policyId) {
            const policy = await this.prisma.workShiftPolicy.findFirst({
                where: { id: shift.policyId, organizationId },
                include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
            });
            if (policy) {
                policyPayload = {
                    startTime: policy.startTime,
                    endTime: policy.endTime,
                    breakMinutes: policy.breakMinutes,
                    lateGraceMinutes: policy.lateGraceMinutes,
                    earlyLeaveGraceMinutes: policy.earlyLeaveGraceMinutes,
                    graceMinutes: policy.lateGraceMinutes,
                    otBeforeMinutes: policy.otBeforeMinutes,
                    otAfterMinutes: policy.otAfterMinutes,
                    crossesMidnight: policy.crossesMidnight,
                    ...(policy.versions[0]?.payload ?? {}),
                };
                // Prefer live policy columns over stale version fields
                policyPayload.startTime = policy.startTime;
                policyPayload.endTime = policy.endTime;
                policyPayload.breakMinutes = policy.breakMinutes;
                policyPayload.lateGraceMinutes = policy.lateGraceMinutes;
                policyPayload.earlyLeaveGraceMinutes = policy.earlyLeaveGraceMinutes;
                policyPayload.otBeforeMinutes = policy.otBeforeMinutes;
                policyPayload.otAfterMinutes = policy.otAfterMinutes;
                policyPayload.crossesMidnight = policy.crossesMidnight;
                policyPayload.graceMinutes = policy.lateGraceMinutes;
            }
        }
        const onApprovedLeave = leaveRequests.some((lr) => (0, database_2.isDateInLeaveRange)(workDate, lr.fromDate, lr.toDate, lr.status));
        const approvedOtMinutes = otRequests.reduce((sum, ot) => sum + ot.minutes, 0);
        const calc = (0, database_2.computeAttendanceDay)({
            punches,
            shift,
            policyPayload,
            approvedOtMinutes,
            onApprovedLeave,
        });
        const period = await this.timesheet.getOrCreateForDate(organizationId, branchId, workDate);
        return this.prisma.attendanceDay.upsert({
            where: {
                organizationId_employeeId_workDate: {
                    organizationId,
                    employeeId,
                    workDate,
                },
            },
            create: {
                organizationId,
                branchId,
                employeeId,
                workDate,
                checkInAt: calc.checkInAt,
                checkOutAt: calc.checkOutAt,
                workedMinutes: calc.workedMinutes,
                lateMinutes: calc.lateMinutes,
                earlyLeaveMinutes: calc.earlyLeaveMinutes,
                otMinutes: calc.otMinutes,
                status: calc.status,
                source: 'AUTO',
                timesheetPeriodId: period.id,
            },
            update: {
                checkInAt: calc.checkInAt,
                checkOutAt: calc.checkOutAt,
                workedMinutes: calc.workedMinutes,
                lateMinutes: calc.lateMinutes,
                earlyLeaveMinutes: calc.earlyLeaveMinutes,
                otMinutes: calc.otMinutes,
                status: calc.status,
                source: 'AUTO',
                timesheetPeriodId: period.id,
            },
            include: {
                employee: { select: { id: true, name: true, code: true } },
                timesheetPeriod: { select: { id: true, status: true, year: true, month: true } },
            },
        });
    }
    async correctDay(organizationId, dayId, dto, actor) {
        if (!actor?.role || !(0, hrm_attendance_scope_1.canCorrectAttendanceDay)(actor.role)) {
            throw new common_1.ForbiddenException('Chỉ Owner/HR được sửa ngày công');
        }
        const day = await this.prisma.attendanceDay.findFirst({
            where: { id: dayId, organizationId },
            include: { timesheetPeriod: true },
        });
        if (!day)
            throw new common_1.NotFoundException('Ngày công không tồn tại');
        await this.timesheet.assertPeriodOpenForDate(organizationId, day.branchId, day.workDate);
        const before = {
            checkInAt: day.checkInAt?.toISOString() ?? null,
            checkOutAt: day.checkOutAt?.toISOString() ?? null,
            workedMinutes: day.workedMinutes,
            lateMinutes: day.lateMinutes,
            earlyLeaveMinutes: day.earlyLeaveMinutes,
            otMinutes: day.otMinutes,
            status: day.status,
            source: day.source,
        };
        const data = {
            source: 'ADJUSTMENT',
        };
        if (dto.checkInAt !== undefined) {
            data.checkInAt = dto.checkInAt ? new Date(dto.checkInAt) : null;
        }
        if (dto.checkOutAt !== undefined) {
            data.checkOutAt = dto.checkOutAt ? new Date(dto.checkOutAt) : null;
        }
        if (dto.workedMinutes !== undefined)
            data.workedMinutes = dto.workedMinutes;
        if (dto.lateMinutes !== undefined)
            data.lateMinutes = dto.lateMinutes;
        if (dto.earlyLeaveMinutes !== undefined)
            data.earlyLeaveMinutes = dto.earlyLeaveMinutes;
        if (dto.otMinutes !== undefined)
            data.otMinutes = dto.otMinutes;
        if (dto.status !== undefined)
            data.status = dto.status;
        // Nếu chỉ sửa giờ vào/ra mà chưa set phút công — tính lại tối thiểu
        const nextCheckIn = dto.checkInAt !== undefined
            ? dto.checkInAt
                ? new Date(dto.checkInAt)
                : null
            : day.checkInAt;
        const nextCheckOut = dto.checkOutAt !== undefined
            ? dto.checkOutAt
                ? new Date(dto.checkOutAt)
                : null
            : day.checkOutAt;
        if (dto.workedMinutes === undefined &&
            (dto.checkInAt !== undefined || dto.checkOutAt !== undefined) &&
            nextCheckIn &&
            nextCheckOut &&
            nextCheckOut > nextCheckIn) {
            data.workedMinutes = Math.max(0, Math.round((nextCheckOut.getTime() - nextCheckIn.getTime()) / 60_000));
        }
        if (dto.status === undefined &&
            (dto.checkInAt !== undefined || dto.checkOutAt !== undefined)) {
            if (nextCheckIn && nextCheckOut) {
                data.status = database_1.AttendanceDayStatus.PRESENT;
            }
            else if (nextCheckIn || nextCheckOut) {
                data.status = database_1.AttendanceDayStatus.INCOMPLETE;
            }
            else {
                data.status = database_1.AttendanceDayStatus.ABSENT;
            }
        }
        const period = day.timesheetPeriod ??
            (await this.timesheet.getOrCreateForDate(organizationId, day.branchId, day.workDate));
        const updated = await this.prisma.attendanceDay.update({
            where: { id: day.id },
            data,
            include: DAY_INCLUDE,
        });
        const after = {
            checkInAt: updated.checkInAt?.toISOString() ?? null,
            checkOutAt: updated.checkOutAt?.toISOString() ?? null,
            workedMinutes: updated.workedMinutes,
            lateMinutes: updated.lateMinutes,
            earlyLeaveMinutes: updated.earlyLeaveMinutes,
            otMinutes: updated.otMinutes,
            status: updated.status,
            source: updated.source,
        };
        const changedFields = Object.keys(before).filter((k) => String(before[k]) !== String(after[k]));
        for (const field of changedFields) {
            if (field === 'source')
                continue;
            await this.prisma.attendanceAdjustment.create({
                data: {
                    organizationId,
                    timesheetPeriodId: period.id,
                    employeeId: day.employeeId,
                    workDate: day.workDate,
                    field,
                    oldValue: before[field] == null ? null : String(before[field]),
                    newValue: after[field] == null ? null : String(after[field]),
                    reason: dto.reason,
                    createdById: actor?.userId,
                },
            });
        }
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'hrm.attendance.day.correct',
            entityType: 'AttendanceDay',
            entityId: day.id,
            metadata: {
                before,
                after,
                reason: dto.reason,
            },
            ipAddress: actor?.ipAddress,
        });
        return updated;
    }
    async createAdjustment(organizationId, dto, actor) {
        if (!actor?.role || !(0, hrm_attendance_scope_1.canCorrectAttendanceDay)(actor.role)) {
            throw new common_1.ForbiddenException('Chỉ Owner/HR được điều chỉnh ngày công');
        }
        const employee = await this.employees.ensureEmployee(organizationId, dto.employeeId);
        const workDate = (0, database_2.parseWorkDate)(dto.workDate);
        const branchId = employee.branchId;
        if (!branchId)
            throw new common_1.BadRequestException('Nhân viên chưa gắn chi nhánh');
        await this.timesheet.assertPeriodOpenForDate(organizationId, branchId, workDate);
        const period = await this.timesheet.getOrCreateForDate(organizationId, branchId, workDate);
        const day = await this.prisma.attendanceDay.findFirst({
            where: { organizationId, employeeId: dto.employeeId, workDate },
        });
        const before = day
            ? {
                [dto.field]: this.readDayField(day, dto.field),
            }
            : null;
        const adjustment = await this.prisma.attendanceAdjustment.create({
            data: {
                organizationId,
                timesheetPeriodId: period.id,
                employeeId: dto.employeeId,
                workDate,
                field: dto.field,
                oldValue: dto.oldValue,
                newValue: dto.newValue,
                reason: dto.reason,
                createdById: actor?.userId,
            },
        });
        if (day) {
            const numericFields = [
                'workedMinutes',
                'lateMinutes',
                'earlyLeaveMinutes',
                'otMinutes',
            ];
            if (numericFields.includes(dto.field)) {
                const value = Number(dto.newValue);
                if (!Number.isFinite(value)) {
                    throw new common_1.BadRequestException('Giá trị điều chỉnh phải là số');
                }
                await this.prisma.attendanceDay.update({
                    where: { id: day.id },
                    data: { [dto.field]: value, source: 'ADJUSTMENT' },
                });
            }
            else if (dto.field === 'status') {
                await this.prisma.attendanceDay.update({
                    where: { id: day.id },
                    data: { status: dto.newValue, source: 'ADJUSTMENT' },
                });
            }
        }
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'hrm.attendance.adjustment',
            entityType: 'AttendanceAdjustment',
            entityId: adjustment.id,
            metadata: {
                before,
                after: { ...dto },
                reason: dto.reason,
            },
            ipAddress: actor?.ipAddress,
        });
        return adjustment;
    }
    async createQrToken(organizationId, dto, actor) {
        const rawToken = (0, crypto_1.randomBytes)(24).toString('hex');
        const tokenHash = this.hashToken(rawToken);
        const record = await this.prisma.attendanceQrToken.create({
            data: {
                organizationId,
                branchId: dto.branchId,
                label: dto.label,
                tokenHash,
                expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
            },
        });
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'hrm.attendance.qr_token.create',
            entityType: 'AttendanceQrToken',
            entityId: record.id,
            metadata: { after: { label: dto.label, branchId: dto.branchId } },
            ipAddress: actor?.ipAddress,
        });
        return { ...record, token: rawToken };
    }
    async listQrTokens(organizationId, branchId) {
        return this.prisma.attendanceQrToken.findMany({
            where: {
                organizationId,
                ...(branchId && { branchId }),
            },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                label: true,
                branchId: true,
                isActive: true,
                expiresAt: true,
                createdAt: true,
            },
        });
    }
    readDayField(day, field) {
        switch (field) {
            case 'workedMinutes':
                return day.workedMinutes;
            case 'lateMinutes':
                return day.lateMinutes;
            case 'earlyLeaveMinutes':
                return day.earlyLeaveMinutes;
            case 'otMinutes':
                return day.otMinutes;
            case 'status':
                return day.status;
            case 'checkInAt':
                return day.checkInAt?.toISOString() ?? null;
            case 'checkOutAt':
                return day.checkOutAt?.toISOString() ?? null;
            default:
                return null;
        }
    }
    hashToken(raw) {
        return (0, crypto_1.createHash)('sha256').update(raw).digest('hex');
    }
    csvEscape(value) {
        if (/[",\n]/.test(value))
            return `"${value.replace(/"/g, '""')}"`;
        return value;
    }
    xmlEscape(value) {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
    async enqueueRebuild(organizationId, employeeId, workDate) {
        if (!this.rebuildQueue) {
            throw new common_1.ServiceUnavailableException('Hàng đợi chấm công chưa sẵn sàng — kiểm tra Redis/worker.');
        }
        await this.queueEnqueue.add(this.rebuildQueue, 'rebuild-day', { organizationId, employeeId, workDate }, { removeOnComplete: 100, removeOnFail: 50 });
    }
};
exports.HrmAttendanceService = HrmAttendanceService;
exports.HrmAttendanceService = HrmAttendanceService = __decorate([
    (0, common_1.Injectable)(),
    __param(5, (0, common_1.Optional)()),
    __param(5, (0, common_1.Inject)(queue_constants_1.HRM_ATTENDANCE_REBUILD_QUEUE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        hrm_employees_service_1.HrmEmployeesService,
        hrm_timesheet_service_1.HrmTimesheetService,
        queue_enqueue_service_1.QueueEnqueueService,
        bullmq_1.Queue])
], HrmAttendanceService);
