/**
 * Landing Page visual variant helpers + responsive CSS.
 * Composition from block.variant; designFamily only tunes tokens / surfaces.
 */

import type { CSSProperties } from 'react';
import type {
  LandingPageBlockType,
  LandingPageLayout,
  LandingPageThemeTokens,
} from '@marketingspa/shared';
import {
  canonicalBlockVariant,
  resolveBlockVariant,
  resolveDesignFamily,
  type LandingPageDesignFamily,
} from '@marketingspa/shared';

/** Hero composition shells used by the renderer (maps foundation ids). */
export type HeroComposition =
  | 'centered'
  | 'split-left'
  | 'split-right'
  | 'editorial-overlay'
  | 'fullscreen-image'
  | 'minimal-copy'
  | 'floating-card';

export function resolveHeroComposition(
  rawVariant: unknown,
  layout: LandingPageLayout,
  hasEmbeddedForm: boolean,
): HeroComposition {
  const v = canonicalBlockVariant('Hero', rawVariant);
  if (v !== 'default') {
    if (
      v === 'centered' ||
      v === 'split-left' ||
      v === 'split-right' ||
      v === 'editorial-overlay' ||
      v === 'fullscreen-image' ||
      v === 'minimal-copy' ||
      v === 'floating-card'
    ) {
      return v;
    }
  }
  // Old specs without variant: keep layout-driven shells.
  if (layout === 'lead_gen' && hasEmbeddedForm) return 'floating-card';
  if (layout === 'agency' || layout === 'course') return 'split-right';
  if (['webinar', 'product', 'saas', 'service', 'local'].includes(layout)) return 'split-left';
  return 'centered';
}

export function resolveListComposition(
  type: LandingPageBlockType,
  rawVariant: unknown,
): string {
  const v = canonicalBlockVariant(type, rawVariant);
  if (type === 'Gallery') {
    if (v === 'default') return 'grid';
    return v;
  }
  if (v === 'default') return 'icon-grid';
  return v;
}

/** designFamily → soft visual defaults (never reorders sections). */
export function designFamilyTokenOverrides(
  familyRaw: unknown,
): Partial<LandingPageThemeTokens> {
  const family = resolveDesignFamily(familyRaw);
  const map: Record<LandingPageDesignFamily, Partial<LandingPageThemeTokens>> = {
    editorial: {
      fontSizeHero: 'clamp(2rem, 4.5vw, 3.4rem)',
      sectionSpacing: '3.25rem',
      textWidth: '38rem',
      imageAspect: '3 / 4',
      radius: '10px',
      density: 'spacious',
      imageTreatment: 'editorial',
      fontWeightHeading: 700,
      lineHeightHeading: 1.2,
      shadowMd: '0 16px 40px rgba(15, 23, 42, 0.08)',
    },
    minimal: {
      fontSizeHero: 'clamp(1.75rem, 3.5vw, 2.75rem)',
      sectionSpacing: '2.25rem',
      radius: '8px',
      shadow: '0 8px 24px rgba(15, 23, 42, 0.06)',
      imageAspect: '1 / 1',
      density: 'compact',
      imageTreatment: 'product-flat',
      buttonStyle: 'outline',
      fontWeightHeading: 600,
    },
    luxury: {
      fontSizeHero: 'clamp(2rem, 4.2vw, 3.25rem)',
      sectionSpacing: '3.5rem',
      radius: '14px',
      imageAspect: '4 / 5',
      buttonStyle: 'solid',
      density: 'spacious',
      imageTreatment: 'editorial',
      fontWeightHeading: 500,
      shadowLg: '0 28px 70px rgba(15, 23, 42, 0.12)',
    },
    bold: {
      fontSizeHero: 'clamp(2.1rem, 5vw, 3.5rem)',
      sectionSpacing: '2.5rem',
      radius: '16px',
      imageAspect: '16 / 9',
      density: 'comfortable',
      imageTreatment: 'photo-real',
      fontWeightHeading: 900,
      buttonStyle: 'solid',
    },
    organic: {
      fontSizeHero: 'clamp(1.9rem, 4vw, 3rem)',
      sectionSpacing: '3rem',
      radius: '20px',
      imageAspect: '5 / 6',
      density: 'spacious',
      imageTreatment: 'photo-real',
      radiusPill: '9999px',
    },
    corporate: {
      fontSizeHero: 'clamp(1.8rem, 3.8vw, 2.85rem)',
      sectionSpacing: '2.75rem',
      radius: '10px',
      containerWidth: '70rem',
      density: 'comfortable',
      imageTreatment: 'product-flat',
      fontWeightHeading: 700,
      buttonStyle: 'solid',
    },
    conversion: {
      fontSizeHero: 'clamp(1.85rem, 4vw, 3.15rem)',
      sectionSpacing: '2.5rem',
      buttonStyle: 'solid',
      density: 'compact',
      imageTreatment: 'photo-real',
      fontWeightHeading: 800,
    },
    portfolio: {
      fontSizeHero: 'clamp(1.9rem, 4vw, 3.1rem)',
      sectionSpacing: '3rem',
      imageAspect: '4 / 3',
      radius: '12px',
      density: 'spacious',
      imageTreatment: 'editorial',
    },
    local: {
      fontSizeHero: 'clamp(1.85rem, 4vw, 2.9rem)',
      sectionSpacing: '2.5rem',
      radius: '12px',
      density: 'comfortable',
      imageTreatment: 'photo-real',
      buttonStyle: 'solid',
    },
    product: {
      fontSizeHero: 'clamp(1.9rem, 4vw, 3.1rem)',
      sectionSpacing: '2.75rem',
      imageAspect: '1 / 1',
      radius: '14px',
      density: 'comfortable',
      imageTreatment: 'product-flat',
    },
  };
  return map[family] || map.conversion;
}

