"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashConfirmSecret = hashConfirmSecret;
exports.generateConfirmSecret = generateConfirmSecret;
exports.secretsEqual = secretsEqual;
exports.confirmExpiresAt = confirmExpiresAt;
exports.isExpired = isExpired;
exports.bindingMatches = bindingMatches;
exports.stripConfirmSecrets = stripConfirmSecrets;
exports.isForbiddenWriteToolName = isForbiddenWriteToolName;
/**
 * Pure confirmation helpers (no Nest/DB) — token hash, binding, expiry.
 * Secrets never log; compare via timing-safe equality.
 */
const crypto_1 = require("crypto");
const shared_1 = require("@marketingspa/shared");
function hashConfirmSecret(secret) {
    return (0, crypto_1.createHash)('sha256').update(secret, 'utf8').digest('hex');
}
/** 32-byte hex token (64 chars) — returned once to client. */
function generateConfirmSecret() {
    return (0, crypto_1.randomBytes)(32).toString('hex');
}
function secretsEqual(aHash, bHash) {
    try {
        const a = Buffer.from(aHash, 'hex');
        const b = Buffer.from(bHash, 'hex');
        if (a.length !== b.length || a.length === 0)
            return false;
        return (0, crypto_1.timingSafeEqual)(a, b);
    }
    catch {
        return false;
    }
}
function confirmExpiresAt(from = new Date(), ttlMs = shared_1.ASSISTANT_TOOL_LIMITS.writeConfirmTtlMs) {
    return new Date(from.getTime() + ttlMs);
}
function isExpired(expiresAt, now = new Date()) {
    return expiresAt.getTime() <= now.getTime();
}
function bindingMatches(stored, attempt) {
    return (stored.organizationId === attempt.organizationId &&
        stored.userId === attempt.userId &&
        stored.toolName === attempt.toolName &&
        stored.requestId === attempt.requestId);
}
/**
 * Strip secrets / confirm tokens from any object before LLM or logs.
 * Recursive, shallow-depth limited.
 */
function stripConfirmSecrets(value, depth = 0) {
    if (depth > 8 || value == null)
        return value;
    if (typeof value === 'string')
        return value;
    if (Array.isArray(value)) {
        return value.map((v) => stripConfirmSecrets(v, depth + 1));
    }
    if (typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            if (/confirmToken|confirmSecret|confirm_secret|secretHash|password|accessToken/i.test(k)) {
                continue;
            }
            out[k] = stripConfirmSecrets(v, depth + 1);
        }
        return out;
    }
    return value;
}
/** Banlist of operations that must never be registered as write tools. */
function isForbiddenWriteToolName(name) {
    return /send|publish|run[_.,-]?ads|run[_.,-]?campaign|delete|permission|payment|billing|purge|force.?ok|skip.?confirm|auto.?confirm/i.test(name);
}
