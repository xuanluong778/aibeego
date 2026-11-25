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
exports.WorkManagementController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permissions_guard_1 = require("../common/guards/permissions.guard");
const require_permissions_decorator_1 = require("../common/decorators/require-permissions.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const upload_policy_1 = require("../common/uploads/upload-policy");
const work_management_service_1 = require("./work-management.service");
const work_collab_service_1 = require("./work-collab.service");
const work_insights_service_1 = require("./work-insights.service");
const work_management_constants_1 = require("./work-management.constants");
const work_management_dto_1 = require("./dto/work-management.dto");
let WorkManagementController = class WorkManagementController {
    service;
    collab;
    insights;
    constructor(service, collab, insights) {
        this.service = service;
        this.collab = collab;
        this.insights = insights;
    }
    // ── Projects / Tasks (existing) ─────────────────────────────────────────
    listProjects(user, includeArchived) {
        return this.service.listProjects(user.organizationId, user, includeArchived === '1' || includeArchived === 'true');
    }
    getProject(user, id) {
        return this.service.getProject(user.organizationId, user, id);
    }
    createProject(user, dto) {
        return this.service.createProject(user.organizationId, user, dto);
    }
    updateProject(user, id, dto) {
        return this.service.updateProject(user.organizationId, user, id, dto);
    }
    listProjectDocuments(user, id) {
        return this.collab.listProjectDocuments(user.organizationId, user, id);
    }
    uploadProjectDocument(user, id, file) {
        return this.collab.uploadFile(user.organizationId, user, file, { projectId: id });
    }
    listTasks(user, query) {
        return this.service.listTasks(user.organizationId, user, query);
    }
    getTask(user, id) {
        return this.service.getTask(user.organizationId, user, id);
    }
    createTask(user, dto) {
        return this.service.createTask(user.organizationId, user, dto);
    }
    updateTask(user, id, dto) {
        return this.service.updateTask(user.organizationId, user, id, dto);
    }
    moveTask(user, id, dto) {
        return this.service.moveTask(user.organizationId, user, id, dto);
    }
    copyTask(user, id) {
        return this.service.copyTask(user.organizationId, user, id);
    }
    archiveTask(user, id) {
        return this.service.archiveTask(user.organizationId, user, id, true);
    }
    unarchiveTask(user, id) {
        return this.service.archiveTask(user.organizationId, user, id, false);
    }
    softDeleteTask(user, id) {
        return this.service.softDeleteTask(user.organizationId, user, id);
    }
    // ── Review ───────────────────────────────────────────────────────────────
    submitReview(user, id, dto) {
        return this.collab.submitForReview(user.organizationId, user, id, dto);
    }
    approve(user, id, dto) {
        return this.collab.approveTask(user.organizationId, user, id, dto);
    }
    requestFix(user, id, dto) {
        return this.collab.requestFix(user.organizationId, user, id, dto);
    }
    statusHistory(user, id) {
        return this.collab.listStatusHistory(user.organizationId, user, id);
    }
    reviewEvents(user, id) {
        return this.collab.listReviewEvents(user.organizationId, user, id);
    }
    // ── Comments ─────────────────────────────────────────────────────────────
    listComments(user, id) {
        return this.collab.listComments(user.organizationId, user, id);
    }
    createComment(user, id, dto) {
        return this.collab.createComment(user.organizationId, user, id, dto);
    }
    updateComment(user, id, dto) {
        return this.collab.updateComment(user.organizationId, user, id, dto);
    }
    deleteComment(user, id) {
        return this.collab.deleteComment(user.organizationId, user, id);
    }
    // ── Files ────────────────────────────────────────────────────────────────
    listTaskFiles(user, id) {
        return this.collab.listTaskFiles(user.organizationId, user, id);
    }
    async uploadTaskFile(user, id, file) {
        const task = await this.service.getTask(user.organizationId, user, id);
        return this.collab.uploadFile(user.organizationId, user, file, {
            projectId: task.projectId,
            taskId: id,
        });
    }
    async downloadFile(user, id, res) {
        const result = await this.collab.downloadAttachment(user.organizationId, user, id);
        res.set({
            'Content-Type': result.mimeType,
            'Content-Disposition': `inline; filename="${encodeURIComponent(result.originalName)}"`,
        });
        return result.file;
    }
    deleteFile(user, id) {
        return this.collab.softDeleteAttachment(user.organizationId, user, id);
    }
    // ── Notifications ────────────────────────────────────────────────────────
    listNotifications(user, unreadOnly) {
        return this.collab.listNotifications(user.organizationId, user, unreadOnly === '1' || unreadOnly === 'true');
    }
    markRead(user, id) {
        return this.collab.markNotificationRead(user.organizationId, user, id);
    }
    markAllRead(user) {
        return this.collab.markAllNotificationsRead(user.organizationId, user);
    }
    // ── Column rename ────────────────────────────────────────────────────────
    renameColumn(user, id, dto) {
        return this.service.renameColumn(user.organizationId, user, id, dto.name);
    }
    // ── Insights: Việc của tôi ───────────────────────────────────────────────
    myWork(user) {
        return this.insights.myWork(user.organizationId, user);
    }
    // ── Insights: Lịch ──────────────────────────────────────────────────────
    calendar(user, q) {
        return this.insights.calendar(user.organizationId, user, { from: q.from, to: q.to });
    }
    // ── Insights: Dashboard ──────────────────────────────────────────────────
    dashboard(user, groupBy) {
        const mode = groupBy === 'project' ? 'project' : 'employee';
        return this.insights.dashboard(user.organizationId, user, mode);
    }
    employeeStats(user, employeeId) {
        return this.insights.employeeStats(user.organizationId, user, employeeId);
    }
    // ── Insights: Xuất báo cáo ───────────────────────────────────────────────
    async exportReport(user, q, res) {
        const format = q.format === 'xlsx' ? 'xlsx' : 'csv';
        const result = await this.insights.exportReport(user.organizationId, user, format);
        res.set({
            'Content-Type': result.contentType,
            'Content-Disposition': `attachment; filename="${result.filename}"`,
        });
        return result.body;
    }
    // ── Time tracking ────────────────────────────────────────────────────────
    listTimeLogs(user, id) {
        return this.insights.listTimeLogs(user.organizationId, user, id);
    }
    startTimer(user, id) {
        return this.insights.startTimer(user.organizationId, user, id);
    }
    pauseTimer(user, id) {
        return this.insights.pauseTimer(user.organizationId, user, id);
    }
    stopTimer(user, id) {
        return this.insights.stopTimer(user.organizationId, user, id);
    }
    manualTime(user, id, dto) {
        return this.insights.manualTime(user.organizationId, user, id, {
            durationMinutes: dto.durationMinutes,
            note: dto.note,
        });
    }
    // ── Audit logs ───────────────────────────────────────────────────────────
    auditLogs(user, q) {
        return this.insights.listAuditLogs(user.organizationId, user, {
            taskId: q.taskId,
            projectId: q.projectId,
            limit: q.limit,
        });
    }
};
exports.WorkManagementController = WorkManagementController;
__decorate([
    (0, common_1.Get)('projects'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.PROJECT_READ),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('includeArchived')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "listProjects", null);
__decorate([
    (0, common_1.Get)('projects/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.PROJECT_READ),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "getProject", null);
__decorate([
    (0, common_1.Post)('projects'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.PROJECT_WRITE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, work_management_dto_1.CreateWorkProjectDto]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "createProject", null);
__decorate([
    (0, common_1.Patch)('projects/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.PROJECT_WRITE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, work_management_dto_1.UpdateWorkProjectDto]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "updateProject", null);
__decorate([
    (0, common_1.Get)('projects/:id/documents'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.PROJECT_READ),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "listProjectDocuments", null);
__decorate([
    (0, common_1.Post)('projects/:id/documents'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_WRITE),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', (0, upload_policy_1.createUploadMulterOptions)('work'))),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "uploadProjectDocument", null);
__decorate([
    (0, common_1.Get)('tasks'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_READ),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, work_management_dto_1.WorkTaskQueryDto]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "listTasks", null);
__decorate([
    (0, common_1.Get)('tasks/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_READ),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "getTask", null);
__decorate([
    (0, common_1.Post)('tasks'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_WRITE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, work_management_dto_1.CreateWorkTaskDto]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "createTask", null);
__decorate([
    (0, common_1.Patch)('tasks/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_WRITE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, work_management_dto_1.UpdateWorkTaskDto]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "updateTask", null);
__decorate([
    (0, common_1.Post)('tasks/:id/move'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_WRITE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, work_management_dto_1.MoveWorkTaskDto]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "moveTask", null);
__decorate([
    (0, common_1.Post)('tasks/:id/copy'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_WRITE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "copyTask", null);
__decorate([
    (0, common_1.Post)('tasks/:id/archive'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_WRITE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "archiveTask", null);
__decorate([
    (0, common_1.Post)('tasks/:id/unarchive'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_WRITE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "unarchiveTask", null);
__decorate([
    (0, common_1.Delete)('tasks/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_WRITE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "softDeleteTask", null);
__decorate([
    (0, common_1.Post)('tasks/:id/submit-review'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_WRITE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, work_management_dto_1.SubmitReviewDto]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "submitReview", null);
__decorate([
    (0, common_1.Post)('tasks/:id/approve'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_WRITE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, work_management_dto_1.ReviewDecisionDto]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)('tasks/:id/request-fix'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_WRITE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, work_management_dto_1.ReviewDecisionDto]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "requestFix", null);
__decorate([
    (0, common_1.Get)('tasks/:id/status-history'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_READ),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "statusHistory", null);
__decorate([
    (0, common_1.Get)('tasks/:id/review-events'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_READ),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "reviewEvents", null);
__decorate([
    (0, common_1.Get)('tasks/:id/comments'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_READ),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "listComments", null);
__decorate([
    (0, common_1.Post)('tasks/:id/comments'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_WRITE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, work_management_dto_1.CreateWorkCommentDto]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "createComment", null);
__decorate([
    (0, common_1.Patch)('comments/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_WRITE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, work_management_dto_1.UpdateWorkCommentDto]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "updateComment", null);
__decorate([
    (0, common_1.Delete)('comments/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_WRITE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "deleteComment", null);
__decorate([
    (0, common_1.Get)('tasks/:id/files'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_READ),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "listTaskFiles", null);
__decorate([
    (0, common_1.Post)('tasks/:id/files'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_WRITE),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', (0, upload_policy_1.createUploadMulterOptions)('work'))),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], WorkManagementController.prototype, "uploadTaskFile", null);
__decorate([
    (0, common_1.Get)('files/:id/download'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_READ),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], WorkManagementController.prototype, "downloadFile", null);
__decorate([
    (0, common_1.Delete)('files/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_WRITE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "deleteFile", null);
__decorate([
    (0, common_1.Get)('notifications'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_READ),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('unreadOnly')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "listNotifications", null);
__decorate([
    (0, common_1.Post)('notifications/:id/read'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_READ),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "markRead", null);
__decorate([
    (0, common_1.Post)('notifications/read-all'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_READ),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "markAllRead", null);
__decorate([
    (0, common_1.Patch)('columns/:id'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.PROJECT_WRITE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, work_management_dto_1.UpdateWorkColumnDto]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "renameColumn", null);
__decorate([
    (0, common_1.Get)('my-work'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_READ),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "myWork", null);
__decorate([
    (0, common_1.Get)('calendar'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_READ),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, work_management_dto_1.CalendarQueryDto]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "calendar", null);
__decorate([
    (0, common_1.Get)('dashboard'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_READ),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('groupBy')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "dashboard", null);
__decorate([
    (0, common_1.Get)('employees/:employeeId/stats'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_READ),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('employeeId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "employeeStats", null);
__decorate([
    (0, common_1.Get)('export-report'),
    (0, common_1.Get)('reports/export'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_READ),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, work_management_dto_1.ExportReportQueryDto, Object]),
    __metadata("design:returntype", Promise)
], WorkManagementController.prototype, "exportReport", null);
__decorate([
    (0, common_1.Get)('tasks/:id/time-logs'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_READ),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "listTimeLogs", null);
__decorate([
    (0, common_1.Post)('tasks/:id/time/start'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_WRITE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "startTimer", null);
__decorate([
    (0, common_1.Post)('tasks/:id/time/pause'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_WRITE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "pauseTimer", null);
__decorate([
    (0, common_1.Post)('tasks/:id/time/stop'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_WRITE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "stopTimer", null);
__decorate([
    (0, common_1.Post)('tasks/:id/time/manual'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_WRITE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, work_management_dto_1.ManualTimeDto]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "manualTime", null);
__decorate([
    (0, common_1.Get)('audit-logs'),
    (0, require_permissions_decorator_1.RequirePermissions)(work_management_constants_1.WORK_PERMISSIONS.TASK_MANAGE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, work_management_dto_1.AuditQueryDto]),
    __metadata("design:returntype", void 0)
], WorkManagementController.prototype, "auditLogs", null);
exports.WorkManagementController = WorkManagementController = __decorate([
    (0, common_1.Controller)('work-management'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [work_management_service_1.WorkManagementService,
        work_collab_service_1.WorkCollabService,
        work_insights_service_1.WorkInsightsService])
], WorkManagementController);
