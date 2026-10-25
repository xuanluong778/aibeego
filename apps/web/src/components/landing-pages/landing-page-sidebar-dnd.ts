/**
 * Sidebar → canvas drag payload helpers for Landing Page Builder.
 * Additive MIME alongside LP_BLOCK_MIME / LP_ITEM_MIME (reorder).
 */

import type { DragEvent as ReactDragEvent } from 'react';
import type { LandingPageBlockType } from '@marketingspa/shared';
import type { LandingPageButtonGroupPreset, LandingPageButtonPreset } from './landing-page-button-presets';
import type { LandingPageBoxPreset } from './landing-page-box-presets';
import type {
  LandingPageListPreset,
  LandingPageParagraphPreset,
  LandingPageTitlePreset,
} from './landing-page-title-presets';
import type { LandingPageFormPreset } from './landing-page-form-presets';

export const LP_SIDEBAR_PRESET_MIME = 'application/x-lp-sidebar-preset';

/**
 * Fired after a sidebar preset is inserted (click) or a preset drag ends.
 * Left-rail overlay panels (text / button / graphics) must close so they stop
 * intercepting pointer events over the newly created canvas element.
 */
export const LP_SIDEBAR_CLOSE_OVERLAY_EVENT = 'lp-sidebar-close-overlay';

export function requestCloseSidebarOverlay() {
  if (typeof document === 'undefined') return;
  document.dispatchEvent(new CustomEvent(LP_SIDEBAR_CLOSE_OVERLAY_EVENT));
}

/** True when this click is the ghost click after an HTML5 drag — skip insert. */
export function suppressClickAfterSidebarDrag(
  e: { currentTarget: EventTarget | null; preventDefault?: () => void; stopPropagation?: () => void },
): boolean {
  const el = e.currentTarget as HTMLElement | null;
  if (!el || el.dataset.lpDidDrag !== '1') return false;
  delete el.dataset.lpDidDrag;
  e.preventDefault?.();
  e.stopPropagation?.();
  return true;
}

export type LpSidebarPresetPayload =
  | { kind: 'title'; preset: LandingPageTitlePreset }
  | { kind: 'paragraph'; preset: LandingPageParagraphPreset }
  | { kind: 'list'; preset: LandingPageListPreset }
  | { kind: 'button'; preset: LandingPageButtonPreset }
  | { kind: 'button-group'; preset: LandingPageButtonGroupPreset }
  | { kind: 'box'; preset: LandingPageBoxPreset }
  | { kind: 'form'; preset: LandingPageFormPreset }
  | { kind: 'block-type'; type: LandingPageBlockType }
  | { kind: 'media'; url: string; name: string }
  | { kind: 'section-preset'; presetId: string; types: LandingPageBlockType[] }
  /** Open Section Library modal — insert position resolved on drop / click. */
  | { kind: 'section-library-open' }
  /** Open Button Library modal — insert position resolved on drop / click. */
  | { kind: 'button-library-open' };

export type LpSidebarInsertPos =
  | { mode: 'after-selected'; clientX?: number; clientY?: number }
  | { mode: 'before'; blockId: string; clientX?: number; clientY?: number }
  | { mode: 'after'; blockId: string; clientX?: number; clientY?: number }
  | { mode: 'start'; clientX?: number; clientY?: number }
  | { mode: 'end'; clientX?: number; clientY?: number };

export function isSidebarPresetDrag(types: readonly string[] | DOMStringList): boolean {
  const list = Array.from(types as ArrayLike<string>);
  return list.includes(LP_SIDEBAR_PRESET_MIME);
}

export function parseSidebarPresetPayload(raw: string): LpSidebarPresetPayload | null {
  try {
    const data = JSON.parse(raw) as LpSidebarPresetPayload;
    if (!data || typeof data !== 'object' || !('kind' in data)) return null;
    if (data.kind === 'section-preset') {
      if (!data.presetId || !Array.isArray(data.types) || data.types.length === 0) return null;
    }
    if (data.kind === 'section-library-open' || data.kind === 'button-library-open') return data;
    return data;
  } catch {
    return null;
  }
}

