import type { LandingPageBlock } from '@marketingspa/shared';

/** Legacy registration presets used floats and section zoom; keep their two blocks in one bounded row. */
export function isRegistrationPair(first: LandingPageBlock, second?: LandingPageBlock): boolean {
  if (!second || first.type !== 'Countdown' || second.type !== 'LeadForm') return false;
  return [first, second].every(block => block.enabled !== false && !block.hidden &&
    block.positionMode !== 'free' && !block.sectionPlacement &&
    /--lp-registration-(?:float|width|scale)\b/.test(String((block.style as Record<string, unknown> | undefined)?.customCss || '')));
}
