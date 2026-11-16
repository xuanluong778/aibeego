'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import type { LandingPageSpec } from '@marketingspa/shared';
import { apiClient } from '@/lib/api-client';

const LandingPageRenderer = dynamic(
  () => import('@/components/landing-pages/landing-page-renderer').then((m) => m.LandingPageRenderer),
  { ssr: false },
);

const CANVAS_W = 1440;
const FRAME_STYLE: CSSProperties = {
  height: 'clamp(340px, 28vw, 420px)',
  minHeight: 340,
  overflow: 'hidden',
};

const specCache = new Map<string, LandingPageSpec>();
const inflight = new Map<string, Promise<LandingPageSpec>>();

export function peekTemplateCardSpec(slug: string) {
  return specCache.get(slug) ?? null;
}

function loadSpec(slug: string): Promise<LandingPageSpec> {
  const cached = specCache.get(slug);
  if (cached) return Promise.resolve(cached);
  const pending = inflight.get(slug);
  if (pending) return pending;
  const req = apiClient<{ definition: LandingPageSpec }>(
    `/landing-pages/templates/${encodeURIComponent(slug)}`,
  )
    .then((row) => {
      specCache.set(slug, row.definition);
      inflight.delete(slug);
      return row.definition;
    })
    .catch((err) => {
      inflight.delete(slug);
      throw err;
    });
  inflight.set(slug, req);
  return req;
}

type Props = {
  slug: string;
  name: string;
  category?: string;
  enableHoverScroll?: boolean;
};

/**
 * Catalog card shows the live template HTML (same spec as "Xem trước"),
 * not a stale static screenshot. Hover pans top → bottom inside a tall frame.
 */
export function TemplateLiveCardPreview({
  slug,
  name,
  category,
  enableHoverScroll = true,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const moverRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const activeHover = useRef(false);
  const generation = useRef(0);
  const [visible, setVisible] = useState(false);
  const [spec, setSpec] = useState<LandingPageSpec | null>(() => specCache.get(slug) ?? null);
  const [failed, setFailed] = useState(false);
  const [scale, setScale] = useState(0.22);
  const [measuredH, setMeasuredH] = useState(1600);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const node = frameRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        setVisible(entries.some((e) => e.isIntersecting));
      },
      { rootMargin: '160px 0px', threshold: 0.01 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    setSpec(specCache.get(slug) ?? null);
    setFailed(false);
    setReady(false);
  }, [slug]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void loadSpec(slug)
      .then((row) => {
        if (!cancelled) setSpec(row);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, slug]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const apply = () => {
      const w = frame.clientWidth || CANVAS_W;
      setScale(Math.max(0.12, Math.min(1, w / CANVAS_W)));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(frame);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !spec) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const measure = () => {
      const root = canvas.querySelector('[data-lp-canvas-root]') as HTMLElement | null;
      const h = Math.max(
        900,
        root?.scrollHeight || root?.offsetHeight || canvas.scrollHeight || 1600,
      );
      setMeasuredH(h);
      setReady(true);
    };

    const id = requestAnimationFrame(() => requestAnimationFrame(measure));
    const ro = new ResizeObserver(measure);
    ro.observe(canvas);
    const imgs = canvas.querySelectorAll('img');
    imgs.forEach((img) => img.addEventListener('load', measure));
    const t = window.setTimeout(measure, 700);
    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
      imgs.forEach((img) => img.removeEventListener('load', measure));
      window.clearTimeout(t);
    };
  }, [visible, spec, slug]);

  const reset = useCallback(() => {
    activeHover.current = false;
    generation.current += 1;
    animationRef.current?.cancel();
    animationRef.current = null;
    if (moverRef.current) moverRef.current.style.transform = 'translate3d(0,0,0)';
    if (frameRef.current) frameRef.current.dataset.previewState = 'idle';
  }, []);

  useEffect(() => () => reset(), [reset, slug]);

  const play = useCallback(() => {
    const frame = frameRef.current;
    const mover = moverRef.current;
    if (!activeHover.current || !frame || !mover || animationRef.current) return;
    const visualH = measuredH * scale;
    const distance = Math.max(0, Math.round(visualH - frame.clientHeight));
    if (!distance) {
      frame.dataset.previewState = 'complete';
      return;
    }
    const down = Math.min(22000, Math.max(4500, (distance / 120) * 1000));
    const back = Math.min(3000, Math.max(900, (distance / 800) * 1000));
    const hold = 650;
    const duration = down + hold + back;
    frame.dataset.previewState = 'playing';
    frame.dataset.previewDistance = String(distance);
    const animation = mover.animate(
      [
        { transform: 'translate3d(0,0,0)', offset: 0 },
        { transform: `translate3d(0,-${distance}px,0)`, offset: down / duration },
        { transform: `translate3d(0,-${distance}px,0)`, offset: (down + hold) / duration },
        { transform: 'translate3d(0,0,0)', offset: 1 },
      ],
      { duration, iterations: 1, fill: 'forwards', easing: 'linear' },
    );
    animationRef.current = animation;
    animation.onfinish = () => {
      if (activeHover.current && frameRef.current) frameRef.current.dataset.previewState = 'complete';
    };
  }, [measuredH, scale]);

  function enter() {
    if (!enableHoverScroll || activeHover.current || !ready) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    activeHover.current = true;
    generation.current += 1;
    if (frameRef.current) frameRef.current.dataset.previewState = 'loading';
    requestAnimationFrame(play);
  }

  return (
    <div
      ref={frameRef}
      data-lp-card-preview
      data-lp-live-card="1"
      data-preview-state="idle"
      tabIndex={enableHoverScroll ? 0 : undefined}
      aria-label={`Hình xem trước ${name}`}
      className="relative overflow-hidden bg-neutral-200/80 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={FRAME_STYLE}
      onMouseEnter={enter}
      onMouseLeave={reset}
      onFocus={enter}
      onBlur={reset}
    >
      {!ready ? (
        <div
          className="absolute inset-0 animate-pulse bg-gradient-to-br from-neutral-200 via-neutral-100 to-neutral-300"
          aria-hidden
        />
      ) : null}
      {visible && spec && !failed ? (
        <div
          ref={moverRef}
          className="absolute left-0 top-0 w-full"
          style={{ transform: 'translate3d(0,0,0)', willChange: 'transform' }}
          aria-hidden="true"
          inert
        >
          <div
            ref={canvasRef}
            className="pointer-events-none origin-top-left"
            style={{
              width: CANVAS_W,
              height: measuredH,
              transform: `scale(${scale})`,
            }}
            data-lp-live-card-scale={String(scale)}
          >
            <LandingPageRenderer
              spec={spec}
              categoryHint={category}
              viewport="desktop"
              mode="preview"
              interactive={false}
              className="w-full bg-white"
            />
          </div>
        </div>
      ) : null}
      {failed ? (
        <div className="absolute inset-0 flex items-end bg-gradient-to-br from-emerald-900 via-slate-900 to-amber-900 p-3">
          <p className="line-clamp-2 text-sm font-semibold text-white">{name}</p>
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/35 to-transparent opacity-80" aria-hidden />
      <div className="absolute inset-0 z-[1]" data-lp-live-card-inert="1" aria-hidden />
    </div>
  );
}
