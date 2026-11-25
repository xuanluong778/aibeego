"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HrmModule = void 0;
const common_1 = require("@nestjs/common");
const hrm_employees_controller_1 = require("./hrm-employees.controller");
const hrm_employees_service_1 = require("./hrm-employees.service");
const hrm_departments_controller_1 = require("./hrm-departments.controller");
const hrm_departments_service_1 = require("./hrm-departments.service");
const hrm_contracts_controller_1 = require("./hrm-contracts.controller");
const hrm_contracts_service_1 = require("./hrm-contracts.service");
const hrm_documents_controller_1 = require("./hrm-documents.controller");
const hrm_documents_service_1 = require("./hrm-documents.service");
const hrm_audit_controller_1 = require("./hrm-audit.controller");
const hrm_audit_service_1 = require("./hrm-audit.service");
const hrm_shift_policies_controller_1 = require("./hrm-shift-policies.controller");
const hrm_shift_policies_service_1 = require("./hrm-shift-policies.service");
const hrm_shift_assignments_controller_1 = require("./hrm-shift-assignments.controller");
const hrm_shift_assignments_service_1 = require("./hrm-shift-assignments.service");
const hrm_attendance_controller_1 = require("./hrm-attendance.controller");
const hrm_attendance_service_1 = require("./hrm-attendance.service");
const hrm_timesheet_controller_1 = require("./hrm-timesheet.controller");
const hrm_timesheet_service_1 = require("./hrm-timesheet.service");
const hrm_leave_controller_1 = require("./hrm-leave.controller");
const hrm_leave_service_1 = require("./hrm-leave.service");
let HrmModule = class HrmModule {
};
exports.HrmModule = HrmModule;
exports.HrmModule = HrmModule = __decorate([
    (0, common_1.Module)({
        controllers: [
            hrm_employees_controller_1.HrmEmployeesController,
            hrm_departments_controller_1.HrmDepartmentsController,
            hrm_contracts_controller_1.HrmContractsController,
            hrm_documents_controller_1.HrmDocumentsController,
            hrm_audit_controller_1.HrmAuditController,
            hrm_shift_policies_controller_1.HrmShiftPoliciesController,
            hrm_shift_assignments_controller_1.HrmShiftAssignmentsController,
            hrm_attendance_controller_1.HrmAttendanceController,
            hrm_timesheet_controller_1.HrmTimesheetController,
            hrm_leave_controller_1.HrmLeaveController,
            hrm_leave_controller_1.HrmOvertimeController,
        ],
        providers: [
            hrm_employees_service_1.HrmEmployeesService,
            hrm_departments_service_1.HrmDepartmentsService,
            hrm_contracts_service_1.HrmContractsService,
            hrm_documents_service_1.HrmDocumentsService,
            hrm_audit_service_1.HrmAuditService,
            hrm_shift_policies_service_1.HrmShiftPoliciesService,
            hrm_shift_assignments_service_1.HrmShiftAssignmentsService,
            hrm_attendance_service_1.HrmAttendanceService,
            hrm_timesheet_service_1.HrmTimesheetService,
            hrm_leave_service_1.HrmLeaveService,
        ],
        exports: [
            hrm_employees_service_1.HrmEmployeesService,
            hrm_departments_service_1.HrmDepartmentsService,
            hrm_contracts_service_1.HrmContractsService,
            hrm_documents_service_1.HrmDocumentsService,
            hrm_audit_service_1.HrmAuditService,
            hrm_attendance_service_1.HrmAttendanceService,
            hrm_timesheet_service_1.HrmTimesheetService,
            hrm_leave_service_1.HrmLeaveService,
        ],
    })
], HrmModule);
