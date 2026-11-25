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
exports.HealthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const redis_constants_1 = require("../redis/redis.constants");
const WORKER_HEARTBEAT_KEY = 'marketingspa:worker:heartbeat';
async function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error('timeout')), ms);
        }),
    ]);
}
let HealthService = class HealthService {
    prisma;
    redis;
    constructor(prisma, redis) {
        this.prisma = prisma;
        this.redis = redis;
    }
    liveness() {
        return {
            status: 'ok',
            timestamp: new Date().toISOString(),
        };
    }
    async readiness() {
        let postgres = false;
        let redisOk = false;
        let worker = false;
        try {
            await withTimeout(this.prisma.$queryRaw `SELECT 1`, 2_000);
            postgres = true;
        }
        catch {
            postgres = false;
        }
        try {
            const pong = await withTimeout(this.redis.ping(), 2_000);
            redisOk = pong === 'PONG';
        }
        catch {
            redisOk = false;
        }
        if (redisOk) {
            try {
                const heartbeat = await this.redis.get(WORKER_HEARTBEAT_KEY);
                if (heartbeat) {
                    const ageMs = Date.now() - parseInt(heartbeat, 10);
                    worker = !Number.isNaN(ageMs) && ageMs < 120_000;
                }
            }
            catch {
                worker = false;
            }
        }
        const ok = postgres && redisOk;
        return {
            ok,
            body: {
                status: ok ? 'ready' : 'not_ready',
                timestamp: new Date().toISOString(),
                checks: {
                    postgres,
                    redis: redisOk,
                    worker,
                },
            },
        };
    }
};
exports.HealthService = HealthService;
exports.HealthService = HealthService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(redis_constants_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, Function])
], HealthService);
