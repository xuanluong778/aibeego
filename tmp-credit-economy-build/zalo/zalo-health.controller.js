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
exports.ZaloHealthController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const zalo_connections_service_1 = require("./zalo-connections.service");
let ZaloHealthController = class ZaloHealthController {
    service;
    constructor(service) {
        this.service = service;
    }
    /** Platform-wide Zalo OA health (no secrets). */
    platformHealth() {
        return this.service.health();
    }
    /** Org-scoped Zalo OA health for authenticated tenant. */
    orgHealth(user) {
        return this.service.health(user.organizationId);
    }
};
exports.ZaloHealthController = ZaloHealthController;
__decorate([
    (0, common_1.Get)('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ZaloHealthController.prototype, "platformHealth", null);
__decorate([
    (0, common_1.Get)('health/org'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ZaloHealthController.prototype, "orgHealth", null);
exports.ZaloHealthController = ZaloHealthController = __decorate([
    (0, common_1.Controller)('zalo'),
    __metadata("design:paramtypes", [zalo_connections_service_1.ZaloConnectionsService])
], ZaloHealthController);
