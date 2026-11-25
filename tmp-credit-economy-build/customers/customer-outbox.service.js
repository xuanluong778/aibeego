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
var CustomerOutboxService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomerOutboxService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("bullmq");
const database_1 = require("@marketingspa/database");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../prisma/prisma.service");
const queue_constants_1 = require("../queue/queue.constants");
let CustomerOutboxService = CustomerOutboxService_1 = class CustomerOutboxService {
    prisma;
    queue;
    logger = new common_1.Logger(CustomerOutboxService_1.name);
    constructor(prisma, queue) {
        this.prisma = prisma;
        this.queue = queue;
    }
    async enqueue(tx, input) {
        return (0, database_1.enqueueCustomerOutboxEvent)(tx, {
            organizationId: input.organizationId,
            customerId: input.customerId,
            eventType: input.eventType,
            idempotencyKey: (0, shared_1.customerOutboxIdempotencyKey)(input.eventType, input.idempotencyParts),
            payload: input.payload ?? {},
        });
    }
    async dispatch(outboxIds) {
        const ids = [...new Set(outboxIds.filter((id) => Boolean(id)))];
        for (const id of ids) {
            try {
                await this.queue.add('project', { outboxId: id }, {
                    jobId: (0, shared_1.customerOutboxJobId)(id),
                    attempts: 8,
                    backoff: { type: 'exponential', delay: 2000 },
                    removeOnComplete: 200,
                    removeOnFail: 100,
                });
            }
            catch (err) {
                this.logger.warn(`Outbox enqueue BullMQ failed for ${id}: ${err instanceof Error ? err.message : err}`);
            }
        }
    }
    events() {
        return shared_1.CUSTOMER_360_EVENTS;
    }
};
exports.CustomerOutboxService = CustomerOutboxService;
exports.CustomerOutboxService = CustomerOutboxService = CustomerOutboxService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(queue_constants_1.CUSTOMER_360_QUEUE)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        bullmq_1.Queue])
], CustomerOutboxService);
