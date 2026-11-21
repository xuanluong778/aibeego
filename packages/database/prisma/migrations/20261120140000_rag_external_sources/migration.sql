-- Additive migration; legacy uploaded/text documents remain independent of external sources.
CREATE UNIQUE INDEX "rag_knowledge_bases_id_organization_id_key" ON "rag_knowledge_bases"("id", "organization_id");
CREATE TABLE "rag_kb_sources" (
  "id" TEXT PRIMARY KEY,
  "organization_id" TEXT NOT NULL,
  "knowledge_base_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL CHECK (kind IN ('WEBSITE', 'FACEBOOK')),
  "source_key" VARCHAR(2000) NOT NULL,
  "url" VARCHAR(2000),
  "facebook_page_id" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "run_id" TEXT,
  "processed" INTEGER NOT NULL DEFAULT 0,
  "succeeded" INTEGER NOT NULL DEFAULT 0,
  "failed" INTEGER NOT NULL DEFAULT 0,
  "errors" JSONB NOT NULL DEFAULT '[]',
  "last_error" VARCHAR(500),
  "last_attempt_at" TIMESTAMP(3),
  "last_synced_at" TIMESTAMP(3),
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "rag_kb_sources_knowledge_base_id_organization_id_fkey" FOREIGN KEY (knowledge_base_id, organization_id) REFERENCES rag_knowledge_bases(id, organization_id) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE (organization_id, knowledge_base_id, source_key),
  UNIQUE (id, knowledge_base_id, organization_id)
);
CREATE INDEX "rag_kb_sources_organization_id_knowledge_base_id_status_idx" ON rag_kb_sources(organization_id, knowledge_base_id, status);
ALTER TABLE rag_kb_documents
  ADD COLUMN source_id TEXT,
  ADD COLUMN external_id VARCHAR(2000),
  ADD COLUMN content_hash VARCHAR(64),
  ADD COLUMN source_updated_at TIMESTAMP(3),
  ADD COLUMN synced_at TIMESTAMP(3),
  ADD COLUMN manual_edited_at TIMESTAMP(3);
CREATE UNIQUE INDEX "rag_kb_documents_source_id_external_id_key" ON rag_kb_documents(source_id, external_id);
ALTER TABLE rag_kb_documents ADD CONSTRAINT "rag_kb_documents_source_id_knowledge_base_id_organization_id_fkey"
  FOREIGN KEY (source_id, knowledge_base_id, organization_id) REFERENCES rag_kb_sources(id, knowledge_base_id, organization_id) ON DELETE CASCADE ON UPDATE CASCADE;
