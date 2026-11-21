'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  useDownloadProductImport,
  useProductImport,
  useProductImportCommand,
  useProductImportHistory,
  useProductImportRows,
  useUploadProductImport,
} from '@/hooks/use-sales';
import {
  PRODUCT_IMPORT_COLUMNS,
  type ProductImportField,
  type ProductImportOptions,
  type ProductImportSession,
} from '@/types/sales-product-import';
import { formatMutationError } from '@/lib/format-mutation-error';
import { WooCommerceImportPanel } from './woocommerce-import-panel';

const fields = Object.keys(PRODUCT_IMPORT_COLUMNS) as ProductImportField[];
const fold = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '');
const labels: Record<string, string> = {
  DRAFT: 'Chọn sheet/ánh xạ',
  PREVIEW: 'Đã xem trước',
  RUNNING: 'Đang chờ/đang nhập',
  COMPLETED: 'Đã xử lý hết',
  READY: 'Sẵn sàng',
  INVALID: 'Lỗi dữ liệu',
  SKIPPED: 'Bỏ qua',
  PENDING: 'Chờ nhập',
  CREATED: 'Đã tạo',
  UPDATED: 'Đã cập nhật',
  ERROR: 'Lỗi khi nhập',
};
const defaultOptions = (): ProductImportOptions => ({
  mode: 'skip',
  createCategories: false,
  updateFields: ['price', 'costPrice'],
});
const selectClass = 'h-10 w-full rounded-md border bg-background px-3 text-sm';
function suggestedMapping(headers: string[]) {
  const mapping: Partial<Record<ProductImportField, number>> = {};
  for (const field of fields) {
    const matches = headers.flatMap((header, index) =>
      [fold(PRODUCT_IMPORT_COLUMNS[field]), fold(field)].includes(fold(header)) ? [index] : [],
    );
    if (matches.length === 1) mapping[field] = matches[0];
  }
  return mapping;
}

