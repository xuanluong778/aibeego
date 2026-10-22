'use client';

import type { ReactNode, WheelEvent as ReactWheelEvent } from 'react';
import {
  ArrowLeft,
  Monitor,
  Redo2,
  Save,
  Smartphone,
  Tablet,
  Undo2,
  Upload,
} from 'lucide-react';

export type LandingPageBuilderViewport = 'desktop' | 'tablet' | 'mobile';

type Props = {
  viewport: LandingPageBuilderViewport;
  previewOn: boolean;
  saving?: boolean;
  /** Preview shell: hide Back; only preview/device/history/save/publish. */
  hideBack?: boolean;
  /**
   * Edit mode: center controls in the canvas column (exclude docked inspector),
   * so the cluster lines up with the device frame. Preview keeps viewport center.
   */
  alignToCanvas?: boolean;
  /** Docked inspector is in the right grid column (lg+). */
  inspectorDocked?: boolean;
  onBack: () => void;
  onPreviewChange: (on: boolean) => void;
  onViewportChange: (v: LandingPageBuilderViewport) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onPublish: () => void;
};

function Tip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-[calc(100%+6px)] z-[70] -translate-x-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}

function IconBtn({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tip label={label}>
      <button
        type="button"
        title={label}
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={
          'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-white/90 transition ' +
          'hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40 ' +
          (active ? 'bg-white/15 text-white ring-1 ring-emerald-300/50' : '')
        }
      >
        {children}
      </button>
    </Tip>
  );
}

/**
 * Fixed builder chrome row — sits under the app header, above the canvas.
 * No floating white panels; compact icon controls + orange Publish.
 */
export function LandingPageBuilderToolbar({
  viewport,
  previewOn,
  saving,
  hideBack = false,
  alignToCanvas = false,
  inspectorDocked = false,
  onBack,
  onPreviewChange,
  onViewportChange,
  onUndo,
  onRedo,
  onSave,
  onPublish,
}: Props) {
  const centerInCanvas = alignToCanvas && !hideBack && !previewOn && inspectorDocked;

  const blockToolbarWheel = (e: ReactWheelEvent) => {
    // Never let wheel over the toolbar scroll the page/canvas (buttons slide under header).
    e.stopPropagation();
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.preventDefault();
  };

  return (
    <div
      data-lp-compact-toolbar="1"
      data-lp-toolbar-fixed="1"
      data-lp-toolbar-centered="1"
      data-lp-toolbar-no-scroll="1"
      data-lp-toolbar-align={centerInCanvas ? 'canvas' : 'viewport'}
      data-lp-toolbar-preview-chrome={hideBack || previewOn ? '1' : '0'}
      onWheel={blockToolbarWheel}
      onWheelCapture={blockToolbarWheel}
      className={
        // sticky + shrink-0: even if an ancestor leaks scroll, toolbar stays under header chrome
        'sticky top-0 z-40 flex h-11 w-full min-w-0 shrink-0 items-center justify-center overflow-y-hidden overscroll-y-none border-b border-white/10 bg-[#0A3D30] px-1.5 sm:px-2 ' +
        // Match builder grid: canvas | gap-2 | inspector 240px → shift center to canvas mid
        (centerInCanvas ? 'lg:pr-[calc(240px+0.5rem)]' : '')
      }
      role="toolbar"
      aria-label="Landing page builder toolbar"
    >
      <div
        className="flex min-w-0 max-w-full items-center justify-center gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-1"
        data-lp-toolbar-center
      >
        {!hideBack ? (
          <div className="flex shrink-0 items-center" data-lp-toolbar-back>
            <IconBtn label="Quay lại" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            </IconBtn>
          </div>
        ) : null}

        <div
          className="flex h-9 shrink-0 items-center gap-1.5 px-1 sm:gap-2 sm:px-1.5"
          data-lp-preview-toggle
          data-lp-preview-on={previewOn ? '1' : '0'}
        >
          <span className="hidden whitespace-nowrap text-[13px] font-medium text-white/90 sm:inline">
            Xem trước
          </span>
          <button
            type="button"
            role="switch"
            dir="ltr"
            aria-checked={previewOn}
            aria-label="Xem trước"
            title={previewOn ? 'Xem trước: Bật' : 'Xem trước: Tắt'}
            data-lp-preview-switch
            data-state={previewOn ? 'on' : 'off'}
            onClick={() => onPreviewChange(!previewOn)}
            className={
              'relative h-[22px] w-[40px] shrink-0 rounded-full transition-colors ' +
              // OFF = neutral gray track; ON = active green track
              (previewOn ? 'bg-emerald-400' : 'bg-zinc-400/80')
            }
          >
            {/*
              Knob position (LTR, explicit left — not transform-only):
              OFF → left (2px); ON → right (20px).
            */}
            <span
              data-lp-preview-knob={previewOn ? 'right' : 'left'}
              aria-hidden
              className={
                'pointer-events-none absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-[left] duration-150 ease-out ' +
                (previewOn ? 'left-[20px]' : 'left-[2px]')
              }
            />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-0.5" data-lp-device-switcher>
          <IconBtn
            label="Desktop"
            active={viewport === 'desktop'}
            onClick={() => onViewportChange('desktop')}
          >
            <Monitor className="h-4 w-4" strokeWidth={1.75} />
          </IconBtn>
          <IconBtn
            label="Tablet"
            active={viewport === 'tablet'}
            onClick={() => onViewportChange('tablet')}
          >
            <Tablet className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </IconBtn>
          <IconBtn
            label="Mobile"
            active={viewport === 'mobile'}
            onClick={() => onViewportChange('mobile')}
          >
            <Smartphone className="h-3.5 w-3.5" strokeWidth={1.75} />
          </IconBtn>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <IconBtn label="Undo" onClick={onUndo}>
            <Undo2 className="h-4 w-4" strokeWidth={1.75} />
          </IconBtn>
          <IconBtn label="Redo" onClick={onRedo}>
            <Redo2 className="h-4 w-4" strokeWidth={1.75} />
          </IconBtn>
          <IconBtn label="Lưu" disabled={saving} onClick={onSave}>
            <Save className="h-4 w-4" strokeWidth={1.75} />
          </IconBtn>
        </div>
      </div>

      <div
        className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center sm:right-2"
        data-lp-toolbar-publish
      >
        <button
          type="button"
          onClick={onPublish}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] bg-[#F97316] px-2.5 text-[13px] font-semibold text-white transition hover:bg-[#ea6c0c] sm:px-3"
          data-lp-publish-btn
          title="Publish"
          aria-label="Publish"
        >
          <Upload className="h-3.5 w-3.5" strokeWidth={2} />
          <span className="hidden sm:inline">Publish</span>
        </button>
      </div>
    </div>
  );
}
