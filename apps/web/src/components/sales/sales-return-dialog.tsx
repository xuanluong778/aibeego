'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiClient } from '@/lib/api-client';
import { formatCurrency } from '@/lib/format';
import { formatMutationError } from '@/lib/format-mutation-error';
import type { SalesOrder } from '@/types/sales';

type Disposition = 'RESTOCK' | 'HOLD' | 'SCRAP';

type Preview = {
  suggestedRefundMax: number;
  allocation?: { totals?: { merchandise?: number; revenueReversal?: number; suggestedRefundMax?: number } };
};

export function SalesReturnDialog({
  order,
  open,
  onOpenChange,
  idempotencyKey,
  pending,
  onConfirm,
}: {
  order: SalesOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  idempotencyKey: string;
  pending?: boolean;
  onConfirm: (body: {
    orderId: string;
    idempotencyKey: string;
    reason: string;
    note?: string;
    disposition: Disposition;
    refundAmount: number;
    items: Array<{ orderItemId: string; quantity: number; reason?: string }>;
  }) => void | Promise<void>;
}) {
  const lines = order.items.filter((it) => it.id && (it.returnedQty ?? 0) < it.quantity);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [reason, setReason] = useState('');
  const [disposition, setDisposition] = useState<Disposition>('RESTOCK');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loadingPreview, setLoadingPreview] = useState(false);

  const selected = useMemo(
    () =>
      lines
        .map((it) => ({
          orderItemId: it.id!,
          quantity: Math.trunc(Number(qty[it.id!]) || 0),
          max: it.quantity - (it.returnedQty ?? 0),
          name: it.productName,
        }))
        .filter((l) => l.quantity > 0),
    [lines, qty],
  );

  const runPreview = async () => {
    const next: Record<string, string> = {};
    if (!reason.trim()) next.reason = 'Nhập lý do trả';
    if (!selected.length) next.items = 'Chọn ít nhất một dòng và số lượng';
    for (const line of lines) {
      const n = Math.trunc(Number(qty[line.id!]) || 0);
      const max = line.quantity - (line.returnedQty ?? 0);
      if (n > max) next[line.id!] = `Tối đa ${max}`;
    }
    setFieldErrors(next);
    if (Object.keys(next).length) return;
    setLoadingPreview(true);
    setError('');
    try {
      const data = await apiClient<Preview>('/sales/returns/preview', {
        method: 'POST',
        body: JSON.stringify({
          orderId: order.id,
          idempotencyKey,
          reason: reason.trim(),
          disposition,
          items: selected.map((l) => ({ orderItemId: l.orderItemId, quantity: l.quantity })),
        }),
      });
      setPreview(data);
    } catch (e) {
      setError(formatMutationError(e));
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Trả hàng — {order.code}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {!lines.length ? (
            <p className="text-muted-foreground">Không còn dòng nào để trả.</p>
          ) : null}
          {lines.map((it) => {
            const max = it.quantity - (it.returnedQty ?? 0);
            return (
              <div key={it.id} className="grid grid-cols-[1fr_6rem] gap-2">
                <div>
                  <p>{it.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    Đã trả {it.returnedQty ?? 0}/{it.quantity} · còn {max}
                  </p>
                  {fieldErrors[it.id!] ? (
                    <p role="alert" className="text-xs text-destructive">{fieldErrors[it.id!]}</p>
                  ) : null}
                </div>
                <Input
                  type="number"
                  min={0}
                  max={max}
                  aria-label={`Số lượng trả ${it.productName}`}
                  value={qty[it.id!] ?? ''}
                  onChange={(e) => setQty((q) => ({ ...q, [it.id!]: e.target.value }))}
                />
              </div>
            );
          })}
          {fieldErrors.items ? <p role="alert" className="text-xs text-destructive">{fieldErrors.items}</p> : null}
          <div>
            <Label>Lý do</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            {fieldErrors.reason ? <p role="alert" className="text-xs text-destructive">{fieldErrors.reason}</p> : null}
          </div>
          <div>
            <Label>Cách xử lý hàng</Label>
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={disposition}
              onChange={(e) => setDisposition(e.target.value as Disposition)}
            >
              <option value="RESTOCK">Nhập lại kho bán</option>
              <option value="HOLD">Giữ chờ xử lý (không cộng tồn bán)</option>
              <option value="SCRAP">Hủy / không nhập lại</option>
            </select>
          </div>
          {loadingPreview ? <p role="status">Đang tính nghĩa vụ hoàn tiền…</p> : null}
          {error ? (
            <p role="alert" className="text-destructive">
              {error}{' '}
              <button type="button" className="underline" onClick={() => void runPreview()}>
                Thử lại
              </button>
            </p>
          ) : null}
          {preview ? (
            <div className="rounded-lg border border-white/15 p-3">
              <p>Hàng trả: {formatCurrency(preview.allocation?.totals?.merchandise ?? 0)}</p>
              <p>Đảo doanh thu: {formatCurrency(preview.allocation?.totals?.revenueReversal ?? 0)}</p>
              <p>Nghĩa vụ hoàn tối đa lần này: {formatCurrency(preview.suggestedRefundMax ?? 0)}</p>
              <p className="text-xs text-muted-foreground">
                Phiếu trả không tự hoàn tiền. Khóa nghiệp vụ giữ nguyên khi thử lại.
              </p>
            </div>
          ) : null}
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => void runPreview()} disabled={loadingPreview}>
            Xem trước
          </Button>
          <Button
            type="button"
            disabled={!preview || pending}
            onClick={() => {
              setError('');
              Promise.resolve(
                onConfirm({
                  orderId: order.id,
                  idempotencyKey,
                  reason: reason.trim(),
                  disposition,
                  refundAmount: 0,
                  items: selected.map((l) => ({
                    orderItemId: l.orderItemId,
                    quantity: l.quantity,
                    reason: reason.trim(),
                  })),
                }),
              ).catch((e) => setError(formatMutationError(e)));
            }}
          >
            Xác nhận trả hàng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
