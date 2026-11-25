"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AssistantModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("../prisma/prisma.module");
const customers_module_1 = require("../customers/customers.module");
const leads_module_1 = require("../leads/leads.module");
const crm_module_1 = require("../crm/crm.module");
const work_management_module_1 = require("../work-management/work-management.module");
const work_insights_service_1 = require("../work-management/work-insights.service");
const hrm_module_1 = require("../hrm/hrm.module");
const ads_mcp_module_1 = require("../ads-mcp/ads-mcp.module");
const chatbot_cskh_module_1 = require("../chatbot-cskh/chatbot-cskh.module");
const attribution_module_1 = require("../attribution/attribution.module");
const events_module_1 = require("../events/events.module");
const rag_kb_module_1 = require("../rag-kb/rag-kb.module");
const finance_service_1 = require("../finance/finance.service");
const employees_service_1 = require("../employees/employees.service");
const assistant_controller_1 = require("./assistant.controller");
const assistant_session_service_1 = require("./assistant.session.service");
const assistant_audit_service_1 = require("./assistant.audit.service");
const tool_registry_1 = require("./tool-registry/tool-registry");
const tool_runtime_1 = require("./tool-registry/tool-runtime");
const assistant_orchestrator_service_1 = require("./assistant.orchestrator.service");
const domain_tools_service_1 = require("./tools/domain-tools.service");
const write_execute_service_1 = require("./write/write-execute.service");
const pending_action_service_1 = require("./write/pending-action.service");
const write_tools_service_1 = require("./write/write-tools.service");
/**
 * Trợ lý Bạch Cốt Tinh — inject domain services/gateways currently exported.
 * FinanceService / EmployeesService / WorkInsightsService are provided here
 * (domain modules do not export them)
 * so assistant can call existing logic without editing CRM/Finance/HRM/Work/Ads/CSKH files.
 */
let AssistantModule = class AssistantModule {
};
exports.AssistantModule = AssistantModule;
exports.AssistantModule = AssistantModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            customers_module_1.CustomersModule,
            leads_module_1.LeadsModule,
            crm_module_1.CrmModule,
            work_management_module_1.WorkManagementModule,
            hrm_module_1.HrmModule,
            ads_mcp_module_1.AdsMcpModule,
            chatbot_cskh_module_1.ChatbotCskhModule,
            attribution_module_1.AttributionModule,
            events_module_1.EventsModule,
            rag_kb_module_1.RagKbModule,
        ],
        controllers: [assistant_controller_1.AssistantController],
        providers: [
            assistant_session_service_1.AssistantSessionService,
            assistant_audit_service_1.AssistantAuditService,
            finance_service_1.FinanceService,
            employees_service_1.EmployeesService,
            work_insights_service_1.WorkInsightsService,
            domain_tools_service_1.AssistantDomainToolsService,
            write_execute_service_1.AssistantWriteExecuteService,
            pending_action_service_1.AssistantPendingActionService,
            write_tools_service_1.AssistantWriteToolsService,
            {
                provide: tool_registry_1.AssistantToolRegistry,
                useFactory: (domain, write) => {
                    const registry = new tool_registry_1.AssistantToolRegistry();
                    domain.registerAll(registry);
                    write.registerAll(registry);
                    return registry;
                },
                inject: [domain_tools_service_1.AssistantDomainToolsService, write_tools_service_1.AssistantWriteToolsService],
            },
            tool_runtime_1.AssistantToolRuntime,
            assistant_orchestrator_service_1.AssistantOrchestratorService,
        ],
        exports: [
            assistant_session_service_1.AssistantSessionService,
            assistant_audit_service_1.AssistantAuditService,
            tool_registry_1.AssistantToolRegistry,
            tool_runtime_1.AssistantToolRuntime,
            assistant_orchestrator_service_1.AssistantOrchestratorService,
            pending_action_service_1.AssistantPendingActionService,
        ],
    })
], AssistantModule);
