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
exports.MessagingEligibilityController = void 0;
const common_1 = require("@nestjs/common");
const messaging_eligibility_service_1 = require("./messaging-eligibility.service");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const permissions_guard_1 = require("../common/guards/permissions.guard");
const require_permissions_decorator_1 = require("../common/decorators/require-permissions.decorator");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const eligibility_dto_1 = require("./dto/eligibility.dto");
let MessagingEligibilityController = class MessagingEligibilityController {
    eligibility;
    constructor(eligibility) {
        this.eligibility = eligibility;
    }
    check(user, dto) {
        if (!dto.channel)
            throw new common_1.BadRequestException('Thiếu channel');
        if (!dto.campaignType)
            throw new common_1.BadRequestException('Thiếu campaignType');
        return this.eligibility.check({
            organizationId: user.organizationId,
            channel: dto.channel,
            campaignType: dto.campaignType,
            identityId: dto.identityId,
            externalUserId: dto.externalUserId,
            connectionId: dto.connectionId,
            accountRef: dto.accountRef,
            templateId: dto.templateId,
            flowId: dto.flowId,
            leadId: dto.leadId,
            customerId: dto.customerId,
            providerModeHint: dto.providerModeHint,
        });
    }
};
exports.MessagingEligibilityController = MessagingEligibilityController;
__decorate([
    (0, common_1.Post)('check'),
    (0, require_permissions_decorator_1.RequirePermissions)('automation.campaign.send'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, eligibility_dto_1.CheckMessagingEligibilityDto]),
    __metadata("design:returntype", void 0)
], MessagingEligibilityController.prototype, "check", null);
exports.MessagingEligibilityController = MessagingEligibilityController = __decorate([
    (0, common_1.Controller)('automation/eligibility'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard, permissions_guard_1.PermissionsGuard),
    __metadata("design:paramtypes", [messaging_eligibility_service_1.MessagingEligibilityService])
], MessagingEligibilityController);
