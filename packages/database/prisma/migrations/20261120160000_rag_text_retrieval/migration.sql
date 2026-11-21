-- Real PostgreSQL text index. No vector/embedding provider or fake embedding counts.
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE UNIQUE INDEX rag_kb_documents_id_knowledge_base_id_organization_id_key ON rag_kb_documents(id, knowledge_base_id, organization_id);
CREATE TABLE rag_kb_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  knowledge_base_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  start_offset INTEGER NOT NULL,
  content TEXT NOT NULL,
  search_vector TSVECTOR NOT NULL,
  CONSTRAINT rag_kb_chunks_document_scope_fkey FOREIGN KEY(document_id, knowledge_base_id, organization_id)
    REFERENCES rag_kb_documents(id, knowledge_base_id, organization_id) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE(document_id, chunk_index)
);
CREATE INDEX rag_kb_chunks_organization_id_knowledge_base_id_idx ON rag_kb_chunks(organization_id, knowledge_base_id);
CREATE INDEX rag_kb_chunks_search_vector_idx ON rag_kb_chunks USING GIN(search_vector);
CREATE FUNCTION rag_kb_document_counts() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.chunk_count := CASE WHEN length(trim(NEW.content)) = 0 THEN 0 ELSE (length(NEW.content) + 1279) / 1280 END;
  NEW.embedding_count := 0;
  RETURN NEW;
END $$;
CREATE FUNCTION rag_kb_index_document() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM rag_kb_chunks WHERE document_id=NEW.id;
  INSERT INTO rag_kb_chunks(id, document_id, knowledge_base_id, organization_id, chunk_index, start_offset, content, search_vector)
  SELECT NEW.id || ':' || n, NEW.id, NEW.knowledge_base_id, NEW.organization_id, n, n*1280+1,
    substring(NEW.content FROM n*1280+1 FOR 1600),
    setweight(to_tsvector('simple', unaccent(NEW.title)), 'A') ||
    setweight(to_tsvector('simple', unaccent(substring(NEW.content FROM n*1280+1 FOR 1600))), 'B')
  FROM generate_series(0, (length(NEW.content)-1)/1280) n WHERE length(trim(NEW.content))>0;
  RETURN NEW;
END $$;
CREATE TRIGGER rag_kb_document_counts BEFORE INSERT OR UPDATE OF content, title ON rag_kb_documents FOR EACH ROW EXECUTE FUNCTION rag_kb_document_counts();
CREATE TRIGGER rag_kb_document_index AFTER INSERT OR UPDATE OF content, title ON rag_kb_documents FOR EACH ROW EXECUTE FUNCTION rag_kb_index_document();
-- Backfill existing documents and remove previously simulated embedding counters.
UPDATE rag_kb_documents SET content=content, embedding_count=0;
