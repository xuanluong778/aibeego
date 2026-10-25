'use client';

/**
 * Right-rail “THÊM THÀNH PHẦN” — full replacement for left-sidebar insert + layers.
 * Reuses left catalogs / DnD MIME / insert handlers; does not own engine logic.
 */

import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react';
import type { LandingPageBlock, LandingPageBlockType } from '@marketingspa/shared';
import {
  LP_ADD_ELEMENTS_LIVE,
} from './landing-page-builder-sidebar';
import { beginSidebarPresetDrag, suppressClickAfterSidebarDrag } from './landing-page-sidebar-dnd';
import {
  LandingPageTextPresetsPanel,
  type LandingPageListPreset,
  type LandingPageParagraphPreset,
  type LandingPageTitlePreset,
  type TextPresetTab,
} from './landing-page-title-presets';
import {
  LandingPageButtonPresetsPanel,
  type LandingPageButtonGroupPreset,
  type LandingPageButtonPreset,
  type ButtonPresetTab,
} from './landing-page-button-presets';
import { LandingPageGraphicsLibraryPanel } from './landing-page-graphics-library';
import type { LandingPageBoxPreset } from './landing-page-box-presets';
import {
  LP_FORM_GROUPS,
  LP_FORM_PRESETS,
  type LandingPageFormPreset,
} from './landing-page-form-presets';
import { cn } from '@/lib/utils';

type RootMode = 'add' | 'layers';
type SubView = 'root' | 'text' | 'button' | 'graphics' | 'icon' | 'forms';

type QuickCard = {
  id: string;
  label: string;
  icon: string;
  kind:
    | 'section-library'
    | 'media'
    | 'text-title'
    | 'text-paragraph'
    | 'text-list'
    | 'button'
    | 'graphics'
    | 'icon'
    | 'forms'
    | 'layers'
    | 'block';
  blockType?: LandingPageBlockType;
};

/** Cơ bản — gọn cho người mới: thư viện + insert thường dùng. */
const BASIC_CARDS: QuickCard[] = [
  { id: 'section', label: 'Phần', icon: '▭', kind: 'section-library' },
  { id: 'heading', label: 'Tiêu đề', icon: 'T', kind: 'text-title' },
  { id: 'text', label: 'Văn bản', icon: '¶', kind: 'text-paragraph' },
  { id: 'list', label: 'Danh sách', icon: '≡', kind: 'text-list' },
  { id: 'button', label: 'Nút', icon: '⏺', kind: 'button' },
  { id: 'image', label: 'Ảnh', icon: '🖼', kind: 'media' },
  { id: 'video', label: 'Video', icon: '▶', kind: 'block', blockType: 'Video' },
  { id: 'graphics', label: 'Đồ họa', icon: '◇', kind: 'graphics' },
  { id: 'icon', label: 'Biểu tượng', icon: '✦', kind: 'icon' },
  { id: 'forms', label: 'Mẫu form', icon: '▭', kind: 'forms' },
];

const ADVANCED_CARDS: QuickCard[] = [
  { id: 'form', label: 'Biểu mẫu', icon: '▭', kind: 'block', blockType: 'LeadForm' },
  { id: 'gallery', label: 'Thư viện', icon: '🖼', kind: 'block', blockType: 'Gallery' },
  { id: 'countdown', label: 'Bộ hẹn giờ', icon: '⏱', kind: 'block', blockType: 'Countdown' },
  { id: 'hero', label: 'Hero', icon: '▣', kind: 'block', blockType: 'Hero' },
  { id: 'benefits', label: 'Benefits', icon: '≡', kind: 'block', blockType: 'Benefits' },
  { id: 'features', label: 'Features', icon: '✦', kind: 'block', blockType: 'Features' },
  { id: 'testimonials', label: 'Testimonials', icon: '★', kind: 'block', blockType: 'Testimonials' },
  { id: 'process', label: 'Process', icon: '↳', kind: 'block', blockType: 'Process' },
  { id: 'speaker', label: 'Speaker', icon: '👤', kind: 'block', blockType: 'Speaker' },
  { id: 'guarantee', label: 'Guarantee', icon: '✓', kind: 'block', blockType: 'Guarantee' },
  { id: 'faq', label: 'FAQ', icon: '▤', kind: 'block', blockType: 'FAQ' },
  { id: 'cta', label: 'CTA', icon: '⏺', kind: 'block', blockType: 'CTA' },
  { id: 'header', label: 'Header', icon: '☰', kind: 'block', blockType: 'Header' },
  { id: 'footer', label: 'Footer', icon: '▁', kind: 'block', blockType: 'Footer' },
];

