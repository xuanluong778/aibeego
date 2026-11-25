"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WORK_REVIEW_TYPES = exports.WORK_STATUS_ACTIONS = exports.WORK_NOTIFICATION_TYPES = exports.WORK_PERMISSIONS = exports.WORK_PRIORITIES = exports.WORK_COLUMN_KEYS = exports.DEFAULT_WORK_COLUMNS = void 0;
/** Work Management — constants + column defaults */
exports.DEFAULT_WORK_COLUMNS = [
    { key: 'NEW', name: 'Việc mới', sortOrder: 0 },
    { key: 'ASSIGNED', name: 'Đã giao', sortOrder: 1 },
    { key: 'IN_PROGRESS', name: 'Làm việc', sortOrder: 2 },
    { key: 'PENDING_REVIEW', name: 'Chờ duyệt', sortOrder: 3 },
    { key: 'NEEDS_FIX', name: 'Cần sửa', sortOrder: 4 },
    { key: 'DONE', name: 'Hoàn thành', sortOrder: 5 },
    { key: 'PAUSED', name: 'Tạm dừng', sortOrder: 6 },
];
exports.WORK_COLUMN_KEYS = {
    NEW: 'NEW',
    ASSIGNED: 'ASSIGNED',
    IN_PROGRESS: 'IN_PROGRESS',
    PENDING_REVIEW: 'PENDING_REVIEW',
    NEEDS_FIX: 'NEEDS_FIX',
    DONE: 'DONE',
    PAUSED: 'PAUSED',
};
exports.WORK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
exports.WORK_PERMISSIONS = {
    PROJECT_READ: 'work.project.read',
    PROJECT_WRITE: 'work.project.write',
    TASK_READ: 'work.task.read',
    TASK_WRITE: 'work.task.write',
    TASK_MANAGE: 'work.task.manage',
};
exports.WORK_NOTIFICATION_TYPES = {
    TASK_ASSIGNED: 'TASK_ASSIGNED',
    MENTION: 'MENTION',
    COMMENT: 'COMMENT',
    FILE: 'FILE',
    SUBMIT_REVIEW: 'SUBMIT_REVIEW',
    APPROVED: 'APPROVED',
    REQUEST_FIX: 'REQUEST_FIX',
};
exports.WORK_STATUS_ACTIONS = {
    MOVE: 'MOVE',
    SUBMIT_REVIEW: 'SUBMIT_REVIEW',
    APPROVE: 'APPROVE',
    REQUEST_FIX: 'REQUEST_FIX',
};
exports.WORK_REVIEW_TYPES = {
    SUBMIT: 'SUBMIT',
    APPROVE: 'APPROVE',
    REQUEST_FIX: 'REQUEST_FIX',
};
