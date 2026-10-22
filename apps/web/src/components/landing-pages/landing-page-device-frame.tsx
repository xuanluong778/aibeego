'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

export type LandingPageDeviceKind = 'mobile' | 'tablet';

/** Logical CSS px for the device screen (content viewport). */
export const LP_DEVICE_SCREEN = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
} as const;

const BEZEL = {
  mobile: 10,
  tablet: 14,
} as const;

type Props = {
  device: LandingPageDeviceKind;
  children: ReactNode;
  className?: string;
};

/**
 * Builder-only device chrome (iPhone Pro–style mobile / slim tablet).
 * Must never wrap public/publish render paths.
 */
export function LandingPageDeviceFrame({ device, children, className }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [contentHeight, setContentHeight] = useState(LP_DEVICE_SCREEN[device].height);

  const screen = LP_DEVICE_SCREEN[device];
  const bezel = BEZEL[device];
  const frameW = screen.width + bezel * 2;
  const frameH = screen.height + bezel * 2;
  const outerRadius = device === 'mobile' ? 44 : 28;
  const screenRadius = device === 'mobile' ? 36 : 20;
  const screenHeight = Math.max(screen.height, contentHeight);
  const shellHeight = screenHeight + bezel * 2;

  const recomputeScale = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;
    const availW = Math.max(0, host.clientWidth - 8);
    if (availW < 40) {
      setScale(1);
      return;
    }
    // Width-only scale — vertical scroll lives on the outer canvas, not inside the device.
    const next = Math.min(1, availW / frameW);
    setScale(Number.isFinite(next) && next > 0.2 ? next : 1);
  }, [frameW]);

  useEffect(() => {
    recomputeScale();
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => recomputeScale());
    ro.observe(host);
    window.addEventListener('resize', recomputeScale);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', recomputeScale);
    };
  }, [recomputeScale]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const sync = () => {
      const next = Math.max(screen.height, Math.ceil(el.getBoundingClientRect().height));
      setContentHeight((prev) => (prev === next ? prev : next));
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [screen.height, children]);

  const shellStyle: CSSProperties = {
    width: frameW,
    minHeight: frameH,
    height: shellHeight,
    borderRadius: outerRadius,
    transform: scale !== 1 ? `scale(${scale})` : undefined,
    transformOrigin: 'top center',
  };

  const layoutStyle: CSSProperties = {
    width: frameW * scale,
    height: shellHeight * scale,
  };

  return (
    <div
      ref={hostRef}
      className={
        'flex min-h-[560px] w-full items-start justify-center py-2 ' +
        (className || '')
      }
      data-lp-device-frame-host="1"
      data-lp-device={device}
    >
      <div style={layoutStyle} className="relative mx-auto shrink-0" data-lp-device-scale-slot="1">
        <div
          className="relative mx-auto bg-[#1c1c1e] shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
          style={shellStyle}
          data-lp-device-frame="1"
          data-lp-device-kind={device}
          data-lp-device-scale={String(scale)}
          aria-label={device === 'mobile' ? 'Mobile phone preview' : 'Tablet preview'}
        >
          {/* Thin metallic rim */}
          <div
            className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-white/15"
            aria-hidden
          />
          {/* Side buttons (mobile only, decorative) */}
          {device === 'mobile' ? (
            <>
              <span
                className="pointer-events-none absolute -left-[2px] top-[120px] h-7 w-[2px] rounded-l bg-[#3a3a3c]"
                aria-hidden
              />
              <span
                className="pointer-events-none absolute -left-[2px] top-[168px] h-12 w-[2px] rounded-l bg-[#3a3a3c]"
                aria-hidden
              />
              <span
                className="pointer-events-none absolute -left-[2px] top-[228px] h-12 w-[2px] rounded-l bg-[#3a3a3c]"
                aria-hidden
              />
              <span
                className="pointer-events-none absolute -right-[2px] top-[180px] h-16 w-[2px] rounded-r bg-[#3a3a3c]"
                aria-hidden
              />
            </>
          ) : null}

          <div
            className="absolute overflow-visible bg-white"
            style={{
              top: bezel,
              left: bezel,
              width: screen.width,
              minHeight: screen.height,
              height: screenHeight,
              borderRadius: screenRadius,
            }}
            data-lp-device-screen="1"
            data-lp-device-screen-w={screen.width}
            data-lp-device-screen-h={screenHeight}
          >
            {/* Dynamic Island / notch — sits above scroll content */}
            {device === 'mobile' ? (
              <div
                className="pointer-events-none absolute left-1/2 top-2.5 z-20 h-[28px] w-[110px] -translate-x-1/2 rounded-full bg-black shadow-sm"
                data-lp-device-notch="1"
                aria-hidden
              />
            ) : (
              <div
                className="pointer-events-none absolute left-1/2 top-2 z-20 h-2 w-2 -translate-x-1/2 rounded-full bg-black/80"
                data-lp-device-camera="1"
                aria-hidden
              />
            )}

            <div
              className="h-auto w-full overflow-x-hidden overflow-y-visible"
              data-lp-device-no-inner-scroll="1"
            >
              <div
                ref={contentRef}
                className="min-h-full w-full max-w-full overflow-x-hidden"
                data-lp-device-content="1"
                style={{ width: screen.width, minHeight: screen.height }}
              >
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
