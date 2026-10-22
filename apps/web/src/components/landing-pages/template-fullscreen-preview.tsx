'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { LandingPageSpec } from '@marketingspa/shared';
import { Button } from '@/components/ui/button';
import { LandingPageRenderer } from '@/components/landing-pages/landing-page-renderer';
import {
  TemplateViewportSwitcher,
  type TemplateViewport,
} from '@/components/landing-pages/template-viewport-switcher';

type Props = {
  open: boolean;
  title: string;
  subtitle?: string;
  spec: LandingPageSpec | null;
  loading: boolean;
  viewport: TemplateViewport;
  onViewportChange: (v: TemplateViewport) => void;
  onClose: () => void;
  onUseTemplate: () => void;
  using?: boolean;
};

/**
 * Full-viewport template preview — same shell as LP builder preview mode
 * (toolbar + scrollable canvas, hides app chrome via data-lp-preview-mode).
 */
export function TemplateFullscreenPreview({
  open,
  title,
  subtitle,
  spec,
  loading,
  viewport,
  onViewportChange,
  onClose,
  onUseTemplate,
  using = false,
}: Props) {
  useEffect(() => {
    if (!open) return;
    document.body.setAttribute('data-lp-preview-mode', '1');
    return () => {
      document.body.removeAttribute('data-lp-preview-mode');
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-white"
      data-lp-preview-shell="1"
      data-lp-fullscreen-preview-surface="1"
      data-lp-template-preview-shell="1"
      role="dialog"
      aria-modal="true"
      aria-label={`Xem trước ${title}`}
    >
      <div
        className="flex h-11 shrink-0 items-center gap-2 border-b border-white/10 bg-zinc-950 px-2 sm:px-3"
        data-lp-template-preview-toolbar="1"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">{title}</div>
          {subtitle ? (
            <div className="truncate text-[11px] text-white/55">{subtitle}</div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div
            className="hidden h-9 shrink-0 items-center gap-1.5 px-1 sm:flex"
            data-lp-preview-toggle
            data-lp-preview-on="1"
          >
            <span className="whitespace-nowrap text-[13px] font-medium text-white/90">Xem trước</span>
            <button
              type="button"
              role="switch"
              dir="ltr"
              aria-checked
              aria-label="Xem trước"
              title="Xem trước: Bật — bấm để đóng"
              data-lp-preview-switch
              data-state="on"
              onClick={onClose}
              className="relative h-[22px] w-[40px] shrink-0 rounded-full bg-emerald-400 transition-colors"
            >
              <span
                data-lp-preview-knob="right"
                aria-hidden
                className="pointer-events-none absolute left-[20px] top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-[left] duration-150 ease-out"
              />
            </button>
          </div>

          <TemplateViewportSwitcher viewport={viewport} onChange={onViewportChange} />

          <Button
            size="sm"
            disabled={using}
            className="h-9 shrink-0 bg-[#F97316] text-white hover:bg-[#ea6c0c]"
            onClick={onUseTemplate}
          >
            Sử dụng mẫu
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-9 shrink-0 text-white/85 hover:bg-white/10 hover:text-white sm:hidden"
            onClick={onClose}
          >
            Đóng
          </Button>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-white"
        data-lp-preview-canvas="1"
        data-lp-preview-full-canvas="1"
        data-lp-template-preview-renderer="1"
      >
        <div
          className={
            viewport === 'mobile'
              ? 'mx-auto min-h-full w-full max-w-[390px] bg-white shadow-sm'
              : viewport === 'tablet'
                ? 'mx-auto min-h-full w-full max-w-[768px] bg-white shadow-sm'
                : 'mx-auto min-h-full w-full max-w-full'
          }
        >
          {loading || !spec ? (
            <div className="flex min-h-[50vh] items-center justify-center text-sm text-neutral-500">
              Đang tải preview…
            </div>
          ) : (
            <LandingPageRenderer
              spec={spec}
              viewport={viewport}
              mode="preview"
              className="w-full"
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
