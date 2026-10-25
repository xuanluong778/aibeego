'use client';

/**
 * Real section preview for Section Library — reuses LandingPageRenderer.
 * Lazy-mount via IntersectionObserver; scaled CSS viewport (not 100 full trees).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { LandingPageSpec, LandingPageTheme, LandingPageThemeTokens } from '@marketingspa/shared';
import {
  createEmptyLandingPageSpec,
  LANDING_PAGE_THEME_PRESETS,
} from '@marketingspa/shared';
import { LandingPageRenderer } from './landing-page-renderer';
import {
  materializeSectionLibraryTemplate,
  type LpSectionLibraryTemplate,
} from './landing-page-section-library-catalog';
import { cn } from '@/lib/utils';

const PREVIEW_CANVAS_W = 1100;

export function buildSectionLibraryPreviewSpec(
  template: LpSectionLibraryTemplate,
  opts?: {
    themeTokens?: LandingPageThemeTokens | null;
    theme?: LandingPageTheme | null;
  },
): LandingPageSpec {
  const theme = opts?.theme || template.previewTheme || 'MODERN';
  const tokens =
    opts?.themeTokens ||
    template.previewTokens ||
    LANDING_PAGE_THEME_PRESETS[theme] ||
    LANDING_PAGE_THEME_PRESETS.MODERN;

  const block = materializeSectionLibraryTemplate(template, (prefix) => {
    // Stable ids so React does not remount the whole tree on parent re-render.
    return `slprev-${template.id}-${prefix}`;
  });

  const base = createEmptyLandingPageSpec(theme);
  return {
    ...base,
    theme,
    themeTokens: { ...tokens },
    blocks: [block],
    meta: {
      ...(base.meta || {}),
      designFamily: template.designFamily || 'conversion',
      conversionGoal: 'lead',
      sectionLibraryPreview: true,
    },
  };
}

type PreviewProps = {
  template: LpSectionLibraryTemplate;
  /** Scroll root for IntersectionObserver (gallery pane). */
  rootEl?: HTMLElement | null;
  /** Larger scale for the right-hand preview pane. */
  size?: 'card' | 'panel';
  /** When true, mount immediately (selected panel). */
  eager?: boolean;
  className?: string;
  /** Optional: browse with page tokens (default: template preview theme). */
  themeTokens?: LandingPageThemeTokens | null;
  theme?: LandingPageTheme | null;
};

/**
 * Card/panel preview: clipped scaled LandingPageRenderer.
 * Off-screen cards unmount to keep SaaS scroll smooth.
 */
export function LandingPageSectionLibraryPreview({
  template,
  rootEl,
  size = 'card',
  eager = false,
  className,
  themeTokens,
  theme,
}: PreviewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(eager);
  const [measuredH, setMeasuredH] = useState(size === 'panel' ? 720 : 560);

  useEffect(() => {
    if (eager) {
      setActive(true);
      return;
    }
    const node = hostRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setActive(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        setActive(hit);
      },
      {
        root: rootEl ?? null,
        rootMargin: '120px 0px',
        threshold: 0.05,
      },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [eager, rootEl, template.id]);

  const spec = useMemo(
    () => buildSectionLibraryPreviewSpec(template, { themeTokens, theme }),
    [template, themeTokens, theme],
  );

  const scale = size === 'panel' ? 0.32 : 0.22;
  const frameH = size === 'panel' ? 420 : 168;

  useEffect(() => {
    if (!active) return;
    const id = requestAnimationFrame(() => {
      const root = hostRef.current?.querySelector(
        '[data-lp-canvas-root]',
      ) as HTMLElement | null;
      if (!root) return;
      const h = Math.max(420, root.scrollHeight || root.offsetHeight || 560);
      setMeasuredH(h);
    });
    return () => cancelAnimationFrame(id);
  }, [active, template.id, spec]);

  return (
    <div
      ref={hostRef}
      className={cn(
        'relative w-full overflow-hidden rounded-md border border-zinc-200/80 bg-white',
        className,
      )}
      style={{ height: frameH }}
      data-lp-section-library-preview={size}
      data-lp-section-library-preview-id={template.id}
      data-lp-section-library-preview-live={active ? '1' : '0'}
    >
      {!active ? (
        <div
          className="absolute inset-0 animate-pulse bg-gradient-to-br from-zinc-100 via-zinc-50 to-orange-50"
          aria-hidden
        />
      ) : (
        <div
          className="pointer-events-none absolute left-0 top-0 origin-top-left"
          style={{
            width: PREVIEW_CANVAS_W,
            height: measuredH,
            transform: `scale(${scale})`,
          }}
          data-lp-section-library-preview-scale={String(scale)}
        >
          <LandingPageRenderer
            spec={spec}
            viewport="desktop"
            mode="preview"
            interactive={false}
            className="bg-white"
          />
        </div>
      )}
      {/* Soft fade so tall sections read as a card crop, not a broken clip. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white/90 to-transparent"
        aria-hidden
      />
    </div>
  );
}
