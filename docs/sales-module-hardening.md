# Sales module hardening

## RBAC (shadow-safe)

Mọi handler `SalesController` gọi `assertSales*` trong `sales.rbac.ts` — **luôn 403**, không phụ thuộc `HRM_PERMISSIONS_ENFORCE`.

| Quyền | Mô tả |
|-------|--------|
| `order.read` | Đọc đơn / thanh toán / trả hàng |
| `order.write` | Tạo/sửa đơn, đổi trạng thái |
| `sales.inventory.read` | Tồn, lô, PO (đọc) |
| `sales.inventory.write` | Nhập/xuất/điều chỉnh, xuất đơn, trả kho |
| `sales.receive.write` | Tạo PO, nhận hàng |
| `sales.stocktake.write` | Kiểm kê |
| `sales.payment.collect` | Thu tiền |
| `sales.payment.refund` | Hoàn tiền |
| `sales.cost.view` | Giá vốn trong API |
| `sales.profit.view` | COGS / lợi nhuận KPI |
| `sales.report.export` | CSV báo cáo |

`order.write` **không** suy ra kho, nhận hàng, kiểm kê, thu hoặc hoàn. Các mã đó phải được gán riêng.

Quyền tài chính (`sales.cost.view`, `sales.profit.view`, `sales.payment.refund`, `sales.report.export`) chỉ gán cho OWNER/MANAGER qua `scripts/grant-sales-granular-permissions.cjs` (chạy lại an toàn). SALE chỉ nhận quyền vận hành. Script **không** cấp tài chính cho mọi role.

Redact: `SalesSensitiveRedactInterceptor` + `redactSalesSensitive` đi trên JSON của sales, import và Woo (kể cả object lồng). CSV báo cáo redact riêng trong handler.

## Cấp mã

`sales_document_sequences` + `SalesDocumentCodeService.nextInTransaction` — SO/KK/RT/PO/RC.

## Giao dịch

- `updateOrder`: `FOR UPDATE`, tính lại total + `paymentStatus`, audit trong tx.
- Kiểm kê `updateLines` / `cancel` / `confirm`: khóa phiếu, kiểm tra lại status.

## Test QA

```bash
node scripts/run-sales-module-hardening-qa.cjs
```

Migration: `20261123170000_sales_hardening`, `20261123170100_sales_doc_seq_backfill`.

## Test QA (2026-11-23)

| Suite | Kết quả |
|-------|---------|
| `grant-sales-granular-permissions.cjs` | QA: lần 1 inserted 407, lần 2 inserted 0; SALE financial links = 0 |
| `test-sales-prompt3-http.ts` | **17/17** JWT thật + SalesController: 403 cả hai enforce; JSON batches/movements/PO/product không còn số giá vốn; tenant B 404 |
| `run-sales-module-hardening-qa.cjs` | **32/32** sau khi bỏ alias `order.write` |
| `run-sales-idempotency-regression.cjs` | **17/17** (Prompt 1) |
| `run-sales-reports-reconcile.cjs` | **5/5** unit + **18/18** (Prompt 2) |

## Chưa kiểm chứng

- Redact `unitCost` trên `GET stock/batches` và `stock/movements` (chưa bọc controller; product + báo cáo đã redact).
- HTTP supertest từng route với JWT thật (matrix hiện unit + service QA).
- Gán quyền chi tiết lên role DB prod (migration chỉ INSERT `permissions`; cần gán role MANAGER qua seed/HRM).