'use client';

/**
 * Canvas-only right-click context menu for LP Builder.
 * Reuses existing canvas/builder actions — no parallel business logic.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import type { LandingPageBlock, LandingPageBlockType } from '@marketingspa/shared';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  resolveInspectorContext,
  type InspectorContextKind,
} from './landing-page-inspector-context';
import type { LandingPageCanvasElementKey, LandingPageInlineTextStyle } from './landing-page-canvas-ux';

export type LpCanvasClipboardStyle = {
  style?: Record<string, unknown>;
  background?: string | null;
  imageStyle?: Record<string, unknown>;
  inlineTextStyle?: LandingPageInlineTextStyle;
};

export type LandingPageCanvasContextMenuActions = {
  pageId: string;
  selectedBlock: LandingPageBlock | null;
  selectedElement: LandingPageCanvasElementKey;
  canPasteBlock: boolean;
  canPasteStyle: boolean;
  onSelectFromTarget: (blockId: string, element: LandingPageCanvasElementKey) => void;
  /** Clear canvas selection (empty-canvas right-click). */
  onClearSelection: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: (blockId: string) => void;
  onDelete: (blockId: string) => void;
  onCopyBlock: (blockId: string) => void;
  onPasteBlock: () => void;
  onCopyStyle: (blockId: string) => void;
  onPasteStyle: (blockId: string) => void;
  onMoveLayer: (blockId: string, direction: 'up' | 'down') => void;
  onToggleLock: (blockId: string) => void;
  onAlign: (blockId: string, align: 'left' | 'center' | 'right') => void;
  onToggleGroup: (blockId: string) => void;
  onInsertSection: (blockId: string, where: 'above' | 'below') => void;
  onReplaceImage: (blockId: string) => void;
  onImageFit: (blockId: string, fit: 'cover' | 'contain') => void;
  onFocusInlineEdit: (blockId: string, field: string) => void;
  onFocusButtonLink: (blockId: string) => void;
  onApplyField: (blockId: string, field: string, value: string, mode: 'replace' | 'append') => void;
};

export type LpCanvasAiPopoverState = {
  x: number;
  y: number;
  blockId: string;
  field: string;
  fieldKind: string;
  blockType: LandingPageBlockType;
  mode: 'quick' | 'rewrite' | 'cta' | 'section' | 'image';
  current: string;
};

export function resolveFieldForContext(
  block: LandingPageBlock,
  element: LandingPageCanvasElementKey,
  kind: InspectorContextKind,
): { field: string; fieldKind: string } {
  if (kind === 'button' || element === 'cta') return { field: 'ctaLabel', fieldKind: 'ctaLabel' };
  if (element === 'headline') return { field: 'headline', fieldKind: 'headline' };
  if (element === 'subheadline') return { field: 'subheadline', fieldKind: 'subheadline' };
  if (element === 'body') return { field: 'body', fieldKind: 'body' };
  if (kind === 'text' || kind === 'section') {
    if ('headline' in block && (block as { headline?: string }).headline) {
      return { field: 'headline', fieldKind: 'headline' };
    }
    if ('body' in block) return { field: 'body', fieldKind: 'body' };
  }
  return { field: 'headline', fieldKind: 'headline' };
}

function clampPopover(x: number, y: number, w = 300, h = 280) {
  const pad = 8;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  return {
    x: Math.min(Math.max(pad, x), Math.max(pad, vw - w - pad)),
    y: Math.min(Math.max(pad, y), Math.max(pad, vh - h - pad)),
  };
}

