'use client';

/**
 * Editor-only vertical element toolbar (move / save / duplicate / delete).
 * Portaled to document.body — never rendered on public/preview pages.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  elementFromField,
  isItemImageField,
  isSectionLevelElement,
  itemIdFromItemImageField,
  itemImageField,
  lpSelectionKey,
  normalizeLpSelectionTarget,
  type LpSelectionTarget,
} from './landing-page-canvas-selection';
import type { LandingPageCanvasElementKey } from './landing-page-canvas-ux';
import { LP_BLOCK_MIME } from './landing-page-canvas-ux';
import { beginFreeDragByFreeId, beginFreeDragFromShell, cancelAllFreeDrags } from './landing-page-free-drag';

const TOOLBAR_W = 44;
const BTN_H = 44;
const GAP = 6;
const BAR_H = BTN_H * 4 + 3;
const DRAGGING_SEL =
  '[data-lp-free-dragging="1"],[data-lp-free-resizing="1"],[data-lp-free-rotating="1"]';

let cachedChromeTop = 0;
let cachedChromeTopAt = 0;

function readBuilderChromeTop(): number {
  if (typeof document === 'undefined') return 108;
  const canvas = document.querySelector('[data-lp-canvas-scroll]');
  if (canvas) return Math.ceil(canvas.getBoundingClientRect().top) + 8;
  const now = performance.now();
  if (cachedChromeTop > 0 && now - cachedChromeTopAt < 500) return cachedChromeTop;
  const root = document.querySelector('[data-lp-builder-root]') as HTMLElement | null;
  let px = Math.round(6.75 * 16);
  if (root) {
    const raw = getComputedStyle(root).getPropertyValue('--builder-top-offset').trim();
    if (raw.endsWith('rem')) {
      const rem = parseFloat(raw);
      if (Number.isFinite(rem)) px = Math.round(rem * 16);
    } else if (raw.endsWith('px')) {
      const n = parseFloat(raw);
      if (Number.isFinite(n)) px = Math.round(n);
    }
  }
  cachedChromeTop = px + 8;
  cachedChromeTopAt = now;
  return cachedChromeTop;
}

function isGestureActive(): boolean {
  return Boolean(document.querySelector(DRAGGING_SEL));
}

/** 4-way move / cross-arrows icon (not up/down only). */
function CrossMoveIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 .75 10.6 3.4H9.1v2.9h2.9V4.8L14.6 8l-2.6 2.6V9.1H9.1v2.9h1.5L8 15.25 5.4 12H6.9V9.1H4v1.5L1.4 8 4 5.4v1.5h2.9V4.8H5.4L8 .75z" />
    </svg>
  );
}

const IGNORE_HIT =
  '[data-lp-element-vertical-toolbar],[data-lp-inspector],[data-lp-inspector-rail],[data-lp-text-toolbar],[data-lp-text-color-panel],[data-lp-text-more-menu],[data-lp-canvas-context-menu],[data-lp-marquee-selection]';

export type LandingPageElementVerticalToolbarProps = {
  enabled: boolean;
  canvasRootRef: React.RefObject<HTMLElement | null>;
  primaryTarget: LpSelectionTarget | null;
  onSelect: (target: LpSelectionTarget) => void;
  onSave: (target: LpSelectionTarget) => void;
  onDuplicate: (target: LpSelectionTarget) => void;
  onDelete: (target: LpSelectionTarget) => void;
  sectionLocked?: (blockId: string) => boolean;
};

