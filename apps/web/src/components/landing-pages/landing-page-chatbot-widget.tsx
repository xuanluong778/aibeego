'use client';

import Image from 'next/image';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

const LP_CHATBOT_FAB_ICON = '/landing-page-assets/lp-chatbot-fab-icon.png';
import type { LandingPageChatbotPublicConfig } from '@marketingspa/shared';
import { getApiBaseUrl } from '@/lib/api-client';

type Msg = { role: 'bot' | 'user' | 'sys'; text: string };

type Props = {
  slug: string;
  pageId: string;
  organizationId?: string;
  previewMode?: boolean;
  previewToken?: string;
  staticConfig?: LandingPageChatbotPublicConfig;
  embedInContainer?: boolean;
};

function sessionKey(pageId: string, preview: boolean) {
  return `lp_chat_${preview ? 'pv' : 'pub'}_${pageId}`;
}

export function LandingPageChatbotWidget({
  slug,
  pageId,
  organizationId,
  previewMode,
  previewToken,
  staticConfig,
  embedInContainer,
}: Props) {
  const mountId = useId();
  const api = useMemo(() => getApiBaseUrl(), []);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLead, setShowLead] = useState(false);
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [dismissedLead, setDismissedLead] = useState(false);
  const [leadNeed, setLeadNeed] = useState('');
  const [leadSending, setLeadSending] = useState(false);
  const [leadDone, setLeadDone] = useState(false);
  const [greeted, setGreeted] = useState(false);
  const [duplicateMount, setDuplicateMount] = useState(false);
  const inflight = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);

  const cfg = staticConfig;
  const enabled = Boolean(cfg?.enabled);

  const [sessionId, setSessionId] = useState('');
  useEffect(() => {
    try {
      const key = sessionKey(pageId, Boolean(previewMode));
      let sid = localStorage.getItem(key) || '';
      if (!sid) {
        sid = `${previewMode ? 'pv' : 'lp'}-${Math.random().toString(36).slice(2, 12)}`;
        localStorage.setItem(key, sid);
      }
      setSessionId(sid);
    } catch {
      setSessionId(`lp-${Date.now().toString(36)}`);
    }
  }, [pageId, previewMode]);

  const positionStyle = useMemo(() => {
    const isLeft = cfg?.position === 'bottom-left';
    if (embedInContainer) {
      return {
        position: 'absolute' as const,
        [isLeft ? 'left' : 'right']: 12,
        bottom: 12,
      };
    }
    return {
      position: 'fixed' as const,
      [isLeft ? 'left' : 'right']: 16,
      bottom: 16,
      zIndex: 1200,
    };
  }, [cfg?.position, embedInContainer]);

  useEffect(() => {
    if (embedInContainer || typeof document === 'undefined') return;
    const attr = 'data-lp-chatbot-active';
    if (document.body.getAttribute(attr)) {
      setDuplicateMount(true);
      return;
    }
    document.body.setAttribute(attr, pageId);
    return () => {
      if (document.body.getAttribute(attr) === pageId) document.body.removeAttribute(attr);
    };
  }, [embedInContainer, pageId]);

  const append = useCallback((m: Msg) => setMsgs((prev) => [...prev, m]), []);

  const bootstrapGreeting = useCallback(() => {
    if (greeted || !cfg) return;
    setGreeted(true);
    append({ role: 'bot', text: cfg.greeting });
  }, [append, cfg, greeted]);

  useEffect(() => {
    if (open) bootstrapGreeting();
  }, [open, bootstrapGreeting]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    const list = messageListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [msgs.length, loading, showLead, open]);

  if (!enabled || !cfg || duplicateMount) return null;

  const qs = new URLSearchParams();
  if (organizationId) qs.set('organizationId', organizationId);
  if (previewMode && previewToken) qs.set('previewToken', previewToken);
  const q = qs.toString() ? `?${qs}` : '';

  async function submitLead() {
    if (previewMode) return;
    const phone = leadPhone.trim();
    const email = leadEmail.trim();
    if ((!phone && !email) || leadSending) return;
    setLeadSending(true);
    try {
      const r = await fetch(`${api}/landing-pages/public/${encodeURIComponent(slug)}/chatbot/lead${q}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: leadName.trim() || 'Khách chatbot',
          phone: phone || undefined,
          email: email || undefined,
          need: leadNeed.trim() || undefined,
          sessionId,
          pageUrl: typeof window !== 'undefined' ? window.location.href : '',
        }),
      });
      const data = (await r.json()) as { ok?: boolean; preview?: boolean; message?: string };
      if (data.preview) {
        append({ role: 'sys', text: 'Preview: không ghi lead.' });
      } else if (data.ok) {
        setLeadDone(true);
        append({ role: 'bot', text: data.message || 'Cảm ơn bạn!' });
      } else {
        append({ role: 'sys', text: data.message || 'Gửi lead thất bại.' });
      }
    } catch {
      append({ role: 'sys', text: 'Lỗi mạng khi gửi lead.' });
    } finally {
      setLeadSending(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || loading || inflight.current) return;
    inflight.current = true;
    setLoading(true);
    setError(null);
    setShowLead(false);
    setInput('');
    append({ role: 'user', text });

    try {
      const r = await fetch(`${api}/landing-pages/public/${encodeURIComponent(slug)}/chatbot/message${q}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionId,
          pageUrl: typeof window !== 'undefined' ? window.location.href : '',
          previewToken: previewMode ? previewToken : undefined,
        }),
      });
      const data = (await r.json()) as {
        ok?: boolean;
        reply?: string;
        show_lead?: boolean;
        contact_requested?: boolean;
        message?: string;
      };
      if (!data.ok || !data.reply) {
        const err = data.message || 'Không gửi được. Thử lại sau.';
        setError(err);
        append({ role: 'sys', text: err });
      } else {
        append({ role: 'bot', text: data.reply });
        if (data.contact_requested) setDismissedLead(false);
        setShowLead(Boolean(data.show_lead && cfg.enableHandoff && (!dismissedLead || data.contact_requested)));
      }
    } catch {
      const err = 'Lỗi mạng. Vui lòng thử lại.';
      setError(err);
      append({ role: 'sys', text: err });
    } finally {
      setLoading(false);
      inflight.current = false;
    }
  }

  return (
    <div
      ref={rootRef}
      id={`lp-cb-${mountId}`}
      className="pointer-events-auto font-sans text-[13px] leading-snug text-slate-900"
      style={positionStyle}
      data-lp-chatbot="1"
    >
      {!open ? (
        <button
          type="button"
          aria-label="Mở chatbot"
          className="relative h-16 w-16 overflow-hidden rounded-full shadow-lg ring-2 ring-white/90 transition-transform hover:scale-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ outlineColor: cfg.accentColor }}
          onClick={() => setOpen(true)}
        >
          <Image
            src={LP_CHATBOT_FAB_ICON}
            alt=""
            width={64}
            height={64}
            className="h-full w-full object-cover"
            priority
          />
        </button>
      ) : (
        <div
          className="flex w-[min(340px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          style={{ maxHeight: embedInContainer ? 320 : 'min(520px, calc(100vh - 120px))' }}
        >
          <div
            className="flex items-center gap-2 px-3 py-2.5 text-white"
            style={{ background: cfg.primaryColor }}
          >
            <Image
              src={LP_CHATBOT_FAB_ICON}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-white/40"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{cfg.displayName}</div>
              {cfg.hotline ? (
                <div className="truncate text-[11px] opacity-85">Hotline: {cfg.hotline}</div>
              ) : null}
            </div>
            <button
              type="button"
              className="rounded-md bg-white/15 px-2 py-1 text-sm"
              onClick={() => setOpen(false)}
              aria-label="Đóng"
            >
              ×
            </button>
          </div>

          <div ref={messageListRef} className="min-h-16 flex-1 space-y-2 overflow-y-auto bg-slate-50 p-3">
            {msgs.map((m, i) => (
              <div
                key={`${i}-${m.role}`}
                className={`max-w-[92%] whitespace-pre-wrap break-words rounded-xl px-3 py-2 ${
                  m.role === 'user'
                    ? 'ml-auto text-white'
                    : m.role === 'sys'
                      ? 'border border-amber-200 bg-amber-50 text-amber-900'
                      : 'border border-slate-200 bg-white'
                }`}
                style={m.role === 'user' ? { background: cfg.primaryColor } : undefined}
              >
                {m.text}
              </div>
            ))}
            {loading ? (
              <div className="text-xs text-slate-500">Đang trả lời…</div>
            ) : null}
            {error ? (
              <button
                type="button"
                className="text-xs font-medium text-emerald-700 underline"
                onClick={() => setError(null)}
              >
                Thử lại
              </button>
            ) : null}
          </div>

          {showLead && cfg.enableHandoff && !leadDone ? (
            <form
              className="max-h-[260px] shrink-0 space-y-2 overflow-y-auto border-t border-slate-200 bg-white p-2"
              data-lp-chatbot-handoff
              onSubmit={(e) => {
                e.preventDefault();
                void submitLead();
              }}
            >
              {previewMode ? (
                <p className="text-[11px] text-amber-700">Xem trước — không ghi lead thật.</p>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-slate-600">Nhân viên liên hệ qua email hoặc điện thoại.</p>
                    <button type="button" aria-label="Để sau, tiếp tục trò chuyện" className="shrink-0 text-xs text-emerald-700 underline" onClick={() => { setShowLead(false); setDismissedLead(true); }}>Để sau</button>
                  </div>
                  <input
                    aria-label="Họ tên"
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    placeholder="Họ tên"
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                  />
                  <input
                    aria-label="Số điện thoại"
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    placeholder="Số điện thoại"
                    inputMode="tel"
                    value={leadPhone}
                    onChange={(e) => setLeadPhone(e.target.value)}
                  />
                  <input
                    aria-label="Email"
                    type="email"
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    placeholder="Email (nếu muốn được tư vấn qua email)"
                    value={leadEmail}
                    onChange={(e) => setLeadEmail(e.target.value)}
                  />
                  <details className="text-xs text-slate-600">
                    <summary className="cursor-pointer py-1">Bổ sung nhu cầu (tuỳ chọn)</summary>
                  <textarea
                    aria-label="Nhu cầu"
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                    rows={2}
                    placeholder="Nhu cầu (tuỳ chọn)"
                    value={leadNeed}
                    onChange={(e) => setLeadNeed(e.target.value)}
                  />
                  </details>
                  <button
                    type="submit"
                    disabled={leadSending || (!leadPhone.trim() && !leadEmail.trim()) || Boolean(leadPhone.trim() && !/^\+?[0-9(). -]{6,32}$/.test(leadPhone.trim())) || Boolean(leadEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail.trim()))}
                    className="w-full rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: cfg.accentColor }}
                  >
                    {leadSending ? 'Đang gửi…' : 'Gửi cho nhân viên'}
                  </button>
                </>
              )}
            </form>
          ) : null}
          {leadDone ? (
            <div className="border-t border-slate-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              Đã ghi nhận. Nhân viên sẽ liên hệ sớm.
            </div>
          ) : null}

          <div className="flex gap-2 border-t border-slate-200 bg-white p-2">
            <input
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-2 text-sm"
              value={input}
              placeholder="Nhập câu hỏi…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button
              type="button"
              disabled={loading}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: cfg.accentColor }}
              onClick={() => void send()}
            >
              Gửi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}