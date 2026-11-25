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
exports.TenantKpiCacheService = void 0;
const common_1 = require("@nestjs/common");
const redis_constants_1 = require("../../redis/redis.constants");
const PREFIX = 'maaz:kpi';
let TenantKpiCacheService = class TenantKpiCacheService {
    redis;
    constructor(redis) {
        this.redis = redis;
    }
    async gen(organizationId) {
        if (!this.redis)
            return '0';
        try {
            const g = await this.redis.get(`${PREFIX}:${organizationId}:g`);
            return g || '0';
        }
        catch {
            return '0';
        }
    }
    async getJson(organizationId, name) {
        if (!this.redis)
            return null;
        try {
            const g = await this.gen(organizationId);
            const raw = await this.redis.get(`${PREFIX}:${organizationId}:${g}:${name}`);
            if (!raw)
                return null;
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    async setJson(organizationId, name, value, ttlSec) {
        if (!this.redis)
            return;
        try {
            const g = await this.gen(organizationId);
            await this.redis.set(`${PREFIX}:${organizationId}:${g}:${name}`, JSON.stringify(value), 'EX', ttlSec);
        }
        catch {
            /* fail-open */
        }
    }
    async bump(organizationId) {
        if (!this.redis)
            return;
        try {
            await this.redis.incr(`${PREFIX}:${organizationId}:g`);
        }
        catch {
            /* ignore */
        }
    }
};
exports.TenantKpiCacheService = TenantKpiCacheService;
exports.TenantKpiCacheService = TenantKpiCacheService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __param(0, (0, common_1.Inject)(redis_constants_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [Function])
], TenantKpiCacheService);
