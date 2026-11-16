'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  Check,
  ChevronDown,
  Monitor,
  RefreshCw,
  Smartphone,
  Tablet,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import {
  applyTemplateContent,
  collectTemplateContentSlots,
  normalizeTemplateContentBrief,
  reviewTemplateContent,
  templatePriceOffer,
  parseTemplateVnd,
  type LandingPageSpec,
  type TemplateContentBrief,
  type TemplateContentImage,
  type TemplateContentProposal,
  type TemplateContentResult,
  type TemplateUrlSource,
  type TemplateUrlReadResult,
} from '@marketingspa/shared';
import { apiClient, apiUpload } from '@/lib/api-client';
import { LandingPageRenderer } from './landing-page-renderer';
import { LandingPagePreviewViewport } from './landing-page-preview-viewport';
import './landing-page-template-content.css';

const BLOCK_LABELS: Record<string, string> = {
  Header: 'Điều hướng',
  Footer: 'Chân trang',
  SEO: 'SEO / tìm kiếm',
  Countdown: 'Lịch / đếm ngược',
  LeadForm: 'Biểu mẫu',
  Hero: 'Đầu trang',
  Benefits: 'Lợi ích',
  Features: 'Thông số / đặc điểm',
  Product: 'Sản phẩm',
  Gallery: 'Hình ảnh và cách triển khai',
  CTA: 'Nút hành động',
  Guarantee: 'Chính sách',
  Pricing: 'Giá bán',
  Testimonials: 'Đánh giá',
  FAQ: 'Hỏi đáp',
  Process: 'Quy trình',
};
const INITIAL: TemplateContentBrief = {
  productName: '',
  brandName: '',
  description: '',
  targetCustomer: '',
  goal: 'sales',
  imageIds: [],
};
type Props = {
  pageId: string;
  currentSpec: LandingPageSpec;
  onClose: () => void;
  onApply: (
    snapshot: LandingPageSpec,
    proposals: TemplateContentProposal[],
    selected: string[],
    images: TemplateContentImage[],
    confirmed: Record<string, string>,
    urlSource?: TemplateContentResult['urlSource'],
  ) => { applied: string[]; conflicts: string[] };
};

