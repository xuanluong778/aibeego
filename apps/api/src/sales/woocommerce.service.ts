import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import {
  discoverPublicWordPressWebsite,
  fetchPublicAuthenticatedJson,
} from '@marketingspa/shared/dist/ssrf-fetch';
import { PrismaService } from '../prisma/prisma.service';
import { decryptSecret, encryptSecret } from '../common/utils/encryption.util';
import { ProductImportService } from './product-import.service';
import {
  IMPORT_FIELDS,
  IMPORT_LIMITS,
  PRODUCT_COLUMNS,
  type ImportSheet,
  type WooProductSnapshot,
} from './product-spreadsheet.util';
import { WooConnectionDto, WooDraftDto } from './dto/woocommerce.dto';
import { RateLimitService } from '../common/services/rate-limit.service';
import { sourceProductModel } from '@marketingspa/shared/dist/sales-product-source';

type Remote = Record<string, any>;
type Connection = { id: string; websiteUrl: string; credentials: string; currency: string };
function fail(message: string): never {
  throw new BadRequestException(message);
}
function safeUrl(raw: unknown): string {
  try {
    const u = new URL(String(raw));
    return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : '';
  } catch {
    return '';
  }
}
export function normalizeWooWebsite(raw: string) {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return fail('URL website không hợp lệ.');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.port && url.port !== '443')
  )
    fail(
      'Dùng URL gốc HTTPS của website (có thể gồm thư mục WordPress), không có tài khoản, query hoặc cổng riêng.',
    );
  url.pathname = url.pathname.replace(/\/+$/, '') + '/';
  return url.href;
}

