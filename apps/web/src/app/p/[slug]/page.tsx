import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import {
  PublicLandingPageClient,
  type PublicLandingPayload,
} from '@/components/landing-pages/public-landing-page-client';
import { landingPagePublicApiBase } from '@/lib/landing-page-public-api';

export const revalidate = 60;

async function fetchPublic(slug: string): Promise<PublicLandingPayload | null> {
  try {
    const res = await fetch(
      `${landingPagePublicApiBase()}/api/v1/landing-pages/public/${encodeURIComponent(slug)}`,
      (slug.startsWith('lp-domain-') || slug.startsWith('lp-platform-'))
        ? { cache: 'no-store' }
        : { next: { revalidate: 60, tags: [`lp-public-${slug}`] } },
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
  // Relative library assets must resolve on the public origin, not Next's internal :3000.
  const requestHeaders = await headers();
  const host = (requestHeaders.get('x-forwarded-host') || requestHeaders.get('host') || '').split(',')[0]!.trim();
  const protocol = requestHeaders.get('x-forwarded-proto')?.split(',')[0]?.trim() === 'https' ? 'https' : 'http';
  let metadataBase: URL | undefined;
  if (/^[a-z0-9.[\]:-]+$/i.test(host)) {
    try { metadataBase = new URL(`${protocol}://${host}`); } catch { /* Keep framework fallback for malformed hosts. */ }
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
 * Public landing page — Server Component (SSR/ISR).
 * SEO meta via generateMetadata; interactive shell is a thin client child.
 * Does not import builder/sidebar/free-drag modules.
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PublicLandingPageClient initial={data} />
    </>
  );
}
