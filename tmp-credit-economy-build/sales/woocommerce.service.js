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
exports.WooCommerceService = void 0;
exports.normalizeWooWebsite = normalizeWooWebsite;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto_1 = require("crypto");
const ssrf_fetch_1 = require("@marketingspa/shared/dist/ssrf-fetch");
const prisma_service_1 = require("../prisma/prisma.service");
const encryption_util_1 = require("../common/utils/encryption.util");
const product_import_service_1 = require("./product-import.service");
const product_spreadsheet_util_1 = require("./product-spreadsheet.util");
const rate_limit_service_1 = require("../common/services/rate-limit.service");
const sales_product_source_1 = require("@marketingspa/shared/dist/sales-product-source");
function fail(message) {
    throw new common_1.BadRequestException(message);
}
function safeUrl(raw) {
    try {
        const u = new URL(String(raw));
        return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : '';
    }
    catch {
        return '';
    }
}
function normalizeWooWebsite(raw) {
    let url;
    try {
        url = new URL(raw.trim());
    }
    catch {
        return fail('URL website không hợp lệ.');
    }
    if (url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        (url.port && url.port !== '443'))
        fail('Dùng URL gốc HTTPS của website (có thể gồm thư mục WordPress), không có tài khoản, query hoặc cổng riêng.');
    url.pathname = url.pathname.replace(/\/+$/, '') + '/';
    return url.href;
}
let WooCommerceService = class WooCommerceService {
    prisma;
    config;
    imports;
    limits;
    active = new Set();
    constructor(prisma, config, imports, limits) {
        this.prisma = prisma;
        this.config = config;
        this.imports = imports;
        this.limits = limits;
    }
    throttle(organizationId, operation, limit = 30) {
        this.limits.assertWithinLimit(`woo:${organizationId}:${operation}`, limit, 60000, 'Đã đạt giới hạn đọc WooCommerce. Thử lại sau một phút.');
    }
    key() {
        const key = this.config.get('ENCRYPTION_KEY') || '';
        if (key.length < 16 || /^(change_me|changeme|test|todo|replace)/i.test(key))
            throw new common_1.ServiceUnavailableException('Cần cấu hình ENCRYPTION_KEY hợp lệ để kết nối website.');
        return key;
    }
    async connection(organizationId, id) {
        const connection = await this.prisma.wooCommerceConnection.findFirst({
            where: { id, organizationId },
        });
        if (!connection)
            throw new common_1.NotFoundException('Không tìm thấy kết nối WooCommerce.');
        return connection;
    }
    publicConnection(c) {
        return { id: c.id, websiteUrl: c.websiteUrl, currency: c.currency };
    }
    async list(organizationId) {
        return this.prisma.wooCommerceConnection.findMany({
            where: { organizationId },
            select: { id: true, websiteUrl: true, currency: true, updatedAt: true },
            orderBy: { createdAt: 'desc' },
        });
    }
    /** Fixed API path and server-built params only. No remote next links or redirects. */
    async request(connection, path, params = {}, deadline = Date.now() + 12000) {
        const remaining = Math.min(12000, deadline - Date.now());
        if (remaining <= 0)
            fail('Hết thời gian đọc website. Chọn ít sản phẩm hơn rồi thử lại.');
        const { consumerKey, consumerSecret } = JSON.parse((0, encryption_util_1.decryptSecret)(connection.credentials, this.key()));
        const url = new URL(`wp-json/wc/v3/${path}`, connection.websiteUrl);
        for (const [key, value] of Object.entries(params))
            url.searchParams.set(key, String(value));
        try {
            return await (0, ssrf_fetch_1.fetchPublicAuthenticatedJson)(url.href, 'Basic ' + Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64'), remaining);
        }
        catch (error) {
            // Only allow controlled errors; never expose remote bodies, credentials or arbitrary transport errors.
            const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
            const status = error && typeof error === 'object' && 'statusCode' in error ? Number(error.statusCode) : 0;
            const messages = {
                401: 'WooCommerce không chấp nhận xác thực (HTTP 401). Kiểm tra Consumer Key/Secret và quyền Read. Nếu khóa đúng, kiểm tra hosting có chuyển tiếp header Authorization cho WordPress không.',
                403: 'WooCommerce không cho phép đọc (HTTP 403). Kiểm tra quyền tài khoản tạo khóa và plugin bảo mật/firewall của website.',
                404: 'Không tìm thấy API WooCommerce (HTTP 404). Dùng URL gốc website, không dùng link danh mục/sản phẩm; kiểm tra WooCommerce REST API và cấu hình đường dẫn tĩnh.',
                429: 'Website đang giới hạn số yêu cầu (HTTP 429). Chờ một lúc rồi thử lại.',
            };
            if (code === 'HTTP_ERROR')
                throw new common_1.BadRequestException({
                    code: `WOO_HTTP_${status || 'ERROR'}`,
                    message: status >= 300 && status < 400
                        ? 'Website chuyển hướng URL. Nhập đúng URL HTTPS chuẩn sau chuyển hướng (gồm www nếu có); hệ thống không gửi khóa theo chuyển hướng.'
                        : messages[status] ||
                            `Không đọc được API WooCommerce${status ? ` (HTTP ${status})` : ''}. Kiểm tra URL gốc website và quyền đọc API.`,
                });
            fail(code === 'TIMEOUT'
                ? 'Website phản hồi quá chậm. Thử lại hoặc chọn ít sản phẩm hơn.'
                : 'Không đọc được WooCommerce. Kiểm tra URL HTTPS công khai, chứng chỉ SSL và cấu hình API.');
        }
    }
    async connect(organizationId, dto) {
        this.throttle(organizationId, 'connect', 5);
        const submittedUrl = normalizeWooWebsite(dto.websiteUrl);
        let websiteUrl = submittedUrl;
        try {
            websiteUrl = (await (0, ssrf_fetch_1.discoverPublicWordPressWebsite)(submittedUrl)) || submittedUrl;
        }
        catch {
            // Discovery is public and optional; keep explicit subdirectory installs working.
            // The authenticated request still validates/pins the original origin and refuses redirects.
        }
        const credentials = (0, encryption_util_1.encryptSecret)(JSON.stringify({ consumerKey: dto.consumerKey, consumerSecret: dto.consumerSecret }), this.key());
        const candidate = { id: '', websiteUrl, credentials, currency: '' };
        const products = await this.request(candidate, 'products', { per_page: 1 });
        if (!Array.isArray(products.data))
            fail('Website không trả danh sách WooCommerce hợp lệ.');
        const currency = (await this.request(candidate, 'data/currencies/current')).data;
        if (typeof currency?.code !== 'string' || !/^[A-Z]{3}$/.test(currency.code))
            fail('Không xác định được tiền tệ website.');
        if (currency.code !== 'VND')
            fail(`Website dùng ${currency.code}. Bản nhập hiện chỉ hỗ trợ VND, chưa quy đổi tiền tệ.`);
        const saved = await this.prisma.wooCommerceConnection.upsert({
            where: {
                organizationId_websiteUrl: { organizationId, websiteUrl },
            },
            create: { organizationId, websiteUrl, credentials, currency: currency.code },
            update: { credentials, currency: currency.code },
        });
        return this.publicConnection(saved);
    }
    async categoriesFor(connection) {
        const items = [], deadline = Date.now() + 30000;
        for (let page = 1; page <= 20; page++) {
            const response = await this.request(connection, 'products/categories', { per_page: 100, page, hide_empty: 'false' }, deadline);
            if (!Array.isArray(response.data))
                fail('Danh mục trả về không hợp lệ.');
            items.push(...response.data);
            const pages = Number(response.headers['x-wp-totalpages']);
            if (response.data.length < 100 || (Number.isInteger(pages) && page >= pages))
                return items.map((c) => ({
                    id: Number(c.id),
                    name: String(c.name || ''),
                    slug: String(c.slug || ''),
                    count: Number(c.count || 0),
                }));
        }
        return fail('Website có quá nhiều danh mục (giới hạn 2.000). Chưa đọc đầy đủ danh mục.');
    }
    async categories(organizationId, id) {
        this.throttle(organizationId, 'categories');
        return this.categoriesFor(await this.connection(organizationId, id));
    }
    async resolveCategory(organizationId, id, raw) {
        this.throttle(organizationId, 'categories');
        const connection = await this.connection(organizationId, id);
        let url;
        try {
            url = new URL(raw);
        }
        catch {
            return fail('Link danh mục không hợp lệ.');
        }
        const base = new URL(connection.websiteUrl);
        if (url.origin !== base.origin ||
            !url.pathname.startsWith(base.pathname) ||
            url.username ||
            url.password)
            fail('Link danh mục phải thuộc website đã kết nối.');
        let slug;
        try {
            slug =
                url.searchParams.get('product_cat') ||
                    decodeURIComponent(url.pathname.replace(/\/+$/, '').split('/').pop() || '');
        }
        catch {
            return fail('Đường dẫn danh mục không hợp lệ.');
        }
        const categories = await this.categoriesFor(connection);
        const matches = categories.filter((c) => c.slug === slug);
        if (matches.length !== 1)
            fail('Không xác định duy nhất danh mục. Hãy chọn danh mục trong danh sách.');
        return matches[0];
    }
    async browse(organizationId, id, page, categoryId) {
        this.throttle(organizationId, 'browse', 60);
        const connection = await this.connection(organizationId, id);
        const response = await this.request(connection, 'products', {
            page,
            per_page: 20,
            orderby: 'id',
            order: 'asc',
            ...(categoryId ? { category: categoryId } : {}),
        });
        if (!Array.isArray(response.data))
            fail('Danh sách sản phẩm không hợp lệ.');
        return {
            items: response.data.map((p) => ({
                id: p.id,
                name: String(p.name || ''),
                sku: String(p.sku || ''),
                type: String(p.type),
                price: String(p.price || ''),
                image: safeUrl(p.images?.[0]?.src),
                stockQuantity: p.manage_stock === true && Number.isInteger(p.stock_quantity) ? p.stock_quantity : null,
                stockStatus: p.stock_status,
                status: p.status,
            })),
            page,
            hasNext: Number(response.headers['x-wp-totalpages'])
                ? page < Number(response.headers['x-wp-totalpages'])
                : response.data.length === 20,
            total: Number(response.headers['x-wp-total']) || null,
            currency: connection.currency,
        };
    }
    async draft(organizationId, id, userId, dto) {
        this.throttle(organizationId, 'draft', 10);
        const connection = await this.connection(organizationId, id);
        const requestHash = (0, crypto_1.createHash)('sha256')
            .update(JSON.stringify([id, [...dto.productIds].sort((a, b) => a - b)]))
            .digest('hex');
        const existing = await this.prisma.salesProductImport.findUnique({
            where: { organizationId_clientToken: { organizationId, clientToken: dto.clientToken } },
        });
        if (existing)
            return this.imports.createWooDraft(organizationId, userId, id, dto.clientToken, requestHash, {
                name: 'WooCommerce',
                headers: [],
                rows: [],
            });
        if (this.active.has(organizationId))
            throw new common_1.ServiceUnavailableException('Tổ chức đang đọc sản phẩm WooCommerce. Vui lòng chờ.');
        this.active.add(organizationId);
        try {
            const sheet = {
                name: 'WooCommerce',
                headers: Object.values(product_spreadsheet_util_1.PRODUCT_COLUMNS),
                rows: [],
            };
            const sourceIds = new Set();
            const deadline = Date.now() + 45000;
            const currentCurrency = (await this.request(connection, 'data/currencies/current', {}, deadline)).data;
            if (currentCurrency?.code !== 'VND')
                fail('Tiền tệ website đã thay đổi hoặc không xác định được. Chưa hỗ trợ nhập tiền tệ khác VND.');
            let snapshotBytes = 0;
            const add = (parent, variant) => {
                if (sheet.rows.length >= product_spreadsheet_util_1.IMPORT_LIMITS.rows)
                    fail('Vượt 2.000 sản phẩm/biến thể. Chọn phạm vi nhỏ hơn.');
                const p = variant || parent, warnings = [];
                if (!Number.isSafeInteger(p.id) || p.id < 1 || sourceIds.has(String(p.id)))
                    fail('ID sản phẩm/biến thể nguồn bị trùng hoặc không hợp lệ.');
                sourceIds.add(String(p.id));
                const attributes = (Array.isArray(p.attributes) ? p.attributes : []).map((a) => ({
                    name: String(a.name || ''),
                    option: String(a.option || (Array.isArray(a.options) ? a.options : []).join(', ')),
                }));
                const inherited = variant && p.manage_stock === 'parent';
                const stock = inherited ? parent : p;
                const source = {
                    externalId: String(p.id),
                    parentId: Number(parent.id),
                    variationId: variant ? Number(p.id) : null,
                    url: safeUrl(p.permalink || parent.permalink),
                    description: String(p.description || parent.description || ''),
                    images: [
                        ...new Set([
                            ...(p.image ? [p.image] : []),
                            ...(Array.isArray(parent.images) ? parent.images : []),
                        ]
                            .map((image) => safeUrl(image.src))
                            .filter(Boolean)),
                    ],
                    currency: connection.currency,
                    stockQuantity: stock.manage_stock === true && Number.isInteger(stock.stock_quantity)
                        ? stock.stock_quantity
                        : null,
                    stockStatus: String(p.stock_status || ''),
                    stockScope: inherited ? 'parent' : 'item',
                    attributes,
                    status: String(p.status || parent.status || ''),
                    fetchedAt: new Date().toISOString(),
                    warnings,
                    categories: (Array.isArray(parent.categories) ? parent.categories : []).map((c) => ({
                        id: Number(c.id),
                        name: String(c.name || ''),
                    })),
                    shortDescription: String(parent.short_description || ''),
                    regularPrice: String(p.regular_price || ''),
                    salePrice: String(p.sale_price || ''),
                };
                if (!p.sku)
                    warnings.push('Không có SKU; chống trùng bằng ID website.');
                if (!p.price)
                    warnings.push('Chưa có giá website; giá nội bộ tạo mới mặc định 0.');
                if ((p.status || parent.status) !== 'publish')
                    warnings.push(`Trạng thái website: ${p.status || parent.status}; trạng thái nội bộ được quản lý riêng.`);
                if (inherited)
                    warnings.push('Biến thể dùng chung tồn của sản phẩm cha; không cộng các số tồn này.');
                if (['grouped', 'external'].includes(parent.type))
                    fail('Chỉ hỗ trợ sản phẩm simple và variable. Bỏ chọn sản phẩm nhóm/liên kết ngoài.');
                const values = {
                    name: String(parent.name || '') +
                        (variant
                            ? ' — ' +
                                attributes
                                    .map((a) => `${a.name}: ${a.option}`)
                                    .join(', ')
                            : ''),
                    sku: String(p.sku || ''),
                    barcode: String(p.global_unique_id || ''),
                    category: String(parent.categories?.[0]?.name || ''),
                    price: String(p.price || ''),
                    model: (0, sales_product_source_1.sourceProductModel)(source) || '',
                };
                if ((parent.categories || []).length > 1)
                    warnings.push('Danh mục nội bộ dùng danh mục đầu tiên; toàn bộ danh mục nguồn được giữ trong dữ liệu bổ sung.');
                if (Buffer.byteLength(JSON.stringify(source)) > 150000)
                    fail('Nội dung sản phẩm quá lớn. Chọn sản phẩm khác.');
                const row = {
                    rowNumber: sheet.rows.length + 2,
                    source,
                    cells: product_spreadsheet_util_1.IMPORT_FIELDS.map((field) => ({
                        kind: 'text',
                        value: values[field] || '',
                    })),
                };
                snapshotBytes += Buffer.byteLength(JSON.stringify(row));
                if (snapshotBytes > 8_000_000)
                    fail('Dữ liệu vượt 8MB. Chọn ít sản phẩm hơn.');
                sheet.rows.push(row);
            };
            for (const productId of dto.productIds) {
                const parent = (await this.request(connection, `products/${productId}`, {}, deadline))
                    .data;
                if (Number(parent?.id) !== productId)
                    fail('ID sản phẩm trả về không khớp.');
                if (parent.type !== 'variable') {
                    add(parent);
                    continue;
                }
                const seen = new Set();
                for (let page = 1; page <= 21; page++) {
                    const response = await this.request(connection, `products/${productId}/variations`, { per_page: 100, page, orderby: 'id', order: 'asc' }, deadline);
                    if (!Array.isArray(response.data))
                        fail('Không đọc được biến thể.');
                    for (const variant of response.data) {
                        if (!Number.isSafeInteger(variant.id) || seen.has(variant.id))
                            fail('Phân trang biến thể trả ID trùng/không hợp lệ.');
                        seen.add(variant.id);
                        add(parent, variant);
                    }
                    const pages = Number(response.headers['x-wp-totalpages']);
                    if (response.data.length < 100 || (pages > 0 && page >= pages))
                        break;
                }
                if (!seen.size ||
                    (Array.isArray(parent.variations) && parent.variations.some((v) => !seen.has(v))))
                    fail('Chưa đọc đủ biến thể; không tạo phiên nhập thiếu dữ liệu.');
            }
            if (Buffer.byteLength(JSON.stringify(sheet)) > 8_000_000)
                fail('Dữ liệu vượt 8MB. Chọn ít sản phẩm hơn.');
            return this.imports.createWooDraft(organizationId, userId, id, dto.clientToken, requestHash, sheet);
        }
        finally {
            this.active.delete(organizationId);
        }
    }
};
exports.WooCommerceService = WooCommerceService;
exports.WooCommerceService = WooCommerceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService,
        product_import_service_1.ProductImportService,
        rate_limit_service_1.RateLimitService])
], WooCommerceService);
