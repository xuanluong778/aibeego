'use client';

import { useId, useMemo } from 'react';
import {
  buildLandingPageChatbotPublicConfig,
  defaultLandingPageChatbotConfig,
  sanitizeLandingPageChatbotConfig,
  validateLandingPageChatbotConfigLocal,
  type LandingPageChatbotConfig,
  type LandingPageSpec,
} from '@marketingspa/shared';
import { useChatbotBots, useChatbotKnowledge } from '@/hooks/use-chatbot-cskh';
import { useRagKnowledgeBases, useSharedKnowledgeBots } from '@/hooks/use-rag-kb';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LandingPageChatbotWidget } from '@/components/landing-pages/landing-page-chatbot-widget';
import { LandingPageInlineAiField } from '@/components/landing-pages/landing-page-inline-ai-field';

type Props = {
  spec: LandingPageSpec;
  pageId: string;
  slug: string;
  previewToken?: string | null;
  onChange: (next: LandingPageSpec) => void;
};

export function LandingPageChatbotInspector({ spec, pageId, slug, previewToken, onChange }: Props) {
  const fieldId = useId();
  const cfg = useMemo(
    () => sanitizeLandingPageChatbotConfig(spec.chatbot, { mode: 'draft' }) ?? defaultLandingPageChatbotConfig(),
    [spec.chatbot],
  );
  const bots = useChatbotBots({ refetchOnWindowFocus: 'always' });
  const sharedBots = useSharedKnowledgeBots();
  const ragBases = useRagKnowledgeBases();
  const knowledge = useChatbotKnowledge(cfg.botId, { refetchOnWindowFocus: 'always' });

  const readySources = useMemo(
    () => (knowledge.data ?? []).filter((s) => ['ready', 'active'].includes(s.status)),
    [knowledge.data],
  );

  const scopedReady = useMemo(() => {
    if (!cfg.knowledgeSourceIds?.length) return readySources;
    const allow = new Set(cfg.knowledgeSourceIds);
    return readySources.filter((s) => allow.has(s.id));
  }, [cfg.knowledgeSourceIds, readySources]);

  const sharedKbReadyCount = useMemo(() => {
    const kbId = sharedBots.data?.find((bot) => bot.id === cfg.botId)?.knowledgeBaseId;
    if (!kbId) return 0;
    const kb = ragBases.data?.find((row) => row.id === kbId);
    return (kb?.documents ?? []).filter((doc) => ['ready', 'active'].includes(doc.status)).length;
  }, [cfg.botId, sharedBots.data, ragBases.data]);

  const validation = validateLandingPageChatbotConfigLocal(cfg, {
    requireKnowledge: cfg.enabled,
    knowledgeCount: scopedReady.length + sharedKbReadyCount,
  });

  const patch = (partial: Partial<LandingPageChatbotConfig>) => {
    const merged = sanitizeLandingPageChatbotConfig({ ...cfg, ...partial }, { mode: 'draft' });
    if (!merged) {
      const { chatbot: _drop, ...rest } = spec;
      void _drop;
      onChange(rest);
      return;
    }
    onChange({ ...spec, chatbot: merged });
  };

  const selectedBot = bots.data?.find((bot) => bot.id === cfg.botId);
  const heroBlock = spec.blocks.find((block) => block.type === 'Hero');
  const hero = heroBlock?.type === 'Hero' ? heroBlock : undefined;
  // Bound each part so the bot setup and page context both reach the AI prompt.
  const greetingContextData = {
    displayName: cfg.displayName?.slice(0, 80),
    businessName: selectedBot?.businessName?.slice(0, 100),
    botName: selectedBot?.botName?.slice(0, 80),
    industry: selectedBot?.industry?.slice(0, 80),
    mainServices: selectedBot?.mainServices?.slice(0, 220),
    consultationTone: selectedBot?.consultationTone?.slice(0, 80),
    botGreeting: selectedBot?.greeting?.slice(0, 160),
    knowledge: scopedReady.slice(0, 3).map((source) => ({
      title: source.title.slice(0, 50),
      content: source.content?.replace(/\s+/g, ' ').slice(0, 80),
    })),
    pageTitle: spec.seo.title?.slice(0, 100),
    pageDescription: spec.seo.metaDescription?.slice(0, 160),
    headline: hero?.headline?.slice(0, 100),
    subheadline: hero?.subheadline?.slice(0, 160),
  };
  const fullGreetingContext = JSON.stringify(greetingContextData);
  const greetingContext = fullGreetingContext.length <= 2000 ? fullGreetingContext
    : JSON.stringify(greetingContextData, (_key, value) => typeof value === 'string' ? value.slice(0, 40) : value);
  const createBotUrl = '/chatbot-cskh?action=create';
  const knowledgeUrl = `/settings?tab=knowledge${cfg.botId ? `&botId=${encodeURIComponent(cfg.botId)}` : ''}`;
  const selectedBotUrl = selectedBot ? `/chatbot-cskh?botId=${encodeURIComponent(selectedBot.id)}` : null;
  const setupAction = !selectedBot || !selectedBotUrl
    ? { label: 'Tạo chatbot', href: createBotUrl, action: 'create' }
    : selectedBot.status !== 'ACTIVE'
      ? { label: 'Kích hoạt chatbot', href: `${selectedBotUrl}&action=activate`, action: 'activate' }
      : !knowledge.isPending && !knowledge.isError && readySources.length === 0
        ? { label: 'Thêm tri thức', href: knowledgeUrl, action: 'knowledge' }
        : { label: 'Chỉnh sửa chatbot', href: `${selectedBotUrl}&action=edit`, action: 'edit' };

  const readyForPreview =
    selectedBot?.status === 'ACTIVE' &&
    scopedReady.length + sharedKbReadyCount > 0 &&
    !knowledge.isFetching &&
    !sharedBots.isFetching &&
    !ragBases.isFetching;
  const errors = [...validation.errors];
  if (cfg.enabled && selectedBot && selectedBot.status !== 'ACTIVE') {
    errors.push('Bot đang ở trạng thái nháp hoặc tạm dừng. Kích hoạt bot tại Chatbot CSKH trước khi xuất bản.');
  }

  const previewPublic = buildLandingPageChatbotPublicConfig({
    pageId,
    slug,
    config: { ...cfg, enabled: readyForPreview && cfg.enabled },
    fallbackBotName: cfg.displayName || 'Trợ lý',
    fallbackGreeting: cfg.greeting,
  });

  return (
    <div className="space-y-3" data-lp-inspector-chatbot>
      <label className="flex cursor-pointer items-center justify-between gap-2 text-xs">
        <span>Bật chatbot trên trang</span>
        <span className="relative inline-flex h-6 w-11 shrink-0">
          <input
            type="checkbox"
            role="switch"
            className="peer sr-only"
            checked={cfg.enabled}
            onChange={(e) => patch({ enabled: e.target.checked })}
          />
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-white/20 transition-colors peer-checked:bg-emerald-500 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-300 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-emerald-950"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5"
          />
        </span>
      </label>

      <p className="text-xs text-white/60">
        Bật để cấu hình chatbot. Trước khi xuất bản, chọn bot đang hoạt động và có nguồn tri thức sẵn sàng.
      </p>

      <div>
        <Label htmlFor={`${fieldId}-bot`} className="text-xs">Bot CSKH</Label>
        <select
          id={`${fieldId}-bot`}
          className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-2 py-1.5 text-xs text-white"
          value={cfg.botId || ''}
          onChange={(e) => {
            const botId = e.target.value || undefined;
            patch({ botId, knowledgeSourceIds: [] });
          }}
        >
          <option value="">— Chọn bot —</option>
          {(bots.data ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.botName} {b.status !== 'ACTIVE' ? `(${b.status})` : ''}
            </option>
          ))}
        </select>
      </div>

      {bots.isPending ? <p role="status" className="text-xs text-white/60">Đang tải danh sách bot…</p> : null}
      {bots.isError ? (
        <p role="alert" className="text-xs text-amber-200">
          Không tải được danh sách bot. <button type="button" className="underline" onClick={() => void bots.refetch()}>Thử lại</button>
        </p>
      ) : null}
      {!bots.isPending && !bots.isError && !bots.data?.length ? (
        <p className="text-xs text-amber-200">Bạn chưa có bot CSKH. Tạo bot và thêm tri thức để sử dụng trên trang.</p>
      ) : null}
      <div className="space-y-2" data-lp-chatbot-setup>
        <a
          href={setupAction.href}
          target="_blank"
          rel="noopener noreferrer"
          data-lp-chatbot-setup-action={setupAction.action}
          className="inline-flex min-h-10 w-full items-center justify-center rounded-md bg-emerald-400 px-3 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200"
        >
          {setupAction.label}
        </a>
        {selectedBot ? (
          <a href={createBotUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-xs text-emerald-200 underline">
            Tạo chatbot mới
          </a>
        ) : null}
        {cfg.botId ? <a href={knowledgeUrl} target="_blank" rel="noopener noreferrer" className="block text-xs text-emerald-200 underline">Quản lý kho tri thức</a> : null}
        <p className="text-xs text-white/60">Sau khi hoàn tất, quay lại tab Landing Page để tiếp tục.</p>
      </div>

      {cfg.botId ? (
        <details>
          <summary className="cursor-pointer text-xs font-medium">Giới hạn nguồn cho Landing Page (tuỳ chọn)</summary>
          <div className="mt-2 space-y-2">
          <Label className="text-xs">Phạm vi tri thức (sơ đồ / nguồn sẵn sàng)</Label>
          <p className="mb-1 text-[10px] text-white/50">Bỏ trống = toàn bộ nguồn ready của bot.</p>
          <div className="max-h-36 space-y-1 overflow-auto rounded border border-white/10 p-2">
            {knowledge.isPending ? (
              <p role="status" className="text-xs text-white/60">Đang tải nguồn tri thức…</p>
            ) : knowledge.isError ? (
              <p role="alert" className="text-xs text-amber-200">Không tải được nguồn tri thức. <button type="button" className="underline" onClick={() => void knowledge.refetch()}>Thử lại</button></p>
            ) : readySources.length === 0 ? (
              <p className="text-xs text-amber-200/80">
                Bot chưa có tri thức sẵn sàng.{' '}
                {selectedBotUrl ? (
                  <a href={knowledgeUrl} target="_blank" rel="noopener noreferrer" className="underline">
                    Thêm tri thức cho bot này
                  </a>
                ) : null}
              </p>
            ) : (
              readySources.map((s) => {
                const checked =
                  !cfg.knowledgeSourceIds?.length || cfg.knowledgeSourceIds.includes(s.id);
                return (
                  <label key={s.id} className="flex items-start gap-2 text-[11px] leading-snug">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const all = readySources.map((x) => x.id);
                        let next: string[];
                        if (!cfg.knowledgeSourceIds?.length) {
                          next = e.target.checked ? all : all.filter((id) => id !== s.id);
                        } else if (e.target.checked) {
                          next = [...new Set([...cfg.knowledgeSourceIds, s.id])];
                        } else {
                          next = cfg.knowledgeSourceIds.filter((id) => id !== s.id);
                        }
                        if (next.length === all.length) patch({ knowledgeSourceIds: undefined });
                        else patch({ knowledgeSourceIds: next });
                      }}
                    />
                    <span>
                      <strong>{s.title}</strong>
                      <span className="block opacity-60">{s.sourceType}</span>
                    </span>
                  </label>
                );
              })
            )}
          </div>
          </div>
        </details>
      ) : null}

      <div>
        <Label htmlFor={`${fieldId}-displayName`} className="text-xs">Tên hiển thị</Label>
        <Input
          className="mt-1 h-8 text-xs"
          id={`${fieldId}-displayName`}
          maxLength={80}
          value={cfg.displayName || ''}
          onChange={(e) => patch({ displayName: e.target.value })}
          placeholder="Trợ lý tư vấn"
        />
      </div>

      <div data-lp-chatbot-greeting-ai>
        <LandingPageInlineAiField
          pageId={pageId}
          label="Lời chào"
          inputId={`${fieldId}-greeting`}
          fieldKind="chatbot.greeting"
          blockType="Hero"
          requestKey={`${pageId}:chatbot:${cfg.botId || 'none'}:greeting`}
          value={cfg.greeting || ''}
          onChange={(greeting) => patch({ greeting })}
          blockContext={greetingContext}
          directSuggest
          multiline
          rows={3}
          maxLength={500}
          placeholder="Xin chào! Tôi có thể giúp gì?"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Màu chính</Label>
          <Input
            type="color"
            className="mt-1 h-8 w-full p-0"
            value={cfg.primaryColor || '#0B2115'}
            onChange={(e) => patch({ primaryColor: e.target.value })}
          />
        </div>
        <div>
          <Label className="text-xs">Màu nút</Label>
          <Input
            type="color"
            className="mt-1 h-8 w-full p-0"
            value={cfg.accentColor || '#22c55e'}
            onChange={(e) => patch({ accentColor: e.target.value })}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs">Vị trí</Label>
        <select
          className="mt-1 w-full rounded-md border border-white/10 bg-zinc-900 px-2 py-1.5 text-xs text-white"
          value={cfg.position || 'bottom-right'}
          onChange={(e) =>
            patch({
              position: e.target.value === 'bottom-left' ? 'bottom-left' : 'bottom-right',
            })
          }
        >
          <option value="bottom-right">Góc phải dưới</option>
          <option value="bottom-left">Góc trái dưới</option>
        </select>
      </div>

      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={cfg.enableHandoff !== false}
          onChange={(e) => patch({ enableHandoff: e.target.checked })}
        />
        Cho phép chuyển nhân viên / thu lead
      </label>

      {errors.length > 0 && !knowledge.isFetching ? (
        <ul className="list-inside list-disc text-[10px] text-amber-200/90">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}

      <div className="relative overflow-hidden rounded-lg border border-white/10 bg-zinc-950 p-2">
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-white/50">Xem trước widget</p>
        <div className="relative min-h-[220px] overflow-hidden rounded bg-gradient-to-b from-zinc-800/40 to-zinc-900">
          {previewPublic ? (
            <LandingPageChatbotWidget
              slug={slug}
              pageId={pageId}
              previewMode
              previewToken={previewToken ?? undefined}
              staticConfig={previewPublic}
              embedInContainer
            />
          ) : (
            <p className="p-4 text-[11px] text-white/40">Bật và cấu hình hợp lệ để xem trước.</p>
          )}
        </div>
      </div>
    </div>
  );
}
