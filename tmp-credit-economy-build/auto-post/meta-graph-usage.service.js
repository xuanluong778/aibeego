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
var MetaGraphUsageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaGraphUsageService = void 0;
const common_1 = require("@nestjs/common");
const redis_constants_1 = require("../redis/redis.constants");
const meta_redis_cache_1 = require("./meta-redis-cache");
const USAGE_KEY = 'meta:graph:usage:latest';
const THROTTLE_KEY = 'meta:graph:throttle:until';
/**
 * Theo dõi X-App-Usage / X-Page-Usage — giảm tác vụ nền khi gần limit.
 */
let MetaGraphUsageService = MetaGraphUsageService_1 = class MetaGraphUsageService {
    redis;
    logger = new common_1.Logger(MetaGraphUsageService_1.name);
    memory = null;
    throttleUntil = 0;
    constructor(redis) {
        this.redis = redis;
    }
    async record(usage) {
        if (!usage)
            return;
        this.memory = usage;
        if (usage.nearLimit) {
            this.throttleUntil = Date.now() + 60_000;
            this.logger.warn(`Meta usage near limit source=${usage.source} call=${usage.callCount}% cpu=${usage.totalCputime}% time=${usage.totalTime}% — throttle background 60s`);
        }
        await (0, meta_redis_cache_1.redisCacheSet)(this.redis, USAGE_KEY, usage, 300);
        if (usage.nearLimit) {
            await (0, meta_redis_cache_1.redisCacheSet)(this.redis, THROTTLE_KEY, { until: this.throttleUntil }, 90);
        }
    }
    async shouldThrottleBackground() {
        if (Date.now() < this.throttleUntil)
            return true;
        const fromRedis = await (0, meta_redis_cache_1.redisCacheGet)(this.redis, THROTTLE_KEY);
        if (fromRedis?.until && Date.now() < fromRedis.until) {
            this.throttleUntil = fromRedis.until;
            return true;
        }
        const usage = (await (0, meta_redis_cache_1.redisCacheGet)(this.redis, USAGE_KEY)) ?? this.memory;
        return Boolean(usage?.nearLimit);
    }
    getLatest() {
        return this.memory;
    }
};
exports.MetaGraphUsageService = MetaGraphUsageService;
exports.MetaGraphUsageService = MetaGraphUsageService = MetaGraphUsageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __param(0, (0, common_1.Inject)(redis_constants_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [Function])
], MetaGraphUsageService);
