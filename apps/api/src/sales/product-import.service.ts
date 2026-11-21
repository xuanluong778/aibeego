import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import {
  Prisma,
  type SalesProductImport,
  type SalesProductImportRow,
} from '@marketingspa/database';
import { PrismaService } from '../prisma/prisma.service';
import { SalesService } from './sales.service';
import { CreateSalesProductDto, UpdateSalesProductDto } from './dto/sales.dto';
import { ProductImportPreviewDto } from './dto/product-import.dto';
import {
  IMPORT_FIELDS,
  IMPORT_LIMITS,
  PRODUCT_COLUMNS,
  UPDATE_FIELDS,
  parseProductSpreadsheet,
  spreadsheetCsv,
  type ImportCells,
  type ImportField,
  type ImportSheet,
  type WooProductSnapshot,
} from './product-spreadsheet.util';
import { assertUploadFile } from '../common/uploads/upload-policy';
import { buildPaginatedResult, getPaginationParams } from '../common/utils/pagination.util';
import type { PaginationDto } from '../common/dto/pagination.dto';

type Db = Prisma.TransactionClient;
type Options = { mode: 'skip' | 'update'; createCategories: boolean; updateFields: ImportField[] };
type Match = { id: string; sku: string | null; barcode: string | null };
type Plan = {
  action: 'CREATE' | 'UPDATE' | 'SKIP' | 'ERROR';
  targetId?: string;
  data: Record<string, string | number>;
  categoryName?: string;
  errors: string[];
  warnings: string[];
  message?: string;
};
const json = (value: unknown) => value as Prisma.InputJsonValue;
function invalid(message: string): never {
  throw new BadRequestException(message);
}
const writable = (status: string) => ['DRAFT', 'PREVIEW'].includes(status);

@Injectable()
export class ProductImportService {
  private parsing = 0;
  constructor(
    private readonly prisma: PrismaService,
    private readonly sales: SalesService,
  ) {}

