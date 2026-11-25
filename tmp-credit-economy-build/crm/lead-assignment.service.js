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
exports.LeadAssignmentService = void 0;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const CLAIM_TTL_MS = 5 * 60_000;
const DEFAULT_SLA_MINUTES = 15;
let LeadAssignmentService = class LeadAssignmentService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    computeScore(input) {
        let score = 10;
        if (input.hasPhone)
            score += 20;
        if (input.hasEmail)
            score += 10;
        if (input.estimatedValue && Number(input.estimatedValue) > 0) {
            score += Math.min(40, Math.floor(Number(input.estimatedValue) / 500_000) * 5);
        }
        if (input.platform === 'META' || input.platform === 'GOOGLE')
            score += 15;
        return Math.min(100, score);
    }
    slaRespondBy(from = new Date(), minutes = DEFAULT_SLA_MINUTES) {
        return new Date(from.getTime() + minutes * 60_000);
    }
    async autoAssign(organizationId, opts) {
        if (opts.preferredEmployeeId) {
            const emp = await this.prisma.employee.findFirst({
                where: {
                    id: opts.preferredEmployeeId,
                    organizationId,
                    isActive: true,
                },
            });
            if (emp)
                return emp.id;
        }
        const rule = await this.prisma.leadAssignmentRule.findFirst({
            where: {
                organizationId,
                isActive: true,
                OR: [{ branchId: opts.branchId ?? null }, { branchId: null }],
            },
            orderBy: [{ branchId: 'desc' }],
        });
        if (!rule) {
            // Fallback: first active employee at branch (or org)
            const emp = await this.prisma.employee.findFirst({
                where: {
                    organizationId,
                    isActive: true,
                    ...(opts.branchId ? { branchId: opts.branchId } : {}),
                },
                orderBy: { createdAt: 'asc' },
            });
            return emp?.id ?? null;
        }
        if (rule.mode === database_1.LeadAssignmentMode.EMPLOYEE && rule.employeeIds[0]) {
            return rule.employeeIds[0];
        }
        if (rule.mode === database_1.LeadAssignmentMode.BRANCH || rule.mode === database_1.LeadAssignmentMode.ROUND_ROBIN) {
            const pool = rule.employeeIds.length > 0
                ? await this.prisma.employee.findMany({
                    where: {
                        organizationId,
                        isActive: true,
                        id: { in: rule.employeeIds },
                    },
                    orderBy: { createdAt: 'asc' },
                })
                : await this.prisma.employee.findMany({
                    where: {
                        organizationId,
                        isActive: true,
                        ...(rule.branchId || opts.branchId
                            ? { branchId: rule.branchId ?? opts.branchId ?? undefined }
                            : {}),
                    },
                    orderBy: { createdAt: 'asc' },
                });
            if (!pool.length)
                return null;
            const nextIndex = (rule.lastIndex + 1) % pool.length;
            await this.prisma.leadAssignmentRule.update({
                where: { id: rule.id },
                data: { lastIndex: nextIndex },
            });
            return pool[nextIndex].id;
        }
        return null;
    }
    /**
     * Claim lead for exclusive handling. Fails if another open claim exists.
     */
    async claimLead(organizationId, leadId, employeeId) {
        const employee = await this.prisma.employee.findFirst({
            where: { id: employeeId, organizationId },
            select: { id: true },
        });
        if (!employee) {
            throw new common_1.NotFoundException('Employee not found in organization');
        }
        const now = new Date();
        const result = await this.prisma.lead.updateMany({
            where: {
                id: leadId,
                organizationId,
                OR: [
                    { claimedById: null },
                    { claimExpiresAt: { lt: now } },
                    { claimedById: employeeId },
                ],
            },
            data: {
                claimedById: employeeId,
                claimedAt: now,
                claimExpiresAt: new Date(now.getTime() + CLAIM_TTL_MS),
                assignedToId: employeeId,
            },
        });
        if (result.count === 0) {
            throw new common_1.ConflictException('Lead đang được nhân viên khác xử lý');
        }
        return this.prisma.lead.findFirst({
            where: { id: leadId, organizationId },
            include: { assignedTo: true, claimedBy: true },
        });
    }
    async releaseClaim(organizationId, leadId, employeeId) {
        await this.prisma.lead.updateMany({
            where: { id: leadId, organizationId, claimedById: employeeId },
            data: { claimedById: null, claimedAt: null, claimExpiresAt: null },
        });
    }
    async upsertRule(organizationId, data) {
        if (data.id) {
            const owned = await this.prisma.leadAssignmentRule.findFirst({
                where: { id: data.id, organizationId },
            });
            if (!owned) {
                throw new common_1.NotFoundException('Assignment rule not found');
            }
            return this.prisma.leadAssignmentRule.update({
                where: { id: data.id },
                data: {
                    branchId: data.branchId,
                    mode: data.mode,
                    employeeIds: data.employeeIds ?? [],
                    isActive: data.isActive ?? true,
                },
            });
        }
        return this.prisma.leadAssignmentRule.create({
            data: {
                organizationId,
                branchId: data.branchId,
                mode: data.mode,
                employeeIds: data.employeeIds ?? [],
                isActive: data.isActive ?? true,
            },
        });
    }
    listRules(organizationId) {
        return this.prisma.leadAssignmentRule.findMany({
            where: { organizationId },
            orderBy: { createdAt: 'desc' },
        });
    }
    async deleteRule(organizationId, id) {
        const owned = await this.prisma.leadAssignmentRule.findFirst({
            where: { id, organizationId },
        });
        if (!owned)
            throw new common_1.NotFoundException('Assignment rule not found');
        await this.prisma.leadAssignmentRule.delete({ where: { id } });
        return { ok: true };
    }
};
exports.LeadAssignmentService = LeadAssignmentService;
exports.LeadAssignmentService = LeadAssignmentService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LeadAssignmentService);
