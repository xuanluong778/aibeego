'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { apiClient } from '@/lib/api-client';
import { useT } from '@/i18n/i18n-provider';
import { Button } from '@/components/ui/button';
import { TemplateHoverPreview } from '@/components/landing-pages/template-hover-preview';
import { TemplateFullscreenPreview } from '@/components/landing-pages/template-fullscreen-preview';
import type { TemplateViewport } from '@/components/landing-pages/template-viewport-switcher';
import type { LandingPageSpec } from '@marketingspa/shared';
import {
  LANDING_PAGE_CATEGORIES,
  LANDING_PAGE_TEMPLATE_CATALOG_VERSION,
} from '@marketingspa/shared';

type TemplateBadge = 'new' | 'popular' | 'high_conversion';

type Template = {
  id: string;
  slug: string;
  name: string;
  category: string;
  theme: string;
  description: string;
  tags: string[];
  thumbnailUrl?: string | null;
  previewLongImage?: string | null;
  badges?: TemplateBadge[];
  designFamily?: string | null;
  conversionGoal?: string | null;
  architectureId?: string | null;
  isSystem: boolean;
};

const PAGE_SIZE = 12;

const BADGE_LABEL: Record<TemplateBadge, string> = {
  new: 'Mới',
  popular: 'Phổ biến',
  high_conversion: 'Tỉ lệ chuyển đổi cao',
};

const BADGE_CLASS: Record<TemplateBadge, string> = {
  new: 'bg-sky-500/90 text-white',
  popular: 'bg-amber-500/90 text-white',
  high_conversion: 'bg-emerald-600/90 text-white',
};

const FAMILY_LABEL: Record<string, string> = {
  editorial: 'Editorial',
  minimal: 'Minimal',
  luxury: 'Luxury',
  bold: 'Bold',
  organic: 'Organic',
  corporate: 'Corporate',
  conversion: 'Conversion',
  portfolio: 'Portfolio',
  local: 'Local',
  product: 'Product',
};

const GOAL_LABEL: Record<string, string> = {
  lead: 'Lead',
  booking: 'Booking',
  purchase: 'Purchase',
  signup: 'Signup',
  download: 'Download',
  contact: 'Contact',
};

