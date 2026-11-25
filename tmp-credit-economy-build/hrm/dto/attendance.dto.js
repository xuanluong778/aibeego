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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CorrectAttendanceDayDto = exports.AttendanceExportQueryDto = exports.CreateAttendanceQrTokenDto = exports.UnlockTimesheetPeriodDto = exports.CreateTimesheetPeriodDto = exports.TimesheetPeriodQueryDto = exports.CreateAttendanceAdjustmentDto = exports.AttendanceDaysQueryDto = exports.AttendancePunchDto = void 0;
const class_validator_1 = require("class-validator");
const database_1 = require("@marketingspa/database");
const class_transformer_1 = require("class-transformer");
class AttendancePunchDto {
    /** Optional — server falls back to actor.employeeId */
    employeeId;
    /** Optional — server falls back to employee's branchId */
    branchId;
    type;
    method;
    punchedAt;
    /** Raw QR token (hashed server-side) */
    qrToken;
    latitude;
    longitude;
    accuracyM;
    kioskDeviceId;
}
exports.AttendancePunchDto = AttendancePunchDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], AttendancePunchDto.prototype, "employeeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], AttendancePunchDto.prototype, "branchId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(database_1.AttendancePunchType),
    __metadata("design:type", String)
], AttendancePunchDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(database_1.AttendanceMethod),
    __metadata("design:type", String)
], AttendancePunchDto.prototype, "method", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AttendancePunchDto.prototype, "punchedAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AttendancePunchDto.prototype, "qrToken", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], AttendancePunchDto.prototype, "latitude", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], AttendancePunchDto.prototype, "longitude", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], AttendancePunchDto.prototype, "accuracyM", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AttendancePunchDto.prototype, "kioskDeviceId", void 0);
class AttendanceDaysQueryDto {
    branchId;
    employeeId;
    year;
    month;
    from;
    to;
    page;
    pageSize;
    departmentId;
    status;
}
exports.AttendanceDaysQueryDto = AttendanceDaysQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], AttendanceDaysQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], AttendanceDaysQueryDto.prototype, "employeeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], AttendanceDaysQueryDto.prototype, "year", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], AttendanceDaysQueryDto.prototype, "month", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AttendanceDaysQueryDto.prototype, "from", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], AttendanceDaysQueryDto.prototype, "to", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AttendanceDaysQueryDto.prototype, "page", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], AttendanceDaysQueryDto.prototype, "pageSize", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AttendanceDaysQueryDto.prototype, "departmentId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.AttendanceDayStatus),
    __metadata("design:type", String)
], AttendanceDaysQueryDto.prototype, "status", void 0);
class CreateAttendanceAdjustmentDto {
    employeeId;
    workDate;
    field;
    oldValue;
    newValue;
    reason;
}
exports.CreateAttendanceAdjustmentDto = CreateAttendanceAdjustmentDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateAttendanceAdjustmentDto.prototype, "employeeId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateAttendanceAdjustmentDto.prototype, "workDate", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateAttendanceAdjustmentDto.prototype, "field", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateAttendanceAdjustmentDto.prototype, "oldValue", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateAttendanceAdjustmentDto.prototype, "newValue", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateAttendanceAdjustmentDto.prototype, "reason", void 0);
class TimesheetPeriodQueryDto {
    branchId;
    year;
    month;
}
exports.TimesheetPeriodQueryDto = TimesheetPeriodQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], TimesheetPeriodQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], TimesheetPeriodQueryDto.prototype, "year", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], TimesheetPeriodQueryDto.prototype, "month", void 0);
class CreateTimesheetPeriodDto {
    branchId;
    year;
    month;
}
exports.CreateTimesheetPeriodDto = CreateTimesheetPeriodDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateTimesheetPeriodDto.prototype, "branchId", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateTimesheetPeriodDto.prototype, "year", void 0);
__decorate([
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], CreateTimesheetPeriodDto.prototype, "month", void 0);
class UnlockTimesheetPeriodDto {
    reason;
}
exports.UnlockTimesheetPeriodDto = UnlockTimesheetPeriodDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UnlockTimesheetPeriodDto.prototype, "reason", void 0);
class CreateAttendanceQrTokenDto {
    branchId;
    label;
    expiresAt;
}
exports.CreateAttendanceQrTokenDto = CreateAttendanceQrTokenDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateAttendanceQrTokenDto.prototype, "branchId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateAttendanceQrTokenDto.prototype, "label", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateAttendanceQrTokenDto.prototype, "expiresAt", void 0);
class AttendanceExportQueryDto {
    from;
    to;
    departmentId;
    branchId;
    status;
    format;
}
exports.AttendanceExportQueryDto = AttendanceExportQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AttendanceExportQueryDto.prototype, "from", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AttendanceExportQueryDto.prototype, "to", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AttendanceExportQueryDto.prototype, "departmentId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AttendanceExportQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.AttendanceDayStatus),
    __metadata("design:type", String)
], AttendanceExportQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], AttendanceExportQueryDto.prototype, "format", void 0);
class CorrectAttendanceDayDto {
    checkInAt;
    checkOutAt;
    workedMinutes;
    lateMinutes;
    earlyLeaveMinutes;
    otMinutes;
    status;
    reason;
}
exports.CorrectAttendanceDayDto = CorrectAttendanceDayDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CorrectAttendanceDayDto.prototype, "checkInAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CorrectAttendanceDayDto.prototype, "checkOutAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CorrectAttendanceDayDto.prototype, "workedMinutes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CorrectAttendanceDayDto.prototype, "lateMinutes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CorrectAttendanceDayDto.prototype, "earlyLeaveMinutes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CorrectAttendanceDayDto.prototype, "otMinutes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.AttendanceDayStatus),
    __metadata("design:type", String)
], CorrectAttendanceDayDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(1),
    __metadata("design:type", String)
], CorrectAttendanceDayDto.prototype, "reason", void 0);
