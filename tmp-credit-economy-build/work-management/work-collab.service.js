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
exports.WorkCollabService = void 0;
const plan_storage_1 = require("../common/uploads/plan-storage");
const common_1 = require("@nestjs/common");
const fs_1 = require("fs");
const path_1 = require("path");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const work_management_scope_1 = require("./work-management.scope");
const work_management_constants_1 = require("./work-management.constants");
const work_file_policy_1 = require("./work-file-policy");
const upload_signed_url_1 = require("../common/uploads/upload-signed-url");
let WorkCollabService = class WorkCollabService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    // ── Notifications ────────────────────────────────────────────────────────
    async notify(organizationId, recipientIds, input) {
        const unique = [...new Set(recipientIds.filter(Boolean))];
        const me = input.actorId;
        const targets = unique.filter((id) => id !== me);
        if (!targets.length)
            return { created: 0 };
        await this.prisma.workNotification.createMany({
            data: targets.map((recipientId) => ({
                organizationId,
                recipientId,
                actorId: me || null,
                type: input.type,
                title: input.title,
                body: input.body || null,
                taskId: input.taskId || null,
                projectId: input.projectId || null,
            })),
        });
        return { created: targets.length };
    }
    async listNotifications(organizationId, user, unreadOnly = false) {
        if (!user.employeeId)
            return [];
        return this.prisma.workNotification.findMany({
            where: {
                organizationId,
                recipientId: user.employeeId,
                ...(unreadOnly ? { isRead: false } : {}),
            },
            include: {
                actor: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
    }
    async markNotificationRead(organizationId, user, id) {
        if (!user.employeeId)
            throw new common_1.ForbiddenException('Tài khoản chưa gắn nhân viên');
        const n = await this.prisma.workNotification.findFirst({
            where: { id, organizationId, recipientId: user.employeeId },
        });
        if (!n)
            throw new common_1.NotFoundException('Không tìm thấy thông báo');
        return this.prisma.workNotification.update({
            where: { id },
            data: { isRead: true, readAt: new Date() },
        });
    }
    async markAllNotificationsRead(organizationId, user) {
        if (!user.employeeId)
            return { ok: true };
        await this.prisma.workNotification.updateMany({
            where: { organizationId, recipientId: user.employeeId, isRead: false },
            data: { isRead: true, readAt: new Date() },
        });
        return { ok: true };
    }
    // ── Comments ─────────────────────────────────────────────────────────────
    async listComments(organizationId, user, taskId) {
        const task = await this.requireVisibleTask(organizationId, user, taskId);
        const rows = await this.prisma.workTaskComment.findMany({
            where: { organizationId, taskId: task.id, deletedAt: null, parentId: null },
            include: {
                author: { select: { id: true, name: true } },
                replies: {
                    where: { deletedAt: null },
                    include: { author: { select: { id: true, name: true } } },
                    orderBy: { createdAt: 'asc' },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
        return rows.map((c) => this.serializeComment(c));
    }
    async createComment(organizationId, user, taskId, dto) {
        const authorId = await (0, work_management_scope_1.resolveLinkedEmployeeId)(this.prisma, organizationId, user, {
            persistUserLink: true,
        });
        if (!authorId)
            throw new common_1.ForbiddenException(work_management_scope_1.WORK_EMPLOYEE_LINK_REQUIRED_MSG);
        const task = await this.requireWriteTask(organizationId, user, taskId);
        if (dto.parentId) {
            const parent = await this.prisma.workTaskComment.findFirst({
                where: {
                    id: dto.parentId,
                    taskId,
                    organizationId,
                    deletedAt: null,
                    parentId: null,
                },
            });
            if (!parent)
                throw new common_1.BadRequestException('Bình luận gốc không hợp lệ');
        }
        const mentionIds = await this.resolveMentions(organizationId, dto.body, dto.mentionIds ?? []);
        const comment = await this.prisma.workTaskComment.create({
            data: {
                organizationId,
                taskId,
                parentId: dto.parentId || null,
                authorId,
                body: dto.body.trim(),
                mentionIds,
            },
            include: {
                author: { select: { id: true, name: true } },
                replies: {
                    where: { deletedAt: null },
                    include: { author: { select: { id: true, name: true } } },
                },
            },
        });
        const stakeholders = await this.taskStakeholderIds(task.id);
        await this.notify(organizationId, stakeholders, {
            type: work_management_constants_1.WORK_NOTIFICATION_TYPES.COMMENT,
            title: `Bình luận mới: ${task.title}`,
            body: dto.body.trim().slice(0, 200),
            actorId: authorId,
            taskId: task.id,
            projectId: task.projectId,
        });
        if (mentionIds.length) {
            await this.notify(organizationId, mentionIds, {
                type: work_management_constants_1.WORK_NOTIFICATION_TYPES.MENTION,
                title: `Bạn được nhắc tên trong: ${task.title}`,
                body: dto.body.trim().slice(0, 200),
                actorId: authorId,
                taskId: task.id,
                projectId: task.projectId,
            });
        }
        return this.serializeComment(comment);
    }
    async updateComment(organizationId, user, commentId, dto) {
        const comment = await this.prisma.workTaskComment.findFirst({
            where: { id: commentId, organizationId, deletedAt: null },
            include: { task: true },
        });
        if (!comment)
            throw new common_1.NotFoundException('Không tìm thấy bình luận');
        await this.requireWriteTask(organizationId, user, comment.taskId);
        const isAuthor = comment.authorId === user.employeeId;
        if (!isAuthor && !(0, work_management_scope_1.canManageAnyTask)(user.role)) {
            throw new common_1.ForbiddenException('Chỉ được sửa bình luận của mình');
        }
        const mentionIds = await this.resolveMentions(organizationId, dto.body, dto.mentionIds ?? comment.mentionIds);
        const updated = await this.prisma.workTaskComment.update({
            where: { id: commentId },
            data: {
                body: dto.body.trim(),
                mentionIds,
                editedAt: new Date(),
            },
            include: {
                author: { select: { id: true, name: true } },
                replies: {
                    where: { deletedAt: null },
                    include: { author: { select: { id: true, name: true } } },
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
        if (mentionIds.length) {
            await this.notify(organizationId, mentionIds, {
                type: work_management_constants_1.WORK_NOTIFICATION_TYPES.MENTION,
                title: `Bạn được nhắc tên trong: ${comment.task.title}`,
                body: dto.body.trim().slice(0, 200),
                actorId: user.employeeId,
                taskId: comment.taskId,
                projectId: comment.task.projectId,
            });
        }
        return this.serializeComment(updated);
    }
    async deleteComment(organizationId, user, commentId) {
        const comment = await this.prisma.workTaskComment.findFirst({
            where: { id: commentId, organizationId, deletedAt: null },
        });
        if (!comment)
            throw new common_1.NotFoundException('Không tìm thấy bình luận');
        await this.requireWriteTask(organizationId, user, comment.taskId);
        const isAuthor = comment.authorId === user.employeeId;
        if (!isAuthor && !(0, work_management_scope_1.canManageAnyTask)(user.role)) {
            throw new common_1.ForbiddenException('Chỉ được xóa bình luận của mình hoặc quản trị');
        }
        await this.prisma.workTaskComment.update({
            where: { id: commentId },
            data: { deletedAt: new Date() },
        });
        return { ok: true };
    }
    // ── Files ────────────────────────────────────────────────────────────────
    uploadsRoot() {
        return (0, path_1.join)(process.cwd(), 'uploads', 'work');
    }
    async listProjectDocuments(organizationId, user, projectId) {
        await (0, work_management_scope_1.resolveWorkScope)(this.prisma, organizationId, user);
        const project = await this.prisma.workProject.findFirst({
            where: { id: projectId, organizationId },
        });
        if (!project)
            throw new common_1.NotFoundException('Không tìm thấy dự án');
        const files = await this.prisma.workAttachment.findMany({
            where: { organizationId, projectId, deletedAt: null },
            include: {
                uploadedBy: { select: { id: true, name: true } },
                task: { select: { id: true, title: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 500,
        });
        const visible = [];
        for (const f of files) {
            try {
                await this.assertAttachmentAccess(organizationId, user, f);
                visible.push(f);
            }
            catch {
                // skip inaccessible
            }
        }
        return visible.map((f) => this.serializeAttachment(f));
    }
    async listTaskFiles(organizationId, user, taskId) {
        const task = await this.requireVisibleTask(organizationId, user, taskId);
        const files = await this.prisma.workAttachment.findMany({
            where: { organizationId, taskId: task.id, deletedAt: null },
            include: {
                uploadedBy: { select: { id: true, name: true } },
                task: { select: { id: true, title: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
        return files.map((f) => this.serializeAttachment(f));
    }
    async uploadFile(organizationId, user, file, opts) {
        if (!file?.buffer)
            throw new common_1.BadRequestException('Thiếu file upload');
        if ((file.size ?? file.buffer.length) > work_file_policy_1.WORK_UPLOAD_MAX_BYTES) {
            throw new common_1.BadRequestException('File vượt dung lượng tối đa 100MB');
        }
        const project = await this.prisma.workProject.findFirst({
            where: { id: opts.projectId, organizationId },
        });
        if (!project)
            throw new common_1.NotFoundException('Không tìm thấy dự án');
        let task = null;
        if (opts.taskId) {
            task = await this.requireWriteTask(organizationId, user, opts.taskId);
            if (task.projectId !== opts.projectId) {
                throw new common_1.BadRequestException('Task không thuộc dự án');
            }
        }
        else if (!(0, work_management_scope_1.canManageAnyTask)(user.role) && !user.employeeId) {
            throw new common_1.ForbiddenException('Không có quyền upload tài liệu dự án');
        }
        const classified = (0, work_file_policy_1.classifyWorkUpload)(file.originalname || 'file', file.mimetype, file.size ?? file.buffer.length);
        const storedName = `${(0, crypto_1.randomUUID)()}${classified.ext}`;
        const dir = (0, path_1.join)(this.uploadsRoot(), organizationId);
        if (!(0, fs_1.existsSync)(dir))
            (0, fs_1.mkdirSync)(dir, { recursive: true });
        const absPath = (0, path_1.join)(dir, storedName);
        // Always new uuid path — never overwrite existing
        if ((0, fs_1.existsSync)(absPath)) {
            throw new common_1.BadRequestException('Xung đột tên file lưu trữ, thử lại');
        }
        await (0, plan_storage_1.writePlanFile)(this.prisma, organizationId, absPath, file.buffer.length, async () => (0, fs_1.writeFileSync)(absPath, file.buffer));
        const fileKey = `work/${organizationId}/${storedName}`;
        const row = await this.prisma.workAttachment.create({
            data: {
                organizationId,
                projectId: opts.projectId,
                taskId: opts.taskId || null,
                originalName: classified.originalName,
                storedName,
                fileKey,
                mimeType: file.mimetype || 'application/octet-stream',
                sizeBytes: file.size ?? file.buffer.length,
                kind: classified.kind,
                uploadedById: user.employeeId || null,
            },
            include: {
                uploadedBy: { select: { id: true, name: true } },
                task: { select: { id: true, title: true } },
            },
        });
        if (task) {
            const stakeholders = await this.taskStakeholderIds(task.id);
            await this.notify(organizationId, stakeholders, {
                type: work_management_constants_1.WORK_NOTIFICATION_TYPES.FILE,
                title: `File mới: ${task.title}`,
                body: classified.originalName,
                actorId: user.employeeId,
                taskId: task.id,
                projectId: task.projectId,
            });
        }
        return this.serializeAttachment(row);
    }
    async downloadAttachment(organizationId, user, id) {
        const att = await this.prisma.workAttachment.findFirst({
            where: { id, organizationId, deletedAt: null },
        });
        if (!att)
            throw new common_1.NotFoundException('Không tìm thấy file');
        await this.assertAttachmentAccess(organizationId, user, att);
        const absPath = (0, path_1.join)(this.uploadsRoot(), organizationId, att.storedName);
        if (!(0, fs_1.existsSync)(absPath))
            throw new common_1.NotFoundException('File không còn trên ổ đĩa');
        const stream = (0, fs_1.createReadStream)(absPath);
        return {
            file: new common_1.StreamableFile(stream),
            mimeType: att.mimeType,
            originalName: att.originalName,
            kind: att.kind,
        };
    }
    async softDeleteAttachment(organizationId, user, id) {
        const att = await this.prisma.workAttachment.findFirst({
            where: { id, organizationId, deletedAt: null },
        });
        if (!att)
            throw new common_1.NotFoundException('Không tìm thấy file');
        await this.assertAttachmentAccess(organizationId, user, att);
        const isUploader = att.uploadedById && att.uploadedById === user.employeeId;
        if (!isUploader && !(0, work_management_scope_1.canManageAnyTask)(user.role)) {
            throw new common_1.ForbiddenException('Chỉ người upload hoặc quản trị được xóa file');
        }
        await this.prisma.workAttachment.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
        // keep disk file for audit (no overwrite semantics)
        return { ok: true };
    }
    // ── Review flow ──────────────────────────────────────────────────────────
    async submitForReview(organizationId, user, taskId, dto) {
        const task = await this.requireWriteTask(organizationId, user, taskId);
        const columns = await this.prisma.workBoardColumn.findMany({
            where: { projectId: task.projectId },
        });
        const pending = columns.find((c) => c.key === work_management_constants_1.WORK_COLUMN_KEYS.PENDING_REVIEW);
        const inProgress = columns.find((c) => c.key === work_management_constants_1.WORK_COLUMN_KEYS.IN_PROGRESS);
        if (!pending)
            throw new common_1.BadRequestException('Thiếu cột Chờ duyệt');
        if (task.columnKey !== work_management_constants_1.WORK_COLUMN_KEYS.IN_PROGRESS &&
            task.columnKey !== work_management_constants_1.WORK_COLUMN_KEYS.NEEDS_FIX) {
            throw new common_1.BadRequestException('Chỉ gửi duyệt từ Đang làm hoặc Cần sửa');
        }
        const fromKey = task.columnKey;
        const fromId = task.columnId;
        await this.prisma.$transaction([
            this.prisma.workTask.update({
                where: { id: taskId },
                data: {
                    columnId: pending.id,
                    lastSubmittedById: user.employeeId || null,
                    lastSubmittedAt: new Date(),
                },
            }),
            this.prisma.workTaskReviewEvent.create({
                data: {
                    organizationId,
                    taskId,
                    type: work_management_constants_1.WORK_REVIEW_TYPES.SUBMIT,
                    submittedById: user.employeeId || null,
                    note: dto.note?.trim() || null,
                    revisionNumber: task.revisionCount,
                },
            }),
            this.prisma.workTaskStatusHistory.create({
                data: {
                    organizationId,
                    taskId,
                    fromColumnKey: fromKey,
                    toColumnKey: work_management_constants_1.WORK_COLUMN_KEYS.PENDING_REVIEW,
                    fromColumnId: fromId,
                    toColumnId: pending.id,
                    action: work_management_constants_1.WORK_STATUS_ACTIONS.SUBMIT_REVIEW,
                    actorId: user.employeeId || null,
                    note: dto.note?.trim() || null,
                },
            }),
        ]);
        const reviewers = await this.reviewerCandidateIds(taskId);
        await this.notify(organizationId, reviewers, {
            type: work_management_constants_1.WORK_NOTIFICATION_TYPES.SUBMIT_REVIEW,
            title: `Gửi duyệt: ${task.title}`,
            body: dto.note?.trim() || 'Công việc đang chờ duyệt',
            actorId: user.employeeId,
            taskId,
            projectId: task.projectId,
        });
        // silence unused
        void inProgress;
        return this.reloadTask(organizationId, user, taskId);
    }
    async approveTask(organizationId, user, taskId, dto) {
        if (!(0, work_management_scope_1.canManageAnyTask)(user.role) && user.role !== 'MANAGER') {
            // assigner or org-wide also allowed
            const taskPeek = await this.requireVisibleTask(organizationId, user, taskId);
            if (taskPeek.assignerId !== user.employeeId && !(0, work_management_scope_1.canManageAnyTask)(user.role)) {
                throw new common_1.ForbiddenException('Chỉ người giao / quản lý được duyệt');
            }
        }
        const task = await this.requireWriteTask(organizationId, user, taskId);
        if (task.columnKey !== work_management_constants_1.WORK_COLUMN_KEYS.PENDING_REVIEW) {
            throw new common_1.BadRequestException('Công việc không ở trạng thái Chờ duyệt');
        }
        const done = await this.prisma.workBoardColumn.findFirst({
            where: { projectId: task.projectId, key: work_management_constants_1.WORK_COLUMN_KEYS.DONE },
        });
        if (!done)
            throw new common_1.BadRequestException('Thiếu cột Hoàn thành');
        await this.prisma.$transaction([
            this.prisma.workTask.update({
                where: { id: taskId },
                data: {
                    columnId: done.id,
                    progress: 100,
                    lastReviewedById: user.employeeId || null,
                    lastReviewedAt: new Date(),
                    lastReviewNote: dto.note?.trim() || null,
                    lastReviewAction: work_management_constants_1.WORK_REVIEW_TYPES.APPROVE,
                },
            }),
            this.prisma.workTaskReviewEvent.create({
                data: {
                    organizationId,
                    taskId,
                    type: work_management_constants_1.WORK_REVIEW_TYPES.APPROVE,
                    submittedById: task.lastSubmittedById,
                    reviewedById: user.employeeId || null,
                    note: dto.note?.trim() || null,
                    revisionNumber: task.revisionCount,
                },
            }),
            this.prisma.workTaskStatusHistory.create({
                data: {
                    organizationId,
                    taskId,
                    fromColumnKey: task.columnKey,
                    toColumnKey: work_management_constants_1.WORK_COLUMN_KEYS.DONE,
                    fromColumnId: task.columnId,
                    toColumnId: done.id,
                    action: work_management_constants_1.WORK_STATUS_ACTIONS.APPROVE,
                    actorId: user.employeeId || null,
                    note: dto.note?.trim() || null,
                },
            }),
        ]);
        const stakeholders = await this.taskStakeholderIds(taskId);
        await this.notify(organizationId, stakeholders, {
            type: work_management_constants_1.WORK_NOTIFICATION_TYPES.APPROVED,
            title: `Đã duyệt: ${task.title}`,
            body: dto.note?.trim() || 'Công việc đã hoàn thành',
            actorId: user.employeeId,
            taskId,
            projectId: task.projectId,
        });
        return this.reloadTask(organizationId, user, taskId);
    }
    async requestFix(organizationId, user, taskId, dto) {
        const taskPeek = await this.requireVisibleTask(organizationId, user, taskId);
        if (!(0, work_management_scope_1.canManageAnyTask)(user.role) &&
            taskPeek.assignerId !== user.employeeId &&
            user.role !== 'MANAGER') {
            throw new common_1.ForbiddenException('Chỉ người giao / quản lý được yêu cầu sửa');
        }
        const task = await this.requireWriteTask(organizationId, user, taskId);
        if (task.columnKey !== work_management_constants_1.WORK_COLUMN_KEYS.PENDING_REVIEW) {
            throw new common_1.BadRequestException('Công việc không ở trạng thái Chờ duyệt');
        }
        const needsFix = await this.prisma.workBoardColumn.findFirst({
            where: { projectId: task.projectId, key: work_management_constants_1.WORK_COLUMN_KEYS.NEEDS_FIX },
        });
        if (!needsFix)
            throw new common_1.BadRequestException('Thiếu cột Cần sửa');
        const rev = task.revisionCount + 1;
        await this.prisma.$transaction([
            this.prisma.workTask.update({
                where: { id: taskId },
                data: {
                    columnId: needsFix.id,
                    revisionCount: rev,
                    lastReviewedById: user.employeeId || null,
                    lastReviewedAt: new Date(),
                    lastReviewNote: dto.note?.trim() || null,
                    lastReviewAction: work_management_constants_1.WORK_REVIEW_TYPES.REQUEST_FIX,
                },
            }),
            this.prisma.workTaskReviewEvent.create({
                data: {
                    organizationId,
                    taskId,
                    type: work_management_constants_1.WORK_REVIEW_TYPES.REQUEST_FIX,
                    submittedById: task.lastSubmittedById,
                    reviewedById: user.employeeId || null,
                    note: dto.note?.trim() || null,
                    revisionNumber: rev,
                },
            }),
            this.prisma.workTaskStatusHistory.create({
                data: {
                    organizationId,
                    taskId,
                    fromColumnKey: task.columnKey,
                    toColumnKey: work_management_constants_1.WORK_COLUMN_KEYS.NEEDS_FIX,
                    fromColumnId: task.columnId,
                    toColumnId: needsFix.id,
                    action: work_management_constants_1.WORK_STATUS_ACTIONS.REQUEST_FIX,
                    actorId: user.employeeId || null,
                    note: dto.note?.trim() || null,
                },
            }),
        ]);
        const stakeholders = await this.taskStakeholderIds(taskId);
        await this.notify(organizationId, stakeholders, {
            type: work_management_constants_1.WORK_NOTIFICATION_TYPES.REQUEST_FIX,
            title: `Cần sửa: ${task.title}`,
            body: dto.note?.trim() || 'Yêu cầu chỉnh sửa',
            actorId: user.employeeId,
            taskId,
            projectId: task.projectId,
        });
        return this.reloadTask(organizationId, user, taskId);
    }
    async listStatusHistory(organizationId, user, taskId) {
        await this.requireVisibleTask(organizationId, user, taskId);
        return this.prisma.workTaskStatusHistory.findMany({
            where: { organizationId, taskId },
            include: { actor: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
    }
    async listReviewEvents(organizationId, user, taskId) {
        await this.requireVisibleTask(organizationId, user, taskId);
        return this.prisma.workTaskReviewEvent.findMany({
            where: { organizationId, taskId },
            include: {
                submittedBy: { select: { id: true, name: true } },
                reviewedBy: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
    }
    async recordMoveHistory(organizationId, taskId, from, to, actorId) {
        if (from && from.id === to.id)
            return;
        await this.prisma.workTaskStatusHistory.create({
            data: {
                organizationId,
                taskId,
                fromColumnKey: from?.key ?? null,
                toColumnKey: to.key,
                fromColumnId: from?.id ?? null,
                toColumnId: to.id,
                action: work_management_constants_1.WORK_STATUS_ACTIONS.MOVE,
                actorId: actorId || null,
            },
        });
    }
    // ── helpers ──────────────────────────────────────────────────────────────
    serializeComment(c) {
        return {
            id: c.id,
            taskId: c.taskId,
            parentId: c.parentId,
            authorId: c.authorId,
            author: c.author,
            body: c.body,
            mentionIds: c.mentionIds,
            editedAt: c.editedAt,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            replies: (c.replies ?? []).map((r) => ({
                id: r.id,
                taskId: r.taskId,
                parentId: r.parentId,
                authorId: r.authorId,
                author: r.author,
                body: r.body,
                mentionIds: r.mentionIds,
                editedAt: r.editedAt,
                createdAt: r.createdAt,
                updatedAt: r.updatedAt,
            })),
        };
    }
    serializeAttachment(f) {
        return {
            id: f.id,
            organizationId: f.organizationId,
            projectId: f.projectId,
            taskId: f.taskId,
            originalName: f.originalName,
            storedName: f.storedName,
            fileKey: f.fileKey,
            mimeType: f.mimeType,
            sizeBytes: f.sizeBytes,
            kind: f.kind,
            uploadedById: f.uploadedById,
            uploadedBy: f.uploadedBy ?? null,
            task: f.task ?? null,
            createdAt: f.createdAt,
            canPreview: f.kind === 'image' || f.kind === 'pdf',
            // Signed /uploads URL for <img>/preview without Bearer header
            url: (0, upload_signed_url_1.withSignedUploadUrl)(`/uploads/${f.fileKey}`),
        };
    }
    async resolveMentions(organizationId, body, explicit) {
        const ids = new Set(explicit.filter(Boolean));
        // @uuid pattern
        for (const m of body.matchAll(/@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi)) {
            ids.add(m[1]);
        }
        // @Name token → match employees by name (case-insensitive contains)
        const names = [...body.matchAll(/@([^\s@]{2,80})/g)]
            .map((m) => m[1])
            .filter((n) => !n.includes('-') || n.length < 36);
        if (names.length) {
            const employees = await this.prisma.employee.findMany({
                where: {
                    organizationId,
                    OR: names.map((n) => ({ name: { equals: n, mode: 'insensitive' } })),
                },
                select: { id: true },
                take: 50,
            });
            for (const e of employees)
                ids.add(e.id);
        }
        if (!ids.size)
            return [];
        const valid = await this.prisma.employee.findMany({
            where: { organizationId, id: { in: [...ids] } },
            select: { id: true },
        });
        return valid.map((e) => e.id);
    }
    async taskStakeholderIds(taskId) {
        const task = await this.prisma.workTask.findFirst({
            where: { id: taskId },
            include: { assignees: true, watchers: true },
        });
        if (!task)
            return [];
        return [
            task.createdById,
            task.assignerId,
            task.lastSubmittedById,
            ...task.assignees.map((a) => a.employeeId),
            ...task.watchers.map((w) => w.employeeId),
        ].filter(Boolean);
    }
    async reviewerCandidateIds(taskId) {
        const task = await this.prisma.workTask.findFirst({
            where: { id: taskId },
            include: { watchers: true },
        });
        if (!task)
            return [];
        const ids = [
            task.assignerId,
            task.createdById,
            ...task.watchers.map((w) => w.employeeId),
        ].filter(Boolean);
        return ids;
    }
    async assertAttachmentAccess(organizationId, user, att) {
        if (att.taskId) {
            await this.requireVisibleTask(organizationId, user, att.taskId);
            return;
        }
        // Project-only document: uploader, org-wide, or manager scope
        if (att.uploadedById && att.uploadedById === user.employeeId)
            return;
        if ((0, work_management_scope_1.canManageAnyTask)(user.role))
            return;
        const scope = await (0, work_management_scope_1.resolveWorkScope)(this.prisma, organizationId, user);
        if (scope.mode === 'all')
            return;
        throw new common_1.ForbiddenException('Không có quyền truy cập file này');
    }
    async requireVisibleTask(organizationId, user, taskId) {
        const scope = await (0, work_management_scope_1.resolveWorkScope)(this.prisma, organizationId, user);
        const task = await this.prisma.workTask.findFirst({
            where: { id: taskId, organizationId, deletedAt: null },
            include: {
                column: true,
                assignees: true,
                watchers: true,
            },
        });
        if (!task)
            throw new common_1.NotFoundException('Không tìm thấy công việc');
        this.assertVisible(user, scope, task);
        return {
            id: task.id,
            title: task.title,
            projectId: task.projectId,
            columnId: task.columnId,
            columnKey: task.column.key,
            assignerId: task.assignerId,
            createdById: task.createdById,
            revisionCount: task.revisionCount,
            lastSubmittedById: task.lastSubmittedById,
        };
    }
    async requireWriteTask(organizationId, user, taskId) {
        const scope = await (0, work_management_scope_1.resolveWorkScope)(this.prisma, organizationId, user);
        const task = await this.prisma.workTask.findFirst({
            where: { id: taskId, organizationId, deletedAt: null },
            include: {
                column: true,
                assignees: true,
                watchers: true,
            },
        });
        if (!task)
            throw new common_1.NotFoundException('Không tìm thấy công việc');
        (0, work_management_scope_1.assertCanWriteTask)(user, {
            createdById: task.createdById,
            assignerId: task.assignerId,
            assigneeIds: task.assignees.map((a) => a.employeeId),
            watcherIds: task.watchers.map((w) => w.employeeId),
        }, scope);
        return {
            id: task.id,
            title: task.title,
            projectId: task.projectId,
            columnId: task.columnId,
            columnKey: task.column.key,
            assignerId: task.assignerId,
            createdById: task.createdById,
            revisionCount: task.revisionCount,
            lastSubmittedById: task.lastSubmittedById,
        };
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
    async reloadTask(organizationId, user, taskId) {
        // Return lean review snapshot (full serialize lives in main service)
        void user;
        const task = await this.prisma.workTask.findFirst({
            where: { id: taskId, organizationId },
            include: {
                column: true,
                lastSubmittedBy: { select: { id: true, name: true } },
                lastReviewedBy: { select: { id: true, name: true } },
                assignees: { include: { employee: { select: { id: true, name: true } } } },
            },
        });
        if (!task)
            throw new common_1.NotFoundException('Không tìm thấy công việc');
        return {
            id: task.id,
            projectId: task.projectId,
            columnId: task.columnId,
            columnKey: task.column.key,
            columnName: task.column.name,
            title: task.title,
            progress: task.progress,
            revisionCount: task.revisionCount,
            lastSubmittedById: task.lastSubmittedById,
            lastSubmittedBy: task.lastSubmittedBy,
            lastSubmittedAt: task.lastSubmittedAt,
            lastReviewedById: task.lastReviewedById,
            lastReviewedBy: task.lastReviewedBy,
            lastReviewedAt: task.lastReviewedAt,
            lastReviewNote: task.lastReviewNote,
            lastReviewAction: task.lastReviewAction,
        };
    }
};
exports.WorkCollabService = WorkCollabService;
exports.WorkCollabService = WorkCollabService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], WorkCollabService);
