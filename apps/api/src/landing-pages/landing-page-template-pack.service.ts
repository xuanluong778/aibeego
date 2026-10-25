import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream, existsSync, realpathSync } from 'fs';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { randomBytes } from 'crypto';
import { join, sep } from 'path';
import {
  LandingPageTemplatePublishStatus,
  LandingPageTheme,
  Prisma,
} from '@marketingspa/database';
import { LANDING_PAGE_CATEGORIES, sanitizeLandingPageSpec, type LandingPageSpec } from '@marketingspa/shared';
import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { PrismaService } from '../prisma/prisma.service';
import {
  TEMPLATE_PACK_FORMAT,
  TEMPLATE_PACK_FORMAT_VERSION,
  TEMPLATE_PACK_MANAGED_TAG,
  TEMPLATE_PACK_MAX_ZIP_BYTES,
  TemplatePackError,
  buildStoredZip,
  isPlatformAdmin,
  parseHtmlDocument,
  parseTemplatePack,
  rewriteHtmlAssetRefs,
  stripSensitiveKeys,
  templatePackReadme,
  type ParsedTemplatePack,
} from './template-pack';

const THEMES = new Set<string>(Object.values(LandingPageTheme));
const ASSET_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

type UploadFile = { originalname?: string; buffer?: Buffer; size?: number };

@Injectable()
export class LandingPageTemplatePackService {
  constructor(private readonly prisma: PrismaService) {}

  private assertAdmin(user: AuthUser) {
    if (!isPlatformAdmin(user)) {
      throw new ForbiddenException('Chỉ quản trị hệ thống mới được tải hoặc cập nhật mẫu.');
    }
  }

  private assetDir(templateId: string) {
    return join(process.cwd(), 'uploads', 'landing-template-packs', templateId);
  }

  private parseUpload(file: UploadFile | undefined): ParsedTemplatePack {
    if (!file?.buffer?.length) throw new BadRequestException('Thiếu file ZIP hoặc HTML');
    const name = (file.originalname || '').toLowerCase();
    const isHtml = name.endsWith('.html') || name.endsWith('.htm');
    const isZip = name.endsWith('.zip');
    if (!isHtml && !isZip) throw new BadRequestException('Chỉ nhận file .zip, .html hoặc .htm');
    const max = isHtml ? 1_500_000 : TEMPLATE_PACK_MAX_ZIP_BYTES;
    if ((file.size ?? file.buffer.length) > max) {
      throw new BadRequestException(isHtml ? 'File HTML vượt dung lượng 1.5MB' : 'ZIP vượt dung lượng 20MB');
    }
    try {
      return isHtml ? parseHtmlDocument(file.originalname || 'template.html', file.buffer) : parseTemplatePack(file.buffer);
    } catch (err) {
      if (err instanceof TemplatePackError) throw new BadRequestException(err.message);
      throw err;
    }
  }

  private acceptSpec(raw: Record<string, unknown>): LandingPageSpec {
    const inputBlocks = Array.isArray(raw.blocks) ? raw.blocks : [];
    const inputIds = new Set(
      inputBlocks
        .map((b) => (b && typeof b === 'object' ? String((b as { id?: string }).id || '') : ''))
        .filter(Boolean),
    );
    const spec = sanitizeLandingPageSpec(raw);
    const kept = spec.blocks.filter((b) => inputIds.has(b.id));
    if (!kept.length) {
      throw new BadRequestException('template.json không còn block hợp lệ sau khi kiểm tra');
    }
    if (!spec.blocks.some((b) => b.type === 'LeadForm' || b.type === 'CTA')) {
      throw new BadRequestException('Mẫu phải giữ block LeadForm hoặc CTA để thu thập lead');
    }
    return spec;
  }

  private assertManifest(pack: ParsedTemplatePack) {
    if (!(LANDING_PAGE_CATEGORIES as readonly string[]).includes(pack.manifest.category)) {
      throw new BadRequestException('Category không thuộc danh mục mẫu');
    }
    if (!THEMES.has(pack.manifest.theme)) throw new BadRequestException('Theme không hợp lệ');
  }