function resolveHit(from: HTMLElement | null): { anchor: HTMLElement; target: LpSelectionTarget } | null {
  if (!from?.closest) return null;
  if (from.closest(IGNORE_HIT)) return null;

  const blockHost = from.closest('[data-lp-block-id]') as HTMLElement | null;
  if (!blockHost) return null;
  const blockId = blockHost.getAttribute('data-lp-block-id');
  if (!blockId) return null;

  const inline = from.closest('[data-lp-inline-field]') as HTMLElement | null;
  if (inline) {
    const field = inline.getAttribute('data-lp-inline-field');
    if (!field) return null;
    const anchor =
      (inline.closest('[data-lp-inline-wrap]') as HTMLElement | null) ||
      (inline.closest('[data-lp-button-block]') as HTMLElement | null) ||
      inline;
    return {
      anchor,
      target: normalizeLpSelectionTarget({
        blockId,
        element: elementFromField(field),
        field,
      }),
    };
  }

  const eidHost = from.closest('[data-lp-element-id]') as HTMLElement | null;
  if (eidHost) {
    const raw = eidHost.getAttribute('data-lp-element-id') || '';
    const sep = raw.indexOf('::');
    if (sep > 0) {
      const bid = raw.slice(0, sep);
      const elKey = raw.slice(sep + 2) as LandingPageCanvasElementKey;
      if (bid === blockId) {
        const fieldAttr = eidHost.getAttribute('data-lp-element-field') || undefined;
        const kind = eidHost.getAttribute('data-lp-element-kind');
        let field = fieldAttr;
        if (
          !field &&
          kind === 'image' &&
          typeof elKey === 'string' &&
          elKey.startsWith('item:') &&
          !elKey.startsWith('item:trust-')
        ) {
          field = itemImageField(elKey.slice(5));
        }
        return {
          anchor: eidHost,
          target: normalizeLpSelectionTarget({ blockId, element: elKey, field }),
        };
      }
    }
  }

  if (from.closest('[data-lp-form-hit]')) {
    const anchor = (from.closest('[data-lp-form-hit]') ||
      from.closest('[data-lp-block-id]')) as HTMLElement;
    return { anchor, target: { blockId, element: 'form' } };
  }

  if (from.closest('[data-lp-button-block]')) {
    const anchor = from.closest('[data-lp-button-block]') as HTMLElement;
    return {
      anchor,
      target: normalizeLpSelectionTarget({ blockId, element: 'cta', field: 'ctaLabel' }),
    };
  }

  if (from.closest('[data-lp-box-block]')) {
    const anchor = from.closest('[data-lp-box-block]') as HTMLElement;
    return {
      anchor,
      target: normalizeLpSelectionTarget({ blockId, element: 'cta', field: 'ctaLabel' }),
    };
  }

  const img = from.closest('[data-lp-content-image]') as HTMLElement | null;
  if (img) {
    const itemHost = img.closest('[data-lp-item-id]') as HTMLElement | null;
    const itemId = itemHost?.getAttribute('data-lp-item-id');
    if (itemId) {
      return {
        anchor: img,
        target: normalizeLpSelectionTarget({
          blockId,
          element: `item:${itemId}`,
          field: itemImageField(itemId),
        }),
      };
    }
    return { anchor: img, target: { blockId, element: 'image' } };
  }

  const gridCell = from.closest('[data-lp-grid-cell]') as HTMLElement | null;
  if (gridCell) {
    const idx = gridCell.getAttribute('data-lp-grid-cell');
    return {
      anchor: gridCell,
      target: { blockId, element: `grid:${idx}` as LandingPageCanvasElementKey },
    };
  }

  if (
    from.closest('[data-lp-section-bg-hit]') ||
    from.closest('[data-lp-selection-target="section-background"]')
  ) {
    const shell =
      (blockHost.closest('[data-lp-section-chrome]') as HTMLElement | null) || blockHost;
    return { anchor: shell, target: { blockId, element: 'section-background' } };
  }

  const shell =
    (blockHost.closest('[data-lp-section-chrome]') as HTMLElement | null) ||
    (blockHost.hasAttribute('data-lp-section-chrome') ? blockHost : blockHost);
  return { anchor: shell, target: { blockId, element: 'section' } };
}

function targetsEqual(a: LpSelectionTarget | null, b: LpSelectionTarget | null): boolean {
  if (!a || !b) return false;
  return lpSelectionKey(a) === lpSelectionKey(b);
}

