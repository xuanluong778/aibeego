'use client';
import { useEffect, useState } from 'react';

const DISMISS_KEY = 'lp-builder-version-dismissed';

export function LandingPageBuilderVersionNotice({ onUpdate }: { onUpdate: () => Promise<void> }) {
  const [available, setAvailable] = useState(false),
    [serverBuildId, setServerBuildId] = useState(''),
    [updating, setUpdating] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    const current = process.env.NEXT_PUBLIC_LP_BUILDER_VERSION;
    if (!current) return;
    let disposed = false;
    const check = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const response = await fetch('/landing-page-builder-version.json', { cache: 'no-store' });
        if (!response.ok) return;
        const data = await response.json();
        if (disposed || typeof data.buildId !== 'string' || !data.buildId) return;
        if (data.buildId === current) {
          setAvailable(false);
          return;
        }
        try {
          if (sessionStorage.getItem(DISMISS_KEY) === data.buildId) {
            setAvailable(false);
            return;
          }
        } catch {
          /* private mode */
        }
        setServerBuildId(data.buildId);
        setAvailable(true);
      } catch {
        /* Offline is handled by autosave; keep the current editor usable. */
      }
    };
    void check();
    const timer = window.setInterval(check, 60000);
    window.addEventListener('focus', check);
    return () => {
      disposed = true;
      clearInterval(timer);
      window.removeEventListener('focus', check);
    };
  }, []);
  if (!available) return null;
  return (
    <div
      data-lp-builder-version-notice
      role="status"
      className="fixed right-4 top-4 z-[220] max-w-[min(92vw,28rem)] rounded-xl border border-sky-200 bg-white p-4 text-sm text-slate-900 shadow-xl"
    >
      <p className="font-semibold">Builder có bản giao diện mới</p>
      <p className="mt-1 text-xs text-slate-600">
        Cập nhật để dùng thư viện và công cụ mới. Chỉnh sửa đang làm sẽ được lưu hoặc giữ trên máy
        trước khi tải lại.
      </p>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={updating}
          className="rounded bg-sky-700 px-3 py-2 font-semibold text-white disabled:opacity-60"
          onClick={async () => {
            setUpdating(true);
            setError('');
            try {
              await onUpdate();
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Chưa cập nhật được giao diện');
            } finally {
              setUpdating(false);
            }
          }}
        >
          {updating ? 'Đang giữ chỉnh sửa…' : 'Cập nhật giao diện'}
        </button>
        <button
          type="button"
          disabled={updating}
          className="rounded border border-slate-300 px-3 py-2 font-semibold text-slate-700 disabled:opacity-60"
          onClick={() => {
            try {
              if (serverBuildId) sessionStorage.setItem(DISMISS_KEY, serverBuildId);
            } catch {
              /* private mode */
            }
            setAvailable(false);
          }}
        >
          Để sau
        </button>
      </div>
    </div>
  );
}
