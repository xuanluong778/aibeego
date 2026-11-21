'use client';
import { Eye, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import type { SalesProduct } from '@/types/sales';
import { ProductImage } from './product-image';

export function ProductCatalogTable({
  products,
  onView,
  onEdit,
}: {
  products: SalesProduct[];
  onView: (id: string) => void;
  onEdit?: (product: SalesProduct) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02]">
      <table className="w-full min-w-[1050px] table-fixed text-left text-sm">
        <thead className="bg-white/[0.05] text-xs font-medium text-muted-foreground">
          <tr>
            <th className="w-[31%] px-4 py-4">Sản phẩm</th>
            <th className="w-[12%] px-3 py-4">Danh mục</th>
            <th className="w-[10%] px-3 py-4 text-right">Giá vốn</th>
            <th className="w-[10%] px-3 py-4 text-right">Giá bán</th>
            <th className="w-[11%] px-3 py-4 text-right">Tồn nội bộ</th>
            <th className="w-[13%] px-3 py-4">Website</th>
            <th className="w-[13%] px-3 py-4 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {products.map((product) => {
            const source = product.websiteSources?.[0];
            return (
              <tr key={product.id} className="transition-colors hover:bg-white/[0.035]">
                <td className="px-4 py-4">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="shrink-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-400"
                      aria-label={`Xem ảnh và chi tiết ${product.name}`}
                      onClick={() => onView(product.id)}
                    >
                      <ProductImage
                        src={product.imageUrl}
                        name={product.name}
                        className="h-[72px] w-[72px]"
                      />
                    </button>
                    <div className="min-w-0">
                      <button
                        type="button"
                        className="line-clamp-2 text-left font-medium leading-6 text-white hover:text-orange-300"
                        onClick={() => onView(product.id)}
                      >
                        {product.name}
                      </button>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        Model: {product.model || 'Chưa khai báo'}
                      </p>
                      <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                        SKU: {product.sku || 'Chưa khai báo'}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-4 text-xs leading-5 text-muted-foreground">
                  {product.category?.name || 'Chưa phân loại'}
                </td>
                <td className="px-3 py-4 text-right tabular-nums">
                  {formatCurrency(product.costPrice)}
                </td>
                <td className="px-3 py-4 text-right font-medium tabular-nums">
                  {product.price === 0 && product.websitePriceMissing ? (
                    <span className="text-xs font-normal text-muted-foreground">Chưa có giá</span>
                  ) : (
                    formatCurrency(product.price)
                  )}
                </td>
                <td className="px-3 py-4 text-right">
                  <p className="font-semibold tabular-nums">
                    {product.sellableQty ?? product.stockQty}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      {product.unit || 'cái'}
                    </span>
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {(product.sellableQty ?? product.stockQty) <= 0
                      ? 'Chưa có tồn nội bộ'
                      : product.isLowStock
                        ? 'Dưới mức tối thiểu'
                        : 'Có thể xuất kho'}
                  </p>
                  {(product.expiredQty || 0) > 0 ? (
                    <p className="mt-1 text-[11px] text-amber-300">{product.expiredQty} hết hạn</p>
                  ) : null}
                </td>
                <td className="px-3 py-4 text-xs leading-5 text-muted-foreground">
                  {source ? (
                    <>
                      <span className="rounded-md border border-teal-500/30 bg-teal-500/10 px-2 py-1 text-teal-200">
                        WooCommerce
                      </span>
                      <p className="mt-2">
                        {source.snapshot.stockQuantity ??
                          (source.snapshot.stockStatus === 'instock'
                            ? 'Còn hàng · chưa có số lượng'
                            : source.snapshot.stockStatus === 'outofstock'
                              ? 'Website báo hết hàng'
                              : 'Không theo dõi số lượng')}
                      </p>
                      {source.snapshot.stockScope === 'parent' ? (
                        <p className="text-[11px]">Chung sản phẩm cha</p>
                      ) : null}
                    </>
                  ) : (
                    'Sản phẩm nội bộ'
                  )}
                </td>
                <td className="px-3 py-4">
                  <div className="flex flex-col items-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      aria-label={`Xem chi tiết ${product.name}`}
                      onClick={() => onView(product.id)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Xem chi tiết
                    </Button>
                    {onEdit ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-xs text-muted-foreground"
                        onClick={() => onEdit(product)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Sửa
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
