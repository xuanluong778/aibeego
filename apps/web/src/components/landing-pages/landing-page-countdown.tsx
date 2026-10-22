'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { LandingPageCountdownBlock } from '@marketingspa/shared';
import {
  useCanvasElementFreeDrag,
  type LandingPageCanvasElementKey,
  type LandingPageCanvasHandlers,
} from './landing-page-canvas-ux';
import {
  FreeTransformChrome,
  type FreeResizeHandle,
} from './landing-page-free-drag';

type Parts = { days: number; hours: number; minutes: number; seconds: number; expired: boolean };

function calcParts(endsAt: string, nowMs: number): Parts {
  const end = Date.parse(endsAt);
  if (Number.isNaN(end)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }
  const diff = Math.max(0, end - nowMs);
  const expired = diff <= 0;
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { days, hours, minutes, seconds, expired };
}

const TAP_MOVE_PX = 6;

function CountdownCellChrome({
  blockId,
  label,
  handlers,
  className,
  style,
  children,
}: {
  blockId: string;
  label: string;
  handlers: LandingPageCanvasHandlers;
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  const field = `countdownCell:${label}`;
  const element = `countdown:${label.toLowerCase()}` as LandingPageCanvasElementKey;
  const selected =
    handlers.selection?.blockId === blockId && handlers.selection.element === element;
  const {
    freeDrag,
    freeEnabled,
    bindShellRef,
    shellStyle,
    armDrag,
    consumePointerUpForDrag,
    showTransformChrome,
  } = useCanvasElementFreeDrag({
    blockId,
    field,
    handlers,
    selected: Boolean(selected),
  });
  const pointerRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  return (
    <div
      ref={bindShellRef}
      data-lp-element-id={`${blockId}::${element}`}
      data-lp-element-kind="box"
      data-lp-element-selected={selected ? '1' : '0'}
      data-lp-free-child="1"
      data-lp-free-id={`${blockId}::${field}`}
      data-lp-free-mode="offset"
      data-lp-bounding-box={selected ? '1' : '0'}
      style={{ ...shellStyle, ...style }}
      className={`${className || ''} ${
        selected && freeEnabled ? 'cursor-grab active:cursor-grabbing' : ''
      } outline-offset-2 ${
        selected
          ? 'z-[1] outline outline-2 outline-[#F97316]/85 data-[lp-free-dragging=1]:outline-dashed data-[lp-free-dragging=1]:outline-blue-700'
          : '[@media(hover:hover)]:hover:outline [@media(hover:hover)]:hover:outline-1 [@media(hover:hover)]:hover:outline-dashed [@media(hover:hover)]:hover:outline-[#F97316]/40'
      }`}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement | null)?.closest?.('[data-lp-resize-handle],[data-lp-rotate-handle]')) {
          return;
        }
        if (e.button !== 0) return;
        pointerRef.current = { x: e.clientX, y: e.clientY, moved: false };
        armDrag(e);
      }}
      onPointerMove={(e) => {
        const p = pointerRef.current;
        if (!p) return;
        if (Math.abs(e.clientX - p.x) > TAP_MOVE_PX || Math.abs(e.clientY - p.y) > TAP_MOVE_PX) {
          p.moved = true;
        }
      }}
      onPointerUp={(e) => {
        if (consumePointerUpForDrag()) return;
        const p = pointerRef.current;
        pointerRef.current = null;
        if (!p || p.moved) return;
        e.preventDefault();
        e.stopPropagation();
        handlers.onSelect({ blockId, element }, { shiftKey: e.shiftKey });
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {showTransformChrome ? (
        <FreeTransformChrome
          visible={showTransformChrome}
          hideHandles={freeDrag.dragging}
          liveAngle={freeDrag.liveAngle}
          onResizePointerDown={(handle: FreeResizeHandle, e) => {
            handlers.onSelect({ blockId, element });
            freeDrag.beginResize(handle, e);
          }}
          onRotatePointerDown={(e) => {
            handlers.onSelect({ blockId, element });
            freeDrag.beginRotate(e);
          }}
        />
      ) : null}
      {children}
    </div>
  );
}