function findAnchorForTarget(target: LpSelectionTarget): HTMLElement | null {
  const { blockId, element, field } = target;
  const blockEl = document.querySelector(
    `[data-lp-block-id="${CSS.escape(blockId)}"]`,
  ) as HTMLElement | null;
  if (!blockEl) return null;

  // While a free-drag gesture is live, pin to the moving shell (not a stale
  // nested text node whose rect can thrash under parent transform + reflow).
  const dragging = document.querySelector(DRAGGING_SEL) as HTMLElement | null;
  if (dragging) {
    const dragFreeId = dragging.getAttribute('data-lp-free-id') || '';
    const belongs =
      dragFreeId === blockId ||
      dragFreeId.startsWith(`${blockId}::`) ||
      dragging.closest(`[data-lp-block-id="${CSS.escape(blockId)}"]`) === blockEl ||
      blockEl.contains(dragging);
    if (belongs) return dragging;
  }

  if (field) {
    if (isItemImageField(field)) {
      const itemId = itemIdFromItemImageField(field);
      if (itemId) {
        const byField = blockEl.querySelector(
          `[data-lp-element-field="${CSS.escape(field)}"]`,
        ) as HTMLElement | null;
        if (byField) return byField;
        const itemHost = blockEl.querySelector(
          `[data-lp-item-id="${CSS.escape(itemId)}"]`,
        ) as HTMLElement | null;
        const img = itemHost?.querySelector('[data-lp-content-image="1"]') as HTMLElement | null;
        if (img) return img;
      }
    }
    const inline = blockEl.querySelector(
      `[data-lp-inline-field="${CSS.escape(field)}"]`,
    ) as HTMLElement | null;
    if (inline) {
      return (
        (inline.closest('[data-lp-inline-wrap]') as HTMLElement | null) ||
        (inline.closest('[data-lp-button-block]') as HTMLElement | null) ||
        inline
      );
    }
  }

  if (element === 'image') {
    return blockEl.querySelector('[data-lp-content-image="1"]') as HTMLElement | null;
  }
  // Form / section: always anchor to the outer free shell so the vertical toolbar
  // sits beside the section outline — never on nested CTA/privacy text.
  if (element === 'form' || isSectionLevelElement(element)) {
    return (
      (document.querySelector(
        `[data-lp-free-id="${CSS.escape(blockId)}"]`,
      ) as HTMLElement | null) ||
      (blockEl.closest('[data-lp-section-chrome]') as HTMLElement | null) ||
      blockEl
    );
  }
  if (typeof element === 'string' && element.startsWith('grid:')) {
    const idx = element.slice(5);
    return blockEl.querySelector(`[data-lp-grid-cell="${idx}"]`) as HTMLElement | null;
  }
  if (typeof element === 'string' && element.startsWith('item:')) {
    const itemId = element.slice(5);
    return (
      (blockEl.querySelector(`[data-lp-item-id="${CSS.escape(itemId)}"]`) as HTMLElement | null) ||
      (blockEl.querySelector(`[data-lp-free-id="${CSS.escape(`${blockId}::${itemId}`)}"]`) as
        | HTMLElement
        | null)
    );
  }

  const eid = blockEl.querySelector(
    `[data-lp-element-id="${CSS.escape(`${blockId}::${element}`)}"]`,
  ) as HTMLElement | null;
  if (eid) return eid;

  return (blockEl.closest('[data-lp-section-chrome]') as HTMLElement | null) || blockEl;
}

