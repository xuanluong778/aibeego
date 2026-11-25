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
exports.CustomersService = void 0;
const database_1 = require("@marketingspa/database");
const common_1 = require("@nestjs/common");
const database_2 = require("@marketingspa/database");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../prisma/prisma.service");
const audit_service_1 = require("../audit/audit.service");
const tenant_ownership_service_1 = require("../common/services/tenant-ownership.service");
const tenant_kpi_cache_service_1 = require("../common/services/tenant-kpi-cache.service");
const pagination_util_1 = require("../common/utils/pagination.util");
let CustomersService = class CustomersService {
    prisma;
    audit;
    tenant;
    kpiCache;
    constructor(prisma, audit, tenant, kpiCache) {
        this.prisma = prisma;
        this.audit = audit;
        this.tenant = tenant;
        this.kpiCache = kpiCache;
    }
    async listSources() {
        return (0, shared_1.listCustomerSources)();
    }
    async findAll(organizationId, query) {
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        const cacheName = `list:cust:${page}:${pageSize}:${JSON.stringify({
            s: query.search,
            src: query.source,
            br: query.branchId,
            tag: query.tag,
            ls: query.leadSourceId,
            act: query.isActive,
        })}`;
        const cached = await this.kpiCache?.getJson(organizationId, cacheName);
        if (cached)
            return cached;
        const canonicalSource = query.source ? (0, shared_1.normalizeCustomerSource)(query.source) : null;
        const andFilters = [];
        if (query.source) {
            if (canonicalSource) {
                andFilters.push({
                    OR: [
                        { latestSource: canonicalSource },
                        { firstSource: canonicalSource },
                        { source: canonicalSource },
                    ],
                });
            }
            else {
                andFilters.push({ id: '00000000-0000-0000-0000-000000000000' });
            }
        }
        if (query.search) {
            andFilters.push({
                OR: [
                    { name: { contains: query.search, mode: 'insensitive' } },
                    { phone: { contains: query.search } },
                    { email: { contains: query.search, mode: 'insensitive' } },
                ],
            });
        }
        if (!query.includeTest && query.tag !== database_2.CUSTOMER_360_TEST_TAG && query.tag !== '__test__') {
            andFilters.push({
                NOT: {
                    OR: [
                        { tags: { has: database_2.CUSTOMER_360_TEST_TAG } },
                        { tags: { has: '__test__' } },
                    ],
                },
            });
        }
        const where = {
            organizationId,
            isActive: query.isActive !== undefined ? query.isActive : true,
            mergedIntoId: null,
            ...(query.branchId && { branchId: query.branchId }),
            ...(query.leadSourceId && { leadSourceId: query.leadSourceId }),
            ...(query.tag && { tags: { has: query.tag } }),
            ...(andFilters.length ? { AND: andFilters } : {}),
        };
        const [items, total] = await Promise.all([
            this.prisma.customer.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                include: { leadSource: { select: { id: true, name: true } }, branch: { select: { id: true, name: true } } },
            }),
            this.prisma.customer.count({ where }),
        ]);
        const payload = (0, pagination_util_1.buildPaginatedResult)(items, total, page, pageSize);
        await this.kpiCache?.setJson(organizationId, cacheName, payload, 8);
        return payload;
    }
    findAllLegacy(organizationId) {
        return this.prisma.customer.findMany({
            where: { organizationId, isActive: true },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
    }
    async findOne(organizationId, id) {
        const customer = await this.prisma.customer.findFirst({
            where: { id, organizationId },
            include: { leadSource: true, branch: true },
        });
        if (!customer)
            throw new common_1.NotFoundException('Khách hàng không tồn tại');
        return customer;
    }
    async getHistory(organizationId, id) {
        const customer = await this.findOne(organizationId, id);
        const [leads, appointments, orders, noteLogs] = await Promise.all([
            this.prisma.lead.findMany({
                where: { organizationId, customerId: id },
                orderBy: { createdAt: 'desc' },
                include: { leadSource: true, assignedTo: true },
            }),
            this.prisma.appointment.findMany({
                where: { organizationId, customerId: id },
                orderBy: { scheduledAt: 'desc' },
                include: { employee: true, service: true, branch: true },
            }),
            this.prisma.order.findMany({
                where: { organizationId, customerId: id },
                orderBy: { orderedAt: 'desc' },
                include: { items: true, payments: true },
            }),
            this.prisma.auditLog.findMany({
                where: {
                    organizationId,
                    entityType: 'CUSTOMER',
                    entityId: id,
                    action: 'CONSULTATION_NOTE',
                },
                orderBy: { createdAt: 'desc' },
                include: { user: { select: { id: true, name: true } } },
            }),
        ]);
        const consultationNotes = noteLogs.map((log) => ({
            id: log.id,
            content: log.metadata?.content ?? '',
            createdAt: log.createdAt.toISOString(),
            authorName: log.user?.name ?? null,
        }));
        return { customer, leads, appointments, orders, consultationNotes };
    }
    async addNote(organizationId, customerId, userId, content) {
        await this.findOne(organizationId, customerId);
        const log = await this.audit.log({
            organizationId,
            userId,
            action: 'CONSULTATION_NOTE',
            entityType: 'CUSTOMER',
            entityId: customerId,
            metadata: { content },
        });
        return {
            id: log.id,
            content,
            createdAt: log.createdAt.toISOString(),
        };
    }
    async create(organizationId, dto) {
        await this.tenant.validateBranchBoundRelations(organizationId, {
            branchId: dto.branchId,
            leadSourceId: dto.leadSourceId,
        });
        const phone = dto.phone?.trim() || null;
        const email = dto.email?.trim() || null;
        if (phone) {
            const dup = await this.prisma.customer.findFirst({
                where: { organizationId, phone, isActive: true },
                include: { leadSource: true, branch: true },
            });
            if (dup)
                return dup;
        }
        if (email) {
            const dup = await this.prisma.customer.findFirst({
                where: { organizationId, email: { equals: email, mode: 'insensitive' }, isActive: true },
                include: { leadSource: true, branch: true },
            });
            if (dup)
                return dup;
        }
        const row = await new database_1.PlanPolicy(this.prisma).resource(organizationId, 'customers', (tx) => tx.customer.count({ where: { organizationId, isActive: true } }), (tx) => tx.customer.create({
            data: {
                organizationId,
                name: dto.name,
                phone: dto.phone,
                email: dto.email,
                gender: dto.gender,
                birthday: dto.birthday ? new Date(dto.birthday) : undefined,
                note: dto.note,
                tags: dto.tags ?? [],
                source: dto.source,
                leadSourceId: dto.leadSourceId,
                branchId: dto.branchId,
            },
            include: { leadSource: true, branch: true },
        }));
        await this.kpiCache?.bump(organizationId);
        return row;
    }
    async update(organizationId, id, dto) {
        await this.findOne(organizationId, id);
        await this.tenant.validateBranchBoundRelations(organizationId, {
            branchId: dto.branchId,
            leadSourceId: dto.leadSourceId,
        });
        const row = await this.prisma.customer.update({
            where: { id },
            data: {
                ...dto,
                birthday: dto.birthday ? new Date(dto.birthday) : undefined,
            },
            include: { leadSource: true, branch: true },
        });
        await this.kpiCache?.bump(organizationId);
        return row;
    }
    async remove(organizationId, id) {
        await this.findOne(organizationId, id);
        const row = await this.prisma.customer.update({
            where: { id },
            data: { isActive: false },
        });
        await this.kpiCache?.bump(organizationId);
        return row;
    }
};
exports.CustomersService = CustomersService;
exports.CustomersService = CustomersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        tenant_ownership_service_1.TenantOwnershipService,
        tenant_kpi_cache_service_1.TenantKpiCacheService])
], CustomersService);
