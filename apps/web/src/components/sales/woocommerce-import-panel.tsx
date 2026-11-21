'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { formatMutationError } from '@/lib/format-mutation-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ProductImportSession } from '@/types/sales-product-import';

type Connection = { id: string; websiteUrl: string; currency: string };
type Category = { id: number; name: string; count: number };
type Item = {
  id: number;
  name: string;
  sku: string;
  type: string;
  price: string;
  image: string;
  stockQuantity: number | null;
  stockStatus: string;
  status: string;
};
const selectClass = 'h-10 w-full rounded-md border bg-background px-3 text-sm';

export function WooCommerceImportPanel({
  onReady,
}: {
  onReady: (session: ProductImportSession) => void;
}) {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const qc = useQueryClient();
  const [connectionId, setConnectionId] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [category, setCategory] = useState('');
  const [categoryUrl, setCategoryUrl] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const token = useRef('');
  const connections = useQuery({
    queryKey: ['sales', 'woocommerce'],
    queryFn: () => apiClient<Connection[]>('/sales/woocommerce'),
  });
  const categories = useQuery({
    queryKey: ['sales', 'woocommerce', connectionId, 'categories'],
    queryFn: () => apiClient<Category[]>(`/sales/woocommerce/${connectionId}/categories`),
    enabled: !!connectionId,
  });
  const catalog = useQuery({
    queryKey: ['sales', 'woocommerce', connectionId, 'catalog', category, page],
    queryFn: () =>
      apiClient<{ items: Item[]; hasNext: boolean; total: number | null; currency: string }>(
        `/sales/woocommerce/${connectionId}/products?page=${page}${category ? `&categoryId=${category}` : ''}`,
      ),
    enabled: !!connectionId,
  });
  const fail = (e: unknown) =>
    setError(formatMutationError(e, 'Không hoàn tất thao tác WooCommerce.'));
  const connect = useMutation({
    mutationFn: () =>
      apiClient<Connection>('/sales/woocommerce', {
        method: 'POST',
        body: JSON.stringify({
          websiteUrl: websiteUrl.trim(),
          consumerKey: consumerKey.trim(),
          consumerSecret: consumerSecret.trim(),
        }),
      }),
    onSuccess: async (item) => {
      const submitted = websiteUrl.trim();
      const corrected =
        new URL(submitted).pathname.replace(/\/+$/, '') !==
        new URL(item.websiteUrl).pathname.replace(/\/+$/, '');
      setWebsiteUrl(item.websiteUrl);
      setCategoryUrl(corrected ? submitted : '');
      setNotice(
        corrected
          ? `Đã nhận diện website gốc: ${item.websiteUrl}. Link vừa dán được giữ trong ô link danh mục; bấm “Tìm danh mục” để chọn.`
          : 'Kết nối WooCommerce thành công. Chọn danh mục và sản phẩm bên dưới.',
      );
      setConsumerKey('');
      setConsumerSecret('');
      setConnectionId(item.id);
      setCategory('');
      setPage(1);
      setSelected([]);
      token.current = '';
      await connections.refetch();
      await qc.invalidateQueries({ queryKey: ['sales', 'woocommerce', item.id] });
    },
    onError: fail,
  });
  const resolve = useMutation({
    mutationFn: () =>
      apiClient<Category>(`/sales/woocommerce/${connectionId}/category-url`, {
        method: 'POST',
        body: JSON.stringify({ url: categoryUrl.trim() }),
      }),
    onSuccess: (item) => {
      setCategory(String(item.id));
      setPage(1);
      setSelected([]);
      token.current = '';
    },
    onError: fail,
  });
  const draft = useMutation({
    mutationFn: () => {
      token.current ||= crypto.randomUUID();
      return apiClient<ProductImportSession>(`/sales/woocommerce/${connectionId}/import`, {
        method: 'POST',
        body: JSON.stringify({ clientToken: token.current, productIds: selected }),
      });
    },
    onSuccess: (session) => {
      if (mounted.current) onReady(session);
    },
    onError: fail,
  });
  const selectAll = useMutation({
    mutationFn: async () => {
      const ids: number[] = [];
      for (let current = 1; current <= 6; current++) {
        const data = await apiClient<{ items: Item[]; hasNext: boolean }>(
          `/sales/woocommerce/${connectionId}/products?page=${current}${category ? `&categoryId=${category}` : ''}`,
        );
        ids.push(
          ...data.items.filter((p) => ['simple', 'variable'].includes(p.type)).map((p) => p.id),
        );
        if (ids.length > 100)
          throw new Error(
            'Kết quả vượt 100 sản phẩm cha. Chọn danh mục nhỏ hơn hoặc chọn từng trang.',
          );
        if (!data.hasNext) return [...new Set(ids)];
      }
      throw new Error('Phạm vi quá lớn. Chọn danh mục nhỏ hơn hoặc từng trang.');
    },
    onSuccess: (ids) => {
      setSelected(ids);
      token.current = '';
    },
    onError: fail,
  });
  const busy = connect.isPending || resolve.isPending || draft.isPending || selectAll.isPending;
  const changeSelection = (next: number[]) => {
    if (next.length > 100) {
      setError('Tối đa 100 sản phẩm cha mỗi phiên. Biến thể được lấy tự động, tối đa 2.000 dòng.');
      return;
    }
    setSelected(next);
    token.current = '';
    setError('');
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Kết nối bằng khóa API có quyền Read. Chỉ đọc website; không sửa sản phẩm hoặc tồn kho trên
        WooCommerce. Tồn website không cộng vào kho AiBeeGo. Hiện hỗ trợ VND.
      </p>
      <fieldset className="space-y-3 rounded-lg border p-4" disabled={busy}>
        <legend className="px-2 text-sm font-medium">
          Kết nối website mới / thay khóa website đã có
        </legend>
        <Label htmlFor="woo-url">URL gốc website (HTTPS)</Label>
        <Input
          id="woo-url"
          placeholder="https://shop.example.com/"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          Dùng URL gốc, ví dụ https://shop.example.com/. Nếu dán link danh mục/sản phẩm WordPress,
          hệ thống sẽ thử nhận diện website gốc.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="woo-key">Consumer Key</Label>
            <Input
              id="woo-key"
              type="password"
              autoComplete="new-password"
              value={consumerKey}
              onChange={(e) => setConsumerKey(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="woo-secret">Consumer Secret</Label>
            <Input
              id="woo-secret"
              type="password"
              autoComplete="new-password"
              value={consumerSecret}
              onChange={(e) => setConsumerSecret(e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Tạo khóa tại WooCommerce → Settings → Advanced → REST API. Chọn Read. Khóa được mã hóa
          trên server.
        </p>
        <Button
          type="button"
          disabled={busy || !websiteUrl || !consumerKey || !consumerSecret}
          onClick={() => {
            setError('');
            setNotice('');
            connect.mutate();
          }}
        >
          {connect.isPending ? 'Đang kiểm tra…' : 'Kiểm tra và lưu kết nối'}
        </Button>
      </fieldset>
      {notice ? (
        <p role="status" className="text-sm text-emerald-300">
          {notice}
        </p>
      ) : null}
      {connections.isError ? (
        <p role="alert">
          Không tải được kết nối.{' '}
          <button className="underline" onClick={() => void connections.refetch()}>
            Thử lại
          </button>
        </p>
      ) : null}
      <Label htmlFor="woo-connection">Website đã kết nối</Label>
      <select
        id="woo-connection"
        className={selectClass}
        disabled={busy}
        value={connectionId}
        onChange={(e) => {
          setConnectionId(e.target.value);
          setCategory('');
          setPage(1);
          changeSelection([]);
        }}
      >
        <option value="">Chọn website</option>
        {connections.data?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.websiteUrl} ({c.currency})
          </option>
        ))}
      </select>
      {connectionId ? (
        <>
          <Label htmlFor="woo-category">Danh mục</Label>
          <select
            id="woo-category"
            className={selectClass}
            disabled={busy || categories.isPending}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
              changeSelection([]);
            }}
          >
            <option value="">Tất cả danh mục</option>
            {categories.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.count})
              </option>
            ))}
          </select>
          {categories.isError ? (
            <p role="alert">
              Không đọc được danh mục.{' '}
              <button className="underline" onClick={() => void categories.refetch()}>
                Thử lại
              </button>
            </p>
          ) : null}
          <Label htmlFor="woo-category-url">Hoặc dán link danh mục của website này</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="woo-category-url"
              className="min-w-0 flex-1"
              value={categoryUrl}
              disabled={busy}
              onChange={(e) => setCategoryUrl(e.target.value)}
              placeholder="https://shop.example.com/product-category/…"
            />
            <Button
              type="button"
              variant="outline"
              disabled={busy || !categoryUrl}
              onClick={() => {
                setError('');
                resolve.mutate();
              }}
            >
              Tìm danh mục
            </Button>
          </div>
          {catalog.isPending ? <p>Đang đọc sản phẩm…</p> : null}
          {catalog.isError ? (
            <p role="alert" className="text-destructive">
              {formatMutationError(catalog.error, 'Không đọc được sản phẩm.')}{' '}
              <button className="underline" onClick={() => void catalog.refetch()}>
                Thử lại
              </button>
            </p>
          ) : null}
          {catalog.data ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>
                  Đã chọn {selected.length} sản phẩm cha
                  {catalog.data.total !== null ? ` / ${catalog.data.total} kết quả` : ''}.
                </span>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    changeSelection([
                      ...new Set([
                        ...selected,
                        ...catalog
                          .data!.items.filter((p) => ['simple', 'variable'].includes(p.type))
                          .map((p) => p.id),
                      ]),
                    ])
                  }
                >
                  Chọn trang này
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setError('');
                    selectAll.mutate();
                  }}
                >
                  Chọn tất cả kết quả (tối đa 100)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => changeSelection([])}
                >
                  Bỏ chọn tất cả
                </Button>
              </div>
              <div className="overflow-x-auto rounded border">
                <table className="w-full min-w-[650px] text-left text-sm">
                  <thead>
                    <tr>
                      <th className="p-2">Chọn</th>
                      <th className="p-2">Sản phẩm / SKU</th>
                      <th className="p-2">Giá website</th>
                      <th className="p-2">Tồn website</th>
                      <th className="p-2">Loại</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalog.data.items.map((p) => (
                      <tr className="border-t" key={p.id}>
                        <td className="p-2">
                          <input
                            type="checkbox"
                            aria-label={`Chọn ${p.name}`}
                            disabled={busy || !['simple', 'variable'].includes(p.type)}
                            checked={selected.includes(p.id)}
                            onChange={(e) =>
                              changeSelection(
                                e.target.checked
                                  ? [...selected, p.id]
                                  : selected.filter((id) => id !== p.id),
                              )
                            }
                          />
                        </td>
                        <td className="p-2">
                          {p.name}
                          <p className="text-xs text-muted-foreground">
                            {p.sku || 'Chưa có SKU'} · {p.status}
                          </p>
                        </td>
                        <td className="p-2">{p.price || 'Chưa có'} VND</td>
                        <td className="p-2">
                          {p.stockQuantity ?? 'Chưa có số lượng'}
                          <p className="text-xs">{p.stockStatus}</p>
                        </td>
                        <td className="p-2">
                          {p.type === 'variable' ? 'Có biến thể (sẽ đọc toàn bộ)' : p.type}
                        </td>
                      </tr>
                    ))}
                    {!catalog.data.items.length ? (
                      <tr>
                        <td colSpan={5} className="p-3">
                          Không có sản phẩm trong phạm vi này.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || catalog.isFetching || page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Trang trước
                </Button>
                <span>Trang {page}</span>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || catalog.isFetching || !catalog.data.hasNext}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Trang sau
                </Button>
              </div>
            </>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Giữ lựa chọn khi chuyển trang. Tối đa 100 sản phẩm cha / 2.000 sản phẩm và biến thể mỗi
            phiên. Với shop lớn, nhập nhiều phiên theo danh mục. Chưa ghi sản phẩm khi chưa xác nhận
            ở bước xem trước.
          </p>
          <Button
            type="button"
            disabled={busy || !selected.length}
            onClick={() => {
              setError('');
              draft.mutate();
            }}
          >
            {draft.isPending ? 'Đang đọc chi tiết và biến thể…' : 'Đọc chi tiết → Xem trước nhập'}
          </Button>
        </>
      ) : null}
      {error ? (
        <p role="alert" className="whitespace-pre-wrap text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
