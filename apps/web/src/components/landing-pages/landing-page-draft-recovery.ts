import type { LandingPageSpec } from '@marketingspa/shared';

export type LocalLandingDraft = {
  pageId: string;
  spec: LandingPageSpec;
  /** Server revision this draft was based on. */
  baseRevision: number;
  clientRevision: number;
  savedAt: string;
};

const keyFor = (pageId: string) => `lp-draft-recovery:${pageId}`;

export type DraftRecoveryDecision = 'use-server' | 'restore-local' | 'conflict';

/** Local draft is restored only when the server has not moved since this tab's last ack. */
export function decideDraftRecovery(input: {
  serverRevision: number;
  local: LocalLandingDraft | null;
}): DraftRecoveryDecision {
  const local = input.local;
  if (!local) return 'use-server';
  if (!Number.isFinite(local.clientRevision) || local.clientRevision <= input.serverRevision) {
    return 'use-server';
  }
  if (local.baseRevision === input.serverRevision) return 'restore-local';
  return 'conflict';
}

export function readLocalLandingDraft(pageId: string): LocalLandingDraft | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(keyFor(pageId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalLandingDraft;
    if (!parsed || parsed.pageId !== pageId || !parsed.spec || typeof parsed.spec !== 'object') return null;
    if (!Number.isFinite(parsed.clientRevision) || !Number.isFinite(parsed.baseRevision)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeLocalLandingDraft(draft: LocalLandingDraft) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(keyFor(draft.pageId), JSON.stringify(draft));
  } catch {
    /* quota or private mode — server autosave remains the source of truth */
  }
}

export function clearLocalLandingDraft(pageId: string) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(keyFor(pageId));
  } catch {
    /* ignore */
  }
}
