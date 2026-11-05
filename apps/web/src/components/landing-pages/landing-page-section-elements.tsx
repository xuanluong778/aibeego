'use client';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { LandingPageBlock, LandingPageSpec } from '@marketingspa/shared';
import {
  applySplitColumnsToBlocks,
  readContentColumns,
  readNativeColumnIndices,
} from '@marketingspa/shared';
import {
  InlineEditable,
  ItemReorderChrome,
  type LandingPageCanvasHandlers,
} from './landing-page-canvas-ux';
import {
  sectionAnchor,
  sectionHost,
  sectionPlacementFromInsertPos,
} from './landing-page-section-insert-target';
import type { LpSidebarInsertPos } from './landing-page-sidebar-dnd';

/** Keep native block/field IDs so inspector, history and autosave remain shared. */
export function attachNewSectionElement(
  previous: LandingPageSpec,
  next: LandingPageSpec,
  pos: LpSidebarInsertPos,
): LandingPageSpec {
  const placement = sectionPlacementFromInsertPos(pos);
  if (!placement) return next;
  const host = previous.blocks.find((b) => b.id === placement.sectionId && !b.sectionPlacement);
  if (!host || host.locked)
    throw Error('Section đích không còn tồn tại hoặc đang khóa. Chưa chèn element.');
  const oldIds = new Set(previous.blocks.map((b) => b.id));
  const added = next.blocks.filter((b) => !oldIds.has(b.id));
  if (added.length !== 1) throw Error('Loại element này không hỗ trợ vị trí đã thả.');
  const allowed = ['Benefits', 'CTA', 'Gallery', 'LeadForm', 'Video', 'Countdown'];
  if (!allowed.includes(added[0]!.type) && typeof placement.columnIndex !== 'number')
    throw Error('Loại element này không hỗ trợ vị trí đã thả.');
  // Shift only existing occupants. The new element already owns the new column.
  const existing =
    pos.mode === 'section-element' && (pos.splitColumns ?? pos.columnCount ?? 1) >= 2
      ? applySplitColumnsToBlocks(
          previous.blocks,
          pos.blockId,
          (pos.splitColumns ?? pos.columnCount)!,
          pos.columnIndex ?? 0,
          pos.nativeColumnIndices,
        )
      : previous.blocks;
  const shifted = new Map(existing.map((b) => [b.id, b]));
  const attached = next.blocks.map((b) => {
    if (oldIds.has(b.id)) {
      const old = shifted.get(b.id)!;
      return { ...b, style: old.style, sectionPlacement: old.sectionPlacement };
    }
    if (b.id !== added[0]!.id) return b;
    const { freeLayout, responsiveFreeLayout, positionMode, ...rest } = b;
    return { ...rest, sectionPlacement: placement, spacing: 'none' } as LandingPageBlock;
  });
  return { ...next, blocks: attached };
}

