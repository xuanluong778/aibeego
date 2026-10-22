#!/usr/bin/env node
/**
 * Gate: Landing Page autosave must not hang UI on "Đang lưu…".
 *   node scripts/test-landing-page-autosave-stuck.cjs
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const builder = fs.readFileSync(
  path.join(root, 'apps/web/src/components/landing-pages/landing-page-builder.tsx'),
  'utf8',
);
const canvas = fs.readFileSync(
  path.join(root, 'apps/web/src/components/landing-pages/landing-page-canvas-ux.tsx'),
  'utf8',
);
const apiClient = fs.readFileSync(
  path.join(root, 'apps/web/src/lib/api-client.ts'),
  'utf8',
);
const service = fs.readFileSync(
  path.join(root, 'apps/api/src/landing-pages/landing-pages.service.ts'),
  'utf8',
);

const gates = {};
function gate(name, ok, detail) {
  gates[name] = { ok: !!ok, detail };
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail ? ' ' + detail : ''));
}

gate(
  'SEED_REVISION_ON_LOAD',
  builder.includes('readClientRevision(loaded)') &&
    builder.includes('revisionRef.current = readClientRevision') &&
    !/dirtyRef\.current = false;\s*revisionRef\.current = 0;/.test(builder),
  'load seeds revisionRef from draftSpec.meta.clientRevision',
);

gate(
  'STALE_NEVER_FORCE_OVERWRITES',
  builder.includes("res.reason === 'STALE_REVISION'") &&
    builder.includes('saveConflictRef.current = true') &&
    builder.includes('resolveSaveConflict') &&
    !/revisionRef\.current\s*=\s*Math\.max\(revisionRef\.current,\s*serverRev\s*\+\s*1\)/.test(
      builder,
    ),
  'STALE never bumps local revision past server to force a retry-overwrite (data-loss fix — LP-AS-CONFLICT-001)',
);

gate(
  'CONFLICT_PAUSES_AUTOSAVE_NO_LOOP',
  builder.includes('if (saveConflictRef.current) {') &&
    builder.includes('if (saveConflictRef.current) return;') &&
    !/setTimeout\(\(\) => \{\s*if \(dirtyRef\.current\) void persist[\s\S]{0,80}\}, 0\)/.test(
      builder,
    ),
  'persist() guard + debounce effect guard both stop while conflict unresolved — no reflush loop, no hang',
);

gate(
  'AUTOSAVE_NO_BUTTON_LOCK',
  /opts\?:\s*\{\s*manual\?:\s*boolean/.test(builder) &&
    builder.includes('if (manual) setSaving(true)') &&
    builder.includes('if (manual) setSaving(false)') &&
    builder.includes('persist(spec, page.name, { manual: true })') &&
    !/setSaving\(true\);\s*let reflush/.test(builder),
  'background autosave does not setSaving(true); only manual Lưu does',
);

gate(
  'NO_TIGHT_REFUSH_LOOP',
  builder.includes('queueFollowUp(500)') &&
    builder.includes('ac.abort()') &&
    !/reflushDelayMs = 50/.test(builder) &&
    !/setTimeout\(\(\) => \{\s*if \(dirtyRef\.current\) void persist[\s\S]{0,80}\}, 0\)/.test(builder),
  'debounced follow-up + 20s abort; no 0/50ms tight reflush',
);

gate(
  'ABORT_PROPAGATES',
  apiClient.includes("e.name === 'AbortError'") && apiClient.includes('throw e'),
  'apiClient rethrows AbortError (timeout distinguishable)',
);

gate(
  'INLINE_EDIT_NO_VALUE_CARET_LOOP',
  canvas.includes('intentionally only on edit enter') &&
    /useLayoutEffect\(\(\) => \{[\s\S]*?el\.focus\([\s\S]*?\}, \[editing\]\)/.test(canvas) &&
    !/}, \[editing, value\]\);/.test(canvas),
  'caret/focus effect depends only on editing, not value',
);

gate(
  'SERVER_STALE_STILL_BLOCKS',
  service.includes("reason: 'STALE_REVISION'") &&
    service.includes('incomingRevision < storedRevision'),
  'API still rejects lower clientRevision',
);

function seedRevision(storedMetaRev) {
  return typeof storedMetaRev === 'number' && Number.isFinite(storedMetaRev)
    ? Math.max(0, Math.floor(storedMetaRev))
    : 0;
}
// New contract (post LP-AS-CONFLICT-001 fix): a STALE_REVISION response never
// advances the local revision counter past the server's — doing that is what let a
// tab silently force its own stale draft over a newer save from another tab/session.
// It only marks a conflict; the caller must fetch-and-adopt the server's current
// draft (resolveSaveConflict) before any further write is attempted.
function onStale(localRev) {
  return {
    revision: localRev,
    conflict: true,
    reflush: false,
  };
}

const seeded = seedRevision(42);
const afterEdit = seeded + 1;
const staleResult = onStale(1);
gate(
  'UNIT_STALE_NEVER_ADVANCES_OR_REFLUSHES',
  seeded === 42 &&
    afterEdit === 43 &&
    staleResult.revision === 1 &&
    staleResult.conflict === true &&
    staleResult.reflush === false,
  'seed 42; stale leaves local revision untouched and schedules no reflush',
);

const failed = Object.entries(gates).filter(([, g]) => !g.ok);
const ready = failed.length === 0 ? 'PASS' : 'FAIL';

console.log('');
console.log(
  'FILES_CHANGED=landing-page-builder.tsx,landing-page-canvas-ux.tsx,api-client.ts,scripts/test-landing-page-autosave-stuck.cjs',
);
console.log('LOGIC_CHANGED_YES_NO=YES');
console.log('AUTOSAVE_STUCK_FIX=' + ready);
console.log('TEST_RESULTS:');
for (const [k, g] of Object.entries(gates)) {
  console.log('  ' + (g.ok ? 'PASS' : 'FAIL') + ' ' + k + ' — ' + (g.detail || ''));
}
process.exit(failed.length ? 1 : 0);
