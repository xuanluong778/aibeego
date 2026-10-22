'use client';

/**
 * Free-drag pointer engine + smart guides overlay (Canva-style).
 * - transform during drag; commit coords on drop (one history entry via caller)
 * - no setState per mousemove (rAF + DOM)
 * - disabled while inline editing / form focus / interactive controls
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { isLpMarqueeSelecting } from './landing-page-canvas-selection';
import {
  applyAxisLock,
  applyResizeHandle,
  clampBoxToContentSafeArea,
  computeFreeSnap,
  CONTENT_SAFE_AREA_SNAP_PX,
  FREE_SNAP_THRESHOLD_PX,
  mapContentSafeAreaToSurface,
  normalizeRotate,
  resolveContentSafeArea,
  resizeHandleCursor,
  snapRotateDegrees,
  type ContentSafeArea,
  type FreeGuide,
  type FreeRect,
  type FreeResizeHandle,
  type FreeSpacingLabel,
  CANVAS_FREE_RESERVE_MIN,
  CANVAS_FREE_RESERVE_PADDING,
  type LandingPageFreeLayout,
} from '@marketingspa/shared';

export type { FreeResizeHandle };

export type FreeGuidesState = {
  visible: boolean;
  guides: FreeGuide[];
  spacings: FreeSpacingLabel[];
  canvasSize: { width: number; height: number };
};

const EMPTY_GUIDES: FreeGuidesState = {
  visible: false,
  guides: [],
  spacings: [],
  canvasSize: { width: 0, height: 0 },
};

const FreeGuidesCtx = createContext<{
  setGuides: (s: FreeGuidesState) => void;
} | null>(null);

/** Imperative guides host — children never re-render on pointer move. */
export function FreeGuidesProvider({
  children,
  /** Builder-only persistent content safe-area guides (hidden on public). */
  contentSafeArea = false,
  viewport = 'desktop',
}: {
  children: ReactNode;
  contentSafeArea?: boolean;
  viewport?: 'desktop' | 'tablet' | 'mobile';
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const setGuides = useCallback((s: FreeGuidesState) => {
    const host = hostRef.current;
    if (!host) return;
    if (!s.visible) {
      host.replaceChildren();
      host.setAttribute('data-lp-guides-active', '0');
      host.style.display = 'none';
      return;
    }
    host.style.display = 'block';
    host.style.width = `${s.canvasSize.width}px`;
    host.style.height = `${s.canvasSize.height}px`;
    host.setAttribute('data-lp-guides-active', '1');
    const frag = document.createDocumentFragment();
    for (const g of s.guides) {
      const line = document.createElement('div');
      line.setAttribute('data-lp-guide', g.orientation);
      line.setAttribute('data-lp-guide-kind', g.kind);
      line.style.position = 'absolute';
      line.style.borderColor = '#e11d8a';
      line.style.borderStyle = 'dashed';
      const isCenter = g.kind === 'center';
      if (isCenter) {
        line.style.borderColor = '#c026d3';
        line.style.borderStyle = 'solid';
      }
      if (g.orientation === 'v') {
        line.style.left = `${g.position}px`;
        line.style.top = '0';
        line.style.width = '0';
        line.style.height = '100%';
        line.style.borderLeftWidth = isCenter ? '2px' : '1px';
      } else {
        line.style.top = `${g.position}px`;
        line.style.left = '0';
        line.style.height = '0';
        line.style.width = '100%';
        line.style.borderTopWidth = isCenter ? '2px' : '1px';
      }
      frag.appendChild(line);
    }
    for (const sp of s.spacings) {
      const label = document.createElement('div');
      label.setAttribute('data-lp-spacing-label', String(sp.value));
      label.textContent = String(sp.value);
      label.style.cssText =
        'position:absolute;transform:translate(-50%,-50%);background:#e11d8a;color:#fff;font-size:10px;font-weight:600;padding:2px 4px;border-radius:4px;left:' +
        sp.x +
        'px;top:' +
        sp.y +
        'px;';
      frag.appendChild(label);
    }
    host.replaceChildren(frag);
  }, []);
  const api = useMemo(() => ({ setGuides }), [setGuides]);
  return (
    <FreeGuidesCtx.Provider value={api}>
      <div className="relative" data-lp-guides-host="1">
        {children}
        {contentSafeArea ? (
          <ContentSafeAreaGuidesOverlay viewport={viewport} />
        ) : null}
        <div
          ref={hostRef}
          data-lp-smart-guides="1"
          data-lp-guides-active="0"
          className="pointer-events-none absolute inset-0 z-[40] overflow-hidden"
          style={{ display: 'none' }}
          aria-hidden
        />
      </div>
    </FreeGuidesCtx.Provider>
  );
}

/** Persistent vertical dashed guides for the 1200px (responsive) content column — builder only. */
function ContentSafeAreaGuidesOverlay({
  viewport,
}: {
  viewport: 'desktop' | 'tablet' | 'mobile';
}) {
  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const host = wrap.parentElement;
    const canvas =
      (host?.querySelector('[data-lp-canvas-root]') as HTMLElement | null) ||
      (host?.querySelector('article') as HTMLElement | null);
    if (!canvas) return;

    const sync = () => {
      const w = canvas.offsetWidth || canvas.getBoundingClientRect().width;
      const safe = resolveContentSafeArea(w, viewport);
      // Start below top-of-page LP <header> so guides never overlay that chrome.
      const pageHeader =
        (canvas.querySelector(':scope > [data-lp-block-slot] header') as HTMLElement | null) ||
        (canvas.querySelector(':scope header') as HTMLElement | null) ||
        (canvas.querySelector('header') as HTMLElement | null);
      let topOffset = 0;
      if (pageHeader) {
        const canvasRect = canvas.getBoundingClientRect();
        const headerRect = pageHeader.getBoundingClientRect();
        const headerTopInCanvas = headerRect.top - canvasRect.top;
        if (headerTopInCanvas < 8) {
          topOffset = Math.max(0, Math.round(headerRect.bottom - canvasRect.top));
        }
      }
      const leftEl = leftRef.current;
      const rightEl = rightRef.current;
      for (const el of [leftEl, rightEl]) {
        if (!el) continue;
        el.style.top = `${topOffset}px`;
        el.style.height = `calc(100% - ${topOffset}px)`;
      }
      if (leftEl) leftEl.style.left = `${safe.left}px`;
      if (rightEl) rightEl.style.left = `${safe.right}px`;
      wrap.setAttribute('data-lp-content-safe-width', String(Math.round(safe.width)));
      wrap.setAttribute('data-lp-content-safe-left', String(Math.round(safe.left)));
      wrap.setAttribute('data-lp-content-safe-top', String(topOffset));
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(canvas);
    const pageHeader =
      (canvas.querySelector('header') as HTMLElement | null) || null;
    if (pageHeader) ro.observe(pageHeader);
    window.addEventListener('resize', sync);
    const mo = new MutationObserver(sync);
    mo.observe(canvas, { childList: true, subtree: true, attributes: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, [viewport]);

  return (
    <div
      ref={wrapRef}
      data-lp-content-safe-guides="1"
      className="pointer-events-none absolute inset-0 z-[34] overflow-hidden"
      aria-hidden
    >
      <div
        ref={leftRef}
        data-lp-content-safe-guide="left"
        className="absolute w-0 border-l-2 border-dashed"
        style={{
          left: 'calc(50% - 600px)',
          top: 0,
          height: '100%',
          borderColor: '#1e3a8a',
        }}
      />
      <div
        ref={rightRef}
        data-lp-content-safe-guide="right"
        className="absolute w-0 border-l-2 border-dashed"
        style={{
          left: 'calc(50% + 600px)',
          top: 0,
          height: '100%',
          borderColor: '#1e3a8a',
        }}
      />
    </div>
  );
}

export function useFreeGuidesPublisher() {
  return useContext(FreeGuidesCtx);
}

export type FreeDragCommitPayload = {
  positionMode: 'free';
  freeLayout: LandingPageFreeLayout;
  /** When viewport is tablet/mobile, caller may store under responsiveFreeLayout. */
  viewport: 'desktop' | 'tablet' | 'mobile';
};

export function isFreeDragBlockedTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.closest) return true;
  if (el.closest('[data-lp-inline-editing="1"]')) return true;
  if (el.closest('[data-lp-text-toolbar]')) return true;
  if (el.closest('[data-lp-text-more-menu]')) return true;
  if (el.closest('[data-lp-text-color-panel]')) return true;
  if (el.closest('[data-lp-floating-toolbar]')) return true;
  if (el.closest('[data-lp-item-handle]')) return true;
  if (el.closest('[data-lp-section-handle]')) return true;
  if (el.closest('[data-lp-resize-handle],[data-lp-rotate-handle]')) return true;
  if (
    el.closest(
      '[data-lp-inline-field],[data-lp-box-hit],[data-lp-form-hit],[data-lp-button-hit],[data-lp-cta-body]',
    )
  ) {
    return true;
  }
  if (el.closest('input, textarea, select, [contenteditable="true"]')) return true;
  if (el.closest('a[href], button, [role="button"]')) {
    // Allow drag from chrome move handle / button-like blocks.
    if (el.closest('[data-lp-free-drag-handle]')) return false;
    if (el.closest('[data-lp-button-block],[data-lp-button-group-block],[data-lp-box-block],[data-lp-transformable]')) {
      return false;
    }
    // Shell itself is role=button — don't treat as blocked interactive.
    if (el.closest('[data-lp-section-chrome="1"]') && !el.closest('[data-lp-floating-toolbar]')) {
      return false;
    }
    return true;
  }
  return false;
}

export function readRect(el: HTMLElement, origin: DOMRect, scale = 1): FreeRect {
  const r = el.getBoundingClientRect();
  const s = scale > 0.05 && Number.isFinite(scale) ? scale : 1;
  return {
    id: el.getAttribute('data-lp-free-id') || el.getAttribute('data-lp-block-id') || 'x',
    left: (r.left - origin.left) / s,
    top: (r.top - origin.top) / s,
    width: r.width / s,
    height: r.height / s,
  };
}

/** CSS layout width of a surface (unscaled) — preferred over getBoundingClientRect under zoom. */
function surfaceLayoutSize(surfaceEl: HTMLElement, scale: number): { width: number; height: number } {
  const s = scale > 0.05 && Number.isFinite(scale) ? scale : 1;
  const rect = surfaceEl.getBoundingClientRect();
  const w = surfaceEl.clientWidth > 0 ? surfaceEl.clientWidth : rect.width / s;
  const h = surfaceEl.clientHeight > 0 ? surfaceEl.clientHeight : rect.height / s;
  return {
    width: Math.max(1, Math.round(w)),
    height: Math.max(1, Math.round(h)),
  };
}

/**
 * Positioning parent for free coords.
 * Items must use the nearest `[data-lp-free-surface]` (card grid), NOT the page canvas —
 * otherwise left/top are huge canvas offsets and the box vanishes outside the section.
 */
export function resolveFreeSurface(el: HTMLElement): HTMLElement {
  const surface = el.closest('[data-lp-free-surface]') as HTMLElement | null;
  if (surface) return surface;
  const canvas =
    (el.closest('[data-lp-canvas-root]') as HTMLElement | null) ||
    (el.closest('article') as HTMLElement | null);
  if (canvas) return canvas;
  const parent = el.offsetParent as HTMLElement | null;
  return parent || el.parentElement || el;
}

/**
 * Content safe-area in free-surface local coords.
 * Sections (absolute chrome) skip this — full-width backgrounds stay allowed.
 */
function resolveSurfaceContentSafeArea(
  surfaceEl: HTMLElement,
  viewport: 'desktop' | 'tablet' | 'mobile',
): ContentSafeArea {
  const canvas =
    (surfaceEl.closest('[data-lp-canvas-root]') as HTMLElement | null) ||
    (surfaceEl.closest('article') as HTMLElement | null) ||
    surfaceEl;
  const scale = readCanvasPointerScale(surfaceEl);
  const canvasCss = surfaceLayoutSize(canvas, scale);
  const surfaceCss = surfaceLayoutSize(surfaceEl, scale);
  const canvasSafe = resolveContentSafeArea(canvasCss.width, viewport);
  if (surfaceEl === canvas || surfaceEl.hasAttribute('data-lp-canvas-root')) {
    return canvasSafe;
  }
  const canvasRect = canvas.getBoundingClientRect();
  const surfaceRect = surfaceEl.getBoundingClientRect();
  const offsetLeft = (surfaceRect.left - canvasRect.left) / (scale > 0.05 ? scale : 1);
  return mapContentSafeAreaToSurface(canvasSafe, offsetLeft, surfaceCss.width);
}

/** True for in-section content (text/image/button/card/box), false for full-bleed sections. */
function shouldClampToContentSafeArea(el: HTMLElement, mode: 'absolute' | 'offset'): boolean {
  if (mode === 'offset') return true;
  if (el.getAttribute('data-lp-section-chrome') === '1') return false;
  if (el.getAttribute('data-lp-free-child') === '1') return true;
  if (el.getAttribute('data-lp-free-mode') === 'offset') return true;
  return false;
}

export function FreeDragGuidesOverlay({
  canvasSize,
  guides,
  spacings,
  visible,
}: {
  canvasSize: { width: number; height: number };
  guides: FreeGuide[];
  spacings: FreeSpacingLabel[];
  visible: boolean;
}) {
  if (!visible) return null;
  return (
    <div
      data-lp-smart-guides="1"
      data-lp-guides-active="1"
      className="pointer-events-none absolute inset-0 z-[40] overflow-hidden"
      style={{ width: canvasSize.width, height: canvasSize.height }}
      aria-hidden
    >
      {guides.map((g, i) =>
        g.orientation === 'v' ? (
          <div
            key={`v-${i}-${g.position}`}
            data-lp-guide="v"
            data-lp-guide-kind={g.kind}
            className="absolute top-0 w-px border-l border-dashed"
            style={{
              left: g.position,
              height: '100%',
              borderColor: '#e11d8a',
            }}
          />
        ) : (
          <div
            key={`h-${i}-${g.position}`}
            data-lp-guide="h"
            data-lp-guide-kind={g.kind}
            className="absolute left-0 h-px border-t border-dashed"
            style={{
              top: g.position,
              width: '100%',
              borderColor: '#e11d8a',
            }}
          />
        ),
      )}
      {spacings.map((s, i) => (
        <div
          key={`sp-${i}-${s.value}`}
          data-lp-spacing-label={s.value}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded bg-[#e11d8a] px-1 py-0.5 text-[10px] font-semibold text-white shadow"
          style={{ left: s.x, top: s.y }}
        >
          {s.value}
        </div>
      ))}
    </div>
  );
}

type DragSession = {
  kind: 'move' | 'resize' | 'rotate';
  pointerId: number;
  originX: number;
  originY: number;
  startClientX: number;
  startClientY: number;
  width: number;
  height: number;
  reserveHeight: number;
  rotate: number;
  shiftLock: boolean;
  el: HTMLElement;
  canvasEl: HTMLElement;
  siblings: FreeRect[];
  canvasBox: FreeRect;
  /** Content (offset) only — sections stay full-width. */
  safeArea?: ContentSafeArea | null;
  /** Enforce content column on drag/resize (text/image/button/card/box). */
  clampToSafeArea?: boolean;
  raf: number | null;
  lastGuides: FreeGuide[];
  lastSpacings: FreeSpacingLabel[];
  lastX: number;
  lastY: number;
  lastW: number;
  lastH: number;
  lastRotate: number;
  /** Offset mode: natural flow position inside surface (before translate). */
  baseLeft?: number;
  baseTop?: number;
  mode?: 'absolute' | 'offset';
  /** Resize */
  handle?: FreeResizeHandle;
  /** Rotate — pointer angle at gesture start (radians) + box center in client space. */
  startPointerAngle?: number;
  centerClientX?: number;
  centerClientY?: number;
  /** Ancestor CSS transform scale — pointer deltas are divided by this. */
  canvasScale?: number;
  /** Latest pointer sample (client space) — rAF consumes snapshot, never re-reads DOM size. */
  pendingClientX?: number;
  pendingClientY?: number;
  pendingShift?: boolean;
};

type PendingArm = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  shiftKey: boolean;
};

/** Active free-drag sessions — cancel when toolbar actions (duplicate/delete) remount DOM. */
const freeDragCancelers = new Set<() => void>();

export function cancelAllFreeDrags() {
  // Copy first — cancelers remove themselves while iterating.
  for (const cancel of [...freeDragCancelers]) {
    try {
      cancel();
    } catch {
      /* ignore */
    }
  }
  freeDragCancelers.clear();
}

/** Drop legacy per-slot reserves (pre canvas-level minHeight). */
function clearLegacySlotFlowReserves(root?: HTMLElement | null) {
  const canvas = root ?? (document.querySelector('[data-lp-canvas-root]') as HTMLElement | null);
  if (!canvas) return;
  canvas.querySelectorAll('[data-lp-flow-reserve="1"]').forEach((node) => node.remove());
}

/** Read cumulative CSS scale from ancestors (viewport preview / transforms). */
export function readCanvasPointerScale(fromEl: HTMLElement | null): number {
  if (!fromEl || typeof window === 'undefined') return 1;
  let node: HTMLElement | null = fromEl;
  while (node) {
    const t = getComputedStyle(node).transform;
    if (t && t !== 'none') {
      try {
        const m = new DOMMatrixReadOnly(t);
        const sx = Math.hypot(m.a, m.b);
        if (sx > 0.05 && Number.isFinite(sx)) return sx;
      } catch {
        /* ignore */
      }
    }
    node = node.parentElement;
  }
  return 1;
}

/**
 * One canvas-level reserve: minHeight = max(bottom of free section shells) + padding.
 * Uses live DOM bounds converted into CSS layout space (÷ pointer scale) so zoom
 * never under/over-reserves after commit handoff.
 */
export function syncCanvasFreeReserve(
  fromShell?: HTMLElement | null,
  padding = CANVAS_FREE_RESERVE_PADDING,
) {
  const root = (fromShell?.closest('[data-lp-canvas-root]') ??
    document.querySelector('[data-lp-canvas-root]')) as HTMLElement | null;
  if (!root) return;
  clearLegacySlotFlowReserves(root);
  const scale = readCanvasPointerScale(root);
  const rootRect = root.getBoundingClientRect();
  const rootTop = rootRect.top;
  let maxBottom = 0;
  root
    .querySelectorAll<HTMLElement>(
      '[data-lp-section-chrome="1"][data-lp-position-mode="free"]',
    )
    .forEach((shell) => {
      const rect = shell.getBoundingClientRect();
      maxBottom = Math.max(maxBottom, (rect.bottom - rootTop) / scale);
    });
  if (maxBottom <= 0) {
    root.style.minHeight = '';
    root.removeAttribute('data-lp-free-reserve-h');
    return;
  }
  const h = Math.max(CANVAS_FREE_RESERVE_MIN, Math.round(maxBottom + padding));
  root.style.minHeight = `${h}px`;
  root.setAttribute('data-lp-free-reserve-h', String(h));
}

/**
 * Hook attached to a free-draggable box. Caller provides commit callback (pushHistory once).
 * Uses window-level pointer listeners so drag keeps working across children / before React re-render.
 */
export function useFreeDragBox({
  enabled,
  selected,
  viewport,
  layout,
  onCommit,
  onGuides,
  /** absolute = leave flow (sections); offset = translate in-place (cards/items, no vanish). */
  mode = 'absolute',
}: {
  enabled: boolean;
  selected: boolean;
  viewport: 'desktop' | 'tablet' | 'mobile';
  layout: LandingPageFreeLayout | null;
  onCommit: (payload: FreeDragCommitPayload) => void;
  onGuides?: (state: FreeGuidesState) => void;
  mode?: 'absolute' | 'offset';
}) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<DragSession | null>(null);
  const pendingRef = useRef<PendingArm | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const [dragging, setDragging] = useState(false);
  const [liveAngle, setLiveAngle] = useState<number | null>(null);
  const guidesCtx = useFreeGuidesPublisher();
  const publishGuidesRef = useRef(onGuides || ((s: FreeGuidesState) => guidesCtx?.setGuides(s)));
  publishGuidesRef.current = onGuides || ((s: FreeGuidesState) => guidesCtx?.setGuides(s));
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const clearTransform = useCallback(() => {
    const el = shellRef.current;
    if (!el) return;
    el.style.transform = '';
    el.style.willChange = '';
    el.style.cursor = '';
    el.removeAttribute('data-lp-free-dragging');
    el.removeAttribute('data-lp-free-resizing');
    el.removeAttribute('data-lp-free-rotating');
    if (modeRef.current === 'offset') {
      // Never leave absolute pin on card items (legacy bug residue).
      el.style.position = '';
      el.style.left = '';
      el.style.top = '';
      el.style.margin = '';
      if (!layoutRef.current?.width) el.style.width = '';
      if (!layoutRef.current?.height) el.style.height = '';
      el.style.zIndex = '';
    }
  }, []);

  const detachWindow = useRef<(() => void) | null>(null);
  const cancelerRef = useRef<(() => void) | null>(null);

  const finish = useCallback(
    (commit: boolean) => {
      const s = sessionRef.current;
      pendingRef.current = null;
      detachWindow.current?.();
      detachWindow.current = null;
      if (cancelerRef.current) {
        freeDragCancelers.delete(cancelerRef.current);
        cancelerRef.current = null;
      }
      if (!s) {
        setDragging(false);
        setLiveAngle(null);
        publishGuidesRef.current?.(EMPTY_GUIDES);
        return;
      }
      if (s.raf != null) cancelAnimationFrame(s.raf);
      try {
        s.el.releasePointerCapture(s.pointerId);
      } catch {
        /* ignore */
      }
      clearTransform();
      // If we temporarily absolute-positioned a flow box but cancel, restore.
      if (!commit && !layoutRef.current) {
        s.el.style.position = '';
        s.el.style.left = '';
        s.el.style.top = '';
        s.el.style.width = '';
        s.el.style.height = '';
        s.el.style.zIndex = '';
        // Drop drag-temp spacers — otherwise they look like undeletable empty sections.
        if (s.mode !== 'offset') syncCanvasFreeReserve(s.el);
      }
      sessionRef.current = null;
      setDragging(false);
      setLiveAngle(null);
      publishGuidesRef.current?.(EMPTY_GUIDES);
      if (!commit) return;
      // Keep document-flow spacer in sync with the visual box so sections don't overlap.
      let flowH = Math.round(s.lastH);
      const flowW = Math.round(s.lastW);
      // Absolute sections: grow height to fit live content so we don't need a second
      // grow-only history entry after drop (overlap + double undo).
      if (s.mode !== 'offset' && s.el) {
        const contentH = Math.ceil(s.el.scrollHeight || s.el.offsetHeight || 0);
        if (contentH > flowH) flowH = contentH;
      }
      // Move/rotate: size was locked at session start (getBoundingClientRect / prior layout).
      // Resize: lastW/lastH were mutated by handles only.
      onCommitRef.current({
        positionMode: 'free',
        freeLayout: {
          x: s.lastX,
          y: s.lastY,
          width: flowW,
          height: flowH,
          rotate: normalizeRotate(s.lastRotate),
          reserveHeight: flowH,
        },
        viewport: viewportRef.current,
      });
      // Canvas minHeight after commit is owned solely by computeCanvasFreeReserveHeight
      // (packages/shared) via LandingPageRenderer's own render + effect — it reacts to
      // this same onCommit's spec change and is rotation-aware, so no imperative
      // re-sync is needed here (see BUG-15: two independent writers used to race).
    },
    [clearTransform],
  );

  // Register canceler for this hook instance
  useEffect(() => {
    const cancel = () => finish(false);
    cancelerRef.current = cancel;
    freeDragCancelers.add(cancel);
    return () => {
      freeDragCancelers.delete(cancel);
      cancelerRef.current = null;
      // Unmount mid-drag must not leave window listeners sticky.
      finish(false);
    };
  }, [finish]);

  // Grow-only content sync (sections only): use offsetHeight (CSS px) — never
  // getBoundingClientRect under device zoom (that returns screen px and fights layout).
  useEffect(() => {
    if (mode === 'offset') return;
    if (dragging) return;
    if (!layout || !layout.height) return;
    const el = shellRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      if (sessionRef.current || pendingRef.current) return;
      const needed = Math.ceil(el.offsetHeight || 0);
      const committed = Math.round(layout.height || 0);
      if (needed > committed + 2) {
        onCommitRef.current({
          positionMode: 'free',
          freeLayout: { ...layout, height: needed, reserveHeight: needed },
          viewport: viewportRef.current,
        });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [layout, mode, dragging]);

  const startSessionRef = useRef<
    (
      pointerId: number,
      clientX: number,
      clientY: number,
      shiftKey: boolean,
      opts?: { preserveBoxSize?: boolean },
    ) => void
  >(() => undefined);

  const applyMove = useCallback((_clientX?: number, _clientY?: number, _shiftKey?: boolean) => {
    const s = sessionRef.current;
    if (!s) return;
    if (_clientX != null) s.pendingClientX = _clientX;
    if (_clientY != null) s.pendingClientY = _clientY;
    if (_shiftKey != null) s.pendingShift = _shiftKey;
    s.shiftLock = s.pendingShift ?? false;

    if (s.raf != null) return;
    s.raf = requestAnimationFrame(() => {
      const sess = sessionRef.current;
      if (!sess) return;
      sess.raf = null;
      const clientX = sess.pendingClientX ?? sess.startClientX;
      const clientY = sess.pendingClientY ?? sess.startClientY;
      const shiftKey = sess.pendingShift ?? false;
      sess.shiftLock = shiftKey;

      if (sess.kind === 'rotate') {
        const cx = sess.centerClientX ?? clientX;
        const cy = sess.centerClientY ?? clientY;
        const ang = Math.atan2(clientY - cy, clientX - cx);
        const startAng = sess.startPointerAngle ?? ang;
        const deltaDeg = ((ang - startAng) * 180) / Math.PI;
        let next = normalizeRotate(sess.rotate + deltaDeg);
        next = snapRotateDegrees(next, shiftKey);
        sess.lastRotate = next;
        sess.lastX = sess.originX;
        sess.lastY = sess.originY;
        sess.lastW = sess.width;
        sess.lastH = sess.height;
        sess.el.style.transform = `rotate(${next}deg)`;
        setLiveAngle(next);
        publishGuidesRef.current?.(EMPTY_GUIDES);
        if (sess.mode !== 'offset') syncCanvasFreeReserve(sess.el);
        return;
      }

      if (sess.kind === 'resize' && sess.handle) {
        const scale = sess.canvasScale && sess.canvasScale > 0 ? sess.canvasScale : 1;
        // Snapshot geometry at pointerdown — never re-measure DOM size per frame.
        const rawDx = (clientX - sess.startClientX) / scale;
        const rawDy = (clientY - sess.startClientY) / scale;
        const theta = (sess.rotate * Math.PI) / 180;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        const dx = rawDx * cos + rawDy * sin;
        const dy = -rawDx * sin + rawDy * cos;
        const maxW = sess.clampToSafeArea && sess.safeArea ? sess.safeArea.width : undefined;
        const next = applyResizeHandle({
          handle: sess.handle,
          x: sess.originX,
          y: sess.originY,
          width: sess.width,
          height: sess.height,
          dx,
          dy,
          ...(maxW != null ? { maxW } : {}),
        });
        if (sess.clampToSafeArea && sess.safeArea) {
          sess.canvasBox = {
            ...sess.canvasBox,
            height: Math.max(
              sess.canvasBox.height,
              next.y + next.height + 240,
              next.height + 560,
            ),
          };
          const clamped = clampBoxToContentSafeArea(
            next.x,
            next.y,
            next.width,
            next.height,
            sess.safeArea,
          );
          const maxY = Math.max(0, sess.canvasBox.height - clamped.height);
          sess.lastX = clamped.x;
          sess.lastY = Math.min(maxY, Math.max(0, clamped.y));
          sess.lastW = clamped.width;
          sess.lastH = clamped.height;
        } else {
          sess.canvasBox = {
            ...sess.canvasBox,
            width: Math.max(sess.canvasBox.width, next.x + next.width + 48),
            height: Math.max(
              sess.canvasBox.height,
              next.y + next.height + 240,
              next.height + 560,
            ),
          };
          const maxX = Math.max(0, sess.canvasBox.width - next.width);
          const maxY = Math.max(0, sess.canvasBox.height - next.height);
          sess.lastX = Math.min(maxX, Math.max(0, next.x));
          sess.lastY = Math.min(maxY, Math.max(0, next.y));
          sess.lastW = next.width;
          sess.lastH = next.height;
        }
        sess.lastRotate = sess.rotate;
        sess.reserveHeight = sess.lastH;
        if (sess.mode === 'offset') {
          sess.el.style.width = `${sess.lastW}px`;
          sess.el.style.height = `${sess.lastH}px`;
          sess.el.style.minHeight = `${sess.lastH}px`;
          sess.el.style.maxWidth = 'none';
          sess.el.style.transform = `translate3d(${sess.lastX}px, ${sess.lastY}px, 0) rotate(${sess.rotate}deg)`;
        } else {
          sess.el.style.left = `${sess.lastX}px`;
          sess.el.style.top = `${sess.lastY}px`;
          sess.el.style.width = `${sess.lastW}px`;
          sess.el.style.height = `${sess.lastH}px`;
          sess.el.style.minHeight = `${sess.lastH}px`;
          sess.el.style.maxWidth = 'none';
          sess.el.style.transform = sess.rotate ? `rotate(${sess.rotate}deg)` : '';
          syncCanvasFreeReserve(sess.el);
        }
        publishGuidesRef.current?.(EMPTY_GUIDES);
        return;
      }

      // --- move ---
      const scale = sess.canvasScale && sess.canvasScale > 0 ? sess.canvasScale : 1;
      const dx = (clientX - sess.startClientX) / scale;
      const dy = (clientY - sess.startClientY) / scale;
      let proposedX = sess.originX + dx;
      let proposedY = sess.originY + dy;
      const locked = applyAxisLock(sess.originX, sess.originY, proposedX, proposedY, sess.shiftLock);
      proposedX = locked.x;
      proposedY = locked.y;

      const isOffset = sess.mode === 'offset';
      const movingLeft = isOffset ? (sess.baseLeft ?? 0) + proposedX : proposedX;
      const movingTop = isOffset ? (sess.baseTop ?? 0) + proposedY : proposedY;

      sess.canvasBox = {
        ...sess.canvasBox,
        height: Math.max(sess.canvasBox.height, movingTop + sess.height + 240, sess.height + 560),
      };

      const snap = computeFreeSnap({
        moving: {
          id: 'moving',
          left: movingLeft,
          top: movingTop,
          width: sess.width,
          height: sess.height,
        },
        proposedX: movingLeft,
        proposedY: movingTop,
        canvas: sess.canvasBox,
        siblings: sess.siblings,
        threshold: FREE_SNAP_THRESHOLD_PX,
        safeArea: sess.clampToSafeArea ? sess.safeArea : null,
        safeAreaThreshold: CONTENT_SAFE_AREA_SNAP_PX,
      });

      if (isOffset) {
        sess.lastX = Math.round(snap.x - (sess.baseLeft ?? 0));
        sess.lastY = Math.round(snap.y - (sess.baseTop ?? 0));
        sess.lastW = sess.width;
        sess.lastH = sess.height;
        sess.lastRotate = sess.rotate;
        sess.el.style.transform = `translate3d(${sess.lastX}px, ${sess.lastY}px, 0) rotate(${sess.rotate}deg)`;
      } else {
        sess.lastX = snap.x;
        sess.lastY = snap.y;
        sess.lastW = sess.width;
        sess.lastH = sess.height;
        sess.lastRotate = sess.rotate;
        sess.el.style.left = `${snap.x}px`;
        sess.el.style.top = `${snap.y}px`;
        sess.el.style.transform = sess.rotate ? `rotate(${sess.rotate}deg)` : '';
        syncCanvasFreeReserve(sess.el);
      }
      sess.lastGuides = snap.guides;
      sess.lastSpacings = snap.spacings;
      publishGuidesRef.current?.({
        visible: true,
        guides: snap.guides,
        spacings: snap.spacings,
        canvasSize: { width: sess.canvasBox.width, height: sess.canvasBox.height },
      });
    });
  }, []);

  const attachWindow = useCallback(
    (pointerId: number) => {
      detachWindow.current?.();
      const endGesture = (commit: boolean) => {
        if (pendingRef.current && !sessionRef.current) {
          pendingRef.current = null;
          detachWindow.current?.();
          detachWindow.current = null;
          return;
        }
        finish(commit);
      };
      const onMove = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        // Mouse released but we missed pointerup (DOM remount / capture loss) —
        // stop sticky drag immediately so section doesn't follow the cursor.
        if (ev.pointerType === 'mouse' && ev.buttons === 0) {
          const s = sessionRef.current;
          const moved =
            !!s &&
            (s.lastX !== s.originX ||
              s.lastY !== s.originY ||
              s.lastW !== s.width ||
              s.lastH !== s.height ||
              s.lastRotate !== s.rotate);
          endGesture(moved);
          return;
        }
        const pending = pendingRef.current;
        if (pending && !sessionRef.current) {
          if (
            Math.abs(ev.clientX - pending.startClientX) > 4 ||
            Math.abs(ev.clientY - pending.startClientY) > 4
          ) {
            pendingRef.current = null;
            startSessionRef.current(
              pending.pointerId,
              pending.startClientX,
              pending.startClientY,
              pending.shiftKey || ev.shiftKey,
              { preserveBoxSize: true },
            );
            applyMove(ev.clientX, ev.clientY, ev.shiftKey);
          }
          return;
        }
        if (!sessionRef.current) return;
        ev.preventDefault();
        applyMove(ev.clientX, ev.clientY, ev.shiftKey);
      };
      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        endGesture(true);
      };
      const onCancel = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        endGesture(false);
      };
      const onBlur = () => endGesture(false);
      const onLostCapture = (ev: Event) => {
        const pe = ev as PointerEvent;
        if (pe.pointerId != null && pe.pointerId !== pointerId) return;
        endGesture(false);
      };
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp, true);
      window.addEventListener('pointercancel', onCancel, true);
      window.addEventListener('blur', onBlur);
      document.addEventListener('lostpointercapture', onLostCapture, true);
      detachWindow.current = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp, true);
        window.removeEventListener('pointercancel', onCancel, true);
        window.removeEventListener('blur', onBlur);
        document.removeEventListener('lostpointercapture', onLostCapture, true);
      };
    },
    [applyMove, finish],
  );

  const startSession = useCallback(
    (
      pointerId: number,
      clientX: number,
      clientY: number,
      shiftKey: boolean,
      opts?: { preserveBoxSize?: boolean },
    ) => {
      if (!enabledRef.current) return;
      const el = shellRef.current;
      if (!el) return;
      if (el.querySelector('[data-lp-inline-editing="1"]')) return;

      const surfaceEl = resolveFreeSurface(el);
      if (getComputedStyle(surfaceEl).position === 'static') {
        surfaceEl.style.position = 'relative';
      }

      const currentLayout = layoutRef.current;
      const canvasScale = readCanvasPointerScale(el);
      const surfaceRect = surfaceEl.getBoundingClientRect();
      const surfaceCss = surfaceLayoutSize(surfaceEl, canvasScale);
      const box = readRect(el, surfaceRect, canvasScale);
      const useOffset = modeRef.current === 'offset';
      const preserveBoxSize = opts?.preserveBoxSize === true;

      const siblingEls = Array.from(
        surfaceEl.querySelectorAll<HTMLElement>('[data-lp-free-box="1"]'),
      ).filter((node) => node !== el && !node.contains(el) && !el.contains(node));
      const siblings = siblingEls.map((node) => readRect(node, surfaceRect, canvasScale));

      let originX: number;
      let originY: number;
      // Move/rotate/resize start: lock size from saved layout OR live CSS-space rect.
      // Never shrink via measureTightFreeSize on move — that caused card/section collapse + reflow.
      let dragW =
        currentLayout?.width && currentLayout.width > 0
          ? Math.min(surfaceCss.width, currentLayout.width)
          : Math.round(box.width);
      let dragH =
        currentLayout?.height && currentLayout.height > 0
          ? currentLayout.height
          : Math.round(box.height);
      const isButtonShell = Boolean(
        el.getAttribute('data-lp-button-shell') === '1' ||
          el.querySelector(
            '[data-lp-button-block],[data-lp-box-block],[data-lp-button-hit],[data-lp-box-hit]',
          ),
      );

      // Flow → free (no prior layout): for button/icon shells only, hug the visible control
      // via its own getBoundingClientRect — never union-of-text-nodes (collapses Features cards).
      if (!useOffset && !currentLayout && isButtonShell) {
        const hitEl = el.querySelector<HTMLElement>(
          '[data-lp-button-hit],[data-lp-box-hit],[data-lp-button-block],[data-lp-box-block]',
        );
        if (hitEl) {
          const hit = readRect(hitEl, surfaceRect, canvasScale);
          if (hit.width >= 8 && hit.height >= 8) {
            dragW = Math.min(surfaceCss.width, Math.max(40, Math.round(hit.width)));
            dragH = Math.max(28, Math.round(hit.height));
            box.left = hit.left;
            box.top = hit.top;
          }
        }
      }
      box.width = dragW;
      box.height = dragH;

      if (useOffset) {
        // Offset mode: x/y are translate deltas; box stays in document flow (never vanishes).
        originX = currentLayout?.x ?? 0;
        originY = currentLayout?.y ?? 0;
        // Clear any leftover absolute pin from older buggy builds.
        el.style.position = '';
        el.style.left = '';
        el.style.top = '';
        // Lock measured size so children do not reflow while dragging.
        el.style.width = `${dragW}px`;
        el.style.height = `${dragH}px`;
        el.style.minHeight = `${dragH}px`;
        el.style.maxWidth = 'none';
        el.style.boxSizing = 'border-box';
        el.style.margin = '';
        el.style.zIndex = '30';
      } else {
        // Absolute free: preserveBoxSize is the only path (move/rotate/resize all pass it).
        // Legacy shrink-on-move removed — resize handles own size changes.
        void preserveBoxSize;

        originX = currentLayout?.x ?? Math.max(0, box.left);
        originY = currentLayout?.y ?? Math.max(0, box.top);
        if (isButtonShell && !currentLayout) {
          originX = Math.max(0, box.left);
          originY = Math.max(0, box.top);
        }

        // Room to move on both axes — expand virtual canvas beyond short article height.
        const roomH = Math.max(
          surfaceCss.height,
          dragH + 560,
          originY + dragH + 240,
          box.top + dragH + 240,
        );
        const maxX0 = Math.max(0, surfaceCss.width - dragW);
        const maxY0 = Math.max(0, roomH - dragH);
        originX = Math.min(maxX0, Math.max(0, originX));
        originY = Math.min(maxY0, Math.max(0, originY));

        const rot0 = normalizeRotate(currentLayout?.rotate ?? 0);
        el.style.position = 'absolute';
        el.style.left = `${originX}px`;
        el.style.top = `${originY}px`;
        el.style.width = `${dragW}px`;
        el.style.height = `${dragH}px`;
        el.style.minHeight = `${dragH}px`;
        el.style.maxWidth = 'none';
        el.style.boxSizing = 'border-box';
        el.style.zIndex = '50';
        el.style.margin = '0';
        if (rot0) el.style.transform = `rotate(${rot0}deg)`;
        if (!currentLayout) syncCanvasFreeReserve(el);
      }

      const rotate = normalizeRotate(currentLayout?.rotate ?? 0);

      // For offset mode, snap/clamp against the visual box inside the surface.
      const movingLeft = useOffset ? box.left - (currentLayout?.x ?? 0) + originX : originX;
      const movingTop = useOffset ? box.top - (currentLayout?.y ?? 0) + originY : originY;
      const canvasH = Math.max(surfaceCss.height, dragH + 560, movingTop + dragH + 240);

      const clampToSafeArea = shouldClampToContentSafeArea(
        el,
        useOffset ? 'offset' : 'absolute',
      );
      const safeArea = clampToSafeArea
        ? resolveSurfaceContentSafeArea(surfaceEl, viewportRef.current)
        : null;

      const session: DragSession = {
        kind: 'move',
        pointerId,
        originX,
        originY,
        startClientX: clientX,
        startClientY: clientY,
        width: dragW,
        height: dragH,
        reserveHeight: currentLayout?.reserveHeight ?? box.height,
        rotate,
        shiftLock: shiftKey,
        el,
        canvasEl: surfaceEl,
        siblings,
        canvasBox: {
          id: 'surface',
          left: 0,
          top: 0,
          width: surfaceCss.width,
          height: canvasH,
        },
        safeArea,
        clampToSafeArea,
        raf: null,
        lastGuides: [],
        lastSpacings: [],
        lastX: originX,
        lastY: originY,
        lastW: dragW,
        lastH: dragH,
        lastRotate: rotate,
        canvasScale,
        pendingClientX: clientX,
        pendingClientY: clientY,
        pendingShift: shiftKey,
      };
      // Stash base flow position for offset clamp (natural left/top without current translate).
      session.baseLeft = useOffset ? box.left - (currentLayout?.x ?? 0) : 0;
      session.baseTop = useOffset ? box.top - (currentLayout?.y ?? 0) : 0;
      session.mode = useOffset ? 'offset' : 'absolute';
      sessionRef.current = session;
      el.setAttribute('data-lp-free-dragging', '1');
      el.style.willChange = 'transform';
      el.style.cursor = 'grabbing';
      try {
        el.setPointerCapture(pointerId);
      } catch {
        /* ignore */
      }
      setDragging(true);
    },
    [],
  );
  startSessionRef.current = startSession;

  const beginDrag = useCallback(
    (e: ReactPointerEvent, opts?: { force?: boolean; immediate?: boolean }) => {
      if (!enabledRef.current) return;
      if (isLpMarqueeSelecting()) return;
      if (e.button !== 0) return;
      const force = opts?.force === true;
      if (!force && !selectedRef.current) return;
      if (!force && isFreeDragBlockedTarget(e.target)) return;
      const el = shellRef.current;
      if (!el) return;
      if (el.querySelector('[data-lp-inline-editing="1"]')) return;
      if ((e.target as HTMLElement | null)?.closest?.('[data-lp-resize-handle],[data-lp-rotate-handle]')) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      pendingRef.current = null;
      if (opts?.immediate) {
        attachWindow(e.pointerId);
        // Move must never shrink — lock live getBoundingClientRect size.
        startSession(e.pointerId, e.clientX, e.clientY, e.shiftKey, { preserveBoxSize: true });
        return;
      }
      // Arm: wait for small move so click-to-select still works.
      pendingRef.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        shiftKey: e.shiftKey,
      };
      attachWindow(e.pointerId);
    },
    [attachWindow, startSession],
  );

  const beginResize = useCallback(
    (handle: FreeResizeHandle, e: ReactPointerEvent) => {
      if (!enabledRef.current || e.button !== 0) return;
      const el = shellRef.current;
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      pendingRef.current = null;
      attachWindow(e.pointerId);
      // Preserve current section box — do not shrink full-bleed width on resize start.
      startSession(e.pointerId, e.clientX, e.clientY, e.shiftKey, { preserveBoxSize: true });
      const s = sessionRef.current;
      if (!s) return;
      s.kind = 'resize';
      s.handle = handle;
      s.el.setAttribute('data-lp-free-resizing', '1');
      s.el.style.cursor = resizeHandleCursor(handle);
      s.el.style.height = `${s.height}px`;
      s.el.style.minHeight = `${s.height}px`;
      s.el.style.width = `${s.width}px`;
      if (s.mode !== 'offset') syncCanvasFreeReserve(s.el);
    },
    [attachWindow, startSession],
  );

  const beginRotate = useCallback(
    (e: ReactPointerEvent) => {
      if (!enabledRef.current || e.button !== 0) return;
      const el = shellRef.current;
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      pendingRef.current = null;
      attachWindow(e.pointerId);
      startSession(e.pointerId, e.clientX, e.clientY, e.shiftKey, { preserveBoxSize: true });
      const s = sessionRef.current;
      if (!s) return;
      s.kind = 'rotate';
      const rect = el.getBoundingClientRect();
      s.centerClientX = rect.left + rect.width / 2;
      s.centerClientY = rect.top + rect.height / 2;
      s.startPointerAngle = Math.atan2(e.clientY - s.centerClientY, e.clientX - s.centerClientX);
      s.el.setAttribute('data-lp-free-rotating', '1');
      s.el.style.cursor = 'grabbing';
      setLiveAngle(s.rotate);
    },
    [attachWindow, startSession],
  );

  // Keyboard nudge when selected + free
  useEffect(() => {
    if (!enabled || !selected || !layout) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (t?.closest?.('[data-lp-inline-editing="1"]')) return;
      if (
        e.key !== 'ArrowLeft' &&
        e.key !== 'ArrowRight' &&
        e.key !== 'ArrowUp' &&
        e.key !== 'ArrowDown'
      ) {
        return;
      }
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const next = { ...layout };
      if (e.key === 'ArrowLeft') next.x -= step;
      if (e.key === 'ArrowRight') next.x += step;
      if (e.key === 'ArrowUp') next.y -= step;
      if (e.key === 'ArrowDown') next.y += step;
      next.x = Math.max(0, next.x);
      next.y = Math.max(0, next.y);
      // Canvas minHeight after commit is owned solely by computeCanvasFreeReserveHeight
      // via LandingPageRenderer's own render + effect (see BUG-15) — no imperative
      // re-sync needed here.
      onCommit({ positionMode: 'free', freeLayout: next, viewport });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, selected, layout, onCommit, viewport]);

  return {
    shellRef,
    dragging,
    liveAngle,
    beginDrag,
    beginResize,
    beginRotate,
    isActive: () => Boolean(sessionRef.current || pendingRef.current),
    cancelPending: () => {
      if (sessionRef.current) return;
      pendingRef.current = null;
      detachWindow.current?.();
      detachWindow.current = null;
    },
  };
}

