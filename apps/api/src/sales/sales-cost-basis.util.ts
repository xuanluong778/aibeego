import { SalesCostBasis } from '@marketingspa/database';

export type InboundCostSnap = {
  unitCost: number;
  costBasis: SalesCostBasis;
};

/** Chứng cứ giá vốn lúc nhập — lô catalog không tự thành CONFIRMED. */
export function resolveInboundUnitCost(opts: {
  dtoUnitCost?: number;
  productCostPrice: number;
}): InboundCostSnap {
  if (opts.dtoUnitCost !== undefined && opts.dtoUnitCost !== null) {
    const v = Math.max(0, Number(opts.dtoUnitCost) || 0);
    return {
      unitCost: v,
      costBasis: SalesCostBasis.CONFIRMED,
    };
  }
  const catalog = Math.max(0, Number(opts.productCostPrice) || 0);
  if (catalog > 0) {
    return { unitCost: catalog, costBasis: SalesCostBasis.ESTIMATED };
  }
  return { unitCost: 0, costBasis: SalesCostBasis.UNKNOWN };
}

export function snapshotFromBatchUnitCost(unitCost: number): InboundCostSnap {
  const v = Math.max(0, Number(unitCost) || 0);
  if (v > 0) return { unitCost: v, costBasis: SalesCostBasis.CONFIRMED };
  return { unitCost: 0, costBasis: SalesCostBasis.UNKNOWN };
}

export function costWarningLines(opts: {
  unknownQty: number;
  estimatedQty: number;
  confirmedZeroQty: number;
  inventoryUnknownQty: number;
  inventoryZeroConfirmedQty: number;
}): string[] {
  const w: string[] = [];
  if (opts.unknownQty > 0) {
    w.push(
      `COGS chuyển kho: ${opts.unknownQty} đơn vị thiếu snapshot (UNKNOWN) — không coi là 0 đã xác thực`,
    );
  }
  if (opts.estimatedQty > 0) {
    w.push(`COGS chuyển kho: ${opts.estimatedQty} đơn vị giá ESTIMATED (từ danh mục/lô ước tính)`);
  }
  if (opts.confirmedZeroQty > 0) {
    w.push(
      `COGS: ${opts.confirmedZeroQty} đơn vị CONFIRMED giá vốn 0 (đã xác nhận hàng tặng/không vốn)`,
    );
  }
  if (opts.inventoryUnknownQty > 0) {
    w.push(`Tồn kho: ${opts.inventoryUnknownQty} đơn vị lô unit_cost=0 chưa xác thực`);
  }
  if (opts.inventoryZeroConfirmedQty > 0) {
    w.push(`Tồn kho: ${opts.inventoryZeroConfirmedQty} đơn vị lô giá 0 đã xác nhận`);
  }
  return w;
}