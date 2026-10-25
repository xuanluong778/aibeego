import { readFileSync } from 'fs';
import { decideDraftRecovery } from '../apps/web/src/components/landing-pages/landing-page-draft-recovery.ts';
import {
  decideLandingPageAutosave,
  publishRevisionAllowed,
  readLandingPageRequestId,
  readLandingPageRevision,
} from '../apps/api/src/landing-pages/landing-page-revision.ts';

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(message);
}

const stored = { meta: { clientRevision: 5, lastAutosaveRequestId: 'req-a' } };
assert(readLandingPageRevision(stored) === 5, 'read revision');
assert(readLandingPageRequestId(stored) === 'req-a', 'read request id');

const first = decideLandingPageAutosave({
  storedRevision: 5,
  storedRequestId: null,
  baseRevision: 5,
  incomingRevision: 6,
  requestId: 'tab-a',
});
assert(first.action === 'accept' && first.nextRevision === 6, 'first tab accepts');

const second = decideLandingPageAutosave({
  storedRevision: 6,
  storedRequestId: 'tab-a',
  baseRevision: 5,
  incomingRevision: 6,
  requestId: 'tab-b',
});
assert(second.action === 'reject' && second.storedRevision === 6, 'second tab does not overwrite');

const retry = decideLandingPageAutosave({
  storedRevision: 6,
  storedRequestId: 'tab-a',
  baseRevision: 5,
  incomingRevision: 6,
  requestId: 'tab-a',
});
assert(retry.action === 'idempotent' && retry.nextRevision === 6, 'same request retries without overwrite');

const flush = decideLandingPageAutosave({
  storedRevision: 6,
  storedRequestId: 'tab-a',
  baseRevision: 6,
  incomingRevision: 6,
  requestId: 'tab-a-2',
});
assert(flush.action === 'unchanged' && flush.nextRevision === 6, 'publish flush does not bump');

const nextEdit = decideLandingPageAutosave({
  storedRevision: 6,
  storedRequestId: 'tab-a',
  baseRevision: 6,
  incomingRevision: 8,
  requestId: 'tab-a-3',
});
assert(nextEdit.action === 'accept' && nextEdit.nextRevision === 8, 'later edits from the same base land');

assert(publishRevisionAllowed(8, 8) === 'ok', 'publish the saved revision');
assert(publishRevisionAllowed(7, 8) === 'not_saved', 'publish waits until autosave lands');
assert(publishRevisionAllowed(9, 8) === 'stale', 'publish does not ship another tab');
assert(publishRevisionAllowed(9, null) === 'ok', 'legacy publish uses the stored draft');

assert(
  decideDraftRecovery({ serverRevision: 4, local: { pageId: 'p', spec: { version: 1 } as never, baseRevision: 4, clientRevision: 6, savedAt: '' } }) ===
    'restore-local',
  'unsaved local draft restores when the server has not moved',
);
assert(
  decideDraftRecovery({ serverRevision: 6, local: { pageId: 'p', spec: { version: 1 } as never, baseRevision: 4, clientRevision: 6, savedAt: '' } }) ===
    'use-server',
  'local draft already saved is ignored',
);
assert(
  decideDraftRecovery({ serverRevision: 7, local: { pageId: 'p', spec: { version: 1 } as never, baseRevision: 4, clientRevision: 9, savedAt: '' } }) ===
    'conflict',
  'local draft does not auto-replace a newer server draft',
);

const pack = readFileSync(
  new URL('../apps/api/src/landing-pages/landing-page-template-pack.service.ts', import.meta.url),
  'utf8',
);
const updateStart = pack.indexOf('async importUpdate');
const updateEnd = pack.indexOf('async publish', updateStart);
const updateFn = pack.slice(updateStart, updateEnd);
const publishStart = pack.indexOf('async publish', updateStart);
const publishEnd = pack.indexOf('async listVersions', publishStart);
const publishFn = pack.slice(publishStart, publishEnd);
assert(!/prisma\.landingPage\b/.test(updateFn), 'template update does not write user pages');
assert(!/prisma\.landingPage\b/.test(publishFn), 'template publish does not write user pages');

const pageService = readFileSync(
  new URL('../apps/api/src/landing-pages/landing-pages.service.ts', import.meta.url),
  'utf8',
);
const restoreStart = pageService.indexOf('async restorePageVersion');
const restoreEnd = pageService.indexOf('async generateAi', restoreStart);
const restoreFn = pageService.slice(restoreStart, restoreEnd);
assert(restoreFn.includes('FOR UPDATE'), 'version restore locks the row');
assert(!restoreFn.includes('publishedSpec:'), 'version restore does not assign publishedSpec');

console.log('landing page revision tests: PASS');
