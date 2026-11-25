"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignedRequestError = void 0;
exports.base64UrlDecode = base64UrlDecode;
exports.base64UrlEncode = base64UrlEncode;
exports.parseAndVerifySignedRequest = parseAndVerifySignedRequest;
exports.buildSignedRequestForTest = buildSignedRequestForTest;
exports.buildDataDeletionConfirmationCode = buildDataDeletionConfirmationCode;
exports.buildRandomConfirmationCode = buildRandomConfirmationCode;
exports.maskFacebookUserId = maskFacebookUserId;
exports.assertHttpsRequest = assertHttpsRequest;
const crypto_1 = require("crypto");
class SignedRequestError extends Error {
    constructor(message) {
        super(message);
        this.name = 'SignedRequestError';
    }
}
exports.SignedRequestError = SignedRequestError;
/** Facebook signed_request uses URL-safe base64 without padding */
function base64UrlDecode(input) {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
    return Buffer.from(normalized + pad, 'base64');
}
function base64UrlEncode(buf) {
    return buf
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}
/**
 * Verify Meta `signed_request` with APP SECRET (HMAC-SHA256).
 * Never log the secret or oauth_token from the payload.
 */
function parseAndVerifySignedRequest(signedRequest, appSecret) {
    if (!signedRequest?.trim()) {
        throw new SignedRequestError('signed_request is required');
    }
    if (!appSecret?.trim()) {
        throw new SignedRequestError('META_APP_SECRET is not configured');
    }
    const parts = signedRequest.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        throw new SignedRequestError('signed_request format is invalid');
    }
    const [encodedSig, encodedPayload] = parts;
    let sig;
    let payloadBuf;
    try {
        sig = base64UrlDecode(encodedSig);
        payloadBuf = base64UrlDecode(encodedPayload);
    }
    catch {
        throw new SignedRequestError('signed_request encoding is invalid');
    }
    const expected = (0, crypto_1.createHmac)('sha256', appSecret).update(encodedPayload).digest();
    if (sig.length !== expected.length || !(0, crypto_1.timingSafeEqual)(sig, expected)) {
        throw new SignedRequestError('signed_request signature mismatch');
    }
    let payload;
    try {
        payload = JSON.parse(payloadBuf.toString('utf8'));
    }
    catch {
        throw new SignedRequestError('signed_request payload is not valid JSON');
    }
    if (payload.algorithm !== 'HMAC-SHA256') {
        throw new SignedRequestError(`unsupported algorithm: ${String(payload.algorithm)}`);
    }
    if (!payload.user_id || typeof payload.user_id !== 'string') {
        throw new SignedRequestError('signed_request missing user_id');
    }
    if (typeof payload.issued_at !== 'number' || !Number.isFinite(payload.issued_at)) {
        throw new SignedRequestError('signed_request missing issued_at');
    }
    return payload;
}
/** Build a valid signed_request for tests (does not belong in production call paths). */
function buildSignedRequestForTest(payload, appSecret) {
    const body = {
        algorithm: payload.algorithm ?? 'HMAC-SHA256',
        issued_at: payload.issued_at,
        user_id: payload.user_id,
    };
    if (payload.oauth_token !== undefined)
        body.oauth_token = payload.oauth_token;
    if (payload.expires !== undefined)
        body.expires = payload.expires;
    const encodedPayload = base64UrlEncode(Buffer.from(JSON.stringify(body), 'utf8'));
    const sig = (0, crypto_1.createHmac)('sha256', appSecret).update(encodedPayload).digest();
    return `${base64UrlEncode(sig)}.${encodedPayload}`;
}
/** Deterministic confirmation code for a Facebook user (idempotent retries). */
function buildDataDeletionConfirmationCode(facebookUserId) {
    const digest = (0, crypto_1.createHash)('sha256')
        .update(`auto-post-data-deletion:${facebookUserId}`)
        .digest('hex')
        .slice(0, 24);
    return `apd_${digest}`;
}
/** Random confirmation code fallback when facebook user id is absent (should not happen). */
function buildRandomConfirmationCode() {
    return `apd_${(0, crypto_1.randomBytes)(12).toString('hex')}`;
}
/** Mask Facebook user id for safe logs / audit (keep last 4). */
function maskFacebookUserId(userId) {
    const id = userId.trim();
    if (id.length <= 4)
        return '••••';
    return `••••${id.slice(-4)}`;
}
/**
 * Production Meta callbacks must arrive over HTTPS (behind proxy: x-forwarded-proto).
 * Local/dev may allow http when NODE_ENV !== production.
 */
function assertHttpsRequest(input) {
    const env = (input.nodeEnv ?? process.env.NODE_ENV ?? '').toLowerCase();
    if (env !== 'production' && env !== 'prod')
        return;
    const protoHeader = Array.isArray(input.forwardedProto)
        ? input.forwardedProto[0]
        : input.forwardedProto;
    const proto = (protoHeader ?? '').split(',')[0]?.trim().toLowerCase();
    const ok = input.secure === true || proto === 'https';
    if (!ok) {
        throw new SignedRequestError('HTTPS is required for Meta callbacks');
    }
}
