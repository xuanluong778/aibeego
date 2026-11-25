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
exports.MessagingIdentityController = void 0;
const common_1 = require("@nestjs/common");
const messaging_identity_service_1 = require("./messaging-identity.service");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permissions_guard_1 = require("../common/guards/permissions.guard");
const require_permissions_decorator_1 = require("../common/decorators/require-permissions.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const messaging_identity_dto_1 = require("./dto/messaging-identity.dto");
let MessagingIdentityController = class MessagingIdentityController {
    service;
    constructor(service) {
        this.service = service;
    }
    list(user, query) {
        return this.service.list(user.organizationId, query);
    }
    listMergeLogs(user, primaryIdentityId) {
        return this.service.listMergeLogs(user.organizationId, primaryIdentityId);
    }
    findOne(user, id) {
        return this.service.findOne(user.organizationId, id);
    }
    suggestLinks(user, id) {
        return this.service.suggestLinks(user.organizationId, id);
    }
    upsert(user, dto) {
        return this.service.upsert(user.organizationId, dto, user.id);
    }
    linkManual(user, id, dto) {
        return this.service.linkManual(user.organizationId, id, dto, user.id);
    }
    linkByVerifiedPhone(user, id) {
        return this.service.linkByVerifiedPhone(user.organizationId, id, user.id);
    }
    merge(user, dto) {
        return this.service.mergeIdentities(user.organizationId, dto, user.id);
    }
    undoMerge(user, logId) {
        return this.service.undoMerge(user.organizationId, logId, user.id);
    }
};
exports.MessagingIdentityController = MessagingIdentityController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, messaging_identity_dto_1.MessagingIdentityQueryDto]),
    __metadata("design:returntype", void 0)
], MessagingIdentityController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('merge-logs'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)('primaryIdentityId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MessagingIdentityController.prototype, "listMergeLogs", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MessagingIdentityController.prototype, "findOne", null);
__decorate([
    (0, common_1.Get)(':id/suggest-links'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MessagingIdentityController.prototype, "suggestLinks", null);
__decorate([
    (0, common_1.Post)('upsert'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.integration.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, messaging_identity_dto_1.UpsertMessagingIdentityDto]),
    __metadata("design:returntype", void 0)
], MessagingIdentityController.prototype, "upsert", null);
__decorate([
    (0, common_1.Patch)(':id/link'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.integration.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, messaging_identity_dto_1.LinkIdentityDto]),
    __metadata("design:returntype", void 0)
], MessagingIdentityController.prototype, "linkManual", null);
__decorate([
    (0, common_1.Post)(':id/link-verified-phone'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.integration.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MessagingIdentityController.prototype, "linkByVerifiedPhone", null);
__decorate([
    (0, common_1.Post)('merge'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.integration.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, messaging_identity_dto_1.MergeIdentitiesDto]),
    __metadata("design:returntype", void 0)
], MessagingIdentityController.prototype, "merge", null);
__decorate([
    (0, common_1.Post)('merge-logs/:logId/undo'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.integration.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('logId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], MessagingIdentityController.prototype, "undoMerge", null);
exports.MessagingIdentityController = MessagingIdentityController = __decorate([
    (0, common_1.Controller)('messaging-identities'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [messaging_identity_service_1.MessagingIdentityService])
], MessagingIdentityController);
