import { SalesPaymentStatus } from '@marketingspa/database';

export function deriveOrderPaymentStatus(total: number, amountPaid: number): SalesPaymentStatus {
  const t = Math.max(0, Number(total) || 0);
  const p = Math.max(0, Number(amountPaid) || 0);
  if (p <= 0) return SalesPaymentStatus.UNPAID;
  if (p >= t) return SalesPaymentStatus.PAID;
  return SalesPaymentStatus.PARTIAL;
}