function parseContextTarget(target: EventTarget | null): {
  blockId: string | null;
  element: LandingPageCanvasElementKey;
} {
  const el = target as HTMLElement | null;
  if (!el?.closest) return { blockId: null, element: 'section' };
  const blockHost = el.closest('[data-lp-block-id]') as HTMLElement | null;
  const blockId = blockHost?.getAttribute('data-lp-block-id') || null;
  const inline = el.closest('[data-lp-inline-field]') as HTMLElement | null;
  const field = inline?.getAttribute('data-lp-inline-field');
  if (field === 'ctaLabel') return { blockId, element: 'cta' };
  if (field === 'headline' || field === 'subheadline' || field === 'body') {
    return { blockId, element: field };
  }
  const elemHost = el.closest('[data-lp-element-id]') as HTMLElement | null;
  const eid = elemHost?.getAttribute('data-lp-element-id') || '';
  if (eid.includes('::')) {
    const key = eid.split('::')[1] || 'section';
    if (
      key === 'image' ||
      key === 'cta' ||
      key === 'headline' ||
      key === 'subheadline' ||
      key === 'body' ||
      key.startsWith('item:') ||
      key.startsWith('grid:')
    ) {
      return { blockId, element: key as LandingPageCanvasElementKey };
    }
  }
  if (el.closest('[data-lp-section-bg-hit],[data-lp-selection-target="section-background"]')) {
    return { blockId, element: 'section-background' };
  }
  return { blockId, element: 'section' };
}

