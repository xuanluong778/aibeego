# Prompt 4 — Bán hàng UI + QA (2026-11-23)

**Kết luận:** API + regression QA **PASS** trên `marketingspa_sales_idem_qa`. Nghiệm thu UI qua **harness fixture** (không image web production `:3000`).

## Đã triển khai

- Bộ chọn sản phẩm server + phân trang (đơn bán, PO, nhập/xuất kho): tên/model/SKU/barcode, bàn phím, giữ lựa chọn; hiển thị tồn bán được, ĐVT, giá.
- Dialog trả hàng: dòng, SL, lý do, disposition (RESTOCK/HOLD/SCRAP), preview nghĩa vụ hoàn, confirm `refundAmount: 0`; retry preview giữ `idempotencyKey`.
- Đơn: Đã thu / Đã hoàn / Còn phải thu / Còn phải hoàn (`amountCollected`, `amountRefunded`, `amountDue`, `amountRefundable`).
- Kiểm kê: phân trang DB đến hết `matched`, `scope` + `productCount` trên API/UI; không `take: 500` cắt âm thầm.

Phân quyền, idempotency và báo cáo Prompt 1–3 **không đổi**.

## QA thật (Docker + DB QA)

```bash
node scripts/run-sales-prompt4-qa.cjs
node scripts/run-sales-idempotency-regression.cjs
node scripts/run-sales-reports-reconcile.cjs
node scripts/run-sales-module-hardening-qa.cjs
node scripts/run-sales-prompt3-http.cjs
```

| Suite | Kết quả |
|-------|---------|
| `run-sales-prompt4-qa.cjs` | Kiểm kê 51, 2 dòng cùng SP, SCRAP không cộng tồn, preview/GET trả, CSV JWT, template import, Woo list redact |
| Idempotency | 17/17 |
| Báo cáo + allocation | 5/5 + 18/18 |
| Hardening | 32/32 (cleanup: xóa `stocktake_line` trước product) |
| Prompt 3 HTTP | 17/17 |

## Nghiệm thu browser

- **Đã chạy:** `scripts/test-sales-prompt4-ui.cjs` (esbuild trong Linux/Docker) + Cursor browser trên fixture API cổng 4019 — desktop + mobile 390px: picker phân trang 51 SP, 2 dòng cùng SP, dialog trả + retry khóa, tiền trên đơn, kiểm kê 51 sản phẩm / phạm vi.
- **Chưa:** click trên image web production `localhost:3000` (bundle cũ, không rebuild/deploy theo yêu cầu).

## Ghi chú vận hành

- Harness UI: `node scripts/test-sales-prompt4-ui.cjs` (cần esbuild platform trong container; trên Windows host thuần có thể fail `@esbuild/win32-x64`).
- Không migrate/deploy production.