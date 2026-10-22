'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, Sparkles, Globe2, LayoutTemplate, ArrowRight, CheckCircle2, FilePlus2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { apiClient } from '@/lib/api-client';
import { useT } from '@/i18n/i18n-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  applyLandingPageAiCopyToSpec,
  createEmptyLandingPageSpec,
  markLandingPageAiSources,
  type LandingPageAiCopy,
} from '@marketingspa/shared';

type CreateMode = 'ai' | 'url' | 'template' | 'blank';

type Template = {
  id: string;
  slug: string;
  name: string;
  category: string;
  theme: string;
  description: string;
};

type PageGoal = 'lead' | 'sales' | 'signup' | 'consult' | 'event';
type Tone = 'professional' | 'bold' | 'friendly';

const PAGE_GOALS: { value: PageGoal; label: string; hint: string }[] = [
  { value: 'lead', label: 'Thu lead', hint: 'Thu thập thông tin khách' },
  { value: 'sales', label: 'Bán hàng', hint: 'Chốt mua / báo giá' },
  { value: 'signup', label: 'Đăng ký', hint: 'Đăng ký dùng thử / tài khoản' },
  { value: 'consult', label: 'Tư vấn', hint: 'Đặt lịch tư vấn' },
  { value: 'event', label: 'Sự kiện', hint: 'Webinar / workshop' },
];

const TONES: { value: Tone; label: string }[] = [
  { value: 'professional', label: 'Chuyên nghiệp' },
  { value: 'bold', label: 'Mạnh' },
  { value: 'friendly', label: 'Thân thiện' },
];

const MODES: {
  id: CreateMode;
  title: string;
  desc: string;
  icon: typeof Sparkles;
}[] = [
  {
    id: 'ai',
    title: 'Tạo nhanh bằng AI',
    desc: 'Trả lời vài câu — AI dựng sẵn toàn bộ landing page',
    icon: Sparkles,
  },
  {
    id: 'template',
    title: 'Chọn Template',
    desc: 'Bắt đầu từ mẫu sẵn, chỉnh trong Builder',
    icon: LayoutTemplate,
  },
  {
    id: 'url',
    title: 'Tạo từ Website/URL',
    desc: 'Dán link website — AI đọc nội dung công khai và dựng trang',
    icon: Globe2,
  },
  {
    id: 'blank',
    title: 'Trang trống',
    desc: 'Draft trống — tự thêm block trong Builder',
    icon: FilePlus2,
  },
];

