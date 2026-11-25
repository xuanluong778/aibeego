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
exports.BusinessGoalsController = void 0;
const common_1 = require("@nestjs/common");
const business_goals_service_1 = require("./business-goals.service");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const business_goal_dto_1 = require("./dto/business-goal.dto");
let BusinessGoalsController = class BusinessGoalsController {
    service;
    constructor(service) {
        this.service = service;
    }
    findAll(user, query) {
        return this.service.findAll(user.organizationId, query);
    }
    calculate(dto) {
        return this.service.calculate(dto);
    }
    create(user, dto) {
        return this.service.create(user, dto);
    }
    findOne(user, id) {
        return this.service.findOne(user.organizationId, id);
    }
    remove(user, id) {
        return this.service.remove(user.organizationId, id);
    }
};
exports.BusinessGoalsController = BusinessGoalsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, business_goal_dto_1.BusinessGoalQueryDto]),
    __metadata("design:returntype", void 0)
], BusinessGoalsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)('calculate'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [business_goal_dto_1.BusinessGoalInputDto]),
    __metadata("design:returntype", void 0)
], BusinessGoalsController.prototype, "calculate", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, business_goal_dto_1.CreateBusinessGoalScenarioDto]),
    __metadata("design:returntype", void 0)
], BusinessGoalsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BusinessGoalsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], BusinessGoalsController.prototype, "remove", null);
exports.BusinessGoalsController = BusinessGoalsController = __decorate([
    (0, common_1.Controller)('business-goals'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __metadata("design:paramtypes", [business_goals_service_1.BusinessGoalsService])
], BusinessGoalsController);
