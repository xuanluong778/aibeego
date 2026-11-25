# Content billing: successful creation only

This policy replaces `docs/content-flat20-20261122.md` following the user's clarification on 22 November 2026.

- Creating a completed AI content result costs 20 credits, once for the entire result. Paid routes: POST `content-marketing/generate`, `generate-advanced`, and `opinion/generate`.
- All other Content editor actions are free, including suggestions, titles, rewriting, scoring, policy checks, media analysis and background URL analysis. Suggestions work with a zero credit balance. The suggestion price is displayed as 0 and cannot be edited to a paid rate.
- Generation reserves the configured creation price before running, then commits only after the handler completes with a nonempty AI content result. Provider failures, parsing failures, empty results, template fallback and postprocessing errors release the reservation without a usage debit. Internal provider calls bypass metering in the editor context.
- Existing plan quotas (5,000 / 15,000 / 45,000), unrelated feature prices and historical usage remain unchanged. Administrators can still customize the creation price.

Verification uses the real CreditLedger, CreditService, request interceptor and OpenAiService against an isolated QA database with a fake provider. All three creation routes charge 20 only on successful content results; 23 other editor routes charge zero. Tests also cover multiple internal calls, premium models, failed postprocessing, missing/invalid AI content, zero-balance suggestions and free background URL analysis. No paid provider calls or customer wallet debits were used for testing.

API TypeScript verification passed. Worker project type checking reports existing errors in `sla-breach-scan.ts`, `ads-autopilot.ts` and `ads-campaign-deploy.ts`; the changed worker module passed its isolated runtime test.

Local images: `aibeego-api:content-success20-20261122`, `aibeego-web:content-success20-20261122`, `aibeego-worker:content-success20-20261122`. Migration: `20261122080000_content_success_only`. Reports, before snapshot, deployment record and rollback files are stored in `tmp/content-success20-20261122/`.
