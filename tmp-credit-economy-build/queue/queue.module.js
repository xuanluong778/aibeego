"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const rag_source_collect_1 = require("@marketingspa/shared/dist/rag-source-collect");
const bullmq_1 = require("bullmq");
const shared_1 = require("@marketingspa/shared");
const queue_constants_1 = require("./queue.constants");
function createQueueProvider(token, queueName) {
    return {
        provide: token,
        inject: [config_1.ConfigService],
        useFactory: (config) => {
            const prefix = config.get('QUEUE_PREFIX', 'marketingspa');
            const redisUrl = config.get('REDIS_URL', 'redis://localhost:6379');
            return new bullmq_1.Queue(queueName, {
                connection: { url: redisUrl, maxRetriesPerRequest: null },
                prefix,
                defaultJobOptions: {
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 2000 },
                    removeOnComplete: { ...shared_1.BULLMQ_JOB_RETENTION.complete },
                    removeOnFail: { ...shared_1.BULLMQ_JOB_RETENTION.fail },
                },
            });
        },
    };
}
let QueueModule = class QueueModule {
};
exports.QueueModule = QueueModule;
exports.QueueModule = QueueModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [
            createQueueProvider('RAG_SOURCE_QUEUE', rag_source_collect_1.RAG_SOURCE_QUEUE),
            createQueueProvider(queue_constants_1.CAMPAIGN_QUEUE, shared_1.QUEUE_NAMES.CAMPAIGN_SEND),
            createQueueProvider(queue_constants_1.LEAD_ALERT_QUEUE, shared_1.QUEUE_NAMES.LEAD_ALERT),
            createQueueProvider(queue_constants_1.APPOINTMENT_REMINDER_QUEUE, shared_1.QUEUE_NAMES.APPOINTMENT_REMINDER),
            createQueueProvider(queue_constants_1.AUTOMATION_MESSAGE_QUEUE, shared_1.QUEUE_NAMES.AUTOMATION_MESSAGE),
            createQueueProvider(queue_constants_1.DAILY_REPORT_QUEUE, shared_1.QUEUE_NAMES.DAILY_REPORT),
            createQueueProvider(queue_constants_1.BACKUP_QUEUE, shared_1.QUEUE_NAMES.BACKUP),
            createQueueProvider(queue_constants_1.AUTO_POST_QUEUE, shared_1.QUEUE_NAMES.AUTO_POST_PUBLISH),
            createQueueProvider(queue_constants_1.HRM_ATTENDANCE_REBUILD_QUEUE, shared_1.QUEUE_NAMES.HRM_ATTENDANCE_REBUILD),
            createQueueProvider(queue_constants_1.OFFLINE_CONVERSION_QUEUE, shared_1.QUEUE_NAMES.OFFLINE_CONVERSION),
            createQueueProvider(queue_constants_1.MESSAGING_WEBHOOK_QUEUE, shared_1.QUEUE_NAMES.MESSAGING_WEBHOOK),
            createQueueProvider(queue_constants_1.MESSAGING_CAMPAIGN_PLAN_QUEUE, shared_1.QUEUE_NAMES.MESSAGING_CAMPAIGN_PLAN),
            createQueueProvider(queue_constants_1.MESSAGING_CAMPAIGN_DISPATCH_QUEUE, shared_1.QUEUE_NAMES.MESSAGING_CAMPAIGN_DISPATCH),
            createQueueProvider(queue_constants_1.MESSAGING_SEND_QUEUE, shared_1.QUEUE_NAMES.MESSAGING_SEND),
            createQueueProvider(queue_constants_1.ADS_SYNC_QUEUE, shared_1.QUEUE_NAMES.ADS_SYNC),
            createQueueProvider(queue_constants_1.ADS_ACTION_QUEUE, shared_1.QUEUE_NAMES.ADS_ACTION),
            createQueueProvider(queue_constants_1.ADS_CAMPAIGN_DEPLOY_QUEUE, shared_1.QUEUE_NAMES.ADS_CAMPAIGN_DEPLOY),
            createQueueProvider(queue_constants_1.ADS_AUTOPILOT_QUEUE, shared_1.QUEUE_NAMES.ADS_AUTOPILOT),
            createQueueProvider(queue_constants_1.AFFILIATE_HOLD_QUEUE, shared_1.QUEUE_NAMES.AFFILIATE_HOLD),
            createQueueProvider(queue_constants_1.VIDEO_TRANSCRIPTION_QUEUE, shared_1.QUEUE_NAMES.VIDEO_TRANSCRIPTION),
            createQueueProvider(queue_constants_1.AD_URL_ANALYZE_QUEUE, shared_1.QUEUE_NAMES.AD_URL_ANALYZE),
            createQueueProvider(queue_constants_1.MARKETING_AUTOPILOT_OUTCOME_EVAL_QUEUE, shared_1.QUEUE_NAMES.MARKETING_AUTOPILOT_OUTCOME_EVAL),
            createQueueProvider(queue_constants_1.MARKETING_AUTOPILOT_MISSION_QUEUE, shared_1.QUEUE_NAMES.MARKETING_AUTOPILOT_MISSION),
            createQueueProvider(queue_constants_1.EMAIL_CAMPAIGN_PLAN_QUEUE, shared_1.QUEUE_NAMES.EMAIL_CAMPAIGN_PLAN),
            createQueueProvider(queue_constants_1.EMAIL_CAMPAIGN_SEND_QUEUE, shared_1.QUEUE_NAMES.EMAIL_CAMPAIGN_SEND),
            createQueueProvider(queue_constants_1.CUSTOMER_360_QUEUE, shared_1.QUEUE_NAMES.CUSTOMER_360_SYNC),
        ],
        exports: [
            'RAG_SOURCE_QUEUE',
            queue_constants_1.CAMPAIGN_QUEUE,
            queue_constants_1.LEAD_ALERT_QUEUE,
            queue_constants_1.APPOINTMENT_REMINDER_QUEUE,
            queue_constants_1.AUTOMATION_MESSAGE_QUEUE,
            queue_constants_1.DAILY_REPORT_QUEUE,
            queue_constants_1.BACKUP_QUEUE,
            queue_constants_1.AUTO_POST_QUEUE,
            queue_constants_1.HRM_ATTENDANCE_REBUILD_QUEUE,
            queue_constants_1.OFFLINE_CONVERSION_QUEUE,
            queue_constants_1.MESSAGING_WEBHOOK_QUEUE,
            queue_constants_1.MESSAGING_CAMPAIGN_PLAN_QUEUE,
            queue_constants_1.MESSAGING_CAMPAIGN_DISPATCH_QUEUE,
            queue_constants_1.MESSAGING_SEND_QUEUE,
            queue_constants_1.ADS_SYNC_QUEUE,
            queue_constants_1.ADS_ACTION_QUEUE,
            queue_constants_1.ADS_CAMPAIGN_DEPLOY_QUEUE,
            queue_constants_1.ADS_AUTOPILOT_QUEUE,
            queue_constants_1.AFFILIATE_HOLD_QUEUE,
            queue_constants_1.VIDEO_TRANSCRIPTION_QUEUE,
            queue_constants_1.AD_URL_ANALYZE_QUEUE,
            queue_constants_1.MARKETING_AUTOPILOT_OUTCOME_EVAL_QUEUE,
            queue_constants_1.MARKETING_AUTOPILOT_MISSION_QUEUE,
            queue_constants_1.EMAIL_CAMPAIGN_PLAN_QUEUE,
            queue_constants_1.EMAIL_CAMPAIGN_SEND_QUEUE,
            queue_constants_1.CUSTOMER_360_QUEUE,
        ],
    })
], QueueModule);
