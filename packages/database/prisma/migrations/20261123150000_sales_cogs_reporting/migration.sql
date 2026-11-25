-- Prompt 2: COGS snapshot trên allocation + timezone báo cáo

CREATE TYPE "SalesCostBasis" AS ENUM ('CONFIRMED', 'ESTIMATED', 'UNKNOWN');

ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "sales_report_timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh';

ALTER TABLE "sales_stock_movement_lines"
  ADD COLUMN IF NOT EXISTS "unit_cost" DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS "cost_amount" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "cost_basis" "SalesCostBasis";

-- Lịch sử: không suy diễn từ giá danh mục — chỉ backfill khi lô đã có unit_cost > 0
UPDATE "sales_stock_movement_lines" AS l
SET
  "unit_cost" = b."unit_cost",
  "cost_amount" = ROUND(l."quantity" * b."unit_cost", 2),
  "cost_basis" = 'CONFIRMED'::"SalesCostBasis"
FROM "sales_stock_batches" AS b
WHERE l."batch_id" = b."id"
  AND l."unit_cost" IS NULL
  AND b."unit_cost" > 0;

UPDATE "sales_stock_movement_lines"
SET "cost_basis" = 'UNKNOWN'::"SalesCostBasis"
WHERE "unit_cost" IS NULL;