  private async applyAssets(templateId: string, assetKey: string, pack: ParsedTemplatePack) {
    const dir = this.assetDir(templateId);
    if (pack.assets.length) await mkdir(dir, { recursive: true });
    const urls = new Map<string, string>();
    for (const asset of pack.assets) {
      await writeFile(join(dir, asset.name), asset.bytes);
      urls.set(
        asset.name,
        `/api/v1/landing-pages/public/template-assets/${templateId}/${asset.name}?k=${encodeURIComponent(assetKey)}`,
      );
    }
    const rewritten = mapStrings(pack.template, (value) => {
      const rel = value.replace(/^\.\//, '').split('?')[0] || '';
      if (!rel.startsWith('assets/')) return value;
      const base = rel.slice('assets/'.length);
      const next = urls.get(base);
      if (!next) throw new BadRequestException(`Thiếu file assets/${base} trong ZIP`);
      return next;
    }) as Record<string, unknown>;
    const meta = rewritten.meta;
    if (meta && typeof meta === 'object' && typeof (meta as { htmlSource?: unknown }).htmlSource === 'string') {
      const withRefs = rewriteHtmlAssetRefs((meta as { htmlSource: string }).htmlSource, urls);
      (meta as { htmlSource: string }).htmlSource = withRefs.replace(
        /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
        (full, quote: string, url: string) => {
          const base = url.trim().split('?')[0]?.split('#')[0]?.split('/').pop() || '';
          const next = urls.get(base);
          return next ? `url(${quote}${next}${quote})` : full;
        },
      );
    }
    const sections = meta && typeof meta === 'object'
      ? (meta as { htmlSections?: Array<{ html?: string }> }).htmlSections
      : undefined;
    if (Array.isArray(sections)) {
      for (const row of sections) {
        if (typeof row.html === 'string') row.html = rewriteHtmlAssetRefs(row.html, urls);
      }
    }
    if (meta && typeof meta === 'object' && typeof (meta as { scopedCss?: unknown }).scopedCss === 'string') {
      (meta as { scopedCss: string }).scopedCss = (meta as { scopedCss: string }).scopedCss.replace(
        /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
        (full, quote: string, url: string) => {
          const base = url.trim().split('?')[0]?.split('#')[0]?.split('/').pop() || '';
          const next = urls.get(base);
          return next ? `url(${quote}${next}${quote})` : full;
        },
      );
    }
    return this.acceptSpec(rewritten);
  }

  private async snapshot(templateId: string, snapshot: Prisma.InputJsonValue, userId: string, note: string) {
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

  async importNew(user: AuthUser, file: UploadFile | undefined) {
    this.assertAdmin(user);
    const pack = this.parseUpload(file);
    this.assertManifest(pack);
    const clash = await this.prisma.landingPageTemplate.findFirst({
      where: { slug: pack.manifest.slug, organizationId: null, isSystem: true },
      select: { id: true },
    });
    if (clash) {
      throw new BadRequestException('Slug đã có. Dùng Upload bản cập nhật trên thẻ mẫu đó.');
    }
    const id = cryptoRandomId();
    const assetKey = randomBytes(18).toString('base64url');
    const spec = await this.applyAssets(id, assetKey, pack);
    const tags = uniqueTags([...pack.manifest.tags, TEMPLATE_PACK_MANAGED_TAG]);
    const row = await this.prisma.landingPageTemplate.create({
      data: {
        id,
        organizationId: null,
        isSystem: true,
        slug: pack.manifest.slug,
        name: pack.manifest.name,
        category: pack.manifest.category,
        theme: pack.manifest.theme as LandingPageTheme,
        description: pack.manifest.description,
        tags,
        thumbnailUrl: thumbFromSpec(spec),
        definition: spec as unknown as Prisma.InputJsonValue,
        publishedDefinition: Prisma.DbNull,
        publishStatus: LandingPageTemplatePublishStatus.DRAFT,
        assetKey,
      },
    });
    return this.serializeAdmin(row);
  }

  async importUpdate(user: AuthUser, idOrSlug: string, file: UploadFile | undefined) {
    // Template rows only. User pages keep their own draftSpec/publishedSpec.
    this.assertAdmin(user);
    const pack = this.parseUpload(file);
    const row = await this.findAdminTemplate(idOrSlug);
    if (pack.htmlOnly) {
      pack.manifest.slug = row.slug;
      pack.manifest.category = row.category;
      pack.manifest.theme = row.theme;
      if (!pack.manifest.name.trim()) pack.manifest.name = row.name;
    }
    this.assertManifest(pack);
    if (pack.manifest.slug !== row.slug) {
      throw new BadRequestException(`Slug trong gói phải là ${row.slug}`);
    }
    await this.snapshot(row.id, row.definition as Prisma.InputJsonValue, user.id, 'Trước khi upload bản cập nhật');
    const assetKey = row.assetKey || randomBytes(18).toString('base64url');
    const spec = await this.applyAssets(row.id, assetKey, pack);
    const published = stripAssetKeys(spec) as LandingPageSpec;
    const tags = uniqueTags([...(row.tags || []), ...pack.manifest.tags, TEMPLATE_PACK_MANAGED_TAG]);
    const updated = await this.prisma.landingPageTemplate.update({
      where: { id: row.id },
      data: {
        name: pack.manifest.name,
        category: pack.manifest.category,
        theme: pack.manifest.theme as LandingPageTheme,
        description: pack.html ? row.description : pack.manifest.description,
        tags,
        thumbnailUrl: thumbFromSpec(published) || row.thumbnailUrl,
        definition: published as unknown as Prisma.InputJsonValue,
        publishedDefinition: published as unknown as Prisma.InputJsonValue,
        publishStatus: LandingPageTemplatePublishStatus.PUBLISHED,
        assetKey,
      },
    });
    return this.serializeAdmin(updated);
  }

  async publish(user: AuthUser, idOrSlug: string) {
    this.assertAdmin(user);
    const row = await this.findAdminTemplate(idOrSlug);
    const published = stripAssetKeys(row.definition);
    const updated = await this.prisma.landingPageTemplate.update({
      where: { id: row.id },
      data: {
        definition: published as Prisma.InputJsonValue,
        publishedDefinition: published as Prisma.InputJsonValue,
        publishStatus: LandingPageTemplatePublishStatus.PUBLISHED,
        thumbnailUrl: thumbFromSpec(published as LandingPageSpec) || row.thumbnailUrl,
      },
    });
    return this.serializeAdmin(updated);
  }

  async listVersions(user: AuthUser, idOrSlug: string) {
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

  async restore(user: AuthUser, idOrSlug: string, version: number) {
    this.assertAdmin(user);
    const row = await this.findAdminTemplate(idOrSlug);
    const target = await this.prisma.landingPageTemplateVersion.findUnique({
      where: { templateId_version: { templateId: row.id, version } },
    });
    if (!target) throw new NotFoundException('Không có phiên bản này');
    await this.snapshot(row.id, row.definition as Prisma.InputJsonValue, user.id, `Trước khi khôi phục v${version}`);
    const updated = await this.prisma.landingPageTemplate.update({
      where: { id: row.id },
      data: {
        definition: target.snapshot as Prisma.InputJsonValue,
        publishStatus: LandingPageTemplatePublishStatus.DRAFT,
        tags: uniqueTags([...(row.tags || []), TEMPLATE_PACK_MANAGED_TAG]),
      },
    });
    return this.serializeAdmin(updated);
  }

  async exportPack(user: AuthUser, idOrSlug: string): Promise<{ filename: string; body: Buffer }> {
    this.assertAdmin(user);
    const row = await this.findAdminTemplate(idOrSlug);
    const spec = stripSensitiveKeys(row.definition) as Record<string, unknown>;
    const assets: Array<{ name: string; bytes: Buffer }> = [];
    const exported = mapStrings(spec, (value) => {
      const name = assetNameFromUrl(value, row.id);
      if (!name) return value;
      return `assets/${name}`;
    }) as Record<string, unknown>;
    const names = new Set<string>();
    collectAssetNames(exported, names);
    for (const name of names) {
      const file = join(this.assetDir(row.id), name);
      if (!existsSync(file)) continue;
      const bytes = await readFile(file);
      assets.push({ name, bytes });
    }
    const manifest = {
      format: TEMPLATE_PACK_FORMAT,
      formatVersion: TEMPLATE_PACK_FORMAT_VERSION,
      slug: row.slug,
      name: row.name,
      category: row.category,
      theme: row.theme,
      description: row.description,
      tags: (row.tags || []).filter((t) => t !== TEMPLATE_PACK_MANAGED_TAG),
    };
    const htmlSource =
      exported.meta && typeof exported.meta === 'object'
        ? String((exported.meta as { htmlSource?: unknown }).htmlSource || '')
        : '';
    const htmlFile = htmlSource
      ? htmlSource.replace(
          new RegExp(`/landing-pages/public/template-assets/${row.id}/([^"'\\s?]+)`, 'g'),
          'assets/$1',
        )
      : '';
    const body = buildStoredZip([
      { name: 'manifest.json', data: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`) },
      { name: 'template.json', data: Buffer.from(`${JSON.stringify(exported, null, 2)}\n`) },
      ...(htmlFile ? [{ name: 'index.html', data: Buffer.from(htmlFile) }] : []),
      { name: 'README.md', data: Buffer.from(templatePackReadme(row.slug)) },
      ...assets.map((a) => ({ name: `assets/${a.name}`, data: a.bytes })),
    ]);
    return { filename: `${row.slug}-template.zip`, body };
  }

  async openPublicHtml(templateId: string, key?: string): Promise<string> {
    if (!/^[0-9a-f-]{16,40}$/i.test(templateId)) throw new NotFoundException();
    const row = await this.prisma.landingPageTemplate.findUnique({
      where: { id: templateId },
      select: { publishStatus: true, assetKey: true, definition: true, publishedDefinition: true },
    });
    if (!row) throw new NotFoundException();
    const published = row.publishStatus === LandingPageTemplatePublishStatus.PUBLISHED;
    if (!published && (!key || !row.assetKey || key !== row.assetKey)) throw new NotFoundException();
    const raw = (published ? row.publishedDefinition ?? row.definition : row.definition) as {
      meta?: { htmlSource?: unknown };
    } | null;
    const html = typeof raw?.meta?.htmlSource === 'string' ? raw.meta.htmlSource : '';
    if (!html.trim()) throw new NotFoundException();
    return html;
  }

  async openPublicAsset(templateId: string, file: string, key?: string): Promise<StreamableFile> {
    if (!/^[0-9a-f-]{16,40}$/i.test(templateId)) throw new NotFoundException();
    const base = safeAssetBase(file);
    const row = await this.prisma.landingPageTemplate.findUnique({
      where: { id: templateId },
      select: { publishStatus: true, assetKey: true },
    });
    if (!row) throw new NotFoundException();
    if (row.publishStatus !== LandingPageTemplatePublishStatus.PUBLISHED) {
      if (!key || !row.assetKey || key !== row.assetKey) throw new NotFoundException();
    }
    const root = this.assetDir(templateId);
    const full = join(root, base);
    if (!existsSync(full)) throw new NotFoundException();
    const rootReal = realpathSync(root);
    const fileReal = realpathSync(full);
    if (fileReal !== rootReal && !fileReal.startsWith(rootReal + sep)) throw new NotFoundException();
    const ext = base.slice(base.lastIndexOf('.')).toLowerCase();
    const mime = ASSET_MIME[ext];
    if (!mime) throw new NotFoundException();
    return new StreamableFile(createReadStream(fileReal), {
      type: mime,
      disposition: `inline; filename="${base}"`,
    });
  }

  private async findAdminTemplate(idOrSlug: string) {
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
    if (!row) throw new NotFoundException('Template không tồn tại');
    return row;
  }

  private serializeAdmin(row: {
    id: string;
    slug: string;
    name: string;
    publishStatus: LandingPageTemplatePublishStatus;
    publishedDefinition: Prisma.JsonValue | null;
  }) {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      publishStatus: row.publishStatus,
      hasPublishedVersion: row.publishedDefinition != null,
      draft: row.publishStatus === LandingPageTemplatePublishStatus.DRAFT,
    };
  }
}

function cryptoRandomId(): string {
  return randomBytes(16).toString('hex').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
}

function uniqueTags(tags: string[]): string[] {
  return [...new Set(tags.map((t) => t.trim()).filter(Boolean))].slice(0, 40);
}

function thumbFromSpec(spec: LandingPageSpec): string | null {
  const gallery = spec.meta?.gallery as { thumbnail?: string } | undefined;
  const thumb = gallery?.thumbnail;
  return typeof thumb === 'string' ? thumb.slice(0, 2000) : null;
}

function mapStrings(value: unknown, fn: (s: string) => string): unknown {
  if (typeof value === 'string') return fn(value);
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, fn));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = mapStrings(v, fn);
    return out;
  }
  return value;
}

function assetNameFromUrl(value: string, templateId: string): string | null {
  const marker = `/landing-pages/public/template-assets/${templateId}/`;
  const i = value.indexOf(marker);
  if (i < 0) return null;
  const name = decodeURIComponent(value.slice(i + marker.length).split('?')[0] || '');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/.test(name)) return null;
  return name;
}

function collectAssetNames(value: unknown, into: Set<string>) {
  if (typeof value === 'string' && value.startsWith('assets/')) {
    const name = value.slice('assets/'.length).split('?')[0];
    if (name) into.add(name);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectAssetNames(item, into);
    return;
  }
  if (value && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) collectAssetNames(v, into);
  }
}

function stripAssetKeys(value: unknown): unknown {
  return mapStrings(value, (s) => s.replace(/(\/template-assets\/[^?\s]+)\?k=[^&\s"]+/g, '$1'));
}

function safeAssetBase(file: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/.test(file) || file.includes('..')) {
    throw new NotFoundException();
  }
  const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
  if (!ASSET_MIME[ext]) throw new NotFoundException();
  return file;
}
