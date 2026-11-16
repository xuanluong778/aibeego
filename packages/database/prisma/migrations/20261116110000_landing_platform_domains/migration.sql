CREATE TABLE IF NOT EXISTS landing_page_platform_domains (
  landing_page_id TEXT PRIMARY KEY REFERENCES landing_pages(id) ON DELETE CASCADE,
  binding_id TEXT NOT NULL UNIQUE,
  label VARCHAR(63) NOT NULL CHECK (label = lower(label) AND label ~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$'),
  hostname VARCHAR(253) NOT NULL UNIQUE CHECK (hostname = label || '.aibeego.com'),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
