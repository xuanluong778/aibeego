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
exports.EmailMarketingQueueService = void 0;
const common_1 = require("@nestjs/common");
const queue_enqueue_service_1 = require("../common/services/queue-enqueue.service");
const queue_constants_1 = require("../queue/queue.constants");
const shared_1 = require("@marketingspa/shared");
const PLAN_OPTS = {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 500,
    removeOnFail: 2000,
};
const SEND_OPTS = {
    attempts: shared_1.EMAIL_SEND_ATTEMPTS,
    backoff: { type: 'exponential', delay: shared_1.EMAIL_SEND_BACKOFF_MS },
    removeOnComplete: 10_000,
    removeOnFail: 20_000,
};
let EmailMarketingQueueService = class EmailMarketingQueueService {
    queueEnqueue;
    planQueue;
    sendQueue;
    constructor(queueEnqueue, planQueue, sendQueue) {
        this.queueEnqueue = queueEnqueue;
        this.planQueue = planQueue;
        this.sendQueue = sendQueue;
    }
    enqueuePlan(organizationId, campaignId) {
        return this.queueEnqueue.add(this.planQueue, 'plan-email-campaign', { organizationId, campaignId }, { ...PLAN_OPTS, jobId: `email-plan-${campaignId}` });
    }
    enqueueSend(organizationId, campaignId, recipientId, delayMs = 0) {
        return this.queueEnqueue.add(this.sendQueue, 'send-email', { organizationId, campaignId, recipientIds: [recipientId] }, {
            ...SEND_OPTS,
            jobId: `email-send-${recipientId}`,
            delay: delayMs > 0 ? delayMs : undefined,
        });
    }
    enqueueNotOpenFollowup(organizationId, automationId, recipientId, waitDays) {
        const delayMs = Math.max(0, waitDays) * 86_400_000;
        return this.queueEnqueue.add(this.sendQueue, 'email-not-open-followup', { organizationId, automationId, recipientId }, {
            ...SEND_OPTS,
            jobId: `email-notopen-${automationId}-${recipientId}`,
            delay: delayMs > 0 ? delayMs : undefined,
        });
    }
};
exports.EmailMarketingQueueService = EmailMarketingQueueService;
exports.EmailMarketingQueueService = EmailMarketingQueueService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(queue_constants_1.EMAIL_CAMPAIGN_PLAN_QUEUE)),
    __param(2, (0, common_1.Inject)(queue_constants_1.EMAIL_CAMPAIGN_SEND_QUEUE)),
    __metadata("design:paramtypes", [queue_enqueue_service_1.QueueEnqueueService, Function, Function])
], EmailMarketingQueueService);
