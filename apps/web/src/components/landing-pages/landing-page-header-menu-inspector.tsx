'use client';

import type { LandingPageBlock, LandingPageTextBlock } from '@marketingspa/shared';
import { headerMenuSections, readHeaderMenu, resolveHeaderLinks, writeHeaderMenu, type HeaderMenuItem } from './landing-page-header-navigation';

export function LandingPageHeaderMenuInspector({ block, blocks, onChange, rendererVersion }: {
  block: LandingPageTextBlock; blocks: LandingPageBlock[]; onChange: (body: string) => void; rendererVersion?: string;
}) {
  const sections = headerMenuSections(blocks);
  const legacyTypes: Record<string, LandingPageBlock['type'][]> = {
    'local-service-v2': ['Features', 'Benefits', 'Process', 'FAQ'],
    'restaurant-menu-v2': ['Product', 'Gallery', 'LeadForm'],
    'website-brief-v2': ['Features', 'Process', 'Pricing'],
  };
  const legacy = legacyTypes[rendererVersion || ''];
  const defaultItems = legacy ? legacy.flatMap((type, i) => {
    const target = sections.find((b) => b.type === type);
    return target ? [{ label: (block.body || '').split('|')[i] || type, targetId: target.id }] : [];
  }) : resolveHeaderLinks(block.body, blocks, block.id).map((link) => ({ label: link.label, targetId: link.href.slice(1) }));
  const items = readHeaderMenu(block.body, blocks, block.id) ?? defaultItems;
  const change = (next: HeaderMenuItem[]) => onChange(writeHeaderMenu(next, blocks, block.id));
  const patch = (index: number, value: Partial<HeaderMenuItem>) => change(items.map((item, i) => i === index ? { ...item, ...value } : item));
  const move = (index: number, direction: number) => {
    const next = [...items];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    change(next);
  };
  const fieldClass = 'mt-1 w-full min-w-0 rounded border border-white/15 bg-slate-900 px-2 py-1.5 text-xs text-white';
  return <fieldset disabled={!!block.locked} className="min-w-0 space-y-3 rounded-lg border border-white/10 p-3 disabled:opacity-50" data-lp-header-menu-inspector>
    <legend className="px-1 text-xs font-semibold">Menu header</legend>
    <p className="text-[11px] text-white/60">Đổi chữ và chọn section đích cho từng mục. Bấm Xem trước để thử liên kết.</p>
    {items.map((item, index) => <div key={index} className="space-y-2 rounded border border-white/10 p-2" data-lp-header-menu-item>
      <div className="flex items-center justify-between gap-1 text-[11px]">
        <span>Mục {index + 1}</span>
        <div className="flex gap-2">
          <button type="button" disabled={index === 0} aria-label={'Đưa mục ' + (index + 1) + ' lên'} className="disabled:opacity-30" onClick={() => move(index, -1)}>↑</button>
          <button type="button" disabled={index === items.length - 1} aria-label={'Đưa mục ' + (index + 1) + ' xuống'} className="disabled:opacity-30" onClick={() => move(index, 1)}>↓</button>
          <button type="button" aria-label={'Xóa mục ' + (index + 1)} className="text-red-300" onClick={() => change(items.filter((_, i) => i !== index))}>Xóa</button>
        </div>
      </div>
      <label className="block text-[11px]">Chữ trên menu
        <input aria-label={'Chữ trên menu ' + (index + 1)} className={fieldClass} maxLength={80} value={item.label}
          onChange={(event) => patch(index, { label: event.target.value })} />
      </label>
      <label className="block text-[11px]">Liên kết tới section
        <select aria-label={'Section đích ' + (index + 1)} className={fieldClass} value={item.targetId} onChange={(event) => patch(index, { targetId: event.target.value })}>
          <option value="">Chọn section</option>
          {item.targetId && !sections.some((section) => section.id === item.targetId) ? <option value={item.targetId}>Section đã bị xóa hoặc đang ẩn</option> : null}
          {sections.map((section, i) => <option key={section.id} value={section.id}>
            {i + 1}. {section.layerName || ('headline' in section && section.headline) || section.type}
          </option>)}
        </select>
      </label>
      {(!item.targetId || !sections.some((section) => section.id === item.targetId)) ? <p className="text-[11px] text-amber-300">Chọn section đang hiển thị để kích hoạt mục này.</p> : null}
    </div>)}
    {!items.length ? <p className="text-[11px] text-white/60">Chưa có mục menu. Thêm mục để hiển thị trên header.</p> : null}
    <button type="button" disabled={items.length >= 6} className="w-full rounded border border-white/15 px-2 py-2 text-xs disabled:opacity-40"
      onClick={() => change([...items, { label: 'Mục mới', targetId: sections[0]?.id || '' }])}>+ Thêm mục menu ({items.length}/6)</button>
  </fieldset>;
}