function wrapCell(
  blockId: string,
  canvas: LandingPageCanvasHandlers | null | undefined,
  label: string,
  className: string,
  style: React.CSSProperties | undefined,
  children: ReactNode,
) {
  if (!canvas) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  return (
    <CountdownCellChrome blockId={blockId} label={label} handlers={canvas} className={className} style={style}>
      {children}
    </CountdownCellChrome>
  );
}

/**
 * Isolated countdown ticker — interval state lives here so parent LP does not re-render.
 */
export function LandingPageCountdownLive({
  block,
  primary,
  blockId,
  canvas,
}: {
  block: LandingPageCountdownBlock;
  primary: string;
  blockId?: string;
  canvas?: LandingPageCanvasHandlers | null;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const parts = calcParts(block.endsAt, nowMs);
  const style = block.styleVariant || 'boxes';
  const cellBlockId = blockId || block.id;

  if (parts.expired) {
    const behavior = block.expireBehavior || 'zero';
    if (behavior === 'hide') return null;
    if (behavior === 'message') {
      return (
        <div className="text-center text-base font-semibold" style={{ color: 'var(--lp-secondary)' }}>
          {block.expireMessage || 'Đã kết thúc'}
        </div>
      );
    }
    if (behavior === 'cta') {
      return (
        <div className="flex justify-center">
          <a
            href={block.expireCtaUrl || '#lead-form'}
            className="inline-flex min-h-[44px] items-center px-6 py-2.5 text-sm font-bold text-white"
            style={{ background: primary, borderRadius: 'var(--lp-radius)' }}
          >
            {block.expireCtaLabel || 'Đăng ký ngay'}
          </a>
        </div>
      );
    }
    // zero — fall through with zeros
  }

  const cells: Array<{ label: string; value: number; show: boolean }> = [
    { label: 'Ngày', value: parts.days, show: block.showDays !== false },
    { label: 'Giờ', value: parts.hours, show: block.showHours !== false },
    { label: 'Phút', value: parts.minutes, show: block.showMinutes !== false },
    { label: 'Giây', value: parts.seconds, show: block.showSeconds !== false },
  ].filter((c) => c.show);

  if (style === 'inline') {
    return (
      <div
        className="flex flex-wrap items-center justify-center gap-2 text-center text-2xl font-extrabold tabular-nums sm:text-3xl"
        style={{ color: 'var(--lp-secondary)' }}
        aria-live="polite"
      >
        {cells.map((c, i) => (
          <span key={c.label} className="inline-flex items-center">
            {wrapCell(
              cellBlockId,
              canvas,
              c.label,
              'px-1',
              undefined,
              String(c.value).padStart(2, '0'),
            )}
            {i < cells.length - 1 ? <span className="mx-1 opacity-40">:</span> : null}
          </span>
        ))}
      </div>
    );
  }

  if (style === 'minimal') {
    return (
      <p className="text-center text-sm tabular-nums" style={{ color: 'var(--lp-muted)' }} aria-live="polite">
        {cells.map((c, i) => (
          <span key={c.label}>
            {wrapCell(
              cellBlockId,
              canvas,
              c.label,
              'inline-block px-0.5',
              undefined,
              <>
                {String(c.value).padStart(2, '0')} {c.label}
              </>,
            )}
            {i < cells.length - 1 ? ' · ' : null}
          </span>
        ))}
      </p>
    );
  }

  return (
    <div
      className="mx-auto grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3"
      aria-live="polite"
    >
      {cells.map((c) =>
        wrapCell(
          cellBlockId,
          canvas,
          c.label,
          'px-2 py-3 text-center sm:py-4',
          {
            background: 'var(--lp-surface)',
            borderRadius: 'var(--lp-radius)',
            boxShadow: 'var(--lp-shadow)',
            border: `1px solid ${primary}33`,
          },
          <>
            <div
              className="text-2xl font-extrabold tabular-nums sm:text-3xl"
              style={{ color: primary }}
            >
              {String(c.value).padStart(2, '0')}
            </div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide opacity-60">
              {c.label}
            </div>
          </>,
        ),
      )}
    </div>
  );
}
