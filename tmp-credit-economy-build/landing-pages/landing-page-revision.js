"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readLandingPageRequestHash = readLandingPageRequestHash;
exports.readLandingPageRevision = readLandingPageRevision;
exports.readLandingPageRequestId = readLandingPageRequestId;
exports.decideLandingPageAutosave = decideLandingPageAutosave;
exports.publishRevisionAllowed = publishRevisionAllowed;
/** Optimistic concurrency for landing-page drafts. No I/O. */
function readLandingPageRequestHash(spec) {
    const hash = spec?.meta
        ?.lastAutosaveRequestHash;
    return typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash) ? hash : null;
}
function readLandingPageRevision(spec) {
    if (!spec || typeof spec !== 'object')
        return 0;
    const meta = spec.meta;
    if (!meta || typeof meta !== 'object')
        return 0;
    const rev = meta.clientRevision;
    return typeof rev === 'number' && Number.isFinite(rev) ? Math.max(0, Math.floor(rev)) : 0;
}
function readLandingPageRequestId(spec) {
    if (!spec || typeof spec !== 'object')
        return null;
    const meta = spec.meta;
    if (!meta || typeof meta !== 'object')
        return null;
    const id = meta.lastAutosaveRequestId;
    return typeof id === 'string' && id.trim() ? id.slice(0, 64) : null;
}
/**
 * baseRevision is the revision the client last loaded or saved.
 * A second tab with the same base loses. Only an identical request is a no-op.
 * Re-saving the current revision (publish flush with no new edits) does not bump.
 */
function decideLandingPageAutosave(input) {
    const stored = Math.max(0, Math.floor(input.storedRevision) || 0);
    if (input.requestId && input.storedRequestId && input.requestId === input.storedRequestId) {
        // Old/colliding IDs without a matching receipt cannot acknowledge this draft.
        return input.requestHash && input.storedRequestHash === input.requestHash
            ? { action: 'idempotent', nextRevision: stored }
            : { action: 'reject', storedRevision: stored };
    }
    if (input.baseRevision == null) {
        if (input.incomingRevision != null && input.incomingRevision < stored) {
            return { action: 'reject', storedRevision: stored };
        }
        const incoming = input.incomingRevision == null ? stored : Math.max(0, Math.floor(input.incomingRevision));
        if (incoming <= stored)
            return { action: 'unchanged', nextRevision: stored };
        return { action: 'accept', nextRevision: incoming };
    }
    const base = Math.max(0, Math.floor(input.baseRevision));
    if (base !== stored)
        return { action: 'reject', storedRevision: stored };
    const incoming = input.incomingRevision == null ? stored + 1 : Math.max(0, Math.floor(input.incomingRevision));
    if (incoming <= stored)
        return { action: 'unchanged', nextRevision: stored };
    return { action: 'accept', nextRevision: Math.max(stored + 1, incoming) };
}
function publishRevisionAllowed(storedRevision, expectedRevision) {
    if (expectedRevision == null)
        return 'ok';
    const stored = Math.max(0, Math.floor(storedRevision) || 0);
    const expected = Math.max(0, Math.floor(expectedRevision));
    if (stored === expected)
        return 'ok';
    if (stored < expected)
        return 'not_saved';
    return 'stale';
}
