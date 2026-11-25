"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeEmail = normalizeEmail;
exports.renderEmailMerge = renderEmailMerge;
exports.contactMergeVars = contactMergeVars;
exports.publicApiBase = publicApiBase;
exports.unsubscribePageUrl = unsubscribePageUrl;
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
function renderEmailMerge(template, vars) {
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => vars[key] ?? '');
}
function contactMergeVars(contact) {
    const name = (contact.name || '').trim() || contact.email;
    const firstName = name.split(/\s+/)[0] || name;
    const fields = contact.customFields && typeof contact.customFields === 'object' && !Array.isArray(contact.customFields)
        ? contact.customFields
        : {};
    const companyRaw = fields.company ?? fields.companyName ?? '';
    const company = typeof companyRaw === 'string' ? companyRaw.trim() : '';
    return {
        name,
        firstName,
        email: contact.email,
        company,
    };
}
function publicApiBase() {
    const app = (process.env.APP_URL || 'https://aibeego.com').replace(/\/$/, '');
    return `${app}/api/v1/email-marketing/public`;
}
function unsubscribePageUrl(recipientId) {
    const app = (process.env.APP_URL || 'https://aibeego.com').replace(/\/$/, '');
    return `${app}/email-unsubscribe?rid=${encodeURIComponent(recipientId)}`;
}
