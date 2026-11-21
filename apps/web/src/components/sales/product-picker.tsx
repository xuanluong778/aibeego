'use client';
import { useEffect, useId, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSalesProducts } from '@/hooks/use-sales';
import type { SalesProduct } from '@/types/sales';
import { ProductImage } from './product-image';

export function SalesProductPicker({
  value,
  onChange,
  disabled,
}: {
  value: SalesProduct | null;
  onChange: (product: SalesProduct | null) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState(-1);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(text.trim());
      setPage(1);
      setActive(-1);
    }, 250);
    return () => clearTimeout(timer);
  }, [text]);
  const results = useSalesProducts({
    active: 'true',
    page,
    pageSize: 10,
    search: query || undefined,
  });
  const pick = (product: SalesProduct) => { onChange(product); setExpanded(false); setText(''); setActive(-1); };
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium">
        Tìm sản phẩm theo tên, model, SKU hoặc barcode
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          id={id}
          value={text}
          maxLength={120}
          disabled={disabled}
          placeholder="Nhập tên, model, SKU hoặc barcode…"
          className="pl-9"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={`${id}-results`}
          aria-activedescendant={expanded && active >= 0 ? `${id}-option-${active}` : undefined}
          onFocus={() => setExpanded(true)}
          onChange={(e) => {
            setText(e.target.value);
            setExpanded(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault(); setExpanded(true);
              setActive(index => e.key === 'ArrowDown' ? Math.min(index + 1, (results.data?.items.length || 1) - 1) : Math.max(0, index - 1));
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              const product = results.data?.items[active];
              if (expanded && product && !results.isFetching && text.trim() === query) { pick(product); return; }
              setQuery(text.trim());
              setExpanded(true);
            }
            if (e.key === 'Escape') {
              setExpanded(false);
              e.preventDefault();
            }
          }}
        />
      </div>
      {expanded ? (
        <div className="rounded-xl border border-white/15 bg-background p-2 shadow-lg">
          {results.isFetching ? (
            <p role="status" className="p-2 text-xs text-muted-foreground">
              Đang tìm sản phẩm…
            </p>
          ) : null}
          {results.isError ? (
            <p role="alert" className="p-2 text-sm">
              Không tải được danh sách.{' '}
              <button type="button" className="underline" onClick={() => void results.refetch()}>
                Thử lại
              </button>
            </p>
          ) : null}
          <div
            id={`${id}-results`}
            role="listbox"
            aria-label="Kết quả tìm sản phẩm"
            className="max-h-80 overflow-y-auto"
          >
            {results.data?.items.map((product, index) => (
              <button
                id={`${id}-option-${index}`}
                type="button"
                role="option"
                aria-selected={value?.id === product.id}
                key={product.id}
                disabled={disabled || text.trim() !== query || results.isFetching}
                onClick={() => pick(product)}
                className={`flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-white/10 focus:bg-white/10 disabled:opacity-50 ${active === index ? 'bg-white/10' : ''}`}
              >
                <ProductImage src={product.imageUrl} name={product.name} className="h-12 w-12" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{product.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Model: {product.model || '—'} · SKU: {product.sku || '—'} · Tồn bán được:{' '}
                    {product.sellableQty ?? product.stockQty}
                  </span>
                </span>
              </button>
            ))}
          </div>
          {!results.isFetching && !results.isError && !results.data?.items.length ? (
            <p className="p-3 text-sm text-muted-foreground">
              Không tìm thấy sản phẩm. Thử tên/model/SKU khác hoặc thêm sản phẩm trước.
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded(false)}>
              Đóng danh sách
            </Button>
            <div className="flex items-center gap-2 text-xs">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1 || results.isFetching}
                onClick={() => setPage((p) => p - 1)}
              >
                Trước
              </Button>
              <span>
                {page}/{results.data?.totalPages || 1}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= (results.data?.totalPages || 1) || results.isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                Sau
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-teal-500/30 bg-teal-500/10 p-3">
          <ProductImage src={value.imageUrl} name={value.name} className="h-12 w-12" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Đã chọn: {value.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Model: {value.model || '—'} · SKU: {value.sku || '—'} · Tồn nội bộ bán được:{' '}
              {value.sellableQty ?? value.stockQty}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label="Bỏ chọn sản phẩm"
            onClick={() => onChange(null)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Chọn một kết quả cụ thể trước khi lập phiếu; hệ thống không tự chọn khi trùng tên/model.
        </p>
      )}
    </div>
  );
}
