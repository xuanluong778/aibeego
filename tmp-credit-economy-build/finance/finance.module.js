"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinanceModule = void 0;
const common_1 = require("@nestjs/common");
const finance_controller_1 = require("./finance.controller");
const finance_service_1 = require("./finance.service");
const attribution_module_1 = require("../attribution/attribution.module");
const crm_module_1 = require("../crm/crm.module");
const events_module_1 = require("../events/events.module");
let FinanceModule = class FinanceModule {
};
exports.FinanceModule = FinanceModule;
exports.FinanceModule = FinanceModule = __decorate([
    (0, common_1.Module)({
        imports: [attribution_module_1.AttributionModule, crm_module_1.CrmModule, events_module_1.EventsModule],
        controllers: [finance_controller_1.FinanceController],
        providers: [finance_service_1.FinanceService],
    })
], FinanceModule);
