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
exports.CustomerJourneyService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../prisma/prisma.service");
const attribution_service_1 = require("../attribution/attribution.service");
let CustomerJourneyService = class CustomerJourneyService {
    prisma;
    attribution;
    constructor(prisma, attribution) {
        this.prisma = prisma;
        this.attribution = attribution;
    }
    async recordJourneyStep(params) {
        return this.attribution.recordFunnelEvent({
            organizationId: params.organizationId,
            leadId: params.leadId,
            funnelId: params.funnelId,
            eventType: params.eventType,
            idempotencyKey: params.idempotencyKey,
            metadata: params.metadata,
            occurredAt: params.occurredAt,
            amount: params.amount,
            appointmentId: params.appointmentId,
            orderId: params.orderId,
            paymentId: params.paymentId,
        });
    }
    async getLeadJourney(organizationId, leadId) {
        const lead = await this.prisma.lead.findFirst({
            where: { id: leadId, organizationId },
            select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                note: true,
                funnelRecommendationId: true,
                createdAt: true,
                pipelineStatus: true,
                qualification: true,
                attribution: true,
                funnelRecommendation: { select: { id: true, prompt: true, selectedSlug: true } },
            },
        });
        if (!lead)
            throw new common_1.NotFoundException('Lead không tồn tại');
        const funnelId = lead.funnelRecommendationId;
        const [funnelEvents, activities, conversations] = await Promise.all([
            this.prisma.marketingFunnelEvent.findMany({
                where: { organizationId, leadId },
                orderBy: { occurredAt: 'asc' },
            }),
            this.prisma.leadActivity.findMany({
                where: { organizationId, leadId },
                orderBy: { createdAt: 'asc' },
                take: 200,
            }),
            this.prisma.chatbotConversation.findMany({
                where: {
                    organizationId,
                    OR: [
                        { linkedLeadId: leadId },
                        ...(lead.phone ? [{ visitorPhone: { contains: lead.phone.slice(-9) } }] : []),
                    ],
                },
                orderBy: { createdAt: 'asc' },
                take: 20,
                select: {
                    id: true,
                    createdAt: true,
                    channel: true,
                    status: true,
                    linkedLeadId: true,
                    bot: { select: { botName: true } },
                },
            }),
        ]);
        const items = [];
        for (const ev of funnelEvents) {
            const kind = (0, shared_1.funnelEventTypeToJourneyKind)(ev.eventType);
            if (!kind)
                continue;
            items.push({
                id: ev.id,
                kind,
                label: (0, shared_1.journeyStepLabel)(kind),
                title: this.titleForKind(kind, ev.metadata),
                occurredAt: ev.occurredAt.toISOString(),
                organizationId: ev.organizationId,
                funnelId: ev.funnelId ?? funnelId,
                leadId: ev.leadId,
                source: 'funnel_event',
                dedupeKey: `${kind}:funnel_event:${ev.idempotencyKey}`,
                metadata: {
                    eventType: ev.eventType,
                    amount: ev.amount != null ? Number(ev.amount) : undefined,
                    ...ev.metadata,
                },
            });
        }
        if (lead.attribution) {
            const first = lead.attribution.firstTouchJson;
            const touchAt = first?.capturedAt
                ? new Date(first.capturedAt)
                : lead.attribution.createdAt;
            const hasClick = first?.fbclid ||
                first?.gclid ||
                lead.attribution.fbclid ||
                lead.attribution.gclid ||
                lead.attribution.adCampaignId;
            if (hasClick) {
                items.push({
                    id: `attr-${lead.id}`,
                    kind: 'AD_CLICK',
                    label: (0, shared_1.journeyStepLabel)('AD_CLICK'),
                    title: 'Click quảng cáo',
                    occurredAt: touchAt.toISOString(),
                    organizationId,
                    funnelId,
                    leadId: lead.id,
                    source: 'attribution',
                    dedupeKey: `AD_CLICK:attribution:${lead.id}`,
                    metadata: {
                        utmSource: first?.utmSource ?? lead.attribution.utmSource,
                        utmCampaign: first?.utmCampaign ?? lead.attribution.utmCampaign,
                        fbclid: first?.fbclid ?? lead.attribution.fbclid,
                        gclid: first?.gclid ?? lead.attribution.gclid,
                        adCampaignId: first?.adCampaignId ?? lead.attribution.adCampaignId,
                        landingPage: first?.landingPage ?? lead.attribution.landingPage,
                        referrer: first?.referrer ?? lead.attribution.referrer,
                    },
                });
            }
        }
        for (const act of activities) {
            const kind = (0, shared_1.activityActionToJourneyKind)(act.action, act.metadata);
            if (!kind)
                continue;
            items.push({
                id: act.id,
                kind,
                label: (0, shared_1.journeyStepLabel)(kind),
                title: this.titleForActivity(act.action, act.fromValue, act.toValue, act.metadata),
                occurredAt: act.createdAt.toISOString(),
                organizationId: act.organizationId,
                funnelId,
                leadId: act.leadId,
                source: 'activity',
                dedupeKey: `${kind}:activity:${act.action}:${act.id}`,
                metadata: {
                    action: act.action,
                    fromValue: act.fromValue,
                    toValue: act.toValue,
                    ...act.metadata,
                },
            });
        }
        for (const conv of conversations) {
            items.push({
                id: conv.id,
                kind: 'CHATBOT',
                label: (0, shared_1.journeyStepLabel)('CHATBOT'),
                title: `Chatbot ${conv.bot?.botName ?? conv.channel}`,
                occurredAt: conv.createdAt.toISOString(),
                organizationId,
                funnelId,
                leadId: lead.id,
                source: 'chatbot',
                dedupeKey: `CHATBOT:chatbot:${conv.id}`,
                metadata: { channel: conv.channel, status: conv.status },
            });
        }
        if (!items.some((i) => i.kind === 'LEAD')) {
            items.push({
                id: `lead-${lead.id}`,
                kind: 'LEAD',
                label: (0, shared_1.journeyStepLabel)('LEAD'),
                title: `Lead: ${lead.name}`,
                occurredAt: lead.createdAt.toISOString(),
                organizationId,
                funnelId,
                leadId: lead.id,
                source: 'activity',
                dedupeKey: `LEAD:lead:${lead.id}`,
                metadata: { pipelineStatus: lead.pipelineStatus },
            });
        }
        const timeline = (0, shared_1.mergeCustomerJourneyTimeline)(items);
        return {
            leadId: lead.id,
            leadName: lead.name,
            phone: lead.phone,
            email: lead.email,
            note: lead.note,
            organizationId,
            funnelId,
            funnel: lead.funnelRecommendation,
            timeline,
            stepsCompleted: [...new Set(timeline.map((t) => t.kind))],
        };
    }
    async getFunnelJourney(organizationId, funnelId, query) {
        const rec = await this.prisma.funnelRecommendation.findFirst({
            where: { id: funnelId, organizationId },
            select: { id: true, prompt: true, selectedSlug: true },
        });
        if (!rec)
            throw new common_1.NotFoundException('Funnel không tồn tại');
        if (query?.leadId) {
            const journey = await this.getLeadJourney(organizationId, query.leadId);
            const belongs = journey.funnelId === funnelId ||
                journey.timeline.some((t) => t.funnelId === funnelId);
            if (!belongs) {
                throw new common_1.NotFoundException('Lead không thuộc funnel này');
            }
            return journey;
        }
        const eventLeadRows = await this.prisma.marketingFunnelEvent.findMany({
            where: { organizationId, funnelId, leadId: { not: null } },
            select: { leadId: true },
        });
        const eventLeadIds = [
            ...new Set(eventLeadRows.map((r) => r.leadId).filter((id) => !!id)),
        ];
        const leads = await this.prisma.lead.findMany({
            where: {
                organizationId,
                OR: [
                    { funnelRecommendationId: funnelId },
                    ...(eventLeadIds.length ? [{ id: { in: eventLeadIds } }] : []),
                ],
            },
            orderBy: { createdAt: 'desc' },
            take: query?.limit ?? 20,
            select: {
                id: true,
                name: true,
                phone: true,
                email: true,
                note: true,
                createdAt: true,
                pipelineStatus: true,
            },
        });
        const summaries = await Promise.all(leads.map(async (l) => {
            const j = await this.getLeadJourney(organizationId, l.id);
            return {
                leadId: l.id,
                leadName: l.name,
                phone: l.phone,
                email: l.email,
                note: l.note,
                pipelineStatus: l.pipelineStatus,
                createdAt: l.createdAt.toISOString(),
                stepsCompleted: j.stepsCompleted,
                lastStep: j.timeline[j.timeline.length - 1] ?? null,
            };
        }));
        return { funnel: rec, leads: summaries };
    }
    titleForKind(kind, metadata) {
        switch (kind) {
            case 'AD_CLICK':
                return 'Click quảng cáo';
            case 'FORM_SUBMIT':
                return 'Gửi form';
            case 'CHATBOT':
                return 'Tương tác chatbot';
            case 'LEAD':
                return 'Lead được tạo';
            case 'STAGE_CHANGE':
                return metadata?.toStatus
                    ? `Chuyển stage → ${metadata.toStatus}`
                    : 'Đổi giai đoạn';
            case 'SALE':
                return metadata?.crossed ? `Đạt ${metadata.crossed}` : 'Qualified / Sale';
            case 'BOOKING':
                return 'Đặt lịch';
            case 'VISIT':
                return 'Khách đến spa';
            case 'PURCHASE':
                return metadata?.amount ? `Mua hàng (${metadata.amount})` : 'Mua dịch vụ';
            default:
                return (0, shared_1.journeyStepLabel)(kind);
        }
    }
    titleForActivity(action, fromValue, toValue, metadata) {
        const meta = metadata;
        if (action === 'FORM_SUBMITTED')
            return 'Gửi form funnel';
        if (action === 'STATUS_CHANGED')
            return `${fromValue ?? '?'} → ${toValue ?? '?'}`;
        if (action === 'SCORE_CHANGED' && meta?.crossed)
            return `Đạt ngưỡng ${meta.crossed}`;
        if (action === 'CHATBOT_REPLY')
            return 'Phản hồi chatbot';
        return action;
    }
};
exports.CustomerJourneyService = CustomerJourneyService;
exports.CustomerJourneyService = CustomerJourneyService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        attribution_service_1.AttributionService])
], CustomerJourneyService);
