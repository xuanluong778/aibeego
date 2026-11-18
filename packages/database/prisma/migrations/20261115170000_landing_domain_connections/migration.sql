CREATE TABLE IF NOT EXISTS landing_page_domain_connections (
  landing_page_id TEXT PRIMARY KEY REFERENCES landing_pages(id) ON DELETE CASCADE,
  binding_id TEXT NOT NULL UNIQUE,
  hostname VARCHAR(253) NOT NULL CHECK (hostname = lower(hostname)),
  verification_token VARCHAR(64) NOT NULL,
  ownership_verified_at TIMESTAMPTZ(3),
  verified_at TIMESTAMPTZ(3),
  tls_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  tls_checked_at TIMESTAMPTZ(3),
  last_checked_at TIMESTAMPTZ(3),
  last_error VARCHAR(1000),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS landing_domain_hostname_idx ON landing_page_domain_connections(hostname);
-- Multiple pending claims cannot reserve someone else's hostname forever.
-- Only a DNS-verified connection owns the unique active hostname.
CREATE UNIQUE INDEX IF NOT EXISTS landing_domain_verified_hostname_key
  ON landing_page_domain_connections(hostname) WHERE verified_at IS NOT NULL;
