import type { LandingPageSectionPlacement } from '@marketingspa/shared';
import { LP_CONTENT_COLUMNS_MAX } from '@marketingspa/shared';
import type { LpSidebarInsertPos, LpSidebarPresetPayload } from './landing-page-sidebar-dnd';

export type DropRect = { left: number; top: number; width: number; height: number };
export type SidebarDropTarget = {
  position: LpSidebarInsertPos;
  region: DropRect;
  line?: DropRect;
  sectionId?: string;
  barColor?: '#000000' | '#ffffff' | '#00E174';
  /** Horizontal = flow slot; vertical = new/existing column. */
  orientation?: 'horizontal' | 'vertical';
  /** Canvas-space bounds in viewport pixels; keeps visual drop feedback inside its section. */
  sectionBounds?: DropRect;
  frame?: { blockId: string; gridIndex?: number };
};
const rect = (r: DOMRect): DropRect => ({
  left: r.left,
  top: r.top,
  width: r.width,
  height: r.height,
});
const esc = (s: string) => CSS.escape(s);

export function isPageSidebarPayload(payload: LpSidebarPresetPayload): boolean {
  return (
    payload.kind === 'section-library-open' ||
    payload.kind === 'section-preset' ||
    payload.kind === 'block-type' ||
    payload.kind === 'form-library-open' ||
    payload.kind === 'form' ||
    (payload.kind === 'add-picker-open' && payload.picker === 'forms')
  );
}

export function sectionPlacementFromInsertPos(
  pos?: LpSidebarInsertPos | null,
): LandingPageSectionPlacement | undefined {
  return pos?.mode === 'section-element'
    ? {
        sectionId: pos.blockId,
        anchor: pos.anchor,
        edge: pos.edge,
        ...(typeof pos.columnIndex === 'number' ? { columnIndex: pos.columnIndex } : {}),
      }
    : undefined;
}

export function sectionHost(root: Element, id: string): HTMLElement | null {
  return root.querySelector(`[data-lp-section-chrome="1"][data-lp-block-id="${esc(id)}"]`);
}

/** Resolve a persisted semantic anchor, independent of selection, scroll and zoom. */
export function sectionAnchor(
  host: HTMLElement,
  placement: LandingPageSectionPlacement,
): { node: HTMLElement; end?: boolean } | null {
  const a = placement.anchor;
  if (typeof placement.columnIndex === 'number') {
    const cell = host.querySelector<HTMLElement>(
      `[data-lp-content-column="${esc(String(placement.columnIndex))}"]`,
    );
    if (cell && a.kind === 'end') return { node: cell, end: true };
    if (cell && a.kind !== 'end') host = cell;
  }
  if (a.kind === 'end') {
    const ownSection = Array.from(host.querySelectorAll<HTMLElement>('section,footer,header')).find(
      (n) => n.closest('[data-lp-section-chrome="1"]') === host,
    );
    return { node: ownSection || host, end: true };
  }
  const owner =
    a.blockId === placement.sectionId
      ? host
      : host.querySelector<HTMLElement>(
          `[data-lp-section-element="1"][data-lp-block-id="${esc(a.blockId)}"]`,
        );
  if (!owner) return null;
  if (a.kind === 'submit') {
    const node = owner.querySelector<HTMLElement>('form[data-lp-form-block] button[type="submit"]');
    return node ? { node } : null;
  }
  const field = owner.querySelector<HTMLElement>(
    `[data-lp-inline-field="${esc(a.field)}"],[data-lp-field-anchor="${esc(a.field)}"]`,
  );
  if (!field) return null;
  const node =
    field.closest<HTMLElement>('button,a,label') ||
    field.closest<HTMLElement>('[data-lp-inline-wrap]') ||
    field;
  return owner.contains(node) ? { node } : null;
}

