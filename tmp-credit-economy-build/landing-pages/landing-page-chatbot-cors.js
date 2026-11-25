"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLandingPageChatbotCorsHandler = createLandingPageChatbotCorsHandler;
const landing_page_domain_manager_1 = require("./landing-page-domain-manager");
/** Public Landing Page widget, lead and event CORS is scoped to a published page's exact, verified domain.
 * Private APIs keep the existing global allowlist. No credentials or wildcard.
 */
function createLandingPageChatbotCorsHandler(db, resolveDomain) {
    const resolve = resolveDomain || ((hostname) => new landing_page_domain_manager_1.LandingPageDomainManager(db).resolveHost(hostname));
    return async (req, res, next) => {
        const path = (req.originalUrl || req.url).split('?')[0] || '';
        const match = /^\/api\/v1\/landing-pages\/public\/([^/]+)\/(?:chatbot\/(config|message|lead)|lead|events)$/.exec(path);
        const origin = req.headers.origin;
        if (!match || !origin)
            return next();
        res.vary('Origin');
        try {
            const url = new URL(origin);
            // Browser Origin must be an HTTPS origin, without a path, port or credentials.
            if (url.protocol !== 'https:' || url.port || url.username || url.password || origin !== url.origin)
                return next();
            const method = req.method === 'OPTIONS' ? req.headers['access-control-request-method'] : req.method;
            const expected = match[2] === 'config' ? 'GET' : 'POST';
            if (method !== expected)
                return next();
            if (req.method === 'OPTIONS') {
                res.vary('Access-Control-Request-Method');
                res.vary('Access-Control-Request-Headers');
                const headers = String(req.headers['access-control-request-headers'] || '').split(',').map(h => h.trim().toLowerCase()).filter(Boolean);
                if (headers.some(header => header !== 'content-type'))
                    return next();
            }
            const page = await resolve(url.hostname);
            const slug = decodeURIComponent(match[1] || '');
            const query = new URL(req.originalUrl || req.url, 'http://api.invalid').searchParams;
            const org = query.get('organizationId');
            if (!page || page.hostname !== url.hostname || (page.slug !== slug && page.publicKey !== slug) || (org && org !== page.organizationId))
                return next();
            res.setHeader('Access-Control-Allow-Origin', origin);
            if (req.method === 'OPTIONS') {
                res.setHeader('Access-Control-Allow-Methods', expected);
                res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
                res.setHeader('Access-Control-Max-Age', '300');
                res.setHeader('Cache-Control', 'private, no-store');
                return res.status(204).end();
            }
        }
        catch {
            // Fail closed if the domain is unknown, malformed, detached or unavailable.
        }
        return next();
    };
}
