import { BadRequestException } from '@nestjs/common';
import { LandingPageDomainStatus } from '@marketingspa/database';

const TRIAL_DENY_CODE = 'LP_CHATBOT_TRIAL_ORG_DENIED';
const CUSTOM_DOMAIN_HOLD_CODE = 'LP_CHATBOT_CUSTOM_DOMAIN_HOLD';

function trialEnforced(): boolean {
  return process.env.LP_CHATBOT_TRIAL_ENFORCE === '1';
}

function trialOrgAllowlist(): Set<string> {
  const raw = (process.env.LP_CHATBOT_TRIAL_ORG_IDS || '').trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[,;\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Trial gate: only listed orgs may enable/publish/use LP chatbot when LP_CHATBOT_TRIAL_ENFORCE=1. */
export function lpChatbotOrgTrialAllowed(organizationId: string): boolean {
  if (!trialEnforced()) return true;
  const org = String(organizationId || '').trim().toLowerCase();
  if (!org) return false;
  return trialOrgAllowlist().has(org);
}

export function assertLpChatbotOrgTrialAllowed(organizationId: string): void {
  if (lpChatbotOrgTrialAllowed(organizationId)) return;
  throw new BadRequestException({
    code: TRIAL_DENY_CODE,
    message:
      'Chatbot landing page đang thử nghiệm nội bộ. Liên hệ quản trị để được mở org canary.',
  });
}

type CustomDomainRow = {
  customDomain: string | null;
  customDomainStatus: LandingPageDomainStatus | null;
};

/**
 * Block public chatbot on custom domain until host E2E is signed off.
 * Does not affect page render, lead forms, or DNS — widget/API chat only.
 * Set LP_CHATBOT_CUSTOM_DOMAIN_E2E_PASS=1 to allow ACTIVE custom domains (still uses origin hotlink).
 */
export function lpChatbotPublicBlockedForCustomDomain(row: CustomDomainRow): boolean {
  const domain = String(row.customDomain || '').trim();
  if (!domain) return false;
  if (process.env.LP_CHATBOT_CUSTOM_DOMAIN_E2E_PASS === '1') {
    return row.customDomainStatus !== LandingPageDomainStatus.ACTIVE;
  }
  return true;
}

export function lpChatbotPublicDenyCode(
  organizationId: string,
  row: CustomDomainRow,
  options?: { preview?: boolean },
): string | null {
  if (!lpChatbotOrgTrialAllowed(organizationId)) return TRIAL_DENY_CODE;
  if (!options?.preview && lpChatbotPublicBlockedForCustomDomain(row)) {
    return CUSTOM_DOMAIN_HOLD_CODE;
  }
  return null;
}