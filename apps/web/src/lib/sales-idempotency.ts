/** Stable idempotency keys for sales mutations — reuse the same ref on network retry. */
export function createSalesIdempotencyKey(scope: string, resourceId: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `sales:${scope}:${resourceId}:${crypto.randomUUID()}`;
  }
  return `sales:${scope}:${resourceId}:${Date.now()}`;
}