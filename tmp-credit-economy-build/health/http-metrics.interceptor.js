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
exports.HttpMetricsInterceptor = void 0;
const common_1 = require("@nestjs/common");
const operators_1 = require("rxjs/operators");
const redis_constants_1 = require("../redis/redis.constants");
const SKIP = new Set(['/health', '/ready', '/api/v1/health', '/api/v1/ready']);
let HttpMetricsInterceptor = class HttpMetricsInterceptor {
    redis;
    constructor(redis) {
        this.redis = redis;
    }
    intercept(context, next) {
        const req = context.switchToHttp().getRequest();
        const path = (req.originalUrl || req.url || '').split('?')[0] || '';
        if (SKIP.has(path)) {
            return next.handle();
        }
        return next.handle().pipe((0, operators_1.finalize)(() => {
            const res = context.switchToHttp().getResponse();
            if (res.statusCode >= 500) {
                void this.bump5xx();
            }
        }));
    }
    async bump5xx() {
        const hour = new Date().toISOString().slice(0, 13).replace(/[-:T]/g, '');
        const key = `marketingspa:metrics:http5xx:${hour}`;
        try {
            await this.redis.incr(key);
            await this.redis.expire(key, 48 * 3600);
        }
        catch {
            /* metrics must never break requests */
        }
    }
};
exports.HttpMetricsInterceptor = HttpMetricsInterceptor;
exports.HttpMetricsInterceptor = HttpMetricsInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_constants_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [Function])
], HttpMetricsInterceptor);
