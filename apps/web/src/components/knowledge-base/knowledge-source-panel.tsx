'use client';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';

type Source = {
  id: string;
  kind: 'WEBSITE' | 'FACEBOOK';
  url: string | null;
  sourceKey: string;
  facebookPageId: string | null;
  enabled: boolean;
  status: string;
  processed: number;
  succeeded: number;
  failed: number;
  lastError: string | null;
  errors: string[];
  lastSyncedAt: string | null;
  lastAttemptAt: string | null;
};
type Page = { id: string; pageId: string; pageName: string; connection: { status: string } };
const labels: Record<string, string> = {
  idle: 'Chưa đồng bộ',
  queued: 'Đang chờ xử lý nền',
  running: 'Đang thu thập',
  ready: 'Đã đồng bộ',
  partial: 'Thành công một phần',
  error: 'Có lỗi',
  paused: 'Đã tắt',
};
const date = (value: string | null) =>
  value ? new Date(value).toLocaleString('vi-VN') : 'Chưa có';
export function KnowledgeSourcePanel({ kbId }: { kbId: string }) {
  const qc = useQueryClient(),
    wasBusy = useRef(false);
  const [kind, setKind] = useState<'WEBSITE' | 'FACEBOOK'>('WEBSITE');
  const [url, setUrl] = useState(''),
    [pageId, setPageId] = useState(''),
    [error, setError] = useState('');
  const sources = useQuery({
    queryKey: ['rag-sources', kbId],
    queryFn: () => apiClient<Source[]>(`/rag-kb/${kbId}/sources`),
    refetchInterval: (query) =>
      query.state.data?.some((s) => ['queued', 'running'].includes(s.status)) ? 2000 : 15_000,
  });
  const pages = useQuery({
    queryKey: ['rag-source-facebook-pages'],
    queryFn: () => apiClient<Page[]>('/rag-kb/facebook-pages'),
    enabled: kind === 'FACEBOOK',
  });
  const busy = sources.data?.some((s) => ['queued', 'running'].includes(s.status)) || false;
  useEffect(() => {
    if (wasBusy.current && !busy) void qc.invalidateQueries({ queryKey: ['rag-kb'] });
    wasBusy.current = busy;
  }, [busy, qc]);
  const action = useMutation({
    mutationFn: ({
      method,
      path,
      body,
    }: {
      method: 'POST' | 'PATCH' | 'DELETE';
      path: string;
      body?: unknown;
    }) =>
      apiClient(`/rag-kb/${kbId}/sources${path}`, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    onSuccess: () => {
      setError('');
      void qc.invalidateQueries({ queryKey: ['rag-sources', kbId] });
      void qc.invalidateQueries({ queryKey: ['rag-kb'] });
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'Không thực hiện được thao tác.'),
  });
  return (
    <section
      className="space-y-3 rounded-xl border bg-muted/10 p-3"
      aria-label="Nguồn Website và Fanpage"
    >
      <h4 className="font-semibold">Website và Facebook Fanpage</h4>
      <p className="text-xs text-muted-foreground">
        Tự thu thập nội dung vào kho, không cần tạo hay tải file. Chỉnh sửa thủ công trong tài liệu
        sẽ được giữ lại khi đồng bộ.
      </p>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          action.mutate({
            method: 'POST',
            path: '',
            body: kind === 'WEBSITE' ? { kind, url: url.trim() } : { kind, facebookPageId: pageId },
          });
        }}
      >
        <select
          aria-label="Loại nguồn"
          className="h-10 rounded border bg-background px-2 text-sm"
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
        >
          <option value="WEBSITE">Website</option>
          <option value="FACEBOOK">Facebook Fanpage</option>
        </select>
        {kind === 'WEBSITE' ? (
          <Input
            className="min-w-48 flex-1"
            type="url"
            aria-label="URL website"
            placeholder="https://website-cua-ban.vn"
            value={url}
            maxLength={1800}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
        ) : (
          <select
            aria-label="Fanpage đã kết nối"
            className="h-10 min-w-48 flex-1 rounded border bg-background px-2 text-sm"
            value={pageId}
            onChange={(e) => setPageId(e.target.value)}
            required
          >
            <option value="">
              {pages.isPending ? 'Đang tải Fanpage…' : 'Chọn Fanpage của tổ chức'}
            </option>
            {pages.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.pageName} · {p.pageId} · {p.connection.status}
              </option>
            ))}
          </select>
        )}
        <Button
          type="submit"
          size="sm"
          disabled={action.isPending || (kind === 'WEBSITE' ? !url.trim() : !pageId)}
        >
          Thêm nguồn
        </Button>
      </form>
      {kind === 'FACEBOOK' ? (
        <p className="text-xs text-muted-foreground">
          Chỉ đọc thông tin Page và bài đăng được cấp quyền; không đọc inbox/bình luận.{' '}
          <Link href="/settings?tab=connections" className="underline">
            Quản lý kết nối Facebook
          </Link>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Tối đa 25 trang/lần, cùng tên miền, sâu 2 cấp; ưu tiên giới thiệu, sản phẩm/dịch vụ, liên
          hệ, FAQ và chính sách.
        </p>
      )}
      {error || (pages.isError && kind === 'FACEBOOK') ? (
        <p role="alert" className="text-sm text-destructive">
          {error || 'Không tải được Fanpage. Hãy kiểm tra kết nối và thử lại.'}
        </p>
      ) : null}
      {sources.isPending ? (
        <p role="status" className="text-sm">
          Đang tải nguồn…
        </p>
      ) : sources.isError ? (
        <p role="alert">
          Không tải được nguồn.{' '}
          <button className="underline" onClick={() => void sources.refetch()}>
            Thử lại
          </button>
        </p>
      ) : null}
      {sources.data?.map((source) => (
        <article key={source.id} className="space-y-2 rounded-lg border p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="min-w-0 break-all text-sm font-medium">
              {source.url ||
                pages.data?.find((p) => p.id === source.facebookPageId)?.pageName ||
                source.sourceKey}
            </p>
            <span role="status" className="text-xs">
              {labels[source.status] || source.status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Đã xử lý: {source.processed} · Thành công: {source.succeeded} · Lỗi: {source.failed}
          </p>
          {['queued', 'running'].includes(source.status) ? (
            <div
              role="progressbar"
              aria-label="Tiến trình thu thập"
              aria-valuetext={`${source.processed} nội dung đã xử lý`}
              className="h-1 animate-pulse rounded bg-emerald-500/50"
            />
          ) : null}
          <p className="text-xs text-muted-foreground">
            Lần chạy: {date(source.lastAttemptAt)} · Cập nhật thành công:{' '}
            {date(source.lastSyncedAt)}
          </p>
          {source.lastError ? (
            <p role="alert" className="text-xs text-amber-500">
              {source.lastError}
            </p>
          ) : null}
          {source.errors?.length > 1 ? (
            <details className="text-xs">
              <summary className="cursor-pointer">Chi tiết lỗi</summary>
              <ul className="list-inside list-disc">
                {source.errors.map((message, i) => (
                  <li key={i}>{message}</li>
                ))}
              </ul>
            </details>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={
                action.isPending || !source.enabled || ['queued', 'running'].includes(source.status)
              }
              onClick={() => action.mutate({ method: 'POST', path: `/${source.id}/sync` })}
            >
              Đồng bộ lại
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={action.isPending}
              onClick={() =>
                action.mutate({
                  method: 'PATCH',
                  path: `/${source.id}`,
                  body: { enabled: !source.enabled },
                })
              }
            >
              {source.enabled ? 'Tắt nguồn' : 'Bật nguồn'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={action.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    'Gỡ nguồn và nội dung tự thu thập? Các tài liệu đã chỉnh sửa thủ công sẽ được giữ lại.',
                  )
                )
                  action.mutate({ method: 'DELETE', path: `/${source.id}` });
              }}
            >
              Gỡ nguồn
            </Button>
          </div>
        </article>
      ))}
    </section>
  );
}
