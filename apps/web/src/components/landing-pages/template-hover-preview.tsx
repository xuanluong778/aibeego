'use client';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

type Props = {
  thumbnail: string;
  previewLongImage: string;
  alt: string;
  className?: string;
  enableHoverScroll?: boolean;
  fitContainer?: boolean;
  hideBottomFade?: boolean;
};

const FRAME_STYLE: CSSProperties = {
  height: 'clamp(340px, 28vw, 420px)',
  minHeight: 340,
  overflow: 'hidden',
};

/** Tall catalog screenshot in a fixed frame; hover plays one top → bottom → top pan. */
export function TemplateHoverPreview({
  thumbnail,
  previewLongImage,
  alt,
  className = '',
  enableHoverScroll = true,
  fitContainer = false,
  hideBottomFade = false,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const active = useRef(false);
  const generation = useRef(0);
  const restSrc = previewLongImage || thumbnail;
  const [src, setSrc] = useState(restSrc);
  const [loaded, setLoaded] = useState(false);

  const reset = useCallback(() => {
    active.current = false;
    generation.current += 1;
    animationRef.current?.cancel();
    animationRef.current = null;
    if (imgRef.current) imgRef.current.style.transform = 'translate3d(0,0,0)';
    if (frameRef.current) frameRef.current.dataset.previewState = 'idle';
    setSrc(restSrc);
  }, [restSrc]);

  useEffect(() => {
    reset();
    setLoaded(false);
    return () => {
      active.current = false;
      generation.current += 1;
      animationRef.current?.cancel();
    };
  }, [reset, previewLongImage]);

  const play = useCallback(() => {
    const frame = frameRef.current;
    const img = imgRef.current;
    if (!active.current || !frame || !img || animationRef.current) return;
    const renderedHeight =
      img.naturalWidth > 0
        ? img.naturalHeight * (frame.clientWidth / img.naturalWidth)
        : img.offsetHeight;
    const distance = Math.max(0, Math.round(renderedHeight - frame.clientHeight));
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
    const animation = img.animate(
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
      if (active.current && frameRef.current) frameRef.current.dataset.previewState = 'complete';
    };
  }, []);

  function enter() {
    if (!enableHoverScroll || active.current) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    active.current = true;
    const request = ++generation.current;
    if (frameRef.current) frameRef.current.dataset.previewState = 'loading';
    const pre = new Image();
    pre.onload = () => {
      if (!active.current || generation.current !== request) return;
      if (src === previewLongImage) requestAnimationFrame(play);
      else setSrc(previewLongImage);
    };
    pre.onerror = () => {
      if (generation.current === request) reset();
    };
    pre.src = previewLongImage;
  }

  return (
    <div
      ref={frameRef}
      data-lp-card-preview
      data-preview-state="idle"
      tabIndex={enableHoverScroll ? 0 : undefined}
      aria-label={`Hình xem trước ${alt}`}
      className={`relative overflow-hidden bg-neutral-200/80 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${fitContainer ? 'h-full w-full' : ''} ${className}`}
      style={fitContainer ? { overflow: 'hidden' } : FRAME_STYLE}
      onMouseEnter={enter}
      onMouseLeave={reset}
      onFocus={enter}
      onBlur={reset}
    >
      {!loaded ? (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-neutral-200 via-neutral-100 to-neutral-300" aria-hidden />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        width={720}
        height={2400}
        sizes="(max-width:640px) 100vw, 360px"
        loading="lazy"
        decoding="async"
        draggable={false}
        className="pointer-events-none absolute left-0 top-0 w-full max-w-none select-none object-top"
        style={{
          height: 'auto',
          maxHeight: 'none',
          transform: 'translate3d(0,0,0)',
          willChange: 'transform',
        }}
        onLoad={() => {
          setLoaded(true);
          if (active.current && src === previewLongImage) requestAnimationFrame(play);
        }}
        onError={() => {
          reset();
          setLoaded(true);
        }}
      />
      {!hideBottomFade ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/35 to-transparent opacity-80" aria-hidden />
      ) : null}
    </div>
  );
}