  private async session(organizationId: string, id: string, db: Db = this.prisma, lock = false) {
    if (lock)
      await db.$queryRaw`SELECT id FROM sales_product_imports WHERE id=${id} AND organization_id=${organizationId} FOR UPDATE`;
    const result = await db.salesProductImport.findFirst({ where: { id, organizationId } });
    if (!result) throw new NotFoundException('Không tìm thấy phiên nhập.');
    return result;
  }
  private async publicSession(session: Omit<SalesProductImport, 'workbook'>, db: Db = this.prisma) {
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
      batchSize: IMPORT_LIMITS.batch,
    };
  }
  async get(organizationId: string, id: string) {
    return this.publicSession(await this.session(organizationId, id));
  }
  async history(organizationId: string, query: PaginationDto) {
    const { page, pageSize, skip, take } = getPaginationParams(query);
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
    return buildPaginatedResult(
      await Promise.all(items.map((item) => this.publicSession(item))),
      total,
      page,
      pageSize,
    );
  }
  async upload(
    organizationId: string,
    userId: string,
    file: Express.Multer.File | undefined,
    clientToken: string,
    delimiter?: 'auto' | ',' | ';',
  ) {
    const checked = assertUploadFile('spreadsheet', file);
    if (
      !['.csv', '.xlsx'].includes(checked.ext) ||
      !file?.buffer ||
      file.buffer.length > IMPORT_LIMITS.bytes
    )
      invalid('Chỉ nhận .xlsx/.csv, tối đa 5MB.');
    const hash = createHash('sha256')
      .update(file!.buffer)
      .update('\0' + (delimiter || 'auto'))
      .digest('hex');
    const existing = await this.prisma.salesProductImport.findUnique({
      where: { organizationId_clientToken: { organizationId, clientToken } },
    });
    if (existing) {
      if (existing.fileHash !== hash)
        throw new ConflictException('Mã upload đã được dùng cho file khác.');
      return this.publicSession(existing);
    }
    if (this.parsing >= 2)
      throw new ServiceUnavailableException('Đang đọc file khác. Vui lòng thử lại.');
    this.parsing++;
    let sheets: ImportSheet[];
    try {
      sheets = await parseProductSpreadsheet(checked.originalName, file!.buffer, delimiter);
    } finally {
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
          sheetMeta: json(
            sheets.map((sheet, index) => ({
              index,
              name: sheet.name,
              headers: sheet.headers,
              rowCount: sheet.rows.length,
            })),
          ),
        },
      });
      return this.publicSession(session);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const previous = await this.prisma.salesProductImport.findUnique({
          where: { organizationId_clientToken: { organizationId, clientToken } },
        });
        if (previous?.fileHash === hash) return this.publicSession(previous);
        throw new ConflictException('Mã upload đã được dùng cho file khác.');
      }
      throw error;
    }
  }
  private options(raw: ProductImportPreviewDto['options']): Options {
    if (
      !raw ||
      !['skip', 'update'].includes(raw.mode) ||
      typeof raw.createCategories !== 'boolean' ||
      !Array.isArray(raw.updateFields) ||
      raw.updateFields.some(
        (field) => !(UPDATE_FIELDS as readonly ImportField[]).includes(field as ImportField),
      ) ||
      new Set(raw.updateFields).size !== raw.updateFields.length ||
      Object.keys(raw).some((key) => !['mode', 'createCategories', 'updateFields'].includes(key))
    )
      invalid('Tùy chọn nhập/cập nhật không hợp lệ. Không được chọn tồn đầu kỳ để cập nhật.');
    return raw as Options;
  }
  /** Server-created WooCommerce snapshots use the existing preview/confirm/batch pipeline. */
  async createWooDraft(organizationId: string, userId: string, connectionId: string,
    clientToken: string, requestHash: string, sheet: ImportSheet) {
    const existing = await this.prisma.salesProductImport.findUnique({
      where: { organizationId_clientToken: { organizationId, clientToken } },
    });
    if (existing) {
      if (existing.fileHash !== requestHash || existing.wooConnectionId !== connectionId)
        throw new ConflictException('Mã phiên đã dùng cho lựa chọn khác.');
      return this.publicSession(existing);
    }
    try {
      const result = await this.prisma.salesProductImport.create({ data: {
        organizationId, createdById: userId, clientToken, fileHash: requestHash,
        fileName: `WooCommerce (${sheet.rows.length} sản phẩm/biến thể)`,
        wooConnectionId: connectionId, workbook: json([sheet]),
        sheetMeta: json([{ index: 0, name: sheet.name, headers: sheet.headers, rowCount: sheet.rows.length }]),
      }});
      return this.publicSession(result);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const previous = await this.prisma.salesProductImport.findUnique({ where: {
          organizationId_clientToken: { organizationId, clientToken },
        }});
        if (previous?.fileHash === requestHash && previous.wooConnectionId === connectionId)
          return this.publicSession(previous);
        if (previous) throw new ConflictException('Mã phiên đã dùng cho lựa chọn khác.');
      }
      throw error;
    }
  }
  private sourcePlan(cells: ImportCells, options: Options, matches: Match[], categories: Map<string, string>,
    source?: WooProductSnapshot | null, linked?: Match | null): Plan {
    const combined = linked ? [...new Map([...matches, linked].map(p => [p.id, p])).values()] : matches;
    const plan = this.plan(cells, options, combined, categories);
    if (source) {
      plan.warnings.push(...source.warnings, 'Tồn website chỉ lưu tham khảo; không nhập kho nội bộ. Giá vốn không được cung cấp.');
      if (!linked && matches.length) plan.errors.push('Mã đã có trong app nhưng chưa liên kết nguồn này. Không tự ghép; hãy xử lý mã trước khi nhập.');
      if (cells.stockQty?.value.trim()) plan.errors.push('Nguồn website không được nhập tồn đầu kỳ.');
      if (source.currency !== 'VND') plan.errors.push(`Website dùng ${source.currency}; app hiện dùng VND. Chưa hỗ trợ quy đổi.`);
      if (plan.errors.length) plan.action = 'ERROR';
    }
    return plan;
  }
  private async matches(organizationId: string, cells: ImportCells, db: Db) {
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
  private plan(
    cells: ImportCells,
    options: Options,
    matches: Match[],
    categories: Map<string, string>,
  ): Plan {
    const plan: Plan = { action: 'CREATE', data: {}, errors: [], warnings: [] };
    for (const field of IMPORT_FIELDS) {
      const cell = cells[field];
      if (cell?.value.trim() && ['formula', 'invalid'].includes(cell.kind))
        plan.errors.push(
          `${PRODUCT_COLUMNS[field]}: công thức, ngày tháng, boolean hoặc kiểu ô không hỗ trợ.`,
        );
    }
    for (const field of ['sku', 'barcode'] as const)
      if (cells[field]?.value.trim() && cells[field]?.kind !== 'text')
        plan.errors.push(
          `${PRODUCT_COLUMNS[field]}: phải là ô văn bản. Lưu lại mã dạng Text để giữ số 0 đầu.`,
        );
    if (matches.length > 1) plan.errors.push('SKU và Barcode trỏ tới hai sản phẩm khác nhau.');
    if (matches.length === 1) {
      plan.targetId = matches[0]!.id;
      plan.action = options.mode === 'skip' ? 'SKIP' : 'UPDATE';
      if (plan.action === 'SKIP') plan.message = 'Bỏ qua: mã đã có trong tổ chức.';
      if (cells.stockQty?.value.trim())
        plan.warnings.push('Tồn đầu kỳ bị bỏ qua đối với sản phẩm đã có.');
    }
    if (plan.action !== 'SKIP') {
      for (const field of IMPORT_FIELDS) {
        const cell = cells[field],
          value = cell?.value.trim() || '';
        if (!value || (plan.action === 'UPDATE' && !options.updateFields.includes(field))) continue;
        if (['price', 'costPrice', 'stockQty', 'minStockQty'].includes(field)) {
          const integer = ['stockQty', 'minStockQty'].includes(field);
          if (!(integer ? /^\d+$/ : /^\d+(?:\.\d{1,2})?$/).test(value)) {
            plan.errors.push(
              `${PRODUCT_COLUMNS[field]}: số/định dạng mơ hồ. Không dùng dấu phân nhóm; giá dùng dấu chấm và tối đa 2 số thập phân, tồn dùng số nguyên không âm.`,
            );
          } else plan.data[field] = Number(value);
        } else if (cell?.kind !== 'text')
          plan.errors.push(`${PRODUCT_COLUMNS[field]}: cần ô văn bản.`);
        else if (field === 'category') {
          if (value.length > 120) plan.errors.push('Danh mục: tối đa 120 ký tự.');
          else if (categories.has(value)) plan.data.categoryId = categories.get(value)!;
          else if (options.createCategories) plan.categoryName = value;
          else
            plan.errors.push(
              `Danh mục chưa có: ${value}. Chỉ tạo khi bật tùy chọn tạo danh mục mới.`,
            );
        } else plan.data[field] = value;
      }
      if (plan.action === 'CREATE') plan.data.name ??= '';
      try {
        if (plan.action === 'CREATE')
          this.sales.validateProduct(
            CreateSalesProductDto,
            plan.data as unknown as CreateSalesProductDto,
          );
        else this.sales.validateProduct(UpdateSalesProductDto, plan.data);
      } catch (error) {
        const response = error instanceof HttpException ? error.getResponse() : null;
        const messages =
          typeof response === 'object' && response && 'message' in response
            ? response.message
            : 'Dữ liệu sản phẩm không hợp lệ.';
        plan.errors.push(...(Array.isArray(messages) ? messages.map(String) : [String(messages)]));
      }
      if (plan.action === 'UPDATE' && !Object.keys(plan.data).length && !plan.categoryName) {
        plan.action = 'SKIP';
        plan.message = 'Không có trường được chọn có giá trị để cập nhật.';
      }
    }
    if (plan.errors.length) plan.action = 'ERROR';
    return plan;
  }
  async preview(organizationId: string, id: string, dto: ProductImportPreviewDto) {
    const options = this.options(dto.options);
    return this.prisma.$transaction(
      async (tx) => {
        const session = await this.session(organizationId, id, tx, true);
        if (!writable(session.status))
          throw new ConflictException('Phiên đã xác nhận; không thể đổi sheet/ánh xạ.');
        const sheet = (session.workbook as unknown as ImportSheet[])?.[dto.sheetIndex];
        if (!sheet || !sheet.rows.length) invalid('Sheet không có dòng dữ liệu.');
        const mapped = Object.entries(dto.mapping);
        if (
          !mapped.length ||
          !mapped.some(([field]) => ['name', 'sku', 'barcode'].includes(field)) ||
          mapped.some(
            ([field, col]) =>
              !IMPORT_FIELDS.includes(field as ImportField) ||
              !Number.isInteger(col) ||
              col < 0 ||
              col >= sheet.headers.length,
          ) ||
          new Set(mapped.map(([, col]) => col)).size !== mapped.length
        )
          invalid(
            'Ánh xạ không hợp lệ: mỗi cột chỉ dùng một lần; cần Tên sản phẩm, SKU hoặc Barcode.',
          );
        const rows = sheet.rows.map((row) => ({
          rowNumber: row.rowNumber,
          cells: Object.fromEntries(
            mapped.map(([field, col]) => [field, row.cells[col] || { value: '', kind: 'text' }]),
          ) as ImportCells,
          source: session.wooConnectionId ? row.source : undefined,
        }));
        const links = session.wooConnectionId ? await tx.wooCommerceProduct.findMany({
          where: { organizationId, connectionId: session.wooConnectionId }, include: { product: { select: { id: true, sku: true, barcode: true } } },
        }) : [];
        const linkMap = new Map(links.map(link => [link.externalId, link.product]));
        const skus = rows.flatMap((row) =>
          row.cells.sku?.kind === 'text' && row.cells.sku.value.trim()
            ? [row.cells.sku.value.trim()]
            : [],
        );
        const barcodes = rows.flatMap((row) =>
          row.cells.barcode?.kind === 'text' && row.cells.barcode.value.trim()
            ? [row.cells.barcode.value.trim()]
            : [],
        );
        const [products, cats] = await Promise.all([
          tx.salesProduct.findMany({
            where: { organizationId, OR: [{ sku: { in: skus } }, { barcode: { in: barcodes } }] },
            select: { id: true, sku: true, barcode: true },
          }),
          tx.salesProductCategory.findMany({ where: { organizationId } }),
        ]);
        const categories = new Map(cats.map((cat) => [cat.name, cat.id]));
        const plans = rows.map((row) =>
          this.sourcePlan(
            row.cells,
            options,
            products.filter(
              (product) =>
                (product.sku && product.sku === row.cells.sku?.value.trim()) ||
                (product.barcode && product.barcode === row.cells.barcode?.value.trim()),
            ),
            categories,
            row.source,
            row.source ? linkMap.get(row.source.externalId) : undefined,
          ),
        );
        const duplicateKeys = new Map<string, number[]>();
        rows.forEach((row, index) => {
          const keys = (['sku', 'barcode'] as const).flatMap((field) =>
            row.cells[field]?.kind === 'text' && row.cells[field]?.value.trim()
              ? [`${field}:${row.cells[field]!.value.trim()}`]
              : [],
          );
          if (options.mode === 'update' && plans[index]?.targetId)
            keys.push(`product:${plans[index]!.targetId}`);
          for (const key of keys)
            duplicateKeys.set(key, [...(duplicateKeys.get(key) || []), index]);
        });
        for (const indices of duplicateKeys.values())
          if (indices.length > 1)
            for (const index of indices) {
              plans[index]!.action = 'ERROR';
              plans[index]!.errors.push('Trùng mã/sản phẩm trong file; không tự chọn dòng thắng.');
            }
        await tx.salesProductImportRow.deleteMany({ where: { importId: id, organizationId } });
        await tx.salesProductImportRow.createMany({
          data: rows.map((row, index) => {
            const plan = plans[index]!;
            return {
              organizationId,
              importId: id,
              rowNumber: row.rowNumber,
              cells: json(row.cells),
              source: row.source ? json(row.source) : Prisma.DbNull,
              action: plan.action,
              targetId: plan.targetId,
              status:
                plan.action === 'ERROR' ? 'INVALID' : plan.action === 'SKIP' ? 'SKIPPED' : 'READY',
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
      },
      { timeout: 20_000 },
    );
  }
  async confirm(organizationId: string, id: string, version: number) {
    return this.prisma.$transaction(async (tx) => {
      const session = await this.session(organizationId, id, tx, true);
      if (session.previewVersion !== version || !version || session.status === 'DRAFT')
        throw new ConflictException('Bản xem trước đã thay đổi. Xem lại trước khi xác nhận.');
      if (session.status === 'PREVIEW') {
        const ready = await tx.salesProductImportRow.updateMany({
          where: { importId: id, organizationId, status: 'READY' },
          data: { status: 'PENDING' },
        });
        return this.publicSession(
          await tx.salesProductImport.update({
            where: { id },
            data: { status: ready.count ? 'RUNNING' : 'COMPLETED', workbook: Prisma.DbNull },
          }),
          tx,
        );
      }
      return this.publicSession(session, tx);
    });
  }
  private async runRow(organizationId: string, id: string, rowId: string, userId: string) {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const session = await this.session(organizationId, id, tx, true);
          if (session.status !== 'RUNNING') return;
          const row = await tx.salesProductImportRow.findFirst({
            where: { id: rowId, importId: id, organizationId, status: 'PENDING' },
          });
          if (!row) return; // The session lock and the committed row result fence retries, including code-less rows.
          const cells = row.cells as unknown as ImportCells;
          const source = session.wooConnectionId ? row.source as unknown as WooProductSnapshot | null : null;
          if (source) await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${organizationId + ':' + session.wooConnectionId + ':' + source.externalId}, 0))::text AS locked`;
          const linked = source ? await tx.wooCommerceProduct.findUnique({ where: {
            connectionId_externalId: { connectionId: session.wooConnectionId!, externalId: source.externalId },
          }, include: { product: { select: { id: true, sku: true, barcode: true } } } }) : null;
          const cats = await tx.salesProductCategory.findMany({ where: { organizationId } });
          const plan = this.sourcePlan(
            cells,
            session.options as unknown as Options,
            await this.matches(organizationId, cells, tx),
            new Map(cats.map((cat) => [cat.name, cat.id])),
            source, linked?.product,
          );
          if (
            plan.action !== 'SKIP' &&
            (plan.targetId !== (row.targetId || undefined) || plan.action !== row.action)
          )
            plan.errors.push(
              'Mã/sản phẩm đối chiếu đã thay đổi sau xem trước. Tạo bản xem trước mới trong phiên khác.',
            );
          if (plan.errors.length) throw new BadRequestException({ message: plan.errors });
          let productId: string | undefined;
          if (plan.action !== 'SKIP') {
            if (plan.categoryName)
              plan.data.categoryId = (
                await this.sales.createCategory(organizationId, plan.categoryName, tx)
              ).id;
            const product =
              plan.action === 'CREATE'
                ? await this.sales.createProduct(
                    organizationId,
                    plan.data as unknown as CreateSalesProductDto,
                    userId,
                    tx,
                  )
                : await this.sales.updateProduct(
                    organizationId,
                    plan.targetId!,
                    plan.data as UpdateSalesProductDto,
                    userId,
                    tx,
                  );
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
              status:
                plan.action === 'SKIP'
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
        },
        { timeout: 10_000, maxWait: 10_000 },
      );
    } catch (error) {
      const response = error instanceof HttpException ? error.getResponse() : null;
      const message =
        typeof response === 'string'
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
  async process(organizationId: string, id: string, userId: string) {
    const session = await this.session(organizationId, id);
    if (session.status !== 'RUNNING' && session.status !== 'COMPLETED')
      throw new ConflictException('Cần xem trước và xác nhận nhập.');
    if (session.status === 'RUNNING') {
      const rows = await this.prisma.salesProductImportRow.findMany({
        where: { importId: id, organizationId, status: 'PENDING' },
        orderBy: { rowNumber: 'asc' },
        take: IMPORT_LIMITS.batch,
        select: { id: true },
      });
      for (const row of rows) await this.runRow(organizationId, id, row.id, userId);
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
  async retry(organizationId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const session = await this.session(organizationId, id, tx, true);
      if (session.status !== 'COMPLETED')
        throw new ConflictException('Chỉ thử lại sau khi phiên đã xử lý hết lô.');
      const changed = await tx.salesProductImportRow.updateMany({
        where: { importId: id, organizationId, status: 'ERROR' },
        data: { status: 'PENDING', errors: [], message: null },
      });
      return this.publicSession(
        await tx.salesProductImport.update({
          where: { id },
          data: { status: changed.count ? 'RUNNING' : 'COMPLETED' },
        }),
        tx,
      );
    });
  }
  async rows(organizationId: string, id: string, query: PaginationDto) {
    await this.session(organizationId, id);
    const { page, pageSize, skip, take } = getPaginationParams(query);
    const [rows, total] = await Promise.all([
      this.prisma.salesProductImportRow.findMany({
        where: { importId: id, organizationId },
        orderBy: { rowNumber: 'asc' },
        skip,
        take,
      }),
      this.prisma.salesProductImportRow.count({ where: { importId: id, organizationId } }),
    ]);
    return buildPaginatedResult(
      rows.map((row) => this.publicRow(row)),
      total,
      page,
      pageSize,
    );
  }
  private publicRow(row: SalesProductImportRow) {
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
      values: Object.fromEntries(
        Object.entries(row.cells as unknown as ImportCells).map(([field, cell]) => [
          field,
          cell.value,
        ]),
      ),
    };
  }
  async report(organizationId: string, id: string) {
    await this.session(organizationId, id);
    const rows = await this.prisma.salesProductImportRow.findMany({
      where: { importId: id, organizationId },
      orderBy: { rowNumber: 'asc' },
    });
    return spreadsheetCsv([
      [
        'Dòng',
        'Trạng thái',
        'Product ID',
        'Thông báo/lỗi',
        'Lưu ý',
        ...Object.values(PRODUCT_COLUMNS),
      ],
      ...rows.map((row) => {
        const item = this.publicRow(row);
        return [
          item.rowNumber,
          item.status,
          item.productId || '',
          [item.message, ...(item.errors as string[])].filter(Boolean).join(' | '),
          (item.warnings as string[]).join(' | '),
          ...IMPORT_FIELDS.map((field) => item.values[field] || ''),
        ];
      }),
    ]);
  }
}
