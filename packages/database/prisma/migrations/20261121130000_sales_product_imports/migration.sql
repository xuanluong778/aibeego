CREATE TABLE "sales_product_imports" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "client_token" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "file_hash" TEXT NOT NULL,
  "sheet_meta" JSONB NOT NULL,
  "workbook" JSONB,
  "sheet_index" INTEGER,
  "mapping" JSONB,
  "options" JSONB,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "preview_version" INTEGER NOT NULL DEFAULT 0,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sales_product_imports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sales_product_imports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "sales_product_imports_status_check" CHECK ("status" IN ('DRAFT','PREVIEW','RUNNING','COMPLETED'))
);
CREATE UNIQUE INDEX "sales_product_imports_organization_id_client_token_key" ON "sales_product_imports"("organization_id", "client_token");
CREATE UNIQUE INDEX "sales_product_imports_id_organization_id_key" ON "sales_product_imports"("id", "organization_id");
CREATE INDEX "sales_product_imports_organization_id_created_at_idx" ON "sales_product_imports"("organization_id", "created_at");
CREATE TABLE "sales_product_import_rows" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "import_id" TEXT NOT NULL,
  "row_number" INTEGER NOT NULL,
  "cells" JSONB NOT NULL,
  "status" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "target_id" TEXT,
  "product_id" TEXT,
  "errors" JSONB NOT NULL,
  "warnings" JSONB NOT NULL,
  "message" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "sales_product_import_rows_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sales_product_import_rows_import_id_organization_id_fkey" FOREIGN KEY ("import_id", "organization_id") REFERENCES "sales_product_imports"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "sales_product_import_rows_number_check" CHECK ("row_number" > 0 AND "attempts" >= 0),
  CONSTRAINT "sales_product_import_rows_status_check" CHECK ("status" IN ('READY','INVALID','SKIPPED','PENDING','CREATED','UPDATED','ERROR')),
  CONSTRAINT "sales_product_import_rows_action_check" CHECK ("action" IN ('CREATE','UPDATE','SKIP','ERROR'))
);
CREATE UNIQUE INDEX "sales_product_import_rows_import_id_row_number_key" ON "sales_product_import_rows"("import_id", "row_number");
CREATE INDEX "sales_product_import_rows_organization_id_import_id_status_idx" ON "sales_product_import_rows"("organization_id", "import_id", "status");