export function LpCanvasAiQuickPopover({
  state,
  pageId,
  onClose,
  onApply,
}: {
  state: LpCanvasAiPopoverState;
  pageId: string;
  onClose: () => void;
  onApply: (value: string, mode: 'replace' | 'append') => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const panelRef = useRef<HTMLDivElement | null>(null);

  const runSuggest = useCallback(
    async (action: 'rewrite' | 'generate' = 'rewrite') => {
      setBusy(true);
      setError(null);
      try {
        const res = await apiClient<{ options: [string, string, string] }>(
          `/landing-pages/${pageId}/ai-suggest-field`,
          {
            method: 'POST',
            body: JSON.stringify({
              action,
              fieldKind: state.fieldKind,
              blockType: state.blockType,
              currentContent: prompt.trim() || state.current,
              pageGoal: 'lead',
              blockContext: `type=${state.blockType};mode=${state.mode}`,
            }),
          },
        );
        const opts = (res.options || []).filter(Boolean);
        setOptions(opts);
        setSelected(opts[0] || null);
        if (!opts.length) setError('Không có gợi ý — thử Tạo lại.');
      } catch (e) {
        setError(
          e instanceof ApiError && e.statusCode === 429
            ? 'Quá nhiều yêu cầu — đợi rồi thử lại.'
            : e instanceof Error
              ? e.message
              : 'AI lỗi',
        );
      } finally {
        setBusy(false);
      }
    },
    [pageId, prompt, state],
  );

  useEffect(() => {
    void runSuggest(state.current.trim() ? 'rewrite' : 'generate');
  }, [state.blockId, state.field, state.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  const pos = clampPopover(state.x, state.y);

  return (
    <div
      ref={panelRef}
      data-lp-ai-quick-popover="1"
      className="fixed z-[90] w-[min(300px,calc(100vw-1rem))] overflow-hidden rounded-lg border border-white/15 bg-zinc-950 p-3 shadow-2xl"
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold text-white/90">✨ AI nhanh</div>
        <button type="button" className="text-[10px] text-white/50 hover:text-white" onClick={onClose}>
          Esc
        </button>
      </div>
      <input
        className="mb-2 w-full rounded border border-white/10 bg-transparent px-2 py-1.5 text-xs"
        placeholder="Gợi ý thêm (tuỳ chọn)…"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      {busy ? <p className="text-xs text-white/50">Đang gợi ý…</p> : null}
      {error ? <p className="text-xs text-amber-200/90">{error}</p> : null}
      <div className="max-h-36 space-y-1 overflow-y-auto">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            className={`block w-full rounded border px-2 py-1.5 text-left text-[11px] leading-snug ${
              selected === opt
                ? 'border-emerald-400/50 bg-emerald-500/15 text-white'
                : 'border-white/10 text-white/75 hover:bg-white/5'
            }`}
            onClick={() => setSelected(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button
          type="button"
          size="sm"
          className="h-7 text-[11px]"
          disabled={!selected || busy}
          data-lp-ai-apply-replace
          onClick={() => selected && onApply(selected, 'replace')}
        >
          Thay thế
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 border-white/20 text-[11px]"
          disabled={!selected || busy}
          data-lp-ai-apply-append
          onClick={() => selected && onApply(selected, 'append')}
        >
          Chèn thêm
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-[11px] text-white/70"
          disabled={busy}
          data-lp-ai-regenerate
          onClick={() => void runSuggest('generate')}
        >
          Tạo lại
        </Button>
      </div>
      <p className="mt-2 text-[10px] text-white/40">Không tự ghi đè — chọn Thay thế / Chèn thêm.</p>
    </div>
  );
}

export function LandingPageCanvasContextMenu({
  children,
  actions,
}: {
  children: ReactNode;
  actions: LandingPageCanvasContextMenuActions;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [clickPos, setClickPos] = useState({ x: 0, y: 0 });
  const [ai, setAi] = useState<LpCanvasAiPopoverState | null>(null);
  /** Target of THIS contextmenu open — never fall back to a prior selectedBlock. */
  const [menuHit, setMenuHit] = useState<{
    blockId: string;
    element: LandingPageCanvasElementKey;
  } | null>(null);
  const menuHitRef = useRef<{ blockId: string; element: LandingPageCanvasElementKey } | null>(
    null,
  );

  // Menu actions bind to the right-click hit, not stale parent selection.
  const menuBlockId = menuHit?.blockId ?? null;
  const block =
    menuBlockId && actions.selectedBlock?.id === menuBlockId ? actions.selectedBlock : null;
  const menuElement = menuHit?.element ?? 'section';
  const ctx = resolveInspectorContext(block, menuElement);
  const sectionLocked = Boolean(block?.locked);
  const editDisabled = !menuBlockId || sectionLocked;

  const openAi = (mode: LpCanvasAiPopoverState['mode']) => {
    if (!block || !menuBlockId || sectionLocked) return;
    const { field, fieldKind } = resolveFieldForContext(block, menuElement, ctx.kind);
    const rec = block as unknown as Record<string, unknown>;
    const current = typeof rec[field] === 'string' ? String(rec[field]) : '';
    setAi({
      x: clickPos.x + 12,
      y: clickPos.y + 12,
      blockId: menuBlockId,
      field,
      fieldKind,
      blockType: block.type as LandingPageBlockType,
      mode,
      current,
    });
  };

  const onContextMenuCapture = useCallback(
    (e: ReactMouseEvent) => {
      // Only canvas — ignore inspector / left rail if somehow nested.
      if ((e.target as HTMLElement | null)?.closest?.('[data-lp-inspector],[data-lp-left-rail]')) {
        return;
      }
      const hit = parseContextTarget(e.target);
      setClickPos({ x: e.clientX, y: e.clientY });
      if (hit.blockId) {
        const next = { blockId: hit.blockId, element: hit.element };
        menuHitRef.current = next;
        setMenuHit(next);
        actions.onSelectFromTarget(hit.blockId, hit.element);
      } else {
        // Empty canvas padding — drop prior selection so Delete/Duplicate cannot
        // act on the previously selected block.
        menuHitRef.current = null;
        setMenuHit(null);
        actions.onClearSelection();
      }
    },
    [actions],
  );

  const actBlockId = () => menuHitRef.current?.blockId ?? menuHit?.blockId ?? null;

  const kindLabel = useMemo(() => {
    if (!menuBlockId) return 'Canvas';
    switch (ctx.kind) {
      case 'text':
        return 'Text';
      case 'image':
        return 'Image';
      case 'button':
        return 'Button';
      case 'form':
        return 'Form';
      case 'video':
        return 'Video';
      case 'countdown':
        return 'Countdown';
      case 'section':
        return 'Section';
      default:
        return 'Canvas';
    }
  }, [ctx.kind, menuBlockId]);

  return (
    <>
      <ContextMenu
        onOpenChange={(open) => {
          setMenuOpen(open);
        }}
      >
        <ContextMenuTrigger asChild>
          <div
            data-lp-canvas-context-menu="1"
            data-lp-context-menu-open={menuOpen ? '1' : '0'}
            onContextMenuCapture={onContextMenuCapture}
            className="min-w-0"
          >
            {children}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent data-lp-canvas-context-menu-content="1" collisionPadding={8}>
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/40">
            {kindLabel}
          </div>

          <ContextMenuItem
            disabled={editDisabled}
            onSelect={() => openAi('quick')}
            data-lp-cm="ai-quick"
          >
            ✨ AI nhập nhanh
          </ContextMenuItem>
          <ContextMenuItem
            disabled={editDisabled}
            onSelect={() => openAi(ctx.kind === 'button' ? 'cta' : 'rewrite')}
            data-lp-cm="ai-rewrite"
          >
            ✨ AI viết lại
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuItem
            disabled={!menuBlockId}
            onSelect={() => {
              const id = actBlockId();
              if (id) actions.onCopyBlock(id);
            }}
            data-lp-cm="copy"
          >
            Sao chép
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!actions.canPasteBlock || sectionLocked}
            onSelect={() => actions.onPasteBlock()}
            data-lp-cm="paste"
          >
            Dán
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!menuBlockId}
            onSelect={() => {
              const id = actBlockId();
              if (id) actions.onDuplicate(id);
            }}
            data-lp-cm="duplicate"
          >
            Tạo bản sao
          </ContextMenuItem>
          <ContextMenuItem
            disabled={editDisabled}
            className="text-red-300 focus:text-red-200"
            onSelect={() => {
              const id = actBlockId();
              if (id) actions.onDelete(id);
            }}
            data-lp-cm="delete"
          >
            Xóa
          </ContextMenuItem>

          <ContextMenuSeparator />

          <ContextMenuSub>
            <ContextMenuSubTrigger data-lp-cm="layer">Lớp</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem
                disabled={editDisabled}
                onSelect={() => {
                  const id = actBlockId();
                  if (id) actions.onMoveLayer(id, 'up');
                }}
              >
                Đưa lên
              </ContextMenuItem>
              <ContextMenuItem
                disabled={editDisabled}
                onSelect={() => {
                  const id = actBlockId();
                  if (id) actions.onMoveLayer(id, 'down');
                }}
              >
                Đưa xuống
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>

          <ContextMenuSub>
            <ContextMenuSubTrigger data-lp-cm="align">Căn chỉnh</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem
                disabled={editDisabled}
                onSelect={() => {
                  const id = actBlockId();
                  if (id) actions.onAlign(id, 'left');
                }}
              >
                Trái
              </ContextMenuItem>
              <ContextMenuItem
                disabled={editDisabled}
                onSelect={() => {
                  const id = actBlockId();
                  if (id) actions.onAlign(id, 'center');
                }}
              >
                Giữa
              </ContextMenuItem>
              <ContextMenuItem
                disabled={editDisabled}
                onSelect={() => {
                  const id = actBlockId();
                  if (id) actions.onAlign(id, 'right');
                }}
              >
                Phải
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>

          <ContextMenuItem
            disabled={!menuBlockId}
            onSelect={() => {
              const id = actBlockId();
              if (id) actions.onToggleLock(id);
            }}
            data-lp-cm="lock"
          >
            {block?.locked ? 'Mở khóa' : 'Khóa'}
          </ContextMenuItem>
          <ContextMenuItem
            disabled={editDisabled}
            onSelect={() => {
              const id = actBlockId();
              if (id) actions.onToggleGroup(id);
            }}
            data-lp-cm="group"
          >
            {((block?.style || {}) as { lpGrouped?: boolean }).lpGrouped
              ? 'Bỏ nhóm'
              : 'Nhóm'}
          </ContextMenuItem>

          <ContextMenuItem
            disabled={!menuBlockId}
            onSelect={() => {
              const id = actBlockId();
              if (id) actions.onCopyStyle(id);
            }}
            data-lp-cm="copy-style"
          >
            Sao chép kiểu
          </ContextMenuItem>
          <ContextMenuItem
            disabled={editDisabled || !actions.canPasteStyle}
            onSelect={() => {
              const id = actBlockId();
              if (id) actions.onPasteStyle(id);
            }}
            data-lp-cm="paste-style"
          >
            Dán kiểu
          </ContextMenuItem>

          <ContextMenuSeparator />

          {/* Element-specific */}
          {(ctx.kind === 'text' || ctx.kind === 'button') && block && menuBlockId && !sectionLocked ? (
            <>
              <ContextMenuItem
                onSelect={() => {
                  const id = actBlockId();
                  if (!id || !block) return;
                  const { field } = resolveFieldForContext(block, menuElement, ctx.kind);
                  actions.onFocusInlineEdit(id, field);
                }}
                data-lp-cm="edit-text"
              >
                Sửa text
              </ContextMenuItem>
              {ctx.kind === 'button' ? (
                <ContextMenuItem
                  onSelect={() => {
                    const id = actBlockId();
                    if (id) actions.onFocusButtonLink(id);
                  }}
                  data-lp-cm="edit-link"
                >
                  Sửa link / action
                </ContextMenuItem>
              ) : null}
              <ContextMenuItem onSelect={() => openAi(ctx.kind === 'button' ? 'cta' : 'rewrite')}>
                ✨ AI {ctx.kind === 'button' ? 'CTA' : 'viết lại'}
              </ContextMenuItem>
            </>
          ) : null}

          {ctx.kind === 'image' && block && menuBlockId && !sectionLocked ? (
            <>
              <ContextMenuItem
                onSelect={() => {
                  const id = actBlockId();
                  if (id) actions.onReplaceImage(id);
                }}
                data-lp-cm="replace-image"
              >
                Đổi ảnh
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() => {
                  const id = actBlockId();
                  if (id) actions.onImageFit(id, 'cover');
                }}
              >
                Fit: Cover
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() => {
                  const id = actBlockId();
                  if (id) actions.onImageFit(id, 'contain');
                }}
              >
                Fit: Contain
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => openAi('image')}>✨ AI gợi ý ảnh/alt</ContextMenuItem>
            </>
          ) : null}

          {ctx.kind === 'section' && menuBlockId && !sectionLocked ? (
            <>
              <ContextMenuItem onSelect={() => openAi('section')} data-lp-cm="ai-section">
                ✨ AI tạo nội dung section
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() => {
                  const id = actBlockId();
                  if (id) actions.onInsertSection(id, 'above');
                }}
                data-lp-cm="insert-above"
              >
                Thêm section phía trên
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() => {
                  const id = actBlockId();
                  if (id) actions.onInsertSection(id, 'below');
                }}
                data-lp-cm="insert-below"
              >
                Thêm section phía dưới
              </ContextMenuItem>
              <ContextMenuItem
                onSelect={() => {
                  const id = actBlockId();
                  if (id) actions.onDuplicate(id);
                }}
              >
                Duplicate section
              </ContextMenuItem>
            </>
          ) : null}

          {ctx.kind === 'form' && menuBlockId ? (
            <ContextMenuItem disabled data-lp-cm="form-hint">
              Form: CRM ở Inspector → Nội dung
            </ContextMenuItem>
          ) : null}

          {ctx.kind === 'video' && block && menuBlockId ? (
            <ContextMenuItem
              onSelect={() => {
                const id = actBlockId();
                if (id) actions.onFocusInlineEdit(id, 'videoUrl');
              }}
              data-lp-cm="edit-video"
            >
              Sửa URL video (Inspector)
            </ContextMenuItem>
          ) : null}

          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => actions.onUndo()} data-lp-cm="undo">
            Undo
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => actions.onRedo()} data-lp-cm="redo">
            Redo
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {ai ? (
        <LpCanvasAiQuickPopover
          state={ai}
          pageId={actions.pageId}
          onClose={() => setAi(null)}
          onApply={(value, mode) => {
            actions.onApplyField(ai.blockId, ai.field, value, mode);
            setAi(null);
          }}
        />
      ) : null}
    </>
  );
}
