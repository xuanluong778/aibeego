"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuthenticatedUploadsHandler = createAuthenticatedUploadsHandler;
const fs_1 = require("fs");
const path_1 = require("path");
const upload_policy_1 = require("../uploads/upload-policy");
const upload_signed_url_1 = require("../uploads/upload-signed-url");
/**
 * /uploads/* handler:
 * - public/{...} + image ext → public (safe media for <img>)
 * - private → JWT Bearer / ?access_token= OR HMAC ?exp=&sig=
 * Never serves executables / traversal.
 */
function createAuthenticatedUploadsHandler(opts) {
    const root = (0, path_1.resolve)(opts.uploadsDir);
    return async (req, res, _next) => {
        try {
            const rawPath = (req.path || '').replace(/^\/uploads\/?/, '');
            if (!rawPath || rawPath.includes('\0')) {
                res.status(400).json({ success: false, message: 'Invalid path' });
                return;
            }
            let decoded;
            try {
                decoded = decodeURIComponent(rawPath);
            }
            catch {
                res.status(400).json({ success: false, message: 'Invalid path encoding' });
                return;
            }
            const normalized = (0, path_1.normalize)(decoded).replace(/^(\.\.(\/|\\|$))+/, '');
            if (normalized.includes('..')) {
                res.status(400).json({ success: false, message: 'Invalid path' });
                return;
            }
            const abs = (0, path_1.resolve)(root, normalized);
            if (abs !== root && !abs.startsWith(root + path_1.sep)) {
                res.status(400).json({ success: false, message: 'Invalid path' });
                return;
            }
            const ext = (0, path_1.extname)(abs).toLowerCase();
            if (upload_policy_1.SERVE_BLOCKED_EXT.has(ext) || (ext && !upload_policy_1.SERVE_ALLOWED_EXT.has(ext))) {
                res.status(403).json({ success: false, message: 'File type not allowed' });
                return;
            }
            const isPublicMedia = normalized.replace(/\\/g, '/').startsWith(upload_policy_1.PUBLIC_UPLOAD_PREFIX) &&
                upload_policy_1.PUBLIC_MEDIA_EXT.has(ext);
            let authOk = isPublicMedia;
            if (!authOk) {
                const sigOk = (0, upload_signed_url_1.verifyUploadSignature)(normalized.replace(/\\/g, '/'), req.query.exp, req.query.sig);
                if (sigOk)
                    authOk = true;
            }
            let payload = null;
            if (!authOk) {
                const auth = req.headers.authorization;
                const bearer = typeof auth === 'string' && auth.startsWith('Bearer ')
                    ? auth.slice(7).trim()
                    : '';
                const q = typeof req.query.access_token === 'string' ? req.query.access_token.trim() : '';
                const token = bearer || q;
                if (!token) {
                    res.status(401).json({ success: false, message: 'Unauthorized' });
                    return;
                }
                try {
                    payload = await opts.jwt.verifyAsync(token);
                }
                catch {
                    res.status(401).json({ success: false, message: 'Unauthorized' });
                    return;
                }
                if (!payload?.organizationId || !payload.sub) {
                    res.status(401).json({ success: false, message: 'Unauthorized' });
                    return;
                }
                authOk = true;
            }
            const parts = normalized.split(/[/\\]/).filter(Boolean);
            if (parts[0] === 'hrm' && parts[1] && payload) {
                const fileOrg = parts[1];
                if (payload.role !== 'SUPER_ADMIN' && fileOrg !== payload.organizationId) {
                    res.status(403).json({ success: false, message: 'Forbidden' });
                    return;
                }
            }
            if (parts[0] === 'work' && parts[1] && payload) {
                const fileOrg = parts[1];
                if (payload.role !== 'SUPER_ADMIN' && fileOrg !== payload.organizationId) {
                    res.status(403).json({ success: false, message: 'Forbidden' });
                    return;
                }
            }
            if (!(0, fs_1.existsSync)(abs) || !(0, fs_1.statSync)(abs).isFile()) {
                res.status(404).json({ success: false, message: 'Not found' });
                return;
            }
            const st = (0, fs_1.statSync)(abs);
            if (st.size > 50 * 1024 * 1024) {
                res.status(413).json({ success: false, message: 'File too large' });
                return;
            }
            res.setHeader('Content-Type', (0, upload_policy_1.contentTypeForExt)(ext));
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Cache-Control', isPublicMedia ? 'public, max-age=3600' : 'private, no-store');
            res.setHeader('Content-Length', String(st.size));
            (0, fs_1.createReadStream)(abs).pipe(res);
        }
        catch {
            res.status(500).json({ success: false, message: 'Upload serve error' });
        }
    };
}