/** White sections use a black bar; every other painted surface uses white. */
export function sectionDropBarColor(host: HTMLElement): '#000000' | '#ffffff' {
  const surface =
    Array.from(host.querySelectorAll<HTMLElement>('section,footer,header')).find(
      (node) => node.closest('[data-lp-section-chrome="1"]') === host,
    ) || host;
  const colors: Array<{ r: number; g: number; b: number; a: number }> = [];
  const read = (node: HTMLElement) => {
    const style = getComputedStyle(node);
    if (style.backgroundImage && style.backgroundImage !== 'none') return false;
    const values = style.backgroundColor.match(/[\d.]+/g)?.map(Number);
    if (values && values.length >= 3)
      colors.push({ r: values[0]!, g: values[1]!, b: values[2]!, a: values[3] ?? 1 });
    return true;
  };
  for (let node: HTMLElement | null = surface; node; node = node.parentElement) {
    if (node === host) {
      const layer = host.querySelector<HTMLElement>('[data-lp-section-bg-layer="1"]');
      if (layer) {
        if (layer.querySelector('[data-lp-section-bg-media]')) return '#ffffff';
        if (!read(layer)) return '#ffffff';
      }
    }
    if (!read(node)) return '#ffffff';
    if (colors.some((color) => color.a >= 1)) break;
  }
  let painted = { r: 255, g: 255, b: 255 };
  for (const c of colors.reverse())
    painted = {
      r: c.r * c.a + painted.r * (1 - c.a),
      g: c.g * c.a + painted.g * (1 - c.a),
      b: c.b * c.a + painted.b * (1 - c.a),
    };
  return painted.r >= 254.5 && painted.g >= 254.5 && painted.b >= 254.5 ? '#000000' : '#ffffff';
}

export const LP_DROP_BAR_HEIGHT = 20;
export const LP_COLUMN_BAR_WIDTH = 20;

function slotBar(left: number, width: number, y: number, edge: 'before' | 'after'): DropRect {
  return {
    left,
    width,
    top: edge === 'before' ? y - LP_DROP_BAR_HEIGHT : y,
    height: LP_DROP_BAR_HEIGHT,
  };
}

function columnBar(box: DropRect): DropRect {
  return {
    left: box.left,
    top: box.top,
    width: LP_COLUMN_BAR_WIDTH,
    height: Math.max(48, box.height),
  };
}

/** Keep a drop bar fully inside the landing page / section, never in the inspector gutter. */
export function intersectRects(a: DropRect, b: DropRect): DropRect {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.left + a.width, b.left + b.width);
  const bottom = Math.min(a.top + a.height, b.top + b.height);
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

export function clampRectToBounds(rect: DropRect, bounds: DropRect, pad = 2): DropRect {
  const maxW = Math.max(8, bounds.width - pad * 2);
  const maxH = Math.max(8, bounds.height - pad * 2);
  const width = Math.min(Math.max(8, rect.width), maxW);
  const height = Math.min(Math.max(8, rect.height), maxH);
  const left = Math.min(
    Math.max(rect.left, bounds.left + pad),
    bounds.left + bounds.width - pad - width,
  );
  const top = Math.min(
    Math.max(rect.top, bounds.top + pad),
    bounds.top + bounds.height - pad - height,
  );
  return { left, top, width, height };
}

/** Place the orange element toolbar beside an anchor, always inside the landing page. */
export function placeVerticalToolbar(input: {
  anchor: DropRect;
  canvas: DropRect;
  toolbarW: number;
  toolbarH: number;
  gap?: number;
  pad?: number;
  viewTop?: number;
  viewBottom?: number;
}): { left: number; top: number; side: 'left' | 'right' } | null {
  const { anchor, canvas, toolbarW, toolbarH } = input;
  const gap = input.gap ?? 6;
  const pad = input.pad ?? 16;
  if (canvas.width < toolbarW + pad * 2 || canvas.height < 8) return null;
  const canvasRight = canvas.left + canvas.width;
  const canvasBottom = canvas.top + canvas.height;
  const viewTop = Math.max(canvas.top + pad, input.viewTop ?? canvas.top + pad);
  const viewBottom = Math.min(canvasBottom - pad, input.viewBottom ?? canvasBottom - pad);
  const overlapTop = Math.max(anchor.top, viewTop);
  const overlapBottom = Math.min(anchor.top + anchor.height, viewBottom);
  if (overlapBottom - overlapTop <= 0) return null;

  const preferRight = anchor.left + anchor.width + gap;
  const preferLeft = anchor.left - gap - toolbarW;
  const minLeft = canvas.left + pad;
  const maxLeft = canvasRight - pad - toolbarW;
  const insideRight = Math.min(anchor.left + anchor.width, canvasRight) - pad - toolbarW;
  let left = preferRight;
  let side: 'left' | 'right' = 'right';
  if (preferRight <= maxLeft) {
    left = preferRight;
    side = 'right';
  } else if (preferLeft >= minLeft) {
    left = preferLeft;
    side = 'left';
  } else {
    // No room beside the block — sit on the block, still on the page.
    left = insideRight;
    side = 'right';
  }
  left = Math.min(Math.max(left, minLeft), maxLeft);

  const visibleMid = (overlapTop + overlapBottom) / 2 - toolbarH / 2;
  const topBase = anchor.height > 220 && anchor.top >= viewTop - 8 ? anchor.top + 16 : visibleMid;
  const top = Math.min(Math.max(viewTop, topBase), viewBottom - toolbarH);
  return { left, top, side };
}