export default function LandingPagesCreatePage() {
  const t = useT();
  const router = useRouter();
  const submitLock = useRef(false);

  const [mode, setMode] = useState<CreateMode>('ai');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateSlug, setTemplateSlug] = useState('');
  const [tplFilter, setTplFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'previewing' | 'creating' | 'generating' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [aiPreview, setAiPreview] = useState<{
    copy: LandingPageAiCopy;
    source: string;
    warning?: string;
  } | null>(null);
  const [ctaHint, setCtaHint] = useState('');
  const [tone, setTone] = useState<Tone>('professional');
  const [blankName, setBlankName] = useState('Landing Page mới');

  const [productService, setProductService] = useState('');
  const [brandName, setBrandName] = useState('');
  const [targetCustomer, setTargetCustomer] = useState('');
  const [pageGoal, setPageGoal] = useState<PageGoal>('lead');
  const [extraNotes, setExtraNotes] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [useBizProfile, setUseBizProfile] = useState(true);
  const [urlSummary, setUrlSummary] = useState<{
    brand?: string | null;
    title?: string;
    description?: string | null;
    productService?: string | null;
    benefits?: string[];
    usp?: string | null;
    contact?: { phone?: string | null; email?: string | null };
    faq?: Array<{ question: string; answer: string }>;
    cta?: string | null;
    imageUrl?: string | null;
    logoUrl?: string | null;
    finalUrl?: string;
  } | null>(null);
  const [crawling, setCrawling] = useState(false);
  const [bizProfile, setBizProfile] = useState<{
    brandName?: string | null;
    productService?: string | null;
    targetCustomer?: string | null;
    usp?: string | null;
    website?: string | null;
    isEmpty?: boolean;
  } | null>(null);

  useEffect(() => {
    void apiClient<{ items: Template[] }>('/landing-pages/templates')
      .then((r) => setTemplates(r.items))
      .catch(() => {
        /* templates optional until mode=template */
      });
    void apiClient<{
      brandName?: string | null;
      productService?: string | null;
      targetCustomer?: string | null;
      usp?: string | null;
      website?: string | null;
      isEmpty?: boolean;
    }>('/landing-pages/business-profile')
      .then((p) => {
        setBizProfile(p);
        if (!p.isEmpty) {
          if (p.brandName) setBrandName(p.brandName);
          if (p.productService) setProductService(p.productService);
          if (p.targetCustomer) setTargetCustomer(p.targetCustomer);
          if (p.usp) setExtraNotes(p.usp);
          if (p.website) setSourceUrl(p.website);
        }
      })
      .catch(() => setBizProfile(null));
  }, []);

  function fillFromBusinessProfile() {
    if (!bizProfile || bizProfile.isEmpty) {
      setError('Chưa có Business Profile — vào Settings hoặc PATCH /landing-pages/business-profile');
      return;
    }
    if (bizProfile.brandName) setBrandName(bizProfile.brandName);
    if (bizProfile.productService) setProductService(bizProfile.productService);
    if (bizProfile.targetCustomer) setTargetCustomer(bizProfile.targetCustomer);
    if (bizProfile.usp) setExtraNotes(bizProfile.usp);
    if (bizProfile.website) setSourceUrl(bizProfile.website);
    setUseBizProfile(true);
    setNote('Đã điền từ Business Profile (có thể chỉnh trước khi tạo).');
  }
  const aiReady =
    productService.trim().length > 0 &&
    brandName.trim().length > 0 &&
    targetCustomer.trim().length > 0;

  const urlReady = /^https?:\/\//i.test(sourceUrl.trim()) && targetCustomer.trim().length > 0;

  async function analyzeUrl() {
    const url = sourceUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      setError('URL phải bắt đầu bằng http:// hoặc https://');
      return;
    }
    setCrawling(true);
    setError(null);
    setUrlSummary(null);
    try {
      const res = await apiClient<{ summary: NonNullable<typeof urlSummary> }>('/landing-pages/crawl-url', {
        method: 'POST',
        body: JSON.stringify({ url }),
      });
      setUrlSummary(res.summary);
      if (res.summary.brand && !brandName.trim()) setBrandName(res.summary.brand);
      if (res.summary.productService && !productService.trim()) {
        setProductService(res.summary.productService);
      }
      if (res.summary.usp) setExtraNotes(res.summary.usp);
      setNote('Đã phân tích URL — xem tóm tắt bên dưới, rồi Generate.');
    } catch (e) {
      setUrlSummary(null);
      setError(e instanceof Error ? e.message : 'Không phân tích được URL (SSRF/timeout/invalid)');
    } finally {
      setCrawling(false);
    }
  }

  const filteredTemplates = templates.filter((tpl) => {
    if (!tplFilter.trim()) return true;
    const q = tplFilter.toLowerCase();
    return (
      tpl.name.toLowerCase().includes(q) ||
      tpl.category.toLowerCase().includes(q) ||
      tpl.theme.toLowerCase().includes(q)
    );
  });

  async function previewAi(opts: {
    productService: string;
    brandName: string;
    targetCustomer: string;
    pageGoal: PageGoal;
    extraNotes?: string;
    sourceUrl?: string;
  }) {
    if (submitLock.current) return;
    submitLock.current = true;
    setBusy(true);
    setError(null);
    setNote(null);
    setAiPreview(null);
    setPhase('previewing');
    try {
      const gen = await apiClient<{
        copy: LandingPageAiCopy;
        source: string;
        warning?: string;
        page?: { id: string };
      }>('/landing-pages/generate', {
        method: 'POST',
        body: JSON.stringify({
          productService: opts.productService,
          brandName: opts.brandName,
          targetCustomer: opts.targetCustomer,
          pageGoal: opts.pageGoal,
          tone,
          extraNotes: [opts.extraNotes, ctaHint.trim() ? `CTA: ${ctaHint.trim()}` : '']
            .filter(Boolean)
            .join('\n') || undefined,
          sourceUrl: opts.sourceUrl || undefined,
          // Preview: no landingPageId — do not create/overwrite draft yet
          useBusinessProfile: useBizProfile,
          businessType: opts.productService,
          offer: opts.extraNotes?.slice(0, 200),
        }),
      });
      if (gen.page?.id) {
        setError('Preview không được ghi draft — thử lại.');
        setPhase('idle');
        return;
      }
      setAiPreview({ copy: gen.copy, source: gen.source, warning: gen.warning });
      setNote(gen.warning || `Preview sẵn (${gen.source}) — xác nhận rồi tạo bản nháp.`);
      setPhase('idle');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview AI thất bại');
      setPhase('idle');
    } finally {
      setBusy(false);
      submitLock.current = false;
    }
  }

  async function createDraftFromPreview() {
    if (!aiPreview || submitLock.current) return;
    submitLock.current = true;
    setBusy(true);
    setError(null);
    setPhase('creating');
    const idempotencyKey =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `lp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      const pageName =
        (brandName || productService || aiPreview.copy.seoTitle || 'Landing Page mới').slice(0, 120);
      const page = await apiClient<{ id: string }>('/landing-pages', {
        method: 'POST',
        body: JSON.stringify({ name: pageName, idempotencyKey }),
      });
      setPhase('generating');
      const draftSpec = markLandingPageAiSources(
        applyLandingPageAiCopyToSpec(createEmptyLandingPageSpec(), aiPreview.copy),
      );
      await apiClient(`/landing-pages/${page.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          draftSpec,
          name: pageName,
          seoTitle: draftSpec.seo.title.slice(0, 200),
          seoDescription: draftSpec.seo.metaDescription.slice(0, 500),
        }),
      });
      setPhase('done');
      setNote('Đã tạo bản nháp (chưa Publish) — mở Builder.');
      router.push(`/landing-pages/builder/${page.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tạo bản nháp thất bại');
      setPhase('idle');
      setBusy(false);
      submitLock.current = false;
    }
  }

  async function createBlankDraft() {
    if (submitLock.current) return;
    submitLock.current = true;
    setBusy(true);
    setError(null);
    setPhase('creating');
    const idempotencyKey =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `lp-blank-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      const page = await apiClient<{ id: string }>('/landing-pages', {
        method: 'POST',
        body: JSON.stringify({
          name: (blankName.trim() || 'Landing Page mới').slice(0, 120),
          idempotencyKey,
        }),
      });
      setPhase('done');
      router.push(`/landing-pages/builder/${page.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tạo trang trống thất bại');
      setPhase('idle');
      setBusy(false);
      submitLock.current = false;
    }
  }

  /** @deprecated kept for URL path that already has summary — still goes preview-first */
  async function runAiCreate(opts: {
    productService: string;
    brandName: string;
    targetCustomer: string;
    pageGoal: PageGoal;
    extraNotes?: string;
    sourceUrl?: string;
  }) {
    await previewAi(opts);
  }

  async function createFromTemplate() {
    if (submitLock.current || !templateSlug) return;
    submitLock.current = true;
    setBusy(true);
    setError(null);
    setPhase('creating');
    const idempotencyKey =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `lp-tpl-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      const tpl = templates.find((x) => x.slug === templateSlug);
      const page = await apiClient<{ id: string }>('/landing-pages', {
        method: 'POST',
        body: JSON.stringify({
          name: tpl?.name || 'Landing Page mới',
          templateSlug,
          idempotencyKey,
        }),
      });
      setPhase('done');
      router.push(`/landing-pages/builder/${page.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tạo từ template thất bại');
      setPhase('idle');
      setBusy(false);
      submitLock.current = false;
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t('landingPages.create')}
        description="AI · Template · URL · Trang trống → Preview → Tạo bản nháp → Builder."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-lp-create-modes>
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              disabled={busy}
              onClick={() => {
                setMode(m.id);
                setError(null);
                setAiPreview(null);
              }}
              className={`rounded-xl border p-4 text-left transition ${
                active
                  ? 'border-orange-400/60 bg-white/10 shadow-[0_0_0_1px_rgba(249,115,22,0.25)]'
                  : 'border-white/10 bg-black/20 hover:border-white/25'
              } ${busy ? 'opacity-60' : ''}`}
            >
              <Icon className={`mb-2 h-5 w-5 ${active ? 'text-orange-400' : 'opacity-70'}`} />
              <div className="text-sm font-semibold">{m.title}</div>
              <p className="mt-1 text-xs leading-relaxed opacity-65">{m.desc}</p>
            </button>
          );
        })}
      </div>

      {mode === 'ai' ? (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-orange-500/15 p-2">
              <Sparkles className="h-4 w-4 text-orange-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold">Tạo Landing Page bằng AI</h2>
              <p className="mt-0.5 text-sm opacity-65">
                Preview trước → tạo bản nháp (không Publish) → mở Builder.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || !bizProfile || bizProfile.isEmpty}
                  onClick={fillFromBusinessProfile}
                >
                  ✨ Dùng thông tin doanh nghiệp
                </Button>
                <label className="flex items-center gap-1.5 text-xs opacity-70">
                  <input
                    type="checkbox"
                    checked={useBizProfile}
                    onChange={(e) => setUseBizProfile(e.target.checked)}
                    disabled={busy}
                  />
                  Gắn Business Profile vào AI
                </label>
                {bizProfile && !bizProfile.isEmpty ? (
                  <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-200">
                    Có Business Profile
                  </span>
                ) : (
                  <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] opacity-60">
                    Profile trống / thiếu
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Sản phẩm / dịch vụ là gì?</Label>
              <Input
                className="mt-1"
                placeholder="VD: Dịch vụ SEO tổng thể cho doanh nghiệp"
                value={productService}
                onChange={(e) => setProductService(e.target.value)}
                disabled={busy}
              />
            </div>
            <div>
              <Label>Tên thương hiệu</Label>
              <Input
                className="mt-1"
                placeholder="VD: Marketing Auto AZ"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                disabled={busy}
              />
            </div>
            <div>
              <Label>Khách hàng mục tiêu</Label>
              <Input
                className="mt-1"
                placeholder="VD: Chủ spa muốn tăng booking"
                value={targetCustomer}
                onChange={(e) => setTargetCustomer(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Mục tiêu trang</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {PAGE_GOALS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    disabled={busy}
                    onClick={() => setPageGoal(g.value)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                      pageGoal === g.value
                        ? 'border-orange-400/50 bg-orange-500/15'
                        : 'border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="font-medium">{g.label}</div>
                    <div className="text-[11px] opacity-55">{g.hint}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label>CTA mong muốn (tuỳ chọn)</Label>
              <Input
                className="mt-1"
                placeholder="VD: Đăng ký tư vấn miễn phí"
                value={ctaHint}
                onChange={(e) => setCtaHint(e.target.value)}
                disabled={busy}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Tone</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {TONES.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    disabled={busy}
                    onClick={() => setTone(g.value)}
                    className={`rounded-lg border px-3 py-1.5 text-sm ${
                      tone === g.value
                        ? 'border-orange-400/50 bg-orange-500/15'
                        : 'border-white/10 hover:border-white/25'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            className="text-xs opacity-60 underline-offset-2 hover:underline"
            onClick={() => setShowAdvanced((v) => !v)}
            disabled={busy}
          >
            {showAdvanced ? 'Ẩn thông tin bổ sung' : 'Thêm ghi chú hoặc URL (tuỳ chọn)'}
          </button>

          {showAdvanced ? (
            <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
              <div>
                <Label>Thông tin bổ sung</Label>
                <Textarea
                  className="mt-1"
                  rows={3}
                  placeholder="USP, ưu đãi, đối thủ…"
                  value={extraNotes}
                  onChange={(e) => setExtraNotes(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div>
                <Label>URL tham khảo (tuỳ chọn)</Label>
                <Input
                  className="mt-1"
                  placeholder="https://…"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  disabled={busy}
                />
              </div>
            </div>
          ) : null}

          {aiPreview ? (
            <div
              className="space-y-2 rounded-xl border border-orange-400/30 bg-orange-500/10 p-4 text-sm"
              data-lp-create-preview
            >
              <div className="font-semibold text-orange-100">Preview AI (chưa tạo draft)</div>
              <p>
                <span className="opacity-60">Headline:</span> {aiPreview.copy.headline}
              </p>
              <p>
                <span className="opacity-60">Sub:</span> {aiPreview.copy.subheadline}
              </p>
              <p>
                <span className="opacity-60">CTA:</span> {aiPreview.copy.cta}
              </p>
              {aiPreview.copy.benefits?.length ? (
                <ul className="list-disc pl-5 opacity-90">
                  {aiPreview.copy.benefits.slice(0, 4).map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : null}
              <p className="text-xs opacity-55">Nguồn: {aiPreview.source} · không tự Publish</p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              className="sm:w-auto"
              size="lg"
              disabled={busy || !aiReady}
              data-lp-create-preview-btn
              onClick={() =>
                void previewAi({
                  productService: productService.trim(),
                  brandName: brandName.trim(),
                  targetCustomer: targetCustomer.trim(),
                  pageGoal,
                  extraNotes: extraNotes.trim() || undefined,
                  sourceUrl: sourceUrl.trim() || undefined,
                })
              }
            >
              {busy && phase === 'previewing' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang tạo preview…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Xem trước AI
                </>
              )}
            </Button>
            <Button
              size="lg"
              variant="outline"
              disabled={busy || !aiPreview}
              data-lp-create-draft-btn
              onClick={() => void createDraftFromPreview()}
            >
              {busy && (phase === 'creating' || phase === 'generating') ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang tạo bản nháp…
                </>
              ) : (
                <>
                  Tạo bản nháp → Builder
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </section>
      ) : null}

      {mode === 'url' ? (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-sky-500/15 p-2">
              <Globe2 className="h-4 w-4 text-sky-300" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Tạo từ Website / URL</h2>
              <p className="mt-0.5 text-sm opacity-65">
                Dán URL công khai. Hệ thống đọc an toàn (SSRF-safe) rồi AI dựng landing page.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>URL website</Label>
              <Input
                className="mt-1"
                placeholder="https://example.com"
                value={sourceUrl}
                onChange={(e) => {
                  setSourceUrl(e.target.value);
                  setUrlSummary(null);
                }}
                disabled={busy || crawling}
              />
            </div>
            <div>
              <Label>Tên thương hiệu (tuỳ chọn)</Label>
              <Input
                className="mt-1"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                disabled={busy || crawling}
              />
            </div>
            <div>
              <Label>Khách hàng mục tiêu</Label>
              <Input
                className="mt-1"
                placeholder="Ai sẽ vào trang này?"
                value={targetCustomer}
                onChange={(e) => setTargetCustomer(e.target.value)}
                disabled={busy || crawling}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Mục tiêu trang</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {PAGE_GOALS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    disabled={busy || crawling}
                    onClick={() => setPageGoal(g.value)}
                    className={`rounded-lg border px-3 py-1.5 text-sm ${
                      pageGoal === g.value
                        ? 'border-sky-400/50 bg-sky-500/15'
                        : 'border-white/10'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy || crawling || !/^https?:\/\//i.test(sourceUrl.trim())}
              onClick={() => void analyzeUrl()}
            >
              {crawling ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang phân tích URL…
                </>
              ) : (
                'Phân tích URL'
              )}
            </Button>
          </div>

          {urlSummary ? (
            <div className="space-y-2 rounded-xl border border-sky-400/30 bg-sky-500/10 p-4 text-sm">
              <div className="font-semibold text-sky-100">Tóm tắt từ website (xem trước Generate)</div>
              <p>
                <span className="opacity-60">Title:</span> {urlSummary.title}
              </p>
              {urlSummary.brand ? (
                <p>
                  <span className="opacity-60">Brand:</span> {urlSummary.brand}
                </p>
              ) : null}
              {urlSummary.description ? (
                <p className="opacity-90">{urlSummary.description}</p>
              ) : null}
              {urlSummary.usp ? (
                <p>
                  <span className="opacity-60">USP:</span> {urlSummary.usp}
                </p>
              ) : null}
              {urlSummary.benefits && urlSummary.benefits.length ? (
                <ul className="list-disc pl-5 opacity-90">
                  {urlSummary.benefits.slice(0, 5).map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : null}
              {urlSummary.cta ? (
                <p>
                  <span className="opacity-60">CTA:</span> {urlSummary.cta}
                </p>
              ) : null}
              {(urlSummary.contact?.phone || urlSummary.contact?.email) && (
                <p className="opacity-80">
                  Contact: {[urlSummary.contact.phone, urlSummary.contact.email].filter(Boolean).join(' · ')}
                </p>
              )}
              {urlSummary.faq && urlSummary.faq.length ? (
                <p className="opacity-70">FAQ phát hiện: {urlSummary.faq.length} mục</p>
              ) : null}
              {(urlSummary.logoUrl || urlSummary.imageUrl) && (
                <p className="truncate text-xs opacity-60">
                  Ảnh: {urlSummary.logoUrl || urlSummary.imageUrl}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs opacity-55">
              Bắt buộc Phân tích URL trước khi Generate — chỉ lấy dữ liệu public, SSRF-safe.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              size="lg"
              disabled={busy || crawling || !urlReady || !urlSummary}
              data-lp-create-preview-btn
              onClick={() => {
                const host = (() => {
                  try {
                    return new URL(sourceUrl.trim()).hostname.replace(/^www\./, '');
                  } catch {
                    return 'Website';
                  }
                })();
                const notesFromSummary = [
                  urlSummary?.description,
                  urlSummary?.benefits?.length
                    ? `Benefits: ${urlSummary.benefits.join('; ')}`
                    : '',
                  urlSummary?.cta ? `CTA: ${urlSummary.cta}` : '',
                  extraNotes.trim(),
                ]
                  .filter(Boolean)
                  .join('\n');
                void previewAi({
                  productService:
                    productService.trim() ||
                    urlSummary?.productService ||
                    brandName.trim() ||
                    host,
                  brandName: brandName.trim() || urlSummary?.brand || host,
                  targetCustomer: targetCustomer.trim(),
                  pageGoal,
                  sourceUrl: sourceUrl.trim(),
                  extraNotes: notesFromSummary || undefined,
                });
              }}
            >
              {busy && phase === 'previewing' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang Preview…
                </>
              ) : (
                <>
                  Xem trước từ URL
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
            <Button
              size="lg"
              variant="outline"
              disabled={busy || !aiPreview}
              data-lp-create-draft-btn
              onClick={() => void createDraftFromPreview()}
            >
              Tạo bản nháp → Builder
            </Button>
          </div>
          {aiPreview && mode === 'url' ? (
            <div className="rounded-xl border border-sky-400/30 bg-sky-500/10 p-3 text-sm" data-lp-create-preview>
              <div className="font-semibold">Preview: {aiPreview.copy.headline}</div>
              <p className="opacity-80">{aiPreview.copy.subheadline}</p>
              <p className="text-xs opacity-55">CTA: {aiPreview.copy.cta}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {mode === 'blank' ? (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-5 sm:p-6" data-lp-create-blank>
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-white/10 p-2">
              <FilePlus2 className="h-4 w-4 opacity-80" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Trang trống</h2>
              <p className="mt-0.5 text-sm opacity-65">
                Tạo draft rỗng — thêm section trong Builder. Không gọi AI, không Publish.
              </p>
            </div>
          </div>
          <div>
            <Label>Tên trang</Label>
            <Input
              className="mt-1"
              value={blankName}
              onChange={(e) => setBlankName(e.target.value)}
              disabled={busy}
            />
          </div>
          <Button size="lg" disabled={busy} data-lp-create-draft-btn onClick={() => void createBlankDraft()}>
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Đang tạo…
              </>
            ) : (
              <>
                Tạo bản nháp → Builder
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </section>
      ) : null}

      {mode === 'template' ? (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-transparent p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Chọn Template</h2>
              <p className="mt-0.5 text-sm opacity-65">Chọn mẫu rồi mở Builder để chỉnh.</p>
            </div>
            <Input
              className="max-w-xs"
              placeholder="Lọc theo tên / ngành…"
              value={tplFilter}
              onChange={(e) => setTplFilter(e.target.value)}
              disabled={busy}
            />
          </div>
          <div className="grid max-h-[420px] gap-2 overflow-y-auto sm:grid-cols-2">
            {filteredTemplates.map((tpl) => {
              const active = templateSlug === tpl.slug;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  disabled={busy}
                  onClick={() => setTemplateSlug(tpl.slug)}
                  className={`rounded-xl border p-3 text-left transition ${
                    active
                      ? 'border-orange-400/50 bg-orange-500/10'
                      : 'border-white/10 hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{tpl.name}</span>
                    {active ? <CheckCircle2 className="h-4 w-4 text-orange-400" /> : null}
                  </div>
                  <div className="mt-1 text-[11px] uppercase opacity-50">
                    {tpl.category} · {tpl.theme}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs opacity-65">{tpl.description}</p>
                </button>
              );
            })}
          </div>
          {!filteredTemplates.length ? (
            <p className="text-sm opacity-60">Không có template khớp bộ lọc.</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button size="lg" disabled={busy || !templateSlug} onClick={() => void createFromTemplate()}>
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang tạo…
                </>
              ) : (
                'Dùng template này'
              )}
            </Button>
            <Button asChild variant="outline">
              <Link href="/landing-pages/templates">Xem tất cả templates</Link>
            </Button>
          </div>
        </section>
      ) : null}

      {busy ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
            <span>
              {phase === 'previewing' && 'AI đang tạo preview (chưa ghi draft)…'}
              {phase === 'creating' && 'Đang tạo bản nháp…'}
              {phase === 'generating' && 'Đang ghi copy vào draft…'}
              {phase === 'done' && 'Xong — chuyển vào Builder…'}
            </span>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {note ? <p className="mt-2 text-xs opacity-60">{note}</p> : null}
    </div>
  );
}
