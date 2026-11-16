import { templatePriceOffer } from '@marketingspa/shared';

/** Display-only: all money is plain text; a discount is derived from two numeric VND amounts. */
export function LandingPagePriceComparison({ originalPrice, price, center = false }: { originalPrice?: string; price?: string; center?: boolean }) {
  let offer;
  try { offer = templatePriceOffer({ originalPrice, salePrice: price }); } catch { return null; }
  if (!offer || offer.sale === undefined) return null;
  return <div data-lp-price-comparison style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: center ? 'center' : 'flex-start', gap: '0.5rem', marginBlock: '0.5rem', fontSize: '0.95rem', lineHeight: 1.5 }}>
    <del aria-label={`Giá gốc ${offer.originalLabel}`} style={{ opacity: 0.75, textDecoration: 'line-through' }}>{offer.originalLabel}</del>
    {offer.percentLabel && <strong style={{ display: 'inline-block', padding: '0.15rem 0.65rem', borderRadius: '999px', background: '#fff1f2', color: '#9f1239', fontWeight: 800, fontSize: '0.85rem' }}>Giảm {offer.percentLabel}</strong>}
  </div>;
}
