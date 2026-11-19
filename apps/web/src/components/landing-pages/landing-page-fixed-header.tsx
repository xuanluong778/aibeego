'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './landing-page-fixed-header.css';

type HeaderPortal = HTMLDivElement & { __lpHeaderOwner?: HTMLElement };
type ThemeContext = { mount: HTMLElement; root: Record<string, string>; article: Record<string, string>; style: CSSProperties };
const dataAttributes = (node: HTMLElement) => Object.fromEntries(
  Array.from(node.attributes).filter((attr) => attr.name.startsWith('data-lp-')).map((attr) => [attr.name, attr.value]),
);

/** A viewport-fixed header with an in-flow spacer. Portals escape transformed
 * preview canvases and section effects while retaining React's editing context. */
export function LandingPageFixedHeader({ children, blockId, disabled, background }: {
  children: ReactNode; blockId: string; disabled?: boolean; background?: string | null;
}) {
  const placeholder = useRef<HTMLDivElement>(null);
  const portal = useRef<HeaderPortal>(null);
  const owner = useRef<HTMLElement | null>(null);
  const [theme, setTheme] = useState<ThemeContext | null>(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    if (disabled || !placeholder.current) return;
    const root = placeholder.current.closest<HTMLElement>('[data-lp-renderer]');
    const header = portal.current?.querySelector<HTMLElement>('header') || placeholder.current.parentElement?.querySelector<HTMLElement>('header');
    if (!root || !header || (root.dataset.lpFixedHeaderBlock && root.dataset.lpFixedHeaderBlock !== blockId)) return;
    if (root.dataset.lpInteractive === '1' || (root.dataset.lpMode !== 'public' && !root.closest('[data-lp-preview-full-canvas], [data-lp-preview-canvas], [data-lp-template-shot]'))) {
      setTheme(null);
      return;
    }
    const article = placeholder.current.closest<HTMLElement>('[data-lp-canvas-root]');
    const computed = getComputedStyle(placeholder.current.parentElement || header);
    const style: Record<string, string> = { fontFamily: computed.fontFamily, fontSize: computed.fontSize, color: computed.color, lineHeight: computed.lineHeight };
    for (const key of Array.from(computed)) if (key.startsWith('--')) style[key] = computed.getPropertyValue(key);
    setHeight(header.offsetHeight);
    owner.current = root;
    const previousHeight = root.style.getPropertyValue('--lp-fixed-header-height');
    root.dataset.lpFixedHeaderBlock = blockId;
    setTheme({ mount: root.closest<HTMLElement>('[data-lp-fullscreen-preview-surface]') || document.body, root: dataAttributes(root), article: article ? dataAttributes(article) : {}, style: style as CSSProperties });
    return () => {
      if (root.dataset.lpFixedHeaderBlock === blockId) delete root.dataset.lpFixedHeaderBlock;
      if (previousHeight) root.style.setProperty('--lp-fixed-header-height', previousHeight);
      else root.style.removeProperty('--lp-fixed-header-height');
      owner.current = null;
    };
  }, [disabled, blockId, background, children]);

  useLayoutEffect(() => {
    const root = owner.current;
    const surface = portal.current;
    const header = surface?.querySelector<HTMLElement>('header');
    if (!theme || !root || !surface || !header) return;
    surface.__lpHeaderOwner = root;
    let frame = 0;
    let disposed = false;
    let scrollParent: HTMLElement | null = root.parentElement;
    while (scrollParent && scrollParent !== document.body && scrollParent !== document.documentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(scrollParent).overflowY)) break;
      scrollParent = scrollParent.parentElement;
    }
    const inFrame = scrollParent && scrollParent !== document.body && scrollParent !== document.documentElement ? scrollParent : null;
    const banner = root.closest('[data-lp-public-root]')?.querySelector<HTMLElement>('[data-lp-preview-banner]') || null;
    const update = () => {
      frame = 0;
      if (disposed) return;
      const rect = root.getBoundingClientRect();
      for (const name of ['data-lp-viewport', 'data-lp-mode', 'data-lp-category', 'data-lp-design-family']) {
        const value = root.getAttribute(name);
        if (value !== null && surface.getAttribute(name) !== value) surface.setAttribute(name, value);
      }
      const scale = root.offsetWidth ? rect.width / root.offsetWidth : 1;
      const headerHeight = header.offsetHeight;
      surface.style.height = `${headerHeight}px`;
      const frameTop = Math.max(0, inFrame ? inFrame.getBoundingClientRect().top + inFrame.clientTop : 0);
      const bannerOffset = Math.max(0, banner ? banner.getBoundingClientRect().bottom - frameTop : 0);
      const top = Math.max(frameTop + bannerOffset, rect.top);
      surface.style.setProperty('--lp-fixed-header-left', `${rect.left}px`);
      surface.style.setProperty('--lp-fixed-header-top', `${top}px`);
      surface.style.setProperty('--lp-fixed-header-width', `${root.offsetWidth}px`);
      surface.style.setProperty('--lp-fixed-header-scale', String(scale || 1));
      surface.style.visibility = rect.width > 0 && rect.bottom > top ? 'visible' : 'hidden';
      root.style.setProperty('--lp-fixed-header-height', `${headerHeight + bannerOffset / (scale || 1)}px`);
      setHeight((previous) => previous === headerHeight ? previous : headerHeight);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const observer = new ResizeObserver(schedule);
    const attributes = new MutationObserver(schedule);
    attributes.observe(root, { attributes: true, attributeFilter: ['data-lp-viewport', 'data-lp-mode', 'data-lp-category', 'data-lp-design-family'] });
    observer.observe(root);
    observer.observe(header);
    if (inFrame) observer.observe(inFrame);
    if (banner) observer.observe(banner);
    window.addEventListener('scroll', schedule, { capture: true, passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    update();
    return () => {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      attributes.disconnect();
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
    };
  }, [theme]);

  if (disabled) return <>{children}</>;
  return <>
    <div ref={placeholder} data-lp-fixed-header-placeholder="1" aria-hidden="true" style={{ height: theme ? height : 0 }} />
    {theme ? createPortal(
      <div {...theme.root} ref={portal} data-lp-fixed-header-portal="1" style={{ ...theme.style, ['--lp-fixed-header-background' as string]: background || 'var(--lp-surface, #fff)' }}>
        <div {...theme.article} data-lp-canvas-root="1" className="lp-fixed-header-theme">
          <div data-lp-block-id={blockId} data-lp-block-slot="1">
            <div data-lp-section-chrome="1">{children}</div>
          </div>
        </div>
      </div>, theme.mount,
    ) : children}
  </>;
}
