import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import {
  PublicLandingPageClient,
  type PublicLandingPayload,
} from '@/components/landing-pages/public-landing-page-client';
import { JsonLdScript } from '@/components/landing-pages/json-ld-script';
import { landingPagePublicApiBase } from '@/lib/landing-page-public-api';
import {
  landingPagePublicCacheTags,
  landingPageScopeCacheTag,
  type LandingPageCacheScope,
} from '@marketingspa/shared';

export const revalidate = 60;

async function resolveCacheScope(slug: string): Promise<LandingPageCacheScope | null> {
  if (slug.startsWith('lp-domain-') || slug.startsWith('lp-platform-')) return null;
  try {
    const res = await fetch(
      `${landingPagePublicApiBase()}/api/v1/landing-pages/public/${encodeURIComponent(slug)}/cache-scope`,
      { next: { revalidate: 60, tags: [landingPageScopeCacheTag(slug)] } },
    );
    if (!res.ok) return null;
    return (await res.json()) as LandingPageCacheScope;
  } catch {
    return null;
  }
}

async function fetchPublic(slug: string): Promise<PublicLandingPayload | null> {
  try {
    const isDomainKey = slug.startsWith('lp-domain-') || slug.startsWith('lp-platform-');
    const scope = isDomainKey ? null : await resolveCacheScope(slug);
    const isrTags = scope
      ? landingPagePublicCacheTags(scope)
      : isDomainKey
        ? undefined
        : [`lp-public-${slug}`];
    const res = await fetch(
      `${landingPagePublicApiBase()}/api/v1/landing-pages/public/${encodeURIComponent(slug)}`,
      isDomainKey || !isrTags
        ? { cache: 'no-store' }
        : { next: { revalidate: 60, tags: isrTags } },
    );
    if (!res.ok) return null;
    return (await res.json()) as PublicLandingPayload;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}): Promise<Metadata> {
  const { slug } = await Promise.resolve(params);
  const data = await fetchPublic(slug);
  if (!data) {
    return { title: 'Landing page', robots: { index: false, follow: false } };
  }
  const title = data.seo.title || data.name;
  const description = data.seo.description || '';
  const indexable = data.seo.robotsIndex !== false;
  const requestHeaders = await headers();
  const host = (requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '').split(',')[0]!.trim();
  const protocol = requestHeaders.get('x-forwarded-proto')?.split(',')[0]?.trim() === 'https' ? 'https' : 'http';
  let metadataBase: URL | undefined;
  if (/^[a-z0-9.[\]:-]+$/i.test(host)) {
    try { metadataBase = new URL(`${protocol}://${host}`); } catch { /* malformed host */ }
  }
  return {
    metadataBase,
    title,
    description,
    alternates: data.seo.canonical ? { canonical: data.seo.canonical } : undefined,
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: 'website',
      ...(data.seo.ogImage ? { images: [{ url: data.seo.ogImage }] } : {}),
    },
    twitter: {
      card: data.seo.ogImage ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(data.seo.ogImage ? { images: [data.seo.ogImage] } : {}),
    },
  };
}

/**
 * Public landing page — Server Component (ISR).
 * Apex /p/:slug — cache gắn tag theo org/page từ cache-scope API (xem LANDING_PAGE_APEX_SLUG_AMBIGUITY_NOTE).
 */
export default async function PublicLandingPage({
  params,
}: {
  params: Promise<{ slug: string }> | { slug: string };
}) {
  const { slug } = await Promise.resolve(params);
  const data = await fetchPublic(slug);
  if (!data) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: data.seo.title || data.name,
    description: data.seo.description || undefined,
    url: data.seo.canonical || undefined,
  };

  return (
    <>
      <JsonLdScript data={jsonLd} />
      <PublicLandingPageClient initial={data} />
    </>
  );
}