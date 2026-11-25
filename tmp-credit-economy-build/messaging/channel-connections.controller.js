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
exports.ChannelConnectionsController = void 0;
const common_1 = require("@nestjs/common");
const channel_connections_service_1 = require("./channel-connections.service");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permissions_guard_1 = require("../common/guards/permissions.guard");
const require_permissions_decorator_1 = require("../common/decorators/require-permissions.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const channel_connection_dto_1 = require("./dto/channel-connection.dto");
let ChannelConnectionsController = class ChannelConnectionsController {
    service;
    constructor(service) {
        this.service = service;
    }
    list(user) {
        return this.service.list(user.organizationId);
    }
    connectMessenger(user, dto) {
        return this.service.connectMessenger(user.organizationId, dto, user.id);
    }
    connectZalo(user, dto) {
        return this.service.connectZaloOa(user.organizationId, dto, user.id);
    }
    connectZbs(user, dto) {
        return this.service.connectZbs(user.organizationId, dto, user.id);
    }
    test(user, id) {
        return this.service.test(user.organizationId, id, user.id);
    }
    reconnect(user, id, dto) {
        return this.service.reconnect(user.organizationId, id, dto, user.id);
    }
    pause(user, id, dto) {
        return this.service.setPaused(user.organizationId, id, dto.isPaused ?? true, user.id);
    }
    remove(user, id) {
        return this.service.remove(user.organizationId, id, user.id);
    }
};
exports.ChannelConnectionsController = ChannelConnectionsController;
__decorate([
    (0, common_1.Get)(),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.view'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ChannelConnectionsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('messenger'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.integration.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, channel_connection_dto_1.ConnectMessengerChannelDto]),
    __metadata("design:returntype", void 0)
], ChannelConnectionsController.prototype, "connectMessenger", null);
__decorate([
    (0, common_1.Post)('zalo'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.integration.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, channel_connection_dto_1.ConnectZaloChannelDto]),
    __metadata("design:returntype", void 0)
], ChannelConnectionsController.prototype, "connectZalo", null);
__decorate([
    (0, common_1.Post)('zbs'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.integration.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, channel_connection_dto_1.ConnectZbsChannelDto]),
    __metadata("design:returntype", void 0)
], ChannelConnectionsController.prototype, "connectZbs", null);
__decorate([
    (0, common_1.Post)(':id/test'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.integration.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ChannelConnectionsController.prototype, "test", null);
__decorate([
    (0, common_1.Post)(':id/reconnect'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.integration.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, channel_connection_dto_1.ReconnectChannelDto]),
    __metadata("design:returntype", void 0)
], ChannelConnectionsController.prototype, "reconnect", null);
__decorate([
    (0, common_1.Patch)(':id/pause'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.integration.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, channel_connection_dto_1.PauseChannelDto]),
    __metadata("design:returntype", void 0)
], ChannelConnectionsController.prototype, "pause", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.integration.manage'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ChannelConnectionsController.prototype, "remove", null);
exports.ChannelConnectionsController = ChannelConnectionsController = __decorate([
    (0, common_1.Controller)('automation/channel-connections'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [channel_connections_service_1.ChannelConnectionsService])
], ChannelConnectionsController);
