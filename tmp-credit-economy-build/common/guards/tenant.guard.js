"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantGuard = void 0;
const common_1 = require("@nestjs/common");
/**
 * Multi-tenant guard — đảm bảo user chỉ truy cập dữ liệu organization của mình.
 * Kiểm tra organizationId từ JWT khớp với param/body/query nếu có.
 */
let TenantGuard = class TenantGuard {
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        if (!user?.organizationId) {
            throw new common_1.ForbiddenException('Không xác định được organization');
        }
        const orgFromRequest = request.params?.organizationId ??
            request.body?.organizationId ??
            request.query?.organizationId;
        if (orgFromRequest && orgFromRequest !== user.organizationId) {
            throw new common_1.ForbiddenException('Không có quyền truy cập organization này');
        }
        return true;
    }
};
exports.TenantGuard = TenantGuard;
exports.TenantGuard = TenantGuard = __decorate([
    (0, common_1.Injectable)()
], TenantGuard);
