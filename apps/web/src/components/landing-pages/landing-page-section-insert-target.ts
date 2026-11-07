import type { LandingPageSectionPlacement } from '@marketingspa/shared';
import { LP_CONTENT_COLUMNS_MAX } from '@marketingspa/shared';
import type { LpSidebarInsertPos, LpSidebarPresetPayload } from './landing-page-sidebar-dnd';

export type DropRect = { left: number; top: number; width: number; height: number };
export type SidebarDropTarget = {
  position: LpSidebarInsertPos;
  region: DropRect;
  line?: DropRect;
  sectionId?: string;
  barColor?: '#000000' | '#ffffff';
  /** Horizontal = flow slot; vertical = new/existing column. */
  orientation?: 'horizontal' | 'vertical';
  /** Canvas-space bounds in viewport pixels; keeps visual drop feedback inside its section. */
  sectionBounds?: DropRect;
  frame?: { blockId: string; gridIndex?: number };
};
const rect = (r: DropRect): DropRect => ({
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
  if (a.kind === 'field' && a.field.startsWith('__')) {
    const itemId = a.field.split(':')[1];
    let box = itemId
      ? host.querySelector<HTMLElement>(`[data-lp-item-id="${esc(itemId)}"]`)
      : host.querySelector<HTMLElement>(
          `[data-lp-section-element][data-lp-block-id="${esc(a.blockId)}"]`,
        );
    if (!box && a.field.startsWith('__row:')) box = nativeItemBoxes(host)[0] || null;
    if (!box) {
      const cell =
        typeof placement.columnIndex === 'number'
          ? host.querySelector<HTMLElement>(`[data-lp-content-column="${placement.columnIndex}"]`)
          : null;
      return cell ? { node: cell, end: true } : null;
    }
    if (a.field.startsWith('__row:')) return { node: nativeItemRow(box)! };
    return { node: box };
  }
  let targetCell: HTMLElement | null = null;
  if (typeof placement.columnIndex === 'number') {
    const cell = host.querySelector<HTMLElement>(
      `[data-lp-content-column="${esc(String(placement.columnIndex))}"]`,
    );
    targetCell = cell;
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
  if (!owner) return targetCell ? { node: targetCell, end: true } : null;
  if (a.kind === 'submit') {
    const node = owner.querySelector<HTMLElement>('form[data-lp-form-block] button[type="submit"]');
    return node ? { node } : null;
  }
  const field = owner.querySelector<HTMLElement>(
    `[data-lp-inline-field="${esc(a.field)}"],[data-lp-field-anchor="${esc(a.field)}"]`,
  );
  if (!field) return targetCell ? { node: targetCell, end: true } : null;
  const outerBox = field.closest<HTMLElement>('[data-lp-item-id],[data-lp-section-element]');
  if (outerBox && (owner === outerBox || owner.contains(outerBox))) return { node: outerBox };
  const node =
    field.closest<HTMLElement>('[data-lp-element-kind="button"]') ||
    field.closest<HTMLElement>('button,a,label') ||
    field.closest<HTMLElement>('[data-lp-inline-wrap]') ||
    field;
  return owner.contains(node) ? { node } : null;
}

/** Drop bar is always white so the insert line never flips to black on light sections. */
export function sectionDropBarColor(_host?: HTMLElement): '#ffffff' {
  return '#ffffff';
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

/** Find a free lane beside the selection; never clamp a toolbar into content. */
export function placeVerticalToolbar(input: {
  anchor: DropRect;
  canvas: DropRect;
  toolbarW: number;
  toolbarH: number;
  gap?: number;
  pad?: number;
  viewTop?: number;
  viewBottom?: number;
  obstacles?: DropRect[];
}): { left: number; top: number; side: 'left' | 'right' | 'top' | 'bottom' } | null {
  const { anchor, canvas, toolbarW: w, toolbarH: h } = input;
  const gap = input.gap ?? 6,
    pad = input.pad ?? 8;
  const left = canvas.left + pad,
    right = canvas.left + canvas.width - pad;
  const top = Math.max(canvas.top + pad, input.viewTop ?? canvas.top + pad);
  const bottom = Math.min(
    canvas.top + canvas.height - pad,
    input.viewBottom ?? canvas.top + canvas.height - pad,
  );
  if (right - left < w || bottom - top < h) return null;
  const obstacles = [anchor, ...(input.obstacles || [])];
  const fits = (x: number, y: number) =>
    x >= left &&
    x + w <= right &&
    y >= top &&
    y + h <= bottom &&
    !obstacles.some((o) => rectsOverlap({ left: x, top: y, width: w, height: h }, o, 2));
  const midY = Math.max(top, Math.min(bottom - h, anchor.top + (anchor.height - h) / 2));
  const midX = Math.max(left, Math.min(right - w, anchor.left + (anchor.width - w) / 2));
  const candidates: Array<{
    left: number;
    top: number;
    side: 'left' | 'right' | 'top' | 'bottom';
  }> = [
    { left: anchor.left + anchor.width + gap, top: midY, side: 'right' },
    { left: anchor.left - gap - w, top: midY, side: 'left' },
    { left: midX, top: anchor.top + anchor.height + gap, side: 'bottom' },
    { left: midX, top: anchor.top - gap - h, side: 'top' },
  ];
  for (const c of candidates) if (fits(c.left, c.top)) return c;
  const nearby = [...obstacles]
    .sort(
      (a, b) =>
        Math.hypot(a.left - anchor.left, a.top - anchor.top) -
        Math.hypot(b.left - anchor.left, b.top - anchor.top),
    )
    .slice(0, 12);
  const xs = [
    left,
    right - w,
    ...nearby.flatMap((o) => [o.left - gap - w, o.left + o.width + gap]),
  ];
  const ys = [top, bottom - h, ...nearby.flatMap((o) => [o.top - gap - h, o.top + o.height + gap])];
  const free = xs
    .flatMap((x) =>
      ys.map((y) => ({
        left: x,
        top: y,
        side: (x >= anchor.left + anchor.width
          ? 'right'
          : x + w <= anchor.left
            ? 'left'
            : y >= anchor.top + anchor.height
              ? 'bottom'
              : 'top') as 'left' | 'right' | 'top' | 'bottom',
      })),
    )
    .filter((c) => fits(c.left, c.top));
  free.sort(
    (a, b) => Math.hypot(a.left - midX, a.top - midY) - Math.hypot(b.left - midX, b.top - midY),
  );
  return free[0] || null;
}

export function rectsOverlap(a: DropRect, b: DropRect, pad = 0): boolean {
  return (
    a.left < b.left + b.width + pad &&
    a.left + a.width > b.left - pad &&
    a.top < b.top + b.height + pad &&
    a.top + a.height > b.top - pad
  );
}

/** Painted boxes and editable elements, excluding editor overlays and page backgrounds. */
export function readDropObstacles(root: HTMLElement): DropRect[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      '[data-lp-item-id],[data-lp-item-id] > *,[data-lp-section-element],[data-lp-free-child],[data-lp-box-block]',
    ),
  )
    .filter((n) => !n.closest('[data-lp-transform-chrome],[data-lp-sidebar-drop-indicator]'))
    .map((n) => rect(n.getBoundingClientRect()))
    .filter((r) => r.width > 1 && r.height > 1);
}

/** Reserve the indicator only in an empty lane; the same target drives the drop. */
export function fitDropLine(
  line: DropRect,
  bounds: DropRect,
  obstacles: DropRect[],
  vertical: boolean,
): DropRect | null {
  for (const thickness of [vertical ? line.width : line.height, 8, 4]) {
    const w = vertical ? thickness : Math.min(line.width, bounds.width),
      h = vertical ? Math.min(line.height, bounds.height) : thickness;
    const x = Math.max(bounds.left, Math.min(bounds.left + bounds.width - w, line.left));
    const y = Math.max(bounds.top, Math.min(bounds.top + bounds.height - h, line.top));
    const coords = vertical
      ? [x, ...obstacles.flatMap((o) => [o.left - w - 2, o.left + o.width + 2])]
      : [y, ...obstacles.flatMap((o) => [o.top - h - 2, o.top + o.height + 2])];
    coords.sort((a, b) => Math.abs(a - (vertical ? x : y)) - Math.abs(b - (vertical ? x : y)));
    for (const c of coords) {
      if (Math.abs(c - (vertical ? x : y)) > 40) continue;
      const r = { left: vertical ? c : x, top: vertical ? y : c, width: w, height: h };
      if (
        r.left >= bounds.left &&
        r.top >= bounds.top &&
        r.left + w <= bounds.left + bounds.width + 0.5 &&
        r.top + h <= bounds.top + bounds.height + 0.5 &&
        !obstacles.some((o) => rectsOverlap(r, o, 1))
      )
        return r;
    }
  }
  return null;
}

export function nativeItemBoxes(host: HTMLElement): HTMLElement[] {
  return Array.from(host.querySelectorAll<HTMLElement>('[data-lp-item-id]')).filter(
    (n) =>
      n.dataset.lpItemParent === host.dataset.lpBlockId && !n.closest('[data-lp-section-element]'),
  );
}

export function nativeItemRow(node: HTMLElement): HTMLElement | null {
  return (
    node.closest<HTMLElement>('[data-lp-native-flow-grid]') ||
    node.closest<HTMLElement>('[data-lp-native-item-cell]')?.parentElement ||
    node.parentElement
  );
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
  pointerY?: number,
): { box: DropRect; columnIndex: number; splitColumns?: number } {
  // Model order also matters when mobile stacks all columns at the same X.
  const sorted = [...columns];
  if (
    pointerY !== undefined &&
    columns.length > 1 &&
    Math.abs(columns[0]!.left - columns[1]!.left) < 2
  ) {
    const i = columns.reduce(
      (best, c, index) =>
        Math.abs(pointerY - (c.top + c.height / 2)) <
        Math.abs(pointerY - (columns[best]!.top + columns[best]!.height / 2))
          ? index
          : best,
      0,
    );
    return { box: columns[i]!, columnIndex: i };
  }
  const n = sorted.length;
  if (!n) return { box: container, columnIndex: 0 };
  const colRight = (c: DropRect) => c.left + c.width;
  const containerRight = container.left + container.width;
  const last = sorted[n - 1]!;
  const first = sorted[0]!;
  const canSplit = n < LP_CONTENT_COLUMNS_MAX;
  const edge = (c: DropRect) => (n === 1 ? columnEdgePx(c.width) : Math.min(24, c.width * 0.1));
  const newWidth = Math.max(48, container.width / (n + 1));

  if (
    canSplit &&
    pointerX >= colRight(last) - edge(last) &&
    pointerX <= containerRight + edge(last)
  ) {
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
  if (
    canSplit &&
    pointerX >= container.left - edge(first) &&
    pointerX <= first.left + edge(first)
  ) {
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
      if (pointerX >= aRight - edge(a) && pointerX <= b.left + edge(b)) {
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
    const cells = Array.from(
      grid.querySelectorAll<HTMLElement>(':scope > [data-lp-content-column]'),
    );
    if (cells.length) {
      return {
        container: hostBox,
        columns: cells
          .sort(
            (a, b) =>
              Number(a.dataset.lpContentColumn || 0) - Number(b.dataset.lpContentColumn || 0),
          )
          .map((c) => rect(c.getBoundingClientRect())),
      };
    }
  }
  const split = host.querySelector<HTMLElement>(
    '[data-lp-hero-grid],[data-lp-cta-split],[data-lp-form-split]',
  );
  if (split) {
    const kids = Array.from(split.children).filter(
      (n): n is HTMLElement => n instanceof HTMLElement,
    );
    if (kids.length >= 2) {
      return {
        container: hostBox,
        columns: kids.map((c, i) => {
          const actual = c.getBoundingClientRect();
          if (actual.width >= 1 && actual.height >= 1) return rect(actual);
          // A hidden image must not remove its native column's drop area.
          const box = split.getBoundingClientRect();
          const gap = Number.parseFloat(getComputedStyle(split).columnGap) || 0;
          const width = (box.width - gap * (kids.length - 1)) / kids.length;
          return {
            left: box.left + i * (width + gap),
            top: box.top,
            width,
            height: Math.max(64, box.height),
          };
        }),
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
  const target = resolveSidebarDropTargetRaw(root, host, payload, point);
  if (!target?.line) return target;
  const bounds = target.sectionBounds || rect(root.getBoundingClientRect());
  const line = fitDropLine(
    target.line,
    bounds,
    readDropObstacles(root),
    target.orientation === 'vertical',
  );
  return line ? { ...target, line } : null;
}

function nativeBoxDrop(
  host: HTMLElement,
  point: { clientX: number; clientY: number; target?: EventTarget | null },
): SidebarDropTarget | null {
  const nodes = nativeItemBoxes(host);
  if (!nodes.length) return null;
  const boxes = nodes.map((n) => rect(n.getBoundingClientRect()));
  const row = nativeItemRow(nodes[0]!)!;
  const rowStyle = getComputedStyle(row);
  if (
    !row.matches('[data-lp-native-flow-grid]') &&
    !rowStyle.display.includes('grid') &&
    !(rowStyle.display.includes('flex') && !rowStyle.flexDirection.startsWith('column'))
  )
    return null;
  const rowBox = rect(row.getBoundingClientRect()),
    section = rect(host.getBoundingClientRect());
  const sectionId = host.dataset.lpBlockId!;
  const indices = nodes.map((n, i) =>
    Number(n.closest<HTMLElement>('[data-lp-content-column]')?.dataset.lpContentColumn ?? i),
  );
  const count = row.hasAttribute('data-lp-content-columns')
    ? Math.max(Number(row.dataset.lpContentColumns) || 1, ...indices.map((i) => i + 1))
    : nodes.length;
  const nativeItemIds = nodes.map((n) => n.dataset.lpItemId!);
  const allTop = Math.min(rowBox.top, ...boxes.map((b) => b.top)),
    allBottom = Math.max(rowBox.top + rowBox.height, ...boxes.map((b) => b.top + b.height));
  const nearest = boxes
    .map((b, i) => ({
      i,
      d:
        Math.max(b.left - point.clientX, 0, point.clientX - b.left - b.width) ** 2 +
        Math.max(b.top - point.clientY, 0, point.clientY - b.top - b.height) ** 2,
    }))
    .sort((a, b) => a.d - b.d)[0]!.i;
  const box = boxes[nearest]!,
    id = nodes[nearest]!.dataset.lpItemId!;
  const hit =
    point.target instanceof Element
      ? point.target
      : document.elementFromPoint(point.clientX, point.clientY);
  const attached = hit?.closest<HTMLElement>('[data-lp-section-element]'),
    cell = attached?.closest<HTMLElement>('[data-lp-content-column]');
  if (attached && !cell && host.contains(attached)) {
    const b = rect(attached.getBoundingClientRect()),
      before = point.clientY < b.top + b.height / 2;
    return {
      sectionId,
      sectionBounds: section,
      barColor: '#ffffff',
      position: {
        mode: 'section-element',
        blockId: sectionId,
        anchor: { kind: 'field', blockId: attached.dataset.lpBlockId!, field: '__whole' },
        edge: before ? 'before' : 'after',
      },
      region: b,
      line: slotBar(
        b.left,
        b.width,
        before ? b.top : b.top + b.height,
        before ? 'before' : 'after',
      ),
    };
  }
  if (attached && cell && host.contains(attached)) {
    const b = rect(attached.getBoundingClientRect()),
      i = Number(cell.dataset.lpContentColumn);
    const side =
      point.clientX < b.left + Math.min(24, b.width * 0.15)
        ? 'left'
        : point.clientX > b.left + b.width - Math.min(24, b.width * 0.15)
          ? 'right'
          : null;
    if (side && count < LP_CONTENT_COLUMNS_MAX)
      return {
        sectionId,
        sectionBounds: section,
        barColor: '#ffffff',
        orientation: 'vertical',
        position: {
          mode: 'section-element',
          blockId: sectionId,
          anchor: { kind: 'end' },
          edge: 'after',
          columnIndex: i + (side === 'right' ? 1 : 0),
          splitColumns: count + 1,
          nativeColumnIndices: indices,
          nativeItemIds,
        },
        region: rowBox,
        line: {
          left: side === 'right' ? b.left + b.width + 2 : b.left - 22,
          top: rowBox.top,
          width: 20,
          height: rowBox.height,
        },
      };
    const before = point.clientY < b.top + b.height / 2;
    return {
      sectionId,
      sectionBounds: section,
      barColor: '#ffffff',
      position: {
        mode: 'section-element',
        blockId: sectionId,
        anchor: { kind: 'field', blockId: attached.dataset.lpBlockId!, field: '__whole' },
        edge: before ? 'before' : 'after',
        columnIndex: i,
        columnCount: count,
        nativeColumnIndices: indices,
        nativeItemIds,
      },
      region: b,
      line: slotBar(
        b.left,
        b.width,
        before ? b.top : b.top + b.height,
        before ? 'before' : 'after',
      ),
    };
  }
  if (point.clientY < allTop - 3 || point.clientY > allBottom + 3) {
    const before = point.clientY < allTop;
    return {
      sectionId,
      sectionBounds: section,
      barColor: '#ffffff',
      position: {
        mode: 'section-element',
        blockId: sectionId,
        anchor: { kind: 'field', blockId: sectionId, field: `__row:${id}` },
        edge: before ? 'before' : 'after',
      },
      region: rowBox,
      line: slotBar(
        rowBox.left,
        rowBox.width,
        before ? allTop : allBottom,
        before ? 'before' : 'after',
      ),
    };
  }
  const edge = Math.min(28, box.width * 0.18),
    left = point.clientX < box.left + edge,
    right = point.clientX > box.left + box.width - edge;
  if ((left || right) && count < LP_CONTENT_COLUMNS_MAX) {
    const at = indices[nearest]! + (right ? 1 : 0);
    return {
      sectionId,
      sectionBounds: section,
      barColor: '#ffffff',
      orientation: 'vertical',
      position: {
        mode: 'section-element',
        blockId: sectionId,
        anchor: { kind: 'end' },
        edge: 'after',
        columnIndex: at,
        splitColumns: count + 1,
        nativeColumnIndices: indices,
        nativeItemIds,
      },
      region: rowBox,
      line: {
        left: right ? box.left + box.width + 2 : box.left - LP_COLUMN_BAR_WIDTH - 2,
        top: allTop,
        width: LP_COLUMN_BAR_WIDTH,
        height: allBottom - allTop,
      },
    };
  }
  const before = point.clientY < box.top + box.height / 2;
  return {
    sectionId,
    sectionBounds: section,
    barColor: '#ffffff',
    position: {
      mode: 'section-element',
      blockId: sectionId,
      anchor: { kind: 'field', blockId: sectionId, field: `__box:${id}` },
      edge: before ? 'before' : 'after',
      columnIndex: indices[nearest],
      columnCount: count,
      nativeColumnIndices: indices,
      nativeItemIds,
    },
    region: box,
    line: slotBar(
      box.left,
      box.width,
      before ? box.top : box.top + box.height,
      before ? 'before' : 'after',
    ),
  };
}

function resolveSidebarDropTargetRaw(
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
  if (host.dataset.lpBlockType === 'Header' || host.closest('[data-lp-html-document]')) return null;
  const native = nativeBoxDrop(host, point);
  if (native) return native;
  const columns = readColumnRects(host);
  const picked = pickColumnBox(point.clientX, columns.container, columns.columns, point.clientY);
  const grid = host.querySelector('[data-lp-content-columns]');
  const nativeColumnIndices = grid
    ? Array.from(grid.querySelectorAll<HTMLElement>('[data-lp-native-group]'))
        .sort((a, b) => Number(a.dataset.lpNativeGroup) - Number(b.dataset.lpNativeGroup))
        .map((n) => Number(n.dataset.lpContentColumn))
    : columns.columns.map((_, i) => i);
  const existingColumns =
    columns.columns.length > 1 ? { columnCount: columns.columns.length, nativeColumnIndices } : {};

  if (picked.splitColumns) {
    const splitBounds = intersectRects(columns.container, rect(r));
    return {
      sectionId,
      barColor,
      orientation: 'vertical',
      position: {
        mode: 'section-element',
        blockId: sectionId,
        anchor: { kind: 'end' },
        edge: 'after',
        columnIndex: picked.columnIndex,
        splitColumns: picked.splitColumns,
        nativeColumnIndices,
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
    const n = resolved.node;
    const cell = n.closest<HTMLElement>('[data-lp-content-column]');
    if (cell && Number(cell.dataset.lpContentColumn) !== picked.columnIndex) return;
    const b = n.getBoundingClientRect(),
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
    add({
      sectionId,
      anchor: {
        kind: 'field',
        blockId,
        field: owner?.hasAttribute('data-lp-section-element') ? '__whole' : key,
      },
      edge: 'after',
    });
  }
  for (const item of host.querySelectorAll<HTMLElement>('[data-lp-section-element]')) {
    const id = item.dataset.lpBlockId;
    if (id)
      add({ sectionId, anchor: { kind: 'field', blockId: id, field: '__whole' }, edge: 'after' });
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
        ...existingColumns,
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
  if (!end) return null;
  const isColumn = end.node.matches('[data-lp-content-column]');
  if (!isColumn && end.node.clientHeight < 1) return null;
  const flow = getComputedStyle(end.node);
  if (
    end.node.matches('[data-lp-frame],[data-lp-grid-block]') ||
    (!isColumn &&
      (flow.display.includes('grid') ||
        (flow.display.includes('flex') && !flow.flexDirection.startsWith('column'))))
  )
    return null;
  const measured = end.node.getBoundingClientRect();
  const b =
    isColumn && (measured.width < 1 || measured.height < 1)
      ? { ...picked.box, bottom: picked.box.top + picked.box.height }
      : measured;
  return {
    sectionId,
    barColor,
    position: {
      mode: 'section-element',
      blockId: sectionId,
      ...existingColumns,
      anchor: placement.anchor,
      edge: 'after',
      columnIndex: picked.columnIndex,
    },
    region: rect(b),
    sectionBounds: rect(r),
    line: slotBar(
      picked.box.left,
      picked.box.width,
      isColumn ? b.top : b.bottom,
      isColumn ? 'after' : 'before',
    ),
  };
}
