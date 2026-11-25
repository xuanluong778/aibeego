"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maskObjectPii = maskObjectPii;
const shared_1 = require("@marketingspa/shared");
/** Apply default PII mask to shallow / nested plain objects (depth-limited). */
function maskObjectPii(value, reveal, depth = 0) {
    if (depth > 6)
        return value;
    if (value == null)
        return value;
    if (typeof value === 'string')
        return value;
    if (typeof value !== 'object')
        return value;
    if (Array.isArray(value)) {
        return value.map((v) => maskObjectPii(v, reveal, depth + 1));
    }
    const out = {};
    for (const [k, v] of Object.entries(value)) {
        const key = k.toLowerCase();
        if (/token|secret|password|authorization|apikey|access_token|page_token/.test(key)) {
            out[k] = (0, shared_1.redactSensitiveTokenLike)(String(v ?? ''));
            continue;
        }
        if (!reveal.phone && /phone|mobile|tel/.test(key) && typeof v === 'string') {
            out[k] = (0, shared_1.maskPhone)(v);
            continue;
        }
        if (!reveal.email && /(^email$|e_mail|email_address)/.test(key) && typeof v === 'string') {
            out[k] = (0, shared_1.maskEmail)(v);
            continue;
        }
        // Free-text sensitive content (inbox previews already pre-masked; belt+suspenders)
        if (!reveal.phone &&
            /message|content|body|transcript|preview|note/.test(key) &&
            typeof v === 'string' &&
            v.length > 0) {
            // keep as-is if short placeholder; deep mask phones inside
            out[k] = v
                .replace(/\b0\d{8,11}\b/g, (m) => (0, shared_1.maskPhone)(m) ?? '****')
                .replace(/[\w.+-]+@[\w.-]+\.\w+/gi, (m) => (0, shared_1.maskEmail)(m) ?? '***@***');
            continue;
        }
        if (v && typeof v === 'object') {
            out[k] = maskObjectPii(v, reveal, depth + 1);
            continue;
        }
        out[k] = v;
    }
    return out;
}
