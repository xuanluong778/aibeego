ALTER TABLE "sales_returns"
  ADD COLUMN IF NOT EXISTS "allocation_snapshot" JSONB;

ALTER TABLE "sales_stock_batches"
  ADD COLUMN IF NOT EXISTS "cost_basis" "SalesCostBasis";

UPDATE "sales_stock_batches"
SET "cost_basis" = 'CONFIRMED'::"SalesCostBasis"
WHERE "cost_basis" IS NULL AND "unit_cost" > 0;

UPDATE "sales_stock_batches"
SET "cost_basis" = 'UNKNOWN'::"SalesCostBasis"
WHERE "cost_basis" IS NULL AND "unit_cost" <= 0;