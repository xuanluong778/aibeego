# Content AI: 20 credits per request

Applied locally on 22 November 2026. This policy supersedes the previous per-provider-call billing for `content_ai.generate` and `content_ai.suggest`.

Both prices are 20 credits. Each HTTP request shares one billing state: internal sequential or parallel AI calls, long content and premium chat models do not add extra credits. A rejected provider call does not consume credits; a successful retry charges once. Separate HTTP requests are billed separately. Administrators can still change either price through Credit costs; the once-per-request rule uses the configured database price.

Other feature prices, existing wallet balances and usage history were preserved. Monthly Basic/Pro/VIP allowances remain 5,000 / 15,000 / 45,000. Migration: `20261122070000_content_flat_request_price`.

Validation completed:

- API TypeScript check and web production build passed.
- Isolated database tests with a fake provider verified single, sequential and parallel calls, long premium requests, retries, rejected calls, separate requests, insufficient credit and unchanged non-content billing.
- Local API, worker and administrator UI show both rates as 20. Desktop and mobile checks passed without page errors. No real paid provider calls or customer wallet debits were used for testing.

Artifacts are in `tmp/content-flat20-20261122/`: test report, deployment record, before snapshot, read-only live verification, screenshots and rollback SQL/Compose override. Deployed images: `aibeego-api:content-flat20-20261122` and `aibeego-web:content-flat20-20261122`. The deployment script preserves prior images and automatically restores them if deployment fails.