/** Visible landing-page box: canvas ∩ scrollport ∩ content-safe, cut before the inspector. */
export function readToolbarPageBounds(input: {
  canvas: DropRect;
  scroll?: DropRect | null;
  inspector?: DropRect | null;
  contentSafe?: DropRect | null;
}): DropRect {
  let bounds = input.canvas;
  if (input.scroll && input.scroll.width > 8 && input.scroll.height > 8) {
    bounds = intersectRects(bounds, input.scroll);
  }
  if (input.contentSafe && input.contentSafe.width > 80 && input.contentSafe.height > 8) {
    bounds = intersectRects(bounds, input.contentSafe);
  }
  if (input.inspector && input.inspector.width > 8) {
    const cut = input.inspector.left;
    if (cut > bounds.left + 40) {
      bounds = { ...bounds, width: Math.max(0, Math.min(bounds.width, cut - bounds.left)) };
    }
  }
  return bounds;
}

export function columnEdgePx(width: number): number {
  return Math.max(40, Math.min(140, width * 0.25));
}

/** Pick the column under the pointer, or a new column when the pointer is on an edge/gap. */
export function pickColumnBox(
  pointerX: number,
  container: DropRect,
  columns: DropRect[],
): { box: DropRect; columnIndex: number; splitColumns?: number } {
  const sorted = [...columns].sort((a, b) => a.left - b.left);
  const n = sorted.length;
  if (!n) return { box: container, columnIndex: 0 };
  const colRight = (c: DropRect) => c.left + c.width;
  const containerRight = container.left + container.width;
  const last = sorted[n - 1]!;
  const first = sorted[0]!;
  const canSplit = n < LP_CONTENT_COLUMNS_MAX;
  const newWidth = Math.max(48, container.width / (n + 1));

  if (canSplit && pointerX >= colRight(last) - columnEdgePx(last.width) && pointerX <= containerRight + columnEdgePx(last.width)) {
    return {
      box: {
        left: colRight(last),
        top: container.top,
        width: newWidth,
        height: container.height,
      },
      columnIndex: n,
      splitColumns: n + 1,
    };
  }
  if (canSplit && pointerX >= container.left - columnEdgePx(first.width) && pointerX <= first.left + columnEdgePx(first.width)) {
    return {
      box: {
        left: Math.max(container.left, first.left - newWidth),
        top: container.top,
        width: newWidth,
        height: container.height,
      },
      columnIndex: 0,
      splitColumns: n + 1,
    };
  }
  if (canSplit) {
    for (let i = 0; i < n - 1; i++) {
      const a = sorted[i]!;
      const b = sorted[i + 1]!;
      const aRight = colRight(a);
      if (pointerX >= aRight - columnEdgePx(a.width) && pointerX <= b.left + columnEdgePx(b.width)) {
        return {
          box: {
            left: aRight,
            top: container.top,
            width: Math.max(newWidth, b.left - aRight),
            height: container.height,
          },
          columnIndex: i + 1,
          splitColumns: n + 1,
        };
      }
    }
  }
  for (let i = 0; i < n; i++) {
    const c = sorted[i]!;
    if (pointerX >= c.left && pointerX <= colRight(c)) {
      return { box: { ...c, top: container.top, height: container.height }, columnIndex: i };
    }
  }
  const nearest = sorted.reduce((best, c) => {
    const mid = c.left + c.width / 2;
    const d = Math.abs(pointerX - mid);
    return d < Math.abs(pointerX - (best.left + best.width / 2)) ? c : best;
  }, first);
  return {
    box: { ...nearest, top: container.top, height: container.height },
    columnIndex: Math.max(0, sorted.indexOf(nearest)),
  };
}

