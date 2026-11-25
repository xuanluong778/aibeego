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
exports.HrmShiftPoliciesService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const roles_1 = require("../common/constants/roles");
const hrm_attendance_scope_1 = require("./hrm-attendance-scope");
function assertCanManagePolicies(role) {
    if (!role || (!(0, hrm_attendance_scope_1.isHrmOrgWideRole)(role) && role !== roles_1.SYSTEM_ROLES.MANAGER)) {
        throw new common_1.ForbiddenException('Không có quyền quản lý ca làm việc');
    }
}
let HrmShiftPoliciesService = class HrmShiftPoliciesService {
    prisma;
    audit;
    constructor(prisma, audit) {
        this.prisma = prisma;
        this.audit = audit;
    }
    async findAll(organizationId, query) {
        return this.prisma.workShiftPolicy.findMany({
            where: {
                organizationId,
                ...(query?.branchId && { branchId: query.branchId }),
                ...(!query?.includeInactive && { isActive: true }),
            },
            orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
            include: {
                branch: { select: { id: true, name: true } },
                versions: { orderBy: { version: 'desc' }, take: 1 },
                _count: { select: { assignments: true } },
            },
        });
    }
    async findOne(organizationId, id) {
        const policy = await this.prisma.workShiftPolicy.findFirst({
            where: { id, organizationId },
            include: {
                branch: { select: { id: true, name: true } },
                versions: { orderBy: { version: 'desc' } },
                _count: { select: { assignments: true } },
            },
        });
        if (!policy)
            throw new common_1.NotFoundException('Ca làm việc không tồn tại');
        return policy;
    }
    normalizeTimes(dto) {
        const [sh, sm] = dto.startTime.split(':').map(Number);
        const [eh, em] = dto.endTime.split(':').map(Number);
        const startMins = (sh ?? 0) * 60 + (sm ?? 0);
        const endMins = (eh ?? 0) * 60 + (em ?? 0);
        const crossesMidnight = dto.crossesMidnight === true || endMins <= startMins;
        return { crossesMidnight };
    }
    async create(organizationId, dto, actor) {
        assertCanManagePolicies(actor?.role);
        const { crossesMidnight } = this.normalizeTimes(dto);
        const effectiveFrom = dto.effectiveFrom
            ? new Date(dto.effectiveFrom)
            : new Date();
        const fields = {
            startTime: dto.startTime,
            endTime: dto.endTime,
            breakMinutes: dto.breakMinutes ?? 60,
            lateGraceMinutes: dto.lateGraceMinutes ?? 0,
            earlyLeaveGraceMinutes: dto.earlyLeaveGraceMinutes ?? 0,
            otBeforeMinutes: dto.otBeforeMinutes ?? 0,
            otAfterMinutes: dto.otAfterMinutes ?? 0,
            crossesMidnight,
        };
        const payload = (0, database_1.buildShiftPayloadFromPolicy)(fields);
        try {
            const policy = await this.prisma.workShiftPolicy.create({
                data: {
                    organizationId,
                    branchId: dto.branchId,
                    name: dto.name.trim(),
                    code: dto.code?.trim().toUpperCase(),
                    ...fields,
                    effectiveFrom,
                    effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
                    currentVersion: 1,
                    createdById: actor?.userId,
                    versions: {
                        create: {
                            version: 1,
                            payload: payload,
                            createdById: actor?.userId,
                        },
                    },
                },
                include: {
                    versions: true,
                    branch: { select: { id: true, name: true } },
                    _count: { select: { assignments: true } },
                },
            });
            await this.audit.log({
                organizationId,
                userId: actor?.userId,
                action: 'hrm.shift_policy.create',
                entityType: 'WorkShiftPolicy',
                entityId: policy.id,
                metadata: { after: { name: policy.name, code: policy.code, ...fields } },
                ipAddress: actor?.ipAddress,
            });
            return policy;
        }
        catch (e) {
            if (e instanceof database_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                throw new common_1.ConflictException('Mã ca đã tồn tại trong organization');
            }
            throw e;
        }
    }
    async update(organizationId, id, dto, actor) {
        assertCanManagePolicies(actor?.role);
        const existing = await this.findOne(organizationId, id);
        const before = {
            name: existing.name,
            branchId: existing.branchId,
            startTime: existing.startTime,
            endTime: existing.endTime,
            breakMinutes: existing.breakMinutes,
            lateGraceMinutes: existing.lateGraceMinutes,
            earlyLeaveGraceMinutes: existing.earlyLeaveGraceMinutes,
            otBeforeMinutes: existing.otBeforeMinutes,
            otAfterMinutes: existing.otAfterMinutes,
            crossesMidnight: existing.crossesMidnight,
            isActive: existing.isActive,
        };
        const startTime = dto.startTime ?? existing.startTime;
        const endTime = dto.endTime ?? existing.endTime;
        const { crossesMidnight } = this.normalizeTimes({
            startTime,
            endTime,
            crossesMidnight: dto.crossesMidnight ?? existing.crossesMidnight,
        });
        const nextFields = {
            startTime,
            endTime,
            breakMinutes: dto.breakMinutes ?? existing.breakMinutes,
            lateGraceMinutes: dto.lateGraceMinutes ?? existing.lateGraceMinutes,
            earlyLeaveGraceMinutes: dto.earlyLeaveGraceMinutes ?? existing.earlyLeaveGraceMinutes,
            otBeforeMinutes: dto.otBeforeMinutes ?? existing.otBeforeMinutes,
            otAfterMinutes: dto.otAfterMinutes ?? existing.otAfterMinutes,
            crossesMidnight,
        };
        const scheduleChanged = nextFields.startTime !== existing.startTime ||
            nextFields.endTime !== existing.endTime ||
            nextFields.breakMinutes !== existing.breakMinutes ||
            nextFields.lateGraceMinutes !== existing.lateGraceMinutes ||
            nextFields.earlyLeaveGraceMinutes !== existing.earlyLeaveGraceMinutes ||
            nextFields.otBeforeMinutes !== existing.otBeforeMinutes ||
            nextFields.otAfterMinutes !== existing.otAfterMinutes ||
            nextFields.crossesMidnight !== existing.crossesMidnight;
        const payload = (0, database_1.buildShiftPayloadFromPolicy)(nextFields);
        const nextVersion = existing.currentVersion + (scheduleChanged ? 1 : 0);
        const updated = await this.prisma.$transaction(async (tx) => {
            if (scheduleChanged) {
                await tx.workShiftPolicyVersion.create({
                    data: {
                        policyId: id,
                        version: nextVersion,
                        payload: payload,
                        createdById: actor?.userId,
                    },
                });
            }
            return tx.workShiftPolicy.update({
                where: { id },
                data: {
                    ...(dto.name !== undefined && { name: dto.name.trim() }),
                    ...(dto.branchId !== undefined && { branchId: dto.branchId }),
                    ...nextFields,
                    ...(dto.effectiveTo !== undefined && {
                        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
                    }),
                    ...(dto.isActive !== undefined && { isActive: dto.isActive }),
                    ...(scheduleChanged && { currentVersion: nextVersion }),
                },
                include: {
                    branch: { select: { id: true, name: true } },
                    versions: { orderBy: { version: 'desc' }, take: 1 },
                    _count: { select: { assignments: true } },
                },
            });
        });
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'hrm.shift_policy.update',
            entityType: 'WorkShiftPolicy',
            entityId: id,
            metadata: { before, after: dto },
            ipAddress: actor?.ipAddress,
        });
        return updated;
    }
    async setActive(organizationId, id, isActive, actor) {
        assertCanManagePolicies(actor?.role);
        const existing = await this.findOne(organizationId, id);
        if (existing.isActive === isActive)
            return existing;
        const updated = await this.prisma.workShiftPolicy.update({
            where: { id },
            data: { isActive },
            include: {
                branch: { select: { id: true, name: true } },
                _count: { select: { assignments: true } },
            },
        });
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: isActive ? 'hrm.shift_policy.activate' : 'hrm.shift_policy.deactivate',
            entityType: 'WorkShiftPolicy',
            entityId: id,
            metadata: {
                before: { isActive: existing.isActive },
                after: { isActive },
            },
            ipAddress: actor?.ipAddress,
        });
        return updated;
    }
    /** Không xóa cứng nếu đã có phân ca. Ngưng (isActive=false) thay thế. */
    async remove(organizationId, id, actor) {
        assertCanManagePolicies(actor?.role);
        const existing = await this.findOne(organizationId, id);
        const assignmentCount = await this.prisma.shiftAssignment.count({
            where: { organizationId, policyId: id },
        });
        if (assignmentCount > 0) {
            const deactivated = await this.setActive(organizationId, id, false, actor);
            return {
                deleted: false,
                deactivated: true,
                message: 'Ca đã có phân ca — không xóa cứng. Đã chuyển sang trạng thái ngưng.',
                policy: deactivated,
            };
        }
        await this.prisma.workShiftPolicyVersion.deleteMany({ where: { policyId: id } });
        await this.prisma.workShiftPolicy.delete({ where: { id } });
        await this.audit.log({
            organizationId,
            userId: actor?.userId,
            action: 'hrm.shift_policy.delete',
            entityType: 'WorkShiftPolicy',
            entityId: id,
            metadata: { before: { name: existing.name, code: existing.code } },
            ipAddress: actor?.ipAddress,
        });
        return { deleted: true, id };
    }
    resolveWindowForPolicy(policy, workDate) {
        return (0, database_1.resolveShiftWindow)(workDate, {
            startTime: policy.startTime,
            endTime: policy.endTime,
            crossesMidnight: policy.crossesMidnight,
        });
    }
};
exports.HrmShiftPoliciesService = HrmShiftPoliciesService;
exports.HrmShiftPoliciesService = HrmShiftPoliciesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService])
], HrmShiftPoliciesService);
