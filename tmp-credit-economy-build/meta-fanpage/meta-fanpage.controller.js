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
exports.MetaFanpageController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permissions_guard_1 = require("../common/guards/permissions.guard");
const require_permissions_decorator_1 = require("../common/decorators/require-permissions.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const meta_fanpage_dto_1 = require("./dto/meta-fanpage.dto");
const meta_fanpage_service_1 = require("./meta-fanpage.service");
let MetaFanpageController = class MetaFanpageController {
    service;
    constructor(service) {
        this.service = service;
    }
    status() {
        return this.service.getStatus();
    }
    publish(user, dto) {
        return this.service.publishNow(user, dto);
    }
};
exports.MetaFanpageController = MetaFanpageController;
__decorate([
    (0, common_1.Get)('status'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], MetaFanpageController.prototype, "status", null);
__decorate([
    (0, common_1.Post)('posts'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.integration.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, meta_fanpage_dto_1.CreateMetaFanpagePostDto]),
    __metadata("design:returntype", void 0)
], MetaFanpageController.prototype, "publish", null);
exports.MetaFanpageController = MetaFanpageController = __decorate([
    (0, common_1.Controller)('meta-fanpage'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [meta_fanpage_service_1.MetaFanpageService])
], MetaFanpageController);
