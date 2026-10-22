'use client';

import type { LandingPageBlock } from '@marketingspa/shared';
import type { LandingPageCanvasElementKey } from './landing-page-canvas-ux';

export type InspectorContextKind =
  | 'section'
  | 'text'
  | 'image'
  | 'button'
  | 'form'
  | 'video'
  | 'countdown'
  | 'none';

export type InspectorContext = {
  kind: InspectorContextKind;
  label: string;
  /** data attribute for gates / QA */
  dataAttr: string;
};

/**
 * Context-aware inspector focus from canvas selection.
 * Additive — does not change selection model.
 */
export function resolveInspectorContext(
  selected: LandingPageBlock | null | undefined,
  selectedElement?: LandingPageCanvasElementKey | null,
): InspectorContext {
  if (!selected) {
    return { kind: 'none', label: 'Chưa chọn', dataAttr: 'none' };
  }

  const el = selectedElement || 'section';

  if (selected.type === 'LeadForm') {
    return { kind: 'form', label: 'Form', dataAttr: 'form' };
  }

  if (el === 'image' || (typeof el === 'string' && el.startsWith('grid:'))) {
    return { kind: 'image', label: 'Image', dataAttr: 'image' };
  }

  if (el === 'cta') {
    return { kind: 'button', label: 'Button', dataAttr: 'button' };
  }

  if (
    el === 'headline' ||
    el === 'subheadline' ||
    el === 'body' ||
    (typeof el === 'string' && el.startsWith('item:'))
  ) {
    return { kind: 'text', label: 'Text', dataAttr: 'text' };
  }

  if (typeof el === 'string' && el.startsWith('countdown:')) {
    return { kind: 'countdown', label: 'Countdown cell', dataAttr: 'countdown' };
  }

  if (selected.type === 'Video') {
    return { kind: 'video', label: 'Video', dataAttr: 'video' };
  }

  if (selected.type === 'Countdown' && (el === 'section' || el === 'section-background')) {
    return { kind: 'countdown', label: 'Countdown', dataAttr: 'countdown' };
  }

  return { kind: 'section', label: `Section · ${selected.type}`, dataAttr: 'section' };
}
