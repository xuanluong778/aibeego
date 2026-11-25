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
var WorkInsightsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkInsightsService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../prisma/prisma.service");
const work_management_scope_1 = require("./work-management.scope");
const work_management_constants_1 = require("./work-management.constants");
const work_metrics_1 = require("./work-metrics");
const work_collab_service_1 = require("./work-collab.service");
let WorkInsightsService = WorkInsightsService_1 = class WorkInsightsService {
    prisma;
    collab;
    logger = new common_1.Logger(WorkInsightsService_1.name);
    constructor(prisma, collab) {
        this.prisma = prisma;
        this.collab = collab;
    }
    // ── Audit ────────────────────────────────────────────────────────────────
    async audit(organizationId, actorId, input) {
        try {
            await this.prisma.workAuditLog.create({
                data: {
                    organizationId,
                    actorId: actorId || null,
                    action: input.action,
                    entityType: input.entityType,
                    entityId: input.entityId || null,
                    taskId: input.taskId || null,
                    projectId: input.projectId || null,
                    summary: input.summary?.slice(0, 500) || null,
                    metadata: input.metadata ?? undefined,
                },
            });
        }
        catch (e) {
            this.logger.warn(`audit failed: ${e instanceof Error ? e.message : e}`);
        }
    }
    async listAuditLogs(organizationId, user, q) {
        await (0, work_management_scope_1.resolveWorkScope)(this.prisma, organizationId, user);
        return this.prisma.workAuditLog.findMany({
            where: {
                organizationId,
                ...(q.taskId ? { taskId: q.taskId } : {}),
                ...(q.projectId ? { projectId: q.projectId } : {}),
            },
            include: { actor: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
            take: Math.min(q.limit ?? 100, 500),
        });
    }
    // ── My work ──────────────────────────────────────────────────────────────
    /**
     * Resolve employeeId for current user: User.employeeId first, then Employee by email.
     * Owners often have account without HR link — still allow empty "Việc của tôi".
     */
    async resolveActorEmployeeId(organizationId, user) {
        if (user.employeeId)
            return user.employeeId;
        if (!user.email)
            return null;
        const emp = await this.prisma.employee.findFirst({
            where: {
                organizationId,
                email: { equals: user.email, mode: 'insensitive' },
                isActive: true,
            },
            select: { id: true },
        });
        return emp?.id ?? null;
    }
    emptyMyWork(today, warning) {
        const empty = {
            today: [],
            upcoming: [],
            overdue: [],
            inProgress: [],
            pendingReview: [],
            done: [],
            assignedByMe: [],
        };
        return {
            timezone: work_metrics_1.WORK_TZ,
            today,
            warning: warning || null,
            buckets: empty,
            counts: {
                today: 0,
                upcoming: 0,
                overdue: 0,
                inProgress: 0,
                pendingReview: 0,
                done: 0,
                assignedByMe: 0,
            },
        };
    }
    async myWork(organizationId, user) {
        const today = (0, work_metrics_1.vnDateString)();
        const me = await this.resolveActorEmployeeId(organizationId, user);
        if (!me) {
            // Do not 401/403 — render empty buckets so page loads for accounts without HR profile
            return this.emptyMyWork(today, 'Tài khoản chưa gắn hồ sơ nhân viên — chưa có việc gán cho bạn. Liên hệ HR để liên kết tài khoản.');
        }
        const soon = (() => {
            const d = new Date(`${today}T00:00:00+07:00`);
            d.setUTCDate(d.getUTCDate() + 3);
            return (0, work_metrics_1.vnDateString)(d);
        })();
        const baseWhere = {
            organizationId,
            deletedAt: null,
            isArchived: false,
            isRecurrenceTemplate: false,
        };
        const related = {
            ...baseWhere,
            OR: [
                { assignees: { some: { employeeId: me } } },
                { assignerId: me },
                { createdById: me },
                { watchers: { some: { employeeId: me } } },
            ],
        };
        const include = {
            column: true,
            project: { select: { id: true, name: true } },
            assignees: { include: { employee: { select: { id: true, name: true } } } },
        };
        const allMine = await this.prisma.workTask.findMany({
            where: related,
            include,
            orderBy: [{ deadline: 'asc' }, { updatedAt: 'desc' }],
            take: 400,
        });
        const isMineAssigned = (t) => t.assignees.some((a) => a.employeeId === me);
        const isIAssigned = (t) => t.assignerId === me;
        const ser = (t) => this.serializeLite(t, today);
        const todayDue = allMine.filter((t) => isMineAssigned(t) && t.deadline && (0, work_metrics_1.vnDateString)(t.deadline) === today);
        const upcoming = allMine.filter((t) => {
            if (!isMineAssigned(t) || !t.deadline)
                return false;
            const d = (0, work_metrics_1.vnDateString)(t.deadline);
            return d > today && d <= soon && t.column.key !== work_management_constants_1.WORK_COLUMN_KEYS.DONE;
        });
        const overdue = allMine.filter((t) => {
            if (!isMineAssigned(t) || !t.deadline)
                return false;
            return (0, work_metrics_1.vnDateString)(t.deadline) < today && t.column.key !== work_management_constants_1.WORK_COLUMN_KEYS.DONE;
        });
        const inProgress = allMine.filter((t) => isMineAssigned(t) &&
            (t.column.key === work_management_constants_1.WORK_COLUMN_KEYS.IN_PROGRESS ||
                t.column.key === work_management_constants_1.WORK_COLUMN_KEYS.NEEDS_FIX));
        const pendingReview = allMine.filter((t) => isMineAssigned(t) && t.column.key === work_management_constants_1.WORK_COLUMN_KEYS.PENDING_REVIEW);
        const done = allMine.filter((t) => isMineAssigned(t) && t.column.key === work_management_constants_1.WORK_COLUMN_KEYS.DONE);
        const iAssigned = allMine.filter((t) => isIAssigned(t));
        return {
            timezone: work_metrics_1.WORK_TZ,
            today: today,
            buckets: {
                today: todayDue.map(ser),
                upcoming: upcoming.map(ser),
                overdue: overdue.map(ser),
                inProgress: inProgress.map(ser),
                pendingReview: pendingReview.map(ser),
                done: done.slice(0, 50).map(ser),
                assignedByMe: iAssigned.map(ser),
            },
            counts: {
                today: todayDue.length,
                upcoming: upcoming.length,
                overdue: overdue.length,
                inProgress: inProgress.length,
                pendingReview: pendingReview.length,
                done: done.length,
                assignedByMe: iAssigned.length,
            },
        };
    }
    // ── Employee profile stats ───────────────────────────────────────────────
    async employeeStats(organizationId, user, employeeId) {
        const scope = await (0, work_management_scope_1.resolveWorkScope)(this.prisma, organizationId, user);
        if (scope.mode === 'ids' &&
            !scope.employeeIds.includes(employeeId) &&
            !(0, work_management_scope_1.canManageAnyTask)(user.role)) {
            if (user.employeeId !== employeeId) {
                throw new common_1.ForbiddenException('Không có quyền xem thống kê nhân viên này');
            }
        }
        const emp = await this.prisma.employee.findFirst({
            where: { id: employeeId, organizationId },
            select: { id: true, name: true, departmentId: true, department: { select: { name: true } } },
        });
        if (!emp)
            throw new common_1.NotFoundException('Không tìm thấy nhân viên');
        const today = (0, work_metrics_1.vnDateString)();
        // Tasks assigned to employee
        const asAssignee = await this.prisma.workTask.findMany({
            where: {
                organizationId,
                deletedAt: null,
                isArchived: false,
                isRecurrenceTemplate: false,
                assignees: { some: { employeeId } },
            },
            include: {
                column: true,
                project: { select: { id: true, name: true } },
                timeLogs: true,
            },
            take: 500,
        });
        const snapshots = asAssignee.map((t) => ({
            columnKey: t.column.key,
            priority: t.priority,
            deadline: t.deadline ? (0, work_metrics_1.vnDateString)(t.deadline) : null,
            completedAt: t.completedAt?.toISOString() ?? null,
            estimatedMinutes: t.estimatedMinutes,
            actualMinutes: Math.round(t.timeLogs.reduce((s, l) => s + this.liveDuration(l), 0) / 60),
        }));
        const workload = (0, work_metrics_1.computeWorkloadScore)(snapshots, today);
        const projects = [...new Map(asAssignee.map((t) => [t.project.id, t.project])).values()];
        const inProgress = asAssignee.filter((t) => [work_management_constants_1.WORK_COLUMN_KEYS.IN_PROGRESS, work_management_constants_1.WORK_COLUMN_KEYS.NEEDS_FIX].includes(t.column.key));
        const overdue = asAssignee.filter((t) => t.deadline && (0, work_metrics_1.vnDateString)(t.deadline) < today && t.column.key !== work_management_constants_1.WORK_COLUMN_KEYS.DONE);
        const done = asAssignee.filter((t) => t.column.key === work_management_constants_1.WORK_COLUMN_KEYS.DONE);
        return {
            employee: emp,
            timezone: work_metrics_1.WORK_TZ,
            today,
            counts: {
                inProgress: inProgress.length,
                overdue: overdue.length,
                done: done.length,
                total: asAssignee.length,
            },
            projects,
            workload,
            recent: asAssignee.slice(0, 30).map((t) => this.serializeLite(t, today)),
        };
    }
    // ── Calendar ─────────────────────────────────────────────────────────────
    async calendar(organizationId, user, q) {
        const scope = await (0, work_management_scope_1.resolveWorkScope)(this.prisma, organizationId, user);
        const visibility = (0, work_management_scope_1.workTaskVisibilityWhere)(scope, user);
        if (!q.from || !q.to)
            throw new common_1.BadRequestException('Cần from/to (YYYY-MM-DD)');
        const tasks = await this.prisma.workTask.findMany({
            where: {
                organizationId,
                deletedAt: null,
                isArchived: false,
                isRecurrenceTemplate: false,
                ...visibility,
                OR: [
                    { deadline: { gte: new Date(q.from), lte: new Date(q.to) } },
                    { startDate: { gte: new Date(q.from), lte: new Date(q.to) } },
                ],
            },
            include: {
                column: true,
                project: { select: { id: true, name: true } },
                assignees: { include: { employee: { select: { id: true, name: true } } } },
            },
            take: 500,
        });
        const today = (0, work_metrics_1.vnDateString)();
        return {
            timezone: work_metrics_1.WORK_TZ,
            from: q.from,
            to: q.to,
            events: tasks.map((t) => ({
                ...this.serializeLite(t, today),
                date: t.deadline
                    ? (0, work_metrics_1.vnDateString)(t.deadline)
                    : t.startDate
                        ? (0, work_metrics_1.vnDateString)(t.startDate)
                        : null,
            })),
        };
    }
    // ── Dashboard / reports ──────────────────────────────────────────────────
    async dashboard(organizationId, user, groupBy = 'project') {
        const scope = await (0, work_management_scope_1.resolveWorkScope)(this.prisma, organizationId, user);
        const visibility = (0, work_management_scope_1.workTaskVisibilityWhere)(scope, user);
        const today = (0, work_metrics_1.vnDateString)();
        const tasks = await this.prisma.workTask.findMany({
            where: {
                organizationId,
                deletedAt: null,
                isArchived: false,
                isRecurrenceTemplate: false,
                ...visibility,
            },
            include: {
                column: true,
                project: { select: { id: true, name: true } },
                assignees: {
                    include: {
                        employee: {
                            select: {
                                id: true,
                                name: true,
                                departmentId: true,
                                department: { select: { id: true, name: true } },
                            },
                        },
                    },
                },
                timeLogs: true,
            },
            take: 1000,
        });
        const summary = this.summarizeTasks(tasks, today);
        const groups = [];
        if (groupBy === 'project') {
            const map = new Map();
            for (const t of tasks) {
                const list = map.get(t.projectId) ?? [];
                list.push(t);
                map.set(t.projectId, list);
            }
            for (const [id, list] of map) {
                groups.push({
                    id,
                    name: list[0].project.name,
                    counts: this.summarizeTasks(list, today),
                });
            }
        }
        else if (groupBy === 'employee') {
            const map = new Map();
            for (const t of tasks) {
                for (const a of t.assignees) {
                    const cur = map.get(a.employeeId) ?? { name: a.employee.name, list: [] };
                    cur.list.push(t);
                    map.set(a.employeeId, cur);
                }
            }
            for (const [id, { name, list }] of map) {
                const snaps = list.map((t) => ({
                    columnKey: t.column.key,
                    priority: t.priority,
                    deadline: t.deadline ? (0, work_metrics_1.vnDateString)(t.deadline) : null,
                    completedAt: t.completedAt?.toISOString() ?? null,
                    estimatedMinutes: t.estimatedMinutes,
                    actualMinutes: Math.round(t.timeLogs.reduce((s, l) => s + this.liveDuration(l), 0) / 60),
                }));
                groups.push({
                    id,
                    name,
                    counts: this.summarizeTasks(list, today),
                    workload: (0, work_metrics_1.computeWorkloadScore)(snaps, today),
                });
            }
        }
        else {
            const map = new Map();
            for (const t of tasks) {
                for (const a of t.assignees) {
                    const depId = a.employee.departmentId || '__none__';
                    const depName = a.employee.department?.name || 'Chưa gán phòng ban';
                    const cur = map.get(depId) ?? { name: depName, list: [] };
                    cur.list.push(t);
                    map.set(depId, cur);
                }
            }
            for (const [id, { name, list }] of map) {
                groups.push({ id, name, counts: this.summarizeTasks(list, today) });
            }
        }
        return { timezone: work_metrics_1.WORK_TZ, today, summary, groupBy, groups };
    }
    async exportReport(organizationId, user, format = 'csv') {
        const dash = await this.dashboard(organizationId, user, 'employee');
        const columns = [
            'employee',
            'inProgress',
            'pendingReview',
            'overdue',
            'done',
            'onTimeRate',
            'workloadScore',
            'atRisk',
        ];
        const rows = dash.groups.map((g) => ({
            employee: g.name,
            inProgress: g.counts.inProgress,
            pendingReview: g.counts.pendingReview,
            overdue: g.counts.overdue,
            done: g.counts.done,
            onTimeRate: g.workload?.onTimeRate ?? '',
            workloadScore: g.workload?.score ?? '',
            atRisk: g.counts.atRisk,
        }));
        await this.audit(organizationId, user.employeeId, {
            action: 'EXPORT_REPORT',
            entityType: 'WorkReport',
            summary: `Xuất báo cáo ${format}`,
            metadata: { format, rows: rows.length },
        });
        if (format === 'xlsx') {
            return {
                contentType: 'application/vnd.ms-excel',
                filename: `work-report-${dash.today}.xls`,
                body: (0, work_metrics_1.toSpreadsheetMl)(rows, columns),
            };
        }
        return {
            contentType: 'text/csv; charset=utf-8',
            filename: `work-report-${dash.today}.csv`,
            body: (0, work_metrics_1.toCsv)(rows, columns),
        };
    }
    // ── Time tracking ────────────────────────────────────────────────────────
    async startTimer(organizationId, user, taskId) {
        if (!user.employeeId)
            throw new common_1.ForbiddenException('Tài khoản chưa gắn nhân viên');
        await this.assertTaskWrite(organizationId, user, taskId);
        // pause any running of this user
        const running = await this.prisma.workTimeLog.findMany({
            where: {
                organizationId,
                employeeId: user.employeeId,
                status: 'RUNNING',
            },
        });
        const alreadyRunning = running.find(log => log.taskId === taskId);
        if (alreadyRunning)
            return alreadyRunning;
        for (const r of running) {
            const dur = this.liveDuration(r);
            await this.prisma.workTimeLog.update({
                where: { id: r.id },
                data: { status: 'PAUSED', durationSeconds: dur, endedAt: new Date() },
            });
        }
        const paused = await this.prisma.workTimeLog.findFirst({
            where: { organizationId, taskId, employeeId: user.employeeId, status: 'PAUSED' },
            orderBy: { createdAt: 'desc' },
        });
        const log = paused ? await this.prisma.workTimeLog.update({
            where: { id: paused.id }, data: { status: 'RUNNING', startedAt: new Date(), endedAt: null },
        }) : await this.prisma.workTimeLog.create({
            data: {
                organizationId,
                taskId,
                employeeId: user.employeeId,
                status: 'RUNNING',
                startedAt: new Date(),
                durationSeconds: 0,
            },
        });
        await this.audit(organizationId, user.employeeId, {
            action: 'TIME_START',
            entityType: 'WorkTimeLog',
            entityId: log.id,
            taskId,
            summary: 'Bắt đầu đếm giờ',
        });
        return log;
    }
    async pauseTimer(organizationId, user, taskId) {
        if (!user.employeeId)
            throw new common_1.ForbiddenException('Tài khoản chưa gắn nhân viên');
        await this.assertTaskWrite(organizationId, user, taskId);
        const running = await this.prisma.workTimeLog.findFirst({
            where: {
                organizationId,
                taskId,
                employeeId: user.employeeId,
                status: 'RUNNING',
            },
            orderBy: { createdAt: 'desc' },
        });
        if (!running)
            throw new common_1.BadRequestException('Không có timer đang chạy');
        const dur = this.liveDuration(running);
        const log = await this.prisma.workTimeLog.update({
            where: { id: running.id },
            data: { status: 'PAUSED', durationSeconds: dur, endedAt: new Date() },
        });
        await this.audit(organizationId, user.employeeId, {
            action: 'TIME_PAUSE',
            entityType: 'WorkTimeLog',
            entityId: log.id,
            taskId,
            summary: 'Tạm dừng timer',
            metadata: { durationSeconds: dur },
        });
        return log;
    }
    async stopTimer(organizationId, user, taskId) {
        if (!user.employeeId)
            throw new common_1.ForbiddenException('Tài khoản chưa gắn nhân viên');
        await this.assertTaskWrite(organizationId, user, taskId);
        const open = await this.prisma.workTimeLog.findFirst({
            where: {
                organizationId,
                taskId,
                employeeId: user.employeeId,
                status: { in: ['RUNNING', 'PAUSED'] },
            },
            orderBy: { createdAt: 'desc' },
        });
        if (!open)
            throw new common_1.BadRequestException('Không có timer để kết thúc');
        const dur = this.liveDuration(open);
        const log = await this.prisma.workTimeLog.update({
            where: { id: open.id },
            data: { status: 'STOPPED', durationSeconds: dur, endedAt: new Date() },
        });
        await this.audit(organizationId, user.employeeId, {
            action: 'TIME_STOP',
            entityType: 'WorkTimeLog',
            entityId: log.id,
            taskId,
            summary: 'Kết thúc timer',
            metadata: { durationSeconds: dur },
        });
        return log;
    }
    async manualTime(organizationId, user, taskId, dto) {
        if (!user.employeeId)
            throw new common_1.ForbiddenException('Tài khoản chưa gắn nhân viên');
        await this.assertTaskWrite(organizationId, user, taskId);
        if (!Number.isFinite(dto.durationMinutes) || dto.durationMinutes < 1 || dto.durationMinutes > 1440) {
            throw new common_1.BadRequestException('Thời gian làm việc phải từ 1 đến 1440 phút');
        }
        const startedAt = dto.startedAt ? new Date(dto.startedAt) : new Date();
        const durationSeconds = Math.round(dto.durationMinutes * 60);
        const endedAt = new Date(startedAt.getTime() + durationSeconds * 1000);
        const log = await this.prisma.workTimeLog.create({
            data: {
                organizationId,
                taskId,
                employeeId: user.employeeId,
                status: 'MANUAL',
                startedAt,
                endedAt,
                durationSeconds,
                note: dto.note?.slice(0, 500) || null,
            },
        });
        await this.audit(organizationId, user.employeeId, {
            action: 'TIME_MANUAL',
            entityType: 'WorkTimeLog',
            entityId: log.id,
            taskId,
            summary: `Nhập thủ công ${dto.durationMinutes} phút`,
        });
        return log;
    }
    async listTimeLogs(organizationId, user, taskId) {
        const scope = await (0, work_management_scope_1.resolveWorkScope)(this.prisma, organizationId, user);
        const task = await this.prisma.workTask.findFirst({
            where: { id: taskId, organizationId, deletedAt: null },
            include: { assignees: true, watchers: true },
        });
        if (!task)
            throw new common_1.NotFoundException('Không tìm thấy công việc');
        this.assertVisible(user, scope, task);
        return this.prisma.workTimeLog.findMany({
            where: { organizationId, taskId },
            include: { employee: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 200,
        });
    }
    // ── Recurrence ───────────────────────────────────────────────────────────
    /**
     * Materialize upcoming occurrences for templates — skips existing occurrence keys.
     */
    async materializeRecurrences(organizationId) {
        const today = (0, work_metrics_1.vnDateString)();
        const templates = await this.prisma.workTask.findMany({
            where: {
                ...(organizationId ? { organizationId } : {}),
                deletedAt: null,
                isRecurrenceTemplate: true,
                recurrenceRule: { in: ['DAILY', 'WEEKLY', 'MONTHLY'] },
            },
            include: {
                assignees: true,
                watchers: true,
                checklist: true,
                column: true,
            },
            take: 200,
        });
        let created = 0;
        for (const tpl of templates) {
            const rule = (tpl.recurrenceRule || 'WEEKLY');
            const until = tpl.recurrenceUntil ? (0, work_metrics_1.vnDateString)(tpl.recurrenceUntil) : null;
            const seriesId = tpl.recurrenceSeriesId || tpl.id;
            const dates = (0, work_metrics_1.nextOccurrenceDates)(rule, tpl.recurrenceInterval || 1, today, 7, until);
            const defaultCol = await this.prisma.workBoardColumn.findFirst({
                where: {
                    projectId: tpl.projectId,
                    key: { in: [work_management_constants_1.WORK_COLUMN_KEYS.NEW, work_management_constants_1.WORK_COLUMN_KEYS.ASSIGNED] },
                },
                orderBy: { sortOrder: 'asc' },
            });
            if (!defaultCol)
                continue;
            for (const dateStr of dates) {
                const key = (0, work_metrics_1.occurrenceKey)(seriesId, dateStr);
                try {
                    await this.prisma.workTask.create({
                        data: {
                            organizationId: tpl.organizationId,
                            projectId: tpl.projectId,
                            columnId: defaultCol.id,
                            title: tpl.title,
                            description: tpl.description,
                            assignerId: tpl.assignerId,
                            createdById: tpl.createdById,
                            startDate: new Date(dateStr),
                            deadline: new Date(dateStr),
                            priority: tpl.priority,
                            labels: tpl.labels,
                            customFields: tpl.customFields,
                            estimatedMinutes: tpl.estimatedMinutes,
                            recurrenceRule: null,
                            isRecurrenceTemplate: false,
                            recurrenceSeriesId: seriesId,
                            recurrenceOccurrenceKey: key,
                            assignees: {
                                create: tpl.assignees.map((a) => ({ employeeId: a.employeeId })),
                            },
                            watchers: {
                                create: tpl.watchers.map((w) => ({ employeeId: w.employeeId })),
                            },
                            checklist: {
                                create: tpl.checklist.map((c, i) => ({
                                    title: c.title,
                                    isDone: false,
                                    sortOrder: c.sortOrder ?? i,
                                })),
                            },
                        },
                    });
                    created += 1;
                }
                catch (e) {
                    // unique violation = already exists (no duplicate)
                    if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
                        continue;
                    }
                    this.logger.warn(`recurrence skip ${key}: ${e instanceof Error ? e.message : e}`);
                }
            }
        }
        return { created, templates: templates.length, today, timezone: work_metrics_1.WORK_TZ };
    }
    // ── Reminders (VN timezone) ──────────────────────────────────────────────
    async cronReminders() {
        try {
            await this.sendDeadlineReminders();
            await this.sendOverdueNotifications();
            await this.materializeRecurrences();
        }
        catch (e) {
            this.logger.error(`cronReminders: ${e instanceof Error ? e.message : e}`);
        }
    }
    async sendDeadlineReminders(organizationId) {
        const today = (0, work_metrics_1.vnDateString)();
        const d1 = (() => {
            const x = new Date(`${today}T00:00:00+07:00`);
            x.setUTCDate(x.getUTCDate() + 1);
            return (0, work_metrics_1.vnDateString)(x);
        })();
        const tasks = await this.prisma.workTask.findMany({
            where: {
                ...(organizationId ? { organizationId } : {}),
                deletedAt: null,
                isArchived: false,
                isRecurrenceTemplate: false,
                deadline: { gte: new Date(today), lte: new Date(d1) },
                column: { key: { not: work_management_constants_1.WORK_COLUMN_KEYS.DONE } },
                OR: [
                    { lastReminderSentAt: null },
                    { lastReminderSentAt: { lt: new Date(`${today}T00:00:00+07:00`) } },
                ],
            },
            include: { assignees: true, column: true },
            take: 300,
        });
        for (const t of tasks) {
            const recipients = [
                t.assignerId,
                t.createdById,
                ...t.assignees.map((a) => a.employeeId),
            ].filter(Boolean);
            await this.collab.notify(t.organizationId, recipients, {
                type: 'DEADLINE_REMINDER',
                title: `Sắp đến hạn: ${t.title}`,
                body: `Deadline ${(0, work_metrics_1.vnDateString)(t.deadline)} (timezone ${work_metrics_1.WORK_TZ})`,
                taskId: t.id,
                projectId: t.projectId,
            });
            await this.prisma.workTask.update({
                where: { id: t.id },
                data: { lastReminderSentAt: new Date() },
            });
            await this.audit(t.organizationId, null, {
                action: 'DEADLINE_REMINDER',
                entityType: 'WorkTask',
                entityId: t.id,
                taskId: t.id,
                projectId: t.projectId,
                summary: 'Nhắc deadline',
            });
        }
        return { sent: tasks.length };
    }
    async sendOverdueNotifications(organizationId) {
        const today = (0, work_metrics_1.vnDateString)();
        const tasks = await this.prisma.workTask.findMany({
            where: {
                ...(organizationId ? { organizationId } : {}),
                deletedAt: null,
                isArchived: false,
                isRecurrenceTemplate: false,
                deadline: { lt: new Date(today) },
                column: { key: { not: work_management_constants_1.WORK_COLUMN_KEYS.DONE } },
                OR: [
                    { lastOverdueNotifiedAt: null },
                    { lastOverdueNotifiedAt: { lt: new Date(`${today}T00:00:00+07:00`) } },
                ],
            },
            include: { assignees: true },
            take: 300,
        });
        for (const t of tasks) {
            const recipients = [
                t.assignerId,
                t.createdById,
                ...t.assignees.map((a) => a.employeeId),
            ].filter(Boolean);
            await this.collab.notify(t.organizationId, recipients, {
                type: 'OVERDUE',
                title: `Quá hạn: ${t.title}`,
                body: `Deadline ${(0, work_metrics_1.vnDateString)(t.deadline)} đã qua (${work_metrics_1.WORK_TZ})`,
                taskId: t.id,
                projectId: t.projectId,
            });
            await this.prisma.workTask.update({
                where: { id: t.id },
                data: { lastOverdueNotifiedAt: new Date() },
            });
            await this.audit(t.organizationId, null, {
                action: 'OVERDUE_NOTIFY',
                entityType: 'WorkTask',
                entityId: t.id,
                taskId: t.id,
                projectId: t.projectId,
                summary: 'Thông báo quá hạn',
            });
        }
        return { sent: tasks.length };
    }
    // ── helpers ──────────────────────────────────────────────────────────────
    summarizeTasks(tasks, today) {
        let inProgress = 0;
        let pendingReview = 0;
        let overdue = 0;
        let done = 0;
        let doneOnTime = 0;
        let doneWithDeadline = 0;
        let atRisk = 0;
        for (const t of tasks) {
            const key = t.column.key;
            if (key === work_management_constants_1.WORK_COLUMN_KEYS.DONE) {
                done += 1;
                if (t.deadline) {
                    doneWithDeadline += 1;
                    const completedDay = t.completedAt ? (0, work_metrics_1.vnDateString)(t.completedAt) : today;
                    if (completedDay <= (0, work_metrics_1.vnDateString)(t.deadline))
                        doneOnTime += 1;
                }
                continue;
            }
            if (key === work_management_constants_1.WORK_COLUMN_KEYS.IN_PROGRESS || key === work_management_constants_1.WORK_COLUMN_KEYS.NEEDS_FIX) {
                inProgress += 1;
            }
            if (key === work_management_constants_1.WORK_COLUMN_KEYS.PENDING_REVIEW)
                pendingReview += 1;
            const dl = t.deadline ? (0, work_metrics_1.vnDateString)(t.deadline) : null;
            if (dl && dl < today)
                overdue += 1;
            const risk = (0, work_metrics_1.classifyRisk)(dl, key, today, t.progress);
            if (risk === 'AT_RISK')
                atRisk += 1;
        }
        return {
            total: tasks.length,
            inProgress,
            pendingReview,
            overdue,
            done,
            doneOnTime,
            onTimeRate: doneWithDeadline > 0 ? Math.round((doneOnTime / doneWithDeadline) * 1000) / 10 : null,
            atRisk,
        };
    }
    serializeLite(t, today) {
        const deadline = t.deadline ? (0, work_metrics_1.vnDateString)(t.deadline) : null;
        return {
            id: t.id,
            title: t.title,
            projectId: t.projectId,
            project: t.project,
            columnId: t.columnId,
            columnKey: t.column.key,
            columnName: t.column.name,
            priority: t.priority,
            progress: t.progress,
            deadline,
            startDate: t.startDate ? (0, work_metrics_1.vnDateString)(t.startDate) : null,
            estimatedMinutes: t.estimatedMinutes ?? null,
            completedAt: t.completedAt,
            risk: (0, work_metrics_1.classifyRisk)(deadline, t.column.key, today, t.progress),
            assignees: (t.assignees ?? []).map((a) => a.employee),
        };
    }
    liveDuration(log) {
        if (log.status === 'RUNNING' && log.startedAt) {
            const base = log.durationSeconds || 0;
            // when restarted after pause durationSeconds holds accumulated; startedAt reset on start
            return base + Math.max(0, Math.floor((Date.now() - log.startedAt.getTime()) / 1000));
        }
        return log.durationSeconds || 0;
    }
    async assertTaskWrite(organizationId, user, taskId) {
        const scope = await (0, work_management_scope_1.resolveWorkScope)(this.prisma, organizationId, user);
        const task = await this.prisma.workTask.findFirst({
            where: { id: taskId, organizationId, deletedAt: null },
            include: { assignees: true, watchers: true },
        });
        if (!task)
            throw new common_1.NotFoundException('Không tìm thấy công việc');
        (0, work_management_scope_1.assertCanWriteTask)(user, {
            createdById: task.createdById,
            assignerId: task.assignerId,
            assigneeIds: task.assignees.map((a) => a.employeeId),
            watcherIds: task.watchers.map((w) => w.employeeId),
        }, scope);
        return task;
    }
    assertVisible(user, scope, task) {
        if (scope.mode === 'all')
            return;
        try {
            (0, work_management_scope_1.assertCanWriteTask)(user, {
                createdById: task.createdById,
                assignerId: task.assignerId,
                assigneeIds: task.assignees.map((a) => a.employeeId),
                watcherIds: task.watchers.map((w) => w.employeeId),
            }, scope);
        }
        catch {
            const me = user.employeeId;
            const related = [
                task.createdById,
                task.assignerId,
                ...task.assignees.map((a) => a.employeeId),
                ...task.watchers.map((w) => w.employeeId),
            ];
            if (scope.mode === 'ids' && related.some((id) => id && scope.employeeIds.includes(id))) {
                return;
            }
            if (me && related.includes(me))
                return;
            throw new common_1.ForbiddenException('Không có quyền xem công việc này');
        }
    }
};
exports.WorkInsightsService = WorkInsightsService;
__decorate([
    (0, schedule_1.Cron)('*/15 * * * *', { timeZone: work_metrics_1.WORK_TZ }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], WorkInsightsService.prototype, "cronReminders", null);
exports.WorkInsightsService = WorkInsightsService = WorkInsightsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        work_collab_service_1.WorkCollabService])
], WorkInsightsService);
