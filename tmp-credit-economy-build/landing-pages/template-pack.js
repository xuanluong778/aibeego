"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplatePackError = exports.TEMPLATE_PACK_MAX_ASSET_BYTES = exports.TEMPLATE_PACK_MAX_FILES = exports.TEMPLATE_PACK_MAX_UNCOMPRESSED_BYTES = exports.TEMPLATE_BULK_MAX_ZIP_BYTES = exports.TEMPLATE_PACK_MAX_ZIP_BYTES = exports.TEMPLATE_EDIT_SLUG_PREFIX = exports.TEMPLATE_PACK_MANAGED_TAG = exports.TEMPLATE_PACK_FORMAT_VERSION = exports.TEMPLATE_PACK_FORMAT = void 0;
exports.isPlatformAdmin = isPlatformAdmin;
exports.buildStoredZip = buildStoredZip;
exports.readZip = readZip;
exports.templateSpecFromHtml = templateSpecFromHtml;
exports.rewriteHtmlAssetRefs = rewriteHtmlAssetRefs;
exports.parseHtmlDocument = parseHtmlDocument;
exports.parseTemplatePack = parseTemplatePack;
exports.stripSensitiveKeys = stripSensitiveKeys;
exports.templatePackReadme = templatePackReadme;
/**
 * Gói mẫu landing page (ZIP) để chỉnh trong Cursor rồi upload lại.
 * Chỉ đọc JSON và ảnh. Không giải nén ra đĩa, không thực thi file trong gói.
 */
