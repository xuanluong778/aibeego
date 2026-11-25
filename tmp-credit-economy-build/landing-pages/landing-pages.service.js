"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var LandingPagesService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LandingPagesService = void 0;
const plan_storage_1 = require("../common/uploads/plan-storage");
const landing_page_domain_manager_1 = require("./landing-page-domain-manager");
const common_1 = require("@nestjs/common");
const fs_1 = require("fs");
const path_1 = require("path");
const database_1 = require("@marketingspa/database");
const shared_1 = require("@marketingspa/shared");
const crypto_1 = require("crypto");
const redis_constants_1 = require("../redis/redis.constants");
const prisma_service_1 = require("../prisma/prisma.service");
const rate_limit_service_1 = require("../common/services/rate-limit.service");
const leads_service_1 = require("../leads/leads.service");
const automation_engine_service_1 = require("../crm/automation-engine.service");
const landing_page_ai_service_1 = require("./landing-page-ai.service");
const landing_page_chatbot_service_1 = require("./landing-page-chatbot.service");
const landing_page_chatbot_rollout_util_1 = require("./landing-page-chatbot-rollout.util");
const landing_page_platform_domain_1 = require("./landing-page-platform-domain");
const credit_service_1 = require("../credit/credit.service");
const template_pack_1 = require("./template-pack");
const upload_policy_1 = require("../common/uploads/upload-policy");
const landing_page_revision_1 = require("./landing-page-revision");
const landing_page_autosave_receipt_1 = require("./landing-page-autosave-receipt");
const THEME_MAP = {
    MODERN: database_1.LandingPageTheme.MODERN,
    PREMIUM: database_1.LandingPageTheme.PREMIUM,
    MINIMAL: database_1.LandingPageTheme.MINIMAL,
    BOLD: database_1.LandingPageTheme.BOLD,
    CORPORATE: database_1.LandingPageTheme.CORPORATE,
};
const LP_SOURCE_CODE = 'landing_page';
const IDEMPOTENCY_TTL_MS = 15 * 60 * 1000;
let LandingPagesService = class LandingPagesService {
    static { LandingPagesService_1 = this; }
    prisma;
    rateLimit;
    leads;
    automation;
    ai;
    credit;
    landingChatbot;
    redis;
    logger = new common_1.Logger(LandingPagesService_1.name);
    createIdem = new Map();
    generateIdem = new Map();
    /** Retain provider output even when saving conflicts with a concurrent edit. */
    generateContentIdem = new Map();
    templateContentIdem = new Map();
    templateUrlSources = new Map();
    doctorApplyIdem = new Map();
    /** Org-scoped crawl cache: key = orgId:urlHash → summary + expiry */
    urlCrawlCache = new Map();
    static URL_CRAWL_TTL_MS = 10 * 60 * 1000;
    constructor(prisma, rateLimit, leads, automation, ai, credit, landingChatbot, redis) {
        this.prisma = prisma;
        this.rateLimit = rateLimit;
        this.leads = leads;
        this.automation = automation;
        this.ai = ai;
        this.credit = credit;
        this.landingChatbot = landingChatbot;
        this.redis = redis;
    }
    purgeIdemMap(map) {
        const now = Date.now();
        for (const [k, v] of map) {
            if (v.expiresAt < now)
                map.delete(k);
        }
    }
    normalizeIdemKey(raw) {
        const key = (raw || '').trim().slice(0, 120);
        return key || null;
    }
    async withIdempotency(map, cacheKey, factory) {
        if (!cacheKey)
            return factory();
        this.purgeIdemMap(map);
        const existing = map.get(cacheKey);
        if (existing && existing.expiresAt > Date.now()) {
            if (existing.value !== undefined)
                return existing.value;
            if (existing.promise)
                return existing.promise;
        }
        const entry = { expiresAt: Date.now() + IDEMPOTENCY_TTL_MS };
        const promise = (this.redis && /^(?:lp:generate:|lp:create:|lp:brief-suggest:|lp:template-content:)/.test(cacheKey)
            ? this.withSharedAiIdempotency(cacheKey, factory)
            : factory())
            .then((value) => {
            entry.value = value;
            entry.promise = undefined;
            entry.expiresAt = Date.now() + IDEMPOTENCY_TTL_MS;
            return value;
        })
            .catch((err) => {
            map.delete(cacheKey);
            throw err;
        });
        entry.promise = promise;
        map.set(cacheKey, entry);
        return promise;
    }
    async withSharedAiIdempotency(key, factory) {
        const redis = this.redis;
        if (redis.status !== 'ready')
            throw new common_1.ServiceUnavailableException('Hệ thống đang kết nối lại. Vui lòng thử lại với yêu cầu hiện tại.');
        const lock = `${key}:lock`;
        const resultKey = `${key}:result`;
        const token = (0, crypto_1.randomUUID)();
        const deadline = Date.now() + 100_000;
        while (Date.now() < deadline) {
            const cached = await redis.get(resultKey);
            if (cached)
                return JSON.parse(cached);
            if (await redis.set(lock, token, 'PX', 180_000, 'NX')) {
                try {
                    const completed = await redis.get(resultKey);
                    if (completed)
                        return JSON.parse(completed);
                    const value = await factory();
                    await redis.set(resultKey, JSON.stringify(value), 'PX', IDEMPOTENCY_TTL_MS);
                    return value;
                }
                finally {
                    await redis.eval("if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end", 1, lock, token);
                }
            }
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        throw new common_1.ConflictException('Yêu cầu này vẫn đang xử lý. Vui lòng thử lại, hệ thống sẽ dùng lại kết quả hiện tại.');
    }
    async onModuleInit() {
        try {
            await this.ensureSystemTemplates();
        }
        catch (err) {
            this.logger.warn(`ensureSystemTemplates skipped: ${String(err)}`);
        }
    }
    templatesSyncedForVersion = null;
    /**
     * Idempotent catalog sync: upsert by slug, dedupe, remove orphans.
     * Safe across API restarts — does not grow DB rows when catalog unchanged.
     */
    async ensureSystemTemplates(opts) {
        const force = opts?.force === true;
        if (!force && this.templatesSyncedForVersion === shared_1.LANDING_PAGE_TEMPLATE_CATALOG_VERSION) {
            return { synced: shared_1.LANDING_PAGE_SYSTEM_TEMPLATES.length, skipped: true };
        }
        const catalog = shared_1.LANDING_PAGE_SYSTEM_TEMPLATES;
        const catalogSlugs = catalog.map((t) => t.slug);
        const catalogSet = new Set(catalogSlugs);
        const existing = await this.prisma.landingPageTemplate.findMany({
            where: { organizationId: null, isSystem: true },
            select: { id: true, slug: true, thumbnailUrl: true, tags: true },
        });
        // Deduplicate slug collisions (keep first, delete rest).
        const seenSlug = new Set();
        const duplicateIds = [];
        for (const row of existing) {
            if (seenSlug.has(row.slug))
                duplicateIds.push(row.id);
            else
                seenSlug.add(row.slug);
        }
        if (duplicateIds.length) {
            await this.prisma.landingPageTemplate.deleteMany({ where: { id: { in: duplicateIds } } });
            this.logger.warn(`LP templates deduped: removed ${duplicateIds.length} duplicate slug rows`);
        }
        const afterDedupe = duplicateIds.length
            ? await this.prisma.landingPageTemplate.findMany({
                where: { organizationId: null, isSystem: true },
                select: { id: true, slug: true, thumbnailUrl: true, tags: true },
            })
            : existing.filter((r) => !duplicateIds.includes(r.id));
        const packManaged = (tags) => (tags || []).includes(template_pack_1.TEMPLATE_PACK_MANAGED_TAG);
        const bySlug = new Map(afterDedupe.map((r) => [r.slug, r]));
        const unmanaged = afterDedupe.filter((r) => !packManaged(r.tags));
        const orphanIds = unmanaged.filter((r) => !catalogSet.has(r.slug)).map((r) => r.id);
        if (orphanIds.length) {
            await this.prisma.landingPageTemplate.deleteMany({ where: { id: { in: orphanIds } } });
            for (const id of orphanIds) {
                const hit = [...bySlug.entries()].find(([, v]) => v.id === id);
                if (hit)
                    bySlug.delete(hit[0]);
            }
        }
        const allPresent = catalogSlugs.every((s) => bySlug.has(s));
        const countOk = unmanaged.length === catalogSlugs.filter((s) => unmanaged.some((r) => r.slug === s)).length
            && unmanaged.every((r) => catalogSet.has(r.slug));
        const thumbsOk = unmanaged.every((r) => Boolean(r.thumbnailUrl && r.thumbnailUrl.includes(`${r.slug}-thumb.webp`)));
        let dbCatalogVersion = null;
        if (!force && allPresent && countOk) {
            const probeSlug = catalogSlugs[0];
            const probeRow = probeSlug ? bySlug.get(probeSlug) : undefined;
            if (probeRow) {
                const probe = await this.prisma.landingPageTemplate.findUnique({
                    where: { id: probeRow.id },
                    select: { definition: true },
                });
                const meta = probe?.definition?.meta;
                dbCatalogVersion = meta?.catalogVersion ?? null;
            }
        }
        // Restart-stable fast path: catalog already matches DB (no write storm).
        if (!force &&
            allPresent &&
            countOk &&
            thumbsOk &&
            dbCatalogVersion === shared_1.LANDING_PAGE_TEMPLATE_CATALOG_VERSION) {
            this.templatesSyncedForVersion = shared_1.LANDING_PAGE_TEMPLATE_CATALOG_VERSION;
            return {
                synced: catalog.length,
                skipped: true,
                reason: 'idempotent-db-match',
            };
        }
        for (const def of catalog) {
            const row = bySlug.get(def.slug);
            const data = {
                slug: def.slug,
                name: def.name,
                category: def.category,
                theme: THEME_MAP[def.theme] ?? database_1.LandingPageTheme.MODERN,
                description: def.description,
                tags: def.tags,
                thumbnailUrl: def.thumbnail?.slice(0, 2000) || null,
                definition: (0, shared_1.sanitizeLandingPageSpec)(def.spec),
                isSystem: true,
                organizationId: null,
            };
            if (row && packManaged(row.tags))
                continue;
            if (row) {
                await this.prisma.landingPageTemplate.update({
                    where: { id: row.id },
                    data: { ...data, updatedAt: new Date() },
                });
            }
            else {
                const created = await this.prisma.landingPageTemplate.create({ data });
                bySlug.set(def.slug, {
                    id: created.id,
                    slug: created.slug,
                    thumbnailUrl: created.thumbnailUrl,
                    tags: created.tags,
                });
            }
        }
        this.templatesSyncedForVersion = shared_1.LANDING_PAGE_TEMPLATE_CATALOG_VERSION;
        return { synced: catalog.length, skipped: false };
    }
    creationTemplateSpec(template, raw) {
        return this.parseSpec(raw ?? template.publishedDefinition ?? template.definition);
    }
    parseSpec(raw) {
        return (0, shared_1.sanitizeLandingPageSpec)(raw);
    }
    /**
     * Public/Preview surface: keep render-critical meta (inlineTextStyles,
     * responsiveInlineTextStyles, elementFreeLayouts, elementHidden, elementLocked,
     * layout, category, themePreset, …) and only strip builder provenance.
     * Shared by getPublicBySlug + getPublicByPreviewToken to avoid drift.
     */
    toPublicSpec(parsed) {
        const metaIn = parsed.meta;
        if (!metaIn || typeof metaIn !== 'object') {
            const { meta: _drop, ...rest } = parsed;
            void _drop;
            return rest;
        }
        const { fieldSources: _fieldSources, profileAppliedAt: _profileAppliedAt, lastAiAt: _lastAiAt, clientRevision: _clientRevision, lastAutosaveRequestId: _lastAutosaveRequestId, gallery: _gallery, ...safeMeta } = metaIn;
        void _fieldSources;
        void _profileAppliedAt;
        void _lastAiAt;
        void _clientRevision;
        void _lastAutosaveRequestId;
        void _gallery;
        const hasSafe = Object.keys(safeMeta).length > 0;
        const { meta: _meta, ...rest } = parsed;
        void _meta;
        return hasSafe ? { ...rest, meta: safeMeta } : rest;
    }
    toSharedTheme(theme) {
        const t = (theme || 'MODERN').toUpperCase();
        if (t === 'PREMIUM' || t === 'MINIMAL' || t === 'BOLD' || t === 'CORPORATE')
            return t;
        return 'MODERN';
    }
    async assertPage(organizationId, id) {
        const row = await this.prisma.landingPage.findFirst({
            where: { id, organizationId },
        });
        if (!row)
            throw new common_1.NotFoundException('Landing page không tồn tại');
        return row;
    }
    assertMutable(status) {
        if (status === database_1.LandingPageStatus.ARCHIVED) {
            throw new common_1.BadRequestException('Trang đã archive — duplicate để chỉnh sửa');
        }
    }
    serializePage(row) {
        return {
            id: row.id,
            organizationId: row.organizationId,
            createdById: row.createdById,
            templateId: row.templateId,
            name: row.name,
            slug: row.slug,
            status: row.status,
            theme: row.theme,
            draftSpec: this.parseSpec(row.draftSpec),
            publishedSpec: row.publishedSpec ? this.parseSpec(row.publishedSpec) : null,
            seoTitle: row.seoTitle,
            seoDescription: row.seoDescription,
            seoCanonical: row.seoCanonical,
            ogImage: row.ogImage,
            robotsIndex: row.robotsIndex,
            subdomainSlug: row.subdomainSlug,
            customDomain: row.customDomain,
            customDomainStatus: row.customDomainStatus,
            customDomainError: row.customDomainError,
            customDomainVerifiedAt: row.customDomainVerifiedAt ?? null,
            trackingConfig: row.trackingConfig ?? null,
            publishedAt: row.publishedAt,
            archivedAt: row.archivedAt,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            publicPath: `/p/${row.slug}`,
        };
    }
    async overview(organizationId) {
        await this.ensureSystemTemplates();
        const [total, published, draft, archived, templates] = await Promise.all([
            this.prisma.landingPage.count({
                where: { organizationId, status: { not: database_1.LandingPageStatus.ARCHIVED } },
            }),
            this.prisma.landingPage.count({
                where: { organizationId, status: database_1.LandingPageStatus.PUBLISHED },
            }),
            this.prisma.landingPage.count({
                where: { organizationId, status: database_1.LandingPageStatus.DRAFT },
            }),
            this.prisma.landingPage.count({
                where: { organizationId, status: database_1.LandingPageStatus.ARCHIVED },
            }),
            this.prisma.landingPageTemplate.count({
                where: {
                    AND: [
                        {
                            OR: [
                                { organizationId: null, isSystem: true },
                                { organizationId },
                            ],
                        },
                        {
                            OR: [
                                { publishStatus: 'PUBLISHED' },
                                { NOT: { publishedDefinition: { equals: database_1.Prisma.DbNull } } },
                            ],
                        },
                    ],
                },
            }),
        ]);
        const recent = await this.prisma.landingPage.findMany({
            where: { organizationId },
            orderBy: { updatedAt: 'desc' },
            take: 8,
            select: {
                id: true,
                name: true,
                slug: true,
                status: true,
                theme: true,
                updatedAt: true,
                publishedAt: true,
            },
        });
        return {
            total,
            published,
            draft,
            archived,
            templates,
            recent,
            defaultSubdomainHint: '{slug}.lp.aibeego.com',
        };
    }
    async listTemplates(organizationId, query, user) {
        await this.ensureSystemTemplates();
        const includeSystem = query.includeSystem !== false;
        const admin = (0, template_pack_1.isPlatformAdmin)(user);
        const q = (query.q || '').trim().toLowerCase();
        const designFamilyQ = (query.designFamily || '').trim().toLowerCase();
        const conversionGoalQ = (query.conversionGoal || '').trim().toLowerCase();
        const items = await this.prisma.landingPageTemplate.findMany({
            where: {
                ...(query.category ? { category: query.category } : {}),
                ...(query.theme ? { theme: THEME_MAP[query.theme] } : {}),
                AND: [
                    {
                        OR: [
                            ...(includeSystem ? [{ organizationId: null, isSystem: true }] : []),
                            { organizationId },
                        ],
                    },
                    ...(admin
                        ? []
                        : [
                            {
                                OR: [
                                    { publishStatus: 'PUBLISHED' },
                                    { NOT: { publishedDefinition: { equals: database_1.Prisma.DbNull } } },
                                ],
                            },
                        ]),
                ],
            },
            orderBy: [{ isSystem: 'desc' }, { category: 'asc' }, { name: 'asc' }],
        });
        const mapped = items.map((t) => {
            const visibleRaw = admin ? t.definition : (t.publishedDefinition ?? t.definition);
            const def = this.parseSpec(visibleRaw);
            const gallery = def.meta?.gallery;
            const recipe = def.meta?.architectureRecipe;
            const designFamily = (typeof def.meta?.designFamily === 'string' && def.meta.designFamily) ||
                (typeof recipe?.designFamily === 'string' && recipe.designFamily) ||
                null;
            const conversionGoal = (typeof def.meta?.conversionGoal === 'string' && def.meta.conversionGoal) ||
                (typeof recipe?.conversionGoal === 'string' && recipe.conversionGoal) ||
                null;
            const architectureId = (typeof recipe?.architectureId === 'string' && recipe.architectureId) ||
                (typeof gallery?.architecture?.id === 'string' && gallery.architecture.id) ||
                null;
            const badges = (gallery?.badges ||
                (t.tags || [])
                    .filter((x) => x.startsWith('badge:'))
                    .map((x) => x.slice(6))
                    .filter((b) => b === 'new' || b === 'popular' || b === 'high_conversion'));
            return {
                id: t.id,
                slug: t.slug,
                name: t.name,
                category: t.category,
                theme: t.theme,
                description: t.description,
                tags: t.tags,
                thumbnailUrl: def.meta?.htmlConverted
                    ? gallery?.thumbnail || null
                    : t.thumbnailUrl || gallery?.thumbnail || null,
                previewLongImage: def.meta?.htmlConverted ? null : gallery?.previewLongImage || null,
                htmlPreviewUrl: def.meta?.htmlConverted ? null : htmlPreviewPath(t.id, visibleRaw, t.updatedAt),
                badges,
                designFamily,
                conversionGoal,
                architectureId,
                isSystem: t.isSystem,
                ...(admin
                    ? {
                        publishStatus: t.publishStatus,
                        hasPublishedVersion: t.publishedDefinition != null,
                    }
                    : {}),
            };
        });
        let filtered = mapped;
        if (designFamilyQ) {
            filtered = filtered.filter((t) => (t.designFamily || '').toLowerCase() === designFamilyQ);
        }
        if (conversionGoalQ) {
            filtered = filtered.filter((t) => (t.conversionGoal || '').toLowerCase() === conversionGoalQ);
        }
        if (q) {
            filtered = filtered.filter((t) => {
                const hay = `${t.name} ${t.description} ${t.slug} ${t.category} ${t.designFamily || ''} ${t.conversionGoal || ''} ${(t.tags || []).join(' ')}`.toLowerCase();
                return hay.includes(q);
            });
        }
        return {
            items: filtered,
            total: filtered.length,
        };
    }
    async getTemplate(organizationId, idOrSlug, user) {
        await this.ensureSystemTemplates();
        const admin = (0, template_pack_1.isPlatformAdmin)(user);
        const row = await this.prisma.landingPageTemplate.findFirst({
            where: {
                OR: [
                    { id: idOrSlug, organizationId: null, isSystem: true },
                    { id: idOrSlug, organizationId },
                    { slug: idOrSlug, organizationId: null, isSystem: true },
                    { slug: idOrSlug, organizationId },
                ],
            },
        });
        if (!row)
            throw new common_1.NotFoundException('Template không tồn tại');
        if (!admin && row.publishStatus === 'DRAFT' && row.publishedDefinition == null) {
            throw new common_1.NotFoundException('Template không tồn tại');
        }
        const visibleRaw = admin ? row.definition : (row.publishedDefinition ?? row.definition);
        return {
            id: row.id,
            slug: row.slug,
            name: row.name,
            category: row.category,
            theme: row.theme,
            description: row.description,
            tags: row.tags,
            thumbnailUrl: row.thumbnailUrl,
            isSystem: row.isSystem,
            ...(admin
                ? {
                    publishStatus: row.publishStatus,
                    hasPublishedVersion: row.publishedDefinition != null,
                }
                : {}),
            definition: this.parseSpec(visibleRaw),
        };
    }
    async listPages(organizationId, query) {
        const status = !query.status || query.status === 'ALL'
            ? undefined
            : query.status;
        const q = query.q?.trim();
        const items = await this.prisma.landingPage.findMany({
            where: {
                organizationId,
                ...(status ? { status } : {}),
                ...(q
                    ? {
                        OR: [
                            { name: { contains: q, mode: 'insensitive' } },
                            { slug: { contains: q, mode: 'insensitive' } },
                        ],
                    }
                    : {}),
            },
            orderBy: { updatedAt: 'desc' },
            take: 100,
        });
        return { items: items.map((r) => this.serializePage(r)), total: items.length };
    }
    /** New page from an HTML upload becomes editable sections. The template row is not changed. */
    editableCopyFromImportedHtml(spec) {
        const next = (0, shared_1.specWithEditableHtmlSections)(spec);
        if (!next)
            return spec;
        return this.parseSpec(next);
    }
    async uniqueSlug(organizationId, base, excludeId) {
        const slug = (0, shared_1.slugifyLandingPage)(base) || `lp-${Date.now().toString(36)}`;
        // slug is unique per organization. subdomain_slug is unique across all organizations.
        const candidates = [
            slug,
            ...Array.from({ length: 39 }, (_, i) => `${slug}-${i + 2}`),
            `${slug}-${(0, crypto_1.randomUUID)().slice(0, 8)}`,
        ];
        for (const candidate of candidates) {
            const clash = await this.prisma.landingPage.findFirst({
                where: {
                    ...(excludeId ? { id: { not: excludeId } } : {}),
                    OR: [{ organizationId, slug: candidate }, { subdomainSlug: candidate }],
                },
                select: { id: true },
            });
            if (!clash)
                return candidate;
        }
        return `${slug}-${(0, crypto_1.randomUUID)().slice(0, 8)}`;
    }
    async create(user, dto) {
        if (dto.mode === 'blank' && (dto.templateId || dto.templateSlug || dto.draftSpec)) {
            throw new common_1.BadRequestException('Chỉ chọn một nguồn bản nháp.');
        }
        const idemKey = this.normalizeIdemKey(dto.idempotencyKey);
        const cacheKey = idemKey ? `lp:create:${user.organizationId}:${idemKey}` : null;
        return this.withIdempotency(this.createIdem, cacheKey, async () => {
            await this.ensureSystemTemplates();
            const blank = dto.mode === 'blank';
            let spec = blank
                ? (0, shared_1.createBlankLandingPageSpec)()
                : (0, shared_1.createEmptyLandingPageSpec)(this.toSharedTheme(dto.theme));
            let templateId = null;
            let theme = THEME_MAP[(blank ? spec.theme : dto.theme) || ''] ?? database_1.LandingPageTheme.MODERN;
            if (dto.templateId || dto.templateSlug) {
                const tpl = await this.prisma.landingPageTemplate.findFirst({
                    where: {
                        OR: [
                            ...(dto.templateId
                                ? [
                                    { id: dto.templateId, organizationId: null, isSystem: true },
                                    { id: dto.templateId, organizationId: user.organizationId },
                                ]
                                : []),
                            ...(dto.templateSlug
                                ? [
                                    { slug: dto.templateSlug, organizationId: null, isSystem: true },
                                    { slug: dto.templateSlug, organizationId: user.organizationId },
                                ]
                                : []),
                        ],
                    },
                });
                if (!tpl)
                    throw new common_1.NotFoundException('Template không tồn tại');
                const admin = (0, template_pack_1.isPlatformAdmin)(user);
                if (!admin && tpl.publishStatus === 'DRAFT' && tpl.publishedDefinition == null) {
                    throw new common_1.NotFoundException('Template không tồn tại');
                }
                templateId = tpl.id;
                theme = tpl.theme;
                // Clone a copy with fresh ids. User pages never share the template row's JSON.
                const source = admin ? tpl.definition : (tpl.publishedDefinition ?? tpl.definition);
                spec = this.editableCopyFromImportedHtml((0, shared_1.cloneLandingPageSpecWithNewIds)(this.parseSpec(source)));
            }
            if (dto.draftSpec) {
                if (dto.templateId || dto.templateSlug)
                    throw new common_1.BadRequestException('Chỉ chọn một nguồn bản nháp.');
                const candidate = (0, shared_1.sanitizeLandingPageSpec)(dto.draftSpec);
                const validation = (0, shared_1.validateLandingPageSpec)(candidate);
                if (!validation.ok)
                    throw new common_1.BadRequestException({ code: 'INVALID_SPEC', message: validation.errors.join('; ') });
                if (candidate.meta?.aiGenerationId) {
                    const existing = await this.prisma.landingPage.findFirst({ where: {
                            organizationId: user.organizationId, createdById: user.id,
                            draftSpec: { path: ['meta', 'aiGenerationId'], equals: candidate.meta.aiGenerationId },
                        } });
                    if (existing)
                        return this.serializePage(existing);
                }
                spec = candidate;
                theme = THEME_MAP[spec.theme] || database_1.LandingPageTheme.MODERN;
            }
            const seo = spec.seo;
            const insert = (slug) => this.prisma.landingPage.create({
                data: {
                    organizationId: user.organizationId,
                    createdById: user.id,
                    templateId,
                    name: dto.name.trim().slice(0, 120),
                    slug,
                    status: database_1.LandingPageStatus.DRAFT,
                    theme,
                    draftSpec: spec,
                    seoTitle: seo.title?.slice(0, 200) ?? dto.name.slice(0, 200),
                    seoDescription: seo.metaDescription?.slice(0, 500) ?? null,
                    seoCanonical: seo.canonical ?? null,
                    ogImage: seo.ogImage ?? null,
                    robotsIndex: seo.robotsIndex !== false,
                    subdomainSlug: slug,
                },
            });
            let slug = await this.uniqueSlug(user.organizationId, dto.slug || dto.name);
            try {
                return this.serializePage(await insert(slug));
            }
            catch (err) {
                if (!(err instanceof database_1.Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') {
                    throw err;
                }
                slug = await this.uniqueSlug(user.organizationId, `${dto.slug || dto.name}-${(0, crypto_1.randomUUID)().slice(0, 6)}`);
                return this.serializePage(await insert(slug));
            }
        });
    }
    async get(user, id) {
        const row = await this.assertPage(user.organizationId, id);
        return this.serializePage(row);
    }
    async update(user, id, dto) {
        const row = await this.assertPage(user.organizationId, id);
        this.assertMutable(row.status);
        let draftSpec;
        if (dto.draftSpec) {
            const sanitized = (0, shared_1.sanitizeLandingPageSpec)(dto.draftSpec);
            const validation = (0, shared_1.validateLandingPageSpec)(sanitized);
            if (!validation.ok) {
                throw new common_1.BadRequestException({
                    code: 'INVALID_SPEC',
                    message: validation.errors.join('; '),
                    errors: validation.errors,
                });
            }
            draftSpec = sanitized;
        }
        let slug = row.slug;
        if (dto.slug && dto.slug !== row.slug) {
            slug = await this.uniqueSlug(user.organizationId, dto.slug, row.id);
        }
        const theme = dto.theme ? THEME_MAP[dto.theme] ?? row.theme : row.theme;
        const updated = await this.prisma.landingPage.update({
            where: { id: row.id },
            data: {
                name: dto.name?.trim().slice(0, 120) ?? undefined,
                slug,
                theme,
                ...(draftSpec !== undefined ? { draftSpec } : {}),
                seoTitle: dto.seoTitle?.slice(0, 200),
                seoDescription: dto.seoDescription?.slice(0, 500),
                seoCanonical: dto.seoCanonical?.slice(0, 2000),
                ogImage: dto.ogImage?.slice(0, 2000),
                robotsIndex: dto.robotsIndex,
                subdomainSlug: dto.subdomainSlug
                    ? (0, shared_1.slugifyLandingPage)(dto.subdomainSlug)
                    : undefined,
                trackingConfig: dto.trackingConfig !== undefined
                    ? this.sanitizeTrackingConfig(dto.trackingConfig)
                    : undefined,
            },
        });
        return this.serializePage(updated);
    }
    async autosave(user, id, dto) {
        const row = await this.assertPage(user.organizationId, id);
        this.assertMutable(row.status);
        const rawIncoming = dto.draftSpec;
        const storedSpec = (0, shared_1.sanitizeLandingPageSpec)(row.draftSpec);
        if (storedSpec.blocks.length > 0 &&
            (!rawIncoming ||
                typeof rawIncoming !== 'object' ||
                !Array.isArray(rawIncoming.blocks))) {
            throw new common_1.BadRequestException({
                code: 'DRAFT_SPEC_INCOMPLETE',
                message: 'Autosave phải gửi nguyên draftSpec (gồm blocks/seo/theme). API không merge từng phần — dùng Builder hoặc spread draftSpec hiện có.',
            });
        }
        const incomingRevision = typeof dto.clientRevision === 'number' && Number.isFinite(dto.clientRevision)
            ? Math.floor(dto.clientRevision)
            : null;
        const baseRevision = typeof dto.baseRevision === 'number' && Number.isFinite(dto.baseRevision)
            ? Math.floor(dto.baseRevision)
            : null;
        // Sanitize outside the row lock — large specs were exceeding Prisma interactive tx timeout (5s).
        const sanitizedIncoming = (0, shared_1.sanitizeLandingPageSpec)(dto.draftSpec);
        const incomingChatbot = (0, shared_1.sanitizeLandingPageChatbotConfig)(sanitizedIncoming.chatbot);
        if (incomingChatbot?.enabled) {
            (0, landing_page_chatbot_rollout_util_1.assertLpChatbotOrgTrialAllowed)(user.organizationId);
        }
        const requestHash = dto.requestId
            ? (0, landing_page_autosave_receipt_1.hashLandingPageAutosaveRequest)({
                // Sanitizers may allocate IDs for legacy input. The submitted payload
                // must retain the same receipt even when that normalization runs again.
                draftSpec: dto.draftSpec,
                name: dto.name?.trim().slice(0, 120),
                baseRevision,
                clientRevision: incomingRevision,
            })
            : null;
        return this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id FROM landing_pages WHERE id = ${row.id} FOR UPDATE`;
            const fresh = await tx.landingPage.findFirst({ where: { id: row.id } });
            if (!fresh)
                throw new common_1.NotFoundException('Landing page not found');
            const decision = (0, landing_page_revision_1.decideLandingPageAutosave)({
                storedRevision: (0, landing_page_revision_1.readLandingPageRevision)(fresh.draftSpec),
                storedRequestId: (0, landing_page_revision_1.readLandingPageRequestId)(fresh.draftSpec),
                baseRevision,
                incomingRevision,
                requestId: dto.requestId ?? null,
                storedRequestHash: (0, landing_page_revision_1.readLandingPageRequestHash)(fresh.draftSpec),
                requestHash,
            });
            const differentUnchangedDraft = decision.action === 'unchanged' && ((0, landing_page_autosave_receipt_1.landingPageAutosaveContentKey)(sanitizedIncoming) !==
                (0, landing_page_autosave_receipt_1.landingPageAutosaveContentKey)((0, shared_1.sanitizeLandingPageSpec)(fresh.draftSpec)) ||
                (dto.name !== undefined && dto.name.trim().slice(0, 120) !== fresh.name));
            if (decision.action === 'reject' || differentUnchangedDraft) {
                return {
                    id: fresh.id,
                    updatedAt: fresh.updatedAt,
                    rejected: true,
                    reason: 'STALE_REVISION',
                    clientRevision: (0, landing_page_revision_1.readLandingPageRevision)(fresh.draftSpec),
                    requestId: dto.requestId ?? null,
                };
            }
            if (decision.action === 'idempotent' || decision.action === 'unchanged') {
                return {
                    id: fresh.id,
                    updatedAt: fresh.updatedAt,
                    rejected: false,
                    clientRevision: decision.nextRevision,
                    requestId: dto.requestId ?? null,
                };
            }
            const sanitized = sanitizedIncoming;
            sanitized.meta = {
                ...(sanitized.meta || {}),
                clientRevision: decision.nextRevision,
                ...(dto.requestId ? {
                    lastAutosaveRequestId: dto.requestId.slice(0, 64),
                    // Server-only receipt; shared spec sanitization does not trust/copy it.
                    lastAutosaveRequestHash: requestHash,
                } : {}),
            };
            const updated = await tx.landingPage.update({
                where: { id: fresh.id },
                data: {
                    draftSpec: sanitized,
                    name: dto.name?.trim().slice(0, 120) ?? undefined,
                    seoTitle: sanitized.seo.title?.slice(0, 200),
                    seoDescription: sanitized.seo.metaDescription?.slice(0, 500),
                    seoCanonical: sanitized.seo.canonical ?? undefined,
                    ogImage: sanitized.seo.ogImage ?? null,
                    robotsIndex: sanitized.seo.robotsIndex,
                    theme: THEME_MAP[sanitized.theme] ?? fresh.theme,
                },
            });
            return {
                id: updated.id,
                updatedAt: updated.updatedAt,
                draftSpec: sanitized,
                rejected: false,
                clientRevision: decision.nextRevision,
                requestId: dto.requestId ?? null,
            };
        });
    }
    /**
     * Put a local unsaved draft back after a network drop or closed tab.
     * If the server draft moved, snapshot it into version history first.
     * Never writes publishedSpec.
     */
    async recoverDraft(user, id, dto) {
        const row = await this.assertPage(user.organizationId, id);
        this.assertMutable(row.status);
        const storedRevision = (0, landing_page_revision_1.readLandingPageRevision)(row.draftSpec);
        const baseRevision = typeof dto.baseRevision === 'number' && Number.isFinite(dto.baseRevision)
            ? Math.floor(dto.baseRevision)
            : null;
        if (baseRevision === storedRevision) {
            return this.autosave(user, id, dto);
        }
        return this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id FROM landing_pages WHERE id = ${row.id} FOR UPDATE`;
            const fresh = await tx.landingPage.findFirst({ where: { id: row.id } });
            if (!fresh)
                throw new common_1.NotFoundException('Landing page not found');
            const freshRevision = (0, landing_page_revision_1.readLandingPageRevision)(fresh.draftSpec);
            const currentDraft = this.parseSpec(fresh.draftSpec);
            const incoming = (0, shared_1.sanitizeLandingPageSpec)(dto.draftSpec);
            const nextRevision = Math.max(freshRevision, (0, landing_page_revision_1.readLandingPageRevision)(incoming)) + 1;
            incoming.meta = {
                ...(incoming.meta || {}),
                clientRevision: nextRevision,
                lastAutosaveRequestId: (dto.requestId || `recover-${Date.now()}`).slice(0, 64),
            };
            let guardVersion = null;
            if (baseRevision !== freshRevision) {
                const lastVersion = await tx.landingPageVersion.findFirst({
                    where: { landingPageId: fresh.id, organizationId: user.organizationId },
                    orderBy: { version: 'desc' },
                    select: { version: true },
                });
                guardVersion = (lastVersion?.version ?? 0) + 1;
                await tx.landingPageVersion.create({
                    data: {
                        organizationId: user.organizationId,
                        landingPageId: fresh.id,
                        version: guardVersion,
                        snapshot: currentDraft,
                        note: `before-local-recovery|base=${baseRevision ?? 'none'}|stored=${freshRevision}`.slice(0, 500),
                        createdById: user.id,
                    },
                });
            }
            const updated = await tx.landingPage.update({
                where: { id: fresh.id },
                data: {
                    draftSpec: incoming,
                    name: dto.name?.trim().slice(0, 120) ?? undefined,
                },
            });
            return {
                ...this.serializePage(updated),
                rejected: false,
                clientRevision: nextRevision,
                guardVersion,
                recovered: true,
            };
        });
    }
    async publicationOptions(user, id) {
        return new landing_page_platform_domain_1.LandingPagePlatformDomains(this.prisma).options(user.organizationId, id);
    }
    async subdomainAvailability(user, id, label) {
        this.rateLimit.assertWithinLimit('lp:subdomain-check:' + user.organizationId, 90, 60000, 'Bạn kiểm tra quá nhanh. Vui lòng thử lại sau.');
        return new landing_page_platform_domain_1.LandingPagePlatformDomains(this.prisma).availability(user.organizationId, id, label);
    }
    async publish(user, id, dto) {
        const gate = await this.assertPage(user.organizationId, id);
        this.assertMutable(gate.status);
        const expected = typeof dto.clientRevision === 'number' && Number.isFinite(dto.clientRevision)
            ? Math.floor(dto.clientRevision)
            : null;
        if (dto.subdomainSlug !== undefined && dto.publicationTarget !== 'subdomain') {
            throw new common_1.BadRequestException('Hãy chọn xuất bản bằng subdomain khi nhập tên miền.');
        }
        const platform = new landing_page_platform_domain_1.LandingPagePlatformDomains(this.prisma);
        const updated = await this.prisma
            .$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id FROM landing_pages WHERE id = ${gate.id} FOR UPDATE`;
            const row = await tx.landingPage.findFirst({
                where: { id: gate.id, organizationId: user.organizationId },
            });
            if (!row)
                throw new common_1.NotFoundException('Landing page not found');
            if (row.status !== database_1.LandingPageStatus.PUBLISHED)
                await (0, database_2.assertPlanResource)(tx, user.organizationId, 'landingPages', () => tx.landingPage.count({ where: { organizationId: user.organizationId, status: database_1.LandingPageStatus.PUBLISHED } }));
            this.assertMutable(row.status);
            const storedRevision = (0, landing_page_revision_1.readLandingPageRevision)(row.draftSpec);
            const allowed = (0, landing_page_revision_1.publishRevisionAllowed)(storedRevision, expected);
            if (allowed !== 'ok') {
                throw new common_1.ConflictException({
                    code: allowed === 'not_saved' ? 'REVISION_NOT_SAVED' : 'STALE_REVISION',
                    message: allowed === 'not_saved'
                        ? 'Bản nháp chưa lưu xong — lưu lại rồi publish'
                        : 'Có bản mới hơn — tải bản mới nhất rồi publish',
                    clientRevision: storedRevision,
                });
            }
            const sanitized = (0, shared_1.sanitizeLandingPageSpec)(row.draftSpec);
            const validation = (0, shared_1.validateLandingPageSpec)(sanitized);
            if (!validation.ok) {
                throw new common_1.BadRequestException({
                    code: 'INVALID_SPEC',
                    message: validation.errors.join('; '),
                    errors: validation.errors,
                });
            }
            await this.landingChatbot.assertChatbotReadyForPublish(user.organizationId, sanitized);
            const lastVersion = await tx.landingPageVersion.findFirst({
                where: { landingPageId: row.id },
                orderBy: { version: 'desc' },
                select: { version: true },
            });
            const nextVersion = (lastVersion?.version ?? 0) + 1;
            let binding = await platform.current(row.id, tx);
            if (dto.publicationTarget === 'subdomain') {
                binding = await platform.claim(tx, user.organizationId, row.id, dto.subdomainSlug || '');
            }
            else if (dto.publicationTarget === 'path') {
                await platform.release(tx, user.organizationId, row.id);
                binding = null;
            }
            const saved = await tx.landingPage.update({
                where: { id: row.id },
                data: {
                    status: database_1.LandingPageStatus.PUBLISHED,
                    ...(binding ? { subdomainSlug: binding.label } : {}),
                    publishedSpec: sanitized,
                    draftSpec: sanitized,
                    publishedAt: new Date(),
                    seoTitle: sanitized.seo.title?.slice(0, 200),
                    seoDescription: sanitized.seo.metaDescription?.slice(0, 500),
                    seoCanonical: sanitized.seo.canonical ?? null,
                    ogImage: sanitized.seo.ogImage ?? null,
                    robotsIndex: sanitized.seo.robotsIndex !== false,
                    theme: THEME_MAP[sanitized.theme] ?? row.theme,
                },
            });
            await tx.landingPageVersion.create({
                data: {
                    organizationId: user.organizationId,
                    landingPageId: row.id,
                    version: nextVersion,
                    snapshot: sanitized,
                    note: dto.note?.slice(0, 500) ?? `Publish v${nextVersion}`,
                    createdById: user.id,
                },
            });
            return { saved, binding };
        })
            .catch((error) => {
            if (error.code === 'P2002' || (error.code === 'P2010' && error.meta?.code === '23505')) {
                throw new common_1.ConflictException({
                    code: 'SUBDOMAIN_TAKEN',
                    message: 'Tên này vừa được sử dụng. Hãy chọn subdomain khác.',
                });
            }
            throw error;
        });
        return {
            ...this.serializePage(updated.saved),
            publicUrl: updated.binding && process.env.LANDING_PAGE_PLATFORM_SUBDOMAINS_ENABLED === 'true'
                ? 'https://' + updated.binding.hostname + '/'
                : null,
            platformSubdomain: updated.binding?.label || null,
        };
    }
    async unpublish(user, id) {
        const row = await this.assertPage(user.organizationId, id);
        if (row.status !== database_1.LandingPageStatus.PUBLISHED) {
            throw new common_1.BadRequestException('Trang chưa published');
        }
        const updated = await this.prisma.landingPage.update({
            where: { id: row.id },
            data: { status: database_1.LandingPageStatus.DRAFT },
        });
        return this.serializePage(updated);
    }
    async duplicate(user, id) {
        const row = await this.assertPage(user.organizationId, id);
        const name = `${row.name} (copy)`.slice(0, 120);
        const slug = await this.uniqueSlug(user.organizationId, `${row.slug}-copy`);
        const cloned = (0, shared_1.cloneLandingPageSpecWithNewIds)(this.parseSpec(row.draftSpec));
        const created = await this.prisma.landingPage.create({
            data: {
                organizationId: user.organizationId,
                createdById: user.id,
                templateId: row.templateId,
                name,
                slug,
                status: database_1.LandingPageStatus.DRAFT,
                theme: row.theme,
                draftSpec: cloned,
                seoTitle: row.seoTitle,
                seoDescription: row.seoDescription,
                seoCanonical: null,
                ogImage: row.ogImage,
                robotsIndex: row.robotsIndex,
                subdomainSlug: slug,
            },
        });
        return this.serializePage(created);
    }
    async archive(user, id) {
        const row = await this.assertPage(user.organizationId, id);
        const updated = await this.prisma.landingPage.update({
            where: { id: row.id },
            data: {
                status: database_1.LandingPageStatus.ARCHIVED,
                archivedAt: new Date(),
            },
        });
        return this.serializePage(updated);
    }
    async delete(user, id) {
        const row = await this.assertPage(user.organizationId, id);
        await this.prisma.landingPage.delete({
            where: { id: row.id },
        });
        return { success: true, id: row.id };
    }
    async bulkDelete(user, ids) {
        if (!Array.isArray(ids) || !ids.length)
            return { success: true, deletedCount: 0 };
        const res = await this.prisma.landingPage.deleteMany({
            where: {
                organizationId: user.organizationId,
                id: { in: ids },
            },
        });
        return { success: true, deletedCount: res.count };
    }
    async listDomains(organizationId) { return landing_page_domain_manager_1.domainMethods.listDomains.call(this, organizationId); }
    async upsertDomain(user, id, dto) { return landing_page_domain_manager_1.domainMethods.upsertDomain.call(this, user, id, dto); }
    async verifyDomain(user, id) { return landing_page_domain_manager_1.domainMethods.verifyDomain.call(this, user, id); }
    async removeDomain(user, id) { return landing_page_domain_manager_1.domainMethods.removeDomain.call(this, user, id); }
    async resolveDomainHost(host) { return landing_page_domain_manager_1.domainMethods.resolveDomainHost.call(this, host); }
    async domainOrganization(host, slug, requested) { return landing_page_domain_manager_1.domainMethods.domainOrganization.call(this, host, slug, requested); }
    sanitizeTrackingConfig(input) {
        const str = (v, max) => typeof v === 'string' ? v.replace(/[<>]/g, '').trim().slice(0, max) : '';
        return {
            ga4MeasurementId: str(input.ga4MeasurementId, 32) || null,
            googleAdsId: str(input.googleAdsId, 40) || null,
            metaPixelId: str(input.metaPixelId, 40) || null,
            /** Architecture stubs — not executed server-side in Phase 2 */
            metaCapiReady: input.metaCapiReady === true,
            tiktokPixelReady: input.tiktokPixelReady === true,
        };
    }
    serializeBusinessProfile(row) {
        return {
            id: row.id,
            organizationId: row.organizationId,
            brandName: row.brandName,
            companyName: row.companyName,
            website: row.website,
            industry: row.industry,
            description: row.description,
            productService: row.productService,
            targetCustomer: row.targetCustomer,
            usp: row.usp,
            hotline: row.hotline,
            email: row.email,
            address: row.address,
            logoUrl: row.logoUrl,
            brandColor: row.brandColor,
            facebookUrl: row.facebookUrl,
            socialLinks: row.socialLinks && typeof row.socialLinks === 'object' && !Array.isArray(row.socialLinks)
                ? row.socialLinks
                : null,
            defaultCta: row.defaultCta,
            updatedAt: row.updatedAt,
            isEmpty: (0, shared_1.isBusinessProfileEmpty)({
                brandName: row.brandName,
                companyName: row.companyName,
                website: row.website,
                productService: row.productService,
                targetCustomer: row.targetCustomer,
                usp: row.usp,
                hotline: row.hotline,
                email: row.email,
            }),
        };
    }
    /** Get or seed BusinessProfile for current tenant only. */
    async getBusinessProfile(organizationId) {
        let row = await this.prisma.businessProfile.findUnique({ where: { organizationId } });
        if (!row) {
            const org = await this.prisma.organization.findUnique({
                where: { id: organizationId },
                select: { id: true, name: true, phone: true, email: true, address: true },
            });
            if (!org || org.id !== organizationId) {
                throw new common_1.NotFoundException('Organization không tồn tại');
            }
            row = await this.prisma.businessProfile.create({
                data: {
                    organizationId,
                    brandName: org.name.slice(0, 120),
                    companyName: org.name.slice(0, 160),
                    hotline: org.phone?.slice(0, 40) || null,
                    email: org.email?.slice(0, 160) || null,
                    address: org.address?.slice(0, 500) || null,
                },
            });
        }
        return this.serializeBusinessProfile(row);
    }
    async upsertBusinessProfile(user, dto) {
        const organizationId = user.organizationId;
        const str = (v, max) => typeof v === 'string' ? v.replace(/[<>]/g, '').trim().slice(0, max) || null : undefined;
        const data = {
            brandName: str(dto.brandName, 120),
            companyName: str(dto.companyName, 160),
            website: str(dto.website, 2000),
            industry: str(dto.industry, 120),
            description: str(dto.description, 4000),
            productService: str(dto.productService, 400),
            targetCustomer: str(dto.targetCustomer, 400),
            usp: str(dto.usp, 800),
            hotline: str(dto.hotline, 40),
            email: str(dto.email, 160),
            address: str(dto.address, 500),
            logoUrl: str(dto.logoUrl, 2000),
            brandColor: str(dto.brandColor, 32),
            facebookUrl: str(dto.facebookUrl, 2000),
            defaultCta: str(dto.defaultCta, 80),
            socialLinks: dto.socialLinks && typeof dto.socialLinks === 'object'
                ? dto.socialLinks
                : undefined,
        };
        const row = await this.prisma.businessProfile.upsert({
            where: { organizationId },
            create: {
                organizationId,
                brandName: data.brandName ?? null,
                companyName: data.companyName ?? null,
                website: data.website ?? null,
                industry: data.industry ?? null,
                description: data.description ?? null,
                productService: data.productService ?? null,
                targetCustomer: data.targetCustomer ?? null,
                usp: data.usp ?? null,
                hotline: data.hotline ?? null,
                email: data.email ?? null,
                address: data.address ?? null,
                logoUrl: data.logoUrl ?? null,
                brandColor: data.brandColor ?? null,
                facebookUrl: data.facebookUrl ?? null,
                defaultCta: data.defaultCta ?? null,
                socialLinks: data.socialLinks,
            },
            update: Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)),
        });
        return this.serializeBusinessProfile(row);
    }
    async applyBusinessProfileToPage(user, pageId, dto) {
        const row = await this.assertPage(user.organizationId, pageId);
        this.assertMutable(row.status);
        const profile = await this.getBusinessProfile(user.organizationId);
        if (profile.isEmpty) {
            throw new common_1.BadRequestException({
                code: 'BUSINESS_PROFILE_EMPTY',
                message: 'Chưa có thông tin doanh nghiệp — hãy bổ sung Business Profile trước',
            });
        }
        const prev = this.parseSpec(row.draftSpec);
        const nextSpec = (0, shared_1.applyBusinessProfileToSpec)(prev, profile, {
            force: dto.force === true,
            pageGoal: dto.pageGoal || 'lead',
        });
        const updated = await this.prisma.landingPage.update({
            where: { id: row.id },
            data: {
                draftSpec: nextSpec,
                seoTitle: nextSpec.seo.title.slice(0, 200),
                seoDescription: nextSpec.seo.metaDescription.slice(0, 500),
                ...(profile.brandColor
                    ? { theme: THEME_MAP[nextSpec.theme] ?? row.theme }
                    : {}),
            },
        });
        return this.serializePage(updated);
    }
    /**
     * Inline field AI — suggest 3 options only; never writes draftSpec.
     * Tenant-scoped via assertPage + BusinessProfile of same org.
     * Rate-limited per user+org; skips OpenAI on empty input; logs usage for metering.
     */
    async suggestInlineField(user, pageId, dto) {
        await this.assertPage(user.organizationId, pageId);
        const started = Date.now();
        const content = dto.currentContent || '';
        const blockContext = dto.blockContext || '';
        const contentHash = (0, shared_1.hashInlineAiFieldContent)(`${content}\n${blockContext}`);
        // Cost / abuse guards
        this.rateLimit.assertWithinLimit(`lp:inline-ai:u:${user.organizationId}:${user.id}`, 20, 60_000, 'Quá nhiều yêu cầu AI field — thử lại sau 1 phút');
        this.rateLimit.assertWithinLimit(`lp:inline-ai:o:${user.organizationId}`, 80, 60_000, 'Tổ chức đang gửi quá nhiều AI field — thử lại sau');
        // Replay / double-submit same field+action+content within 3s
        this.rateLimit.assertWithinLimit(`lp:inline-ai:d:${user.organizationId}:${user.id}:${dto.fieldKind}:${dto.action}:${contentHash}`, 1, 3_000, 'Đang xử lý — tránh gửi trùng');
        let profile = null;
        if (dto.useBusinessProfile !== false) {
            try {
                const p = await this.getBusinessProfile(user.organizationId);
                if (!p.isEmpty) {
                    profile = {
                        brandName: p.brandName,
                        companyName: p.companyName,
                        website: p.website,
                        industry: p.industry,
                        description: p.description,
                        productService: p.productService,
                        targetCustomer: p.targetCustomer,
                        usp: p.usp,
                        hotline: p.hotline,
                        email: p.email,
                        address: p.address,
                        logoUrl: p.logoUrl,
                        brandColor: p.brandColor,
                        facebookUrl: p.facebookUrl,
                        socialLinks: p.socialLinks,
                        defaultCta: p.defaultCta,
                    };
                }
            }
            catch {
                profile = null;
            }
        }
        const request = {
            action: dto.action,
            fieldKind: dto.fieldKind,
            currentContent: content,
            blockType: (dto.blockType || 'Hero'),
            pageGoal: (dto.pageGoal || 'lead'),
            blockContext,
            useBusinessProfile: dto.useBusinessProfile !== false,
        };
        const skipOpenAi = (0, shared_1.shouldSkipOpenAiInlineSuggest)(content) && !blockContext.trim() && !profile?.productService?.trim();
        let out;
        if (skipOpenAi) {
            out = await this.ai.suggestField(request, profile);
        }
        else {
            try {
                const paid = await this.credit.runPaidFeature({
                    organizationId: user.organizationId,
                    featureCode: shared_1.CREDIT_FEATURE_CODES.LANDING_PAGE_INLINE_AI,
                    referenceId: `lp.inline-ai:${pageId}:${user.id}:${(0, crypto_1.randomUUID)()}`,
                    reason: 'Landing page field AI suggest',
                    metadata: {
                        pageId,
                        fieldKind: dto.fieldKind,
                        action: dto.action,
                        blockType: dto.blockType || 'Hero',
                    },
                    fn: async (ctx) => {
                        return this.ai.suggestFieldStrict(request, profile);
                    },
                });
                out = { result: paid.result, source: 'ai' };
            }
            catch (err) {
                if ((0, credit_service_1.isInsufficientCredits)(err))
                    throw err;
                this.logger.warn(`Inline AI paid path failed, fallback: ${String(err)}`);
                out = await this.ai.suggestField(request, profile);
                if (!out.warning) {
                    out = {
                        ...out,
                        warning: err instanceof Error ? err.message : 'AI tạm lỗi — dùng fallback',
                    };
                }
            }
        }
        this.logger.log(JSON.stringify({
            event: 'lp_inline_ai_usage',
            organizationId: user.organizationId,
            userId: user.id,
            pageId,
            fieldKind: dto.fieldKind,
            action: dto.action,
            blockType: dto.blockType || 'Hero',
            source: out.source,
            contentHash,
            contentLen: content.length,
            skippedOpenAi: skipOpenAi,
            latencyMs: Date.now() - started,
        }));
        return {
            options: out.result.options,
            source: out.source,
            warning: out.warning,
            fieldKind: out.result.fieldKind,
            action: out.result.action,
            schemaVersion: out.result.schemaVersion,
            mode: out.result.mode,
            contentHash,
        };
    }
    /**
     * SSRF-safe public URL crawl → structured summary for Create-from-URL preview.
     * Soft-safe: never throws SSRF internals to client as stack; crawl errors are typed.
     */
    async crawlPublicUrl(user, dto, templateMode = false) {
        const url = (dto.url || '').trim();
        await this.assertTemplateContentLimit(`lp:crawl:u:${user.organizationId}:${user.id}`, 10, 60_000, 'Quá nhiều lần phân tích URL — thử lại sau');
        await this.assertTemplateContentLimit(`lp:crawl:o:${user.organizationId}`, 40, 60_000, 'Tổ chức đang phân tích URL quá nhiều');
        const cacheKey = `${user.organizationId}:${templateMode ? 'template:' : ''}${(0, shared_1.hashInlineAiFieldContent)(url)}`;
        const cached = this.urlCrawlCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return { summary: cached.summary, content: cached.content, cached: true };
        }
        try {
            const { fetchPublicHtmlSafe } = await Promise.resolve().then(() => __importStar(require('@marketingspa/shared/dist/ssrf-fetch')));
            const fetched = await fetchPublicHtmlSafe(url, {
                timeoutMs: 12000,
                maxBytes: 1_000_000,
                skipCommerceHostBlock: true,
                includeHtml: true,
            });
            const summary = (0, shared_1.extractLandingPageUrlSummary)({
                sourceUrl: url,
                finalUrl: fetched.finalUrl,
                title: fetched.title,
                text: fetched.text,
                html: fetched.html,
            });
            const content = templateMode ? (0, shared_1.extractTemplateUrlSource)(fetched.html || '', url, fetched.finalUrl) : undefined;
            this.urlCrawlCache.set(cacheKey, {
                expiresAt: Date.now() + LandingPagesService_1.URL_CRAWL_TTL_MS,
                summary,
                content,
            });
            // Purge stale cache entries opportunistically
            if (this.urlCrawlCache.size > 200) {
                const now = Date.now();
                for (const [k, v] of this.urlCrawlCache) {
                    if (v.expiresAt < now)
                        this.urlCrawlCache.delete(k);
                }
                while (this.urlCrawlCache.size > 200)
                    this.urlCrawlCache.delete(this.urlCrawlCache.keys().next().value);
            }
            return { summary, content, cached: false };
        }
        catch (err) {
            const code = err && typeof err === 'object' && 'code' in err
                ? String(err.code || 'FETCH_FAILED')
                : 'FETCH_FAILED';
            const message = err instanceof Error ? err.message : 'Không phân tích được URL';
            throw new common_1.BadRequestException({
                code: code.startsWith('SSRF') || code === 'PRIVATE_IP' || code === 'LOCALHOST' || code === 'METADATA' || code === 'BAD_SCHEME' || code === 'EMPTY_URL' || code === 'INVALID_URL'
                    ? 'SSRF_BLOCKED'
                    : code,
                message,
            });
        }
    }
    async readTemplateContentUrl(user, pageId, dto) {
        await this.templateContentPage(user, pageId);
        const crawled = await this.crawlPublicUrl(user, dto, true);
        if (!crawled.content)
            throw new common_1.BadRequestException('Không đọc được nội dung chính. Hãy nhập thủ công.');
        const source = { ...crawled.content, sourceId: (0, crypto_1.randomUUID)() };
        const key = `${user.organizationId}:${user.id}:${pageId}:${source.sourceId}`;
        if (this.redis) {
            this.assertTemplateRedisReady();
            await this.redis.set(`lp:template-source:${key}`, JSON.stringify(source), 'PX', IDEMPOTENCY_TTL_MS);
        }
        else {
            const now = Date.now();
            for (const [id, receipt] of this.templateUrlSources)
                if (receipt.expiresAt <= now)
                    this.templateUrlSources.delete(id);
            this.templateUrlSources.set(key, { source, expiresAt: now + IDEMPOTENCY_TTL_MS });
            while (this.templateUrlSources.size > 100)
                this.templateUrlSources.delete(this.templateUrlSources.keys().next().value);
        }
        return { source, brief: (0, shared_1.templateUrlBrief)(source) };
    }
    assertTemplateRedisReady() {
        if (this.redis && this.redis.status !== 'ready')
            throw new common_1.ServiceUnavailableException('Hệ thống đang kết nối lại. Vui lòng thử lại sau.');
    }
    /** Shared atomic quota across API replicas; local mode remains available without Redis. */
    async assertTemplateContentLimit(key, limit, windowMs, message) {
        if (!this.redis)
            return this.rateLimit.assertWithinLimit(key, limit, windowMs, message);
        this.assertTemplateRedisReady();
        const count = Number(await this.redis.eval("local n=redis.call('incr',KEYS[1]); if n==1 then redis.call('pexpire',KEYS[1],ARGV[1]) end; return n", 1, `lp:quota:${key}`, windowMs));
        if (count > limit)
            throw new common_1.HttpException(message || 'Quá nhiều yêu cầu. Vui lòng thử lại sau.', common_1.HttpStatus.TOO_MANY_REQUESTS);
    }
    async templateUrlSource(user, pageId, sourceId) {
        const key = `${user.organizationId}:${user.id}:${pageId}:${sourceId}`;
        if (this.redis) {
            this.assertTemplateRedisReady();
            const raw = await this.redis.get(`lp:template-source:${key}`);
            if (raw)
                return JSON.parse(raw);
        }
        const receipt = this.templateUrlSources.get(key);
        if (this.redis || !receipt || receipt.expiresAt <= Date.now()) {
            this.templateUrlSources.delete(key);
            throw new common_1.BadRequestException({ code: 'URL_SOURCE_EXPIRED', message: 'Nội dung URL đã hết hạn hoặc không thuộc phiên này. Đọc lại URL hoặc chuyển sang nhập thủ công.' });
        }
        return receipt.source;
    }
    async importTemplateUrlImage(user, pageId, dto) {
        await this.templateContentPage(user, pageId);
        const source = await this.templateUrlSource(user, pageId, dto.sourceId);
        if (!source.images.some(image => image.url === dto.imageUrl))
            throw new common_1.BadRequestException('Ảnh không thuộc trang nguồn đã đọc.');
        await this.assertTemplateContentLimit(`lp:url-image:${user.organizationId}:${user.id}`, 10, 60_000, 'Nhập ảnh quá nhanh. Vui lòng thử lại sau một phút.');
        try {
            const { fetchPublicImageSafe } = await Promise.resolve().then(() => __importStar(require('@marketingspa/shared/dist/ssrf-fetch')));
            const file = await fetchPublicImageSafe(dto.imageUrl);
            const upload = await this.uploadPublicImage(user, pageId, file);
            const library = await this.listMedia(user, pageId, { scope: 'org' });
            return { image: library.items.find(image => image.url === upload.url), sourceUrl: source.sourceUrl, originalImageUrl: dto.imageUrl };
        }
        catch (error) {
            throw new common_1.BadRequestException({ code: 'URL_IMAGE_FAILED', message: 'Không nhập được ảnh công khai này. Bạn có thể tải ảnh lên thư viện theo cách thông thường.' });
        }
    }
    async runPageDoctor(user, pageId) {
        const row = await this.assertPage(user.organizationId, pageId);
        this.rateLimit.assertWithinLimit(`lp:doctor:u:${user.organizationId}:${user.id}`, 15, 60_000, 'Quá nhiều lần Page Doctor — thử lại sau');
        const spec = this.parseSpec(row.draftSpec);
        const report = (0, shared_1.analyzeLandingPageHeuristic)(spec);
        this.logger.log(JSON.stringify({
            event: 'lp_page_doctor',
            organizationId: user.organizationId,
            userId: user.id,
            pageId,
            overallScore: report.overallScore,
            patchCount: report.patches.length,
        }));
        return { report };
    }
    /**
     * Apply selected Page Doctor patches.
     * - Snapshot draft BEFORE mutate (append-only version history).
     * - All-or-nothing: no partial patch write.
     * - Idempotent via idempotencyKey (no duplicate snapshot / no double apply).
     * - Never touches tracking / domain / publish / publishedSpec.
     */
    async applyPageDoctor(user, pageId, dto) {
        const idemKey = this.normalizeIdemKey(dto.idempotencyKey);
        const cacheKey = idemKey
            ? `lp:doctor-apply:${user.organizationId}:${pageId}:${idemKey}`
            : null;
        return this.withIdempotency(this.doctorApplyIdem, cacheKey, async () => {
            const row = await this.assertPage(user.organizationId, pageId);
            this.assertMutable(row.status);
            const ids = Array.isArray(dto.selectedPatchIds)
                ? dto.selectedPatchIds.map(String).slice(0, 20)
                : [];
            if (!ids.length) {
                throw new common_1.BadRequestException({
                    code: 'NO_PATCHES',
                    message: 'Chọn ít nhất 1 đề xuất để Apply',
                });
            }
            let report;
            try {
                report = shared_1.landingPageDoctorReportSchema.parse(dto.report);
            }
            catch {
                throw new common_1.BadRequestException({
                    code: 'AI_MALFORMED',
                    message: 'Report Page Doctor không hợp lệ — không Apply. Bản nháp không đổi.',
                });
            }
            // Safety: never apply patches that look like tracking/domain/publish
            const safePatches = report.patches.filter((p) => !/tracking|domain|publish|pixel|ga4|metaPixel/i.test(p.path) &&
                !/tracking|domain|publish/i.test(p.kind));
            const prev = this.parseSpec(row.draftSpec);
            const nextSpec = (0, shared_1.applyLandingPageDoctorPatches)(prev, safePatches, ids);
            const lastVersion = await this.prisma.landingPageVersion.findFirst({
                where: { landingPageId: row.id, organizationId: user.organizationId },
                orderBy: { version: 'desc' },
                select: { version: true },
            });
            const snapshotVersion = (lastVersion?.version ?? 0) + 1;
            const patchNote = `page-doctor-before-apply|v=${snapshotVersion}|patches=${ids.join(',').slice(0, 200)}`;
            const [, updated] = await this.prisma.$transaction([
                this.prisma.landingPageVersion.create({
                    data: {
                        organizationId: user.organizationId,
                        landingPageId: row.id,
                        version: snapshotVersion,
                        snapshot: prev,
                        note: patchNote.slice(0, 500),
                        createdById: user.id,
                    },
                }),
                this.prisma.landingPage.update({
                    where: { id: row.id },
                    data: {
                        draftSpec: nextSpec,
                        seoTitle: nextSpec.seo.title.slice(0, 200),
                        seoDescription: nextSpec.seo.metaDescription.slice(0, 500),
                    },
                }),
            ]);
            this.logger.log(JSON.stringify({
                event: 'lp_page_doctor_apply',
                organizationId: user.organizationId,
                userId: user.id,
                pageId,
                snapshotVersion,
                patchIds: ids,
                idempotencyKey: idemKey || null,
            }));
            return {
                ...this.serializePage(updated),
                undoVersion: snapshotVersion,
                canUndo: true,
            };
        });
    }
    async listPageVersions(user, pageId) {
        const page = await this.assertPage(user.organizationId, pageId);
        const rows = await this.prisma.landingPageVersion.findMany({
            where: { landingPageId: pageId, organizationId: user.organizationId },
            orderBy: { version: 'desc' },
            take: 50,
            select: {
                id: true,
                version: true,
                note: true,
                createdById: true,
                createdAt: true,
            },
        });
        const editorIds = [...new Set(rows.map((r) => r.createdById).filter(Boolean))];
        const editors = editorIds.length > 0
            ? await this.prisma.user.findMany({
                where: { id: { in: editorIds }, organizationId: user.organizationId },
                select: { id: true, name: true, email: true },
            })
            : [];
        const editorMap = Object.fromEntries(editors.map((e) => [e.id, e]));
        const versions = rows.map((r) => {
            const note = r.note || '';
            const kind = /^Publish\b/i.test(note)
                ? 'published'
                : /before-restore|restore/i.test(note)
                    ? 'restore_guard'
                    : 'draft';
            const editor = r.createdById ? editorMap[r.createdById] : null;
            return {
                ...r,
                kind,
                editorName: editor?.name || null,
                editorEmail: editor?.email || null,
                previewHint: kind === 'published' ? 'published snapshot' : 'draft snapshot',
            };
        });
        return {
            pageStatus: page.status,
            publishedAt: page.publishedAt,
            versions,
        };
    }
    async getPageVersion(user, pageId, version) {
        await this.assertPage(user.organizationId, pageId);
        const row = await this.prisma.landingPageVersion.findFirst({
            where: {
                landingPageId: pageId,
                organizationId: user.organizationId,
                version,
            },
        });
        if (!row)
            throw new common_1.NotFoundException('Version không tồn tại');
        const editor = row.createdById
            ? await this.prisma.user.findFirst({
                where: { id: row.createdById, organizationId: user.organizationId },
                select: { id: true, name: true, email: true },
            })
            : null;
        const note = row.note || '';
        const kind = /^Publish\b/i.test(note)
            ? 'published'
            : /before-restore|restore/i.test(note)
                ? 'restore_guard'
                : 'draft';
        return {
            id: row.id,
            version: row.version,
            note: row.note,
            createdAt: row.createdAt,
            createdById: row.createdById,
            kind,
            editorName: editor?.name || null,
            editorEmail: editor?.email || null,
            snapshot: this.parseSpec(row.snapshot),
            readOnly: true,
        };
    }
    /** Issue / rotate opaque draft-preview token (read-only public URL). */
    async issuePreviewToken(user, pageId, opts) {
        const row = await this.assertPage(user.organizationId, pageId);
        this.assertMutable(row.status);
        const hours = typeof opts?.expiresInHours === 'number' &&
            Number.isFinite(opts.expiresInHours) &&
            opts.expiresInHours > 0
            ? Math.min(24 * 30, Math.max(1, Math.floor(opts.expiresInHours)))
            : 72;
        const token = (0, crypto_1.randomBytes)(32).toString('hex');
        const expiresAt = new Date(Date.now() + hours * 3600_000);
        await this.prisma.landingPage.update({
            where: { id: row.id },
            data: { previewToken: token, previewExpiresAt: expiresAt },
        });
        this.logger.log(JSON.stringify({
            event: 'lp_preview_token_issue',
            organizationId: user.organizationId,
            userId: user.id,
            pageId,
            expiresAt: expiresAt.toISOString(),
        }));
        return {
            token,
            expiresAt,
            previewPath: `/p/preview/${token}`,
            robotsIndex: false,
        };
    }
    async revokePreviewToken(user, pageId) {
        await this.assertPage(user.organizationId, pageId);
        await this.prisma.landingPage.update({
            where: { id: pageId },
            data: { previewToken: null, previewExpiresAt: null },
        });
        return { ok: true };
    }
    async getPreviewTokenStatus(user, pageId) {
        const row = await this.assertPage(user.organizationId, pageId);
        const active = Boolean(row.previewToken) &&
            Boolean(row.previewExpiresAt) &&
            row.previewExpiresAt.getTime() > Date.now();
        return {
            active,
            expiresAt: row.previewExpiresAt,
            previewPath: active && row.previewToken ? `/p/preview/${row.previewToken}` : null,
            robotsIndex: false,
        };
    }
    /** Public draft preview by token — never indexes; uses draftSpec only. */
    async getPublicByPreviewToken(token, ip) {
        const clean = String(token || '')
            .replace(/[^a-f0-9]/gi, '')
            .slice(0, 64);
        if (clean.length < 32) {
            throw new common_1.NotFoundException('Preview không hợp lệ hoặc đã hết hạn');
        }
        this.rateLimit.assertWithinLimit(`lp:preview:ip:${ip || 'na'}`, 60, 60_000, 'Quá nhiều yêu cầu preview');
        this.rateLimit.assertWithinLimit(`lp:preview:tok:${clean.slice(0, 16)}`, 40, 60_000, 'Preview token bị thử quá nhiều');
        const row = await this.prisma.landingPage.findFirst({
            where: {
                previewToken: clean,
                previewExpiresAt: { gt: new Date() },
                status: { not: database_1.LandingPageStatus.ARCHIVED },
            },
        });
        if (!row) {
            throw new common_1.NotFoundException('Preview không hợp lệ hoặc đã hết hạn');
        }
        const parsed = this.parseSpec(row.draftSpec);
        // Strip builder provenance only — keep inlineTextStyles / free-layouts / hidden / locked.
        const spec = this.toPublicSpec(parsed);
        const cbCfg = (0, shared_1.sanitizeLandingPageChatbotConfig)(spec.chatbot);
        const chatbotConfig = await this.buildPublicChatbotConfig(row, cbCfg, { preview: true });
        return {
            id: row.id,
            slug: row.slug,
            name: row.name,
            theme: row.theme,
            spec,
            chatbotConfig,
            isPreview: true,
            seo: {
                title: `[Preview] ${row.seoTitle || spec.seo.title || row.name}`,
                description: row.seoDescription || spec.seo.metaDescription || '',
                canonical: null,
                ogImage: null,
                robotsIndex: false,
            },
            trackingConfig: null,
            publishedAt: null,
        };
    }
    /**
     * Restore a prior version into draftSpec only.
     * Creates a NEW version of the current draft first (append-only history).
     * Does not rollback tracking / domain / publish / publishedSpec.
     */
    async restorePageVersion(user, pageId, version, dto) {
        const row = await this.assertPage(user.organizationId, pageId);
        this.assertMutable(row.status);
        const target = await this.prisma.landingPageVersion.findFirst({
            where: {
                landingPageId: pageId,
                organizationId: user.organizationId,
                version,
            },
        });
        if (!target) {
            throw new common_1.NotFoundException('Version không tồn tại trong tổ chức này');
        }
        const restoredSpec = this.parseSpec(target.snapshot);
        const restoredSnapshotRevision = (0, landing_page_revision_1.readLandingPageRevision)(restoredSpec);
        const { updated, guardVersion, nextClientRevision } = await this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id FROM landing_pages WHERE id = ${row.id} FOR UPDATE`;
            const fresh = await tx.landingPage.findFirst({ where: { id: row.id } });
            if (!fresh)
                throw new common_1.NotFoundException('Landing page not found');
            const currentDraft = this.parseSpec(fresh.draftSpec);
            const nextClientRevision = Math.max((0, landing_page_revision_1.readLandingPageRevision)(currentDraft), restoredSnapshotRevision) + 1;
            restoredSpec.meta = {
                ...(restoredSpec.meta || {}),
                clientRevision: nextClientRevision,
            };
            delete restoredSpec.meta.lastAutosaveRequestId;
            const lastVersion = await tx.landingPageVersion.findFirst({
                where: { landingPageId: row.id, organizationId: user.organizationId },
                orderBy: { version: 'desc' },
                select: { version: true },
            });
            const guardVersion = (lastVersion?.version ?? 0) + 1;
            const note = (dto?.note || `before-restore-v${version}|from=${guardVersion}`).slice(0, 500);
            await tx.landingPageVersion.create({
                data: {
                    organizationId: user.organizationId,
                    landingPageId: row.id,
                    version: guardVersion,
                    snapshot: currentDraft,
                    note,
                    createdById: user.id,
                },
            });
            const updated = await tx.landingPage.update({
                where: { id: row.id },
                data: {
                    draftSpec: restoredSpec,
                    seoTitle: restoredSpec.seo.title.slice(0, 200),
                    seoDescription: restoredSpec.seo.metaDescription.slice(0, 500),
                    // publishedSpec, domain, status, and tracking stay as they are.
                },
            });
            return { updated, guardVersion, nextClientRevision };
        });
        this.logger.log(JSON.stringify({
            event: 'lp_page_version_restore',
            organizationId: user.organizationId,
            userId: user.id,
            pageId,
            restoredVersion: version,
            guardVersion,
            clientRevision: nextClientRevision,
        }));
        return {
            ...this.serializePage(updated),
            restoredFromVersion: version,
            guardVersion,
            clientRevision: nextClientRevision,
        };
    }
    async suggestAiBrief(user, dto) {
        const input = (0, shared_1.normalizeLandingPageBriefSuggestInput)(dto);
        if (!input.productService && !input.businessType)
            throw new common_1.BadRequestException('Nhập ngành hoặc sản phẩm / dịch vụ trước khi lấy gợi ý.');
        const key = this.normalizeIdemKey(dto.idempotencyKey);
        if (!key)
            throw new common_1.BadRequestException('Thiếu mã yêu cầu. Vui lòng thử lại.');
        return this.withIdempotency(this.generateIdem, `lp:brief-suggest:${user.organizationId}:${user.id}:${input.field}:${key}`, async () => {
            this.rateLimit.assertWithinLimit(`lp:brief-suggest:u:${user.organizationId}:${user.id}`, 12, 60_000, 'Bạn đang lấy gợi ý quá nhanh. Vui lòng thử lại sau một phút.');
            this.rateLimit.assertWithinLimit(`lp:brief-suggest:o:${user.organizationId}`, 60, 60_000, 'Hệ thống đang xử lý nhiều gợi ý. Vui lòng thử lại sau.');
            return this.ai.suggestBriefField(input);
        });
    }
    async templateContentPage(user, pageId) {
        const page = await this.assertPage(user.organizationId, pageId);
        this.assertMutable(page.status);
        if (!page.templateId)
            throw new common_1.BadRequestException('Chọn một mẫu trước khi tạo nội dung.');
        const template = await this.prisma.landingPageTemplate.findFirst({ where: {
                id: page.templateId,
                OR: [{ organizationId: user.organizationId }, { organizationId: null, isSystem: true }],
            } });
        if (!template)
            throw new common_1.NotFoundException('Template không tồn tại hoặc bạn không có quyền truy cập.');
        return { page, template };
    }
    async validateTemplateContentImages(user, pageId, imageIds) {
        await this.templateContentPage(user, pageId);
        if (!Array.isArray(imageIds) || imageIds.length > 30 || imageIds.some(id => typeof id !== 'string' || id.length > 300))
            throw new common_1.BadRequestException('Danh sách ảnh không hợp lệ.');
        const library = await this.listMedia(user, pageId, { scope: 'org' });
        const images = imageIds.map(id => library.items.find(image => image.id === id));
        if (images.some(image => !image))
            throw new common_1.BadRequestException('Ảnh không còn tồn tại hoặc không thuộc thư viện của bạn. Vui lòng chọn lại.');
        return { images: images.map(image => ({ id: image.id, url: image.url, name: image.name })) };
    }
    async generateTemplateContent(user, pageId, dto) {
        const { template } = await this.templateContentPage(user, pageId);
        const urlSource = dto.sourceId ? await this.templateUrlSource(user, pageId, dto.sourceId) : undefined;
        let brief;
        try {
            brief = (0, shared_1.normalizeTemplateContentBrief)({ ...dto.brief, sourceText: urlSource?.text }, !!urlSource);
        }
        catch (error) {
            throw new common_1.BadRequestException(error instanceof Error ? error.message : 'Thông tin sản phẩm không hợp lệ.');
        }
        if (urlSource) {
            brief.sourceContext = (0, shared_1.buildEditorialContext)(urlSource);
            if (!brief.curriculum)
                brief.curriculum = (0, shared_1.templateUrlBrief)(urlSource).curriculum;
        }
        const { images } = await this.validateTemplateContentImages(user, pageId, brief.imageIds);
        const snapshot = (0, shared_1.sanitizeLandingPageSpec)(dto.snapshot);
        if (!(0, shared_1.validateLandingPageSpec)(snapshot).ok || snapshot.meta?.htmlSource)
            throw new common_1.BadRequestException('Mẫu này chưa hỗ trợ tạo nội dung theo vị trí.');
        const allSlots = (0, shared_1.collectTemplateContentSlots)(snapshot, !!brief.originalPrice);
        if (brief.originalPrice && brief.pricingTargetId && !allSlots.some(slot => slot.id === brief.pricingTargetId && slot.blockType === 'Pricing' && slot.field === 'price'))
            throw new common_1.BadRequestException('Box nhận giá đã thay đổi hoặc không còn hiển thị. Hãy chọn lại box báo giá.');
        const slots = dto.blockId ? allSlots.filter(slot => slot.blockId === dto.blockId) : allSlots;
        if (!slots.length || slots.length > 400)
            throw new common_1.BadRequestException('Không tìm thấy vị trí nội dung phù hợp trong mẫu.');
        const key = this.normalizeIdemKey(dto.idempotencyKey);
        if (!key)
            throw new common_1.BadRequestException('Thiếu mã yêu cầu.');
        const requestHash = (0, shared_1.hashInlineAiFieldContent)(JSON.stringify({ brief, snapshot, blockId: dto.blockId || '' }));
        return this.withIdempotency(this.templateContentIdem, `lp:template-content:${user.organizationId}:${user.id}:${pageId}:${key}:${requestHash}`, async () => {
            await this.assertTemplateContentLimit(`lp:template-content:${user.organizationId}:${user.id}`, 8, 60_000, 'Bạn đang tạo nội dung quá nhanh. Vui lòng thử lại sau một phút.');
            await this.assertTemplateContentLimit(`lp:template-content:org:${user.organizationId}`, 24, 60_000, 'Tổ chức đang tạo nội dung quá nhanh. Vui lòng thử lại sau một phút.');
            const generated = await this.ai.generateTemplateContent(slots, brief, (0, shared_1.planTemplateContent)(allSlots, brief));
            const original = this.creationTemplateSpec(template, template.publishedDefinition ?? template.definition);
            return { ...generated, ...(urlSource ? { urlSource: { sourceUrl: urlSource.sourceUrl, finalUrl: urlSource.finalUrl, readAt: urlSource.readAt } } : {}), slots, images, protectedSlotIds: (0, shared_1.protectedTemplateSlotIds)(snapshot, original, !!brief.originalPrice).filter(id => slots.some(slot => slot.id === id)) };
        });
    }
    async generateAi(user, dto) {
        const idemKey = this.normalizeIdemKey(dto.idempotencyKey);
        const cacheKey = idemKey ? `lp:generate:${user.organizationId}:${idemKey}:${dto.landingPageId || 'none'}` : null;
        return this.withIdempotency(this.generateIdem, cacheKey, async () => {
            // Check ownership and snapshot BEFORE an AI call; save only if the draft is unchanged.
            const original = dto.landingPageId ? await this.assertPage(user.organizationId, dto.landingPageId) : null;
            if (original)
                this.assertMutable(original.status);
            let profile = null;
            let summary = null;
            const warnings = [];
            if (dto.useBusinessProfile && !dto.sourceReviewed) {
                const current = await this.getBusinessProfile(user.organizationId);
                if (!current.isEmpty)
                    profile = current;
            }
            if (dto.sourceUrl?.trim() && !dto.sourceReviewed) {
                try {
                    // Reuse the same SSRF-safe crawl and cache as the URL review flow.
                    const crawled = await this.crawlPublicUrl(user, { url: dto.sourceUrl.trim() });
                    summary = crawled.summary;
                }
                catch {
                    warnings.push('Không đọc được website tham khảo. Bản nháp sử dụng thông tin trong biểu mẫu.');
                }
            }
            const brief = (0, shared_1.mergeLandingPageAiBrief)(dto, profile, summary);
            // External media from URL/profile input must pass the existing public-URL validator.
            const { assertPublicHttpUrl } = await Promise.resolve().then(() => __importStar(require('@marketingspa/shared/dist/ssrf-fetch')));
            for (const field of ['imageUrl', 'logoUrl']) {
                if (!brief[field] || brief[field].startsWith('/'))
                    continue;
                try {
                    await assertPublicHttpUrl(brief[field], { skipCommerceHostBlock: true });
                }
                catch {
                    brief[field] = '';
                    warnings.push(field === 'imageUrl' ? 'Ảnh tham khảo không hợp lệ; bản nháp dùng bố cục không ảnh.' : 'Logo tham khảo không hợp lệ và đã được bỏ qua.');
                }
            }
            const templateSelection = (0, shared_1.selectLandingPageTemplate)({
                businessType: brief.businessType, pageGoal: brief.pageGoal, offer: brief.offer,
                audience: brief.targetCustomer, productService: brief.productService, templateSlug: dto.templateSlug,
            });
            const result = await this.withIdempotency(this.generateContentIdem, cacheKey ? `${cacheKey}:content` : null, () => this.ai.generate(brief, templateSelection));
            let draftSpec = result.draftSpec;
            let page = null;
            if (original) {
                const existingSpec = this.parseSpec(original.draftSpec);
                draftSpec = (0, shared_1.protectLandingPageAiUserContent)(existingSpec, draftSpec);
                const validation = (0, shared_1.validateLandingPageSpec)(draftSpec);
                if (!validation.ok)
                    throw new common_1.BadRequestException({ code: 'INVALID_SPEC', message: validation.errors.join('; ') });
                const saved = await this.prisma.landingPage.updateMany({
                    where: { id: original.id, organizationId: user.organizationId, updatedAt: original.updatedAt, status: original.status },
                    data: { draftSpec: draftSpec, theme: THEME_MAP[draftSpec.theme],
                        seoTitle: draftSpec.seo.title, seoDescription: draftSpec.seo.metaDescription },
                });
                if (saved.count !== 1)
                    throw new common_1.ConflictException('Trang đã thay đổi trong khi AI xử lý. Nội dung mới của bạn được giữ nguyên; hãy tải lại trước khi thử lại.');
                page = this.serializePage(await this.assertPage(user.organizationId, original.id));
            }
            const warning = [...warnings, result.warning].filter(Boolean).join(' · ') || undefined;
            return { ...result, draftSpec, warning, page, templateSelection, normalizedBrief: brief };
        });
    }
    async analytics(organizationId, query = {}) {
        const from = query.from ? new Date(query.from) : new Date(Date.now() - 30 * 86400000);
        const to = query.to ? new Date(query.to) : new Date();
        const where = {
            organizationId,
            occurredAt: { gte: from, lte: to },
            ...(query.pageId ? { landingPageId: query.pageId } : {}),
            ...(query.utmSource ? { utmSource: query.utmSource } : {}),
            ...(query.utmMedium ? { utmMedium: query.utmMedium } : {}),
            ...(query.utmCampaign ? { utmCampaign: query.utmCampaign } : {}),
            ...(query.device ? { device: query.device } : {}),
        };
        const byType = await this.prisma.landingPageEvent.groupBy({
            by: ['eventType'],
            where,
            _count: { _all: true },
        });
        const counts = Object.fromEntries(byType.map((r) => [r.eventType, r._count._all]));
        const uniqueVisitors = await this.prisma.landingPageEvent.findMany({
            where: { ...where, eventType: database_1.LandingPageEventType.PAGE_VIEW, visitorId: { not: null } },
            distinct: ['visitorId'],
            select: { visitorId: true },
        });
        const pageViews = counts.PAGE_VIEW ?? 0;
        const formSubmit = counts.FORM_SUBMIT ?? 0;
        const leads = counts.LEAD ?? 0;
        const ctaClicks = counts.CTA_CLICK ?? 0;
        const formStarts = counts.FORM_START ?? 0;
        const conversionRate = pageViews > 0 ? Number(((leads / pageViews) * 100).toFixed(2)) : 0;
        const booked = await this.prisma.lead.count({
            where: {
                organizationId,
                ...(query.pageId ? { landingPageId: query.pageId } : { landingPageId: { not: null } }),
                pipelineStatus: { in: ['BOOKED', 'PURCHASED'] },
                createdAt: { gte: from, lte: to },
            },
        });
        const byDevice = await this.prisma.landingPageEvent.groupBy({
            by: ['device'],
            where: { ...where, eventType: database_1.LandingPageEventType.PAGE_VIEW },
            _count: { _all: true },
        });
        const byUtmRaw = await this.prisma.landingPageEvent.groupBy({
            by: ['utmSource', 'utmCampaign'],
            where: { ...where, eventType: database_1.LandingPageEventType.PAGE_VIEW },
            _count: { _all: true },
        });
        const byUtm = [...byUtmRaw]
            .sort((a, b) => b._count._all - a._count._all)
            .slice(0, 20);
        // Aggregate views-by-day + CTA-by-block from existing event rows (no schema change).
        const viewRows = await this.prisma.landingPageEvent.findMany({
            where: { ...where, eventType: database_1.LandingPageEventType.PAGE_VIEW },
            select: { occurredAt: true },
            take: 50_000,
        });
        const viewsByDayMap = new Map();
        for (const r of viewRows) {
            const day = r.occurredAt.toISOString().slice(0, 10);
            viewsByDayMap.set(day, (viewsByDayMap.get(day) || 0) + 1);
        }
        const viewsByDay = [...viewsByDayMap.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, count]) => ({ date, count }));
        const ctaRows = await this.prisma.landingPageEvent.findMany({
            where: { ...where, eventType: database_1.LandingPageEventType.CTA_CLICK },
            select: { meta: true },
            take: 20_000,
        });
        const ctaBlockMap = new Map();
        for (const r of ctaRows) {
            const meta = (r.meta || {});
            const blockId = typeof meta.blockId === 'string' && meta.blockId.trim()
                ? meta.blockId.trim().slice(0, 80)
                : typeof meta.href === 'string'
                    ? `href:${meta.href.slice(0, 60)}`
                    : 'unknown';
            ctaBlockMap.set(blockId, (ctaBlockMap.get(blockId) || 0) + 1);
        }
        const ctaByBlock = [...ctaBlockMap.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 30)
            .map(([blockId, count]) => ({ blockId, count }));
        const formRows = await this.prisma.landingPageEvent.findMany({
            where: { ...where, eventType: database_1.LandingPageEventType.FORM_SUBMIT },
            select: { meta: true },
            take: 20_000,
        });
        const formBlockMap = new Map();
        for (const r of formRows) {
            const meta = (r.meta || {});
            const bid = typeof meta.blockId === 'string' && meta.blockId.trim()
                ? meta.blockId.trim().slice(0, 80)
                : 'unknown';
            formBlockMap.set(bid, (formBlockMap.get(bid) || 0) + 1);
        }
        const formByBlock = [...formBlockMap.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 30)
            .map(([blockId, count]) => ({ blockId, count }));
        // Visitor-level funnel: View → CTA → Lead → Sale
        const funnelRows = await this.prisma.landingPageEvent.findMany({
            where: { ...where, visitorId: { not: null } },
            select: { visitorId: true, eventType: true, leadId: true },
            take: 100_000,
        });
        const visitorMap = new Map();
        for (const row of funnelRows) {
            const vid = row.visitorId;
            let bucket = visitorMap.get(vid);
            if (!bucket) {
                bucket = { events: new Set(), leadIds: new Set() };
                visitorMap.set(vid, bucket);
            }
            bucket.events.add(row.eventType);
            if (row.leadId)
                bucket.leadIds.add(row.leadId);
        }
        let funnelViews = 0;
        let funnelCta = 0;
        let funnelLeads = 0;
        const allLeadIds = new Set();
        for (const bucket of visitorMap.values()) {
            if (bucket.events.has(database_1.LandingPageEventType.PAGE_VIEW))
                funnelViews++;
            if (bucket.events.has(database_1.LandingPageEventType.CTA_CLICK))
                funnelCta++;
            if (bucket.events.has(database_1.LandingPageEventType.LEAD) ||
                bucket.events.has(database_1.LandingPageEventType.FORM_SUBMIT)) {
                funnelLeads++;
            }
            for (const lid of bucket.leadIds)
                allLeadIds.add(lid);
        }
        const soldRows = allLeadIds.size > 0
            ? await this.prisma.lead.findMany({
                where: {
                    organizationId,
                    id: { in: [...allLeadIds] },
                    pipelineStatus: { in: ['BOOKED', 'PURCHASED'] },
                },
                select: { id: true },
            })
            : [];
        const soldLeadIds = new Set(soldRows.map((r) => r.id));
        let funnelSales = 0;
        for (const bucket of visitorMap.values()) {
            if ([...bucket.leadIds].some((id) => soldLeadIds.has(id)))
                funnelSales++;
        }
        const pct = (num, den) => den > 0 ? Number(((num / den) * 100).toFixed(2)) : 0;
        return {
            range: { from, to },
            metrics: {
                pageViews,
                uniqueVisitors: uniqueVisitors.length,
                ctaClicks,
                formStarts,
                formSubmits: formSubmit,
                leads,
                conversionRate,
                bookingsOrSales: booked,
            },
            funnel: {
                views: funnelViews,
                cta: funnelCta,
                leads: funnelLeads,
                sales: funnelSales,
                rates: {
                    viewToCta: pct(funnelCta, funnelViews),
                    ctaToLead: pct(funnelLeads, funnelCta),
                    leadToSale: pct(funnelSales, funnelLeads),
                    viewToLead: pct(funnelLeads, funnelViews),
                    viewToSale: pct(funnelSales, funnelViews),
                },
            },
            viewsByDay,
            ctaByBlock,
            formByBlock,
            byDevice: byDevice.map((r) => ({ device: r.device || 'unknown', count: r._count._all })),
            byUtm: byUtm.map((r) => ({
                utmSource: r.utmSource,
                utmCampaign: r.utmCampaign,
                count: r._count._all,
            })),
        };
    }
    /** Public published page by org-scoped slug (default path /p/:slug). */
    async getPublicBySlug(slug, organizationId) {
        if (slug.startsWith('lp-domain-') || (0, landing_page_platform_domain_1.isPlatformDomainKey)(slug))
            return landing_page_domain_manager_1.domainMethods.getPublicByDomainKey.call(this, slug);
        const row = await this.prisma.landingPage.findFirst({
            where: {
                slug,
                status: database_1.LandingPageStatus.PUBLISHED,
                ...(organizationId ? { organizationId } : {}),
            },
            orderBy: { publishedAt: 'desc' },
        });
        if (!row || !row.publishedSpec) {
            throw new common_1.NotFoundException('Landing page không tồn tại hoặc chưa publish');
        }
        const parsed = this.parseSpec(row.publishedSpec);
        // Strip builder provenance only — keep layout/category + canvas render meta.
        const spec = this.toPublicSpec(parsed);
        const cbCfg = (0, shared_1.sanitizeLandingPageChatbotConfig)(spec.chatbot);
        const chatbotConfig = await this.buildPublicChatbotConfig(row, cbCfg, { preview: false });
        return {
            id: row.id,
            slug: row.slug,
            name: row.name,
            theme: row.theme,
            spec,
            chatbotConfig,
            seo: {
                title: row.seoTitle || spec.seo.title,
                description: row.seoDescription || spec.seo.metaDescription,
                canonical: row.seoCanonical || spec.seo.canonical,
                ogImage: row.ogImage || spec.seo.ogImage,
                robotsIndex: row.robotsIndex,
            },
            trackingConfig: row.trackingConfig ?? null,
            subdomainSlug: row.subdomainSlug,
            customDomain: row.customDomain,
            customDomainStatus: row.customDomainStatus,
            publishedAt: row.publishedAt,
        };
    }
    async buildPublicChatbotConfig(row, cbCfg, options) {
        if (!cbCfg?.enabled || !cbCfg.botId)
            return null;
        const deny = (0, landing_page_chatbot_rollout_util_1.lpChatbotPublicDenyCode)(row.organizationId, {
            customDomain: row.customDomain,
            customDomainStatus: row.customDomainStatus,
        }, { preview: options.preview });
        if (deny)
            return null;
        const bot = await this.prisma.chatbotBot.findFirst({
            where: {
                id: cbCfg.botId,
                organizationId: row.organizationId,
                ...(options.preview ? {} : { status: 'ACTIVE' }),
            },
            select: { botName: true, greeting: true, hotline: true, status: true },
        });
        if (!bot || (!options.preview && bot.status !== 'ACTIVE'))
            return null;
        return (0, shared_1.buildLandingPageChatbotPublicConfig)({
            pageId: row.id,
            slug: row.slug,
            config: cbCfg,
            fallbackBotName: bot.botName,
            fallbackGreeting: bot.greeting ?? undefined,
            hotline: bot.hotline ?? undefined,
        });
    }
    async resolvePublishedPage(slug, organizationId) {
        const org = organizationId?.trim();
        return this.prisma.landingPage.findFirst({
            where: {
                slug,
                status: database_1.LandingPageStatus.PUBLISHED,
                ...(org ? { organizationId: org } : {}),
            },
            orderBy: { publishedAt: 'desc' },
            select: {
                id: true,
                organizationId: true,
                name: true,
                slug: true,
                publishedSpec: true,
            },
        });
    }
    async trackPublicEvent(slug, dto, ip, organizationId) {
        if (dto.website && String(dto.website).trim()) {
            return { ok: true, skipped: true, reason: 'spam' };
        }
        const page = await this.resolvePublishedPage(slug, organizationId);
        if (!page)
            throw new common_1.NotFoundException('Landing page không tồn tại');
        this.rateLimit.assertWithinLimit(`lp:evt:global:${ip || 'na'}`, 240, 60_000, 'Quá nhiều sự kiện tracking');
        this.rateLimit.assertWithinLimit(`lp:evt:${page.id}:${ip || 'na'}`, 120, 60_000, 'Quá nhiều sự kiện tracking');
        const allowedEvents = new Set(Object.values(database_1.LandingPageEventType));
        const eventTypeRaw = String(dto.eventType || '').trim();
        if (!allowedEvents.has(eventTypeRaw)) {
            throw new common_1.BadRequestException('eventType không hợp lệ');
        }
        const eventType = eventTypeRaw;
        await this.prisma.landingPageEvent.create({
            data: {
                organizationId: page.organizationId,
                landingPageId: page.id,
                eventType,
                visitorId: dto.visitorId?.slice(0, 80) || null,
                sessionId: dto.sessionId?.slice(0, 80) || null,
                device: dto.device?.slice(0, 40) || null,
                utmSource: dto.utmSource?.slice(0, 120) || null,
                utmMedium: dto.utmMedium?.slice(0, 120) || null,
                utmCampaign: dto.utmCampaign?.slice(0, 160) || null,
                utmContent: dto.utmContent?.slice(0, 160) || null,
                utmTerm: dto.utmTerm?.slice(0, 160) || null,
                referrer: dto.referrer?.slice(0, 2000) || null,
                meta: (dto.meta ?? undefined),
            },
        });
        return { ok: true };
    }
    async ensureLeadSource(organizationId) {
        const existing = await this.prisma.leadSource.findFirst({
            where: { organizationId, code: LP_SOURCE_CODE },
        });
        if (existing) {
            if (!existing.isActive) {
                return this.prisma.leadSource.update({
                    where: { id: existing.id },
                    data: { isActive: true },
                });
            }
            return existing;
        }
        return this.prisma.leadSource.create({
            data: { organizationId, code: LP_SOURCE_CODE, name: 'Landing Page', isActive: true },
        });
    }
    async submitPublicLead(slug, dto, ip, organizationId) {
        const page = await this.resolvePublishedPage(slug, organizationId);
        if (!page)
            throw new common_1.NotFoundException('Landing page không tồn tại');
        // Honeypot
        if (dto.website && dto.website.trim()) {
            return { ok: true, skipped: true, reason: 'spam' };
        }
        this.rateLimit.assertWithinLimit(`lp:lead:global:${ip || 'na'}`, 40, 60 * 60_000, 'Quá nhiều yêu cầu từ IP này');
        this.rateLimit.assertWithinLimit(`lp:lead:${page.id}:${ip || 'na'}`, 8, 10 * 60_000, 'Gửi form quá nhanh — thử lại sau');
        this.rateLimit.assertWithinLimit(`lp:lead:ip:${ip || 'na'}`, 30, 60 * 60_000, 'Quá nhiều yêu cầu từ IP này');
        const fields = {};
        for (const [k, v] of Object.entries(dto.fields || {})) {
            const key = String(k).replace(/[^\w.-]/g, '').slice(0, 64);
            if (!key)
                continue;
            fields[key] = String(v ?? '')
                .replace(/<[^>]+>/g, '')
                .slice(0, 2000);
        }
        const email = fields.email || fields.Email || fields.mail || fields.email_address || undefined;
        const phone = fields.phone || fields.Phone || fields.tel || fields.mobile || fields.sdt || fields.dien_thoai || undefined;
        const name = (fields.name || fields.fullName || fields.Name || 'Landing lead').slice(0, 200);
        const company = fields.company || fields.Company || '';
        const need = fields.need || fields.nhu_cau || fields.requirement || '';
        const noteExtra = fields.note || fields.notes || fields.ghi_chu || '';
        if (!phone && !email) {
            throw new common_1.BadRequestException('Cần ít nhất Số điện thoại hoặc Email');
        }
        const dedupeId = `${(phone || '').replace(/\D/g, '')}|${(email || '').toLowerCase()}`;
        this.rateLimit.assertWithinLimit(`lp:lead:once:${page.id}:${dedupeId}`, 1, 12_000, 'Thông tin vừa được gửi. Vui lòng đợi một lát trước khi gửi lại.');
        const source = await this.ensureLeadSource(page.organizationId);
        const publishedSpec = this.parseSpec(page.publishedSpec);
        const formBlock = (0, shared_1.resolveLeadFormBlockFromSpec)(publishedSpec, dto.blockId);
        const crm = formBlock?.crm;
        const blockId = dto.blockId || formBlock?.id || null;
        const attribution = {
            ...(dto.attribution ?? {}),
            utmSource: (typeof dto.attribution?.utmSource === 'string' && dto.attribution.utmSource) ||
                'landing_page',
            utmMedium: (typeof dto.attribution?.utmMedium === 'string' && dto.attribution.utmMedium) ||
                'lead_form',
            utmCampaign: (typeof dto.attribution?.utmCampaign === 'string' && dto.attribution.utmCampaign) ||
                page.slug,
            utmContent: typeof dto.attribution?.utmContent === 'string' ? dto.attribution.utmContent : undefined,
            utmTerm: typeof dto.attribution?.utmTerm === 'string' ? dto.attribution.utmTerm : undefined,
            landingPage: dto.landingPageUrl || `/p/${page.slug}`,
            referrer: dto.referrer || dto.attribution?.referrer,
            rawPayload: {
                device: dto.device ?? null,
                blockId,
                source: 'landing_page_form',
                visitorId: dto.visitorId ?? null,
                sessionId: dto.sessionId ?? null,
            },
        };
        const noteParts = [
            company ? `Công ty: ${company}` : '',
            need ? `Nhu cầu: ${need}` : '',
            noteExtra ? `Ghi chú: ${noteExtra}` : '',
            `landingPageId=${page.id}`,
            blockId ? `blockId=${blockId}` : '',
            Object.keys(fields).length
                ? `fields=${JSON.stringify(fields).slice(0, 1500)}`
                : '',
        ].filter(Boolean);
        const lead = await this.leads.create(page.organizationId, {
            name,
            phone,
            email,
            leadSourceId: source.id,
            landingPageId: page.id,
            landingPageBlockId: blockId ?? undefined,
            pipelineId: crm?.pipelineId,
            stageId: crm?.stageId,
            assignedToId: crm?.assignedToId,
            autoAssign: crm?.autoAssign,
            tags: (0, shared_1.mergeLeadFormTags)(page.slug, crm),
            note: noteParts.join('\n').slice(0, 4000),
            attribution,
            captureMeta: {
                landingPageId: page.id,
                blockId,
                visitorId: dto.visitorId,
                sessionId: dto.sessionId,
                device: dto.device,
                referrer: dto.referrer ?? null,
                source: 'landing_page_form',
                fields,
                submittedAt: new Date().toISOString(),
            },
        });
        const isUpdate = lead.updatedAt.getTime() - lead.createdAt.getTime() > 2_000;
        await this.prisma.landingPageEvent.create({
            data: {
                organizationId: page.organizationId,
                landingPageId: page.id,
                leadId: lead.id,
                eventType: database_1.LandingPageEventType.FORM_SUBMIT,
                visitorId: dto.visitorId?.slice(0, 80) || null,
                sessionId: dto.sessionId?.slice(0, 80) || null,
                device: dto.device?.slice(0, 40) || null,
                utmSource: attribution.utmSource?.slice(0, 120) || null,
                utmMedium: attribution.utmMedium?.slice(0, 120) || null,
                utmCampaign: attribution.utmCampaign?.slice(0, 160) || null,
                utmContent: typeof attribution.utmContent === 'string' ? attribution.utmContent.slice(0, 160) : null,
                utmTerm: typeof attribution.utmTerm === 'string' ? attribution.utmTerm.slice(0, 160) : null,
                referrer: typeof attribution.referrer === 'string' ? attribution.referrer.slice(0, 2000) : null,
                meta: { updated: isUpdate, blockId },
            },
        });
        await this.prisma.landingPageEvent.create({
            data: {
                organizationId: page.organizationId,
                landingPageId: page.id,
                leadId: lead.id,
                eventType: database_1.LandingPageEventType.LEAD,
                visitorId: dto.visitorId?.slice(0, 80) || null,
                device: dto.device?.slice(0, 40) || null,
                utmSource: attribution.utmSource?.slice(0, 120) || null,
                utmCampaign: attribution.utmCampaign?.slice(0, 160) || null,
            },
        });
        // Ensure FK + block id even if older LeadsService path ignored fields
        if (!lead.landingPageId ||
            lead.landingPageId !== page.id ||
            (blockId && lead.landingPageBlockId !== blockId)) {
            await this.prisma.lead.update({
                where: { id: lead.id },
                data: {
                    landingPageId: page.id,
                    ...(blockId ? { landingPageBlockId: blockId.slice(0, 64) } : {}),
                },
            });
        }
        const automationContext = {
            landingPageId: page.id,
            landingPageSlug: page.slug,
            blockId: blockId ?? '',
            device: dto.device?.slice(0, 40) ?? '',
            referrer: typeof attribution.referrer === 'string' ? attribution.referrer.slice(0, 500) : '',
            utmSource: String(attribution.utmSource ?? ''),
            utmMedium: String(attribution.utmMedium ?? ''),
            utmCampaign: String(attribution.utmCampaign ?? ''),
            source: 'landing_page_form',
            updated: String(isUpdate),
        };
        void this.automation.dispatch(page.organizationId, database_1.AutomationTriggerType.LANDING_PAGE_FORM_SUBMITTED, {
            leadId: lead.id,
            customerId: lead.customerId,
            context: automationContext,
            dedupeKey: `LP_FORM:${page.id}:${lead.id}:${Date.now().toString(36).slice(-4)}`,
        });
        if (!isUpdate) {
            void this.automation.dispatch(page.organizationId, database_1.AutomationTriggerType.LANDING_PAGE_LEAD_CREATED, {
                leadId: lead.id,
                customerId: lead.customerId,
                context: automationContext,
                dedupeKey: `LP_LEAD_NEW:${page.id}:${lead.id}`,
            });
        }
        const webhookUrl = crm?.webhookUrl?.trim();
        if (webhookUrl && (0, shared_1.isSafeWebhookUrl)(webhookUrl)) {
            const webhookPayload = (0, shared_1.buildLandingPageLeadWebhookPayload)({
                event: isUpdate ? 'landing_page.form.submitted' : 'landing_page.lead.created',
                organizationId: page.organizationId,
                landingPageId: page.id,
                landingPageSlug: page.slug,
                blockId,
                leadId: lead.id,
                isUpdate,
                device: dto.device,
                referrer: typeof attribution.referrer === 'string' ? attribution.referrer : null,
                utm: {
                    source: String(attribution.utmSource ?? ''),
                    medium: String(attribution.utmMedium ?? ''),
                    campaign: String(attribution.utmCampaign ?? ''),
                    content: typeof attribution.utmContent === 'string' ? attribution.utmContent : undefined,
                    term: typeof attribution.utmTerm === 'string' ? attribution.utmTerm : undefined,
                },
                fields,
            });
            void (0, shared_1.postLandingPageLeadWebhook)(webhookUrl, webhookPayload, crm?.webhookSecret).catch((err) => this.logger.warn(`LP form webhook failed: ${String(err)}`));
        }
        try {
            await this.leads.applyScoringEvent({
                organizationId: page.organizationId,
                leadId: lead.id,
                eventType: 'FORM_SUBMITTED',
                source: 'landing_page_form',
            });
        }
        catch (err) {
            this.logger.warn(`LP scoring skipped: ${String(err)}`);
        }
        return {
            ok: true,
            leadId: lead.id,
            updated: isUpdate,
            landingPageId: page.id,
        };
    }
    /**
     * Public image upload for LP canvas (JPG/PNG/WebP via profile=image).
     * Stored under uploads/public/... so published pages can load without JWT.
     */
    async uploadPublicImage(user, pageId, file) {
        await this.assertPage(user.organizationId, pageId);
        const classified = (0, upload_policy_1.assertUploadFile)('image', file);
        if (!file?.buffer?.length) {
            throw new common_1.BadRequestException('Thiếu file upload');
        }
        const { filename, ext } = (0, upload_policy_1.randomStoredFilename)(classified.originalName);
        if (!upload_policy_1.PUBLIC_MEDIA_EXT.has(ext)) {
            throw new common_1.BadRequestException('Chỉ hỗ trợ JPG/PNG/WebP/GIF');
        }
        const relDir = (0, path_1.join)(upload_policy_1.PUBLIC_UPLOAD_PREFIX.replace(/\/$/, ''), 'landing-pages', user.organizationId, pageId);
        const absDir = (0, path_1.join)(process.cwd(), 'uploads', relDir);
        if (!(0, fs_1.existsSync)(absDir))
            (0, fs_1.mkdirSync)(absDir, { recursive: true });
        const absPath = (0, path_1.join)(absDir, filename);
        if ((0, fs_1.existsSync)(absPath)) {
            throw new common_1.BadRequestException('Xung đột tên file — thử lại');
        }
        await (0, plan_storage_1.writePlanFile)(this.prisma, user.organizationId, absPath, file.buffer.length, async () => (0, fs_1.writeFileSync)(absPath, file.buffer));
        const url = `/uploads/${relDir.replace(/\\/g, '/')}/${filename}`;
        return {
            ok: true,
            url,
            mimeType: classified.mime,
            sizeBytes: classified.size,
            originalName: classified.originalName,
        };
    }
    /** Image or short background video for a section. Public URL, same folder as images. */
    async uploadPublicBackground(user, pageId, file) {
        await this.assertPage(user.organizationId, pageId);
        const classified = (0, upload_policy_1.assertUploadFile)('lp_background', file);
        if (!file?.buffer?.length) {
            throw new common_1.BadRequestException('Thiếu file upload');
        }
        const { filename, ext } = (0, upload_policy_1.randomStoredFilename)(classified.originalName);
        if (!upload_policy_1.PUBLIC_MEDIA_EXT.has(ext)) {
            throw new common_1.BadRequestException('Chỉ hỗ trợ JPG, PNG, WebP, GIF, MP4, WebM');
        }
        const relDir = (0, path_1.join)(upload_policy_1.PUBLIC_UPLOAD_PREFIX.replace(/\/$/, ''), 'landing-pages', user.organizationId, pageId);
        const absDir = (0, path_1.join)(process.cwd(), 'uploads', relDir);
        if (!(0, fs_1.existsSync)(absDir))
            (0, fs_1.mkdirSync)(absDir, { recursive: true });
        const absPath = (0, path_1.join)(absDir, filename);
        if ((0, fs_1.existsSync)(absPath)) {
            throw new common_1.BadRequestException('Xung đột tên file — thử lại');
        }
        await (0, plan_storage_1.writePlanFile)(this.prisma, user.organizationId, absPath, file.buffer.length, async () => (0, fs_1.writeFileSync)(absPath, file.buffer));
        const url = `/uploads/${relDir.replace(/\\/g, '/')}/${filename}`;
        return {
            ok: true,
            url,
            mimeType: classified.mime,
            sizeBytes: classified.size,
            originalName: classified.originalName,
        };
    }
    /**
     * List images already uploaded for this org under landing-pages/ (same store as uploadPublicImage).
     * scope=page → current page folder only; scope=org (default) → all pages in the org.
     */
    async listMedia(user, pageId, query) {
        await this.assertPage(user.organizationId, pageId);
        const scope = query?.scope === 'page' ? 'page' : 'org';
        const q = (query?.q || '').trim().toLowerCase();
        const orgRoot = (0, path_1.join)(process.cwd(), 'uploads', upload_policy_1.PUBLIC_UPLOAD_PREFIX.replace(/\/$/, ''), 'landing-pages', user.organizationId);
        const items = [];
        const collectDir = (absDir, ownerPageId) => {
            if (!(0, fs_1.existsSync)(absDir))
                return;
            let entries = [];
            try {
                entries = (0, fs_1.readdirSync)(absDir);
            }
            catch {
                return;
            }
            for (const name of entries) {
                const abs = (0, path_1.join)(absDir, name);
                let st;
                try {
                    st = (0, fs_1.statSync)(abs);
                }
                catch {
                    continue;
                }
                if (!st.isFile())
                    continue;
                const ext = (0, path_1.extname)(name).toLowerCase();
                if (!upload_policy_1.PUBLIC_IMAGE_EXT.has(ext))
                    continue;
                const url = `/uploads/${upload_policy_1.PUBLIC_UPLOAD_PREFIX.replace(/\/$/, '')}/landing-pages/${user.organizationId}/${ownerPageId}/${name}`;
                const display = (0, path_1.basename)(name);
                if (q && !display.toLowerCase().includes(q) && !url.toLowerCase().includes(q))
                    continue;
                items.push({
                    id: `${ownerPageId}:${name}`,
                    url,
                    name: display,
                    sizeBytes: st.size,
                    updatedAt: st.mtime.toISOString(),
                    pageId: ownerPageId,
                });
            }
        };
        if (scope === 'page') {
            collectDir((0, path_1.join)(orgRoot, pageId), pageId);
        }
        else if ((0, fs_1.existsSync)(orgRoot)) {
            let pageDirs = [];
            try {
                pageDirs = (0, fs_1.readdirSync)(orgRoot);
            }
            catch {
                pageDirs = [];
            }
            for (const dir of pageDirs) {
                const abs = (0, path_1.join)(orgRoot, dir);
                try {
                    if (!(0, fs_1.statSync)(abs).isDirectory())
                        continue;
                }
                catch {
                    continue;
                }
                collectDir(abs, dir);
            }
        }
        items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
        return { items, total: items.length, scope };
    }
};
exports.LandingPagesService = LandingPagesService;
exports.LandingPagesService = LandingPagesService = LandingPagesService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(7, (0, common_1.Optional)()),
    __param(7, (0, common_1.Inject)(redis_constants_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        rate_limit_service_1.RateLimitService,
        leads_service_1.LeadsService,
        automation_engine_service_1.AutomationEngineService,
        landing_page_ai_service_1.LandingPageAiService,
        credit_service_1.CreditService,
        landing_page_chatbot_service_1.LandingPageChatbotService, Function])
], LandingPagesService);
function htmlPreviewPath(id, raw, updatedAt) {
    const meta = raw && typeof raw === 'object' && 'meta' in raw
        ? raw.meta
        : null;
    const html = typeof meta?.htmlSource === 'string' ? meta.htmlSource.trim() : '';
    if (!html)
        return null;
    const v = updatedAt instanceof Date ? updatedAt.getTime() : Date.now();
    return `/landing-pages/public/template-html/${id}?v=${v}`;
}
const database_2 = require("@marketingspa/database");
