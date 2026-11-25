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
var AttributionHooksService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttributionHooksService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const attribution_service_1 = require("./attribution.service");
const offline_conversion_service_1 = require("./offline-conversion.service");
let AttributionHooksService = AttributionHooksService_1 = class AttributionHooksService {
    attribution;
    offline;
    logger = new common_1.Logger(AttributionHooksService_1.name);
    constructor(attribution, offline) {
        this.attribution = attribution;
        this.offline = offline;
    }
    async onLeadCreated(organizationId, lead, attribution) {
        if (attribution) {
            try {
                await this.attribution.upsertLeadAttribution(organizationId, lead.id, attribution);
            }
            catch (err) {
                this.logger.warn(`attribution upsert failed: ${err instanceof Error ? err.message : err}`);
            }
        }
        const { event, created } = await this.attribution.recordFunnelEvent({
            organizationId,
            eventType: database_1.MarketingFunnelEventType.LEAD_CREATED,
            idempotencyKey: `LEAD_CREATED:${lead.id}`,
            leadId: lead.id,
            customerId: lead.customerId,
        });
        if (created) {
            const jobs = await this.attribution.enqueueOfflineConversions({
                organizationId,
                funnelEventId: event.id,
                leadId: lead.id,
                eventType: database_1.MarketingFunnelEventType.LEAD_CREATED,
                payload: {
                    event_name: 'Lead',
                    lead_id: lead.id,
                    phone: lead.phone,
                    email: lead.email,
                    gclid: attribution?.gclid,
                    fbclid: attribution?.fbclid,
                },
            });
            await this.offline.enqueuePendingJobs(organizationId, jobs.map((j) => j.id));
        }
    }
    async onLeadQualified(organizationId, leadId) {
        await this.attribution.recordFunnelEvent({
            organizationId,
            eventType: database_1.MarketingFunnelEventType.LEAD_QUALIFIED,
            idempotencyKey: `LEAD_QUALIFIED:${leadId}`,
            leadId,
        });
    }
    async onAppointmentChange(organizationId, appt, previousStatus) {
        const map = {
            [database_1.AppointmentStatus.SCHEDULED]: database_1.MarketingFunnelEventType.APPOINTMENT_BOOKED,
            [database_1.AppointmentStatus.CONFIRMED]: database_1.MarketingFunnelEventType.APPOINTMENT_CONFIRMED,
            [database_1.AppointmentStatus.ARRIVED]: database_1.MarketingFunnelEventType.CUSTOMER_ARRIVED,
            [database_1.AppointmentStatus.COMPLETED]: database_1.MarketingFunnelEventType.CUSTOMER_ARRIVED,
            [database_1.AppointmentStatus.CANCELLED]: database_1.MarketingFunnelEventType.APPOINTMENT_CANCELLED,
        };
        const eventType = map[appt.status];
        if (!eventType)
            return;
        if (previousStatus === appt.status)
            return;
        // One booked event per appointment (idempotent) — multiple appointments ≠ multiple leads
        const { event, created } = await this.attribution.recordFunnelEvent({
            organizationId,
            eventType,
            idempotencyKey: `${eventType}:${appt.id}`,
            leadId: appt.leadId,
            customerId: appt.customerId,
            appointmentId: appt.id,
            branchId: appt.branchId,
            employeeId: appt.employeeId,
            serviceId: appt.serviceId,
        });
        if (created &&
            (eventType === database_1.MarketingFunnelEventType.APPOINTMENT_BOOKED ||
                eventType === database_1.MarketingFunnelEventType.CUSTOMER_ARRIVED)) {
            const jobs = await this.attribution.enqueueOfflineConversions({
                organizationId,
                funnelEventId: event.id,
                leadId: appt.leadId,
                eventType,
                payload: {
                    event_name: eventType,
                    appointment_id: appt.id,
                    lead_id: appt.leadId,
                },
            });
            await this.offline.enqueuePendingJobs(organizationId, jobs.map((j) => j.id));
        }
    }
    async onPayment(organizationId, payment) {
        if (payment.status === database_1.PaymentStatus.COMPLETED) {
            const purchased = await this.attribution.recordFunnelEvent({
                organizationId,
                eventType: database_1.MarketingFunnelEventType.SERVICE_PURCHASED,
                idempotencyKey: `SERVICE_PURCHASED:${payment.orderId}`,
                leadId: payment.leadId,
                customerId: payment.customerId,
                orderId: payment.orderId,
                paymentId: payment.id,
                branchId: payment.branchId,
                serviceId: payment.serviceIds?.[0],
                amount: payment.amount,
            });
            const paid = await this.attribution.recordFunnelEvent({
                organizationId,
                eventType: database_1.MarketingFunnelEventType.PAYMENT_COMPLETED,
                idempotencyKey: `PAYMENT_COMPLETED:${payment.id}`,
                leadId: payment.leadId,
                customerId: payment.customerId,
                orderId: payment.orderId,
                paymentId: payment.id,
                branchId: payment.branchId,
                amount: payment.amount,
            });
            if (payment.isReturningCustomer) {
                await this.attribution.recordFunnelEvent({
                    organizationId,
                    eventType: database_1.MarketingFunnelEventType.CUSTOMER_RETURNED,
                    idempotencyKey: `CUSTOMER_RETURNED:${payment.orderId}`,
                    leadId: payment.leadId,
                    customerId: payment.customerId,
                    orderId: payment.orderId,
                    amount: payment.amount,
                });
            }
            if (paid.created) {
                const jobs = await this.attribution.enqueueOfflineConversions({
                    organizationId,
                    funnelEventId: paid.event.id,
                    leadId: payment.leadId,
                    eventType: database_1.MarketingFunnelEventType.PAYMENT_COMPLETED,
                    payload: {
                        event_name: 'Purchase',
                        value: payment.amount,
                        currency: 'VND',
                        order_id: payment.orderId,
                        payment_id: payment.id,
                        lead_id: payment.leadId,
                    },
                });
                await this.offline.enqueuePendingJobs(organizationId, jobs.map((j) => j.id));
            }
            return purchased;
        }
        if (payment.status === database_1.PaymentStatus.REFUNDED) {
            await this.attribution.recordFunnelEvent({
                organizationId,
                eventType: database_1.MarketingFunnelEventType.PAYMENT_REFUNDED,
                idempotencyKey: `PAYMENT_REFUNDED:${payment.id}`,
                leadId: payment.leadId,
                customerId: payment.customerId,
                orderId: payment.orderId,
                paymentId: payment.id,
                amount: payment.amount,
            });
        }
    }
    isQualifiedStatus(status) {
        const qualified = [
            database_1.LeadPipelineStatus.CONTACTED,
            database_1.LeadPipelineStatus.QUALIFIED,
            database_1.LeadPipelineStatus.BOOKED,
            database_1.LeadPipelineStatus.CONFIRMED,
            database_1.LeadPipelineStatus.VISITED,
            database_1.LeadPipelineStatus.PURCHASED,
        ];
        return qualified.includes(status);
    }
};
exports.AttributionHooksService = AttributionHooksService;
exports.AttributionHooksService = AttributionHooksService = AttributionHooksService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [attribution_service_1.AttributionService,
        offline_conversion_service_1.OfflineConversionService])
], AttributionHooksService);