const zlib_1 = require("zlib");
const shared_1 = require("@marketingspa/shared");
exports.TEMPLATE_PACK_FORMAT = 'aibeego.landing-template';
exports.TEMPLATE_PACK_FORMAT_VERSION = 1;
exports.TEMPLATE_PACK_MANAGED_TAG = 'pack:managed';
/** Trang làm việc ẩn dùng để admin sửa trực tiếp mẫu gốc trong builder. Không bao giờ publish. */
exports.TEMPLATE_EDIT_SLUG_PREFIX = 'tpl-edit-';
exports.TEMPLATE_PACK_MAX_ZIP_BYTES = 20 * 1024 * 1024;
exports.TEMPLATE_BULK_MAX_ZIP_BYTES = 256 * 1024 * 1024;
exports.TEMPLATE_PACK_MAX_UNCOMPRESSED_BYTES = 40 * 1024 * 1024;
exports.TEMPLATE_PACK_MAX_FILES = 40;
exports.TEMPLATE_PACK_MAX_ASSET_BYTES = 8 * 1024 * 1024;
const ASSET_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
class TemplatePackError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TemplatePackError';
    }
}
exports.TemplatePackError = TemplatePackError;
function isPlatformAdmin(user) {
    return user?.role === 'SUPER_ADMIN' || user?.platformRole === 'SUPER_ADMIN';
}
function assertSafeZipPath(name) {
    const norm = name.replace(/\\/g, '/').replace(/^\/+/, '');
    if (!norm || norm.length > 180)
        throw new TemplatePackError('Đường dẫn trong ZIP không hợp lệ');
    if (norm.includes('\0') || norm.includes('..') || norm.startsWith('/') || /^[a-zA-Z]:/.test(norm)) {
        throw new TemplatePackError('ZIP chứa đường dẫn nguy hiểm');
    }
    const parts = norm.split('/');
    if (parts.some((p) => !p || p === '.' || p === '..')) {
        throw new TemplatePackError('ZIP chứa đường dẫn nguy hiểm');
    }
    return norm;
}
function extOf(name) {
    const i = name.lastIndexOf('.');
    return i >= 0 ? name.slice(i).toLowerCase() : '';
}
function assertAssetName(name) {
    if (!name.startsWith('assets/'))
        throw new TemplatePackError('Asset phải nằm trong thư mục assets/');
    const base = name.slice('assets/'.length);
    if (!base || base.includes('/') || base.includes('..')) {
        throw new TemplatePackError('Tên file asset không hợp lệ');
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/.test(base)) {
        throw new TemplatePackError(`Tên file không được phép: ${base}`);
    }
    const ext = extOf(base);
    if (!ASSET_EXT.has(ext)) {
        throw new TemplatePackError(`Loại file không được phép: ${base}`);
    }
    return base;
}
function dosDateTime(d = new Date()) {
    const time = ((d.getHours() & 0x1f) << 11) | ((d.getMinutes() & 0x3f) << 5) | ((d.getSeconds() / 2) & 0x1f);
    const date = (((d.getFullYear() - 1980) & 0x7f) << 9) | (((d.getMonth() + 1) & 0xf) << 5) | (d.getDate() & 0x1f);
    return { time, date };
}
function buildStoredZip(entries) {
    const { time, date } = dosDateTime();
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const entry of entries) {
        const name = Buffer.from(entry.name, 'utf8');
        if (name.length > 200)
            throw new TemplatePackError('Tên file trong ZIP quá dài');
        const crc = (0, zlib_1.crc32)(entry.data) >>> 0;
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0x0800, 6);
        local.writeUInt16LE(0, 8);
        local.writeUInt16LE(time, 10);
        local.writeUInt16LE(date, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(entry.data.length, 18);
        local.writeUInt32LE(entry.data.length, 22);
        local.writeUInt16LE(name.length, 26);
        local.writeUInt16LE(0, 28);
        locals.push(local, name, entry.data);
        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0x0800, 8);
        central.writeUInt16LE(0, 10);
        central.writeUInt16LE(time, 12);
        central.writeUInt16LE(date, 14);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(entry.data.length, 20);
        central.writeUInt32LE(entry.data.length, 24);
        central.writeUInt16LE(name.length, 28);
        central.writeUInt16LE(0, 30);
        central.writeUInt16LE(0, 32);
        central.writeUInt16LE(0, 34);
        central.writeUInt16LE(0, 36);
        central.writeUInt32LE(0, 38);
        central.writeUInt32LE(offset, 42);
        centrals.push(central, name);
        offset += local.length + name.length + entry.data.length;
    }
    const centralBuf = Buffer.concat(centrals);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(entries.length, 8);
    eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(centralBuf.length, 12);
    eocd.writeUInt32LE(offset, 16);
    eocd.writeUInt16LE(0, 20);
    return Buffer.concat([...locals, centralBuf, eocd]);
}
function findEocd(buf) {
    const min = Math.max(0, buf.length - (22 + 65535));
    for (let i = buf.length - 22; i >= min; i--) {
        if (buf.readUInt32LE(i) === 0x06054b50)
            return i;
    }
    throw new TemplatePackError('File không phải ZIP hợp lệ');
}
function readZip(buf, opts) {
    const maxZip = opts?.bundle ? exports.TEMPLATE_BULK_MAX_ZIP_BYTES : exports.TEMPLATE_PACK_MAX_ZIP_BYTES;
    const maxFiles = opts?.bundle ? 16000 : exports.TEMPLATE_PACK_MAX_FILES;
    const maxUncompressed = opts?.bundle ? 400 * 1024 * 1024 : exports.TEMPLATE_PACK_MAX_UNCOMPRESSED_BYTES;
    if (buf.length < 22 || buf.length > maxZip) {
        throw new TemplatePackError('Dung lượng ZIP không hợp lệ');
    }
    const eocd = findEocd(buf);
    const count = buf.readUInt16LE(eocd + 10);
    const centralSize = buf.readUInt32LE(eocd + 12);
    let ptr = buf.readUInt32LE(eocd + 16);
    if (count > maxFiles)
        throw new TemplatePackError('ZIP có quá nhiều file');
    if (ptr > buf.length || centralSize > buf.length)
        throw new TemplatePackError('ZIP hỏng');
    const out = new Map();
    let uncompressedTotal = 0;
    for (let n = 0; n < count; n++) {
        if (ptr + 46 > buf.length || buf.readUInt32LE(ptr) !== 0x02014b50) {
            throw new TemplatePackError('Thư mục ZIP hỏng');
        }
        const flags = buf.readUInt16LE(ptr + 8);
        const method = buf.readUInt16LE(ptr + 10);
        const compSize = buf.readUInt32LE(ptr + 20);
        const uncompSize = buf.readUInt32LE(ptr + 24);
        const nameLen = buf.readUInt16LE(ptr + 28);
        const extraLen = buf.readUInt16LE(ptr + 30);
        const commentLen = buf.readUInt16LE(ptr + 32);
        const localOff = buf.readUInt32LE(ptr + 42);
        const name = buf.slice(ptr + 46, ptr + 46 + nameLen).toString('utf8');
        ptr += 46 + nameLen + extraLen + commentLen;
        if (flags & 0x1)
            throw new TemplatePackError('ZIP có mật khẩu không được hỗ trợ');
        if (name.endsWith('/'))
            continue;
        const safe = assertSafeZipPath(name);
        if (localOff + 30 > buf.length || buf.readUInt32LE(localOff) !== 0x04034b50) {
            throw new TemplatePackError('ZIP hỏng');
        }
        const localNameLen = buf.readUInt16LE(localOff + 26);
        const localExtraLen = buf.readUInt16LE(localOff + 28);
        const dataOff = localOff + 30 + localNameLen + localExtraLen;
        if (dataOff + compSize > buf.length)
            throw new TemplatePackError('ZIP hỏng');
        uncompressedTotal += uncompSize;
        if (uncompressedTotal > maxUncompressed) {
            throw new TemplatePackError('ZIP giải nén vượt dung lượng cho phép');
        }
        const compressed = buf.slice(dataOff, dataOff + compSize);
        let data;
        if (method === 0)
            data = compressed;
        else if (method === 8) {
            try {
                data = (0, zlib_1.inflateRawSync)(compressed, { maxOutputLength: Math.max(1, maxUncompressed - (uncompressedTotal - uncompSize)) });
            }
            catch {
                throw new TemplatePackError('Không đọc được file nén trong ZIP');
            }
        }
        else {
            throw new TemplatePackError('Kiểu nén ZIP không được hỗ trợ');
        }
        if (data.length !== uncompSize) {
            throw new TemplatePackError('Kích thước file trong ZIP không khớp');
        }
        if (out.has(safe))
            throw new TemplatePackError(`File bị trùng: ${safe}`);
        out.set(safe, data);
    }
    return out;
}
function asObject(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new TemplatePackError(`${label} phải là JSON object`);
    }
    return value;
}
function readJson(buf, label, max) {
    if (buf.length > max)
        throw new TemplatePackError(`${label} quá lớn`);
    try {
        return asObject(JSON.parse(buf.toString('utf8')), label);
    }
    catch (err) {
        if (err instanceof TemplatePackError)
            throw err;
        throw new TemplatePackError(`${label} không phải JSON hợp lệ`);
    }
}
function htmlTitle(html) {
    const raw = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
    return raw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
}
function slugifyFileName(input) {
    const slug = input
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/gi, 'd')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
    return slug || 'html-template';
}
/** Client-side preview entrypoints lose their renderer when scripts are isolated.
 * They must not replace native JSON blocks or be accepted as standalone pages. */