function ImportContent({ initialSession }: { initialSession?: ProductImportSession }) {
  const qc = useQueryClient();
  const [id, setId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const token = useRef('');
  const [delimiter, setDelimiter] = useState('auto');
  const [sheetIndex, setSheetIndex] = useState(-1);
  const [mapping, setMapping] = useState<Partial<Record<ProductImportField, number>>>({});
  const [options, setOptions] = useState(defaultOptions);
  const [dirty, setDirty] = useState(false);
  const [rowPage, setRowPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);
  const control = useRef({ mounted: true, stop: false, active: false });
  useEffect(() => {
    control.current.mounted = true;
    return () => {
      control.current.mounted = false;
      control.current.stop = true;
    };
  }, []);
  const history = useProductImportHistory(historyPage);
  const detail = useProductImport(id);
  const session = detail.data;
  const rows = useProductImportRows(id, rowPage, !!session && session.status !== 'DRAFT');
  const upload = useUploadProductImport();
  const command = useProductImportCommand();
  const download = useDownloadProductImport();
  const busy = upload.isPending || command.isPending || running;
  const sheet = session?.sheets.find((item) => item.index === sheetIndex);
  const editable = !!session && ['DRAFT', 'PREVIEW'].includes(session.status) && !busy;
  const fail = (e: unknown) =>
    setError(formatMutationError(e, 'Chưa hoàn tất thao tác. Vui lòng thử lại.'));

  const selectSession = (item: ProductImportSession) => {
    qc.setQueryData(['sales', 'product-imports', item.id], item);
    setId(item.id);
    setError('');
    setDirty(false);
    setRowPage(1);
    const nextSheet = item.sheetIndex ?? (item.sheets.length === 1 ? item.sheets[0]!.index : -1);
    setSheetIndex(nextSheet);
    setMapping(
      item.mapping ||
        suggestedMapping(item.sheets.find((s) => s.index === nextSheet)?.headers || []),
    );
    setOptions(item.options || defaultOptions());
  };
  useEffect(() => {
    if (initialSession) selectSession(initialSession);
    // The parent mounts a fresh importer keyed by the immutable source session ID.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSession?.id]);
  const saveDownload = async (path: string) => {
    setError('');
    try {
      const result = await download.mutateAsync(path),
        url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      fail(e);
    }
  };
  const run = async (sessionId: string) => {
    if (control.current.active) return;
    control.current.active = true;
    control.current.stop = false;
    setRunning(true);
    setError('');
    try {
      while (control.current.mounted && !control.current.stop) {
        const result = await command.mutateAsync({ id: sessionId, action: 'process' });
        if (result.status !== 'RUNNING') break;
      }
    } catch (e) {
      if (control.current.mounted) fail(e);
    } finally {
      control.current.active = false;
      if (control.current.mounted) setRunning(false);
    }
  };
  const confirm = async () => {
    if (!session || busy || dirty) return;
    setError('');
    try {
      const next = await command.mutateAsync({
        id: session.id,
        action: 'confirm',
        body: { previewVersion: session.previewVersion },
      });
      if (next.status === 'RUNNING') await run(next.id);
    } catch (e) {
      fail(e);
    }
  };

  return (
    <div className="min-w-0 space-y-5">
      <p className="text-sm text-muted-foreground">
        {session?.wooConnectionId ? 'Đã đọc WooCommerce. Kiểm tra ánh xạ/tùy chọn → xem trước → xác nhận nhập. Ảnh và mô tả giữ trong dữ liệu nguồn; tồn website không nhập vào kho nội bộ. ' : ''}
        Chọn file/sheet → ánh xạ cột → xem trước → xác nhận nhập. Tối đa 5MB, 2.000 dòng cho toàn
        file, 40 cột và 10 sheet. Giá dùng dấu chấm thập phân, không dùng dấu phân nhóm; lưu
        SKU/Barcode dạng Text trong Excel.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={download.isPending}
          onClick={() => void saveDownload('template?format=xlsx')}
        >
          Tải mẫu .xlsx
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={download.isPending}
          onClick={() => void saveDownload('template?format=csv')}
        >
          Tải mẫu .csv UTF-8
        </Button>
      </div>
      <section className="space-y-3 rounded-lg border p-4" aria-label="Chọn file nhập sản phẩm">
        <div className="space-y-1">
          <Label htmlFor="product-import-file">File Excel/CSV</Label>
          <Input
            id="product-import-file"
            type="file"
            accept=".xlsx,.csv"
            disabled={busy}
            onChange={(event) => {
              const chosen = event.target.files?.[0] || null;
              if (
                chosen &&
                (!/\.(xlsx|csv)$/i.test(chosen.name) ||
                  chosen.size > 5 * 1024 * 1024 ||
                  !chosen.size)
              ) {
                setError('Chọn .xlsx/.csv có dữ liệu, tối đa 5MB.');
                event.target.value = '';
                setFile(null);
                return;
              }
              token.current = crypto.randomUUID();
              setFile(chosen);
              setError('');
            }}
          />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="product-import-delimiter">Dấu phân cách CSV</Label>
            <select
              id="product-import-delimiter"
              className={selectClass}
              value={delimiter}
              disabled={busy}
              onChange={(event) => {
                setDelimiter(event.target.value);
                token.current = crypto.randomUUID();
              }}
            >
              <option value="auto">Tự nhận nếu rõ ràng</option>
              <option value=",">Dấu phẩy (,)</option>
              <option value=";">Chấm phẩy (;)</option>
            </select>
          </div>
          <Button
            type="button"
            disabled={!file || busy}
            onClick={async () => {
              if (!file) return;
              setError('');
              try {
                selectSession(
                  await upload.mutateAsync({ file, clientToken: token.current, delimiter }),
                );
              } catch (e) {
                fail(e);
              }
            }}
          >
            {upload.isPending ? 'Đang đọc file…' : 'Đọc file / tạo phiên'}
          </Button>
        </div>
      </section>
      {error ? (
        <p role="alert" className="whitespace-pre-wrap text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {detail.isError ? (
        <p role="alert" className="text-sm text-destructive">
          Không tải được phiên.{' '}
          <button type="button" onClick={() => void detail.refetch()} className="underline">
            Thử lại
          </button>
        </p>
      ) : null}
      {session ? (
        <section
          className="min-w-0 space-y-4 rounded-lg border p-4"
          aria-label="Phiên nhập hiện tại"
        >
          <div>
            <h3 className="break-all font-semibold">{session.fileName}</h3>
            <p className="text-xs text-muted-foreground">
              Mã phiên: {session.id} · {labels[session.status]} · Cập nhật:{' '}
              {new Date(session.updatedAt).toLocaleString('vi-VN')}
            </p>
          </div>
          {['DRAFT', 'PREVIEW'].includes(session.status) ? (
            <fieldset disabled={!editable} className="min-w-0 space-y-3">
              <div>
                <Label htmlFor="product-import-sheet">Sheet dữ liệu</Label>
                <select
                  id="product-import-sheet"
                  className={selectClass}
                  value={sheetIndex}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setSheetIndex(next);
                    setMapping(
                      suggestedMapping(session.sheets.find((s) => s.index === next)?.headers || []),
                    );
                    setDirty(true);
                  }}
                >
                  <option value={-1}>Chọn sheet</option>
                  {session.sheets.map((item) => (
                    <option key={item.index} value={item.index}>
                      {item.name} ({item.rowCount} dòng)
                    </option>
                  ))}
                </select>
              </div>
              {sheet ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {fields.map((field) => (
                    <div key={field}>
                      <Label htmlFor={`import-map-${field}`}>{PRODUCT_IMPORT_COLUMNS[field]}</Label>
                      <select
                        id={`import-map-${field}`}
                        className={selectClass}
                        value={mapping[field] ?? -1}
                        onChange={(event) => {
                          const next = { ...mapping },
                            col = Number(event.target.value);
                          if (col < 0) delete next[field];
                          else next[field] = col;
                          setMapping(next);
                          setDirty(true);
                        }}
                      >
                        <option value={-1}>Không nhập cột này</option>
                        {sheet.headers.map((header, index) => (
                          <option key={index} value={index}>
                            Cột {index + 1}: {header || '(không có tên)'}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              ) : null}
              <div>
                <Label htmlFor="product-import-mode">Khi mã đã có trong tổ chức</Label>
                <select
                  id="product-import-mode"
                  className={selectClass}
                  value={options.mode}
                  onChange={(event) => {
                    setOptions({ ...options, mode: event.target.value as 'skip' | 'update' });
                    setDirty(true);
                  }}
                >
                  <option value="skip">Bỏ qua (mặc định)</option>
                  <option value="update">Cập nhật trường được chọn</option>
                </select>
              </div>
              {options.mode === 'update' ? (
                <div className="space-y-2">
                  <p className="text-sm">
                    Chọn trường cập nhật. Ô trống giữ dữ liệu hiện có; tồn đầu kỳ không được cập
                    nhật.
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {fields
                      .filter((field) => field !== 'stockQty')
                      .map((field) => (
                        <label key={field} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={options.updateFields.includes(field)}
                            onChange={(event) => {
                              setOptions({
                                ...options,
                                updateFields: event.target.checked
                                  ? [...options.updateFields, field]
                                  : options.updateFields.filter((item) => item !== field),
                              });
                              setDirty(true);
                            }}
                          />
                          {PRODUCT_IMPORT_COLUMNS[field]}
                        </label>
                      ))}
                  </div>
                </div>
              ) : null}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={options.createCategories}
                  onChange={(event) => {
                    setOptions({ ...options, createCategories: event.target.checked });
                    setDirty(true);
                  }}
                />
                Cho phép tạo danh mục mới
              </label>
              <Button
                type="button"
                disabled={!sheet || busy}
                onClick={async () => {
                  setError('');
                  try {
                    await command.mutateAsync({
                      id: session.id,
                      action: 'preview',
                      body: { sheetIndex, mapping, options },
                    });
                    setDirty(false);
                    setRowPage(1);
                  } catch (e) {
                    fail(e);
                  }
                }}
              >
                Xem trước / kiểm tra
              </Button>
            </fieldset>
          ) : null}
          {dirty && session.status === 'PREVIEW' ? (
            <p role="status" className="text-sm text-amber-300">
              Ánh xạ/tùy chọn đã đổi. Xem trước lại trước khi xác nhận.
            </p>
          ) : null}
          {session.total > 0 ? (
            <div className="space-y-2">
              <p role="status" className="text-sm">
                {Object.entries(session.counts)
                  .map(([status, count]) => `${labels[status] || status}: ${count}`)
                  .join(' · ')}{' '}
                · Tổng: {session.total}
              </p>
              {['RUNNING', 'COMPLETED'].includes(session.status) ? (
                <progress
                  className="h-3 w-full"
                  max={session.total}
                  value={session.total - (session.counts.PENDING || 0)}
                  aria-label="Tiến trình nhập sản phẩm"
                />
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {session.status === 'PREVIEW' ? (
              <Button
                type="button"
                disabled={busy || dirty || !((session.counts.READY || 0) > 0)}
                onClick={() => void confirm()}
              >
                Xác nhận nhập {session.counts.READY || 0} dòng hợp lệ
              </Button>
            ) : null}
            {session.status === 'RUNNING' && !running ? (
              <Button type="button" disabled={busy} onClick={() => void run(session.id)}>
                Tiếp tục nhập
              </Button>
            ) : null}
            {running ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  control.current.stop = true;
                }}
              >
                Dừng sau lô hiện tại
              </Button>
            ) : null}
            {session.status === 'COMPLETED' && (session.counts.ERROR || 0) > 0 ? (
              <Button
                type="button"
                disabled={busy}
                onClick={async () => {
                  try {
                    await command.mutateAsync({ id: session.id, action: 'retry' });
                    await run(session.id);
                  } catch (e) {
                    fail(e);
                  }
                }}
              >
                Thử lại dòng lỗi
              </Button>
            ) : null}
            {session.status !== 'DRAFT' ? (
              <Button
                type="button"
                variant="outline"
                disabled={download.isPending}
                onClick={() => void saveDownload(`${session.id}/report.csv`)}
              >
                Tải kết quả / lỗi CSV
              </Button>
            ) : null}
          </div>
          {session.status === 'PREVIEW' && (session.counts.INVALID || 0) > 0 ? (
            <p className="text-sm text-amber-300">
              Dòng lỗi không được nhập. Có thể sửa file rồi tạo phiên khác; xác nhận chỉ xử lý các
              dòng hợp lệ.
            </p>
          ) : null}
          {session.status === 'RUNNING' ? (
            <p className="text-xs text-muted-foreground">
              Mỗi lô tối đa 25 dòng. Đóng trang sẽ dừng sau lô đang chạy; mở lịch sử để tiếp tục
              cùng mã phiên, không nhập lại dòng đã thành công.
            </p>
          ) : null}
          {rows.isError ? (
            <p role="alert" className="text-sm text-destructive">
              Không tải được kết quả dòng.{' '}
              <button type="button" className="underline" onClick={() => void rows.refetch()}>
                Thử lại
              </button>
            </p>
          ) : null}
          {rows.data ? (
            <>
              <div className="overflow-x-auto rounded border">
                <table className="w-full min-w-[1300px] text-left text-xs">
                  <thead>
                    <tr>
                      <th className="p-2">Dòng / kết quả</th>
                      {fields.map((field) => (
                        <th className="p-2" key={field}>
                          {PRODUCT_IMPORT_COLUMNS[field]}
                        </th>
                      ))}
                      <th className="p-2">Lỗi / lưu ý</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.data.items.map((row) => (
                      <tr className="border-t align-top" key={row.id}>
                        <td className="p-2">
                          {row.rowNumber} · {labels[row.status] || row.status}
                          <p>
                            {row.action === 'UPDATE'
                              ? 'Sửa sản phẩm'
                              : row.action === 'CREATE'
                                ? 'Tạo sản phẩm'
                                : ''}
                          </p>
                          {row.productId ? <p className="break-all">{row.productId}</p> : null}
                          {row.source ? <div className="mt-1 text-xs text-muted-foreground">
                            <p>WooCommerce #{row.source.externalId}</p>
                            {row.source.images?.[0] ? <img src={row.source.images[0]} alt="Ảnh sản phẩm nguồn" width={48} height={48} loading="lazy" referrerPolicy="no-referrer" className="my-1 h-12 w-12 rounded object-contain" /> : null}
                            <p>Tồn web: {row.source.stockQuantity ?? 'Chưa có số lượng'} ({row.source.stockStatus})</p>
                            {row.source.url ? <a className="underline" href={row.source.url} target="_blank" rel="noreferrer">Xem nguồn</a> : null}
                          </div> : null}
                        </td>
                        {fields.map((field) => (
                          <td className="max-w-48 whitespace-pre-wrap break-words p-2" key={field}>
                            {row.values[field] || '—'}
                          </td>
                        ))}
                        <td className="min-w-64 space-y-1 p-2">
                          {row.message ? <p>{row.message}</p> : null}
                          {row.errors.map((message, index) => (
                            <p key={`e${index}`} className="text-destructive">
                              {message}
                            </p>
                          ))}
                          {row.warnings.map((message, index) => (
                            <p key={`w${index}`} className="text-amber-300">
                              {message}
                            </p>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <p>
                  Trang kết quả {rowPage}/{rows.data.totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={rowPage <= 1 || rows.isFetching}
                    onClick={() => setRowPage((page) => page - 1)}
                  >
                    Kết quả trước
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={rowPage >= rows.data.totalPages || rows.isFetching}
                    onClick={() => setRowPage((page) => page + 1)}
                  >
                    Kết quả sau
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </section>
      ) : null}
      <section className="space-y-3 border-t pt-4" aria-label="Lịch sử nhập sản phẩm">
        <h3 className="font-semibold">Lịch sử nhập</h3>
        {history.isLoading ? <p>Đang tải lịch sử…</p> : null}
        {history.isError ? (
          <p role="alert">
            Không tải được lịch sử.{' '}
            <button type="button" className="underline" onClick={() => void history.refetch()}>
              Thử lại
            </button>
          </p>
        ) : null}
        {history.data?.items.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded border p-3"
          >
            <div>
              <p className="break-all font-medium">{item.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {labels[item.status]} · {item.total} dòng ·{' '}
                {new Date(item.updatedAt).toLocaleString('vi-VN')}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => selectSession(item)}
            >
              Mở phiên
            </Button>
          </div>
        ))}
        {history.data && !history.data.total ? (
          <p className="text-sm text-muted-foreground">Chưa có phiên nhập.</p>
        ) : null}
        {history.data ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={historyPage <= 1 || history.isFetching || busy}
              onClick={() => setHistoryPage((page) => page - 1)}
            >
              Lịch sử trước
            </Button>
            <span className="text-xs">
              {historyPage}/{history.data.totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={historyPage >= history.data.totalPages || history.isFetching || busy}
              onClick={() => setHistoryPage((page) => page + 1)}
            >
              Lịch sử sau
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function ProductImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [source, setSource] = useState<'file' | 'woo'>('file');
  const [initialSession, setInitialSession] = useState<ProductImportSession>();
  return (
    <Dialog open={open} onOpenChange={next => {
      if (!next) { setSource('file'); setInitialSession(undefined); }
      onOpenChange(next);
    }}>
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nhập nhanh sản phẩm</DialogTitle>
        </DialogHeader>
        {open ? <>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={source === 'file' ? 'default' : 'outline'} onClick={() => setSource('file')}>Excel/CSV và lịch sử</Button>
            <Button type="button" variant={source === 'woo' ? 'default' : 'outline'} onClick={() => setSource('woo')}>Kết nối WooCommerce</Button>
          </div>
          {source === 'woo' ? <WooCommerceImportPanel onReady={session => { setInitialSession(session); setSource('file'); }} />
            : <ImportContent key={initialSession?.id || 'file'} initialSession={initialSession} />}
        </> : null}
      </DialogContent>
    </Dialog>
  );
}
