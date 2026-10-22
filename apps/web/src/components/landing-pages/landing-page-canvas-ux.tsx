'use client';

/**
 * Additive canvas UX helpers for Landing Page Builder.
 * Hardened for: touch select, toolbar placement, nested reorder safety.
 */

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type TouchEvent,
} from 'react';
import { createPortal } from 'react-dom';
import type { LandingPageFreeLayout } from '@marketingspa/shared';
import { applyResizeHandle, resizeHandleCursor } from '@marketingspa/shared';
import {
  FreeDragHandle,
  FreeTransformChrome,
  cancelAllFreeDrags,
  freeLayoutStyle,
  isFreeDragBlockedTarget,
  isPlausibleFreeLayout,
  readCanvasPointerScale,
  useFreeDragBox,
  type FreeResizeHandle,
} from './landing-page-free-drag';
import {
  LP_SIDEBAR_PRESET_MIME,
  isSidebarPresetDrag,
  parseSidebarPresetPayload,
} from './landing-page-sidebar-dnd';
import { SectionBackgroundToolbar } from './landing-page-section-background-toolbar';
import { readElementCustomCssStyle, safeCustomClassName } from './landing-page-block-design-style';
import {
  collectMarqueeTargetsInBlock,
  findTextAnchorEl,
  isLpMarqueeSelecting,
  isSectionLevelElement,
  isSectionToolbarElement,
  isTextToolbarTarget,
  lpSelectionKey,
  normalizeClientRect,
  normalizeLpSelectionTarget,
  parseLpSelectionKey,
  setLpMarqueeSelecting,
  type LpSelectionTarget,
  type LpSelectOptions,
} from './landing-page-canvas-selection';

export type LandingPageCanvasElementKey =
  | 'section'
  | 'section-background'
  | 'headline'
  | 'subheadline'
  | 'body'
  | 'cta'
  | 'form'
  | 'image'
  | `item:${string}`
  | `grid:${number}`
  | `countdown:${string}`;

export type LandingPageCanvasSelection = {
  blockId: string;
  element?: LandingPageCanvasElementKey;
  /** Disambiguates nested text fields (itemTitle vs itemDesc). */
  field?: string;
};

export type LandingPageCanvasHandlers = {
  selection: LandingPageCanvasSelection | null;
  /** All selected element keys (`blockId::field:…` or `blockId::element`). */
  selectedElementIds: string[];
  /** Primary target for toolbar / inspector focus. */
  primarySelectedId: string | null;
  onSelect: (
    next: LandingPageCanvasSelection,
    opts?: LpSelectOptions,
  ) => void;
  /** Marquee rubber-band select within a section (empty-area drag). */
  onMarqueeSelect?: (targets: LpSelectionTarget[], opts?: LpSelectOptions) => void;
  isSelected: (target: {
    blockId: string;
    element?: LandingPageCanvasElementKey;
    field?: string;
  }) => boolean;
  isPrimarySelected: (target: {
    blockId: string;
    element?: LandingPageCanvasElementKey;
    field?: string;
  }) => boolean;
  isSectionPrimary: (blockId: string) => boolean;
  onDeselect: () => void;
  onFieldLive: (blockId: string, field: string, value: string) => void;
  onFieldCommit: (blockId: string, field: string, value: string) => void;
  /** Duplicate nested card/item when selection is item:…; otherwise duplicates the block. */
  onDuplicate: (blockId: string) => void;
  onDuplicateItem?: (blockId: string, itemId: string) => void;
  onDelete: (blockId: string) => void;
  onMove: (blockId: string, direction: 'up' | 'down') => void;
  onReorderBlock: (fromBlockId: string, toBlockId: string) => void;
  /** Stable item ids — never cross parent sections. */
  onReorderItem: (blockId: string, fromItemId: string, toItemId: string) => void;
  /** Drop sidebar preset onto a section (insert before this block). */
  onInsertSidebarPreset?: (
    payload: import('./landing-page-sidebar-dnd').LpSidebarPresetPayload,
    pos: import('./landing-page-sidebar-dnd').LpSidebarInsertPos,
  ) => void;
  /** Apply image URL onto a shape frame / grid cell (Đồ họa). */
  onApplyBlockImage?: (blockId: string, url: string, opts?: { gridIndex?: number }) => void;
  onAi: (blockId: string) => void;
  onReplaceImage: (blockId: string) => void;
  /** Toggle section free position (toolbar «Tự do» — not drag). */
  onToggleFreePosition?: (blockId: string) => void;
  canReplaceImage?: (blockId: string) => boolean;
  /** Optional per-field canvas text styles (no HTML). */
  getTextStyle?: (blockId: string, field: string) => LandingPageInlineTextStyle | undefined;
  onTextStyleChange?: (
    blockId: string,
    field: string,
    patch: Partial<LandingPageInlineTextStyle>,
  ) => void;
  /** Builder viewport for free-layout resolve / commit. */
  viewport?: 'desktop' | 'tablet' | 'mobile';
  /** Resolved free layout for a block (null = flow). */
  getBlockFreeLayout?: (blockId: string) => import('@marketingspa/shared').LandingPageFreeLayout | null;
  /** Commit free-drag drop (one history entry). */
  onFreeLayoutCommit?: (
    blockId: string,
    payload: {
      positionMode: 'free';
      freeLayout: import('@marketingspa/shared').LandingPageFreeLayout;
      viewport: 'desktop' | 'tablet' | 'mobile';
    },
  ) => void;
  /** Item free-layout within a section. */
  getItemFreeLayout?: (
    blockId: string,
    itemId: string,
  ) => import('@marketingspa/shared').LandingPageFreeLayout | null;
  onItemFreeLayoutCommit?: (
    blockId: string,
    itemId: string,
    payload: {
      positionMode: 'free';
      freeLayout: import('@marketingspa/shared').LandingPageFreeLayout;
      viewport: 'desktop' | 'tablet' | 'mobile';
    },
  ) => void;
  /** Inline text / child element free offsets within a section. */
  getElementFreeLayout?: (
    blockId: string,
    field: string,
  ) => import('@marketingspa/shared').LandingPageFreeLayout | null;
  onElementFreeLayoutCommit?: (
    blockId: string,
    field: string,
    payload: {
      positionMode: 'free';
      freeLayout: import('@marketingspa/shared').LandingPageFreeLayout;
      viewport: 'desktop' | 'tablet' | 'mobile';
    },
  ) => void;
  /** Text-box 8-handle resize — width/height + offset in ONE history entry. */
  onTextBoxResizeCommit?: (
    blockId: string,
    field: string,
    payload: {
      width: number;
      height: number;
      freeLayout: import('@marketingspa/shared').LandingPageFreeLayout;
      viewport: 'desktop' | 'tablet' | 'mobile';
    },
  ) => void;
  /** Section-background context toolbar actions (additive). */
  onSectionBackgroundAction?: (
    blockId: string,
    action: import('./landing-page-section-background-toolbar').SectionBackgroundToolbarAction,
  ) => void;
  /** Content-image toolbar (same actions, different data model). */
  onContentImageAction?: (
    blockId: string,
    element: LandingPageCanvasElementKey | undefined,
    action: import('./landing-page-section-background-toolbar').ContentImageToolbarAction,
  ) => void;
  /** Resolved paint flags for bg toolbar. */
  getSectionBackgroundMeta?: (blockId: string) => {
    hasImage: boolean;
    hasAnyBg: boolean;
    motion?: string;
    zIndex?: number;
  };
  /** Meta for content-image toolbar (block / item / grid). */
  getContentImageMeta?: (
    blockId: string,
    element?: LandingPageCanvasElementKey,
  ) => { hasImage: boolean; hasAnyBg: boolean };
  /** Per-element custom class from Inspector Custom Class/CSS. */
  getElementCustomClass?: (blockId: string, element: LandingPageCanvasElementKey | string) => string;
  /** Per-element custom CSS declarations → inline style (overrides theme defaults). */
  getElementCustomCssStyle?: (
    blockId: string,
    element: LandingPageCanvasElementKey | string,
  ) => import('react').CSSProperties;
  /** Canvas paint for bg image + flip (underlay). */
  getSectionBackgroundPaint?: (blockId: string) => CSSProperties | null;
  /** Quick text toolbar — extended actions (reuse builder/context-menu flows). */
  onTextToolbarCopy?: (blockId: string) => void;
  onTextToolbarCopyStyle?: (blockId: string) => void;
  onTextToolbarSaveAsset?: (blockId: string, field: string) => void;
  onTextToolbarSyncFromMobile?: (blockId: string, field: string) => void;
  onTextToolbarToggleHidden?: (blockId: string, field: string) => void;
  onTextToolbarToggleLock?: (blockId: string, field: string) => void;
  onTextToolbarAiPrompt?: (blockId: string, field: string, anchorRect: DOMRect) => void;
  isTextElementHidden?: (blockId: string, field: string) => boolean;
  isTextElementLocked?: (blockId: string, field: string) => boolean;
  /** Section-level lock (right-click Khóa) — blocks move/edit/free-drag. */
  isBlockLocked?: (blockId: string) => boolean;
};

/** Text inline fields that show the horizontal quick toolbar (not section/image). */
export function isTextToolbarElement(el?: LandingPageCanvasElementKey | null): boolean {
  if (!el || el === 'section' || el === 'section-background' || el === 'image') return false;
  if (el === 'headline' || el === 'subheadline' || el === 'body' || el === 'cta') return true;
  if (typeof el === 'string' && el.startsWith('item:')) return true;
  return false;
}

/** Additive plain-text style map — never stores HTML. */
export type LandingPageInlineTextStyle = {
  fontSize?: number;
  fontSizeUnit?: 'px' | 'rem';
  fontWeight?: 'normal' | 'bold' | number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  color?: string;
  fontFamily?: string;
  fontStyle?: 'normal' | 'italic';
  textTransform?: 'none' | 'uppercase' | 'capitalize' | 'lowercase';
  textDecoration?: string;
  letterSpacing?: string;
  lineHeight?: number | string;
  /** Letter fill via background-clip (e.g. DISCOVER gradient). */
  backgroundImage?: string;
  backgroundClip?: 'text';
  webkitTextFillColor?: string;
  /** Semantic heading tag level (h1–h6) for headline fields. */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Text box width in px — L/R + corner resize + reflow. */
  width?: number;
  /** Text box height in px — corner resize. */
  height?: number;
};

export const LP_HEADING_LEVEL_PRESETS: Record<
  1 | 2 | 3 | 4 | 5 | 6,
  { fontSize: number; fontWeight: number }
> = {
  1: { fontSize: 36, fontWeight: 800 },
  2: { fontSize: 28, fontWeight: 700 },
  3: { fontSize: 22, fontWeight: 700 },
  4: { fontSize: 18, fontWeight: 600 },
  5: { fontSize: 16, fontWeight: 600 },
  6: { fontSize: 14, fontWeight: 600 },
};

export const LP_TEXT_FONT_OPTIONS: Array<{ label: string; value: string }> = [
  { label: 'System', value: 'system-ui, sans-serif' },
  { label: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Montserrat', value: '"Montserrat", system-ui, sans-serif' },
  { label: 'Playfair', value: '"Playfair Display", Georgia, serif' },
  { label: 'Oswald', value: '"Oswald", system-ui, sans-serif' },
  { label: 'Mulish', value: '"Mulish", system-ui, sans-serif' },
  { label: 'Cormorant', value: '"Cormorant Garamond", Georgia, serif' },
  { label: 'Lobster', value: '"Lobster", cursive' },
  { label: 'Great Vibes', value: '"Great Vibes", cursive' },
];

export const LP_BLOCK_MIME = 'application/x-lp-block-id';
export const LP_ITEM_MIME = 'application/x-lp-item';

const TAP_MOVE_PX = 10;

function isInteractiveCanvasChild(t: HTMLElement | null): boolean {
  if (!t?.closest) return false;
  return Boolean(
      t.closest('[data-lp-inline-field]') ||
      t.closest('[data-lp-element-id]') ||
      t.closest('[data-lp-content-image]') ||
      t.closest('[data-lp-box-hit]') ||
      t.closest('[data-lp-form-hit]') ||
      t.closest('[data-lp-button-hit]') ||
      t.closest('[data-lp-cta-body]') ||
      t.closest('[data-lp-grid-cell]') ||
      t.closest('[data-lp-item-handle]') ||
      t.closest('[data-lp-floating-toolbar]') ||
      t.closest('[data-lp-free-drag-handle]') ||
      t.closest('[data-lp-section-handle]') ||
      t.closest('[data-lp-resize-handle]') ||
      t.closest('[data-lp-rotate-handle]') ||
      t.closest('[data-lp-inline-editing="1"]') ||
      t.closest('a[href], button, input, textarea, select'),
  );
}

/** Strip HTML / rich paste → plain text (preserve newlines). */
export function sanitizeInlinePasteText(raw: string): string {
  const html = String(raw || '');
  if (!html.includes('<')) {
    return html.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ');
  }
  if (typeof document === 'undefined') {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\r\n/g, '\n');
  }
  const div = document.createElement('div');
  div.innerHTML = html;
  const text = div.innerText || div.textContent || '';
  return text.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ');
}

export function styleKeyForInlineField(blockId: string, field: string): string {
  return `${blockId}::${field}`;
}

export function readInlineTextStyles(
  meta: Record<string, unknown> | null | undefined,
): Record<string, LandingPageInlineTextStyle> {
  const raw = meta && typeof meta === 'object' ? (meta as { inlineTextStyles?: unknown }).inlineTextStyles : null;
  if (!raw || typeof raw !== 'object') return {};
  return raw as Record<string, LandingPageInlineTextStyle>;
}

export function readElementFreeLayouts(
  meta: Record<string, unknown> | null | undefined,
): Record<string, LandingPageFreeLayout> {
  const raw =
    meta && typeof meta === 'object'
      ? (meta as { elementFreeLayouts?: unknown }).elementFreeLayouts
      : null;
  if (!raw || typeof raw !== 'object') return {};
  return raw as Record<string, LandingPageFreeLayout>;
}

/** Shared Builder/Preview/Public meta for toolbar styles + element free-layouts (no handlers). */
export type LpPublicRenderMeta = {
  inlineTextStyles: Record<string, LandingPageInlineTextStyle>;
  elementFreeLayouts: Record<string, LandingPageFreeLayout>;
};

const LpPublicRenderMetaContext = createContext<LpPublicRenderMeta | null>(null);

export function LandingPagePublicMetaProvider({
  meta,
  children,
}: {
  meta: Record<string, unknown> | null | undefined;
  children: ReactNode;
}) {
  const value = useMemo<LpPublicRenderMeta>(
    () => ({
      inlineTextStyles: readInlineTextStyles(meta),
      elementFreeLayouts: readElementFreeLayouts(meta),
    }),
    [meta],
  );
  return (
    <LpPublicRenderMetaContext.Provider value={value}>{children}</LpPublicRenderMetaContext.Provider>
  );
}

