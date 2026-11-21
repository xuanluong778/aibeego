CREATE TABLE "woocommerce_connections" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organization_id" TEXT NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "website_url" TEXT NOT NULL,
  "credentials" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "woocommerce_connections_id_organization_id_key" ON "woocommerce_connections"("id", "organization_id");
CREATE UNIQUE INDEX "woocommerce_connections_organization_id_website_url_key" ON "woocommerce_connections"("organization_id", "website_url");
CREATE UNIQUE INDEX "sales_products_id_organization_id_key" ON "sales_products"("id", "organization_id");
ALTER TABLE "sales_product_imports" ADD COLUMN "woo_connection_id" TEXT;
ALTER TABLE "sales_product_imports" ADD CONSTRAINT "sales_import_woo_connection_fkey" FOREIGN KEY ("woo_connection_id", "organization_id") REFERENCES "woocommerce_connections"("id", "organization_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales_product_import_rows" ADD COLUMN "source" JSONB;
CREATE TABLE "woocommerce_products" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "connection_id" TEXT NOT NULL,
  "external_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "woo_product_connection_fkey" FOREIGN KEY ("connection_id", "organization_id") REFERENCES "woocommerce_connections"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "woo_product_product_fkey" FOREIGN KEY ("product_id", "organization_id") REFERENCES "sales_products"("id", "organization_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "woocommerce_products_connection_id_external_id_key" ON "woocommerce_products"("connection_id", "external_id");
CREATE INDEX "woocommerce_products_organization_id_product_id_idx" ON "woocommerce_products"("organization_id", "product_id");
