CREATE TABLE "sales_operation_idempotencies" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "operation" VARCHAR(32) NOT NULL,
  "idempotency_key" VARCHAR(128) NOT NULL,
  "payload_hash" VARCHAR(64) NOT NULL,
  "resource_id" TEXT,
  "result_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sales_operation_idempotencies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sales_operation_idempotencies_org_op_key_key"
  ON "sales_operation_idempotencies"("organization_id", "operation", "idempotency_key");

CREATE INDEX "sales_operation_idempotencies_organization_id_resource_id_idx"
  ON "sales_operation_idempotencies"("organization_id", "resource_id");

ALTER TABLE "sales_operation_idempotencies"
  ADD CONSTRAINT "sales_operation_idempotencies_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;