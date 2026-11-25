'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/i18n-provider';

export function ModuleFeatureCard({
  titleKey,
  descriptionKey,
  href,
  icon: Icon,
  badge,
  className,
}: {
  titleKey: string;
  descriptionKey: string;
  href: string;
  icon: LucideIcon;
  badge?: string | number | null;
  className?: string;
}) {
  const t = useT();

  return (
    <Link
      href={href}
      className={cn(
        'flex h-full min-h-[148px] flex-col rounded-xl bg-white/5 p-4',
        'transition-colors duration-200 motion-reduce:transition-none hover:bg-white/[0.15]',
        'focus-visible:bg-white/[0.15] focus-visible:outline-none',
        className,
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0A3D30]/80 ring-1 ring-white/15">
          <Icon className="h-5 w-5 text-[#F97316]" aria-hidden />
        </div>
        {badge != null && badge !== '' ? (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/80">
            {badge}
          </span>
        ) : null}
      </div>
      <h3 className="text-sm font-semibold text-white">{t(titleKey)}</h3>
      <p className="mt-1 line-clamp-2 flex-1 text-xs leading-relaxed text-white/65">
        {t(descriptionKey)}
      </p>
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[#F97316]">
        {t('moduleHub.viewDetails')}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </span>
    </Link>
  );
}
