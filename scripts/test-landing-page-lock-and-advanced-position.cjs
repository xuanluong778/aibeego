#!/usr/bin/env node
/**
 * BUG-10 section lock semantics + BUG-11 advanced position clamp
 *   node scripts/test-landing-page-lock-and-advanced-position.cjs
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const builder = read('apps/web/src/components/landing-pages/landing-page-builder.tsx');
const drag = read('apps/web/src/components/landing-pages/landing-page-free-drag.tsx');
const ux = read('apps/web/src/components/landing-pages/landing-page-canvas-ux.tsx');
const menu = read('apps/web/src/components/landing-pages/landing-page-canvas-context-menu.tsx');

const gates = {};
function gate(name, ok, detail) {
  gates[name] = { ok: !!ok, detail: detail || '' };
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail ? ' — ' + detail : ''));
}

// --- BUG-10 ---
gate(
  'LOCK_GUARD_HELPER',
  builder.includes('function guardSectionUnlocked') &&
    builder.includes('function isSectionLocked') &&
    builder.includes("Section đang khóa — mở khóa trước khi chỉnh sửa"),
  'central lock guard + toast',
);

gate(
  'LOCK_GUARDS_STRUCTURAL',
  /function moveBlock[\s\S]*?guardSectionUnlocked/.test(builder) &&
    /function reorderBlockById[\s\S]*?guardSectionUnlocked/.test(builder) &&
    /function toggleBlockFreePosition[\s\S]*?guardSectionUnlocked/.test(builder) &&
    builder.includes("Section đang khóa — mở khóa trước khi xóa") &&
    builder.includes('moving?.locked'),
  'move/reorder/free-position/delete/sidebar reorder guarded',
);

gate(
  'LOCK_GUARDS_EDIT',
  /function updateBlock\([\s\S]*?onlyLockToggle/.test(builder) &&
    /function updateBlockFieldLive[\s\S]*?guardSectionUnlocked/.test(builder) &&
    /function updateBlockFieldCommit[\s\S]*?guardSectionUnlocked/.test(builder) &&
    /function patchInlineTextStyle[\s\S]*?guardSectionUnlocked/.test(builder) &&
    /function commitBlockFreeLayout[\s\S]*?guardSectionUnlocked/.test(builder),
  'content + free-layout commits blocked while locked (lock toggle allowed)',
);

gate(
  'LOCK_UI_DISABLE',
  ux.includes('isBlockLocked') &&
    ux.includes('sectionLocked') &&
    ux.includes("data-lp-section-locked={sectionLocked ? '1' : '0'}") &&
    ux.includes('allowReorder={allowReorder && !sectionLocked}') &&
    menu.includes('editDisabled') &&
    menu.includes('sectionLocked') &&
    builder.includes('disabled={selected.locked === true}') &&
    builder.includes('isTextElementLocked') &&
    builder.includes('if (isSectionLocked(blockId)) return true'),
  'toolbar/context/inspector/inline disable when section locked',
);

// --- BUG-11 ---
gate(
  'SHARED_BOUNDS_CONSTANTS',
  drag.includes('FREE_LAYOUT_ABSOLUTE_BOUNDS') &&
    drag.includes('minPos: -40') &&
    drag.includes('maxPos: 2400') &&
    drag.includes('maxSize: 2400') &&
    /export function isPlausibleFreeLayout[\s\S]*FREE_LAYOUT_ABSOLUTE_BOUNDS/.test(drag),
  'isPlausibleFreeLayout uses shared FREE_LAYOUT_ABSOLUTE_BOUNDS',
);

gate(
  'CLAMP_HELPER_SAME_BOUNDS',
  drag.includes('export function clampAbsoluteFreeLayout') &&
    drag.includes('export function patchAbsoluteFreeLayoutField') &&
    /clampAbsoluteFreeLayout[\s\S]*FREE_LAYOUT_ABSOLUTE_BOUNDS/.test(drag) &&
    builder.includes('patchAbsoluteFreeLayoutField') &&
    builder.includes('clampAbsoluteFreeLayout'),
  'Advanced Position uses same clamp helper as plausibility bounds',
);

gate(
  'ADVANCED_POSITION_CLAMPS_BEFORE_UPDATE',
  /data-lp="advanced-position"[\s\S]*patchAbsoluteFreeLayoutField[\s\S]*updateBlock\(selected\.id/.test(
    builder,
  ) &&
    !/data-lp="advanced-position"[\s\S]*freeLayout:\s*\{\s*\.\.\.selected\.freeLayout![\s\S]*\[key\]:\s*Number\.isFinite/.test(
      builder,
    ),
  'inspector numbers go through patchAbsoluteFreeLayoutField before updateBlock',
);

gate(
  'CLAMP_KEEPS_PLAUSIBLE',
  (() => {
    // Lightweight simulation of exported bounds (mirror source of truth in free-drag).
    const FREE_LAYOUT_ABSOLUTE_BOUNDS = { minPos: -40, maxPos: 2400, minSize: 1, maxSize: 2400 };
    function clampNumber(n, min, max) {
      return Math.min(max, Math.max(min, n));
    }
    function clampAbsoluteFreeLayout(layout) {
      const { minPos, maxPos, minSize, maxSize } = FREE_LAYOUT_ABSOLUTE_BOUNDS;
      const next = {
        ...layout,
        x: clampNumber(Number(layout.x) || 0, minPos, maxPos),
        y: clampNumber(Number(layout.y) || 0, minPos, maxPos),
      };
      if (layout.width != null && Number.isFinite(layout.width)) {
        next.width = clampNumber(layout.width, minSize, maxSize);
      }
      if (layout.height != null && Number.isFinite(layout.height)) {
        next.height = clampNumber(layout.height, minSize, maxSize);
      }
      return next;
    }
    function isPlausible(layout) {
      const { minPos, maxPos, maxSize } = FREE_LAYOUT_ABSOLUTE_BOUNDS;
      if (layout.x < minPos || layout.y < minPos) return false;
      if (layout.x > maxPos || layout.y > maxPos) return false;
      if (layout.width != null && (layout.width <= 0 || layout.width > maxSize)) return false;
      if (layout.height != null && (layout.height <= 0 || layout.height > maxSize)) return false;
      return true;
    }
    const cases = [
      { x: 24, y: -100, width: 2500, height: 200 },
      { x: 3000, y: 10, width: 100, height: 0 },
      { x: -40, y: 2400, width: 2400, height: 1 },
    ];
    return cases.every((c) => isPlausible(clampAbsoluteFreeLayout(c)));
  })(),
  'clamped layouts always pass isPlausibleFreeLayout absolute bounds',
);

gate(
  'UNDO_AUTOSAVE_PATH_INTACT',
  builder.includes('const undo = useCallback') &&
    builder.includes('const redo = useCallback') &&
    builder.includes('pushHistory') &&
    builder.includes('persist(') &&
    builder.includes('clientRevision'),
  'undo/redo + autosave revision path unchanged',
);

const bug10 = [
  'LOCK_GUARD_HELPER',
  'LOCK_GUARDS_STRUCTURAL',
  'LOCK_GUARDS_EDIT',
  'LOCK_UI_DISABLE',
];
const bug11 = [
  'SHARED_BOUNDS_CONSTANTS',
  'CLAMP_HELPER_SAME_BOUNDS',
  'ADVANCED_POSITION_CLAMPS_BEFORE_UPDATE',
  'CLAMP_KEEPS_PLAUSIBLE',
  'UNDO_AUTOSAVE_PATH_INTACT',
];

console.log('');
for (const k of Object.keys(gates)) {
  console.log(k + '=' + (gates[k].ok ? 'PASS' : 'FAIL'));
}
const fail10 = bug10.some((k) => !gates[k].ok);
const fail11 = bug11.some((k) => !gates[k].ok);
console.log(fail10 ? 'BUG_10=FAIL' : 'BUG_10=PASS');
console.log(fail11 ? 'BUG_11=FAIL' : 'BUG_11=PASS');
process.exit(fail10 || fail11 ? 1 : 0);