export function useLpPublicRenderMeta(): LpPublicRenderMeta | null {
  return useContext(LpPublicRenderMetaContext);
}

export function elementKeyForField(field: string): LandingPageCanvasElementKey {
  if (field === 'ctaLabel') return 'cta';
  if (field === 'body') return 'body';
  if (field === 'headline' || field === 'subheadline') return field;
  // itemTitle:xyz / planName:xyz / fieldLabel:xyz → item:xyz selection
  const m = /^(?:itemTitle|itemDesc|itemQuestion|itemAnswer|itemQuote|itemAuthor|planName|planPrice|planCta|fieldLabel):(.+)$/.exec(
    field,
  );
  if (m?.[1]) return `item:${m[1]}`;
  const cd = /^countdownCell:(.+)$/.exec(field);
  if (cd?.[1]) return `countdown:${cd[1].toLowerCase()}`;
  return 'section';
}

export function parseElementKey(raw: string | null | undefined): LandingPageCanvasElementKey | undefined {
  if (!raw || raw === 'section') return 'section';
  if (raw === 'section-background') return 'section-background';
  if (
    raw === 'headline' ||
    raw === 'subheadline' ||
    raw === 'body' ||
    raw === 'cta' ||
    raw === 'form' ||
    raw === 'image'
  ) {
    return raw;
  }
  if (raw.startsWith('item:')) return raw as LandingPageCanvasElementKey;
  if (raw.startsWith('countdown:')) return raw as LandingPageCanvasElementKey;
  if (raw.startsWith('grid:') && /^\d+$/.test(raw.slice(5))) {
    return raw as LandingPageCanvasElementKey;
  }
  return 'section';
}

/** Offset free-drag for text / nested canvas elements (headline, image chrome, countdown cells). */
export function useCanvasElementFreeDrag({
  blockId,
  field,
  handlers,
  selected,
  paused = false,
}: {
  blockId: string;
  field: string;
  handlers?: LandingPageCanvasHandlers | null;
  selected: boolean;
  paused?: boolean;
}) {
  const publicMeta = useLpPublicRenderMeta();
  const viewport = handlers?.viewport || 'desktop';
  const layoutRaw =
    handlers?.getElementFreeLayout?.(blockId, field) ??
    publicMeta?.elementFreeLayouts[styleKeyForInlineField(blockId, field)] ??
    null;
  const layout = isPlausibleFreeLayout(layoutRaw, 'offset') ? layoutRaw : null;
  const freeEnabled = Boolean(handlers?.onElementFreeLayoutCommit) && !paused;

  const freeDrag = useFreeDragBox({
    enabled: freeEnabled,
    selected: Boolean(selected),
    viewport,
    layout,
    mode: 'offset',
    onCommit: (payload) => handlers?.onElementFreeLayoutCommit?.(blockId, field, payload),
  });

  const bindShellRef = (node: HTMLElement | null) => {
    freeDrag.shellRef.current = node as HTMLDivElement | null;
  };

  const shellStyle = freeLayoutStyle(layout, freeDrag.dragging, 'offset');

  const armDrag = (e: PointerEvent) => {
    if (selected && freeEnabled) freeDrag.beginDrag(e, { force: true });
  };

  const consumePointerUpForDrag = () => {
    if (!freeDrag.isActive()) return false;
    if (!freeDrag.dragging) freeDrag.cancelPending();
    return freeDrag.dragging;
  };

  return {
    freeDrag,
    freeEnabled,
    layout,
    bindShellRef,
    shellStyle,
    armDrag,
    consumePointerUpForDrag,
    showTransformChrome: freeEnabled && selected,
  };
}

function isTouchLike(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(hover: none), (pointer: coarse)').matches;
}

/** Soft outline — outline only (no layout shift). Hover styles gated to fine pointers. */
export function SelectableShell({
  blockId,
  label,
  selected,
  selectedElement,
  handlers,
  children,
  allowReorder = true,
  designClassName,
  publicFreeLayout = null,
}: {
  blockId: string;
  label?: string;
  selected?: boolean;
  selectedElement?: LandingPageCanvasElementKey;
  handlers?: LandingPageCanvasHandlers | null;
  children: ReactNode;
  allowReorder?: boolean;
  /** Optional custom class from Design tab (block.style.className). */
  designClassName?: string;
  /**
   * Public/Preview free-position (no handlers). Absolute section layout from
   * block.positionMode/freeLayout — render-only, no edit chrome.
   */
  publicFreeLayout?: import('@marketingspa/shared').LandingPageFreeLayout | null;
}) {
  const cls = safeCustomClassName(designClassName);
  if (!handlers) {
    const freeStyle = freeLayoutStyle(publicFreeLayout ?? null, false);
    return (
      <div
        data-lp-block-id={blockId}
        data-lp-design-shell="1"
        data-lp-section-chrome="1"
        data-lp-free-box={freeStyle ? '1' : undefined}
        data-lp-position-mode={freeStyle ? 'free' : 'flow'}
        data-lp-public-free={freeStyle ? '1' : undefined}
        className={cls || undefined}
        style={freeStyle}
      >
        {children}
      </div>
    );
  }
  return (
    <SelectableShellInteractive
      blockId={blockId}
      label={label}
      selected={selected}
      selectedElement={selectedElement}
      handlers={handlers}
      allowReorder={allowReorder}
      designClassName={cls}
    >
      {children}
    </SelectableShellInteractive>
  );
}

