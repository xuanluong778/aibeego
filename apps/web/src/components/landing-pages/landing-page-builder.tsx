'use client';

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  LANDING_PAGE_THEME_PRESETS,
  LANDING_PAGE_THEMES,
  createEmptyLandingPageSpec,
  duplicateBlock,
  markLandingPageFieldSources,
  markLandingPageUserEdits,
  reorderBlocks,
  resolveFreeLayoutForViewport,
  ensureSectionFreeLayoutHeight,
  reflowFreeSectionsAfterChange,
  expandBlocksToFitElementLayouts,
  packFreeSectionsVertical,
  isFloatingTextLayerBlock,
  SECTION_CONTENT_FIT_PADDING,
  sanitizeLandingPageDraftSpec,
  sanitizeLandingPagePersistSpec,
  specWithEditableHtmlSections,
  duplicateLandingPageNestedItem,
  type LandingPageBlock,
  type LandingPageBlockType,
  type LandingPageFreeLayout,
  type LandingPageSpec,
  type LandingPageTheme,
} from '@marketingspa/shared';
import { apiClient, ApiError } from '@/lib/api-client';
import {
  LP_AI_RETRY_MAX_ATTEMPTS,
  lpAiRetryDelayMs,
  shouldRetryLpAiHttpStatus,
} from '@marketingspa/shared';
import { LandingPageRenderer } from './landing-page-renderer';
import { replaceHtmlBody } from './landing-page-html-isolate';
import { LandingPageDeviceFrame } from './landing-page-device-frame';
import {
  LandingPageCanvasZoomLayer,
  handleCanvasZoomWheel,
  syncCanvasZoomToInspectorDock,
} from './landing-page-canvas-zoom';
import { LandingPageInlineAiField } from './landing-page-inline-ai-field';
import { LeadFormCrmInspector } from './lead-form-crm-inspector';
import {
  inspectorTextFieldKey,
  CustomCssPanel,
  LandingPageInspectorDesignTab,
} from './landing-page-inspector-design-tab';
import { resolveInspectorContext } from './landing-page-inspector-context';
import { LandingPageInspectorElementActions } from './landing-page-inspector-element-actions';
import { LandingPageInspectorTextContent } from './landing-page-inspector-text-content';
import { LandingPageItemBoxPanel } from './landing-page-item-box-panel';
import { normalizeItemBoxChrome, readLpItemBoxes, withLpItemBox } from './landing-page-item-box';
import { LandingPageTextQuickPanel } from './landing-page-text-quick-panel';
import { LandingPageHtmlInspector } from './landing-page-html-inspector';
import {
  clearLocalLandingDraft,
  decideDraftRecovery,
  readLocalLandingDraft,
  writeLocalLandingDraft,
  type LocalLandingDraft,
} from './landing-page-draft-recovery';
import { revalidatePublicLandingPage } from './revalidate-public-landing-page';
import { htmlNodeLabel, type HtmlNodeSnapshot, type HtmlPatchFn } from './landing-page-html-nodes';
import { InspectorAccordion, InspectorEmptyHint } from './landing-page-inspector-ui';
import {
  LandingPageInspectorRail,
  inspectorDockReservePx,
  INSPECTOR_PANEL_WIDTH,
  INSPECTOR_ADD_COMPONENTS_PANEL_WIDTH,
  type InspectorRailId,
} from './landing-page-inspector-rail';
import { LandingPageInspectorGlobalDesign } from './landing-page-inspector-global-design';
import { LandingPageAddComponentsPanel } from './landing-page-add-components-panel';
import { LandingPageButtonInspector } from './landing-page-button-inspector';
import { LandingPageIconInspector } from './landing-page-icon-inspector';
import { LandingPageLeadFormFieldsInspector } from './landing-page-lead-form-fields-inspector';
import { LandingPageInspectorResponsiveVisibility } from './landing-page-inspector-responsive';
import { LandingPageElementVerticalToolbar } from './landing-page-element-vertical-toolbar';
import { LandingPageSectionLibraryModal } from './landing-page-section-library-modal';
import { LandingPageButtonLibraryModal } from './landing-page-button-library-modal';
import {
  getSectionLibraryTemplate,
  materializeSectionLibraryTemplate,
} from './landing-page-section-library-catalog';
import {
  buttonLibraryTemplateToPreset,
  getButtonLibraryTemplate,
} from './landing-page-button-library-catalog';
import {
  LandingPageCanvasContextMenu,
  LpCanvasAiQuickPopover,
  resolveFieldForContext,
  type LpCanvasAiPopoverState,
  type LpCanvasClipboardStyle,
} from './landing-page-canvas-context-menu';
import { LandingPageImageField } from './landing-page-image-field';
import { LandingPageAiMenu } from './landing-page-ai-menu';
import { LandingPageBuilderToolbar } from './landing-page-builder-toolbar';
import { useRouter } from 'next/navigation';
import {
  LandingPageMediaModal,
  type LpMediaItem,
} from './landing-page-media-modal';
import {
  ensureLandingPageTitleFonts,
  type LandingPageListPreset,
  type LandingPageParagraphPreset,
  type LandingPageTitlePreset,
} from './landing-page-title-presets';
import {
  navIconForVariant,
  type LandingPageButtonGroupPreset,
  type LandingPageButtonPreset,
} from './landing-page-button-presets';
import type { LandingPageBoxPreset } from './landing-page-box-presets';
import { isLandingPageBoxStyle } from './landing-page-box-presets';
import type { LandingPageFormPreset } from './landing-page-form-presets';
import type { SectionBackgroundToolbarAction } from './landing-page-section-background-toolbar';
import { LandingPageSectionSettingsPanel } from './landing-page-section-settings-panel';
import { applySectionSettingsChange } from './landing-page-section-settings';
import {
  encodeSectionBgFlip,
  parseSectionBgFlip,
  sectionHasAnyBackground,
  sectionHasBackgroundImage,
} from './landing-page-section-surface';
import {
  LandingPageDraftPreviewPanel,
  LandingPageVersionHistoryPanel,
} from './landing-page-version-history';
import { readElementCustomClass, readElementCustomCssStyle } from './landing-page-block-design-style';
import type {
  LpSidebarInsertPos,
  LpSidebarPresetPayload,
} from './landing-page-sidebar-dnd';
import {
  elementKeyForField,
  parseElementKey,
  type LandingPageCanvasElementKey,
  type LandingPageCanvasHandlers,
  type LandingPageCanvasSelection,
  type LandingPageInlineTextStyle,
} from './landing-page-canvas-ux';
import {
  applyMarqueeSelection,
  applySelectionClick,
  isSectionLevelElement,
  isTextToolbarTarget,
  lpSelectionKey,
  lpSelectionKeyMatches,
  normalizeLpSelectionTarget,
  parseLpSelectionKey,
  type LpSelectOptions,
  type LpSelectionTarget,
} from './landing-page-canvas-selection';
import {
  clampAbsoluteFreeLayout,
  measureSectionContentHeightCss,
  measureVisibleContentRect,
  patchAbsoluteFreeLayoutField,
  readCanvasPointerScale,
  readRect,
  clientPointToCanvasLocal,
} from './landing-page-free-drag';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type InspectorTab = 'content' | 'design' | 'advanced' | 'add';

/** Text / heading / image selection → open Inspector on Design first. */
function preferInspectorDesignTab(target: LpSelectionTarget): boolean {
  if (isTextToolbarTarget(target)) return true;
  const el = target.element;
  if (el === 'image') return true;
  if (typeof el === 'string' && el.startsWith('grid:')) return true;
  return false;
}

type Viewport = 'desktop' | 'tablet' | 'mobile';

/** ~5px scrollbar — canvas + inspector (landingpage.vn style). */
const LP_THIN_SCROLL =
  '[scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.35)_transparent] ' +
  '[&::-webkit-scrollbar]:w-[5px] [&::-webkit-scrollbar]:h-[5px] ' +
  '[&::-webkit-scrollbar-track]:bg-transparent ' +
  '[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/35 ' +
  'hover:[&::-webkit-scrollbar-thumb]:bg-white/50';

type PagePayload = {
  id: string;
  name: string;
  slug: string;
  status: string;
  draftSpec: LandingPageSpec;
  publicPath?: string;
  trackingConfig?: {
    ga4MeasurementId?: string | null;
    googleAdsId?: string | null;
    metaPixelId?: string | null;
    metaCapiReady?: boolean;
    tiktokPixelReady?: boolean;
  } | null;
};

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** True when keyboard events must go to typing UI — never steal Space / shortcuts. */
function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const el = target;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    if (tag === 'INPUT') {
      const type = (el as HTMLInputElement).type?.toLowerCase();
      if (type === 'button' || type === 'submit' || type === 'checkbox' || type === 'radio' || type === 'file') {
        return false;
      }
    }
    return true;
  }
  if (el.isContentEditable) return true;
  return Boolean(el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
}

function cloneSpec(spec: LandingPageSpec): LandingPageSpec {
  return JSON.parse(JSON.stringify(spec)) as LandingPageSpec;
}

/** Title / paragraph-only Benefits used as free text layers on the canvas. */
function isLpTextLayerBlock(block: LandingPageBlock): boolean {
  return isFloatingTextLayerBlock(block);
}

/**
 * Place a text-layer section at the drop pointer (canvas-local absolute free).
 * Cascade when no pointer so sequential inserts never share the same x/y.
 * Coordinates are canvas-root local (same space as freeLayoutStyle left/top).
 */
function resolveTextLayerFreeLayout(
  blocks: LandingPageBlock[],
  pos?: LpSidebarInsertPos,
): LandingPageFreeLayout {
  const freeText = blocks.filter(
    (b) => isLpTextLayerBlock(b) && b.positionMode === 'free' && b.freeLayout,
  );
  if (
    pos &&
    typeof (pos as { clientX?: number }).clientX === 'number' &&
    typeof (pos as { clientY?: number }).clientY === 'number' &&
    Number.isFinite((pos as { clientX: number }).clientX) &&
    Number.isFinite((pos as { clientY: number }).clientY)
  ) {
    const local = clientPointToCanvasLocal(
      (pos as { clientX: number }).clientX,
      (pos as { clientY: number }).clientY,
    );
    return {
      x: Math.max(0, local.x - 8),
      y: Math.max(0, local.y - 16),
      width: 420,
      height: 72,
    };
  }
  // Click-insert cascade — unique canvas-local defaults (never shared x/y).
  const existing = freeText.length;
  return {
    x: 48 + (existing % 6) * 36,
    y: 96 + existing * 80,
    width: 420,
    height: 72,
  };
}

/**
 * Fold stale text-layer elementFreeLayouts into section.freeLayout and clear
 * the element keys so save/reload never re-applies a second translate.
 */
function healTextLayerCoordinates(spec: LandingPageSpec): LandingPageSpec {
  const prevEfl =
    (spec.meta && typeof spec.meta === 'object'
      ? (spec.meta as { elementFreeLayouts?: Record<string, LandingPageFreeLayout> }).elementFreeLayouts
      : null) || {};
  const nextEfl: Record<string, LandingPageFreeLayout> = { ...prevEfl };
  let changed = false;
  const blocks = spec.blocks.map((b) => {
    if (!isLpTextLayerBlock(b)) return b;
    const hKey = `${b.id}::headline`;
    const sKey = `${b.id}::subheadline`;
    const el = nextEfl[hKey] || nextEfl[sKey];
    if (el) {
      delete nextEfl[hKey];
      delete nextEfl[sKey];
      changed = true;
      const base = b.freeLayout || { x: 0, y: 0 };
      const freeLayout = clampAbsoluteFreeLayout({
        x: Math.round((base.x || 0) + (el.x || 0)),
        y: Math.max(0, Math.round((base.y || 0) + (el.y || 0))),
        width: el.width || base.width || 420,
        height: base.height || 72,
        ...(base.rotate != null ? { rotate: base.rotate } : {}),
        ...(el.rotate != null ? { rotate: el.rotate } : {}),
      });
      return {
        ...b,
        positionMode: 'free' as const,
        freeLayout,
        spacing: 'none' as const,
      };
    }
    if (b.positionMode === 'free' && b.freeLayout) return b;
    // Promote flow text layers that only had natural stacking — keep flow unless
    // they already look free. No-op for clean flow titles.
    return b;
  });
  if (!changed) return spec;
  return {
    ...spec,
    blocks,
    meta: {
      ...(spec.meta || {}),
      elementFreeLayouts: Object.keys(nextEfl).length ? nextEfl : undefined,
    },
  };
}

/** Stored autosave concurrency stamp — must seed on load or client sends 0 and hangs on STALE. */
function readClientRevision(s: LandingPageSpec | null | undefined): number {
  const rev = s?.meta?.clientRevision;
  return typeof rev === 'number' && Number.isFinite(rev) ? Math.max(0, Math.floor(rev)) : 0;
}

