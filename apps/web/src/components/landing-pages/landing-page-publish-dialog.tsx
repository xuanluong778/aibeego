'use client';
import { useEffect, useState } from 'react';
import { Globe, Link as LinkIcon, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export type LandingPagePublishSelection = { publicationTarget: 'path' | 'subdomain'; subdomainSlug?: string };
type Options = { baseDomain: string; enabled: boolean; current: { label: string; hostname: string; url: string } | null; suggestedLabel: string; pathUrl: string };
type Availability = { available: boolean; label: string; hostname: string; message: string };

export function LandingPagePublishDialog({ open, pageId, publishing, onOpenChange, onPublish }: {
  open: boolean; pageId: string; publishing: boolean; onOpenChange: (value: boolean) => void;
  onPublish: (selection: LandingPagePublishSelection) => Promise<void>;
}) {
  const [options, setOptions] = useState<Options | null>(null);
  const [target, setTarget] = useState<'path' | 'subdomain'>('path');
  const [label, setLabel] = useState('');
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [checkError, setCheckError] = useState('');
  const busy = publishing || submitting;
  const normalized = label.trim().toLowerCase();
  const formatOk = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(normalized) && !normalized.startsWith('xn--');

  useEffect(() => {
    if (!open) return;
    let live = true;
    const abort = new AbortController();
    setOptions(null); setError(''); setAvailability(null); setCheckError('');
    apiClient<Options>(`/landing-pages/${encodeURIComponent(pageId)}/publication-options`, { signal: abort.signal })
      .then(data => { if (live) { setOptions(data); setLabel(data.suggestedLabel); setTarget(data.enabled ? 'subdomain' : 'path'); } })
      .catch(e => { if (live) setError(e instanceof Error ? e.message : 'Không tải được lựa chọn xuất bản.'); });
    return () => { live = false; abort.abort(); };
  }, [open, pageId]);

  useEffect(() => {
    setAvailability(null); setCheckError('');
    if (!open || !options?.enabled || target !== 'subdomain' || !formatOk) { setChecking(false); return; }
    let live = true;
    const abort = new AbortController();
    setChecking(true);
    const timer = window.setTimeout(() => {
      apiClient<Availability>(`/landing-pages/${encodeURIComponent(pageId)}/subdomain-availability?label=${encodeURIComponent(normalized)}`, { signal: abort.signal })
        .then(result => { if (live) setAvailability(result); })
        .catch(e => { if (live) setCheckError(e instanceof Error ? e.message : 'Không kiểm tra được tên. Vui lòng thử lại.'); })
        .finally(() => { if (live) setChecking(false); });
    }, 350);
    return () => { live = false; window.clearTimeout(timer); abort.abort(); };
  }, [open, options?.enabled, target, normalized, formatOk, pageId]);

  const canPublish = !!options && !busy && (target === 'path' || (options.enabled && formatOk && !checking && availability?.available === true && availability.label === normalized));
  async function submit() {
    if (!canPublish) return;
    setSubmitting(true); setError('');
    try {
      await onPublish(target === 'subdomain' ? { publicationTarget: 'subdomain', subdomainSlug: normalized } : { publicationTarget: 'path' });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không xuất bản được. Bản đang công khai vẫn được giữ nguyên.');
      if ((e as { code?: string })?.code === 'SUBDOMAIN_TAKEN' || (e as { code?: string })?.code === 'SUBDOMAIN_RESERVED') setAvailability(null);
    } finally { setSubmitting(false); }
  }
  return <Dialog open={open} onOpenChange={value => { if (!busy) onOpenChange(value); }}>
    <DialogContent data-lp-publish-dialog className="z-[100] w-[92vw] max-w-lg transition-none border-white/20 bg-[#0A3D30] text-white">
      <DialogHeader><DialogTitle>Xuất bản Landing Page</DialogTitle><DialogDescription className="text-white/70">Chọn địa chỉ để khách truy cập trang của bạn.</DialogDescription></DialogHeader>
      {error ? <div role="alert" className="rounded-lg border border-red-400/50 bg-red-950/30 p-3 text-sm text-red-100">{error}</div> : null}
      {!options ? <p role="status" className="text-sm text-white/70">{error ? 'Đóng cửa sổ và thử lại để tải lựa chọn xuất bản.' : 'Đang tải địa chỉ xuất bản…'}</p> : <div className="min-w-0 space-y-4">
        <label className={`flex gap-3 rounded-xl border p-4 ${target === 'subdomain' ? 'border-orange-400 bg-white/5' : 'border-white/20'} ${!options.enabled ? 'opacity-60' : ''}`}>
          <input type="radio" name="lp-publication-target" value="subdomain" checked={target === 'subdomain'} disabled={busy || !options.enabled} onChange={() => { setTarget('subdomain'); setError(''); }} className="mt-1" />
          <span className="min-w-0"><span className="flex items-center gap-2 font-semibold"><Globe className="h-4 w-4 shrink-0" /> Subdomain miễn phí</span><span className="mt-1 block break-words text-xs text-white/70">Địa chỉ riêng dạng ten-trang.{options.baseDomain}</span></span>
        </label>
        {!options.enabled ? <p className="text-xs text-amber-200" role="status">Địa chỉ miễn phí chưa sẵn sàng. Bạn vẫn có thể xuất bản bằng liên kết hiện có.</p> : null}
        {target === 'subdomain' ? <div className="min-w-0 space-y-2">
          <label htmlFor="lp-publish-subdomain" className="text-sm font-medium">Tên subdomain</label>
          <div className="flex min-w-0 items-center rounded-lg border border-white/20 bg-[#083028] px-2 sm:px-3">
            <span className="shrink-0 text-xs text-white/50">https://</span>
            <Input id="lp-publish-subdomain" value={label} maxLength={63} autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={busy} onChange={event => { setLabel(event.target.value.toLowerCase()); setError(''); }} aria-describedby="lp-subdomain-help lp-subdomain-result" aria-invalid={!!label && (!formatOk || availability?.available === false)} className="min-w-0 flex-1 border-0 px-1 focus-visible:ring-0 focus-visible:ring-offset-0" />
            <span className="shrink-0 text-xs text-white/75">.{options.baseDomain}</span>
          </div>
          <p id="lp-subdomain-help" className="text-xs text-white/60">3–63 ký tự: chữ a–z, số, dấu gạch ngang. Không nhập cả tên miền.</p>
          <div id="lp-subdomain-result" role="status" aria-live="polite" className={`flex min-h-5 gap-2 text-xs ${availability?.available ? 'text-emerald-300' : 'text-amber-200'}`}>
            {checking ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Đang kiểm tra tên…</> : !formatOk ? 'Nhập tên hợp lệ để kiểm tra.' : checkError || availability?.message || 'Đang chờ kiểm tra tên.'}
          </div>
          {options.current && options.current.label !== normalized ? <p className="break-words text-xs text-amber-200">Sau khi xuất bản, địa chỉ cũ {options.current.hostname} sẽ ngừng hoạt động.</p> : null}
        </div> : null}
        <label className={`flex gap-3 rounded-xl border p-4 ${target === 'path' ? 'border-orange-400 bg-white/5' : 'border-white/20'}`}>
          <input type="radio" name="lp-publication-target" value="path" checked={target === 'path'} disabled={busy} onChange={() => { setTarget('path'); setError(''); }} className="mt-1" />
          <span className="min-w-0"><span className="flex items-center gap-2 font-semibold"><LinkIcon className="h-4 w-4 shrink-0" /> Liên kết hiện có</span><span className="mt-1 block break-all text-xs text-white/70">{options.pathUrl}</span></span>
        </label>
        {target === 'path' && options.current ? <p className="break-words text-xs text-amber-200">Xuất bản bằng liên kết hiện có sẽ tháo subdomain {options.current.hostname} khỏi trang này.</p> : null}
      </div>}
      <div className="flex flex-wrap justify-end gap-2 pt-2"><Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Hủy</Button><Button data-lp-confirm-publish disabled={!canPublish} onClick={() => void submit()}>{busy ? 'Đang xuất bản…' : 'Xuất bản'}</Button></div>
    </DialogContent>
  </Dialog>;
}
