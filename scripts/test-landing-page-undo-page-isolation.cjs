#!/usr/bin/env node
/**
 * BUG-06 undo-history-leaks-across-pages
 *   node scripts/test-landing-page-undo-page-isolation.cjs
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const page = read('apps/web/src/app/(app)/landing-pages/builder/[id]/page.tsx');
const builder = read('apps/web/src/components/landing-pages/landing-page-builder.tsx');

const gates = {};
function gate(name, ok, detail) {
  gates[name] = { ok: !!ok, detail: detail || '' };
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail ? ' — ' + detail : ''));
}

gate(
  'REMOUNT_ON_PAGE_ID',
  /<LandingPageBuilder\s+key=\{pageId\}\s+pageId=\{pageId\}\s*\/>/.test(page) ||
    (/key=\{pageId\}/.test(page) && /pageId=\{pageId\}/.test(page)),
  'LandingPageBuilder remounts via key={pageId}',
);

gate(
  'NO_SHARED_INSTANCE_ACROSS_PAGES',
  page.includes('key={pageId}') &&
    page.includes('history/clipboard/refs never leak') &&
    !/<LandingPageBuilder\s+pageId=\{params\.id\}\s*\/>/.test(page),
  'no unkeyed builder reuse on client navigation',
);

gate(
  'UNDO_USES_LOCAL_HISTORY',
  builder.includes('historyRef.current.pop()') &&
    builder.includes('futureRef.current.pop()') &&
    builder.includes('blockClipboardRef') &&
    builder.includes('styleClipboardRef'),
  'undo/redo/clipboard live in builder instance refs (cleared by remount)',
);

const failed = Object.entries(gates).filter(([, g]) => !g.ok);
console.log('');
for (const k of Object.keys(gates)) {
  console.log(k + '=' + (gates[k].ok ? 'PASS' : 'FAIL'));
}
console.log(failed.length ? 'BUG_06=FAIL' : 'BUG_06=PASS');
console.log(
  'FILES_CHANGED=apps/web/src/app/(app)/landing-pages/builder/[id]/page.tsx,scripts/test-landing-page-undo-page-isolation.cjs',
);
process.exit(failed.length ? 1 : 0);
