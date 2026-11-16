import { useLayoutEffect, type RefObject } from 'react';

type RGB = [number, number, number];
function rgb(value: string): RGB | null {
  const parts = value.match(
    /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/,
  );
  if (!parts || (parts[4] != null && Number(parts[4]) < 0.1)) return null;
  return [Number(parts[1]), Number(parts[2]), Number(parts[3])];
}
function luminance(color: RGB): number {
  const channels = color.map((value) => {
    const c = value / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}
const contrast = (a: RGB, b: RGB) =>
  (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
function surfaces(element: HTMLElement, root: HTMLElement): RGB[] {
  let current: HTMLElement | null = element;
  while (current) {
    const style = getComputedStyle(current);
    const gradient = [...style.backgroundImage.matchAll(/rgba?\([^)]+\)/g)]
      .map((match) => rgb(match[0]))
      .filter((value): value is RGB => !!value);
    if (gradient.length) return gradient;
    const solid = rgb(style.backgroundColor);
    if (solid) return [solid];
    if (current === root) break;
    current = current.parentElement;
  }
  return [[255, 255, 255]];
}

/** Repair inherited/custom-CSS button ink at render time, identically in Builder, preview and public. */
export function useLandingPageActionReadability(
  rootRef: RefObject<HTMLDivElement | null>,
  dependency: unknown,
) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let frame = 0;
    const originals = new Map<
      HTMLElement,
      { color: string; priority: string; fill: string; fillPriority: string }
    >();
    const repair = () => {
      frame = 0;
      const actions = root.querySelectorAll<HTMLElement>(
        'a[href],button[type="submit"],[data-lp-inline-field="ctaLabel"],[data-lp-inline-field="submitLabel"],[data-lp-inline-field^="planCta:"]',
      );
      for (const action of actions) {
        if (
          !action.getClientRects().length ||
          action.closest('[data-lp-resize-handle],[data-lp-rotate-handle]')
        )
          continue;
        const backgrounds = surfaces(action, root);
        const nodes = [
          action,
          ...action.querySelectorAll<HTMLElement>('[data-lp-inline-field],span'),
        ];
        const hasBadInk = nodes.some((node) => {
          const color = rgb(getComputedStyle(node).color);
          return (
            color && Math.min(...backgrounds.map((background) => contrast(color, background))) < 4.5
          );
        });
        if (!hasBadInk) continue;
        const black: RGB = [0, 0, 0],
          white: RGB = [255, 255, 255];
        const score = (ink: RGB) =>
          Math.min(...backgrounds.map((background) => contrast(ink, background)));
        const ink = score(black) >= score(white) ? '#000000' : '#ffffff';
        action.setAttribute('data-lp-readable-action', '1');
        for (const node of nodes) {
          if (!originals.has(node))
            originals.set(node, {
              color: node.style.getPropertyValue('color'),
              priority: node.style.getPropertyPriority('color'),
              fill: node.style.getPropertyValue('-webkit-text-fill-color'),
              fillPriority: node.style.getPropertyPriority('-webkit-text-fill-color'),
            });
          if (
            node.style.getPropertyValue('color') !== ink ||
            node.style.getPropertyPriority('color') !== 'important'
          )
            node.style.setProperty('color', ink, 'important');
          if (node.style.getPropertyValue('-webkit-text-fill-color') !== ink)
            node.style.setProperty('-webkit-text-fill-color', ink, 'important');
        }
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(repair);
    };
    repair();
    schedule();
    const mutation = new MutationObserver(schedule);
    mutation.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
    const styles = new MutationObserver(schedule);
    styles.observe(document.head, { childList: true, subtree: true, characterData: true });
    const resize = new ResizeObserver(schedule);
    resize.observe(root);
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      mutation.disconnect();
      styles.disconnect();
      resize.disconnect();
      window.removeEventListener('resize', schedule);
      for (const [node, value] of originals) {
        if (value.color) node.style.setProperty('color', value.color, value.priority);
        else node.style.removeProperty('color');
        if (value.fill)
          node.style.setProperty('-webkit-text-fill-color', value.fill, value.fillPriority);
        else node.style.removeProperty('-webkit-text-fill-color');
      }
    };
  }, [rootRef, dependency]);
}
