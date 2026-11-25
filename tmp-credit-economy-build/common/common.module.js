"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommonModule = void 0;
const common_1 = require("@nestjs/common");
const tenant_ownership_service_1 = require("./services/tenant-ownership.service");
const rate_limit_service_1 = require("./services/rate-limit.service");
const queue_enqueue_service_1 = require("./services/queue-enqueue.service");
const tenant_kpi_cache_service_1 = require("./services/tenant-kpi-cache.service");
let CommonModule = class CommonModule {
};
exports.CommonModule = CommonModule;
exports.CommonModule = CommonModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        providers: [tenant_ownership_service_1.TenantOwnershipService, rate_limit_service_1.RateLimitService, queue_enqueue_service_1.QueueEnqueueService, tenant_kpi_cache_service_1.TenantKpiCacheService],
        exports: [tenant_ownership_service_1.TenantOwnershipService, rate_limit_service_1.RateLimitService, queue_enqueue_service_1.QueueEnqueueService, tenant_kpi_cache_service_1.TenantKpiCacheService],
    })
], CommonModule);