function withCatalogCacheBust(path: string) {
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}v=${encodeURIComponent(LANDING_PAGE_TEMPLATE_CATALOG_VERSION)}`;
}

function imagePaths(slug: string, thumb?: string | null, long?: string | null) {
  const fallbackThumb = `/landing-pages/templates/${slug}-thumb.webp`;
  const fallbackLong = `/landing-pages/templates/${slug}-long.webp`;
  return {
    thumbnail: withCatalogCacheBust(thumb || fallbackThumb),
    previewLongImage: withCatalogCacheBust(long || fallbackLong),
  };
}

function parseBadges(t: Template): TemplateBadge[] {
  if (t.badges?.length) return t.badges;
  const fromTags = (t.tags || [])
    .filter((x) => x.startsWith('badge:'))
    .map((x) => x.slice(6))
    .filter((b): b is TemplateBadge => b === 'new' || b === 'popular' || b === 'high_conversion');
  return fromTags;
}

function usePrefersHover() {
  const [ok, setOk] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    const apply = () => setOk(mq.matches);
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);
  return ok;
}

export default function LandingPagesTemplatesPage() {
  const t = useT();
  const router = useRouter();
  const hoverOk = usePrefersHover();
  const [items, setItems] = useState<Template[]>([]);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);
  const [previewSpec, setPreviewSpec] = useState<LandingPageSpec | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [viewport, setViewport] = useState<TemplateViewport>('desktop');
  const [using, setUsing] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (search.trim()) params.set('q', search.trim());
    const q = params.toString() ? `?${params.toString()}` : '';
    void apiClient<{ items: Template[] }>(`/landing-pages/templates${q}`)
      .then((r) => {
        setItems(r.items);
        setPage(1);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, [category, search]);

  const openPreview = useCallback(async (slug: string) => {
    setPreviewSlug(slug);
    setViewport('desktop');
    setPreviewSpec(null);
    setPreviewLoading(true);
    try {
      const row = await apiClient<{ definition: LandingPageSpec; slug: string }>(
        `/landing-pages/templates/${encodeURIComponent(slug)}`,
      );
      setPreviewSpec(row.definition);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được preview');
      setPreviewSlug(null);
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  async function useTemplate(slug: string, name: string) {
    setUsing(true);
    try {
      const pageRow = await apiClient<{ id: string }>('/landing-pages', {
        method: 'POST',
        body: JSON.stringify({ name, templateSlug: slug }),
      });
      router.push(`/landing-pages/builder/${pageRow.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tạo được trang');
      setUsing(false);
    }
  }

  const categories = useMemo(() => {
    const present = new Set(items.map((i) => i.category));
    return LANDING_PAGE_CATEGORIES.filter((c) => present.has(c));
  }, [items]);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const previewMeta = items.find((i) => i.slug === previewSlug);

  return (
    <div>
      <PageHeader
        title={t('landingPages.templates')}
        description="Chọn mẫu theo ngành — hover xem nhanh, Xem trước full màn hình như builder."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2" data-lp-template-search>
        <input
          type="search"
          value={searchDraft}
          placeholder="Tìm mẫu theo tên, mô tả, tag…"
          className="min-w-[200px] flex-1 rounded-md border border-white/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-[#F97316]/60"
          onChange={(e) => setSearchDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setSearch(searchDraft.trim());
          }}
        />
        <Button size="sm" variant="outline" onClick={() => setSearch(searchDraft.trim())}>
          Tìm
        </Button>
        {search || category ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSearch('');
              setSearchDraft('');
              setCategory('');
            }}
          >
            Xóa lọc
          </Button>
        ) : null}
      </div>

      <div className="mb-5 flex flex-wrap gap-2" data-lp-template-categories>
        <Button size="sm" variant={category === '' ? 'default' : 'outline'} onClick={() => setCategory('')}>
          Tất cả
        </Button>
        {(category ? LANDING_PAGE_CATEGORIES : categories).map((c) => (
          <Button
            key={c}
            size="sm"
            variant={category === c ? 'default' : 'outline'}
            onClick={() => setCategory(c)}
          >
            {c}
          </Button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs opacity-60">
        <span>
          {loading ? 'Đang tải…' : `${items.length} mẫu`}
          {category ? ` · ${category}` : ' · mọi category'}
        </span>
        <span className="hidden sm:inline">
          {hoverOk ? 'Rê chuột vào ảnh để xem toàn trang' : 'Chạm Xem trước để xem đầy đủ trên mobile'}
        </span>
      </div>

      {error ? <p className="mb-3 text-sm text-red-300">{error}</p> : null}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
              <div className="aspect-[16/10] animate-pulse bg-white/10" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
                <div className="h-3 w-full animate-pulse rounded bg-white/5" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pageItems.map((tpl) => {
            const imgs = imagePaths(tpl.slug, tpl.thumbnailUrl, tpl.previewLongImage);
            const badges = parseBadges(tpl);
            const family = tpl.designFamily || '';
            const goal = tpl.conversionGoal || '';
            return (
              <article
                key={tpl.id}
                className="group flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] shadow-sm transition hover:border-white/25 hover:bg-white/[0.05]"
              >
                <div className="relative">
                  <TemplateHoverPreview
                    thumbnail={imgs.thumbnail}
                    previewLongImage={imgs.previewLongImage}
                    alt={tpl.name}
                    enableHoverScroll={hoverOk}
                  />
                  <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                    {badges.map((b) => (
                      <span
                        key={b}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${BADGE_CLASS[b]}`}
                      >
                        {BADGE_LABEL[b]}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-wide opacity-50">
                    {tpl.category}
                    {family ? ` · ${FAMILY_LABEL[family] || family}` : ''}
                    {goal ? ` · ${GOAL_LABEL[goal] || goal}` : ''}
                  </div>
                  <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug">{tpl.name}</h3>
                  <p className="mt-1.5 line-clamp-2 flex-1 text-xs leading-relaxed opacity-65">
                    {tpl.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => void openPreview(tpl.slug)}>
                      Xem trước
                    </Button>
                    <Button
                      size="sm"
                      disabled={using}
                      data-lp-use-template
                      onClick={() => void useTemplate(tpl.slug, tpl.name)}
                    >
                      Sử dụng mẫu
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Trước
          </Button>
          <span className="text-xs opacity-60">
            Trang {page}/{totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Sau
          </Button>
        </div>
      ) : null}

      <TemplateFullscreenPreview
        open={Boolean(previewSlug)}
        title={previewMeta?.name || previewSlug || 'Template'}
        subtitle={[previewMeta?.designFamily, previewMeta?.conversionGoal, previewMeta?.description]
          .filter(Boolean)
          .join(' · ')}
        spec={previewSpec}
        loading={previewLoading}
        viewport={viewport}
        onViewportChange={setViewport}
        onClose={() => {
          setPreviewSlug(null);
          setPreviewSpec(null);
        }}
        onUseTemplate={() => {
          if (!previewSlug) return;
          void useTemplate(previewSlug, previewMeta?.name || previewSlug);
        }}
        using={using}
      />
    </div>
  );
}