function InsertedElement({
  block,
  canvas,
  renderNative,
}: {
  block: LandingPageBlock;
  canvas: LandingPageCanvasHandlers | null;
  renderNative: (b: LandingPageBlock) => ReactNode;
}) {
  const text = (field: string, value: string | undefined, as: 'h2' | 'p' | 'span') => (
    <InlineEditable
      blockId={block.id}
      field={field}
      value={value || ''}
      as={as}
      handlers={canvas}
      blockStyle={block.style as Record<string, unknown>}
      textRole={as === 'h2' ? 'heading' : 'paragraph'}
      multiline
    />
  );
  return (
    <div
      data-lp-section-element="1"
      data-lp-block-id={block.id}
      style={{ maxWidth: '100%', minWidth: 0, margin: '12px 0', position: 'relative' }}
    >
      {block.type === 'Benefits' ? (
        <div>
          {block.headline ? (
            text('headline', block.headline, 'h2')
          ) : (
            <span hidden data-lp-field-anchor="headline" />
          )}
          {block.subheadline ? (
            text('subheadline', block.subheadline, 'p')
          ) : (
            <span hidden data-lp-field-anchor="subheadline" />
          )}
          {block.items.length ? (
            <ul>
              {block.items.map((item, index) => (
                <li key={item.id}>
                  <ItemReorderChrome
                    itemId={item.id}
                    blockId={block.id}
                    index={index}
                    handlers={canvas}
                  >
                    {text(`itemTitle:${item.id}`, item.title, 'span')}
                  </ItemReorderChrome>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        renderNative(block)
      )}
    </div>
  );
}

type ColumnState = { inner: HTMLElement; grid: HTMLElement; groups: ChildNode[][] };
const columnStates = new WeakMap<HTMLElement, ColumnState>();

function ensureSectionColumns(host: HTMLElement, count: number, nativeIndices: number[]) {
  let state = columnStates.get(host);
  if (state && !host.contains(state.inner)) {
    columnStates.delete(host);
    state = undefined;
  }
  if (!state && count < 2) {
    const split = host.querySelector<HTMLElement>(
      '[data-lp-hero-grid],[data-lp-cta-split],[data-lp-form-split]',
    );
    if (split)
      Array.from(split.children).forEach((node, i) => {
        if (node instanceof HTMLElement) {
          node.dataset.lpContentColumn = String(i);
          node.dataset.lpNativeGroup = String(i);
        }
      });
    return;
  }
  if (!state) {
    // Use the actual content container, above the section background and inside its copy.
    const inner =
      host.querySelector<HTMLElement>(
        '[data-lp-container-inner],[data-lp-cta-split],[data-lp-form-split],.blank-container',
      ) ||
      Array.from(host.querySelectorAll<HTMLElement>('section,footer,header')).find(
        (n) => n.closest('[data-lp-section-chrome="1"]') === host,
      );
    if (!inner) return;
    const kids = Array.from(inner.childNodes).filter(
      (n) => !(n instanceof HTMLElement && n.matches('[data-lp-section-element-slot]')),
    );
    const splitHost = inner.matches('[data-lp-hero-grid],[data-lp-cta-split],[data-lp-form-split]');
    const groups =
      splitHost && kids.filter((n) => n instanceof HTMLElement).length >= 2
        ? kids.filter((n) => n instanceof HTMLElement).map((n) => [n])
        : [kids];
    if (splitHost)
      for (const node of kids)
        if (node instanceof HTMLElement) {
          node.removeAttribute('data-lp-content-column');
          node.removeAttribute('data-lp-native-group');
        }
    const grid = document.createElement('div');
    grid.dataset.lpContentColumns = String(count);
    grid.style.gridColumn = '1 / -1';
    inner.appendChild(grid);
    state = { inner, grid, groups };
    columnStates.set(host, state);
  }
  const { inner, grid, groups } = state;
  if (count < 2) {
    // Undo must restore the original React-owned nodes and remove all generated cells.
    for (const group of groups) for (const node of group) inner.insertBefore(node, grid);
    grid.remove();
    columnStates.delete(host);
    ensureSectionColumns(host, count, nativeIndices);
    return;
  }
  grid.dataset.lpContentColumns = String(count);
  grid.style.setProperty('--lp-content-column-count', String(count));
  for (let i = 0; i < count; i++) {
    if (grid.querySelector(`:scope > [data-lp-content-column="${i}"]`)) continue;
    const cell = document.createElement('div');
    cell.dataset.lpContentColumn = String(i);
    grid.appendChild(cell);
  }
  groups.forEach((nodes, i) => {
    const index = Math.max(0, Math.min(count - 1, nativeIndices[i] ?? i));
    const cell = grid.querySelector<HTMLElement>(`:scope > [data-lp-content-column="${index}"]`)!;
    cell.dataset.lpNativeGroup = String(i);
    for (const node of nodes) if (node.parentNode !== cell) cell.appendChild(node);
  });
  for (const cell of Array.from(grid.children)) {
    if (Number((cell as HTMLElement).dataset.lpContentColumn) >= count) cell.remove();
    else if (
      !groups.some(
        (_, i) => (nativeIndices[i] ?? i) === Number((cell as HTMLElement).dataset.lpContentColumn),
      )
    )
      cell.removeAttribute('data-lp-native-group');
  }
}

/** Portals participate in the host's normal flow, including inside a form column. */
export function LandingPageSectionElements({
  spec,
  canvas,
  renderNative,
}: {
  spec: LandingPageSpec;
  canvas: LandingPageCanvasHandlers | null;
  renderNative: (b: LandingPageBlock) => ReactNode;
}) {
  const marker = useRef<HTMLSpanElement>(null);
  const containers = useRef(new Map<string, HTMLDivElement>());
  const [slots, setSlots] = useState<
    Array<{ key: string; node: HTMLDivElement; blocks: LandingPageBlock[] }>
  >([]);
  const entries = spec.blocks.filter((b) => b.enabled && !b.hidden && b.sectionPlacement);
  const signature = JSON.stringify(entries.map((b) => [b.id, b.sectionPlacement]));
  const columnSig = JSON.stringify(
    spec.blocks
      .filter((b) => !b.sectionPlacement)
      .map((b) => [b.id, readContentColumns(b.style), readNativeColumnIndices(b.style)]),
  );
  useLayoutEffect(() => {
    const root = marker.current?.closest<HTMLElement>('[data-lp-canvas-root]');
    if (!root) return;
    let raf = 0;
    const sync = () => {
      for (const hostBlock of spec.blocks) {
        if (hostBlock.sectionPlacement) continue;
        const count = readContentColumns(hostBlock.style);
        const host = sectionHost(root, hostBlock.id);
        if (host) ensureSectionColumns(host, count, readNativeColumnIndices(hostBlock.style));
      }
      const groups = new Map<string, LandingPageBlock[]>();
      for (const b of entries) {
        const key = JSON.stringify(b.sectionPlacement);
        groups.set(key, [...(groups.get(key) || []), b]);
      }
      const next: Array<{ key: string; node: HTMLDivElement; blocks: LandingPageBlock[] }> = [];
      for (const [key, blocks] of groups) {
        const p = blocks[0]!.sectionPlacement!,
          host = sectionHost(root, p.sectionId),
          anchor = host ? sectionAnchor(host, p) : null;
        if (!anchor) continue;
        let node = containers.current.get(key);
        if (!node) {
          node = document.createElement('div');
          node.dataset.lpSectionElementSlot = '1';
          node.style.minWidth = '0';
          node.style.maxWidth = '100%';
          containers.current.set(key, node);
        }
        if (anchor.end) {
          if (node.parentNode !== anchor.node || anchor.node.lastChild !== node)
            anchor.node.appendChild(node);
        } else if (p.edge === 'before') {
          if (node.nextSibling !== anchor.node)
            anchor.node.parentNode?.insertBefore(node, anchor.node);
        } else if (node.previousSibling !== anchor.node)
          anchor.node.parentNode?.insertBefore(node, anchor.node.nextSibling);
        next.push({ key, node, blocks });
      }
      for (const [key, node] of containers.current)
        if (!groups.has(key)) {
          node.remove();
          containers.current.delete(key);
        }
      setSlots((old) =>
        old.length === next.length &&
        old.every(
          (s, i) =>
            s.key === next[i]?.key &&
            s.node === next[i]?.node &&
            s.blocks.map((b) => b.id).join(',') === next[i]?.blocks.map((b) => b.id).join(','),
        )
          ? old
          : next,
      );
    };
    sync();
    const observer = new MutationObserver(() => {
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          sync();
        });
    });
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
    // Text/style updates render through current spec below; only ownership changes relocate slots.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, columnSig, canvas]);
  useLayoutEffect(
    () => () => {
      for (const node of containers.current.values()) node.remove();
      containers.current.clear();
    },
    [],
  );
  return (
    <>
      <style>{`[data-lp-canvas-root]{container-type:inline-size}[data-lp-content-columns]{display:grid;grid-template-columns:repeat(var(--lp-content-column-count),minmax(0,1fr));align-items:stretch;width:100%;gap:1.5rem;position:relative;z-index:1}[data-lp-content-column]{min-width:0;min-height:64px}@container(max-width:767px){[data-lp-content-columns]{grid-template-columns:minmax(0,1fr)}}[data-lp-section-element] [data-lp-inline-wrap]:is([data-lp-inline-wrap="heading"],[data-lp-inline-wrap="paragraph"]):not([data-lp-heading-width-locked="1"]):not([data-lp-heading-width-live]){max-width:100%!important;width:100%!important;box-sizing:border-box}`}</style>
      <span hidden ref={marker} data-lp-section-element-mount />
      {slots.map((slot) =>
        createPortal(
          slot.blocks.map((old) => {
            const block = spec.blocks.find((b) => b.id === old.id);
            return block && block.enabled && !block.hidden ? (
              <InsertedElement
                key={block.id}
                block={block}
                canvas={canvas}
                renderNative={renderNative}
              />
            ) : null;
          }),
          slot.node,
          slot.key,
        ),
      )}
    </>
  );
}
