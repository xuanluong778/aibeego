"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrmModule = void 0;
const common_1 = require("@nestjs/common");
const email_marketing_module_1 = require("../email-marketing/email-marketing.module");
const pipeline_service_1 = require("./pipeline.service");
const lead_assignment_service_1 = require("./lead-assignment.service");
const customer_360_service_1 = require("./customer-360.service");
const customer_journey_service_1 = require("./customer-journey.service");
const appointment_conflict_service_1 = require("./appointment-conflict.service");
const automation_engine_service_1 = require("./automation-engine.service");
const lead_scoring_service_1 = require("./lead-scoring.service");
const funnel_canvas_runtime_service_1 = require("./funnel-canvas-runtime.service");
const crm_controller_1 = require("./crm.controller");
const audit_module_1 = require("../audit/audit.module");
const messaging_module_1 = require("../messaging/messaging.module");
const events_module_1 = require("../events/events.module");
const attribution_module_1 = require("../attribution/attribution.module");
const customers_module_1 = require("../customers/customers.module");
let CrmModule = class CrmModule {
};
exports.CrmModule = CrmModule;
exports.CrmModule = CrmModule = __decorate([
    (0, common_1.Module)({
        imports: [
            audit_module_1.AuditModule,
            messaging_module_1.MessagingModule,
            events_module_1.EventsModule,
            attribution_module_1.AttributionModule,
            email_marketing_module_1.EmailMarketingModule,
            customers_module_1.CustomersModule,
        ],
        controllers: [crm_controller_1.CrmController],
        providers: [
            pipeline_service_1.PipelineService,
            lead_assignment_service_1.LeadAssignmentService,
            customer_360_service_1.Customer360Service,
            customer_journey_service_1.CustomerJourneyService,
            appointment_conflict_service_1.AppointmentConflictService,
            automation_engine_service_1.AutomationEngineService,
            lead_scoring_service_1.LeadScoringService,
            funnel_canvas_runtime_service_1.FunnelCanvasRuntimeService,
        ],
        exports: [
            pipeline_service_1.PipelineService,
            lead_assignment_service_1.LeadAssignmentService,
            customer_360_service_1.Customer360Service,
            customer_journey_service_1.CustomerJourneyService,
            appointment_conflict_service_1.AppointmentConflictService,
            automation_engine_service_1.AutomationEngineService,
            lead_scoring_service_1.LeadScoringService,
            funnel_canvas_runtime_service_1.FunnelCanvasRuntimeService,
        ],
    })
], CrmModule);
