-- Already present in the running database; keep fresh installs equally strict.
CREATE UNIQUE INDEX IF NOT EXISTS landing_pages_custom_domain_key ON landing_pages(custom_domain);