function SelectableShellInteractive({
  blockId,
  label,
  selected,
  selectedElement,
  handlers,
  children,
  allowReorder = true,
  designClassName,
}: {
  blockId: string;
  label?: string;
  selected?: boolean;
  selectedElement?: LandingPageCanvasElementKey;
  handlers: LandingPageCanvasHandlers;
  children: ReactNode;
  allowReorder?: boolean;
  designClassName?: string;
}) {
  const sectionPrimary = handlers.isSectionPrimary?.(blockId) ?? false;
  const sectionInSelection = Boolean(
    selected ||
      handlers.isSelected?.({ blockId, element: 'section' }) ||
      handlers.isSelected?.({ blockId, element: 'section-background' }),
  );
  const primaryTarget = handlers.primarySelectedId
    ? parseLpSelectionKey(handlers.primarySelectedId)
    : null;
  const isBgSelected = sectionPrimary && selectedElement === 'section-background';
  const imageMeta = handlers.getContentImageMeta?.(blockId, selectedElement) || {
    hasImage: false,
    hasAnyBg: false,
  };
  const isImageTarget =
    Boolean(
      primaryTarget &&
        primaryTarget.blockId === blockId &&
        !primaryTarget.field &&
        (primaryTarget.element === 'image' ||
          (typeof primaryTarget.element === 'string' && primaryTarget.element.startsWith('grid:')) ||
          (typeof primaryTarget.element === 'string' &&
            primaryTarget.element.startsWith('item:') &&
            imageMeta.hasImage)),
    );
  const showImageToolbar = Boolean(isImageTarget && imageMeta.hasImage);
  const isTextFieldSelected = Boolean(
    primaryTarget &&
      primaryTarget.blockId === blockId &&
      isTextToolbarTarget(primaryTarget),
  );
  const isSectionSelected = sectionPrimary && isSectionToolbarElement(selectedElement);
  const isSectionMultiChrome =
    sectionInSelection && !sectionPrimary && !isTextFieldSelected;
  // Keep existing section toolbar; swap to BG / Image / text toolbar when those targets selected.
  const showToolbar =
    sectionPrimary &&
    !isTextFieldSelected &&
    selectedElement !== 'section-background' &&
    !showImageToolbar &&
    isSectionToolbarElement(selectedElement);
  const showBgToolbar = Boolean(isBgSelected);
  const pointerRef = useRef<{
    x: number;
    y: number;
    moved: boolean;
    shiftKey: boolean;
    dragHandle: boolean;
    marquee: boolean;
  } | null>(null);
  const [marqueeRect, setMarqueeRect] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const viewport = handlers.viewport || 'desktop';
  const layout = handlers.getBlockFreeLayout?.(blockId) ?? null;
  const sectionLocked = Boolean(handlers.isBlockLocked?.(blockId));
  const freeEnabled = Boolean(handlers.onFreeLayoutCommit) && !sectionLocked;
  const bgMeta = handlers.getSectionBackgroundMeta?.(blockId) || {
    hasImage: false,
    hasAnyBg: false,
    motion: undefined,
  };

  const [buttonLike, setButtonLike] = useState(false);

  const freeDrag = useFreeDragBox({
    enabled: freeEnabled,
    selected: Boolean(sectionPrimary && isSectionLevelElement(selectedElement)),
    viewport,
    layout,
    onCommit: (payload) => handlers.onFreeLayoutCommit?.(blockId, payload),
  });

  const combinedRef = (node: HTMLDivElement | null) => {
    freeDrag.shellRef.current = node;
    if (node) {
      setButtonLike(
        Boolean(
          node.querySelector(
            '[data-lp-button-block],[data-lp-button-group-block],[data-lp-box-block],[data-lp-transformable]',
          ),
        ),
      );
    } else {
      setButtonLike(false);
    }
  };

  /** When section is in free mode, body drag is allowed (handle ✥ or shell padding). */
  const canArmSectionBodyFreeDrag = (target: EventTarget | null) => {
    if (!sectionPrimary || !freeEnabled || !layout) return false;
    return !isFreeDragBlockedTarget(target);
  };

  const armSectionPointer = (e: PointerEvent, opts?: { fromBgHit?: boolean }) => {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement | null;
    const onFreeHandle = Boolean(t?.closest?.('[data-lp-free-drag-handle]'));
    if (!opts?.fromBgHit && isInteractiveCanvasChild(t)) {
      if (!canArmSectionBodyFreeDrag(e.target)) return;
    }
    const freeDragIntent = canArmSectionBodyFreeDrag(e.target) || onFreeHandle;
    pointerRef.current = {
      x: e.clientX,
      y: e.clientY,
      moved: false,
      shiftKey: e.shiftKey,
      dragHandle: freeDragIntent,
      marquee: false,
    };
    if (onFreeHandle) {
      freeDrag.beginDrag(e, { force: true, immediate: true });
      return;
    }
    if (freeDragIntent) {
      freeDrag.beginDrag(e, { force: true });
      return;
    }
    attachMarqueeWin();
  };

  const updateMarqueeVisual = (x0: number, y0: number, x1: number, y1: number) => {
    const norm = normalizeClientRect(x0, y0, x1, y1);
    setMarqueeRect({
      left: norm.left,
      top: norm.top,
      width: norm.width,
      height: norm.height,
    });
  };

  const finishMarquee = (clientX: number, clientY: number, shiftKey: boolean) => {
    const shell = freeDrag.shellRef.current;
    if (!shell) return;
    const p = pointerRef.current;
    if (!p) return;
    const norm = normalizeClientRect(p.x, p.y, clientX, clientY);
    if (norm.width >= TAP_MOVE_PX || norm.height >= TAP_MOVE_PX) {
      const targets = collectMarqueeTargetsInBlock(shell, norm);
      handlers.onMarqueeSelect?.(targets, { shiftKey });
    }
  };

  const clearMarquee = () => {
    setMarqueeRect(null);
    setLpMarqueeSelecting(false);
    if (pointerRef.current) pointerRef.current.marquee = false;
  };

  const marqueeWinCleanupRef = useRef<(() => void) | null>(null);
  const detachMarqueeWin = () => {
    marqueeWinCleanupRef.current?.();
    marqueeWinCleanupRef.current = null;
  };

  const handleSectionPointerUp = (clientX: number, clientY: number) => {
    if (freeDrag.isActive()) {
      if (!freeDrag.dragging) {
        freeDrag.cancelPending();
      } else {
        pointerRef.current = null;
        clearMarquee();
        detachMarqueeWin();
        return;
      }
    }
    const p = pointerRef.current;
    pointerRef.current = null;
    detachMarqueeWin();
    if (!p) {
      clearMarquee();
      return;
    }
    if (p.marquee) {
      finishMarquee(clientX, clientY, p.shiftKey);
      clearMarquee();
      return;
    }
    if (p.moved || p.dragHandle) {
      clearMarquee();
      return;
    }
    return p;
  };

  const attachMarqueeWin = () => {
    detachMarqueeWin();
    const onMove: EventListener = (ev) => {
      const pe = ev as unknown as globalThis.PointerEvent;
      const p = pointerRef.current;
      if (!p || freeDrag.dragging || p.dragHandle) return;
      const dx = Math.abs(pe.clientX - p.x);
      const dy = Math.abs(pe.clientY - p.y);
      if (dx <= TAP_MOVE_PX && dy <= TAP_MOVE_PX) return;
      p.moved = true;
      if (!p.marquee) {
        p.marquee = true;
        setLpMarqueeSelecting(true);
        freeDrag.cancelPending?.();
      }
      updateMarqueeVisual(p.x, p.y, pe.clientX, pe.clientY);
    };
    const onUp: EventListener = (ev) => {
      const pe = ev as unknown as globalThis.PointerEvent;
      // pointercancel (mobile scroll steal) must clear marquee flag the same as pointerup —
      // otherwise isLpMarqueeSelecting stays true and freezes all section select/drag.
      handleSectionPointerUp(pe.clientX, pe.clientY);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    marqueeWinCleanupRef.current = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  };

  useEffect(
    () => () => {
      setLpMarqueeSelecting(false);
      detachMarqueeWin();
    },
    [],
  );

  const isSectionTransformTarget =
    !selectedElement ||
    selectedElement === 'section' ||
    selectedElement === 'section-background';
  const showTransformChrome = Boolean(sectionPrimary && freeEnabled && isSectionTransformTarget);

  return (
    <div
      ref={combinedRef}
      data-lp-block-id={blockId}
      data-lp-free-id={blockId}
      data-lp-free-box="1"
      data-lp-position-mode={layout ? 'free' : 'flow'}
      data-lp-selected={sectionPrimary || sectionInSelection ? '1' : '0'}
      data-lp-section-chrome="1"
      data-lp-bounding-box={sectionPrimary ? '1' : '0'}
      data-lp-section-multi={isSectionMultiChrome ? '1' : undefined}
      data-lp-button-shell={buttonLike ? '1' : undefined}
      data-lp-button-move-layer={buttonLike ? '1' : undefined}
      role="button"
      tabIndex={0}
      style={
        freeLayoutStyle(layout, freeDrag.dragging) ||
        // Empty / short flow sections still need a hit target for click + Delete.
        (!layout ? { minHeight: 56 } : undefined)
      }
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        if (isLpMarqueeSelecting()) return;
        armSectionPointer(e);
      }}
      onPointerUp={(e) => {
        const p = handleSectionPointerUp(e.clientX, e.clientY);
        if (!p || typeof p === 'undefined') return;
        if ((e.target as HTMLElement | null)?.closest?.('[data-lp-floating-toolbar]')) return;
        if ((e.target as HTMLElement | null)?.closest?.('[data-lp-item-handle]')) return;
        if ((e.target as HTMLElement | null)?.closest?.('[data-lp-inline-editing="1"]')) return;
        if ((e.target as HTMLElement | null)?.closest?.('[data-lp-free-drag-handle]')) return;
        if ((e.target as HTMLElement | null)?.closest?.('[data-lp-section-handle]')) return;
        if ((e.target as HTMLElement | null)?.closest?.('[data-lp-inline-field]')) return;
        if ((e.target as HTMLElement | null)?.closest?.('[data-lp-element-id]')) return;
        if ((e.target as HTMLElement | null)?.closest?.('[data-lp-content-image]')) return;
        if ((e.target as HTMLElement | null)?.closest?.('[data-lp-box-hit]')) return;
        if ((e.target as HTMLElement | null)?.closest?.('[data-lp-form-hit]')) return;
        if ((e.target as HTMLElement | null)?.closest?.('[data-lp-grid-cell]')) return;
        if ((e.target as HTMLElement | null)?.closest?.('[data-lp-resize-handle]')) return;
        if ((e.target as HTMLElement | null)?.closest?.('[data-lp-rotate-handle]')) return;
        e.preventDefault();
        e.stopPropagation();
        const t = e.target as HTMLElement | null;
        const shiftKey = p.shiftKey;
        // Empty padding always selects section — Nền only via explicit toolbar button.
        handlers.onSelect({ blockId, element: 'section' }, { shiftKey });
      }}
      onPointerCancel={(e) => {
        handleSectionPointerUp(e.clientX, e.clientY);
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handlers.onSelect({ blockId, element: 'section' });
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          handlers.onDeselect();
        }
      }}
      onDragOver={
        allowReorder || handlers.onInsertSidebarPreset
          ? (e) => {
              const types = [...e.dataTransfer.types];
              const preset = isSidebarPresetDrag(types);
              const blockMove =
                types.includes(LP_BLOCK_MIME) && !types.includes(LP_ITEM_MIME);
              if (!preset && !blockMove) return;
              if (types.includes(LP_ITEM_MIME)) return;
              // Don't steal drops intended for nested item reorder / interactive children
              // that explicitly handle their own MIME — section-preset always lands on section.
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = preset ? 'copy' : 'move';
              e.currentTarget.setAttribute('data-lp-drop-over', '1');
              if (preset) {
                e.currentTarget.setAttribute('data-lp-preset-drop', '1');
                const rect = e.currentTarget.getBoundingClientRect();
                const edge = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
                e.currentTarget.setAttribute('data-lp-drop-edge', edge);
              }
            }
          : undefined
      }
      onDragLeave={
        allowReorder || handlers.onInsertSidebarPreset
          ? (e) => {
              e.currentTarget.removeAttribute('data-lp-drop-over');
              e.currentTarget.removeAttribute('data-lp-preset-drop');
              e.currentTarget.removeAttribute('data-lp-drop-edge');
            }
          : undefined
      }
      onDrop={
        allowReorder || handlers.onInsertSidebarPreset
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              const edge =
                (e.currentTarget.getAttribute('data-lp-drop-edge') as 'before' | 'after' | null) ||
                'before';
              e.currentTarget.removeAttribute('data-lp-drop-over');
              e.currentTarget.removeAttribute('data-lp-preset-drop');
              e.currentTarget.removeAttribute('data-lp-drop-edge');
              if ([...e.dataTransfer.types].includes(LP_ITEM_MIME)) return;
              const presetRaw = e.dataTransfer.getData(LP_SIDEBAR_PRESET_MIME);
              if (presetRaw && handlers.onInsertSidebarPreset) {
                const payload = parseSidebarPresetPayload(presetRaw);
                if (payload) {
                  if (
                    payload.kind === 'media' &&
                    handlers.onApplyBlockImage &&
                    e.currentTarget.querySelector('[data-lp-frame="1"],[data-lp-grid-block="1"]')
                  ) {
                    const cell = (e.target as HTMLElement | null)?.closest?.('[data-lp-grid-cell]');
                    const gridIndex = cell
                      ? Number(cell.getAttribute('data-lp-grid-cell'))
                      : undefined;
                    handlers.onApplyBlockImage(
                      blockId,
                      payload.url,
                      Number.isFinite(gridIndex) ? { gridIndex } : undefined,
                    );
                    return;
                  }
                  // Section presets / other presets: insert before|after section — never into child.
                  handlers.onInsertSidebarPreset(
                    payload,
                    edge === 'after' ? { mode: 'after', blockId } : { mode: 'before', blockId },
                  );
                }
                return;
              }
              if (!allowReorder) return;
              const from = e.dataTransfer.getData(LP_BLOCK_MIME);
              if (from && from !== blockId) handlers.onReorderBlock(from, blockId);
            }
          : undefined
      }
      className={
        (isSectionSelected
          ? `relative z-[1] outline outline-2 ${buttonLike ? 'outline-offset-0' : 'outline-offset-2'} ${isBgSelected ? 'outline-violet-500/90' : 'outline-[#F97316]/90'} data-[lp-free-dragging=1]:outline-dashed data-[lp-free-dragging=1]:outline-blue-700 data-[lp-preset-drop=1]:outline-dashed data-[lp-preset-drop=1]:outline-violet-500`
          : isSectionMultiChrome
            ? `relative z-[1] outline outline-1 outline-dashed ${buttonLike ? 'outline-offset-0' : 'outline-offset-2'} outline-[#F97316]/55 data-[lp-preset-drop=1]:outline-dashed data-[lp-preset-drop=1]:outline-violet-500`
          : `relative cursor-pointer ${buttonLike ? 'outline-offset-0' : 'outline-offset-2'} [@media(hover:hover)]:hover:outline [@media(hover:hover)]:hover:outline-1 [@media(hover:hover)]:hover:outline-dashed [@media(hover:hover)]:hover:outline-[#F97316]/45 data-[lp-drop-over=1]:outline data-[lp-drop-over=1]:outline-2 data-[lp-drop-over=1]:outline-dashed data-[lp-drop-over=1]:outline-[#F97316]/70 data-[lp-preset-drop=1]:outline-violet-500 data-[lp-preset-drop=1]:bg-violet-500/5`) +
        ' before:pointer-events-none after:pointer-events-none data-[lp-drop-edge=before]:before:absolute data-[lp-drop-edge=before]:before:inset-x-2 data-[lp-drop-edge=before]:before:top-0 data-[lp-drop-edge=before]:before:z-20 data-[lp-drop-edge=before]:before:h-1 data-[lp-drop-edge=before]:before:rounded-full data-[lp-drop-edge=before]:before:bg-violet-500 data-[lp-drop-edge=before]:before:content-[""] data-[lp-drop-edge=after]:after:absolute data-[lp-drop-edge=after]:after:inset-x-2 data-[lp-drop-edge=after]:after:bottom-0 data-[lp-drop-edge=after]:after:z-20 data-[lp-drop-edge=after]:after:h-1 data-[lp-drop-edge=after]:after:rounded-full data-[lp-drop-edge=after]:after:bg-violet-500 data-[lp-drop-edge=after]:after:content-[""]' +
        (buttonLike && !layout ? ' w-fit max-w-full' : '') +
        (buttonLike ? ' leading-none' : '') +
        (designClassName ? ` ${designClassName}` : '')
      }
      data-lp-selection-target={isBgSelected ? 'section-background' : sectionPrimary ? 'section' : undefined}
      data-lp-section-drop-slot="1"
    >
      {sectionPrimary ? (
        <>
          <FreeTransformChrome
            visible={showTransformChrome}
            hideHandles={freeDrag.dragging}
            liveAngle={freeDrag.liveAngle}
            onResizePointerDown={(handle: FreeResizeHandle, e) => {
              handlers.onSelect({ blockId, element: 'section' });
              freeDrag.beginResize(handle, e);
            }}
            onRotatePointerDown={(e) => {
              handlers.onSelect({ blockId, element: 'section' });
              freeDrag.beginRotate(e);
            }}
          />
          <span
            data-lp-section-label
            className="pointer-events-none absolute left-2 top-2 z-[15] rounded bg-[#F97316] px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
          >
            {label || 'Section'}
            {layout ? (
              <span className="ml-1 opacity-90" data-lp-free-coords>
                {Math.round(layout.x)},{Math.round(layout.y)}
                {layout.rotate ? ` · ${Math.round(layout.rotate)}°` : ''}
              </span>
            ) : null}
          </span>
        </>
      ) : null}
      {showToolbar ? (
        <FloatingToolbar
          blockId={blockId}
          hasImage={handlers.canReplaceImage?.(blockId) ?? false}
          allowReorder={allowReorder && !sectionLocked}
          sectionLocked={sectionLocked}
          freeDragHandle={
            freeEnabled || handlers.onToggleFreePosition ? (
              <>
                {/* Always-available drag grip — once a section is free-positioned, its
                    OWN body can be 100% covered by an interactive hit-zone (e.g. LeadForm's
                    data-lp-form-hit spans the whole visible card), leaving no empty padding
                    to grab. isFreeDragBlockedTarget already special-cases
                    [data-lp-free-drag-handle] to always be draggable — this button is the
                    section-level element that was missing to make that path reachable
                    (items already have the equivalent via ItemReorderChromeInteractive). */}
                {layout ? (
                  <button
                    type="button"
                    data-lp-free-drag-handle
                    disabled={sectionLocked}
                    title="Kéo để di chuyển section"
                    className="inline-flex h-7 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded text-sm text-orange-700 hover:bg-orange-50 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-40"
                    onPointerDown={(e) => {
                      if (sectionLocked) return;
                      e.preventDefault();
                      e.stopPropagation();
                      handlers.onSelect({ blockId, element: 'section' });
                      freeDrag.beginDrag(e, { force: true, immediate: true });
                    }}
                  >
                    <span aria-hidden>⠿</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  data-lp-free-toggle
                  data-lp-free-mode={layout ? 'on' : 'off'}
                  disabled={sectionLocked}
                  title={
                    sectionLocked
                      ? 'Section đang khóa'
                      : layout
                        ? 'Tắt vị trí tự do'
                        : 'Bật vị trí tự do (kéo thân section khi bật)'
                  }
                  className={`inline-flex h-7 items-center gap-1 rounded px-1.5 text-[11px] font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 ${
                    layout ? 'bg-orange-50 text-orange-700' : 'text-zinc-800'
                  }`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (sectionLocked) return;
                    handlers.onSelect({ blockId, element: 'section' });
                    handlers.onToggleFreePosition?.(blockId);
                  }}
                >
                  <FreeDragHandle />
                </button>
              </>
            ) : null
          }
          isFreeMode={Boolean(layout)}
          onMoveUp={() => handlers.onMove(blockId, 'up')}
          onMoveDown={() => handlers.onMove(blockId, 'down')}
          onDuplicate={() => {
            const el = selectedElement;
            if (el && String(el).startsWith('item:') && handlers.onDuplicateItem) {
              handlers.onDuplicateItem(blockId, String(el).slice('item:'.length));
              return;
            }
            handlers.onDuplicate(blockId);
          }}
          onAi={() => handlers.onAi(blockId)}
          onDelete={() => handlers.onDelete(blockId)}
          onReplaceImage={() => handlers.onReplaceImage(blockId)}
          onBackground={() =>
            handlers.onSelect({ blockId, element: 'section-background' })
          }
          onDeselect={() => handlers.onDeselect()}
          onDragStart={(e) => {
            if (sectionLocked) {
              e.preventDefault();
              return;
            }
            const shell = (e.target as HTMLElement | null)?.closest?.('[data-lp-block-id]');
            if (shell?.querySelector?.('[data-lp-inline-editing="1"]')) {
              e.preventDefault();
              return;
            }
            e.dataTransfer.setData(LP_BLOCK_MIME, blockId);
            e.dataTransfer.effectAllowed = 'move';
          }}
        />
      ) : null}
      {showBgToolbar ? (
        <SectionBackgroundToolbar
          blockId={blockId}
          anchorEl={freeDrag.shellRef.current}
          hasImage={bgMeta.hasImage}
          hasAnyBg={bgMeta.hasAnyBg}
          onAction={(action) => handlers.onSectionBackgroundAction?.(blockId, action)}
          onBackToSection={() => handlers.onSelect({ blockId, element: 'section' })}
          onDeleteSection={() => handlers.onDelete(blockId)}
          onDeselect={() => handlers.onDeselect()}
        />
      ) : null}
      {showImageToolbar ? (
        <SectionBackgroundToolbar
          variant="image"
          blockId={blockId}
          anchorEl={
            freeDrag.shellRef.current?.querySelector(
              '[data-lp-element-selected="1"][data-lp-element-kind="image"],[data-lp-content-image="1"]',
            ) as HTMLElement | null
          }
          hasImage={imageMeta.hasImage}
          hasAnyBg={imageMeta.hasAnyBg}
          onAction={(action) =>
            handlers.onContentImageAction?.(blockId, selectedElement, action)
          }
          onDeselect={() => handlers.onDeselect()}
        />
      ) : null}
      {/* Background hit layer — empty/padding clicks always select section (never auto Nền). */}
      {!buttonLike ? (
        <div
          data-lp-section-bg-hit="1"
          data-lp-selection-target="section"
          className="absolute inset-0 z-0"
          aria-hidden
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            armSectionPointer(e, { fromBgHit: true });
          }}
          onPointerMove={(e) => {
            const p = pointerRef.current;
            if (!p || freeDrag.dragging || p.dragHandle) return;
            const dx = Math.abs(e.clientX - p.x);
            const dy = Math.abs(e.clientY - p.y);
            if (dx <= TAP_MOVE_PX && dy <= TAP_MOVE_PX) return;
            p.moved = true;
            if (!p.marquee) {
              p.marquee = true;
              setLpMarqueeSelecting(true);
              freeDrag.cancelPending?.();
            }
            updateMarqueeVisual(p.x, p.y, e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const p = handleSectionPointerUp(e.clientX, e.clientY);
            if (!p || typeof p === 'undefined') return;
            handlers.onSelect({ blockId, element: 'section' }, { shiftKey: p.shiftKey });
          }}
          onPointerCancel={(e) => {
            handleSectionPointerUp(e.clientX, e.clientY);
          }}
        />
      ) : null}
      {bgMeta.hasImage ? (
        <div
          data-lp-section-bg-paint="1"
          data-lp-bg-motion={bgMeta.motion}
          className="pointer-events-none absolute inset-0 z-0"
          style={handlers.getSectionBackgroundPaint?.(blockId) || undefined}
          aria-hidden
        />
      ) : null}
      <div
        data-lp-section-content="1"
        className={
          bgMeta.hasImage
            ? 'relative z-[1] [&>section]:![background-image:none]'
            : 'relative z-[1]'
        }
      >
        {children}
      </div>
      {marqueeRect && typeof document !== 'undefined'
        ? createPortal(
            <div
              data-lp-marquee-selection="1"
              className="pointer-events-none fixed z-[9990] border border-dashed border-[#2563EB] bg-[#2563EB]/10"
              style={{
                left: marqueeRect.left,
                top: marqueeRect.top,
                width: marqueeRect.width,
                height: marqueeRect.height,
              }}
              aria-hidden
            />,
            document.body,
          )
        : null}
    </div>
  );
}

