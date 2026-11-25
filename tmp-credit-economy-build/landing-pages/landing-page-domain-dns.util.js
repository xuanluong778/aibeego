"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.landingPageCnameTarget = landingPageCnameTarget;
exports.normalizeLandingCustomDomain = normalizeLandingCustomDomain;
exports.isValidLandingCustomDomain = isValidLandingCustomDomain;
exports.verifyLandingPageCname = verifyLandingPageCname;
const email_domain_dns_util_1 = require("../email-marketing/email-domain-dns.util");
const landing_page_domain_manager_1 = require("./landing-page-domain-manager");
/** Default CNAME target for Ai Bee Go landing pages. Override via LANDING_PAGE_CNAME_TARGET. */
function landingPageCnameTarget() {
    const fromEnv = process.env.LANDING_PAGE_CNAME_TARGET?.trim().toLowerCase();
    return (fromEnv || 'lp-edge.aibeego.com').replace(/\.$/, '');
}
function normalizeLandingCustomDomain(input) {
    return (0, landing_page_domain_manager_1.normalizeWebDomain)(input);
}
function isValidLandingCustomDomain(domain) {
    return (0, email_domain_dns_util_1.isValidSenderDomain)(domain);
}
async function verifyLandingPageCname(domain) {
    const expected = landingPageCnameTarget();
    const host = normalizeLandingCustomDomain(domain);
    if (!isValidLandingCustomDomain(host)) {
        return { ok: false, expected, found: [], error: 'Domain không hợp lệ' };
    }
    const found = await (0, email_domain_dns_util_1.lookupCname)(host);
    const ok = found.some((v) => v === expected || v.endsWith(`.${expected}`));
    return {
        ok,
        expected,
        found,
        error: ok ? undefined : `CNAME chưa trỏ tới ${expected}`,
    };
}
