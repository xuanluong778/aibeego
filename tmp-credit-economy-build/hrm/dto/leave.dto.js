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
exports.LeaveRejectDto = exports.LeaveCancelDto = exports.LeaveBalanceQueryDto = exports.CreateOvertimeRequestDto = exports.OvertimeRequestQueryDto = exports.LeaveDecisionDto = exports.CreateLeaveRequestDto = exports.LeaveRequestQueryDto = void 0;
const class_validator_1 = require("class-validator");
const database_1 = require("@marketingspa/database");
const class_transformer_1 = require("class-transformer");
class LeaveRequestQueryDto {
    branchId;
    employeeId;
    status;
    page;
    pageSize;
}
exports.LeaveRequestQueryDto = LeaveRequestQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], LeaveRequestQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], LeaveRequestQueryDto.prototype, "employeeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.LeaveRequestStatus),
    __metadata("design:type", String)
], LeaveRequestQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], LeaveRequestQueryDto.prototype, "page", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], LeaveRequestQueryDto.prototype, "pageSize", void 0);
class CreateLeaveRequestDto {
    employeeId;
    branchId;
    leaveType;
    fromDate;
    toDate;
    days;
    reason;
    dayPart;
}
exports.CreateLeaveRequestDto = CreateLeaveRequestDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateLeaveRequestDto.prototype, "employeeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateLeaveRequestDto.prototype, "branchId", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(database_1.LeaveType),
    __metadata("design:type", String)
], CreateLeaveRequestDto.prototype, "leaveType", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateLeaveRequestDto.prototype, "fromDate", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateLeaveRequestDto.prototype, "toDate", void 0);
__decorate([
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateLeaveRequestDto.prototype, "days", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateLeaveRequestDto.prototype, "reason", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.LeaveDayPart),
    __metadata("design:type", String)
], CreateLeaveRequestDto.prototype, "dayPart", void 0);
class LeaveDecisionDto {
    decisionNote;
}
exports.LeaveDecisionDto = LeaveDecisionDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LeaveDecisionDto.prototype, "decisionNote", void 0);
class OvertimeRequestQueryDto {
    branchId;
    employeeId;
    status;
    page;
    pageSize;
}
exports.OvertimeRequestQueryDto = OvertimeRequestQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], OvertimeRequestQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], OvertimeRequestQueryDto.prototype, "employeeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(database_1.LeaveRequestStatus),
    __metadata("design:type", String)
], OvertimeRequestQueryDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], OvertimeRequestQueryDto.prototype, "page", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], OvertimeRequestQueryDto.prototype, "pageSize", void 0);
class CreateOvertimeRequestDto {
    employeeId;
    branchId;
    workDate;
    minutes;
    reason;
    breakMinutes;
    startAt;
    endAt;
}
exports.CreateOvertimeRequestDto = CreateOvertimeRequestDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateOvertimeRequestDto.prototype, "employeeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateOvertimeRequestDto.prototype, "branchId", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateOvertimeRequestDto.prototype, "workDate", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateOvertimeRequestDto.prototype, "minutes", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateOvertimeRequestDto.prototype, "reason", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], CreateOvertimeRequestDto.prototype, "breakMinutes", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateOvertimeRequestDto.prototype, "startAt", void 0);
__decorate([
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], CreateOvertimeRequestDto.prototype, "endAt", void 0);
class LeaveBalanceQueryDto {
    employeeId;
    year;
}
exports.LeaveBalanceQueryDto = LeaveBalanceQueryDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], LeaveBalanceQueryDto.prototype, "employeeId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], LeaveBalanceQueryDto.prototype, "year", void 0);
class LeaveCancelDto {
    reason;
}
exports.LeaveCancelDto = LeaveCancelDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    __metadata("design:type", String)
], LeaveCancelDto.prototype, "reason", void 0);
class LeaveRejectDto {
    reason;
    decisionNote;
}
exports.LeaveRejectDto = LeaveRejectDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LeaveRejectDto.prototype, "reason", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], LeaveRejectDto.prototype, "decisionNote", void 0);