export function LandingPageTemplateContentDialog({ pageId, currentSpec, onClose, onApply }: Props) {
  const [snapshot, setSnapshot] = useState(() => structuredClone(currentSpec));
  const [brief, setBrief] = useState<TemplateContentBrief>(INITIAL);
  const [result, setResult] = useState<TemplateContentResult | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState<Record<string, string>>({});
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [step, setStep] = useState<'info' | 'review'>('info');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [library, setLibrary] = useState<TemplateContentImage[]>([]);
  const [activeBlock, setActiveBlock] = useState('');
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const [generatedBrief, setGeneratedBrief] = useState('');
  const [inputMode, setInputMode] = useState<'manual' | 'url'>('manual');
  const [urlInput, setUrlInput] = useState(currentSpec.meta?.contentSource?.sourceUrl || '');
  const [urlSource, setUrlSource] = useState<TemplateUrlSource | null>(null);
  const [readingUrl, setReadingUrl] = useState(false);
  const [importedUrls, setImportedUrls] = useState<string[]>([]);
  const [importingUrl, setImportingUrl] = useState('');
  const pendingGeneration = useRef<{ fingerprint: string; key: string } | null>(null);
  const pricingTargets = useMemo(() => collectTemplateContentSlots(currentSpec, true)
    .filter(slot => slot.blockType === 'Pricing' && slot.field === 'price'), [currentSpec]);
  const pricePreview = useMemo(() => {
    try { return { offer: templatePriceOffer(brief), error: '' }; }
    catch (error) { return { offer: undefined, error: error instanceof Error ? error.message : 'Giá không hợp lệ.' }; }
  }, [brief.originalPrice, brief.salePrice]);
  const context = JSON.stringify({
    brief,
    sourceId: inputMode === 'url' ? urlSource?.sourceId : undefined,
  });
  const briefDirty = !!result && generatedBrief !== context;
  const [previewScale, setPreviewScale] = useState(1);
  const previewRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const alive = useRef(true);
  const touchedBrief = useRef(new Set<keyof TemplateContentBrief>());
  useEffect(() => {
    if (!error) return;
    const frame = requestAnimationFrame(() => {
      errorRef.current?.scrollIntoView({ block: 'nearest' });
      errorRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [error, step]);
  useEffect(() => {
    if (step !== 'review') return;
    panelRef.current?.scrollTo({ top: 0 });
    requestAnimationFrame(() =>
      previewRef.current
        ?.querySelector(`[data-lp-block-id="${CSS.escape(activeBlock)}"]`)
        ?.scrollIntoView({ block: 'start' }),
    );
  }, [step, viewport]);
  useEffect(() => {
    const element = previewRef.current;
    if (!element) return;
    const sync = () =>
      setPreviewScale(
        Math.min(
          1,
          Math.max(
            0.15,
            (element.clientWidth - 16) /
              (viewport === 'mobile' ? 390 : viewport === 'tablet' ? 768 : 1100),
          ),
        ),
      );
    const observer = new ResizeObserver(sync);
    observer.observe(element);
    sync();
    return () => observer.disconnect();
  }, [viewport, step]);
  useEffect(() => {
    alive.current = true;
    void apiClient<{ items: TemplateContentImage[] }>(`/landing-pages/${pageId}/media?scope=org`)
      .then((data) => {
        if (alive.current) setLibrary(data.items);
      })
      .catch(() => {
        if (alive.current)
          setError('Không tải được thư viện ảnh. Bạn có thể thử lại bằng cách mở lại bảng này.');
      });
    void apiClient<{ brandName?: string; companyName?: string }>('/landing-pages/business-profile')
      .then((profile) => {
        if (alive.current)
          setBrief((value) => ({
            ...value,
            brandName: value.brandName || profile.brandName || profile.companyName || '',
          }));
      })
      .catch(() => {});
    return () => {
      alive.current = false;
    };
  }, [pageId]);

  const liveSlots = useMemo(
    () => new Map(collectTemplateContentSlots(currentSpec, true).map((slot) => [slot.id, slot])),
    [currentSpec],
  );
  const groups = useMemo(() => {
    const map = new Map<
      string,
      { id: string; label: string; slots: NonNullable<TemplateContentResult>['slots'] }
    >();
    for (const slot of result?.slots || collectTemplateContentSlots(snapshot)) {
      const group = map.get(slot.blockId) || {
        id: slot.blockId,
        label:
          result?.outline?.find((section) => section.blockId === slot.blockId)?.question ||
          BLOCK_LABELS[slot.blockType] ||
          slot.blockType,
        slots: [],
      };
      group.slots.push(slot);
      map.set(slot.blockId, group);
    }
    return [...map.values()];
  }, [result, snapshot]);
  const preview = useMemo(
    () =>
      result
        ? applyTemplateContent(
            currentSpec,
            snapshot,
            result.proposals,
            selected,
            library,
            confirmed,
          ).spec
        : currentSpec,
    [currentSpec, snapshot, result, selected, library, confirmed],
  );
  const conflictIds = useMemo(
    () =>
      result
        ? applyTemplateContent(
            currentSpec,
            snapshot,
            result.proposals,
            selected,
            library,
            confirmed,
          ).conflicts
        : [],
    [currentSpec, snapshot, result, selected, library, confirmed],
  );
  const reviewIssues = useMemo(
    () => result ? reviewTemplateContent(preview, result.slots, result.proposals) : [],
    [preview, result],
  );

  function changeBrief<K extends keyof TemplateContentBrief>(
    key: K,
    value: TemplateContentBrief[K],
  ) {
    touchedBrief.current.add(key);
    setBrief((prev) => ({ ...prev, [key]: value }));
  }
  function proposal(id: string) {
    return result?.proposals.find((value) => value.slotId === id);
  }
  function protect(id: string) {
    return !!result?.protectedSlotIds.includes(id) && confirmed[id] === undefined;
  }
  function toggle(id: string, checked: boolean) {
    const priceGroupId = proposal(id)?.priceGroupId;
    const ids = priceGroupId ? result!.proposals.filter(p => p.priceGroupId === priceGroupId).map(p => p.slotId) : [id];
    if (priceGroupId && checked && ids.some(key => protect(key) || liveSlots.get(key)?.locked)) {
      setError('Cần xác nhận thay thế hoặc mở khóa cả giá gốc và giá bán. Bạn có thể dùng nút duyệt đề xuất toàn trang.');
      return;
    }
    setSelected((values) =>
      checked ? [...new Set([...values, ...ids])] : values.filter((value) => !ids.includes(value)),
    );
  }
  function patchProposal(id: string, patch: Partial<TemplateContentProposal>) {
    setResult((value) =>
      value
        ? {
            ...value,
            proposals: value.proposals.map((p) =>
              p.slotId === id
                ? {
                    ...p,
                    ...patch,
                    source: 'user',
                    validationIssue: undefined,
                    action: undefined,
                    status: (patch.text ?? patch.imageId ?? p.text ?? p.imageId)?.trim()
                      ? 'ready'
                      : 'missing',
                  }
                : p,
            ),
          }
        : value,
    );
  }
  const pendingMissing = reviewIssues
    .reduce((count, issue) => count + issue.slotIds.length, 0);
  function approveCompleteReview() {
    if (!result) return;
    const candidates = result.proposals.filter(
      (p) =>
        (p.status === 'ready' || (p.status === 'missing' && p.action === 'hide')) &&
        liveSlots.has(p.slotId) &&
        !liveSlots.get(p.slotId)?.locked,
    );
    const hidden = candidates.filter((p) => p.action === 'hide'),
      protectedFields = candidates.filter((p) => protect(p.slotId));
    if (
      !window.confirm(
        `Duyệt toàn trang: cập nhật ${candidates.length - hidden.length} vị trí, trong đó ${protectedFields.length} vị trí đã chỉnh cần thay thế; ẩn ${hidden.length} khối/ảnh còn dữ liệu demo chưa xác nhận? Cấu hình gốc được giữ để hoàn tác. Bạn có thể hủy và duyệt từng vị trí.`,
      )
    )
      return;
    setConfirmed((values) => ({
      ...values,
      ...Object.fromEntries(candidates.map((p) => [p.slotId, liveSlots.get(p.slotId)!.current])),
    }));
    setSelected([...new Set(candidates.map((p) => p.slotId))]);
  }
  function focusBlock(id: string) {
    setActiveBlock(id);
    setOpened((value) => ({ ...value, [id]: true }));
    requestAnimationFrame(() =>
      previewRef.current
        ?.querySelector(`[data-lp-block-id="${CSS.escape(id)}"]`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
    );
  }

  async function generate(blockId?: string) {
    if (busy || uploading) return;
    setError('');
    setBusy(true);
    const base = blockId ? snapshot : structuredClone(currentSpec);
    try {
      let source = inputMode === 'url' ? urlSource : null;
      let input = brief;
      if (inputMode === 'url' && !source) {
        setReadingUrl(true);
        const data = await fetchUrlSource();
        if (!alive.current) return;
        source = data.source;
        // Fill blanks from the source; preserve information the user already entered.
        input = { ...brief };
        for (const [key, value] of Object.entries(data.brief)) {
          if (
            typeof value === 'string' &&
            (!touchedBrief.current.has(key as keyof TemplateContentBrief) ||
              !String(input[key as keyof TemplateContentBrief] || '').trim())
          )
            (input as unknown as Record<string, unknown>)[key] = value;
        }
        setUrlSource(source);
        setImportedUrls([]);
        setBrief(input);
        setReadingUrl(false);
      }
      const clean = normalizeTemplateContentBrief(input, !!source);
      const generationContext = JSON.stringify({ brief: input, sourceId: source?.sourceId });
      const fingerprint = JSON.stringify({ brief: clean, sourceId: source?.sourceId, snapshot: base, blockId });
      if (pendingGeneration.current?.fingerprint !== fingerprint)
        pendingGeneration.current = { fingerprint, key: crypto.randomUUID() };
      const data = await apiClient<TemplateContentResult>(
        `/landing-pages/${pageId}/ai-template-content`,
        {
          method: 'POST',
          body: JSON.stringify({
            brief: clean,
            snapshot: base,
            blockId,
            sourceId: source?.sourceId,
            idempotencyKey: pendingGeneration.current.key,
          }),
        },
      );
      if (!alive.current) return;
      pendingGeneration.current = null;
      if (blockId && result) {
        const updatedIds = new Set(data.slots.map((s) => s.id));
        // Rewriting also requires reviewing again; hand-edited suggestions stay intact until explicitly rewritten.
        setResult({
          ...result,
          source: data.source,
          warning: data.warning,
          outline: data.outline || result.outline,
          validationSummary: data.validationSummary,
          proposals: result.proposals.map(
            (p) => data.proposals.find((next) => next.slotId === p.slotId) || p,
          ),
        });
        setSelected((values) =>
          values
            .filter((id) => !updatedIds.has(id))
            .concat(
              data.proposals
                .filter((p) => (p.status === 'ready' || (p.status === 'missing' && p.action === 'hide')) && !data.protectedSlotIds.includes(p.slotId))
                .map((p) => p.slotId),
            ),
        );
      } else {
        setSnapshot(base);
        setResult(data);
        setConfirmed({});
        setSelected(
          data.proposals
            .filter((p) => (p.status === 'ready' || (p.status === 'missing' && p.action === 'hide')) && !data.protectedSlotIds.includes(p.slotId))
            .map((p) => p.slotId),
        );
        const first =
          data.slots.find((slot) => slot.blockType === 'Hero')?.blockId ||
          data.slots[0]?.blockId ||
          '';
        setActiveBlock(first);
        setOpened({ [first]: true });
      }
      setGeneratedBrief(generationContext);
      setStep('review');
    } catch (e) {
      if (alive.current) {
        if (e && typeof e === 'object' && 'code' in e && e.code === 'URL_SOURCE_EXPIRED')
          setUrlSource(null);
        setError(e instanceof Error ? e.message : 'Không thể tạo nội dung. Vui lòng thử lại.');
      }
    } finally {
      if (alive.current) {
        setBusy(false);
        setReadingUrl(false);
      }
    }
  }

  async function fetchUrlSource() {
    const raw = urlInput.trim();
    if (!raw) throw new Error('Nhập URL trang công khai hoặc chuyển sang nhập thủ công.');
    let url: URL;
    try {
      url = new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    } catch {
      throw new Error(
        'URL không hợp lệ. Nhập địa chỉ trang công khai, ví dụ https://example.com/san-pham.',
      );
    }
    if (alive.current) setUrlInput(url.href);
    return apiClient<TemplateUrlReadResult>(
      `/landing-pages/${pageId}/ai-template-content/read-url`,
      {
        method: 'POST',
        body: JSON.stringify({ url: url.href }),
      },
    );
  }

  async function readUrl() {
    setError('');
    if (
      (brief.productName || brief.description || brief.targetCustomer) &&
      !window.confirm(
        'Dùng nội dung URL để thay thông tin đang nhập? Bản nháp chưa thay đổi; ảnh đã chọn được giữ.',
      )
    )
      return;
    setBusy(true);
    setReadingUrl(true);
    try {
      const data = await fetchUrlSource();
      if (!alive.current) return;
      setUrlSource(data.source);
      setImportedUrls([]);
      touchedBrief.current.clear();
      setBrief((value) => ({
        ...value,
        ...data.brief,
        imageIds: value.imageIds,
        primaryImageId: value.primaryImageId,
      }));
    } catch (e) {
      if (alive.current) {
        setUrlSource(null);
        setError(
          `${e instanceof Error ? e.message : 'Không đọc được trang.'} Bạn có thể thử lại hoặc chọn nhập thủ công.`,
        );
      }
    } finally {
      if (alive.current) {
        setBusy(false);
        setReadingUrl(false);
      }
    }
  }

  async function importUrlImage(imageUrl: string) {
    if (!urlSource) return;
    setBusy(true);
    setImportingUrl(imageUrl);
    setError('');
    try {
      const data = await apiClient<{ image?: TemplateContentImage }>(
        `/landing-pages/${pageId}/ai-template-content/import-url-image`,
        { method: 'POST', body: JSON.stringify({ sourceId: urlSource.sourceId, imageUrl }) },
      );
      if (!alive.current) return;
      if (!data.image) throw new Error('Ảnh chưa có trong thư viện. Hãy thử lại.');
      const image = data.image;
      setLibrary((value) => [...value.filter((item) => item.id !== image.id), image]);
      setImportedUrls((value) => [...value, imageUrl]);
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : 'Không nhập được ảnh. Hãy tải ảnh lên thư viện.');
    } finally {
      if (alive.current) {
        setBusy(false);
        setImportingUrl('');
      }
    }
  }

  async function upload(file?: File) {
    if (!file) return;
    setError('');
    if (
      !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) ||
      file.size > 10 * 1024 * 1024
    ) {
      setError('Chọn ảnh JPG, PNG, WebP hoặc GIF tối đa 10 MB.');
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const uploaded = await apiUpload<{ url: string }>(
        `/landing-pages/${pageId}/upload-image`,
        form,
      );
      const data = await apiClient<{ items: TemplateContentImage[] }>(
        `/landing-pages/${pageId}/media?scope=org`,
      );
      if (!alive.current) return;
      setLibrary(data.items);
      const item = data.items.find((image) => image.url === uploaded.url);
      if (!item) throw new Error('Ảnh chưa có trong thư viện. Vui lòng thử lại.');
      setBrief((value) => ({
        ...value,
        imageIds: [...new Set([...value.imageIds, item.id])].slice(0, 30),
        primaryImageId: value.primaryImageId || item.id,
      }));
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : 'Không tải được ảnh.');
    } finally {
      if (alive.current) setUploading(false);
    }
  }

  async function apply() {
    if (!result || !selected.length || briefDirty) return;
    const unresolved = reviewIssues;
    if (unresolved.length && !window.confirm(
      `Bản xem trước còn ${unresolved.length} phần cần kiểm tra, gồm khối thiếu dữ kiện hoặc nội dung chưa được thay thế. Áp dụng lựa chọn hiện tại và giữ các phần này để chỉnh tiếp? Trang chỉ được lưu bản nháp.`,
    )) return;
    setError('');
    setBusy(true);
    try {
      const ids = [
        ...new Set(
          result.proposals
            .filter((p) => selected.includes(p.slotId) && p.imageId)
            .map((p) => p.imageId!),
        ),
      ];
      const verified = await apiClient<{ images: TemplateContentImage[] }>(
        `/landing-pages/${pageId}/ai-template-content/validate-images`,
        { method: 'POST', body: JSON.stringify({ imageIds: ids }) },
      );
      if (!alive.current) return;
      const outcome = onApply(
        snapshot,
        result.proposals,
        selected,
        verified.images,
        confirmed,
        result.urlSource,
      );
      if (outcome.conflicts.length) {
        setError(
          'Có vị trí vừa thay đổi hoặc nhóm giá chưa được chọn đủ. Hãy duyệt cả giá gốc và giá bán, hoặc bỏ chọn nhóm giá trước khi áp dụng.',
        );
        return;
      }
      if (!outcome.applied.length) {
        setError('Không có đề xuất hợp lệ để áp dụng. Kiểm tra vị trí đã chọn.');
        return;
      }
      onClose();
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : 'Không thể áp dụng nội dung.');
    } finally {
      if (alive.current) setBusy(false);
    }
  }

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !busy && !uploading) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="lp-template-ai-overlay" />
        <Dialog.Content
          className="lp-template-ai"
          aria-describedby="lp-template-ai-description"
          onInteractOutside={(event) => event.preventDefault()}
        >
          <header className="lp-template-ai-header">
            <Dialog.Title>
              <Sparkles size={20} /> Tạo nội dung cho mẫu bằng AI
            </Dialog.Title>
            <button
              type="button"
              aria-label="Đóng tạo nội dung cho mẫu"
              disabled={busy || uploading}
              onClick={onClose}
            >
              <X size={22} />
            </button>
          </header>
          <Dialog.Description
            id="lp-template-ai-description"
            className="lp-template-ai-description"
          >
            Duyệt trên bản xem trước. Chỉ chữ và ảnh đã chọn được áp dụng vào bản nháp.
          </Dialog.Description>
          <div className="lp-template-ai-body">
            <nav aria-label="Cấu trúc mẫu" className="lp-template-ai-structure">
              <h3>Cấu trúc trang</h3>
              {groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  aria-current={activeBlock === group.id ? 'true' : undefined}
                  onClick={() => focusBlock(group.id)}
                >
                  {group.label}
                  {result?.proposals.some(
                    (p) => group.slots.some((s) => s.id === p.slotId) && p.status === 'missing',
                  ) && <span className="lp-template-ai-dot" aria-label="Cần bổ sung" />}
                </button>
              ))}
            </nav>
            <section className="lp-template-ai-canvas" aria-label="Xem trước nội dung trên mẫu">
              <div className="lp-template-ai-devices">
                {(['desktop', 'tablet', 'mobile'] as const).map((device) => (
                  <button
                    key={device}
                    type="button"
                    aria-pressed={viewport === device}
                    onClick={() => setViewport(device)}
                  >
                    {device === 'desktop' ? (
                      <Monitor size={18} />
                    ) : device === 'tablet' ? (
                      <Tablet size={18} />
                    ) : (
                      <Smartphone size={18} />
                    )}
                    {device === 'desktop' ? 'Desktop' : device === 'tablet' ? 'Tablet' : 'Mobile'}
                  </button>
                ))}
              </div>
              <div
                ref={previewRef}
                className="lp-template-ai-preview-scroll"
                data-template-content-preview={viewport}
                onClickCapture={(event) => {
                  if ((event.target as Element).closest('a,button,input,select,textarea')) {
                    event.preventDefault();
                    event.stopPropagation();
                  }
                }}
                onSubmitCapture={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                <div
                  className="lp-template-ai-preview-page"
                  style={{
                    width: viewport === 'mobile' ? 390 : viewport === 'tablet' ? 768 : 1100,
                    zoom: previewScale,
                  }}
                >
                  <LandingPagePreviewViewport>
                    <LandingPageRenderer spec={preview} viewport={viewport} mode="preview" />
                  </LandingPagePreviewViewport>
                </div>
              </div>
              <p className="lp-template-ai-preview-note">
                {selected.length} vị trí được chọn · Nội dung mẫu ở vị trí “Cần bổ sung” vẫn giữ
                nguyên để bạn rà soát.
              </p>
            </section>
            <aside ref={panelRef} className="lp-template-ai-panel">
              <h2>Tạo nội dung cho mẫu bằng AI</h2>
              <div className="lp-template-ai-tabs">
                <button
                  type="button"
                  disabled={busy}
                  aria-pressed={step === 'info'}
                  onClick={() => setStep('info')}
                >
                  Thông tin sản phẩm
                </button>
                <button
                  type="button"
                  disabled={!result || busy || briefDirty}
                  aria-pressed={step === 'review'}
                  onClick={() => setStep('review')}
                >
                  Duyệt nội dung
                </button>
              </div>
              {error && step !== 'info' && (
                <p ref={errorRef} tabIndex={-1} role="alert" className="lp-template-ai-error">
                  {error}
                </p>
              )}
              {briefDirty && (
                <p role="status" className="lp-template-ai-warning">
                  Thông tin đã thay đổi. Tạo lại đề xuất để duyệt theo thông tin mới.
                </p>
              )}
              {result?.warning && <p className="lp-template-ai-warning">{result.warning}</p>}
              {!result?.urlSource && currentSpec.meta?.contentSource && (
                <p className="lp-template-ai-warning">
                  Nguồn đã lưu trong bản nháp:{' '}
                  <a
                    href={currentSpec.meta.contentSource.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {currentSpec.meta.contentSource.sourceUrl}
                  </a>
                </p>
              )}
              {result?.urlSource && step === 'review' && (
                <p className="lp-template-ai-warning">
                  Nguồn đối chiếu:{' '}
                  <a href={result.urlSource.sourceUrl} target="_blank" rel="noreferrer">
                    {result.urlSource.sourceUrl}
                  </a>
                  . Chỉ lưu khi bạn áp dụng; trang chưa được xuất bản.
                </p>
              )}
              {step === 'info' ? (
                <form
                  className="lp-template-ai-form"
                  noValidate
                  onSubmit={(event) => {
                    event.preventDefault();
                    void generate();
                  }}
                >
                  <fieldset disabled={busy || uploading} className="lp-template-ai-url">
                    <legend>Nguồn nội dung</legend>
                    <div className="lp-template-ai-tabs">
                      <button
                        type="button"
                        aria-pressed={inputMode === 'manual'}
                        onClick={() => setInputMode('manual')}
                      >
                        Nhập thủ công
                      </button>
                      <button
                        type="button"
                        aria-pressed={inputMode === 'url'}
                        onClick={() => setInputMode('url')}
                      >
                        Tạo nội dung từ URL
                      </button>
                    </div>
                    {inputMode === 'url' && (
                      <>
                        <label>
                          URL trang công khai
                          <input
                            type="url"
                            maxLength={2000}
                            value={urlInput}
                            placeholder="https://example.com/san-pham"
                            onChange={(e) => {
                              setUrlInput(e.target.value);
                              setUrlSource(null);
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          disabled={!urlInput.trim()}
                          onClick={() => void readUrl()}
                        >
                          {readingUrl
                            ? 'Đang đọc và phân tích…'
                            : urlSource
                              ? 'Đọc lại URL'
                              : 'Đọc và phân tích URL'}
                        </button>
                        {readingUrl && (
                          <p role="status">
                            Đang lấy nội dung chính, metadata và danh sách ảnh. Bản nháp chưa thay
                            đổi.
                          </p>
                        )}
                        {urlSource && (
                          <div className="lp-template-ai-url-result">
                            <p role="status">
                              Đã đọc nội dung trang. Kiểm tra và bổ sung thông tin bên dưới trước
                              khi tạo đề xuất.
                            </p>
                            <a href={urlSource.finalUrl} target="_blank" rel="noreferrer">
                              {urlSource.title || urlSource.finalUrl}
                            </a>
                            {urlSource.warnings.map((warning) => (
                              <p key={warning}>{warning}</p>
                            ))}
                            <details>
                              <summary>Nội dung nguồn đã lọc</summary>
                              <p style={{ whiteSpace: 'pre-wrap' }}>{urlSource.text}</p>
                            </details>
                            {!!urlSource.images.length && (
                              <details>
                                <summary>Ảnh từ trang nguồn ({urlSource.images.length})</summary>
                                <p>
                                  Nhập ảnh bạn có quyền sử dụng vào thư viện, sau đó chọn ảnh trong
                                  thư viện bên dưới. Ảnh nguồn không tự áp dụng.
                                </p>
                                {urlSource.images.map((image) => (
                                  <div key={image.url} className="lp-template-ai-url-image">
                                    <span>
                                      {image.alt || 'Ảnh nguồn'} · {image.url}
                                    </span>
                                    <button
                                      type="button"
                                      disabled={importedUrls.includes(image.url)}
                                      onClick={() => void importUrlImage(image.url)}
                                    >
                                      {importingUrl === image.url
                                        ? 'Đang nhập ảnh…'
                                        : importedUrls.includes(image.url)
                                          ? 'Đã nhập vào thư viện'
                                          : 'Nhập vào thư viện'}
                                    </button>
                                  </div>
                                ))}
                              </details>
                            )}
                          </div>
                        )}
                        <p>
                          Trang yêu cầu đăng nhập, chặn truy cập hoặc chỉ chạy JavaScript có thể
                          không đọc được. Bạn luôn có thể chuyển sang nhập thủ công.
                        </p>
                      </>
                    )}
                  </fieldset>
                  {(
                    [
                      ['productName', 'Tên sản phẩm / dịch vụ', 200],
                      ['brandName', 'Thương hiệu', 120],
                      ['description', 'Mô tả / đặc điểm thực tế (mỗi đặc điểm một dòng)', 2400],
                      ['targetCustomer', 'Khách hàng mục tiêu', 400],
                    ] as const
                  ).map(([key, label, max]) => (
                    <label key={key}>
                      {label}
                      {(key === 'productName' ||
                        key === 'description' ||
                        inputMode === 'manual') && <span aria-hidden="true"> *</span>}
                      {key === 'description' ? (
                        <textarea
                          required={key === 'description' || inputMode === 'manual'}
                          maxLength={max}
                          value={brief[key]}
                          onChange={(e) => changeBrief(key, e.target.value)}
                          disabled={busy}
                        />
                      ) : (
                        <input
                          required={key === 'productName' || inputMode === 'manual'}
                          maxLength={max}
                          value={brief[key]}
                          onChange={(e) => changeBrief(key, e.target.value)}
                          disabled={busy}
                        />
                      )}
                    </label>
                  ))}
                  <fieldset disabled={busy}>
                    <legend>Giá sản phẩm và khuyến mãi (VNĐ)</legend>
                    <label>
                      Giá gốc
                      <input inputMode="numeric" maxLength={40} placeholder="Ví dụ: 10.000.000"
                        value={brief.originalPrice || ''}
                        onChange={event => changeBrief('originalPrice', event.target.value)}
                        onBlur={() => { try { const value = parseTemplateVnd(brief.originalPrice); if (value) changeBrief('originalPrice', value.toLocaleString('vi-VN')); } catch {} }} />
                    </label>
                    <label>
                      Giá khuyến mãi
                      <input inputMode="numeric" maxLength={40} placeholder="Ví dụ: 4.000.000"
                        value={brief.salePrice || ''}
                        onChange={event => changeBrief('salePrice', event.target.value)}
                        onBlur={() => { try { const value = parseTemplateVnd(brief.salePrice); if (value) changeBrief('salePrice', value.toLocaleString('vi-VN')); } catch {} }} />
                    </label>
                    {pricePreview.error && <p role="alert" className="lp-template-ai-warning">{pricePreview.error}</p>}
                    {pricePreview.offer && <div role="status" className="lp-template-ai-warning">
                      {pricePreview.offer.sale !== undefined && <><del>{pricePreview.offer.originalLabel}</del>{' → '}</>}
                      <strong>{pricePreview.offer.priceLabel}</strong>
                      {pricePreview.offer.percentLabel && <strong> · Giảm {pricePreview.offer.percentLabel}</strong>}
                    </div>}
                    {!!pricingTargets.length && <label>
                      Box báo giá nhận giá sản phẩm
                      <select aria-label="Box báo giá nhận giá sản phẩm" value={brief.pricingTargetId || pricingTargets[0]!.id}
                        onChange={event => changeBrief('pricingTargetId', event.target.value)}>
                        {pricingTargets.map((slot, index) => <option key={slot.id} value={slot.id}>
                          Box {index + 1} · {currentSpec.blocks.find(block => block.id === slot.blockId)?.type === 'Pricing'
                            ? (currentSpec.blocks.find(block => block.id === slot.blockId) as any).plans.find((plan: any) => plan.id === slot.itemId)?.name || 'Báo giá'
                            : 'Báo giá'}
                        </option>)}
                      </select>
                    </label>}
                    <p>Giá được đưa vào box đã chọn và phần ưu đãi cạnh đồng hồ. Phần trăm giảm được tính từ hai giá bạn nhập.</p>
                    <label>
                      Thời gian kết thúc ưu đãi (tùy chọn)
                      <input type="datetime-local"
                        value={brief.schedule && Number.isFinite(Date.parse(brief.schedule)) ? (() => {
                          const date = new Date(brief.schedule!);
                          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
                        })() : ''}
                        onChange={event => changeBrief('schedule', event.target.value ? new Date(event.target.value).toISOString() : '')} />
                    </label>
                      <small>Để trống: giữ nguyên chế độ và mốc đồng hồ đang có. Nhập thời gian mới để cập nhật và bật đếm ngược. Nếu mẫu chưa có mốc thời gian, chỉ hiển thị ưu đãi.</small>
                  </fieldset>
                  <label>
                    Mục tiêu trang
                    <select
                      value={brief.goal}
                      onChange={(e) =>
                        changeBrief('goal', e.target.value as TemplateContentBrief['goal'])
                      }
                      disabled={busy}
                    >
                      <option value="sales">Bán hàng</option>
                      <option value="consult">Nhận tư vấn</option>
                    </select>
                  </label>
                  <fieldset disabled={busy || uploading}>
                    <legend>Hình ảnh sản phẩm / dịch vụ</legend>
                    <label className="lp-template-ai-upload">
                      <Upload size={16} /> {uploading ? 'Đang tải ảnh…' : 'Tải ảnh lên'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        aria-label="Tải ảnh sản phẩm"
                        onChange={(e) => {
                          void upload(e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <p>Chọn tối đa 30 ảnh từ thư viện của bạn và đặt một ảnh chính.</p>
                    <div className="lp-template-ai-images">
                      {library.map((image) => (
                        <div key={image.id}>
                          <label>
                            <input
                              type="checkbox"
                              aria-label={`Chọn ảnh ${image.name}`}
                              checked={brief.imageIds.includes(image.id)}
                              disabled={
                                !brief.imageIds.includes(image.id) && brief.imageIds.length >= 30
                              }
                              onChange={(e) => {
                                const imageIds = e.target.checked
                                  ? [...brief.imageIds, image.id]
                                  : brief.imageIds.filter((id) => id !== image.id);
                                setBrief((value) => ({
                                  ...value,
                                  imageIds,
                                  primaryImageId: imageIds.includes(value.primaryImageId || '')
                                    ? value.primaryImageId
                                    : imageIds[0],
                                }));
                              }}
                            />
                            <img src={image.url} alt={image.name} loading="lazy" />
                          </label>
                          <label className="lp-template-ai-primary">
                            <input
                              type="radio"
                              name="primaryImage"
                              aria-label={`Ảnh chính ${image.name}`}
                              checked={brief.primaryImageId === image.id}
                              disabled={!brief.imageIds.includes(image.id)}
                              onChange={() => changeBrief('primaryImageId', image.id)}
                            />
                            Ảnh chính
                          </label>
                        </div>
                      ))}
                    </div>
                    {!library.length && (
                      <p>Thư viện chưa có ảnh. Bạn có thể tải ảnh hoặc tiếp tục để bổ sung sau.</p>
                    )}
                  </fieldset>
                  <details>
                    <summary>Thông tin bổ sung (tùy chọn)</summary>
                    {(
                      [
                        ['offer', 'Ưu đãi thực tế', 600],
                        ['policy', 'Chính sách / cam kết đã xác nhận', 1200],
                        ['reviews', 'Đánh giá thật (mỗi dòng: tên | đánh giá)', 2400],
                        ['curriculum', 'Giáo trình / nội dung chương trình đã xác nhận', 2400],
                        [
                          'schedule',
                          'Mốc thời gian đã xác nhận (ISO có múi giờ, ví dụ 2027-01-01T19:00:00+07:00)',
                          200,
                        ],
                        ['commitments', 'Cam kết được xác nhận', 1200],
                      ] as const
                    ).map(([key, label, max]) => (
                      <label key={key}>
                        {label}
                        <textarea
                          value={brief[key] || ''}
                          maxLength={max}
                          onChange={(e) => changeBrief(key, e.target.value)}
                          disabled={busy}
                        />
                      </label>
                    ))}
                  </details>
                  {error && (
                    <p ref={errorRef} tabIndex={-1} role="alert" className="lp-template-ai-error">
                      {error}
                    </p>
                  )}
                  <button
                    className="lp-template-ai-primary-button"
                    disabled={busy || uploading}
                    type="submit"
                  >
                    <Sparkles size={16} />
                    {readingUrl
                      ? 'Đang đọc và phân tích URL…'
                      : busy
                        ? 'Đang tạo nội dung…'
                        : 'Tạo đề xuất trên mẫu'}
                  </button>
                </form>
              ) : (
                result && (
                  <>
                    <div className="lp-template-ai-product">
                      {library.find((i) => i.id === brief.primaryImageId) && (
                        <img
                          alt="Ảnh chính sản phẩm"
                          src={library.find((i) => i.id === brief.primaryImageId)!.url}
                        />
                      )}
                      <strong>{brief.productName}</strong>
                      <button type="button" disabled={busy} onClick={() => setStep('info')}>
                        Sửa thông tin
                      </button>
                    </div>
                    <div className="lp-template-ai-select">
                      <h3>Đề xuất theo khối</h3>
                      <button type="button" disabled={busy} onClick={approveCompleteReview}>
                        Duyệt đề xuất và ẩn demo thiếu dữ liệu
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          setSelected(
                            result.proposals
                              .filter(
                                (p) =>
                                  p.status === 'ready' &&
                                  !protect(p.slotId) &&
                                  !liveSlots.get(p.slotId)?.locked,
                              )
                              .map((p) => p.slotId),
                          )
                        }
                      >
                        Chọn đủ dữ liệu
                      </button>
                      <button type="button" disabled={busy} onClick={() => setSelected([])}>
                        Bỏ chọn tất cả
                      </button>
                    </div>
                    {!!pendingMissing && (
                      <p role="status" className="lp-template-ai-warning">
                        Còn {pendingMissing} vị trí cần bổ sung hoặc duyệt ẩn. Áp dụng từng phần sẽ
                        giữ những vị trí chưa duyệt; hãy rà soát trước khi xuất bản.
                      </p>
                    )}
                    {!!reviewIssues.length && (
                      <details open className="lp-template-ai-warning">
                        <summary>Kiểm tra bản xem trước: {reviewIssues.length} mục cần rà soát</summary>
                        <p>Các mục dưới đây phản ánh nội dung sẽ thực sự được áp dụng.</p>
                        {reviewIssues.map((issue, index) => (
                          <p key={`${issue.blockId}-${issue.kind}-${index}`}>
                            <button type="button" disabled={busy} onClick={() => focusBlock(issue.blockId)}>
                              {groups.find(group => group.id === issue.blockId)?.label || issue.blockId}
                            </button>{' '}
                            {issue.message}
                          </p>
                        ))}
                      </details>
                    )}
                    {result.validationSummary &&
                      Object.keys(result.validationSummary).length > 0 && (
                        <details className="lp-template-ai-warning">
                          <summary>Kiểm chứng nội dung AI</summary>
                          {Object.entries(result.validationSummary).map(([code, count]) => (
                            <p key={code}>
                              {code}: {count} vị trí đã dùng đề xuất có căn cứ thay thế.
                            </p>
                          ))}
                        </details>
                      )}
                    <div className="lp-template-ai-proposals">
                      {groups.map((group) => {
                        const ready = group.slots.filter(
                          (s) => proposal(s.id)?.status === 'ready' && !protect(s.id) && !s.locked,
                        );
                        const missing = group.slots.some(
                          (s) => proposal(s.id)?.status === 'missing',
                        );
                        return (
                          <section
                            key={group.id}
                            className="lp-template-ai-group"
                            data-template-content-block={group.id}
                          >
                            <div className="lp-template-ai-group-heading">
                              <input
                                type="checkbox"
                                aria-label={`Chọn khối ${group.label}`}
                                disabled={busy || !ready.length}
                                checked={
                                  !!ready.length && ready.every((s) => selected.includes(s.id))
                                }
                                onChange={(e) =>
                                  setSelected((values) =>
                                    e.target.checked
                                      ? [...new Set([...values, ...ready.map((s) => s.id)])]
                                      : values.filter(
                                          (id) => !group.slots.some((s) => s.id === id),
                                        ),
                                  )
                                }
                              />
                              <button
                                type="button"
                                aria-expanded={!!opened[group.id]}
                                onClick={() => {
                                  setOpened((value) => ({
                                    ...value,
                                    [group.id]: !value[group.id],
                                  }));
                                  setActiveBlock(group.id);
                                }}
                              >
                                <strong>{group.label}</strong>
                                {missing && (
                                  <span className="lp-template-ai-badge">
                                    {selected.includes(`${group.id}::hidden`)
                                      ? 'Đã duyệt ẩn'
                                      : 'Cần bổ sung'}
                                  </span>
                                )}
                                <ChevronDown size={16} />
                              </button>
                            </div>
                            {opened[group.id] && (
                              <div className="lp-template-ai-group-content">
                                <button
                                  className="lp-template-ai-rewrite"
                                  type="button"
                                  disabled={busy}
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `Viết lại khối “${group.label}”? Nội dung đề xuất đã sửa trong khối sẽ được thay thế.`,
                                      )
                                    )
                                      void generate(group.id);
                                  }}
                                >
                                  <RefreshCw size={14} />
                                  Viết lại khối
                                </button>
                                {group.slots.map((slot) => {
                                  const p = proposal(slot.id);
                                  if (!p) return null;
                                  if (slot.kind === 'visibility' && slot.itemId && p.status !== 'missing') return null;
                                  if (slot.kind === 'visibility')
                                    return (
                                      <div key={slot.id} className="lp-template-ai-slot">
                                        <label className="lp-template-ai-slot-label">
                                          <input
                                            type="checkbox"
                                            aria-label={`Duyệt ${p.action === 'show' ? 'hiển thị' : 'ẩn'} ${slot.itemId ? `thẻ ${(slot.itemIndex || 0) + 1}` : 'khối'} ${group.label}`}
                                            checked={selected.includes(slot.id)}
                                            disabled={busy || slot.locked || protect(slot.id)}
                                            onChange={(event) =>
                                              toggle(slot.id, event.target.checked)
                                            }
                                          />
                                          {p.action === 'show' ? 'Hiển thị khối báo giá / ưu đãi' : slot.itemId ? 'Ẩn thẻ này' : 'Ẩn khối này'} (giữ cấu hình để hoàn tác)
                                        </label>
                                        <p className="lp-template-ai-missing">{p.reason}</p>
                                        {protect(slot.id) && !slot.locked && (
                                          <button
                                            type="button"
                                            disabled={busy}
                                            onClick={() => {
                                              if (
                                                window.confirm(
                                                  'Duyệt ẩn khối đã chỉnh này? Cấu hình được giữ và có thể hoàn tác.',
                                                )
                                              ) {
                                                setConfirmed((values) => ({
                                                  ...values,
                                                  [slot.id]: liveSlots.get(slot.id)?.current || '',
                                                }));
                                                toggle(slot.id, true);
                                              }
                                            }}
                                          >
                                            Xác nhận ẩn khối đã chỉnh
                                          </button>
                                        )}
                                      </div>
                                    );
                                  const live = liveSlots.get(slot.id);
                                  const stale =
                                    !!live &&
                                    live.current !== slot.current &&
                                    confirmed[slot.id] !== live.current;
                                  const protectedField = protect(slot.id) || stale;
                                  return (
                                    <div className="lp-template-ai-slot" key={slot.id}>
                                      <label className="lp-template-ai-slot-label">
                                        <input
                                          type="checkbox"
                                          aria-label={`Áp dụng ${slot.label} ${slot.id}`}
                                          checked={selected.includes(slot.id)}
                                          disabled={
                                            busy ||
                                            slot.locked ||
                                            (protectedField && !selected.includes(slot.id)) ||
                                            p.status !== 'ready'
                                          }
                                          onChange={(e) => toggle(slot.id, e.target.checked)}
                                        />
                                        {slot.label}
                                      </label>
                                      {(protectedField || conflictIds.includes(slot.id)) && (
                                        <div className="lp-template-ai-warning">
                                          {stale
                                            ? 'Vị trí vừa thay đổi.'
                                            : 'Nội dung đã chỉnh thủ công.'}
                                          <button
                                            type="button"
                                            disabled={busy || slot.locked || !live}
                                            onClick={() => {
                                              if (
                                                window.confirm(
                                                  p.priceGroupId ? 'Thay thế cả giá gốc và giá bán bằng hai mức giá đã nhập?' : 'Thay thế nội dung hiện tại ở vị trí này bằng đề xuất đang duyệt?',
                                                )
                                              ) {
                                                if (p.priceGroupId) {
                                                  const ids = result.proposals.filter(item => item.priceGroupId === p.priceGroupId).map(item => item.slotId);
                                                  if (ids.some(id => liveSlots.get(id)?.locked)) { setError('Nhóm giá có trường đang khóa. Mở khóa trước khi thay thế.'); return; }
                                                  setConfirmed(value => ({ ...value, ...Object.fromEntries(ids.map(id => [id, liveSlots.get(id)?.current || ''])) }));
                                                  setSelected(value => [...new Set([...value, ...ids])]);
                                                  return;
                                                }
                                                setConfirmed((value) => ({
                                                  ...value,
                                                  [slot.id]: live?.current || '',
                                                }));
                                                if (p.status === 'ready') toggle(slot.id, true);
                                              }
                                            }}
                                          >
                                            Xác nhận thay thế
                                          </button>
                                        </div>
                                      )}
                                      {slot.kind === 'image' ? (
                                        <>
                                          <select
                                            aria-label={`Đổi ảnh ${slot.id}`}
                                            disabled={busy || slot.locked}
                                            value={p.imageId || ''}
                                            onChange={(e) =>
                                              patchProposal(slot.id, { imageId: e.target.value })
                                            }
                                          >
                                            <option value="">Chọn ảnh từ thư viện</option>
                                            {library.map((image) => (
                                              <option key={image.id} value={image.id}>
                                                {image.name}
                                              </option>
                                            ))}
                                          </select>
                                          {p.status === 'missing' && (
                                            <label className="lp-template-ai-slot-label">
                                              <input
                                                type="checkbox"
                                                aria-label={`Duyệt ẩn ảnh ${slot.id}`}
                                                disabled={busy || slot.locked || protectedField}
                                                checked={
                                                  selected.includes(slot.id) && p.action === 'hide'
                                                }
                                                onChange={(event) =>
                                                  toggle(slot.id, event.target.checked)
                                                }
                                              />
                                              Duyệt ẩn ảnh minh họa chưa xác nhận
                                            </label>
                                          )}
                                          {library.find((i) => i.id === p.imageId) && (
                                            <img
                                              className="lp-template-ai-proposed-image"
                                              src={library.find((i) => i.id === p.imageId)!.url}
                                              alt="Ảnh đề xuất, giữ vùng cắt của mẫu"
                                            />
                                          )}
                                          <small>Giữ tỷ lệ và vùng cắt hiện có của mẫu.</small>
                                        </>
                                      ) : slot.field === 'clockMode' ? (
                                        <p>{p.text === 'offer' ? 'Chỉ hiển thị ưu đãi, không chạy đếm ngược.' : p.text === 'timer' ? 'Chạy đếm ngược đến thời gian đã nhập.' : 'Giữ cấu hình đồng hồ hiện tại.'}</p>
                                      ) : p.action === 'clear' ? (
                                        <p>Xóa nội dung mẫu tại vị trí này.</p>
                                      ) : (
                                        <textarea
                                          aria-label={`Sửa ${slot.label} ${slot.id}`}
                                          maxLength={slot.maxLength}
                                          value={p.text || ''}
                                          disabled={busy || slot.locked}
                                          readOnly={p.priceControlled}
                                          placeholder="Bổ sung thông tin đã xác nhận"
                                          onChange={(e) =>
                                            patchProposal(slot.id, { text: e.target.value })
                                          }
                                        />
                                      )}
                                      {p.priceControlled && <small>
                                        {p.action === 'clear' ? 'Xóa nội dung mẫu không phù hợp.' : 'Nội dung được tính từ giá đã nhập.'}{' '}
                                        <button type="button" disabled={busy} onClick={() => setStep('info')}>Sửa giá sản phẩm</button>
                                      </small>}
                                      {p.status === 'missing' && (
                                        <p className="lp-template-ai-missing">
                                          Cần bổ sung ·{' '}
                                          {p.reason ||
                                            'Nhập dữ liệu đã xác nhận và chọn vị trí để áp dụng.'}
                                          <small>Nội dung mẫu: {slot.current || '(trống)'}</small>
                                        </p>
                                      )}
                                      {p.source && (
                                        <small>
                                          {p.source === 'ai'
                                            ? 'Đề xuất AI'
                                            : p.source === 'user'
                                              ? 'Bạn đã chỉnh sửa'
                                              : 'Gợi ý tham khảo theo thông tin đã nhập'}
                                        </small>
                                      )}
                                      {p.validationIssue && (
                                        <small>
                                          {p.validationIssue === 'AI_SLOT_MISSING'
                                            ? 'AI chưa trả nội dung cho vị trí này. Hãy duyệt gợi ý tham khảo.'
                                            : 'Nội dung AI chưa đạt yêu cầu hoặc tạm thời chưa sẵn sàng. Hãy duyệt gợi ý tham khảo.'}
                                        </small>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </section>
                        );
                      })}
                    </div>
                    <footer className="lp-template-ai-footer">
                      <button type="button" disabled={busy} onClick={onClose}>
                        Hủy
                      </button>
                      <button
                        type="button"
                        className="lp-template-ai-primary-button"
                        disabled={busy || !selected.length || briefDirty}
                        onClick={() => void apply()}
                      >
                        <Check size={16} />
                        {busy ? 'Đang xử lý…' : `Áp dụng đã chọn (${selected.length})`}
                      </button>
                    </footer>
                  </>
                )
              )}
            </aside>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
