"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkManagementModule = void 0;
const common_1 = require("@nestjs/common");
const work_management_controller_1 = require("./work-management.controller");
const work_management_service_1 = require("./work-management.service");
const work_collab_service_1 = require("./work-collab.service");
const work_insights_service_1 = require("./work-insights.service");
const work_management_schema_service_1 = require("./work-management-schema.service");
let WorkManagementModule = class WorkManagementModule {
};
exports.WorkManagementModule = WorkManagementModule;
exports.WorkManagementModule = WorkManagementModule = __decorate([
    (0, common_1.Module)({
        controllers: [work_management_controller_1.WorkManagementController],
        providers: [
            work_management_service_1.WorkManagementService,
            work_collab_service_1.WorkCollabService,
            work_insights_service_1.WorkInsightsService,
            work_management_schema_service_1.WorkManagementSchemaService,
        ],
        exports: [work_management_service_1.WorkManagementService, work_collab_service_1.WorkCollabService, work_insights_service_1.WorkInsightsService],
    })
], WorkManagementModule);
