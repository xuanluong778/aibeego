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
exports.MarketingContextCacheService = void 0;
const common_1 = require("@nestjs/common");
const redis_constants_1 = require("../../redis/redis.constants");
const CACHE_TTL_SEC = 120;
let MarketingContextCacheService = class MarketingContextCacheService {
    redis;
    constructor(redis) {
        this.redis = redis;
    }
    key(organizationId) {
        return `mce:snapshot:${organizationId}`;
    }
    async get(organizationId) {
        try {
            const raw = await this.redis.get(this.key(organizationId));
            if (!raw)
                return null;
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    async set(organizationId, payload) {
        try {
            await this.redis.set(this.key(organizationId), JSON.stringify(payload), 'EX', CACHE_TTL_SEC);
        }
        catch {
            /* fail-soft: cache optional */
        }
    }
    async invalidate(organizationId) {
        try {
            await this.redis.del(this.key(organizationId));
        }
        catch {
            /* ignore */
        }
    }
    getTtlSeconds() {
        return CACHE_TTL_SEC;
    }
};
exports.MarketingContextCacheService = MarketingContextCacheService;
exports.MarketingContextCacheService = MarketingContextCacheService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_constants_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [Function])
], MarketingContextCacheService);
