#!/usr/bin/env node
/**
 * Gate: LP Canvas right-click context menu
 *   node scripts/test-landing-page-canvas-context-menu.cjs
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const builder = read('apps/web/src/components/landing-pages/landing-page-builder.tsx');
const menu = read('apps/web/src/components/landing-pages/landing-page-canvas-context-menu.tsx');
const ui = read('apps/web/src/components/ui/context-menu.tsx');
const sidebar = read('apps/web/src/components/landing-pages/landing-page-builder-sidebar.tsx');
const pkg = read('apps/web/package.json');
const freeDrag = read('apps/web/src/components/landing-pages/landing-page-free-drag.tsx');

const gates = {};
function gate(name, ok, detail) {
  gates[name] = !!ok;
  console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (detail ? ' — ' + detail : ''));
}

gate(
  'CONTEXT_MENU',
  pkg.includes('@radix-ui/react-context-menu') &&
    ui.includes('ContextMenuPrimitive') &&
    menu.includes('ContextMenu') &&
    menu.includes('data-lp-canvas-context-menu') &&
    builder.includes('LandingPageCanvasContextMenu') &&
    menu.includes('collisionPadding'),
  'Radix ContextMenu on canvas only',
);

gate(
  'CONTEXT_AWARE',
  menu.includes('resolveInspectorContext') &&
    menu.includes("ctx.kind === 'text'") &&
    menu.includes("ctx.kind === 'image'") &&
    menu.includes("ctx.kind === 'button'") &&
    menu.includes("ctx.kind === 'section'") &&
    menu.includes("ctx.kind === 'form'") &&
    menu.includes("ctx.kind === 'video'") &&
    menu.includes('parseContextTarget'),
  'menu items follow selection kind',
);

gate(
  'AI_QUICK_ACTION',
  menu.includes('data-lp-ai-quick-popover') &&
    menu.includes('data-lp-ai-apply-replace') &&
    menu.includes('data-lp-ai-apply-append') &&
    menu.includes('data-lp-ai-regenerate') &&
    menu.includes('ai-suggest-field') &&
    menu.includes('Thay thế') &&
    menu.includes('Chèn thêm') &&
    menu.includes('Tạo lại') &&
    menu.includes('Không tự ghi đè'),
  'AI popover near click; replace/append/regenerate',
);

gate(
  'EXISTING_ACTIONS_REUSED',
  builder.includes('onDuplicate: (blockId) => dupBlock(blockId)') &&
    builder.includes('onDelete: (blockId) => removeBlock(blockId)') &&
    builder.includes('onMoveLayer: (blockId, direction) => moveBlock(blockId, direction)') &&
    builder.includes('applyAiToBlockField') &&
    builder.includes('duplicateBlock') &&
    menu.includes('onUndo') &&
    menu.includes('onRedo'),
  'dup/delete/move/undo reuse builder actions',
);

gate(
  'UNDO_REDO',
  builder.includes('const undo = useCallback') &&
    builder.includes('onUndo: () => undo()') &&
    builder.includes('onRedo: () => redo()'),
  'undo/redo wired from context menu',
);

gate(
  'CANVAS_UNCHANGED',
  freeDrag.includes('useFreeDragBox') &&
    freeDrag.includes('FreeTransformChrome') &&
    builder.includes('/autosave') &&
    builder.includes('Publish') &&
    sidebar.includes('LP_RAIL_QUICK_INSERT') &&
    builder.includes('<LandingPageCanvasContextMenu') &&
    menu.includes('data-lp-canvas-context-menu="1"'),
  'free-drag/autosave/publish/left rail intact; menu only on canvas',
);

const failed = Object.entries(gates).filter(([, ok]) => !ok);
console.log('');
Object.keys(gates).forEach((k) => console.log(k + '=' + (gates[k] ? 'PASS' : 'FAIL')));
console.log('CANVAS_CONTEXT_MENU_READY=' + (failed.length ? 'FAIL' : 'PASS'));
process.exit(failed.length ? 1 : 0);
