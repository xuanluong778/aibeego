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
var MetaGraphMetricsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaGraphMetricsService = void 0;
const common_1 = require("@nestjs/common");
const redis_constants_1 = require("../redis/redis.constants");
let MetaGraphMetricsService = MetaGraphMetricsService_1 = class MetaGraphMetricsService {
    redis;
    logger = new common_1.Logger(MetaGraphMetricsService_1.name);
    local = {
        graphRequestsByEndpoint: {},
        cacheHit: 0,
        cacheMiss: 0,
        singleFlightPrevented: 0,
        retries: 0,
        duplicatePublishPrevented: 0,
        rateLimitEvents: 0,
        updatedAt: new Date().toISOString(),
    };
    constructor(redis) {
        this.redis = redis;
    }
    touch() {
        this.local.updatedAt = new Date().toISOString();
    }
    async bumpRedis(field, by = 1) {
        if (!this.redis)
            return;
        try {
            await this.redis.hincrby('meta:graph:metrics', field, by);
        }
        catch {
            /* best-effort */
        }
    }
    /** endpoint dạng an toàn: page_metadata | published_posts | me_accounts | debug_token | feed | photos | other */
    graphRequest(endpoint) {
        const key = endpoint.replace(/[^a-z0-9_\-./]/gi, '_').slice(0, 64);
        this.local.graphRequestsByEndpoint[key] = (this.local.graphRequestsByEndpoint[key] ?? 0) + 1;
        this.touch();
        void this.bumpRedis(`graph:${key}`);
    }
    cacheHit() {
        this.local.cacheHit += 1;
        this.touch();
        void this.bumpRedis('cacheHit');
    }
    cacheMiss() {
        this.local.cacheMiss += 1;
        this.touch();
        void this.bumpRedis('cacheMiss');
    }
    singleFlightPrevented() {
        this.local.singleFlightPrevented += 1;
        this.touch();
        void this.bumpRedis('singleFlightPrevented');
    }
    retry() {
        this.local.retries += 1;
        this.touch();
        void this.bumpRedis('retries');
    }
    duplicatePublishPrevented() {
        this.local.duplicatePublishPrevented += 1;
        this.touch();
        void this.bumpRedis('duplicatePublishPrevented');
        this.logger.log('metric=duplicate_publish_prevented');
    }
    rateLimit() {
        this.local.rateLimitEvents += 1;
        this.touch();
        void this.bumpRedis('rateLimitEvents');
    }
    snapshot() {
        return {
            ...this.local,
            graphRequestsByEndpoint: { ...this.local.graphRequestsByEndpoint },
        };
    }
};
exports.MetaGraphMetricsService = MetaGraphMetricsService;
exports.MetaGraphMetricsService = MetaGraphMetricsService = MetaGraphMetricsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __param(0, (0, common_1.Inject)(redis_constants_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [Function])
], MetaGraphMetricsService);