export function readColumnRects(host: HTMLElement): { container: DropRect; columns: DropRect[] } {
  const hostBox = rect(host.getBoundingClientRect());
  const grid = host.querySelector<HTMLElement>('[data-lp-content-columns]');
  if (grid) {
    const cells = Array.from(grid.querySelectorAll<HTMLElement>(':scope > [data-lp-content-column]'));
    if (cells.length) {
      return {
        container: hostBox,
        columns: cells
          .sort((a, b) => Number(a.dataset.lpContentColumn || 0) - Number(b.dataset.lpContentColumn || 0))
          .map((c) => rect(c.getBoundingClientRect())),
      };
    }
  }
  const split = host.querySelector<HTMLElement>(
    '[data-lp-hero-grid],[data-lp-cta-split],[data-lp-form-split]',
  );
  if (split) {
    const kids = Array.from(split.children).filter((n): n is HTMLElement => n instanceof HTMLElement);
    if (kids.length >= 2) {
      return {
        container: hostBox,
        columns: kids.map((c) => rect(c.getBoundingClientRect())),
      };
    }
  }
  const inner =
    host.querySelector<HTMLElement>('[data-lp-container-inner]') ||
    Array.from(host.querySelectorAll<HTMLElement>('section,footer,header')).find(
      (n) => n.closest('[data-lp-section-chrome="1"]') === host,
    ) ||
    host;
  const box = rect(inner.getBoundingClientRect());
  // Gutters left/right of the copy (still on the green section) are new columns.
  return { container: hostBox, columns: [box] };
}

function acceptsFlow(node: HTMLElement): boolean {
  const p = node.parentElement;
  if (!p || p.closest('[data-lp-grid-block],[data-lp-frame]')) return false;
  const s = getComputedStyle(p);
  return (
    s.display !== 'grid' &&
    s.display !== 'inline-grid' &&
    !(s.display.includes('flex') && !s.flexDirection.startsWith('column'))
  );
}