export function LandingPageElementVerticalToolbar({
  enabled,
  canvasRootRef,
  primaryTarget,
  onSelect,
  onSave,
  onDuplicate,
  onDelete,
  sectionLocked,
}: LandingPageElementVerticalToolbarProps) {
  const [hoverTarget, setHoverTarget] = useState<LpSelectionTarget | null>(null);
  const [toolbarHover, setToolbarHover] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; side: 'left' | 'right' } | null>(
    null,
  );
  const pinnedBySelection = Boolean(primaryTarget);
  const displayTarget = primaryTarget ?? hoverTarget;

  const anchorRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const toolbarElRef = useRef<HTMLDivElement | null>(null);

  const computePosition = useCallback(
    (target: LpSelectionTarget): { left: number; top: number; side: 'left' | 'right' } | null => {
      const anchor = findAnchorForTarget(target) || anchorRef.current;
      if (!anchor) return null;
      anchorRef.current = anchor;
      const r = anchor.getBoundingClientRect();
      if (r.width <= 0 && r.height <= 0) return null;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const toolbarW = vh < 500 ? BAR_H : TOOLBAR_W;
      const toolbarH = vh < 500 ? TOOLBAR_W : BAR_H;
      const chromeTop = readBuilderChromeTop();
      // Visible band: below builder chrome, above viewport bottom.
      const viewTop = chromeTop;
      const viewBottom = vh - 8;
      const overlapTop = Math.max(r.top, viewTop);
      const overlapBottom = Math.min(r.bottom, viewBottom);
      const visibleH = overlapBottom - overlapTop;
      // Hide when the selected element has scrolled out of the canvas viewport —
      // previously we clamped top into view, so the bar stayed stuck mid-screen.
      if (visibleH <= 0 || visibleH < Math.min(12, r.height / 2) || r.right < 8 || r.left > vw - 8) {
        return null;
      }

      // Always anchor to the element's right edge. Near the viewport boundary,
      // keep the controls reachable without flipping them to the left side.
      const left = Math.max(8, Math.min(r.right + GAP, vw - toolbarW - 8));

      // Prefer centering on the *visible* slice of the anchor (not the off-screen part).
      const visibleMid = (overlapTop + overlapBottom) / 2 - toolbarH / 2;
      const topBase =
        r.height > 220 && r.top >= viewTop - 8 ? r.top + 16 : visibleMid;
      // Soft clamp only while still overlapping — never invent a position when gone.
      const top = Math.min(Math.max(viewTop, topBase), viewBottom - toolbarH);
      return { left, top, side: 'right' };
    },
    [],
  );

  const updatePosition = useCallback(() => {
    const target = displayTarget;
    if (!target) {
      setPos(null);
      return;
    }
    const next = computePosition(target);
    if (!next) {
      setPos(null);
      return;
    }
    // During live free-drag, write DOM directly first (no React lag / batching).
    const el = toolbarElRef.current;
    if (el && isGestureActive()) {
      el.style.left = `${next.left}px`;
      el.style.top = `${next.top}px`;
      el.dataset.lpVerticalToolbarSide = next.side;
    }
    setPos((prev) => {
      if (
        prev &&
        Math.abs(prev.left - next.left) < 0.5 &&
        Math.abs(prev.top - next.top) < 0.5 &&
        prev.side === next.side
      ) {
        return prev;
      }
      return next;
    });
  }, [computePosition, displayTarget]);

  useLayoutEffect(() => {
    if (!enabled || !displayTarget) {
      setPos(null);
      return;
    }
    anchorRef.current = findAnchorForTarget(displayTarget);
    updatePosition();
    const onScroll = () => {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = requestAnimationFrame(() => {
        scrollRafRef.current = null;
        // Re-resolve anchor each scroll — DOM nodes can remount / free-id shells move.
        anchorRef.current = findAnchorForTarget(displayTarget);
        updatePosition();
      });
    };
    const canvasScroll = canvasRootRef.current;
    // Dock fitting, loaded fonts and text resize can move the anchor without scrolling.
    const resizeObserver = new ResizeObserver(onScroll);
    if (anchorRef.current) resizeObserver.observe(anchorRef.current);
    if (canvasScroll) resizeObserver.observe(canvasScroll);
    const transformObserver = new MutationObserver(onScroll);
    for (let node = anchorRef.current; node; node = node.parentElement) {
      transformObserver.observe(node, { attributes: true, attributeFilter: ['style'] });
      if (node === canvasScroll) break;
    }
    canvasScroll?.addEventListener('scroll', onScroll, { passive: true });
    // Capture any nested scrollports (device frame, zoom layer).
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    window.addEventListener('transitionend', onScroll, true);
    window.addEventListener('lp-heading-box-resize-end', onScroll);
    window.addEventListener('lp-canvas-zoom-change', onScroll);
    window.addEventListener('pointerup', onScroll, true);
    window.addEventListener('pointercancel', onScroll, true);
    return () => {
      resizeObserver.disconnect();
      transformObserver.disconnect();
      canvasScroll?.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('transitionend', onScroll, true);
      window.removeEventListener('lp-heading-box-resize-end', onScroll);
      window.removeEventListener('lp-canvas-zoom-change', onScroll);
      window.removeEventListener('pointerup', onScroll, true);
      window.removeEventListener('pointercancel', onScroll, true);
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    };
  }, [enabled, displayTarget, updatePosition, canvasRootRef]);

  // Keep toolbar glued to the element while free-dragging / resizing (transform live).
  // Single listener + rAF loop keeps the position in sync with live transforms.
  useEffect(() => {
    if (!enabled || !displayTarget) return;
    let raf = 0;
    let active = false;
    const stop = () => {
      active = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      updatePosition();
    };
    const tick = () => {
      raf = 0;
      if (!active) return;
      updatePosition();
      if (isGestureActive()) {
        raf = requestAnimationFrame(tick);
      } else {
        stop();
      }
    };
    const start = () => {
      if (active) return;
      if (!isGestureActive()) return;
      active = true;
      raf = requestAnimationFrame(tick);
    };
    const onFrame = () => {
      updatePosition();
      start();
    };
    window.addEventListener('lp-free-drag-frame', onFrame);
    window.addEventListener('pointerdown', start, true);
    return () => {
      active = false;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('lp-free-drag-frame', onFrame);
      window.removeEventListener('pointerdown', start, true);
    };
  }, [enabled, displayTarget, updatePosition]);

  useEffect(() => {
    if (!enabled) return;
    const root = canvasRootRef.current;
    if (!root) return;

    const onMove = (e: PointerEvent) => {
      if (toolbarHover) return;
      if (pinnedBySelection && primaryTarget) return;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const hit = resolveHit(e.target as HTMLElement | null);
        if (!hit) {
          setHoverTarget(null);
          return;
        }
        setHoverTarget((prev) => (targetsEqual(prev, hit.target) ? prev : hit.target));
        anchorRef.current = hit.anchor;
      });
    };

    const onLeave = (e: PointerEvent) => {
      if (toolbarHover || pinnedBySelection) return;
      const related = e.relatedTarget as Node | null;
      if (related && root.contains(related)) return;
      setHoverTarget(null);
    };

    root.addEventListener('pointermove', onMove, { passive: true });
    root.addEventListener('pointerleave', onLeave);
    return () => {
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerleave', onLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [enabled, canvasRootRef, toolbarHover, pinnedBySelection, primaryTarget]);

  useEffect(() => {
    if (primaryTarget) {
      anchorRef.current = findAnchorForTarget(primaryTarget);
    }
  }, [primaryTarget]);

  if (!enabled || typeof document === 'undefined' || !displayTarget || !pos) {
    return null;
  }

  const locked = sectionLocked?.(displayTarget.blockId) ?? false;
  // Pure section chrome: HTML5 block reorder on Move.
  // Form uses free-drag (was wrongly lumped into isSection and never moved).
  const isSectionReorder = isSectionLevelElement(displayTarget.element);
  const isForm = displayTarget.element === 'form';

  const run =
    (fn: () => void) =>
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      cancelAllFreeDrags();
      fn();
    };

  const beginElementDrag = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Do not call onSelect here — it can remount canvas chrome mid-gesture and
    // cancel the free-drag session. Target is already the displayTarget.
    const anchor = anchorRef.current || findAnchorForTarget(displayTarget);
    if (!anchor) return;

    // Section-level only: HTML5 DnD reorder (form is free-drag below).
    if (isSectionReorder) return;

    // Exit inline edit so drag doesn't fight caret / contentEditable.
    const editing = document.querySelector(
      '[data-lp-inline-editing="1"]',
    ) as HTMLElement | null;
    if (editing) {
      try {
        editing.blur();
      } catch {
        /* ignore */
      }
    }

    const { blockId, element, field } = displayTarget;
    const itemId =
      typeof element === 'string' && element.startsWith('item:') ? element.slice(5) : null;

    // Prefer the most specific free-id FIRST.
    // Form: move the section shell (absolute free) so the whole LeadForm moves.
    // Fall back to ElementChrome `__element:form` if section API is missing.
    const freeIdCandidates = [
      field ? `${blockId}::${field}` : null,
      isForm ? blockId : null,
      isForm ? `${blockId}::__element:form` : null,
      `${blockId}::__element:${String(element)}`,
      itemId && !field ? `${blockId}::${itemId}` : null,
      !field && !isForm ? `${blockId}::${String(element)}` : null,
    ].filter(Boolean) as string[];

    for (const freeId of freeIdCandidates) {
      if (beginFreeDragByFreeId(freeId, e)) return;
      const byId = document.querySelector(
        `[data-lp-free-id="${CSS.escape(freeId)}"]`,
      ) as HTMLElement | null;
      if (byId && beginFreeDragFromShell(byId, e)) return;
    }

    // Fallback: nearest free shell under the anchor (text wrap → item → section).
    const shell =
      (field
        ? (anchor.closest(`[data-lp-free-id="${CSS.escape(`${blockId}::${field}`)}"]`) as
            | HTMLElement
            | null)
        : null) ||
      (isForm
        ? ((document.querySelector(
            `[data-lp-free-id="${CSS.escape(`${blockId}::__element:form`)}"]`,
          ) as HTMLElement | null) ||
            (document.querySelector(
              `[data-lp-free-id="${CSS.escape(blockId)}"]`,
            ) as HTMLElement | null))
        : null) ||
      (anchor.closest('[data-lp-free-id]') as HTMLElement | null) ||
      (anchor.querySelector('[data-lp-free-id]') as HTMLElement | null) ||
      (anchor.closest('[data-lp-section-chrome]') as HTMLElement | null) ||
      anchor;
    if (beginFreeDragFromShell(shell, e)) return;

    // Last resort: on-canvas free-drag handle (item chrome).
    const handle =
      (shell.querySelector('[data-lp-free-drag-handle]') as HTMLElement | null) ||
      (anchor.querySelector('[data-lp-free-drag-handle]') as HTMLElement | null);
    if (handle) {
      handle.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          clientX: e.clientX,
          clientY: e.clientY,
          button: 0,
          pointerId: e.pointerId,
          pointerType: e.pointerType,
        }),
      );
    }
  };

  const toolbar = (
    <div
      ref={toolbarElRef}
      data-lp-element-vertical-toolbar="1"
      data-lp-floating-toolbar="1"
      data-lp-vertical-toolbar-side={pos.side}
      data-lp-toolbar-for={displayTarget.blockId}
      className="pointer-events-auto fixed z-[9994] flex flex-col [@media(max-height:500px)]:flex-row rounded-md border border-orange-400/80 bg-[#F97316] shadow-lg"
      style={{ left: pos.left, top: pos.top, width: typeof window !== 'undefined' && window.innerHeight < 500 ? BAR_H : TOOLBAR_W }}
      onPointerEnter={() => setToolbarHover(true)}
      onPointerLeave={() => setToolbarHover(false)}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        title="Di chuyển"
        aria-label="Di chuyển"
        disabled={locked}
        // Sections only: HTML5 block reorder. Form/items/elements use free-drag.
        draggable={isSectionReorder}
        data-lp-vertical-tool="move"
        data-lp-free-drag-handle={!isSectionReorder ? '1' : undefined}
        data-lp-section-drag-handle={isSectionReorder ? '1' : undefined}
        className="flex h-11 w-full cursor-grab items-center justify-center border-b border-orange-500/40 text-sm text-white hover:bg-orange-600 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
        onPointerDown={(e) => {
          if (isSectionReorder) {
            e.stopPropagation();
            return;
          }
          beginElementDrag(e);
        }}
        onDragStart={(e) => {
          e.stopPropagation();
          if (!isSectionReorder) {
            e.preventDefault();
            return;
          }
          if (locked) {
            e.preventDefault();
            return;
          }
          onSelect(displayTarget);
          e.dataTransfer.setData(LP_BLOCK_MIME, displayTarget.blockId);
          e.dataTransfer.effectAllowed = 'move';
        }}
      >
        <CrossMoveIcon />
      </button>
      <button
        type="button"
        title="Lưu"
        aria-label="Lưu"
        disabled={locked}
        data-lp-vertical-tool="save"
        className="flex h-11 w-full items-center justify-center border-b border-orange-500/40 text-sm text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
        onClick={run(() => onSave(displayTarget))}
      >
        💾
      </button>
      <button
        type="button"
        title="Nhân bản"
        aria-label="Nhân bản"
        disabled={locked}
        data-lp-vertical-tool="duplicate"
        className="flex h-11 w-full items-center justify-center border-b border-orange-500/40 text-sm text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
        onClick={run(() => onDuplicate(displayTarget))}
      >
        ⧉
      </button>
      <button
        type="button"
        title="Xóa"
        aria-label="Xóa"
        disabled={locked}
        data-lp-vertical-tool="delete"
        className="flex h-11 w-full items-center justify-center text-sm text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
        onClick={run(() => onDelete(displayTarget))}
      >
        🗑
      </button>
    </div>
  );

  return createPortal(toolbar, document.body);
}