function FloatingToolbar({
  blockId,
  hasImage,
  allowReorder,
  sectionLocked = false,
  freeDragHandle,
  isFreeMode,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onAi,
  onDelete,
  onReplaceImage,
  onBackground,
  onDeselect,
  onDragStart,
}: {
  blockId: string;
  hasImage: boolean;
  allowReorder: boolean;
  sectionLocked?: boolean;
  freeDragHandle?: ReactNode;
  isFreeMode?: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
  onAi: () => void;
  onDelete: () => void;
  onReplaceImage: () => void;
  onBackground: () => void;
  onDeselect: () => void;
  onDragStart: (e: DragEvent) => void;
}) {
  const btn =
    'pointer-events-auto inline-flex h-7 shrink-0 items-center gap-1 rounded px-1.5 text-[11px] font-medium text-zinc-800 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 sm:px-2';
  const runAction = (fn: () => void) => (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Duplicate/delete remounts DOM — must kill sticky free-drag listeners first.
    cancelAllFreeDrags();
    fn();
  };
  return (
    <div
      data-lp-floating-toolbar
      data-lp-toolbar-for={blockId}
      data-lp-toolbar-placement="safe"
      data-lp-free-mode={isFreeMode ? 'on' : 'off'}
      data-lp-section-locked={sectionLocked ? '1' : '0'}
      className="pointer-events-none absolute left-1/2 top-0 z-20 flex max-w-[calc(100%-0.5rem)] -translate-x-1/2 -translate-y-[calc(100%+6px)] flex-wrap items-center justify-center gap-0.5 rounded-md border border-zinc-200 bg-white px-1 py-0.5 shadow-md max-[767px]:top-auto max-[767px]:bottom-0 max-[767px]:translate-y-[calc(100%+6px)]"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {freeDragHandle}
      {allowReorder ? (
        <>
          <button
            type="button"
            title="Di chuyển section (kéo)"
            data-lp-section-handle
            data-lp-section-drag-handle="1"
            draggable
            onDragStart={onDragStart}
            className={`${btn} cursor-grab touch-none active:cursor-grabbing`}
          >
            <span aria-hidden className="text-sm leading-none">
              ⠿
            </span>
            <span className="hidden sm:inline">Di chuyển</span>
          </button>
          <button type="button" title="Lên" className={btn} onClick={runAction(onMoveUp)}>
            ↑
          </button>
          <button type="button" title="Xuống" className={btn} onClick={runAction(onMoveDown)}>
            ↓
          </button>
        </>
      ) : null}
      <button type="button" title="Nhân bản" className={btn} onClick={runAction(onDuplicate)}>
        <CopyIcon />
        <span className="hidden sm:inline">Nhân bản</span>
      </button>
      <button
        type="button"
        title={sectionLocked ? 'Section đang khóa' : 'AI'}
        className={btn}
        disabled={sectionLocked}
        onClick={runAction(onAi)}
      >
        <WandIcon />
        <span className="hidden sm:inline">AI</span>
      </button>
      {hasImage ? (
        <button
          type="button"
          title={sectionLocked ? 'Section đang khóa' : 'Thay ảnh'}
          className={btn}
          disabled={sectionLocked}
          onClick={runAction(onReplaceImage)}
        >
          <ImageIcon />
          <span className="hidden sm:inline">Thay ảnh</span>
        </button>
      ) : null}
      <button
        type="button"
        title={sectionLocked ? 'Section đang khóa' : 'Chỉnh nền section'}
        className={btn}
        disabled={sectionLocked}
        onClick={runAction(onBackground)}
      >
        <span className="hidden sm:inline">Nền</span>
        <span className="sm:hidden" aria-hidden>
          ▦
        </span>
      </button>
      <button
        type="button"
        title={sectionLocked ? 'Section đang khóa — mở khóa trước khi xóa' : 'Xóa'}
        className={`${btn} text-red-600 hover:bg-red-50`}
        disabled={sectionLocked}
        onClick={runAction(onDelete)}
      >
        <TrashIcon />
        <span className="hidden sm:inline">Xóa</span>
      </button>
      <button
        type="button"
        title="Bỏ chọn"
        data-lp-deselect
        className={`${btn} text-zinc-500`}
        onClick={runAction(onDeselect)}
      >
        ✕
      </button>
    </div>
  );
}

function isLeadFormInteractiveTarget(t: HTMLElement | null): boolean {
  if (!t?.closest) return false;
  return Boolean(
    t.closest('[data-lp-inline-field]') ||
      t.closest('input, textarea, select, button'),
  );
}

export function ElementChrome({
  blockId,
  element,
  handlers,
  kind,
  children,
  className = '',
  blockStyle,
}: {
  blockId: string;
  element: LandingPageCanvasElementKey;
  handlers?: LandingPageCanvasHandlers | null;
  kind: 'text' | 'image' | 'button' | 'box';
  children: ReactNode;
  className?: string;
  /** Publish path: element Custom CSS when handlers absent. */
  blockStyle?: Record<string, unknown> | null;
}) {
  const layoutField = `__element:${element}`;
  const selected = Boolean(
    handlers &&
      (handlers.isSelected?.({ blockId, element }) ??
        (handlers.selection?.blockId === blockId && handlers.selection.element === element)),
  );
  const isPrimary = Boolean(
    handlers &&
      (handlers.isPrimarySelected?.({ blockId, element }) ?? selected),
  );
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
    field: layoutField,
    handlers,
    selected: Boolean(isPrimary),
  });
  const canResize = kind === 'box' || kind === 'image';
  const isFormChrome = element === 'form';
  const elementClass = handlers?.getElementCustomClass?.(blockId, element) || '';
  const customCssStyle =
    handlers?.getElementCustomCssStyle?.(blockId, element) ??
    readElementCustomCssStyle(blockStyle, element);

  if (!handlers) {
    return (
      <div
        data-lp-element-id={`${blockId}::${element}`}
        data-lp-element-kind={kind}
        data-lp-free-child={shellStyle ? '1' : undefined}
        data-lp-free-mode={shellStyle ? 'offset' : undefined}
        style={{ ...(shellStyle || {}), ...customCssStyle }}
        className={`${kind === 'button' || kind === 'text' ? 'inline-block max-w-full' : 'relative'} ${className}`}
      >
        {children}
      </div>
    );
  }

  const cursor =
    kind === 'text'
      ? selected && freeEnabled
        ? 'cursor-grab active:cursor-grabbing'
        : 'cursor-text'
      : kind === 'button'
        ? 'cursor-pointer'
        : selected && freeEnabled
          ? 'cursor-grab active:cursor-grabbing'
          : 'cursor-pointer';
  const pointerRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  return (
    <div
      ref={bindShellRef}
      data-lp-element-id={`${blockId}::${element}`}
      data-lp-element-kind={kind}
      data-lp-element-selected={selected ? '1' : '0'}
      data-lp-element-primary={isPrimary ? '1' : '0'}
      data-lp-free-child="1"
      data-lp-free-id={`${blockId}::${layoutField}`}
      data-lp-free-mode="offset"
      data-lp-bounding-box={isPrimary ? '1' : '0'}
      style={{ ...shellStyle, ...customCssStyle }}
      className={`${kind === 'button' || kind === 'text' ? 'inline-block max-w-full' : 'relative'} ${cursor} outline-offset-2 ${
        isPrimary
          ? 'z-[1] outline outline-2 outline-[#F97316]/85 data-[lp-free-dragging=1]:outline-dashed data-[lp-free-dragging=1]:outline-blue-700'
          : selected
            ? 'z-[1] outline outline-1 outline-dashed outline-[#F97316]/55'
            : '[@media(hover:hover)]:hover:outline [@media(hover:hover)]:hover:outline-1 [@media(hover:hover)]:hover:outline-dashed [@media(hover:hover)]:hover:outline-[#F97316]/40'
      } ${className}${elementClass ? ` ${elementClass}` : ''}`}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement | null)?.closest?.('[data-lp-resize-handle],[data-lp-rotate-handle]')) {
          e.stopPropagation();
          return;
        }
        if (e.button !== 0) return;
        if (isFormChrome && isLeadFormInteractiveTarget(e.target as HTMLElement)) return;
        e.stopPropagation();
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
        if (isFormChrome && isLeadFormInteractiveTarget(e.target as HTMLElement)) return;
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
      {canResize && showTransformChrome ? (
        <FreeTransformChrome
          visible={showTransformChrome}
          hideHandles={freeDrag.dragging}
          liveAngle={freeDrag.liveAngle}
          onResizePointerDown={(handle: FreeResizeHandle, e) => {
            e.stopPropagation();
            handlers.onSelect({ blockId, element });
            freeDrag.beginResize(handle, e);
          }}
          onRotatePointerDown={(e) => {
            e.stopPropagation();
            handlers.onSelect({ blockId, element });
            freeDrag.beginRotate(e);
          }}
        />
      ) : null}
      {children}
    </div>
  );
}

/**
 * Text box transform chrome — 8 handles (N/S/E/W/NE/NW/SE/SW).
 * Snapshot geometry at pointerdown; each frame = applyResizeHandle(start + delta).
 * Corners change both width and height; west/north also shift free offset.
 */
function isHeadingCornerHandle(handle: string): handle is 'nw' | 'ne' | 'sw' | 'se' {
  return handle === 'nw' || handle === 'ne' || handle === 'sw' || handle === 'se';
}