const ECOMMERCE_CARDS: QuickCard[] = [
  { id: 'product', label: 'Hộp sản phẩm', icon: '▣', kind: 'block', blockType: 'Product' },
  { id: 'pricing', label: 'Bảng giá', icon: '₫', kind: 'block', blockType: 'Pricing' },
];

const LIVE_TYPES = new Set(LP_ADD_ELEMENTS_LIVE.map((r) => r.type));

function filterLiveCards(cards: QuickCard[]): QuickCard[] {
  return cards.filter((c) =>
    c.kind === 'block' ? c.blockType != null && LIVE_TYPES.has(c.blockType) : true,
  );
}

export type LandingPageAddComponentsPanelProps = {
  onAddBlock: (type: LandingPageBlockType) => void;
  onAddBlocks: (types: LandingPageBlockType[]) => void;
  onOpenMediaLibrary?: () => void;
  onOpenSectionLibrary?: () => void;
  onOpenButtonLibrary?: () => void;
  onInsertTitlePreset?: (preset: LandingPageTitlePreset) => void;
  onInsertParagraphPreset?: (preset: LandingPageParagraphPreset) => void;
  onInsertListPreset?: (preset: LandingPageListPreset) => void;
  onInsertButtonPreset?: (preset: LandingPageButtonPreset) => void;
  onInsertButtonGroupPreset?: (preset: LandingPageButtonGroupPreset) => void;
  onInsertBoxPreset?: (preset: LandingPageBoxPreset) => void;
  onInsertFormPreset?: (preset: LandingPageFormPreset) => void;
  /** Layers (from left sidebar) */
  blocks?: LandingPageBlock[];
  selectedBlockId?: string | null;
  onSelectBlock?: (id: string) => void;
  onReorderBlocks?: (fromIndex: number, toIndex: number) => void;
  onDupBlock?: (id: string) => void;
  onRemoveBlock?: (id: string) => void;
  /** AI menu (from left sidebar) */
  aiMenu?: ReactNode;
  /** Open on layers when launched from external request */
  initialRootMode?: RootMode;
  /** @deprecated bottom Phần tử/Section mẫu tabs removed — presets → mở thư viện Phần */
  initialAddTab?: 'elements' | 'presets';
};

const EMBEDDED_PRESET_CLASS =
  '!relative !left-0 !top-0 !ml-0 !mt-0 !h-full !max-h-none !w-full !min-h-0 !rounded-none !border-0 !shadow-none';

