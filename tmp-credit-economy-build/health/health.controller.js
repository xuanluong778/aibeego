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
exports.ReadyController = exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const health_service_1 = require("./health.service");
let HealthController = class HealthController {
    health;
    constructor(health) {
        this.health = health;
    }
    /** Process liveness — does not probe dependencies. */
    live() {
        return this.health.liveness();
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HealthController.prototype, "live", null);
exports.HealthController = HealthController = __decorate([
    (0, common_1.Controller)('health'),
    __metadata("design:paramtypes", [health_service_1.HealthService])
], HealthController);
let ReadyController = class ReadyController {
    health;
    constructor(health) {
        this.health = health;
    }
    /** PostgreSQL + Redis must be up. Worker is reported but not required for 200. */
    async ready(res) {
        const result = await this.health.readiness();
        if (!result.ok) {
            res.status(common_1.HttpStatus.SERVICE_UNAVAILABLE);
        }
        return result.body;
    }
};
exports.ReadyController = ReadyController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReadyController.prototype, "ready", null);
exports.ReadyController = ReadyController = __decorate([
    (0, common_1.Controller)('ready'),
    __metadata("design:paramtypes", [health_service_1.HealthService])
], ReadyController);
