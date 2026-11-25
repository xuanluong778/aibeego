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
exports.ProductImportService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const database_1 = require("@marketingspa/database");
const prisma_service_1 = require("../prisma/prisma.service");
const sales_service_1 = require("./sales.service");
const sales_dto_1 = require("./dto/sales.dto");
const product_spreadsheet_util_1 = require("./product-spreadsheet.util");
const upload_policy_1 = require("../common/uploads/upload-policy");
const pagination_util_1 = require("../common/utils/pagination.util");
const json = (value) => value;
function invalid(message) {
    throw new common_1.BadRequestException(message);
}
const writable = (status) => ['DRAFT', 'PREVIEW'].includes(status);
let ProductImportService = class ProductImportService {
    prisma;
    sales;
    parsing = 0;
    constructor(prisma, sales) {
        this.prisma = prisma;
        this.sales = sales;
    }
    async session(organizationId, id, db = this.prisma, lock = false) {
        if (lock)
            await db.$queryRaw `SELECT id FROM sales_product_imports WHERE id=${id} AND organization_id=${organizationId} FOR UPDATE`;
        const result = await db.salesProductImport.findFirst({ where: { id, organizationId } });
        if (!result)
            throw new common_1.NotFoundException('Không tìm thấy phiên nhập.');
        return result;
    }
    async publicSession(session, db = this.prisma) {
        const groups = await db.salesProductImportRow.groupBy({
            by: ['status'],
            where: { importId: session.id, organizationId: session.organizationId },
            _count: true,
        });
        const counts = Object.fromEntries(groups.map((group) => [group.status, group._count]));
        return {
            id: session.id,
            wooConnectionId: session.wooConnectionId,
            fileName: session.fileName,
            status: session.status,
            sheets: session.sheetMeta,
            sheetIndex: session.sheetIndex,
            mapping: session.mapping,
            options: session.options,
            previewVersion: session.previewVersion,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            counts,
            total: Object.values(counts).reduce((sum, value) => sum + value, 0),
            batchSize: product_spreadsheet_util_1.IMPORT_LIMITS.batch,
        };
    }
    async get(organizationId, id) {
        return this.publicSession(await this.session(organizationId, id));
    }
    async history(organizationId, query) {
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        const [items, total] = await Promise.all([
            this.prisma.salesProductImport.findMany({
                where: { organizationId },
                omit: { workbook: true },
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                skip,
                take,
            }),
            this.prisma.salesProductImport.count({ where: { organizationId } }),
        ]);
        return (0, pagination_util_1.buildPaginatedResult)(await Promise.all(items.map((item) => this.publicSession(item))), total, page, pageSize);
    }
    async upload(organizationId, userId, file, clientToken, delimiter) {
        const checked = (0, upload_policy_1.assertUploadFile)('spreadsheet', file);
        if (!['.csv', '.xlsx'].includes(checked.ext) ||
            !file?.buffer ||
            file.buffer.length > product_spreadsheet_util_1.IMPORT_LIMITS.bytes)
            invalid('Chỉ nhận .xlsx/.csv, tối đa 5MB.');
        const hash = (0, crypto_1.createHash)('sha256')
            .update(file.buffer)
            .update('\0' + (delimiter || 'auto'))
            .digest('hex');
        const existing = await this.prisma.salesProductImport.findUnique({
            where: { organizationId_clientToken: { organizationId, clientToken } },
        });
        if (existing) {
            if (existing.fileHash !== hash)
                throw new common_1.ConflictException('Mã upload đã được dùng cho file khác.');
            return this.publicSession(existing);
        }
        if (this.parsing >= 2)
            throw new common_1.ServiceUnavailableException('Đang đọc file khác. Vui lòng thử lại.');
        this.parsing++;
        let sheets;
        try {
            sheets = await (0, product_spreadsheet_util_1.parseProductSpreadsheet)(checked.originalName, file.buffer, delimiter);
        }
        finally {
            this.parsing--;
        }
        try {
            const session = await this.prisma.salesProductImport.create({
                data: {
                    organizationId,
                    createdById: userId,
                    clientToken,
                    fileName: checked.originalName,
                    fileHash: hash,
                    workbook: json(sheets),
                    sheetMeta: json(sheets.map((sheet, index) => ({
                        index,
                        name: sheet.name,
                        headers: sheet.headers,
                        rowCount: sheet.rows.length,
                    }))),
                },
            });
            return this.publicSession(session);
        }
        catch (error) {
            if (error instanceof database_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                const previous = await this.prisma.salesProductImport.findUnique({
                    where: { organizationId_clientToken: { organizationId, clientToken } },
                });
                if (previous?.fileHash === hash)
                    return this.publicSession(previous);
                throw new common_1.ConflictException('Mã upload đã được dùng cho file khác.');
            }
            throw error;
        }
    }
    options(raw) {
        if (!raw ||
            !['skip', 'update'].includes(raw.mode) ||
            typeof raw.createCategories !== 'boolean' ||
            !Array.isArray(raw.updateFields) ||
            raw.updateFields.some((field) => !product_spreadsheet_util_1.UPDATE_FIELDS.includes(field)) ||
            new Set(raw.updateFields).size !== raw.updateFields.length ||
            Object.keys(raw).some((key) => !['mode', 'createCategories', 'updateFields'].includes(key)))
            invalid('Tùy chọn nhập/cập nhật không hợp lệ. Không được chọn tồn đầu kỳ để cập nhật.');
        return raw;
    }
    /** Server-created WooCommerce snapshots use the existing preview/confirm/batch pipeline. */
    async createWooDraft(organizationId, userId, connectionId, clientToken, requestHash, sheet) {
        const existing = await this.prisma.salesProductImport.findUnique({
            where: { organizationId_clientToken: { organizationId, clientToken } },
        });
        if (existing) {
            if (existing.fileHash !== requestHash || existing.wooConnectionId !== connectionId)
                throw new common_1.ConflictException('Mã phiên đã dùng cho lựa chọn khác.');
            return this.publicSession(existing);
        }
        try {
            const result = await this.prisma.salesProductImport.create({ data: {
                    organizationId, createdById: userId, clientToken, fileHash: requestHash,
                    fileName: `WooCommerce (${sheet.rows.length} sản phẩm/biến thể)`,
                    wooConnectionId: connectionId, workbook: json([sheet]),
                    sheetMeta: json([{ index: 0, name: sheet.name, headers: sheet.headers, rowCount: sheet.rows.length }]),
                } });
            return this.publicSession(result);
        }
        catch (error) {
            if (error instanceof database_1.Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                const previous = await this.prisma.salesProductImport.findUnique({ where: {
                        organizationId_clientToken: { organizationId, clientToken },
                    } });
                if (previous?.fileHash === requestHash && previous.wooConnectionId === connectionId)
                    return this.publicSession(previous);
                if (previous)
                    throw new common_1.ConflictException('Mã phiên đã dùng cho lựa chọn khác.');
            }
            throw error;
        }
    }
    sourcePlan(cells, options, matches, categories, source, linked) {
        const combined = linked ? [...new Map([...matches, linked].map(p => [p.id, p])).values()] : matches;
        const plan = this.plan(cells, options, combined, categories);
        if (source) {
            plan.warnings.push(...source.warnings, 'Tồn website chỉ lưu tham khảo; không nhập kho nội bộ. Giá vốn không được cung cấp.');
            if (!linked && matches.length)
                plan.errors.push('Mã đã có trong app nhưng chưa liên kết nguồn này. Không tự ghép; hãy xử lý mã trước khi nhập.');
            if (cells.stockQty?.value.trim())
                plan.errors.push('Nguồn website không được nhập tồn đầu kỳ.');
            if (source.currency !== 'VND')
                plan.errors.push(`Website dùng ${source.currency}; app hiện dùng VND. Chưa hỗ trợ quy đổi.`);
            if (plan.errors.length)
                plan.action = 'ERROR';
        }
        return plan;
    }
    async matches(organizationId, cells, db) {
        const sku = cells.sku?.kind === 'text' ? cells.sku.value.trim() : '';
        const barcode = cells.barcode?.kind === 'text' ? cells.barcode.value.trim() : '';
        return sku || barcode
            ? db.salesProduct.findMany({
                where: {
                    organizationId,
                    OR: [...(sku ? [{ sku }] : []), ...(barcode ? [{ barcode }] : [])],
                },
                select: { id: true, sku: true, barcode: true },
            })
            : [];
    }
    plan(cells, options, matches, categories) {
        const plan = { action: 'CREATE', data: {}, errors: [], warnings: [] };
        for (const field of product_spreadsheet_util_1.IMPORT_FIELDS) {
            const cell = cells[field];
            if (cell?.value.trim() && ['formula', 'invalid'].includes(cell.kind))
                plan.errors.push(`${product_spreadsheet_util_1.PRODUCT_COLUMNS[field]}: công thức, ngày tháng, boolean hoặc kiểu ô không hỗ trợ.`);
        }
        for (const field of ['sku', 'barcode'])
            if (cells[field]?.value.trim() && cells[field]?.kind !== 'text')
                plan.errors.push(`${product_spreadsheet_util_1.PRODUCT_COLUMNS[field]}: phải là ô văn bản. Lưu lại mã dạng Text để giữ số 0 đầu.`);
        if (matches.length > 1)
            plan.errors.push('SKU và Barcode trỏ tới hai sản phẩm khác nhau.');
        if (matches.length === 1) {
            plan.targetId = matches[0].id;
            plan.action = options.mode === 'skip' ? 'SKIP' : 'UPDATE';
            if (plan.action === 'SKIP')
                plan.message = 'Bỏ qua: mã đã có trong tổ chức.';
            if (cells.stockQty?.value.trim())
                plan.warnings.push('Tồn đầu kỳ bị bỏ qua đối với sản phẩm đã có.');
        }
        if (plan.action !== 'SKIP') {
            for (const field of product_spreadsheet_util_1.IMPORT_FIELDS) {
                const cell = cells[field], value = cell?.value.trim() || '';
                if (!value || (plan.action === 'UPDATE' && !options.updateFields.includes(field)))
                    continue;
                if (['price', 'costPrice', 'stockQty', 'minStockQty'].includes(field)) {
                    const integer = ['stockQty', 'minStockQty'].includes(field);
                    if (!(integer ? /^\d+$/ : /^\d+(?:\.\d{1,2})?$/).test(value)) {
                        plan.errors.push(`${product_spreadsheet_util_1.PRODUCT_COLUMNS[field]}: số/định dạng mơ hồ. Không dùng dấu phân nhóm; giá dùng dấu chấm và tối đa 2 số thập phân, tồn dùng số nguyên không âm.`);
                    }
                    else
                        plan.data[field] = Number(value);
                }
                else if (cell?.kind !== 'text')
                    plan.errors.push(`${product_spreadsheet_util_1.PRODUCT_COLUMNS[field]}: cần ô văn bản.`);
                else if (field === 'category') {
                    if (value.length > 120)
                        plan.errors.push('Danh mục: tối đa 120 ký tự.');
                    else if (categories.has(value))
                        plan.data.categoryId = categories.get(value);
                    else if (options.createCategories)
                        plan.categoryName = value;
                    else
                        plan.errors.push(`Danh mục chưa có: ${value}. Chỉ tạo khi bật tùy chọn tạo danh mục mới.`);
                }
                else
                    plan.data[field] = value;
            }
            if (plan.action === 'CREATE')
                plan.data.name ??= '';
            try {
                if (plan.action === 'CREATE')
                    this.sales.validateProduct(sales_dto_1.CreateSalesProductDto, plan.data);
                else
                    this.sales.validateProduct(sales_dto_1.UpdateSalesProductDto, plan.data);
            }
            catch (error) {
                const response = error instanceof common_1.HttpException ? error.getResponse() : null;
                const messages = typeof response === 'object' && response && 'message' in response
                    ? response.message
                    : 'Dữ liệu sản phẩm không hợp lệ.';
                plan.errors.push(...(Array.isArray(messages) ? messages.map(String) : [String(messages)]));
            }
            if (plan.action === 'UPDATE' && !Object.keys(plan.data).length && !plan.categoryName) {
                plan.action = 'SKIP';
                plan.message = 'Không có trường được chọn có giá trị để cập nhật.';
            }
        }
        if (plan.errors.length)
            plan.action = 'ERROR';
        return plan;
    }
    async preview(organizationId, id, dto) {
        const options = this.options(dto.options);
        return this.prisma.$transaction(async (tx) => {
            const session = await this.session(organizationId, id, tx, true);
            if (!writable(session.status))
                throw new common_1.ConflictException('Phiên đã xác nhận; không thể đổi sheet/ánh xạ.');
            const sheet = session.workbook?.[dto.sheetIndex];
            if (!sheet || !sheet.rows.length)
                invalid('Sheet không có dòng dữ liệu.');
            const mapped = Object.entries(dto.mapping);
            if (!mapped.length ||
                !mapped.some(([field]) => ['name', 'sku', 'barcode'].includes(field)) ||
                mapped.some(([field, col]) => !product_spreadsheet_util_1.IMPORT_FIELDS.includes(field) ||
                    !Number.isInteger(col) ||
                    col < 0 ||
                    col >= sheet.headers.length) ||
                new Set(mapped.map(([, col]) => col)).size !== mapped.length)
                invalid('Ánh xạ không hợp lệ: mỗi cột chỉ dùng một lần; cần Tên sản phẩm, SKU hoặc Barcode.');
            const rows = sheet.rows.map((row) => ({
                rowNumber: row.rowNumber,
                cells: Object.fromEntries(mapped.map(([field, col]) => [field, row.cells[col] || { value: '', kind: 'text' }])),
                source: session.wooConnectionId ? row.source : undefined,
            }));
            const links = session.wooConnectionId ? await tx.wooCommerceProduct.findMany({
                where: { organizationId, connectionId: session.wooConnectionId }, include: { product: { select: { id: true, sku: true, barcode: true } } },
            }) : [];
            const linkMap = new Map(links.map(link => [link.externalId, link.product]));
            const skus = rows.flatMap((row) => row.cells.sku?.kind === 'text' && row.cells.sku.value.trim()
                ? [row.cells.sku.value.trim()]
                : []);
            const barcodes = rows.flatMap((row) => row.cells.barcode?.kind === 'text' && row.cells.barcode.value.trim()
                ? [row.cells.barcode.value.trim()]
                : []);
            const [products, cats] = await Promise.all([
                tx.salesProduct.findMany({
                    where: { organizationId, OR: [{ sku: { in: skus } }, { barcode: { in: barcodes } }] },
                    select: { id: true, sku: true, barcode: true },
                }),
                tx.salesProductCategory.findMany({ where: { organizationId } }),
            ]);
            const categories = new Map(cats.map((cat) => [cat.name, cat.id]));
            const plans = rows.map((row) => this.sourcePlan(row.cells, options, products.filter((product) => (product.sku && product.sku === row.cells.sku?.value.trim()) ||
                (product.barcode && product.barcode === row.cells.barcode?.value.trim())), categories, row.source, row.source ? linkMap.get(row.source.externalId) : undefined));
            const duplicateKeys = new Map();
            rows.forEach((row, index) => {
                const keys = ['sku', 'barcode'].flatMap((field) => row.cells[field]?.kind === 'text' && row.cells[field]?.value.trim()
                    ? [`${field}:${row.cells[field].value.trim()}`]
                    : []);
                if (options.mode === 'update' && plans[index]?.targetId)
                    keys.push(`product:${plans[index].targetId}`);
                for (const key of keys)
                    duplicateKeys.set(key, [...(duplicateKeys.get(key) || []), index]);
            });
            for (const indices of duplicateKeys.values())
                if (indices.length > 1)
                    for (const index of indices) {
                        plans[index].action = 'ERROR';
                        plans[index].errors.push('Trùng mã/sản phẩm trong file; không tự chọn dòng thắng.');
                    }
            await tx.salesProductImportRow.deleteMany({ where: { importId: id, organizationId } });
            await tx.salesProductImportRow.createMany({
                data: rows.map((row, index) => {
                    const plan = plans[index];
                    return {
                        organizationId,
                        importId: id,
                        rowNumber: row.rowNumber,
                        cells: json(row.cells),
                        source: row.source ? json(row.source) : database_1.Prisma.DbNull,
                        action: plan.action,
                        targetId: plan.targetId,
                        status: plan.action === 'ERROR' ? 'INVALID' : plan.action === 'SKIP' ? 'SKIPPED' : 'READY',
                        errors: json(plan.errors),
                        warnings: json(plan.warnings),
                        message: plan.message,
                    };
                }),
            });
            const updated = await tx.salesProductImport.update({
                where: { id },
                data: {
                    status: 'PREVIEW',
                    sheetIndex: dto.sheetIndex,
                    mapping: json(dto.mapping),
                    options: json(options),
                    previewVersion: { increment: 1 },
                },
            });
            return this.publicSession(updated, tx);
        }, { timeout: 20_000 });
    }
    async confirm(organizationId, id, version) {
        return this.prisma.$transaction(async (tx) => {
            const session = await this.session(organizationId, id, tx, true);
            if (session.previewVersion !== version || !version || session.status === 'DRAFT')
                throw new common_1.ConflictException('Bản xem trước đã thay đổi. Xem lại trước khi xác nhận.');
            if (session.status === 'PREVIEW') {
                const ready = await tx.salesProductImportRow.updateMany({
                    where: { importId: id, organizationId, status: 'READY' },
                    data: { status: 'PENDING' },
                });
                return this.publicSession(await tx.salesProductImport.update({
                    where: { id },
                    data: { status: ready.count ? 'RUNNING' : 'COMPLETED', workbook: database_1.Prisma.DbNull },
                }), tx);
            }
            return this.publicSession(session, tx);
        });
    }
    async runRow(organizationId, id, rowId, userId) {
        try {
            await this.prisma.$transaction(async (tx) => {
                const session = await this.session(organizationId, id, tx, true);
                if (session.status !== 'RUNNING')
                    return;
                const row = await tx.salesProductImportRow.findFirst({
                    where: { id: rowId, importId: id, organizationId, status: 'PENDING' },
                });
                if (!row)
                    return; // The session lock and the committed row result fence retries, including code-less rows.
                const cells = row.cells;
                const source = session.wooConnectionId ? row.source : null;
                if (source)
                    await tx.$queryRaw `SELECT pg_advisory_xact_lock(hashtextextended(${organizationId + ':' + session.wooConnectionId + ':' + source.externalId}, 0))::text AS locked`;
                const linked = source ? await tx.wooCommerceProduct.findUnique({ where: {
                        connectionId_externalId: { connectionId: session.wooConnectionId, externalId: source.externalId },
                    }, include: { product: { select: { id: true, sku: true, barcode: true } } } }) : null;
                const cats = await tx.salesProductCategory.findMany({ where: { organizationId } });
                const plan = this.sourcePlan(cells, session.options, await this.matches(organizationId, cells, tx), new Map(cats.map((cat) => [cat.name, cat.id])), source, linked?.product);
                if (plan.action !== 'SKIP' &&
                    (plan.targetId !== (row.targetId || undefined) || plan.action !== row.action))
                    plan.errors.push('Mã/sản phẩm đối chiếu đã thay đổi sau xem trước. Tạo bản xem trước mới trong phiên khác.');
                if (plan.errors.length)
                    throw new common_1.BadRequestException({ message: plan.errors });
                let productId;
                if (plan.action !== 'SKIP') {
                    if (plan.categoryName)
                        plan.data.categoryId = (await this.sales.createCategory(organizationId, plan.categoryName, tx)).id;
                    const product = plan.action === 'CREATE'
                        ? await this.sales.createProduct(organizationId, plan.data, userId, tx)
                        : await this.sales.updateProduct(organizationId, plan.targetId, plan.data, userId, tx);
                    productId = product.id;
                    if (source && session.wooConnectionId) {
                        await tx.wooCommerceProduct.upsert({
                            where: { connectionId_externalId: { connectionId: session.wooConnectionId, externalId: source.externalId } },
                            create: { organizationId, connectionId: session.wooConnectionId, externalId: source.externalId, productId, snapshot: json(source) },
                            update: { snapshot: json(source), syncedAt: new Date() },
                        });
                    }
                }
                await tx.salesProductImportRow.update({
                    where: { id: row.id },
                    data: {
                        status: plan.action === 'SKIP'
                            ? 'SKIPPED'
                            : plan.action === 'CREATE'
                                ? 'CREATED'
                                : 'UPDATED',
                        productId,
                        message: plan.message || 'Đã ghi thành công.',
                        errors: [],
                        warnings: json(plan.warnings),
                        attempts: { increment: 1 },
                        completedAt: new Date(),
                    },
                });
            }, { timeout: 10_000, maxWait: 10_000 });
        }
        catch (error) {
            const response = error instanceof common_1.HttpException ? error.getResponse() : null;
            const message = typeof response === 'string'
                ? response
                : response && typeof response === 'object' && 'message' in response
                    ? response.message
                    : 'Lỗi xử lý dòng. Có thể thử lại; dữ liệu chưa ghi đã rollback.';
            await this.prisma.$transaction(async (tx) => {
                await this.session(organizationId, id, tx, true);
                await tx.salesProductImportRow.updateMany({
                    where: { id: rowId, importId: id, organizationId, status: 'PENDING' },
                    data: {
                        status: 'ERROR',
                        errors: json(Array.isArray(message) ? message : [String(message)]),
                        attempts: { increment: 1 },
                    },
                });
            });
        }
    }
    async process(organizationId, id, userId) {
        const session = await this.session(organizationId, id);
        if (session.status !== 'RUNNING' && session.status !== 'COMPLETED')
            throw new common_1.ConflictException('Cần xem trước và xác nhận nhập.');
        if (session.status === 'RUNNING') {
            const rows = await this.prisma.salesProductImportRow.findMany({
                where: { importId: id, organizationId, status: 'PENDING' },
                orderBy: { rowNumber: 'asc' },
                take: product_spreadsheet_util_1.IMPORT_LIMITS.batch,
                select: { id: true },
            });
            for (const row of rows)
                await this.runRow(organizationId, id, row.id, userId);
            await this.prisma.$transaction(async (tx) => {
                await this.session(organizationId, id, tx, true);
                const pending = await tx.salesProductImportRow.count({
                    where: { importId: id, organizationId, status: 'PENDING' },
                });
                await tx.salesProductImport.update({
                    where: { id },
                    data: { status: pending ? 'RUNNING' : 'COMPLETED' },
                });
            });
        }
        // Replayed requests also invalidate: a previous response/cache call may have been interrupted after commit.
        await this.sales.invalidateProductCache(organizationId);
        return this.get(organizationId, id);
    }
    async retry(organizationId, id) {
        return this.prisma.$transaction(async (tx) => {
            const session = await this.session(organizationId, id, tx, true);
            if (session.status !== 'COMPLETED')
                throw new common_1.ConflictException('Chỉ thử lại sau khi phiên đã xử lý hết lô.');
            const changed = await tx.salesProductImportRow.updateMany({
                where: { importId: id, organizationId, status: 'ERROR' },
                data: { status: 'PENDING', errors: [], message: null },
            });
            return this.publicSession(await tx.salesProductImport.update({
                where: { id },
                data: { status: changed.count ? 'RUNNING' : 'COMPLETED' },
            }), tx);
        });
    }
    async rows(organizationId, id, query) {
        await this.session(organizationId, id);
        const { page, pageSize, skip, take } = (0, pagination_util_1.getPaginationParams)(query);
        const [rows, total] = await Promise.all([
            this.prisma.salesProductImportRow.findMany({
                where: { importId: id, organizationId },
                orderBy: { rowNumber: 'asc' },
                skip,
                take,
            }),
            this.prisma.salesProductImportRow.count({ where: { importId: id, organizationId } }),
        ]);
        return (0, pagination_util_1.buildPaginatedResult)(rows.map((row) => this.publicRow(row)), total, page, pageSize);
    }
    publicRow(row) {
        return {
            id: row.id,
            source: row.source,
            rowNumber: row.rowNumber,
            status: row.status,
            action: row.action,
            productId: row.productId,
            targetId: row.targetId,
            errors: row.errors,
            warnings: row.warnings,
            message: row.message,
            attempts: row.attempts,
            values: Object.fromEntries(Object.entries(row.cells).map(([field, cell]) => [
                field,
                cell.value,
            ])),
        };
    }
    async report(organizationId, id) {
        await this.session(organizationId, id);
        const rows = await this.prisma.salesProductImportRow.findMany({
            where: { importId: id, organizationId },
            orderBy: { rowNumber: 'asc' },
        });
        return (0, product_spreadsheet_util_1.spreadsheetCsv)([
            [
                'Dòng',
                'Trạng thái',
                'Product ID',
                'Thông báo/lỗi',
                'Lưu ý',
                ...Object.values(product_spreadsheet_util_1.PRODUCT_COLUMNS),
            ],
            ...rows.map((row) => {
                const item = this.publicRow(row);
                return [
                    item.rowNumber,
                    item.status,
                    item.productId || '',
                    [item.message, ...item.errors].filter(Boolean).join(' | '),
                    item.warnings.join(' | '),
                    ...product_spreadsheet_util_1.IMPORT_FIELDS.map((field) => item.values[field] || ''),
                ];
            }),
        ]);
    }
};
exports.ProductImportService = ProductImportService;
exports.ProductImportService = ProductImportService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        sales_service_1.SalesService])
], ProductImportService);
