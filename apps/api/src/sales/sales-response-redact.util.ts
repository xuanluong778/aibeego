import type { AuthUser } from '../common/interfaces/auth-user.interface';
import { canViewSalesCost, canViewSalesProfit } from './sales.rbac';

/** Giá vốn — cần sales.cost.view */
const COST_KEYS = new Set([
  'costPrice',
  'unitCost',
  'costAmount',
  'costBasis',
  'productCostPrice',
]);

/** Lợi nhuận / COGS báo cáo — cần sales.profit.view */
const PROFIT_KEYS = new Set([
  'cogs',
  'cogsConfirmed',
  'cogsEstimated',
  'cogsUnknownQty',
  'cogsConfirmedZeroQty',
  'cogsEstimatedQty',
  'grossProfit',
  'inventoryValue',
]);

function isPlain(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  if (value instanceof Date) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Xóa giá vốn / lợi nhuận trên mọi object lồng nhau của response JSON. */
export function redactSalesSensitive<T>(value: T, user: AuthUser): T {
  const showCost = canViewSalesCost(user);
  const showProfit = canViewSalesProfit(user);
  if (showCost && showProfit) return value;
  return walk(value, showCost, showProfit) as T;
}

function walk(value: unknown, showCost: boolean, showProfit: boolean): unknown {
  if (Array.isArray(value)) return value.map((v) => walk(v, showCost, showProfit));
  if (!isPlain(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (!showCost && COST_KEYS.has(key)) {
      out[key] = null;
      continue;
    }
    if (!showProfit && PROFIT_KEYS.has(key)) {
      out[key] = null;
      continue;
    }
    out[key] = walk(child, showCost, showProfit);
  }
  return out;
}

export function redactReportCsvBody(body: string, user: AuthUser): string {
  if (canViewSalesCost(user) && canViewSalesProfit(user)) return body;
  const lines = body.split('\n');
  if (!lines.length) return body;
  const header = lines[0]!.split(',');
  const dropIdx = new Set<number>();
  header.forEach((h, i) => {
    const key = h.trim().toLowerCase();
    const cost = ['unitcost', 'costprice', 'costamount', 'costbasis'].some((x) => key.includes(x));
    const profit = ['cogs', 'grossprofit', 'inventoryvalue'].some((x) => key.includes(x));
    if ((!canViewSalesCost(user) && cost) || (!canViewSalesProfit(user) && profit) || key.includes('cost')) {
      if (!canViewSalesCost(user) || !canViewSalesProfit(user)) {
        if (key.includes('cost') && !canViewSalesCost(user)) dropIdx.add(i);
        if (profit && !canViewSalesProfit(user)) dropIdx.add(i);
      }
    }
  });
  if (!dropIdx.size) return body;
  return lines
    .map((line) =>
      line
        .split(',')
        .filter((_, i) => !dropIdx.has(i))
        .join(','),
    )
    .join('\n');
}
