# Prompt 2 — COGS snapshot, trả một phần, đối soát báo cáo

**DB nghiệm thu:** `marketingspa_sales_idem_qa` (guard `scripts/sales-idem-qa-env.cjs`). Không deploy production.

## Migration

| Migration | Nội dung |
|-----------|----------|
| `20261123150000_sales_cogs_reporting` | Snapshot `unit_cost` / `cost_amount` / `cost_basis` trên `sales_stock_movement_lines`; `organizations.sales_report_timezone`; backfill lịch sử không suy diễn danh mục. |
| `20261123160000_sales_return_allocation` | `sales_returns.allocation_snapshot` (JSONB); `sales_stock_batches.cost_basis`. |

## Giá vốn — CONFIRMED / ESTIMATED / UNKNOWN

- **CONFIRMED:** `unitCost` chỉ định khi nhập (kể cả 0 — có chứng cứ).
- **ESTIMATED:** nhập không chỉ định giá, lấy `cost_price` danh mục (không tự thành CONFIRMED).
- **UNKNOWN:** không có giá.
- Lô sửa `unit_cost` sau xuất **không** đổi snapshot dòng movement.
- Đổi `sales_products.cost_price` sau xuất **không** đổi COGS đơn đã xuất.

## Trả một phần (tách trả hàng / hoàn tiền)

`sales-return-allocation.util.ts` — policy **v1**:

- Chiết khấu & phí ship: `orderDiscount × (merchandiseTrả / subtotal)` (tương tự ship), phân bổ theo tỷ trọng dòng trả; làm tròn cent + remainder.
- `revenueReversal`, `suggestedRefundMax`, `amountReceivableAfter` lưu trong `allocation_snapshot`.
- `refundAmount` trên phiếu trả chỉ khi client gửi; mặc định 0 (hoàn tiền qua payment service).

## Báo cáo (`reports.service.ts`)

| Chỉ số | Định nghĩa |
|--------|------------|
| orderValue / orderCountCreated | Đơn tạo trong kỳ (`createdAt`, TZ org) |
| recognizedRevenue | Xuất theo `exportedAt`, trừ `returnedQty` |
| returnRevenueReversal | Trả đã xác nhận theo `confirmedAt` |
| netRecognizedRevenue | `recognizedRevenue − returnRevenueReversal` |
| collected / refunded / netCollected | Theo `paidAt` (tách khỏi trả hàng) |
| cogs | OUTBOUND − RETURN_IN trong kỳ, từ snapshot line |
| inventoryValue | Σ `remaining_quantity × unit_cost` (lô) |
| warnings | Dòng cảnh báo giá vốn chưa xác thực (UNKNOWN / ESTIMATED) |

Không còn `take: 5000` trên đơn.

## Test thực chạy (2026-11-23)

```bash
node scripts/run-sales-reports-reconcile.cjs
# Docker (network aibeego_default, postgres QA):
# DATABASE_URL=postgresql://…/marketingspa_sales_idem_qa node scripts/run-sales-reports-reconcile.cjs
```

| Lớp | Kết quả |
|-----|---------|
| Unit phân bổ | **5/5** (`test-sales-return-allocation-unit.ts`) |
| Integration QA | **18/18** (`test-sales-reports-reconcile.ts`): COGS catalog 999, ESTIMATED inbound, sửa lô, 5001 đơn (kpi=5004, sumMs≈382), nhiều lần trả, CSV/KPI, unique index OUTBOUND |
| Prompt 1 regression (sau Prompt 2) | **17/17** (`run-sales-idempotency-regression.cjs`) |

## Chưa kiểm chứng

- SalesController + JWT supertest đầy đủ; E2E browser báo cáo.
- Đối soát top sản phẩm/khách hàng vs SQL độc lập từng cột (chỉ đọc source + smoke CSV).
- Benchmark 5001+ trên máy khác (số ms thay đổi theo Postgres).