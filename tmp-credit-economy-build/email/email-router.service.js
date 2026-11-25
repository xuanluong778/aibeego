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
var EmailRouterService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailRouterService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@marketingspa/shared");
const create_1 = require("@marketingspa/shared/dist/email-providers/create");
const prisma_service_1 = require("../prisma/prisma.service");
const database_1 = require("@marketingspa/database");
/**
 * Gửi email qua router SES/Brevo + ghi EmailOutboundMessage (multi-tenant, idempotent).
 * Không log API key/secret.
 */
let EmailRouterService = EmailRouterService_1 = class EmailRouterService {
    prisma;
    logger = new common_1.Logger(EmailRouterService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async send(input) {
        const existing = await this.prisma.emailOutboundMessage.findUnique({
            where: {
                organizationId_idempotencyKey: {
                    organizationId: input.organizationId,
                    idempotencyKey: input.idempotencyKey,
                },
            },
        });
        if (existing?.status === 'SENT' && existing.providerMessageId) {
            return {
                provider: existing.provider || 'ses',
                messageId: existing.providerMessageId,
                deduped: true,
            };
        }
        const row = existing ||
            (await this.prisma.emailOutboundMessage.create({
                data: {
                    organizationId: input.organizationId,
                    purpose: input.purpose,
                    toEmail: input.to.toLowerCase(),
                    subject: input.subject,
                    status: 'PENDING',
                    idempotencyKey: input.idempotencyKey,
                    metadata: (input.metadata || {}),
                },
            }));
        const provider = (0, create_1.createEmailProvider)({ purpose: input.purpose });
        if (input.purpose === 'marketing')
            await new database_1.PlanPolicy(this.prisma).consume(input.organizationId, 'emails', `routed:${input.idempotencyKey}`);
        const from = input.from || (0, shared_1.defaultFromForProvider)(provider.name);
        if (!from) {
            await this.prisma.emailOutboundMessage.update({
                where: { id: row.id },
                data: {
                    status: 'FAILED',
                    failedAt: new Date(),
                    lastError: 'missing_from_address',
                    provider: provider.name,
                },
            });
            throw new Error('missing_from_address');
        }
        const message = {
            to: input.to,
            from,
            replyTo: input.replyTo,
            subject: input.subject,
            html: input.html || `<pre>${escapeHtml(input.text)}</pre>`,
            text: input.text,
            tags: {
                purpose: input.purpose,
                organizationId: input.organizationId.slice(0, 32),
            },
        };
        try {
            const result = input.purpose === 'marketing'
                ? await new database_1.CreditLedger(this.prisma).runPaidFeature({ organizationId: input.organizationId,
                    featureCode: 'email.send', referenceId: `email.routed:${row.id}`,
                    fn: async (context) => { const sent = await provider.send(message); context.markProviderStarted(); return sent; },
                })
                : await provider.send(message);
            await this.prisma.emailOutboundMessage.update({
                where: { id: row.id },
                data: {
                    status: 'SENT',
                    provider: result.provider,
                    providerMessageId: result.messageId || null,
                    sentAt: new Date(),
                    failedAt: null,
                    lastError: null,
                },
            });
            this.logger.log(`[email:sent] purpose=${input.purpose} provider=${result.provider} org=${input.organizationId.slice(0, 8)}… to=${maskEmail(input.to)}`);
            return result;
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await this.prisma.emailOutboundMessage.update({
                where: { id: row.id },
                data: {
                    status: 'FAILED',
                    failedAt: new Date(),
                    lastError: msg.slice(0, 500),
                    provider: provider.name,
                },
            });
            this.logger.error(`[email:fail] purpose=${input.purpose} provider=${provider.name} org=${input.organizationId.slice(0, 8)}… ${msg.slice(0, 160)}`);
            throw err;
        }
    }
};
exports.EmailRouterService = EmailRouterService;
exports.EmailRouterService = EmailRouterService = EmailRouterService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], EmailRouterService);
function maskEmail(email) {
    const [u, d] = email.split('@');
    if (!d)
        return '•••';
    return `${(u || '').slice(0, 2)}…@${d}`;
}
function escapeHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
