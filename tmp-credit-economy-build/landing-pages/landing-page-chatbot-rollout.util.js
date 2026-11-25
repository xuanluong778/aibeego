"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lpChatbotOrgTrialAllowed = lpChatbotOrgTrialAllowed;
exports.assertLpChatbotOrgTrialAllowed = assertLpChatbotOrgTrialAllowed;
exports.lpChatbotPublicBlockedForCustomDomain = lpChatbotPublicBlockedForCustomDomain;
exports.lpChatbotPublicDenyCode = lpChatbotPublicDenyCode;
const common_1 = require("@nestjs/common");
const database_1 = require("@marketingspa/database");
const TRIAL_DENY_CODE = 'LP_CHATBOT_TRIAL_ORG_DENIED';
const CUSTOM_DOMAIN_HOLD_CODE = 'LP_CHATBOT_CUSTOM_DOMAIN_HOLD';
function trialEnforced() {
    return process.env.LP_CHATBOT_TRIAL_ENFORCE === '1';
}
function trialOrgAllowlist() {
    const raw = (process.env.LP_CHATBOT_TRIAL_ORG_IDS || '').trim();
    if (!raw)
        return new Set();
    return new Set(raw
        .split(/[,;\s]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean));
}
/** Trial gate: only listed orgs may enable/publish/use LP chatbot when LP_CHATBOT_TRIAL_ENFORCE=1. */
function lpChatbotOrgTrialAllowed(organizationId) {
    if (!trialEnforced())
        return true;
    const org = String(organizationId || '').trim().toLowerCase();
    if (!org)
        return false;
    return trialOrgAllowlist().has(org);
}
function assertLpChatbotOrgTrialAllowed(organizationId) {
    if (lpChatbotOrgTrialAllowed(organizationId))
        return;
    throw new common_1.BadRequestException({
        code: TRIAL_DENY_CODE,
        message: 'Chatbot landing page đang thử nghiệm nội bộ. Liên hệ quản trị để được mở org canary.',
    });
}
/**
 * Block public chatbot on custom domain until host E2E is signed off.
 * Does not affect page render, lead forms, or DNS — widget/API chat only.
 * Set LP_CHATBOT_CUSTOM_DOMAIN_E2E_PASS=1 to allow ACTIVE custom domains (still uses origin hotlink).
 */
function lpChatbotPublicBlockedForCustomDomain(row) {
    const domain = String(row.customDomain || '').trim();
    if (!domain)
        return false;
    if (process.env.LP_CHATBOT_CUSTOM_DOMAIN_E2E_PASS === '1') {
        return row.customDomainStatus !== database_1.LandingPageDomainStatus.ACTIVE;
    }
    return true;
}
function lpChatbotPublicDenyCode(organizationId, row, options) {
    if (!lpChatbotOrgTrialAllowed(organizationId))
        return TRIAL_DENY_CODE;
    if (!options?.preview && lpChatbotPublicBlockedForCustomDomain(row)) {
        return CUSTOM_DOMAIN_HOLD_CODE;
    }
    return null;
}
