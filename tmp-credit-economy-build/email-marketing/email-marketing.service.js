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
exports.EmailMarketingService = void 0;
exports.segmentWhere = segmentWhere;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const pagination_util_1 = require("../common/utils/pagination.util");
const email_marketing_queue_service_1 = require("./email-marketing-queue.service");
const email_marketing_util_1 = require("./email-marketing.util");
const email_spreadsheet_util_1 = require("./email-spreadsheet.util");
const openai_service_1 = require("../openai/openai.service");
const credit_service_1 = require("../credit/credit.service");
const shared_1 = require("@marketingspa/shared");
const create_1 = require("@marketingspa/shared/dist/email-providers/create");
const shared_2 = require("@marketingspa/shared");
const ses_identity_1 = require("@marketingspa/shared/dist/email-providers/ses-identity");
const email_domain_dns_util_1 = require("./email-domain-dns.util");
const ses_webhook_util_1 = require("./ses-webhook.util");
const ses_webhook_security_1 = require("./ses-webhook-security");
const email_automation_recipes_1 = require("./email-automation-recipes");
const email_preset_templates_1 = require("./email-preset-templates");
const WELCOME_DEDUPE_TRIGGERS = new Set([
    database_1.EmailAutomationTrigger.NEW_LEAD,
    database_1.EmailAutomationTrigger.FUNNEL_SIGNUP,
    database_1.EmailAutomationTrigger.NEW_CONTACT,
]);
const CONTACT_LIST_INCLUDE = {
    listMembers: { include: { list: { select: { id: true, name: true } } } },
};
const CRM_STAGE_FALLBACK = {
    NEW: 'Mới',
    CONTACTED: 'Đã liên hệ',
    QUALIFIED: 'Tiềm năng',
    BOOKED: 'Đã đặt lịch',
    CONFIRMED: 'Đã xác nhận',
    VISITED: 'Đã đến',
    PURCHASED: 'Đã mua',
    LOST: 'Mất',
};
function mergeTags(current, incoming) {
    return [...new Set([...(current ?? []), ...(incoming ?? [])].map((t) => t.trim()).filter(Boolean))];
}
const EDITABLE_CAMPAIGN = [
    database_1.EmailCampaignStatus.DRAFT,
    database_1.EmailCampaignStatus.PAUSED,
    database_1.EmailCampaignStatus.SCHEDULED,
];
let EmailMarketingService = class EmailMarketingService {
    prisma;
    queue;
    openAi;
    credit;
    constructor(prisma, queue, openAi, credit) {
        this.prisma = prisma;
        this.queue = queue;
        this.openAi = openAi;
        this.credit = credit;
    }
    async scopedCampaign(organizationId, id) {
        const row = await this.prisma.emailCampaign.findFirst({ where: { id, organizationId } });
        if (!row)
            throw new common_1.NotFoundException('Không tìm thấy chiến dịch email');
        return row;
    }
    async scopedTemplate(organizationId, id) {
        const row = await this.prisma.emailTemplate.findFirst({ where: { id, organizationId } });
        if (!row)
            throw new common_1.NotFoundException('Không tìm thấy mẫu email');
        return row;
    }
    async scopedContact(organizationId, id) {
        const row = await this.prisma.emailContact.findFirst({ where: { id, organizationId } });
        if (!row)
            throw new common_1.NotFoundException('Không tìm thấy liên hệ email');
        return row;
    }
    async overview(organizationId) {
        const [contacts, subscribed, lists, templates, campaigns, running, suppressions, domains, sentAgg, openAgg, clickAgg,] = await Promise.all([
            this.prisma.emailContact.count({ where: { organizationId } }),
            this.prisma.emailContact.count({
                where: {
                    organizationId,
                    status: database_1.EmailContactStatus.SUBSCRIBED,
                    NOT: { tags: { has: database_1.CUSTOMER_360_TEST_TAG || "__c360_e2e__" } },
                },
            }),
            this.prisma.emailList.count({ where: { organizationId } }),
            this.prisma.emailTemplate.count({ where: { organizationId, isActive: true } }),
            this.prisma.emailCampaign.count({ where: { organizationId } }),
            this.prisma.emailCampaign.count({
                where: { organizationId, status: database_1.EmailCampaignStatus.RUNNING },
            }),
            this.prisma.emailSuppression.count({ where: { organizationId } }),
            this.prisma.emailSenderDomain.count({ where: { organizationId } }),
            this.prisma.emailCampaign.aggregate({
                where: { organizationId },
                _sum: { sentCount: true, openCount: true, clickCount: true },
            }),
            this.prisma.emailEvent.count({ where: { organizationId, type: database_1.EmailEventType.OPEN } }),
            this.prisma.emailEvent.count({ where: { organizationId, type: database_1.EmailEventType.CLICK } }),
        ]);
        const sent = sentAgg._sum.sentCount ?? 0;
        const opened = sentAgg._sum.openCount ?? 0;
        return {
            contacts,
            subscribed,
            lists,
            templates,
            campaigns,
            running,
            suppressions,
            domains,
            sent,
            opened,
            clicked: sentAgg._sum.clickCount ?? 0,
            openRate: sent > 0 ? Math.round((opened / sent) * 1000) / 10 : 0,
            clickRate: sent > 0 ? Math.round(((sentAgg._sum.clickCount ?? 0) / sent) * 1000) / 10 : 0,
            eventsOpen: openAgg,
            eventsClick: clickAgg,
        };
    }
    async reports(organizationId) {
        const campaigns = await this.prisma.emailCampaign.findMany({
            where: { organizationId },
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
                id: true,
                name: true,
                status: true,
                totalRecipients: true,
                sentCount: true,
                deliveredCount: true,
                openCount: true,
                clickCount: true,
                bounceCount: true,
                failCount: true,
                unsubscribeCount: true,
                startedAt: true,
                completedAt: true,
                createdAt: true,
            },
        });
        const eventGroups = await this.prisma.emailEvent.groupBy({
            by: ['type'],
            where: { organizationId },
            _count: { _all: true },
        });
        return {
            campaigns: campaigns.map((c) => withCampaignRates(c)),
            events: eventGroups.map((g) => ({ type: g.type, count: g._count._all })),
        };
    }
    // --- Templates ---
    async listTemplates(organizationId, query) {
        await this.ensurePresetTemplates(organizationId);
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        const where = { organizationId };
        if (query.search?.trim()) {
            where.name = { contains: query.search.trim(), mode: 'insensitive' };
        }
        const [items, total] = await Promise.all([
            this.prisma.emailTemplate.findMany({ where, skip, take, orderBy: { updatedAt: 'desc' } }),
            this.prisma.emailTemplate.count({ where }),
        ]);
        return (0, pagination_util_1.buildPaginatedResult)(items, total, page, pageSize);
    }
    createTemplate(organizationId, dto, userId) {
        return this.prisma.emailTemplate.create({
            data: {
                organizationId,
                name: dto.name.trim(),
                subject: dto.subject.trim(),
                previewText: dto.previewText?.trim() || null,
                htmlBody: dto.htmlBody,
                textBody: dto.textBody ?? null,
                category: dto.category?.trim() || null,
                isActive: dto.isActive ?? true,
                createdByUserId: userId ?? null,
            },
        });
    }
    async updateTemplate(organizationId, id, dto) {
        await this.scopedTemplate(organizationId, id);
        return this.prisma.emailTemplate.update({
            where: { id },
            data: {
                ...(dto.name != null ? { name: dto.name.trim() } : {}),
                ...(dto.subject != null ? { subject: dto.subject.trim() } : {}),
                ...(dto.previewText !== undefined ? { previewText: dto.previewText?.trim() || null } : {}),
                ...(dto.htmlBody != null ? { htmlBody: dto.htmlBody } : {}),
                ...(dto.textBody !== undefined ? { textBody: dto.textBody } : {}),
                ...(dto.category !== undefined ? { category: dto.category?.trim() || null } : {}),
                ...(dto.isActive != null ? { isActive: dto.isActive } : {}),
            },
        });
    }
    async deleteTemplate(organizationId, id) {
        await this.scopedTemplate(organizationId, id);
        await this.prisma.emailTemplate.delete({ where: { id } });
        return { ok: true };
    }
    // --- Contacts ---
    async listContacts(organizationId, query) {
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        const where = { organizationId };
        if (query.status)
            where.status = query.status;
        if (query.source?.trim())
            where.source = query.source.trim();
        if (query.crmStage?.trim())
            where.crmStage = query.crmStage.trim();
        if (query.tag?.trim())
            where.tags = { has: query.tag.trim() };
        if (query.search?.trim()) {
            const q = query.search.trim();
            where.OR = [
                { email: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q } },
                { source: { contains: q, mode: 'insensitive' } },
                { crmStage: { contains: q, mode: 'insensitive' } },
                { tags: { has: q } },
            ];
        }
        if (query.listId) {
            where.listMembers = { some: { listId: query.listId, organizationId } };
        }
        const [items, total] = await Promise.all([
            this.prisma.emailContact.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: { ...CONTACT_LIST_INCLUDE, _count: { select: { listMembers: true } } },
            }),
            this.prisma.emailContact.count({ where }),
        ]);
        return (0, pagination_util_1.buildPaginatedResult)(items, total, page, pageSize);
    }
    async contactFacets(organizationId) {
        const [contacts, lists] = await Promise.all([
            this.prisma.emailContact.findMany({
                where: { organizationId },
                select: { tags: true, source: true, crmStage: true },
                take: 5000,
            }),
            this.prisma.emailList.findMany({
                where: { organizationId },
                orderBy: { name: 'asc' },
                include: { _count: { select: { members: true } } },
            }),
        ]);
        const tags = [...new Set(contacts.flatMap((c) => c.tags))].sort((a, b) => a.localeCompare(b, 'vi'));
        const sources = [...new Set(contacts.map((c) => c.source).filter((s) => !!s))].sort((a, b) => a.localeCompare(b, 'vi'));
        const crmStages = [
            ...new Set(contacts.map((c) => c.crmStage).filter((s) => !!s)),
        ].sort((a, b) => a.localeCompare(b, 'vi'));
        return { tags, sources, crmStages, lists };
    }
    async createContact(organizationId, dto) {
        const contact = await this.upsertAudienceContact(organizationId, {
            email: dto.email,
            name: dto.name,
            phone: dto.phone,
            source: dto.source || 'Thêm tay',
            tags: (0, email_spreadsheet_util_1.parseTagList)(dto.tags),
            crmStage: dto.crmStage,
            listId: dto.listId,
        }, { failIfExists: true, fireAutomation: true });
        if (!contact)
            throw new common_1.BadRequestException('Email không hợp lệ');
        return this.prisma.emailContact.findFirstOrThrow({
            where: { id: contact.id, organizationId },
            include: CONTACT_LIST_INCLUDE,
        });
    }
    async updateContact(organizationId, id, dto) {
        const current = await this.scopedContact(organizationId, id);
        const data = {};
        // CRM Customer is SSOT. EmailContact is a projection — never write back to Customer.
        // Name/phone on a linked contact stay owned by CRM projector.
        if (!current.customerId) {
            if (dto.name !== undefined)
                data.name = dto.name?.trim() || null;
            if (dto.phone !== undefined)
                data.phone = dto.phone?.trim() || null;
        }
        else if (dto.name !== undefined || dto.phone !== undefined) {
            // Ignore CRM-owned fields; consent/tags still apply below.
        }
        if (dto.source !== undefined)
            data.source = dto.source?.trim() || null;
        if (dto.crmStage !== undefined)
            data.crmStage = dto.crmStage?.trim() || null;
        if (dto.tags)
            data.tags = (0, email_spreadsheet_util_1.parseTagList)(dto.tags);
        if (dto.status) {
            data.status = dto.status;
            data.unsubscribedAt = dto.status === database_1.EmailContactStatus.UNSUBSCRIBED ? new Date() : null;
        }
        if (dto.customFields)
            data.customFields = dto.customFields;
        await this.prisma.emailContact.update({ where: { id: current.id }, data });
        if (dto.listId) {
            await this.addListMember(organizationId, dto.listId, { contactId: current.id });
        }
        return this.prisma.emailContact.findFirstOrThrow({
            where: { id: current.id, organizationId },
            include: CONTACT_LIST_INCLUDE,
        });
    }
    async deleteContact(organizationId, id) {
        await this.scopedContact(organizationId, id);
        await this.prisma.emailContact.delete({ where: { id } });
        return { ok: true };
    }
    async previewAudience(organizationId, listId) {
        const PREVIEW_CAP = 5000;
        if (listId) {
            const list = await this.prisma.emailList.findFirst({ where: { id: listId, organizationId } });
            if (!list)
                throw new common_1.NotFoundException('Không tìm thấy nhóm');
        }
        const suppressed = await this.prisma.emailSuppression.findMany({
            where: { organizationId },
            select: { email: true },
            take: PREVIEW_CAP,
        });
        const suppressedSet = new Set(suppressed.map((s) => s.email.toLowerCase()));
        const contacts = listId
            ? (await this.prisma.emailListMember.findMany({
                where: { organizationId, listId },
                take: PREVIEW_CAP,
                include: { contact: { select: { email: true, status: true } } },
            })).map((m) => m.contact)
            : await this.prisma.emailContact.findMany({
                where: { organizationId },
                select: { email: true, status: true },
                take: PREVIEW_CAP,
            });
        let eligible = 0;
        let skippedSuppressed = 0;
        let skippedUnsubscribed = 0;
        for (const c of contacts) {
            if (c.status !== database_1.EmailContactStatus.SUBSCRIBED) {
                skippedUnsubscribed += 1;
                continue;
            }
            if (suppressedSet.has(c.email.toLowerCase())) {
                skippedSuppressed += 1;
                continue;
            }
            eligible += 1;
        }
        return {
            eligible,
            skippedSuppressed,
            skippedUnsubscribed,
            total: contacts.length,
            capped: contacts.length >= PREVIEW_CAP,
            listId: listId ?? null,
        };
    }
    async listAudienceMembers(organizationId, query) {
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        if (query.listId) {
            const list = await this.prisma.emailList.findFirst({
                where: { id: query.listId, organizationId },
            });
            if (!list)
                throw new common_1.NotFoundException('Không tìm thấy nhóm');
        }
        const suppressed = await this.prisma.emailSuppression.findMany({
            where: { organizationId },
            select: { email: true, reason: true },
        });
        const suppressedMap = new Map(suppressed.map((s) => [s.email.toLowerCase(), s.reason]));
        const where = { organizationId };
        if (query.listId) {
            where.listMembers = { some: { listId: query.listId, organizationId } };
        }
        if (query.search?.trim()) {
            const q = query.search.trim();
            where.OR = [
                { email: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
                { source: { contains: q, mode: 'insensitive' } },
            ];
        }
        const eligibleOnly = (query.filter || 'eligible').toLowerCase() !== 'all';
        // Hard cap — never load entire org audience into memory for UI pagination.
        const HARD_CAP = 5000;
        const [totalMatching, contacts] = await Promise.all([
            this.prisma.emailContact.count({ where }),
            this.prisma.emailContact.findMany({
                where,
                orderBy: [{ name: 'asc' }, { email: 'asc' }],
                take: HARD_CAP,
                include: {
                    listMembers: { include: { list: { select: { id: true, name: true } } } },
                },
            }),
        ]);
        const mapped = contacts.map((c) => {
            const email = c.email.toLowerCase();
            const suppressionReason = suppressedMap.get(email) ?? null;
            let skipReason = null;
            if (c.status === database_1.EmailContactStatus.UNSUBSCRIBED)
                skipReason = 'unsubscribed';
            else if (c.status === database_1.EmailContactStatus.BOUNCED)
                skipReason = 'hard_bounce';
            else if (suppressionReason === 'COMPLAINT')
                skipReason = 'complaint';
            else if (suppressionReason === 'BOUNCE')
                skipReason = 'hard_bounce';
            else if (suppressionReason === 'UNSUBSCRIBE')
                skipReason = 'unsubscribed';
            else if (suppressionReason)
                skipReason = 'suppression';
            else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email))
                skipReason = 'invalid';
            const statusLabel = skipReason === 'unsubscribed'
                ? 'Đã hủy ĐK'
                : skipReason === 'hard_bounce'
                    ? 'Hard bounce'
                    : skipReason === 'complaint'
                        ? 'Complaint'
                        : skipReason === 'invalid'
                            ? 'Invalid'
                            : skipReason === 'suppression'
                                ? 'Suppression'
                                : c.status === database_1.EmailContactStatus.SUBSCRIBED
                                    ? 'Nhận email'
                                    : c.status;
            return {
                id: c.id,
                name: c.name,
                email: c.email,
                source: c.source,
                groups: c.listMembers.map((m) => m.list.name),
                status: c.status,
                statusLabel,
                eligible: !skipReason,
                skipReason,
            };
        });
        const filtered = eligibleOnly ? mapped.filter((m) => m.eligible) : mapped;
        const total = eligibleOnly ? filtered.length : Math.min(totalMatching, HARD_CAP);
        const items = filtered.slice(skip, skip + take);
        return (0, pagination_util_1.buildPaginatedResult)(items, total, page, pageSize);
    }
    async importFromCustomers(organizationId) {
        return this.syncFromCrm(organizationId);
    }
    async syncFromCrm(organizationId) {
        const [customers, leads] = await Promise.all([
            this.prisma.customer.findMany({
                where: {
                    organizationId,
                    isActive: true,
                    email: { not: null },
                    ...(0, database_1.customerExcludeTestWhere)(),
                },
                take: 2000,
                select: { id: true, email: true, name: true, phone: true, tags: true, leadSource: { select: { name: true } } },
            }),
            this.prisma.lead.findMany({
                where: { organizationId, email: { not: null } },
                take: 2000,
                select: {
                    id: true,
                    email: true,
                    name: true,
                    phone: true,
                    tags: true,
                    customerId: true,
                    pipelineStatus: true,
                    funnelRecommendationId: true,
                    leadSource: { select: { name: true } },
                    stage: { select: { name: true } },
                },
            }),
        ]);
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        const processChunk = async (rows) => {
            for (const row of rows) {
                const result = await this.upsertAudienceContact(organizationId, row);
                if (!result) {
                    skipped += 1;
                    continue;
                }
                if (result.created)
                    imported += 1;
                else
                    updated += 1;
            }
        };
        await processChunk(leads.map((lead) => ({
            email: lead.email || '',
            name: lead.name,
            phone: lead.phone,
            source: lead.leadSource?.name || (lead.funnelRecommendationId ? 'Funnel' : 'CRM'),
            tags: lead.tags,
            crmStage: lead.stage?.name || CRM_STAGE_FALLBACK[lead.pipelineStatus] || lead.pipelineStatus,
            leadId: lead.id,
            customerId: lead.customerId,
        })));
        await processChunk(customers.map((c) => ({
            email: c.email || '',
            name: c.name,
            phone: c.phone,
            source: c.leadSource?.name || 'CRM',
            tags: c.tags,
            customerId: c.id,
        })));
        return {
            imported,
            updated,
            skipped,
            scanned: customers.length + leads.length,
        };
    }
    async importSpreadsheet(organizationId, file, listId) {
        if (!file?.buffer?.length)
            throw new common_1.BadRequestException('Hãy chọn file CSV hoặc Excel');
        let rows;
        try {
            rows = (0, email_spreadsheet_util_1.parseContactSpreadsheet)(file);
        }
        catch (err) {
            throw new common_1.BadRequestException(err instanceof Error ? err.message : 'Không đọc được file');
        }
        if (!rows.length)
            throw new common_1.BadRequestException('File không có dữ liệu (cần dòng tiêu đề + ít nhất 1 khách)');
        if (rows.length > 2000)
            throw new common_1.BadRequestException('Tối đa 2.000 dòng mỗi lần nhập');
        let imported = 0;
        let updated = 0;
        let skipped = 0;
        for (const row of rows) {
            const result = await this.upsertAudienceContact(organizationId, {
                email: row.email || '',
                name: row.name,
                phone: row.phone,
                source: row.source || 'Excel',
                tags: (0, email_spreadsheet_util_1.parseTagList)(row.tags),
                listId,
                listName: row.listName,
            });
            if (!result) {
                skipped += 1;
                continue;
            }
            if (result.created)
                imported += 1;
            else
                updated += 1;
        }
        return { imported, updated, skipped, scanned: rows.length };
    }
    async upsertAudienceContact(organizationId, row, opts) {
        const email = (0, email_marketing_util_1.normalizeEmail)(row.email || '');
        if (!email || !email.includes('@'))
            return null;
        // Keep E2E / test tags out of live audience mutations unless already tagged.
        if ((0, database_1.isCustomer360TestTag)(row.tags) && !row.customerId) {
            // still allow explicit test runs that pass customerId
        }
        let customerId = row.customerId || null;
        if (!customerId) {
            try {
                const resolved = await this.prisma.$transaction(async (tx) => (0, database_1.resolveCustomerForIngress)(tx, {
                    organizationId,
                    name: row.name?.trim() || email,
                    email,
                    phone: row.phone,
                    source: row.source?.trim() || database_1.CUSTOMER_SOURCE.EMAIL_MARKETING,
                    tags: (0, email_spreadsheet_util_1.parseTagList)(row.tags),
                }));
                if (resolved.customer)
                    customerId = resolved.customer.id;
            }
            catch {
                customerId = null;
            }
        }
        const existing = await this.prisma.emailContact.findFirst({
            where: { organizationId, email },
        });
        if (existing && opts?.failIfExists) {
            throw new common_1.BadRequestException('Email đã tồn tại trong danh bạ tổ chức này');
        }
        const tags = (0, email_spreadsheet_util_1.parseTagList)(row.tags);
        let contactId;
        let created = false;
        if (existing) {
            contactId = existing.id;
            await this.prisma.emailContact.update({
                where: { id: existing.id },
                data: {
                    name: row.name?.trim() || existing.name,
                    phone: row.phone?.trim() || existing.phone,
                    source: row.source?.trim() || existing.source,
                    crmStage: row.crmStage?.trim() || existing.crmStage,
                    tags: mergeTags(existing.tags, tags),
                    customerId: customerId || existing.customerId,
                    leadId: row.leadId || existing.leadId,
                },
            });
        }
        else {
            created = true;
            const createdRow = await this.prisma.emailContact.create({
                data: {
                    organizationId,
                    email,
                    name: row.name?.trim() || null,
                    phone: row.phone?.trim() || null,
                    source: row.source?.trim() || null,
                    crmStage: row.crmStage?.trim() || null,
                    tags,
                    customerId,
                    leadId: row.leadId || null,
                },
            });
            contactId = createdRow.id;
            if (opts?.fireAutomation) {
                await this.fireAutomations(organizationId, database_1.EmailAutomationTrigger.NEW_CONTACT, contactId);
            }
        }
        let targetListId = row.listId || null;
        if (!targetListId && row.listName?.trim()) {
            const found = await this.prisma.emailList.findFirst({
                where: { organizationId, name: { equals: row.listName.trim(), mode: 'insensitive' } },
            });
            if (found)
                targetListId = found.id;
            else {
                const createdList = await this.prisma.emailList.create({
                    data: { organizationId, name: row.listName.trim() },
                });
                targetListId = createdList.id;
            }
        }
        if (targetListId) {
            const list = await this.prisma.emailList.findFirst({
                where: { id: targetListId, organizationId },
            });
            if (list) {
                await this.prisma.emailListMember.upsert({
                    where: { listId_contactId: { listId: list.id, contactId } },
                    create: { organizationId, listId: list.id, contactId },
                    update: {},
                });
            }
        }
        return { id: contactId, created };
    }
    // --- Lists ---
    async listLists(organizationId, query) {
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        const where = { organizationId };
        if (query.search?.trim()) {
            where.name = { contains: query.search.trim(), mode: 'insensitive' };
        }
        const [items, total] = await Promise.all([
            this.prisma.emailList.findMany({
                where,
                skip,
                take,
                orderBy: { updatedAt: 'desc' },
                include: { _count: { select: { members: true } } },
            }),
            this.prisma.emailList.count({ where }),
        ]);
        return (0, pagination_util_1.buildPaginatedResult)(items, total, page, pageSize);
    }
    createList(organizationId, dto) {
        return this.prisma.emailList.create({
            data: {
                organizationId,
                name: dto.name.trim(),
                description: dto.description?.trim() || null,
            },
        });
    }
    async updateList(organizationId, id, dto) {
        const row = await this.prisma.emailList.findFirst({ where: { id, organizationId } });
        if (!row)
            throw new common_1.NotFoundException('Không tìm thấy danh sách');
        return this.prisma.emailList.update({
            where: { id },
            data: { name: dto.name.trim(), description: dto.description?.trim() || null },
        });
    }
    async deleteList(organizationId, id) {
        const row = await this.prisma.emailList.findFirst({ where: { id, organizationId } });
        if (!row)
            throw new common_1.NotFoundException('Không tìm thấy danh sách');
        await this.prisma.emailList.delete({ where: { id } });
        return { ok: true };
    }
    async listMembers(organizationId, listId, query) {
        const list = await this.prisma.emailList.findFirst({ where: { id: listId, organizationId } });
        if (!list)
            throw new common_1.NotFoundException('Không tìm thấy danh sách');
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        const where = { organizationId, listId };
        const [items, total] = await Promise.all([
            this.prisma.emailListMember.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: { contact: true },
            }),
            this.prisma.emailListMember.count({ where }),
        ]);
        return (0, pagination_util_1.buildPaginatedResult)(items, total, page, pageSize);
    }
    async addListMember(organizationId, listId, dto) {
        const list = await this.prisma.emailList.findFirst({ where: { id: listId, organizationId } });
        if (!list)
            throw new common_1.NotFoundException('Không tìm thấy danh sách');
        let contactId = dto.contactId;
        if (!contactId) {
            if (!dto.email)
                throw new common_1.BadRequestException('Cần contactId hoặc email');
            const email = (0, email_marketing_util_1.normalizeEmail)(dto.email);
            const contact = await this.prisma.emailContact.upsert({
                where: { organizationId_email: { organizationId, email } },
                create: { organizationId, email, name: dto.name?.trim() || null },
                update: dto.name ? { name: dto.name.trim() } : {},
            });
            contactId = contact.id;
        }
        else {
            await this.scopedContact(organizationId, contactId);
        }
        const member = await this.prisma.emailListMember.upsert({
            where: { listId_contactId: { listId, contactId } },
            create: { organizationId, listId, contactId },
            update: {},
            include: { contact: true },
        });
        await this.fireAutomations(organizationId, database_1.EmailAutomationTrigger.LIST_JOIN, contactId, listId);
        return member;
    }
    async removeListMember(organizationId, listId, contactId) {
        const member = await this.prisma.emailListMember.findFirst({
            where: { organizationId, listId, contactId },
        });
        if (!member)
            throw new common_1.NotFoundException('Không tìm thấy thành viên');
        await this.prisma.emailListMember.delete({ where: { id: member.id } });
        return { ok: true };
    }
    // --- Segments ---
    async listSegments(organizationId, query) {
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        const where = { organizationId };
        if (query.search?.trim()) {
            where.name = { contains: query.search.trim(), mode: 'insensitive' };
        }
        const [items, total] = await Promise.all([
            this.prisma.emailSegment.findMany({ where, skip, take, orderBy: { updatedAt: 'desc' } }),
            this.prisma.emailSegment.count({ where }),
        ]);
        return (0, pagination_util_1.buildPaginatedResult)(items, total, page, pageSize);
    }
    createSegment(organizationId, dto) {
        return this.prisma.emailSegment.create({
            data: {
                organizationId,
                name: dto.name.trim(),
                rules: (dto.rules ?? {}),
            },
        });
    }
    async updateSegment(organizationId, id, dto) {
        const row = await this.prisma.emailSegment.findFirst({ where: { id, organizationId } });
        if (!row)
            throw new common_1.NotFoundException('Không tìm thấy phân khúc');
        return this.prisma.emailSegment.update({
            where: { id },
            data: { name: dto.name.trim(), rules: (dto.rules ?? {}) },
        });
    }
    async deleteSegment(organizationId, id) {
        const row = await this.prisma.emailSegment.findFirst({ where: { id, organizationId } });
        if (!row)
            throw new common_1.NotFoundException('Không tìm thấy phân khúc');
        await this.prisma.emailSegment.delete({ where: { id } });
        return { ok: true };
    }
    // --- Campaigns ---
    async listCampaigns(organizationId, query) {
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        const where = { organizationId };
        if (query.status)
            where.status = query.status;
        const [items, total] = await Promise.all([
            this.prisma.emailCampaign.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: {
                    template: { select: { id: true, name: true } },
                    list: { select: { id: true, name: true } },
                    segment: { select: { id: true, name: true } },
                    senderDomain: { select: { id: true, domain: true, fromEmail: true } },
                },
            }),
            this.prisma.emailCampaign.count({ where }),
        ]);
        return (0, pagination_util_1.buildPaginatedResult)(items.map((row) => withCampaignRates(row)), total, page, pageSize);
    }
    async getCampaign(organizationId, id) {
        const row = await this.prisma.emailCampaign.findFirst({
            where: { id, organizationId },
            include: {
                template: true,
                list: { select: { id: true, name: true } },
                segment: { select: { id: true, name: true } },
                senderDomain: true,
            },
        });
        if (!row)
            throw new common_1.NotFoundException('Không tìm thấy chiến dịch email');
        return withCampaignRates(row);
    }
    async createCampaign(organizationId, dto, userId) {
        await this.assertAudience(organizationId, dto.templateId, dto.listId, dto.segmentId, dto.senderDomainId);
        const contactIds = await this.normalizeContactIds(organizationId, dto.contactIds);
        return this.prisma.emailCampaign.create({
            data: {
                organizationId,
                name: dto.name.trim(),
                subject: dto.subject?.trim() || null,
                templateId: dto.templateId ?? null,
                listId: dto.listId ?? null,
                segmentId: dto.segmentId ?? null,
                senderDomainId: dto.senderDomainId ?? null,
                selectedContactIds: contactIds,
                createdByUserId: userId ?? null,
            },
        });
    }
    async updateCampaign(organizationId, id, dto) {
        const campaign = await this.scopedCampaign(organizationId, id);
        if (!EDITABLE_CAMPAIGN.includes(campaign.status)) {
            throw new common_1.BadRequestException('Chỉ sửa chiến dịch nháp, tạm dừng hoặc đã lên lịch');
        }
        await this.assertAudience(organizationId, dto.templateId ?? campaign.templateId, dto.listId ?? campaign.listId, dto.segmentId ?? campaign.segmentId, dto.senderDomainId ?? campaign.senderDomainId);
        return this.prisma.emailCampaign.update({
            where: { id },
            data: {
                ...(dto.name != null ? { name: dto.name.trim() } : {}),
                ...(dto.subject !== undefined ? { subject: dto.subject?.trim() || null } : {}),
                ...(dto.templateId !== undefined ? { templateId: dto.templateId } : {}),
                ...(dto.listId !== undefined ? { listId: dto.listId } : {}),
                ...(dto.segmentId !== undefined ? { segmentId: dto.segmentId } : {}),
                ...(dto.senderDomainId !== undefined ? { senderDomainId: dto.senderDomainId } : {}),
                ...(dto.contactIds !== undefined
                    ? { selectedContactIds: await this.normalizeContactIds(organizationId, dto.contactIds) }
                    : {}),
            },
        });
    }
    async normalizeContactIds(organizationId, contactIds) {
        if (!contactIds?.length)
            return [];
        const unique = [...new Set(contactIds.map((id) => id.trim()).filter(Boolean))];
        if (unique.length > 20_000) {
            throw new common_1.BadRequestException('Quá nhiều người nhận được chọn');
        }
        const rows = await this.prisma.emailContact.findMany({
            where: { organizationId, id: { in: unique } },
            select: { id: true },
        });
        if (rows.length !== unique.length) {
            throw new common_1.BadRequestException('Một số contact không thuộc tổ chức này');
        }
        return rows.map((r) => r.id);
    }
    async deleteCampaign(organizationId, id) {
        const campaign = await this.scopedCampaign(organizationId, id);
        if (campaign.status === database_1.EmailCampaignStatus.RUNNING) {
            throw new common_1.BadRequestException('Không xóa chiến dịch đang chạy — hãy hủy trước');
        }
        await this.prisma.emailCampaign.delete({ where: { id } });
        return { ok: true };
    }
    async sendCampaign(organizationId, id) {
        const campaign = await this.scopedCampaign(organizationId, id);
        if (!EDITABLE_CAMPAIGN.includes(campaign.status)) {
            throw new common_1.BadRequestException('Chiến dịch không thể gửi ở trạng thái hiện tại');
        }
        if (!campaign.templateId)
            throw new common_1.BadRequestException('Chiến dịch cần mẫu email');
        await this.prisma.emailCampaign.update({
            where: { id },
            data: { status: database_1.EmailCampaignStatus.RUNNING, startedAt: new Date(), scheduledAt: null },
        });
        await this.queue.enqueuePlan(organizationId, id);
        return this.getCampaign(organizationId, id);
    }
    async scheduleCampaign(organizationId, id, dto) {
        const campaign = await this.scopedCampaign(organizationId, id);
        if (!EDITABLE_CAMPAIGN.includes(campaign.status)) {
            throw new common_1.BadRequestException('Không lên lịch được chiến dịch này');
        }
        const when = new Date(dto.scheduledAt);
        if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) {
            throw new common_1.BadRequestException('Thời điểm gửi phải ở tương lai');
        }
        if (!campaign.templateId)
            throw new common_1.BadRequestException('Chiến dịch cần mẫu email');
        return this.prisma.emailCampaign.update({
            where: { id },
            data: { status: database_1.EmailCampaignStatus.SCHEDULED, scheduledAt: when },
        });
    }
    async pauseCampaign(organizationId, id) {
        const campaign = await this.scopedCampaign(organizationId, id);
        if (campaign.status !== database_1.EmailCampaignStatus.RUNNING) {
            throw new common_1.BadRequestException('Chỉ tạm dừng chiến dịch đang chạy');
        }
        return this.prisma.emailCampaign.update({
            where: { id },
            data: { status: database_1.EmailCampaignStatus.PAUSED },
        });
    }
    async cancelCampaign(organizationId, id) {
        const campaign = await this.scopedCampaign(organizationId, id);
        if (campaign.status === database_1.EmailCampaignStatus.COMPLETED) {
            throw new common_1.BadRequestException('Chiến dịch đã hoàn thành');
        }
        return this.prisma.emailCampaign.update({
            where: { id },
            data: { status: database_1.EmailCampaignStatus.CANCELLED, completedAt: new Date() },
        });
    }
    async listRecipients(organizationId, campaignId, query) {
        await this.scopedCampaign(organizationId, campaignId);
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        const where = { organizationId, campaignId };
        if (query.search?.trim()) {
            const q = query.search.trim();
            where.OR = [
                { email: { contains: q, mode: 'insensitive' } },
                { contact: { name: { contains: q, mode: 'insensitive' } } },
            ];
        }
        if (query.metric === 'sent')
            where.sentAt = { not: null };
        else if (query.metric === 'delivered')
            where.deliveredAt = { not: null };
        else if (query.metric === 'opened')
            where.openedAt = { not: null };
        else if (query.metric === 'clicked')
            where.clickedAt = { not: null };
        else if (query.metric === 'bounced')
            where.status = database_1.EmailRecipientStatus.BOUNCED;
        else if (query.metric === 'unsubscribed')
            where.status = database_1.EmailRecipientStatus.UNSUBSCRIBED;
        const orderBy = query.metric === 'opened'
            ? { openedAt: 'desc' }
            : query.metric === 'clicked'
                ? { clickedAt: 'desc' }
                : query.metric === 'delivered'
                    ? { deliveredAt: 'desc' }
                    : query.metric === 'bounced'
                        ? { bouncedAt: 'desc' }
                        : { createdAt: 'desc' };
        const [items, total] = await Promise.all([
            this.prisma.emailCampaignRecipient.findMany({
                where,
                skip,
                take,
                orderBy,
                include: { contact: { select: { id: true, name: true, email: true } } },
            }),
            this.prisma.emailCampaignRecipient.count({ where }),
        ]);
        return (0, pagination_util_1.buildPaginatedResult)(items, total, page, pageSize);
    }
    // --- Suppressions / domains / automations ---
    async listSuppressions(organizationId, query) {
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        const where = { organizationId };
        if (query.search?.trim()) {
            where.email = { contains: query.search.trim(), mode: 'insensitive' };
        }
        const [items, total] = await Promise.all([
            this.prisma.emailSuppression.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
            this.prisma.emailSuppression.count({ where }),
        ]);
        return (0, pagination_util_1.buildPaginatedResult)(items, total, page, pageSize);
    }
    createSuppression(organizationId, dto) {
        const email = (0, email_marketing_util_1.normalizeEmail)(dto.email);
        return this.prisma.emailSuppression.upsert({
            where: { organizationId_email: { organizationId, email } },
            create: {
                organizationId,
                email,
                reason: dto.reason ?? database_1.EmailSuppressionReason.MANUAL,
                note: dto.note ?? null,
            },
            update: {
                reason: dto.reason ?? database_1.EmailSuppressionReason.MANUAL,
                note: dto.note ?? null,
            },
        });
    }
    async deleteSuppression(organizationId, id) {
        const row = await this.prisma.emailSuppression.findFirst({ where: { id, organizationId } });
        if (!row)
            throw new common_1.NotFoundException('Không tìm thấy suppression');
        await this.prisma.emailSuppression.delete({ where: { id } });
        return { ok: true };
    }
    async listDomains(organizationId) {
        const rows = await this.prisma.emailSenderDomain.findMany({
            where: { organizationId },
            orderBy: { createdAt: 'desc' },
        });
        return rows.map((row) => this.presentSenderDomain(row));
    }
    async createDomain(organizationId, dto) {
        const domain = (0, email_domain_dns_util_1.normalizeSenderDomain)(dto.domain);
        if (!(0, email_domain_dns_util_1.isValidSenderDomain)(domain)) {
            throw new common_1.BadRequestException('Tên miền chưa đúng. Ví dụ: spaabc.com');
        }
        const fromName = dto.fromName.trim();
        const fromEmail = (0, email_marketing_util_1.normalizeEmail)(dto.fromEmail);
        if (!(0, email_domain_dns_util_1.fromEmailMatchesDomain)(fromEmail, domain)) {
            throw new common_1.BadRequestException(`Email gửi đi phải kết thúc bằng @${domain}`);
        }
        const replyTo = dto.replyTo ? (0, email_marketing_util_1.normalizeEmail)(dto.replyTo) : null;
        const existing = await this.prisma.emailSenderDomain.findFirst({
            where: { organizationId, domain },
        });
        if (existing)
            throw new common_1.BadRequestException('Tên miền này đã được thêm');
        const ses = await Promise.race([
            (0, ses_identity_1.provisionSesDomainIdentity)(domain).catch(() => null),
            new Promise((resolve) => setTimeout(() => resolve(null), 12_000)),
        ]);
        const dkimCnames = (0, ses_identity_1.sesDkimCnameRecords)(domain, ses?.tokens ?? []);
        const spfValue = 'v=spf1 include:amazonses.com ~all';
        const dmarcValue = 'v=DMARC1; p=none;';
        try {
            const row = await this.prisma.emailSenderDomain.create({
                data: {
                    organizationId,
                    domain,
                    fromName,
                    fromEmail,
                    replyTo,
                    dkimHost: dkimCnames[0]?.host ? `${dkimCnames[0].host}.${domain}` : `mail._domainkey.${domain}`,
                    dkimValue: dkimCnames[0]?.value ?? null,
                    spfValue,
                    dmarcHost: `_dmarc.${domain}`,
                    dmarcValue,
                    dkimRecords: dkimCnames,
                },
            });
            return this.presentSenderDomain(row);
        }
        catch (err) {
            if (err.code === 'P2002') {
                throw new common_1.BadRequestException('Tên miền này đã được thêm');
            }
            throw err;
        }
    }
    async updateDomain(organizationId, id, dto) {
        const current = await this.prisma.emailSenderDomain.findFirst({ where: { id, organizationId } });
        if (!current)
            throw new common_1.NotFoundException('Không tìm thấy tên miền gửi');
        const fromEmail = dto.fromEmail ? (0, email_marketing_util_1.normalizeEmail)(dto.fromEmail) : current.fromEmail;
        if (!(0, email_domain_dns_util_1.fromEmailMatchesDomain)(fromEmail, current.domain)) {
            throw new common_1.BadRequestException(`Email gửi đi phải kết thúc bằng @${current.domain}`);
        }
        const row = await this.prisma.emailSenderDomain.update({
            where: { id },
            data: {
                ...(dto.fromName != null ? { fromName: dto.fromName.trim() } : {}),
                ...(dto.fromEmail !== undefined ? { fromEmail } : {}),
                ...(dto.replyTo !== undefined ? { replyTo: dto.replyTo ? (0, email_marketing_util_1.normalizeEmail)(dto.replyTo) : null } : {}),
            },
        });
        return this.presentSenderDomain(row);
    }
    async verifyDomain(organizationId, id) {
        return this.checkDomain(organizationId, id);
    }
    async checkDomain(organizationId, id) {
        const row = await this.prisma.emailSenderDomain.findFirst({ where: { id, organizationId } });
        if (!row)
            throw new common_1.NotFoundException('Không tìm thấy tên miền gửi');
        const dkimRecords = parseDkimRecords(row.dkimRecords);
        const [dns, ses] = await Promise.all([
            (0, email_domain_dns_util_1.checkDomainDns)({ domain: row.domain, dkimRecords }),
            Promise.race([
                (0, ses_identity_1.getSesDomainIdentity)(row.domain).catch(() => null),
                new Promise((resolve) => setTimeout(() => resolve(null), 8_000)),
            ]),
        ]);
        const refreshed = !dkimRecords.length && ses?.tokens?.length ? (0, ses_identity_1.sesDkimCnameRecords)(row.domain, ses.tokens) : dkimRecords;
        const dkimVerified = dns.dkim || ses?.dkimStatus === 'SUCCESS';
        const sesVerified = ses?.verificationStatus === 'SUCCESS' || ses?.dkimStatus === 'SUCCESS';
        const allDns = dkimVerified && dns.spf && dns.dmarc;
        const domainVerified = sesVerified || (!ses && allDns);
        const failed = ses?.verificationStatus === 'FAILED' || ses?.dkimStatus === 'FAILED';
        const status = domainVerified
            ? database_1.EmailDomainStatus.VERIFIED
            : failed
                ? database_1.EmailDomainStatus.FAILED
                : database_1.EmailDomainStatus.PENDING;
        const updated = await this.prisma.emailSenderDomain.update({
            where: { id: row.id },
            data: {
                dkimRecords: refreshed,
                dkimHost: refreshed[0]?.host ? `${refreshed[0].host}.${row.domain}` : row.dkimHost,
                dkimValue: refreshed[0]?.value ?? row.dkimValue,
                dkimVerified,
                spfVerified: dns.spf,
                dmarcVerified: dns.dmarc,
                lastCheckedAt: new Date(),
                status,
                verifiedAt: domainVerified ? row.verifiedAt ?? new Date() : row.verifiedAt,
            },
        });
        return this.presentSenderDomain(updated);
    }
    async deleteDomain(organizationId, id) {
        const row = await this.prisma.emailSenderDomain.findFirst({ where: { id, organizationId } });
        if (!row)
            throw new common_1.NotFoundException('Không tìm thấy tên miền gửi');
        await this.prisma.emailSenderDomain.delete({ where: { id } });
        return { ok: true };
    }
    presentSenderDomain(row) {
        const dkimRecords = parseDkimRecords(row.dkimRecords);
        return {
            ...row,
            domainVerified: row.status === database_1.EmailDomainStatus.VERIFIED,
            dnsRecords: (0, email_domain_dns_util_1.buildDomainDnsRecords)({
                domain: row.domain,
                dkimRecords,
                spfValue: row.spfValue,
                dmarcValue: row.dmarcValue,
            }),
        };
    }
    async listAutomations(organizationId) {
        return this.prisma.emailAutomation.findMany({
            where: { organizationId },
            orderBy: { updatedAt: 'desc' },
            take: 200,
            include: {
                template: { select: { id: true, name: true } },
                list: { select: { id: true, name: true } },
            },
        });
    }
    listAutomationRecipes(organizationId) {
        void organizationId;
        return email_automation_recipes_1.EMAIL_AUTOMATION_RECIPES;
    }
    async listCrmStagesForAutomation(organizationId) {
        const stages = await this.prisma.funnelStage.findMany({
            where: { organizationId, isActive: true },
            orderBy: [{ pipelineId: 'asc' }, { position: 'asc' }],
            select: { id: true, name: true, code: true, legacyStatus: true },
        });
        if (stages.length) {
            return stages.map((s) => ({
                id: s.id,
                code: s.code,
                name: s.name,
                legacyStatus: s.legacyStatus,
            }));
        }
        return Object.keys(CRM_STAGE_FALLBACK).map((code) => ({
            id: code,
            code,
            name: CRM_STAGE_FALLBACK[code] ?? code,
            legacyStatus: code,
        }));
    }
    async createAutomationFromRecipe(organizationId, dto) {
        const recipe = (0, email_automation_recipes_1.findEmailRecipe)(dto.recipeId);
        if (!recipe)
            throw new common_1.BadRequestException('Không tìm thấy công thức tự động hóa');
        await this.ensurePresetTemplates(organizationId);
        let templateId = dto.templateId ?? null;
        if (recipe.needsTemplate && !templateId && recipe.defaultTemplateCategory) {
            templateId = await this.resolvePresetTemplateId(organizationId, recipe.defaultTemplateCategory);
        }
        if (recipe.needsTemplate && !templateId) {
            throw new common_1.BadRequestException('Cần chọn mẫu email');
        }
        if (templateId)
            await this.scopedTemplate(organizationId, templateId);
        if (dto.listId) {
            const list = await this.prisma.emailList.findFirst({
                where: { id: dto.listId, organizationId },
            });
            if (!list)
                throw new common_1.NotFoundException('Không tìm thấy danh sách');
        }
        const data = {
            name: recipe.name,
            trigger: recipe.trigger,
            action: recipe.action,
            templateId,
            listId: dto.listId ?? null,
            waitDays: dto.waitDays ?? recipe.defaultWaitDays,
            scoreDelta: dto.scoreDelta ?? recipe.defaultScoreDelta,
            targetStage: dto.targetStage ?? recipe.defaultStage,
            recipeId: recipe.id,
            status: dto.activate === false
                ? database_1.EmailAutomationStatus.DRAFT
                : database_1.EmailAutomationStatus.ACTIVE,
        };
        const existing = await this.prisma.emailAutomation.findFirst({
            where: { organizationId, recipeId: recipe.id },
        });
        if (existing) {
            return this.prisma.emailAutomation.update({
                where: { id: existing.id },
                data,
                include: {
                    template: { select: { id: true, name: true } },
                    list: { select: { id: true, name: true } },
                },
            });
        }
        return this.prisma.emailAutomation.create({
            data: { organizationId, ...data },
            include: {
                template: { select: { id: true, name: true } },
                list: { select: { id: true, name: true } },
            },
        });
    }
    async createAutomation(organizationId, dto) {
        if (dto.templateId)
            await this.scopedTemplate(organizationId, dto.templateId);
        if (dto.listId) {
            const list = await this.prisma.emailList.findFirst({
                where: { id: dto.listId, organizationId },
            });
            if (!list)
                throw new common_1.NotFoundException('Không tìm thấy danh sách');
        }
        return this.prisma.emailAutomation.create({
            data: {
                organizationId,
                name: dto.name.trim(),
                trigger: dto.trigger,
                status: dto.status ?? database_1.EmailAutomationStatus.DRAFT,
                templateId: dto.templateId ?? null,
                listId: dto.listId ?? null,
                delayMinutes: dto.delayMinutes ?? 0,
                recipeId: dto.recipeId ?? null,
                action: dto.action ?? database_1.EmailAutomationAction.SEND_EMAIL,
                scoreDelta: dto.scoreDelta ?? 10,
                targetStage: dto.targetStage ?? null,
                waitDays: dto.waitDays ?? 2,
            },
        });
    }
    async updateAutomation(organizationId, id, dto) {
        const row = await this.prisma.emailAutomation.findFirst({ where: { id, organizationId } });
        if (!row)
            throw new common_1.NotFoundException('Không tìm thấy tự động hóa');
        return this.prisma.emailAutomation.update({
            where: { id },
            data: {
                ...(dto.name != null ? { name: dto.name.trim() } : {}),
                ...(dto.trigger != null ? { trigger: dto.trigger } : {}),
                ...(dto.status != null ? { status: dto.status } : {}),
                ...(dto.templateId !== undefined ? { templateId: dto.templateId } : {}),
                ...(dto.listId !== undefined ? { listId: dto.listId } : {}),
                ...(dto.delayMinutes != null ? { delayMinutes: dto.delayMinutes } : {}),
                ...(dto.action != null ? { action: dto.action } : {}),
                ...(dto.scoreDelta != null ? { scoreDelta: dto.scoreDelta } : {}),
                ...(dto.targetStage !== undefined ? { targetStage: dto.targetStage } : {}),
                ...(dto.waitDays != null ? { waitDays: dto.waitDays } : {}),
            },
        });
    }
    async deleteAutomation(organizationId, id) {
        const row = await this.prisma.emailAutomation.findFirst({ where: { id, organizationId } });
        if (!row)
            throw new common_1.NotFoundException('Không tìm thấy tự động hóa');
        await this.prisma.emailAutomation.delete({ where: { id } });
        return { ok: true };
    }
    async planAllowsEmailAutomation(organizationId) {
        try {
            await new database_2.PlanPolicy(this.prisma).assertFeature(organizationId, 'email_automation');
            return true;
        }
        catch (error) {
            if (error instanceof database_2.PlanPolicyError)
                return false;
            throw error;
        }
    }
    async runAutomation(organizationId, id) {
        await new database_2.PlanPolicy(this.prisma).assertFeature(organizationId, 'email_automation');
        const automation = await this.prisma.emailAutomation.findFirst({
            where: { id, organizationId },
        });
        if (!automation)
            throw new common_1.NotFoundException('Không tìm thấy tự động hóa');
        if (!automation.templateId)
            throw new common_1.BadRequestException('Tự động hóa cần mẫu email');
        const contacts = automation.listId
            ? await this.prisma.emailContact.findMany({
                where: {
                    organizationId,
                    status: database_1.EmailContactStatus.SUBSCRIBED,
                    NOT: { tags: { has: database_1.CUSTOMER_360_TEST_TAG || "__c360_e2e__" } },
                    listMembers: { some: { listId: automation.listId, organizationId } },
                },
            })
            : await this.prisma.emailContact.findMany({
                where: {
                    organizationId,
                    status: database_1.EmailContactStatus.SUBSCRIBED,
                    NOT: { tags: { has: database_1.CUSTOMER_360_TEST_TAG || "__c360_e2e__" } },
                },
                take: 500,
            });
        let queued = 0;
        for (const contact of contacts) {
            await this.enqueueAutomationSend(organizationId, automation, contact.id, contact.email);
            queued += 1;
        }
        return { queued };
    }
    // --- Public tracking ---
    async unsubscribeByRecipient(recipientId) {
        if (!recipientId?.trim())
            throw new common_1.NotFoundException('Liên kết hủy đăng ký không hợp lệ');
        const recipient = await this.prisma.emailCampaignRecipient.findFirst({
            where: { id: recipientId },
            include: { contact: true },
        });
        if (!recipient)
            throw new common_1.NotFoundException('Liên kết hủy đăng ký không hợp lệ');
        if (recipient.status === database_1.EmailRecipientStatus.UNSUBSCRIBED) {
            await this.upsertSuppression(recipient.organizationId, recipient.email, database_1.EmailSuppressionReason.UNSUBSCRIBE);
            return { ok: true, email: recipient.email, already: true };
        }
        await this.prisma.emailContact.update({
            where: { id: recipient.contactId },
            data: { status: database_1.EmailContactStatus.UNSUBSCRIBED, unsubscribedAt: new Date() },
        });
        await this.prisma.emailCampaignRecipient.update({
            where: { id: recipient.id },
            data: { status: database_1.EmailRecipientStatus.UNSUBSCRIBED },
        });
        await this.upsertSuppression(recipient.organizationId, recipient.email, database_1.EmailSuppressionReason.UNSUBSCRIBE);
        const created = await this.ensureUniqueEvent(recipient, database_1.EmailEventType.UNSUBSCRIBE, { source: 'unsubscribe' });
        if (created) {
            await this.prisma.emailCampaign.update({
                where: { id: recipient.campaignId },
                data: { unsubscribeCount: { increment: 1 } },
            });
        }
        return { ok: true, email: recipient.email };
    }
    async trackOpen(recipientId) {
        const recipient = await this.prisma.emailCampaignRecipient.findFirst({
            where: { id: recipientId },
        });
        if (!recipient)
            return false;
        if (recipient.openedAt)
            return false;
        if (recipient.status === database_1.EmailRecipientStatus.BOUNCED ||
            recipient.status === database_1.EmailRecipientStatus.FAILED ||
            recipient.status === database_1.EmailRecipientStatus.SKIPPED ||
            recipient.status === database_1.EmailRecipientStatus.UNSUBSCRIBED) {
            return false;
        }
        await this.prisma.$transaction([
            this.prisma.emailCampaignRecipient.update({
                where: { id: recipient.id },
                data: {
                    openedAt: new Date(),
                    status: recipient.status === database_1.EmailRecipientStatus.CLICKED
                        ? database_1.EmailRecipientStatus.CLICKED
                        : database_1.EmailRecipientStatus.OPENED,
                },
            }),
            this.prisma.emailEvent.create({
                data: {
                    organizationId: recipient.organizationId,
                    campaignId: recipient.campaignId,
                    recipientId: recipient.id,
                    contactId: recipient.contactId,
                    type: database_1.EmailEventType.OPEN,
                },
            }),
            this.prisma.emailCampaign.update({
                where: { id: recipient.campaignId },
                data: { openCount: { increment: 1 } },
            }),
        ]);
        void this.runEngagementAutomations(recipient.organizationId, database_1.EmailAutomationTrigger.EMAIL_OPENED, recipient.contactId);
        return true;
    }
    async trackClick(recipientId, url) {
        const recipient = await this.prisma.emailCampaignRecipient.findFirst({
            where: { id: recipientId },
        });
        if (!recipient)
            return url || '/';
        if (recipient.status === database_1.EmailRecipientStatus.BOUNCED ||
            recipient.status === database_1.EmailRecipientStatus.FAILED ||
            recipient.status === database_1.EmailRecipientStatus.UNSUBSCRIBED) {
            return url || '/';
        }
        if (recipient.clickedAt)
            return url || '/';
        const implicitOpen = !recipient.openedAt;
        await this.prisma.$transaction([
            this.prisma.emailCampaignRecipient.update({
                where: { id: recipient.id },
                data: {
                    clickedAt: new Date(),
                    openedAt: recipient.openedAt ?? new Date(),
                    status: database_1.EmailRecipientStatus.CLICKED,
                },
            }),
            this.prisma.emailEvent.create({
                data: {
                    organizationId: recipient.organizationId,
                    campaignId: recipient.campaignId,
                    recipientId: recipient.id,
                    contactId: recipient.contactId,
                    type: database_1.EmailEventType.CLICK,
                    metadata: { url: url ?? null },
                },
            }),
            ...(implicitOpen
                ? [
                    this.prisma.emailEvent.create({
                        data: {
                            organizationId: recipient.organizationId,
                            campaignId: recipient.campaignId,
                            recipientId: recipient.id,
                            contactId: recipient.contactId,
                            type: database_1.EmailEventType.OPEN,
                            metadata: { implicit: true },
                        },
                    }),
                ]
                : []),
            this.prisma.emailCampaign.update({
                where: { id: recipient.campaignId },
                data: {
                    clickCount: { increment: 1 },
                    ...(implicitOpen ? { openCount: { increment: 1 } } : {}),
                },
            }),
        ]);
        void this.runEngagementAutomations(recipient.organizationId, database_1.EmailAutomationTrigger.EMAIL_CLICKED, recipient.contactId);
        if (implicitOpen) {
            void this.runEngagementAutomations(recipient.organizationId, database_1.EmailAutomationTrigger.EMAIL_OPENED, recipient.contactId);
        }
        return url || '/';
    }
    async handleCrmTrigger(organizationId, triggerType, payload) {
        const emailTriggers = this.mapCrmToEmailTriggers(triggerType);
        if (!emailTriggers.length)
            return;
        let contactId = null;
        if (payload.leadId) {
            const lead = await this.prisma.lead.findFirst({
                where: { id: payload.leadId, organizationId },
                select: {
                    id: true,
                    email: true,
                    name: true,
                    phone: true,
                    customerId: true,
                    pipelineStatus: true,
                    funnelRecommendationId: true,
                    tags: true,
                    leadSource: { select: { name: true } },
                    stage: { select: { name: true } },
                },
            });
            if (!lead?.email?.trim())
                return;
            const upserted = await this.upsertAudienceContact(organizationId, {
                email: lead.email,
                name: lead.name,
                phone: lead.phone,
                source: lead.leadSource?.name || (lead.funnelRecommendationId ? 'Funnel' : 'CRM'),
                tags: lead.tags,
                crmStage: lead.stage?.name || CRM_STAGE_FALLBACK[lead.pipelineStatus] || lead.pipelineStatus,
                leadId: lead.id,
                customerId: lead.customerId,
            });
            if (!upserted)
                return;
            contactId = upserted.id;
            for (const trigger of emailTriggers) {
                if (trigger === database_1.EmailAutomationTrigger.FUNNEL_SIGNUP && !lead.funnelRecommendationId) {
                    continue;
                }
                await this.fireAutomations(organizationId, trigger, contactId);
            }
            return;
        }
        if (payload.customerId) {
            const customer = await this.prisma.customer.findFirst({
                where: { id: payload.customerId, organizationId },
                select: { id: true, email: true, name: true, phone: true, tags: true, leadSource: { select: { name: true } } },
            });
            if (!customer?.email?.trim())
                return;
            const upserted = await this.upsertAudienceContact(organizationId, {
                email: customer.email,
                name: customer.name,
                phone: customer.phone,
                source: customer.leadSource?.name || 'CRM',
                tags: customer.tags,
                customerId: customer.id,
            });
            if (!upserted)
                return;
            contactId = upserted.id;
            for (const trigger of emailTriggers) {
                await this.fireAutomations(organizationId, trigger, contactId);
            }
        }
    }
    async assertAudience(organizationId, templateId, listId, segmentId, senderDomainId) {
        if (templateId)
            await this.scopedTemplate(organizationId, templateId);
        if (listId) {
            const list = await this.prisma.emailList.findFirst({ where: { id: listId, organizationId } });
            if (!list)
                throw new common_1.NotFoundException('Không tìm thấy danh sách');
        }
        if (segmentId) {
            const segment = await this.prisma.emailSegment.findFirst({
                where: { id: segmentId, organizationId },
            });
            if (!segment)
                throw new common_1.NotFoundException('Không tìm thấy phân khúc');
        }
        if (senderDomainId) {
            const domain = await this.prisma.emailSenderDomain.findFirst({
                where: { id: senderDomainId, organizationId },
            });
            if (!domain)
                throw new common_1.NotFoundException('Không tìm thấy tên miền gửi');
        }
    }
    mapCrmToEmailTriggers(triggerType) {
        switch (triggerType) {
            case 'LEAD_CREATED':
                return [database_1.EmailAutomationTrigger.NEW_LEAD, database_1.EmailAutomationTrigger.FUNNEL_SIGNUP];
            case 'BOOKING_CREATED':
            case 'APPOINTMENT_CREATED':
                return [database_1.EmailAutomationTrigger.BOOKING_CREATED];
            case 'PURCHASED':
            case 'ORDER_COMPLETED':
                return [database_1.EmailAutomationTrigger.PURCHASED];
            default:
                return [];
        }
    }
    async ensurePresetTemplates(organizationId) {
        for (const preset of email_preset_templates_1.PRESET_EMAIL_TEMPLATES) {
            const category = (0, email_preset_templates_1.presetCategoryKey)(preset.category);
            const existing = await this.prisma.emailTemplate.findFirst({
                where: { organizationId, category },
            });
            if (existing)
                continue;
            await this.prisma.emailTemplate.create({
                data: {
                    organizationId,
                    name: preset.name,
                    subject: preset.subject,
                    previewText: preset.previewText,
                    htmlBody: (0, email_preset_templates_1.compilePresetHtml)(preset),
                    category,
                    isActive: true,
                },
            });
        }
    }
    async resolvePresetTemplateId(organizationId, category) {
        await this.ensurePresetTemplates(organizationId);
        const row = await this.prisma.emailTemplate.findFirst({
            where: { organizationId, category: (0, email_preset_templates_1.presetCategoryKey)(category) },
            select: { id: true },
        });
        return row?.id ?? null;
    }
    async contactInList(organizationId, listId, contactId) {
        const member = await this.prisma.emailListMember.findFirst({
            where: { organizationId, listId, contactId },
        });
        return !!member;
    }
    async ensureListMember(organizationId, listId, contactId) {
        await this.prisma.emailListMember.upsert({
            where: { listId_contactId: { listId, contactId } },
            create: { organizationId, listId, contactId },
            update: {},
        });
    }
    async shouldSkipWelcomeSend(organizationId, automation, contactId) {
        if (!WELCOME_DEDUPE_TRIGGERS.has(automation.trigger))
            return false;
        const campaignName = `[Tự động] ${automation.name}`;
        const existing = await this.prisma.emailCampaignRecipient.findFirst({
            where: {
                organizationId,
                contactId,
                campaign: { name: campaignName },
            },
            select: { id: true },
        });
        return !!existing;
    }
    async resolveStageUpdate(organizationId, targetStage) {
        if (!targetStage?.trim())
            return null;
        const byId = await this.prisma.funnelStage.findFirst({
            where: { id: targetStage, organizationId, isActive: true },
        });
        if (byId) {
            const pipelineStatus = byId.legacyStatus ??
                (Object.values(database_1.LeadPipelineStatus).includes(byId.code)
                    ? byId.code
                    : database_1.LeadPipelineStatus.CONTACTED);
            return {
                stageId: byId.id,
                pipelineStatus,
                crmStageLabel: byId.name,
            };
        }
        const code = targetStage;
        if (Object.values(database_1.LeadPipelineStatus).includes(code)) {
            const stage = await this.prisma.funnelStage.findFirst({
                where: {
                    organizationId,
                    isActive: true,
                    OR: [{ legacyStatus: code }, { code: targetStage }],
                },
            });
            return {
                stageId: stage?.id ?? null,
                pipelineStatus: code,
                crmStageLabel: stage?.name ?? CRM_STAGE_FALLBACK[code] ?? code,
            };
        }
        return null;
    }
    async applyLeadScore(organizationId, contactId, scoreDelta) {
        const contact = await this.prisma.emailContact.findFirst({
            where: { id: contactId, organizationId },
            select: { leadId: true },
        });
        if (!contact?.leadId)
            return;
        const lead = await this.prisma.lead.findFirst({
            where: { id: contact.leadId, organizationId },
            select: { score: true },
        });
        if (!lead)
            return;
        const nextScore = Math.max(0, Math.min(100, lead.score + scoreDelta));
        await this.prisma.lead.update({
            where: { id: contact.leadId },
            data: { score: nextScore },
        });
    }
    async applyCrmStage(organizationId, contactId, targetStage) {
        const resolved = await this.resolveStageUpdate(organizationId, targetStage);
        if (!resolved)
            return;
        const contact = await this.prisma.emailContact.findFirst({
            where: { id: contactId, organizationId },
            select: { leadId: true },
        });
        if (contact?.leadId) {
            await this.prisma.lead.update({
                where: { id: contact.leadId },
                data: {
                    pipelineStatus: resolved.pipelineStatus,
                    ...(resolved.stageId ? { stageId: resolved.stageId } : {}),
                },
            });
        }
        await this.prisma.emailContact.update({
            where: { id: contactId },
            data: { crmStage: resolved.crmStageLabel },
        });
    }
    async runEngagementAutomations(organizationId, trigger, contactId) {
        if (!(await this.planAllowsEmailAutomation(organizationId)))
            return;
        const automations = await this.prisma.emailAutomation.findMany({
            where: { organizationId, trigger, status: database_1.EmailAutomationStatus.ACTIVE },
        });
        if (!automations.length)
            return;
        for (const automation of automations) {
            if (automation.listId) {
                const inList = await this.contactInList(organizationId, automation.listId, contactId);
                if (!inList)
                    continue;
            }
            if (automation.action === database_1.EmailAutomationAction.ADD_LEAD_SCORE) {
                await this.applyLeadScore(organizationId, contactId, automation.scoreDelta);
            }
            else if (automation.action === database_1.EmailAutomationAction.SET_CRM_STAGE) {
                await this.applyCrmStage(organizationId, contactId, automation.targetStage);
            }
        }
    }
    async fireAutomations(organizationId, trigger, contactId, listId) {
        if (!(await this.planAllowsEmailAutomation(organizationId)))
            return;
        const automations = await this.prisma.emailAutomation.findMany({
            where: {
                organizationId,
                trigger,
                status: database_1.EmailAutomationStatus.ACTIVE,
                ...(trigger === database_1.EmailAutomationTrigger.LIST_JOIN && listId ? { listId } : {}),
            },
        });
        if (!automations.length)
            return;
        const contact = await this.prisma.emailContact.findFirst({
            where: { id: contactId, organizationId },
        });
        if (!contact || contact.status !== database_1.EmailContactStatus.SUBSCRIBED)
            return;
        for (const automation of automations) {
            if (automation.action === database_1.EmailAutomationAction.SEND_EMAIL) {
                if (automation.listId) {
                    await this.ensureListMember(organizationId, automation.listId, contactId);
                }
                if (await this.shouldSkipWelcomeSend(organizationId, automation, contactId))
                    continue;
                if (!automation.templateId)
                    continue;
                await this.enqueueAutomationSend(organizationId, automation, contact.id, contact.email);
                continue;
            }
            if (automation.listId) {
                const inList = await this.contactInList(organizationId, automation.listId, contactId);
                if (!inList)
                    continue;
            }
            if (automation.action === database_1.EmailAutomationAction.ADD_LEAD_SCORE) {
                await this.applyLeadScore(organizationId, contactId, automation.scoreDelta);
            }
            else if (automation.action === database_1.EmailAutomationAction.SET_CRM_STAGE) {
                await this.applyCrmStage(organizationId, contactId, automation.targetStage);
            }
        }
    }
    async scheduleNotOpenFollowups(organizationId, recipientId) {
        if (!(await this.planAllowsEmailAutomation(organizationId)))
            return;
        const automations = await this.prisma.emailAutomation.findMany({
            where: {
                organizationId,
                trigger: database_1.EmailAutomationTrigger.EMAIL_NOT_OPENED,
                status: database_1.EmailAutomationStatus.ACTIVE,
                action: database_1.EmailAutomationAction.SEND_EMAIL,
            },
        });
        if (!automations.length)
            return;
        for (const automation of automations) {
            if (!automation.templateId)
                continue;
            await this.queue.enqueueNotOpenFollowup(organizationId, automation.id, recipientId, automation.waitDays);
        }
    }
    async enqueueAutomationSend(organizationId, automation, contactId, email) {
        if (!(await this.planAllowsEmailAutomation(organizationId)))
            return;
        if (!automation.templateId)
            return;
        const normalized = (0, email_marketing_util_1.normalizeEmail)(email);
        const contact = await this.prisma.emailContact.findFirst({
            where: { id: contactId, organizationId },
            select: { status: true },
        });
        if (contact && contact.status !== database_1.EmailContactStatus.SUBSCRIBED)
            return;
        const suppressed = await this.prisma.emailSuppression.findFirst({
            where: { organizationId, email: normalized },
        });
        if (suppressed)
            return;
        const campaign = await this.prisma.emailCampaign.create({
            data: {
                organizationId,
                name: `[Tự động] ${automation.name}`,
                templateId: automation.templateId,
                status: database_1.EmailCampaignStatus.RUNNING,
                startedAt: new Date(),
                totalRecipients: 1,
                queuedCount: 1,
            },
        });
        const recipient = await this.prisma.emailCampaignRecipient.create({
            data: {
                organizationId,
                campaignId: campaign.id,
                contactId,
                email: normalized,
                status: database_1.EmailRecipientStatus.QUEUED,
                queuedAt: new Date(),
            },
        });
        await this.queue.enqueueSend(organizationId, campaign.id, recipient.id, Math.max(0, automation.delayMinutes) * 60_000);
    }
    async generateEmailContent(organizationId, prompt) {
        if (!this.openAi.isConfigured()) {
            throw new common_1.ServiceUnavailableException('Chưa cấu hình AI. Liên hệ quản trị viên.');
        }
        return this.credit.runPaidFeature({
            organizationId,
            featureCode: shared_1.CREDIT_FEATURE_CODES.EMAIL_AI_SUBJECT,
            referenceId: `email.ai:${organizationId}:${(0, crypto_1.randomUUID)()}`,
            reason: 'email AI generate',
            fn: async (ctx) => {
                const raw = await this.openAi.chatCompletion({
                    messages: [
                        {
                            role: 'system',
                            content: `Bạn viết email marketing spa/clinic tiếng Việt, thân thiện, ngắn.
Chỉ trả JSON:
{"subject":"","previewText":"","heading":"","body":"","ctaLabel":"","ctaUrl":"","footer":""}
Quy tắc:
- subject tối đa 70 ký tự, previewText tối đa 90 ký tự.
- heading 1 câu, body 2-4 đoạn, có CTA rõ.
- Dùng {{firstName}}, {{email}}, {{company}} khi hợp lý (không bịa dữ liệu khách).
- ctaUrl luôn https://aibeego.com trừ khi mô tả nêu link khác.
- footer 1-2 dòng, không spam.`,
                        },
                        { role: 'user', content: prompt.trim() },
                    ],
                    temperature: 0.6,
                    maxTokens: 900,
                    timeoutMs: 45_000,
                });
                let parsed = {};
                try {
                    parsed = JSON.parse(extractJsonObject(raw));
                }
                catch {
                    parsed = {};
                }
                const str = (key, fallback) => {
                    const value = parsed[key];
                    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
                };
                return {
                    subject: str('subject', `Ưu đãi dành cho bạn`).slice(0, 90),
                    previewText: str('previewText', 'Mở email để xem ưu đãi trong tuần này.').slice(0, 120),
                    heading: str('heading', 'Xin chào {{firstName}},'),
                    body: str('body', `Cảm ơn bạn đã quan tâm. Chúng tôi dành một ưu đãi ngắn cho {{firstName}} tại {{company}}.\n\n${prompt.trim()}`),
                    ctaLabel: str('ctaLabel', 'Đặt lịch ngay'),
                    ctaUrl: str('ctaUrl', 'https://aibeego.com'),
                    footer: str('footer', 'Bạn nhận email này vì đã để lại thông tin liên hệ.\n{{company}}'),
                };
            },
        });
    }
    async sendTestEmail(dto, organizationId) {
        const to = (0, email_marketing_util_1.normalizeEmail)(dto.to);
        const health = (0, shared_2.getEmailProviderHealth)();
        const provider = (0, create_1.createEmailProvider)({ purpose: 'marketing' });
        if (!provider.isConfigured()) {
            if (health.marketing === 'ses' || health.resolved === 'ses') {
                throw new common_1.BadRequestException((0, shared_2.sesNotConfiguredMessage)());
            }
            if (health.marketing === 'brevo') {
                throw new common_1.BadRequestException('Chưa cấu hình Brevo (BREVO_API_KEY, BREVO_FROM_EMAIL).');
            }
            throw new common_1.BadRequestException('Chưa cấu hình SMTP (SMTP_HOST, SMTP_USER, SMTP_PASS).');
        }
        const vars = {
            firstName: 'An',
            name: 'Nguyễn An',
            email: to,
            company: 'Spa An Nhiên',
        };
        const subject = (0, email_marketing_util_1.renderEmailMerge)(dto.subject, vars);
        const html = (0, email_marketing_util_1.renderEmailMerge)(dto.htmlBody, vars);
        const text = dto.previewText?.trim() ||
            `${subject}\n\nĐây là email thử. Biến mẫu: ${vars.firstName} / ${vars.email} / ${vars.company}`;
        const from = provider.name === 'ses'
            ? (0, shared_2.sesFromEmail)()
            : (process.env.SMTP_FROM || '').trim() ||
                `Ai Bee Go <${(process.env.SMTP_USER || 'noreply@aibeego.com').trim()}>`;
        try {
            await this.credit.runPaidFeature({ organizationId, featureCode: 'email.send',
                referenceId: `email.test:${(0, crypto_1.randomUUID)()}`, fn: async (context) => {
                    const result = await provider.send({
                        to,
                        from,
                        subject: `[Thử] ${subject}`,
                        html,
                        text,
                    });
                    context.markProviderStarted();
                    return result;
                } });
        }
        catch (err) {
            throw new common_1.BadRequestException((0, shared_2.formatEmailSendError)(err, provider.name));
        }
        return { ok: true, to, provider: provider.name };
    }
    async handleSesEvent(input, opts) {
        const auth = await (0, ses_webhook_security_1.authenticateSesWebhook)(input, opts);
        if (!auth.ok) {
            return { ok: false, reason: auth.reason, statusCode: auth.statusCode };
        }
        const event = auth.event;
        if (event.kind === 'sns_confirm') {
            if (event.subscribeUrl && (0, ses_webhook_util_1.isAllowedSnsSubscribeUrl)(event.subscribeUrl)) {
                await fetch(event.subscribeUrl, { method: 'GET' });
                return { ok: true, subscribed: true };
            }
            return { ok: false, reason: 'invalid_subscribe_url', statusCode: 403 };
        }
        if (event.kind === 'ignored')
            return { ok: true, ignored: true, type: event.rawType };
        const recipients = await this.findRecipientsForSesEvent({
            messageId: event.messageId,
            recipientIds: event.recipientIds,
            campaignIds: event.campaignIds,
            emails: event.emails,
        });
        let updated = 0;
        for (const recipient of recipients) {
            const changed = await this.applySesEventToRecipient(recipient, event);
            if (changed)
                updated += 1;
        }
        const suppressKind = event.kind === 'bounce' || event.kind === 'complaint' || event.kind === 'unsubscribe'
            ? event.kind
            : null;
        let suppressed = 0;
        if (suppressKind) {
            suppressed = await this.suppressSesEmails(event.campaignIds, event.emails, recipients.map((r) => r.email), suppressKind);
        }
        return { ok: true, type: event.kind, updated, suppressed };
    }
    async applySesEventToRecipient(recipient, event) {
        if (event.messageId && !recipient.providerMessageId) {
            await this.prisma.emailCampaignRecipient.update({
                where: { id: recipient.id },
                data: { providerMessageId: event.messageId },
            });
        }
        if (event.kind === 'send') {
            return this.ensureUniqueEvent(recipient, database_1.EmailEventType.SENT, {
                source: 'ses',
                messageId: event.messageId ?? null,
            });
        }
        if (event.kind === 'delivery') {
            if (recipient.deliveredAt)
                return false;
            if (recipient.status === database_1.EmailRecipientStatus.BOUNCED ||
                recipient.status === database_1.EmailRecipientStatus.FAILED ||
                recipient.status === database_1.EmailRecipientStatus.UNSUBSCRIBED) {
                return false;
            }
            await this.prisma.$transaction([
                this.prisma.emailCampaignRecipient.update({
                    where: { id: recipient.id },
                    data: {
                        deliveredAt: new Date(),
                        status: recipient.status === database_1.EmailRecipientStatus.OPENED ||
                            recipient.status === database_1.EmailRecipientStatus.CLICKED
                            ? recipient.status
                            : database_1.EmailRecipientStatus.DELIVERED,
                    },
                }),
                this.prisma.emailEvent.create({
                    data: {
                        organizationId: recipient.organizationId,
                        campaignId: recipient.campaignId,
                        recipientId: recipient.id,
                        contactId: recipient.contactId,
                        type: database_1.EmailEventType.DELIVERED,
                        metadata: { messageId: event.messageId ?? null },
                    },
                }),
                this.prisma.emailCampaign.update({
                    where: { id: recipient.campaignId },
                    data: { deliveredCount: { increment: 1 } },
                }),
            ]);
            return true;
        }
        if (event.kind === 'open') {
            return this.trackOpen(recipient.id);
        }
        if (event.kind === 'click') {
            const before = recipient.clickedAt;
            await this.trackClick(recipient.id, event.link);
            return !before;
        }
        if (event.kind === 'bounce' || event.kind === 'complaint') {
            return this.applyBounceOrComplaint(recipient, event.kind, event.messageId, event.permanent);
        }
        if (event.kind === 'unsubscribe') {
            const result = await this.unsubscribeByRecipient(recipient.id);
            return !result.already;
        }
        return false;
    }
    async applyBounceOrComplaint(recipient, kind, messageId, permanent) {
        const reason = kind === 'complaint' ? database_1.EmailSuppressionReason.COMPLAINT : database_1.EmailSuppressionReason.BOUNCE;
        await this.upsertSuppression(recipient.organizationId, recipient.email, reason);
        await this.markContactDoNotEmail(recipient.organizationId, recipient.contactId, kind === 'complaint' ? database_1.EmailContactStatus.UNSUBSCRIBED : database_1.EmailContactStatus.BOUNCED);
        if (recipient.status === database_1.EmailRecipientStatus.BOUNCED && kind === 'bounce')
            return false;
        if (recipient.status === database_1.EmailRecipientStatus.UNSUBSCRIBED && kind === 'complaint') {
            await this.ensureUniqueEvent(recipient, database_1.EmailEventType.COMPLAINT, {
                messageId: messageId ?? null,
                permanent: true,
            });
            return false;
        }
        const alreadyBounced = recipient.status === database_1.EmailRecipientStatus.BOUNCED;
        if (!alreadyBounced) {
            await this.prisma.emailCampaignRecipient.update({
                where: { id: recipient.id },
                data: {
                    status: database_1.EmailRecipientStatus.BOUNCED,
                    bouncedAt: new Date(),
                    lastError: kind === 'complaint' ? 'ses_complaint' : 'ses_bounce',
                },
            });
        }
        const created = await this.ensureUniqueEvent(recipient, kind === 'complaint' ? database_1.EmailEventType.COMPLAINT : database_1.EmailEventType.BOUNCE, { messageId: messageId ?? null, permanent: permanent ?? true });
        if (created && !alreadyBounced) {
            await this.prisma.emailCampaign.update({
                where: { id: recipient.campaignId },
                data: { bounceCount: { increment: 1 } },
            });
        }
        return created || !alreadyBounced;
    }
    async suppressSesEmails(campaignIds, emails, alreadyHandled, kind) {
        const remaining = (emails ?? []).filter((email) => !alreadyHandled.map((e) => e.toLowerCase()).includes(email.toLowerCase()));
        if (!remaining.length || !campaignIds?.length)
            return 0;
        const campaigns = await this.prisma.emailCampaign.findMany({
            where: { id: { in: campaignIds } },
            select: { id: true, organizationId: true },
        });
        if (!campaigns.length)
            return 0;
        const campaignOrgById = new Map(campaigns.map((c) => [c.id, c.organizationId]));
        const reason = kind === 'complaint'
            ? database_1.EmailSuppressionReason.COMPLAINT
            : kind === 'unsubscribe'
                ? database_1.EmailSuppressionReason.UNSUBSCRIBE
                : database_1.EmailSuppressionReason.BOUNCE;
        const contactStatus = kind === 'bounce' ? database_1.EmailContactStatus.BOUNCED : database_1.EmailContactStatus.UNSUBSCRIBED;
        let count = 0;
        for (const campaignId of campaignIds) {
            const organizationId = campaignOrgById.get(campaignId);
            if (!organizationId)
                continue;
            for (const email of remaining) {
                await this.upsertSuppression(organizationId, email, reason);
                const contact = await this.prisma.emailContact.findFirst({
                    where: { organizationId, email },
                    select: { id: true, status: true },
                });
                if (contact) {
                    await this.markContactDoNotEmail(organizationId, contact.id, contactStatus);
                }
                count += 1;
            }
        }
        return count;
    }
    async markContactDoNotEmail(organizationId, contactId, status) {
        const contact = await this.prisma.emailContact.findFirst({
            where: { id: contactId, organizationId },
            select: { status: true },
        });
        if (!contact)
            return;
        if (contact.status === database_1.EmailContactStatus.UNSUBSCRIBED)
            return;
        await this.prisma.emailContact.update({
            where: { id: contactId },
            data: {
                status,
                unsubscribedAt: status === database_1.EmailContactStatus.UNSUBSCRIBED ? new Date() : undefined,
            },
        });
    }
    async upsertSuppression(organizationId, email, reason) {
        const normalized = (0, email_marketing_util_1.normalizeEmail)(email);
        const existing = await this.prisma.emailSuppression.findUnique({
            where: { organizationId_email: { organizationId, email: normalized } },
        });
        if (!existing) {
            await this.prisma.emailSuppression.create({
                data: { organizationId, email: normalized, reason },
            });
            return;
        }
        if (suppressionRank(reason) > suppressionRank(existing.reason)) {
            await this.prisma.emailSuppression.update({
                where: { id: existing.id },
                data: { reason },
            });
        }
    }
    async ensureUniqueEvent(recipient, type, metadata) {
        const exists = await this.prisma.emailEvent.findFirst({
            where: { recipientId: recipient.id, type },
            select: { id: true },
        });
        if (exists)
            return false;
        await this.prisma.emailEvent.create({
            data: {
                organizationId: recipient.organizationId,
                campaignId: recipient.campaignId,
                recipientId: recipient.id,
                contactId: recipient.contactId,
                type,
                metadata: metadata ?? {},
            },
        });
        return true;
    }
    async findRecipientsForSesEvent(input) {
        const tagCampaignIds = [...new Set((input.campaignIds ?? []).map((id) => id.trim()).filter(Boolean))];
        const campaigns = tagCampaignIds.length
            ? await this.prisma.emailCampaign.findMany({
                where: { id: { in: tagCampaignIds } },
                select: { id: true, organizationId: true },
            })
            : [];
        const campaignById = new Map(campaigns.map((c) => [c.id, c]));
        const validCampaignIds = campaigns.map((c) => c.id);
        const organizationIds = [...new Set(campaigns.map((c) => c.organizationId))];
        const tagRecipientIds = [...new Set((input.recipientIds ?? []).map((id) => id.trim()).filter(Boolean))];
        if (tagRecipientIds.length) {
            if (!validCampaignIds.length)
                return [];
            const rows = await this.prisma.emailCampaignRecipient.findMany({
                where: {
                    id: { in: tagRecipientIds },
                    campaignId: { in: validCampaignIds },
                    organizationId: { in: organizationIds },
                },
            });
            return rows.filter((row) => {
                const campaign = campaignById.get(row.campaignId);
                if (!campaign)
                    return false;
                if (row.organizationId !== campaign.organizationId)
                    return false;
                if (tagCampaignIds.length && !tagCampaignIds.includes(row.campaignId))
                    return false;
                return true;
            });
        }
        if (input.messageId) {
            const where = {
                providerMessageId: input.messageId,
            };
            if (organizationIds.length === 1) {
                where.organizationId = organizationIds[0];
            }
            else if (organizationIds.length > 1) {
                where.organizationId = { in: organizationIds };
            }
            if (validCampaignIds.length) {
                where.campaignId = { in: validCampaignIds };
            }
            const byId = await this.prisma.emailCampaignRecipient.findMany({ where });
            if (byId.length) {
                return byId.filter((row) => {
                    if (validCampaignIds.length && !validCampaignIds.includes(row.campaignId))
                        return false;
                    const campaign = campaignById.get(row.campaignId);
                    if (campaign && row.organizationId !== campaign.organizationId)
                        return false;
                    return true;
                });
            }
        }
        const cleaned = (input.emails || []).map((e) => e.trim().toLowerCase()).filter(Boolean);
        if (cleaned.length && validCampaignIds.length) {
            const rows = await this.prisma.emailCampaignRecipient.findMany({
                where: {
                    campaignId: { in: validCampaignIds },
                    organizationId: { in: organizationIds },
                    email: { in: cleaned },
                },
                orderBy: { createdAt: 'desc' },
                take: 50,
            });
            return rows.filter((row) => {
                const campaign = campaignById.get(row.campaignId);
                return campaign ? row.organizationId === campaign.organizationId : false;
            });
        }
        return [];
    }
};
exports.EmailMarketingService = EmailMarketingService;
exports.EmailMarketingService = EmailMarketingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        email_marketing_queue_service_1.EmailMarketingQueueService,
        openai_service_1.OpenAiService,
        credit_service_1.CreditService])
], EmailMarketingService);
/** Resolve contacts for a campaign list/segment (used by worker via duplicated query). */
function segmentWhere(organizationId, rules) {
    const where = { organizationId };
    if (rules.status)
        where.status = rules.status;
    else
        where.status = database_1.EmailContactStatus.SUBSCRIBED;
    if (rules.listId) {
        where.listMembers = { some: { listId: rules.listId, organizationId } };
    }
    return where;
}
function parseDkimRecords(value) {
    if (!Array.isArray(value))
        return [];
    const out = [];
    for (const item of value) {
        if (!item || typeof item !== 'object' || Array.isArray(item))
            continue;
        const host = typeof item.host === 'string' ? item.host : '';
        const recValue = typeof item.value === 'string' ? item.value : '';
        if (host && recValue)
            out.push({ host, value: recValue });
    }
    return out;
}
function suppressionRank(reason) {
    if (reason === database_1.EmailSuppressionReason.COMPLAINT)
        return 3;
    if (reason === database_1.EmailSuppressionReason.UNSUBSCRIBE)
        return 2;
    if (reason === database_1.EmailSuppressionReason.BOUNCE)
        return 1;
    return 0;
}
function withCampaignRates(row) {
    const sent = row.sentCount || 0;
    const pct = (n) => (sent > 0 ? Math.round((n / sent) * 1000) / 10 : 0);
    return {
        ...row,
        openRate: pct(row.openCount),
        clickRate: pct(row.clickCount),
        bounceRate: pct(row.bounceCount),
        unsubscribeRate: pct(row.unsubscribeCount),
    };
}
function extractJsonObject(text) {
    const trimmed = text.trim();
    if (trimmed.startsWith('{'))
        return trimmed;
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence?.[1])
        return fence[1].trim();
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start)
        return trimmed.slice(start, end + 1);
    throw new Error('AI response is not JSON');
}
const database_2 = require("@marketingspa/database");
