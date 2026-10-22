'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
  thumbnail: string;
  previewLongImage: string;
  alt: string;
  className?: string;
  /** Disable hover scroll (e.g. touch devices). */
  enableHoverScroll?: boolean;
};

/**
 * Fixed-height preview frame: shows thumb at rest; on hover scrolls long preview
 * via transform translateY (smooth, layout-safe).
 */
export function TemplateHoverPreview({
  thumbnail,
  previewLongImage,
  alt,
  className = '',
  enableHoverScroll = true,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [src, setSrc] = useState(thumbnail);
  const [loaded, setLoaded] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [scrollPx, setScrollPx] = useState(0);

  const measure = useCallback(() => {
    const frame = frameRef.current;
    const img = imgRef.current;
    if (!frame || !img) return;
    const distance = Math.max(0, img.offsetHeight - frame.clientHeight);
    setScrollPx(distance);
  }, []);

  useEffect(() => {
    setLoaded(false);
    setSrc(thumbnail);
    setScrollPx(0);
  }, [thumbnail, previewLongImage]);

  function onEnter() {
    if (!enableHoverScroll) return;
    setHovering(true);
    // Swap to long image for scroll; preload then measure.
    if (src !== previewLongImage) {
      const pre = new Image();
      pre.onload = () => {
        setSrc(previewLongImage);
      };
      pre.src = previewLongImage;
    } else {
      measure();
    }
  }

  function onLeave() {
    setHovering(false);
    // Drop long image after hover to avoid keeping 200 full-page assets in memory.
    setSrc(thumbnail);
    setScrollPx(0);
  }

  return (
    <div
      ref={frameRef}
      className={`relative overflow-hidden bg-neutral-200/80 ${className}`}
      style={{ aspectRatio: '16 / 10' }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {!loaded ? (
        <div
          className="absolute inset-0 animate-pulse bg-gradient-to-br from-neutral-200 via-neutral-100 to-neutral-300"
          aria-hidden
        />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        width={640}
        height={400}
        loading="lazy"
        decoding="async"
        draggable={false}
        className="pointer-events-none absolute left-0 top-0 w-full max-w-none select-none will-change-transform"
        style={{
          // Intrinsic ratio reserved by parent aspect-ratio — avoids CLS.
          transform: hovering && scrollPx > 0 ? `translate3d(0, -${scrollPx}px, 0)` : 'translate3d(0, 0, 0)',
          transition: hovering
            ? `transform ${Math.min(8, Math.max(2.5, scrollPx / 180))}s cubic-bezier(0.22, 0.61, 0.36, 1)`
            : 'transform 0.45s ease-out',
        }}
        onLoad={() => {
          setLoaded(true);
          if (hovering) measure();
        }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/35 to-transparent opacity-80"
        aria-hidden
      />
    </div>
  );
}
