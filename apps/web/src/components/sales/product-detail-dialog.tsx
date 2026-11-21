'use client';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ExternalLink, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSalesProduct } from '@/hooks/use-sales';
import { formatCurrency } from '@/lib/format';
import type { SalesProduct } from '@/types/sales';
import { ProductImage } from './product-image';

function Description({ content }: { content: string }) {
  return (
    <div className="space-y-4 text-[15px] leading-7 text-slate-700 [&_p]:my-3 [&_h1]:text-xl [&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-5 [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_strong]:font-semibold [&_strong]:text-slate-900 [&_a]:text-teal-700 [&_a]:underline [&_table]:w-full [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:p-2 break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          img: () => null,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
export function ProductDetailDialog({
  id,
  onClose,
  onEdit,
}: {
  id: string | null;
  onClose: () => void;
  onEdit?: (product: SalesProduct) => void;
}) {
  const query = useSalesProduct(id);
  const [active, setActive] = useState(0);
  useEffect(() => setActive(0), [id]);
  const product = query.data;
  const images = [...new Set(product?.sources.flatMap((source) => source.images) || [])];
  const source = product?.sources[0];
  const imageIndex = Math.min(active, Math.max(0, images.length - 1));
  return (
    <Dialog
      open={!!id}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-6xl gap-0 overflow-y-auto rounded-2xl border-slate-200 bg-white p-0 text-slate-900 sm:p-0">
        <DialogHeader className="border-b border-slate-100 px-6 py-5 pr-14 text-left">
          <DialogTitle className="text-xl font-semibold !text-slate-900">Chi tiết sản phẩm</DialogTitle>
          <DialogDescription className="text-slate-500">
            Hình ảnh, thông số và tồn kho của sản phẩm.
          </DialogDescription>
        </DialogHeader>
        {query.isPending ? (
          <p className="p-8 text-slate-500" role="status">
            Đang tải chi tiết sản phẩm…
          </p>
        ) : query.isError ? (
          <div className="p-8" role="alert">
            <p>Không tải được sản phẩm.</p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              Thử lại
            </Button>
          </div>
        ) : product ? (
          <>
            <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="min-w-0 space-y-4">
                <div className="relative rounded-2xl bg-slate-50 p-3">
                  <ProductImage
                    src={images[imageIndex]}
                    name={product.name}
                    className="aspect-square max-h-[460px] w-full border-0"
                  />
                  {images.length > 1 ? (
                    <div className="absolute inset-x-5 bottom-5 flex items-center justify-between">
                      <Button
                        aria-label="Ảnh trước"
                        size="icon"
                        className="rounded-full bg-white text-slate-800 shadow hover:bg-slate-100"
                        onClick={() => setActive((imageIndex - 1 + images.length) % images.length)}
                      >
                        <ChevronLeft />
                      </Button>
                      <span className="rounded-full bg-white/90 px-3 py-1 text-xs">
                        {imageIndex + 1}/{images.length}
                      </span>
                      <Button
                        aria-label="Ảnh sau"
                        size="icon"
                        className="rounded-full bg-white text-slate-800 shadow hover:bg-slate-100"
                        onClick={() => setActive((imageIndex + 1) % images.length)}
                      >
                        <ChevronRight />
                      </Button>
                    </div>
                  ) : null}
                </div>
                {images.length > 1 ? (
                  <div className="flex gap-2 overflow-x-auto pb-2" aria-label="Album ảnh sản phẩm">
                    {images.map((image, index) => (
                      <button
                        key={image}
                        type="button"
                        aria-label={`Xem ảnh ${index + 1}`}
                        aria-pressed={imageIndex === index}
                        className={`shrink-0 rounded-lg p-1 ${imageIndex === index ? 'ring-2 ring-teal-700' : 'ring-1 ring-slate-200'}`}
                        onClick={() => setActive(index)}
                      >
                        <ProductImage
                          src={image}
                          name={product.name}
                          className="h-16 w-16 rounded-md"
                        />
                      </button>
                    ))}
                  </div>
                ) : null}
                {source?.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Xem trang sản phẩm trên website
                  </a>
                ) : null}
              </div>
              <div className="min-w-0 space-y-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
                  {product.category?.name || 'Chưa phân loại'}
                </p>
                <h2 className="text-2xl font-semibold leading-snug tracking-tight !text-slate-900 sm:text-3xl">
                  {product.name}
                </h2>
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="rounded-md bg-slate-100 px-3 py-1.5">
                    Model: <strong>{product.model || source?.model || 'Chưa khai báo'}</strong>
                  </span>
                  <span className="rounded-md bg-slate-100 px-3 py-1.5">
                    SKU: <strong>{product.sku || 'Chưa khai báo'}</strong>
                  </span>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-medium uppercase text-slate-500">Giá bán nội bộ</p>
                  <p className="mt-1 text-3xl font-semibold text-teal-800">
                    {product.price === 0 && source && !source.regularPrice && !source.salePrice
                      ? 'Chưa có giá'
                      : formatCurrency(product.price)}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Giá vốn: {formatCurrency(product.costPrice)} · Đơn vị: {product.unit || 'cái'}
                  </p>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <dt className="text-slate-500">Tồn nội bộ bán được</dt>
                    <dd className="mt-1 text-2xl font-semibold">
                      {product.sellableQty ?? product.stockQty}
                    </dd>
                    <p className="mt-1 text-xs text-slate-500">
                      Thực tế: {product.physicalQty ?? product.stockQty} · Hết hạn:{' '}
                      {product.expiredQty ?? 0}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4">
                    <dt className="text-slate-500">Tồn website</dt>
                    <dd className="mt-2 font-semibold">
                      {source
                        ? (source.stockQuantity ?? 'Không theo dõi số lượng')
                        : 'Chưa kết nối website'}
                    </dd>
                    <p className="mt-1 text-xs text-slate-500">
                      {source?.stockScope === 'parent'
                        ? 'Dùng chung tồn của sản phẩm cha'
                        : 'Không cộng vào kho nội bộ'}
                    </p>
                  </div>
                </dl>
                {source?.shortDescription ? (
                  <Description content={source.shortDescription} />
                ) : null}
                {onEdit ? (
                  <Button
                    className="gap-2 bg-teal-800 text-white hover:bg-teal-900"
                    onClick={() => {
                      onClose();
                      onEdit(product);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                    Chỉnh sửa sản phẩm
                  </Button>
                ) : null}
              </div>
            </div>
            <Tabs
              defaultValue="description"
              className="border-t border-slate-100 px-5 py-6 sm:px-8"
            >
              <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-slate-100 text-slate-600">
                <TabsTrigger
                  value="description"
                  className="data-[state=active]:bg-white data-[state=active]:text-teal-800"
                >
                  Mô tả chi tiết
                </TabsTrigger>
                <TabsTrigger
                  value="specifications"
                  className="data-[state=active]:bg-white data-[state=active]:text-teal-800"
                >
                  Thông số
                </TabsTrigger>
                <TabsTrigger
                  value="source"
                  className="data-[state=active]:bg-white data-[state=active]:text-teal-800"
                >
                  Nguồn dữ liệu
                </TabsTrigger>
              </TabsList>
              <TabsContent value="description" className="mt-5 min-w-0 overflow-x-auto">
                {source?.description ? (
                  <Description content={source.description} />
                ) : (
                  <p className="text-slate-500">Chưa có mô tả từ website.</p>
                )}
                {product.note ? (
                  <div className="mt-5 rounded-lg bg-slate-50 p-4">
                    <h3 className="font-semibold">Ghi chú nội bộ</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{product.note}</p>
                  </div>
                ) : null}
              </TabsContent>
              <TabsContent value="specifications" className="mt-5">
                <dl className="divide-y divide-slate-100 text-sm">
                  {[
                    ['Model', product.model || source?.model],
                    ['SKU', product.sku],
                    ['Barcode', product.barcode],
                    ['Tồn tối thiểu', String(product.minStockQty)],
                    ...(source?.attributes || []).map((a) => [a.name, a.option]),
                  ].map(([label, value], index) => (
                    <div key={index} className="grid grid-cols-2 gap-4 py-3">
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="break-words font-medium">{value || 'Chưa khai báo'}</dd>
                    </div>
                  ))}
                </dl>
              </TabsContent>
              <TabsContent value="source" className="mt-5 space-y-3">
                {product.sources.length ? (
                  product.sources.map((s) => (
                    <div
                      key={`${s.websiteUrl}:${s.externalId}`}
                      className="rounded-lg border border-slate-200 p-4 text-sm leading-7"
                    >
                      <p className="font-medium">{s.websiteUrl}</p>
                      <p>
                        ID nguồn: {s.externalId} · Trạng thái website: {s.status}
                      </p>
                      <p>Cập nhật: {new Date(s.syncedAt).toLocaleString('vi-VN')}</p>
                      <p className="text-slate-500">
                        Giá và tồn nội bộ được quản lý riêng với website.
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500">Sản phẩm được tạo trực tiếp trong AiBeeGo.</p>
                )}
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
