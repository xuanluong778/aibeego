'use client';
import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { getSidebarDropTarget, subscribeSidebarDrop } from './landing-page-sidebar-dnd';
import { readCanvasPointerScale } from './landing-page-free-drag';

export function LandingPageSidebarDropIndicator() {
  const target = useSyncExternalStore(subscribeSidebarDrop, getSidebarDropTarget, () => null);
  if (!target || typeof document === 'undefined') return null;
  const canvas = document.querySelector('[data-lp-canvas-root]') as HTMLElement | null;
  if (!canvas) return null;
  const bar = target.line;
  const vertical = target.orientation === 'vertical';
  const cr = canvas.getBoundingClientRect();
  const scale = readCanvasPointerScale(canvas);
  const s = scale > 0.05 && Number.isFinite(scale) ? scale : 1;
  const toLocal = (r: { left: number; top: number; width: number; height: number }) => ({
    left: (r.left - cr.left) / s,
    top: (r.top - cr.top) / s,
    width: r.width / s,
    height: r.height / s,
  });
  return createPortal(
    <div
      data-lp-sidebar-drop-indicator="1"
      data-lp-drop-section={target.sectionId}
      data-lp-drop-mode={target.position.mode}
      data-lp-drop-orientation={vertical ? 'vertical' : 'horizontal'}
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, zIndex: 50, pointerEvents: 'none' }}
    >
      {bar ? (
        <div
          data-lp-drop-line
          data-lp-drop-bar={vertical ? 'column' : '20'}
          style={{
            position: 'absolute',
            ...toLocal(bar),
            background: target.barColor || '#ffffff',
            borderRadius: vertical ? 999 : 4,
          }}
        />
      ) : (
        <div
          data-lp-drop-image-target
          style={{
            position: 'absolute',
            ...toLocal(target.region),
            boxSizing: 'border-box',
            border: `2px solid ${target.barColor || '#ffffff'}`,
          }}
        />
      )}
    </div>,
    canvas,
  );
}
