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
exports.AssistantWriteToolsService = void 0;
const shared_1 = require("@marketingspa/shared");
const common_1 = require("@nestjs/common");
const tool_registry_1 = require("../tool-registry/tool-registry");
const result_helpers_1 = require("../tools/result-helpers");
const prisma_service_1 = require("../../prisma/prisma.service");
const pending_action_service_1 = require("./pending-action.service");
const confirmation_logic_1 = require("./confirmation.logic");
/**
 * Write tools: handlers ONLY propose (mutates=true).
 * Actual domain write runs in AssistantWriteExecuteService after UI confirm.
 */
let AssistantWriteToolsService = class AssistantWriteToolsService {
    prisma;
    pending;
    constructor(prisma, pending) {
        this.prisma = prisma;
        this.pending = pending;
    }
    registerAll(registry) {
        const tools = [
            shared_1.ASSISTANT_TOOLS.WORK_CREATE_TASK,
            shared_1.ASSISTANT_TOOLS.CRM_CREATE_LEAD,
            shared_1.ASSISTANT_TOOLS.CRM_CREATE_CARE_REMINDER,
            shared_1.ASSISTANT_TOOLS.INBOX_MARK_READ,
            shared_1.ASSISTANT_TOOLS.INBOX_DRAFT_REPLY,
        ];
        for (const name of tools) {
            if ((0, confirmation_logic_1.isForbiddenWriteToolName)(name) || !(0, shared_1.isAssistantWriteTool)(name)) {
                throw new Error(`assistant_write_tool_forbidden:${name}`);
            }
            registry.register({
                name,
                description: writeToolDescription(name),
                permissions: shared_1.assistantToolPermissionMap[name],
                mutates: true,
                argsSchema: tool_registry_1.looseObjectArgsSchema,
                timeoutMs: shared_1.ASSISTANT_TOOL_LIMITS.timeoutMs,
                handler: async (ctx, args) => this.handlePropose(ctx, name, args),
            });
        }
    }
    async handlePropose(ctx, toolName, rawArgs) {
        const args = (0, confirmation_logic_1.stripConfirmSecrets)(rawArgs);
        // Prompt injection: ignore any client/LLM skip-confirm flags
        delete args.skipConfirm;
        delete args.confirmed;
        delete args.executeNow;
        delete args.force;
        delete args.confirmToken;
        delete args.actionId;
        if (!(0, shared_1.isAssistantWriteTool)(toolName) ||
            !(0, shared_1.assistantHasAllPermissions)(ctx, shared_1.assistantToolPermissionMap[toolName])) {
            return {
                ok: false,
                code: 'FORBIDDEN',
                message: 'Thiếu quyền cho write tool',
                tool: toolName,
                organizationId: ctx.organizationId,
                retryable: false,
            };
        }
        try {
            const prepared = await this.prepare(ctx, toolName, args);
            if (!prepared.ok) {
                return (0, result_helpers_1.validationTool)(ctx, toolName, prepared.message);
            }
            const user = {
                id: ctx.userId,
                email: '',
                name: '',
                organizationId: ctx.organizationId,
                role: ctx.role,
                permissions: ctx.permissions,
                employeeId: ctx.employeeId ?? null,
            };
            const proposeKey = typeof args.idempotencyKey === 'string'
                ? String(args.idempotencyKey).slice(0, 120)
                : (0, pending_action_service_1.hashProposeArgs)(toolName, prepared.args);
            const proposed = await this.pending.propose(user, {
                toolName,
                args: prepared.args,
                preview: prepared.preview,
                requestId: ctx.requestId,
                sessionId: ctx.sessionId ?? null,
                proposeIdempotencyKey: proposeKey,
            });
            return (0, result_helpers_1.okTool)(ctx, toolName, {
                requiresConfirmation: true,
                status: 'PROPOSED',
                actionId: proposed.actionId,
                confirmToken: proposed.confirmToken,
                expiresAt: proposed.expiresAt,
                preview: proposed.preview,
                /**
                 * executeBlocked: true — domain write must not run until
                 * POST /assistant/actions/confirm with this token.
                 */
                executeBlocked: true,
                autoSent: false,
            }, {
                evidence: [
                    { label: 'Yêu cầu xác nhận', value: 1 },
                    { label: 'Hết hạn', value: proposed.expiresAt },
                ],
            });
        }
        catch (err) {
            return (0, result_helpers_1.mapDomainError)(err, ctx, toolName);
        }
    }
    async prepare(ctx, toolName, args) {
        const actor = {
            userId: ctx.userId,
            role: ctx.role,
            label: `${ctx.role}`,
        };
        switch (toolName) {
            case shared_1.ASSISTANT_TOOLS.WORK_CREATE_TASK: {
                const projectId = s(args.projectId);
                const title = s(args.title);
                if (!projectId || !title) {
                    return { ok: false, message: 'Cần projectId và title để tạo công việc' };
                }
                const project = await this.prisma.workProject.findFirst({
                    where: { id: projectId, organizationId: ctx.organizationId },
                    select: { id: true, name: true },
                });
                if (!project)
                    return { ok: false, message: 'Dự án không tồn tại trong tổ chức' };
                const assigneeIds = arr(args.assigneeIds);
                const clean = {
                    projectId,
                    title: title.slice(0, 300),
                    description: s(args.description)?.slice(0, 2000) || undefined,
                    assigneeIds,
                    deadline: s(args.deadline) || undefined,
                    priority: s(args.priority) || undefined,
                    labels: arr(args.labels),
                    columnId: s(args.columnId) || undefined,
                };
                return {
                    ok: true,
                    args: clean,
                    preview: {
                        action: 'Tạo và giao công việc',
                        tool: toolName,
                        actor,
                        targets: [{ type: 'project', id: project.id, label: project.name }],
                        changes: [
                            { field: 'title', to: clean.title },
                            { field: 'assigneeIds', to: assigneeIds.join(',') || '(chưa gán)' },
                            { field: 'deadline', to: clean.deadline ?? null },
                            { field: 'priority', to: clean.priority ?? null },
                        ],
                        warnings: ['Chỉ ghi DB sau khi bấm “Xác nhận thực hiện”.'],
                    },
                };
            }
            case shared_1.ASSISTANT_TOOLS.CRM_CREATE_LEAD: {
                let name = s(args.name);
                const conversationId = s(args.conversationId);
                let phone = s(args.phone);
                let note = s(args.note);
                if (conversationId) {
                    const conv = await this.prisma.chatbotConversation.findFirst({
                        where: { id: conversationId, organizationId: ctx.organizationId },
                        select: {
                            id: true,
                            visitorName: true,
                            visitorPhone: true,
                            channelRef: true,
                        },
                    });
                    if (!conv)
                        return { ok: false, message: 'Hội thoại không thuộc tổ chức' };
                    if (!name)
                        name = conv.visitorName || 'Lead Fanpage';
                    if (!phone)
                        phone = conv.visitorPhone || undefined;
                    if (!note)
                        note = `Từ hội thoại ${conv.id.slice(0, 8)}…`;
                }
                if (!name)
                    return { ok: false, message: 'Cần name hoặc conversationId' };
                const clean = {
                    name: name.slice(0, 200),
                    phone: phone?.slice(0, 40) || undefined,
                    email: s(args.email)?.slice(0, 120) || undefined,
                    note: note?.slice(0, 1000) || undefined,
                    conversationId: conversationId || undefined,
                    branchId: s(args.branchId) || undefined,
                    assignedToId: s(args.assignedToId) || undefined,
                    reminderAt: s(args.reminderAt) || undefined,
                    tags: arr(args.tags),
                };
                return {
                    ok: true,
                    args: clean,
                    preview: {
                        action: 'Tạo lead từ hội thoại / form',
                        tool: toolName,
                        actor,
                        targets: clean.conversationId
                            ? [{ type: 'conversation', id: clean.conversationId, label: 'Hội thoại CSKH' }]
                            : [{ type: 'lead', label: 'Lead mới' }],
                        changes: [
                            { field: 'name', to: clean.name.slice(0, 2) + '***' },
                            { field: 'phone', to: (0, shared_1.maskPhone)(clean.phone ?? null) },
                            { field: 'email', to: (0, shared_1.maskEmail)(clean.email ?? null) },
                            { field: 'note', to: (0, shared_1.maskSensitiveText)(clean.note, 60) },
                        ],
                        warnings: ['Không tạo nếu đã trùng (domain dedupe). Cần “Xác nhận thực hiện”.'],
                    },
                };
            }
            case shared_1.ASSISTANT_TOOLS.CRM_CREATE_CARE_REMINDER: {
                const leadId = s(args.leadId);
                const reminderAt = s(args.reminderAt);
                if (!leadId || !reminderAt) {
                    return { ok: false, message: 'Cần leadId và reminderAt (ISO/date)' };
                }
                const lead = await this.prisma.lead.findFirst({
                    where: { id: leadId, organizationId: ctx.organizationId },
                    select: { id: true, name: true, reminderAt: true },
                });
                if (!lead)
                    return { ok: false, message: 'Lead không thuộc tổ chức' };
                const clean = {
                    leadId,
                    reminderAt,
                    note: s(args.note)?.slice(0, 500) || undefined,
                };
                return {
                    ok: true,
                    args: clean,
                    preview: {
                        action: 'Tạo lịch nhắc chăm sóc khách',
                        tool: toolName,
                        actor,
                        targets: [
                            {
                                type: 'lead',
                                id: lead.id,
                                label: (lead.name || 'Lead').slice(0, 2) + '***',
                            },
                        ],
                        changes: [
                            {
                                field: 'reminderAt',
                                from: lead.reminderAt?.toISOString() ?? null,
                                to: reminderAt,
                            },
                            { field: 'note', to: (0, shared_1.maskSensitiveText)(clean.note, 60) },
                        ],
                        warnings: ['Chỉ cập nhật lead.reminderAt — không gửi tin nhắn tự động.'],
                    },
                };
            }
            case shared_1.ASSISTANT_TOOLS.INBOX_MARK_READ: {
                const conversationId = s(args.conversationId);
                if (!conversationId)
                    return { ok: false, message: 'Cần conversationId' };
                const conv = await this.prisma.chatbotConversation.findFirst({
                    where: { id: conversationId, organizationId: ctx.organizationId },
                    select: { id: true, visitorName: true, staffReadAt: true, channelRef: true },
                });
                if (!conv)
                    return { ok: false, message: 'Hội thoại không thuộc tổ chức' };
                return {
                    ok: true,
                    args: { conversationId },
                    preview: {
                        action: 'Đánh dấu hội thoại đã đọc',
                        tool: toolName,
                        actor,
                        targets: [
                            {
                                type: 'conversation',
                                id: conv.id,
                                label: (0, shared_1.maskSensitiveText)(conv.visitorName, 40) || 'Hội thoại',
                            },
                        ],
                        changes: [
                            {
                                field: 'staffReadAt',
                                from: conv.staffReadAt?.toISOString() ?? null,
                                to: '(now)',
                            },
                        ],
                        warnings: ['Không gửi tin Fanpage / Meta.'],
                    },
                };
            }
            case shared_1.ASSISTANT_TOOLS.INBOX_DRAFT_REPLY: {
                const conversationId = s(args.conversationId);
                const draft = s(args.draftText) || s(args.message) || s(args.text) || '';
                if (!conversationId || !draft) {
                    return { ok: false, message: 'Cần conversationId và draftText' };
                }
                if (draft.length > shared_1.ASSISTANT_TOOL_LIMITS.maxDraftReplyChars) {
                    return {
                        ok: false,
                        message: `Nháp tối đa ${shared_1.ASSISTANT_TOOL_LIMITS.maxDraftReplyChars} ký tự`,
                    };
                }
                const conv = await this.prisma.chatbotConversation.findFirst({
                    where: { id: conversationId, organizationId: ctx.organizationId },
                    select: { id: true, visitorName: true },
                });
                if (!conv)
                    return { ok: false, message: 'Hội thoại không thuộc tổ chức' };
                const clean = {
                    conversationId,
                    draftText: draft.slice(0, shared_1.ASSISTANT_TOOL_LIMITS.maxDraftReplyChars),
                };
                return {
                    ok: true,
                    args: clean,
                    preview: {
                        action: 'Soạn nháp trả lời Fanpage',
                        tool: toolName,
                        actor,
                        targets: [
                            {
                                type: 'conversation',
                                id: conv.id,
                                label: (0, shared_1.maskSensitiveText)(conv.visitorName, 40) || 'Hội thoại',
                            },
                        ],
                        changes: [
                            {
                                field: 'draftText',
                                to: (0, shared_1.maskSensitiveText)(clean.draftText, 120),
                            },
                            { field: 'status', to: 'DRAFT' },
                            { field: 'metaSent', to: false },
                        ],
                        warnings: [
                            'CHỈ LƯU NHÁP — không tự gửi Fanpage, không đăng bài, không chạy quảng cáo.',
                        ],
                    },
                };
            }
            default:
                return { ok: false, message: 'Write tool không hỗ trợ' };
        }
    }
};
exports.AssistantWriteToolsService = AssistantWriteToolsService;
exports.AssistantWriteToolsService = AssistantWriteToolsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        pending_action_service_1.AssistantPendingActionService])
], AssistantWriteToolsService);
function writeToolDescription(name) {
    switch (name) {
        case shared_1.ASSISTANT_TOOLS.WORK_CREATE_TASK:
            return 'Đề xuất tạo + giao công việc (cần Xác nhận thực hiện). Args: projectId, title, assigneeIds?, deadline?';
        case shared_1.ASSISTANT_TOOLS.CRM_CREATE_LEAD:
            return 'Đề xuất tạo lead từ hội thoại (cần Xác nhận). Args: name?|conversationId, phone?, note?';
        case shared_1.ASSISTANT_TOOLS.CRM_CREATE_CARE_REMINDER:
            return 'Đề xuất lịch nhắc chăm sóc lead (cần Xác nhận). Args: leadId, reminderAt, note?';
        case shared_1.ASSISTANT_TOOLS.INBOX_MARK_READ:
            return 'Đề xuất đánh dấu hội thoại đã đọc (cần Xác nhận). Args: conversationId';
        case shared_1.ASSISTANT_TOOLS.INBOX_DRAFT_REPLY:
            return 'Đề xuất nháp trả lời Fanpage — KHÔNG gửi (cần Xác nhận). Args: conversationId, draftText';
        default:
            return name;
    }
}
function s(v) {
    if (v == null)
        return undefined;
    const t = String(v).trim();
    return t || undefined;
}
function arr(v) {
    if (!Array.isArray(v))
        return [];
    return v.map((x) => String(x).trim()).filter(Boolean);
}
