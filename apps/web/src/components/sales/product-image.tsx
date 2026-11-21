'use client';
import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';
export function ProductImage({
  src,
  name,
  className,
}: {
  src?: string | null;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white text-slate-400',
        className,
      )}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="flex flex-col items-center gap-2 p-2 text-center text-xs">
          <ImageOff className="h-6 w-6" />
          <span className="hidden sm:inline">{failed ? 'Không tải được ảnh' : 'Chưa có ảnh'}</span>
        </span>
      )}
    </div>
  );
}
