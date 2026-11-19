'use client';

import { useRef, useState } from 'react';
import type { LandingPageBlock } from '@marketingspa/shared';
import './landing-page-header-navigation.css';

export type HeaderLink = { label: string; href: string };
export type HeaderMenuItem = { label: string; targetId: string; type?: string; index?: number };

export function headerMenuSections(blocks: LandingPageBlock[]) {
  return blocks.filter((b) => b.enabled && !b.hidden && !b.sectionPlacement && b.type !== 'Header');
}

// Use the existing text field so current API save/publish/restore contracts remain compatible.
// The source header ID lets copies resolve targets after the API generates new block IDs.
export function readHeaderMenu(body: string | undefined, blocks: LandingPageBlock[], headerId?: string): HeaderMenuItem[] | null {
  try {
    const data = JSON.parse(body || '');
    if (data?.headerMenu !== 1 || !Array.isArray(data.items)) return null;
    const targets = headerMenuSections(blocks);
    const cloned = !!headerId && typeof data.headerId === 'string' && data.headerId !== headerId;
    return data.items.slice(0, 6).flatMap((item: HeaderMenuItem) => {
      if (!item || typeof item.label !== 'string' || typeof item.targetId !== 'string') return [];
      const target = cloned && item.type && Number.isInteger(item.index)
        ? targets.filter((b) => b.type === item.type)[item.index!]
        : targets.find((b) => b.id === item.targetId);
      return [{ ...item, label: item.label.slice(0, 80), targetId: target?.id || item.targetId }];
    });
  } catch { return null; }
}

export function writeHeaderMenu(items: HeaderMenuItem[], blocks: LandingPageBlock[], headerId: string) {
  const targets = headerMenuSections(blocks);
  return JSON.stringify({ headerMenu: 1, headerId, items: items.slice(0, 6).map((item) => {
    const target = targets.find((b) => b.id === item.targetId);
    return { label: item.label.slice(0, 80), targetId: item.targetId,
      ...(target ? { type: target.type, index: targets.filter((b) => b.type === target.type).findIndex((b) => b.id === target.id) } : {}) };
  }) });
}
const sections: [LandingPageBlock['type'], string, RegExp][] = [
  ['Hero', 'Trang chủ', /trang chu|gioi thieu|home|about/],
  ['Features', 'Dịch vụ', /dich vu|san pham|service|product|tinh nang/],
  ['Benefits', 'Lợi ích', /loi ich|diem manh|benefit/],
  ['Gallery', 'Dự án', /du an|dau ra|thu vien|hinh anh|portfolio|gallery/],
  ['Process', 'Quy trình', /quy trinh|process/],
  ['Pricing', 'Bảng giá', /bang gia|goi dich vu|hop tac|pricing/],
  ['FAQ', 'Hỏi đáp', /hoi dap|cau hoi|faq/],
  ['LeadForm', 'Liên hệ', /lien he|dang ky|tu van|contact|booking/],
];
const normalize = (label: string) => label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();

/** Resolve against the current spec, including cloned IDs and disabled sections. */
export function resolveHeaderLinks(body: string | undefined, blocks: LandingPageBlock[], headerId?: string): HeaderLink[] {
  const custom = readHeaderMenu(body, blocks, headerId);
  if (custom) {
    const targets = headerMenuSections(blocks);
    return custom.filter((item) => item.label.trim() && targets.some((b) => b.id === item.targetId))
      .map((item) => ({ label: item.label, href: '#' + item.targetId }));
  }
  const enabled = blocks.filter((b) => b.enabled && !b.hidden && !b.sectionPlacement && b.type !== 'Header' && b.type !== 'Footer');
  const labels = (body || '').split('|').map((label) => label.trim()).filter(Boolean).slice(0, 6);
  if (!labels.length) {
    return sections.filter(([type]) => type !== 'Hero').flatMap(([type, label]) => {
      const block = enabled.find((b) => b.type === type);
      return block ? [{ label, href: '#' + block.id }] : [];
    }).slice(0, 6);
  }
  return labels.flatMap((label, index) => {
    const normalized = normalize(label);
    const match = sections.find(([, , pattern]) => pattern.test(normalized));
    const block = match
      ? enabled.find((b) => b.type === match[0])
      : enabled.find((b) => 'headline' in b && normalize(b.headline || '') === normalized) || enabled[index];
    return block ? [{ label, href: '#' + block.id }] : [];
  });
}

export function followHeaderLink(anchor: HTMLAnchorElement, href: string) {
  const id = href.slice(1);
  const fixedPortal = anchor.closest('[data-lp-fixed-header-portal]') as (HTMLElement & { __lpHeaderOwner?: HTMLElement }) | null;
  const root = fixedPortal?.__lpHeaderOwner || anchor.closest('[data-lp-renderer]');
  const target = Array.from(root?.querySelectorAll<HTMLElement>('[data-lp-block-id], [id]') || [])
    .find((el) => el.dataset.lpBlockId === id || el.id === id) || document.getElementById(id);
  target?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

export function LandingPageHeaderNavigation({ body, blocks, editing = false, headerId }: {
  body?: string; blocks: LandingPageBlock[]; editing?: boolean; headerId: string;
}) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const links = resolveHeaderLinks(body, blocks, headerId);
  if (!links.length) return null;
  const nav = (mobile: boolean) => (
    <nav className={mobile ? 'lp-header-mobile-links' : 'lp-header-desktop-links'} aria-label={mobile ? 'Menu di động' : 'Điều hướng chính'}>
      {links.map(({ label, href }, index) => <a key={index} href={href} onClick={(event) => {
        event.preventDefault();
        if (!editing) followHeaderLink(event.currentTarget, href);
        setOpen(false);
      }}>{label}</a>)}
    </nav>
  );
  return <div className="lp-header-navigation" onKeyDown={(event) => {
    if (event.key === 'Escape') { setOpen(false); toggle.current?.focus(); }
  }}>
    {nav(false)}
    <button ref={toggle} type="button" className="lp-header-menu-toggle" aria-label={open ? 'Đóng menu điều hướng' : 'Mở menu điều hướng'} aria-expanded={open} aria-controls={'lp-header-menu-' + headerId} onClick={() => setOpen(!open)}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d={open ? 'M6 6l12 12M18 6L6 18' : 'M4 6h16M4 12h16M4 18h16'} /></svg>
    </button>
    <div id={'lp-header-menu-' + headerId} className="lp-header-mobile-menu" hidden={!open}>{open ? nav(true) : null}</div>
  </div>;
}