/**
 * Absolute free-layout plausibility bounds — single source for drag/resize gate
 * (`isPlausibleFreeLayout`) and Advanced Position clamp (`clampAbsoluteFreeLayout`).
 * Do not duplicate these numbers elsewhere.
 */
export const FREE_LAYOUT_ABSOLUTE_BOUNDS = {
  minPos: -40,
  maxPos: 2400,
  /** Sizes must be strictly > 0 and ≤ maxSize (matches isPlausibleFreeLayout). */
  minSize: 1,
  maxSize: 2400,
} as const;

export const FREE_LAYOUT_OFFSET_BOUNDS = {
  maxAbsPos: 640,
  maxSize: 1200,
} as const;

function clampNumber(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Clamp absolute freeLayout so freeLayoutStyle never returns undefined for typed inputs. */
export function clampAbsoluteFreeLayout(
  layout: LandingPageFreeLayout,
): LandingPageFreeLayout {
  const { minPos, maxPos, minSize, maxSize } = FREE_LAYOUT_ABSOLUTE_BOUNDS;
  const next: LandingPageFreeLayout = {
    ...layout,
    x: clampNumber(Number(layout.x) || 0, minPos, maxPos),
    y: clampNumber(Number(layout.y) || 0, minPos, maxPos),
  };
  if (layout.width != null && Number.isFinite(layout.width)) {
    next.width = clampNumber(layout.width, minSize, maxSize);
  }
  if (layout.height != null && Number.isFinite(layout.height)) {
    next.height = clampNumber(layout.height, minSize, maxSize);
    next.reserveHeight = next.height;
  } else if (layout.reserveHeight != null && Number.isFinite(layout.reserveHeight)) {
    next.reserveHeight = clampNumber(layout.reserveHeight, minSize, maxSize);
  }
  if (layout.rotate != null && Number.isFinite(layout.rotate)) {
    next.rotate = layout.rotate;
  }
  return next;
}

/**
 * Patch one Advanced Position field, then clamp the whole layout to absolute bounds.
 * Empty/cleared width|height|rotate stay undefined (optional fields).
 */
export function patchAbsoluteFreeLayoutField(
  prev: LandingPageFreeLayout,
  key: 'x' | 'y' | 'width' | 'height' | 'rotate',
  raw: number | undefined,
): LandingPageFreeLayout {
  const draft: LandingPageFreeLayout = { ...prev };
  if (raw == null || !Number.isFinite(raw)) {
    if (key === 'width' || key === 'height' || key === 'rotate') {
      delete (draft as { width?: number; height?: number; rotate?: number })[key];
      if (key === 'height') delete (draft as { reserveHeight?: number }).reserveHeight;
    } else {
      draft[key] = key === 'x' || key === 'y' ? 0 : draft[key];
    }
    return clampAbsoluteFreeLayout(draft);
  }
  if (key === 'x' || key === 'y') {
    draft[key] = raw;
  } else if (key === 'width' || key === 'height') {
    draft[key] = raw;
    if (key === 'height') draft.reserveHeight = raw;
  } else {
    draft.rotate = raw;
  }
  return clampAbsoluteFreeLayout(draft);
}

/** Drop absurd coords saved under the old canvas-relative bug (box "vanished"). */
export function isPlausibleFreeLayout(
  layout: LandingPageFreeLayout | null | undefined,
  kind: 'absolute' | 'offset' = 'absolute',
): boolean {
  if (!layout) return false;
  if (!Number.isFinite(layout.x) || !Number.isFinite(layout.y)) return false;
  if (kind === 'offset') {
    // Card translate deltas — keep modest so a bad save cannot shove the card away.
    const { maxAbsPos, maxSize } = FREE_LAYOUT_OFFSET_BOUNDS;
    if (Math.abs(layout.x) > maxAbsPos || Math.abs(layout.y) > maxAbsPos) return false;
    if (layout.width != null && (layout.width <= 0 || layout.width > maxSize)) return false;
    return true;
  }
  const { minPos, maxPos, maxSize } = FREE_LAYOUT_ABSOLUTE_BOUNDS;
  if (layout.x < minPos || layout.y < minPos) return false;
  if (layout.x > maxPos || layout.y > maxPos) return false;
  if (layout.width != null && (layout.width <= 0 || layout.width > maxSize)) return false;
  if (layout.height != null && (layout.height <= 0 || layout.height > maxSize)) return false;
  if (layout.rotate != null && !Number.isFinite(layout.rotate)) return false;
  return true;
}

export function freeLayoutStyle(
  layout: LandingPageFreeLayout | null,
  dragging: boolean,
  mode: 'absolute' | 'offset' = 'absolute',
): CSSProperties | undefined {
  if (!layout || !isPlausibleFreeLayout(layout, mode)) return undefined;
  const rot = normalizeRotate(layout.rotate ?? 0);
  // During an active gesture the live DOM owns left/top/width/height/transform.
  // Returning committed geometry here would fight pointer updates on React re-render
  // (setDragging) and cause jump/jitter under zoom.
  if (dragging) {
    if (mode === 'offset') {
      return {
        position: 'relative',
        zIndex: 30,
        boxSizing: 'border-box',
        maxWidth: 'none',
      };
    }
    return {
      position: 'absolute',
      zIndex: 50,
      margin: 0,
      boxSizing: 'border-box',
      overflow: 'visible',
      maxWidth: 'none',
    };
  }
  if (mode === 'offset') {
    return {
      position: 'relative',
      transform: `translate3d(${layout.x}px, ${layout.y}px, 0)${rot ? ` rotate(${rot}deg)` : ''}`,
      zIndex: 5,
      ...(layout.width ? { width: layout.width, maxWidth: 'none' } : null),
      // minHeight:0 + overflow:hidden together, not just `height` alone: this
      // element is a CSS grid/flex item (the cards grid — data-lp-cards-grid).
      // Grid/flex items get an implicit "automatic minimum size" equal to their
      // CONTENT's min-content height unless overflow is something other than
      // visible — so an explicit smaller `height` here was silently overridden
      // back up to fit the (icon+title+paragraph) content by the grid algorithm
      // itself, before the box model even got a chance to clip anything. This is
      // why dragging a card's resize handle shorter visually did nothing.
      ...(layout.height
        ? { height: layout.height, minHeight: 0, overflow: 'hidden' as const }
        : null),
      boxSizing: 'border-box',
    };
  }
  return {
    position: 'absolute',
    left: layout.x,
    top: layout.y,
    ...(layout.width ? { width: layout.width, maxWidth: 'none' } : null),
    // Hard height for free sections so reserved canvas space matches painted box.
    // Content that outgrows triggers grow-only commit → reflow siblings.
    ...(layout.height
      ? { height: layout.height, minHeight: layout.height, boxSizing: 'border-box' as const }
      : {
          minHeight: Math.max(1, Math.round(layout.reserveHeight || 120)),
          boxSizing: 'border-box' as const,
        }),
    transform: rot ? `rotate(${rot}deg)` : undefined,
    zIndex: 5,
    margin: 0,
    overflow: 'visible',
  };
}

const RESIZE_HANDLES: FreeResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

/** 8 resize handles + top rotate handle (Canva-style). */
export function FreeTransformChrome({
  visible,
  hideHandles = false,
  liveAngle,
  onResizePointerDown,
  onRotatePointerDown,
}: {
  visible: boolean;
  /** Hide handles during active transform but keep angle badge. */
  hideHandles?: boolean;
  liveAngle: number | null;
  onResizePointerDown: (handle: FreeResizeHandle, e: ReactPointerEvent) => void;
  onRotatePointerDown: (e: ReactPointerEvent) => void;
}) {
  if (!visible && liveAngle == null) return null;
  return (
    <div
      data-lp-transform-chrome="1"
      className="pointer-events-none absolute inset-0 z-[18]"
      aria-hidden
    >
      {/* Rotate stick */}
      {!hideHandles ? (
        <div className="pointer-events-none absolute left-1/2 top-0 flex -translate-x-1/2 -translate-y-full flex-col items-center">
          <button
            type="button"
            data-lp-rotate-handle
            title="Xoay (giữ Shift để snap 15°)"
            className="pointer-events-auto mb-1 flex h-5 w-5 cursor-grab items-center justify-center rounded-full border-2 border-[#F97316] bg-white text-[#F97316] shadow-sm active:cursor-grabbing"
            onPointerDown={(e) => onRotatePointerDown(e)}
          >
            <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden>
              <path
                fill="currentColor"
                d="M10 4V1L8.5 2.5A5 5 0 1 0 11 7h-1.1A3.9 3.9 0 1 1 8.1 3.1L10 4z"
              />
            </svg>
          </button>
          <div className="h-3 w-px bg-[#F97316]" />
        </div>
      ) : null}
      {liveAngle != null ? (
        <span
          data-lp-rotate-angle
          className="pointer-events-none absolute left-1/2 top-0 z-[19] -translate-x-1/2 -translate-y-[calc(100%+28px)] rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow"
        >
          {Math.round(liveAngle)}°
        </span>
      ) : null}

      {!hideHandles
        ? RESIZE_HANDLES.map((handle) => {
            const cursor = resizeHandleCursor(handle);
            const pos: CSSProperties = {};
            if (handle.includes('n')) pos.top = -5;
            if (handle.includes('s')) pos.bottom = -5;
            if (handle.includes('w')) pos.left = -5;
            if (handle.includes('e')) pos.right = -5;
            if (handle === 'n' || handle === 's') {
              pos.left = '50%';
              pos.transform = 'translateX(-50%)';
            }
            if (handle === 'e' || handle === 'w') {
              pos.top = '50%';
              pos.transform = 'translateY(-50%)';
            }
            return (
              <button
                key={handle}
                type="button"
                data-lp-resize-handle={handle}
                title="Resize"
                className="pointer-events-auto absolute h-2.5 w-2.5 rounded-sm border-2 border-[#F97316] bg-white shadow-sm"
                style={{ ...pos, cursor }}
                onPointerDown={(e) => onResizePointerDown(handle, e)}
              />
            );
          })
        : null}
    </div>
  );
}

export function FreeDragHandle({ title = 'Kéo tự do' }: { title?: string }) {
  return (
    <>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
        <path
          fill="currentColor"
          d="M4 1h1v1H4V1zm3 0h1v1H7V1zM4 4h1v1H4V4zm3 0h1v1H7V4zM4 7h1v1H4V7zm3 0h1v1H7V7zM1 4h1v1H1V4zm0 3h1v1H1V7zm9-3h1v1h-1V4zm0 3h1v1h-1V7zM4 10h1v1H4v-1zm3 0h1v1H7v-1z"
        />
      </svg>
      <span className="hidden sm:inline">{title === 'Kéo tự do' ? 'Tự do' : title}</span>
    </>
  );
}

export function FlowReserve({
  height,
  editor = false,
}: {
  height?: number;
  /** Builder canvas: show dashed placeholder so free-holes aren't mistaken for empty sections. */
  editor?: boolean;
}) {
  // Always reserve positive space when called for a free section — never collapse slot.
  const h = !height || height <= 0 ? 120 : Math.max(1, Math.round(height));
  if (!editor) {
    return (
      <div
        data-lp-flow-reserve="1"
        data-lp-flow-reserve-fallback={!height || height <= 0 ? '1' : undefined}
        aria-hidden
        style={{
          height: h,
          width: '100%',
          pointerEvents: 'none',
          visibility: 'hidden',
          margin: 0,
          padding: 0,
          border: 0,
        }}
      />
    );
  }
  return (
    <div
      data-lp-flow-reserve="1"
      data-lp-flow-reserve-fallback={!height || height <= 0 ? '1' : undefined}
      aria-hidden
      title="Khoảng giữ chỗ section (free) — click để chọn / Delete để xóa section"
      style={{
        height: h,
        width: '100%',
        pointerEvents: 'auto',
        cursor: 'pointer',
        margin: 0,
        padding: 0,
        border: 0,
        boxSizing: 'border-box',
        background:
          'repeating-linear-gradient(-45deg,rgba(249,115,22,0.06),rgba(249,115,22,0.06) 8px,rgba(249,115,22,0.02) 8px,rgba(249,115,22,0.02) 16px)',
        outline: '1px dashed rgba(249,115,22,0.35)',
        outlineOffset: -1,
      }}
    />
  );
}
