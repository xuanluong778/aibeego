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
  | { kind: 'section-preset'; presetId: string; types: LandingPageBlockType[] };

export type LpSidebarInsertPos =
  | { mode: 'after-selected' }
  | { mode: 'before'; blockId: string }
  | { mode: 'after'; blockId: string }
  | { mode: 'start' }
  | { mode: 'end' };

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
  const ghost = document.createElement('div');
  ghost.setAttribute('data-lp-sidebar-drag-preview', '1');
  if (payload.kind === 'section-preset') {
    ghost.setAttribute('data-lp-section-preset-drag', payload.presetId);
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
    background: payload.kind === 'section-preset' ? '#7c3aed' : '#0f172a',
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
