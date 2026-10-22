#!/usr/bin/env node
/**
 * Landing Page — publish flush + stale-state action gates.
 *   node scripts/test-landing-page-publish-flush.cjs
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const gates = {};
function gate(name, ok, detail) {
  gates[name] = { ok: !!ok, detail: detail || '' };
  console.log(ok ? 'PASS' : 'FAIL', name, detail || '');
}

const builder = fs.readFileSync(
  path.join(root, 'apps/web/src/components/landing-pages/landing-page-builder.tsx'),
  'utf8',
);
const theme = fs.readFileSync(
  path.join(root, 'apps/web/src/components/landing-pages/landing-page-theme-switcher.tsx'),
  'utf8',
);
const design = fs.readFileSync(
  path.join(root, 'apps/web/src/components/landing-pages/landing-page-inspector-design-tab.tsx'),
  'utf8',
);
const ux = fs.readFileSync(
  path.join(root, 'apps/web/src/components/landing-pages/landing-page-canvas-ux.tsx'),
  'utf8',
);
const renderer = fs.readFileSync(
  path.join(root, 'apps/web/src/components/landing-pages/landing-page-renderer.tsx'),
  'utf8',
);

gate(
  'PUBLISH_LATEST_SPEC',
  builder.includes('await persist(specRef.current') &&
    builder.includes('wait: true') &&
    !/async function publish\(\)[\s\S]{0,200}persist\(spec,/.test(builder),
  'publish uses specRef.current + wait flush',
);

gate(
  'AUTOSAVE_PUBLISH_RACE',
  builder.includes('persistWaitersRef') &&
    builder.includes('opts?.wait === true || manual') &&
    builder.includes('_flushDepth') &&
    builder.includes('dirtyRef.current || autosaveInflightRef.current'),
  'publish waits for in-flight autosave then flushes',
);

gate(
  'STALE_STATE_ACTIONS',
  builder.includes('cloneSpec(specRef.current)') &&
    builder.includes('const current = specRef.current') &&
    builder.includes('Merge theme onto latest canvas') &&
    builder.includes('onApplyBlockFields') &&
    /onApplyBlockFields[\s\S]{0,400}specRef\.current/.test(builder),
  'history/theme/AI use specRef.current',
);

gate(
  'UNDO_REDO',
  builder.includes('futureRef.current.push(cloneSpec(specRef.current))') &&
    builder.includes('historyRef.current.push(cloneSpec(specRef.current))') &&
    builder.includes("key === 'z'"),
  'undo/redo snapshot from specRef',
);

gate(
  'CUSTOM_CSS_SAVE',
  design.includes('scheduleCommit') &&
    design.includes('onBlur') &&
    design.includes('450') &&
    design.includes('debounceRef'),
  'custom CSS debounced + blur commit',
);

gate(
  'MOBILE_TOOLBAR',
  ux.includes('isMobileViewport') &&
    ux.includes('spaceBelow') &&
    ux.includes("vw <= 767") &&
    ux.includes("data-[lp-toolbar-placement=below]"),
  'text toolbar places above/below by viewport',
);

gate(
  'MULTISELECT',
  ux.includes('isSectionMultiChrome') &&
    ux.includes('data-lp-section-multi') &&
    renderer.includes("isSelected?.({ blockId: block.id, element: 'section' })") &&
    design.includes('selectedField'),
  'shift multi-select section chrome + inspector field',
);

const failed = Object.entries(gates).filter(([, v]) => !v.ok);
process.exit(failed.length ? 1 : 0);
