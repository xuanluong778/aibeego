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
var PermissionsGuard_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PermissionsGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const require_permissions_decorator_1 = require("../decorators/require-permissions.decorator");
const roles_1 = require("../constants/roles");
let PermissionsGuard = PermissionsGuard_1 = class PermissionsGuard {
    reflector;
    logger = new common_1.Logger(PermissionsGuard_1.name);
    constructor(reflector) {
        this.reflector = reflector;
    }
    canActivate(context) {
        const required = this.reflector.getAllAndOverride(require_permissions_decorator_1.PERMISSIONS_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!required?.length)
            return true;
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user) {
            throw new common_1.ForbiddenException('Không có thông tin người dùng');
        }
        // Khớp frontend hasPermission: OWNER / SUPER_ADMIN bypass toàn bộ RBAC
        if (user.role === roles_1.SYSTEM_ROLES.OWNER || user.role === 'SUPER_ADMIN') {
            return true;
        }
        const permissions = user.permissions ?? [];
        const missing = required.filter((p) => !permissions.includes(p));
        const enforce = process.env.HRM_PERMISSIONS_ENFORCE !== 'false';
        if (missing.length === 0)
            return true;
        if (!enforce) {
            this.logger.warn(`[shadow] thiếu quyền [${missing.join(', ')}] user=${user.email} ${request.method} ${request.url}`);
            return true;
        }
        throw new common_1.ForbiddenException(`Thiếu quyền: ${missing.join(', ')}`);
    }
};
exports.PermissionsGuard = PermissionsGuard;
exports.PermissionsGuard = PermissionsGuard = PermissionsGuard_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.Reflector])
], PermissionsGuard);
