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
exports.AdsActionController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permissions_guard_1 = require("../common/guards/permissions.guard");
const require_permissions_decorator_1 = require("../common/decorators/require-permissions.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const ads_action_service_1 = require("./ads-action.service");
const ads_action_dto_1 = require("./dto/ads-action.dto");
let AdsActionController = class AdsActionController {
    service;
    constructor(service) {
        this.service = service;
    }
    list(user, status, limit) {
        return this.service.list(user, status, limit ? Number(limit) : 40);
    }
    get(user, id) {
        return this.service.get(user, id);
    }
    propose(user, dto) {
        return this.service.propose(user, dto);
    }
    submit(user, id) {
        return this.service.submitForApproval(user, id);
    }
    approve(user, id, _dto) {
        return this.service.approve(user, id);
    }
    reject(user, id, dto) {
        return this.service.reject(user, id, dto.rejectionReason);
    }
};
exports.AdsActionController = AdsActionController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], AdsActionController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.read'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AdsActionController.prototype, "get", null);
__decorate([
    (0, common_1.Post)('propose'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.analyze'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ads_action_dto_1.ProposeAdsActionDto]),
    __metadata("design:returntype", void 0)
], AdsActionController.prototype, "propose", null);
__decorate([
    (0, common_1.Post)(':id/submit'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.analyze'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], AdsActionController.prototype, "submit", null);
__decorate([
    (0, common_1.Post)(':id/approve'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, ads_action_dto_1.ApproveAdsActionDto]),
    __metadata("design:returntype", void 0)
], AdsActionController.prototype, "approve", null);
__decorate([
    (0, common_1.Post)(':id/reject'),
    (0, require_permissions_decorator_1.RequirePermissions)('ads.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, ads_action_dto_1.RejectAdsActionDto]),
    __metadata("design:returntype", void 0)
], AdsActionController.prototype, "reject", null);
exports.AdsActionController = AdsActionController = __decorate([
    (0, common_1.Controller)('ads-actions'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [ads_action_service_1.AdsActionService])
], AdsActionController);
