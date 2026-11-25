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
exports.ContentIndustryService = exports.SPA_BEAUTY_SLUG = exports.SPA_BEAUTY_INDUSTRY_NAME = exports.SPA_BEAUTY_INDUSTRY_ID = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const roles_1 = require("../common/constants/roles");
const content_industry_constants_1 = require("./content-industry.constants");
var content_industry_constants_2 = require("./content-industry.constants");
Object.defineProperty(exports, "SPA_BEAUTY_INDUSTRY_ID", { enumerable: true, get: function () { return content_industry_constants_2.SPA_BEAUTY_INDUSTRY_ID; } });
Object.defineProperty(exports, "SPA_BEAUTY_INDUSTRY_NAME", { enumerable: true, get: function () { return content_industry_constants_2.SPA_BEAUTY_INDUSTRY_NAME; } });
Object.defineProperty(exports, "SPA_BEAUTY_SLUG", { enumerable: true, get: function () { return content_industry_constants_2.SPA_BEAUTY_SLUG; } });
function slugifyName(name) {
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || `industry-${Date.now()}`;
}
let ContentIndustryService = class ContentIndustryService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    /** Resolve display industry label for AI prompts / snapshots. */
    resolveIndustryLabel(input) {
        const custom = input.customIndustry?.trim();
        if (custom)
            return custom;
        const name = input.industryName?.trim();
        if (name)
            return name;
        return content_industry_constants_1.SPA_BEAUTY_INDUSTRY_NAME;
    }
    async listPublic(q, includeInactive = false) {
        const query = q?.trim();
        const items = await this.prisma.contentIndustry.findMany({
            where: includeInactive ? {} : { isActive: true },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        });
        const mapped = items.map((i) => ({
            id: i.id,
            slug: i.slug,
            name: i.name,
            sortOrder: i.sortOrder,
            isActive: i.isActive,
            isSystem: i.isSystem,
        }));
        // Lọc không dấu / không phân biệt hoa thường (Postgres ILIKE không đủ cho tiếng Việt)
        const needle = query ? (0, content_industry_constants_1.normalizeIndustrySearch)(query) : '';
        const filtered = needle
            ? mapped.filter((i) => (0, content_industry_constants_1.normalizeIndustrySearch)(i.name).includes(needle) ||
                (0, content_industry_constants_1.normalizeIndustrySearch)(i.slug).includes(needle))
            : mapped;
        return {
            items: filtered,
            otherOption: { ...content_industry_constants_1.CONTENT_INDUSTRY_OTHER_OPTION },
        };
    }
    async getPreference(user) {
        const [userPref, orgPref] = await Promise.all([
            this.prisma.contentMarketingPreference.findFirst({
                where: { organizationId: user.organizationId, userId: user.id },
                include: { industry: true },
            }),
            this.prisma.contentMarketingPreference.findFirst({
                where: { organizationId: user.organizationId, userId: null },
                include: { industry: true },
            }),
        ]);
        const resolved = userPref ?? orgPref ?? null;
        return {
            user: userPref
                ? {
                    industryId: userPref.industryId,
                    industryName: userPref.industry?.name ?? null,
                    customIndustry: userPref.customIndustry,
                    source: 'user',
                }
                : null,
            organization: orgPref
                ? {
                    industryId: orgPref.industryId,
                    industryName: orgPref.industry?.name ?? null,
                    customIndustry: orgPref.customIndustry,
                    source: 'organization',
                }
                : null,
            resolved: resolved
                ? {
                    industryId: resolved.industryId,
                    industryName: resolved.industry?.name ?? null,
                    customIndustry: resolved.customIndustry,
                    source: userPref ? 'user' : 'organization',
                }
                : null,
        };
    }
    async upsertPreference(user, dto) {
        const scope = dto.scope ?? 'user';
        if (scope === 'organization') {
            const can = user.role === 'SUPER_ADMIN' ||
                user.role === roles_1.SYSTEM_ROLES.OWNER ||
                user.role === roles_1.SYSTEM_ROLES.MANAGER;
            if (!can) {
                throw new common_1.ForbiddenException('Chỉ OWNER/MANAGER/SUPER_ADMIN được đặt ngành mặc định cho tổ chức');
            }
        }
        const { industryId, customIndustry, industryName } = await this.normalizeIndustryInput(dto);
        if (scope === 'organization') {
            const existing = await this.prisma.contentMarketingPreference.findFirst({
                where: { organizationId: user.organizationId, userId: null },
            });
            const row = existing
                ? await this.prisma.contentMarketingPreference.update({
                    where: { id: existing.id },
                    data: { industryId, customIndustry },
                    include: { industry: true },
                })
                : await this.prisma.contentMarketingPreference.create({
                    data: {
                        organizationId: user.organizationId,
                        userId: null,
                        industryId,
                        customIndustry,
                    },
                    include: { industry: true },
                });
            return {
                industryId: row.industryId,
                industryName: row.industry?.name ?? industryName,
                customIndustry: row.customIndustry,
                source: 'organization',
            };
        }
        const existing = await this.prisma.contentMarketingPreference.findFirst({
            where: { organizationId: user.organizationId, userId: user.id },
        });
        const row = existing
            ? await this.prisma.contentMarketingPreference.update({
                where: { id: existing.id },
                data: { industryId, customIndustry },
                include: { industry: true },
            })
            : await this.prisma.contentMarketingPreference.create({
                data: {
                    organizationId: user.organizationId,
                    userId: user.id,
                    industryId,
                    customIndustry,
                },
                include: { industry: true },
            });
        return {
            industryId: row.industryId,
            industryName: row.industry?.name ?? industryName,
            customIndustry: row.customIndustry,
            source: 'user',
        };
    }
    async adminList() {
        return this.listPublic(undefined, true);
    }
    async adminCreate(dto) {
        const name = (dto.name ?? '').trim();
        if (!name)
            throw new common_1.BadRequestException('name không được trống');
        let slug = (dto.slug?.trim() || slugifyName(name)).toLowerCase();
        const clash = await this.prisma.contentIndustry.findUnique({ where: { slug } });
        if (clash)
            slug = `${slug}-${Date.now().toString(36)}`;
        const maxSort = await this.prisma.contentIndustry.aggregate({ _max: { sortOrder: true } });
        const created = await this.prisma.contentIndustry.create({
            data: {
                name,
                slug,
                sortOrder: dto.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 10,
                isActive: dto.isActive ?? true,
                isSystem: false,
            },
        });
        return created;
    }
    async adminUpdate(id, dto) {
        const existing = await this.prisma.contentIndustry.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException('Ngành không tồn tại');
        if (dto.slug && dto.slug.trim() !== existing.slug && existing.isSystem) {
            throw new common_1.BadRequestException('Không đổi slug ngành hệ thống');
        }
        const data = {};
        if (dto.name != null)
            data.name = dto.name.trim();
        if (dto.slug != null && !existing.isSystem)
            data.slug = slugifyName(dto.slug.trim());
        if (dto.sortOrder != null)
            data.sortOrder = dto.sortOrder;
        if (dto.isActive != null)
            data.isActive = dto.isActive;
        return this.prisma.contentIndustry.update({ where: { id }, data });
    }
    /** Soft-hide only; system industries cannot be hard-deleted. */
    async adminHide(id) {
        const existing = await this.prisma.contentIndustry.findUnique({ where: { id } });
        if (!existing)
            throw new common_1.NotFoundException('Ngành không tồn tại');
        if (existing.isSystem) {
            throw new common_1.BadRequestException('Không ẩn/xóa ngành hệ thống Spa/Làm đẹp');
        }
        return this.prisma.contentIndustry.update({
            where: { id },
            data: { isActive: false },
        });
    }
    async normalizeIndustryInput(input) {
        const custom = input.customIndustry?.trim() || null;
        if (custom) {
            return { industryId: null, industryName: custom, customIndustry: custom };
        }
        if (input.industryId) {
            const row = await this.prisma.contentIndustry.findFirst({
                where: { id: input.industryId, isActive: true },
            });
            if (!row)
                throw new common_1.BadRequestException('industryId không hợp lệ hoặc đã ẩn');
            return { industryId: row.id, industryName: row.name, customIndustry: null };
        }
        if (input.industryName?.trim()) {
            return {
                industryId: null,
                industryName: input.industryName.trim(),
                customIndustry: null,
            };
        }
        return { industryId: null, industryName: null, customIndustry: null };
    }
};
exports.ContentIndustryService = ContentIndustryService;
exports.ContentIndustryService = ContentIndustryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ContentIndustryService);
