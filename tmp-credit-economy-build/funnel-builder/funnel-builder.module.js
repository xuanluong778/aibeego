"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FunnelBuilderModule = void 0;
const common_1 = require("@nestjs/common");
const funnel_builder_controller_1 = require("./funnel-builder.controller");
const funnel_public_controller_1 = require("./funnel-public.controller");
const funnel_builder_service_1 = require("./funnel-builder.service");
const funnel_template_service_1 = require("./funnel-template.service");
const funnel_generator_service_1 = require("./funnel-generator.service");
const funnel_lead_capture_service_1 = require("./funnel-lead-capture.service");
const funnel_validator_service_1 = require("./funnel-validator.service");
const funnel_consultant_service_1 = require("./funnel-consultant.service");
const funnel_lifecycle_service_1 = require("./funnel-lifecycle.service");
const funnel_inline_edit_service_1 = require("./funnel-inline-edit.service");
const crm_module_1 = require("../crm/crm.module");
const automation_module_1 = require("../automation/automation.module");
const leads_module_1 = require("../leads/leads.module");
const chatbot_cskh_module_1 = require("../chatbot-cskh/chatbot-cskh.module");
let FunnelBuilderModule = class FunnelBuilderModule {
};
exports.FunnelBuilderModule = FunnelBuilderModule;
exports.FunnelBuilderModule = FunnelBuilderModule = __decorate([
    (0, common_1.Module)({
        imports: [crm_module_1.CrmModule, automation_module_1.AutomationModule, leads_module_1.LeadsModule, chatbot_cskh_module_1.ChatbotCskhModule],
        controllers: [funnel_builder_controller_1.FunnelBuilderController, funnel_public_controller_1.FunnelPublicController],
        providers: [
            funnel_builder_service_1.FunnelBuilderService,
            funnel_template_service_1.FunnelTemplateService,
            funnel_generator_service_1.FunnelGeneratorService,
            funnel_lead_capture_service_1.FunnelLeadCaptureService,
            funnel_validator_service_1.FunnelValidatorService,
            funnel_consultant_service_1.FunnelConsultantService,
            funnel_lifecycle_service_1.FunnelLifecycleService,
            funnel_inline_edit_service_1.FunnelInlineEditService,
        ],
        exports: [
            funnel_builder_service_1.FunnelBuilderService,
            funnel_template_service_1.FunnelTemplateService,
            funnel_generator_service_1.FunnelGeneratorService,
            funnel_lead_capture_service_1.FunnelLeadCaptureService,
            funnel_validator_service_1.FunnelValidatorService,
            funnel_consultant_service_1.FunnelConsultantService,
            funnel_lifecycle_service_1.FunnelLifecycleService,
            funnel_inline_edit_service_1.FunnelInlineEditService,
        ],
    })
], FunnelBuilderModule);
