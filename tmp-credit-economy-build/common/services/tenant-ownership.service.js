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
exports.TenantOwnershipService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let TenantOwnershipService = class TenantOwnershipService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async assertById(model, organizationId, id, branchId) {
        if (!id)
            return null;
        const row = await this.prisma[model].findFirst({ where: { id, organizationId } });
        if (!row)
            throw new common_1.NotFoundException(`${model} not found`);
        if (branchId && row.branchId && row.branchId !== branchId) {
            throw new common_1.ForbiddenException(`${model} not in branch`);
        }
        return row;
    }
    assertCustomer(organizationId, id) { return this.assertById('customer', organizationId, id); }
    assertLead(organizationId, id, branchId) { return this.assertById('lead', organizationId, id, branchId); }
    assertEmployee(organizationId, id, branchId) { return this.assertById('employee', organizationId, id, branchId); }
    assertIntegration(organizationId, id) { return this.assertById('integration', organizationId, id); }
    assertService(organizationId, id) { return this.assertById('service', organizationId, id); }
    assertSpaRoom(organizationId, id) { return this.assertById('spaRoom', organizationId, id); }
    assertSpaBed(organizationId, id) { return this.assertById('spaBed', organizationId, id); }
    assertSpaEquipment(organizationId, id) { return this.assertById('spaEquipment', organizationId, id); }
    assertAdAccount(organizationId, id) { return this.assertById('adAccount', organizationId, id); }
    assertAdCampaign(organizationId, id) { return this.assertById('adCampaign', organizationId, id); }
    assertAdSet(organizationId, id) { return this.assertById('adSet', organizationId, id); }
    assertAdCreative(organizationId, id) { return this.assertById('adCreative', organizationId, id); }
    async validateBranchBoundRelations(organizationId, rel = {}) {
        const branchId = rel.branchId ?? null;
        if (branchId)
            await this.assertById('branch', organizationId, branchId);
        const pairs = [
            ['customerId', 'customer'], ['leadId', 'lead'], ['employeeId', 'employee'],
            ['assignedToId', 'employee'], ['serviceId', 'service'], ['leadSourceId', 'leadSource'],
            ['funnelStageId', 'funnelStage'], ['adCampaignId', 'adCampaign'],
        ];
        for (const [key, model] of pairs) {
            if (rel[key])
                await this.assertById(model, organizationId, rel[key], branchId);
        }
    }
};
exports.TenantOwnershipService = TenantOwnershipService;
exports.TenantOwnershipService = TenantOwnershipService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TenantOwnershipService);
