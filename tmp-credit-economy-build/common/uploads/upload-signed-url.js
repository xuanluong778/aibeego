"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signUploadPath = signUploadPath;
exports.withSignedUploadUrl = withSignedUploadUrl;
exports.verifyUploadSignature = verifyUploadSignature;
/**
 * HMAC signed URLs for private /uploads paths (img/href without Bearer).
 * Query: ?exp=<unixSec>&sig=<hex>
 */
const crypto_1 = require("crypto");
function signingKey() {
    const key = process.env.UPLOAD_SIGNING_SECRET?.trim() ||
        process.env.ENCRYPTION_KEY?.trim() ||
        '';
    if (!key || key.length < 16) {
        throw new Error('UPLOAD_SIGNING_SECRET or ENCRYPTION_KEY required for signed uploads');
    }
    return key;
}
function safeEqual(a, b) {
    try {
        const ba = Buffer.from(a, 'utf8');
        const bb = Buffer.from(b, 'utf8');
        if (ba.length !== bb.length)
            return false;
        return (0, crypto_1.timingSafeEqual)(ba, bb);
    }
    catch {
        return false;
    }
}
function signUploadPath(relativePath, ttlSeconds = 7 * 24 * 3600) {
    const path = relativePath.replace(/^\/+/, '').replace(/^uploads\//, '');
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const sig = (0, crypto_1.createHmac)('sha256', signingKey())
        .update(`upload:${path}:${exp}`)
        .digest('hex');
    return { exp, sig };
}
/** Append ?exp=&sig= to a /uploads/... or absolute URL ending with /uploads/... */
function withSignedUploadUrl(urlOrPath, ttlSeconds = 7 * 24 * 3600) {
    if (!urlOrPath)
        return urlOrPath;
    try {
        let pathPart = urlOrPath;
        let prefix = '';
        if (/^https?:\/\//i.test(urlOrPath)) {
            const u = new URL(urlOrPath);
            if (!u.pathname.startsWith('/uploads/'))
                return urlOrPath;
            pathPart = u.pathname.slice('/uploads/'.length);
            prefix = `${u.origin}/uploads/${pathPart}`;
        }
        else if (urlOrPath.startsWith('/uploads/')) {
            pathPart = urlOrPath.slice('/uploads/'.length);
            prefix = `/uploads/${pathPart}`;
        }
        else {
            return urlOrPath;
        }
        // strip existing query
        const bare = (prefix.split('?')[0] || prefix);
        const rel = (pathPart.split('?')[0] || pathPart);
        const { exp, sig } = signUploadPath(rel, ttlSeconds);
        return `${bare}?exp=${exp}&sig=${sig}`;
    }
    catch {
        return urlOrPath;
    }
}
function verifyUploadSignature(relativePath, expRaw, sigRaw) {
    const exp = Number(expRaw);
    const sig = typeof sigRaw === 'string' ? sigRaw.trim().toLowerCase() : '';
    if (!Number.isFinite(exp) || !sig || !/^[0-9a-f]{64}$/.test(sig))
        return false;
    if (exp < Math.floor(Date.now() / 1000))
        return false;
    const path = relativePath.replace(/^\/+/, '').replace(/^uploads\//, '');
    try {
        const expected = (0, crypto_1.createHmac)('sha256', signingKey())
            .update(`upload:${path}:${exp}`)
            .digest('hex');
        return safeEqual(expected, sig);
    }
    catch {
        return false;
    }
}
