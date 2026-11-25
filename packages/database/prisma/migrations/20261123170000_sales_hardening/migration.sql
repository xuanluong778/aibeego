-- Atomic document sequences per org / doc type / day
CREATE TABLE IF NOT EXISTS sales_document_sequences (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  doc_type VARCHAR(32) NOT NULL,
  period_key VARCHAR(16) NOT NULL,
  last_value INT NOT NULL DEFAULT 0,
  PRIMARY KEY (organization_id, doc_type, period_key)
);

-- Granular sales permissions (idempotent seed rows)
INSERT INTO permissions (id, code, name, module, created_at)
VALUES
  (gen_random_uuid(), 'sales.inventory.read', 'Xem tồn kho / lô', 'sales', NOW()),
  (gen_random_uuid(), 'sales.inventory.write', 'Nhập/xuất/điều chỉnh kho', 'sales', NOW()),
  (gen_random_uuid(), 'sales.receive.write', 'Nhận hàng PO', 'sales', NOW()),
  (gen_random_uuid(), 'sales.stocktake.write', 'Kiểm kê kho', 'sales', NOW()),
  (gen_random_uuid(), 'sales.payment.collect', 'Thu tiền đơn bán', 'sales', NOW()),
  (gen_random_uuid(), 'sales.payment.refund', 'Hoàn tiền đơn bán', 'sales', NOW()),
  (gen_random_uuid(), 'sales.cost.view', 'Xem giá vốn', 'sales', NOW()),
  (gen_random_uuid(), 'sales.profit.view', 'Xem lợi nhuận / COGS báo cáo', 'sales', NOW()),
  (gen_random_uuid(), 'sales.report.export', 'Xuất báo cáo bán hàng CSV', 'sales', NOW())
ON CONFLICT (code) DO NOTHING;