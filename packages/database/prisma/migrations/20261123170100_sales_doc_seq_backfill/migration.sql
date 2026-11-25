-- Khởi tạo sequence từ mã hiện có (tránh trùng sau khi bỏ count+1)
INSERT INTO sales_document_sequences (organization_id, doc_type, period_key, last_value)
SELECT organization_id, 'SALES_ORDER', SUBSTRING(code FROM 4 FOR 8),
  MAX(CAST(SUBSTRING(code FROM 13) AS INT))
FROM sales_orders
WHERE code ~ '^SO-[0-9]{8}-[0-9]+$'
GROUP BY organization_id, SUBSTRING(code FROM 4 FOR 8)
ON CONFLICT (organization_id, doc_type, period_key)
DO UPDATE SET last_value = GREATEST(sales_document_sequences.last_value, EXCLUDED.last_value);

INSERT INTO sales_document_sequences (organization_id, doc_type, period_key, last_value)
SELECT organization_id, 'STOCKTAKE', SUBSTRING(code FROM 4 FOR 8),
  MAX(CAST(SUBSTRING(code FROM 13) AS INT))
FROM sales_stocktakes WHERE code ~ '^KK-[0-9]{8}-[0-9]+$'
GROUP BY organization_id, SUBSTRING(code FROM 4 FOR 8)
ON CONFLICT (organization_id, doc_type, period_key)
DO UPDATE SET last_value = GREATEST(sales_document_sequences.last_value, EXCLUDED.last_value);

INSERT INTO sales_document_sequences (organization_id, doc_type, period_key, last_value)
SELECT organization_id, 'RETURN', SUBSTRING(code FROM 4 FOR 8),
  MAX(CAST(SUBSTRING(code FROM 13) AS INT))
FROM sales_returns WHERE code ~ '^RT-[0-9]{8}-[0-9]+$'
GROUP BY organization_id, SUBSTRING(code FROM 4 FOR 8)
ON CONFLICT (organization_id, doc_type, period_key)
DO UPDATE SET last_value = GREATEST(sales_document_sequences.last_value, EXCLUDED.last_value);

INSERT INTO sales_document_sequences (organization_id, doc_type, period_key, last_value)
SELECT organization_id, 'PURCHASE_ORDER', SUBSTRING(code FROM 4 FOR 8),
  MAX(CAST(SUBSTRING(code FROM 13) AS INT))
FROM sales_purchase_orders WHERE code ~ '^PO-[0-9]{8}-[0-9]+$'
GROUP BY organization_id, SUBSTRING(code FROM 4 FOR 8)
ON CONFLICT (organization_id, doc_type, period_key)
DO UPDATE SET last_value = GREATEST(sales_document_sequences.last_value, EXCLUDED.last_value);