export function mergeDesignFamilyTokens(
  tokens: LandingPageThemeTokens,
  familyRaw: unknown,
): LandingPageThemeTokens {
  const over = designFamilyTokenOverrides(familyRaw);
  return { ...tokens, ...over };
}

function resolveFontPairing(fontFamily: string): { heading: string; body: string } {
  if (/Fraunces|Playfair|Palatino|serif/i.test(fontFamily)) {
    return {
      heading: fontFamily,
      body: '"DM Sans", "Segoe UI", system-ui, sans-serif',
    };
  }
  if (/IBM Plex Sans/i.test(fontFamily)) {
    return { heading: fontFamily, body: '"IBM Plex Sans", "Segoe UI", sans-serif' };
  }
  if (/Manrope/i.test(fontFamily)) {
    return { heading: fontFamily, body: '"Manrope", "Segoe UI", sans-serif' };
  }
  return {
    heading: fontFamily,
    body: '"Plus Jakarta Sans", "Segoe UI", system-ui, sans-serif',
  };
}

export function extendedTokenStyle(tokens: LandingPageThemeTokens): CSSProperties {
  const density = tokens.density || 'comfortable';
  const sectionMult = density === 'compact' ? '0.85' : density === 'spacious' ? '1.2' : '1';
  const fonts = resolveFontPairing(tokens.fontFamily || 'system-ui, sans-serif');
  return {
    ['--lp-canvas' as string]: tokens.canvas || tokens.background,
    ['--lp-surface-alt' as string]: tokens.surfaceAlt || tokens.surface,
    ['--lp-text-muted' as string]: tokens.textMuted || tokens.muted,
    ['--lp-container' as string]: tokens.containerWidth || '68rem',
    ['--lp-font-heading' as string]: fonts.heading,
    ['--lp-font-body' as string]: fonts.body,
    ['--lp-text-width' as string]: tokens.textWidth || '42rem',
    ['--lp-section-space' as string]: tokens.sectionSpacing || '2.75rem',
    ['--lp-section-mult' as string]: sectionMult,
    ['--lp-fs-sm' as string]: tokens.fontSizeSm || '0.875rem',
    ['--lp-fs-md' as string]: tokens.fontSizeMd || '1rem',
    ['--lp-fs-lg' as string]: tokens.fontSizeLg || '1.125rem',
    ['--lp-fs-xl' as string]: tokens.fontSizeXl || '1.5rem',
    ['--lp-fs-2xl' as string]: tokens.fontSize2xl || '2rem',
    ['--lp-fs-hero' as string]: tokens.fontSizeHero || 'clamp(1.85rem, 4vw, 3.15rem)',
    ['--lp-fw-heading' as string]: String(tokens.fontWeightHeading ?? 800),
    ['--lp-fw-body' as string]: String(tokens.fontWeightBody ?? 400),
    ['--lp-lh-heading' as string]: String(tokens.lineHeightHeading ?? 1.15),
    ['--lp-lh-body' as string]: String(tokens.lineHeightBody ?? 1.6),
    ['--lp-image-radius' as string]: tokens.imageRadius || tokens.radius,
    ['--lp-image-aspect' as string]: tokens.imageAspect || '4 / 5',
    ['--lp-button-radius' as string]: tokens.buttonRadius || `calc(${tokens.radius} - 2px)`,
    ['--lp-radius-sm' as string]: tokens.radiusSm || `calc(${tokens.radius} - 4px)`,
    ['--lp-radius-md' as string]: tokens.radiusMd || tokens.radius,
    ['--lp-radius-lg' as string]: tokens.radiusLg || `calc(${tokens.radius} + 6px)`,
    ['--lp-radius-pill' as string]: tokens.radiusPill || '9999px',
    ['--lp-shadow-sm' as string]: tokens.shadowSm || '0 4px 14px rgba(15, 23, 42, 0.06)',
    ['--lp-shadow-md' as string]: tokens.shadowMd || tokens.shadow || '0 12px 36px rgba(15, 23, 42, 0.10)',
    ['--lp-shadow-lg' as string]: tokens.shadowLg || '0 24px 60px rgba(15, 23, 42, 0.14)',
    ['--lp-button-style' as string]: tokens.buttonStyle || 'solid',
    ['--lp-image-treatment' as string]: tokens.imageTreatment || 'photo-real',
  };
}

