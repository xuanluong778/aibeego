export type LandingPageCacheScope = {
  organizationId: string;
  pageId: string;
  slug: string;
};

/** Apex /p/:slug không có org trong URL — getPublicBySlug có thể lấy nhầm nếu hai tenant trùng slug. */
export const LANDING_PAGE_APEX_SLUG_AMBIGUITY_NOTE =
  'Trên host chung, slug trùng giữa tổ chức: cache ISR theo scope API trả về; domain/subdomain xác định org rõ ràng.';

/** ISR scope resolver (đồng bộ với GET …/public/:slug/cache-scope). */
export function landingPageScopeCacheTag(slug: string): string {
  const clean = slug.trim().toLowerCase();
  return clean ? `lp-scope-${clean}` : 'lp-scope-empty';
}

/** ISR / on-demand cache tags for one published landing page (org + page scoped). */
export function landingPagePublicCacheTags(input: LandingPageCacheScope): string[] {
  const org = input.organizationId.trim();
  const slug = input.slug.trim().toLowerCase();
  const pageId = input.pageId.trim();
  const tags = [
    `lp-public-page-${pageId}`,
    `lp-public-${org}-${slug}`,
    landingPageScopeCacheTag(slug),
  ];
  if (slug) tags.push(`lp-public-${slug}`);
  return tags;
}

export function landingPagePublicPath(slug: string): string {
  const clean = slug.trim();
  if (!clean) return '/p';
  return `/p/${encodeURIComponent(clean).replace(/%2F/gi, '/')}`;
}