'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { LoadingState, ErrorState, EmptyState } from '@/components/shared/page-state';
import {
  useCreateSalesCategory,
  useCreateSalesProduct,
  useSalesCategories,
  useSalesProducts,
  useUpdateSalesProduct,
} from '@/hooks/use-sales';
import { formatCurrency } from '@/lib/format';
import { formatMutationError } from '@/lib/format-mutation-error';
import { ApiError } from '@/lib/api-client';
import { hasPermission, useCurrentUser } from '@/hooks/use-auth';
import { useT } from '@/i18n/i18n-provider';
import type { SalesProduct } from '@/types/sales';
import { ProductCatalogTable } from '@/components/sales/product-catalog-table';
import { ProductDetailDialog } from '@/components/sales/product-detail-dialog';
import { ProductImportDialog } from '@/components/sales/product-import-dialog';

const emptyProduct = () => ({
  name: '',
  sku: '',
  model: '',
  barcode: '',
  categoryId: '',
  unit: 'cái',
  price: '0',
  costPrice: '0',
  stockQty: '0',
  minStockQty: '0',
  note: '',
});
type ProductField = keyof ReturnType<typeof emptyProduct>;
type FieldErrors = Partial<Record<ProductField, string>>;
const numericPattern = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

export default function SalesProductsPage() {
  const t = useT();
  const { data: user } = useCurrentUser();
  const canWrite = hasPermission(user, 'order.write');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<SalesProduct | null>(null);
  const [form, setForm] = useState(emptyProduct);
  const [newCategory, setNewCategory] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [notice, setNotice] = useState('');
  const nameInput = useRef<HTMLInputElement>(null);
  const saving = useRef(false);

  const list = useSalesProducts({
    page,
    pageSize: 50,
    search: search.trim() || undefined,
    active: 'true',
  });
  const categories = useSalesCategories();
  const create = useCreateSalesProduct();
  const update = useUpdateSalesProduct();
  const createCat = useCreateSalesCategory();
  const items = list.data?.items ?? [];
  const cats = categories.data ?? [];
  const busy = create.isPending || update.isPending || createCat.isPending;
  const totalPages = list.data?.totalPages ?? 1;

  useEffect(() => {
    if (list.data && page > list.data.totalPages) setPage(Math.max(1, list.data.totalPages));
  }, [list.data, page]);

  const change = (field: ProductField, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: undefined }));
    setServerError('');
  };
  const resetErrors = () => {
    setErrors({});
    setServerError('');
    setCategoryError('');
    setNotice('');
    setNewCategory('');
  };

  const openCreate = () => {
    if (!canWrite) return;
    setEditing(null);
    setForm(emptyProduct());
    resetErrors();
    setOpen(true);
  };

  const openEdit = (p: SalesProduct) => {
    if (!canWrite) return;
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku ?? '',
      model: p.model ?? '',
      barcode: p.barcode ?? '',
      categoryId: p.categoryId ?? '',
      price: String(p.price),
      costPrice: String(p.costPrice),
      stockQty: String(p.stockQty),
      minStockQty: String(p.minStockQty ?? 0),
      unit: p.unit || 'cái',
      note: p.note ?? '',
    });
    resetErrors();
    setOpen(true);
  };

  const save = async (addAnother: boolean) => {
    if (saving.current || busy || !canWrite) return;
    const invalid: FieldErrors = {};
    if (!form.name.trim()) invalid.name = 'Nhập tên sản phẩm.';
    for (const [field, max] of [
      ['name', 255],
      ['sku', 64],
      ['model', 120],
      ['barcode', 64],
      ['unit', 32],
      ['note', 1000],
    ] as const)
      if (form[field].trim().length > max) invalid[field] = `Tối đa ${max} ký tự.`;
    const number = (
      field: 'price' | 'costPrice' | 'stockQty' | 'minStockQty',
      integer: boolean,
    ) => {
      const text = form[field].trim(),
        value = Number(text);
      if (
        !text ||
        !numericPattern.test(text) ||
        !Number.isFinite(value) ||
        value < 0 ||
        (integer && !Number.isInteger(value))
      )
        invalid[field] = integer ? 'Nhập số nguyên không âm.' : 'Nhập giá không âm hợp lệ.';
      else if (value > (integer ? 2147483647 : 9999999999.99))
        invalid[field] = 'Giá trị vượt giới hạn cho phép.';
      return value;
    };
    const price = number('price', false),
      costPrice = number('costPrice', false),
      minStockQty = number('minStockQty', true);
    const stockQty = editing ? undefined : number('stockQty', true);
    setErrors(invalid);
    setServerError('');
    if (Object.keys(invalid).length) {
      document.getElementById(`product-${Object.keys(invalid)[0]}`)?.focus();
      return;
    }
    const body = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      model: form.model.trim(),
      barcode: form.barcode.trim(),
      categoryId: form.categoryId || null,
      unit: form.unit.trim() || 'cái',
      price,
      costPrice,
      minStockQty,
      note: form.note.trim(),
    };
    saving.current = true;
    try {
      if (editing) await update.mutateAsync({ id: editing.id, ...body });
      else await create.mutateAsync({ ...body, stockQty });
      setPage(1);
      setNotice(editing ? 'Đã cập nhật sản phẩm.' : 'Đã thêm sản phẩm.');
      if (addAnother && !editing) {
        setForm(emptyProduct());
        setNewCategory('');
        setCategoryError('');
        requestAnimationFrame(() => nameInput.current?.focus());
      } else setOpen(false);
    } catch (error) {
      const fieldErrors: FieldErrors = {};
      const messages = error instanceof ApiError ? (error.errors ?? [error.message]) : [];
      for (const message of messages) {
        const field = message.match(
          /^(name|sku|model|barcode|categoryId|unit|price|costPrice|stockQty|minStockQty|note)(?::|\s)/,
        )?.[1] as ProductField | undefined;
        if (field) fieldErrors[field] = message.replace(new RegExp(`^${field}:?\\s*`), '');
      }
      setErrors(fieldErrors);
      if (!Object.keys(fieldErrors).length)
        setServerError(formatMutationError(error, t('sales.saveFailed'), t));
      else
        requestAnimationFrame(() =>
          document.getElementById(`product-${Object.keys(fieldErrors)[0]}`)?.focus(),
        );
    } finally {
      saving.current = false;
    }
  };

  const fieldError = (field: ProductField) =>
    errors[field] ? (
      <p id={`product-${field}-error`} role="alert" className="text-xs text-destructive">
        {errors[field]}
      </p>
    ) : null;
  const input = (
    field: Exclude<ProductField, 'categoryId' | 'note'>,
    label: string,
    numeric = false,
    maxLength?: number,
  ) => (
    <div className="space-y-1">
      <Label htmlFor={`product-${field}`}>{label}</Label>
      <Input
        id={`product-${field}`}
        ref={field === 'name' ? nameInput : undefined}
        type={numeric ? 'number' : 'text'}
        min={numeric ? 0 : undefined}
        step={numeric ? (field === 'price' || field === 'costPrice' ? 'any' : 1) : undefined}
        maxLength={maxLength}
        value={form[field]}
        onChange={(event) => change(field, event.target.value)}
        aria-invalid={!!errors[field]}
        aria-describedby={errors[field] ? `product-${field}-error` : undefined}
      />
      {fieldError(field)}
    </div>
  );

  return (
    <div className="space-y-4 pb-8">
      <PageHeader title={t('sales.productsTitle')} description={t('sales.productsDesc')}>
        {canWrite ? <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>Nhập nhanh sản phẩm</Button> : null}
        {canWrite ? (
          <Button type="button" onClick={openCreate} className="bg-[#F97316] text-white">
            <Plus className="mr-1 h-4 w-4" />
            {t('sales.addProduct')}
          </Button>
        ) : null}
      </PageHeader>
      {notice ? (
        <p role="status" className="text-sm text-emerald-300">
          {notice}
        </p>
      ) : null}
      {user && !canWrite ? (
        <p className="text-sm text-muted-foreground">Bạn chỉ có quyền xem sản phẩm.</p>
      ) : null}

      <Input
        placeholder="Tìm tên sản phẩm, model, SKU, barcode…"
        value={search}
        aria-label={t('sales.searchProduct')}
        maxLength={120}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        className="max-w-sm"
      />

      {list.isLoading ? <LoadingState /> : null}
      {list.isError ? <ErrorState onRetry={() => void list.refetch()} /> : null}
      {!list.isLoading && !list.isError && !items.length ? (
        <EmptyState title={t('sales.emptyProducts')} />
      ) : null}

      {items.length ? <ProductCatalogTable products={items} onView={setViewingId} onEdit={canWrite ? openEdit : undefined} /> : null}

      {list.data ? (
        <nav
          aria-label="Phân trang sản phẩm"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <p className="text-sm text-muted-foreground">
            Trang {page}/{totalPages} · {list.data.total} sản phẩm · 50 sản phẩm/trang
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={page <= 1 || list.isFetching}
              onClick={() => setPage((previous) => previous - 1)}
            >
              Trang trước
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={page >= totalPages || list.isFetching}
              onClick={() => setPage((previous) => previous + 1)}
            >
              Trang sau
            </Button>
          </div>
        </nav>
      ) : null}

      <ProductDetailDialog id={viewingId} onClose={() => setViewingId(null)} onEdit={canWrite ? openEdit : undefined} />
      {canWrite ? <ProductImportDialog open={importOpen} onOpenChange={setImportOpen} /> : null}
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t('sales.editProduct') : t('sales.addProduct')}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void save(false);
            }}
          >
            <fieldset disabled={busy || !canWrite} className="min-w-0 space-y-3">
              {input('name', `${t('sales.productName')} *`, false, 255)}
              {input('model', 'Model', false, 120)}
              <div className="grid grid-cols-2 gap-2">
                {input('sku', 'SKU', false, 64)}
                {input('barcode', t('sales.barcode'), false, 64)}
              </div>
              <div className="space-y-1">
                <Label htmlFor="product-categoryId">{t('sales.category')}</Label>
                <Select
                  value={form.categoryId || '__none'}
                  disabled={busy || !canWrite}
                  onValueChange={(value) => {
                    // Clear only through the explicit option; ignore the native form's empty reset.
                    if (value) change('categoryId', value === '__none' ? '' : value);
                  }}
                >
                  <SelectTrigger
                    id="product-categoryId"
                    aria-invalid={!!errors.categoryId}
                    aria-describedby={errors.categoryId ? 'product-categoryId-error' : undefined}
                  >
                    <SelectValue placeholder={t('sales.category')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">—</SelectItem>
                    {cats.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldError('categoryId')}
                {categories.isError ? (
                  <p role="alert" className="text-xs text-destructive">
                    Không tải được danh mục.{' '}
                    <button
                      type="button"
                      className="underline"
                      onClick={() => void categories.refetch()}
                    >
                      Thử lại
                    </button>
                  </p>
                ) : null}
                <div className="mt-2 flex gap-2">
                  <Input
                    aria-label={t('sales.newCategory')}
                    placeholder={t('sales.newCategory')}
                    maxLength={120}
                    value={newCategory}
                    onChange={(event) => {
                      setNewCategory(event.target.value);
                      setCategoryError('');
                    }}
                    aria-invalid={!!categoryError}
                    aria-describedby={categoryError ? 'new-category-error' : undefined}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!newCategory.trim() || busy || !canWrite}
                    onClick={() =>
                      createCat.mutate(newCategory.trim(), {
                        onSuccess: (category) => {
                          change('categoryId', category.id);
                          setNewCategory('');
                          setCategoryError('');
                        },
                        onError: (error) =>
                          setCategoryError(
                            formatMutationError(error, 'Không thêm được danh mục.', t),
                          ),
                      })
                    }
                  >
                    {t('common.add')}
                  </Button>
                </div>
                {categoryError ? (
                  <p id="new-category-error" role="alert" className="text-xs text-destructive">
                    {categoryError}
                  </p>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {input('costPrice', t('sales.costPrice'), true)}
                {input('price', t('sales.price'), true)}
                {!editing ? (
                  input('stockQty', t('sales.openingStock'), true)
                ) : (
                  <div className="space-y-1">
                    <Label htmlFor="product-stockQty">{t('sales.stock')}</Label>
                    <Input
                      id="product-stockQty"
                      value={form.stockQty}
                      readOnly
                      disabled
                      aria-describedby="product-stock-help"
                    />
                  </div>
                )}
                {input('minStockQty', t('sales.minStock'), true)}
              </div>
              {editing ? (
                <p id="product-stock-help" className="text-xs text-muted-foreground">
                  Điều chỉnh tồn bằng phiếu nhập/xuất hoặc kiểm kê.
                </p>
              ) : null}
              {input('unit', t('sales.unit'), false, 32)}
              <div className="space-y-1">
                <Label htmlFor="product-note">Ghi chú</Label>
                <Textarea
                  id="product-note"
                  maxLength={1000}
                  value={form.note}
                  onChange={(event) => change('note', event.target.value)}
                  aria-invalid={!!errors.note}
                  aria-describedby={errors.note ? 'product-note-error' : undefined}
                />
                {fieldError('note')}
              </div>
            </fieldset>
            {serverError ? (
              <p role="alert" className="text-sm text-destructive">
                {serverError}
              </p>
            ) : null}
            {open && notice ? (
              <p role="status" className="text-sm text-emerald-300">
                {notice}
              </p>
            ) : null}
            <DialogFooter className="gap-2 sm:space-x-0">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={busy || !canWrite}>
                {t('common.save')}
              </Button>
              {!editing ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !canWrite}
                  onClick={() => void save(true)}
                >
                  Lưu và thêm tiếp
                </Button>
              ) : null}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
