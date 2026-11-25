import { Prisma, SalesCostBasis, SalesStockMovementType } from '@marketingspa/database';

export type CogsRollup = {
  cogsConfirmed: number;
  cogsEstimated: number;
  cogsUnknownQty: number;
  cogsConfirmedZeroQty: number;
  cogsEstimatedQty: number;
  cogsNet: number;
};

export function lineCostAmount(line: {
  quantity: number;
  unitCost: Prisma.Decimal | null;
  costAmount: Prisma.Decimal | null;
  costBasis: SalesCostBasis | null;
}): { amount: number | null; basis: SalesCostBasis | null } {
  if (line.costAmount != null) {
    return { amount: Number(line.costAmount), basis: line.costBasis };
  }
  if (line.unitCost != null) {
    const v = Number(line.unitCost);
    const basis = line.costBasis ?? (v > 0 ? SalesCostBasis.CONFIRMED : SalesCostBasis.UNKNOWN);
    if (basis === SalesCostBasis.CONFIRMED && v === 0) {
      return { amount: 0, basis: SalesCostBasis.CONFIRMED };
    }
    if (v > 0) {
      return { amount: v * line.quantity, basis };
    }
    if (basis === SalesCostBasis.ESTIMATED) {
      return { amount: 0, basis: SalesCostBasis.ESTIMATED };
    }
  }
  return { amount: null, basis: line.costBasis ?? SalesCostBasis.UNKNOWN };
}

export function rollupMovementCogs(
  movements: Array<{
    type: SalesStockMovementType;
    lines: Array<{
      quantity: number;
      unitCost: Prisma.Decimal | null;
      costAmount: Prisma.Decimal | null;
      costBasis: SalesCostBasis | null;
    }>;
  }>,
): CogsRollup {
  const out: CogsRollup = {
    cogsConfirmed: 0,
    cogsEstimated: 0,
    cogsUnknownQty: 0,
    cogsConfirmedZeroQty: 0,
    cogsEstimatedQty: 0,
    cogsNet: 0,
  };
  const sign = (t: SalesStockMovementType) =>
    t === SalesStockMovementType.OUTBOUND ? 1 : -1;

  for (const m of movements) {
    const s = sign(m.type);
    for (const line of m.lines) {
      const { amount, basis } = lineCostAmount(line);
      if (amount == null || !Number.isFinite(amount)) {
        out.cogsUnknownQty += Math.abs(line.quantity);
        continue;
      }
      const signed = s * amount;
      out.cogsNet += signed;
      const qtyAbs = Math.abs(line.quantity);
      if (basis === SalesCostBasis.CONFIRMED && amount === 0) {
        out.cogsConfirmedZeroQty += qtyAbs;
        continue;
      }
      if (basis === SalesCostBasis.CONFIRMED) out.cogsConfirmed += signed;
      else if (basis === SalesCostBasis.ESTIMATED) {
        out.cogsEstimated += signed;
        out.cogsEstimatedQty += qtyAbs;
      } else out.cogsUnknownQty += qtyAbs;
    }
  }
  return out;
}