/** One resolver for the marker and the actual drop. */
export function resolveSidebarDropTarget(
  root: HTMLElement,
  host: HTMLElement | null,
  payload: LpSidebarPresetPayload,
  point: { clientX: number; clientY: number; target?: EventTarget | null },
): SidebarDropTarget | null {
  if (!host) {
    if (!isPageSidebarPayload(payload)) return null;
    const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-lp-section-chrome="1"]'));
    const distance = (n: HTMLElement) =>
      Math.min(
        Math.abs(point.clientY - n.getBoundingClientRect().top),
        Math.abs(point.clientY - n.getBoundingClientRect().bottom),
      );
    const nearest = sections.sort((a, b) => distance(a) - distance(b))[0];
    if (nearest) return resolveSidebarDropTarget(root, nearest, payload, point);
    const r = root.getBoundingClientRect();
    return {
      position: { mode: 'end' },
      region: rect(r),
      barColor: sectionDropBarColor(root),
      line: slotBar(r.left, r.width, r.bottom, 'before'),
    };
  }
  const sectionId = host.dataset.lpBlockId;
  if (!sectionId || host.dataset.lpInsertLocked === '1') return null;
  const r = host.getBoundingClientRect();
  const barColor = sectionDropBarColor(host);
  if (isPageSidebarPayload(payload)) {
    const before = point.clientY < r.top + r.height / 2;
    return {
      sectionId,
      barColor,
      position: { mode: before ? 'before' : 'after', blockId: sectionId },
      region: rect(r),
      line: slotBar(r.left, r.width, before ? r.top : r.bottom, before ? 'before' : 'after'),
    };
  }
  const hit =
    point.target instanceof Element
      ? point.target
      : document.elementFromPoint(point.clientX, point.clientY);
  if (
    payload.kind === 'media' ||
    (payload.kind === 'add-picker-open' && payload.picker === 'media')
  ) {
    const frame = hit?.closest<HTMLElement>('[data-lp-frame="1"],[data-lp-grid-block="1"]');
    if (frame && host.contains(frame)) {
      const cell = hit?.closest<HTMLElement>('[data-lp-grid-cell]');
      const blockId = frame.closest<HTMLElement>('[data-lp-block-id]')?.dataset.lpBlockId;
      if (blockId)
        return {
          sectionId,
          barColor,
          position: {
            mode: 'image-target',
            blockId,
            ...(cell ? { gridIndex: Number(cell.dataset.lpGridCell) } : {}),
          },
          region: rect((cell || frame).getBoundingClientRect()),
          frame: { blockId, ...(cell ? { gridIndex: Number(cell.dataset.lpGridCell) } : {}) },
        };
    }
  }
  if (host.dataset.lpBlockType === 'Header' || host.closest('[data-lp-html-document]'))
    return null;
  const columns = readColumnRects(host);
  const picked = pickColumnBox(point.clientX, columns.container, columns.columns);
  if (picked.splitColumns) {
    const splitBounds = intersectRects(columns.container, rect(r));
    return {
      sectionId,
      barColor: '#00E174',
      orientation: 'vertical',
      position: {
        mode: 'section-element',
        blockId: sectionId,
        anchor: { kind: 'end' },
        edge: 'after',
        columnIndex: picked.columnIndex,
        splitColumns: picked.splitColumns,
      },
      region: picked.box,
      sectionBounds: rect(r),
      line: clampRectToBounds(columnBar(picked.box), splitBounds),
    };
  }
  const candidates: Array<{
    placement: LandingPageSectionPlacement;
    node: HTMLElement;
    score: number;
  }> = [];
  const seen = new Set<HTMLElement>();
  const add = (placement: LandingPageSectionPlacement) => {
    const resolved = sectionAnchor(host, placement);
    if (!resolved || seen.has(resolved.node) || !acceptsFlow(resolved.node)) return;
    const n = resolved.node,
      b = n.getBoundingClientRect(),
      parent = n.parentElement!.getBoundingClientRect();
    if (
      b.width < 1 ||
      b.height < 1 ||
      point.clientX < parent.left - 8 ||
      point.clientX > parent.right + 8
    )
      return;
    if (b.left > picked.box.left + picked.box.width + 8 || b.right < picked.box.left - 8) return;
    seen.add(n);
    const edge = point.clientY < b.top + b.height / 2 ? 'before' : 'after';
    const dy = Math.min(Math.abs(point.clientY - b.top), Math.abs(point.clientY - b.bottom));
    const dx =
      point.clientX < b.left
        ? b.left - point.clientX
        : point.clientX > b.right
          ? point.clientX - b.right
          : 0;
    candidates.push({ placement: { ...placement, edge }, node: n, score: dy + dx * 0.35 });
  };
  for (const field of host.querySelectorAll<HTMLElement>(
    '[data-lp-inline-field],[data-lp-field-anchor]',
  )) {
    const owner = field.closest<HTMLElement>('[data-lp-block-id]');
    const blockId = owner?.dataset.lpBlockId;
    const key = field.dataset.lpInlineField || field.dataset.lpFieldAnchor;
    if (!blockId || !key || key === 'submitLabel') continue;
    add({ sectionId, anchor: { kind: 'field', blockId, field: key }, edge: 'after' });
  }
  if (host.querySelector('form[data-lp-form-block] button[type="submit"]'))
    add({ sectionId, anchor: { kind: 'submit', blockId: sectionId }, edge: 'after' });
  candidates.sort((a, b) => a.score - b.score);
  const selected = candidates[0];
  if (selected) {
    const b = selected.node.getBoundingClientRect(),
      p = selected.node.parentElement!.getBoundingClientRect();
    const y = selected.placement.edge === 'before' ? b.top : b.bottom;
    return {
      sectionId,
      barColor,
      position: {
        mode: 'section-element',
        blockId: sectionId,
        anchor: selected.placement.anchor,
        edge: selected.placement.edge,
        columnIndex: picked.columnIndex,
      },
      region: rect(p),
      sectionBounds: rect(r),
      line: slotBar(picked.box.left, picked.box.width, y, selected.placement.edge),
    };
  }
  const placement: LandingPageSectionPlacement = {
    sectionId,
    anchor: { kind: 'end' },
    edge: 'after',
    columnIndex: picked.columnIndex,
  };
  const end = sectionAnchor(host, placement);
  if (!end || end.node.clientHeight < 1) return null;
  const flow = getComputedStyle(end.node);
  if (
    end.node.matches('[data-lp-frame],[data-lp-grid-block]') ||
    flow.display.includes('grid') ||
    (flow.display.includes('flex') && !flow.flexDirection.startsWith('column'))
  )
    return null;
  const b = end.node.getBoundingClientRect();
  return {
    sectionId,
    barColor,
    position: {
      mode: 'section-element',
      blockId: sectionId,
      anchor: placement.anchor,
      edge: 'after',
      columnIndex: picked.columnIndex,
    },
    region: rect(b),
    sectionBounds: rect(r),
    line: slotBar(picked.box.left, picked.box.width, b.bottom, 'before'),
  };
}
