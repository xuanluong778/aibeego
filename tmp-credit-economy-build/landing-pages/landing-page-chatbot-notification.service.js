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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var LandingPageChatbotNotificationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LandingPageChatbotNotificationService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const schedule_1 = require("@nestjs/schedule");
const nodemailer_1 = __importDefault(require("nodemailer"));
const prisma_service_1 = require("../prisma/prisma.service");
const PURPOSE = 'landing_page_chatbot_handoff';
let LandingPageChatbotNotificationService = LandingPageChatbotNotificationService_1 = class LandingPageChatbotNotificationService {
    prisma;
    config;
    logger = new common_1.Logger(LandingPageChatbotNotificationService_1.name);
    transporter = null;
    constructor(prisma, config) {
        this.prisma = prisma;
        this.config = config;
    }
    async enqueue(input) {
        const lead = await this.prisma.lead.findFirst({ where: { id: input.crmLeadId, organizationId: input.organizationId }, select: { id: true, name: true, phone: true, email: true, note: true, assignedToId: true } });
        if (!lead)
            return 'unavailable';
        const employee = lead.assignedToId ? await this.prisma.employee.findFirst({ where: { id: lead.assignedToId, organizationId: input.organizationId, isActive: true }, select: { id: true, email: true, user: { select: { email: true } } } }) : null;
        const to = (employee?.email || employee?.user?.email || '').trim().toLowerCase();
        const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to);
        const idempotencyKey = `lp-chatbot:${input.chatbotLeadId}`;
        const metadata = { ...input, employeeId: employee?.id || null, attempts: 0 };
        const existing = await this.prisma.emailOutboundMessage.findUnique({ where: { organizationId_idempotencyKey: { organizationId: input.organizationId, idempotencyKey } } });
        if (existing?.status === 'SENT')
            return 'sent';
        const data = { toEmail: valid ? to : '', subject: `Khách cần tư vấn — Landing Page ${input.slug}`.slice(0, 240), metadata: metadata, status: valid ? 'PENDING' : 'BLOCKED', lastError: valid ? null : 'ASSIGNED_EMPLOYEE_EMAIL_MISSING' };
        const row = existing
            ? existing.status === 'BLOCKED' && valid ? await this.prisma.emailOutboundMessage.update({ where: { id: existing.id }, data }) : existing
            : await this.prisma.emailOutboundMessage.upsert({ where: { organizationId_idempotencyKey: { organizationId: input.organizationId, idempotencyKey } }, create: { organizationId: input.organizationId, purpose: PURPOSE, idempotencyKey, ...data }, update: {} });
        if (!valid) {
            if (!existing)
                this.logger.warn(`Handoff saved; assigned employee email missing for lead=${lead.id}`);
            return 'blocked';
        }
        void this.deliver(row.id).catch(() => undefined);
        return 'queued';
    }
    async retryPending() {
        // Reclaim interrupted sends. Atomic status claims prevent parallel workers.
        await this.prisma.emailOutboundMessage.updateMany({ where: { purpose: PURPOSE, status: 'SENDING', updatedAt: { lt: new Date(Date.now() - 120000) } }, data: { status: 'FAILED', lastError: 'SEND_INTERRUPTED' } });
        const blocked = await this.prisma.emailOutboundMessage.findMany({ where: { purpose: PURPOSE, status: 'BLOCKED', updatedAt: { lt: new Date(Date.now() - 30000) }, createdAt: { gte: new Date(Date.now() - 7 * 86400000) } }, select: { metadata: true }, take: 30 });
        for (const row of blocked) {
            const meta = row.metadata;
            if (meta?.crmLeadId && meta?.chatbotLeadId)
                await this.enqueue(meta).catch(() => undefined);
        }
        const rows = await this.prisma.emailOutboundMessage.findMany({ where: { purpose: PURPOSE, status: { in: ['PENDING', 'FAILED'] }, updatedAt: { lt: new Date(Date.now() - 30000) }, createdAt: { gte: new Date(Date.now() - 7 * 86400000) } }, select: { id: true, metadata: true }, take: 30, orderBy: { createdAt: 'asc' } });
        for (const row of rows) {
            if (Number(row.metadata?.attempts || 0) >= 5)
                continue;
            await this.deliver(row.id).catch(() => undefined);
        }
    }
    async deliver(id) {
        const row = await this.prisma.emailOutboundMessage.findUnique({ where: { id } });
        if (!row || row.purpose !== PURPOSE || !['PENDING', 'FAILED'].includes(row.status))
            return;
        const meta = row.metadata;
        if (Number(meta?.attempts || 0) >= 5)
            return;
        const claimed = await this.prisma.emailOutboundMessage.updateMany({ where: { id, status: row.status, updatedAt: row.updatedAt }, data: { status: 'SENDING', metadata: { ...meta, attempts: Number(meta?.attempts || 0) + 1 } } });
        if (!claimed.count)
            return;
        try {
            const lead = await this.prisma.lead.findFirst({ where: { id: meta.crmLeadId, organizationId: row.organizationId }, select: { id: true, name: true, phone: true, email: true, note: true, assignedToId: true } });
            const employee = lead?.assignedToId ? await this.prisma.employee.findFirst({ where: { id: lead.assignedToId, organizationId: row.organizationId, isActive: true }, select: { id: true, email: true, user: { select: { email: true } } } }) : null;
            const to = (employee?.email || employee?.user?.email || '').trim().toLowerCase();
            if (!lead || !employee || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
                await this.prisma.emailOutboundMessage.update({ where: { id }, data: { status: 'BLOCKED', lastError: 'ASSIGNED_EMPLOYEE_EMAIL_MISSING' } });
                return;
            }
            const host = this.config.get('SMTP_HOST')?.trim(), user = this.config.get('SMTP_USER')?.trim(), pass = (this.config.get('SMTP_PASS') || '').replace(/\s+/g, '');
            if (!host || !user || !pass)
                throw Error('SMTP_NOT_CONFIGURED');
            if (!this.transporter) {
                const port = Number(this.config.get('SMTP_PORT') || 587);
                this.transporter = nodemailer_1.default.createTransport({ host, port, secure: port === 465, auth: { user, pass }, connectionTimeout: 10000, socketTimeout: 15000 });
            }
            const base = (this.config.get('APP_URL') || 'https://aibeego.com').replace(/\/$/, '');
            const history = await this.prisma.chatbotMessage.findMany({ where: { conversationId: meta.conversationId, conversation: { organizationId: row.organizationId } }, orderBy: { createdAt: 'desc' }, take: 8, select: { role: true, message: true } });
            const text = [`Có khách cần tư vấn từ Landing Page ${meta.slug}.`, `Họ tên: ${lead.name}`, `Điện thoại: ${lead.phone || 'Không cung cấp'}`, `Email: ${lead.email || 'Không cung cấp'}`, `Nhu cầu: ${(lead.note || '').slice(0, 2000)}`, `Mở lead: ${base}/leads?id=${lead.id}`, '', 'Hội thoại gần đây:', ...history.reverse().map(m => `${m.role === 'user' ? 'Khách' : 'Trợ lý'}: ${m.message.slice(0, 1000)}`)].join('\n');
            const result = await this.transporter.sendMail({ from: `Ai Bee Go <${user}>`, to, subject: row.subject || 'Khách cần tư vấn Landing Page', text, messageId: `<lp-chatbot-${id}@aibeego.com>` });
            await this.prisma.emailOutboundMessage.update({ where: { id }, data: { toEmail: to, status: 'SENT', provider: 'smtp', providerMessageId: result.messageId || id, sentAt: new Date(), failedAt: null, lastError: null } });
        }
        catch {
            await this.prisma.emailOutboundMessage.update({ where: { id }, data: { status: 'FAILED', failedAt: new Date(), lastError: 'SMTP_SEND_FAILED' } });
            this.logger.warn(`Landing Page handoff email failed; will retry outbox=${id}`);
        }
    }
};
exports.LandingPageChatbotNotificationService = LandingPageChatbotNotificationService;
__decorate([
    (0, schedule_1.Cron)('*/30 * * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], LandingPageChatbotNotificationService.prototype, "retryPending", null);
exports.LandingPageChatbotNotificationService = LandingPageChatbotNotificationService = LandingPageChatbotNotificationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, config_1.ConfigService])
], LandingPageChatbotNotificationService);
