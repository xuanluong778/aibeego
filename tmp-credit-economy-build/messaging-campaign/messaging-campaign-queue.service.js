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
exports.MessagingCampaignQueueService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@marketingspa/shared");
const queue_enqueue_service_1 = require("../common/services/queue-enqueue.service");
const queue_constants_1 = require("../queue/queue.constants");
const PLAN_OPTS = {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 500,
    removeOnFail: 2000,
};
const DISPATCH_OPTS = {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
};
const SEND_OPTS = {
    attempts: shared_1.MESSAGING_SEND_MAX_ATTEMPTS,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 10_000,
    removeOnFail: 50_000,
};
let MessagingCampaignQueueService = class MessagingCampaignQueueService {
    queueEnqueue;
    planQueue;
    dispatchQueue;
    sendQueue;
    constructor(queueEnqueue, planQueue, dispatchQueue, sendQueue) {
        this.queueEnqueue = queueEnqueue;
        this.planQueue = planQueue;
        this.dispatchQueue = dispatchQueue;
        this.sendQueue = sendQueue;
    }
    enqueuePlan(organizationId, campaignId) {
        return this.queueEnqueue.add(this.planQueue, 'plan-campaign', { organizationId, campaignId }, { ...PLAN_OPTS, jobId: (0, shared_1.buildCampaignPlanJobId)(campaignId) });
    }
    enqueueDispatch(organizationId, campaignId, cursor) {
        return this.queueEnqueue.add(this.dispatchQueue, 'dispatch-campaign', { organizationId, campaignId, cursor }, { ...DISPATCH_OPTS, jobId: (0, shared_1.buildCampaignDispatchJobId)(campaignId, cursor) });
    }
    enqueueSend(organizationId, campaignId, recipientId, idempotencyKey) {
        return this.queueEnqueue.add(this.sendQueue, 'send-message', { organizationId, campaignId, recipientId }, { ...SEND_OPTS, jobId: idempotencyKey });
    }
    buildRecipientJobId(campaignId, identityId) {
        return (0, shared_1.buildRecipientIdempotencyKey)(campaignId, identityId);
    }
};
exports.MessagingCampaignQueueService = MessagingCampaignQueueService;
exports.MessagingCampaignQueueService = MessagingCampaignQueueService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(queue_constants_1.MESSAGING_CAMPAIGN_PLAN_QUEUE)),
    __param(2, (0, common_1.Inject)(queue_constants_1.MESSAGING_CAMPAIGN_DISPATCH_QUEUE)),
    __param(3, (0, common_1.Inject)(queue_constants_1.MESSAGING_SEND_QUEUE)),
    __metadata("design:paramtypes", [queue_enqueue_service_1.QueueEnqueueService, Function, Function, Function])
], MessagingCampaignQueueService);
