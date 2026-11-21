# Website / Facebook sources in Settings → Knowledge

Implemented in repository source and validated locally on 20/11/2026. **Not deployed to production.** No existing application database or running application containers were changed by this task. PostgreSQL/Redis test containers were separate, with synthetic organizations and content.

## Behavior

Each knowledge base now has a Website / Facebook Fanpage panel. Enter a public HTTP(S) URL, or choose a Page from the organization's existing Auto Post Facebook connections. No file creation/upload is required. A BullMQ job collects content and persists each successful item immediately. Polling shows queued/running/completed/partial/error states, processed/success/error counts, last attempt and last successful update. Users can resync, disable/enable or remove a source.

Disabling cancels the current generation and excludes imported documents from search and shared chatbot retrieval. Reindexing or editing cannot silently re-enable them. Removing a source deletes generated documents; documents edited manually are detached and kept. Resync preserves manual edits, updates changed generated content and does not duplicate an existing URL/post ID. Failed updates keep previous successful documents. Missing/exhausted jobs become retryable errors. Jobs contain IDs only; tokens never enter BullMQ payloads, documents, error text or source responses.

## Source and schema changes

- API: `rag-source.service.ts`, source routes in `rag-kb.controller.ts`, DTOs and QueueModule provider. All source/KB/Page lookups are scoped by authenticated organization. Existing rag-kb edits and unrelated working-tree changes were retained.
- Worker: `processors/rag-source-sync.ts`, queue registration in worker entry point. Uses existing Prisma client, Redis queue configuration and AES-GCM token helper. Requests are sequential. Run IDs plus transactional source locks prevent stale/cancelled jobs from committing content.
- Collector: `packages/shared/src/rag-source-collect.ts`. Reuses shared SSRF fetcher; adds an optional hostname restriction checked on every redirect. Shared fetcher already validates A/AAAA, rechecks DNS, pins the connection IP and limits time/bytes/redirects.
- UI: `knowledge-source-panel.tsx`, embedded in the existing `KnowledgeBasePage` used by `/settings?tab=knowledge`. Existing manual import/upload flows remain available.
- Schema: `RagKbSource`; nullable provenance, hash, fetched/source timestamps and manual-edit timestamp on `RagKbDocument`. Compound foreign keys enforce source/KB/organization consistency. Legacy documents remain independent of sources.

Migration: **`20261120140000_rag_external_sources`**. Additive, no data reset/backfill or migration down. Requires existing `rag_knowledge_bases` and `rag_kb_documents` tables. Review/deploy pre-existing pending migrations separately; this task does not resolve unrelated migration drift. When a release is approved, generate Prisma clients, build shared/database/API/worker/web, apply migrations before running the new API and worker, and use the same Redis URL/prefix and encryption key as the existing Facebook connections.

## Readable website Markdown (local update)

Website collection now converts bounded HTML into Markdown with headings, paragraphs, lists, tables and absolute links. It removes navigation, forms, scripts, tracking images, empty image links and exact duplicated responsive blocks. Prices and promotion dates remain source text. Each website keeps one summary document, with a source table of contents and per-page update dates. Successful resync updates the same document and its real text chunks; manual edits and previous successful pages still remain protected. No additional database migration is required for this formatting update.

The document dialog opens a rendered preview and provides a Markdown edit tab plus UTF-8 `.md` download of the current editor content. Raw HTML is not rendered, remote images are disabled and unsafe link schemes are filtered. Switching tabs preserves edits. Existing manually edited flattened documents are not rewritten automatically.

Validation: `scripts/test-rag-markdown.cjs` (HTML structure, dates/prices, deduplication, script/navigation removal), `scripts/test-rag-markdown-ui.cjs` (real component in Edge: preview/edit/download/mobile and unsafe content), plus the existing website-summary and chatbot-retrieval integration suites against a disposable PostgreSQL database. Local API/worker source synchronization was verified against the selected website; production was not deployed.

## Limits

- Website: at most 25 fetch attempts per run, depth 2, at most 150 discovered candidates, exact hostname, standard-port input, one request per second. Follows links for introduction, products/services, contact, FAQ and policies. Redirects to a different hostname are rejected, including apex ↔ www; use the final hostname in the source URL. Each page is bounded to 750 KB, 12 seconds and 3 redirects.
- HTML extraction only: no JavaScript/browser rendering, login bypass, sitemap expansion or exhaustive site indexing. Discovery is bounded and does not promise all pages on a large site. Content is normalized and capped at 100,000 characters/document.
- Facebook: existing connected Page access token only, respecting connection status/expiry; reads Page metadata and Page-owned `/posts` only. No inbox, comments or visitor feed. Four cursor pages of up to 25 posts (100 posts/run), Page metadata in addition. Only cursor values are used; Facebook `paging.next` URLs are never fetched. Fields are explicit, redirects forbidden, response limit 1 MB and deadline 15 seconds. Permissions and available content remain subject to Meta grants and API version configured by `META_API_VERSION`.
- Up to 20 external sources/KB and 500 documents/KB for collector insertions. Manual-import limits remain those of the existing service. No periodic automatic resync schedule: sync occurs on source addition and explicit resync. No deletion of older documents merely because an upstream page/post disappears or falls outside the bounded window.
- Uses current rag-kb text/token/chunk estimates; does not introduce a new embedding provider or claim real vector embeddings.

## Verification

`scripts/prepare-rag-source-qa.cjs` builds a legacy schema in a disposable PostgreSQL instance on loopback 15489 and applies the actual SQL migration. It never uses the application DATABASE_URL. Test Redis uses loopback 16489. `scripts/test-rag-external-sources.cjs` exercises actual PostgreSQL/BullMQ, API services and worker processing, with synthetic collectors/Meta responses and no customer tokens/data.

Verified URL/hash normalization; private/metadata/IPv6/credential rejection; DNS rebind and private redirect blocking; pinned transport; bounded linked-page discovery; duplicate sources/jobs/documents; pagination without following arbitrary URLs; organization isolation including compound FK rejection; encrypted token reuse; permission/expired-token errors; partial results; preservation of last good content and manual edits; disabling while a job is running; search/reindex exclusion; removal preserving edited documents; missing-job recovery and queue failure.

`scripts/test-rag-source-ui.cjs` bundles the real component and app CSS in a synthetic API harness, runs Chromium/Edge, checks Website/Fanpage add, polling/partial/error states, sync/toggle/remove and mobile overflow, and saves screenshots under `tmp/rag-source-qa/`. No browser runtime errors. `scripts/rag-source-qa/tsconfig.ui.json` typechecks the new UI and its dependencies in isolation.

Prisma schema validation, shared build, database build and **full API build pass**. New worker processor and UI typecheck independently. Full worker build is blocked by existing SLA assignment/Google Ads/automation type errors outside this task. Full web typecheck reports existing sales/admin/i18n and other unrelated errors. Those files were left unchanged. Live Facebook account calls were not performed; permission/token/pagination behavior was verified with synthetic Graph responses.

Useful commands after dependencies and isolated test services are available:

```powershell
node scripts/prepare-rag-source-qa.cjs
node scripts/test-rag-external-sources.cjs
pnpm.cmd exec tsc -p scripts/rag-source-qa/tsconfig.ui.json
node scripts/test-rag-source-ui.cjs
```
