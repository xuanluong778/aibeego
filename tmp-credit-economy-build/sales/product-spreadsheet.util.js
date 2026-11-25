"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UPDATE_FIELDS = exports.IMPORT_FIELDS = exports.PRODUCT_COLUMNS = exports.IMPORT_LIMITS = void 0;
exports.parseProductSpreadsheet = parseProductSpreadsheet;
exports.spreadsheetCsv = spreadsheetCsv;
exports.productImportTemplate = productImportTemplate;
const common_1 = require("@nestjs/common");
const exceljs_1 = __importDefault(require("exceljs"));
const sync_1 = require("csv-parse/sync");
const yauzl_1 = require("yauzl");
exports.IMPORT_LIMITS = {
    bytes: 5 * 1024 * 1024,
    expandedBytes: 20 * 1024 * 1024,
    rows: 2000,
    columns: 40,
    sheets: 10,
    cellChars: 5000,
    batch: 25,
};
exports.PRODUCT_COLUMNS = {
    name: 'Tên sản phẩm',
    sku: 'SKU',
    barcode: 'Barcode',
    category: 'Danh mục',
    unit: 'Đơn vị',
    price: 'Giá bán',
    costPrice: 'Giá vốn',
    stockQty: 'Tồn đầu kỳ',
    minStockQty: 'Tồn tối thiểu',
    note: 'Ghi chú',
    model: 'Model',
};
exports.IMPORT_FIELDS = Object.keys(exports.PRODUCT_COLUMNS);
exports.UPDATE_FIELDS = exports.IMPORT_FIELDS.filter((field) => field !== 'stockQty');
const fail = (message) => {
    throw new common_1.BadRequestException(message);
};
const textCell = (value) => ({
    value,
    kind: /^\s*[=+@]/.test(value) ? 'formula' : 'text',
});
const blank = () => ({ value: '', kind: 'text' });
/** Central-directory and actual decompressed byte checks before ExcelJS allocates a workbook. */
async function checkZip(buffer) {
    await new Promise((resolve, reject) => {
        (0, yauzl_1.fromBuffer)(buffer, { lazyEntries: true, validateEntrySizes: true, strictFileNames: true }, (error, zip) => {
            if (error || !zip)
                return reject(new common_1.BadRequestException('XLSX/ZIP không hợp lệ.'));
            let bytes = 0, entries = 0, rows = 0, cells = 0;
            const names = new Set();
            const stop = (message) => {
                zip.close();
                reject(new common_1.BadRequestException(message));
            };
            zip.on('error', () => stop('XLSX/ZIP bị lỗi hoặc kích thước giải nén không khớp.'));
            zip.on('end', () => {
                if (!names.has('xl/workbook.xml'))
                    return stop('File không phải workbook XLSX.');
                resolve();
            });
            zip.on('entry', (entry) => {
                if (++entries > 256 ||
                    names.has(entry.fileName) ||
                    entry.generalPurposeBitFlag & 1 ||
                    /vbaProject|externalLinks/i.test(entry.fileName))
                    return stop('XLSX có entry trùng, mã hóa, macro/liên kết ngoài hoặc quá nhiều thành phần.');
                names.add(entry.fileName);
                if (entry.uncompressedSize > exports.IMPORT_LIMITS.expandedBytes)
                    return stop('XLSX vượt giới hạn giải nén 20MB.');
                zip.openReadStream(entry, (streamError, stream) => {
                    if (streamError || !stream)
                        return stop('Không giải nén được XLSX.');
                    const chunks = [];
                    stream.on('error', () => stop('Dữ liệu nén XLSX không hợp lệ.'));
                    stream.on('data', (chunk) => {
                        bytes += chunk.length;
                        if (bytes > exports.IMPORT_LIMITS.expandedBytes) {
                            stream.destroy();
                            return stop('XLSX vượt giới hạn giải nén 20MB.');
                        }
                        if (/\.xml$/i.test(entry.fileName))
                            chunks.push(chunk);
                    });
                    stream.on('end', () => {
                        const xml = Buffer.concat(chunks).toString('utf8');
                        if (/<!DOCTYPE|<!ENTITY/i.test(xml))
                            return stop('Không chấp nhận DTD/entity trong XLSX.');
                        if (/^xl\/worksheets\/.*\.xml$/i.test(entry.fileName)) {
                            rows += [...xml.matchAll(/<(?:\w+:)?row\b/g)].length;
                            cells += [...xml.matchAll(/<(?:\w+:)?c\b/g)].length;
                            if (rows > exports.IMPORT_LIMITS.rows + exports.IMPORT_LIMITS.sheets || cells > 100_000)
                                return stop('Workbook vượt 2.000 dòng hoặc 100.000 ô.');
                            for (const match of xml.matchAll(/\br=["']([A-Z]+)(\d+)["']/gi)) {
                                let col = 0;
                                for (const letter of match[1].toUpperCase())
                                    col = col * 26 + letter.charCodeAt(0) - 64;
                                if (col > exports.IMPORT_LIMITS.columns || Number(match[2]) > 5000)
                                    return stop('Sheet vượt 40 cột hoặc có địa chỉ dòng quá lớn.');
                            }
                        }
                        zip.readEntry();
                    });
                });
            });
            zip.readEntry();
        });
    });
}
function checkedSheet(sheet) {
    if (sheet.headers.length > exports.IMPORT_LIMITS.columns || sheet.rows.length > exports.IMPORT_LIMITS.rows)
        fail('Tối đa 2.000 dòng và 40 cột.');
    for (const cell of [
        ...sheet.headers.map((value) => ({ value })),
        ...sheet.rows.flatMap((row) => row.cells),
    ])
        if (cell.value.length > exports.IMPORT_LIMITS.cellChars)
            fail('Mỗi ô tối đa 5.000 ký tự.');
        else if (cell.value.includes('\0'))
            fail('File có ký tự NUL không hợp lệ. Hãy lưu lại file rồi thử lại.');
    return sheet;
}
async function parseProductSpreadsheet(fileName, buffer, delimiter = 'auto') {
    if (!buffer.length || buffer.length > exports.IMPORT_LIMITS.bytes)
        fail('File phải có dữ liệu và không vượt 5MB.');
    if (/\.csv$/i.test(fileName)) {
        let text;
        try {
            text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
        }
        catch {
            return fail('CSV phải được lưu bằng UTF-8 (có hoặc không có BOM).');
        }
        const candidates = [];
        for (const separator of delimiter === 'auto' ? [',', ';'] : [delimiter]) {
            try {
                const records = (0, sync_1.parse)(text, {
                    delimiter: separator,
                    bom: true,
                    skip_empty_lines: true,
                    cast: false,
                    max_record_size: 200_000,
                    to: exports.IMPORT_LIMITS.rows + 2,
                });
                if (records.length && (delimiter !== 'auto' || records[0].length > 1))
                    candidates.push(records);
            }
            catch {
                /* A different separator may be valid; never relax malformed quoting. */
            }
        }
        if (candidates.length !== 1)
            fail('Không xác định được dấu phân cách CSV hoặc dấu nháy không hợp lệ. Chọn rõ dấu phẩy/chấm phẩy rồi tải lại.');
        const records = candidates[0];
        if (records.length > exports.IMPORT_LIMITS.rows + 1)
            fail('CSV tối đa 2.000 dòng dữ liệu.');
        const headers = records[0].map((value) => value.trim());
        return [
            checkedSheet({
                name: 'CSV',
                headers,
                rows: records
                    .slice(1)
                    .map((row, index) => ({ rowNumber: index + 2, cells: row.map(textCell) }))
                    .filter((row) => row.cells.some((cell) => cell.value.trim())),
            }),
        ];
    }
    if (!/\.xlsx$/i.test(fileName) || buffer[0] !== 0x50 || buffer[1] !== 0x4b)
        fail('Chỉ chấp nhận .xlsx hoặc .csv; không hỗ trợ .xls.');
    await checkZip(buffer);
    const workbook = new exceljs_1.default.Workbook();
    try {
        await workbook.xlsx.load(buffer);
    }
    catch {
        return fail('Không đọc được workbook XLSX. Hãy lưu lại bằng Excel hoặc xuất CSV UTF-8.');
    }
    if (workbook.worksheets.length > exports.IMPORT_LIMITS.sheets)
        fail('Tối đa 10 sheet/workbook.');
    const sheets = [];
    let total = 0;
    for (const sheet of workbook.worksheets) {
        if (sheet.columnCount > exports.IMPORT_LIMITS.columns || sheet.rowCount > 5000)
            fail('Sheet vượt giới hạn cột/dòng.');
        const rows = [];
        sheet.eachRow((row, rowNumber) => {
            const cells = [];
            for (let col = 1; col <= sheet.columnCount; col++) {
                const cell = row.getCell(col), value = cell.value;
                if (value === null || value === undefined)
                    cells.push(blank());
                else if (typeof value === 'string')
                    cells.push({ value, kind: 'text' });
                else if (typeof value === 'number')
                    cells.push({ value: String(value), kind: 'number' });
                else if ((typeof value === 'object' && 'formula' in value) ||
                    cell.type === exceljs_1.default.ValueType.Formula)
                    cells.push({ value: 'Công thức: ' + cell.formula, kind: 'formula' });
                else if (typeof value === 'object' && 'richText' in value)
                    cells.push({ value: value.richText.map((part) => part.text).join(''), kind: 'text' });
                else if (typeof value === 'object' && 'hyperlink' in value)
                    cells.push({ value: value.text, kind: 'text' });
                else
                    cells.push({ value: cell.text, kind: 'invalid' });
            }
            if (cells.some((cell) => cell.value.trim()))
                rows.push({ rowNumber, cells });
        });
        const header = rows.shift();
        if (!header)
            continue;
        if (header.cells.some((cell) => cell.kind === 'formula' || cell.kind === 'invalid'))
            fail('Tiêu đề cột không được chứa công thức/kiểu ô không hỗ trợ.');
        total += rows.length;
        if (total > exports.IMPORT_LIMITS.rows)
            fail('Toàn workbook tối đa 2.000 dòng dữ liệu.');
        sheets.push(checkedSheet({
            name: sheet.name,
            headers: header.cells.map((cell) => cell.value.trim()),
            rows,
        }));
    }
    if (!sheets.length)
        fail('Workbook không có sheet chứa tiêu đề.');
    if (JSON.stringify(sheets).length > 8 * 1024 * 1024)
        fail('Nội dung workbook sau đọc vượt 8MB.');
    return sheets;
}
function spreadsheetCsv(rows) {
    return ('\ufeff' +
        rows
            .map((row) => row
            .map((value) => {
            const text = String(value ?? '');
            const safe = /^[\s\u0000-\u001f]*[=+\-@]/.test(text) ? "'" + text : text;
            return '"' + safe.replace(/"/g, '""') + '"';
        })
            .join(','))
            .join('\r\n'));
}
async function productImportTemplate(format) {
    if (format === 'csv')
        return Buffer.from(spreadsheetCsv([Object.values(exports.PRODUCT_COLUMNS)]), 'utf8');
    const workbook = new exceljs_1.default.Workbook();
    const sheet = workbook.addWorksheet('Sản phẩm');
    sheet.columns = exports.IMPORT_FIELDS.map((field) => ({
        header: exports.PRODUCT_COLUMNS[field],
        key: field,
        width: field === 'note' ? 45 : 22,
        style: { numFmt: ['sku', 'barcode', 'model'].includes(field) ? '@' : 'General' },
    }));
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    return Buffer.from(await workbook.xlsx.writeBuffer());
}