function isClientOnlyPreviewShell(html) {
    const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i)?.[1] || html;
    const inert = body
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
    if (!/\bid\s*=\s*["'](?:app|root|__next)["']/i.test(inert))
        return false;
    if (/<(?:img|video|audio|svg|canvas|iframe|input|textarea|select|button)\b/i.test(inert))
        return false;
    return !inert.replace(/<[^>]*>/g, '').replace(/&(?:nbsp|#160|#xA0);/gi, '').trim();
}
function templateSpecFromHtml(html, name, assetNames = []) {
    if (isClientOnlyPreviewShell(html)) {
        throw new TemplatePackError('HTML xem thử chỉ có khung JavaScript, chưa có nội dung trang. Hãy upload gói manifest.json + template.json trong thư mục packs.');
    }
    const isolatedScriptCount = (html.match(/<script\b/gi) || []).length;
    const notes = (0, shared_1.describeHtmlImportLimits)(html);
    const safe = (0, shared_1.sanitizeTemplateHtml)(html);
    if (!safe.trim())
        throw new TemplatePackError('File HTML không có nội dung');
    const imported = (0, shared_1.landingSpecFromHtml)(safe, htmlTitle(safe) || name, new Set(assetNames));
    return {
        version: 1,
        theme: 'MODERN',
        seo: { ...imported.seo, robotsIndex: true },
        themeTokens: imported.themeTokens,
        blocks: imported.blocks,
        meta: {
            ...imported.meta,
            htmlSource: safe,
            isolatedScriptCount,
            ...(notes.length ? { htmlImportNotes: notes } : {}),
        },
    };
}
function rewriteHtmlAssetRefs(html, urls) {
    return html.replace(/(\s(?:src|href)\s*=\s*)(['"])([^'"]+)\2/gi, (full, prefix, quote, url) => {
        const clean = url.trim();
        if (/^(https?:|data:|mailto:|tel:|#|\/\/)/i.test(clean))
            return full;
        const base = clean.split('?')[0]?.split('#')[0]?.split('/').pop() || '';
        const next = urls.get(base);
        if (!next)
            return full;
        return `${prefix}${quote}${next}${quote}`;
    });
}
function readHtmlEntry(files) {
    const buf = files.get('index.html') || files.get('source.html');
    if (!buf)
        return null;
    if (buf.length > 1_500_000)
        throw new TemplatePackError('File HTML quá lớn');
    const html = buf.toString('utf8');
    if (!html.trim())
        throw new TemplatePackError('File HTML không có nội dung');
    return html;
}
function parseHtmlDocument(filename, buf) {
    if (buf.length <= 0 || buf.length > 1_500_000)
        throw new TemplatePackError('Dung lượng file HTML không hợp lệ');
    const base = filename.replace(/^.*[\\/]/, '').replace(/\.(html|htm)$/i, '');
    const html = buf.toString('utf8');
    const name = htmlTitle(html) || base.slice(0, 120) || 'HTML template';
    const manifest = {
        format: exports.TEMPLATE_PACK_FORMAT,
        formatVersion: exports.TEMPLATE_PACK_FORMAT_VERSION,
        slug: slugifyFileName(base),
        name,
        category: 'agency',
        theme: 'MODERN',
        description: 'Mẫu từ file HTML',
        tags: ['source:html'],
    };
    return {
        manifest,
        template: templateSpecFromHtml(html, name),
        assets: [],
        html,
        htmlOnly: true,
    };
}
function parseTemplatePack(buf) {
    const files = readZip(buf);
    const manifestBuf = files.get('manifest.json');
    const templateBuf = files.get('template.json');
    const sourceHtml = readHtmlEntry(files);
    // Preserve authored HTML precedence, but ignore an empty JS preview when the
    // same pack has native JSON. Invalid JSON still fails below; no silent fallback.
    const html = templateBuf && sourceHtml && isClientOnlyPreviewShell(sourceHtml) ? null : sourceHtml;
    if (!manifestBuf && !html) {
        throw new TemplatePackError('ZIP cần manifest.json và template.json, hoặc file index.html');
    }
    if (!templateBuf && !html) {
        throw new TemplatePackError('ZIP cần template.json hoặc index.html');
    }
    for (const name of files.keys()) {
        if (name === 'manifest.json' || name === 'template.json' || name === 'README.md')
            continue;
        if (name === 'index.html' || name === 'source.html')
            continue;
        if (name.startsWith('assets/'))
            continue;
        throw new TemplatePackError(`File không được phép trong gói: ${name}`);
    }
    const htmlOnly = Boolean(html) && !manifestBuf;
    let manifest;
    if (!manifestBuf) {
        const title = htmlTitle(html || '') || 'HTML template';
        manifest = {
            format: exports.TEMPLATE_PACK_FORMAT,
            formatVersion: exports.TEMPLATE_PACK_FORMAT_VERSION,
            slug: slugifyFileName(title),
            name: title,
            category: 'agency',
            theme: 'MODERN',
            description: 'Mẫu từ file HTML',
            tags: ['source:html'],
        };
    }
    else {
        const rawManifest = readJson(manifestBuf, 'manifest.json', 100_000);
        if (rawManifest.format !== exports.TEMPLATE_PACK_FORMAT || rawManifest.formatVersion !== exports.TEMPLATE_PACK_FORMAT_VERSION) {
            throw new TemplatePackError(`Định dạng gói không hỗ trợ. Cần ${exports.TEMPLATE_PACK_FORMAT} phiên bản ${exports.TEMPLATE_PACK_FORMAT_VERSION}`);
        }
        const slug = String(rawManifest.slug || '');
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
            throw new TemplatePackError('slug không hợp lệ');
        }
        const name = String(rawManifest.name || '').trim();
        const category = String(rawManifest.category || '').trim();
        const theme = String(rawManifest.theme || 'MODERN').trim();
        const description = String(rawManifest.description || '').slice(0, 4000);
        if (!name || name.length > 120)
            throw new TemplatePackError('Tên mẫu không hợp lệ');
        if (!category || category.length > 40)
            throw new TemplatePackError('Category không hợp lệ');
        if (!/^[A-Z_]+$/.test(theme) || theme.length > 32)
            throw new TemplatePackError('Theme không hợp lệ');
        const tags = Array.isArray(rawManifest.tags)
            ? rawManifest.tags.filter((t) => typeof t === 'string').slice(0, 30).map((t) => t.slice(0, 40))
            : [];
        manifest = {
            format: exports.TEMPLATE_PACK_FORMAT,
            formatVersion: exports.TEMPLATE_PACK_FORMAT_VERSION,
            slug,
            name,
            category,
            theme,
            description,
            tags,
        };
    }
    const assetNames = [...files.keys()]
        .filter((path) => path.startsWith('assets/'))
        .map((path) => path.slice('assets/'.length));
    let template = templateBuf
        ? readJson(templateBuf, 'template.json', 2_000_000)
        : templateSpecFromHtml(html || '', manifest.name, assetNames);
    if (html) {
        const fromHtml = templateSpecFromHtml(html, manifest.name, assetNames);
        const oldBlocks = Array.isArray(template.blocks) ? template.blocks : [];
        const lead = oldBlocks.filter((b) => {
            if (!b || typeof b !== 'object')
                return false;
            const type = b.type;
            return type === 'LeadForm' || type === 'CTA';
        });
        if (lead.length) {
            fromHtml.blocks = [
                ...fromHtml.blocks.filter((b) => {
                    const type = b.type;
                    return type !== 'LeadForm' && type !== 'CTA';
                }),
                ...lead,
            ];
        }
        template = fromHtml;
    }
    const blocks = template.blocks;
    if (!Array.isArray(blocks) || blocks.length < 1 || blocks.length > 80) {
        throw new TemplatePackError('template.json cần danh sách blocks hợp lệ');
    }
    const hasLead = blocks.some((b) => {
        if (!b || typeof b !== 'object')
            return false;
        const type = b.type;
        return type === 'LeadForm' || type === 'CTA';
    });
    if (!hasLead) {
        throw new TemplatePackError('Mẫu phải giữ block LeadForm hoặc CTA để thu thập lead');
    }
    const assets = [];
    for (const [path, bytes] of files) {
        if (!path.startsWith('assets/'))
            continue;
        const base = assertAssetName(path);
        if (bytes.length <= 0 || bytes.length > exports.TEMPLATE_PACK_MAX_ASSET_BYTES) {
            throw new TemplatePackError(`Dung lượng asset không hợp lệ: ${base}`);
        }
        assets.push({ name: base, bytes });
    }
    return { manifest, template, assets, html, htmlOnly };
}
const SECRET_KEY = /password|secret|token|api[_-]?key|authorization|clientsecret/i;
function stripSensitiveKeys(value) {
    if (Array.isArray(value))
        return value.map((item) => stripSensitiveKeys(item));
    if (!value || typeof value !== 'object')
        return value;
    const out = {};
    for (const [k, v] of Object.entries(value)) {
        if (k !== 'themeTokens' && SECRET_KEY.test(k))
            continue;
        out[k] = stripSensitiveKeys(v);
    }
    return out;
}
function templatePackReadme(slug) {
    return `# Mẫu landing page: ${slug}

Gói này là dữ liệu mẫu Ai Bee Go (không phải trang của khách). Chỉnh bằng Cursor rồi nén lại và upload.

## Cấu trúc

- \`manifest.json\` — tên, slug, category, theme. \`format\` phải là \`${exports.TEMPLATE_PACK_FORMAT}\` và \`formatVersion\` phải là ${exports.TEMPLATE_PACK_FORMAT_VERSION}.
- \`template.json\` — nội dung trang (blocks). Đây là nguồn trình dựng đang dùng.
- \`assets/\` — ảnh png, jpg, webp, gif. Trong JSON, dẫn bằng \`assets/ten-file.webp\`.
- \`index.html\` hoặc file \`.html\` — source giao diện. Có thể upload riêng file HTML, hoặc để \`index.html\` trong ZIP. Script trong HTML bị loại.
- Không thêm file \`.js\` hoặc đường dẫn \`../\`.

## Giữ thu thập lead

Giữ ít nhất một block \`LeadForm\` hoặc \`CTA\`. Có thể sửa tiêu đề, mô tả, nhãn form, lựa chọn. Đừng xóa form nếu mẫu đang dùng form để nhận lead.

## Đóng gói

Nén **nội dung thư mục gốc** (thấy \`manifest.json\` ngay khi mở ZIP, không bọc thêm một thư mục cha).

## Upload

- Mẫu mới: nút Upload mẫu mới trên trang Templates.
- Sửa mẫu này: Upload bản cập nhật trên đúng thẻ mẫu. Slug trong manifest phải trùng \`${slug}\`.

Upload bản cập nhật áp source và giao diện mới ngay. Trang landing người dùng đã tạo trước đó không bị đổi.

Không đưa mật khẩu, token, hay dữ liệu khách vào gói.
`;
}
