# Prompt 1 — Báo cáo nghiệm thu (chốt)

**Kết luận:** `regression service PASS` — **còn thiếu nghiệm thu HTTP/browser đầy đủ**.

**DB QA:** `marketingspa_sales_idem_qa` (`marketingspa-postgres`). Guard: `scripts/sales-idem-qa-env.cjs`.

**Lệnh chuẩn (Docker, không dùng `with-root-env` mù):**

```bash
docker run --rm --network aibeego_default -v "<repo>:/app" -w /app \
  -e DATABASE_URL=postgresql://marketingspa:***@postgres:5432/marketingspa_sales_idem_qa?schema=public \
  -e NODE_OPTIONS=--require /app/node_modules/.pnpm/reflect-metadata@0.2.2/node_modules/reflect-metadata \
  node:20-bookworm-slim bash -c "corepack enable && pnpm --filter @marketingspa/database exec tsx ../../scripts/test-sales-idempotency-regression.ts"
```

Sau `pnpm build` trong `apps/api` (test load từ `dist/`).

**Regression sau Prompt 2 (2026-11-23):** `node scripts/run-sales-idempotency-regression.cjs` trên QA — **17/17 PASS** (runner dùng `tsx` trực tiếp, không phụ thuộc `pnpm` trong container).

## Phân loại kiểm tra

| Kiểm tra | Loại | Kết quả |
|---------|------|---------|
| PO nhận 3 + retry, 6+6, rollback, concurrent, 409, trả, dual line, payment/refund idem | **Thực chạy service** | PASS |
| `receiveGoods` / `addPayment` thiếu key → 400 | **Thực chạy service** | PASS |
| Org B không đọc PO A | **Thực chạy service** | PASS |
| Frontend giữ key sau lỗi / key mới sau success | **Mô phỏng** (Map + nonce, không browser) | PASS |
| Legacy outbound ambiguous `findMany>1` | **DB P2002** (partial unique) + **đọc source** | PASS |
| `pnpm test:sales-idempotency-http` (400/409 qua HTTP server fixture) | **Thực chạy HTTP** (mapping, không SalesController JWT) | PASS |
| Supertest qua `SalesController` đầy đủ JWT/guard | — | **CHƯA** |
| E2E browser timeout / commit-before-response | — | **CHƯA** |

## Unique `sales_stock_movements` (partial OUTBOUND)

Index: `(organization_id, reference_id, product_id)` khi `type=OUTBOUND`, `reference_type=SALES_ORDER`.

- **Cho phép hợp lệ:** hai dòng đơn cùng `productId` — `reference_id = orderId::orderItemId` khác nhau (kiểm thử trong regression Prompt 2 / idem dual-line).
- **Chặn trùng:** hai OUTBOUND legacy cùng `reference_id = orderId` + cùng SP (idempotent đơn dòng).
- **Không ảnh hưởng:** RETURN_IN / INBOUND / reference khác.

## Chưa làm trong lượt này

- Restart/deploy production (cố ý không thực hiện).
- Container `marketingspa-api` live phải **rebuild local** nếu cần thử tay trên UI (ngoài phạm vi nghiệm thu).