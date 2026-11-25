"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveCorsOrigins = resolveCorsOrigins;
exports.isCorsOriginAllowed = isCorsOriginAllowed;
/**
 * Resolve allowlisted browser origins for credentialed CORS.
 * Never reflect arbitrary Origin.
 */
function resolveCorsOrigins(env = process.env) {
    const fromList = (env.CORS_ORIGINS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    const singles = [
        env.APP_URL,
        env.NEXT_PUBLIC_APP_URL,
        env.WEB_URL,
        env.DOMAIN ? `https://${env.DOMAIN.replace(/^https?:\/\//, '')}` : '',
        'https://aibeego.com',
        'https://www.aibeego.com',
        'https://marketingautoaz.com',
        'https://www.marketingautoaz.com',
    ]
        .map((s) => (s || '').trim().replace(/\/$/, ''))
        .filter(Boolean);
    const dev = env.NODE_ENV === 'production'
        ? []
        : ['http://localhost:3000', 'http://localhost:3002', 'http://127.0.0.1:3000', 'http://127.0.0.1:3002'];
    return [...new Set([...fromList, ...singles, ...dev])];
}
function isCorsOriginAllowed(origin, allowlist) {
    if (!origin)
        return false;
    const o = origin.replace(/\/$/, '');
    return allowlist.some((a) => a === o);
}
