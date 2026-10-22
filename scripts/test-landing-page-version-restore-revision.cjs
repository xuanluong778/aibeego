#!/usr/bin/env node
/**
 * BUG-07 version-restore-no-concurrency-guard-silently-reverted
 *   node scripts/test-landing-page-version-restore-revision.cjs
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const service = read('apps/api/src/landing-pages/landing-pages.service.ts');
const builder = read('apps/web/src/components/landing-pages/landing-page-builder.tsx');
const lifecycle = read('packages/shared/src/landing-page-lifecycle.ts');

const gates = {};
function gate(name, ok, detail) {
  gates[name] = { ok: !!ok, detail: detail || '' };
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail ? ' — ' + detail : ''));
}

const restoreFn = (() => {
  const start = service.indexOf('async restorePageVersion(');
  if (start < 0) return '';
  const end = service.indexOf('async generateAi(', start);
  return end > start ? service.slice(start, end) : service.slice(start, start + 4000);
})();

gate(
  'RESTORE_BUMPS_CLIENT_REVISION',
  restoreFn.includes('nextClientRevision') &&
    restoreFn.includes('Math.max(existingDraftRevision, restoredSnapshotRevision) + 1') &&
    restoreFn.includes('clientRevision: nextClientRevision'),
  'restorePageVersion sets meta.clientRevision = max(draft, snapshot) + 1',
);

gate(
  'RESTORE_WRITES_BUMPED_SPEC',
  restoreFn.includes('draftSpec: restoredSpec') &&
    /restoredSpec\.meta\s*=\s*\{[\s\S]*clientRevision:\s*nextClientRevision/.test(restoreFn),
  'bumped revision is written into draftSpec before persist',
);

gate(
  'AUTOSAVE_STALE_STILL_PHASE1',
  service.includes("reason: 'STALE_REVISION'") &&
    service.includes('incomingRevision < storedRevision') &&
    builder.includes('resolveSaveConflict') &&
    builder.includes("res.reason === 'STALE_REVISION'"),
  'reuse existing STALE_REVISION + resolveSaveConflict (no second revision system)',
);

gate(
  'CLIENT_SEEDS_REVISION_ON_RESTORE',
  builder.includes('onRestored={(next)') &&
    builder.includes('revisionRef.current = readClientRevision(restored)') &&
    /onRestored=\{\(next\)\s*=>\s*\{[\s\S]*?revisionRef\.current\s*=\s*readClientRevision\(restored\)/.test(
      builder,
    ),
  'Version History restore seeds revisionRef from server draft',
);

gate(
  'SANITIZE_PRESERVES_CLIENT_REVISION',
  lifecycle.includes('clientRevision: Math.max(0, Math.floor(metaIn.clientRevision))'),
  'sanitize keeps clientRevision so bump survives round-trip',
);

const failed = Object.entries(gates).filter(([, g]) => !g.ok);
console.log('');
for (const k of Object.keys(gates)) {
  console.log(k + '=' + (gates[k].ok ? 'PASS' : 'FAIL'));
}
console.log(failed.length ? 'BUG_07=FAIL' : 'BUG_07=PASS');
process.exit(failed.length ? 1 : 0);
