'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCustomers } from '@/hooks/use-queries';
import { formatCurrency } from '@/lib/format';
import { useT } from '@/i18n/i18n-provider';
import { SALES_ORDER_SOURCES, type SalesOrder, type SalesProduct } from '@/types/sales';
import type { SalesOrderInput } from '@/hooks/use-sales';
import { SalesBarcodeScan } from '@/components/sales/sales-barcode-scan';
import { SalesProductPicker } from '@/components/sales/product-picker';

type Line = {
  key: string;
  productId?: string;
  productName: string;
  sku?: string;
  unit?: string;
  model?: string;
  picked?: SalesProduct | null;
  quantity: number;
  unitPrice: number;
  lineDiscount: number;
};

function emptyLine(): Line {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    productName: '',
    quantity: 1,
    unitPrice: 0,
    lineDiscount: 0,
  };
}

export function SalesOrderFormDialog({
  open,
  onOpenChange,
  initial,
  isPending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: SalesOrder | null;
  isPending?: boolean;
  onSubmit: (data: SalesOrderInput) => void;
}) {
  const t = useT();
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerId, setCustomerId] = useState(initial?.customerId || '');
  const [customerName, setCustomerName] = useState(initial?.customerName || '');
  const [phone, setPhone] = useState(initial?.phone || '');
  const [address, setAddress] = useState(initial?.address || '');
  const [source, setSource] = useState(initial?.source || 'OTHER');
  const [discount, setDiscount] = useState(String(initial?.discount ?? 0));
  const [shippingFee, setShippingFee] = useState(String(initial?.shippingFee ?? 0));
  const [note, setNote] = useState(initial?.note || '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [lines, setLines] = useState<Line[]>(
    initial?.items?.length
      ? initial.items.map((it) => ({
          key: it.id || emptyLine().key,
          productId: it.productId || undefined,
          productName: it.productName,
          sku: it.sku || undefined,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          lineDiscount: it.lineDiscount,
        }))
      : [emptyLine()],
  );

  useEffect(() => {
    if (!open) return;
    setCustomerSearch('');
    setCustomerId(initial?.customerId || '');
    setCustomerName(initial?.customerName || '');
    setPhone(initial?.phone || '');
    setAddress(initial?.address || '');
    setSource(initial?.source || 'OTHER');
    setDiscount(String(initial?.discount ?? 0));
    setShippingFee(String(initial?.shippingFee ?? 0));
    setNote(initial?.note || '');
    setLines(
      initial?.items?.length
        ? initial.items.map((it) => ({
            key: it.id || emptyLine().key,
            productId: it.productId || undefined,
            productName: it.productName,
            sku: it.sku || undefined,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            lineDiscount: it.lineDiscount,
          }))
        : [emptyLine()],
    );
  }, [open, initial]);

  const customers = useCustomers({
    search: customerSearch || undefined,
    pageSize: '20',
  } as Record<string, string>);
  const customerItems = customers.data?.items ?? [];

  const totals = useMemo(() => {
    const subtotal = lines.reduce(
      (s, l) => s + Math.max(0, l.quantity * l.unitPrice - (l.lineDiscount || 0)),
      0,
    );
    const disc = Math.max(0, Number(discount) || 0);
    const ship = Math.max(0, Number(shippingFee) || 0);
    return { subtotal, total: Math.max(0, subtotal - disc + ship) };
  }, [lines, discount, shippingFee]);

  const pickCustomer = (id: string) => {
    setCustomerId(id);
    const c = customerItems.find((x) => x.id === id);
    if (c) {
      setCustomerName(c.name);
      setPhone(c.phone || '');
    }
  };

  const applyProduct = (key: string, p: SalesProduct | null) => {
    setLines((prev) =>
      prev.map((l) =>
        l.key === key
          ? p
            ? {
                ...l,
                productId: p.id,
                productName: p.name,
                sku: p.sku || undefined,
                unit: p.unit || undefined,
                model: p.model || undefined,
                unitPrice: Number(p.price) || 0,
                picked: p,
              }
            : { ...l, productId: undefined, picked: null }
          : l,
      ),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initial ? t('sales.editOrder') : t('sales.createOrder')}
          </DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const nextErrors: Record<string, string> = {};
            if (!customerId) nextErrors.customer = 'Chọn khách hàng';
            lines.forEach((l) => {
              if (!l.productName.trim()) nextErrors[l.key] = 'Chọn hoặc nhập sản phẩm';
              if (!l.quantity || l.quantity < 1) nextErrors[`${l.key}-qty`] = 'Số lượng phải ≥ 1';
            });
            setFieldErrors(nextErrors);
            if (Object.keys(nextErrors).length) return;
            const validLines = lines.filter((l) => l.productName.trim());
            onSubmit({
              customerId,
              customerName: customerName.trim() || undefined,
              phone: phone.trim() || undefined,
              address: address.trim() || undefined,
              source: source || undefined,
              discount: Number(discount) || 0,
              shippingFee: Number(shippingFee) || 0,
              note: note.trim() || undefined,
              items: validLines.map((l) => ({
                productId: l.productId,
                productName: l.productName.trim(),
                sku: l.sku,
                quantity: Math.max(1, Number(l.quantity) || 1),
                unitPrice: Math.max(0, Number(l.unitPrice) || 0),
                lineDiscount: Math.max(0, Number(l.lineDiscount) || 0),
              })),
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>{t('sales.customer')} *</Label>
              <Input
                placeholder={t('sales.searchCustomer')}
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="mb-2"
              />
              {fieldErrors.customer ? (
                <p role="alert" className="mb-1 text-xs text-destructive">{fieldErrors.customer}</p>
              ) : null}
              <Select value={customerId || undefined} onValueChange={pickCustomer}>
                <SelectTrigger>
                  <SelectValue placeholder={t('sales.selectCustomer')} />
                </SelectTrigger>
                <SelectContent>
                  {customerItems.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.phone ? ` · ${c.phone}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t('sales.customerName')}</Label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t('sales.phone')}</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>{t('sales.address')}</Label>
              <Input value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t('sales.source')}</Label>
              <Select value={source || 'OTHER'} onValueChange={setSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SALES_ORDER_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`sales.sources.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('sales.products')}</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setLines((p) => [...p, emptyLine()])}>
                <Plus className="mr-1 h-4 w-4" />
                {t('sales.addLine')}
              </Button>
            </div>
            <SalesBarcodeScan
              onFound={(p) => {
                setLines((prev) => [
                  ...prev,
                  {
                    ...emptyLine(),
                    productId: p.id,
                    productName: p.name,
                    sku: p.sku || undefined,
                    unit: p.unit || undefined,
                    model: p.model || undefined,
                    unitPrice: Number(p.price) || 0,
                    picked: p,
                  },
                ]);
              }}
            />
            <div className="space-y-3">
              {lines.map((line) => (
                <div key={line.key} className="grid gap-2 rounded-lg border border-white/10 p-3 sm:grid-cols-12">
                  <div className="sm:col-span-4 space-y-1">
                    <Label className="text-xs">{t('sales.product')}</Label>
                    <SalesProductPicker
                      value={
                        line.picked ||
                        (line.productId
                          ? {
                              id: line.productId,
                              name: line.productName,
                              sku: line.sku,
                              model: line.model,
                              unit: line.unit,
                              price: line.unitPrice,
                              costPrice: 0,
                              stockQty: 0,
                              minStockQty: 0,
                              isActive: true,
                            }
                          : null)
                      }
                      onChange={(p) => applyProduct(line.key, p)}
                    />
                    {fieldErrors[line.key] ? (
                      <p role="alert" className="text-xs text-destructive">{fieldErrors[line.key]}</p>
                    ) : null}
                    <Input
                      className="mt-1"
                      placeholder={t('sales.productName')}
                      value={line.productName}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((l) =>
                            l.key === line.key ? { ...l, productName: e.target.value } : l,
                          ),
                        )
                      }
                      required
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs">{t('sales.qty')}</Label>
                    <Input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((l) =>
                            l.key === line.key
                              ? { ...l, quantity: Number(e.target.value) || 1 }
                              : l,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs">{t('sales.price')}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={line.unitPrice}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((l) =>
                            l.key === line.key
                              ? { ...l, unitPrice: Number(e.target.value) || 0 }
                              : l,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <Label className="text-xs">{t('sales.lineDiscount')}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={line.lineDiscount}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((l) =>
                            l.key === line.key
                              ? { ...l, lineDiscount: Number(e.target.value) || 0 }
                              : l,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="flex items-end sm:col-span-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={lines.length <= 1}
                      onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>{t('sales.discount')}</Label>
              <Input type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{t('sales.shippingFee')}</Label>
              <Input
                type="number"
                min={0}
                value={shippingFee}
                onChange={(e) => setShippingFee(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>{t('sales.total')}</Label>
              <div className="flex h-10 items-center rounded-md border border-input px-3 text-sm font-semibold text-[#F97316]">
                {formatCurrency(totals.total)}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label>{t('sales.note')}</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isPending || !customerId}>
              {isPending ? t('common.saving') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
