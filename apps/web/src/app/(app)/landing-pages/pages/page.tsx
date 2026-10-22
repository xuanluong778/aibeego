'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { apiClient } from '@/lib/api-client';
import { useT } from '@/i18n/i18n-provider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type PageRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  theme: string;
  updatedAt: string;
  publicPath: string;
};

type StatusFilter = 'ALL' | 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';

const FILTERS: StatusFilter[] = ['ALL', 'PUBLISHED', 'DRAFT', 'ARCHIVED'];

function normalizeStatus(raw: string | null): StatusFilter {
  const v = (raw || '').toUpperCase();
  if (v === 'PUBLISHED' || v === 'DRAFT' || v === 'ARCHIVED' || v === 'ALL') return v;
  return 'ALL';
}

function LandingPagesListInner() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = useMemo(
    () => normalizeStatus(searchParams.get('status')),
    [searchParams],
  );
  const [items, setItems] = useState<PageRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q =
        status === 'ALL'
          ? '/landing-pages'
          : `/landing-pages?status=${encodeURIComponent(status)}`;
      const res = await apiClient<{ items: PageRow[] }>(q);
      setItems(Array.isArray(res?.items) ? res.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function act(id: string, action: 'duplicate' | 'archive' | 'unpublish') {
    await apiClient(`/landing-pages/${id}/${action}`, { method: 'POST', body: '{}' });
    await reload();
  }

  function setFilter(next: StatusFilter) {
    const url =
      next === 'ALL' ? '/landing-pages/pages' : `/landing-pages/pages?status=${next}`;
    router.push(url);
  }

  const filterLabel = (f: StatusFilter) => {
    if (f === 'ALL') return t('landingPages.filterAll');
    if (f === 'PUBLISHED') return t('landingPages.statPublished');
    if (f === 'DRAFT') return t('landingPages.statDraft');
    return t('landingPages.filterArchived');
  };

  return (
    <div>
      <PageHeader title={t('landingPages.myPages')} description={t('landingPages.myPagesDesc')} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button asChild>
          <Link href="/landing-pages/create">{t('landingPages.create')}</Link>
        </Button>
        <div
          className="flex flex-wrap gap-1 rounded-lg border border-white/10 p-0.5"
          data-lp-pages-status-filters
        >
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              data-lp-pages-status={f}
              data-active={status === f ? '1' : '0'}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-xs font-medium transition',
                status === f
                  ? 'bg-[#F97316] text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white',
              )}
            >
              {filterLabel(f)}
            </button>
          ))}
        </div>
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {loading ? <p className="text-sm opacity-60">{t('common.loading')}</p> : null}
      {!loading ? (
        <div className="space-y-2" data-lp-pages-list data-lp-pages-filter={status}>
          {items.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2"
            >
              <div>
                <div className="font-medium">{p.name || t('landingPages.untitled')}</div>
                <div className="text-xs opacity-60">
                  {p.status} · {p.theme} · /{p.slug}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <Link className="underline" href={`/landing-pages/builder/${p.id}`}>
                  Builder
                </Link>
                {p.status === 'PUBLISHED' ? (
                  <a className="underline" href={p.publicPath} target="_blank" rel="noreferrer">
                    Public
                  </a>
                ) : null}
                <button type="button" className="underline" onClick={() => void act(p.id, 'duplicate')}>
                  Duplicate
                </button>
                {p.status === 'PUBLISHED' ? (
                  <button
                    type="button"
                    className="underline"
                    onClick={() => void act(p.id, 'unpublish')}
                  >
                    Unpublish
                  </button>
                ) : null}
                {p.status !== 'ARCHIVED' ? (
                  <button
                    type="button"
                    className="underline text-red-300"
                    onClick={() => void act(p.id, 'archive')}
                  >
                    Archive
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {!items.length ? (
            <p className="text-sm opacity-60">{t('landingPages.empty')}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function LandingPagesListPage() {
  return (
    <Suspense fallback={<p className="text-sm opacity-60">Loading…</p>}>
      <LandingPagesListInner />
    </Suspense>
  );
}