function defaultBlock(type: LandingPageBlockType): LandingPageBlock {
  const base = { id: uid(type.toLowerCase()), type, enabled: true, spacing: 'md' as const };
  switch (type) {
    case 'Hero':
    case 'CTA':
    case 'Guarantee':
    case 'Footer':
    case 'Header':
      return {
        ...base,
        type,
        headline: type === 'Header' ? 'Brand' : type === 'Guarantee' ? 'Cam kết của chúng tôi' : `${type} headline`,
        subheadline: '',
        body:
          type === 'Header'
            ? 'Trang chủ|Liên hệ'
            : type === 'Guarantee'
              ? 'Đảm bảo chất lượng dịch vụ. Liên hệ nếu bạn chưa hài lòng — chúng tôi hỗ trợ đổi/hoàn theo chính sách.'
              : undefined,
        ctaLabel: 'Tìm hiểu thêm',
        ctaUrl: '#lead-form',
      };
    case 'Benefits':
    case 'Features':
    case 'Process':
    case 'Gallery':
    case 'Product':
      return {
        ...base,
        type,
        headline: type,
        items: [{ id: uid('item'), title: 'Mục 1', description: 'Mô tả ngắn' }],
      };
    case 'Speaker':
      return {
        ...base,
        type: 'Speaker',
        headline: 'Diễn giả',
        items: [
          {
            id: uid('item'),
            title: 'Tên diễn giả',
            role: 'Chức danh',
            description: 'Bio ngắn',
          },
        ],
      };
    case 'Pricing':
      return {
        ...base,
        type: 'Pricing',
        headline: 'Bảng giá',
        plans: [
          {
            id: uid('plan'),
            name: 'Basic',
            price: '999.000đ',
            period: 'tháng',
            features: ['Tính năng 1'],
            ctaLabel: 'Chọn gói',
          },
        ],
      };
    case 'Testimonials':
      return {
        ...base,
        type: 'Testimonials',
        headline: 'Khách hàng nói gì',
        items: [{ id: uid('t'), quote: 'Rất hài lòng', author: 'Khách A', role: 'CEO' }],
      };
    case 'FAQ':
      return {
        ...base,
        type: 'FAQ',
        headline: 'FAQ',
        items: [{ id: uid('f'), question: 'Câu hỏi?', answer: 'Trả lời.' }],
      };
    case 'Video':
      return { ...base, type: 'Video', headline: 'Video', videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ' };
    case 'LeadForm':
      return {
        ...base,
        type: 'LeadForm',
        headline: 'Đăng ký nhận tư vấn',
        submitLabel: 'Gửi',
        fields: [
          { id: uid('fld'), name: 'name', label: 'Họ tên', fieldType: 'text', required: true },
          { id: uid('fld'), name: 'phone', label: 'Số điện thoại', fieldType: 'tel', required: true },
          { id: uid('fld'), name: 'email', label: 'Email', fieldType: 'email', required: false },
        ],
      };
    case 'Countdown':
      return {
        ...base,
        type: 'Countdown',
        headline: 'Ưu đãi kết thúc sau',
        subheadline: 'Đặt lịch trước khi hết giờ',
        endsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        timezone: 'Asia/Ho_Chi_Minh',
        showDays: true,
        showHours: true,
        showMinutes: true,
        showSeconds: true,
        expireBehavior: 'message',
        expireMessage: 'Đã hết thời gian ưu đãi',
        expireCtaLabel: 'Liên hệ ngay',
        expireCtaUrl: '#lead-form',
        styleVariant: 'boxes',
      };
    default:
      return { ...base, type: 'Hero', headline: 'Hero' };
  }
}

export function LandingPageBuilder({ pageId }: { pageId: string }) {
  const [page, setPage] = useState<PagePayload | null>(null);
  const [spec, setSpec] = useState<LandingPageSpec>(createEmptyLandingPageSpec());
  const [canvasSelection, setCanvasSelection] = useState<{
    ids: string[];
    primaryId: string | null;
  }>({ ids: [], primaryId: null });
  const selectedElementIds = canvasSelection.ids;
  const primarySelectedId = canvasSelection.primaryId;
  const primaryTarget = useMemo(() => {
    if (!primarySelectedId) return null;
    const parsed = parseLpSelectionKey(primarySelectedId);
    return parsed ? normalizeLpSelectionTarget(parsed) : null;
  }, [primarySelectedId]);
  const textInspectorAutoKeyRef = useRef<string | null>(null);
  const openInspectorOnSelectRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!primarySelectedId) {
      textInspectorAutoKeyRef.current = null;
      return;
    }
    const parsed = parseLpSelectionKey(primarySelectedId);
    if (!parsed) return;
    const target = normalizeLpSelectionTarget(parsed);
    if (!preferInspectorDesignTab(target)) return;
    if (textInspectorAutoKeyRef.current === primarySelectedId) return;
    textInspectorAutoKeyRef.current = primarySelectedId;
    setInspectorTab('design');
  }, [primarySelectedId]);
  const selectedId = primaryTarget?.blockId ?? null;
  /** Alias — selection by stable block id (not index). */
  const selectedBlockId = selectedId;
  const selectedElement = (primaryTarget?.element ?? 'section') as LandingPageCanvasElementKey;

  function selectCanvas(next: LandingPageCanvasSelection, opts?: LpSelectOptions) {
    const element = (parseElementKey(next.element) || next.element || 'section') as LandingPageCanvasElementKey;
    const target = normalizeLpSelectionTarget({
      blockId: next.blockId,
      element,
      field: next.field,
    });
    setCanvasSelection((prev) => applySelectionClick(prev.ids, prev.primaryId, target, opts));
    openInspectorOnSelectRef.current?.();
    const textField = inspectorTextFieldKey(target.element, target.field);
    const textBlock = specRef.current.blocks.find((block) => block.id === target.blockId);
    if (
      textBlock &&
      textField &&
      resolveInspectorContext(textBlock, target.element, textField).kind === 'text'
    ) {
      setInspectorPanelOpen(true);
      setInspectorRailSurface('element');
      setInspectorTab('content');
    }
    if (
      typeof target.element === 'string' &&
      target.element.startsWith('item:') &&
      !target.field &&
      !target.element.startsWith('item:trust-icon-')
    ) {
      setInspectorPanelOpen(true);
      setInspectorRailSurface('element');
      setInspectorTab('design');
    }
    if (element === 'section' || element === 'section-background') {
      setInspectorPanelOpen(true);
      setInspectorRailSurface('element');
      setInspectorTab('content');
    }
  }

  function setSelectedBlockId(id: string | null) {
    if (!id) deselectCanvas();
    else selectCanvas({ blockId: id, element: 'section' });
  }
  const inspectorPanelRef = useRef<HTMLElement | null>(null);
  const inlineHistStarted = useRef(false);
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [saving, setSaving] = useState(false);
  const [historyNav, setHistoryNav] = useState({ undo: false, redo: false });
  const [saveMsg, setSaveMsg] = useState('');
  /** Another writer (tab/session) saved a newer revision — autosave paused until user resolves. */
  const [saveConflict, setSaveConflict] = useState(false);
  const [pendingLocalDraft, setPendingLocalDraft] = useState<LocalLandingDraft | null>(null);
  const [resolvingConflict, setResolvingConflict] = useState(false);
  const [textAiPopover, setTextAiPopover] = useState<LpCanvasAiPopoverState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [doctorOpen, setDoctorOpen] = useState(false);
  const [doctorBusy, setDoctorBusy] = useState(false);
  const [doctorReport, setDoctorReport] = useState<{
    overallScore: number;
    findings: Array<{
      dim: string;
      status: string;
      score: number;
      message: string;
      suggestion?: string;
    }>;
    patches: Array<{
      id: string;
      label: string;
      path: string;
      before?: string;
      after: string;
    }>;
    warnings?: string[];
  } | null>(null);
  const [selectedPatches, setSelectedPatches] = useState<Record<string, boolean>>({});
  const [doctorError, setDoctorError] = useState<string | null>(null);
  const [doctorUndoVersion, setDoctorUndoVersion] = useState<number | null>(null);
  const [actionBarMounted, setActionBarMounted] = useState(false);
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const router = useRouter();
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('content');
  /** GetResponse-style rail: panel open/close is independent of canvas selection. */
  const [inspectorPanelOpen, setInspectorPanelOpen] = useState(false);
  const [htmlNode, setHtmlNode] = useState<HtmlNodeSnapshot | null>(null);
  const htmlPatchRef = useRef<HtmlPatchFn | null>(null);
  const [inspectorRailSurface, setInspectorRailSurface] = useState<
    'element' | 'page-theme' | 'add-components'
  >('element');
  const inspectorSuppressOpenRef = useRef(true);
  /** Desktop inspector layout: docked (right column) | floating (detach + drag). */
  const [inspectorMode, setInspectorMode] = useState<'docked' | 'floating'>('docked');
  const [floatingPosition, setFloatingPosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [inspectorDesktop, setInspectorDesktop] = useState(false);
  const useInspectorRail = inspectorDesktop && inspectorMode === 'docked';
  useEffect(() => {
    if (!useInspectorRail) return;
    if (inspectorSuppressOpenRef.current) {
      inspectorSuppressOpenRef.current = false;
      return;
    }
    if (!primarySelectedId) {
      setInspectorPanelOpen(false);
      return;
    }
    setInspectorPanelOpen(true);
    setInspectorRailSurface('element');
  }, [primarySelectedId, useInspectorRail]);
  useEffect(() => {
    if (!useInspectorRail) return;
    // After dock width CSS var commits, refit preview via transform only (no spec).
    const id = requestAnimationFrame(() => syncCanvasZoomToInspectorDock());
    return () => cancelAnimationFrame(id);
  }, [inspectorPanelOpen, useInspectorRail, inspectorRailSurface]);
  const [dockedInspectorHost, setDockedInspectorHost] = useState<HTMLDivElement | null>(null);
  /** Desktop: collapse left tool rail so canvas takes full width. */
  const inspectorDragRef = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const inspectorDragHandleRef = useRef<HTMLDivElement | null>(null);
  const floatingPosRef = useRef(floatingPosition);
  const detachInspectorDragRef = useRef<(() => void) | null>(null);
  const [sidebarOpenRequest, setSidebarOpenRequest] = useState<{
    panel: 'add';
    tab: 'elements' | 'presets' | 'layers';
    nonce: number;
  } | null>(null);
  const [addPanelNonce, setAddPanelNonce] = useState(0);
  const [addPanelInitial, setAddPanelInitial] = useState<{
    rootMode?: 'add' | 'layers';
    addTab?: 'elements' | 'presets';
  }>({});
  const [mediaOpen, setMediaOpen] = useState(false);
  const textBoxMediaRef = useRef<((url: string) => void) | null>(null);
  const sectionMediaRef = useRef<((url: string) => void) | null>(null);
  const [sectionLibraryOpen, setSectionLibraryOpen] = useState(false);

  const openRightAddComponents = useCallback(
    (opts?: { rootMode?: 'add' | 'layers'; addTab?: 'elements' | 'presets' }) => {
      setAddPanelInitial({
        rootMode: opts?.rootMode || 'add',
        addTab: opts?.addTab || 'elements',
      });
      setAddPanelNonce((n) => n + 1);
      if (inspectorDesktop && inspectorMode === 'docked') {
        setInspectorRailSurface('add-components');
        setInspectorPanelOpen(true);
      } else {
        setInspectorTab('add');
      }
    },
    [inspectorDesktop, inspectorMode],
  );

  useEffect(() => {
    if (!sidebarOpenRequest) return;
    openRightAddComponents({
      rootMode: sidebarOpenRequest.tab === 'layers' ? 'layers' : 'add',
      addTab: sidebarOpenRequest.tab === 'presets' ? 'presets' : 'elements',
    });
  }, [sidebarOpenRequest, openRightAddComponents]);
  const sectionLibraryPosRef = useRef<LpSidebarInsertPos | null>(null);
  const [buttonLibraryOpen, setButtonLibraryOpen] = useState(false);
  const buttonLibraryPosRef = useRef<LpSidebarInsertPos | null>(null);
  /** In-memory clipboards for canvas context menu (reuse dup/update — no new persist model). */
  const blockClipboardRef = useRef<LandingPageBlock | null>(null);
  const styleClipboardRef = useRef<LpCanvasClipboardStyle | null>(null);
  const [clipboardTick, setClipboardTick] = useState(0);
  const doctorIdemRef = useRef<string | null>(null);
  const historyRef = useRef<LandingPageSpec[]>([]);
  const futureRef = useRef<LandingPageSpec[]>([]);
  const dirtyRef = useRef(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Bumps on every local edit — autosave must not clear dirty if user typed during flight. */
  const revisionRef = useRef(0);
  /** Last revision the server acknowledged for this tab. Autosave sends it as baseRevision. */
  const ackedRevisionRef = useRef(0);
  /** Serial autosave: only one in-flight; stale responses ignored. */
  const autosaveInflightRef = useRef(false);
  const autosaveQueuedRef = useRef(false);
  const autosaveRequestIdRef = useRef(0);
  /** Resolvers waiting for in-flight autosave to finish (publish / manual flush). */
  const persistWaitersRef = useRef<Array<() => void>>([]);
  /** Set when server rejects our revision as stale — someone else saved a newer version.
   * Autosave stays paused (never force-overwrites) until resolveSaveConflict() runs. */
  const saveConflictRef = useRef(false);
  const specRef = useRef(spec);
  specRef.current = spec;
  const canvasSelectionRef = useRef(canvasSelection);
  canvasSelectionRef.current = canvasSelection;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  const selected = useMemo(
    () => spec.blocks.find((b) => b.id === selectedId) ?? null,
    [spec.blocks, selectedId],
  );

  const inspectorActiveRail: InspectorRailId =
    inspectorRailSurface === 'page-theme'
      ? 'page-theme'
      : inspectorRailSurface === 'add-components'
        ? 'add-components'
        : inspectorTab;

  const htmlInspectorActive = Boolean(spec.meta?.htmlSource && htmlNode);
  const sectionChromeTarget = selectedElement === 'section' || selectedElement === 'section-background';
  const quickTextField = inspectorTextFieldKey(selectedElement, primaryTarget?.field);
  const cardChromeTarget =
    selected &&
    !htmlInspectorActive &&
    !primaryTarget?.field &&
    resolveInspectorContext(selected, selectedElement, primaryTarget?.field).kind === 'card';
  const inspectorPanelWidthPx =
    useInspectorRail &&
    inspectorPanelOpen &&
    inspectorRailSurface === 'add-components'
      ? INSPECTOR_ADD_COMPONENTS_PANEL_WIDTH
      : (quickTextField &&
          selected &&
          !htmlInspectorActive &&
          resolveInspectorContext(selected, selectedElement, quickTextField).kind === 'text') ||
          cardChromeTarget
        ? 320
        : sectionChromeTarget && selected && !htmlInspectorActive
          ? 320
        : INSPECTOR_PANEL_WIDTH;

  const inspectorPanelTitle = useMemo(() => {
    if (inspectorRailSurface === 'page-theme') return 'Thiết kế tổng thể';
    if (inspectorRailSurface === 'add-components') return 'THÊM THÀNH PHẦN';
    if (htmlNode && spec.meta?.htmlSource) return htmlNodeLabel(htmlNode.kind);
    const ctx = resolveInspectorContext(selected, selectedElement, primaryTarget?.field);
    if (ctx.kind === 'button') return 'NÚT';
    return ctx.label;
  }, [inspectorRailSurface, selected, selectedElement, primaryTarget?.field, htmlNode, spec.meta?.htmlSource]);

  const isButtonInspector =
    resolveInspectorContext(selected, selectedElement, primaryTarget?.field).kind === 'button';
  const isIconInspector =
    resolveInspectorContext(selected, selectedElement, primaryTarget?.field).kind === 'icon';

  const handleInspectorRailSelect = useCallback(
    (id: InspectorRailId) => {
      if (id === 'add-components') {
        if (inspectorRailSurface === 'add-components' && inspectorPanelOpen) {
          setInspectorPanelOpen(false);
          return;
        }
        setInspectorRailSurface('add-components');
        setInspectorPanelOpen(true);
        return;
      }
      setInspectorPanelOpen(true);
      if (id === 'page-theme') {
        setInspectorRailSurface('page-theme');
        return;
      }
      setInspectorRailSurface('element');
      setInspectorTab(id);
    },
    [inspectorPanelOpen, inspectorRailSurface],
  );

  openInspectorOnSelectRef.current = () => {
    if (!useInspectorRail) return;
    if (inspectorSuppressOpenRef.current) return;
    setInspectorPanelOpen(true);
    setInspectorRailSurface('element');
  };

  const pushHistory = useCallback((next: LandingPageSpec) => {
    // Always snapshot latest live draft from ref — never stale React closure.
    historyRef.current.push(cloneSpec(specRef.current));
    if (historyRef.current.length > 50) historyRef.current.shift();
    futureRef.current = [];
    revisionRef.current += 1;
    setSpec(next);
    dirtyRef.current = true;
    setHistoryNav({ undo: true, redo: false });
  }, []);

  const applyHtmlSource = useCallback(
    (nextHtml: string) => {
      const current = specRef.current;
      if (!nextHtml || (current.meta?.htmlSource || '') === nextHtml) return;
      pushHistory({
        ...current,
        meta: { ...(current.meta || {}), htmlSource: nextHtml },
      });
    },
    [pushHistory],
  );

  const applyHtmlSection = useCallback(
    (blockId: string, sectionHtml: string) => {
      const current = specRef.current;
      if (current.blocks.find((block) => block.id === blockId)?.locked) {
        setSaveMsg('Section đang khóa — mở khóa trước khi chỉnh sửa');
        return;
      }
      const sections = current.meta?.htmlSections || [];
      const nextSections = sections.map((row) =>
        row.blockId === blockId ? { ...row, html: sectionHtml } : row,
      );
      if (nextSections.every((row, index) => row.html === sections[index]?.html)) return;
      const htmlSource = current.meta?.htmlSource
        ? replaceHtmlBody(
            current.meta.htmlSource,
            nextSections.map((row) => row.html).join('\n'),
          )
        : '';
      pushHistory({
        ...current,
        meta: {
          ...(current.meta || {}),
          htmlSections: nextSections,
          ...(htmlSource ? { htmlSource } : {}),
        },
      });
    },
    [pushHistory],
  );

  const selectHtmlNode = useCallback((node: HtmlNodeSnapshot) => {
    setHtmlNode(node);
    setInspectorPanelOpen(true);
    setInspectorRailSurface('element');
    setInspectorTab((tab) => (tab === 'add' ? 'content' : tab));
  }, []);

  const load = useCallback(async () => {
    setError(null);
    const data = await apiClient<PagePayload>(`/landing-pages/${pageId}`);
    setPage(data);
    // Loaded from DB — persist-normalized (no edge whitespace junk).
    const persisted = healTextLayerCoordinates(sanitizeLandingPagePersistSpec(data.draftSpec));
    const upgraded = specWithEditableHtmlSections(persisted);
    const loaded = upgraded
      ? healTextLayerCoordinates(sanitizeLandingPagePersistSpec(upgraded))
      : persisted;
    setSpec(loaded);
    setHtmlNode(null);
    inspectorSuppressOpenRef.current = true;
    setInspectorPanelOpen(false);
    const firstBlockId = loaded.blocks?.[0]?.id;
    if (firstBlockId) selectCanvas({ blockId: firstBlockId, element: 'section' });
    else setCanvasSelection({ ids: [], primaryId: null });
    historyRef.current = [];
    futureRef.current = [];
    setHistoryNav({ undo: false, redo: false });
    dirtyRef.current = Boolean(upgraded);
    // Seed from stored meta — resetting to 0 makes every save STALE vs DB and hangs "Đang lưu…".
    const serverRevision = readClientRevision(loaded);
    revisionRef.current = serverRevision;
    ackedRevisionRef.current = serverRevision;
    const localDraft = readLocalLandingDraft(pageId);
    const recovery = decideDraftRecovery({ serverRevision, local: localDraft });
    if (recovery === 'restore-local' && localDraft) {
      try {
        const restoredBase = healTextLayerCoordinates(sanitizeLandingPagePersistSpec(localDraft.spec));
        const restoredUpgrade = specWithEditableHtmlSections(restoredBase);
        const restored = restoredUpgrade
          ? healTextLayerCoordinates(sanitizeLandingPagePersistSpec(restoredUpgrade))
          : restoredBase;
        setSpec(restored);
        revisionRef.current = localDraft.clientRevision;
        ackedRevisionRef.current = localDraft.baseRevision;
        dirtyRef.current = true;
        setSaveMsg('Đã khôi phục bản nháp chưa kịp lưu (mất mạng hoặc đóng tab)');
      } catch {
        clearLocalLandingDraft(pageId);
      }
    } else if (recovery === 'conflict' && localDraft) {
      setPendingLocalDraft(localDraft);
      setSaveMsg('Có bản nháp trên máy này cũ hơn bản server. Bản server đang mở.');
    } else if (localDraft) {
      clearLocalLandingDraft(pageId);
    }
    autosaveInflightRef.current = false;
    autosaveQueuedRef.current = false;
    saveConflictRef.current = false;
    setSaveConflict(false);
    // After first paint: hug free-section chrome to painted content (fixes legacy
    // frames that floated over / cut through neighbouring sections).
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          healFreeSectionFramesToContent();
        } catch {
          /* ignore heal errors */
        }
      });
    });
  }, [pageId]);

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : 'Load failed'));
  }, [load]);

  /** Safe conflict resolution: never auto-overwrites — always re-fetches the
   * server's current draft and adopts it. Any local unsaved edits made before
   * the conflict was detected are discarded (they were already rejected by the
   * server and never persisted), never the other writer's saved content. */
  const resolveSaveConflict = useCallback(async () => {
    setResolvingConflict(true);
    try {
      await load();
      setSaveMsg('Đã tải bản mới nhất từ server — chỉnh sửa chưa lưu trước đó (nếu có) đã bị bỏ qua');
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : 'Tải bản mới nhất thất bại — thử lại');
    } finally {
      setResolvingConflict(false);
    }
  }, [load]);

  const recoverPendingLocalDraft = useCallback(async () => {
    const local = pendingLocalDraft;
    if (!local) return;
    setResolvingConflict(true);
    try {
      const updated = await apiClient<PagePayload & { clientRevision?: number }>(
        `/landing-pages/${pageId}/recover-draft`,
        {
          method: 'POST',
          body: JSON.stringify({
            draftSpec: local.spec,
            name: page?.name,
            baseRevision: local.baseRevision,
            clientRevision: local.clientRevision,
            requestId: `recover-${pageId.slice(0, 8)}-${Date.now()}`,
          }),
        },
      );
      const restored = healTextLayerCoordinates(sanitizeLandingPagePersistSpec(updated.draftSpec));
      setSpec(restored);
      const rev = typeof updated.clientRevision === 'number' ? updated.clientRevision : readClientRevision(restored);
      revisionRef.current = rev;
      ackedRevisionRef.current = rev;
      dirtyRef.current = false;
      saveConflictRef.current = false;
      setSaveConflict(false);
      setPendingLocalDraft(null);
      clearLocalLandingDraft(pageId);
      setPage({ ...page!, ...updated, draftSpec: restored });
      setSaveMsg('Đã khôi phục bản máy vào nháp. Bản server trước đó nằm trong lịch sử phiên bản.');
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : 'Khôi phục bản máy thất bại');
    } finally {
      setResolvingConflict(false);
    }
  }, [page, pageId, pendingLocalDraft]);

  // Portal action bar to document.body so position:fixed is relative to viewport
  // (AppShell <main overflow-y-auto> would otherwise scroll a non-ported bar away).
  useEffect(() => {
    setActionBarMounted(true);
  }, []);

  // Preview mode: signal AppShell to hide app chrome; restore on exit/unmount.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (fullscreenPreview) {
      document.body.setAttribute('data-lp-preview-mode', '1');
    } else {
      document.body.removeAttribute('data-lp-preview-mode');
    }
    return () => {
      document.body.removeAttribute('data-lp-preview-mode');
    };
  }, [fullscreenPreview]);

  const onPreviewChange = useCallback((on: boolean) => {
    setFullscreenPreview(on);
  }, []);

  const canvasScrollRef = useRef<HTMLDivElement>(null);

  floatingPosRef.current = floatingPosition;

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setInspectorDesktop(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // Mobile: force docked (no floating/drag).
  useEffect(() => {
    if (!inspectorDesktop && inspectorMode === 'floating') {
      setInspectorMode('docked');
    }
  }, [inspectorDesktop, inspectorMode]);

  const clampFloatingPosition = useCallback((x: number, y: number, panelW = 320, panelH = 480) => {
    const pad = 8;
    const maxX = Math.max(pad, window.innerWidth - Math.min(panelW, window.innerWidth - pad) - pad);
    const maxY = Math.max(pad, window.innerHeight - Math.min(panelH, window.innerHeight - pad) - pad);
    return {
      x: Math.min(Math.max(pad, x), maxX),
      y: Math.min(Math.max(pad, y), maxY),
    };
  }, []);

  const endInspectorDrag = useCallback((pointerId?: number) => {
    const drag = inspectorDragRef.current;
    if (!drag) {
      detachInspectorDragRef.current?.();
      detachInspectorDragRef.current = null;
      return;
    }
    if (pointerId != null && drag.pointerId !== pointerId) return;
    inspectorDragRef.current = null;
    detachInspectorDragRef.current?.();
    detachInspectorDragRef.current = null;
    const handle = inspectorDragHandleRef.current;
    if (handle && pointerId != null) {
      try {
        if (handle.hasPointerCapture?.(pointerId)) {
          handle.releasePointerCapture(pointerId);
        }
      } catch {
        /* already released */
      }
    }
    // Commit final left/top from ref (DOM may already be updated).
    setFloatingPosition({ ...floatingPosRef.current });
  }, []);

  // Cleanup drag listeners on unmount / mode change.
  useEffect(() => {
    return () => {
      detachInspectorDragRef.current?.();
      detachInspectorDragRef.current = null;
      inspectorDragRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (inspectorMode !== 'floating') {
      endInspectorDrag();
    }
  }, [inspectorMode, endInspectorDrag]);

  // Keep floating panel inside viewport on resize.
  useEffect(() => {
    if (inspectorMode !== 'floating' || !inspectorDesktop) return;
    const onResize = () => {
      const el = inspectorPanelRef.current;
      const w = el?.offsetWidth || 320;
      const h = el?.offsetHeight || 480;
      setFloatingPosition((prev) => {
        const next = clampFloatingPosition(prev.x, prev.y, w, h);
        floatingPosRef.current = next;
        return next;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [inspectorMode, inspectorDesktop, clampFloatingPosition]);

  const toggleInspectorMode = useCallback(() => {
    if (!inspectorDesktop) return;
    endInspectorDrag();
    setInspectorMode((prev) => {
      if (prev === 'docked') {
        const el = inspectorPanelRef.current;
        const rect = el?.getBoundingClientRect();
        const next = clampFloatingPosition(
          rect ? rect.left : Math.max(8, window.innerWidth - 360),
          rect ? Math.min(rect.top, Math.max(8, window.innerHeight - 280)) : 108,
          rect?.width || 320,
          // Clamp against viewport, not unbounded content height.
          Math.min(rect?.height || 480, Math.max(240, window.innerHeight - 24)),
        );
        floatingPosRef.current = next;
        setFloatingPosition(next);
        return 'floating';
      }
      return 'docked';
    });
  }, [inspectorDesktop, clampFloatingPosition, endInspectorDrag]);

  /**
   * Robust floating drag:
   * pointerdown → setPointerCapture → window pointermove/up/cancel/lostpointercapture.
   * Position from getBoundingClientRect + clientX/Y offset (no left/top+transform mix).
   */
  const onInspectorDragPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (inspectorMode !== 'floating' || !inspectorDesktop) return;
      if (e.button !== 0) return;
      const t = e.target as HTMLElement | null;
      if (
        t?.closest?.(
          'button, a, input, textarea, select, label, [data-lp-inspector-tabs], [data-lp-inspector-tab-btn], [role="tab"], [data-lp-inspector-expand], [data-lp-no-drag]',
        )
      ) {
        return;
      }
      const panel = inspectorPanelRef.current;
      const handle = e.currentTarget;
      if (!panel) return;

      e.preventDefault();
      e.stopPropagation();

      // Always re-sync from live rect so first move never jumps.
      const rect = panel.getBoundingClientRect();
      const start = clampFloatingPosition(rect.left, rect.top, rect.width, rect.height);
      floatingPosRef.current = start;
      setFloatingPosition(start);
      panel.style.left = `${start.x}px`;
      panel.style.top = `${start.y}px`;

      inspectorDragRef.current = {
        pointerId: e.pointerId,
        offsetX: e.clientX - start.x,
        offsetY: e.clientY - start.y,
      };
      inspectorDragHandleRef.current = handle;

      try {
        handle.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      const onMove = (ev: PointerEvent) => {
        const drag = inspectorDragRef.current;
        if (!drag || ev.pointerId !== drag.pointerId) return;
        // Mouse released outside without pointerup (rare) — stop immediately.
        if (ev.pointerType === 'mouse' && ev.buttons === 0) {
          endInspectorDrag(ev.pointerId);
          return;
        }
        const el = inspectorPanelRef.current;
        const next = clampFloatingPosition(
          ev.clientX - drag.offsetX,
          ev.clientY - drag.offsetY,
          el?.offsetWidth || 320,
          el?.offsetHeight || 480,
        );
        floatingPosRef.current = next;
        if (el) {
          el.style.left = `${next.x}px`;
          el.style.top = `${next.y}px`;
        }
      };

      const onUp = (ev: PointerEvent) => {
        if (inspectorDragRef.current?.pointerId !== ev.pointerId) return;
        endInspectorDrag(ev.pointerId);
      };

      const onLostCapture = (ev: Event) => {
        const pe = ev as PointerEvent;
        if (inspectorDragRef.current?.pointerId !== pe.pointerId) return;
        endInspectorDrag(pe.pointerId);
      };

      // Detach any previous listeners before attaching (no duplicates).
      detachInspectorDragRef.current?.();
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp, true);
      window.addEventListener('pointercancel', onUp, true);
      handle.addEventListener('lostpointercapture', onLostCapture);
      detachInspectorDragRef.current = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp, true);
        window.removeEventListener('pointercancel', onUp, true);
        handle.removeEventListener('lostpointercapture', onLostCapture);
      };
    },
    [inspectorMode, inspectorDesktop, clampFloatingPosition, endInspectorDrag],
  );

  // Sync right inspector to selected block id (stable — survives viewport change).
  useEffect(() => {
    if (!selectedBlockId || !inspectorPanelRef.current) return;
    // Button / Icon inspectors own their fields — never steal focus.
    if (isButtonInspector || isIconInspector) return;
    if (document.activeElement?.closest?.('[data-lp-button-inspector="1"]')) return;
    if (document.activeElement?.closest?.('[data-lp-icon-inspector="1"]')) return;
    const safeId = selectedBlockId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const root = inspectorPanelRef.current.querySelector(`[data-inspector-block-id="${safeId}"]`);
    if (!(root instanceof HTMLElement)) return;
    const field =
      selectedElement === 'headline' ||
      selectedElement === 'subheadline' ||
      selectedElement === 'body' ||
      selectedElement === 'cta' ||
      selectedElement === 'image'
        ? selectedElement === 'cta'
          ? 'ctaLabel'
          : selectedElement
        : null;
    if (field) {
      const fieldEl = root.querySelector(`[data-inspector-field="${field}"]`);
      if (fieldEl instanceof HTMLElement) {
        fieldEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        const focusable = fieldEl.querySelector('input, textarea') as HTMLElement | null;
        focusable?.focus({ preventScroll: true });
        return;
      }
    }
    root.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedBlockId, selectedElement, isButtonInspector, isIconInspector]);

  const persist = useCallback(
    async (
      nextSpec?: LandingPageSpec,
      name?: string,
      opts?: { manual?: boolean; wait?: boolean; _flushDepth?: number },
    ) => {
      const manual = opts?.manual === true;
      const wait = opts?.wait === true || manual;
      const flushDepth = opts?._flushDepth ?? 0;
      if (wait && flushDepth > 12) {
        setSaveMsg('Không lưu kịp trước thao tác — thử Lưu lại');
        return;
      }
      // Unresolved version conflict — never auto-retry a write while paused, that is
      // exactly the "out-bid the server revision" behavior that used to silently
      // overwrite a newer save. User must call resolveSaveConflict() first.
      if (saveConflictRef.current) {
        dirtyRef.current = true;
        setSaveMsg('Có bản mới hơn ở nơi khác — bấm "Tải bản mới nhất" để tiếp tục');
        return;
      }
      // Serial mutex — concurrent callers queue a follow-up with latest specRef.
      // Publish/manual with wait must not return early — await in-flight then flush.
      if (autosaveInflightRef.current) {
        autosaveQueuedRef.current = true;
        dirtyRef.current = true;
        if (manual) setSaveMsg('Đang chờ lưu…');
        if (!wait) return;
        await new Promise<void>((resolve) => {
          persistWaitersRef.current.push(resolve);
        });
        // After prior save finishes, flush latest canvas state.
        return persist(specRef.current, name ?? page?.name, {
          ...opts,
          wait: true,
          _flushDepth: flushDepth + 1,
        });
      }
      autosaveInflightRef.current = true;
      const hadQueue = autosaveQueuedRef.current;
      autosaveQueuedRef.current = false;

      const startedAtRevision = revisionRef.current;
      const baseRevision = ackedRevisionRef.current;
      const requestId = `lp-as-${++autosaveRequestIdRef.current}`;
      // Always prefer live canvas — never stale closure when caller omitted nextSpec.
      const payloadSpec = nextSpec ?? specRef.current;
      // Stamp revision into meta for server-side stale rejection (idempotent).
      const stamped: LandingPageSpec = {
        ...payloadSpec,
        meta: {
          ...(payloadSpec.meta || {}),
          clientRevision: startedAtRevision,
        },
      };

      // Only manual "Lưu" toggles button saving state — background autosave must not
      // lock the UI on "Đang lưu…" during typing (reflush storms looked like a hang).
      if (manual) setSaving(true);
      const ac = new AbortController();
      const timeoutId = window.setTimeout(() => ac.abort(), 20_000);
      const queueFollowUp = (delayMs: number) => {
        if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
        autosaveTimer.current = setTimeout(() => {
          if (dirtyRef.current) void persist(specRef.current, page?.name);
        }, delayMs);
      };
      let needsImmediateFlush = false;
      try {
        // Wire/DB only — never write response draftSpec back into live editor state.
        const sanitized = sanitizeLandingPagePersistSpec(stamped);
        const autosaveBody = JSON.stringify({
          draftSpec: sanitized,
          name: name ?? page?.name,
          clientRevision: startedAtRevision,
          baseRevision,
          requestId,
        });
        let res: {
          updatedAt: string;
          rejected?: boolean;
          reason?: string;
          clientRevision?: number;
          requestId?: string | null;
        } | null = null;
        let lastErr: unknown;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            res = await apiClient(`/landing-pages/${pageId}/autosave`, {
              method: 'POST',
              signal: ac.signal,
              body: autosaveBody,
            });
            lastErr = null;
            break;
          } catch (err) {
            lastErr = err;
            const aborted =
              (err instanceof DOMException && err.name === 'AbortError') ||
              (err instanceof Error && err.name === 'AbortError');
            if (aborted) break;
          }
        }
        if (!res) throw lastErr instanceof Error ? lastErr : new Error('Lưu thất bại');

        const staleLocal = revisionRef.current > startedAtRevision;
        if (!res.rejected && typeof res.clientRevision === 'number' && Number.isFinite(res.clientRevision)) {
          ackedRevisionRef.current = Math.floor(res.clientRevision);
          revisionRef.current = Math.max(revisionRef.current, ackedRevisionRef.current);
        }
        if (res.rejected || res.reason === 'STALE_REVISION') {
          // Someone else (another tab/session) saved a newer revision than the one we
          // based this write on. Do NOT bump our local revision past theirs and retry —
          // that would force our (older) draft over their saved content and silently
          // destroy it. Pause autosave; the user must explicitly resolve the conflict
          // (resolveSaveConflict) which re-fetches the current server draft.
          saveConflictRef.current = true;
          setSaveConflict(true);
          dirtyRef.current = true;
          setSaveMsg('Có người khác vừa lưu bản mới hơn — bấm "Tải bản mới nhất" để tiếp tục');
        } else if (staleLocal || hadQueue || autosaveQueuedRef.current) {
          dirtyRef.current = true;
          autosaveQueuedRef.current = false;
          setSaveMsg(`Đã lưu ${new Date(res.updatedAt).toLocaleTimeString()} — đồng bộ tiếp…`);
          // Debounced follow-up — never tight 0/50ms loop that keeps UI on "Đang lưu…".
          // Waiters (publish) flush immediately instead of 500ms debounce.
          if (wait || persistWaitersRef.current.length) needsImmediateFlush = true;
          else queueFollowUp(500);
        } else {
          dirtyRef.current = false;
          setSaveMsg(`Đã lưu ${new Date(res.updatedAt).toLocaleTimeString()}`);
        }
        if (res.rejected) {
          writeLocalLandingDraft({
            pageId,
            spec: specRef.current,
            baseRevision: ackedRevisionRef.current,
            clientRevision: revisionRef.current,
            savedAt: new Date().toISOString(),
          });
        } else if (dirtyRef.current) {
          writeLocalLandingDraft({
            pageId,
            spec: specRef.current,
            baseRevision: ackedRevisionRef.current,
            clientRevision: revisionRef.current,
            savedAt: new Date().toISOString(),
          });
        } else {
          clearLocalLandingDraft(pageId);
        }
      } catch (e) {
        const aborted =
          (e instanceof DOMException && e.name === 'AbortError') ||
          (e instanceof Error && e.name === 'AbortError');
        setSaveMsg(
          aborted
            ? 'Lưu quá lâu — bấm Lưu để thử lại'
            : e instanceof Error
              ? e.message
              : 'Lưu thất bại',
        );
        dirtyRef.current = true;
        writeLocalLandingDraft({
          pageId,
          spec: specRef.current,
          baseRevision: ackedRevisionRef.current,
          clientRevision: revisionRef.current,
          savedAt: new Date().toISOString(),
        });
      } finally {
        window.clearTimeout(timeoutId);
        autosaveInflightRef.current = false;
        if (manual) setSaving(false);
        if (autosaveQueuedRef.current) {
          autosaveQueuedRef.current = false;
          dirtyRef.current = true;
          if (wait || persistWaitersRef.current.length) needsImmediateFlush = true;
          else queueFollowUp(500);
        }
        const waiters = persistWaitersRef.current.splice(0);
        waiters.forEach((w) => w());
      }
      // Publish/manual flush: keep saving until canvas is clean.
      if (wait && (needsImmediateFlush || dirtyRef.current)) {
        await persist(specRef.current, name ?? page?.name, {
          ...opts,
          wait: true,
          manual,
          _flushDepth: flushDepth + 1,
        });
      }
    },
    [pageId, page?.name],
  );

  useEffect(() => {
    if (!dirtyRef.current) return;
    // Paused on an unresolved save conflict — scheduling here would just repeat the
    // rejected write. Wait for resolveSaveConflict() (Tải bản mới nhất) instead.
    if (saveConflictRef.current) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      void persist(specRef.current, page?.name);
    }, 1200);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [spec, page?.name, persist]);

  useEffect(() => {
    if (!dirtyRef.current) return;
    const timer = window.setTimeout(() => {
      if (!dirtyRef.current) return;
      writeLocalLandingDraft({
        pageId,
        spec: specRef.current,
        baseRevision: ackedRevisionRef.current,
        clientRevision: revisionRef.current,
        savedAt: new Date().toISOString(),
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [spec, pageId]);

  useEffect(() => {
    const flush = () => {
      if (!dirtyRef.current) return;
      writeLocalLandingDraft({
        pageId,
        spec: specRef.current,
        baseRevision: ackedRevisionRef.current,
        clientRevision: revisionRef.current,
        savedAt: new Date().toISOString(),
      });
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
    };
  }, [pageId]);

  // Canvas reserve after spec mutations (delete/duplicate/undo/redo/reload) is owned
  // solely by computeCanvasFreeReserveHeight via LandingPageRenderer's own render +
  // effect (see BUG-15) — spec/blocks changes already flow down as its props, so no
  // separate imperative re-sync is needed here.

  const undo = useCallback(() => {
    const prev = historyRef.current.pop();
    if (!prev) return;
    futureRef.current.push(cloneSpec(specRef.current));
    revisionRef.current += 1;
    setSpec(prev);
    setHtmlNode(null);
    dirtyRef.current = true;
    setHistoryNav({ undo: historyRef.current.length > 0, redo: true });
  }, []);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    historyRef.current.push(cloneSpec(specRef.current));
    revisionRef.current += 1;
    setSpec(next);
    setHtmlNode(null);
    dirtyRef.current = true;
    setHistoryNav({ undo: true, redo: futureRef.current.length > 0 });
  }, []);

  // Builder shortcuts (Undo/Redo/Deselect/Delete) — never intercept when typing in form fields.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableKeyboardTarget(e.target)) return;
      if ((e.target as HTMLElement | null)?.closest?.('[data-lp-inline-editing="1"]')) return;
      if (document.querySelector('[data-lp-html-document][data-lp-inline-editing="1"]')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (fullscreenPreview) {
          setFullscreenPreview(false);
          return;
        }
        deselectCanvas();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Nested element (icon/text/box) → hide that element only.
        // Section selection → delete the section block.
        // Prefer live selection ref — never escalate nested → parent block delete.
        const keys = canvasSelectionRef.current.ids.length
          ? canvasSelectionRef.current.ids
          : selectedIdRef.current
            ? [`${selectedIdRef.current}::section`]
            : [];
        if (!keys.length) return;
        const sectionIds: string[] = [];
        const nested: LpSelectionTarget[] = [];
        for (const key of keys) {
          const parsed = parseLpSelectionKey(key);
          if (!parsed) continue;
          const norm = normalizeLpSelectionTarget(parsed);
          if (isSectionLevelElement(norm.element)) sectionIds.push(norm.blockId);
          else nested.push(norm);
        }
        e.preventDefault();
        if (nested.length) {
          canvasActionRef.current.hideCanvasElements(nested);
          canvasActionRef.current.deselectCanvas();
          return;
        }
        if (sectionIds.length) canvasActionRef.current.removeBlocks(sectionIds);
        return;
      }
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo, redo, fullscreenPreview]);

  function isSectionLocked(blockId: string): boolean {
    return specRef.current.blocks.find((b) => b.id === blockId)?.locked === true;
  }

  /** Section lock — structural + content edits no-op with toast (unlock via toggleBlockLock). */
  function guardSectionUnlocked(
    blockId: string,
    msg = 'Section đang khóa — mở khóa trước khi chỉnh sửa',
  ): boolean {
    if (!isSectionLocked(blockId)) return true;
    setSaveMsg(msg);
    return false;
  }

  function updateBlock(id: string, patch: Partial<LandingPageBlock>) {
    const keys = Object.keys(patch);
    // Allow unlock/lock itself; every other patch is blocked while locked.
    const onlyLockToggle = keys.length === 1 && keys[0] === 'locked';
    if (!onlyLockToggle && !guardSectionUnlocked(id)) return;
    // Live typing: apply raw patch — do NOT sanitize (trim would eat Space / partial URLs).
    const current = specRef.current;
    const next = {
      ...current,
      blocks: current.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as LandingPageBlock) : b)),
    };
    pushHistory(markLandingPageUserEdits(next, keys.map((f) => `${id}.${f}`)));
  }

  /** Inspector free-layout edits must target the active viewport (tablet/mobile overrides). */
  function patchBlockFreeLayoutForViewport(blockId: string, nextLayout: LandingPageFreeLayout) {
    if (!guardSectionUnlocked(blockId)) return;
    const current = specRef.current;
    const block = current.blocks.find((b) => b.id === blockId);
    if (!block) return;
    const clamped = ensureSectionFreeLayoutHeight(clampAbsoluteFreeLayout(nextLayout));
    const style = { ...((block.style || {}) as Record<string, unknown>) };
    const stripStyleMirror =
      style.lpRotate != null ||
      style.lpTranslateX != null ||
      style.lpTranslateY != null ||
      typeof style.transform === 'string';
    let patch: Partial<LandingPageBlock> =
      viewport === 'desktop'
        ? { positionMode: 'free', freeLayout: clamped }
        : {
            positionMode: 'free',
            freeLayout: block.freeLayout || clamped,
            responsiveFreeLayout: {
              ...(block.responsiveFreeLayout || {}),
              [viewport]: clamped,
            },
          };
    if (stripStyleMirror) {
      patch = {
        ...patch,
        style: {
          ...style,
          lpRotate: undefined,
          lpTranslateX: undefined,
          lpTranslateY: undefined,
          transform: undefined,
        },
      } as Partial<LandingPageBlock>;
    }
    updateBlock(blockId, patch);
  }

  const resolvedSelectedFreeLayout = useMemo(() => {
    if (!selected || selected.positionMode !== 'free') return null;
    return resolveFreeLayoutForViewport(
      selected.positionMode,
      selected.freeLayout,
      selected.responsiveFreeLayout,
      viewport,
    );
  }, [selected, viewport]);

  function applyAiToBlockField(id: string, field: string, value: string) {
    if (!guardSectionUnlocked(id)) return;
    const current = specRef.current;
    const next = {
      ...current,
      blocks: current.blocks.map((b) =>
        b.id === id ? ({ ...b, [field]: value } as LandingPageBlock) : b,
      ),
    };
    pushHistory(markLandingPageFieldSources(next, [`${id}.${field}`], 'ai'));
  }

  function applyAiToSeo(field: 'title' | 'metaDescription', value: string) {
    const current = specRef.current;
    const next = {
      ...current,
      seo: { ...current.seo, [field]: value },
    };
    pushHistory(markLandingPageFieldSources(next, [`seo.${field}`], 'ai'));
  }

  function blockContextSnippet(block: LandingPageBlock): string {
    const parts: string[] = [`type=${block.type}`];
    const rec = block as unknown as Record<string, unknown>;
    for (const k of ['headline', 'subheadline', 'body', 'ctaLabel'] as const) {
      if (typeof rec[k] === 'string' && (rec[k] as string).trim()) {
        parts.push(`${k}=${String(rec[k]).slice(0, 120)}`);
      }
    }
    return parts.join(' | ').slice(0, 800);
  }

  function addBlocks(
    types: LandingPageBlockType[],
    opts?: { pos?: LpSidebarInsertPos; select?: 'first' | 'last' },
  ) {
    if (!types.length) return;
    // Use live canvas — never stale React closure (edit → immediate preset insert).
    const current = specRef.current;
    const blocks = [...current.blocks];
    let insertAt = resolveInsertIndex(blocks, opts?.pos);
    const created: LandingPageBlock[] = [];
    for (const type of types) {
      const block = defaultBlock(type);
      created.push(block);
      blocks.splice(insertAt, 0, block);
      insertAt += 1;
    }
    pushHistory(sanitizeLandingPageDraftSpec({ ...current, blocks }));
    const select = opts?.select ?? 'last';
    const focus = select === 'first' ? created[0] : created[created.length - 1];
    if (focus) {
      selectCanvas({ blockId: focus.id, element: 'section' });
    }
  }

  function addBlock(type: LandingPageBlockType) {
    addBlocks([type]);
  }

  function resolveInsertIndex(blocks: LandingPageBlock[], pos?: LpSidebarInsertPos): number {
    if (pos?.mode === 'end') return blocks.length;
    if (pos?.mode === 'start') return 0;
    if (pos?.mode === 'before') {
      const idx = blocks.findIndex((b) => b.id === pos.blockId);
      return idx >= 0 ? idx : blocks.length;
    }
    if (pos?.mode === 'after') {
      const idx = blocks.findIndex((b) => b.id === pos.blockId);
      return idx >= 0 ? idx + 1 : blocks.length;
    }
    if (selectedId) {
      const idx = blocks.findIndex((b) => b.id === selectedId);
      if (idx >= 0) return idx + 1;
    }
    return blocks.length;
  }

  /** Insert a title text layer — free section at drop pointer (canvas-local). */
  function insertTitlePreset(preset: LandingPageTitlePreset, pos?: LpSidebarInsertPos) {
    ensureLandingPageTitleFonts();
    const current = specRef.current;
    const blocks = [...current.blocks];
    const insertAt = resolveInsertIndex(blocks, pos);
    const freeLayout = resolveTextLayerFreeLayout(blocks, pos);
    const block = {
      ...defaultBlock('Benefits'),
      type: 'Benefits' as const,
      headline: preset.label,
      subheadline: '',
      items: [] as Array<{ id: string; title: string; description: string }>,
      spacing: 'none' as const,
      positionMode: 'free' as const,
      freeLayout,
    };
    blocks.splice(insertAt, 0, block);
    const styleKey = `${block.id}::headline`;
    const prevMap =
      (current.meta && typeof current.meta === 'object'
        ? (current.meta as { inlineTextStyles?: Record<string, LandingPageInlineTextStyle> }).inlineTextStyles
        : null) || {};
    // Strip any stale element free-layout for this key — section freeLayout owns position.
    const prevEfl =
      (current.meta && typeof current.meta === 'object'
        ? (current.meta as { elementFreeLayouts?: Record<string, LandingPageFreeLayout> }).elementFreeLayouts
        : null) || {};
    const nextEfl = { ...prevEfl };
    delete nextEfl[styleKey];
    pushHistory(
      markLandingPageUserEdits(
        sanitizeLandingPageDraftSpec({
          ...current,
          blocks,
          meta: {
            ...(current.meta || {}),
            inlineTextStyles: {
              ...prevMap,
              [styleKey]: { ...preset.style },
            },
            elementFreeLayouts: nextEfl,
          },
        }),
        [`${block.id}.headline`, `${styleKey}.style`, `${block.id}.freeLayout`],
      ),
    );
    selectCanvas({ blockId: block.id, element: 'headline', field: 'headline' });
    setSaveMsg(`Đã chèn tiêu đề «${preset.label}»`);
  }

  /** Insert paragraph text layer — free section at drop pointer. */
  function insertParagraphPreset(preset: LandingPageParagraphPreset, pos?: LpSidebarInsertPos) {
    ensureLandingPageTitleFonts();
    const current = specRef.current;
    const blocks = [...current.blocks];
    const insertAt = resolveInsertIndex(blocks, pos);
    const freeLayout = resolveTextLayerFreeLayout(blocks, pos);
    const block = {
      ...defaultBlock('Benefits'),
      type: 'Benefits' as const,
      headline: '',
      subheadline: preset.text,
      items: [] as Array<{ id: string; title: string; description: string }>,
      spacing: 'none' as const,
      positionMode: 'free' as const,
      freeLayout: { ...freeLayout, width: 520, height: 96 },
    };
    blocks.splice(insertAt, 0, block);
    const styleKey = `${block.id}::subheadline`;
    const prevMap =
      (current.meta && typeof current.meta === 'object'
        ? (current.meta as { inlineTextStyles?: Record<string, LandingPageInlineTextStyle> }).inlineTextStyles
        : null) || {};
    const prevEfl =
      (current.meta && typeof current.meta === 'object'
        ? (current.meta as { elementFreeLayouts?: Record<string, LandingPageFreeLayout> }).elementFreeLayouts
        : null) || {};
    const nextEfl = { ...prevEfl };
    delete nextEfl[styleKey];
    pushHistory(
      markLandingPageUserEdits(
        sanitizeLandingPageDraftSpec({
          ...current,
          blocks,
          meta: {
            ...(current.meta || {}),
            inlineTextStyles: {
              ...prevMap,
              [styleKey]: { ...preset.style },
            },
            elementFreeLayouts: nextEfl,
          },
        }),
        [`${block.id}.subheadline`, `${styleKey}.style`, `${block.id}.freeLayout`],
      ),
    );
    selectCanvas({ blockId: block.id, element: 'subheadline', field: 'subheadline' });
    setSaveMsg('Đã chèn đoạn văn');
  }

  /** Insert plain bullet/checklist Benefits (items + icon markers). */
  function insertListPreset(preset: LandingPageListPreset, pos?: LpSidebarInsertPos) {
    ensureLandingPageTitleFonts();
    const current = specRef.current;
    const blocks = [...current.blocks];
    const insertAt = resolveInsertIndex(blocks, pos);
    const block = {
      ...defaultBlock('Benefits'),
      type: 'Benefits' as const,
      headline: '',
      subheadline: '',
      spacing: 'sm' as const,
      items: preset.lines.map((title) => ({
        id: uid('item'),
        title,
        description: '',
        icon: preset.bullet,
      })),
    };
    blocks.splice(insertAt, 0, block);
    const stylePatches: Record<string, LandingPageInlineTextStyle> = {};
    for (const item of block.items) {
      stylePatches[`${block.id}::itemTitle:${item.id}`] = { ...preset.style };
    }
    const prevMap =
      (current.meta && typeof current.meta === 'object'
        ? (current.meta as { inlineTextStyles?: Record<string, LandingPageInlineTextStyle> }).inlineTextStyles
        : null) || {};
    pushHistory(
      markLandingPageUserEdits(
        sanitizeLandingPageDraftSpec({
          ...current,
          blocks,
          meta: {
            ...(current.meta || {}),
            inlineTextStyles: {
              ...prevMap,
              ...stylePatches,
            },
          },
        }),
        [`${block.id}.items`, ...Object.keys(stylePatches).map((k) => `${k}.style`)],
      ),
    );
    selectCanvas({
      blockId: block.id,
      element: block.items[0] ? (`item:${block.items[0].id}` as const) : 'section',
    });
    setSaveMsg('Đã chèn danh sách');
  }

  /** Insert styled single button as CTA (button-only render). */
  function insertButtonPreset(preset: LandingPageButtonPreset, pos?: LpSidebarInsertPos) {
    const current = specRef.current;
    const blocks = [...current.blocks];
    const insertAt = resolveInsertIndex(blocks, pos);
    const block = {
      ...defaultBlock('CTA'),
      type: 'CTA' as const,
      headline: '',
      subheadline: '',
      body: '',
      ctaLabel: preset.label,
      ctaUrl: '#lead-form',
      spacing: 'none' as const,
      style: { ...preset.style },
    };
    blocks.splice(insertAt, 0, block);
    // Typography extras (fontFamily / italic / underline / transform) live in
    // inlineTextStyles so Inspector + mergeTextStyle apply them without renderer changes.
    const styleKey = `${block.id}::ctaLabel`;
    const prevMap =
      (current.meta && typeof current.meta === 'object'
        ? (current.meta as { inlineTextStyles?: Record<string, LandingPageInlineTextStyle> })
            .inlineTextStyles
        : null) || {};
    const textExtras: LandingPageInlineTextStyle = {};
    const s = preset.style;
    if (s.fontFamily) textExtras.fontFamily = s.fontFamily;
    if (s.fontStyle) textExtras.fontStyle = s.fontStyle;
    if (s.textTransform) textExtras.textTransform = s.textTransform;
    if (s.textDecoration) textExtras.textDecoration = s.textDecoration;
    const hasTextExtras = Object.keys(textExtras).length > 0;
    pushHistory(
      markLandingPageUserEdits(
        sanitizeLandingPageDraftSpec({
          ...current,
          blocks,
          ...(hasTextExtras
            ? {
                meta: {
                  ...(current.meta || {}),
                  inlineTextStyles: {
                    ...prevMap,
                    [styleKey]: textExtras,
                  },
                },
              }
            : null),
        }),
        [`${block.id}.ctaLabel`],
      ),
    );
    selectCanvas({ blockId: block.id, element: 'cta' });
    setSaveMsg(`Đã chèn nút «${preset.label}»`);
  }

  /** Insert shape-only CTA («Đồ họa») — empty text + style.lpBox. */
  function insertBoxPreset(preset: LandingPageBoxPreset, pos?: LpSidebarInsertPos) {
    const current = specRef.current;
    const blocks = [...current.blocks];
    const insertAt = resolveInsertIndex(blocks, pos);
    const style = {
      ...preset.style,
      ...(preset.id.startsWith('frame-') || preset.style.lpFrame ? { lpFrame: true } : {}),
    };
    const block = {
      ...defaultBlock('CTA'),
      type: 'CTA' as const,
      headline: '',
      subheadline: '',
      body: '',
      ctaLabel: '',
      ctaUrl: '',
      imageUrl: null as string | null,
      spacing: 'none' as const,
      style,
    };
    blocks.splice(insertAt, 0, block);
    pushHistory(
      markLandingPageUserEdits(
        sanitizeLandingPageDraftSpec({ ...current, blocks }),
        [`${block.id}.style`],
      ),
    );
    selectCanvas({ blockId: block.id, element: 'section' });
    setSaveMsg(`Đã chèn đồ họa «${preset.label}»`);
  }

  /** Insert themed LeadForm card from «Biểu mẫu» presets. */
  function insertFormPreset(preset: LandingPageFormPreset, pos?: LpSidebarInsertPos) {
    const current = specRef.current;
    const blocks = [...current.blocks];
    const insertAt = resolveInsertIndex(blocks, pos);
    const block = {
      ...defaultBlock('LeadForm'),
      type: 'LeadForm' as const,
      headline: preset.headline,
      subheadline: preset.subheadline || '',
      submitLabel: preset.submitLabel,
      footerText: preset.footerText || '',
      successMessage: 'Cảm ơn bạn! Chúng tôi sẽ liên hệ sớm.',
      formTheme: { ...preset.formTheme },
      fields: preset.fields.map((row) => ({
        ...row,
        id: uid('fld'),
      })),
    };
    blocks.splice(insertAt, 0, block);
    pushHistory(
      markLandingPageUserEdits(
        sanitizeLandingPageDraftSpec({ ...current, blocks }),
        [`${block.id}.headline`, `${block.id}.fields`, `${block.id}.submitLabel`],
      ),
    );
    selectCanvas({ blockId: block.id, element: 'section' });
    setSaveMsg(`Đã chèn biểu mẫu «${preset.label}»`);
  }

  /** Insert button group as Benefits nav:* items. */
  function insertButtonGroupPreset(preset: LandingPageButtonGroupPreset, pos?: LpSidebarInsertPos) {
    const current = specRef.current;
    const blocks = [...current.blocks];
    const insertAt = resolveInsertIndex(blocks, pos);
    const icon = navIconForVariant(preset.variant);
    const block = {
      ...defaultBlock('Benefits'),
      type: 'Benefits' as const,
      headline: '',
      subheadline: '',
      spacing: 'sm' as const,
      items: preset.labels.map((title) => ({
        id: uid('item'),
        title,
        description: '',
        icon,
      })),
    };
    blocks.splice(insertAt, 0, block);
    pushHistory(
      markLandingPageUserEdits(
        sanitizeLandingPageDraftSpec({ ...current, blocks }),
        [`${block.id}.items`],
      ),
    );
    selectCanvas({
      blockId: block.id,
      element: block.items[0] ? (`item:${block.items[0].id}` as const) : 'section',
    });
    setSaveMsg('Đã chèn nhóm nút');
  }

  function insertBlockTypeAt(type: LandingPageBlockType, pos?: LpSidebarInsertPos) {
    const current = specRef.current;
    const blocks = [...current.blocks];
    const insertAt = resolveInsertIndex(blocks, pos);
    const block = defaultBlock(type);
    blocks.splice(insertAt, 0, block);
    pushHistory(sanitizeLandingPageDraftSpec({ ...current, blocks }));
    selectCanvas({ blockId: block.id, element: 'section' });
    setSaveMsg(`Đã thêm ${type}`);
  }

  function insertMediaGalleryAt(item: { url: string; name: string }, pos?: LpSidebarInsertPos) {
    const url = item.url;
    const alt = item.name.replace(/\.[^.]+$/, '').slice(0, 80);
    const current = specRef.current;
    const gallery = defaultBlock('Gallery') as LandingPageBlock & {
      items: Array<Record<string, unknown>>;
    };
    if (Array.isArray(gallery.items) && gallery.items[0]) {
      gallery.items = [
        {
          ...gallery.items[0],
          imageUrl: url,
          imageStyle: { alt },
          title: alt || 'Hình ảnh',
        },
      ];
    }
    const blocks = [...current.blocks];
    const insertAt = resolveInsertIndex(blocks, pos);
    blocks.splice(insertAt, 0, gallery);
    pushHistory(sanitizeLandingPageDraftSpec({ ...current, blocks }));
    selectCanvas({ blockId: gallery.id, element: 'section' });
    setMediaOpen(false);
    setSaveMsg('Đã thêm Gallery với ảnh đã chọn');
  }

  function openSectionLibrary(pos?: LpSidebarInsertPos | null) {
    sectionLibraryPosRef.current = pos ?? null;
    setSectionLibraryOpen(true);
  }

  function openButtonLibrary(pos?: LpSidebarInsertPos | null) {
    buttonLibraryPosRef.current = pos ?? null;
    setButtonLibraryOpen(true);
  }

  function insertLibraryButtonTemplate(templateId: string) {
    const tpl = getButtonLibraryTemplate(templateId);
    if (!tpl) return;
    ensureLandingPageTitleFonts();
    const pos = buttonLibraryPosRef.current ?? undefined;
    buttonLibraryPosRef.current = null;
    insertButtonPreset(buttonLibraryTemplateToPreset(tpl), pos);
  }

  function insertLibrarySectionTemplate(templateId: string) {
    const tpl = getSectionLibraryTemplate(templateId);
    if (!tpl) return;
    const current = specRef.current;
    const blocks = [...current.blocks];
    const insertAt = resolveInsertIndex(blocks, sectionLibraryPosRef.current ?? undefined);
    const block = materializeSectionLibraryTemplate(tpl, uid);
    blocks.splice(insertAt, 0, block);
    pushHistory(sanitizeLandingPageDraftSpec({ ...current, blocks }));
    selectCanvas({ blockId: block.id, element: 'section' });
    sectionLibraryPosRef.current = null;
    setSaveMsg(`Đã thêm section «${tpl.label}»`);
  }

  function insertBlankSection() {
    const current = specRef.current;
    const blocks = [...current.blocks];
    const insertAt = resolveInsertIndex(blocks, sectionLibraryPosRef.current ?? undefined);
    const block = {
      ...defaultBlock('Benefits'),
      headline: 'Section mới',
      subheadline: '',
      items: [] as Array<{ id: string; title: string; description: string }>,
      spacing: 'md' as const,
      variant: 'minimal-list',
    };
    blocks.splice(insertAt, 0, block);
    pushHistory(sanitizeLandingPageDraftSpec({ ...current, blocks }));
    selectCanvas({ blockId: block.id, element: 'section' });
    sectionLibraryPosRef.current = null;
    setSaveMsg('Đã thêm phần trống');
  }

  function insertSidebarPreset(payload: LpSidebarPresetPayload, pos: LpSidebarInsertPos) {
    switch (payload.kind) {
      case 'title':
        insertTitlePreset(payload.preset, pos);
        return;
      case 'paragraph':
        insertParagraphPreset(payload.preset, pos);
        return;
      case 'list':
        insertListPreset(payload.preset, pos);
        return;
      case 'button':
        insertButtonPreset(payload.preset, pos);
        return;
      case 'button-group':
        insertButtonGroupPreset(payload.preset, pos);
        return;
      case 'box':
        insertBoxPreset(payload.preset, pos);
        return;
      case 'form':
        insertFormPreset(payload.preset, pos);
        return;
      case 'block-type':
        insertBlockTypeAt(payload.type, pos);
        return;
      case 'media':
        insertMediaGalleryAt(payload, pos);
        return;
      case 'section-preset':
        addBlocks(payload.types, { pos, select: 'first' });
        setSaveMsg(`Đã chèn section mẫu (${payload.types.length} block)`);
        return;
      case 'section-library-open':
        openSectionLibrary(pos);
        return;
      case 'button-library-open':
        openButtonLibrary(pos);
        return;
      default:
        return;
    }
  }

  /** Fill Đồ họa frame / grid cell with an image URL (reuse history + sanitize). */
  function applyBlockImage(
    blockId: string,
    url: string,
    opts?: { gridIndex?: number; alt?: string },
  ) {
    const block = specRef.current.blocks.find((b) => b.id === blockId);
    if (!block || block.type !== 'CTA') return;
    if (!isLandingPageBoxStyle(block.style as Record<string, unknown> | undefined)) return;
    const style = { ...(block.style || {}) } as Record<string, unknown>;
    const alt = opts?.alt || 'Ảnh';
    const gridIdx = opts?.gridIndex;
    if (style.lpGrid && typeof gridIdx === 'number' && Number.isFinite(gridIdx) && gridIdx >= 0) {
      let images: string[] = [];
      try {
        images = JSON.parse(String(style.lpGridImages || '[]'));
        if (!Array.isArray(images)) images = [];
      } catch {
        images = [];
      }
      images[gridIdx] = url;
      style.lpGridImages = JSON.stringify(images);
      updateBlock(blockId, { style: style as LandingPageBlock['style'] });
      selectCanvas({ blockId: blockId, element: `grid:${gridIdx}` });
      setSaveMsg('Đã chèn ảnh vào ô lưới');
      return;
    }
    updateBlock(blockId, {
      imageUrl: url,
      imageStyle: { ...((block as { imageStyle?: Record<string, unknown> }).imageStyle || {}), alt },
      style: { ...style, lpFrame: true } as LandingPageBlock['style'],
    });
    selectCanvas({ blockId: blockId, element: 'image' });
    setSaveMsg('Đã chèn ảnh vào khung');
  }

  /** Apply media URL to selected block/item, or insert a Gallery with that image. */
  function applyMediaToSelection(item: LpMediaItem) {
    const url = item.url;
    const textBoxMedia = textBoxMediaRef.current;
    if (textBoxMedia) {
      textBoxMediaRef.current = null;
      textBoxMedia(url);
      setMediaOpen(false);
      return;
    }
    const sectionMedia = sectionMediaRef.current;
    if (sectionMedia) {
      sectionMediaRef.current = null;
      sectionMedia(url);
      setMediaOpen(false);
      return;
    }
    const alt = item.name.replace(/\.[^.]+$/, '').slice(0, 80);
    const current = specRef.current;
    const blockId = selectedId;
    const block = blockId ? current.blocks.find((b) => b.id === blockId) : null;

    // Section background replace (CSS background-image) — does not touch content images.
    if (block && selectedElement === 'section-background') {
      const prevStyle = (block.style || {}) as Record<string, unknown>;
      updateBlock(block.id, {
        style: {
          ...prevStyle,
          backgroundImage: `url(${url})`,
          backgroundSize: (prevStyle.backgroundSize as string) || 'cover',
          backgroundPosition: (prevStyle.backgroundPosition as string) || 'center',
          backgroundRepeat: 'no-repeat',
        },
      } as Partial<LandingPageBlock>);
      setMediaOpen(false);
      setSaveMsg('Đã thay ảnh nền section');
      return;
    }

    const itemMatch =
      selectedElement && selectedElement.startsWith('item:')
        ? selectedElement.slice(5)
        : null;

    if (block && 'imageUrl' in block && !itemMatch) {
      // Prefer frame/grid path when shape-only CTA is selected
      if (
        block.type === 'CTA' &&
        isLandingPageBoxStyle(block.style as Record<string, unknown> | undefined)
      ) {
        applyBlockImage(block.id, url, {
          gridIndex:
            selectedElement && selectedElement.startsWith('grid:')
              ? Number(selectedElement.slice(5))
              : undefined,
          alt,
        });
        setMediaOpen(false);
        return;
      }
      updateBlock(block.id, {
        imageUrl: url,
        imageStyle: { ...(block.imageStyle || {}), alt },
      });
      selectCanvas({ blockId: block.id, element: 'image' });
      setMediaOpen(false);
      setSaveMsg('Đã chèn ảnh vào block');
      return;
    }

    // Shape / frame CTA (imageUrl may be omitted on older inserts)
    if (
      block &&
      block.type === 'CTA' &&
      isLandingPageBoxStyle(block.style as Record<string, unknown> | undefined) &&
      !itemMatch
    ) {
      applyBlockImage(block.id, url, {
        gridIndex:
          selectedElement && selectedElement.startsWith('grid:')
            ? Number(selectedElement.slice(5))
            : undefined,
        alt,
      });
      setMediaOpen(false);
      return;
    }

    if (
      block &&
      'items' in block &&
      Array.isArray(block.items) &&
      block.items.length &&
      (block.type === 'Gallery' ||
        block.type === 'Product' ||
        block.type === 'Benefits' ||
        block.type === 'Features' ||
        block.type === 'Process' ||
        block.type === 'Speaker')
    ) {
      const targetId =
        itemMatch && block.items.some((it) => it.id === itemMatch)
          ? itemMatch
          : block.items[0]?.id;
      if (targetId) {
        const items = (block.items as Array<Record<string, unknown> & { id: string }>).map((it) => {
          if (it.id !== targetId) return it;
          const prevStyle =
            it.imageStyle && typeof it.imageStyle === 'object'
              ? (it.imageStyle as Record<string, unknown>)
              : {};
          return {
            ...it,
            imageUrl: url,
            imageStyle: { ...prevStyle, alt },
          };
        });
        updateBlock(block.id, { items } as Partial<LandingPageBlock>);
        selectCanvas({ blockId: block.id, element: `item:${targetId}` });
        setMediaOpen(false);
        setSaveMsg('Đã chèn ảnh vào mục đang chọn');
        return;
      }
    }

    // No suitable selection — add Gallery with this image.
    const gallery = defaultBlock('Gallery') as LandingPageBlock & {
      items: Array<Record<string, unknown>>;
    };
    if (Array.isArray(gallery.items) && gallery.items[0]) {
      gallery.items = [
        {
          ...gallery.items[0],
          imageUrl: url,
          imageStyle: { alt },
          title: alt || 'Hình ảnh',
        },
      ];
    }
    const blocks = [...current.blocks];
    let insertAt = blocks.length;
    if (selectedId) {
      const idx = blocks.findIndex((b) => b.id === selectedId);
      if (idx >= 0) insertAt = idx + 1;
    }
    blocks.splice(insertAt, 0, gallery);
    pushHistory(sanitizeLandingPageDraftSpec({ ...current, blocks }));
    selectCanvas({ blockId: gallery.id, element: 'section' });
    setMediaOpen(false);
    setSaveMsg('Đã thêm Gallery với ảnh đã chọn');
  }

  function removeBlock(id: string) {
    removeBlocks([id]);
  }

  /**
   * Grow OR shrink section shell so painted content (incl. transform/absolute
   * children) matches the selection chrome — never leave an empty tall frame
   * covering the next section, and never leave content overflowing outside.
   */
  function fitSectionToContent(
    blockId: string,
    viewport: Viewport,
    opts?: { live?: boolean; padding?: number },
  ) {
    const shell = document.querySelector(
      `[data-lp-block-id="${CSS.escape(blockId)}"][data-lp-section-chrome="1"]`,
    ) as HTMLElement | null;
    if (!shell) return;
    const pad = opts?.padding ?? SECTION_CONTENT_FIT_PADDING;
    const scale = readCanvasPointerScale(shell);
    const needed = Math.min(
      2400,
      Math.max(72, measureSectionContentHeightCss(shell, scale) + pad),
    );
    const current = specRef.current;
    const block = current.blocks.find((b) => b.id === blockId);
    if (!block) return;
    const free = resolveFreeLayoutForViewport(
      block.positionMode,
      block.freeLayout,
      block.responsiveFreeLayout,
      viewport,
    );

    if (opts?.live) {
      if (free) {
        shell.style.height = `${needed}px`;
        shell.style.minHeight = `${needed}px`;
      } else {
        shell.style.minHeight = `${needed}px`;
      }
      return;
    }

    if (free) {
      const cur = Math.round(free.height ?? free.reserveHeight ?? 0);
      // Height unchanged: still pack siblings — expand-in-place can leave overlap
      // that a later no-op fit would otherwise skip forever.
      if (Math.abs(needed - cur) <= 2) {
        const packed = packFreeSectionsVertical(current.blocks, viewport);
        if (packed !== current.blocks) {
          pushHistory(
            markLandingPageUserEdits({ ...current, blocks: packed }, [
              `${blockId}.freeLayout.pack`,
            ]),
          );
        }
        return;
      }
      const nextLayout = clampAbsoluteFreeLayout({
        ...free,
        height: needed,
        reserveHeight: needed,
      });
      const nextBlocks = reflowFreeSectionsAfterChange(
        current.blocks,
        blockId,
        free,
        nextLayout,
        viewport,
      );
      pushHistory(
        markLandingPageUserEdits({ ...current, blocks: nextBlocks }, [
          `${blockId}.freeLayout.height`,
        ]),
      );
      return;
    }

    const style = { ...((block.style || {}) as Record<string, unknown>) };
    const curMin = Number.parseFloat(String(style.minHeight || '0')) || 0;
    // Allow shrink when a prior bad free-surface snap inflated minHeight (mega-section).
    if (needed <= curMin + 1 && needed >= curMin - 1) return;
    const nextMin = needed;
    // Live DOM heal so overlapping drop targets clear before the next paint.
    shell.style.minHeight = `${nextMin}px`;
    if (Math.abs(nextMin - curMin) <= 1) return;
    pushHistory(
      markLandingPageUserEdits(
        {
          ...current,
          blocks: current.blocks.map((b) =>
            b.id === blockId
              ? ({ ...b, style: { ...style, minHeight: `${nextMin}px` } } as LandingPageBlock)
              : b,
          ),
        },
        [`${blockId}.style.minHeight`],
      ),
    );
  }

  /**
   * Seed freeLayout from the section's CURRENT painted box in canvas-root space.
   * freeLayoutStyle uses position:absolute against [data-lp-canvas-root] — measuring
   * against resolveFreeSurface(section)≈section itself produced ~0,0 (or stale prev
   * x/y) and jumped the chrome onto other sections. Always remeasure; ignore prev x/y.
   */
  function measureFreeToggleLayout(
    blockId: string,
    prev: LandingPageFreeLayout | undefined,
  ): { x: number; y: number; width: number | undefined; height: number } {
    const shell = document.querySelector(
      `[data-lp-block-id="${CSS.escape(blockId)}"][data-lp-section-chrome="1"]`,
    ) as HTMLElement | null;
    const root =
      (shell?.closest('[data-lp-canvas-root]') as HTMLElement | null) ||
      (typeof document !== 'undefined'
        ? (document.querySelector('[data-lp-canvas-root]') as HTMLElement | null)
        : null);

    let x = 24;
    let y = 24;
    let width = prev?.width;
    let height = Math.max(120, prev?.height || prev?.reserveHeight || 280);

    if (shell && root) {
      const scale = readCanvasPointerScale(shell);
      const s = scale > 0.05 && Number.isFinite(scale) ? scale : 1;
      const content = measureVisibleContentRect(shell);
      const origin = root.getBoundingClientRect();
      // Canvas-local (same space as freeLayoutStyle left/top).
      x = Math.max(0, Math.round((content.left - origin.left) / s));
      y = Math.max(0, Math.round((content.top - origin.top) / s));
      if (width == null && content.width > 0) {
        width = Math.round(content.width);
      }
      const cssH = measureSectionContentHeightCss(shell, s) + SECTION_CONTENT_FIT_PADDING;
      const visualH = Math.round(content.height) + SECTION_CONTENT_FIT_PADDING;
      // Hug content — do not keep a stale inflated prev height.
      height = Math.min(2400, Math.max(72, visualH, Math.min(cssH, 2400)));
    }

    return { x, y, width, height };
  }

  /**
   * After paint: reseat free section chrome so left/top/height match painted content.
   * Fixes legacy saves where frame floated over the next section (wrong origin / tall height).
   */
  function healFreeSectionFramesToContent() {
    const current = specRef.current;
    const root = document.querySelector('[data-lp-canvas-root]') as HTMLElement | null;
    if (!root) return;
    const scale = readCanvasPointerScale(root);
    const s = scale > 0.05 && Number.isFinite(scale) ? scale : 1;
    const origin = root.getBoundingClientRect();
    let changed = false;
    const nextBlocks = current.blocks.map((b) => {
      if (b.positionMode !== 'free' || !b.freeLayout) return b;
      const shell = document.querySelector(
        `[data-lp-block-id="${CSS.escape(b.id)}"][data-lp-section-chrome="1"]`,
      ) as HTMLElement | null;
      if (!shell) return b;
      const content = measureVisibleContentRect(shell);
      const nextX = Math.max(0, Math.round((content.left - origin.left) / s));
      const nextY = Math.max(0, Math.round((content.top - origin.top) / s));
      // Height from real painted nodes only (measureVisibleContentRect) — never
      // trust the stretched free-layout wrapper height.
      const nextH = Math.min(
        2400,
        Math.max(48, Math.round(content.height) + SECTION_CONTENT_FIT_PADDING),
      );
      const prev = b.freeLayout;
      const dx = Math.abs((prev.x || 0) - nextX);
      const dy = Math.abs((prev.y || 0) - nextY);
      const dh = Math.abs((prev.height || prev.reserveHeight || 0) - nextH);
      // Reseat when chrome drifts from content, or height is inflated empty space.
      if (dx < 12 && dy < 12 && dh < 24) return b;
      changed = true;
      return {
        ...b,
        freeLayout: clampAbsoluteFreeLayout({
          ...prev,
          x: nextX,
          y: nextY,
          height: nextH,
          reserveHeight: nextH,
          ...(prev.width != null
            ? { width: prev.width }
            : content.width > 0
              ? { width: Math.round(content.width) }
              : {}),
        }),
      } as LandingPageBlock;
    });
    if (!changed) return;
    // Silent adopt — no history entry (load/heal, not a user edit).
    const next = { ...current, blocks: nextBlocks };
    specRef.current = next;
    setSpec(next);
    dirtyRef.current = true;
  }

  /** Toolbar «Tự do» — toggle free position (drag uses body when on). */
  function toggleBlockFreePosition(blockId: string) {
    if (!guardSectionUnlocked(blockId, 'Section đang khóa — mở khóa trước khi đổi vị trí')) return;
    const current = specRef.current;
    const block = current.blocks.find((b) => b.id === blockId);
    if (!block) return;
    if (block.positionMode === 'free') {
      updateBlock(blockId, { positionMode: 'flow' } as Partial<LandingPageBlock>);
      return;
    }
    const prev = block.freeLayout;
    const { x, y, width, height } = measureFreeToggleLayout(blockId, prev);
    const freeLayout = clampAbsoluteFreeLayout({
      x,
      y,
      ...(width ? { width } : {}),
      height,
      reserveHeight: height,
      ...(prev?.rotate != null ? { rotate: prev.rotate } : {}),
    });
    // Keep the measured seat — do NOT run vertical pack (that rewrote y and
    // dropped free chrome onto neighbouring flow sections).
    const nextBlocks = current.blocks.map((b) =>
      b.id === blockId
        ? ({ ...b, positionMode: 'free' as const, freeLayout } as LandingPageBlock)
        : b,
    );
    pushHistory(
      markLandingPageUserEdits({ ...current, blocks: nextBlocks }, [
        `${blockId}.positionMode`,
        `${blockId}.freeLayout`,
      ]),
    );
    requestAnimationFrame(() => fitSectionToContent(blockId, viewport));
  }

  /** Delete one or more sections in a single history entry (keyboard / multi-select). */
  function removeBlocks(ids: string[]) {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return;
    const current = specRef.current;
    const lockedIds = new Set(
      current.blocks.filter((b) => (b as { locked?: boolean }).locked === true).map((b) => b.id),
    );
    const toRemove = unique.filter((id) => !lockedIds.has(id));
    if (!toRemove.length) {
      setSaveMsg('Section đang khóa — mở khóa trước khi xóa');
      return;
    }
    const removeSet = new Set(toRemove);
    pushHistory(
      sanitizeLandingPageDraftSpec({
        ...current,
        blocks: current.blocks.filter((b) => !removeSet.has(b.id)),
      }),
    );
    if (
      (selectedIdRef.current && removeSet.has(selectedIdRef.current)) ||
      canvasSelectionRef.current.ids.some((key) => {
        const parsed = parseLpSelectionKey(key);
        return parsed?.blockId ? removeSet.has(parsed.blockId) : false;
      })
    ) {
      deselectCanvas();
    }
    if (toRemove.length < unique.length) {
      setSaveMsg('Đã xóa (bỏ qua section đang khóa)');
    }
  }

  function dupBlock(id: string, preferElement?: LandingPageCanvasElementKey) {
    const block = specRef.current.blocks.find((b) => b.id === id);
    if (!block) return;
    const copy = duplicateBlock(block);
    const idx = specRef.current.blocks.findIndex((b) => b.id === id);
    const blocks = [...specRef.current.blocks];
    blocks.splice(idx + 1, 0, copy);

    // Copy per-field inline text styles / hide / lock keys for the duplicated block.
    const meta = { ...(specRef.current.meta || {}) } as {
      inlineTextStyles?: Record<string, LandingPageInlineTextStyle>;
      elementHidden?: Record<string, boolean>;
      elementLocked?: Record<string, boolean>;
      responsiveInlineTextStyles?: Record<
        string,
        Partial<Record<Viewport, LandingPageInlineTextStyle>>
      >;
      [k: string]: unknown;
    };
    const remapKeyed = <T,>(map?: Record<string, T>) => {
      if (!map) return map;
      const next = { ...map };
      const prefix = `${id}::`;
      for (const [key, val] of Object.entries(map)) {
        if (!key.startsWith(prefix)) continue;
        next[`${copy.id}::${key.slice(prefix.length)}`] = val;
      }
      return next;
    };
    meta.inlineTextStyles = remapKeyed(meta.inlineTextStyles);
    meta.elementHidden = remapKeyed(meta.elementHidden);
    meta.elementLocked = remapKeyed(meta.elementLocked);
    meta.responsiveInlineTextStyles = remapKeyed(meta.responsiveInlineTextStyles);

    pushHistory(
      sanitizeLandingPageDraftSpec({
        ...specRef.current,
        blocks,
        meta,
      }),
    );
    selectCanvas({ blockId: copy.id, element: preferElement || 'section' });
    setSaveMsg('Đã nhân bản');
  }

  function dupItem(blockId: string, itemId: string) {
    const block = specRef.current.blocks.find((b) => b.id === blockId) as
      | (LandingPageBlock & {
          items?: Array<Record<string, unknown> & { id: string }>;
          plans?: Array<Record<string, unknown> & { id: string }>;
        })
      | undefined;
    if (!block) return;
    if (Array.isArray(block.items)) {
      const idx = block.items.findIndex((it) => it.id === itemId);
      if (idx < 0) return;
      const copy = duplicateLandingPageNestedItem(block.items[idx]!);
      const items = [...block.items];
      items.splice(idx + 1, 0, copy);
      const next = {
        ...specRef.current,
        blocks: specRef.current.blocks.map((b) =>
          b.id === blockId ? ({ ...b, items } as LandingPageBlock) : b,
        ),
      };
      pushHistory(sanitizeLandingPageDraftSpec(markLandingPageUserEdits(next, [`${blockId}.items`])));
      selectCanvas({ blockId: blockId, element: `item:${copy.id}` });
      return;
    }
    if (Array.isArray(block.plans)) {
      const idx = block.plans.findIndex((it) => it.id === itemId);
      if (idx < 0) return;
      const copy = duplicateLandingPageNestedItem(block.plans[idx]!);
      const plans = [...block.plans];
      plans.splice(idx + 1, 0, copy);
      const next = {
        ...specRef.current,
        blocks: specRef.current.blocks.map((b) =>
          b.id === blockId ? ({ ...b, plans } as LandingPageBlock) : b,
        ),
      };
      pushHistory(sanitizeLandingPageDraftSpec(markLandingPageUserEdits(next, [`${blockId}.plans`])));
      selectCanvas({ blockId: blockId, element: `item:${copy.id}` });
    }
  }

  function moveBlock(id: string, direction: 'up' | 'down') {
    if (!guardSectionUnlocked(id, 'Section đang khóa — mở khóa trước khi di chuyển')) return;
    const from = spec.blocks.findIndex((b) => b.id === id);
    if (from < 0) return;
    const to = direction === 'up' ? from - 1 : from + 1;
    if (to < 0 || to >= spec.blocks.length) return;
    pushHistory(
      sanitizeLandingPageDraftSpec({
        ...spec,
        blocks: reorderBlocks(spec.blocks, from, to),
      }),
    );
  }

  function reorderBlockById(fromBlockId: string, toBlockId: string) {
    if (!guardSectionUnlocked(fromBlockId, 'Section đang khóa — mở khóa trước khi di chuyển')) {
      return;
    }
    const from = spec.blocks.findIndex((b) => b.id === fromBlockId);
    const to = spec.blocks.findIndex((b) => b.id === toBlockId);
    if (from < 0 || to < 0 || from === to) return;
    pushHistory(
      sanitizeLandingPageDraftSpec({
        ...spec,
        blocks: reorderBlocks(spec.blocks, from, to),
      }),
    );
  }

  function reorderListItem(blockId: string, fromItemId: string, toItemId: string) {
    if (!guardSectionUnlocked(blockId)) return;
    const current = specRef.current;
    const block = current.blocks.find((b) => b.id === blockId) as
      | (LandingPageBlock & {
          items?: Array<{ id: string } & Record<string, unknown>>;
          plans?: Array<{ id: string } & Record<string, unknown>>;
        })
      | undefined;
    if (!block) return;
    const listKey = Array.isArray(block.items) ? 'items' : Array.isArray(block.plans) ? 'plans' : null;
    if (!listKey) return;
    const items = [...(block[listKey] as Array<{ id: string } & Record<string, unknown>>)];
    const fromIndex = items.findIndex((row) => row.id === fromItemId);
    const toIndex = items.findIndex((row) => row.id === toItemId);
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex === toIndex ||
      fromItemId === toItemId
    ) {
      return;
    }
    const [row] = items.splice(fromIndex, 1);
    if (!row || row.id !== fromItemId) return;
    const insertAt = items.findIndex((r) => r.id === toItemId);
    if (insertAt < 0) return;
    items.splice(insertAt, 0, row);
    pushHistory(
      markLandingPageUserEdits(
        {
          ...current,
          blocks: current.blocks.map((b) =>
            b.id === blockId ? ({ ...b, [listKey]: items } as LandingPageBlock) : b,
          ),
        },
        [`${blockId}.${listKey}`],
      ),
    );
  }

  function deselectCanvas() {
    try {
      window.getSelection()?.removeAllRanges();
    } catch {
      /* ignore */
    }
    setCanvasSelection({ ids: [], primaryId: null });
  }

  function applyNestedBlockField(
    current: LandingPageSpec,
    blockId: string,
    field: string,
    value: string,
  ): LandingPageSpec {
    return {
      ...current,
      blocks: current.blocks.map((b) => {
        if (b.id !== blockId) return b;
        if (
          field === 'headline' ||
          field === 'subheadline' ||
          field === 'body' ||
          field === 'ctaLabel'
        ) {
          return { ...b, [field]: value } as LandingPageBlock;
        }
        const trustM = /^trustPoint:(\d+)$/.exec(field);
        if (trustM) {
          const idx = Number(trustM[1]);
          const fallback = ['Tư vấn rõ ràng', 'Phản hồi nhanh', 'Cam kết minh bạch'];
          const existing =
            'trustPoints' in b && Array.isArray((b as { trustPoints?: string[] }).trustPoints)
              ? (b as { trustPoints: string[] }).trustPoints
              : null;
          const prev =
            existing && existing.length > 0 ? [...existing] : [...fallback];
          while (prev.length <= idx) prev.push(fallback[prev.length] || '');
          prev[idx] = value;
          return { ...b, trustPoints: prev } as LandingPageBlock;
        }
        const itemM = /^(itemTitle|itemDesc|itemQuestion|itemAnswer|itemQuote|itemAuthor):(.+)$/.exec(
          field,
        );
        if (itemM && 'items' in b && Array.isArray((b as { items?: unknown[] }).items)) {
          const kind = itemM[1];
          const itemId = itemM[2];
          const key =
            kind === 'itemTitle'
              ? 'title'
              : kind === 'itemDesc'
                ? 'description'
                : kind === 'itemQuestion'
                  ? 'question'
                  : kind === 'itemAnswer'
                    ? 'answer'
                    : kind === 'itemQuote'
                      ? 'quote'
                      : 'author';
          const items = (b as { items: Array<Record<string, unknown>> }).items.map((row) =>
            row.id === itemId ? { ...row, [key]: value } : row,
          );
          return { ...b, items } as LandingPageBlock;
        }
        const planM = /^(planName|planPrice|planCta):(.+)$/.exec(field);
        if (planM && 'plans' in b && Array.isArray((b as { plans?: unknown[] }).plans)) {
          const kind = planM[1];
          const planId = planM[2];
          const key = kind === 'planName' ? 'name' : kind === 'planPrice' ? 'price' : 'ctaLabel';
          const plans = (b as { plans: Array<Record<string, unknown>> }).plans.map((row) =>
            row.id === planId ? { ...row, [key]: value } : row,
          );
          return { ...b, plans } as LandingPageBlock;
        }
        const fieldM = /^fieldLabel:(.+)$/.exec(field);
        if (fieldM && 'fields' in b && Array.isArray((b as { fields?: unknown[] }).fields)) {
          const fid = fieldM[1];
          const fields = (b as { fields: Array<Record<string, unknown>> }).fields.map((row) =>
            row.id === fid ? { ...row, label: value } : row,
          );
          return { ...b, fields } as LandingPageBlock;
        }
        const optM = /^fieldOption:(.+):(\d+)$/.exec(field);
        if (optM && 'fields' in b && Array.isArray((b as { fields?: unknown[] }).fields)) {
          const fid = optM[1];
          const idx = Number(optM[2]);
          const fields = (b as { fields: Array<Record<string, unknown>> }).fields.map((row) => {
            if (row.id !== fid) return row;
            const options = Array.isArray(row.options) ? [...(row.options as string[])] : [];
            if (idx >= 0 && idx < options.length) options[idx] = value;
            return { ...row, options };
          });
          return { ...b, fields } as LandingPageBlock;
        }
        return { ...b, [field]: value } as LandingPageBlock;
      }),
    };
  }

  function updateBlockFieldLive(id: string, field: string, value: string) {
    if (!guardSectionUnlocked(id)) return;
    const current = specRef.current;
    if (!inlineHistStarted.current) {
      historyRef.current.push(cloneSpec(current));
      if (historyRef.current.length > 50) historyRef.current.shift();
      futureRef.current = [];
      inlineHistStarted.current = true;
    }
    const next = applyNestedBlockField(current, id, field, value);
    const marked = markLandingPageUserEdits(next, [`${id}.${field}`]);
    revisionRef.current += 1;
    specRef.current = marked;
    startTransition(() => setSpec(marked));
    dirtyRef.current = true;
  }

  function updateBlockFieldCommit(id: string, field: string, value: string) {
    if (!guardSectionUnlocked(id)) return;
    // History snapshot already taken at first live keystroke (if any).
    inlineHistStarted.current = false;
    const current = specRef.current;
    const next = applyNestedBlockField(current, id, field, value);
    const marked = markLandingPageUserEdits(next, [`${id}.${field}`]);
    revisionRef.current += 1;
    specRef.current = marked;
    startTransition(() => setSpec(marked));
    dirtyRef.current = true;
  }

  function elementStyleKey(blockId: string, field: string) {
    return `${blockId}::${field}`;
  }

  function patchInlineTextStyle(
    blockId: string,
    field: string,
    patch: Partial<LandingPageInlineTextStyle>,
  ) {
    if (!guardSectionUnlocked(blockId)) return;
    const key = elementStyleKey(blockId, field);
    const current = specRef.current;
    const meta = (current.meta && typeof current.meta === 'object' ? current.meta : {}) as {
      inlineTextStyles?: Record<string, LandingPageInlineTextStyle>;
      responsiveInlineTextStyles?: Record<
        string,
        Partial<Record<Viewport, LandingPageInlineTextStyle>>
      >;
    };
    const prevMap = meta.inlineTextStyles || {};
    const prev = { ...(prevMap[key] || {}) };
    const merged = { ...prev, ...patch } as LandingPageInlineTextStyle & Record<string, unknown>;
    // Solid color from toolbar must remove gradient text-fill leftovers.
    if (typeof patch.color === 'string' && patch.color) {
      delete merged.backgroundImage;
      delete merged.backgroundClip;
      delete merged.webkitTextFillColor;
    }
    for (const k of Object.keys(patch)) {
      if ((patch as Record<string, unknown>)[k] === undefined) delete merged[k];
    }
    if ('box' in patch) {
      const normalizedBox = normalizeItemBoxChrome(merged.box);
      if (normalizedBox) merged.box = normalizedBox;
      else delete merged.box;
    }
    const prevRespMap = meta.responsiveInlineTextStyles || {};
    const prevViewport = prevRespMap[key] || {};
    pushHistory(
      markLandingPageUserEdits(
        {
          ...current,
          meta: {
            ...(current.meta || {}),
            inlineTextStyles: {
              ...prevMap,
              [key]: merged,
            },
            responsiveInlineTextStyles: {
              ...prevRespMap,
              [key]: {
                ...prevViewport,
                [viewport]: merged,
              },
            },
          },
        },
        [`${key}.style`],
      ),
    );
  }

  function toggleElementHidden(blockId: string, field: string) {
    const key = elementStyleKey(blockId, field);
    const current = specRef.current;
    const prev =
      (current.meta as { elementHidden?: Record<string, boolean> } | undefined)?.elementHidden ||
      {};
    const nextHidden = !prev[key];
    const nextMap = { ...prev };
    if (nextHidden) nextMap[key] = true;
    else delete nextMap[key];
    pushHistory(
      markLandingPageUserEdits(
        {
          ...current,
          meta: {
            ...(current.meta || {}),
            elementHidden: nextMap,
          },
        },
        [`${key}.hidden`],
      ),
    );
    setSaveMsg(nextHidden ? 'Đã ẩn phần tử' : 'Đã hiện phần tử');
  }

  /**
   * Keyboard Delete on a nested canvas element (trust icon, text, box chrome…).
   * Never escalates to deleting the parent Hero/section.
   */
  function hideCanvasElements(targets: LpSelectionTarget[]) {
    if (!targets.length) return;
    const current = specRef.current;
    const prev =
      (current.meta as { elementHidden?: Record<string, boolean> } | undefined)?.elementHidden ||
      {};
    const nextMap = { ...prev };
    const editKeys: string[] = [];
    for (const t of targets) {
      if (!guardSectionUnlocked(t.blockId, 'Section đang khóa — mở khóa trước khi xóa phần tử')) {
        continue;
      }
      const fieldOrEl = t.field || t.element;
      if (!fieldOrEl || isSectionLevelElement(t.element)) continue;
      const key = elementStyleKey(t.blockId, fieldOrEl);
      nextMap[key] = true;
      editKeys.push(`${key}.hidden`);
    }
    if (!editKeys.length) return;
    pushHistory(
      markLandingPageUserEdits(
        {
          ...current,
          meta: {
            ...(current.meta || {}),
            elementHidden: nextMap,
          },
        },
        editKeys,
      ),
    );
    setSaveMsg(editKeys.length === 1 ? 'Đã xóa phần tử' : `Đã xóa ${editKeys.length} phần tử`);
  }

  function toggleElementLock(blockId: string, field: string) {
    const key = elementStyleKey(blockId, field);
    const current = specRef.current;
    const prev =
      (current.meta as { elementLocked?: Record<string, boolean> } | undefined)?.elementLocked ||
      {};
    const nextLocked = !prev[key];
    const nextMap = { ...prev };
    if (nextLocked) nextMap[key] = true;
    else delete nextMap[key];
    pushHistory(
      markLandingPageUserEdits(
        {
          ...current,
          meta: {
            ...(current.meta || {}),
            elementLocked: nextMap,
          },
        },
        [`${key}.locked`],
      ),
    );
    setSaveMsg(nextLocked ? 'Đã khóa phần tử' : 'Đã mở khóa phần tử');
  }

  const LP_SAVED_BLOCKS_LS = 'mkspa.lpSavedBlocks.v1';

  function saveTargetToSavedLibrary(target: LpSelectionTarget) {
    const blockId = target.blockId;
    const block = specRef.current.blocks.find((b) => b.id === blockId);
    if (!block) return;
    if (isSectionLevelElement(target.element) || target.element === 'form') {
      try {
        const clone = cloneSpec({ blocks: [block] } as LandingPageSpec).blocks[0];
        const raw = localStorage.getItem(LP_SAVED_BLOCKS_LS);
        const list = raw ? (JSON.parse(raw) as unknown[]) : [];
        const rec = block as Record<string, unknown>;
        const label =
          (typeof rec.headline === 'string' && rec.headline.trim()) ||
          (typeof rec.ctaLabel === 'string' && rec.ctaLabel.trim()) ||
          block.type ||
          'Section';
        const next = [
          {
            id: `sb-${Date.now()}`,
            label: String(label).slice(0, 64),
            block: clone,
            savedAt: new Date().toISOString(),
          },
          ...(Array.isArray(list) ? list : []),
        ].slice(0, 40);
        localStorage.setItem(LP_SAVED_BLOCKS_LS, JSON.stringify(next));
        setSaveMsg('Đã lưu vào Khối đã lưu');
      } catch {
        setSaveMsg('Lưu khối thất bại');
      }
      return;
    }
    const field =
      target.field ||
      (target.element === 'cta' ? 'ctaLabel' : target.element === 'headline' ? 'headline' : null);
    if (field) {
      saveTextAsset(blockId, field);
      return;
    }
    setSaveMsg('Chọn phần tử có nội dung để lưu');
  }

  function duplicateToolbarTarget(target: LpSelectionTarget) {
    const norm = normalizeLpSelectionTarget(target);
    if (isSectionLevelElement(norm.element) || norm.element === 'form') {
      dupBlock(norm.blockId);
      return;
    }
    if (typeof norm.element === 'string' && norm.element.startsWith('item:')) {
      dupItem(norm.blockId, norm.element.slice(5));
      return;
    }
    const block = specRef.current.blocks.find((b) => b.id === norm.blockId);
    if (block && isFloatingTextLayerBlock(block)) {
      dupBlock(norm.blockId, norm.element);
      return;
    }
    if (block?.type === 'CTA') {
      const b = block as LandingPageBlock & {
        headline?: string;
        subheadline?: string;
        body?: string;
      };
      const buttonOnly =
        !(b.headline || '').trim() &&
        !(b.subheadline || '').trim() &&
        !(b.body || '').trim();
      if (buttonOnly) {
        dupBlock(norm.blockId, 'cta');
        return;
      }
    }
    dupBlock(norm.blockId, norm.element);
  }

  function deleteToolbarTarget(target: LpSelectionTarget) {
    const norm = normalizeLpSelectionTarget(target);
    if (isSectionLevelElement(norm.element)) {
      removeBlock(norm.blockId);
      return;
    }
    hideCanvasElements([norm]);
  }

  function saveTextAsset(blockId: string, field: string) {
    const key = elementStyleKey(blockId, field);
    const map =
      (specRef.current.meta as { inlineTextStyles?: Record<string, LandingPageInlineTextStyle> } | undefined)
        ?.inlineTextStyles || {};
    const style = map[key];
    const block = specRef.current.blocks.find((b) => b.id === blockId);
    if (!block || !style) {
      setSaveMsg('Không có thiết kế để lưu');
      return;
    }
    const rec = block as unknown as Record<string, unknown>;
    const text = typeof rec[field] === 'string' ? String(rec[field]) : field;
    const LS_KEY = 'mkspa.lpSavedTextAssets.v1';
    try {
      const raw = localStorage.getItem(LS_KEY);
      const list = raw ? (JSON.parse(raw) as unknown[]) : [];
      const next = [
        {
          id: `${key}-${Date.now()}`,
          key,
          label: text.slice(0, 48) || field,
          style,
          savedAt: new Date().toISOString(),
        },
        ...(Array.isArray(list) ? list : []),
      ].slice(0, 50);
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      setSaveMsg('Đã lưu Assets');
    } catch {
      setSaveMsg('Lưu Assets thất bại');
    }
  }

  function syncDesignFromMobile(blockId: string, field: string) {
    const key = elementStyleKey(blockId, field);
    const mobile =
      (
        specRef.current.meta as
          | {
              responsiveInlineTextStyles?: Record<
                string,
                Partial<Record<Viewport, LandingPageInlineTextStyle>>
              >;
            }
          | undefined
      )?.responsiveInlineTextStyles?.[key]?.mobile;
    if (!mobile || !Object.keys(mobile).length) {
      setSaveMsg('Không có thiết kế Mobile cho phần tử này');
      return;
    }
    patchInlineTextStyle(blockId, field, mobile);
    setSaveMsg('Đã đồng bộ từ Mobile');
  }

  function openTextAiPrompt(blockId: string, field: string, anchorRect: DOMRect) {
    const block = specRef.current.blocks.find((b) => b.id === blockId);
    if (!block) return;
    const element = elementKeyForField(field);
    const ctx = resolveInspectorContext(block, element);
    const { field: resolvedField, fieldKind } = resolveFieldForContext(block, element, ctx.kind);
    const useField = field || resolvedField;
    const rec = block as unknown as Record<string, unknown>;
    const current = typeof rec[useField] === 'string' ? String(rec[useField]) : '';
    setTextAiPopover({
      x: Math.min(anchorRect.right + 8, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 320),
      y: anchorRect.top,
      blockId,
      field: useField,
      fieldKind,
      blockType: block.type,
      mode: ctx.kind === 'button' ? 'cta' : 'quick',
      current,
    });
  }

  function focusInspectorAi(blockId: string) {
    selectCanvas({ blockId: blockId, element: 'section' });
    requestAnimationFrame(() => {
      const safeId = blockId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const root = inspectorPanelRef.current?.querySelector(`[data-inspector-block-id="${safeId}"]`);
      const btn = root?.querySelector('[data-lp-inline-ai-trigger]') as HTMLButtonElement | null;
      btn?.click();
    });
  }

  function copyBlockToClipboard(blockId: string) {
    const block = specRef.current.blocks.find((b) => b.id === blockId);
    if (!block) return;
    blockClipboardRef.current = cloneSpec({ blocks: [block] } as LandingPageSpec).blocks[0] || null;
    setClipboardTick((n) => n + 1);
    setSaveMsg('Đã sao chép block');
  }

  function pasteBlockFromClipboard() {
    const clip = blockClipboardRef.current;
    if (!clip) return;
    const copy = duplicateBlock(clip);
    const blocks = [...specRef.current.blocks];
    const idx = selectedId ? blocks.findIndex((b) => b.id === selectedId) : -1;
    const insertAt = idx >= 0 ? idx + 1 : blocks.length;
    blocks.splice(insertAt, 0, copy);
    pushHistory(sanitizeLandingPageDraftSpec({ ...specRef.current, blocks }));
    selectCanvas({ blockId: copy.id, element: 'section' });
    setSaveMsg('Đã dán block');
  }

  function copyStyleToClipboard(blockId: string) {
    const block = specRef.current.blocks.find((b) => b.id === blockId);
    if (!block) return;
    const field = inspectorTextFieldKey(selectedElement, primaryTarget?.field);
    const map =
      (specRef.current.meta as { inlineTextStyles?: Record<string, LandingPageInlineTextStyle> } | undefined)
        ?.inlineTextStyles || {};
    const textStyle = field ? map[`${blockId}::${field}`] : undefined;
    styleClipboardRef.current = {
      style: { ...((block.style || {}) as Record<string, unknown>) },
      background: block.background ?? null,
      imageStyle: {
        ...(((block as { imageStyle?: Record<string, unknown> }).imageStyle ||
          {}) as Record<string, unknown>),
      },
      inlineTextStyle: textStyle ? { ...textStyle } : undefined,
    };
    setClipboardTick((n) => n + 1);
    setSaveMsg('Đã sao chép kiểu');
  }

  function pasteStyleFromClipboard(blockId: string) {
    const clip = styleClipboardRef.current;
    if (!clip) return;
    const patch: Partial<LandingPageBlock> = {};
    if (clip.style) patch.style = { ...clip.style } as LandingPageBlock['style'];
    if (clip.background !== undefined) patch.background = clip.background;
    if (clip.imageStyle && Object.keys(clip.imageStyle).length) {
      (patch as { imageStyle?: Record<string, unknown> }).imageStyle = { ...clip.imageStyle };
    }
    updateBlock(blockId, patch);
    const field = inspectorTextFieldKey(selectedElement, primaryTarget?.field);
    if (field && clip.inlineTextStyle) {
      patchInlineTextStyle(blockId, field, clip.inlineTextStyle);
    }
    setSaveMsg('Đã dán kiểu');
  }

  function toggleBlockLock(blockId: string) {
    const block = specRef.current.blocks.find((b) => b.id === blockId);
    if (!block) return;
    updateBlock(blockId, { locked: !block.locked } as Partial<LandingPageBlock>);
    setSaveMsg(block.locked ? 'Đã mở khóa' : 'Đã khóa section');
  }

  function toggleBlockGroup(blockId: string) {
    if (!guardSectionUnlocked(blockId)) return;
    const block = specRef.current.blocks.find((b) => b.id === blockId);
    if (!block) return;
    const style = { ...((block.style || {}) as Record<string, unknown>) };
    if (style.lpGrouped) delete style.lpGrouped;
    else style.lpGrouped = true;
    updateBlock(blockId, { style } as Partial<LandingPageBlock>);
    setSaveMsg(style.lpGrouped ? 'Đã nhóm (marker)' : 'Đã bỏ nhóm');
  }

  function alignSelected(blockId: string, align: 'left' | 'center' | 'right') {
    if (!guardSectionUnlocked(blockId)) return;
    const field = inspectorTextFieldKey(selectedElement, primaryTarget?.field);
    if (field) {
      patchInlineTextStyle(blockId, field, { textAlign: align });
      setSaveMsg(`Căn ${align}`);
      return;
    }
    const block = specRef.current.blocks.find((b) => b.id === blockId);
    if (!block) return;
    const style = { ...((block.style || {}) as Record<string, unknown>), textAlign: align };
    updateBlock(blockId, { style } as Partial<LandingPageBlock>);
    setSaveMsg(`Căn ${align}`);
  }

  function insertSectionRelative(blockId: string, where: 'above' | 'below') {
    const blocks = [...specRef.current.blocks];
    const idx = blocks.findIndex((b) => b.id === blockId);
    if (idx < 0) return;
    const created = defaultBlock('Benefits');
    const insertAt = where === 'above' ? idx : idx + 1;
    blocks.splice(insertAt, 0, created);
    pushHistory(sanitizeLandingPageDraftSpec({ ...specRef.current, blocks }));
    selectCanvas({ blockId: created.id, element: 'section' });
    setSaveMsg(where === 'above' ? 'Đã thêm section phía trên' : 'Đã thêm section phía dưới');
  }

  function applyContextAiField(
    blockId: string,
    field: string,
    value: string,
    mode: 'replace' | 'append',
  ) {
    const block = specRef.current.blocks.find((b) => b.id === blockId);
    if (!block) return;
    const rec = block as unknown as Record<string, unknown>;
    const prev = typeof rec[field] === 'string' ? String(rec[field]) : '';
    const nextVal = mode === 'append' ? `${prev}${prev ? ' ' : ''}${value}` : value;
    applyAiToBlockField(blockId, field, nextVal);
    setSaveMsg(mode === 'append' ? 'Đã chèn thêm AI' : 'Đã thay thế bằng AI');
  }

  function focusInlineEditField(blockId: string, field: string) {
    const elKey =
      field === 'ctaLabel'
        ? 'cta'
        : field === 'headline' || field === 'subheadline' || field === 'body'
          ? field
          : elementKeyForField(field);
    selectCanvas({
      blockId,
      element: elKey as LandingPageCanvasElementKey,
      field,
    });
    if (field === 'videoUrl') {
      setInspectorTab('content');
      return;
    }
    requestAnimationFrame(() => {
      const node = document.querySelector(
        `[data-lp-block-id="${CSS.escape(blockId)}"] [data-lp-inline-field="${CSS.escape(field)}"]`,
      ) as HTMLElement | null;
      node?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      node?.focus?.();
    });
  }

  function focusButtonLink(blockId: string) {
    selectCanvas({ blockId: blockId, element: 'cta' });
    setInspectorTab('content');
    requestAnimationFrame(() => {
      const input = inspectorPanelRef.current?.querySelector(
        '[data-lp-button-link-value], [data-lp-button-label]',
      ) as HTMLInputElement | null;
      input?.focus();
    });
  }

  function setImageFit(blockId: string, fit: 'cover' | 'contain') {
    const block = specRef.current.blocks.find((b) => b.id === blockId);
    if (!block) return;
    const prev = {
      ...(((block as { imageStyle?: Record<string, unknown> }).imageStyle || {}) as Record<
        string,
        unknown
      >),
      fit,
    };
    const style = {
      ...((block.style || {}) as Record<string, unknown>),
      objectFit: fit,
    };
    updateBlock(blockId, { imageStyle: prev, style } as Partial<LandingPageBlock>);
    setSaveMsg(`Fit: ${fit}`);
  }

  function triggerReplaceImage(blockId: string) {
    selectCanvas({ blockId: blockId, element: 'image' });
    requestAnimationFrame(() => {
      const safeId = blockId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const root = inspectorPanelRef.current?.querySelector(`[data-inspector-block-id="${safeId}"]`);
      const input = root?.querySelector(
        '[data-lp-image-field] input[type="file"]',
      ) as HTMLInputElement | null;
      input?.click();
    });
  }

  /** Additive section-background toolbar → history via updateBlock. */
  function handleSectionBackgroundAction(blockId: string, action: SectionBackgroundToolbarAction) {
    const block = specRef.current.blocks.find((b) => b.id === blockId);
    if (!block) return;
    const prevStyle = { ...((block.style || {}) as Record<string, unknown>) };

    switch (action.type) {
      case 'edit': {
        selectCanvas({ blockId: blockId, element: 'section-background' });
        setInspectorTab('design');
        requestAnimationFrame(() => {
          const el = inspectorPanelRef.current?.querySelector(
            '[data-lp-inspector-background]',
          ) as HTMLInputElement | null;
          el?.focus({ preventScroll: false });
          el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        return;
      }
      case 'remove-bg': {
        updateBlock(blockId, {
          background: null,
          style: {
            ...prevStyle,
            backgroundImage: undefined,
            backgroundSize: undefined,
            backgroundPosition: undefined,
            backgroundRepeat: undefined,
            lpBgFlip: undefined,
            lpBgMotion: undefined,
          },
        } as Partial<LandingPageBlock>);
        setSaveMsg('Đã xóa nền section');
        return;
      }
      case 'remove-bg-image': {
        updateBlock(blockId, {
          style: {
            ...prevStyle,
            backgroundImage: undefined,
            backgroundSize: undefined,
            backgroundPosition: undefined,
            backgroundRepeat: undefined,
            lpBgFlip: undefined,
          },
        } as Partial<LandingPageBlock>);
        setSaveMsg('Đã xóa ảnh nền');
        return;
      }
      case 'set-color': {
        updateBlock(blockId, { background: action.color });
        setSaveMsg('Đã đổi màu nền');
        return;
      }
      case 'align': {
        updateBlock(blockId, {
          style: {
            ...prevStyle,
            backgroundPosition: action.position,
            ...(action.size ? { backgroundSize: action.size } : {}),
            backgroundRepeat: 'no-repeat',
          },
        } as Partial<LandingPageBlock>);
        setSaveMsg('Đã căn ảnh nền');
        return;
      }
      case 'z-layer': {
        updateBlock(blockId, {
          style: {
            ...prevStyle,
            lpBgZIndex: action.z === 0 ? undefined : String(action.z),
          },
        } as Partial<LandingPageBlock>);
        setSaveMsg('Đã đổi lớp nền');
        return;
      }
      case 'flip': {
        const flip = parseSectionBgFlip(prevStyle as { lpBgFlip?: string });
        if (action.axis === 'x') flip.x = !flip.x;
        else flip.y = !flip.y;
        updateBlock(blockId, {
          style: {
            ...prevStyle,
            lpBgFlip: encodeSectionBgFlip(flip),
          },
        } as Partial<LandingPageBlock>);
        setSaveMsg(action.axis === 'x' ? 'Đã lật ngang nền' : 'Đã lật dọc nền');
        return;
      }
      case 'motion': {
        updateBlock(blockId, {
          style: {
            ...prevStyle,
            lpBgMotion: action.preset === 'none' ? undefined : action.preset,
          },
        } as Partial<LandingPageBlock>);
        setSaveMsg('Đã gán chuyển động nền');
        return;
      }
      case 'replace-image': {
        selectCanvas({ blockId: blockId, element: 'section-background' });
        setMediaOpen(true);
        return;
      }
      case 'reset': {
        updateBlock(blockId, {
          background: null,
          style: {
            ...prevStyle,
            backgroundImage: undefined,
            backgroundSize: undefined,
            backgroundPosition: undefined,
            backgroundRepeat: undefined,
            lpBgFlip: undefined,
            lpBgMotion: undefined,
          },
        } as Partial<LandingPageBlock>);
        setSaveMsg('Đã reset nền');
        return;
      }
      case 'copy-style': {
        try {
          const payload = {
            background: block.background || null,
            style: {
              backgroundImage: prevStyle.backgroundImage,
              backgroundSize: prevStyle.backgroundSize,
              backgroundPosition: prevStyle.backgroundPosition,
              backgroundRepeat: prevStyle.backgroundRepeat,
              lpBgFlip: prevStyle.lpBgFlip,
              lpBgMotion: prevStyle.lpBgMotion,
            },
          };
          void navigator.clipboard.writeText(JSON.stringify(payload));
          setSaveMsg('Đã copy style nền');
        } catch {
          setSaveMsg('Không copy được style nền');
        }
        return;
      }
      default:
        return;
    }
  }

  /** Content-image toolbar (ẢNH) — block.imageUrl / item / grid cell. */
  function handleContentImageAction(
    blockId: string,
    element: LandingPageCanvasElementKey | undefined,
    action: SectionBackgroundToolbarAction,
  ) {
    const block = specRef.current.blocks.find((b) => b.id === blockId);
    if (!block) return;
    const el = element || selectedElement || 'image';
    const itemId = typeof el === 'string' && el.startsWith('item:') ? el.slice(5) : null;
    const gridIdx =
      typeof el === 'string' && el.startsWith('grid:') ? Number(el.slice(5)) : null;

    const readItemStyle = (): import('@marketingspa/shared').LandingPageImageStyle => {
      const row = block as LandingPageBlock & {
        items?: Array<{ id: string; imageStyle?: import('@marketingspa/shared').LandingPageImageStyle }>;
      };
      const item = row.items?.find((it) => it.id === itemId);
      return { ...(item?.imageStyle || {}) };
    };

    const patchItem = (
      patch: Partial<{
        imageUrl: string | null;
        imageStyle: import('@marketingspa/shared').LandingPageImageStyle | undefined;
      }>,
    ) => {
      const row = block as LandingPageBlock & {
        items?: Array<Record<string, unknown> & { id: string }>;
      };
      if (!Array.isArray(row.items) || !itemId) return;
      updateBlock(blockId, {
        items: row.items.map((it) =>
          it.id === itemId
            ? {
                ...it,
                ...(patch.imageUrl !== undefined ? { imageUrl: patch.imageUrl } : {}),
                ...(patch.imageStyle !== undefined ? { imageStyle: patch.imageStyle } : {}),
              }
            : it,
        ),
      } as Partial<LandingPageBlock>);
    };

    const readBlockStyle = (): import('@marketingspa/shared').LandingPageImageStyle => ({
      ...((block as { imageStyle?: import('@marketingspa/shared').LandingPageImageStyle }).imageStyle ||
        {}),
    });

    const readGridStyles = (): Array<Record<string, string>> => {
      const st = (block.style || {}) as Record<string, unknown>;
      try {
        const parsed = JSON.parse(String(st.lpGridImageStyles || '[]'));
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    const writeGridStyles = (styles: Array<Record<string, string>>) => {
      const prevStyle = { ...((block.style || {}) as Record<string, unknown>) };
      updateBlock(blockId, {
        style: { ...prevStyle, lpGridImageStyles: JSON.stringify(styles) },
      } as Partial<LandingPageBlock>);
    };

    const flipToggle = (prev: string | undefined, axis: 'x' | 'y') => {
      const set = new Set((prev || '').split('').filter((c) => c === 'x' || c === 'y'));
      if (set.has(axis)) set.delete(axis);
      else set.add(axis);
      const next = `${set.has('x') ? 'x' : ''}${set.has('y') ? 'y' : ''}`;
      return next || undefined;
    };

    switch (action.type) {
      case 'edit': {
        selectCanvas({ blockId: blockId, element: el });
        setInspectorTab('content');
        requestAnimationFrame(() => {
          const safeId = blockId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          const root = inspectorPanelRef.current?.querySelector(
            `[data-inspector-block-id="${safeId}"]`,
          );
          const field = root?.querySelector('[data-lp-image-field]') as HTMLElement | null;
          field?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        return;
      }
      case 'remove-bg': {
        if (itemId) {
          const st = readItemStyle();
          patchItem({ imageStyle: { ...st, bgColor: undefined } });
        } else if (gridIdx != null && Number.isFinite(gridIdx)) {
          const styles = readGridStyles();
          styles[gridIdx] = { ...(styles[gridIdx] || {}), bgColor: '' };
          writeGridStyles(styles);
        } else {
          const st = readBlockStyle();
          updateBlock(blockId, {
            imageStyle: { ...st, bgColor: undefined },
          } as Partial<LandingPageBlock>);
        }
        setSaveMsg('Đã xóa màu nền ảnh');
        return;
      }
      case 'remove-bg-image': {
        if (itemId) {
          patchItem({ imageUrl: null });
        } else if (gridIdx != null && Number.isFinite(gridIdx)) {
          const prevStyle = { ...((block.style || {}) as Record<string, unknown>) };
          let images: string[] = [];
          try {
            const parsed = JSON.parse(String(prevStyle.lpGridImages || '[]'));
            images = Array.isArray(parsed) ? parsed.map((u) => String(u || '')) : [];
          } catch {
            images = [];
          }
          images[gridIdx] = '';
          updateBlock(blockId, {
            style: { ...prevStyle, lpGridImages: JSON.stringify(images) },
          } as Partial<LandingPageBlock>);
        } else {
          updateBlock(blockId, { imageUrl: null } as Partial<LandingPageBlock>);
        }
        setSaveMsg('Đã xóa ảnh');
        return;
      }
      case 'set-color': {
        if (itemId) {
          patchItem({ imageStyle: { ...readItemStyle(), bgColor: action.color } });
        } else if (gridIdx != null && Number.isFinite(gridIdx)) {
          const styles = readGridStyles();
          styles[gridIdx] = { ...(styles[gridIdx] || {}), bgColor: action.color };
          writeGridStyles(styles);
        } else {
          updateBlock(blockId, {
            imageStyle: { ...readBlockStyle(), bgColor: action.color },
          } as Partial<LandingPageBlock>);
        }
        setSaveMsg('Đã đổi màu nền ảnh');
        return;
      }
      case 'align': {
        const fit =
          action.size === 'contain' || action.size === 'cover'
            ? action.size
            : action.size === '100% 100%'
              ? 'contain'
              : undefined;
        if (itemId) {
          patchItem({
            imageStyle: {
              ...readItemStyle(),
              position: action.position,
              ...(fit ? { fit } : {}),
            },
          });
        } else if (gridIdx != null && Number.isFinite(gridIdx)) {
          const styles = readGridStyles();
          styles[gridIdx] = {
            ...(styles[gridIdx] || {}),
            position: action.position,
            ...(action.size ? { size: action.size } : {}),
          };
          writeGridStyles(styles);
        } else {
          updateBlock(blockId, {
            imageStyle: {
              ...readBlockStyle(),
              position: action.position,
              ...(fit ? { fit } : {}),
            },
          } as Partial<LandingPageBlock>);
        }
        setSaveMsg('Đã căn ảnh');
        return;
      }
      case 'z-layer': {
        const z = action.z === 0 ? undefined : String(action.z);
        if (itemId) {
          patchItem({ imageStyle: { ...readItemStyle(), zIndex: z } });
        } else if (gridIdx != null && Number.isFinite(gridIdx)) {
          const styles = readGridStyles();
          styles[gridIdx] = { ...(styles[gridIdx] || {}), zIndex: z || '' };
          writeGridStyles(styles);
        } else {
          updateBlock(blockId, {
            imageStyle: { ...readBlockStyle(), zIndex: z },
          } as Partial<LandingPageBlock>);
        }
        setSaveMsg('Đã đổi lớp ảnh');
        return;
      }
      case 'flip': {
        if (itemId) {
          const st = readItemStyle();
          patchItem({ imageStyle: { ...st, flip: flipToggle(st.flip, action.axis) } });
        } else if (gridIdx != null && Number.isFinite(gridIdx)) {
          const styles = readGridStyles();
          const prev = styles[gridIdx]?.flip;
          styles[gridIdx] = {
            ...(styles[gridIdx] || {}),
            flip: flipToggle(prev, action.axis) || '',
          };
          writeGridStyles(styles);
        } else {
          const st = readBlockStyle();
          updateBlock(blockId, {
            imageStyle: { ...st, flip: flipToggle(st.flip, action.axis) },
          } as Partial<LandingPageBlock>);
        }
        setSaveMsg(action.axis === 'x' ? 'Đã lật ngang ảnh' : 'Đã lật dọc ảnh');
        return;
      }
      case 'motion': {
        const motion = action.preset === 'none' ? undefined : action.preset;
        if (itemId) {
          patchItem({ imageStyle: { ...readItemStyle(), motion } });
        } else if (gridIdx != null && Number.isFinite(gridIdx)) {
          const styles = readGridStyles();
          styles[gridIdx] = { ...(styles[gridIdx] || {}), motion: motion || '' };
          writeGridStyles(styles);
        } else {
          updateBlock(blockId, {
            imageStyle: { ...readBlockStyle(), motion },
          } as Partial<LandingPageBlock>);
        }
        setSaveMsg('Đã gán chuyển động ảnh');
        return;
      }
      case 'replace-image': {
        selectCanvas({ blockId: blockId, element: el });
        setMediaOpen(true);
        return;
      }
      case 'reset': {
        if (itemId) {
          patchItem({
            imageStyle: {
              alt: readItemStyle().alt,
            },
          });
        } else if (gridIdx != null && Number.isFinite(gridIdx)) {
          const styles = readGridStyles();
          styles[gridIdx] = {};
          writeGridStyles(styles);
        } else {
          updateBlock(blockId, {
            imageStyle: { alt: readBlockStyle().alt },
          } as Partial<LandingPageBlock>);
        }
        setSaveMsg('Đã reset style ảnh');
        return;
      }
      case 'copy-style': {
        try {
          let payload: unknown;
          if (itemId) payload = readItemStyle();
          else if (gridIdx != null && Number.isFinite(gridIdx)) {
            payload = readGridStyles()[gridIdx] || {};
          } else payload = readBlockStyle();
          void navigator.clipboard.writeText(JSON.stringify(payload));
          setSaveMsg('Đã copy style ảnh');
        } catch {
          setSaveMsg('Không copy được style ảnh');
        }
        return;
      }
      default:
        return;
    }
  }

  /** Free-drag drop → one history entry + dirty/revision (autosave-safe). */
  function commitBlockFreeLayout(
    blockId: string,
    payload: {
      positionMode: 'free';
      freeLayout: LandingPageFreeLayout;
      viewport: Viewport;
    },
  ) {
    if (!guardSectionUnlocked(blockId, 'Section đang khóa — mở khóa trước khi kéo')) return;
    const current = specRef.current;
    const prevBlock = current.blocks.find((b) => b.id === blockId);
    const prevLayout = prevBlock
      ? resolveFreeLayoutForViewport(
          prevBlock.positionMode,
          prevBlock.freeLayout,
          prevBlock.responsiveFreeLayout,
          payload.viewport,
        )
      : null;
    const freeLayout = ensureSectionFreeLayoutHeight(
      clampAbsoluteFreeLayout(payload.freeLayout),
    );
    const nextBlocks = reflowFreeSectionsAfterChange(
      current.blocks,
      blockId,
      prevLayout,
      freeLayout,
      payload.viewport,
    );
    pushHistory(
      markLandingPageUserEdits(
        { ...current, blocks: nextBlocks },
        [`${blockId}.freeLayout`],
      ),
    );
  }

  function commitElementFreeLayout(
    blockId: string,
    field: string,
    payload: {
      positionMode: 'free';
      freeLayout: LandingPageFreeLayout;
      viewport: Viewport;
    },
  ) {
    if (!guardSectionUnlocked(blockId)) return;
    if (payload.viewport === 'mobile') return;
    const key = `${blockId}::${field}`;
    const current = specRef.current;
    const block = current.blocks.find((b) => b.id === blockId);
    // Text-layer sections (Heading/Paragraph): element drag moves the SECTION.
    // Never persist a second translate on the text node — that double-applied
    // transform and let y go negative into neighbouring sections.
    if (block && isLpTextLayerBlock(block) && !field.startsWith('__element:')) {
      let prevSection = resolveFreeLayoutForViewport(
        block.positionMode,
        block.freeLayout,
        block.responsiveFreeLayout,
        payload.viewport,
      );
      if (!prevSection) {
        // First free move from flow: seed from live section box in canvas-local space.
        const shell = document.querySelector(
          `[data-lp-block-id="${CSS.escape(blockId)}"][data-lp-section-chrome="1"]`,
        ) as HTMLElement | null;
        const root = shell?.closest('[data-lp-canvas-root]') as HTMLElement | null;
        if (shell && root) {
          const scale = readCanvasPointerScale(shell);
          const s = scale > 0.05 ? scale : 1;
          const sr = shell.getBoundingClientRect();
          const rr = root.getBoundingClientRect();
          prevSection = {
            x: Math.round((sr.left - rr.left) / s),
            y: Math.round((sr.top - rr.top) / s),
            width: Math.round(sr.width / s) || 420,
            height: Math.round(sr.height / s) || 72,
          };
        } else {
          prevSection = { x: 0, y: 0, width: 420, height: 72 };
        }
      }
      const nextSection = clampAbsoluteFreeLayout({
        ...prevSection,
        x: Math.round((prevSection.x || 0) + (payload.freeLayout.x || 0)),
        y: Math.round((prevSection.y || 0) + (payload.freeLayout.y || 0)),
        width: prevSection.width || payload.freeLayout.width || 420,
        height: prevSection.height || 72,
        reserveHeight: prevSection.reserveHeight || prevSection.height || 72,
      });
      const prevEfl =
        (current.meta && typeof current.meta === 'object'
          ? (current.meta as { elementFreeLayouts?: Record<string, LandingPageFreeLayout> })
              .elementFreeLayouts
          : null) || {};
      const nextEfl = { ...prevEfl };
      delete nextEfl[key];
      // Text layers: update this section only — reflowFreeSectionsAfterChange is a
      // no-op pack for floating text layers (keeps exact x/y).
      const nextBlocks = reflowFreeSectionsAfterChange(
        current.blocks.map((b) =>
          b.id === blockId
            ? ({
                ...b,
                positionMode: 'free' as const,
                freeLayout: nextSection,
                spacing: 'none' as const,
              } as LandingPageBlock)
            : b,
        ),
        blockId,
        prevSection,
        nextSection,
        payload.viewport,
      );
      pushHistory(
        markLandingPageUserEdits(
          {
            ...current,
            blocks: nextBlocks,
            meta: { ...(current.meta || {}), elementFreeLayouts: nextEfl },
          },
          [`${blockId}.freeLayout`],
        ),
      );
      return;
    }
    const prevMap =
      (current.meta && typeof current.meta === 'object'
        ? (current.meta as { elementFreeLayouts?: Record<string, LandingPageFreeLayout> }).elementFreeLayouts
        : null) || {};
    // Text hug: never persist a locked geometric height from free-drag measure.
    const keyLooksText = !field.startsWith('__element:');
    const freeLayout = keyLooksText
      ? {
          x: payload.freeLayout.x,
          y: payload.freeLayout.y,
          ...(payload.freeLayout.width != null ? { width: payload.freeLayout.width } : null),
          ...(payload.freeLayout.rotate != null ? { rotate: payload.freeLayout.rotate } : null),
        }
      : payload.freeLayout;
    const nextMeta = {
      ...(current.meta || {}),
      elementFreeLayouts: {
        ...prevMap,
        [key]: freeLayout,
      },
    };
    // Spec heuristic grow (works before paint); DOM fit below after push.
    // Capture PREV free height BEFORE expand — expand grows in place and used to
    // skip reflow when "needed" already matched the expanded height, leaving the
    // next free section painted on top.
    const prevParentFree = (() => {
      const parent = current.blocks.find((b) => b.id === blockId);
      if (!parent) return null;
      return resolveFreeLayoutForViewport(
        parent.positionMode,
        parent.freeLayout,
        parent.responsiveFreeLayout,
        payload.viewport,
      );
    })();
    let nextBlocks = expandBlocksToFitElementLayouts(
      current.blocks,
      nextMeta.elementFreeLayouts as Record<string, LandingPageFreeLayout>,
      payload.viewport,
    );
    // Prefer live DOM bottom (offset-mode y is translate, not section-absolute).
    let domNeeded = 0;
    const shell = document.querySelector(
      `[data-lp-block-id="${CSS.escape(blockId)}"][data-lp-section-chrome="1"]`,
    ) as HTMLElement | null;
    if (shell) {
      const scale = readCanvasPointerScale(shell);
      domNeeded =
        measureSectionContentHeightCss(shell, scale) + SECTION_CONTENT_FIT_PADDING;
    }
    const parent = nextBlocks.find((b) => b.id === blockId);
    const parentFree = parent
      ? resolveFreeLayoutForViewport(
          parent.positionMode,
          parent.freeLayout,
          parent.responsiveFreeLayout,
          payload.viewport,
        )
      : null;
    if (prevParentFree && parentFree) {
      const childBottom =
        Math.max(0, freeLayout.y ?? 0) +
        Math.max(28, freeLayout.height ?? 48) +
        SECTION_CONTENT_FIT_PADDING;
      const needed = Math.max(
        parentFree.height || 0,
        childBottom,
        domNeeded > 0 ? Math.min(domNeeded, 2400) : 0,
      );
      nextBlocks = reflowFreeSectionsAfterChange(
        nextBlocks,
        blockId,
        prevParentFree,
        ensureSectionFreeLayoutHeight({ ...parentFree, height: needed }),
        payload.viewport,
      );
    } else if (parentFree) {
      const childBottom =
        Math.max(0, freeLayout.y ?? 0) +
        Math.max(28, freeLayout.height ?? 48) +
        SECTION_CONTENT_FIT_PADDING;
      const needed = Math.max(
        parentFree.height || 0,
        childBottom,
        domNeeded > 0 ? Math.min(domNeeded, 2400) : 0,
      );
      if (needed > (parentFree.height || 0) + 1) {
        nextBlocks = reflowFreeSectionsAfterChange(
          nextBlocks,
          blockId,
          parentFree,
          ensureSectionFreeLayoutHeight({ ...parentFree, height: needed }),
          payload.viewport,
        );
      }
    } else {
      // Flow parent: expand already set minHeight; pack free siblings if any remain.
      nextBlocks = packFreeSectionsVertical(nextBlocks, payload.viewport);
    }
    pushHistory(
      markLandingPageUserEdits(
        {
          ...current,
          blocks: nextBlocks,
          meta: nextMeta,
        },
        [`${key}.freeLayout`],
      ),
    );
    // After paint: precise DOM measure (transform-aware) + sibling reflow.
    requestAnimationFrame(() => fitSectionToContent(blockId, payload.viewport));
  }

  /** Text box 8-handle resize — style width/height (+ typography on corner scale) + free offset in ONE history entry. */
  function commitTextBoxResize(
    blockId: string,
    field: string,
    payload: {
      width: number;
      height: number;
      fontSize?: number;
      lineHeight?: number | string;
      scaleTypography?: boolean;
      freeLayout: LandingPageFreeLayout;
      viewport: Viewport;
    },
  ) {
    if (!guardSectionUnlocked(blockId)) return;
    const key = elementStyleKey(blockId, field);
    const current = specRef.current;
    const meta = (current.meta && typeof current.meta === 'object' ? current.meta : {}) as {
      inlineTextStyles?: Record<string, LandingPageInlineTextStyle>;
      elementFreeLayouts?: Record<string, LandingPageFreeLayout>;
      responsiveInlineTextStyles?: Record<
        string,
        Partial<Record<Viewport, LandingPageInlineTextStyle>>
      >;
    };
    const prevStyles = meta.inlineTextStyles || {};
    const prev = { ...(prevStyles[key] || {}) };
    const merged = {
      ...prev,
      width: payload.width,
      ...(payload.scaleTypography &&
      typeof payload.fontSize === 'number' &&
      payload.fontSize > 0
        ? {
            fontSize: payload.fontSize,
            fontSizeUnit: 'px' as const,
            ...(payload.lineHeight != null ? { lineHeight: payload.lineHeight } : null),
          }
        : null),
    } as LandingPageInlineTextStyle & Record<string, unknown>;
    // Text hug: never lock a taller empty frame from prior geometric height commits.
    delete merged.height;
    const freeLayoutHug = {
      x: payload.freeLayout.x,
      y: payload.freeLayout.y,
      width: payload.freeLayout.width,
    };
    const prevRespMap = meta.responsiveInlineTextStyles || {};
    const prevViewport = prevRespMap[key] || {};
    const prevFree = meta.elementFreeLayouts || {};
    // Grow parent free section if child bottom exceeds committed height — always
    // reflow from PREV layout when height changes (never grow in place only).
    let nextBlocks = current.blocks;
    const parent = current.blocks.find((b) => b.id === blockId);
    const parentFree = parent
      ? resolveFreeLayoutForViewport(
          parent.positionMode,
          parent.freeLayout,
          parent.responsiveFreeLayout,
          payload.viewport,
        )
      : null;
    if (parentFree) {
      const childBottom =
        Math.max(0, payload.freeLayout.y) +
        Math.max(28, payload.height) +
        SECTION_CONTENT_FIT_PADDING;
      let domNeeded = 0;
      const shell = document.querySelector(
        `[data-lp-block-id="${CSS.escape(blockId)}"][data-lp-section-chrome="1"]`,
      ) as HTMLElement | null;
      if (shell) {
        const scale = readCanvasPointerScale(shell);
        domNeeded =
          measureSectionContentHeightCss(shell, scale) + SECTION_CONTENT_FIT_PADDING;
      }
      const needed = Math.max(
        parentFree.height || 0,
        childBottom,
        domNeeded > 0 ? Math.min(domNeeded, 2400) : 0,
      );
      if (needed > (parentFree.height || 0) + 1) {
        nextBlocks = reflowFreeSectionsAfterChange(
          current.blocks,
          blockId,
          parentFree,
          ensureSectionFreeLayoutHeight({ ...parentFree, height: needed }),
          payload.viewport,
        );
      } else {
        nextBlocks = packFreeSectionsVertical(current.blocks, payload.viewport);
      }
    }
    pushHistory(
      markLandingPageUserEdits(
        {
          ...current,
          blocks: nextBlocks,
          meta: {
            ...(current.meta || {}),
            inlineTextStyles: { ...prevStyles, [key]: merged },
            responsiveInlineTextStyles: {
              ...prevRespMap,
              [key]: { ...prevViewport, [payload.viewport]: merged },
            },
            elementFreeLayouts: {
              ...prevFree,
              [key]: freeLayoutHug,
            },
          },
        },
        [`${key}.textBoxResize`],
      ),
    );
    requestAnimationFrame(() => fitSectionToContent(blockId, payload.viewport));
  }

  function commitItemFreeLayout(
    blockId: string,
    itemId: string,
    payload: {
      positionMode: 'free';
      freeLayout: LandingPageFreeLayout;
      viewport: Viewport;
    },
  ) {
    // Mobile without explicit item free layout stays flow — skip writing mobile free coords
    // into the shared item freeLayout when viewport is mobile would break phones; store only
    // when desktop/tablet (item schema has single freeLayout).
    if (payload.viewport === 'mobile') return;
    const next = {
      ...specRef.current,
      blocks: specRef.current.blocks.map((b) => {
        if (b.id !== blockId) return b;
        const row = b as LandingPageBlock & {
          items?: Array<Record<string, unknown>>;
          plans?: Array<Record<string, unknown>>;
        };
        if (Array.isArray(row.items)) {
          return {
            ...row,
            items: row.items.map((it) =>
              it.id === itemId
                ? { ...it, positionMode: 'free', freeLayout: payload.freeLayout }
                : it,
            ),
          } as LandingPageBlock;
        }
        if (Array.isArray(row.plans)) {
          return {
            ...row,
            plans: row.plans.map((it) =>
              it.id === itemId
                ? { ...it, positionMode: 'free', freeLayout: payload.freeLayout }
                : it,
            ),
          } as LandingPageBlock;
        }
        return b;
      }),
    };
    pushHistory(markLandingPageUserEdits(next, [`${blockId}.item.${itemId}.freeLayout`]));
    requestAnimationFrame(() => fitSectionToContent(blockId, payload.viewport));
  }

  const canvasActionRef = useRef({
    updateBlockFieldLive,
    updateBlockFieldCommit,
    patchInlineTextStyle,
    dupBlock,
    dupItem,
    removeBlock,
    removeBlocks,
    hideCanvasElements,
    moveBlock,
    reorderBlockById,
    reorderListItem,
    focusInspectorAi,
    triggerReplaceImage,
    deselectCanvas,
    commitBlockFreeLayout,
    commitItemFreeLayout,
    commitElementFreeLayout,
    commitTextBoxResize,
    insertSidebarPreset,
    copyBlockToClipboard,
    copyStyleToClipboard,
    saveTextAsset,
    syncDesignFromMobile,
    toggleElementHidden,
    toggleElementLock,
    openTextAiPrompt,
  });
  canvasActionRef.current = {
    updateBlockFieldLive,
    updateBlockFieldCommit,
    patchInlineTextStyle,
    dupBlock,
    dupItem,
    removeBlock,
    removeBlocks,
    hideCanvasElements,
    moveBlock,
    reorderBlockById,
    reorderListItem,
    focusInspectorAi,
    triggerReplaceImage,
    deselectCanvas,
    commitBlockFreeLayout,
    commitItemFreeLayout,
    commitElementFreeLayout,
    commitTextBoxResize,
    insertSidebarPreset,
    copyBlockToClipboard,
    copyStyleToClipboard,
    saveTextAsset,
    syncDesignFromMobile,
    toggleElementHidden,
    toggleElementLock,
    openTextAiPrompt,
  };

  const canvasHandlers: LandingPageCanvasHandlers = useMemo(
    () => ({
      selection: primaryTarget
        ? {
            blockId: primaryTarget.blockId,
            element: primaryTarget.element,
            field: primaryTarget.field,
          }
        : null,
      selectedElementIds,
      primarySelectedId,
      onSelect: (next: LandingPageCanvasSelection, opts?: LpSelectOptions) => {
        const element = (parseElementKey(next.element) ||
          next.element ||
          'section') as LandingPageCanvasElementKey;
        const target = normalizeLpSelectionTarget({
          blockId: next.blockId,
          element,
          field: next.field,
        });
        setCanvasSelection((prev) => applySelectionClick(prev.ids, prev.primaryId, target, opts));
        const textField = inspectorTextFieldKey(target.element, target.field);
        const textBlock = specRef.current.blocks.find((block) => block.id === target.blockId);
        if (
          textBlock &&
          textField &&
          resolveInspectorContext(textBlock, target.element, textField).kind === 'text'
        ) {
          setInspectorPanelOpen(true);
          setInspectorRailSurface('element');
          setInspectorTab('content');
        }
        if (
          typeof target.element === 'string' &&
          target.element.startsWith('item:') &&
          !target.field &&
          !target.element.startsWith('item:trust-icon-')
        ) {
          setInspectorPanelOpen(true);
          setInspectorRailSurface('element');
          setInspectorTab('design');
        }
        if (element === 'section' || element === 'section-background') {
          setInspectorPanelOpen(true);
          setInspectorRailSurface('element');
          setInspectorTab('content');
        }
      },
      onMarqueeSelect: (targets: LpSelectionTarget[], opts?: LpSelectOptions) => {
        setCanvasSelection((prev) => applyMarqueeSelection(prev.ids, prev.primaryId, targets, opts));
      },
      isSelected: (target) => {
        const element = (parseElementKey(target.element) ||
          target.element ||
          'section') as LandingPageCanvasElementKey;
        const normalized = normalizeLpSelectionTarget({
          blockId: target.blockId,
          element,
          field: target.field,
        });
        return selectedElementIds.some((id) => lpSelectionKeyMatches(id, normalized));
      },
      isPrimarySelected: (target) => {
        const element = (parseElementKey(target.element) ||
          target.element ||
          'section') as LandingPageCanvasElementKey;
        const normalized = normalizeLpSelectionTarget({
          blockId: target.blockId,
          element,
          field: target.field,
        });
        return lpSelectionKeyMatches(primarySelectedId, normalized);
      },
      isSectionPrimary: (blockId) => {
        if (!primarySelectedId) return false;
        const p = parseLpSelectionKey(primarySelectedId);
        return Boolean(
          p && p.blockId === blockId && isSectionLevelElement(p.element) && !p.field,
        );
      },
      onDeselect: () => canvasActionRef.current.deselectCanvas(),
      onFieldLive: (blockId, field, value) =>
        canvasActionRef.current.updateBlockFieldLive(blockId, field, value),
      onFieldCommit: (blockId, field, value) =>
        canvasActionRef.current.updateBlockFieldCommit(blockId, field, value),
      onDuplicate: (blockId) => {
        const el = selectedElement;
        const prefer =
          el === 'headline' ||
          el === 'subheadline' ||
          el === 'body' ||
          el === 'cta' ||
          (typeof el === 'string' && el.startsWith('item:'))
            ? el
            : undefined;
        canvasActionRef.current.dupBlock(blockId, prefer);
      },
      onDuplicateItem: (blockId, itemId) => canvasActionRef.current.dupItem(blockId, itemId),
      onDelete: (blockId) => canvasActionRef.current.removeBlock(blockId),
      onToggleFreePosition: (blockId) => toggleBlockFreePosition(blockId),
      onMove: (blockId, direction) => canvasActionRef.current.moveBlock(blockId, direction),
      onReorderBlock: (fromId, toId) => canvasActionRef.current.reorderBlockById(fromId, toId),
      onReorderItem: (blockId, fromItemId, toItemId) =>
        canvasActionRef.current.reorderListItem(blockId, fromItemId, toItemId),
      onInsertSidebarPreset: (payload, pos) =>
        canvasActionRef.current.insertSidebarPreset(payload, pos),
      onApplyBlockImage: (blockId, url, opts) => applyBlockImage(blockId, url, opts),
      onAi: (blockId) => canvasActionRef.current.focusInspectorAi(blockId),
      onReplaceImage: (blockId) => canvasActionRef.current.triggerReplaceImage(blockId),
      onSectionBackgroundAction: (blockId, action) =>
        handleSectionBackgroundAction(blockId, action),
      onContentImageAction: (blockId, element, action) =>
        handleContentImageAction(blockId, element, action),
      getSectionBackgroundMeta: (blockId) => {
        const b = specRef.current.blocks.find((row) => row.id === blockId);
        if (!b) return { hasImage: false, hasAnyBg: false, motion: undefined };
        const st = (b.style || {}) as { lpBgMotion?: string; lpBgZIndex?: string };
        return {
          hasImage: sectionHasBackgroundImage(b),
          hasAnyBg: sectionHasAnyBackground(b),
          motion:
            typeof st.lpBgMotion === 'string' && st.lpBgMotion && st.lpBgMotion !== 'none'
              ? st.lpBgMotion
              : undefined,
          zIndex: st.lpBgZIndex ? Number(st.lpBgZIndex) : undefined,
        };
      },
      getContentImageMeta: (blockId, element) => {
        const b = specRef.current.blocks.find((row) => row.id === blockId);
        if (!b) return { hasImage: false, hasAnyBg: false };
        const el = element || 'image';
        if (typeof el === 'string' && el.startsWith('item:')) {
          const itemId = el.slice(5);
          const row = b as LandingPageBlock & {
            items?: Array<{
              id: string;
              imageUrl?: string | null;
              imageStyle?: { bgColor?: string };
            }>;
          };
          const item = row.items?.find((it) => it.id === itemId);
          return {
            hasImage: Boolean(item?.imageUrl),
            hasAnyBg: Boolean(item?.imageStyle?.bgColor),
          };
        }
        if (typeof el === 'string' && el.startsWith('grid:')) {
          const idx = Number(el.slice(5));
          const st = (b.style || {}) as Record<string, unknown>;
          let images: string[] = [];
          try {
            const parsed = JSON.parse(String(st.lpGridImages || '[]'));
            images = Array.isArray(parsed) ? parsed.map((u) => String(u || '')) : [];
          } catch {
            images = [];
          }
          let styles: Array<{ bgColor?: string }> = [];
          try {
            const parsed = JSON.parse(String(st.lpGridImageStyles || '[]'));
            styles = Array.isArray(parsed) ? parsed : [];
          } catch {
            styles = [];
          }
          return {
            hasImage: Boolean(images[idx]),
            hasAnyBg: Boolean(styles[idx]?.bgColor),
          };
        }
        const url = (b as { imageUrl?: string | null }).imageUrl;
        const st = (b as { imageStyle?: { bgColor?: string } }).imageStyle;
        return {
          hasImage: Boolean(url),
          hasAnyBg: Boolean(st?.bgColor),
        };
      },
      getElementCustomClass: (blockId, element) => {
        const b = specRef.current.blocks.find((row) => row.id === blockId);
        if (!b) return '';
        return readElementCustomClass(
          (b.style || {}) as Record<string, unknown>,
          String(element || ''),
        );
      },
      getElementCustomCssStyle: (blockId, element) => {
        const b = specRef.current.blocks.find((row) => row.id === blockId);
        if (!b) return {};
        return readElementCustomCssStyle(
          (b.style || {}) as Record<string, unknown>,
          String(element || ''),
        );
      },
      getSectionBackgroundPaint: (blockId) => {
        const b = specRef.current.blocks.find((row) => row.id === blockId);
        if (!b || !sectionHasBackgroundImage(b)) return null;
        const st = (b.style || {}) as Record<string, unknown>;
        const flip = parseSectionBgFlip(st as { lpBgFlip?: string });
        const zRaw = st.lpBgZIndex;
        const z = typeof zRaw === 'string' || typeof zRaw === 'number' ? Number(zRaw) : 0;
        return {
          backgroundImage: (st.backgroundImage as string) || undefined,
          backgroundSize: (st.backgroundSize as string) || 'cover',
          backgroundPosition: (st.backgroundPosition as string) || 'center',
          backgroundRepeat: (st.backgroundRepeat as string) || 'no-repeat',
          transform:
            flip.x || flip.y ? `scale(${flip.x ? -1 : 1}, ${flip.y ? -1 : 1})` : undefined,
          zIndex: Number.isFinite(z) ? z : 0,
        };
      },
      canReplaceImage: (blockId: string) => {
        const b = specRef.current.blocks.find((row) => row.id === blockId);
        if (!b) return false;
        if ('imageUrl' in b) return true;
        if (b.type === 'Gallery' || b.type === 'Product' || b.type === 'Hero') return true;
        if (b.type === 'CTA' && isLandingPageBoxStyle(b.style as Record<string, unknown> | undefined)) {
          return true;
        }
        return false;
      },
      getTextStyle: (blockId, field) => {
        const map =
          (specRef.current.meta as { inlineTextStyles?: Record<string, LandingPageInlineTextStyle> } | undefined)
            ?.inlineTextStyles || {};
        return map[`${blockId}::${field}`];
      },
      onTextStyleChange: (blockId, field, patch) =>
        canvasActionRef.current.patchInlineTextStyle(blockId, field, patch),
      viewport,
      getBlockFreeLayout: (blockId) => {
        const b = specRef.current.blocks.find((row) => row.id === blockId);
        if (!b) return null;
        const resolved = resolveFreeLayoutForViewport(
          b.positionMode,
          b.freeLayout,
          b.responsiveFreeLayout,
          viewport,
        );
        // Drop legacy off-canvas free coords (e.g. y=2328) so section stays visible.
        if (resolved && (resolved.x > 2400 || resolved.y > 2400 || resolved.x < -40 || resolved.y < -40)) {
          return null;
        }
        return resolved;
      },
      onFreeLayoutCommit: (blockId, payload) =>
        canvasActionRef.current.commitBlockFreeLayout(blockId, payload),
      getItemFreeLayout: (blockId, itemId) => {
        if (viewport === 'mobile') return null;
        const b = specRef.current.blocks.find((row) => row.id === blockId) as
          | (LandingPageBlock & {
              items?: Array<{ id: string; positionMode?: string; freeLayout?: LandingPageFreeLayout }>;
              plans?: Array<{ id: string; positionMode?: string; freeLayout?: LandingPageFreeLayout }>;
            })
          | undefined;
        const item =
          b?.items?.find((it) => it.id === itemId) || b?.plans?.find((it) => it.id === itemId);
        if (!item || item.positionMode !== 'free' || !item.freeLayout) return null;
        // Reject legacy canvas-absolute saves that made cards vanish.
        const fl = item.freeLayout;
        if (Math.abs(fl.x) > 640 || Math.abs(fl.y) > 640) return null;
        return fl;
      },
      onItemFreeLayoutCommit: (blockId, itemId, payload) =>
        canvasActionRef.current.commitItemFreeLayout(blockId, itemId, payload),
      getElementFreeLayout: (blockId, field) => {
        if (viewport === 'mobile') return null;
        const block = specRef.current.blocks.find((b) => b.id === blockId);
        // Text-layer sections own position via section.freeLayout — never paint a
        // second element translate (double transform / cross-section overlap).
        if (block && isLpTextLayerBlock(block) && !field.startsWith('__element:')) {
          return null;
        }
        const map =
          (specRef.current.meta as { elementFreeLayouts?: Record<string, LandingPageFreeLayout> } | undefined)
            ?.elementFreeLayouts || {};
        const fl = map[`${blockId}::${field}`];
        if (!fl) return null;
        if (Math.abs(fl.x) > 640 || Math.abs(fl.y) > 640) return null;
        return fl;
      },
      onElementFreeLayoutCommit: (blockId, field, payload) =>
        canvasActionRef.current.commitElementFreeLayout(blockId, field, payload),
      onTextBoxResizeCommit: (blockId, field, payload) =>
        canvasActionRef.current.commitTextBoxResize(blockId, field, payload),
      onTextToolbarCopy: (blockId) => canvasActionRef.current.copyBlockToClipboard(blockId),
      onTextToolbarCopyStyle: (blockId) => canvasActionRef.current.copyStyleToClipboard(blockId),
      onTextToolbarSaveAsset: (blockId, field) =>
        canvasActionRef.current.saveTextAsset(blockId, field),
      onTextToolbarSyncFromMobile: (blockId, field) =>
        canvasActionRef.current.syncDesignFromMobile(blockId, field),
      onTextToolbarToggleHidden: (blockId, field) =>
        canvasActionRef.current.toggleElementHidden(blockId, field),
      onTextToolbarToggleLock: (blockId, field) =>
        canvasActionRef.current.toggleElementLock(blockId, field),
      onTextToolbarAiPrompt: (blockId, field, anchorRect) =>
        canvasActionRef.current.openTextAiPrompt(blockId, field, anchorRect),
      isTextElementHidden: (blockId, field) => {
        const key = elementStyleKey(blockId, field);
        return Boolean(
          (specRef.current.meta as { elementHidden?: Record<string, boolean> } | undefined)
            ?.elementHidden?.[key],
        );
      },
      isTextElementLocked: (blockId, field) => {
        if (isSectionLocked(blockId)) return true;
        const key = elementStyleKey(blockId, field);
        return Boolean(
          (specRef.current.meta as { elementLocked?: Record<string, boolean> } | undefined)
            ?.elementLocked?.[key],
        );
      },
      isBlockLocked: (blockId) => isSectionLocked(blockId),
    }),
    [primaryTarget, selectedElementIds, primarySelectedId, selectedElement, viewport],
  );

  function setTheme(theme: LandingPageTheme) {
    pushHistory(
      sanitizeLandingPageDraftSpec({
        ...specRef.current,
        theme,
        themeTokens: { ...LANDING_PAGE_THEME_PRESETS[theme] },
      }),
    );
  }

  async function publish() {
    if (saveConflictRef.current) {
      setSaveMsg('Có bản mới hơn ở nơi khác — bấm "Tải bản mới nhất" trước khi publish');
      return;
    }
    // LP-PUB-001/002: flush latest canvas (specRef) and wait for in-flight autosave.
    await persist(specRef.current, page?.name, { manual: true, wait: true });
    if (dirtyRef.current || autosaveInflightRef.current) {
      setSaveMsg(
        saveConflictRef.current
          ? 'Có bản mới hơn ở nơi khác — bấm "Tải bản mới nhất" trước khi publish'
          : 'Không lưu kịp trước publish — thử lại',
      );
      return;
    }
    let updated: PagePayload;
    try {
      updated = await apiClient<PagePayload>(`/landing-pages/${pageId}/publish`, {
        method: 'POST',
        body: JSON.stringify({ clientRevision: ackedRevisionRef.current }),
      });
    } catch (e) {
      setSaveMsg(
        e instanceof Error ? e.message : 'Publish thất bại — bản công khai chưa đổi',
      );
      return;
    }
    setPage(updated);
    clearLocalLandingDraft(pageId);
    const fresh = await revalidatePublicLandingPage(updated.slug);
    setSaveMsg(fresh ? 'Đã publish' : 'Đã publish. Cache trang công khai chưa làm mới — tải lại sau ít phút');
  }

  async function applyBusinessProfile(force: boolean) {
    try {
      setSaving(true);
      const updated = await apiClient<PagePayload & { draftSpec: LandingPageSpec }>(
        `/landing-pages/${pageId}/apply-business-profile`,
        {
          method: 'POST',
          body: JSON.stringify({ force, pageGoal: 'lead' }),
        },
      );
      setSpec(sanitizeLandingPagePersistSpec(updated.draftSpec));
      setPage({ ...page!, ...updated });
      setSaveMsg(
        force
          ? 'Đã điền lại từ Business Profile'
          : 'Đã dùng Business Profile (giữ phần bạn đã sửa)',
      );
      dirtyRef.current = true;
      revisionRef.current += 1;
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : 'Apply profile thất bại');
    } finally {
      setSaving(false);
    }
  }

  async function withDoctorRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < LP_AI_RETRY_MAX_ATTEMPTS; attempt++) {
      try {
        return await fn();
      } catch (e) {
        lastErr = e;
        const status = e instanceof ApiError ? e.statusCode : 0;
        if (!shouldRetryLpAiHttpStatus(status) || attempt >= LP_AI_RETRY_MAX_ATTEMPTS - 1) {
          throw e;
        }
        setDoctorError(
          e instanceof Error
            ? `${e.message} — đang thử lại (${attempt + 1}/${LP_AI_RETRY_MAX_ATTEMPTS})…`
            : 'Lỗi tạm thời — đang thử lại…',
        );
        await new Promise((r) => setTimeout(r, lpAiRetryDelayMs(attempt)));
      }
    }
    throw lastErr;
  }

  async function runPageDoctor() {
    try {
      setDoctorBusy(true);
      setDoctorOpen(true);
      setDoctorError(null);
      const res = await withDoctorRetry(() =>
        apiClient<{ report: NonNullable<typeof doctorReport> }>(
          `/landing-pages/${pageId}/page-doctor`,
          { method: 'POST', body: JSON.stringify({}) },
        ),
      );
      setDoctorReport(res.report);
      const sel: Record<string, boolean> = {};
      for (const p of res.report.patches || []) sel[p.id] = true;
      setSelectedPatches(sel);
    } catch (e) {
      const msg =
        e instanceof ApiError && e.statusCode === 429
          ? 'Quá nhiều yêu cầu (429) — đợi rồi thử lại. Bản nháp không đổi.'
          : e instanceof Error
            ? e.message
            : 'Page Doctor lỗi';
      setDoctorError(msg);
      setSaveMsg(msg);
      // Keep modal open with error so Builder stays usable; draft untouched.
    } finally {
      setDoctorBusy(false);
    }
  }

  async function applyDoctorPatches() {
    if (!doctorReport) return;
    const selectedPatchIds = Object.entries(selectedPatches)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (!selectedPatchIds.length) {
      setSaveMsg('Chọn ít nhất 1 đề xuất');
      return;
    }
    if (!doctorIdemRef.current) {
      doctorIdemRef.current =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `doc-${Date.now()}`;
    }
    const beforeSpec = cloneSpec(spec);
    try {
      setDoctorBusy(true);
      setDoctorError(null);
      const updated = await withDoctorRetry(() =>
        apiClient<
          PagePayload & {
            draftSpec: LandingPageSpec;
            undoVersion?: number;
            canUndo?: boolean;
          }
        >(`/landing-pages/${pageId}/page-doctor/apply`, {
          method: 'POST',
          body: JSON.stringify({
            report: doctorReport,
            selectedPatchIds,
            idempotencyKey: doctorIdemRef.current,
          }),
        }),
      );
      setSpec(sanitizeLandingPagePersistSpec(updated.draftSpec));
      setPage({ ...page!, ...updated });
      dirtyRef.current = true;
      revisionRef.current += 1;
      if (typeof updated.undoVersion === 'number') {
        setDoctorUndoVersion(updated.undoVersion);
      }
      doctorIdemRef.current = null;
      setSaveMsg('Đã Apply tối ưu — sẽ autosave. Có thể Hoàn tác.');
      setDoctorOpen(false);
    } catch (e) {
      // Never apply partial client-side — restore local view to pre-attempt draft.
      setSpec(beforeSpec);
      const msg =
        e instanceof ApiError && (e.statusCode === 429 || e.statusCode >= 500)
          ? `${e.message} — thử lại. Bản nháp không đổi.`
          : e instanceof Error
            ? e.message
            : 'Apply Page Doctor thất bại';
      setDoctorError(msg);
      setSaveMsg(msg);
    } finally {
      setDoctorBusy(false);
    }
  }

  async function undoDoctorApply() {
    if (doctorUndoVersion == null) return;
    try {
      setDoctorBusy(true);
      const updated = await apiClient<PagePayload & { draftSpec: LandingPageSpec }>(
        `/landing-pages/${pageId}/versions/${doctorUndoVersion}/restore`,
        { method: 'POST', body: JSON.stringify({ note: 'undo-page-doctor' }) },
      );
      const restored = sanitizeLandingPagePersistSpec(updated.draftSpec);
      setSpec(restored);
      setPage({ ...page!, ...updated });
      dirtyRef.current = false;
      revisionRef.current = readClientRevision(restored);
      saveConflictRef.current = false;
      setSaveConflict(false);
      setDoctorUndoVersion(null);
      setSaveMsg('Đã hoàn tác Page Doctor — version mới đã lưu lịch sử');
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : 'Hoàn tác thất bại');
    } finally {
      setDoctorBusy(false);
    }
  }

  if (error) {
    return <div className="rounded-lg border border-red-500/30 p-4 text-red-300">{error}</div>;
  }
  if (!page) {
    return <div className="p-6 text-sm opacity-70">Đang tải builder…</div>;
  }

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden"
      data-lp-builder-root
      data-lp-builder-vertical-toolbars="1"
      data-lp-inspector-mode={inspectorMode}
      data-lp-canvas-scroll-mode="internal"
      data-lp-fullscreen-preview={fullscreenPreview ? '1' : undefined}
      data-lp-no-double-scroll="1"
      style={{
        // App header h-16 (4rem) + LP toolbar h-11 (2.75rem)
        ['--builder-chrome-offset' as string]: '6.75rem',
        ['--builder-top-offset' as string]: '6.75rem',
        ['--lp-toolbar-h' as string]: '2.75rem',
        ['--builder-left-offset' as string]:
          'calc(var(--app-sidebar-width, 16rem) + 1.5rem)',
      }}
    >
      {!fullscreenPreview ? (
        <LandingPageBuilderToolbar
          viewport={viewport}
          previewOn={fullscreenPreview}
          saving={saving}
          alignToCanvas
          inspectorDocked={inspectorMode === 'docked' || !inspectorDesktop}
          onBack={() => router.push('/landing-pages/pages')}
          onPreviewChange={onPreviewChange}
          onViewportChange={setViewport}
          onUndo={undo}
          onRedo={redo}
          canUndo={historyNav.undo}
          canRedo={historyNav.redo}
          onSave={() => void persist(spec, page.name, { manual: true })}
          onPublish={() => void publish()}
        />
      ) : null}

      {!fullscreenPreview && (spec.meta?.htmlImportNotes?.length || spec.meta?.isolatedScriptCount) ? (
        <div
          className="border-b border-amber-500/30 bg-amber-950/80 px-4 py-2 text-xs leading-relaxed text-amber-50"
          data-lp-html-import-notes
        >
          {(spec.meta.htmlImportNotes?.length
            ? spec.meta.htmlImportNotes
            : [
                `Đã cô lập ${spec.meta.isolatedScriptCount} đoạn JavaScript. Chúng không chạy trong trang quản trị và không chạy trên trang public.`,
              ]
          ).map((note) => (
            <p key={note}>{note}</p>
          ))}
        </div>
      ) : null}

      {actionBarMounted && (saveConflict || pendingLocalDraft) && !fullscreenPreview
        ? createPortal(
            <div
              className="fixed bottom-4 left-1/2 z-[58] flex -translate-x-1/2 items-center gap-2 rounded-xl border border-amber-500/40 bg-zinc-950 px-3 py-2 text-xs shadow-lg"
              data-lp-save-conflict-toast
            >
              <span className="text-amber-200">
                {saveMsg || 'Có bản mới hơn ở nơi khác'}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={resolvingConflict}
                onClick={() => void resolveSaveConflict()}
              >
                {resolvingConflict ? 'Đang tải…' : 'Tải bản mới nhất'}
              </Button>
              {pendingLocalDraft ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={resolvingConflict}
                  onClick={() => void recoverPendingLocalDraft()}
                >
                  Khôi phục bản máy
                </Button>
              ) : null}
            </div>,
            document.body,
          )
        : null}

      {actionBarMounted && doctorUndoVersion != null && !fullscreenPreview
        ? createPortal(
            <div
              className="fixed bottom-4 right-4 z-[58] max-[767px]:bottom-20 max-[767px]:right-3"
              data-lp-doctor-undo-toast
            >
              <Button
                size="sm"
                variant="outline"
                disabled={saving || doctorBusy}
                onClick={() => void undoDoctorApply()}
              >
                Hoàn tác Page Doctor
              </Button>
            </div>,
            document.body,
          )
        : null}

      {/* Full-viewport preview shell: toolbar only + real-page canvas (hides all editor chrome). */}
      {actionBarMounted && fullscreenPreview
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex flex-col bg-white"
              data-lp-preview-shell="1"
              data-lp-fullscreen-preview-surface="1"
              data-lp-toolbar-only="1"
            >
              <LandingPageBuilderToolbar
                hideBack
                viewport={viewport}
                previewOn
                saving={saving}
                onBack={() => router.push('/landing-pages/pages')}
                onPreviewChange={onPreviewChange}
                onViewportChange={setViewport}
                onUndo={undo}
                onRedo={redo}
                canUndo={historyNav.undo}
                canRedo={historyNav.redo}
                onSave={() => void persist(spec, page.name, { manual: true })}
                onPublish={() => void publish()}
              />
              <div
                className="relative z-0 min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain bg-white [transform:translateZ(0)]"
                data-lp-preview-canvas="1"
                data-lp-preview-full-canvas="1"
                data-lp-canvas-scroll="1"
              >
                <div
                  className={
                    viewport === 'mobile'
                      ? 'mx-auto min-h-full w-full max-w-[390px]'
                      : viewport === 'tablet'
                        ? 'mx-auto min-h-full w-full max-w-[768px]'
                        : 'mx-auto min-h-full w-full max-w-full'
                  }
                >
                  <LandingPageRenderer
                    spec={spec}
                    viewport={viewport}
                    mode="preview"
                    className="mx-auto w-full"
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {!fullscreenPreview && doctorOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/70 p-4 pt-16">
          <div className="w-full max-w-2xl rounded-xl border border-white/15 bg-zinc-950 p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <div className="text-sm font-semibold">✨ AI Page Doctor</div>
                <p className="text-xs opacity-60">Chỉ đề xuất — không tự publish / đổi tracking.</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setDoctorOpen(false)}>
                Đóng
              </Button>
            </div>
            {doctorError ? (
              <div className="mb-3 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                {doctorError}
                <div className="mt-2">
                  <Button size="sm" variant="outline" disabled={doctorBusy} onClick={() => void runPageDoctor()}>
                    Thử lại
                  </Button>
                </div>
              </div>
            ) : null}
            {doctorBusy && !doctorReport ? (
              <p className="text-sm opacity-70">Đang phân tích…</p>
            ) : doctorReport ? (
              <div className="space-y-3">
                <div className="text-2xl font-semibold">
                  Điểm tổng: {doctorReport.overallScore}
                  <span className="text-sm font-normal opacity-50">/100</span>
                </div>
                <div className="max-h-48 space-y-1.5 overflow-auto text-xs">
                  {doctorReport.findings.map((f) => (
                    <div key={f.dim} className="rounded border border-white/10 px-2 py-1.5">
                      <span className="font-medium">
                        {f.status === 'good' ? '✓' : '⚠'} {f.dim}
                      </span>{' '}
                      <span className="opacity-50">({f.score})</span>
                      <div className="opacity-80">{f.message}</div>
                      {f.suggestion ? <div className="text-amber-200/80">{f.suggestion}</div> : null}
                    </div>
                  ))}
                </div>
                <div className="border-t border-white/10 pt-3">
                  <div className="mb-2 text-xs font-semibold uppercase opacity-60">
                    Tối ưu tự động — xem thay đổi trước khi Apply
                  </div>
                  <div className="max-h-56 space-y-2 overflow-auto">
                    {(doctorReport.patches || []).map((p) => (
                      <label
                        key={p.id}
                        className="flex cursor-pointer gap-2 rounded border border-white/10 p-2 text-xs"
                      >
                        <input
                          type="checkbox"
                          checked={!!selectedPatches[p.id]}
                          onChange={(e) =>
                            setSelectedPatches((s) => ({ ...s, [p.id]: e.target.checked }))
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <div className="font-medium">{p.label}</div>
                          <div className="opacity-50">{p.path}</div>
                          {p.before ? (
                            <div className="truncate text-red-300/80">− {p.before}</div>
                          ) : null}
                          <div className="truncate text-emerald-300/90">+ {p.after}</div>
                        </span>
                      </label>
                    ))}
                    {!doctorReport.patches?.length ? (
                      <p className="opacity-60">Không có patch tự động — chỉnh thủ công theo gợi ý.</p>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      disabled={doctorBusy || !doctorReport.patches?.length}
                      onClick={() => void applyDoctorPatches()}
                    >
                      Apply các thay đổi đã chọn
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setDoctorOpen(false)}>
                      Huỷ
                    </Button>
                  </div>
                  {doctorReport.warnings?.length ? (
                    <p className="mt-2 text-[10px] opacity-50">{doctorReport.warnings.join(' · ')}</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Left sidebar removed — Layers / Theme / Add / AI live on right Inspector rail (+ Thành phần / Thiết kế tổng thể). */}

      {!fullscreenPreview ? (
      <div
        className={
          // max-lg rows: canvas gets the leftover viewport (scrollport); inspector keeps 70vh.
          // Without 1fr on the canvas row, both rows size to content → canvas never overflows
          // and overscroll-none blocks wheel chaining — same dead-wheel symptom as desktop.
          // Rail mode: reserve a right spacer so fixed Inspector does not cover the LP preview
          // (editor viewport only — does not mutate freeLayout / zoom store / device viewport).
          'grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-2 overflow-hidden overscroll-none max-[767px]:touch-pan-y lg:grid-rows-[minmax(0,1fr)] ' +
          (useInspectorRail
            ? 'lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-0'
            : 'lg:grid-cols-[minmax(0,1fr)]')
        }
        data-lp-builder-layout
        data-lp-fixed-panels="1"
        data-lp-mobile-overflow-guard="1"
        data-lp-inspector-mode={inspectorMode}
        data-lp-inspector-dock={useInspectorRail ? (inspectorPanelOpen ? 'open' : 'rail') : undefined}
        style={{
          ['--builder-top-offset' as string]: '6.75rem',
          ['--builder-left-offset' as string]:
            'calc(var(--app-sidebar-width, 16rem) + 1.5rem)',
          ...(useInspectorRail
            ? {
                ['--lp-inspector-dock-w' as string]: `${inspectorDockReservePx(
                  inspectorPanelOpen,
                  inspectorPanelWidthPx,
                )}px`,
              }
            : null),
        }}
      >
        <LandingPageMediaModal
          open={mediaOpen}
          pageId={pageId}
          onClose={() => {
            textBoxMediaRef.current = null;
            sectionMediaRef.current = null;
            setMediaOpen(false);
          }}
          onUse={(item) => applyMediaToSelection(item)}
        />

        <LandingPageSectionLibraryModal
          open={sectionLibraryOpen}
          onClose={() => {
            setSectionLibraryOpen(false);
            sectionLibraryPosRef.current = null;
          }}
          onInsertTemplate={insertLibrarySectionTemplate}
          onInsertBlank={insertBlankSection}
          pageTheme={spec.theme}
          pageThemeTokens={spec.themeTokens}
        />

        <LandingPageButtonLibraryModal
          open={buttonLibraryOpen}
          onClose={() => {
            setButtonLibraryOpen(false);
            buttonLibraryPosRef.current = null;
          }}
          onInsertTemplate={insertLibraryButtonTemplate}
        />

        {textAiPopover ? (
          <LpCanvasAiQuickPopover
            state={textAiPopover}
            pageId={pageId}
            onClose={() => setTextAiPopover(null)}
            onApply={(value, mode) => {
              applyContextAiField(textAiPopover.blockId, textAiPopover.field, value, mode);
              setTextAiPopover(null);
            }}
          />
        ) : null}

        <div
          ref={canvasScrollRef}
          className={
            'relative z-0 h-full min-h-0 min-w-0 max-h-full overflow-y-auto overscroll-contain rounded-lg border border-white/10 bg-neutral-950/40 p-3 [transform:translateZ(0)] ' +
            (viewport === 'desktop' ? 'overflow-x-auto ' : 'overflow-x-hidden ') +
            'max-[767px]:pb-24 max-[767px]:touch-pan-y ' +
            LP_THIN_SCROLL
          }
          data-lp-canvas-scroll
          data-lp-canvas-below-toolbar="1"
          data-lp-viewport-min="360"
          data-lp-viewport={viewport}
          data-lp-mobile-touch-safe={viewport === 'mobile' ? '1' : undefined}
          data-lp-canvas-scroll-mode="internal"
          data-lp-toolbar-anchor="1"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}
          onWheel={(e) => {
            handleCanvasZoomWheel(e);
          }}
          onClick={(e) => {
            // Tap empty canvas chrome → deselect (blocks stopPropagation).
            if (e.target === e.currentTarget) deselectCanvas();
          }}
        >
          <div
            data-lp-canvas-backdrop
            className={viewport !== 'desktop' ? 'min-h-[560px]' : undefined}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest?.('[data-lp-html-document]')) return;
              if ((e.target as HTMLElement).closest?.('[data-lp-block-id]')) return;
              if ((e.target as HTMLElement).closest?.('[data-lp-device-screen]')) return;
              setHtmlNode(null);
              deselectCanvas();
            }}
          >
            <LandingPageCanvasZoomLayer>
            <LandingPageCanvasContextMenu
              actions={{
                pageId,
                selectedBlock: selected,
                selectedElement,
                canPasteBlock: Boolean(blockClipboardRef.current),
                canPasteStyle: Boolean(styleClipboardRef.current),
                onSelectFromTarget: (blockId, element) => {
                  const el = (parseElementKey(element) ||
                    element ||
                    'section') as LandingPageCanvasElementKey;
                  selectCanvas(
                    normalizeLpSelectionTarget({
                      blockId,
                      element: el,
                    }),
                  );
                },
                onClearSelection: () => deselectCanvas(),
                onUndo: () => undo(),
                onRedo: () => redo(),
                onDuplicate: (blockId) => dupBlock(blockId),
                onDelete: (blockId) => removeBlock(blockId),
                onCopyBlock: copyBlockToClipboard,
                onPasteBlock: pasteBlockFromClipboard,
                onCopyStyle: copyStyleToClipboard,
                onPasteStyle: pasteStyleFromClipboard,
                onMoveLayer: (blockId, direction) => moveBlock(blockId, direction),
                onToggleLock: toggleBlockLock,
                onAlign: alignSelected,
                onToggleGroup: toggleBlockGroup,
                onInsertSection: insertSectionRelative,
                onReplaceImage: (blockId) => {
                  selectCanvas({ blockId: blockId, element: 'image' });
                  setMediaOpen(true);
                },
                onImageFit: setImageFit,
                onFocusInlineEdit: focusInlineEditField,
                onFocusButtonLink: focusButtonLink,
                onApplyField: applyContextAiField,
              }}
            >
              {viewport === 'desktop' ? (
                <LandingPageRenderer
                  spec={spec}
                  viewport={viewport}
                  interactive
                  selectedBlockId={selectedBlockId}
                  onSelectBlock={(id) => {
                    setSelectedBlockId(id);
                  }}
                  canvas={canvasHandlers}
                  onHtmlSourceChange={applyHtmlSource}
                  onHtmlSectionChange={applyHtmlSection}
                  htmlSelectedNodeId={htmlNode?.id ?? null}
                  onHtmlSelectNode={selectHtmlNode}
                  onHtmlBindPatch={(patch) => {
                    htmlPatchRef.current = patch;
                  }}
                />
              ) : (
                <LandingPageDeviceFrame device={viewport}>
                  <LandingPageRenderer
                    spec={spec}
                    viewport={viewport}
                    interactive
                    selectedBlockId={selectedBlockId}
                    onSelectBlock={(id) => {
                      setSelectedBlockId(id);
                    }}
                    canvas={canvasHandlers}
                    onHtmlSourceChange={applyHtmlSource}
                  onHtmlSectionChange={applyHtmlSection}
                    htmlSelectedNodeId={htmlNode?.id ?? null}
                    onHtmlSelectNode={selectHtmlNode}
                    onHtmlBindPatch={(patch) => {
                      htmlPatchRef.current = patch;
                    }}
                  />
                </LandingPageDeviceFrame>
              )}
            </LandingPageCanvasContextMenu>
            </LandingPageCanvasZoomLayer>
          </div>
          {/* Zoom chrome hidden — canvas zoom/scale still active via wheel + internal store. */}
        </div>

        {!fullscreenPreview ? (
          <LandingPageElementVerticalToolbar
            enabled
            canvasRootRef={canvasScrollRef}
            primaryTarget={primaryTarget}
            onSelect={(t) =>
              selectCanvas({
                blockId: t.blockId,
                element: t.element,
                field: t.field,
              })
            }
            onSave={saveTargetToSavedLibrary}
            onDuplicate={duplicateToolbarTarget}
            onDelete={deleteToolbarTarget}
            sectionLocked={isSectionLocked}
          />
        ) : null}

        <div
          ref={setDockedInspectorHost}
          className={
            !inspectorDesktop
              ? // Tablet/mobile: this IS the real portal host for the interactive
                // Inspector (see portal target below) — must stay clickable and
                // visible to assistive tech. It sits in-flow below the canvas
                // (single-column grid below `lg`), so cap its height to a fixed
                // share of the viewport (own internal scroll) instead of forcing
                // 100dvh, which would assume it starts at the viewport top.
                'relative min-h-0 min-w-0 h-[70vh] max-h-[70vh]'
              : inspectorMode === 'docked'
                ? // Desktop docked: layout spacer for fixed portal Inspector.
                  // Width tracks panel open/close so canvas scrollport shrinks —
                  // zoom layer ResizeObserver reflows preview width only (no spec).
                  'pointer-events-none relative min-h-0 h-full shrink-0'
                : 'hidden'
          }
          aria-hidden={!inspectorDesktop ? undefined : true}
          data-lp-inspector-slot
          data-lp-inspector-slot-mode={inspectorMode}
          data-lp-inspector-dock-spacer={useInspectorRail ? '1' : undefined}
          style={
            useInspectorRail
              ? {
                  width: 'var(--lp-inspector-dock-w)',
                  transition: 'width 200ms ease',
                }
              : undefined
          }
        />
        {(actionBarMounted && inspectorDesktop
          ? document.body
          : !inspectorDesktop
            ? dockedInspectorHost
            : null)
          ? createPortal(
        <div
          className={useInspectorRail ? 'pointer-events-auto flex flex-row-reverse items-stretch gap-2' : undefined}
          data-lp-inspector-shell={useInspectorRail ? '1' : undefined}
          data-lp-inspector-panel-open={useInspectorRail ? (inspectorPanelOpen ? '1' : '0') : undefined}
          onPointerDown={useInspectorRail ? (e) => e.stopPropagation() : undefined}
          onMouseDown={useInspectorRail ? (e) => e.stopPropagation() : undefined}
          style={
            useInspectorRail
              ? {
                  position: 'fixed',
                  top: 'var(--builder-top-offset, 6.75rem)',
                  right: '0.75rem',
                  height: 'calc(100dvh - var(--builder-top-offset, 6.75rem) - 0.5rem)',
                  maxHeight: 'calc(100dvh - var(--builder-top-offset, 6.75rem) - 0.5rem)',
                  zIndex: 56,
                }
              : { display: 'contents' }
          }
        >
          {useInspectorRail ? (
            <LandingPageInspectorRail
              active={inspectorActiveRail}
              onSelect={handleInspectorRailSelect}
            />
          ) : null}
        <aside
          ref={inspectorPanelRef}
          className={
            inspectorDesktop
              ? 'flex min-w-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0A3D30] shadow-2xl'
              : 'flex h-full max-h-full min-h-0 w-full max-w-[360px] min-w-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-transparent'
          }
          data-lp-inspector
          data-lp-inspector-fixed="1"
          data-lp-inspector-mode={inspectorMode}
          data-lp-inspector-tab={inspectorTab}
          data-lp-inspector-canvas-first="1"
          data-lp-inspector-viewport-fit="1"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={
            inspectorDesktop
              ? useInspectorRail
                ? inspectorPanelOpen
                  ? {
                      width: inspectorPanelWidthPx,
                      height: '100%',
                      maxHeight: '100%',
                    }
                  : { display: 'none' }
                : inspectorMode === 'floating'
                  ? {
                      position: 'fixed',
                      left: floatingPosition.x,
                      top: floatingPosition.y,
                      width: 240,
                      zIndex: 60,
                      maxHeight: `min(calc(100dvh - ${Math.max(0, floatingPosition.y)}px - 0.5rem), calc(100dvh - 0.75rem))`,
                    }
                  : {
                      position: 'fixed',
                      top: 'var(--builder-top-offset, 6.75rem)',
                      right: '0.75rem',
                      width: 240,
                      height: 'calc(100dvh - var(--builder-top-offset, 6.75rem) - 0.5rem)',
                      maxHeight: 'calc(100dvh - var(--builder-top-offset, 6.75rem) - 0.5rem)',
                      zIndex: 56,
                    }
              : {
                  height: '100%',
                  maxHeight: '100%',
                }
          }
        >
          <div
            className="z-10 shrink-0 space-y-1.5 border-b border-white/10 bg-[#0A3D30]/95 px-3 pb-1.5 pt-2 backdrop-blur-sm"
            data-lp-inspector-sticky
          >
          <div
            ref={inspectorDragHandleRef}
            data-lp-inspector-header
            data-lp-inspector-drag-handle={
              inspectorMode === 'floating' && inspectorDesktop ? '1' : undefined
            }
            className={
              'flex shrink-0 items-center gap-2 ' +
              (inspectorMode === 'floating' && inspectorDesktop
                ? 'cursor-grab active:cursor-grabbing select-none'
                : '')
            }
            onPointerDown={onInspectorDragPointerDown}
          >
            {useInspectorRail ? (
              <>
                <div
                  className="min-w-0 flex-1 truncate text-sm font-semibold text-white"
                  data-lp-inspector-title
                  title={inspectorPanelTitle}
                >
                  {inspectorPanelTitle}
                </div>
                <button
                  type="button"
                  data-lp-inspector-close
                  title="Đóng panel"
                  aria-label="Đóng panel"
                  className="shrink-0 rounded-md border border-white/15 px-2 py-1 text-xs text-white/80 hover:bg-white/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setInspectorPanelOpen(false);
                  }}
                >
                  ✕
                </button>
              </>
            ) : (
              <>
                <div className="text-xs font-semibold uppercase opacity-60">Inspector</div>
                <button
                  type="button"
                  data-lp-inspector-expand
                  title={
                    inspectorMode === 'docked'
                      ? 'Phóng sidebar (floating)'
                      : 'Gắn lại sidebar (docked)'
                  }
                  className="ml-auto hidden rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-white/80 hover:bg-white/10 lg:inline-flex"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleInspectorMode();
                  }}
                >
                  {inspectorMode === 'docked' ? 'Phóng' : 'Gắn'}
                </button>
              </>
            )}
          </div>
          {!useInspectorRail ? (
          <div className="flex gap-1 rounded-lg border border-white/10 p-0.5" data-lp-inspector-tabs>
            {(
              [
                { id: 'add' as const, label: 'Thêm' },
                { id: 'design' as const, label: 'Thiết kế' },
                { id: 'content' as const, label: 'Nội dung' },
                { id: 'advanced' as const, label: 'Nâng cao' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                data-lp-inspector-tab-btn={tab.id}
                className={`flex-1 rounded-md px-1.5 py-1.5 text-[10px] font-medium transition ${
                  inspectorTab === tab.id
                    ? 'bg-white/15 text-white'
                    : 'text-white/55 hover:bg-white/5 hover:text-white/80'
                }`}
                onClick={() => setInspectorTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          ) : null}
          </div>

          <div
            className={
              (useInspectorRail && inspectorRailSurface === 'add-components') ||
              inspectorTab === 'add'
                ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
                : 'min-h-0 flex-1 space-y-2.5 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-2 ' +
                  LP_THIN_SCROLL
            }
            data-lp-inspector-scroll
            data-lp-inspector-add-components={
              (useInspectorRail && inspectorRailSurface === 'add-components') ||
              inspectorTab === 'add'
                ? '1'
                : undefined
            }
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >

          {((useInspectorRail && inspectorRailSurface === 'add-components') ||
            (!useInspectorRail && inspectorTab === 'add')) ? (
            <LandingPageAddComponentsPanel
              key={addPanelNonce}
              initialRootMode={addPanelInitial.rootMode}
              initialAddTab={addPanelInitial.addTab}
              onAddBlock={addBlock}
              onAddBlocks={addBlocks}
              onOpenMediaLibrary={() => setMediaOpen(true)}
              onOpenSectionLibrary={() => openSectionLibrary(null)}
              onOpenButtonLibrary={() => openButtonLibrary(null)}
              onInsertTitlePreset={insertTitlePreset}
              onInsertParagraphPreset={insertParagraphPreset}
              onInsertListPreset={insertListPreset}
              onInsertButtonPreset={insertButtonPreset}
              onInsertButtonGroupPreset={insertButtonGroupPreset}
              onInsertBoxPreset={insertBoxPreset}
              onInsertFormPreset={insertFormPreset}
              blocks={spec.blocks}
              selectedBlockId={selectedId}
              onSelectBlock={(id) => {
                selectCanvas({ blockId: id, element: 'section' });
              }}
              onReorderBlocks={(fromIndex, toIndex) => {
                const moving = spec.blocks[fromIndex];
                if (moving?.locked) {
                  setSaveMsg('Section đang khóa — mở khóa trước khi di chuyển');
                  return;
                }
                pushHistory(
                  sanitizeLandingPageDraftSpec({
                    ...spec,
                    blocks: reorderBlocks(spec.blocks, fromIndex, toIndex),
                  }),
                );
              }}
              onDupBlock={dupBlock}
              onRemoveBlock={removeBlock}
              aiMenu={
                <LandingPageAiMenu
                  placement="sidebar"
                  pageId={pageId}
                  pageName={page.name}
                  spec={spec}
                  selectedBlock={selected}
                  doctorBusy={doctorBusy}
                  disabled={saving}
                  onApplySpec={(next, note) => {
                    pushHistory(sanitizeLandingPageDraftSpec(next));
                    setSaveMsg(note);
                  }}
                  onApplyBlockFields={(blockId, patch, note) => {
                    const keys = Object.keys(patch).map((f) => `${blockId}.${f}`);
                    const current = specRef.current;
                    const next = {
                      ...current,
                      blocks: current.blocks.map((b) =>
                        b.id === blockId ? ({ ...b, ...patch } as LandingPageBlock) : b,
                      ),
                    };
                    pushHistory(markLandingPageFieldSources(next, keys, 'ai'));
                    setSaveMsg(note);
                  }}
                  onOpenSectionPresets={() => {
                    openRightAddComponents({ rootMode: 'add', addTab: 'presets' });
                  }}
                  onPageDoctor={() => void runPageDoctor()}
                />
              }
            />
          ) : null}

          {useInspectorRail && inspectorRailSurface === 'page-theme' ? (
            <LandingPageInspectorGlobalDesign
              spec={spec}
              productName={page?.name}
              onChange={(next) => {
                const current = specRef.current;
                pushHistory(
                  sanitizeLandingPageDraftSpec({
                    ...current,
                    theme: next.theme,
                    themeTokens: next.themeTokens,
                    meta: {
                      ...(current.meta || {}),
                      ...(next.meta || {}),
                      themePreset: next.meta?.themePreset ?? current.meta?.themePreset,
                      themeUserLocked: true,
                    },
                  }),
                );
              }}
            />
          ) : null}

          {htmlInspectorActive && htmlNode && inspectorRailSurface !== 'page-theme' && inspectorRailSurface !== 'add-components' ? (
            <LandingPageHtmlInspector
              node={htmlNode}
              tab={inspectorTab}
              onLive={(patch) => {
                if (selectedBlockId && specRef.current.blocks.find((block) => block.id === selectedBlockId)?.locked) {
                  return;
                }
                const next = htmlPatchRef.current?.(htmlNode.id, patch, false);
                if (next) setHtmlNode(next);
              }}
              onCommit={(patch) => {
                if (selectedBlockId && specRef.current.blocks.find((block) => block.id === selectedBlockId)?.locked) {
                  setSaveMsg('Section đang khóa — mở khóa trước khi chỉnh sửa');
                  return;
                }
                const next = htmlPatchRef.current?.(htmlNode.id, patch, true);
                if (next) setHtmlNode(next);
              }}
            />
          ) : null}

          {!htmlInspectorActive && isButtonInspector &&
          selected &&
          (!useInspectorRail ||
            (inspectorRailSurface !== 'page-theme' &&
              inspectorRailSurface !== 'add-components')) &&
          (useInspectorRail || inspectorTab !== 'add') ? (
            <LandingPageButtonInspector
              block={selected}
              labelField={
                inspectorTextFieldKey(selectedElement, primaryTarget?.field) || 'ctaLabel'
              }
              textStyle={(() => {
                const field =
                  inspectorTextFieldKey(selectedElement, primaryTarget?.field) || 'ctaLabel';
                const map =
                  (
                    spec.meta as
                      | { inlineTextStyles?: Record<string, LandingPageInlineTextStyle> }
                      | undefined
                  )?.inlineTextStyles || {};
                return map[`${selected.id}::${field}`] || null;
              })()}
              isHidden={(() => {
                const field =
                  inspectorTextFieldKey(selectedElement, primaryTarget?.field) || 'ctaLabel';
                const key = elementStyleKey(selected.id, field);
                return Boolean(
                  (spec.meta as { elementHidden?: Record<string, boolean> } | undefined)
                    ?.elementHidden?.[key],
                );
              })()}
              isLocked={(() => {
                const field =
                  inspectorTextFieldKey(selectedElement, primaryTarget?.field) || 'ctaLabel';
                if (isSectionLocked(selected.id)) return true;
                const key = elementStyleKey(selected.id, field);
                return Boolean(
                  (spec.meta as { elementLocked?: Record<string, boolean> } | undefined)
                    ?.elementLocked?.[key],
                );
              })()}
              onUpdateBlock={updateBlock}
              onPatchTextStyle={(patch) => {
                const field =
                  inspectorTextFieldKey(selectedElement, primaryTarget?.field) || 'ctaLabel';
                canvasActionRef.current.patchInlineTextStyle(selected.id, field, patch);
              }}
              onLiveLabel={(value) => {
                const field =
                  inspectorTextFieldKey(selectedElement, primaryTarget?.field) || 'ctaLabel';
                canvasActionRef.current.updateBlockFieldLive(selected.id, field, value);
              }}
              onCommitLabel={(value) => {
                const field =
                  inspectorTextFieldKey(selectedElement, primaryTarget?.field) || 'ctaLabel';
                canvasActionRef.current.updateBlockFieldCommit(selected.id, field, value);
              }}
              onToggleHidden={() => {
                const field =
                  inspectorTextFieldKey(selectedElement, primaryTarget?.field) || 'ctaLabel';
                canvasActionRef.current.toggleElementHidden(selected.id, field);
              }}
              onToggleLock={() => {
                const field =
                  inspectorTextFieldKey(selectedElement, primaryTarget?.field) || 'ctaLabel';
                canvasActionRef.current.toggleElementLock(selected.id, field);
              }}
            />
          ) : null}

          {!htmlInspectorActive && isIconInspector &&
          selected &&
          (!useInspectorRail ||
            (inspectorRailSurface !== 'page-theme' &&
              inspectorRailSurface !== 'add-components')) &&
          (useInspectorRail || inspectorTab !== 'add') ? (
            <LandingPageIconInspector
              block={selected}
              elementKey={
                typeof selectedElement === 'string' &&
                selectedElement.startsWith('item:trust-icon-')
                  ? selectedElement
                  : typeof primaryTarget?.field === 'string' &&
                      primaryTarget.field.startsWith('item:trust-icon-')
                    ? primaryTarget.field
                    : typeof primaryTarget?.element === 'string' &&
                        primaryTarget.element.startsWith('item:trust-icon-')
                      ? primaryTarget.element
                      : null
              }
              onUpdateBlock={updateBlock}
            />
          ) : null}

          {!htmlInspectorActive && !isButtonInspector &&
          !isIconInspector &&
          (!useInspectorRail ||
            (inspectorRailSurface !== 'page-theme' &&
              inspectorRailSurface !== 'add-components')) &&
          inspectorTab === 'content' ? (
          <div className="space-y-3" data-lp-inspector-content data-lp-canvas-first="1" data-lp-context-aware="1">
          {(() => {
            const ctx = resolveInspectorContext(selected, selectedElement, primaryTarget?.field);
            const el = selectedElement;
            const isItemEl = typeof el === 'string' && el.startsWith('item:');
            return (
              <>
          {!selected ? (
            <InspectorEmptyHint>Chọn một phần tử trên canvas.</InspectorEmptyHint>
          ) : (
            <div
              className="space-y-2"
              data-inspector-block-id={selected.id}
              data-selected-block-id={selectedBlockId || ''}
              data-lp-content-focus={ctx.dataAttr}
              data-lp-context={ctx.dataAttr}
            >
              {!useInspectorRail ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{ctx.label}</div>
                  {ctx.kind === 'section' ||
                  ctx.kind === 'form' ||
                  ctx.kind === 'video' ||
                  ctx.kind === 'countdown' ? (
                    <label className="flex items-center gap-1.5 text-[11px] opacity-80">
                      <input
                        type="checkbox"
                        checked={selected.enabled}
                        onChange={(e) => updateBlock(selected.id, { enabled: e.target.checked })}
                      />
                      Hiện
                    </label>
                  ) : null}
                </div>
              ) : null}

              <LandingPageInspectorElementActions
                hideVisibilityControls={useInspectorRail}
                contextKind={ctx.kind}
                sectionLocked={isSectionLocked(selected.id)}
                allowSectionReorder={
                  ctx.kind === 'section' || ctx.kind === 'form' || ctx.kind === 'video' || ctx.kind === 'countdown'
                }
                canReplaceImage={(() => {
                  const b = selected;
                  if ('imageUrl' in b) return true;
                  if (b.type === 'Gallery' || b.type === 'Product' || b.type === 'Hero') return true;
                  if (b.type === 'CTA' && isLandingPageBoxStyle(b.style as Record<string, unknown> | undefined)) {
                    return true;
                  }
                  return false;
                })()}
                isTextHidden={(() => {
                  const field = inspectorTextFieldKey(selectedElement, primaryTarget?.field);
                  if (!field) return false;
                  const key = elementStyleKey(selected.id, field);
                  return Boolean(
                    (spec.meta as { elementHidden?: Record<string, boolean> } | undefined)?.elementHidden?.[
                      key
                    ],
                  );
                })()}
                isTextLocked={(() => {
                  const field = inspectorTextFieldKey(selectedElement, primaryTarget?.field);
                  if (!field) return false;
                  if (isSectionLocked(selected.id)) return true;
                  const key = elementStyleKey(selected.id, field);
                  return Boolean(
                    (spec.meta as { elementLocked?: Record<string, boolean> } | undefined)?.elementLocked?.[
                      key
                    ],
                  );
                })()}
                onMoveUp={() => canvasActionRef.current.moveBlock(selected.id, 'up')}
                onMoveDown={() => canvasActionRef.current.moveBlock(selected.id, 'down')}
                onDuplicate={() => {
                  const field = inspectorTextFieldKey(selectedElement, primaryTarget?.field);
                  const itemM =
                    field &&
                    /^(?:itemTitle|itemDesc|itemQuestion|itemAnswer|itemQuote|itemAuthor|planName|planPrice|planCta|fieldLabel):(.+)$/.exec(
                      field,
                    );
                  if (itemM?.[1]) {
                    canvasActionRef.current.dupItem(selected.id, itemM[1]);
                    return;
                  }
                  const el = selectedElement;
                  const prefer =
                    el === 'headline' ||
                    el === 'subheadline' ||
                    el === 'body' ||
                    el === 'cta' ||
                    (typeof el === 'string' && el.startsWith('item:'))
                      ? el
                      : undefined;
                  canvasActionRef.current.dupBlock(selected.id, prefer);
                }}
                onDelete={() => canvasActionRef.current.removeBlock(selected.id)}
                onAi={
                  ctx.kind === 'section' || ctx.kind === 'form'
                    ? () => canvasActionRef.current.focusInspectorAi(selected.id)
                    : undefined
                }
                onReplaceImage={() => canvasActionRef.current.triggerReplaceImage(selected.id)}
                onCopy={() => canvasActionRef.current.copyBlockToClipboard(selected.id)}
                onCopyStyle={() => canvasActionRef.current.copyStyleToClipboard(selected.id)}
                onSaveAsset={() => {
                  const field = inspectorTextFieldKey(selectedElement, primaryTarget?.field);
                  if (field) canvasActionRef.current.saveTextAsset(selected.id, field);
                }}
                onSyncFromMobile={() => {
                  const field = inspectorTextFieldKey(selectedElement, primaryTarget?.field);
                  if (field) canvasActionRef.current.syncDesignFromMobile(selected.id, field);
                }}
                onToggleHidden={() => {
                  const field = inspectorTextFieldKey(selectedElement, primaryTarget?.field);
                  if (field) canvasActionRef.current.toggleElementHidden(selected.id, field);
                }}
                onToggleLock={() => {
                  const field = inspectorTextFieldKey(selectedElement, primaryTarget?.field);
                  if (field) canvasActionRef.current.toggleElementLock(selected.id, field);
                }}
                onAiPrompt={() => {
                  const field = inspectorTextFieldKey(selectedElement, primaryTarget?.field);
                  if (!field) return;
                  const rect =
                    inspectorPanelRef.current?.getBoundingClientRect() ?? new DOMRect(0, 0, 320, 48);
                  canvasActionRef.current.openTextAiPrompt(selected.id, field, rect);
                }}
              />

              {ctx.kind === 'card' && typeof selectedElement === 'string' && selectedElement.startsWith('item:') ? (
                <LandingPageItemBoxPanel
                  block={selected}
                  itemId={selectedElement.slice('item:'.length)}
                  resolveBlock={() => specRef.current.blocks.find((b) => b.id === selected.id) ?? selected}
                  onUpdateBlock={updateBlock}
                  onPickMedia={() => {
                    const blockId = selected.id;
                    const itemId = selectedElement.slice('item:'.length);
                    textBoxMediaRef.current = (url) => {
                      const current = specRef.current.blocks.find((b) => b.id === blockId);
                      if (!current) return;
                      const prev = readLpItemBoxes((current.style || {}) as Record<string, unknown>)[itemId] || {};
                      updateBlock(blockId, withLpItemBox(current, itemId, { ...prev, mediaOn: true, mediaUrl: url }));
                    };
                    setMediaOpen(true);
                  }}
                />
              ) : null}

              {ctx.kind === 'section' ? (
                <LandingPageSectionSettingsPanel
                  embedded
                  block={selected}
                  pageId={pageId}
                  onUpdateBlock={updateBlock}
                  onPickImage={() => {
                    const blockId = selected.id;
                    sectionMediaRef.current = (url) => {
                      const current = specRef.current.blocks.find((b) => b.id === blockId);
                      if (!current) return;
                      updateBlock(
                        blockId,
                        applySectionSettingsChange(current, { imageUrl: url, mediaOn: true, kind: 'image' }),
                      );
                    };
                    setMediaOpen(true);
                  }}
                />
              ) : null}

              {(() => {
                const field = inspectorTextFieldKey(selectedElement, primaryTarget?.field);
                if ((ctx.kind === 'text' || ctx.kind === 'button') && field) {
                  const textStyle =
                    (
                      spec.meta as
                        | {
                            inlineTextStyles?: Record<
                              string,
                              import('./landing-page-canvas-ux').LandingPageInlineTextStyle
                            >;
                          }
                        | undefined
                    )?.inlineTextStyles?.[`${selected.id}::${field}`] || null;
                  return (
                    <>
                    <LandingPageInspectorTextContent
                      block={selected}
                      field={field}
                      onLive={(value) =>
                        canvasActionRef.current.updateBlockFieldLive(selected.id, field, value)
                      }
                      onCommit={(value) =>
                        canvasActionRef.current.updateBlockFieldCommit(selected.id, field, value)
                      }
                    />
                    {ctx.kind === 'text' ? (
                      <LandingPageTextQuickPanel
                        embedded
                        open
                        block={selected}
                        field={field}
                        textStyle={textStyle}
                        onLive={(value) =>
                          canvasActionRef.current.updateBlockFieldLive(selected.id, field, value)
                        }
                        onCommit={(value) =>
                          canvasActionRef.current.updateBlockFieldCommit(selected.id, field, value)
                        }
                        onPatchBox={(box) =>
                          canvasActionRef.current.patchInlineTextStyle(selected.id, field, { box })
                        }
                        onPickMedia={() => {
                          const blockId = selected.id;
                          textBoxMediaRef.current = (url) => {
                            const map =
                              (
                                specRef.current.meta as
                                  | {
                                      inlineTextStyles?: Record<
                                        string,
                                        import('./landing-page-canvas-ux').LandingPageInlineTextStyle
                                      >;
                                    }
                                  | undefined
                              )?.inlineTextStyles || {};
                            const prev = map[`${blockId}::${field}`]?.box || {};
                            canvasActionRef.current.patchInlineTextStyle(blockId, field, {
                              box: { ...prev, mediaOn: true, mediaUrl: url },
                            });
                          };
                          setMediaOpen(true);
                        }}
                        onClose={() => undefined}
                      />
                    ) : null}
                    </>
                  );
                }
                if (ctx.kind === 'card') return null;
                if (ctx.kind === 'text' || isItemEl) {
                  return (
                    <InspectorEmptyHint>
                      Chọn một vùng chữ trên canvas. Tab <strong>Thiết kế</strong> cho typography.
                    </InspectorEmptyHint>
                  );
                }
                return null;
              })()}

              {ctx.kind === 'section' && selected.type === 'Hero' ? (
                // Single column always: `sm:` is a viewport breakpoint, but this
                // panel's own rendered width (240px docked, up to 360px mobile) is
                // independent of viewport — sm:grid-cols-3 squeezed these fields at
                // any browser width >= 640px regardless of the panel's real width.
                <div className="grid gap-2 rounded border border-white/10 p-2" data-lp-hero-meta>
                  <label className="text-xs">
                    <span className="mb-1 block opacity-60">Ngày</span>
                    <input
                      className="w-full rounded border border-white/10 bg-transparent px-2 py-1.5 text-sm"
                      value={(selected as { eventDate?: string }).eventDate || ''}
                      onChange={(e) =>
                        updateBlock(selected.id, { eventDate: e.target.value } as Partial<LandingPageBlock>)
                      }
                    />
                  </label>
                  <label className="text-xs">
                    <span className="mb-1 block opacity-60">Giờ</span>
                    <input
                      className="w-full rounded border border-white/10 bg-transparent px-2 py-1.5 text-sm"
                      value={(selected as { eventTime?: string }).eventTime || ''}
                      onChange={(e) =>
                        updateBlock(selected.id, { eventTime: e.target.value } as Partial<LandingPageBlock>)
                      }
                    />
                  </label>
                  <label className="text-xs">
                    <span className="mb-1 block opacity-60">Hình thức</span>
                    <input
                      className="w-full rounded border border-white/10 bg-transparent px-2 py-1.5 text-sm"
                      value={(selected as { eventFormat?: string }).eventFormat || ''}
                      onChange={(e) =>
                        updateBlock(selected.id, {
                          eventFormat: e.target.value,
                        } as Partial<LandingPageBlock>)
                      }
                    />
                  </label>
                </div>
              ) : null}

              {ctx.kind === 'section' &&
              !['Hero', 'Video', 'Countdown', 'LeadForm', 'Pricing', 'FAQ', 'Benefits', 'Features', 'Testimonials', 'Process', 'Gallery', 'Product', 'Speaker'].includes(
                selected.type,
              ) ? (
                <InspectorEmptyHint>
                  Double-click chữ trên canvas. Nền / kích thước / khoảng cách: tab{' '}
                  <strong>Thiết kế</strong>.
                </InspectorEmptyHint>
              ) : null}

              {ctx.kind === 'image' && !isItemEl && 'imageUrl' in selected ? (
                <LandingPageImageField
                  pageId={pageId}
                  label="Đổi ảnh"
                  imageUrl={(selected as { imageUrl?: string | null }).imageUrl}
                  imageStyle={(selected as { imageStyle?: import('@marketingspa/shared').LandingPageImageStyle })
                    .imageStyle}
                  onChange={({ imageUrl, imageStyle }) =>
                    updateBlock(selected.id, { imageUrl, imageStyle } as Partial<LandingPageBlock>)
                  }
                />
              ) : null}

              {isItemEl && 'items' in selected ? (
                (() => {
                  const itemId = String(el).slice(5);
                  const items = (
                    selected as {
                      items: Array<{
                        id: string;
                        imageUrl?: string | null;
                        imageStyle?: import('@marketingspa/shared').LandingPageImageStyle;
                      }>;
                    }
                  ).items || [];
                  const item = items.find((it) => it.id === itemId);
                  if (!item) return null;
                  return (
                    <LandingPageImageField
                      pageId={pageId}
                      label="Đổi ảnh card"
                      imageUrl={item.imageUrl}
                      imageStyle={item.imageStyle}
                      onChange={({ imageUrl, imageStyle }) => {
                        const nextItems = items.map((it) =>
                          it.id === itemId ? { ...it, imageUrl, imageStyle } : it,
                        );
                        updateBlock(selected.id, { items: nextItems } as Partial<LandingPageBlock>);
                      }}
                    />
                  );
                })()
              ) : null}

              {ctx.kind === 'form' ? (
                <div className="space-y-2" data-lp-inspector-form>
                  <LandingPageLeadFormFieldsInspector
                    block={selected as import('@marketingspa/shared').LandingPageLeadFormBlock}
                    onChange={(fields) =>
                      updateBlock(selected.id, {
                        fields,
                      } as Partial<LandingPageBlock>)
                    }
                  />
                  <div className="rounded border border-white/10 p-2" data-lp-inspector-crm>
                    <LeadFormCrmInspector
                      block={selected as import('@marketingspa/shared').LandingPageLeadFormBlock}
                      onChange={(crm) =>
                        updateBlock(selected.id, {
                          crm,
                        } as Partial<LandingPageBlock>)
                      }
                    />
                  </div>
                  <p className="text-[10px] opacity-40">
                    Nhãn / placeholder cũng có thể sửa bằng double-click trên canvas.
                  </p>
                </div>
              ) : null}

              {ctx.kind === 'countdown' && selected.type === 'Countdown' ? (
                <div className="space-y-2 rounded border border-white/10 p-2" data-lp-countdown-inspector>
                  <div className="text-[10px] font-semibold uppercase opacity-60">Đồng hồ đếm ngược</div>
                  <Label className="text-xs">Kết thúc lúc</Label>
                  <Input
                    type="datetime-local"
                    value={(() => {
                      const iso = (selected as { endsAt?: string }).endsAt || '';
                      const d = Date.parse(iso);
                      if (Number.isNaN(d)) return '';
                      const local = new Date(d);
                      const pad = (n: number) => String(n).padStart(2, '0');
                      return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}`;
                    })()}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) return;
                      updateBlock(selected.id, {
                        endsAt: new Date(v).toISOString(),
                      } as Partial<LandingPageBlock>);
                    }}
                  />
                  <Label className="text-xs">Múi giờ</Label>
                  <Input
                    value={(selected as { timezone?: string }).timezone || 'Asia/Ho_Chi_Minh'}
                    onChange={(e) =>
                      updateBlock(selected.id, { timezone: e.target.value } as Partial<LandingPageBlock>)
                    }
                  />
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {(
                      [
                        ['showDays', 'Ngày'],
                        ['showHours', 'Giờ'],
                        ['showMinutes', 'Phút'],
                        ['showSeconds', 'Giây'],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={(selected as Record<string, unknown>)[key] !== false}
                          onChange={(e) =>
                            updateBlock(selected.id, {
                              [key]: e.target.checked,
                            } as Partial<LandingPageBlock>)
                          }
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <Label className="text-xs">Kiểu hiển thị</Label>
                  <select
                    className="lp-dark-select w-full rounded-md border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm text-white"
                    value={(selected as { styleVariant?: string }).styleVariant || 'boxes'}
                    onChange={(e) =>
                      updateBlock(selected.id, {
                        styleVariant: e.target.value,
                      } as Partial<LandingPageBlock>)
                    }
                  >
                    <option value="boxes">Ô số</option>
                    <option value="inline">Nằm ngang</option>
                    <option value="minimal">Tối giản</option>
                  </select>
                  <Label className="text-xs">Khi hết giờ</Label>
                  <select
                    className="lp-dark-select w-full rounded-md border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm text-white"
                    value={(selected as { expireBehavior?: string }).expireBehavior || 'zero'}
                    onChange={(e) =>
                      updateBlock(selected.id, {
                        expireBehavior: e.target.value,
                      } as Partial<LandingPageBlock>)
                    }
                  >
                    <option value="zero">Về 0</option>
                    <option value="hide">Ẩn</option>
                    <option value="message">Hiện thông báo</option>
                    <option value="cta">Hiện nút CTA</option>
                  </select>
                  <Label className="text-xs">URL CTA khi hết giờ</Label>
                  <Input
                    value={(selected as { expireCtaUrl?: string }).expireCtaUrl || ''}
                    onChange={(e) =>
                      updateBlock(selected.id, {
                        expireCtaUrl: e.target.value,
                      } as Partial<LandingPageBlock>)
                    }
                  />
                </div>
              ) : null}

              {ctx.kind === 'video' ? (
                <div className="space-y-1.5 rounded-lg border border-white/10 p-2" data-lp-inspector-video>
                  <div className="text-[10px] font-semibold uppercase opacity-60">Video</div>
                  <Label className="text-xs">Nguồn video (URL)</Label>
                  <Input
                    value={(selected as { videoUrl?: string }).videoUrl || ''}
                    onChange={(e) =>
                      updateBlock(selected.id, { videoUrl: e.target.value } as Partial<LandingPageBlock>)
                    }
                    placeholder="https://www.youtube.com/embed/…"
                  />
                </div>
              ) : null}

              {ctx.kind === 'section' && selected.type === 'Pricing' && 'plans' in selected ? (
                <div className="space-y-2 rounded border border-white/10 p-2" data-lp-pricing-inspector>
                  <div className="text-[10px] font-semibold uppercase opacity-60">Gói giá</div>
                  <p className="text-[10px] opacity-45">
                    Double-click tên / giá / nút trên canvas. Dùng tab Thiết kế cho nền &amp; khoảng
                    cách.
                  </p>
                  {((selected as { plans?: Array<{ id: string; name?: string }> }).plans || []).map(
                    (plan, i) => (
                      <div
                        key={plan.id}
                        className="rounded border border-white/5 px-2 py-1.5 text-[11px] text-white/70"
                      >
                        Gói {i + 1}: {plan.name || '(chưa đặt tên)'}
                      </div>
                    ),
                  )}
                </div>
              ) : null}
            </div>
          )}
              </>
            );
          })()}
          </div>
          ) : null}

          {!htmlInspectorActive && !isButtonInspector &&
          !isIconInspector &&
          (!useInspectorRail ||
            (inspectorRailSurface !== 'page-theme' &&
              inspectorRailSurface !== 'add-components')) &&
          inspectorTab === 'design' ? (
            <LandingPageInspectorDesignTab
              selected={selected}
              selectedElement={selectedElement}
              viewport={viewport}
              resolvedFreeLayout={resolvedSelectedFreeLayout}
              onPatchFreeLayout={
                selected
                  ? (layout) => patchBlockFreeLayoutForViewport(selected.id, layout)
                  : undefined
              }
              textField={inspectorTextFieldKey(selectedElement, primaryTarget?.field)}
              textStyle={(() => {
                const field = inspectorTextFieldKey(selectedElement, primaryTarget?.field);
                if (!selected || !field) return null;
                const map =
                  (spec.meta as { inlineTextStyles?: Record<string, import('./landing-page-canvas-ux').LandingPageInlineTextStyle> } | undefined)
                    ?.inlineTextStyles || {};
                return map[`${selected.id}::${field}`] || null;
              })()}
              themePrimary={spec.themeTokens.primary}
              onUpdateBlock={updateBlock}
              onPatchTextStyle={(patch) => {
                const field = inspectorTextFieldKey(selectedElement, primaryTarget?.field);
                if (!selected || !field) return;
                canvasActionRef.current.patchInlineTextStyle(selected.id, field, patch);
              }}
              onThemePrimary={(color) =>
                pushHistory(
                  sanitizeLandingPageDraftSpec({
                    ...spec,
                    themeTokens: {
                      ...spec.themeTokens,
                      primary: color,
                      button: color,
                    },
                    meta: {
                      ...spec.meta,
                      themePreset: 'custom',
                      themeUserLocked: true,
                    },
                  }),
                )
              }
              onPickBackgroundImage={() => {
                if (!selected) return;
                selectCanvas({ blockId: selected.id, element: 'section-background' });
                setMediaOpen(true);
              }}
              onPickTextBoxMedia={() => {
                if (
                  selected &&
                  !primaryTarget?.field &&
                  typeof selectedElement === 'string' &&
                  selectedElement.startsWith('item:') &&
                  !selectedElement.startsWith('item:trust-icon-')
                ) {
                  const blockId = selected.id;
                  const itemId = selectedElement.slice('item:'.length);
                  textBoxMediaRef.current = (url) => {
                    const current = specRef.current.blocks.find((b) => b.id === blockId);
                    if (!current) return;
                    const prev = readLpItemBoxes((current.style || {}) as Record<string, unknown>)[itemId] || {};
                    updateBlock(blockId, withLpItemBox(current, itemId, { ...prev, mediaOn: true, mediaUrl: url }));
                  };
                  setMediaOpen(true);
                  return;
                }
                const field = inspectorTextFieldKey(selectedElement, primaryTarget?.field);
                if (!selected || !field) return;
                const blockId = selected.id;
                textBoxMediaRef.current = (url) => {
                  const map =
                    (
                      specRef.current.meta as
                        | {
                            inlineTextStyles?: Record<
                              string,
                              import('./landing-page-canvas-ux').LandingPageInlineTextStyle
                            >;
                          }
                        | undefined
                    )?.inlineTextStyles || {};
                  const prev = map[`${blockId}::${field}`]?.box || {};
                  canvasActionRef.current.patchInlineTextStyle(blockId, field, {
                    box: { ...prev, mediaOn: true, mediaUrl: url },
                  });
                };
                setMediaOpen(true);
              }}
              hidePageTheme={useInspectorRail}
              hideElementCustomCss={useInspectorRail}
            />
          ) : null}

          {!htmlInspectorActive && !isButtonInspector &&
          !isIconInspector &&
          (!useInspectorRail ||
            (inspectorRailSurface !== 'page-theme' &&
              inspectorRailSurface !== 'add-components')) &&
          inspectorTab === 'advanced' ? (
            <div className="space-y-2" data-lp-inspector-advanced data-lp-advanced-accordions="1">
              {selected && useInspectorRail ? (
                <InspectorAccordion title="Khóa &amp; hiển thị" data-lp="advanced-visibility" defaultOpen>
                  <div className="space-y-2" data-lp-inspector-visibility-controls>
                    {(() => {
                      const ctx = resolveInspectorContext(
                        selected,
                        selectedElement,
                        primaryTarget?.field,
                      );
                      const field = inspectorTextFieldKey(selectedElement, primaryTarget?.field);
                      const hiddenKey = field ? elementStyleKey(selected.id, field) : null;
                      const isTextHidden =
                        hiddenKey &&
                        Boolean(
                          (spec.meta as { elementHidden?: Record<string, boolean> } | undefined)
                            ?.elementHidden?.[hiddenKey],
                        );
                      const isTextLocked =
                        hiddenKey &&
                        (isSectionLocked(selected.id) ||
                          Boolean(
                            (spec.meta as { elementLocked?: Record<string, boolean> } | undefined)
                              ?.elementLocked?.[hiddenKey],
                          ));
                      return (
                        <>
                          {ctx.kind === 'section' ||
                          ctx.kind === 'form' ||
                          ctx.kind === 'video' ||
                          ctx.kind === 'countdown' ? (
                            <label className="flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={selected.enabled}
                                onChange={(e) =>
                                  updateBlock(selected.id, { enabled: e.target.checked })
                                }
                              />
                              Hiện section trên canvas
                            </label>
                          ) : null}
                          {field ? (
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                className="rounded border border-white/10 px-2 py-1 text-[11px] hover:bg-white/5"
                                onClick={() =>
                                  canvasActionRef.current.toggleElementHidden(selected.id, field)
                                }
                              >
                                {isTextHidden ? 'Hiện phần tử' : 'Ẩn phần tử'}
                              </button>
                              <button
                                type="button"
                                className="rounded border border-white/10 px-2 py-1 text-[11px] hover:bg-white/5"
                                onClick={() =>
                                  canvasActionRef.current.toggleElementLock(selected.id, field)
                                }
                              >
                                {isTextLocked ? 'Mở khóa' : 'Khóa chỉnh sửa'}
                              </button>
                            </div>
                          ) : (
                            <p className="text-[10px] opacity-40">
                              Chọn text / button trên canvas để ẩn hoặc khóa phần tử.
                            </p>
                          )}
                          {selected.locked ? (
                            <p className="text-[10px] text-amber-200/80">
                              Section đang khóa — mở khóa trên canvas hoặc context menu.
                            </p>
                          ) : null}
                        </>
                      );
                    })()}
                  </div>
                </InspectorAccordion>
              ) : null}
              <InspectorAccordion title="Responsive" data-lp="advanced-responsive" defaultOpen={false}>
                {selected ? (
                  <LandingPageInspectorResponsiveVisibility
                    block={selected}
                    activeViewport={viewport}
                    onUpdateBlock={updateBlock}
                  />
                ) : (
                  <p className="text-[10px] opacity-40">Chọn section để chỉnh responsive riêng.</p>
                )}
              </InspectorAccordion>

              <InspectorAccordion title="Vị trí nâng cao" data-lp="advanced-position" defaultOpen={false}>
                {selected ? (
                  <div className="space-y-2" data-lp-advanced-free-layout>
                    <p className="text-[10px] opacity-50">
                      Viewport: <strong className="text-white/75">{viewport}</strong> — toạ độ/rotate lưu theo
                      breakpoint đang xem.
                    </p>
                    {selected.locked ? (
                      <p className="text-[10px] text-amber-200/80" data-lp-section-locked-hint>
                        Section đang khóa — mở khóa để chỉnh vị trí.
                      </p>
                    ) : null}
                    <label className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        disabled={selected.locked === true}
                        checked={selected.positionMode === 'free'}
                        onChange={(e) => {
                          if (selected.locked) return;
                          if (e.target.checked) {
                            const prev = selected.freeLayout;
                            const { x, y, width, height } = measureFreeToggleLayout(selected.id, prev);
                            updateBlock(selected.id, {
                              positionMode: 'free',
                              freeLayout: clampAbsoluteFreeLayout({
                                x,
                                y,
                                ...(width ? { width } : {}),
                                height,
                                reserveHeight: height,
                                ...(prev?.rotate != null ? { rotate: prev.rotate } : {}),
                              }),
                            } as Partial<LandingPageBlock>);
                          } else {
                            updateBlock(selected.id, {
                              positionMode: 'flow',
                            } as Partial<LandingPageBlock>);
                          }
                        }}
                      />
                      Free position (kéo tự do)
                    </label>
                    {selected.positionMode === 'free' && resolvedSelectedFreeLayout ? (
                      <>
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            ['x', 'X'],
                            ['y', 'Y'],
                            ['width', 'W'],
                            ['height', 'H'],
                            ['rotate', 'Rotate°'],
                          ] as const
                        ).map(([key, label]) => (
                          <label key={key} className="text-[11px]">
                            <span className="mb-0.5 block opacity-50">{label}</span>
                            <Input
                              type="number"
                              className="h-8 text-xs"
                              disabled={selected.locked === true}
                              value={
                                typeof resolvedSelectedFreeLayout[key] === 'number'
                                  ? resolvedSelectedFreeLayout[key]
                                  : ''
                              }
                              onChange={(e) => {
                                if (selected.locked) return;
                                const n =
                                  e.target.value === '' ? undefined : Number(e.target.value);
                                const base =
                                  resolvedSelectedFreeLayout ||
                                  ({ x: 0, y: 0 } as LandingPageFreeLayout);
                                const nextLayout = patchAbsoluteFreeLayoutField(
                                  base,
                                  key,
                                  Number.isFinite(n as number) ? (n as number) : undefined,
                                );
                                patchBlockFreeLayoutForViewport(selected.id, nextLayout);
                              }}
                            />
                          </label>
                        ))}
                      </div>
                      <button
                        type="button"
                        className="w-full rounded border border-white/15 px-2 py-1.5 text-[11px] hover:bg-white/5"
                        data-lp-reset-rotate
                        disabled={selected.locked === true}
                        onClick={() => {
                          if (selected.locked) return;
                          const base =
                            resolvedSelectedFreeLayout || ({ x: 0, y: 0 } as LandingPageFreeLayout);
                          patchBlockFreeLayoutForViewport(
                            selected.id,
                            patchAbsoluteFreeLayoutField(base, 'rotate', undefined),
                          );
                        }}
                      >
                        Reset góc xoay (0°)
                      </button>
                      </>
                    ) : (
                      <p className="text-[10px] opacity-40">
                        Bật Free hoặc kéo trên canvas để ghi toạ độ. Trang cũ giữ flow.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[10px] opacity-40">Chọn section để chỉnh vị trí.</p>
                )}
              </InspectorAccordion>

              <InspectorAccordion title="SEO" data-lp="advanced-seo" defaultOpen={false}>
                <div className="space-y-2" data-lp-inspector-seo>
                  <LandingPageInlineAiField
                    pageId={pageId}
                    label="Tiêu đề SEO"
                    fieldKind="seo.title"
                    blockType="SEO"
                    requestKey={`${pageId}.seo.title`}
                    value={spec.seo.title}
                    onChange={(v) =>
                      pushHistory(
                        markLandingPageUserEdits(
                          { ...spec, seo: { ...spec.seo, title: v } },
                          ['seo.title'],
                        ),
                      )
                    }
                    onApplyAi={(v) => applyAiToSeo('title', v)}
                  />
                  <LandingPageInlineAiField
                    pageId={pageId}
                    label="Mô tả meta"
                    fieldKind="seo.metaDescription"
                    blockType="SEO"
                    requestKey={`${pageId}.seo.metaDescription`}
                    value={spec.seo.metaDescription}
                    multiline
                    rows={2}
                    onChange={(v) =>
                      pushHistory(
                        markLandingPageUserEdits(
                          { ...spec, seo: { ...spec.seo, metaDescription: v } },
                          ['seo.metaDescription'],
                        ),
                      )
                    }
                    onApplyAi={(v) => applyAiToSeo('metaDescription', v)}
                  />
                  <Label className="text-xs">URL chuẩn (canonical)</Label>
                  <Input
                    value={spec.seo.canonical || ''}
                    onChange={(e) =>
                      pushHistory({
                        ...spec,
                        seo: { ...spec.seo, canonical: e.target.value || null },
                      })
                    }
                  />
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={spec.seo.robotsIndex}
                      onChange={(e) =>
                        pushHistory({
                          ...spec,
                          seo: { ...spec.seo, robotsIndex: e.target.checked },
                        })
                      }
                    />
                    Cho phép index (robots)
                  </label>
                </div>
              </InspectorAccordion>

              <InspectorAccordion title="Tracking" data-lp="advanced-tracking" defaultOpen={false}>
                <div className="space-y-2" data-lp-inspector-tracking>
                  <Label className="text-xs">GA4 Measurement ID</Label>
                  <Input
                    value={page.trackingConfig?.ga4MeasurementId || ''}
                    onChange={(e) =>
                      setPage({
                        ...page,
                        trackingConfig: { ...(page.trackingConfig || {}), ga4MeasurementId: e.target.value },
                      })
                    }
                    onBlur={() => {
                      void apiClient(`/landing-pages/${pageId}`, {
                        method: 'PATCH',
                        body: JSON.stringify({
                          trackingConfig: {
                            ...(page.trackingConfig || {}),
                            metaCapiReady: true,
                            tiktokPixelReady: true,
                          },
                        }),
                      });
                    }}
                  />
                  <Label className="text-xs">Google Ads ID</Label>
                  <Input
                    value={page.trackingConfig?.googleAdsId || ''}
                    onChange={(e) =>
                      setPage({
                        ...page,
                        trackingConfig: { ...(page.trackingConfig || {}), googleAdsId: e.target.value },
                      })
                    }
                    onBlur={() => {
                      void apiClient(`/landing-pages/${pageId}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ trackingConfig: page.trackingConfig || {} }),
                      });
                    }}
                  />
                  <Label className="text-xs">Meta Pixel ID</Label>
                  <Input
                    value={page.trackingConfig?.metaPixelId || ''}
                    onChange={(e) =>
                      setPage({
                        ...page,
                        trackingConfig: { ...(page.trackingConfig || {}), metaPixelId: e.target.value },
                      })
                    }
                    onBlur={() => {
                      void apiClient(`/landing-pages/${pageId}`, {
                        method: 'PATCH',
                        body: JSON.stringify({
                          trackingConfig: {
                            ...(page.trackingConfig || {}),
                            metaCapiReady: true,
                            tiktokPixelReady: true,
                          },
                        }),
                      });
                    }}
                  />
                  <p className="text-[10px] opacity-50">Meta CAPI / TikTok Pixel: architecture-ready flags</p>
                </div>
              </InspectorAccordion>

              <InspectorAccordion title="Phiên bản / Xem trước" data-lp="advanced-versions" defaultOpen={false}>
                <div className="space-y-2" data-lp-inspector-versions>
                  <LandingPageVersionHistoryPanel
                    pageId={pageId}
                    pageStatus={page.status}
                    onRestored={(next) => {
                      const restored = sanitizeLandingPagePersistSpec(next.draftSpec);
                      // Snapshot pre-restore into undo; do not rely on pushHistory's
                      // local +=1 — seed from server-bumped clientRevision so this
                      // tab stays ahead of stale other-tab autosaves.
                      historyRef.current.push(cloneSpec(specRef.current));
                      if (historyRef.current.length > 50) historyRef.current.shift();
                      futureRef.current = [];
                      setSpec(sanitizeLandingPageDraftSpec(restored));
                      revisionRef.current = readClientRevision(restored);
                      ackedRevisionRef.current = readClientRevision(restored);
                      dirtyRef.current = false;
                      clearLocalLandingDraft(pageId);
                      setPendingLocalDraft(null);
                      saveConflictRef.current = false;
                      setSaveConflict(false);
                      setPage({
                        ...page,
                        draftSpec: restored,
                        name: next.name || page.name,
                        status: next.status || page.status,
                      });
                    }}
                  />
                  <LandingPageDraftPreviewPanel pageId={pageId} />
                </div>
              </InspectorAccordion>

              <InspectorAccordion title="Class / CSS tùy chỉnh" data-lp="advanced-custom-css" defaultOpen={false}>
                {selected ? (
                  <CustomCssPanel
                    blockId={selected.id}
                    selectedElement={selectedElement}
                    style={{ ...((selected.style || {}) as Record<string, unknown>) }}
                    onPatchStyle={(nextStyle) => {
                      updateBlock(selected.id, { style: nextStyle } as Partial<LandingPageBlock>);
                    }}
                    bare
                  />
                ) : (
                  <p className="text-[10px] opacity-40">Chọn section để gắn class / CSS.</p>
                )}
              </InspectorAccordion>

              <p className="text-[10px] opacity-50">
                AI Generate / Page Doctor nằm trên sidebar trái (nút AI) — không ghi đè khi chưa Apply.
              </p>
            </div>
          ) : null}

          {page.publicPath ? (
            <a className="block text-xs underline opacity-80" href={page.publicPath} target="_blank" rel="noreferrer">
              Public: {page.publicPath}
            </a>
          ) : null}
          </div>
        </aside>
        </div>,
            actionBarMounted && inspectorDesktop
              ? document.body
              : (dockedInspectorHost as HTMLElement),
          )
          : null}
      </div>
      ) : null}
    </div>
  );
}