function HeadingBoxResizeChrome({
  width,
  height,
  freeOffset,
  wrapRef,
  textRef,
  onCommitBox,
  onResizingChange,
}: {
  width?: number;
  height?: number;
  freeOffset?: { x: number; y: number } | null;
  wrapRef: { current: HTMLElement | null };
  textRef: { current: HTMLElement | null };
  onCommitBox: (next: {
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
  }) => void;
  /** Active for the duration of a drag gesture — lets the parent stop re-applying
   * committed width/height via React so it doesn't fight applyLiveBox's DOM writes. */
  onResizingChange?: (active: boolean) => void;
}) {
  const sessionRef = useRef<{
    handle: FreeResizeHandle;
    startX: number;
    startY: number;
    startW: number;
    startH: number;
    originX: number;
    originY: number;
    canvasScale: number;
    raf: number;
    pendingX: number;
    pendingY: number;
    lastW: number;
    lastH: number;
    lastOX: number;
    lastOY: number;
    captureEl: HTMLElement | null;
    pointerId: number;
  } | null>(null);

  const applyLiveBox = (w: number, h: number, ox: number, oy: number) => {
    const el = wrapRef.current;
    const textEl = textRef.current;
    if (!el) return;
    el.style.boxSizing = 'border-box';
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.minWidth = `${w}px`;
    el.style.minHeight = `${h}px`;
    el.style.maxWidth = 'none';
    el.style.maxHeight = 'none';
    el.style.overflow = 'visible';
    el.style.display = 'block';
    el.style.whiteSpace = 'normal';
    el.style.transform = `translate3d(${ox}px, ${oy}px, 0)`;
    el.setAttribute('data-lp-heading-width-live', String(w));
    el.setAttribute('data-lp-heading-height-live', String(h));
    if (textEl) {
      textEl.style.boxSizing = 'border-box';
      textEl.style.display = 'block';
      textEl.style.width = '100%';
      textEl.style.maxWidth = 'none';
      textEl.style.height = '100%';
      textEl.style.whiteSpace = 'normal';
      textEl.style.overflowWrap = 'anywhere';
      textEl.style.wordBreak = 'break-word';
      textEl.style.overflow = 'visible';
    }
  };

  const applyMoveFrame = () => {
    const s = sessionRef.current;
    if (!s || !wrapRef.current) return;
    s.raf = 0;
    const scale = s.canvasScale > 0 ? s.canvasScale : 1;
    const dx = (s.pendingX - s.startX) / scale;
    const dy = (s.pendingY - s.startY) / scale;
    const next = applyResizeHandle({
      handle: s.handle,
      x: s.originX,
      y: s.originY,
      width: s.startW,
      height: s.startH,
      dx,
      dy,
      minW: 80,
      minH: 28,
      maxW: 1200,
      maxH: 1200,
    });
    s.lastW = next.width;
    s.lastH = next.height;
    s.lastOX = next.x;
    s.lastOY = next.y;
    applyLiveBox(next.width, next.height, next.x, next.y);
  };

  const scheduleMove = (clientX: number, clientY: number) => {
    const s = sessionRef.current;
    if (!s) return;
    s.pendingX = clientX;
    s.pendingY = clientY;
    if (s.raf) return;
    s.raf = requestAnimationFrame(applyMoveFrame);
  };

  const onHandleDown = (handle: FreeResizeHandle) => (e: PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const captureEl = e.currentTarget as HTMLElement;
    try {
      captureEl.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const wrap = wrapRef.current;
    if (!wrap) return;
    const scale = readCanvasPointerScale(wrap);
    const rect = wrap.getBoundingClientRect();
    const startW =
      width && width > 0
        ? width
        : Math.max(80, Math.round(rect.width / (scale > 0.05 ? scale : 1)));
    const startH =
      height && height > 0
        ? height
        : Math.max(28, Math.round(rect.height / (scale > 0.05 ? scale : 1)));
    const originX = freeOffset?.x ?? 0;
    const originY = freeOffset?.y ?? 0;
    sessionRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startW,
      startH,
      originX,
      originY,
      canvasScale: scale,
      raf: 0,
      pendingX: e.clientX,
      pendingY: e.clientY,
      lastW: startW,
      lastH: startH,
      lastOX: originX,
      lastOY: originY,
      captureEl,
      pointerId: e.pointerId,
    };
    wrap.setAttribute('data-lp-heading-resizing', '1');
    document.documentElement.setAttribute('data-lp-heading-box-resizing', '1');
    onResizingChange?.(true);
    applyLiveBox(startW, startH, originX, originY);

    const onMove = (ev: globalThis.PointerEvent) => {
      if (!sessionRef.current) return;
      ev.preventDefault();
      scheduleMove(ev.clientX, ev.clientY);
    };
    const onUp = (ev: globalThis.PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      const s = sessionRef.current;
      if (s?.raf) cancelAnimationFrame(s.raf);
      if (s) {
        s.pendingX = ev.clientX;
        s.pendingY = ev.clientY;
        applyMoveFrame();
      }
      try {
        s?.captureEl?.releasePointerCapture(ev.pointerId);
      } catch {
        /* ignore */
      }
      sessionRef.current = null;
      const el = wrapRef.current;
      document.documentElement.removeAttribute('data-lp-heading-box-resizing');
      window.dispatchEvent(new CustomEvent('lp-heading-box-resize-end'));
      // Flip back to declarative styling in the SAME batch as onCommitBox's spec
      // update below, so the wrap span never re-renders with the old (pre-drag)
      // committed width/height for even one frame.
      onResizingChange?.(false);
      if (!el || !s) return;
      el.removeAttribute('data-lp-heading-resizing');
      el.removeAttribute('data-lp-heading-width-live');
      el.removeAttribute('data-lp-heading-height-live');
      onCommitBox({
        width: s.lastW,
        height: s.lastH,
        offsetX: s.lastOX,
        offsetY: s.lastOY,
      });
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const handleCls =
    'pointer-events-auto absolute z-[19] h-2.5 w-2.5 rounded-[2px] border-2 border-[#F97316] bg-white shadow-sm';

  const handles: FreeResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  return (
    <div
      data-lp-heading-width-chrome="1"
      data-lp-heading-box-chrome="1"
      data-lp-heading-handles="sm"
      data-lp-heading-corner-resizes-box="1"
      data-lp-transform-chrome="1"
      className="pointer-events-none absolute inset-0 z-[18] overflow-visible"
      aria-hidden
    >
      {handles.map((handle) => {
        const pos: CSSProperties = {};
        if (handle.includes('n')) pos.top = 0;
        if (handle.includes('s')) pos.bottom = 0;
        if (handle.includes('w')) pos.left = 0;
        if (handle.includes('e')) pos.right = 0;
        if (handle === 'n' || handle === 's') {
          pos.left = '50%';
          pos.transform = 'translate(-50%, ' + (handle === 'n' ? '-50%' : '50%') + ')';
        } else if (handle === 'e' || handle === 'w') {
          pos.top = '50%';
          pos.transform = 'translate(' + (handle === 'w' ? '-50%' : '50%') + ', -50%)';
        } else {
          const tx = handle.includes('w') ? '-50%' : '50%';
          const ty = handle.includes('n') ? '-50%' : '50%';
          pos.transform = `translate(${tx}, ${ty})`;
        }
        return (
          <button
            key={handle}
            type="button"
            data-lp-resize-handle={handle}
            data-lp-heading-width-handle={handle === 'e' || handle === 'w' ? handle : undefined}
            data-lp-heading-corner-handle={isHeadingCornerHandle(handle) ? handle : undefined}
            title="Resize text box"
            className={handleCls}
            style={{ ...pos, cursor: resizeHandleCursor(handle) }}
            onPointerDown={onHandleDown(handle)}
          />
        );
      })}
    </div>
  );
}

export function InlineEditable({
  as: Tag = 'div',
  blockId,
  field,
  value,
  handlers,
  className,
  style,
  multiline = false,
  textRole = 'paragraph',
  fillParent = false,
  blockStyle,
}: {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'div' | 'span' | 'a';
  blockId: string;
  /** Top-level or nested path keys (itemTitle:id, planName:id, fieldLabel:id, …). */
  field: string;
  value: string;
  handlers?: LandingPageCanvasHandlers | null;
  /** Block.style for publish path (when handlers absent). */
  blockStyle?: Record<string, unknown> | null;
  className?: string;
  style?: CSSProperties;
  multiline?: boolean;
  /** Semantic role for gates / a11y. */
  textRole?:
    | 'heading'
    | 'paragraph'
    | 'button'
    | 'card-title'
    | 'card-description'
    | 'faq'
    | 'cta'
    | 'pricing'
    | 'testimonial'
    | 'form-label';
  /** Stretch wrap to parent — needed for free-resize button chrome. */
  fillParent?: boolean;
}) {
  const element = elementKeyForField(field);
  const ref = useRef<HTMLElement | null>(null);
  const [editing, setEditing] = useState(false);
  const editingRef = useRef(false);
  editingRef.current = editing;
  // While a HeadingBoxResizeChrome drag is live, applyLiveBox owns wrap.style
  // directly — suppress the declarative width/height/overflow below so an
  // incidental re-render (autosave tick, selection change, anything) doesn't
  // reapply the stale pre-drag committed size and undo the live shrink/grow.
  const [boxResizing, setBoxResizing] = useState(false);
  const draftRef = useRef(value || '');
  const pointerRef = useRef<{ x: number; y: number; moved: boolean; t: number } | null>(null);
  const wrapNodeRef = useRef<HTMLSpanElement | null>(null);
  const selected = Boolean(
    handlers?.isSelected?.({ blockId, element, field }) ??
      (handlers?.selection?.blockId === blockId &&
        (handlers?.selection?.field === field ||
          (!handlers?.selection?.field && handlers?.selection.element === element))),
  );
  const isPrimary = Boolean(
    handlers?.isPrimarySelected?.({ blockId, element, field }) ?? selected,
  );
  const hidden = Boolean(handlers?.isTextElementHidden?.(blockId, field));
  const locked = Boolean(handlers?.isTextElementLocked?.(blockId, field));
  const publicMeta = useLpPublicRenderMeta();
  const styleKey = styleKeyForInlineField(blockId, field);
  const textStyle =
    handlers?.getTextStyle?.(blockId, field) ?? publicMeta?.inlineTextStyles[styleKey];
  const customCssStyle =
    handlers?.getElementCustomCssStyle?.(blockId, element) ??
    readElementCustomCssStyle(blockStyle, element);
  const editBorderColor = resolveEditBorderColor(style, textStyle, className);
  const isHeadingField = textRole === 'heading' || field === 'headline';
  const boxWidthEarly =
    typeof textStyle?.width === 'number' && textStyle.width > 0 ? textStyle.width : undefined;

  const mergeFieldStyle = (extra?: CSSProperties): CSSProperties => {
    // Theme/base → custom CSS → toolbar textStyle (toolbar color must win).
    const fromToolbar = mergeTextStyle(undefined, textStyle, {
      widthOnWrapOnly: isHeadingField && Boolean(boxWidthEarly),
    }) || {};
    const merged: CSSProperties = {
      ...(style || {}),
      ...customCssStyle,
      ...fromToolbar,
      ...(extra || {}),
      // Builder only: block sticky blue ::selection when not editing.
      ...(handlers && !editing
        ? ({ userSelect: 'none', WebkitUserSelect: 'none' } as CSSProperties)
        : undefined),
    };
    // Wrapped canvas headings: override theme leading-tight so lines never overlap.
    if (isHeadingField && (boxWidthEarly || merged.fontSize)) {
      if (textStyle?.lineHeight == null) merged.lineHeight = 1.25;
    }
    return merged;
  };
  const elementFreeDrag = useCanvasElementFreeDrag({
    blockId,
    field,
    handlers,
    selected: Boolean(isPrimary),
    paused: editing || locked,
  });
  const bindWrapRef = (node: HTMLSpanElement | null) => {
    elementFreeDrag.bindShellRef(node);
    wrapNodeRef.current = node;
  };

  // Clear sticky browser selection when leaving edit / deselected.
  useEffect(() => {
    if (!editing) clearBrowserTextSelection();
  }, [editing, selected]);

  // Seed / sync plain text via DOM only — never React-clear children while editing
  // (React conditional children previously wiped content on double-click).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (editingRef.current) return;
    const next = value || '';
    draftRef.current = next;
    if ((el.innerText || '') !== next) {
      el.textContent = next;
    }
  }, [value]);

  // Changing H1–H6 remounts the semantic tag — reseed DOM from draft/value so text is never lost.
  const headingLevelKey = textStyle?.headingLevel ?? 0;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const next = (draftRef.current || value || '').replace(/\u00a0/g, ' ');
    if ((el.innerText || '').replace(/\u00a0/g, ' ') !== next) {
      el.textContent = next;
    }
    if (editingRef.current) {
      try {
        el.focus({ preventScroll: true });
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when semantic tag remounts
  }, [headingLevelKey]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!editing || !el) return;
    // Restore if DOM was emptied by a prior render race — only when entering edit mode.
    // Do NOT depend on `value`: live typing updates value via onFieldLive and must not
    // re-focus / move caret (that felt like save hang + fought the cursor).
    const current = (el.innerText || '').replace(/\u00a0/g, ' ');
    const fallback = draftRef.current || value || '';
    if (!current && fallback) {
      el.textContent = fallback;
    }
    el.focus({ preventScroll: true });
    try {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false); // caret at end — do not select-all (avoids wipe on first key)
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally only on edit enter
  }, [editing]);

  if (!handlers) {
    const Comp = Tag;
    const freeStyle = elementFreeDrag.shellStyle;
    const node = (
      <Comp
        className={className}
        style={mergeFieldStyle()}
        data-lp-element-id={`${blockId}::${element}`}
        data-lp-element-kind="text"
      >
        {value}
      </Comp>
    );
    if (!freeStyle) return node;
    return (
      <span
        data-lp-free-child="1"
        data-lp-free-mode="offset"
        data-lp-free-id={`${blockId}::${field}`}
        style={freeStyle}
        className={fillParent ? 'block w-full' : 'inline-block max-w-full'}
      >
        {node}
      </span>
    );
  }

  const stop = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
  };

  const startEdit = () => {
    if (locked) return;
    handlers.onSelect({ blockId, element, field });
    const el = ref.current;
    const keep = (el?.innerText || value || draftRef.current || '').replace(/\u00a0/g, ' ');
    draftRef.current = keep;
    if (el) el.textContent = keep;
    setEditing(true);
  };

  const commit = () => {
    if (!ref.current) return;
    let text = (ref.current.innerText ?? '').replace(/\u00a0/g, ' ');
    if (ref.current.childElementCount > 0) {
      ref.current.textContent = text;
      text = (ref.current.innerText ?? '').replace(/\u00a0/g, ' ');
    }
    draftRef.current = text;
    setEditing(false);
    clearBrowserTextSelection();
    handlers.onFieldCommit(blockId, field, text);
  };

  const cancel = () => {
    const restore = value || '';
    if (ref.current) ref.current.textContent = restore;
    draftRef.current = restore;
    setEditing(false);
    clearBrowserTextSelection();
    handlers.onDeselect();
  };

  const textCursor =
    editing || !elementFreeDrag.freeEnabled
      ? 'cursor-text'
      : selected
        ? 'cursor-grab active:cursor-grabbing'
        : 'cursor-text';

  const keepEmptyChrome = Boolean(editing || selected || isPrimary);
  const emptyChromeStyle: CSSProperties | undefined = keepEmptyChrome
    ? {
        minWidth: '2ch',
        minHeight: '1.25em',
        display: isHeadingField ? 'block' : 'inline-block',
        boxSizing: 'border-box',
        verticalAlign: 'top',
      }
    : undefined;

  const headingLevel = textStyle?.headingLevel;
  const ResolvedTag =
    isHeadingField && headingLevel && headingLevel >= 1 && headingLevel <= 6
      ? (`h${headingLevel}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6')
      : Tag;
  const viewport = handlers.viewport || 'desktop';
  const showHeadingWidthResize =
    isHeadingField &&
    isPrimary &&
    !locked &&
    !editing &&
    viewport !== 'mobile' &&
    !isTouchLike();
  const boxWidth = typeof textStyle?.width === 'number' && textStyle.width > 0 ? textStyle.width : undefined;
  const boxHeight =
    typeof textStyle?.height === 'number' && textStyle.height > 0 ? textStyle.height : undefined;

  const headingChromeOutline =
    isHeadingField && !editing
      ? isPrimary
        ? 'outline outline-2 outline-offset-2 outline-[#F97316]/85 data-[lp-free-dragging=1]:outline-dashed data-[lp-free-dragging=1]:outline-blue-700'
        : selected
          ? 'outline outline-1 outline-offset-2 outline-dashed outline-[#F97316]/55'
          : '[@media(hover:hover)]:hover:outline [@media(hover:hover)]:hover:outline-1 [@media(hover:hover)]:hover:outline-dashed [@media(hover:hover)]:hover:outline-[#F97316]/40'
      : '';

  return (
    <span
      ref={bindWrapRef}
      className={
        (fillParent
          ? 'relative flex h-full w-full min-w-0'
          : 'relative block align-top') +
        (headingChromeOutline ? ` ${headingChromeOutline}` : '')
      }
      data-lp-inline-wrap={textRole}
      data-lp-inline-empty={!(value || '').trim() && keepEmptyChrome ? '1' : undefined}
      data-lp-heading-resize={isHeadingField ? '1' : undefined}
      data-lp-heading-auto-height={isHeadingField && !boxHeight ? '1' : undefined}
      data-lp-fill-parent={fillParent ? '1' : undefined}
      data-lp-button-hit={fillParent && textRole === 'button' ? '1' : undefined}
      data-lp-cta-body={element === 'cta' || textRole === 'button' ? '1' : undefined}
      data-lp-free-child="1"
      data-lp-free-id={`${blockId}::${field}`}
      data-lp-free-mode="offset"
      data-lp-element-selected={selected ? '1' : '0'}
      data-lp-element-primary={isPrimary ? '1' : '0'}
      data-lp-bounding-box={isPrimary ? '1' : '0'}
      data-lp-text-hidden={hidden ? '1' : undefined}
      data-lp-text-locked={locked ? '1' : undefined}
      style={{
        ...elementFreeDrag.shellStyle,
        ...(hidden ? { opacity: selected ? 0.55 : 0.35 } : undefined),
        ...(keepEmptyChrome && !(value || '').trim()
          ? { minWidth: '2ch', minHeight: '1.25em' }
          : undefined),
        ...(boxResizing
          ? null
          : boxWidth
            ? {
                width: boxWidth,
                maxWidth: 'none',
                boxSizing: 'border-box',
              }
            : undefined),
        ...(boxResizing
          ? null
          : boxHeight
            ? {
                height: boxHeight,
                minHeight: boxHeight,
                boxSizing: 'border-box',
              }
            : { height: 'auto' }),
        ...(boxResizing ? null : { overflow: 'visible' }),
        display: boxWidth || isHeadingField ? 'block' : undefined,
        whiteSpace: 'normal',
      }}
    >
      {showHeadingWidthResize ? (
        <HeadingBoxResizeChrome
          width={boxWidth}
          height={boxHeight}
          freeOffset={
            elementFreeDrag.layout
              ? { x: elementFreeDrag.layout.x, y: elementFreeDrag.layout.y }
              : { x: 0, y: 0 }
          }
          wrapRef={wrapNodeRef}
          textRef={ref}
          onResizingChange={setBoxResizing}
          onCommitBox={(next) => {
            const freeLayout = {
              x: next.offsetX,
              y: next.offsetY,
              width: next.width,
              height: next.height,
            };
            if (handlers.onTextBoxResizeCommit) {
              handlers.onTextBoxResizeCommit(blockId, field, {
                width: next.width,
                height: next.height,
                freeLayout,
                viewport,
              });
              return;
            }
            handlers.onTextStyleChange?.(blockId, field, {
              width: next.width,
              height: next.height,
            });
            handlers.onElementFreeLayoutCommit?.(blockId, field, {
              positionMode: 'free',
              freeLayout,
              viewport,
            });
          }}
        />
      ) : null}
      <ResolvedTag
        // @ts-expect-error polymorphic ref
        ref={ref}
        data-lp-element-id={`${blockId}::${element}`}
        data-lp-element-kind="text"
        data-lp-inline-field={field}
        data-lp-inline-role={textRole}
        data-lp-heading-level={headingLevel || undefined}
        data-lp-inline-editing={editing ? '1' : '0'}
        data-lp-element-selected={selected ? '1' : '0'}
        data-lp-element-primary={isPrimary ? '1' : '0'}
        data-lp-no-layout-shift="1"
        data-lp-edit-border={editing ? editBorderColor : ''}
        className={`${className || ''} ${textCursor} ${
          editing
            ? 'relative z-[2] rounded-sm'
            : isHeadingField
              ? ''
              : isPrimary
                ? 'outline outline-2 outline-offset-2 outline-[#F97316]/85 data-[lp-free-dragging=1]:outline-dashed data-[lp-free-dragging=1]:outline-blue-700'
                : selected
                  ? 'outline outline-1 outline-offset-2 outline-dashed outline-[#F97316]/55'
                  : 'outline-offset-2 [@media(hover:hover)]:hover:outline [@media(hover:hover)]:hover:outline-1 [@media(hover:hover)]:hover:outline-dashed [@media(hover:hover)]:hover:outline-[#F97316]/40'
        } ${
          isHeadingField || boxWidth
            ? 'block w-full whitespace-normal break-words [overflow-wrap:anywhere] [max-width:none]'
            : ''
        }`}
        style={mergeFieldStyle(
          editing
            ? {
                boxShadow: `0 0 0 2px ${editBorderColor}`,
                outline: 'none',
                ...emptyChromeStyle,
              }
            : emptyChromeStyle,
        )}
        contentEditable={editing}
        suppressContentEditableWarning
        role={editing ? 'textbox' : undefined}
        aria-multiline={multiline || undefined}
        spellCheck={editing}
        onPointerDown={(e) => {
          if ((e.target as HTMLElement | null)?.closest?.('[data-lp-resize-handle],[data-lp-heading-width-handle],[data-lp-heading-corner-handle]')) {
            e.stopPropagation();
            return;
          }
          if (editing) {
            stop(e);
            return;
          }
          if (locked) {
            stop(e);
            handlers.onSelect({ blockId, element, field }, { shiftKey: e.shiftKey });
            return;
          }
          if (e.button !== 0) return;
          pointerRef.current = { x: e.clientX, y: e.clientY, moved: false, t: Date.now() };
          elementFreeDrag.armDrag(e);
        }}
        onPointerMove={(e) => {
          const p = pointerRef.current;
          if (!p || editing) return;
          if (Math.abs(e.clientX - p.x) > TAP_MOVE_PX || Math.abs(e.clientY - p.y) > TAP_MOVE_PX) {
            p.moved = true;
          }
        }}
        onPointerUp={(e) => {
          if (editing) return;
          if (elementFreeDrag.consumePointerUpForDrag()) return;
          const p = pointerRef.current;
          pointerRef.current = null;
          if (!p || p.moved) return;
          stop(e);
          e.preventDefault();
          const already = selected;
          handlers.onSelect({ blockId, element, field }, { shiftKey: e.shiftKey });
          clearBrowserTextSelection();
          if (already && isTouchLike()) startEdit();
        }}
        onClick={(e) => {
          stop(e);
          e.preventDefault();
          if (!editing) clearBrowserTextSelection();
        }}
        onDoubleClick={(e) => {
          e.preventDefault();
          stop(e);
          clearBrowserTextSelection();
          startEdit();
        }}
        onPaste={(e) => {
          if (!editing) return;
          e.preventDefault();
          stop(e);
          const clip = e.clipboardData;
          const html = clip?.getData('text/html') || '';
          const plain = clip?.getData('text/plain') || '';
          const cleaned = sanitizeInlinePasteText(html || plain);
          document.execCommand('insertText', false, cleaned);
        }}
        onBlur={() => {
          if (!editingRef.current) return;
          commit();
        }}
        onInput={() => {
          if (!ref.current) return;
          if (ref.current.childElementCount > 0) {
            const t = ref.current.innerText ?? '';
            ref.current.textContent = t;
          }
          const text = (ref.current.innerText ?? '').replace(/\u00a0/g, ' ');
          draftRef.current = text;
          handlers.onFieldLive(blockId, field, text);
        }}
        onKeyDown={(e) => {
          stop(e);
          if (!multiline && e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLElement).blur();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            cancel();
          }
        }}
      />
    </span>
  );
}

/** Light card / dark CTA: pick edit border so the caret field is obvious. */
function resolveEditBorderColor(
  style?: CSSProperties,
  textStyle?: LandingPageInlineTextStyle,
  className?: string,
): string {
  const cls = String(className || '').toLowerCase();
  if (/\btext-white\b/.test(cls) || /\btext-white\//.test(cls)) return '#ffffff';
  const color = String(textStyle?.color || style?.color || '').toLowerCase().trim();
  if (
    color === '#fff' ||
    color === '#ffffff' ||
    color === 'white' ||
    /rgba?\(\s*255\s*,\s*255\s*,\s*255/.test(color)
  ) {
    return '#ffffff';
  }
  const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex?.[1]) {
    let h = hex[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    if (lum > 0.72) return '#ffffff';
  }
  return '#000000';
}

function clearBrowserTextSelection() {
  try {
    const sel = typeof window !== 'undefined' ? window.getSelection() : null;
    sel?.removeAllRanges();
  } catch {
    /* ignore */
  }
}

function mergeTextStyle(
  base: CSSProperties | undefined,
  textStyle: LandingPageInlineTextStyle | undefined,
  opts?: { widthOnWrapOnly?: boolean },
): CSSProperties | undefined {
  if (!textStyle && !base) return undefined;
  const next: CSSProperties = { ...(base || {}) };
  if (!textStyle) return next;
  if (textStyle.fontSize) {
    next.fontSize =
      textStyle.fontSizeUnit === 'rem'
        ? `${Math.round((textStyle.fontSize / 16) * 1000) / 1000}rem`
        : `${textStyle.fontSize}px`;
  }
  if (textStyle.fontWeight != null) {
    next.fontWeight = textStyle.fontWeight as CSSProperties['fontWeight'];
  }
  if (textStyle.textAlign) next.textAlign = textStyle.textAlign;
  if (textStyle.fontFamily) next.fontFamily = textStyle.fontFamily;
  if (textStyle.fontStyle) next.fontStyle = textStyle.fontStyle;
  if (textStyle.textTransform) next.textTransform = textStyle.textTransform;
  if (textStyle.textDecoration) next.textDecoration = textStyle.textDecoration;
  if (textStyle.letterSpacing) next.letterSpacing = textStyle.letterSpacing;
  if (textStyle.lineHeight != null) next.lineHeight = textStyle.lineHeight;
  if (typeof textStyle.width === 'number' && textStyle.width > 0 && !opts?.widthOnWrapOnly) {
    next.width = `${textStyle.width}px`;
    next.maxWidth = '100%';
    next.display = next.display || 'block';
    next.whiteSpace = 'normal';
    next.overflowWrap = 'anywhere';
    next.wordBreak = 'break-word';
    next.height = 'auto';
    next.overflow = 'visible';
  }
  // Never apply fixed height / overflow:hidden on inline text — clips wrapped headings.
  // Legacy `height` in meta is ignored so content can auto-grow.

  const hasGradientFill = Boolean(textStyle.backgroundImage) && !textStyle.color;
  if (hasGradientFill) {
    next.backgroundImage = textStyle.backgroundImage;
    next.backgroundSize = 'cover';
    next.backgroundPosition = 'center';
    next.WebkitBackgroundClip = 'text';
    next.backgroundClip = 'text';
    next.WebkitTextFillColor = textStyle.webkitTextFillColor || 'transparent';
    next.color = 'transparent';
  } else if (textStyle.color) {
    // Solid color from toolbar — clear any leftover gradient fill so color actually shows.
    next.color = textStyle.color;
    next.WebkitTextFillColor = textStyle.color;
    next.backgroundImage = 'none';
    next.backgroundClip = 'border-box';
    next.WebkitBackgroundClip = 'border-box';
  }
  return next;
}

const LP_TEXT_COLOR_PRESETS = [
  '#ffffff',
  '#000000',
  '#111827',
  '#374151',
  '#6b7280',
  '#9ca3af',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#0A3D30',
];

const LP_TEXT_COLOR_PALETTE = [
  '#ffffff', '#f3f4f6', '#e5e7eb', '#d1d5db', '#9ca3af', '#6b7280', '#374151', '#111827', '#000000',
  '#fef2f2', '#fecaca', '#f87171', '#ef4444', '#dc2626', '#991b1b', '#7f1d1d',
  '#fff7ed', '#fed7aa', '#fb923c', '#f97316', '#ea580c', '#c2410c',
  '#fefce8', '#fef08a', '#facc15', '#eab308', '#ca8a04',
  '#f0fdf4', '#bbf7d0', '#4ade80', '#22c55e', '#16a34a', '#166534',
  '#ecfeff', '#a5f3fc', '#22d3ee', '#06b6d4', '#0891b2',
  '#eff6ff', '#bfdbfe', '#60a5fa', '#3b82f6', '#2563eb', '#1e40af',
  '#f5f3ff', '#c4b5fd', '#8b5cf6', '#7c3aed', '#5b21b6',
  '#fdf2f8', '#f9a8d4', '#ec4899', '#db2777', '#9d174d',
];

const LP_TEXT_MY_COLORS_KEY = 'mkspa.lpTextMyColors.v1';

function loadMyTextColors(): string[] {
  try {
    const raw = localStorage.getItem(LP_TEXT_MY_COLORS_KEY);
    if (!raw) return LP_TEXT_COLOR_PRESETS.slice(0, 12);
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return LP_TEXT_COLOR_PRESETS.slice(0, 12);
    const colors = arr.filter((c): c is string => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c));
    return colors.length ? colors.slice(0, 16) : LP_TEXT_COLOR_PRESETS.slice(0, 12);
  } catch {
    return LP_TEXT_COLOR_PRESETS.slice(0, 12);
  }
}

function pushMyTextColor(color: string) {
  try {
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return;
    const next = [color, ...loadMyTextColors().filter((c) => c.toLowerCase() !== color.toLowerCase())].slice(
      0,
      16,
    );
    localStorage.setItem(LP_TEXT_MY_COLORS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function normalizeHexColor(raw: string, fallback = '#111827'): string {
  const s = String(raw || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  }
  return fallback;
}

/** Single primary text toolbar host — one instance for the whole canvas. */
export function LandingPageCanvasTextToolbarHost({
  handlers,
}: {
  handlers: LandingPageCanvasHandlers | null;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const primaryKey = handlers?.primarySelectedId ?? null;

  useLayoutEffect(() => {
    if (!handlers || !primaryKey) {
      setAnchorEl(null);
      return;
    }
    const target = parseLpSelectionKey(primaryKey);
    if (!target || !isTextToolbarTarget(target)) {
      setAnchorEl(null);
      return;
    }
    const update = () => {
      // Freeze toolbar position while heading box is being resized — reposition only after end.
      if (document.documentElement.getAttribute('data-lp-heading-box-resizing') === '1') return;
      setAnchorEl(findTextAnchorEl(target));
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    window.addEventListener('lp-heading-box-resize-end', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      window.removeEventListener('lp-heading-box-resize-end', update);
    };
  }, [handlers, primaryKey]);

  if (!handlers || !primaryKey || !anchorEl) return null;

  const targetRaw = parseLpSelectionKey(primaryKey);
  if (!targetRaw || !isTextToolbarTarget(targetRaw)) return null;
  const target = normalizeLpSelectionTarget(targetRaw);
  if (!target.field) return null;

  const { blockId, field } = target;
  const textStyle = handlers.getTextStyle?.(blockId, field);
  const hidden = Boolean(handlers.isTextElementHidden?.(blockId, field));
  const locked = Boolean(handlers.isTextElementLocked?.(blockId, field));
  if (hidden) return null;

  const itemM =
    /^(?:itemTitle|itemDesc|itemQuestion|itemAnswer|itemQuote|itemAuthor|planName|planPrice|planCta|fieldLabel):(.+)$/.exec(
      field,
    );

  return (
    <TextEditToolbar
      blockId={blockId}
      field={field}
      anchorEl={anchorEl}
      textStyle={textStyle}
      editing={false}
      locked={locked}
      onStyle={(patch) => handlers.onTextStyleChange?.(blockId, field, patch)}
      onAi={() => handlers.onAi(blockId)}
      onMoveUp={() => handlers.onMove(blockId, 'up')}
      onMoveDown={() => handlers.onMove(blockId, 'down')}
      onDuplicate={() => {
        cancelAllFreeDrags();
        if (itemM?.[1] && handlers.onDuplicateItem) {
          handlers.onDuplicateItem(blockId, itemM[1]);
          return;
        }
        handlers.onDuplicate(blockId);
      }}
      onDelete={() => {
        cancelAllFreeDrags();
        handlers.onDelete(blockId);
      }}
      onCopy={() => handlers.onTextToolbarCopy?.(blockId)}
      onCopyStyle={() => handlers.onTextToolbarCopyStyle?.(blockId)}
      onSaveAsset={() => handlers.onTextToolbarSaveAsset?.(blockId, field)}
      onSyncFromMobile={() => handlers.onTextToolbarSyncFromMobile?.(blockId, field)}
      onToggleHidden={() => handlers.onTextToolbarToggleHidden?.(blockId, field)}
      onToggleLock={() => handlers.onTextToolbarToggleLock?.(blockId, field)}
      onAiPrompt={(rect) => handlers.onTextToolbarAiPrompt?.(blockId, field, rect)}
      isHidden={hidden}
      isLocked={locked}
    />
  );
}

/** Portal-based horizontal quick text toolbar — not clipped by overflow:hidden ancestors. */
function TextEditToolbar({
  blockId,
  field,
  anchorEl,
  textStyle,
  editing = false,
  locked = false,
  onStyle,
  onAi,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onCopy,
  onCopyStyle,
  onSaveAsset,
  onSyncFromMobile,
  onToggleHidden,
  onToggleLock,
  onAiPrompt,
  isHidden = false,
  isLocked = false,
}: {
  blockId: string;
  field: string;
  anchorEl: HTMLElement | null;
  textStyle?: LandingPageInlineTextStyle;
  editing?: boolean;
  locked?: boolean;
  onStyle?: (patch: Partial<LandingPageInlineTextStyle>) => void;
  onAi: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCopy?: () => void;
  onCopyStyle?: () => void;
  onSaveAsset?: () => void;
  onSyncFromMobile?: () => void;
  onToggleHidden?: () => void;
  onToggleLock?: () => void;
  onAiPrompt?: (anchorRect: DOMRect) => void;
  isHidden?: boolean;
  isLocked?: boolean;
}) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const moreBtnRef = useRef<HTMLButtonElement | null>(null);
  const colorBtnRef = useRef<HTMLButtonElement | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const colorPanelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number; placement: 'above' | 'below' } | null>(
    null,
  );
  const [moreOpen, setMoreOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [morePos, setMorePos] = useState<{ left: number; top: number } | null>(null);
  const [colorPos, setColorPos] = useState<{ left: number; top: number } | null>(null);
  const [sizeDraft, setSizeDraft] = useState<string | null>(null);
  const [hexDraft, setHexDraft] = useState('');
  const [myColors, setMyColors] = useState<string[]>(() =>
    typeof window !== 'undefined' ? loadMyTextColors() : LP_TEXT_COLOR_PRESETS.slice(0, 12),
  );

  const btn =
    'inline-flex h-7 shrink-0 items-center justify-center gap-1 rounded px-1.5 text-[11px] font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-40';
  const menuItem =
    'flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-zinc-800 hover:bg-zinc-50';
  const size = textStyle?.fontSize || 14;
  const bold = textStyle?.fontWeight === 'bold' || textStyle?.fontWeight === 700 || textStyle?.fontWeight === 800;
  const align = textStyle?.textAlign || 'left';
  const color = normalizeHexColor(textStyle?.color || '#111827');
  const isHeadingToolbar = field === 'headline';
  const fontFamily = textStyle?.fontFamily || 'system-ui, sans-serif';
  const headingLevel = textStyle?.headingLevel || 2;

  useEffect(() => {
    if (isHeadingToolbar) {
      void import('./landing-page-title-presets').then((m) => m.ensureLandingPageTitleFonts());
    }
  }, [isHeadingToolbar, fontFamily]);

  useEffect(() => {
    setSizeDraft(null);
    setMoreOpen(false);
    setColorOpen(false);
  }, [blockId, field]);

  useEffect(() => {
    setSizeDraft(null);
  }, [size]);

  useEffect(() => {
    if (colorOpen) setHexDraft(color);
  }, [colorOpen, color]);

  useLayoutEffect(() => {
    const update = () => {
      if (document.documentElement.getAttribute('data-lp-heading-box-resizing') === '1') {
        return;
      }
      if (!anchorEl) {
        setPos(null);
        return;
      }
      const r = anchorEl.getBoundingClientRect();
      const barH = barRef.current?.offsetHeight || 36;
      const gap = 8;
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
      const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
      const isMobileViewport = vw <= 767;
      const spaceAbove = r.top - gap;
      const spaceBelow = vh - r.bottom - gap;
      // Mobile: prefer below when space allows (avoid clipping under app chrome).
      // Desktop: prefer above when enough room.
      const preferAbove = isMobileViewport
        ? spaceAbove >= barH + 8 && spaceAbove >= spaceBelow
        : spaceAbove >= barH + 8;
      const placement: 'above' | 'below' = preferAbove ? 'above' : 'below';
      let top = preferAbove ? r.top - barH - gap : r.bottom + gap;
      let left = r.left + r.width / 2;
      const barW = barRef.current?.offsetWidth || 420;
      const half = barW / 2;
      left = Math.min(Math.max(left, half + 8), vw - half - 8);
      top = Math.min(Math.max(top, 8), vh - barH - 8);
      setPos({ left, top, placement });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    window.addEventListener('lp-heading-box-resize-end', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      window.removeEventListener('lp-heading-box-resize-end', update);
    };
  }, [anchorEl, blockId, field]);

  useLayoutEffect(() => {
    if (!moreOpen || !moreBtnRef.current) {
      setMorePos(null);
      return;
    }
    const r = moreBtnRef.current.getBoundingClientRect();
    const menuW = 240;
    const menuH = 280;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = Math.min(Math.max(8, r.right - menuW), vw - menuW - 8);
    let top = r.bottom + 6;
    if (top + menuH > vh - 8) top = Math.max(8, r.top - menuH - 6);
    setMorePos({ left, top });
  }, [moreOpen, pos]);

  useLayoutEffect(() => {
    if (!colorOpen || !colorBtnRef.current) {
      setColorPos(null);
      return;
    }
    const r = colorBtnRef.current.getBoundingClientRect();
    const panelW = 280;
    const panelH = 360;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = Math.min(Math.max(8, r.left + r.width / 2 - panelW / 2), vw - panelW - 8);
    let top = r.bottom + 8;
    if (top + panelH > vh - 8) top = Math.max(8, r.top - panelH - 8);
    setColorPos({ left, top });
  }, [colorOpen, pos]);

  useEffect(() => {
    if (!moreOpen && !colorOpen) return;
    const onDown = (e: globalThis.MouseEvent) => {
      const t = e.target as Node | null;
      if (barRef.current?.contains(t)) return;
      if (moreMenuRef.current?.contains(t)) return;
      if (colorPanelRef.current?.contains(t)) return;
      setMoreOpen(false);
      setColorOpen(false);
    };
    const onKey: EventListener = (ev) => {
      if ((ev as unknown as globalThis.KeyboardEvent).key === 'Escape') {
        setMoreOpen(false);
        setColorOpen(false);
      }
    };
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [moreOpen, colorOpen]);

  const stopAll = (e: { preventDefault: () => void; stopPropagation: () => void }) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const run =
    (fn?: () => void) =>
    (e: MouseEvent) => {
      stopAll(e);
      fn?.();
    };

  const runAction =
    (fn?: () => void) =>
    (e: MouseEvent) => {
      stopAll(e);
      cancelAllFreeDrags();
      try {
        fn?.();
      } catch {
        /* ignore */
      }
    };

  const applyColor = (next: string) => {
    const hex = normalizeHexColor(next, color);
    clearBrowserTextSelection();
    // Explicitly clear gradient fill so solid color always paints.
    onStyle?.({
      color: hex,
      backgroundImage: undefined,
      backgroundClip: undefined,
      webkitTextFillColor: undefined,
    });
    pushMyTextColor(hex);
    setMyColors(loadMyTextColors());
    setHexDraft(hex);
  };

  const commitSize = (raw: string) => {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) {
      setSizeDraft(null);
      return;
    }
    onStyle?.({ fontSize: Math.min(48, Math.max(10, n)) });
    setSizeDraft(null);
  };

  if (typeof document === 'undefined' || !pos) return null;

  const toolbar = (
    <div
      ref={barRef}
      data-lp-text-toolbar
      data-lp-floating-toolbar
      data-lp-toolbar-for={blockId}
      data-lp-toolbar-field={field}
      data-lp-toolbar-placement={pos.placement}
      data-lp-text-toolbar-orient="horizontal"
      // flex-wrap (not flex-nowrap): every child below is shrink-0 by design (icon
      // buttons/selects must not squash), so on mobile the min content width (up to
      // ~700px for the heading variant) exceeds the max-w cap — flex-nowrap left the
      // excess buttons rendered past the box's right edge, past the viewport edge,
      // and unreachable (html/body use overflow-x:clip, so there's no scroll to
      // recover them either). Wrapping to a 2nd row keeps every control reachable.
      className="fixed z-[9995] flex max-w-[min(calc(100vw-1rem),720px)] -translate-x-1/2 flex-row flex-wrap items-center gap-0.5 overflow-visible rounded-lg border border-zinc-200 bg-white px-1 py-0.5 shadow-lg max-[767px]:data-[lp-toolbar-placement=below]:translate-y-0"
      style={{ left: pos.left, top: pos.top }}
      onClick={(e) => {
        e.stopPropagation();
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => {
        // Keep contentEditable focus for style buttons, but NEVER block color/more/input defaults.
        const t = e.target as HTMLElement | null;
        if (
          t?.closest?.(
            'input, textarea, select, [data-lp-text-color], [data-lp-text-more], [data-lp-text-color-panel], [data-lp-text-more-menu], [data-lp-text-font], [data-lp-text-heading-level]',
          )
        ) {
          e.stopPropagation();
          return;
        }
        if (editing) e.preventDefault();
        e.stopPropagation();
      }}
    >
      {isHeadingToolbar ? (
        <>
          <select
            className="h-7 max-w-[7.5rem] shrink-0 rounded border border-zinc-200 bg-white px-1 text-[11px] text-zinc-800"
            data-lp-text-font
            title="Font chữ"
            disabled={locked}
            value={
              LP_TEXT_FONT_OPTIONS.some((f) => f.value === fontFamily)
                ? fontFamily
                : LP_TEXT_FONT_OPTIONS[0]!.value
            }
            onChange={(e) => {
              e.stopPropagation();
              onStyle?.({ fontFamily: e.target.value });
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {LP_TEXT_FONT_OPTIONS.map((f) => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            className="h-7 w-[3.25rem] shrink-0 rounded border border-zinc-200 bg-white px-1 text-[11px] font-semibold text-zinc-800"
            data-lp-text-heading-level
            title="Loại Heading"
            disabled={locked}
            value={String(headingLevel)}
            onChange={(e) => {
              e.stopPropagation();
              const level = Number(e.target.value) as 1 | 2 | 3 | 4 | 5 | 6;
              if (level < 1 || level > 6) return;
              const preset = LP_HEADING_LEVEL_PRESETS[level];
              // Semantic tag + matching font-size. Keep family / align / bold / text.
              onStyle?.({
                headingLevel: level,
                fontSize: preset.fontSize,
              });
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {([1, 2, 3, 4, 5, 6] as const).map((lvl) => (
              <option key={lvl} value={lvl}>
                H{lvl}
              </option>
            ))}
          </select>
          <span className="mx-0.5 h-4 w-px shrink-0 bg-zinc-200" aria-hidden />
        </>
      ) : null}
      <button
        type="button"
        className={btn}
        title="Giảm cỡ chữ"
        data-lp-text-fs-dec
        disabled={locked}
        onClick={run(() => onStyle?.({ fontSize: Math.max(10, size - 1) }))}
      >
        A−
      </button>
      <input
        type="number"
        min={10}
        max={48}
        className="h-7 w-10 shrink-0 rounded border border-zinc-200 bg-white text-center text-[11px] tabular-nums text-zinc-700"
        data-lp-text-fs
        value={sizeDraft ?? String(size)}
        disabled={locked}
        onChange={(e) => setSizeDraft(e.target.value)}
        onBlur={(e) => commitSize(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            commitSize((e.target as HTMLInputElement).value);
          }
        }}
        onMouseDown={(e) => e.stopPropagation()}
      />
      <button
        type="button"
        className={btn}
        title="Tăng cỡ chữ"
        data-lp-text-fs-inc
        disabled={locked}
        onClick={run(() => onStyle?.({ fontSize: Math.min(48, size + 1) }))}
      >
        A+
      </button>
      <span className="mx-0.5 h-4 w-px shrink-0 bg-zinc-200" aria-hidden />
      <button
        type="button"
        className={`${btn} ${bold ? 'bg-zinc-100 font-bold' : ''}`}
        title="Đậm"
        data-lp-text-bold
        disabled={locked}
        onClick={run(() => onStyle?.({ fontWeight: bold ? 'normal' : 'bold' }))}
      >
        B
      </button>
      <button
        type="button"
        className={`${btn} ${align === 'left' ? 'bg-zinc-100' : ''}`}
        title="Căn trái"
        data-lp-text-align="left"
        disabled={locked}
        onClick={run(() => onStyle?.({ textAlign: 'left' }))}
      >
        ≡
      </button>
      <button
        type="button"
        className={`${btn} ${align === 'center' ? 'bg-zinc-100' : ''}`}
        title="Căn giữa"
        data-lp-text-align="center"
        disabled={locked}
        onClick={run(() => onStyle?.({ textAlign: 'center' }))}
      >
        ☰
      </button>
      <button
        type="button"
        className={`${btn} ${align === 'right' ? 'bg-zinc-100' : ''}`}
        title="Căn phải"
        data-lp-text-align="right"
        disabled={locked}
        onClick={run(() => onStyle?.({ textAlign: 'right' }))}
      >
        ≡|
      </button>
      <button
        ref={colorBtnRef}
        type="button"
        className={`${btn} ${colorOpen ? 'bg-zinc-100' : ''}`}
        title="Màu chữ"
        data-lp-text-color
        disabled={locked}
        aria-expanded={colorOpen}
        onClick={(e) => {
          stopAll(e);
          clearBrowserTextSelection();
          setMoreOpen(false);
          setColorOpen((v) => !v);
        }}
      >
        <span className="font-semibold underline decoration-2" style={{ textDecorationColor: color }}>
          A
        </span>
      </button>
      <span className="mx-0.5 h-4 w-px shrink-0 bg-zinc-200" aria-hidden />
      <button
        type="button"
        className={btn}
        title="AI Tools"
        data-lp-text-ai
        disabled={locked}
        onClick={run(onAi)}
      >
        <WandIcon />
        <span className="hidden sm:inline">AI</span>
      </button>
      <button
        type="button"
        className={btn}
        title="Lên"
        data-lp-text-move-up
        onClick={runAction(onMoveUp)}
      >
        ↑
      </button>
      <button
        type="button"
        className={btn}
        title="Xuống"
        data-lp-text-move-down
        onClick={runAction(onMoveDown)}
      >
        ↓
      </button>
      <button
        type="button"
        className={btn}
        title="Nhân bản"
        data-lp-text-dup
        onPointerDown={(e) => {
          e.stopPropagation();
        }}
        onClick={runAction(() => {
          onDuplicate();
        })}
      >
        <CopyIcon />
      </button>
      <button
        type="button"
        className={`${btn} text-red-600 hover:bg-red-50`}
        title="Xóa"
        data-lp-text-del
        onClick={runAction(onDelete)}
      >
        <TrashIcon />
      </button>
      <button
        ref={moreBtnRef}
        type="button"
        className={`${btn} ${moreOpen ? 'bg-zinc-100' : ''}`}
        title="Thêm"
        data-lp-text-more
        aria-expanded={moreOpen}
        onClick={(e) => {
          stopAll(e);
          setColorOpen(false);
          setMoreOpen((v) => !v);
        }}
      >
        …
      </button>
    </div>
  );

  const moreMenu =
    moreOpen && morePos ? (
      <div
        ref={moreMenuRef}
        data-lp-text-more-menu
        data-lp-text-more-orient="vertical"
        data-lp-floating-toolbar
        className="fixed z-[9998] flex min-w-[220px] flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-xl"
        style={{ left: morePos.left, top: morePos.top }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={menuItem}
          data-lp-text-more-copy
          onClick={run(() => {
            onCopy?.();
            setMoreOpen(false);
          })}
        >
          <CopyIcon /> Sao chép
          <span className="ml-auto text-[10px] text-zinc-400">CTRL + C</span>
        </button>
        <button
          type="button"
          className={menuItem}
          data-lp-text-more-copy-style
          onClick={run(() => {
            onCopyStyle?.();
            setMoreOpen(false);
          })}
        >
          <span className="inline-flex h-3 w-3 items-center justify-center text-[10px]">✎</span>
          Sao chép thiết kế
        </button>
        <button
          type="button"
          className={menuItem}
          data-lp-text-more-save-asset
          onClick={run(() => {
            onSaveAsset?.();
            setMoreOpen(false);
          })}
        >
          <span className="inline-flex h-3 w-3 items-center justify-center text-[10px]">💾</span>
          Lưu Assets
        </button>
        <button
          type="button"
          className={menuItem}
          data-lp-text-more-sync-mobile
          onClick={run(() => {
            onSyncFromMobile?.();
            setMoreOpen(false);
          })}
        >
          <span className="inline-flex h-3 w-3 items-center justify-center text-[10px]">↻</span>
          Đồng bộ thiết kế từ Mobile
        </button>
        <button
          type="button"
          className={menuItem}
          data-lp-text-more-hide
          onClick={run(() => {
            onToggleHidden?.();
            setMoreOpen(false);
          })}
        >
          <span className="inline-flex h-3 w-3 items-center justify-center text-[10px]">👁</span>
          {isHidden ? 'Hiện phần tử' : 'Ẩn phần tử'}
        </button>
        <button
          type="button"
          className={menuItem}
          data-lp-text-more-lock
          onClick={run(() => {
            onToggleLock?.();
            setMoreOpen(false);
          })}
        >
          <span className="inline-flex h-3 w-3 items-center justify-center text-[10px]">🔒</span>
          {isLocked ? 'Mở khóa phần tử' : 'Khóa phần tử'}
        </button>
        <button
          type="button"
          className={menuItem}
          data-lp-text-more-ai-prompt
          onClick={run(() => {
            const rect = barRef.current?.getBoundingClientRect();
            if (rect) onAiPrompt?.(rect);
            setMoreOpen(false);
          })}
        >
          <WandIcon /> AI Prompt
        </button>
      </div>
    ) : null;

  const colorPanel =
    colorOpen && colorPos ? (
      <div
        ref={colorPanelRef}
        data-lp-text-color-panel
        data-lp-floating-toolbar
        className="fixed z-[9998] w-[280px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl"
        style={{ left: colorPos.left, top: colorPos.top }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2">
          <div className="text-sm font-semibold text-zinc-800">Chọn màu</div>
          <button
            type="button"
            className="rounded p-1 text-zinc-500 hover:bg-zinc-100"
            data-lp-text-color-close
            onClick={run(() => setColorOpen(false))}
          >
            ✕
          </button>
        </div>
        <div className="space-y-3 p-3">
          <div className="flex items-center gap-2">
            <input
              type="color"
              className="h-10 w-14 cursor-pointer rounded border border-zinc-200 bg-transparent p-0"
              value={color}
              onChange={(e) => applyColor(e.target.value)}
              data-lp-text-color-native
            />
            <div
              className="h-10 flex-1 rounded-md border border-zinc-200"
              style={{ background: color }}
              data-lp-text-color-preview
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              className="h-8 flex-1 rounded border border-zinc-200 px-2 text-xs uppercase"
              value={hexDraft}
              data-lp-text-color-hex
              onChange={(e) => setHexDraft(e.target.value)}
              onBlur={() => {
                if (/^#?[0-9a-fA-F]{3,6}$/.test(hexDraft.trim())) {
                  const raw = hexDraft.trim().startsWith('#') ? hexDraft.trim() : `#${hexDraft.trim()}`;
                  applyColor(normalizeHexColor(raw, color));
                } else {
                  setHexDraft(color);
                }
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              }}
            />
            <span className="rounded bg-blue-50 px-2 py-1 text-[10px] font-semibold text-blue-600">
              HEX
            </span>
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-medium text-zinc-500">Màu của tôi</div>
            <div className="flex flex-wrap gap-1.5" data-lp-text-color-mine>
              {myColors.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  className={`h-6 w-6 rounded-full border ${
                    c.toLowerCase() === color.toLowerCase()
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : 'border-zinc-200'
                  }`}
                  style={{ background: c }}
                  onClick={run(() => applyColor(c))}
                />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-medium text-zinc-500">Bảng màu</div>
            <div className="grid grid-cols-9 gap-1" data-lp-text-color-palette>
              {LP_TEXT_COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  className={`h-5 w-full rounded-sm border ${
                    c.toLowerCase() === color.toLowerCase()
                      ? 'border-blue-500 ring-1 ring-blue-300'
                      : 'border-zinc-200'
                  }`}
                  style={{ background: c }}
                  onClick={run(() => applyColor(c))}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    ) : null;

  return createPortal(
    <>
      {toolbar}
      {moreMenu}
      {colorPanel}
    </>,
    document.body,
  );
}