/** Start HTML5 drag from a sidebar preset (keeps click-to-add on the same control). */
export function beginSidebarPresetDrag(
  e: ReactDragEvent,
  payload: LpSidebarPresetPayload,
  previewLabel: string,
  opts?: { subtitle?: string },
) {
  e.stopPropagation();
  const json = JSON.stringify(payload);
  e.dataTransfer.setData(LP_SIDEBAR_PRESET_MIME, json);
  e.dataTransfer.setData('text/plain', previewLabel.slice(0, 80));
  e.dataTransfer.effectAllowed = 'copy';

  if (typeof document === 'undefined') return;

  const isLibraryOpen =
    payload.kind === 'section-library-open' || payload.kind === 'button-library-open';
  if (payload.kind === 'section-library-open') {
    document.body.setAttribute('data-lp-dragging-section-library', '1');
  }
  if (payload.kind === 'button-library-open') {
    document.body.setAttribute('data-lp-dragging-button-library', '1');
  }

  // Mark source so the post-drag synthetic click does not double-insert / double-open.
  const src = e.currentTarget as HTMLElement | null;
  if (src) {
    src.dataset.lpDidDrag = '1';
    const onDragEnd = () => {
      src.removeEventListener('dragend', onDragEnd);
      document.body.removeAttribute('data-lp-dragging-section-library');
      document.body.removeAttribute('data-lp-dragging-button-library');
      // Close left overlays AFTER drop handlers finish.
      // Libraries open on DROP only — never close/open them from dragend.
      if (!isLibraryOpen) {
        window.setTimeout(() => requestCloseSidebarOverlay(), 120);
      }
      // Keep lpDidDrag through the trailing click (often after dragend).
      window.setTimeout(() => {
        if (src.dataset.lpDidDrag === '1') delete src.dataset.lpDidDrag;
      }, 400);
    };
    src.addEventListener('dragend', onDragEnd);
  }

  const ghost = document.createElement('div');
  ghost.setAttribute('data-lp-sidebar-drag-preview', '1');
  if (payload.kind === 'section-preset') {
    ghost.setAttribute('data-lp-section-preset-drag', payload.presetId);
  }
  if (payload.kind === 'section-library-open') {
    ghost.setAttribute('data-lp-section-library-drag', '1');
  }
  if (payload.kind === 'button-library-open') {
    ghost.setAttribute('data-lp-button-library-drag', '1');
  }
  const title = document.createElement('div');
  title.textContent = previewLabel.slice(0, 48) || 'Thêm block';
  title.style.fontWeight = '700';
  ghost.appendChild(title);
  if (opts?.subtitle) {
    const sub = document.createElement('div');
    sub.textContent = opts.subtitle.slice(0, 72);
    Object.assign(sub.style, {
      marginTop: '2px',
      fontSize: '10px',
      fontWeight: '500',
      opacity: '0.85',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    } as CSSStyleDeclaration);
    ghost.appendChild(sub);
  }
  Object.assign(ghost.style, {
    position: 'fixed',
    top: '-1000px',
    left: '-1000px',
    zIndex: '99999',
    pointerEvents: 'none',
    padding: '8px 14px',
    borderRadius: '8px',
    background:
      payload.kind === 'section-preset' ||
      payload.kind === 'section-library-open' ||
      payload.kind === 'button-library-open'
        ? payload.kind === 'button-library-open'
          ? '#ea580c'
          : '#7c3aed'
        : '#0f172a',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '700',
    boxShadow: '0 8px 24px rgba(15,23,42,0.35)',
    maxWidth: '260px',
    overflow: 'hidden',
  } as CSSStyleDeclaration);
  document.body.appendChild(ghost);
  try {
    e.dataTransfer.setDragImage(ghost, 16, 16);
  } catch {
    /* ignore — some browsers reject custom drag images */
  }
  window.setTimeout(() => ghost.remove(), 0);
}
