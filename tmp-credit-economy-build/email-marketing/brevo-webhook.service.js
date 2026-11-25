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
var BrevoWebhookService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BrevoWebhookService = void 0;
const crypto_1 = require("crypto");
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../prisma/prisma.service");
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
function maskEmail(email) {
    if (!email)
        return '•••';
    const [u, d] = email.split('@');
    if (!d)
        return '•••';
    return `${(u || '').slice(0, 2)}…@${d}`;
}
/**
 * Brevo transactional webhook → EmailCampaignRecipient / EmailOutboundMessage / suppression.
 * Idempotent via EmailWebhookEvent.eventKey. Không log secret / full email.
 */
let BrevoWebhookService = BrevoWebhookService_1 = class BrevoWebhookService {
    prisma;
    logger = new common_1.Logger(BrevoWebhookService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    verifySecret(headerSecret) {
        const expected = (process.env.BREVO_WEBHOOK_SECRET || '').trim();
        if (!expected) {
            if ((process.env.BREVO_WEBHOOK_ALLOW_UNSIGNED || '').trim() === '1')
                return true;
            return false;
        }
        const provided = (headerSecret || '').trim();
        if (!provided)
            return false;
        const a = (0, crypto_1.createHash)('sha256').update(expected).digest();
        const b = (0, crypto_1.createHash)('sha256').update(provided).digest();
        return (0, crypto_1.timingSafeEqual)(a, b);
    }
    async handlePayload(body) {
        const items = (0, shared_1.flattenBrevoWebhookBodies)(body);
        let accepted = 0;
        let updated = 0;
        let suppressed = 0;
        let duplicates = 0;
        for (const item of items) {
            const event = (0, shared_1.parseBrevoWebhookPayload)(item);
            if (event.kind === 'ignored') {
                accepted += 1;
                continue;
            }
            accepted += 1;
            const result = await this.processOne(event);
            if (result.duplicate)
                duplicates += 1;
            else {
                updated += result.updated;
                suppressed += result.suppressed;
            }
        }
        this.logger.log(`[brevo-webhook] accepted=${accepted} updated=${updated} suppressed=${suppressed} dup=${duplicates}`);
        return { ok: true, accepted, updated, suppressed, duplicates };
    }
    async processOne(event) {
        try {
            await this.prisma.emailWebhookEvent.create({
                data: {
                    provider: 'brevo',
                    eventKey: event.eventKey,
                    eventKind: event.kind,
                    messageId: event.messageId,
                    recipientId: event.recipientId,
                    campaignId: event.campaignId,
                    metadata: {
                        rawEvent: event.rawEvent,
                        hasEmail: Boolean(event.email),
                        tagCount: event.tags.length,
                    },
                },
            });
        }
        catch (err) {
            if (err instanceof database_1.Prisma.PrismaClientKnownRequestError &&
                err.code === 'P2002') {
                return { duplicate: true, updated: 0, suppressed: 0 };
            }
            throw err;
        }
        const recipients = await this.findRecipients(event);
        let updated = 0;
        let suppressed = 0;
        let organizationId = null;
        for (const recipient of recipients) {
            organizationId = recipient.organizationId;
            const changed = await this.applyToRecipient(recipient, event);
            if (changed)
                updated += 1;
            if ((0, shared_1.brevoKindRequiresSuppression)(event.kind)) {
                await this.upsertSuppression(recipient.organizationId, recipient.email, this.suppressionReason(event.kind));
                suppressed += 1;
            }
        }
        // Also update outbound transactional/marketing log by message id
        await this.applyToOutbound(event);
        // Suppress even if no recipient row matched (org from campaign tag / outbound)
        if ((0, shared_1.brevoKindRequiresSuppression)(event.kind) && event.email) {
            if (!organizationId && event.campaignId) {
                const camp = await this.prisma.emailCampaign.findFirst({
                    where: { id: event.campaignId },
                    select: { organizationId: true },
                });
                organizationId = camp?.organizationId ?? null;
            }
            if (!organizationId && event.messageId) {
                const out = await this.prisma.emailOutboundMessage.findFirst({
                    where: { providerMessageId: { in: (0, shared_1.brevoMessageIdVariants)(event.messageId) } },
                    select: { organizationId: true },
                });
                organizationId = out?.organizationId ?? null;
            }
            if (organizationId) {
                await this.upsertSuppression(organizationId, event.email, this.suppressionReason(event.kind));
                suppressed += 1;
            }
        }
        if (organizationId) {
            await this.prisma.emailWebhookEvent.updateMany({
                where: { provider: 'brevo', eventKey: event.eventKey },
                data: { organizationId },
            });
        }
        return { duplicate: false, updated, suppressed };
    }
    suppressionReason(kind) {
        if (kind === 'complaint')
            return database_1.EmailSuppressionReason.COMPLAINT;
        if (kind === 'unsubscribed')
            return database_1.EmailSuppressionReason.UNSUBSCRIBE;
        return database_1.EmailSuppressionReason.BOUNCE;
    }
    async findRecipients(event) {
        if (event.recipientId) {
            const row = await this.prisma.emailCampaignRecipient.findFirst({
                where: {
                    id: event.recipientId,
                    ...(event.campaignId ? { campaignId: event.campaignId } : {}),
                },
            });
            if (row)
                return [row];
        }
        const variants = (0, shared_1.brevoMessageIdVariants)(event.messageId);
        if (variants.length) {
            const byMid = await this.prisma.emailCampaignRecipient.findMany({
                where: { providerMessageId: { in: variants } },
                take: 20,
            });
            if (byMid.length)
                return byMid;
        }
        if (event.email && event.campaignId) {
            return this.prisma.emailCampaignRecipient.findMany({
                where: {
                    campaignId: event.campaignId,
                    email: normalizeEmail(event.email),
                },
                orderBy: { createdAt: 'desc' },
                take: 5,
            });
        }
        if (event.email) {
            // Recent SENT/DELIVERED for this email (narrow window) — last resort
            return this.prisma.emailCampaignRecipient.findMany({
                where: {
                    email: normalizeEmail(event.email),
                    status: {
                        in: [
                            database_1.EmailRecipientStatus.SENT,
                            database_1.EmailRecipientStatus.DELIVERED,
                            database_1.EmailRecipientStatus.OPENED,
                            database_1.EmailRecipientStatus.CLICKED,
                            database_1.EmailRecipientStatus.QUEUED,
                        ],
                    },
                    sentAt: { gte: new Date(Date.now() - 7 * 24 * 3600_000) },
                },
                orderBy: { sentAt: 'desc' },
                take: 3,
            });
        }
        return [];
    }
    async applyToRecipient(recipient, event) {
        if (event.messageId && !recipient.providerMessageId) {
            await this.prisma.emailCampaignRecipient.update({
                where: { id: recipient.id },
                data: { providerMessageId: event.messageId },
            });
        }
        const meta = {
            source: 'brevo_webhook',
            rawEvent: event.rawEvent,
            messageId: event.messageId,
        };
        if (event.kind === 'sent') {
            return this.ensureUniqueEvent(recipient, database_1.EmailEventType.SENT, meta);
        }
        if (event.kind === 'delivered') {
            if (recipient.deliveredAt)
                return false;
            if (recipient.status === database_1.EmailRecipientStatus.BOUNCED ||
                recipient.status === database_1.EmailRecipientStatus.FAILED ||
                recipient.status === database_1.EmailRecipientStatus.UNSUBSCRIBED) {
                return false;
            }
            const created = await this.ensureUniqueEvent(recipient, database_1.EmailEventType.DELIVERED, meta);
            if (!created && recipient.deliveredAt)
                return false;
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
                this.prisma.emailCampaign.update({
                    where: { id: recipient.campaignId },
                    data: { deliveredCount: { increment: created ? 1 : 0 } },
                }),
            ]);
            return true;
        }
        if (event.kind === 'opened') {
            if (recipient.openedAt)
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
                        openedAt: new Date(),
                        status: recipient.status === database_1.EmailRecipientStatus.CLICKED
                            ? recipient.status
                            : database_1.EmailRecipientStatus.OPENED,
                        deliveredAt: recipient.deliveredAt ?? new Date(),
                    },
                }),
                this.prisma.emailEvent.create({
                    data: {
                        organizationId: recipient.organizationId,
                        campaignId: recipient.campaignId,
                        recipientId: recipient.id,
                        contactId: recipient.contactId,
                        type: database_1.EmailEventType.OPEN,
                        metadata: meta,
                    },
                }),
                this.prisma.emailCampaign.update({
                    where: { id: recipient.campaignId },
                    data: { openCount: { increment: 1 } },
                }),
            ]);
            return true;
        }
        if (event.kind === 'clicked') {
            if (recipient.clickedAt)
                return false;
            await this.prisma.$transaction([
                this.prisma.emailCampaignRecipient.update({
                    where: { id: recipient.id },
                    data: {
                        clickedAt: new Date(),
                        openedAt: recipient.openedAt ?? new Date(),
                        deliveredAt: recipient.deliveredAt ?? new Date(),
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
                        metadata: { ...Object(meta), link: event.link },
                    },
                }),
                this.prisma.emailCampaign.update({
                    where: { id: recipient.campaignId },
                    data: { clickCount: { increment: 1 } },
                }),
            ]);
            return true;
        }
        if (event.kind === 'bounce_hard' ||
            event.kind === 'invalid' ||
            event.kind === 'complaint') {
            const isComplaint = event.kind === 'complaint';
            const already = recipient.status === database_1.EmailRecipientStatus.BOUNCED;
            if (!already) {
                await this.prisma.emailCampaignRecipient.update({
                    where: { id: recipient.id },
                    data: {
                        status: database_1.EmailRecipientStatus.BOUNCED,
                        bouncedAt: new Date(),
                        failedAt: new Date(),
                        lastError: `brevo_${event.kind}`,
                    },
                });
            }
            await this.markContact(recipient.organizationId, recipient.contactId, isComplaint ? database_1.EmailContactStatus.UNSUBSCRIBED : database_1.EmailContactStatus.BOUNCED);
            const created = await this.ensureUniqueEvent(recipient, isComplaint ? database_1.EmailEventType.COMPLAINT : database_1.EmailEventType.BOUNCE, meta);
            if (created && !already) {
                await this.prisma.emailCampaign.update({
                    where: { id: recipient.campaignId },
                    data: { bounceCount: { increment: 1 } },
                });
            }
            return created || !already;
        }
        if (event.kind === 'unsubscribed') {
            await this.prisma.emailCampaignRecipient.update({
                where: { id: recipient.id },
                data: { status: database_1.EmailRecipientStatus.UNSUBSCRIBED },
            });
            await this.markContact(recipient.organizationId, recipient.contactId, database_1.EmailContactStatus.UNSUBSCRIBED);
            const created = await this.ensureUniqueEvent(recipient, database_1.EmailEventType.UNSUBSCRIBE, meta);
            if (created) {
                await this.prisma.emailCampaign.update({
                    where: { id: recipient.campaignId },
                    data: { unsubscribeCount: { increment: 1 } },
                });
            }
            return created;
        }
        if (event.kind === 'bounce_soft' ||
            event.kind === 'blocked' ||
            event.kind === 'error' ||
            event.kind === 'deferred') {
            await this.prisma.emailCampaignRecipient.update({
                where: { id: recipient.id },
                data: {
                    lastError: `brevo_${event.kind}`,
                    ...(event.kind === 'error' || event.kind === 'blocked'
                        ? {
                            status: database_1.EmailRecipientStatus.FAILED,
                            failedAt: new Date(),
                        }
                        : {}),
                },
            });
            if (event.kind === 'error' || event.kind === 'blocked') {
                await this.ensureUniqueEvent(recipient, database_1.EmailEventType.FAILED, meta);
            }
            this.logger.warn(`[brevo-webhook] soft/fail kind=${event.kind} recipient=${recipient.id.slice(0, 8)}… to=${maskEmail(recipient.email)}`);
            return true;
        }
        return false;
    }
    async applyToOutbound(event) {
        const variants = (0, shared_1.brevoMessageIdVariants)(event.messageId);
        if (!variants.length)
            return;
        const rows = await this.prisma.emailOutboundMessage.findMany({
            where: { providerMessageId: { in: variants } },
            take: 5,
        });
        for (const row of rows) {
            if (event.kind === 'delivered' && !row.deliveredAt) {
                await this.prisma.emailOutboundMessage.update({
                    where: { id: row.id },
                    data: { status: 'DELIVERED', deliveredAt: new Date() },
                });
            }
            else if ((event.kind === 'bounce_hard' ||
                event.kind === 'invalid' ||
                event.kind === 'complaint' ||
                event.kind === 'error' ||
                event.kind === 'blocked') &&
                row.status !== 'FAILED') {
                await this.prisma.emailOutboundMessage.update({
                    where: { id: row.id },
                    data: {
                        status: 'FAILED',
                        failedAt: new Date(),
                        lastError: `brevo_${event.kind}`,
                    },
                });
            }
        }
    }
    async ensureUniqueEvent(recipient, type, metadata) {
        const exists = await this.prisma.emailEvent.findFirst({
            where: { recipientId: recipient.id, type },
            select: { id: true },
        });
        if (exists) {
            // Upgrade metadata source if webhook arrives after send-side SENT
            if (type === database_1.EmailEventType.DELIVERED || type === database_1.EmailEventType.OPEN) {
                return false;
            }
            return false;
        }
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
    async upsertSuppression(organizationId, email, reason) {
        const normalized = normalizeEmail(email);
        const existing = await this.prisma.emailSuppression.findUnique({
            where: { organizationId_email: { organizationId, email: normalized } },
        });
        if (!existing) {
            await this.prisma.emailSuppression.create({
                data: { organizationId, email: normalized, reason, note: 'brevo_webhook' },
            });
            return;
        }
        const rank = (r) => r === database_1.EmailSuppressionReason.COMPLAINT
            ? 3
            : r === database_1.EmailSuppressionReason.UNSUBSCRIBE
                ? 2
                : r === database_1.EmailSuppressionReason.BOUNCE
                    ? 1
                    : 0;
        if (rank(reason) > rank(existing.reason)) {
            await this.prisma.emailSuppression.update({
                where: { id: existing.id },
                data: { reason, note: 'brevo_webhook' },
            });
        }
    }
    async markContact(organizationId, contactId, status) {
        const contact = await this.prisma.emailContact.findFirst({
            where: { id: contactId, organizationId },
            select: { status: true },
        });
        if (!contact || contact.status === database_1.EmailContactStatus.UNSUBSCRIBED)
            return;
        await this.prisma.emailContact.update({
            where: { id: contactId },
            data: {
                status,
                unsubscribedAt: status === database_1.EmailContactStatus.UNSUBSCRIBED ? new Date() : undefined,
            },
        });
    }
};
exports.BrevoWebhookService = BrevoWebhookService;
exports.BrevoWebhookService = BrevoWebhookService = BrevoWebhookService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BrevoWebhookService);
