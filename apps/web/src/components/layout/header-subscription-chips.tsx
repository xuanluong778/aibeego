'use client';

import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/i18n-provider';
import { useSubscriptionDisplay } from '@/hooks/use-subscription-display';

/** Keep the header focused on the remaining subscription time. */
export function HeaderSubscriptionChips() {
  const t = useT();
  const { display } = useSubscriptionDisplay();
  if (!display) return null;

  const days = display.remainingDays;

  const daysTone =
    days <= 0
      ? 'bg-red-500/25 text-red-100 ring-red-300/40'
      : days <= 15
        ? 'bg-amber-500/25 text-amber-100 ring-amber-300/40'
        : 'bg-white/10 text-white/90 ring-white/15';


  return (
    <>
      {display.showDaysChip ? (
        <Link
          href="/pricing"
          title={t('layout.viewSubscription')}
          className={cn(
            'inline-flex max-w-[200px] items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 sm:max-w-none',
            daysTone,
          )}
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate whitespace-nowrap font-semibold">
            {days} {t('layout.daysUnit')}
          </span>
        </Link>
      ) : null}

    </>
  );
}
