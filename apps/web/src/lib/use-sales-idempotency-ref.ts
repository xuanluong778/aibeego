'use client';

import { useRef } from 'react';
import { createSalesIdempotencyKey } from '@/lib/sales-idempotency';

/** One key per mount + business scope; survives React strict-mode remount if key already set. */
export function useSalesIdempotencyRef(scope: string, resourceId: string) {
  const ref = useRef<string | null>(null);
  if (!ref.current) {
    ref.current = createSalesIdempotencyKey(scope, resourceId);
  }
  return ref;
}