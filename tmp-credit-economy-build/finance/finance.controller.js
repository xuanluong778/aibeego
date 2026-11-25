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
exports.FinanceController = void 0;
const common_1 = require("@nestjs/common");
const finance_service_1 = require("./finance.service");
const auth_guard_1 = require("../common/guards/auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
const current_user_decorator_1 = require("../common/decorators/current-user.decorator");
const finance_dto_1 = require("./dto/finance.dto");
let FinanceController = class FinanceController {
    service;
    constructor(service) {
        this.service = service;
    }
    dashboard(user, query) {
        return this.service.getDashboard(user.organizationId, query);
    }
    listOrders(user, query) {
        return this.service.listOrders(user.organizationId, query);
    }
    createOrder(user, dto) {
        return this.service.createOrder(user.organizationId, dto, user.id);
    }
    cancelOrder(user, id) {
        return this.service.cancelOrder(user.organizationId, id, user.id);
    }
    listPayments(user, query) {
        return this.service.listPayments(user.organizationId, query);
    }
    createPayment(user, dto) {
        return this.service.createPayment(user.organizationId, dto, user.id);
    }
    refundPayment(user, id) {
        return this.service.refundPayment(user.organizationId, id, user.id);
    }
    listExpenses(user, query) {
        return this.service.listExpenses(user.organizationId, query);
    }
    createExpense(user, dto) {
        return this.service.createExpense(user.organizationId, dto);
    }
    updateExpense(user, id, dto) {
        return this.service.updateExpense(user.organizationId, id, dto);
    }
    removeExpense(user, id) {
        return this.service.removeExpense(user.organizationId, id);
    }
};
exports.FinanceController = FinanceController;
__decorate([
    (0, common_1.Get)('dashboard'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, finance_dto_1.DashboardQueryDto]),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "dashboard", null);
__decorate([
    (0, common_1.Get)('orders'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, finance_dto_1.FinanceQueryDto]),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "listOrders", null);
__decorate([
    (0, common_1.Post)('orders'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, finance_dto_1.CreateOrderDto]),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "createOrder", null);
__decorate([
    (0, common_1.Post)('orders/:id/cancel'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "cancelOrder", null);
__decorate([
    (0, common_1.Get)('payments'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, finance_dto_1.FinanceQueryDto]),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "listPayments", null);
__decorate([
    (0, common_1.Post)('payments'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, finance_dto_1.CreatePaymentDto]),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "createPayment", null);
__decorate([
    (0, common_1.Post)('payments/:id/refund'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "refundPayment", null);
__decorate([
    (0, common_1.Get)('expenses'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, finance_dto_1.FinanceQueryDto]),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "listExpenses", null);
__decorate([
    (0, common_1.Post)('expenses'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, finance_dto_1.CreateExpenseDto]),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "createExpense", null);
__decorate([
    (0, common_1.Patch)('expenses/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, finance_dto_1.UpdateExpenseDto]),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "updateExpense", null);
__decorate([
    (0, common_1.Delete)('expenses/:id'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], FinanceController.prototype, "removeExpense", null);
exports.FinanceController = FinanceController = __decorate([
    (0, common_1.Controller)('finance'),
    (0, common_1.UseGuards)(auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    __metadata("design:paramtypes", [finance_service_1.FinanceService])
], FinanceController);