export function LandingPageAddComponentsPanel({
  onAddBlock,
  onAddBlocks,
  onOpenMediaLibrary,
  onOpenSectionLibrary,
  onOpenButtonLibrary,
  onInsertTitlePreset,
  onInsertParagraphPreset,
  onInsertListPreset,
  onInsertButtonPreset,
  onInsertButtonGroupPreset,
  onInsertBoxPreset,
  onInsertFormPreset,
  blocks,
  selectedBlockId,
  onSelectBlock,
  onReorderBlocks,
  onDupBlock,
  onRemoveBlock,
  aiMenu,
  initialRootMode = 'add',
  initialAddTab,
}: LandingPageAddComponentsPanelProps) {
  const [rootMode, setRootMode] = useState<RootMode>(initialRootMode);
  const [subView, setSubView] = useState<SubView>('root');
  const [textTab, setTextTab] = useState<TextPresetTab>('title');
  const [buttonTab, setButtonTab] = useState<ButtonPresetTab>('buttons');
  const dragIndex = useRef<number | null>(null);

  // AI / external "Section mẫu" → mở thư viện Phần (gọn hơn tab cũ).
  useEffect(() => {
    if (initialAddTab === 'presets' && onOpenSectionLibrary) {
      onOpenSectionLibrary();
    }
  }, [initialAddTab, onOpenSectionLibrary]);

  function runQuick(card: QuickCard) {
    switch (card.kind) {
      case 'layers':
        setRootMode('layers');
        setSubView('root');
        return;
      case 'section-library':
        onOpenSectionLibrary?.();
        return;
      case 'button':
        if (onOpenButtonLibrary) {
          onOpenButtonLibrary();
          return;
        }
        if (!onInsertButtonPreset) {
          onAddBlock('CTA');
          return;
        }
        setButtonTab('buttons');
        setSubView('button');
        return;
      case 'media':
        onOpenMediaLibrary?.();
        return;
      case 'text-title':
        if (!onInsertTitlePreset) {
          onAddBlock('Hero');
          return;
        }
        setTextTab('title');
        setSubView('text');
        return;
      case 'text-paragraph':
        if (!onInsertParagraphPreset) {
          onAddBlock('Benefits');
          return;
        }
        setTextTab('paragraph');
        setSubView('text');
        return;
      case 'text-list':
        if (!onInsertListPreset) {
          onAddBlock('Benefits');
          return;
        }
        setTextTab('list');
        setSubView('text');
        return;
      case 'graphics':
        if (!onInsertBoxPreset) {
          onAddBlock('Product');
          return;
        }
        setSubView('graphics');
        return;
      case 'icon':
        if (!onInsertBoxPreset) {
          onAddBlock('Features');
          return;
        }
        setSubView('icon');
        return;
      case 'forms':
        if (!onInsertFormPreset) {
          onAddBlock('LeadForm');
          return;
        }
        setSubView('forms');
        return;
      case 'block':
        if (card.blockType) onAddBlock(card.blockType);
        return;
      default:
        return;
    }
  }

  if (subView === 'text' && onInsertTitlePreset) {
    return (
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white text-zinc-900"
        data-lp-add-components-sub="text"
      >
        <LandingPageTextPresetsPanel
          className={EMBEDDED_PRESET_CLASS}
          initialTab={textTab}
          onTabChange={setTextTab}
          onClose={() => setSubView('root')}
          onInsertTitle={(preset) => onInsertTitlePreset(preset)}
          onInsertParagraph={(preset) => onInsertParagraphPreset?.(preset)}
          onInsertList={(preset) => onInsertListPreset?.(preset)}
        />
      </div>
    );
  }

  if (subView === 'button' && onInsertButtonPreset) {
    return (
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white text-zinc-900"
        data-lp-add-components-sub="button"
      >
        <LandingPageButtonPresetsPanel
          className={EMBEDDED_PRESET_CLASS}
          initialTab={buttonTab}
          onTabChange={setButtonTab}
          onClose={() => setSubView('root')}
          onInsertButton={(preset) => onInsertButtonPreset(preset)}
          onInsertGroup={(preset) => onInsertButtonGroupPreset?.(preset)}
        />
      </div>
    );
  }

  if (subView === 'graphics' && onInsertBoxPreset) {
    return (
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white text-zinc-900"
        data-lp-add-components-sub="graphics"
      >
        <LandingPageGraphicsLibraryPanel
          className={EMBEDDED_PRESET_CLASS}
          onClose={() => setSubView('root')}
          onInsertBox={(preset) => onInsertBoxPreset(preset)}
          onInsertForm={(preset) => onInsertFormPreset?.(preset)}
          onInsertBlockType={(type) => onAddBlock(type)}
          onOpenMediaLibrary={onOpenMediaLibrary}
        />
      </div>
    );
  }

  if (subView === 'icon' && onInsertBoxPreset) {
    return (
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white text-zinc-900"
        data-lp-add-components-sub="icon"
      >
        <LandingPageGraphicsLibraryPanel
          className={EMBEDDED_PRESET_CLASS}
          initialCategory="graphics"
          iconsOnly
          panelTitle="Biểu tượng"
          onClose={() => setSubView('root')}
          onInsertBox={(preset) => onInsertBoxPreset(preset)}
          onInsertForm={(preset) => onInsertFormPreset?.(preset)}
          onInsertBlockType={(type) => onAddBlock(type)}
          onOpenMediaLibrary={onOpenMediaLibrary}
        />
      </div>
    );
  }

  if (subView === 'forms' && onInsertFormPreset) {
    return (
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0A3D30] text-white"
        data-lp-add-components-sub="forms"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-2.5 py-2">
          <button
            type="button"
            className="rounded-md border border-white/15 px-2 py-1 text-[11px] hover:bg-white/10"
            onClick={() => setSubView('root')}
          >
            ← Quay lại
          </button>
          <div className="min-w-0 flex-1 truncate text-sm font-semibold">Mẫu biểu mẫu</div>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-2.5 py-3">
          {LP_FORM_GROUPS.map((group) => {
            const rows = LP_FORM_PRESETS.filter((p) => p.group === group.id);
            if (!rows.length) return null;
            return (
              <section key={group.id}>
                <h3 className="mb-1.5 px-0.5 text-[10px] font-bold uppercase tracking-wider text-white/50">
                  {group.label}
                </h3>
                <div className="flex flex-col gap-1.5">
                  {rows.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      data-lp-form-preset={preset.id}
                      className="rounded-md bg-white/5 px-2.5 py-2 text-left ring-1 ring-white/10 transition hover:bg-white/10"
                      onClick={() => onInsertFormPreset(preset)}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-8 w-8 shrink-0 rounded-md ring-1 ring-white/15"
                          style={{
                            background: `linear-gradient(135deg, ${preset.preview.bg}, ${preset.preview.accent})`,
                          }}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12px] font-semibold text-white">
                            {preset.label}
                          </div>
                          <div className="truncate text-[10px] text-white/50">
                            {preset.fields.length} trường · {preset.submitLabel}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0A3D30] text-white"
      data-lp-add-components-panel="1"
      data-lp-add-root-mode={rootMode}
    >
      {aiMenu ? (
        <div
          className="shrink-0 border-b border-white/10 px-2 py-1.5 [&_button]:text-white"
          data-lp-add-components-ai
        >
          {aiMenu}
        </div>
      ) : null}

      <div className="shrink-0 border-b border-white/10 px-2 py-1.5" data-lp-add-root-tabs>
        <div className="flex gap-1 rounded-lg bg-black/20 p-0.5">
          <button
            type="button"
            data-lp-add-root-tab="add"
            className={cn(
              'flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold',
              rootMode === 'add' ? 'bg-white text-zinc-900 shadow-sm' : 'text-white/60 hover:text-white',
            )}
            onClick={() => {
              setRootMode('add');
              setSubView('root');
            }}
          >
            Thêm
          </button>
          <button
            type="button"
            data-lp-add-root-tab="layers"
            className={cn(
              'flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold',
              rootMode === 'layers'
                ? 'bg-white text-zinc-900 shadow-sm'
                : 'text-white/60 hover:text-white',
            )}
            onClick={() => {
              setRootMode('layers');
              setSubView('root');
            }}
          >
            Danh sách ({blocks?.length ?? 0})
          </button>
        </div>
      </div>

      {rootMode === 'layers' ? (
        <div
          className="min-h-0 flex-1 overflow-y-auto px-2.5 py-2"
          data-lp-add-components-layers
        >
          {!blocks?.length ? (
            <p className="px-1 py-3 text-[11px] text-white/45">
              Chưa có section — dùng tab Thêm để chèn phần tử.
            </p>
          ) : (
            <ul className="space-y-1" data-lp-block-list>
              {blocks.map((b, index) => (
                <li
                  key={b.id}
                  draggable={Boolean(onReorderBlocks)}
                  onDragStart={() => {
                    dragIndex.current = index;
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragIndex.current == null || dragIndex.current === index) return;
                    onReorderBlocks?.(dragIndex.current, index);
                    dragIndex.current = null;
                  }}
                  className={cn(
                    'flex cursor-grab items-center gap-1 rounded-md px-2 py-1.5 text-[12px]',
                    selectedBlockId === b.id
                      ? 'bg-orange-400/20 ring-1 ring-orange-400/50'
                      : 'bg-white/5 hover:bg-white/10',
                  )}
                  onClick={() => onSelectBlock?.(b.id)}
                >
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {b.type}
                    {!b.enabled ? ' (ẩn)' : ''}
                    {b.locked ? ' 🔒' : ''}
                  </span>
                  {onDupBlock ? (
                    <button
                      type="button"
                      className="rounded px-1.5 py-0.5 text-[10px] text-white/55 hover:bg-white/10 hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDupBlock(b.id);
                      }}
                    >
                      Nhân bản
                    </button>
                  ) : null}
                  {onRemoveBlock ? (
                    <button
                      type="button"
                      className="rounded px-1.5 py-0.5 text-[10px] text-red-300/80 hover:bg-red-500/20 hover:text-red-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveBlock(b.id);
                      }}
                    >
                      Xóa
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2.5 py-3"
          data-lp-add-components-scroll
        >
          <CardGroup title="Cơ bản">
            {filterLiveCards(BASIC_CARDS).map((card) => {
              const libraryDrag =
                card.kind === 'section-library'
                  ? ('section-library' as const)
                  : card.kind === 'button' && onOpenButtonLibrary
                    ? ('button-library' as const)
                    : null;
              return (
                <ComponentCard
                  key={card.id}
                  card={card}
                  onClick={() => runQuick(card)}
                  draggable={Boolean(libraryDrag)}
                  onDragStart={
                    libraryDrag === 'section-library'
                      ? (e) =>
                          beginSidebarPresetDrag(
                            e,
                            { kind: 'section-library-open' },
                            'Thư viện Section',
                            { subtitle: 'Thả vào canvas để chọn mẫu' },
                          )
                      : libraryDrag === 'button-library'
                        ? (e) =>
                            beginSidebarPresetDrag(
                              e,
                              { kind: 'button-library-open' },
                              'Thư viện Nút',
                              { subtitle: 'Thả vào canvas để chọn mẫu' },
                            )
                        : undefined
                  }
                />
              );
            })}
          </CardGroup>

          <CardGroup title="Nâng cao">
            {filterLiveCards(ADVANCED_CARDS).map((card) => (
              <ComponentCard key={card.id} card={card} onClick={() => runQuick(card)} />
            ))}
          </CardGroup>

          <CardGroup title="Thương mại điện tử">
            {filterLiveCards(ECOMMERCE_CARDS).map((card) => (
              <ComponentCard key={card.id} card={card} onClick={() => runQuick(card)} />
            ))}
          </CardGroup>
        </div>
      )}
    </div>
  );
}

function CardGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section data-lp-add-components-group={title}>
      <h3 className="mb-2 px-0.5 text-[10px] font-bold uppercase tracking-wider text-white/50">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-1.5">{children}</div>
    </section>
  );
}

function ComponentCard({
  card,
  onClick,
  draggable,
  onDragStart,
}: {
  card: QuickCard;
  onClick: () => void;
  draggable?: boolean;
  onDragStart?: (e: DragEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      data-lp-add-component-card={card.id}
      data-lp-sidebar-draggable={
        draggable
          ? card.kind === 'button'
            ? 'button-library'
            : 'section-library'
          : undefined
      }
      draggable={draggable}
      onDragStart={onDragStart}
      className={cn(
        'flex flex-col items-center gap-1.5 rounded-lg bg-white/5 px-2 py-3 text-center ring-1 ring-white/10 transition hover:bg-white/12 hover:ring-white/20',
        draggable && 'cursor-grab active:cursor-grabbing',
      )}
      onClick={(e) => {
        if (suppressClickAfterSidebarDrag(e)) return;
        onClick();
      }}
      title={
        draggable
          ? card.kind === 'button'
            ? `${card.label} — kéo thả hoặc click để mở thư viện nút`
            : `${card.label} — kéo thả hoặc click để mở thư viện`
          : card.label
      }
    >
      <span
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-black/25 text-base text-white/90"
        aria-hidden
      >
        {card.icon}
      </span>
      <span className="w-full truncate text-[11px] font-medium text-white/90">{card.label}</span>
    </button>
  );
}
