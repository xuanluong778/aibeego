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
exports.LandingPageTemplatePackService = void 0;
const common_1 = require("@nestjs/common");
const fs_1 = require("fs");
const promises_1 = require("fs/promises");
const crypto_1 = require("crypto");
const path_1 = require("path");
const database_1 = require("@marketingspa/database");
const shared_1 = require("@marketingspa/shared");
const prisma_service_1 = require("../prisma/prisma.service");
const template_pack_1 = require("./template-pack");
const template_pack_bulk_1 = require("./template-pack-bulk");
const THEMES = new Set(Object.values(database_1.LandingPageTheme));
const ASSET_MIME = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
};
let LandingPageTemplatePackService = class LandingPageTemplatePackService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    assertAdmin(user) {
        if (!(0, template_pack_1.isPlatformAdmin)(user)) {
            throw new common_1.ForbiddenException('Chỉ quản trị hệ thống mới được tải hoặc cập nhật mẫu.');
        }
    }
    assetDir(templateId) {
        return (0, path_1.join)(process.cwd(), 'uploads', 'landing-template-packs', templateId);
    }
    parseUpload(file) {
        if (!file?.buffer?.length)
            throw new common_1.BadRequestException('Thiếu file ZIP hoặc HTML');
        const name = (file.originalname || '').toLowerCase();
        const isHtml = name.endsWith('.html') || name.endsWith('.htm');
        const isZip = name.endsWith('.zip');
        if (!isHtml && !isZip)
            throw new common_1.BadRequestException('Chỉ nhận file .zip, .html hoặc .htm');
        const max = isHtml ? 1_500_000 : template_pack_1.TEMPLATE_PACK_MAX_ZIP_BYTES;
        if ((file.size ?? file.buffer.length) > max) {
            throw new common_1.BadRequestException(isHtml ? 'File HTML vượt dung lượng 1.5MB' : 'ZIP vượt dung lượng 20MB');
        }
        try {
            return isHtml ? (0, template_pack_1.parseHtmlDocument)(file.originalname || 'template.html', file.buffer) : (0, template_pack_1.parseTemplatePack)(file.buffer);
        }
        catch (err) {
            if (err instanceof template_pack_1.TemplatePackError)
                throw new common_1.BadRequestException(err.message);
            throw err;
        }
    }
    acceptSpec(raw) {
        const inputBlocks = Array.isArray(raw.blocks) ? raw.blocks : [];
        const inputIds = new Set(inputBlocks
            .map((b) => (b && typeof b === 'object' ? String(b.id || '') : ''))
            .filter(Boolean));
        const spec = (0, shared_1.sanitizeLandingPageSpec)(raw);
        const kept = spec.blocks.filter((b) => inputIds.has(b.id));
        if (!kept.length) {
            throw new common_1.BadRequestException('template.json không còn block hợp lệ sau khi kiểm tra');
        }
        if (!spec.blocks.some((b) => b.type === 'LeadForm' || b.type === 'CTA')) {
            throw new common_1.BadRequestException('Mẫu phải giữ block LeadForm hoặc CTA để thu thập lead');
        }
        return spec;
    }
    assertManifest(pack) {
        if (!shared_1.LANDING_PAGE_CATEGORIES.includes(pack.manifest.category)) {
            throw new common_1.BadRequestException('Category không thuộc danh mục mẫu');
        }
        if (!THEMES.has(pack.manifest.theme))
            throw new common_1.BadRequestException('Theme không hợp lệ');
    }
    async applyAssets(templateId, assetKey, pack) {
        const dir = this.assetDir(templateId);
        if (pack.assets.length)
            await (0, promises_1.mkdir)(dir, { recursive: true });
        const urls = new Map();
        for (const asset of pack.assets) {
            await (0, promises_1.writeFile)((0, path_1.join)(dir, asset.name), asset.bytes);
            urls.set(asset.name, `/api/v1/landing-pages/public/template-assets/${templateId}/${asset.name}?k=${encodeURIComponent(assetKey)}`);
        }
        const rewritten = mapStrings(pack.template, (value) => {
            const rel = value.replace(/^\.\//, '').split('?')[0] || '';
            if (!rel.startsWith('assets/'))
                return value;
            const base = rel.slice('assets/'.length);
            const next = urls.get(base);
            if (!next)
                throw new common_1.BadRequestException(`Thiếu file assets/${base} trong ZIP`);
            return next;
        });
        const meta = rewritten.meta;
        if (meta && typeof meta === 'object' && typeof meta.htmlSource === 'string') {
            const withRefs = (0, template_pack_1.rewriteHtmlAssetRefs)(meta.htmlSource, urls);
            meta.htmlSource = withRefs.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (full, quote, url) => {
                const base = url.trim().split('?')[0]?.split('#')[0]?.split('/').pop() || '';
                const next = urls.get(base);
                return next ? `url(${quote}${next}${quote})` : full;
            });
        }
        const sections = meta && typeof meta === 'object'
            ? meta.htmlSections
            : undefined;
        if (Array.isArray(sections)) {
            for (const row of sections) {
                if (typeof row.html === 'string')
                    row.html = (0, template_pack_1.rewriteHtmlAssetRefs)(row.html, urls);
            }
        }
        if (meta && typeof meta === 'object' && typeof meta.scopedCss === 'string') {
            meta.scopedCss = meta.scopedCss.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (full, quote, url) => {
                const base = url.trim().split('?')[0]?.split('#')[0]?.split('/').pop() || '';
                const next = urls.get(base);
                return next ? `url(${quote}${next}${quote})` : full;
            });
        }
        return this.acceptSpec(rewritten);
    }
    async snapshot(templateId, snapshot, userId, note) {
        const latest = await this.prisma.landingPageTemplateVersion.aggregate({
            where: { templateId },
            _max: { version: true },
        });
        await this.prisma.landingPageTemplateVersion.create({
            data: {
                templateId,
                version: (latest._max.version ?? 0) + 1,
                snapshot,
                note: note.slice(0, 500),
                createdById: userId,
            },
        });
    }
    async importNew(user, file) {
        this.assertAdmin(user);
        const pack = this.parseUpload(file);
        this.assertManifest(pack);
        const clash = await this.prisma.landingPageTemplate.findFirst({
            where: { slug: pack.manifest.slug, organizationId: null, isSystem: true },
            select: { id: true },
        });
        if (clash) {
            throw new common_1.BadRequestException('Slug đã có. Dùng Upload bản cập nhật trên thẻ mẫu đó.');
        }
        const id = cryptoRandomId();
        const assetKey = (0, crypto_1.randomBytes)(18).toString('base64url');
        const spec = await this.applyAssets(id, assetKey, pack);
        const tags = uniqueTags([...pack.manifest.tags, template_pack_1.TEMPLATE_PACK_MANAGED_TAG]);
        const row = await this.prisma.landingPageTemplate.create({
            data: {
                id,
                organizationId: null,
                isSystem: true,
                slug: pack.manifest.slug,
                name: pack.manifest.name,
                category: pack.manifest.category,
                theme: pack.manifest.theme,
                description: pack.manifest.description,
                tags,
                thumbnailUrl: thumbFromSpec(spec),
                definition: spec,
                publishedDefinition: database_1.Prisma.DbNull,
                publishStatus: database_1.LandingPageTemplatePublishStatus.DRAFT,
                assetKey,
            },
        });
        return this.serializeAdmin(row);
    }
    async importUpdate(user, idOrSlug, file) {
        // Template rows only. User pages keep their own draftSpec/publishedSpec.
        this.assertAdmin(user);
        const pack = this.parseUpload(file);
        const row = await this.findAdminTemplate(idOrSlug);
        if (pack.htmlOnly) {
            pack.manifest.slug = row.slug;
            pack.manifest.category = row.category;
            pack.manifest.theme = row.theme;
            if (!pack.manifest.name.trim())
                pack.manifest.name = row.name;
        }
        this.assertManifest(pack);
        // Older exported packs stripped the render-only themeTokens key as if it were a secret.
        // Preserve current colors for such same-theme updates; explicit incoming tokens still win.
        const previousSpec = row.definition;
        if (!Object.hasOwn(pack.template, 'themeTokens') && pack.manifest.theme === row.theme && previousSpec?.themeTokens) {
            pack.template.themeTokens = previousSpec.themeTokens;
        }
        if (pack.manifest.slug !== row.slug) {
            throw new common_1.BadRequestException(`Slug trong gói phải là ${row.slug}`);
        }
        await this.snapshot(row.id, row.definition, user.id, 'Trước khi upload bản cập nhật');
        const assetKey = row.assetKey || (0, crypto_1.randomBytes)(18).toString('base64url');
        const spec = await this.applyAssets(row.id, assetKey, pack);
        const published = stripAssetKeys(spec);
        const tags = uniqueTags([...(row.tags || []), ...pack.manifest.tags, template_pack_1.TEMPLATE_PACK_MANAGED_TAG]);
        const updated = await this.prisma.landingPageTemplate.update({
            where: { id: row.id },
            data: {
                name: pack.manifest.name,
                category: pack.manifest.category,
                theme: pack.manifest.theme,
                description: pack.html ? row.description : pack.manifest.description,
                tags,
                thumbnailUrl: thumbFromSpec(published) || row.thumbnailUrl,
                definition: published,
                publishedDefinition: published,
                publishStatus: database_1.LandingPageTemplatePublishStatus.PUBLISHED,
                assetKey,
            },
        });
        return this.serializeAdmin(updated);
    }
    /**
     * Chế độ 2: sửa trực tiếp mẫu gốc. Mở (hoặc tạo) một trang làm việc ẩn chứa bản nháp của mẫu
     * để admin sửa bằng builder. Mẫu chỉ đổi khi gọi saveFromSession.
     */
    async openEditSession(user, idOrSlug, opts) {
        this.assertAdmin(user);
        const row = await this.findAdminTemplate(idOrSlug);
        const slug = `${template_pack_1.TEMPLATE_EDIT_SLUG_PREFIX}${row.slug}`.slice(0, 120);
        const existing = await this.prisma.landingPage.findFirst({
            where: { organizationId: user.organizationId, slug },
        });
        const spec = (0, shared_1.sanitizeLandingPageSpec)(row.definition);
        if (existing) {
            if (opts?.reset) {
                await this.prisma.landingPage.update({
                    where: { id: existing.id },
                    data: { draftSpec: spec },
                });
            }
            return { pageId: existing.id, slug: row.slug, name: row.name, reused: !opts?.reset };
        }
        const page = await this.prisma.landingPage.create({
            data: {
                organizationId: user.organizationId,
                createdById: user.id,
                templateId: row.id,
                name: `[Sửa mẫu] ${row.name}`.slice(0, 120),
                slug,
                status: database_1.LandingPageStatus.DRAFT,
                theme: row.theme,
                draftSpec: spec,
                robotsIndex: false,
            },
        });
        return { pageId: page.id, slug: row.slug, name: row.name, reused: false };
    }
    /** Ghi bản đang sửa trong builder vào mẫu gốc. `publish` = đưa ngay cho người dùng. */
    async saveFromSession(user, idOrSlug, opts) {
        this.assertAdmin(user);
        const row = await this.findAdminTemplate(idOrSlug);
        const page = await this.prisma.landingPage.findFirst({
            where: {
                organizationId: user.organizationId,
                slug: `${template_pack_1.TEMPLATE_EDIT_SLUG_PREFIX}${row.slug}`.slice(0, 120),
            },
        });
        if (!page)
            throw new common_1.NotFoundException('Chưa mở phiên sửa mẫu. Hãy bấm "Sửa mẫu gốc" trước.');
        const spec = (0, shared_1.sanitizeLandingPageSpec)(page.draftSpec);
        if (!Array.isArray(spec.blocks) || spec.blocks.length === 0) {
            throw new common_1.BadRequestException('Mẫu đang trống, không thể lưu vào mẫu gốc.');
        }
        await this.snapshot(row.id, row.definition, user.id, opts.publish ? 'Trước khi sửa và xuất bản từ builder' : 'Trước khi lưu từ builder');
        const clean = stripAssetKeys(spec);
        await this.prisma.landingPageTemplate.update({
            where: { id: row.id },
            data: {
                definition: clean,
                // Gắn tag để đồng bộ catalog khi khởi động API không ghi đè bản đã sửa tay.
                tags: uniqueTags([...(row.tags || []), template_pack_1.TEMPLATE_PACK_MANAGED_TAG]),
                ...(row.publishedDefinition == null ? { publishStatus: database_1.LandingPageTemplatePublishStatus.DRAFT } : {}),
            },
        });
        if (opts.publish)
            return this.publish(user, row.id);
        const fresh = await this.findAdminTemplate(row.id);
        return this.serializeAdmin(fresh);
    }
    /** Tải toàn bộ mẫu hệ thống: một ZIP chứa packs/<slug>.zip cho từng mẫu (cùng định dạng upload lại được). */
    async exportAll(user) {
        this.assertAdmin(user);
        const rows = await this.prisma.landingPageTemplate.findMany({
            where: { organizationId: null, isSystem: true },
            select: { id: true, slug: true },
            orderBy: { slug: 'asc' },
        });
        const entries = [];
        for (const r of rows) {
            const pack = await this.exportPack(user, r.id);
            entries.push({ name: `packs/${r.slug}.zip`, data: pack.body });
        }
        const stamp = new Date().toISOString().slice(0, 10);
        return { filename: `all-landing-templates-${stamp}.zip`, body: (0, template_pack_1.buildStoredZip)(entries), count: rows.length };
    }
    /**
     * Upload hàng loạt: nhận nhiều file .zip/.html. Một ZIP chứa toàn các gói .zip (bản "tải tất cả")
     * được tách ra từng mẫu. Slug đã có thì cập nhật, chưa có thì tạo mới (nháp). Lỗi một file không dừng cả lô.
     */
    async importBulk(user, files) {
        this.assertAdmin(user);
        if (!files?.length)
            throw new common_1.BadRequestException('Chưa chọn file nào');
        let queue = [];
        const preferences = (0, template_pack_bulk_1.parseTemplateBulkPreferences)(process.env.LP_TEMPLATE_BULK_PREFERRED_SOURCES);
        const results = [];
        for (const f of files) {
            try {
                queue.push(...(0, template_pack_bulk_1.expandTemplateBulkFile)(f, preferences));
            }
            catch (e) {
                // Preserve the bulk ZIP error instead of retrying it as a 20 MiB single pack.
                results.push({ file: f.originalname || 'file', status: 'error', message: e instanceof Error ? e.message : 'Không đọc được ZIP tổng' });
            }
        }
        try {
            queue = (0, template_pack_bulk_1.deduplicateTemplateBulkFiles)(queue, preferences);
        }
        catch (e) {
            throw new common_1.BadRequestException(e instanceof Error ? e.message : 'Không xác định được mẫu trùng');
        }
        if (queue.length > 300)
            throw new common_1.BadRequestException('Tối đa 300 mẫu mỗi lần upload');
        for (const f of queue) {
            const label = f.originalname || 'file';
            try {
                const pack = this.parseUpload(f);
                const slug = pack.manifest.slug;
                const existing = pack.htmlOnly
                    ? null
                    : await this.prisma.landingPageTemplate.findFirst({
                        where: { slug, organizationId: null, isSystem: true },
                        select: { id: true },
                    });
                if (existing) {
                    await this.importUpdate(user, slug, f);
                    results.push({ file: label, status: 'updated', slug });
                }
                else {
                    const row = await this.importNew(user, f);
                    results.push({ file: label, status: 'created', slug: row.slug });
                }
            }
            catch (e) {
                results.push({ file: label, status: 'error', message: e instanceof Error ? e.message : 'Lỗi không xác định' });
            }
        }
        return {
            total: results.length,
            created: results.filter((r) => r.status === 'created').length,
            updated: results.filter((r) => r.status === 'updated').length,
            failed: results.filter((r) => r.status === 'error').length,
            results,
        };
    }
    async publish(user, idOrSlug) {
        this.assertAdmin(user);
        const row = await this.findAdminTemplate(idOrSlug);
        const published = stripAssetKeys(row.definition);
        const updated = await this.prisma.landingPageTemplate.update({
            where: { id: row.id },
            data: {
                definition: published,
                publishedDefinition: published,
                publishStatus: database_1.LandingPageTemplatePublishStatus.PUBLISHED,
                thumbnailUrl: thumbFromSpec(published) || row.thumbnailUrl,
            },
        });
        return this.serializeAdmin(updated);
    }
    async listVersions(user, idOrSlug) {
        this.assertAdmin(user);
        const row = await this.findAdminTemplate(idOrSlug);
        const versions = await this.prisma.landingPageTemplateVersion.findMany({
            where: { templateId: row.id },
            orderBy: { version: 'desc' },
            take: 30,
            select: { version: true, note: true, createdAt: true },
        });
        return { slug: row.slug, publishStatus: row.publishStatus, versions };
    }
    async restore(user, idOrSlug, version) {
        this.assertAdmin(user);
        const row = await this.findAdminTemplate(idOrSlug);
        const target = await this.prisma.landingPageTemplateVersion.findUnique({
            where: { templateId_version: { templateId: row.id, version } },
        });
        if (!target)
            throw new common_1.NotFoundException('Không có phiên bản này');
        await this.snapshot(row.id, row.definition, user.id, `Trước khi khôi phục v${version}`);
        const updated = await this.prisma.landingPageTemplate.update({
            where: { id: row.id },
            data: {
                definition: target.snapshot,
                publishStatus: database_1.LandingPageTemplatePublishStatus.DRAFT,
                tags: uniqueTags([...(row.tags || []), template_pack_1.TEMPLATE_PACK_MANAGED_TAG]),
            },
        });
        return this.serializeAdmin(updated);
    }
    async exportPack(user, idOrSlug) {
        this.assertAdmin(user);
        const row = await this.findAdminTemplate(idOrSlug);
        const spec = (0, template_pack_1.stripSensitiveKeys)(row.definition);
        const assets = [];
        const exported = mapStrings(spec, (value) => {
            const name = assetNameFromUrl(value, row.id);
            if (!name)
                return value;
            return `assets/${name}`;
        });
        const names = new Set();
        collectAssetNames(exported, names);
        for (const name of names) {
            const file = (0, path_1.join)(this.assetDir(row.id), name);
            if (!(0, fs_1.existsSync)(file))
                continue;
            const bytes = await (0, promises_1.readFile)(file);
            assets.push({ name, bytes });
        }
        const manifest = {
            format: template_pack_1.TEMPLATE_PACK_FORMAT,
            formatVersion: template_pack_1.TEMPLATE_PACK_FORMAT_VERSION,
            slug: row.slug,
            name: row.name,
            category: row.category,
            theme: row.theme,
            description: row.description,
            tags: (row.tags || []).filter((t) => t !== template_pack_1.TEMPLATE_PACK_MANAGED_TAG),
        };
        const htmlSource = exported.meta && typeof exported.meta === 'object'
            ? String(exported.meta.htmlSource || '')
            : '';
        const htmlFile = htmlSource
            ? htmlSource.replace(new RegExp(`/landing-pages/public/template-assets/${row.id}/([^"'\\s?]+)`, 'g'), 'assets/$1')
            : '';
        const body = (0, template_pack_1.buildStoredZip)([
            { name: 'manifest.json', data: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`) },
            { name: 'template.json', data: Buffer.from(`${JSON.stringify(exported, null, 2)}\n`) },
            ...(htmlFile ? [{ name: 'index.html', data: Buffer.from(htmlFile) }] : []),
            { name: 'README.md', data: Buffer.from((0, template_pack_1.templatePackReadme)(row.slug)) },
            ...assets.map((a) => ({ name: `assets/${a.name}`, data: a.bytes })),
        ]);
        return { filename: `${row.slug}-template.zip`, body };
    }
    async openPublicHtml(templateId, key) {
        if (!/^[0-9a-f-]{16,40}$/i.test(templateId))
            throw new common_1.NotFoundException();
        const row = await this.prisma.landingPageTemplate.findUnique({
            where: { id: templateId },
            select: { publishStatus: true, assetKey: true, definition: true, publishedDefinition: true },
        });
        if (!row)
            throw new common_1.NotFoundException();
        const published = row.publishStatus === database_1.LandingPageTemplatePublishStatus.PUBLISHED;
        if (!published && (!key || !row.assetKey || key !== row.assetKey))
            throw new common_1.NotFoundException();
        const raw = (published ? row.publishedDefinition ?? row.definition : row.definition);
        const html = typeof raw?.meta?.htmlSource === 'string' ? raw.meta.htmlSource : '';
        if (!html.trim())
            throw new common_1.NotFoundException();
        return html;
    }
    async openPublicAsset(templateId, file, key) {
        if (!/^[0-9a-f-]{16,40}$/i.test(templateId))
            throw new common_1.NotFoundException();
        const base = safeAssetBase(file);
        const row = await this.prisma.landingPageTemplate.findUnique({
            where: { id: templateId },
            select: { publishStatus: true, assetKey: true },
        });
        if (!row)
            throw new common_1.NotFoundException();
        if (row.publishStatus !== database_1.LandingPageTemplatePublishStatus.PUBLISHED) {
            if (!key || !row.assetKey || key !== row.assetKey)
                throw new common_1.NotFoundException();
        }
        const root = this.assetDir(templateId);
        const full = (0, path_1.join)(root, base);
        if (!(0, fs_1.existsSync)(full))
            throw new common_1.NotFoundException();
        const rootReal = (0, fs_1.realpathSync)(root);
        const fileReal = (0, fs_1.realpathSync)(full);
        if (fileReal !== rootReal && !fileReal.startsWith(rootReal + path_1.sep))
            throw new common_1.NotFoundException();
        const ext = base.slice(base.lastIndexOf('.')).toLowerCase();
        const mime = ASSET_MIME[ext];
        if (!mime)
            throw new common_1.NotFoundException();
        return new common_1.StreamableFile((0, fs_1.createReadStream)(fileReal), {
            type: mime,
            disposition: `inline; filename="${base}"`,
        });
    }
    async findAdminTemplate(idOrSlug) {
        const row = await this.prisma.landingPageTemplate.findFirst({
            where: {
                OR: [
                    { id: idOrSlug, organizationId: null, isSystem: true },
                    { slug: idOrSlug, organizationId: null, isSystem: true },
                    { id: idOrSlug },
                    { slug: idOrSlug },
                ],
            },
            orderBy: { isSystem: 'desc' },
        });
        if (!row)
            throw new common_1.NotFoundException('Template không tồn tại');
        return row;
    }
    serializeAdmin(row) {
        return {
            id: row.id,
            slug: row.slug,
            name: row.name,
            publishStatus: row.publishStatus,
            hasPublishedVersion: row.publishedDefinition != null,
            draft: row.publishStatus === database_1.LandingPageTemplatePublishStatus.DRAFT,
        };
    }
};
exports.LandingPageTemplatePackService = LandingPageTemplatePackService;
exports.LandingPageTemplatePackService = LandingPageTemplatePackService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LandingPageTemplatePackService);
function cryptoRandomId() {
    return (0, crypto_1.randomBytes)(16).toString('hex').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
}
function uniqueTags(tags) {
    return [...new Set(tags.map((t) => t.trim()).filter(Boolean))].slice(0, 40);
}
function thumbFromSpec(spec) {
    const gallery = spec.meta?.gallery;
    const thumb = gallery?.thumbnail;
    return typeof thumb === 'string' ? thumb.slice(0, 2000) : null;
}
function mapStrings(value, fn) {
    if (typeof value === 'string')
        return fn(value);
    if (Array.isArray(value))
        return value.map((item) => mapStrings(item, fn));
    if (value && typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value))
            out[k] = mapStrings(v, fn);
        return out;
    }
    return value;
}
function assetNameFromUrl(value, templateId) {
    const marker = `/landing-pages/public/template-assets/${templateId}/`;
    const i = value.indexOf(marker);
    if (i < 0)
        return null;
    const name = decodeURIComponent(value.slice(i + marker.length).split('?')[0] || '');
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/.test(name))
        return null;
    return name;
}
function collectAssetNames(value, into) {
    if (typeof value === 'string' && value.startsWith('assets/')) {
        const name = value.slice('assets/'.length).split('?')[0];
        if (name)
            into.add(name);
        return;
    }
    if (Array.isArray(value)) {
        for (const item of value)
            collectAssetNames(item, into);
        return;
    }
    if (value && typeof value === 'object') {
        for (const v of Object.values(value))
            collectAssetNames(v, into);
    }
}
function stripAssetKeys(value) {
    return mapStrings(value, (s) => s.replace(/(\/template-assets\/[^?\s]+)\?k=[^&\s"]+/g, '$1'));
}
function safeAssetBase(file) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/.test(file) || file.includes('..')) {
        throw new common_1.NotFoundException();
    }
    const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
    if (!ASSET_MIME[ext])
        throw new common_1.NotFoundException();
    return file;
}
