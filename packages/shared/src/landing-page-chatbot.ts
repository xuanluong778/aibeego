/**
 * Landing page — page-level chatbot (builder + public), reuses CSKH bots/knowledge.
 */

export const LANDING_PAGE_CHATBOT_POSITIONS = ['bottom-right', 'bottom-left'] as const;
export type LandingPageChatbotPosition = (typeof LANDING_PAGE_CHATBOT_POSITIONS)[number];

export type LandingPageChatbotConfig = {
  /** Default false — widget hidden until explicitly enabled + valid on publish. */
  enabled: boolean;
  botId?: string;
  /** Subset of bot knowledge source ids; empty/omit = all ready sources on the bot. */
  knowledgeSourceIds?: string[];
  displayName?: string;
  greeting?: string;
  primaryColor?: string;
  accentColor?: string;
  position?: LandingPageChatbotPosition;
  /** Show staff handoff / lead capture when configured on bot. */
  enableHandoff?: boolean;
};

export type LandingPageChatbotPublicConfig = {
  enabled: boolean;
  displayName: string;
  greeting: string;
  primaryColor: string;
  accentColor: string;
  position: LandingPageChatbotPosition;
  enableHandoff: boolean;
  hotline?: string;
  pageId: string;
  slug: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function clampColor(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string' || !raw.trim()) return fallback;
  const v = raw.trim().slice(0, 32);
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return v;
  if (/^rgb(a)?\([^)]{0,120}\)$/i.test(v)) return v;
  return fallback;
}

function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v.trim());
}

export function defaultLandingPageChatbotConfig(): LandingPageChatbotConfig {
  return {
    enabled: false,
    position: 'bottom-right',
    enableHandoff: true,
    primaryColor: '#0B2115',
    accentColor: '#22c55e',
  };
}

export function sanitizeLandingPageChatbotConfig(
  raw: unknown,
  options?: { mode?: 'draft' | 'persist' },
): LandingPageChatbotConfig | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const base = defaultLandingPageChatbotConfig();
  const enabled = o.enabled === true;
  const botId = isUuid(o.botId) ? o.botId.trim() : undefined;
  const knowledgeSourceIds = Array.isArray(o.knowledgeSourceIds)
    ? o.knowledgeSourceIds.filter((id): id is string => isUuid(id)).slice(0, 64)
    : undefined;
  // Live controlled fields must keep spaces and IME text until persistence.
  const text = (value: unknown, max: number) => typeof value === 'string'
    ? (options?.mode === 'draft' ? value : value.trim()).slice(0, max)
    : undefined;
  const displayName = text(o.displayName, 80);
  const greeting = text(o.greeting, 500);
  const position: LandingPageChatbotPosition =
    o.position === 'bottom-left' || o.position === 'bottom-right' ? o.position : base.position!;
  const enableHandoff = o.enableHandoff !== false;
  const out: LandingPageChatbotConfig = {
    // Preserve the user setting while configuring; publish validates the binding.
    enabled,
    ...(botId ? { botId } : {}),
    ...(knowledgeSourceIds?.length ? { knowledgeSourceIds } : {}),
    ...(displayName ? { displayName } : {}),
    ...(greeting ? { greeting } : {}),
    primaryColor: clampColor(o.primaryColor, base.primaryColor!),
    accentColor: clampColor(o.accentColor, base.accentColor!),
    position,
    enableHandoff,
  };
  if (!out.enabled && !botId && !displayName && !greeting && !o.enabled) {
    return undefined;
  }
  return out;
}

/** Drop org-scoped bot bindings (templates / cross-tenant clones). */
export function stripLandingPageChatbotOrgBindings(
  config?: LandingPageChatbotConfig | null,
): LandingPageChatbotConfig | undefined {
  if (!config) return undefined;
  return {
    ...defaultLandingPageChatbotConfig(),
    ...(config.displayName ? { displayName: config.displayName } : {}),
    ...(config.greeting ? { greeting: config.greeting } : {}),
    ...(config.primaryColor ? { primaryColor: config.primaryColor } : {}),
    ...(config.accentColor ? { accentColor: config.accentColor } : {}),
    ...(config.position ? { position: config.position } : {}),
    enableHandoff: config.enableHandoff !== false,
    enabled: false,
  };
}

export function validateLandingPageChatbotConfigLocal(
  config?: LandingPageChatbotConfig | null,
  opts?: { requireKnowledge?: boolean; knowledgeCount?: number },
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!config?.enabled) return { ok: true, errors: [] };
  if (!config.botId) errors.push('Chọn bot CSKH trước khi bật chatbot.');
  const kCount = opts?.knowledgeCount ?? 0;
  if (opts?.requireKnowledge && kCount < 1) {
    errors.push('Bot cần ít nhất một nguồn tri thức ở trạng thái sẵn sàng trong phạm vi đã chọn.');
  }
  if (config.knowledgeSourceIds?.length && config.knowledgeSourceIds.length > 64) {
    errors.push('Phạm vi tri thức quá lớn.');
  }
  return { ok: errors.length === 0, errors };
}

export function buildLandingPageChatbotPublicConfig(input: {
  pageId: string;
  slug: string;
  config: LandingPageChatbotConfig;
  fallbackBotName?: string;
  fallbackGreeting?: string;
  hotline?: string;
}): LandingPageChatbotPublicConfig | null {
  if (!input.config.enabled || !input.config.botId) return null;
  const base = defaultLandingPageChatbotConfig();
  return {
    enabled: true,
    pageId: input.pageId,
    slug: input.slug,
    displayName: (input.config.displayName || input.fallbackBotName || 'Trợ lý').slice(0, 80),
    greeting: (input.config.greeting || input.fallbackGreeting || 'Xin chào! Tôi có thể hỗ trợ gì cho bạn?').slice(
      0,
      500,
    ),
    primaryColor: input.config.primaryColor || base.primaryColor!,
    accentColor: input.config.accentColor || base.accentColor!,
    position: input.config.position || 'bottom-right',
    enableHandoff: input.config.enableHandoff !== false,
    ...(input.hotline ? { hotline: input.hotline.slice(0, 64) } : {}),
  };
}