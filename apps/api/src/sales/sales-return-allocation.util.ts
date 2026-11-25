/**
 * Phân bổ trả hàng (tách khỏi hoàn tiền).
 * Chiết khấu & phí ship phân bổ theo tỷ trọng doanh thu dòng trên subtotal; làm tròn 2 chữ số, remainder về dòng cuối.
 */
export const SALES_RETURN_ALLOCATION_POLICY_V = 1;

export type OrderLineSnap = {
  orderItemId: string;
  quantity: number;
  returnedQtyBefore: number;
  totalPrice: number;
};

export type ReturnAllocLineInput = {
  orderItemId: string;
  quantity: number;
};

export type ReturnAllocLine = {
  orderItemId: string;
  quantity: number;
  merchandise: number;
  discountShare: number;
  shippingShare: number;
  revenueReversal: number;
  suggestedRefundMax: number;
};

export type ReturnAllocationResult = {
  policyVersion: number;
  subtotal: number;
  orderDiscount: number;
  orderShipping: number;
  orderTotal: number;
  amountPaid: number;
  lines: ReturnAllocLine[];
  totals: {
    merchandise: number;
    discountReversal: number;
    shippingReversal: number;
    revenueReversal: number;
    suggestedRefundMax: number;
  };
  /** Công nợ còn lại sau trả (không tự thu/hoàn tiền) */
  amountReceivableAfter: number;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function splitCents(total: number, weights: number[]): number[] {
  if (total <= 0 || weights.every((w) => w <= 0)) return weights.map(() => 0);
  const sumW = weights.reduce((s, w) => s + w, 0);
  if (sumW <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sumW);
  const floored = raw.map((r) => Math.floor(r * 100) / 100);
  let cents = Math.round(total * 100) - floored.reduce((s, f) => s + Math.round(f * 100), 0);
  const order = raw
    .map((r, i) => ({ i, frac: r * 100 - Math.floor(r * 100) }))
    .sort((a, b) => b.frac - a.frac);
  const out = [...floored];
  for (let k = 0; k < order.length && cents > 0; k++) {
    out[order[k]!.i] = round2(out[order[k]!.i]! + 0.01);
    cents -= 1;
  }
  return out;
}

export function allocatePartialReturn(opts: {
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  amountPaid: number;
  priorReturnedMerchandise?: number;
  orderLines: OrderLineSnap[];
  returnLines: ReturnAllocLineInput[];
}): ReturnAllocationResult {
  const subtotal = Math.max(0, Number(opts.subtotal) || 0);
  const orderDiscount = Math.max(0, Number(opts.discount) || 0);
  const orderShipping = Math.max(0, Number(opts.shippingFee) || 0);
  const orderTotal = Math.max(0, Number(opts.total) || 0);
  const amountPaid = Math.max(0, Number(opts.amountPaid) || 0);
  const lineMap = new Map(opts.orderLines.map((l) => [l.orderItemId, l]));

  const merchandiseWeights: number[] = [];
  const built: Array<{ orderItemId: string; quantity: number; merchandise: number }> = [];

  for (const r of opts.returnLines) {
    const oi = lineMap.get(r.orderItemId);
    if (!oi) throw new Error(`Dòng đơn không hợp lệ: ${r.orderItemId}`);
    const qty = Math.trunc(r.quantity);
    if (qty <= 0) throw new Error('Số lượng trả phải > 0');
    const remain = oi.quantity - oi.returnedQtyBefore;
    if (qty > remain) {
      throw new Error(`Trả vượt còn lại dòng ${r.orderItemId} (còn ${remain})`);
    }
    const lineTotal = Number(oi.totalPrice) || 0;
    const merchandise =
      oi.quantity > 0 ? round2((lineTotal / oi.quantity) * qty) : 0;
    built.push({ orderItemId: r.orderItemId, quantity: qty, merchandise });
    merchandiseWeights.push(merchandise);
  }

  const sumMerch = built.reduce((s, l) => s + l.merchandise, 0);
  if (sumMerch <= 0) throw new Error('Giá trị trả hàng phải > 0');
  if (sumMerch > subtotal + 0.01) {
    throw new Error('Tổng trả vượt subtotal đơn');
  }

  const merchRatio = subtotal > 0 ? sumMerch / subtotal : 0;
  const discountPool = round2(orderDiscount * merchRatio);
  const shippingPool = round2(orderShipping * merchRatio);
  const discountParts = splitCents(discountPool, merchandiseWeights);
  const shippingParts = splitCents(shippingPool, merchandiseWeights);

  const lines: ReturnAllocLine[] = built.map((b, i) => {
    const discountShare = discountParts[i] ?? 0;
    const shippingShare = shippingParts[i] ?? 0;
    const revenueReversal = round2(b.merchandise - discountShare + shippingShare);
    const suggestedRefundMax = round2(
      Math.min(revenueReversal, Math.max(0, amountPaid)),
    );
    return {
      orderItemId: b.orderItemId,
      quantity: b.quantity,
      merchandise: b.merchandise,
      discountShare,
      shippingShare,
      revenueReversal,
      suggestedRefundMax,
    };
  });

  const totals = {
    merchandise: round2(lines.reduce((s, l) => s + l.merchandise, 0)),
    discountReversal: round2(lines.reduce((s, l) => s + l.discountShare, 0)),
    shippingReversal: round2(lines.reduce((s, l) => s + l.shippingShare, 0)),
    revenueReversal: round2(lines.reduce((s, l) => s + l.revenueReversal, 0)),
    suggestedRefundMax: round2(lines.reduce((s, l) => s + l.suggestedRefundMax, 0)),
  };

  const prior = Math.max(0, opts.priorReturnedMerchandise ?? 0);
  const newReturnedMerch = prior + totals.merchandise;
  const impliedOrderValueAfter = round2(orderTotal - totals.revenueReversal);
  const amountReceivableAfter = round2(
    Math.max(0, impliedOrderValueAfter - amountPaid),
  );

  if (newReturnedMerch > subtotal + 0.01) {
    throw new Error('Tổng merchandise trả vượt subtotal');
  }

  return {
    policyVersion: SALES_RETURN_ALLOCATION_POLICY_V,
    subtotal,
    orderDiscount,
    orderShipping,
    orderTotal,
    amountPaid,
    lines,
    totals,
    amountReceivableAfter,
  };
}

export function mergeReturnRounds(
  allocations: ReturnAllocationResult[],
): ReturnAllocationResult['totals'] {
  const acc = {
    merchandise: 0,
    discountReversal: 0,
    shippingReversal: 0,
    revenueReversal: 0,
    suggestedRefundMax: 0,
  };
  for (const a of allocations) {
    acc.merchandise = round2(acc.merchandise + a.totals.merchandise);
    acc.discountReversal = round2(acc.discountReversal + a.totals.discountReversal);
    acc.shippingReversal = round2(acc.shippingReversal + a.totals.shippingReversal);
    acc.revenueReversal = round2(acc.revenueReversal + a.totals.revenueReversal);
    acc.suggestedRefundMax = round2(acc.suggestedRefundMax + a.totals.suggestedRefundMax);
  }
  return acc;
}