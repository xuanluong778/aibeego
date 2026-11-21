ALTER TABLE "sales_products" ADD COLUMN "model" VARCHAR(120);
CREATE INDEX "sales_products_organization_id_model_idx" ON "sales_products"("organization_id", "model");
-- Only explicit Model labels/attributes, never guess from titles or overwrite user input.
WITH candidates AS (
  SELECT w.product_id, w.organization_id, NULLIF(BTRIM(COALESCE(
    (SELECT a->>'option' FROM jsonb_array_elements(CASE WHEN jsonb_typeof(w.snapshot->'attributes')='array' THEN w.snapshot->'attributes' ELSE '[]'::jsonb END) a
      WHERE LOWER(BTRIM(a->>'name')) IN ('model','mã model','mã máy') AND LENGTH(BTRIM(a->>'option')) BETWEEN 1 AND 120 LIMIT 1),
    (regexp_match(regexp_replace(regexp_replace(COALESCE(w.snapshot->>'description',''), '</(p|li|div|tr|h[1-6])\s*>', E'\n', 'gi'), '<[^>]*>', ' ', 'g'), '(?i)(?:^|\n)[^\S\n]*(?:model|mã model|mã máy)[^\S\n]*[:：][^\S\n]*([^\n]{1,120})(?:\n|$)'))[1]
  )), '') AS value FROM woocommerce_products w
), unique_models AS (
 SELECT product_id, organization_id, MIN(value) AS value FROM candidates WHERE LENGTH(value) BETWEEN 1 AND 120
 GROUP BY product_id, organization_id HAVING COUNT(DISTINCT value)=1
)
UPDATE sales_products p SET model=c.value FROM unique_models c
WHERE p.id=c.product_id AND p.organization_id=c.organization_id AND p.model IS NULL;
