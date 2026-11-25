"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashLandingPageAutosaveRequest = hashLandingPageAutosaveRequest;
exports.landingPageAutosaveContentKey = landingPageAutosaveContentKey;
/** Server-only payload receipts for landing-page autosave. No database I/O. */
const crypto_1 = require("crypto");
function canonicalAutosaveJson(value) {
    return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
        ? Object.fromEntries(Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]))
        : item);
}
/** Bind a receipt to the operation's base, revision, name and submitted payload. */
function hashLandingPageAutosaveRequest(input) {
    return (0, crypto_1.createHash)('sha256').update(canonicalAutosaveJson(input)).digest('hex');
}
/** Content equality for a no-edit flush, excluding server receipt metadata. */
function landingPageAutosaveContentKey(spec) {
    const record = (spec || {});
    const meta = { ...(record.meta || {}) };
    delete meta.clientRevision;
    delete meta.lastAutosaveRequestId;
    delete meta.lastAutosaveRequestHash;
    return canonicalAutosaveJson({ ...record, meta: Object.keys(meta).length ? meta : undefined });
}
