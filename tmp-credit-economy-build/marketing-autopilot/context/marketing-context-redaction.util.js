"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redactMarketingContextSnapshot = redactMarketingContextSnapshot;
const FORBIDDEN_KEYS = /token|secret|password|credential|api_?key|authorization|encrypted|hash|refresh_?token|access_?token/i;
/** Strip secrets and PII-heavy fields before persisting or sending to LLM. */
function redactMarketingContextSnapshot(payload) {
    return sanitizeDeep(payload);
}
function sanitizeDeep(value) {
    if (value === null || value === undefined)
        return value;
    if (Array.isArray(value))
        return value.map(sanitizeDeep);
    if (typeof value !== 'object')
        return value;
    const out = {};
    for (const [key, child] of Object.entries(value)) {
        if (FORBIDDEN_KEYS.test(key)) {
            out[key] = '[redacted]';
            continue;
        }
        if (key === 'phone' || key === 'email' || key === 'name') {
            continue;
        }
        out[key] = sanitizeDeep(child);
    }
    return out;
}
