"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapHeader = mapHeader;
exports.splitCsvLine = splitCsvLine;
exports.parseCsv = parseCsv;
exports.parseXlsx = parseXlsx;
exports.parseContactSpreadsheet = parseContactSpreadsheet;
exports.parseTagList = parseTagList;
const zlib_1 = require("zlib");
const HEADER_ALIASES = {
    ten: 'name',
    hoten: 'name',
    name: 'name',
    fullname: 'name',
    ho: 'name',
    email: 'email',
    mail: 'email',
    dienthoai: 'phone',
    phone: 'phone',
    sdt: 'phone',
    tel: 'phone',
    mobile: 'phone',
    nguon: 'source',
    source: 'source',
    tag: 'tags',
    tags: 'tags',
    nhan: 'tags',
    label: 'tags',
    nhom: 'listName',
    group: 'listName',
    list: 'listName',
    danhsach: 'listName',
    zalo: 'uid',
    zalo_uid: 'uid',
    uid: 'uid',
    userid: 'uid',
    user_id: 'uid',
    mauuid: 'uid',
};
function foldHeader(raw) {
    return raw
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, '')
        .trim();
}
function mapHeader(raw) {
    const folded = foldHeader(raw);
    return HEADER_ALIASES[folded] ?? folded;
}
/** Split CSV line with quotes; supports , or ; delimiter. */
function splitCsvLine(line, delimiter) {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (line[i + 1] === '"') {
                    cur += '"';
                    i += 1;
                }
                else {
                    inQuotes = false;
                }
            }
            else {
                cur += ch;
            }
        }
        else if (ch === '"') {
            inQuotes = true;
        }
        else if (ch === delimiter) {
            out.push(cur.trim());
            cur = '';
        }
        else {
            cur += ch;
        }
    }
    out.push(cur.trim());
    return out;
}
function parseCsv(text) {
    const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = cleaned.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length < 2)
        return [];
    const first = lines[0] ?? '';
    const delimiter = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : ',';
    const headers = splitCsvLine(first, delimiter).map(mapHeader);
    const rows = [];
    for (const line of lines.slice(1)) {
        const cells = splitCsvLine(line, delimiter);
        const row = {};
        headers.forEach((h, i) => {
            if (!h)
                return;
            row[h] = cells[i] ?? '';
        });
        if (Object.values(row).some((v) => v.trim()))
            rows.push(row);
    }
    return rows;
}
function unzipEntries(buf) {
    const files = {};
    let offset = 0;
    while (offset + 30 <= buf.length) {
        const sig = buf.readUInt32LE(offset);
        if (sig !== 0x04034b50)
            break;
        const method = buf.readUInt16LE(offset + 8);
        const gpFlags = buf.readUInt16LE(offset + 6);
        const compSize = buf.readUInt32LE(offset + 18);
        const uncompSize = buf.readUInt32LE(offset + 22);
        const nameLen = buf.readUInt16LE(offset + 26);
        const extraLen = buf.readUInt16LE(offset + 28);
        const nameStart = offset + 30;
        const name = buf.subarray(nameStart, nameStart + nameLen).toString('utf8');
        const dataStart = nameStart + nameLen + extraLen;
        if (gpFlags & 0x08) {
            throw new Error('XLSX không hỗ trợ data descriptor — lưu lại file Excel rồi thử lại, hoặc dùng CSV.');
        }
        const compressed = buf.subarray(dataStart, dataStart + compSize);
        let raw;
        if (method === 0)
            raw = compressed;
        else if (method === 8)
            raw = (0, zlib_1.inflateRawSync)(compressed);
        else
            throw new Error('Định dạng nén XLSX không hỗ trợ');
        if (uncompSize && raw.length !== uncompSize && method === 8) {
            // still accept
        }
        files[name] = raw.toString('utf8');
        offset = dataStart + compSize;
    }
    return files;
}
function xmlTextNodes(xml, tag) {
    const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'g');
    const out = [];
    let m;
    while ((m = re.exec(xml))) {
        out.push(decodeXml(m[1] ?? ''));
    }
    return out;
}
function decodeXml(s) {
    return s
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/<[^>]+>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
        .trim();
}
function colIndex(cellRef) {
    const letters = (cellRef.match(/^[A-Z]+/i)?.[0] || 'A').toUpperCase();
    let n = 0;
    for (const ch of letters)
        n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
}
function parseXlsx(buf) {
    const files = unzipEntries(buf);
    const sharedXml = files['xl/sharedStrings.xml'] || '';
    const shared = xmlTextNodes(sharedXml, 'si').map((siXml) => decodeXml(siXml));
    const sheetName = Object.keys(files).find((k) => /^xl\/worksheets\/sheet1\.xml$/i.test(k)) ||
        Object.keys(files).find((k) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(k));
    if (!sheetName)
        throw new Error('Không đọc được sheet trong file Excel');
    const sheet = files[sheetName] || '';
    const rowXmls = sheet.match(/<row\b[^>]*>[\s\S]*?<\/row>/g) || [];
    const matrix = [];
    for (const rowXml of rowXmls) {
        const cells = rowXml.match(/<c\b[^>]*\/>|<c\b[^>]*>[\s\S]*?<\/c>/g) || [];
        const line = [];
        for (const cell of cells) {
            const ref = cell.match(/\br="([A-Z]+\d+)"/i)?.[1] || '';
            const idx = colIndex(ref);
            const type = cell.match(/\bt="([^"]+)"/)?.[1];
            let value = '';
            if (type === 's') {
                const v = Number(cell.match(/<v[^>]*>([^<]*)<\/v>/)?.[1] ?? '');
                value = Number.isFinite(v) ? shared[v] ?? '' : '';
            }
            else if (type === 'inlineStr') {
                value = decodeXml(cell.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? '');
            }
            else {
                value = decodeXml(cell.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? '');
            }
            line[idx] = value;
        }
        if (line.some((c) => (c || '').trim()))
            matrix.push(line.map((c) => c ?? ''));
    }
    if (matrix.length < 2)
        return [];
    const headers = (matrix[0] ?? []).map(mapHeader);
    return matrix.slice(1).map((cells) => {
        const row = {};
        headers.forEach((h, i) => {
            if (!h)
                return;
            row[h] = cells[i] ?? '';
        });
        return row;
    });
}
function parseContactSpreadsheet(file) {
    const name = (file.originalname || '').toLowerCase();
    const head = file.buffer.subarray(0, 8);
    const isZip = head[0] === 0x50 && head[1] === 0x4b;
    const isOle = head[0] === 0xd0 && head[1] === 0xcf;
    if (isOle || name.endsWith('.xls')) {
        throw new Error('File .xls cũ không hỗ trợ. Hãy lưu thành .xlsx hoặc .csv rồi nhập lại.');
    }
    if (isZip || name.endsWith('.xlsx')) {
        return parseXlsx(file.buffer);
    }
    return parseCsv(file.buffer.toString('utf8'));
}
function parseTagList(raw) {
    const parts = Array.isArray(raw) ? raw : (raw || '').split(/[,;|]/);
    const tags = parts.map((t) => t.trim()).filter(Boolean);
    return [...new Set(tags)];
}
