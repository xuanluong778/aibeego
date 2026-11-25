"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTemplateBulkPreferences = parseTemplateBulkPreferences;
exports.deduplicateTemplateBulkFiles = deduplicateTemplateBulkFiles;
exports.expandTemplateBulkFile = expandTemplateBulkFile;
/** Resolve bulk containers into logical templates, rather than counting ZIPs and folders twice. */
const crypto_1 = require("crypto");
const template_pack_1 = require("./template-pack");
const MAX_TEMPLATES = 300;
const ignored = (name) => name.split('/').some(p => p === '__MACOSX' || p === '.DS_Store' || p === 'Thumbs.db');
const hasDocument = (entries, root = '') => ['template.json', 'index.html', 'source.html'].some(n => entries.has(root + n));
const metadata = (entries, root = '') => {
    const bytes = entries.get(root + 'manifest.json');
    if (!bytes || bytes.length > 100_000)
        return null;
    let manifest;
    try {
        manifest = JSON.parse(bytes.toString('utf8'));
    }
    catch {
        return null;
    }
    if (!manifest || manifest.format !== template_pack_1.TEMPLATE_PACK_FORMAT || manifest.formatVersion !== template_pack_1.TEMPLATE_PACK_FORMAT_VERSION || typeof manifest.slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(manifest.slug) || manifest.slug.length > 80)
        return null;
    const hash = (0, crypto_1.createHash)('sha256');
    // ZIP headers/timestamps/order do not change a template's contents.
    for (const [name, data] of [...entries].filter(([name]) => name.startsWith(root) && !ignored(name)).sort(([a], [b]) => a.localeCompare(b))) {
        hash.update(name.slice(root.length));
        hash.update('\0');
        hash.update(data);
        hash.update('\0');
    }
    return { slug: manifest.slug, fingerprint: hash.digest('hex') };
};
const zipMetadata = (file) => {
    if (!file.buffer || !file.originalname?.toLowerCase().endsWith('.zip'))
        return null;
    try {
        const entries = (0, template_pack_1.readZip)(file.buffer);
        return hasDocument(entries) ? metadata(entries) : null;
    }
    catch {
        return null;
    }
};
const sourceAlias = (file) => (file.originalname || '').replace(/\\/g, '/').split('/').pop().replace(/\.zip$/i, '');
/** Explicit operator/user choice only; unconfigured conflicts keep requiring a choice. */
function parseTemplateBulkPreferences(raw) {
    if (!raw)
        return {};
    let value;
    try {
        value = JSON.parse(raw);
    }
    catch {
        throw new template_pack_1.TemplatePackError('Cấu hình chọn bản template không hợp lệ');
    }
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new template_pack_1.TemplatePackError('Cấu hình chọn bản template không hợp lệ');
    const result = {};
    for (const [slug, alias] of Object.entries(value)) {
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80 || typeof alias !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(alias) || alias.length > 120)
            throw new template_pack_1.TemplatePackError('Cấu hình chọn bản template không hợp lệ');
        result[slug] = alias;
    }
    return result;
}
/** Prefer extracted/editable source folders over their packaged copies, once per slug. */
function deduplicateTemplateBulkFiles(files, preferences = {}) {
    const result = [], seen = new Map();
    for (const file of files) {
        const info = zipMetadata(file);
        if (!info) {
            result.push(file);
            continue;
        } // Keep malformed packs for the existing per-file error report.
        const previous = seen.get(info.slug);
        if (!previous) {
            seen.set(info.slug, { index: result.length, fingerprint: info.fingerprint, source: file.bulkSource });
            result.push(file);
            continue;
        }
        const old = result[previous.index];
        const selected = preferences[info.slug];
        if (selected) {
            const oldSelected = sourceAlias(old) === selected, nextSelected = sourceAlias(file) === selected;
            if (oldSelected && !nextSelected)
                continue;
            if (nextSelected && !oldSelected) {
                result[previous.index] = file;
                seen.set(info.slug, { index: previous.index, fingerprint: info.fingerprint, source: file.bulkSource });
                continue;
            }
        }
        if (previous.source === 'folder' && file.bulkSource !== 'folder')
            continue;
        if (file.bulkSource === 'folder' && previous.source !== 'folder') {
            result[previous.index] = file;
            seen.set(info.slug, { index: previous.index, fingerprint: info.fingerprint, source: 'folder' });
            continue;
        }
        if (previous.fingerprint === info.fingerprint)
            continue;
        throw new template_pack_1.TemplatePackError(`Mẫu "${info.slug}" có nhiều bản khác nhau: ${old.originalname} và ${file.originalname}. Chỉ giữ một bản nguồn cho slug này.`);
    }
    return result;
}
const finish = (files, preferences) => {
    const unique = deduplicateTemplateBulkFiles(files, preferences);
    if (unique.length > MAX_TEMPLATES)
        throw new template_pack_1.TemplatePackError(`Đã nhận diện ${unique.length} mẫu khác nhau sau khi gộp trùng; tối đa 300 mẫu mỗi lần upload.`);
    return unique;
};
function expandTemplateBulkFile(file, preferences = {}) {
    if (!file.originalname?.toLowerCase().endsWith('.zip') || !file.buffer?.length)
        return [file];
    const entries = new Map([...(0, template_pack_1.readZip)(file.buffer, { bundle: true })].filter(([name]) => !ignored(name)));
    const allRoots = [...entries.keys()].filter(name => /(?:^|\/)manifest\.json$/.test(name)).map(name => name.slice(0, -'manifest.json'.length)).filter(root => entries.has(root + 'template.json') || (hasDocument(entries, root) && metadata(entries, root)));
    const childRoots = allRoots.filter(root => root !== '');
    // A folder owns all its contents; a ZIP kept inside that folder is not another template.
    const roots = childRoots.filter(root => !childRoots.some(parent => parent !== root && root.startsWith(parent)));
    const nested = [...entries].filter(([name]) => name.toLowerCase().endsWith('.zip') && !roots.some(root => name.startsWith(root)));
    if (!nested.length && !roots.length && entries.has('manifest.json') && hasDocument(entries))
        return [file];
    const packaged = nested.map(([name, buffer]) => ({ originalname: name, buffer, size: buffer.length, bulkSource: 'zip' }));
    const explicitTemplates = roots.length > 0 || packaged.some(p => zipMetadata(p));
    // Collection/gallery/demo HTML is ancillary when explicit manifest-based templates exist.
    // Pure HTML-folder archives still use the existing create-draft semantics.
    if (!explicitTemplates) {
        const htmlRoots = [...entries.keys()].filter(name => /(?:^|\/)(?:index|source)\.html$/i.test(name)).map(name => name.slice(0, name.lastIndexOf('/') + 1));
        for (const root of htmlRoots) {
            if (root === '' && (nested.length || htmlRoots.some(r => r !== '')))
                continue;
            if (!roots.some(parent => root.startsWith(parent) || parent.startsWith(root)))
                roots.push(root);
        }
    }
    if (!packaged.length && !roots.length) {
        if (file.buffer.length > template_pack_1.TEMPLATE_PACK_MAX_ZIP_BYTES)
            throw new template_pack_1.TemplatePackError('Không tìm thấy mẫu trong ZIP tổng. Mỗi mẫu cần một gói .zip hoặc thư mục chứa manifest.json và template.json/index.html.');
        return [file];
    }
    if (!packaged.length && roots.length === 1 && roots[0] === '')
        return [file];
    const expanded = [...packaged];
    for (const root of roots) {
        const files = [...entries].filter(([name]) => name.startsWith(root) && !name.toLowerCase().endsWith('.zip')).map(([name, data]) => ({ name: name.slice(root.length), data }));
        const label = root.replace(/\/$/, '') || file.originalname.replace(/\.zip$/i, '');
        const buffer = (0, template_pack_1.buildStoredZip)(files);
        expanded.push({ originalname: `${label}.zip`, buffer, size: buffer.length, bulkSource: 'folder' });
    }
    return finish(expanded, preferences);
}
