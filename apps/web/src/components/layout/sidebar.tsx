'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Crown, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { sidebarNavGroups, type NavGroup, type NavItem } from '@/config/navigation';
import { useT } from '@/i18n/i18n-provider';
import { useCurrentUser } from '@/hooks/use-auth';
import { useSubscriptionDisplay } from '@/hooks/use-subscription-display';
import { CONTENT_AUTO_POST_BASE } from '@/lib/content-auto-post-routes';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CollapsedNavHoverLabel } from './collapsed-nav-hover-label';

/** Canonicalize create-section for active match (`ads-check` → `facebook-check`). */
function normalizeContentSection(section: string | null | undefined): string {
  const value = (section || 'ad').trim();
  if (value === 'ads-check') return 'facebook-check';
  return value || 'ad';
}

interface SidebarProps {
  onNavigate?: () => void;
  /** Main app sidebar rail (icon-only). Does not affect LP builder white toolbar. */
  collapsed?: boolean;
  mobile?: boolean;
  /** Desktop-only: collapse/expand main green sidebar. */
  onToggleCollapsed?: () => void;
}

export function Sidebar({
  onNavigate,
  collapsed = false,
  mobile = false,
  onToggleCollapsed,
}: SidebarProps) {
  const t = useT();
  const { data: currentUser } = useCurrentUser();
  const isPlatformAdmin = currentUser?.role === 'SUPER_ADMIN';
  const navGroups = useMemo(
    () =>
      sidebarNavGroups.map((g) =>
        g.items ? { ...g, items: g.items.filter((i) => !i.adminOnly || isPlatformAdmin) } : g,
      ),
    [isPlatformAdmin],
  );
  const pathname = usePathname();
  const router = useRouter();
  // Keep editing focused on this page; prefetching other routes loads unused CSS.
  const prefetchNavigation =
    pathname.startsWith('/landing-pages/builder/') || pathname === '/landing-pages/manage-templates'
      ? false
      : undefined;
  const searchParams = useSearchParams();
  const currentPathWithQuery = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const isNavItemActive = useMemo(
    () => (item: NavItem) => {
      if (!item.href) return false;

      try {
        const want = new URL(item.href, 'http://local');
        const have = new URL(currentPathWithQuery, 'http://local');

        if (item.href.startsWith(`${CONTENT_AUTO_POST_BASE}?`)) {
          if (have.pathname !== CONTENT_AUTO_POST_BASE) return false;
          const wantTab = want.searchParams.get('tab');
          const haveTab = have.searchParams.get('tab') || 'create';
          if (wantTab !== haveTab) return false;
          const wantSection = want.searchParams.get('section');
          if (wantSection) {
            return (
              normalizeContentSection(have.searchParams.get('section')) ===
              normalizeContentSection(wantSection)
            );
          }
          return true;
        }

        if (want.pathname === '/automation' && want.searchParams.has('tab')) {
          if (have.pathname !== '/automation') return false;
          const wantTab = want.searchParams.get('tab');
          const haveTab = have.searchParams.get('tab') || 'campaigns';
          if (wantTab === 'flows') {
            return (
              haveTab === 'flows' ||
              haveTab === 'templates' ||
              haveTab === 'logs' ||
              haveTab === 'channels'
            );
          }
          return wantTab === haveTab;
        }

        if (want.pathname === '/automation' && !want.search) {
          if (have.pathname !== '/automation') return false;
          const haveTab = have.searchParams.get('tab') || 'campaigns';
          return (
            haveTab === 'flows' ||
            haveTab === 'templates' ||
            haveTab === 'logs' ||
            haveTab === 'channels'
          );
        }

        if (want.search) {
          if (have.pathname !== want.pathname) return false;
          if (want.pathname === '/settings' && want.searchParams.get('tab') === 'account') {
            const haveTab = have.searchParams.get('tab');
            // Hub (/settings without tab) is not the Account child
            return haveTab === 'account' || haveTab === 'general';
          }
          for (const [key, value] of want.searchParams.entries()) {
            if (key === 'tab' && want.pathname === '/settings') {
              const haveTab = have.searchParams.get('tab');
              if (value === 'knowledge') {
                return haveTab === 'knowledge' || haveTab === 'knowledge-base' || haveTab === 'kb';
              }
              if (value === 'connections') {
                return (
                  haveTab === 'connections' ||
                  haveTab === 'connect' ||
                  haveTab === 'zalo' ||
                  haveTab === 'zalo-oa'
                );
              }
              if (value === 'api') {
                return haveTab === 'api' || haveTab === 'integrations';
              }
              if (value === 'system') {
                return haveTab === 'system' || haveTab === 'general';
              }
            }
            if (have.searchParams.get(key) !== value) return false;
          }
          return true;
        }
      } catch {
        return currentPathWithQuery === item.href;
      }

      return (
        pathname === item.href ||
        pathname.startsWith(`${item.href}/`) ||
        (item.href === CONTENT_AUTO_POST_BASE &&
          (pathname === '/ai' ||
            pathname.startsWith('/ai/') ||
            pathname === '/auto-post' ||
            pathname.startsWith('/auto-post/')))
      );
    },
    [currentPathWithQuery, pathname],
  );

  const isGroupActive = useMemo(
    () => (group: NavGroup) => {
      if (group.items?.some(isNavItemActive)) return true;
      if (!group.href) return false;

      if (group.href === '/settings') {
        return pathname === '/settings' || pathname.startsWith('/settings/');
      }
      if (group.href === '/content-marketing' || group.href === CONTENT_AUTO_POST_BASE) {
        if (pathname === '/content-marketing' || pathname.startsWith('/content-marketing/')) {
          return true;
        }
        if (pathname === '/teleprompter' || pathname.startsWith('/teleprompter/')) return true;
        if (
          pathname === CONTENT_AUTO_POST_BASE ||
          pathname.startsWith(`${CONTENT_AUTO_POST_BASE}/`)
        ) {
          return true;
        }
        return (
          pathname === '/ai' ||
          pathname.startsWith('/ai/') ||
          pathname === '/auto-post' ||
          pathname.startsWith('/auto-post/')
        );
      }
      if (group.href === '/hrm') {
        return (
          pathname === '/hrm' ||
          pathname.startsWith('/hrm/') ||
          pathname.startsWith('/work-management')
        );
      }
      if (group.href === '/messaging') {
        return (
          pathname === '/messaging' ||
          pathname.startsWith('/messaging/') ||
          pathname.startsWith('/automation') ||
          pathname.startsWith('/chatbot-cskh') ||
          pathname.startsWith('/email-marketing') ||
          pathname.startsWith('/zalo-marketing') ||
          pathname.startsWith('/messages')
        );
      }
      if (group.href === '/advertising') {
        return (
          pathname === '/advertising' ||
          pathname.startsWith('/advertising/') ||
          pathname.startsWith('/ads') ||
          pathname.startsWith('/attribution')
        );
      }
      if (group.href === '/finance-billing') {
        return (
          pathname === '/finance-billing' ||
          pathname.startsWith('/finance-billing/') ||
          pathname.startsWith('/finance') ||
          pathname.startsWith('/business-goals') ||
          pathname.startsWith('/affiliate') ||
          pathname.startsWith('/credits')
        );
      }
      if (group.href === '/crm') {
        return (
          pathname === '/crm' ||
          pathname.startsWith('/crm/') ||
          pathname.startsWith('/customers') ||
          pathname.startsWith('/leads') ||
          pathname.startsWith('/funnel')
        );
      }
      if (group.href === '/sales') {
        return pathname === '/sales' || pathname.startsWith('/sales/');
      }

      return pathname === group.href || pathname.startsWith(`${group.href}/`);
    },
    [isNavItemActive, pathname],
  );

  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => {
    setOpenGroup(null);
  }, [currentPathWithQuery, collapsed]);

  const { display: subscriptionDisplay } = useSubscriptionDisplay();
  const upgradeNav = subscriptionDisplay?.upgradeButton;
  const sidebarPlanLabel =
    subscriptionDisplay?.tier === 'PRO_12M'
      ? subscriptionDisplay.planLabel
      : upgradeNav?.show
        ? upgradeNav.label
        : (subscriptionDisplay?.planLabel ?? t('layout.upgradePro'));
  const sidebarPlanHref = upgradeNav?.href ?? '/pricing';
  const sidebarPlanIsUpgrade =
    upgradeNav?.show !== false && subscriptionDisplay?.tier !== 'PRO_12M';

  const navigate = () => {
    setOpenGroup(null);
    onNavigate?.();
  };
  const renderGroup = (group: NavGroup) => {
    const active = isGroupActive(group);
    const label = t(group.title);
    const rowClass = cn(
      'relative flex h-[clamp(1.5rem,calc((100dvh_-_12.5rem)/12),2.25rem)] w-full min-w-0 items-center rounded-lg text-sm font-medium transition-colors touch-manipulation',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-inset',
      collapsed ? 'justify-center px-0' : 'gap-3 px-3',
      active
        ? 'bg-white/15 text-white before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-orange-500'
        : 'text-white/80 hover:bg-white/10 hover:text-white',
    );
    if (group.items?.length) {
      // Keep the hub URL available in the panel heading, including one-child groups.
      const activeItems = group.items.filter(isNavItemActive);
      const bestMatch = activeItems.sort((a, b) => b.href.length - a.href.length)[0]?.href;
      const hubHref = group.href || group.items[0]!.href;
      return (
        <SidebarFlyout
          key={group.title}
          label={label}
          mobile={mobile}
          open={openGroup === group.title}
          onOpenChange={(value) =>
            setOpenGroup((current) =>
              value ? group.title : current === group.title ? null : current,
            )
          }
          onHubClick={() => {
            router.push(hubHref);
            navigate();
          }}
          trigger={
            <button type="button" aria-label={label} className={rowClass}>
              <group.icon
                aria-hidden
                className={cn('h-[18px] w-[18px] shrink-0', active && 'text-orange-400')}
              />
              {!collapsed && (
                <>
                  <span className="min-w-0 flex-1 truncate text-left">{label}</span>
                  <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-white/60" />
                </>
              )}
            </button>
          }
        >
          <Link
            href={group.href || group.items[0]!.href}
            prefetch={prefetchNavigation}
            onClick={navigate}
            className="mb-2 flex min-h-11 items-center gap-3 rounded-lg px-3 font-semibold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
          >
            <group.icon aria-hidden className="h-5 w-5 shrink-0 text-orange-400" />
            <span>{label}</span>
            <ChevronRight aria-hidden className="ml-auto h-4 w-4" />
          </Link>
          <nav aria-label={label} className="grid gap-1">
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch={prefetchNavigation}
                onClick={navigate}
                aria-current={bestMatch === item.href ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-inset',
                  bestMatch === item.href
                    ? 'bg-white font-semibold text-[#0A3D30] shadow-sm'
                    : 'text-white/85 hover:bg-white/10 hover:text-white',
                )}
              >
                <item.icon aria-hidden className="h-[18px] w-[18px] shrink-0" />
                <span>{t(item.title)}</span>
              </Link>
            ))}
          </nav>
        </SidebarFlyout>
      );
    }
    if (!group.href) return null;
    return (
      <CollapsedNavHoverLabel key={group.title} enabled={collapsed} label={label}>
        <Link
          href={group.href}
          prefetch={prefetchNavigation}
          onClick={navigate}
          aria-label={label}
          aria-current={active ? 'page' : undefined}
          className={cn(
            rowClass,
            active && 'bg-white text-[#0A3D30] hover:bg-white hover:text-[#0A3D30]',
          )}
        >
          <group.icon aria-hidden className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span className="truncate">{label}</span>}
        </Link>
      </CollapsedNavHoverLabel>
    );
  };

  return (
    <div
      className="relative flex h-full min-h-0 flex-col bg-gradient-to-b from-[#0A3D30] to-[#063327] text-white"
      data-main-sidebar-nav={collapsed ? 'collapsed' : 'expanded'}
    >
      <div
        className={cn(
          'flex h-14 shrink-0 items-center border-b border-white/10',
          collapsed ? 'flex-col justify-center gap-1 px-1' : 'gap-2 px-4',
        )}
      >
        <Sparkles
          aria-hidden
          className={cn('shrink-0 text-white', collapsed ? 'h-5 w-5' : 'h-6 w-6')}
        />
        {!collapsed && (
          <span className="flex-1 whitespace-nowrap text-lg font-bold tracking-tight">
            Ai Bee Go
          </span>
        )}
        {onToggleCollapsed && (
          <button
            type="button"
            onClick={() => {
              setOpenGroup(null);
              onToggleCollapsed();
            }}
            aria-label={collapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
            aria-expanded={!collapsed}
            data-testid="main-app-sidebar-toggle"
            className={cn(
              'flex shrink-0 items-center justify-center rounded-md bg-white text-[#0A3D30] shadow-sm hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300',
              collapsed ? 'h-6 w-8' : 'h-8 w-8',
            )}
          >
            {collapsed ? (
              <ChevronRight aria-hidden className="h-4 w-4" />
            ) : (
              <ChevronLeft aria-hidden className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        data-sidebar-menu-scroll
      >
        <nav
          aria-label="Menu chính"
          className={cn(
            'flex min-h-full flex-col justify-evenly gap-0.5 py-3 [&>*]:shrink-0',
            collapsed ? 'px-2' : 'px-3',
          )}
        >
          {navGroups.filter((group) => group.title !== 'nav.settings').map(renderGroup)}
        </nav>
      </div>
      <div
        data-sidebar-footer
        className={cn(
          'shrink-0 space-y-1 border-t border-white/20 py-2',
          collapsed ? 'px-2' : 'px-3',
        )}
      >
        {navGroups.filter((group) => group.title === 'nav.settings').map(renderGroup)}
        <CollapsedNavHoverLabel enabled={collapsed} label={sidebarPlanLabel}>
          <Link
            href={sidebarPlanHref}
            prefetch={prefetchNavigation}
            onClick={navigate}
            aria-label={sidebarPlanLabel}
            className={cn(
              'flex h-9 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A3D30]',
              sidebarPlanIsUpgrade
                ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-black shadow-sm ring-1 ring-inset ring-white/0 transition-shadow hover:ring-2 hover:ring-white hover:shadow-[0_0_16px_rgba(255,255,255,0.65),0_0_28px_rgba(253,224,71,0.45)]'
                : 'bg-white/10 text-white hover:bg-white/20',
            )}
          >
            <Crown aria-hidden className="h-5 w-5 shrink-0" />
            {!collapsed && <span className="truncate">{sidebarPlanLabel}</span>}
          </Link>
        </CollapsedNavHoverLabel>
      </div>
    </div>
  );
}

/** Radix supplies collision handling, outside dismissal and a focus scope inside the drawer. */
function SidebarFlyout({
  label,
  mobile,
  open,
  onOpenChange,
  onHubClick,
  trigger,
  children,
}: {
  label: string;
  mobile: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Click main tab → module hub (feature cards) in the main pane; hover flyout unchanged. */
  onHubClick?: () => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const keyboardOpen = useRef(false);
  const openedByHover = useRef(false);
  const restoreFocus = useRef(false);
  const cancelClose = () => {
    if (timer.current) clearTimeout(timer.current);
  };
  const scheduleClose = () => {
    cancelClose();
    timer.current = setTimeout(() => {
      if (!content.current?.contains(document.activeElement)) onOpenChange(false);
    }, 220);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <div
        onPointerEnter={(event) => {
          cancelClose();
          if (!mobile && event.pointerType === 'mouse' && !open) {
            keyboardOpen.current = false;
            openedByHover.current = true;
            onOpenChange(true);
          }
        }}
        onPointerLeave={() => {
          if (!mobile) scheduleClose();
        }}
      >
        <PopoverTrigger
          asChild
          onClick={(event) => {
            if (onHubClick) {
              event.preventDefault();
              openedByHover.current = false;
              keyboardOpen.current = false;
              onOpenChange(false);
              onHubClick();
              return;
            }
            if (openedByHover.current && open) event.preventDefault();
            openedByHover.current = false;
          }}
          onKeyDown={(event) => {
            if (['ArrowRight', 'ArrowDown', 'Enter', ' '].includes(event.key)) {
              event.preventDefault();
              cancelClose();
              keyboardOpen.current = true;
              onOpenChange(true);
              content.current?.querySelector<HTMLAnchorElement>('a')?.focus();
            }
          }}
        >
          {trigger}
        </PopoverTrigger>
      </div>
      <PopoverContent
        ref={content}
        side={mobile ? 'bottom' : 'right'}
        align="start"
        sideOffset={mobile ? 8 : 16}
        aria-label={label}
        data-sidebar-flyout
        onPointerEnter={cancelClose}
        onPointerLeave={() => {
          if (!mobile) scheduleClose();
        }}
        onOpenAutoFocus={(event) => {
          if (!keyboardOpen.current) event.preventDefault();
        }}
        onCloseAutoFocus={(event) => {
          if (!restoreFocus.current) event.preventDefault();
          restoreFocus.current = false;
        }}
        onEscapeKeyDown={() => {
          restoreFocus.current = true;
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            restoreFocus.current = true;
            onOpenChange(false);
          }
          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const links = Array.from(
              content.current?.querySelectorAll<HTMLAnchorElement>('a') || [],
            );
            const index = links.indexOf(document.activeElement as HTMLAnchorElement);
            const next =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? links.length - 1
                  : (index + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
            links[next]?.focus();
          }
        }}
        className="w-64 max-h-[var(--radix-popover-content-available-height)] overflow-y-auto overscroll-contain border-white/25 bg-[#124c3c] p-2 text-white shadow-xl shadow-black/15 data-[state=closed]:hidden dark:border-white/25 dark:bg-[#124c3c] dark:text-white"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
