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
exports.AssistantWriteExecuteService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../../prisma/prisma.service");
const work_management_service_1 = require("../../work-management/work-management.service");
const leads_service_1 = require("../../leads/leads.service");
/**
 * Domain execute after user confirmed. Never called from LLM tool handlers.
 * Uses existing services when available; tenant always via JWT org.
 */
let AssistantWriteExecuteService = class AssistantWriteExecuteService {
    prisma;
    work;
    leads;
    constructor(prisma, work, leads) {
        this.prisma = prisma;
        this.work = work;
        this.leads = leads;
    }
    async run(user, toolName, args) {
        switch (toolName) {
            case shared_1.ASSISTANT_TOOLS.WORK_CREATE_TASK:
                return this.execCreateTask(user, args);
            case shared_1.ASSISTANT_TOOLS.CRM_CREATE_LEAD:
                return this.execCreateLead(user, args);
            case shared_1.ASSISTANT_TOOLS.CRM_CREATE_CARE_REMINDER:
                return this.execCareReminder(user, args);
            case shared_1.ASSISTANT_TOOLS.INBOX_MARK_READ:
                return this.execMarkRead(user, args);
            case shared_1.ASSISTANT_TOOLS.INBOX_DRAFT_REPLY:
                return this.execDraftReply(user, args);
            default:
                throw new common_1.BadRequestException(`Write tool không hỗ trợ execute: ${toolName}`);
        }
    }
    async execCreateTask(user, args) {
        const projectId = str(args.projectId);
        const title = str(args.title);
        if (!projectId || !title) {
            throw new common_1.BadRequestException('projectId và title là bắt buộc');
        }
        const assigneeIds = strArr(args.assigneeIds);
        const dto = {
            projectId,
            title,
            description: str(args.description) || undefined,
            assigneeIds: assigneeIds.length ? assigneeIds : undefined,
            deadline: str(args.deadline) || undefined,
            priority: str(args.priority) || undefined,
            labels: strArr(args.labels),
            columnId: str(args.columnId) || undefined,
        };
        const task = await this.work.createTask(user.organizationId, user, dto);
        const id = String(task.id ?? '');
        return {
            entityType: 'work_task',
            entityId: id,
            summary: 'Đã tạo công việc',
            projectId,
            title: title.slice(0, 120),
        };
    }
    async execCreateLead(user, args) {
        const name = str(args.name);
        if (!name)
            throw new common_1.BadRequestException('name là bắt buộc');
        const conversationId = str(args.conversationId) || null;
        if (conversationId) {
            const conv = await this.prisma.chatbotConversation.findFirst({
                where: { id: conversationId, organizationId: user.organizationId },
                select: { id: true, visitorName: true, visitorPhone: true },
            });
            if (!conv)
                throw new common_1.NotFoundException('Hội thoại không thuộc tổ chức');
        }
        const dto = {
            name,
            phone: str(args.phone) || undefined,
            email: str(args.email) || undefined,
            note: str(args.note) || undefined,
            branchId: str(args.branchId) || undefined,
            assignedToId: str(args.assignedToId) || undefined,
            reminderAt: str(args.reminderAt) || undefined,
            autoAssign: args.autoAssign === false ? false : true,
            tags: strArr(args.tags),
        };
        const lead = await this.leads.create(user.organizationId, dto, user.id);
        const leadId = String(lead.id ?? '');
        if (conversationId && leadId) {
            await this.prisma.chatbotConversation.updateMany({
                where: { id: conversationId, organizationId: user.organizationId },
                data: { linkedLeadId: leadId },
            });
        }
        return {
            entityType: 'lead',
            entityId: leadId,
            summary: 'Đã tạo lead',
            conversationId: conversationId ?? undefined,
            // never return raw phone
            nameMasked: name.slice(0, 2) + '***',
        };
    }
    async execCareReminder(user, args) {
        const leadId = str(args.leadId);
        const reminderAt = str(args.reminderAt);
        if (!leadId || !reminderAt) {
            throw new common_1.BadRequestException('leadId và reminderAt là bắt buộc');
        }
        const when = new Date(reminderAt);
        if (Number.isNaN(when.getTime())) {
            throw new common_1.BadRequestException('reminderAt không hợp lệ');
        }
        const note = str(args.note);
        const lead = await this.prisma.lead.findFirst({
            where: { id: leadId, organizationId: user.organizationId },
            select: { id: true, note: true, reminderAt: true, name: true },
        });
        if (!lead)
            throw new common_1.NotFoundException('Lead không thuộc tổ chức');
        const nextNote = note && note.trim()
            ? [lead.note?.trim(), `[Nhắc CSKH ${when.toISOString()}]: ${note.trim()}`]
                .filter(Boolean)
                .join('\n')
                .slice(0, 4000)
            : lead.note;
        await this.prisma.lead.update({
            where: { id: lead.id },
            data: {
                reminderAt: when,
                ...(nextNote !== lead.note ? { note: nextNote } : {}),
            },
        });
        await this.prisma.leadActivity.create({
            data: {
                organizationId: user.organizationId,
                leadId: lead.id,
                actorUserId: user.id,
                action: 'REMINDER_SET',
                metadata: { source: 'assistant', reminderAt: when.toISOString() },
            },
        });
        return {
            entityType: 'lead',
            entityId: lead.id,
            summary: 'Đã đặt lịch nhắc chăm sóc',
            reminderAt: when.toISOString(),
        };
    }
    async execMarkRead(user, args) {
        const conversationId = str(args.conversationId);
        if (!conversationId)
            throw new common_1.BadRequestException('conversationId là bắt buộc');
        const conv = await this.prisma.chatbotConversation.findFirst({
            where: { id: conversationId, organizationId: user.organizationId },
            select: { id: true, staffReadAt: true },
        });
        if (!conv)
            throw new common_1.NotFoundException('Hội thoại không thuộc tổ chức');
        const now = new Date();
        await this.prisma.chatbotConversation.update({
            where: { id: conv.id },
            data: { staffReadAt: now },
        });
        return {
            entityType: 'conversation',
            entityId: conv.id,
            summary: 'Đã đánh dấu hội thoại đã đọc',
            staffReadAt: now.toISOString(),
            // No Meta send
            metaSent: false,
        };
    }
    async execDraftReply(user, args) {
        const conversationId = str(args.conversationId);
        let draft = str(args.draftText) || str(args.message) || str(args.text) || '';
        if (!conversationId || !draft.trim()) {
            throw new common_1.BadRequestException('conversationId và draftText là bắt buộc');
        }
        draft = draft.trim().slice(0, shared_1.ASSISTANT_TOOL_LIMITS.maxDraftReplyChars);
        const conv = await this.prisma.chatbotConversation.findFirst({
            where: { id: conversationId, organizationId: user.organizationId },
            select: { id: true },
        });
        if (!conv)
            throw new common_1.NotFoundException('Hội thoại không thuộc tổ chức');
        // DRAFT only — never call Graph send / never status SENT
        const msg = await this.prisma.chatbotMessage.create({
            data: {
                conversationId: conv.id,
                role: 'assistant',
                message: draft,
                status: 'DRAFT',
                direction: 'OUTBOUND',
                senderType: 'STAFF',
                // no externalMessageId — never counted as Meta send
            },
            select: { id: true, status: true, senderType: true },
        });
        return {
            entityType: 'chatbot_message_draft',
            entityId: msg.id,
            summary: 'Đã lưu nháp trả lời Fanpage (chưa gửi)',
            conversationId: conv.id,
            status: msg.status,
            senderType: msg.senderType,
            metaSent: false,
            draftPreview: (0, shared_1.maskSensitiveText)(draft, 80),
        };
    }
};
exports.AssistantWriteExecuteService = AssistantWriteExecuteService;
exports.AssistantWriteExecuteService = AssistantWriteExecuteService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        work_management_service_1.WorkManagementService,
        leads_service_1.LeadsService])
], AssistantWriteExecuteService);
function str(v) {
    if (v == null)
        return '';
    return String(v).trim();
}
function strArr(v) {
    if (!Array.isArray(v))
        return [];
    return v.map((x) => String(x).trim()).filter(Boolean);
}
