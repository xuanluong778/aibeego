# Retrieval from shared knowledge bases — 20/11/2026

Implemented in repository source and tested against disposable local PostgreSQL/Redis. **No production deployment and no migration of the running application database.** Existing unrelated working-tree changes were retained.

## Current retrieval mode

The previous Reindex operation assigned `embeddingCount = chunkCount` without generating vectors. No embedding generation endpoint, provider configuration or vector retrieval existed in rag-kb. The implementation now explicitly uses **PostgreSQL full-text search**, not vector embeddings. UI/API identify text retrieval; embedding counters and totals are zero. There are no pretend embeddings.

Migration **20261120160000_rag_text_retrieval** adds `rag_kb_chunks`, a real `tsvector` GIN index and the PostgreSQL `unaccent` extension. Migration role needs permission to install that extension. It depends on the earlier `20261120140000_rag_external_sources` migration and existing rag-kb tables. There are no destructive resets or migration downs.

Document insert/content/title edits rebuild chunks and actual chunk counts in the same database transaction, including Website/Fanpage synchronization, manual imports and edits. Existing documents are backfilled by the migration and previous simulated embedding counts are cleared. Reindex rebuilds this actual index. Source removal/document deletion cannot leave retrievable orphan chunks.

Chunks are 1,600 characters, stride 1,280 (320-character overlap). Query text is normalized for Vietnamese, common conversational stop words are removed, and short follow-ups can carry terms from the preceding user message. SQL matches and ranks the indexed chunks. Each question receives at most five excerpts (at most two per document), each bounded to 2,100 characters including adjacent context. It does not send the whole Website or KB to the model. This is lexical search; paraphrases/synonyms without matching vocabulary can return insufficient evidence.

## Scope and connected channels

Retrieval checks organization, the bot's current `knowledgeBaseId`, document readiness and source enabled/not-deleted state, with matching tenant keys in every join. A linked bot never falls back to stale legacy sources when its KB yields no matches. UI Test Search can search the authenticated organization's bases, but chatbot replies are restricted to the linked base.

The Website widget, Landing Page and Facebook reply pipelines now call the same retrieval/grounding path. Conversation history uses recent turns instead of the oldest twenty. Landing Page publish readiness counts available shared documents without loading entire Websites into the reply context, and does not widen an invalid legacy source selection.

Zalo OA previously had a KB selection/auto-reply setting but no corresponding knowledge reply handler. A handler is now registered after the existing authenticated Zalo ingress. It requires an active, unpaused OA connection, its explicitly linked active bot/KB, and the bot's Zalo auto-reply flag. Durable message uniqueness rejects duplicate events; staff takeover and switches are rechecked before sending. It uses the existing fresh-token helper and sender, with monthly usage guards. API restart during its asynchronous handling can still interrupt a reply; this task does not introduce a durable outbound chatbot retry queue. Unimplemented channel adapters such as Telegram were not represented as working integrations.

Before committing/sending an answer, a further check verifies that selected documents are still active with the same versions and the bot is still linked to that base. A source changed/disabled/removed during AI processing produces a retry message instead of stale evidence. There is no retrieval cache needing manual invalidation.

## Grounding and provenance

Documents/history are explicitly delimited untrusted data. Document instructions cannot change model roles or authorize actions. The reply model has no tools. It must return structured selections with exact quotations and known chunk IDs. Unknown citations, fabricated quotations, unsupported numbers, missing evidence or malformed output are rejected. Factual replies are assembled from verified source quotations, rather than unverified generated prose. URL and update timestamps are kept in evidence metadata, and ordinary source links are included in replies/search results.

Different numeric values under the same explicit price/tuition/hotline label in separate documents are flagged conservatively as conflicting. The model can also flag conflicts that this lexical check cannot identify; conflict responses show cited variants and ask for confirmation. This is not a universal semantic contradiction detector, and source accuracy itself cannot be independently guaranteed by retrieval.

Offer dates/conditions are preserved in citations and displayed with a validity warning. Explicit end dates already passed are not treated as current offers. If a validity date is absent from the retrieved context, current applicability is not confirmed. Complex date phrasing and conditions outside bounded excerpts may require manual verification. Static knowledge is never used to affirm current stock, sales volume or revenue; these questions request a live transactional lookup/staff check. The internal assistant's knowledge prompt carries the same restrictions while its existing live business tools remain available.

Removed-source manual edits are retained as **disabled documents with provenance**, available for inspection but excluded from retrieval/export. This deliberately supersedes the earlier behavior that detached them as active standalone documents. Disabling/reindexing/editing cannot reactivate a source implicitly.

## Markdown export

The KB panel includes **Xuất .md UTF-8**, backed by authenticated `GET /rag-kb/:id/export.md` with a private/no-store download response. It exports only ready documents from enabled sources, plus the organization's business profile, into business information, products/services, policies, FAQ and other-knowledge sections. Source URLs and source/profile update dates are included; unavailable sections say so. Existing offer dates remain unchanged. Classification uses headings/titles, not an AI claim of completeness. HTML is escaped. Markdown is an export only and is never required by retrieval/chatbot operation.

## Verification and remaining external checks

Validated schema, shared/database builds and full API build. New knowledge-source/export UI and hooks typecheck in isolation. Checking the full knowledge page encounters existing duplicate dictionary keys in `i18n/dictionaries/en.ts` and `vi.ts`; those unrelated files were not edited. Existing broader Worker/Web build failures remain as documented in the previous source-ingestion handoff.

`scripts/prepare-rag-source-qa.cjs` builds a disposable legacy database on loopback 15489 and applies both actual SQL migrations. No customer data is used. `test-rag-external-sources.cjs` covers actual BullMQ/Redis ingestion and source lifecycle. `test-rag-chatbot-retrieval.cjs` covers collected content beyond the old leading-document truncation, persisted chunks/index counts, all four reply paths, source updates/off/removal, stale version rejection, tenant/linked-KB isolation, URL evidence, unsupported numbers/quotes, conflicts, expired offers, current-stock/sales refusal and UTF-8 Markdown contents/access control. `test-rag-source-ui.cjs` exercises the actual UI/CSS and UTF-8 `.md` download in headless Edge, including mobile rendering and source controls.

The end-to-end suite mocks OpenAI/Facebook/Zalo transports with synthetic data. A separate opt-in **live OpenAI check passed** using only a fictional tuition/offer-date fixture (`scripts/test-rag-grounding-live-ai.cjs`); no customer conversation or knowledge was sent. Live Facebook/Zalo credentials/scopes, webhook delivery, OA tier/send limits and production extension permissions have not been verified. No message was sent to a real customer. End-to-end production verification remains for an explicitly approved release.

Test commands after building API/database/shared and preparing the isolated QA services:

```powershell
node scripts/prepare-rag-source-qa.cjs
node scripts/test-rag-external-sources.cjs
node scripts/test-rag-chatbot-retrieval.cjs
pnpm.cmd exec tsc -p scripts/rag-source-qa/tsconfig.ui.json
node scripts/test-rag-source-ui.cjs
```
