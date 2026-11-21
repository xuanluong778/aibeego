-- Internal page snapshots allow one visible Website summary document while retaining
-- the last successful version of individual pages if a later crawl fails.
ALTER TABLE rag_kb_sources ADD COLUMN website_pages JSONB NOT NULL DEFAULT '[]'::jsonb;