/**
 * Lightweight conversionGoal emphasis — never reorders blocks.
 * Returns optional data-attr value for CSS (e.g. stronger CTA).
 */
export function conversionGoalEmphasis(goalRaw: unknown): string {
  const g = typeof goalRaw === 'string' ? goalRaw : 'lead';
  if (['lead', 'booking', 'purchase', 'signup', 'download', 'contact'].includes(g)) return g;
  return 'lead';
}

/** Shared variant + viewport CSS injected once. */
export const LP_VARIANT_CSS = `
/* —— Block variants (composition) —— */
[data-lp-variant="minimal-copy"] [data-lp-hero-copy] { max-width: var(--lp-text-width, 42rem); margin-inline: auto; }
[data-lp-variant="minimal-copy"] [data-lp-hero-trust] { display: none; }

[data-lp-variant="editorial-overlay"] { position: relative; min-height: min(70vh, 640px); }
[data-lp-variant="editorial-overlay"] [data-lp-hero-overlay-bg] {
  position: absolute; inset: 0; background-size: cover; background-position: center;
  filter: brightness(0.55);
}
[data-lp-variant="editorial-overlay"] [data-lp-hero-copy] {
  position: relative; z-index: 1; color: #fff; max-width: var(--lp-text-width, 42rem);
}
[data-lp-variant="editorial-overlay"] [data-lp-hero-copy] h1,
[data-lp-variant="editorial-overlay"] [data-lp-hero-copy] [data-lp-inline-field="headline"] { color: #fff !important; }
[data-lp-variant="editorial-overlay"] [data-lp-hero-copy] p,
[data-lp-variant="editorial-overlay"] [data-lp-hero-copy] [data-lp-inline-field="subheadline"] { color: rgba(255,255,255,0.88) !important; }

[data-lp-variant="fullscreen-image"] [data-lp-hero-visual] { max-width: none; width: 100%; }
[data-lp-variant="fullscreen-image"] [data-lp-hero-visual] img,
[data-lp-variant="fullscreen-image"] [data-lp-hero-visual] > div {
  aspect-ratio: 16 / 9; max-width: 100%; border-radius: var(--lp-image-radius, var(--lp-radius));
}

[data-lp-variant="floating-card"] [data-lp-hero-float] {
  background: var(--lp-surface); border-radius: var(--lp-radius);
  box-shadow: var(--lp-shadow); padding: 1.25rem; border: 1px solid var(--lp-border);
}

[data-lp-list-variant="alternating"] [data-lp-card-item]:nth-child(even) {
  flex-direction: row-reverse;
}
[data-lp-list-variant="alternating"] [data-lp-alt-row] {
  display: flex; flex-direction: column; gap: 1rem; align-items: center;
}
@media (min-width: 768px) {
  [data-lp-list-variant="alternating"] [data-lp-alt-row] {
    flex-direction: row; gap: 1.75rem; text-align: left;
  }
  [data-lp-list-variant="alternating"] [data-lp-card-item]:nth-child(even) [data-lp-alt-row] {
    flex-direction: row-reverse;
  }
}

[data-lp-list-variant="masonry"] [data-lp-cards-grid],
[data-lp-gallery-variant="masonry"] [data-lp-cards-grid] {
  columns: 1; column-gap: 0.75rem;
}
@media (min-width: 768px) {
  [data-lp-list-variant="masonry"] [data-lp-cards-grid],
  [data-lp-gallery-variant="masonry"] [data-lp-cards-grid] { columns: 2; }
}
@media (min-width: 1024px) {
  [data-lp-list-variant="masonry"] [data-lp-cards-grid],
  [data-lp-gallery-variant="masonry"] [data-lp-cards-grid] { columns: 3; }
}
[data-lp-list-variant="masonry"] [data-lp-card-item],
[data-lp-gallery-variant="masonry"] [data-lp-card-item] {
  break-inside: avoid; margin-bottom: 0.75rem; display: inline-block; width: 100%;
}

[data-lp-gallery-variant="editorial-mosaic"] [data-lp-cards-grid] {
  display: grid; grid-template-columns: 1fr; gap: 0.75rem;
}
@media (min-width: 768px) {
  [data-lp-gallery-variant="editorial-mosaic"] [data-lp-cards-grid] {
    grid-template-columns: 1.4fr 1fr 1fr; grid-auto-rows: minmax(140px, auto);
  }
  [data-lp-gallery-variant="editorial-mosaic"] [data-lp-card-item]:first-child {
    grid-row: span 2; grid-column: 1;
  }
}

[data-lp-gallery-variant="featured-plus-grid"] [data-lp-cards-grid] {
  display: grid; grid-template-columns: 1fr; gap: 0.75rem;
}
@media (min-width: 768px) {
  [data-lp-gallery-variant="featured-plus-grid"] [data-lp-cards-grid] {
    grid-template-columns: 1.2fr 1fr; gap: 1rem;
  }
  [data-lp-gallery-variant="featured-plus-grid"] [data-lp-card-item]:first-child {
    grid-row: span 2;
  }
}

[data-lp-testimonials-variant="quote-centered"] [data-lp-testimonials-grid] {
  display: block; max-width: var(--lp-text-width, 42rem); margin-inline: auto; text-align: center;
}
[data-lp-testimonials-variant="quote-centered"] [data-lp-card-item] {
  box-shadow: none; background: transparent; padding: 1.5rem 0;
}
[data-lp-testimonials-variant="editorial"] [data-lp-testimonials-grid] {
  display: grid; grid-template-columns: 1fr; gap: 1.5rem;
}
@media (min-width: 768px) {
  [data-lp-testimonials-variant="editorial"] [data-lp-testimonials-grid] {
    grid-template-columns: 1fr 1fr; gap: 2rem;
  }
}
[data-lp-testimonials-variant="portrait-quotes"] [data-lp-card-item] {
  display: flex; flex-direction: column; align-items: center; text-align: center;
}
[data-lp-testimonials-variant="portrait-quotes"] img,
[data-lp-testimonials-variant="portrait-quotes"] [data-lp-avatar] {
  width: 4.5rem; height: 4.5rem; border-radius: 9999px;
}
[data-lp-testimonials-variant="metric-plus-quote"] [data-lp-metric] {
  font-size: var(--lp-fs-2xl, 2rem); font-weight: 800; color: var(--lp-primary);
}

[data-lp-cta-variant="minimal"] [data-lp-cta-band] {
  background: var(--lp-surface) !important; color: var(--lp-text) !important;
  box-shadow: none; border: 1px solid var(--lp-border);
}
[data-lp-cta-variant="minimal"] [data-lp-cta-band] * { color: inherit !important; }
[data-lp-cta-variant="centered"] [data-lp-cta-band] {
  flex-direction: column; text-align: center; align-items: center;
}
[data-lp-cta-variant="banner"] [data-lp-cta-band] { border-radius: 0; }
[data-lp-category="agency"] [data-lp-cta-variant="banner"] [data-lp-cta-band] {
  border-radius: var(--lp-radius-lg, calc(var(--lp-radius) + 4px));
}
[data-lp-form-variant="inline"] [data-lp-form-card] { max-width: 100%; box-shadow: none; border: none; background: transparent; padding: 0; }
[data-lp-form-variant="booking"] [data-lp-form-card] { border-top: 4px solid var(--lp-primary); }
[data-lp-form-variant="minimal"] [data-lp-form-card] { box-shadow: none; border: 1px solid var(--lp-border); }
[data-lp-form-variant="floating-card"] [data-lp-form-card] {
  box-shadow: var(--lp-shadow-lg, var(--lp-shadow)); transform: translateY(-0.35rem);
}

/* —— Additive design tokens consumption —— */
[data-lp-canvas-root] {
  --lp-shadow: var(--lp-shadow-md, 0 12px 36px rgba(15, 23, 42, 0.10));
}
[data-lp-canvas-root] h1,
[data-lp-canvas-root] h2,
[data-lp-canvas-root] h3,
[data-lp-canvas-root] [data-lp-inline-field="headline"] {
  font-weight: var(--lp-fw-heading, 800);
  line-height: var(--lp-lh-heading, 1.15);
}
[data-lp-canvas-root] p,
[data-lp-canvas-root] [data-lp-inline-field="subheadline"],
[data-lp-canvas-root] [data-lp-inline-field="body"] {
  font-weight: var(--lp-fw-body, 400);
  line-height: var(--lp-lh-body, 1.6);
  font-size: var(--lp-fs-md, 1rem);
}
[data-lp-density="compact"] [data-lp-section-pad],
[data-lp-density="compact"] section[class*="py-"] {
  padding-top: calc(var(--lp-section-space, 2.5rem) * 0.72 * var(--lp-section-mult, 0.85)) !important;
  padding-bottom: calc(var(--lp-section-space, 2.5rem) * 0.72 * var(--lp-section-mult, 0.85)) !important;
}
[data-lp-density="spacious"] [data-lp-section-pad],
[data-lp-density="spacious"] section[class*="py-"] {
  padding-top: calc(var(--lp-section-space, 2.75rem) * 1.15 * var(--lp-section-mult, 1.2)) !important;
  padding-bottom: calc(var(--lp-section-space, 2.75rem) * 1.15 * var(--lp-section-mult, 1.2)) !important;
}
[data-lp-canvas-root] h1 {
  font-size: var(--lp-fs-hero, clamp(1.85rem, 4vw, 3.15rem));
  letter-spacing: -0.03em;
}
[data-lp-section-tone="dark"],
[data-lp-section-tone="dark"] [data-lp-inline-field],
[data-lp-section-tone="dark"] h1,
[data-lp-section-tone="dark"] h2,
[data-lp-section-tone="dark"] h3,
[data-lp-section-tone="dark"] p {
  color: #f8fafc;
}
[data-lp-section-tone="dark"] [style*="var(--lp-muted)"],
[data-lp-section-tone="dark"] [style*="var(--lp-secondary)"] {
  color: #e2e8f0 !important;
}
[data-lp-btn-style="outline"] [data-lp-cta-band] a,
[data-lp-btn-style="outline"] [data-lp-hero-cta] a {
  background: transparent !important;
  color: var(--lp-primary) !important;
  border: 2px solid var(--lp-primary);
  box-shadow: none !important;
}
[data-lp-btn-style="pill"] [data-lp-cta-band] a,
[data-lp-btn-style="pill"] [data-lp-hero-cta] a,
[data-lp-btn-style="pill"] [data-lp-form-card] button[type="submit"] {
  border-radius: var(--lp-radius-pill, 9999px) !important;
}
[data-lp-image-treatment="editorial"] [data-lp-content-image],
[data-lp-image-treatment="editorial"] [data-lp-hero-visual] img {
  filter: contrast(1.05) saturate(0.92);
}
[data-lp-image-treatment="product-flat"] [data-lp-content-image],
[data-lp-image-treatment="product-flat"] [data-lp-hero-visual] img {
  filter: none;
  box-shadow: none;
  border-radius: var(--lp-radius-sm, 6px);
}
[data-lp-pricing-variant="comparison"] [data-lp-pricing-table] {
  width: 100%; border-collapse: collapse;
}
[data-lp-pricing-variant="comparison"] [data-lp-pricing-table] th,
[data-lp-pricing-variant="comparison"] [data-lp-pricing-table] td {
  border: 1px solid var(--lp-border); padding: 0.75rem 0.85rem; text-align: left; vertical-align: top;
}
[data-lp-pricing-variant="minimal"] [data-lp-pricing-minimal] {
  display: flex; flex-direction: column; gap: 1.25rem; max-width: 36rem; margin-inline: auto;
}
[data-lp-process-variant="timeline"] [data-lp-timeline] {
  position: relative; padding-left: 1.75rem;
}
[data-lp-process-variant="timeline"] [data-lp-timeline]::before {
  content: ""; position: absolute; left: 0.55rem; top: 0.25rem; bottom: 0.25rem; width: 2px;
  background: color-mix(in srgb, var(--lp-primary) 35%, transparent);
}
[data-lp-cta-variant="split"] [data-lp-cta-split] {
  display: grid; gap: 1.25rem; align-items: center;
}
@media (min-width: 768px) {
  [data-lp-cta-variant="split"] [data-lp-cta-split] { grid-template-columns: 1.2fr 0.8fr; }
}
[data-lp-cta-variant="floating-card"] [data-lp-cta-float-wrap] {
  background: var(--lp-surface-alt, var(--lp-surface)); padding: 1.5rem 1rem;
}
[data-lp-cta-variant="floating-card"] [data-lp-cta-band] {
  max-width: 56rem; margin-inline: auto;
  box-shadow: var(--lp-shadow-lg, var(--lp-shadow));
}
[data-lp-form-variant="split"] [data-lp-form-split] {
  display: grid; gap: 1.5rem; align-items: start; width: 100%; max-width: 64rem; margin-inline: auto;
}
@media (min-width: 768px) {
  [data-lp-form-variant="split"] [data-lp-form-split] { grid-template-columns: 1fr 1fr; }
}
[data-lp-gallery-variant="featured-plus-grid"] [data-lp-gallery-featured] {
  margin-bottom: 0.85rem;
}
[data-lp-gallery-variant="featured-plus-grid"] [data-lp-gallery-featured] img {
  width: 100%; aspect-ratio: 16 / 9; object-fit: cover;
  border-radius: var(--lp-image-radius, var(--lp-radius));
}
[data-lp-testimonials-variant="editorial"] [data-lp-testimonial-editorial] {
  border-left: 3px solid var(--lp-primary); padding-left: 1.1rem; background: transparent; box-shadow: none;
}
[data-lp-testimonials-variant="portrait-quotes"] [data-lp-testimonial-portrait] {
  display: flex; flex-direction: column; gap: 1rem; align-items: flex-start; text-align: left;
}
@media (min-width: 640px) {
  [data-lp-testimonials-variant="portrait-quotes"] [data-lp-testimonial-portrait] {
    flex-direction: row; align-items: center;
  }
}

/* Goal emphasis (no reorder) */
[data-lp-goal="booking"] [data-lp-cta-band],
[data-lp-goal="purchase"] [data-lp-cta-band] { ring: 0; outline: none; }
[data-lp-goal="booking"] a[href="#lead-form"],
[data-lp-goal="purchase"] a[href="#lead-form"] { min-width: 12rem; }

/* —— Responsive 1440 / 768 / 390 —— */
[data-lp-canvas-root] {
  overflow-x: clip;
  max-width: 100%;
}
[data-lp-canvas-root] img,
[data-lp-canvas-root] video,
[data-lp-canvas-root] iframe {
  max-width: 100%;
  height: auto;
}
[data-lp-hero-cta] a,
[data-lp-cta-band] a,
[data-lp-hero-cta] [data-lp-inline-field="ctaLabel"] {
  max-width: 100%;
}

@media (max-width: 767px) {
  [data-lp-canvas-root] {
    --lp-section-space: 1.75rem;
  }
  [data-lp-hero-cta] a,
  [data-lp-cta-band] a,
  [data-lp-form-card] button[type="submit"] {
    width: 100%;
    justify-content: center;
  }
  [data-lp-variant="split-left"] [data-lp-hero-grid],
  [data-lp-variant="split-right"] [data-lp-hero-grid],
  [data-lp-variant="floating-card"] [data-lp-hero-grid] {
    display: flex !important;
    flex-direction: column;
    gap: 1.25rem;
  }
  [data-lp-variant="split-right"] [data-lp-hero-visual] { order: -1; }
  [data-lp-list-variant="icon-grid"] [data-lp-cards-grid],
  [data-lp-list-variant="image-cards"] [data-lp-cards-grid] {
    grid-template-columns: 1fr !important;
  }
  [data-lp-hero-copy] h1,
  [data-lp-hero-copy] [data-lp-inline-field="headline"] {
    font-size: clamp(1.6rem, 7vw, 2.1rem) !important;
    line-height: 1.15 !important;
    overflow-wrap: anywhere;
  }
  [data-lp-variant="editorial-overlay"] { min-height: 420px; padding: 2rem 1rem; }
  [data-lp-variant="editorial-overlay"] [data-lp-hero-overlay-bg] { filter: brightness(0.45); }
}

@media (min-width: 768px) and (max-width: 1023px) {
  [data-lp-list-variant="icon-grid"] [data-lp-cards-grid],
  [data-lp-list-variant="image-cards"] [data-lp-cards-grid] {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }
}

@media (min-width: 1440px) {
  [data-lp-container-inner] {
    max-width: min(var(--lp-container, 68rem), 100%);
  }
}

/* Builder viewport sim: force mobile collapse */
[data-lp-viewport="mobile"] [data-lp-hero-grid] {
  display: flex !important; flex-direction: column !important;
}
[data-lp-viewport="mobile"] [data-lp-cards-grid],
[data-lp-viewport="mobile"] [data-lp-testimonials-grid],
[data-lp-viewport="mobile"] [data-lp-pricing-grid] {
  grid-template-columns: 1fr !important;
}
[data-lp-viewport="mobile"] [data-lp-hero-cta] a,
[data-lp-viewport="mobile"] [data-lp-cta-band] a {
  width: 100%; justify-content: center;
}
[data-lp-viewport="tablet"] [data-lp-cards-grid]:not([data-lp-process-grid]) {
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
}
`.trim();

export { resolveBlockVariant, canonicalBlockVariant };