@Injectable()
export class WooCommerceService {
  private active = new Set<string>();
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly imports: ProductImportService,
    private readonly limits: RateLimitService,
  ) {}
  private throttle(organizationId: string, operation: string, limit = 30) {
    this.limits.assertWithinLimit(
      `woo:${organizationId}:${operation}`,
      limit,
      60000,
      'Đã đạt giới hạn đọc WooCommerce. Thử lại sau một phút.',
    );
  }
  private key() {
    const key = this.config.get<string>('ENCRYPTION_KEY') || '';
    if (key.length < 16 || /^(change_me|changeme|test|todo|replace)/i.test(key))
      throw new ServiceUnavailableException(
        'Cần cấu hình ENCRYPTION_KEY hợp lệ để kết nối website.',
      );
    return key;
  }
  private async connection(organizationId: string, id: string) {
    const connection = await this.prisma.wooCommerceConnection.findFirst({
      where: { id, organizationId },
    });
    if (!connection) throw new NotFoundException('Không tìm thấy kết nối WooCommerce.');
    return connection;
  }
  private publicConnection(c: Connection) {
    return { id: c.id, websiteUrl: c.websiteUrl, currency: c.currency };
  }
  async list(organizationId: string) {
    return this.prisma.wooCommerceConnection.findMany({
      where: { organizationId },
      select: { id: true, websiteUrl: true, currency: true, updatedAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }
  /** Fixed API path and server-built params only. No remote next links or redirects. */
  async request(
    connection: Connection,
    path: string,
    params: Record<string, string | number> = {},
    deadline = Date.now() + 12000,
  ) {
    const remaining = Math.min(12000, deadline - Date.now());
    if (remaining <= 0) fail('Hết thời gian đọc website. Chọn ít sản phẩm hơn rồi thử lại.');
    const { consumerKey, consumerSecret } = JSON.parse(
      decryptSecret(connection.credentials, this.key()),
    );
    const url = new URL(`wp-json/wc/v3/${path}`, connection.websiteUrl);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
    try {
      return await fetchPublicAuthenticatedJson(
        url.href,
        'Basic ' + Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64'),
        remaining,
      );
    } catch (error) {
      // Only allow controlled errors; never expose remote bodies, credentials or arbitrary transport errors.
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      const status =
        error && typeof error === 'object' && 'statusCode' in error ? Number(error.statusCode) : 0;
      const messages: Record<number, string> = {
        401: 'WooCommerce không chấp nhận xác thực (HTTP 401). Kiểm tra Consumer Key/Secret và quyền Read. Nếu khóa đúng, kiểm tra hosting có chuyển tiếp header Authorization cho WordPress không.',
        403: 'WooCommerce không cho phép đọc (HTTP 403). Kiểm tra quyền tài khoản tạo khóa và plugin bảo mật/firewall của website.',
        404: 'Không tìm thấy API WooCommerce (HTTP 404). Dùng URL gốc website, không dùng link danh mục/sản phẩm; kiểm tra WooCommerce REST API và cấu hình đường dẫn tĩnh.',
        429: 'Website đang giới hạn số yêu cầu (HTTP 429). Chờ một lúc rồi thử lại.',
      };
      if (code === 'HTTP_ERROR')
        throw new BadRequestException({
          code: `WOO_HTTP_${status || 'ERROR'}`,
          message:
            status >= 300 && status < 400
              ? 'Website chuyển hướng URL. Nhập đúng URL HTTPS chuẩn sau chuyển hướng (gồm www nếu có); hệ thống không gửi khóa theo chuyển hướng.'
              : messages[status] ||
                `Không đọc được API WooCommerce${status ? ` (HTTP ${status})` : ''}. Kiểm tra URL gốc website và quyền đọc API.`,
        });
      fail(
        code === 'TIMEOUT'
          ? 'Website phản hồi quá chậm. Thử lại hoặc chọn ít sản phẩm hơn.'
          : 'Không đọc được WooCommerce. Kiểm tra URL HTTPS công khai, chứng chỉ SSL và cấu hình API.',
      );
    }
  }
  async connect(organizationId: string, dto: WooConnectionDto) {
    this.throttle(organizationId, 'connect', 5);
    const submittedUrl = normalizeWooWebsite(dto.websiteUrl);
    let websiteUrl = submittedUrl;
    try {
      websiteUrl = (await discoverPublicWordPressWebsite(submittedUrl)) || submittedUrl;
    } catch {
      // Discovery is public and optional; keep explicit subdirectory installs working.
      // The authenticated request still validates/pins the original origin and refuses redirects.
    }
    const credentials = encryptSecret(
      JSON.stringify({ consumerKey: dto.consumerKey, consumerSecret: dto.consumerSecret }),
      this.key(),
    );
    const candidate = { id: '', websiteUrl, credentials, currency: '' };
    const products = await this.request(candidate, 'products', { per_page: 1 });
    if (!Array.isArray(products.data)) fail('Website không trả danh sách WooCommerce hợp lệ.');
    const currency = (await this.request(candidate, 'data/currencies/current')).data as Remote;
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
  private async categoriesFor(connection: Connection) {
    const items: Remote[] = [],
      deadline = Date.now() + 30000;
    for (let page = 1; page <= 20; page++) {
      const response = await this.request(
        connection,
        'products/categories',
        { per_page: 100, page, hide_empty: 'false' },
        deadline,
      );
      if (!Array.isArray(response.data)) fail('Danh mục trả về không hợp lệ.');
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
  async categories(organizationId: string, id: string) {
    this.throttle(organizationId, 'categories');
    return this.categoriesFor(await this.connection(organizationId, id));
  }
  async resolveCategory(organizationId: string, id: string, raw: string) {
    this.throttle(organizationId, 'categories');
    const connection = await this.connection(organizationId, id);
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      return fail('Link danh mục không hợp lệ.');
    }
    const base = new URL(connection.websiteUrl);
    if (
      url.origin !== base.origin ||
      !url.pathname.startsWith(base.pathname) ||
      url.username ||
      url.password
    )
      fail('Link danh mục phải thuộc website đã kết nối.');
    let slug: string;
    try {
      slug =
        url.searchParams.get('product_cat') ||
        decodeURIComponent(url.pathname.replace(/\/+$/, '').split('/').pop() || '');
    } catch {
      return fail('Đường dẫn danh mục không hợp lệ.');
    }
    const categories = await this.categoriesFor(connection);
    const matches = categories.filter((c) => c.slug === slug);
    if (matches.length !== 1)
      fail('Không xác định duy nhất danh mục. Hãy chọn danh mục trong danh sách.');
    return matches[0]!;
  }
  async browse(organizationId: string, id: string, page: number, categoryId?: number) {
    this.throttle(organizationId, 'browse', 60);
    const connection = await this.connection(organizationId, id);
    const response = await this.request(connection, 'products', {
      page,
      per_page: 20,
      orderby: 'id',
      order: 'asc',
      ...(categoryId ? { category: categoryId } : {}),
    });
    if (!Array.isArray(response.data)) fail('Danh sách sản phẩm không hợp lệ.');
    return {
      items: response.data.map((p: Remote) => ({
        id: p.id,
        name: String(p.name || ''),
        sku: String(p.sku || ''),
        type: String(p.type),
        price: String(p.price || ''),
        image: safeUrl(p.images?.[0]?.src),
        stockQuantity:
          p.manage_stock === true && Number.isInteger(p.stock_quantity) ? p.stock_quantity : null,
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
  async draft(organizationId: string, id: string, userId: string, dto: WooDraftDto) {
    this.throttle(organizationId, 'draft', 10);
    const connection = await this.connection(organizationId, id);
    const requestHash = createHash('sha256')
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
      throw new ServiceUnavailableException('Tổ chức đang đọc sản phẩm WooCommerce. Vui lòng chờ.');
    this.active.add(organizationId);
    try {
      const sheet: ImportSheet = {
        name: 'WooCommerce',
        headers: Object.values(PRODUCT_COLUMNS),
        rows: [],
      };
      const sourceIds = new Set<string>();
      const deadline = Date.now() + 45000;
      const currentCurrency = (
        await this.request(connection, 'data/currencies/current', {}, deadline)
      ).data as Remote;
      if (currentCurrency?.code !== 'VND')
        fail(
          'Tiền tệ website đã thay đổi hoặc không xác định được. Chưa hỗ trợ nhập tiền tệ khác VND.',
        );
      let snapshotBytes = 0;
      const add = (parent: Remote, variant?: Remote) => {
        if (sheet.rows.length >= IMPORT_LIMITS.rows)
          fail('Vượt 2.000 sản phẩm/biến thể. Chọn phạm vi nhỏ hơn.');
        const p = variant || parent,
          warnings: string[] = [];
        if (!Number.isSafeInteger(p.id) || p.id < 1 || sourceIds.has(String(p.id)))
          fail('ID sản phẩm/biến thể nguồn bị trùng hoặc không hợp lệ.');
        sourceIds.add(String(p.id));
        const attributes = (Array.isArray(p.attributes) ? p.attributes : []).map((a: Remote) => ({
          name: String(a.name || ''),
          option: String(a.option || (Array.isArray(a.options) ? a.options : []).join(', ')),
        }));
        const inherited = variant && p.manage_stock === 'parent';
        const stock = inherited ? parent : p;
        const source: WooProductSnapshot = {
          externalId: String(p.id),
          parentId: Number(parent.id),
          variationId: variant ? Number(p.id) : null,
          url: safeUrl(p.permalink || parent.permalink),
          description: String(p.description || parent.description || ''),
          images: [
            ...new Set<string>(
              [
                ...(p.image ? [p.image] : []),
                ...(Array.isArray(parent.images) ? parent.images : []),
              ]
                .map((image: Remote) => safeUrl(image.src))
                .filter(Boolean),
            ),
          ],
          currency: connection.currency,
          stockQuantity:
            stock.manage_stock === true && Number.isInteger(stock.stock_quantity)
              ? stock.stock_quantity
              : null,
          stockStatus: String(p.stock_status || ''),
          stockScope: inherited ? 'parent' : 'item',
          attributes,
          status: String(p.status || parent.status || ''),
          fetchedAt: new Date().toISOString(),
          warnings,
          categories: (Array.isArray(parent.categories) ? parent.categories : []).map(
            (c: Remote) => ({
              id: Number(c.id),
              name: String(c.name || ''),
            }),
          ),
          shortDescription: String(parent.short_description || ''),
          regularPrice: String(p.regular_price || ''),
          salePrice: String(p.sale_price || ''),
        };
        if (!p.sku) warnings.push('Không có SKU; chống trùng bằng ID website.');
        if (!p.price) warnings.push('Chưa có giá website; giá nội bộ tạo mới mặc định 0.');
        if ((p.status || parent.status) !== 'publish')
          warnings.push(
            `Trạng thái website: ${p.status || parent.status}; trạng thái nội bộ được quản lý riêng.`,
          );
        if (inherited)
          warnings.push('Biến thể dùng chung tồn của sản phẩm cha; không cộng các số tồn này.');
        if (['grouped', 'external'].includes(parent.type))
          fail('Chỉ hỗ trợ sản phẩm simple và variable. Bỏ chọn sản phẩm nhóm/liên kết ngoài.');
        const values: Record<string, string> = {
          name:
            String(parent.name || '') +
            (variant
              ? ' — ' +
                attributes
                  .map((a: { name: string; option: string }) => `${a.name}: ${a.option}`)
                  .join(', ')
              : ''),
          sku: String(p.sku || ''),
          barcode: String(p.global_unique_id || ''),
          category: String(parent.categories?.[0]?.name || ''),
          price: String(p.price || ''),
          model: sourceProductModel(source as unknown as Record<string, unknown>) || '',
        };
        if ((parent.categories || []).length > 1)
          warnings.push(
            'Danh mục nội bộ dùng danh mục đầu tiên; toàn bộ danh mục nguồn được giữ trong dữ liệu bổ sung.',
          );
        if (Buffer.byteLength(JSON.stringify(source)) > 150000)
          fail('Nội dung sản phẩm quá lớn. Chọn sản phẩm khác.');
        const row = {
          rowNumber: sheet.rows.length + 2,
          source,
          cells: IMPORT_FIELDS.map((field) => ({
            kind: 'text' as const,
            value: values[field] || '',
          })),
        };
        snapshotBytes += Buffer.byteLength(JSON.stringify(row));
        if (snapshotBytes > 8_000_000) fail('Dữ liệu vượt 8MB. Chọn ít sản phẩm hơn.');
        sheet.rows.push(row);
      };
      for (const productId of dto.productIds) {
        const parent = (await this.request(connection, `products/${productId}`, {}, deadline))
          .data as Remote;
        if (Number(parent?.id) !== productId) fail('ID sản phẩm trả về không khớp.');
        if (parent.type !== 'variable') {
          add(parent);
          continue;
        }
        const seen = new Set<number>();
        for (let page = 1; page <= 21; page++) {
          const response = await this.request(
            connection,
            `products/${productId}/variations`,
            { per_page: 100, page, orderby: 'id', order: 'asc' },
            deadline,
          );
          if (!Array.isArray(response.data)) fail('Không đọc được biến thể.');
          for (const variant of response.data) {
            if (!Number.isSafeInteger(variant.id) || seen.has(variant.id))
              fail('Phân trang biến thể trả ID trùng/không hợp lệ.');
            seen.add(variant.id);
            add(parent, variant);
          }
          const pages = Number(response.headers['x-wp-totalpages']);
          if (response.data.length < 100 || (pages > 0 && page >= pages)) break;
        }
        if (
          !seen.size ||
          (Array.isArray(parent.variations) && parent.variations.some((v: number) => !seen.has(v)))
        )
          fail('Chưa đọc đủ biến thể; không tạo phiên nhập thiếu dữ liệu.');
      }
      if (Buffer.byteLength(JSON.stringify(sheet)) > 8_000_000)
        fail('Dữ liệu vượt 8MB. Chọn ít sản phẩm hơn.');
      return this.imports.createWooDraft(
        organizationId,
        userId,
        id,
        dto.clientToken,
        requestHash,
        sheet,
      );
    } finally {
      this.active.delete(organizationId);
    }
  }
}