/**
 * Nested card/item reorder — drag ONLY via dedicated handle.
 * Item MIME never accepted by section drop; parent blockId must match.
 * Free-drag (opt-in) via pointer after select — separate from reorder MIME.
 */
export function ItemReorderChrome({
  blockId,
  index,
  itemId,
  handlers,
  children,
}: {
  blockId: string;
  index: number;
  itemId: string;
  handlers?: LandingPageCanvasHandlers | null;
  children: ReactNode;
}) {
  if (!handlers) return <>{children}</>;
  return (
    <ItemReorderChromeInteractive blockId={blockId} index={index} itemId={itemId} handlers={handlers}>
      {children}
    </ItemReorderChromeInteractive>
  );
}

function ItemReorderChromeInteractive({
  blockId,
  index,
  itemId,
  handlers,
  children,
}: {
  blockId: string;
  index: number;
  itemId: string;
  handlers: LandingPageCanvasHandlers;
  children: ReactNode;
}) {
  const element: LandingPageCanvasElementKey = `item:${itemId}`;
  const selected =
    handlers.selection?.blockId === blockId && handlers.selection.element === element;
  const pointerRef = useRef<{ x: number; y: number; moved: boolean; freeIntent?: boolean } | null>(
    null,
  );
  const viewport = handlers.viewport || 'desktop';
  const layoutRaw = handlers.getItemFreeLayout?.(blockId, itemId) ?? null;
  const layout = isPlausibleFreeLayout(layoutRaw, 'offset') ? layoutRaw : null;
  const freeEnabled = Boolean(handlers.onItemFreeLayoutCommit);

  const freeDrag = useFreeDragBox({
    enabled: freeEnabled,
    selected: Boolean(selected),
    viewport,
    layout,
    mode: 'offset',
    onCommit: (payload) => handlers.onItemFreeLayoutCommit?.(blockId, itemId, payload),
  });

  return (
    <div
      ref={(node) => {
        freeDrag.shellRef.current = node;
      }}
      data-lp-item-id={itemId}
      data-lp-item-index={index}
      data-lp-item-parent={blockId}
      data-lp-element-id={`${blockId}::${element}`}
      data-lp-free-id={`${blockId}::${itemId}`}
      data-lp-free-box="1"
      data-lp-free-mode="offset"
      data-lp-position-mode={layout ? 'free' : 'flow'}
      data-lp-bounding-box={selected ? '1' : '0'}
      draggable={false}
      style={freeLayoutStyle(layout, freeDrag.dragging, 'offset')}
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes(LP_ITEM_MIME)) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.setAttribute('data-lp-item-drop-over', '1');
      }}
      onDragLeave={(e) => e.currentTarget.removeAttribute('data-lp-item-drop-over')}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.removeAttribute('data-lp-item-drop-over');
        try {
          const raw = e.dataTransfer.getData(LP_ITEM_MIME);
          const parsed = JSON.parse(raw) as { blockId: string; itemId: string };
          if (parsed.blockId !== blockId) return;
          if (parsed.itemId === itemId) return;
          handlers.onReorderItem(blockId, parsed.itemId, itemId);
        } catch {
          /* ignore */
        }
      }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement | null)?.closest?.('[data-lp-item-handle]')) return;
        if ((e.target as HTMLElement | null)?.closest?.('[data-lp-inline-editing="1"]')) return;
        if ((e.target as HTMLElement | null)?.closest?.('[data-lp-resize-handle],[data-lp-rotate-handle]')) {
          return;
        }
        if (e.button !== 0) return;
        pointerRef.current = { x: e.clientX, y: e.clientY, moved: false };
        if (
          selected &&
          freeEnabled &&
          !(e.target as HTMLElement | null)?.closest?.(
            'input, textarea, select, a[href], button:not([data-lp-free-drag-handle]), [data-lp-item-handle]',
          )
        ) {
          freeDrag.beginDrag(e, { force: true });
        }
      }}
      onPointerMove={(e) => {
        const p = pointerRef.current;
        if (!p || freeDrag.dragging) return;
        if (Math.abs(e.clientX - p.x) > TAP_MOVE_PX || Math.abs(e.clientY - p.y) > TAP_MOVE_PX) {
          p.moved = true;
        }
      }}
      onPointerUp={(e) => {
        if (freeDrag.isActive()) {
          if (!freeDrag.dragging) freeDrag.cancelPending();
          else return;
        }
        const p = pointerRef.current;
        pointerRef.current = null;
        if (!p || p.moved) return;
        if ((e.target as HTMLElement | null)?.closest?.('[data-lp-item-handle]')) return;
        e.preventDefault();
        e.stopPropagation();
        handlers.onSelect({ blockId, element });
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      className={`relative min-w-0 outline-offset-2 ${
        selected
          ? 'z-[1] cursor-grab outline outline-2 outline-[#F97316]/80 active:cursor-grabbing data-[lp-free-dragging=1]:outline-dashed data-[lp-free-dragging=1]:outline-blue-700'
          : '[@media(hover:hover)]:hover:outline [@media(hover:hover)]:hover:outline-1 [@media(hover:hover)]:hover:outline-dashed [@media(hover:hover)]:hover:outline-[#F97316]/35 data-[lp-item-drop-over=1]:outline data-[lp-item-drop-over=1]:outline-2 data-[lp-item-drop-over=1]:outline-dashed data-[lp-item-drop-over=1]:outline-[#F97316]/60'
      }`}
    >
      {selected && freeEnabled ? (
        <button
          type="button"
          data-lp-free-drag-handle
          title="Kéo tự do"
          className="absolute left-1 top-1 z-[6] inline-flex h-7 cursor-grab touch-none items-center gap-1 rounded border border-zinc-200 bg-white/95 px-1.5 text-[10px] font-medium text-zinc-700 shadow-sm active:cursor-grabbing"
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handlers.onSelect({ blockId, element });
            freeDrag.beginDrag(e, { force: true, immediate: true });
          }}
        >
          ✥
        </button>
      ) : null}
      {selected && handlers.onDuplicateItem ? (
        <button
          type="button"
          data-lp-item-dup
          title="Nhân bản card"
          className="absolute left-9 top-1 z-[6] inline-flex h-7 items-center justify-center rounded border border-zinc-200 bg-white/95 px-1.5 text-[10px] font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            cancelAllFreeDrags();
            handlers.onDuplicateItem?.(blockId, itemId);
          }}
        >
          <CopyIcon />
        </button>
      ) : null}
      <button
        type="button"
        data-lp-item-handle
        title="Kéo đổi thứ tự card"
        draggable
        aria-label="Kéo đổi thứ tự"
        className="absolute right-1 top-1 z-[5] inline-flex h-7 w-7 cursor-grab touch-none items-center justify-center rounded border border-zinc-200 bg-white/95 text-zinc-600 shadow-sm active:cursor-grabbing"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handlers.onSelect({ blockId, element });
        }}
        onDragStart={(e) => {
          e.stopPropagation();
          const shell = (e.target as HTMLElement | null)?.closest?.('[data-lp-block-id]');
          if (shell?.querySelector?.('[data-lp-inline-editing="1"]')) {
            e.preventDefault();
            return;
          }
          e.dataTransfer.setData(
            LP_ITEM_MIME,
            JSON.stringify({ blockId, itemId, index }),
          );
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.clearData(LP_BLOCK_MIME);
        }}
      >
        <GripIcon />
      </button>
      {selected && freeEnabled ? (
        <FreeTransformChrome
          visible
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
      {/* Clipping to the resized height happens on the shell itself now
          (freeLayoutStyle, offset mode: minHeight:0 + overflow:hidden) — that's
          also what neutralizes the CSS grid/flex "automatic minimum size"
          override that was silently keeping this shell at content height
          regardless of the explicit smaller `height`. See BUG note there. */}
      {children}
    </div>
  );
}

function GripIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M10 4h2v2h-2V4zm4 0h2v2h-2V4zM10 9h2v2h-2V9zm4 0h2v2h-2V9zm-4 5h2v2h-2v-2zm4 0h2v2h-2v-2zm-4 5h2v2h-2v-2zm4 0h2v2h-2v-2z" />
    </svg>
  );
}
function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}
function WandIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M15 4V2M15 16v-2M8 9H6M22 9h-2M18.4 13.4 20 15M18.4 4.6 20 3M11.6 13.4 10 15M11.6 4.6 10 3" />
      <path d="m4 20 8-8" />
    </svg>
  );
}
function ImageIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10.5" r="1.5" />
      <path d="m21 15-4.5-4.5L9 18" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  );
}
