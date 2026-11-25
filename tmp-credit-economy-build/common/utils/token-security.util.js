"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maskExternalId = maskExternalId;
exports.maskPhone = maskPhone;
exports.sanitizePublicMetadata = sanitizePublicMetadata;
exports.redactForAudit = redactForAudit;
exports.assertNoCredentialLeak = assertNoCredentialLeak;
exports.encodeStoredSecret = encodeStoredSecret;
exports.decodeStoredSecret = decodeStoredSecret;
const encryption_util_1 = require("./encryption.util");
const SENSITIVE_KEY_PATTERN = /token|secret|password|credential|psid|access_?token|refresh_?token|api_?key|authorization/i;
/** Che PSID / Zalo UID / external user id — chỉ giữ 4 ký tự cuối */
function maskExternalId(value) {
    if (!value?.trim())
        return '';
    return (0, encryption_util_1.maskSecret)(value.trim());
}
/** Che số điện thoại — giữ 3 số cuối */
function maskPhone(value) {
    if (!value?.trim())
        return '';
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 3)
        return '***';
    return `***${digits.slice(-3)}`;
}
/** Metadata an toàn cho API response / audit — không lộ token hay id đầy đủ */
function sanitizePublicMetadata(metadata) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        return {};
    }
    const out = {};
    for (const [key, value] of Object.entries(metadata)) {
        if (SENSITIVE_KEY_PATTERN.test(key)) {
            out[key] = typeof value === 'string' ? (0, encryption_util_1.maskSecret)(value) : '[redacted]';
            continue;
        }
        if (key === 'externalAccountId' && typeof value === 'string') {
            out[key] = maskExternalId(value);
            continue;
        }
        if (key === 'externalUserId' && typeof value === 'string') {
            out[key] = maskExternalId(value);
            continue;
        }
        out[key] = value;
    }
    return out;
}
/** Loại bỏ field nhạy cảm khỏi object trước khi ghi audit/log */
function redactForAudit(payload) {
    if (payload === null || payload === undefined)
        return payload;
    if (Array.isArray(payload))
        return payload.map(redactForAudit);
    if (typeof payload !== 'object') {
        return typeof payload === 'string' && payload.length > 20 ? (0, encryption_util_1.maskSecret)(payload) : payload;
    }
    const out = {};
    for (const [key, value] of Object.entries(payload)) {
        if (key === 'encryptedCredentials' ||
            key === 'pageAccessTokenEncrypted' ||
            key === 'encryptedAccessToken' ||
            key === 'encryptedPageAccessToken') {
            out[key] = '[redacted]';
        }
        else if (SENSITIVE_KEY_PATTERN.test(key)) {
            out[key] = typeof value === 'string' ? (0, encryption_util_1.maskSecret)(value) : '[redacted]';
        }
        else if (typeof value === 'object') {
            out[key] = redactForAudit(value);
        }
        else if (typeof value === 'string' && (key === 'externalUserId' || key === 'psid')) {
            out[key] = maskExternalId(value);
        }
        else {
            out[key] = value;
        }
    }
    return out;
}
/** Đảm bảo response integration không chứa credential */
function assertNoCredentialLeak(response, rawToken) {
    const json = JSON.stringify(response);
    if (json.includes('encryptedCredentials')) {
        throw new Error('API response leaked encryptedCredentials');
    }
    if (rawToken && rawToken.length > 8 && json.includes(rawToken)) {
        throw new Error('API response leaked raw token');
    }
}
function encodeStoredSecret(plaintext, encryptionKey) {
    return (0, encryption_util_1.encryptSecret)(plaintext, encryptionKey);
}
/** Giải mã token đã lưu — hỗ trợ legacy base64 plain */
function decodeStoredSecret(stored, encryptionKey) {
    if (!stored?.trim())
        return '';
    try {
        return (0, encryption_util_1.decryptSecret)(stored, encryptionKey);
    }
    catch {
        try {
            const legacy = Buffer.from(stored, 'base64').toString('utf8').trim();
            if (legacy && !legacy.includes('\0'))
                return legacy;
        }
        catch {
            /* ignore */
        }
        return '';
    }
}
